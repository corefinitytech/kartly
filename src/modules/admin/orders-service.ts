import { toIso, toIsoOrNull } from "@/lib/dates";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/lib/audit";
import { decryptPii } from "@/lib/crypto";
import { sendMail } from "@/lib/mailer";
import { stripeClient } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/seo";
import {
  assertTransition,
  isOrderStatus,
  nextFulfilmentStatus,
  type OrderStatus,
} from "@/modules/orders/state-machine";
import { orderUpdateEmail, type OrderUpdateKind, type OrderUpdateEmailData } from "@/modules/orders/emails";
import type { Staff } from "./guard";

/** Who is changing an order: staff from the admin panel, or the customer cancelling their own. */
export interface OrderActor {
  id: string | null;
  role: string;
  ip: string | null;
}
import { can, maskEmail } from "./permissions";
import * as repo from "./repo";
import { REFUNDABLE_STATUSES, assertRefundAmount, refundableCents, statusAfterRefund } from "./rules";
import type { AdvanceOrderInput } from "./schemas";

function contactEmail(row: { contact_email_enc: string | null; guest_email_enc: string | null }): string {
  const enc = row.contact_email_enc ?? row.guest_email_enc;
  if (!enc) return "";
  try {
    return decryptPii(enc);
  } catch {
    return "";
  }
}

function toStatus(value: string): OrderStatus {
  if (!isOrderStatus(value)) throw new AppError("CONFLICT", "This order is in an unknown state.");
  return value;
}

// Reads ----------------------------------------------------------------------

export interface AdminOrderListItem {
  id: string;
  number: string;
  status: string;
  placedAt: string;
  totalCents: number;
  itemCount: number;
  customer: string;
  isGuest: boolean;
}

export async function listOrders(staff: Staff, filters: { status: string; q: string; page: number }) {
  const [rows, counts] = await Promise.all([repo.listOrders(filters), repo.countOrdersByStatus()]);
  const full = can(staff.role, "orders.viewFullPii");
  const items: AdminOrderListItem[] = rows.map((r) => {
    const email = contactEmail(r);
    return {
      id: r.id,
      number: r.number,
      status: r.status,
      placedAt: toIso(r.placed_at),
      totalCents: r.total_cents,
      itemCount: Number(r.item_count),
      customer: email ? (full ? email : maskEmail(email)) : "—",
      isGuest: !r.user_id,
    };
  });
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, Number(c.count)]));
  return { items, total: Number(rows[0]?.total ?? 0), byStatus };
}

export interface AdminOrderDetail {
  id: string;
  number: string;
  status: OrderStatus;
  placedAt: string;
  isGuest: boolean;
  customerEmail: string;
  shipTo: { name?: string; lines: string[] } | null;
  shippingMethodCode: string | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  items: { variantId: string; productId: string | null; title: string; sku: string | null; quantity: number; unitPriceCents: number }[];
  events: { fromStatus: string | null; toStatus: string; actor: string; note: string | null; at: string }[];
  payment: { status: string; amountCents: number; brand: string | null; last4: string | null } | null;
  shipment: { carrier: string; trackingNumber: string; shippedAt: string; deliveredAt: string | null } | null;
  refunds: { id: string; amountCents: number; reason: string | null; status: string; at: string }[];
  refundableCents: number;
  actions: {
    next: "processing" | "shipped" | "delivered" | null;
    canCancel: boolean;
    canRefund: boolean;
  };
}

export async function getOrder(staff: Staff, number: string): Promise<AdminOrderDetail> {
  const order = await repo.findOrderByNumber(number);
  if (!order) throw new AppError("NOT_FOUND", "Order not found.");
  const status = toStatus(order.status);
  const children = await repo.orderChildren(order.id);
  const fullPii = can(staff.role, "orders.viewFullPii");
  const email = contactEmail(order);

  let shipTo: AdminOrderDetail["shipTo"] = null;
  if (order.shipping_address_json_enc) {
    try {
      const a = JSON.parse(decryptPii(order.shipping_address_json_enc)) as Record<string, string | undefined>;
      shipTo = fullPii
        ? {
            name: a.fullName,
            lines: [a.line1, a.line2, [a.city, a.region, a.postalCode].filter(Boolean).join(" "), a.country, a.phone].filter(
              (l): l is string => Boolean(l),
            ),
          }
        : { lines: [[a.city, a.country].filter(Boolean).join(", ")] };
    } catch {
      shipTo = null;
    }
  }

  const payment = children.payments.find((p) => p.status === "succeeded") ?? children.payments[0] ?? null;
  const paidCents = payment?.status === "succeeded" ? payment.amount_cents : 0;
  const refunds = children.refunds.map((r) => ({ amountCents: r.amount_cents, status: r.status }));
  const remaining = refundableCents(paidCents, refunds);

  return {
    id: order.id,
    number: order.number,
    status,
    placedAt: toIso(order.placed_at),
    isGuest: !order.user_id,
    customerEmail: email ? (fullPii ? email : maskEmail(email)) : "",
    shipTo,
    shippingMethodCode: order.shipping_method_code,
    subtotalCents: order.subtotal_cents,
    discountCents: order.discount_cents,
    shippingCents: order.shipping_cents,
    taxCents: order.tax_cents,
    totalCents: order.total_cents,
    items: children.items.map((i) => ({
      variantId: i.variant_id,
      productId: i.product_id,
      title: i.title_snapshot,
      sku: i.sku,
      quantity: i.qty,
      unitPriceCents: i.unit_price_cents,
    })),
    events: children.events.map((e) => ({
      fromStatus: e.from_status,
      toStatus: e.to_status,
      actor: e.actor,
      note: e.note,
      at: toIso(e.at),
    })),
    payment: payment
      ? { status: payment.status, amountCents: payment.amount_cents, brand: payment.method_brand, last4: payment.method_last4 }
      : null,
    shipment: children.shipment
      ? {
          carrier: children.shipment.carrier,
          trackingNumber: children.shipment.tracking_number,
          shippedAt: toIso(children.shipment.shipped_at),
          deliveredAt: toIsoOrNull(children.shipment.delivered_at),
        }
      : null,
    refunds: children.refunds.map((r) => ({
      id: r.id,
      amountCents: r.amount_cents,
      reason: r.reason,
      status: r.status,
      at: toIso(r.at),
    })),
    refundableCents: remaining,
    actions: {
      next: can(staff.role, "orders.fulfil") ? nextFulfilmentStatus(status) : null,
      canCancel: can(staff.role, "orders.cancel") && ["pending_payment", "payment_failed", "paid", "processing"].includes(status),
      canRefund: can(staff.role, "orders.refund") && REFUNDABLE_STATUSES.includes(status) && remaining > 0,
    },
  };
}

// Writes ---------------------------------------------------------------------

function afterOrderChange(number: string) {
  revalidatePath(`/admin/orders/${number}`);
  revalidatePath("/admin/orders");
}

async function notifyCustomer(orderId: string, kind: OrderUpdateKind, extra: Omit<OrderUpdateEmailData, "number" | "orderUrl"> = {}) {
  const rows = await db.execute<{ number: string; contact_email_enc: string | null; guest_email_enc: string | null; access_token_hash: string | null }>(sql`
    select number, contact_email_enc, guest_email_enc, access_token_hash from orders where id = ${orderId} limit 1
  `);
  const row = rows[0];
  if (!row) return;
  const to = contactEmail(row);
  if (!to) return;
  // Guests have no account page; their emails point at the lookup-free success page like the confirmation.
  const orderUrl = row.access_token_hash
    ? absoluteUrl(`/checkout/success?order=${row.number}`)
    : absoluteUrl(`/orders/${row.number}`);
  await sendMail({ to, ...orderUpdateEmail(kind, { number: row.number, orderUrl, ...extra }) });
}

/**
 * Move an order one fulfilment step forward. `to` must be exactly the next
 * step for the order's current status, so a double submit cannot skip ahead.
 */
export async function advanceOrder(staff: Staff, input: AdvanceOrderInput): Promise<void> {
  const result = await db.transaction(async (tx) => {
    const rows = await tx.execute<{ number: string; status: string }>(sql`
      select number, status from orders where id = ${input.orderId} for update
    `);
    const row = rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Order not found.");
    const current = toStatus(row.status);
    if (nextFulfilmentStatus(current) !== input.to) {
      throw new AppError("CONFLICT", `This order is ${current.replace(/_/g, " ")} and cannot be marked ${input.to} now. Refresh to see its current state.`);
    }
    assertTransition(current, input.to);
    await tx.execute(sql`update orders set status = ${input.to} where id = ${input.orderId}`);

    let note: string | null = null;
    if (input.to === "shipped") {
      await tx.execute(sql`
        insert into shipments (order_id, carrier, tracking_number, status)
        values (${input.orderId}, ${input.carrier}, ${input.trackingNumber}, 'shipped')
        on conflict (order_id) do update set carrier = excluded.carrier,
          tracking_number = excluded.tracking_number, status = 'shipped', shipped_at = now()
      `);
      note = `${input.carrier}, tracking ${input.trackingNumber}`;
    }
    if (input.to === "delivered") {
      await tx.execute(sql`update shipments set status = 'delivered', delivered_at = now() where order_id = ${input.orderId}`);
    }
    await tx.execute(sql`
      insert into order_events (order_id, from_status, to_status, actor, note)
      values (${input.orderId}, ${current}, ${input.to}, ${staff.role}, ${note})
    `);
    return { number: row.number, from: current };
  });

  await writeAudit({
    actorId: staff.id,
    actorRole: staff.role,
    action: `order.${input.to}`,
    entityType: "order",
    entityId: input.orderId,
    meta: { from: result.from, to: input.to },
    ip: staff.ip,
  }).catch(() => undefined);
  if (input.to === "shipped") {
    void notifyCustomer(input.orderId, "shipped", { carrier: input.carrier, trackingNumber: input.trackingNumber }).catch(() => undefined);
  }
  if (input.to === "delivered") void notifyCustomer(input.orderId, "delivered").catch(() => undefined);
  afterOrderChange(result.number);
}

/**
 * Cancel before shipping (FR-ADM-05): restores stock in the same transaction,
 * then cancels the PaymentIntent (unpaid) or refunds what was paid.
 */
export async function cancelOrder(staff: OrderActor, orderId: string, reason: string): Promise<{ refundError: string | null }> {
  const result = await db.transaction(async (tx) => {
    const rows = await tx.execute<{ number: string; status: string }>(sql`
      select number, status from orders where id = ${orderId} for update
    `);
    const row = rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Order not found.");
    const current = toStatus(row.status);
    assertTransition(current, "cancelled");

    const lines = await tx.execute<{ variant_id: string; qty: number }>(sql`
      select variant_id, qty from order_items where order_id = ${orderId}
    `);
    for (const line of lines) {
      await tx.execute(sql`update product_variants set stock_qty = stock_qty + ${line.qty} where id = ${line.variant_id}`);
      await tx.execute(sql`
        insert into inventory_ledger (variant_id, delta, reason, ref_id, actor_id, note)
        values (${line.variant_id}, ${line.qty}, 'cancel', ${orderId}, ${staff.id}, ${staff.role === "customer" ? "order cancelled by customer" : "order cancelled by staff"})
      `);
    }
    await tx.execute(sql`update orders set status = 'cancelled' where id = ${orderId}`);
    await tx.execute(sql`
      insert into order_events (order_id, from_status, to_status, actor, note)
      values (${orderId}, ${current}, 'cancelled', ${staff.role}, ${reason})
    `);
    return { number: row.number, from: current };
  });

  await writeAudit({
    actorId: staff.id,
    actorRole: staff.role,
    action: "order.cancelled",
    entityType: "order",
    entityId: orderId,
    meta: { from: result.from },
    ip: staff.ip,
  }).catch(() => undefined);
  revalidateTag("catalog"); // stock came back

  let refundError: string | null = null;
  if (result.from === "pending_payment" || result.from === "payment_failed") {
    const payment = await db.execute<{ stripe_payment_intent_id: string | null }>(sql`
      select stripe_payment_intent_id from payments where order_id = ${orderId} limit 1
    `);
    const intentId = payment[0]?.stripe_payment_intent_id;
    if (intentId) await stripeClient()?.paymentIntents.cancel(intentId).catch(() => undefined);
  } else {
    const order = await getOrderRefundState(orderId);
    if (order.remaining > 0) {
      try {
        await refundOrder(staff, orderId, order.remaining, `Cancelled: ${reason}`, { silent: true });
      } catch (error) {
        refundError = error instanceof AppError ? error.message : "The refund could not be issued.";
      }
    }
  }
  void notifyCustomer(orderId, "cancelled", { reason }).catch(() => undefined);
  afterOrderChange(result.number);
  return { refundError };
}

async function getOrderRefundState(orderId: string) {
  const [payments, refunds] = await Promise.all([
    db.execute<{ amount_cents: number }>(sql`
      select amount_cents from payments where order_id = ${orderId} and status = 'succeeded' limit 1
    `),
    db.execute<{ amount_cents: number; status: string }>(sql`select amount_cents, status from refunds where order_id = ${orderId}`),
  ]);
  const paid = payments[0]?.amount_cents ?? 0;
  return { remaining: refundableCents(paid, refunds.map((r) => ({ amountCents: r.amount_cents, status: r.status }))) };
}

/**
 * Full or partial refund through Stripe (FR-ADM-05, FR-ORD-07). The refund row
 * is reserved under the order lock first, so two admins cannot over-refund.
 */
export async function refundOrder(
  staff: OrderActor,
  orderId: string,
  amountCents: number,
  reason: string,
  options: { silent?: boolean } = {},
): Promise<void> {
  const stripe = stripeClient();
  if (!stripe) throw new AppError("BAD_REQUEST", "Stripe is not configured, so refunds cannot be issued.");

  const reserved = await db.transaction(async (tx) => {
    const rows = await tx.execute<{ number: string; status: string }>(sql`
      select number, status from orders where id = ${orderId} for update
    `);
    const row = rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Order not found.");
    const status = toStatus(row.status);
    if (!REFUNDABLE_STATUSES.includes(status)) {
      throw new AppError("CONFLICT", "This order has no payment that can be refunded.");
    }
    const payments = await tx.execute<{ id: string; amount_cents: number; stripe_payment_intent_id: string | null }>(sql`
      select id, amount_cents, stripe_payment_intent_id from payments
      where order_id = ${orderId} and status = 'succeeded' limit 1
    `);
    const payment = payments[0];
    if (!payment?.stripe_payment_intent_id) throw new AppError("CONFLICT", "This order has no card payment to refund.");
    const existing = await tx.execute<{ amount_cents: number; status: string }>(sql`
      select amount_cents, status from refunds where order_id = ${orderId}
    `);
    const remaining = refundableCents(
      payment.amount_cents,
      existing.map((r) => ({ amountCents: r.amount_cents, status: r.status })),
    );
    assertRefundAmount(amountCents, remaining);
    const inserted = await tx.execute<{ id: string }>(sql`
      insert into refunds (order_id, payment_id, amount_cents, reason, status, actor_id)
      values (${orderId}, ${payment.id}, ${amountCents}, ${reason}, 'pending', ${staff.id})
      returning id
    `);
    return {
      refundId: inserted[0]!.id,
      intentId: payment.stripe_payment_intent_id,
      number: row.number,
      remainingAfter: remaining - amountCents,
    };
  });

  let stripeRefund;
  try {
    stripeRefund = await stripe.refunds.create(
      {
        payment_intent: reserved.intentId,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata: { order_id: orderId, refund_id: reserved.refundId },
      },
      { idempotencyKey: `refund-${reserved.refundId}` },
    );
  } catch (error) {
    await db.execute(sql`update refunds set status = 'failed' where id = ${reserved.refundId}`);
    logger.error({ orderId, error: error instanceof Error ? error.message : "unknown" }, "refund create failed");
    throw new AppError("INTERNAL", "Stripe did not accept the refund. Nothing was refunded. Please try again.");
  }

  const refundStatus = stripeRefund.status === "succeeded" ? "succeeded" : stripeRefund.status === "failed" ? "failed" : "pending";
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      update refunds set stripe_refund_id = ${stripeRefund.id}, status = ${refundStatus} where id = ${reserved.refundId}
    `);
    if (refundStatus === "failed") return;
    const rows = await tx.execute<{ status: string }>(sql`select status from orders where id = ${orderId} for update`);
    const current = toStatus(rows[0]!.status);
    const next = statusAfterRefund(current, reserved.remainingAfter);
    const note = `Refund of $${(amountCents / 100).toFixed(2)}`;
    if (next !== current) {
      assertTransition(current, next);
      await tx.execute(sql`update orders set status = ${next} where id = ${orderId}`);
    }
    await tx.execute(sql`
      insert into order_events (order_id, from_status, to_status, actor, note)
      values (${orderId}, ${current}, ${next}, ${staff.role}, ${note})
    `);
  });

  if (refundStatus === "failed") {
    throw new AppError("INTERNAL", "Stripe declined the refund. Nothing was refunded.");
  }
  await writeAudit({
    actorId: staff.id,
    actorRole: staff.role,
    action: "order.refunded",
    entityType: "order",
    entityId: orderId,
    meta: { amountCents, refundId: reserved.refundId, full: reserved.remainingAfter === 0 },
    ip: staff.ip,
  }).catch(() => undefined);
  if (!options.silent) void notifyCustomer(orderId, "refunded", { amountCents }).catch(() => undefined);
  afterOrderChange(reserved.number);
}
