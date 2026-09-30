import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments } from "@/db/schema/payments";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/lib/audit";
import { priceCart, type PricingResult } from "@/modules/checkout/pricing";
import { buildOrderSnapshot } from "./order-snapshot";
import type { PlaceOrderInput } from "./schemas";
import * as cartRepo from "@/modules/cart/repo";
import type { Owner } from "@/modules/cart/identity";
import { generateOrderNumber } from "@/modules/orders/order-number";
import { generateAccessToken, hashAccessToken } from "@/modules/orders/access-token";
import { assertTransition } from "@/modules/orders/state-machine";
import { requireStripeClient, stripeClient } from "@/lib/stripe";
import { sendMail } from "@/lib/mailer";
import { orderConfirmationEmail } from "@/modules/orders/emails";
import { decryptPii, encryptPii } from "@/lib/crypto";
import * as vouchers from "@/modules/vouchers/service";
import { notifyOrder } from "@/modules/notifications/service";

export interface QuoteResult extends PricingResult {
  shippingMethodName: string;
  taxCountry: string;
  voucher: vouchers.VoucherSummary | null;
}

const ownerUserId = (owner: Owner): string | null => (owner.kind === "user" ? owner.userId : null);

export async function quote(
  owner: Owner,
  country: string,
  shippingMethodCode: string,
  voucherCode?: string,
): Promise<QuoteResult | null> {
  const cart = await cartRepo.findCart(owner);
  if (!cart) return null;
  const [lineRows, methods, taxRates, voucher] = await Promise.all([
    cartRepo.getLines(cart.id),
    cartRepo.getShippingMethods(),
    cartRepo.getTaxRates(),
    voucherCode ? vouchers.evaluateForCart(voucherCode, ownerUserId(owner), cart.id) : null,
  ]);
  const method = methods.find((m) => m.code === shippingMethodCode && m.isActive);
  if (!method) throw new AppError("VALIDATION", "Unknown shipping method.");
  const available = lineRows.filter((r) => r.productStatus === "active" && r.stockQty > 0);
  if (available.length === 0) return null;
  const tax = taxRates.find((r) => r.countryCode === country);
  const pricing = priceCart({
    lines: available.map((r) => ({
      variantId: r.variantId,
      unitPriceCents: r.unitPriceCents,
      quantity: r.qty,
    })),
    voucher: voucher?.pricingVoucher,
    shippingMethod: { priceCents: method.priceCents, freeOverCents: method.freeOverCents },
    taxRateBps: tax?.rateBps ?? 0,
  });
  return {
    ...pricing,
    shippingMethodName: method.name,
    taxCountry: country,
    voucher: voucher ? vouchers.summarize(voucher, pricing) : null,
  };
}

async function findIdempotentOrder(key: string): Promise<{ id: string; number: string } | null> {
  const rows = await db.execute<{ order_id: string; number: string }>(sql`
    select o.id, o.number from idempotency_keys k
    join orders o on o.idempotency_key = k.key
    where k.key = ${key} and k.scope = 'checkout.place'
    limit 1
  `);
  return rows[0] ? { id: rows[0].order_id, number: rows[0].number } : null;
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  clientSecret: string | null;
  status: string;
  accessToken: string | null;
}

export async function placeOrder(
  owner: Owner,
  input: PlaceOrderInput,
  idempotencyKey: string,
  ip?: string | null,
): Promise<PlaceOrderResult> {
  // Housekeeping must not add seconds to the shopper's click; the daily cron is the backstop.
  void expireStaleOrders().catch(() => logger.warn({}, "stale order expiry failed"));

  const [existing, cart] = await Promise.all([findIdempotentOrder(idempotencyKey), cartRepo.findCart(owner)]);
  if (existing) {
    const payment = await db.execute<{ stripe_payment_intent_id: string | null }>(sql`
      select stripe_payment_intent_id from payments where order_id = ${existing.id} limit 1
    `);
    const intentId = payment[0]?.stripe_payment_intent_id;
    let clientSecret: string | null = null;
    if (intentId) {
      const stripe = stripeClient();
      const intent = await stripe?.paymentIntents.retrieve(intentId).catch(() => null);
      clientSecret = intent?.client_secret ?? null;
    }
    return { orderId: existing.id, orderNumber: existing.number, clientSecret, status: "pending_payment", accessToken: null };
  }

  if (!cart) throw new AppError("VALIDATION", "Your cart is empty.");

  const [lineRows, methods, taxRates, voucher] = await Promise.all([
    cartRepo.getLines(cart.id),
    cartRepo.getShippingMethods(),
    cartRepo.getTaxRates(),
    input.voucherCode ? vouchers.evaluateForCart(input.voucherCode, ownerUserId(owner), cart.id) : null,
  ]);
  const unavailable = lineRows.filter((r) => r.productStatus !== "active" || r.stockQty <= 0);
  if (lineRows.length === 0) throw new AppError("VALIDATION", "Your cart is empty.");
  if (unavailable.length > 0) {
    throw new AppError("VALIDATION", `Some items are no longer available: ${unavailable.map((l) => l.title).join(", ")}. Remove them to continue.`);
  }
  const method = methods.find((m) => m.code === input.shippingMethodCode && m.isActive);
  if (!method) throw new AppError("VALIDATION", "Unknown shipping method.");
  const tax = taxRates.find((r) => r.countryCode === input.address.country);

  const priced = priceCart({
    lines: lineRows.map((r) => ({
      variantId: r.variantId,
      unitPriceCents: r.unitPriceCents,
      quantity: r.qty,
    })),
    voucher: voucher?.pricingVoucher,
    shippingMethod: { priceCents: method.priceCents, freeOverCents: method.freeOverCents },
    taxRateBps: tax?.rateBps ?? 0,
  });
  // A code the shopper typed must apply, or the order is not placed: never
  // charge a total they did not see.
  const voucherSummary = voucher ? vouchers.summarize(voucher, priced) : null;
  if (voucherSummary && !voucherSummary.applied) {
    throw new AppError("VALIDATION", voucherSummary.message ?? "This code cannot be used.");
  }
  const voucherId = voucher && voucherSummary?.applied ? voucher.rule!.id : null;
  const pricedById = new Map(priced.lines.map((l) => [l.variantId, l]));
  const snapshot = buildOrderSnapshot(
    lineRows.map((r) => ({
      variantId: r.variantId,
      title: r.title,
      sku: `SKU-${r.variantId.slice(0, 8)}`,
      quantity: r.qty,
      unitPriceCents: r.unitPriceCents,
      priced: pricedById.get(r.variantId)!,
    })),
    priced,
    method.code,
  );
  void snapshot;

  const accessToken = owner.kind === "guest" ? generateAccessToken() : null;
  let orderNumber = "";
  const orderId = await db.transaction(async (tx) => {
    let placed = false;
    let orderRowId: string | null = null;
    for (let attempt = 0; attempt < 3 && !placed; attempt++) {
      const number = generateOrderNumber();
      try {
        const inserted = await tx.execute<{ id: string }>(sql`
          insert into orders (number, user_id, guest_email_enc, status, currency,
            subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
            instruments_cents, payable_cents, pricing_json, shipping_address_json_enc,
            shipping_method_code, source_cart_id, idempotency_key, access_token_hash, contact_email_enc, voucher_id)
          values (${number}, ${owner.kind === "user" ? owner.userId : null},
            ${owner.kind === "guest" ? encryptPii(input.contactEmail) : null},
            'pending_payment', 'USD',
            ${priced.subtotalCents}, ${priced.discountCents}, ${priced.shippingCents},
            ${priced.taxCents}, ${priced.totalCents}, 0, ${priced.payableCents},
            ${JSON.stringify(snapshot.pricingJson)},
            ${encryptPii(JSON.stringify(input.address))},
            ${method.code}, ${cart.id}, ${idempotencyKey},
            ${accessToken ? hashAccessToken(accessToken) : null},
            ${encryptPii(input.contactEmail)}, ${voucherId})
          returning id
        `);
        orderRowId = inserted[0]!.id;
        orderNumber = number;
        placed = true;
      } catch (error) {
        if (error instanceof Error && /orders_number_unique/.test(error.message)) continue;
        throw error;
      }
    }
    if (!orderRowId) throw new AppError("INTERNAL", "Could not create the order. Please try again.");

    if (voucherId) await vouchers.redeemInTx(tx, voucherId, ownerUserId(owner), orderRowId);

    const outOfStock: string[] = [];
    for (const line of lineRows) {
      const updated = await tx.execute(sql`
        update product_variants set stock_qty = stock_qty - ${line.qty}
        where id = ${line.variantId} and stock_qty >= ${line.qty}
        returning id
      `);
      if (updated.length === 0) {
        outOfStock.push(line.title);
      }
      await tx.execute(sql`
        insert into inventory_ledger (variant_id, delta, reason, ref_id, actor_id)
        values (${line.variantId}, ${-line.qty}, 'order', ${orderRowId}, null)
      `);
    }
    if (outOfStock.length > 0) {
      throw new AppError("VALIDATION", `Some items just sold out: ${outOfStock.join(", ")}.`);
    }

    for (const line of lineRows) {
      const pricedLine = pricedById.get(line.variantId)!;
      await tx.execute(sql`
        insert into order_items (order_id, variant_id, title_snapshot, sku_snapshot, unit_price_cents, qty, discount_cents, tax_cents)
        values (${orderRowId}, ${line.variantId}, ${line.title}, ${line.variantId.slice(0, 12).toUpperCase()},
          ${line.unitPriceCents}, ${line.qty}, ${pricedLine.discountCents}, ${pricedLine.taxCents})
      `);
    }
    await tx.execute(sql`
      insert into order_events (order_id, from_status, to_status, actor, note)
      values (${orderRowId}, null, 'pending_payment', 'customer', null)
    `);
    await tx.execute(sql`
      insert into idempotency_keys (key, scope, request_hash)
      values (${idempotencyKey}, 'checkout.place', ${priced.totalCents})
      on conflict do nothing
    `);

    return orderRowId;
  });

  void writeAudit({ actorId: owner.kind === "user" ? owner.userId : null, actorRole: owner.kind === "user" ? "customer" : null, action: "order.placed", entityType: "order", entityId: orderId, ip }).catch(() => undefined);

  if (priced.payableCents === 0) {
    await markOrderPaidByOrderId(orderId, null, ip);
    return { orderId, orderNumber, clientSecret: null, status: "paid", accessToken };
  }

  const stripe = requireStripeClient();
  let intent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: priced.payableCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { order_id: orderId, order_number: orderNumber },
    }, { idempotencyKey });
  } catch {
    await compensateOrder(orderId, ip);
    logger.error({ orderId }, "payment intent creation failed");
    throw new AppError("INTERNAL", "Payment could not be started. Nothing was charged. Please try again.");
  }

  await db.insert(payments).values({
    orderId,
    stripePaymentIntentId: intent.id,
    status: "pending",
    amountCents: priced.payableCents,
  });

  return { orderId, orderNumber, clientSecret: intent.client_secret, status: "pending_payment", accessToken };
}

async function compensateOrder(orderId: string, ip?: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const lines = await tx.execute<{ variant_id: string; qty: number }>(sql`
      select variant_id, qty from order_items where order_id = ${orderId}
    `);
    for (const line of lines) {
      await tx.execute(sql`
        update product_variants set stock_qty = stock_qty + ${line.qty} where id = ${line.variant_id}
      `);
      await tx.execute(sql`
        insert into inventory_ledger (variant_id, delta, reason, ref_id)
        values (${line.variant_id}, ${line.qty}, 'cancel', ${orderId})
      `);
    }
    await tx.execute(sql`
      update orders set status = 'cancelled' where id = ${orderId} and status = 'pending_payment'
    `);
    await tx.execute(sql`
      insert into order_events (order_id, from_status, to_status, actor, note)
      values (${orderId}, 'pending_payment', 'cancelled', 'system', 'payment setup failed')
    `);
  });
  await writeAudit({ actorId: null, actorRole: null, action: "order.cancelled", entityType: "order", entityId: orderId, ip }).catch(() => undefined);
}

export async function markOrderPaidByOrderId(orderId: string, intent: { id: string; brand?: string | null; last4?: string | null } | null, ip?: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx.execute<{ status: string }>(sql`
      select status from orders where id = ${orderId} for update
    `);
    const current = rows[0]?.status as "pending_payment" | "paid" | undefined;
    if (!current) return;
    if (current === "paid") return;
    assertTransition(current, "paid");
    await tx.execute(sql`update orders set status = 'paid' where id = ${orderId}`);
    await tx.execute(sql`
      insert into order_events (order_id, from_status, to_status, actor, note)
      values (${orderId}, ${current}, 'paid', 'system', null)
    `);
    if (intent) {
      await tx.execute(sql`
        update payments set status = 'succeeded', method_brand = ${intent.brand ?? null},
          method_last4 = ${intent.last4 ?? null}
        where order_id = ${orderId} and stripe_payment_intent_id = ${intent.id}
      `);
    }
    await tx.execute(sql`
      delete from cart_items where cart_id = (
        select source_cart_id from orders where id = ${orderId}
      )
    `);
  });
  await writeAudit({ actorId: null, actorRole: null, action: "order.payment_succeeded", entityType: "order", entityId: orderId, ip }).catch(() => undefined);
  void sendConfirmation(orderId).catch(() => undefined);
  void notifyOrder(orderId, "order.placed");
}

export async function sendConfirmation(orderId: string): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order || !order.contactEmail) return;
  const [lines, method] = await Promise.all([
    db.execute<{ title_snapshot: string; qty: number; unit_price_cents: number }>(sql`
      select title_snapshot, qty, unit_price_cents from order_items where order_id = ${orderId}
    `),
    db.execute<{ shipping_method_code: string | null }>(sql`
      select shipping_method_code from orders where id = ${orderId}
    `),
  ]);
  const { absoluteUrl } = await import("@/lib/seo");
  const isGuest = Boolean(order.accessTokenHash);
  const orderUrl = isGuest
    ? absoluteUrl(`/checkout/success?order=${order.number}`)
    : absoluteUrl(`/orders/${order.number}`);
  await sendMail({
    to: order.contactEmail,
    ...orderConfirmationEmail({
      number: order.number,
      contactEmail: order.contactEmail,
      totalCents: order.totalCents,
      lines: lines.map((l) => ({
        title: l.title_snapshot,
        quantity: l.qty,
        unitPriceCents: l.unit_price_cents,
      })),
      shippingMethod: method[0]?.shipping_method_code ?? null,
      orderUrl,
    }),
  });
}

export async function expireStaleOrders(limit = 20): Promise<number> {
  const stale = await db.execute<{ id: string; number: string }>(sql`
    select id, number from orders
    where status = 'pending_payment' and placed_at < now() - interval '30 minutes'
    order by placed_at asc
    limit ${limit}
  `);
  if (stale.length === 0) return 0;

  const stripe = stripeClient();
  for (const order of stale) {
    await db.transaction(async (tx) => {
      const lines = await tx.execute<{ variant_id: string; qty: number }>(sql`
        select variant_id, qty from order_items where order_id = ${order.id}
      `);
      for (const line of lines) {
        await tx.execute(sql`
          update product_variants set stock_qty = stock_qty + ${line.qty} where id = ${line.variant_id}
        `);
        await tx.execute(sql`
          insert into inventory_ledger (variant_id, delta, reason, ref_id)
          values (${line.variant_id}, ${line.qty}, 'cancel', ${order.id})
        `);
      }
      const updated = await tx.execute(sql`
        update orders set status = 'cancelled'
        where id = ${order.id} and status = 'pending_payment' returning id
      `);
      if (updated.length > 0) {
        await tx.execute(sql`
          insert into order_events (order_id, from_status, to_status, actor, note)
          values (${order.id}, 'pending_payment', 'cancelled', 'system', 'payment window expired')
        `);
      }
    });
    const payment = await db.execute<{ stripe_payment_intent_id: string | null }>(sql`
      select stripe_payment_intent_id from payments where order_id = ${order.id} limit 1
    `);
    const intentId = payment[0]?.stripe_payment_intent_id;
    if (intentId) {
      await stripe?.paymentIntents.cancel(intentId).catch(() => undefined);
    }
    await writeAudit({ actorId: null, actorRole: null, action: "order.expired", entityType: "order", entityId: order.id }).catch(() => undefined);
    void notifyOrder(order.id, "order.cancelled", { reason: "payment_expired" });
  }
  return stale.length;
}

export async function getOrderById(orderId: string): Promise<{
  id: string;
  number: string;
  status: string;
  contactEmail: string;
  payableCents: number;
  totalCents: number;
  accessTokenHash: string | null;
} | null> {
  const rows = await db.execute<{
    id: string; number: string; status: string; contact_email_enc: string | null;
    guest_email_enc: string | null; payable_cents: number; total_cents: number;
    access_token_hash: string | null;
  }>(sql`
    select id, number, status, contact_email_enc, guest_email_enc, payable_cents, total_cents, access_token_hash
    from orders where id = ${orderId} limit 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    contactEmail: row.contact_email_enc
      ? decryptPii(row.contact_email_enc)
      : row.guest_email_enc
        ? decryptPii(row.guest_email_enc)
        : "",
    payableCents: row.payable_cents,
    totalCents: row.total_cents,
    accessTokenHash: row.access_token_hash,
  };
}
