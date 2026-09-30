import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireStripeClient } from "@/lib/stripe";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/lib/audit";
import { verifyPaymentIntent } from "@/modules/payments/verify";
import { markOrderPaidByOrderId } from "@/modules/checkout/service";

export const dynamic = "force-dynamic";

interface OrderRow {
  [key: string]: unknown;
  id: string;
  number: string;
  status: string;
  payable_cents: number;
  currency: string;
}

async function loadOrderByIntent(intentId: string): Promise<OrderRow | null> {
  const rows = await db.execute<OrderRow>(sql`
    select o.id, o.number, o.status, o.payable_cents, o.currency
    from payments p join orders o on o.id = p.order_id
    where p.stripe_payment_intent_id = ${intentId}
    limit 1
  `);
  return rows[0] ?? null;
}

/**
 * Keep `refunds` in step with Stripe (FR-ORD-07): update refunds we created,
 * and record ones issued from the Stripe dashboard. Order status is left to
 * the admin refund flow; dashboard refunds show on the order as refund rows.
 */
async function mirrorRefund(refund: Stripe.Refund): Promise<void> {
  const status = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" || refund.status === "canceled" ? refund.status : "pending";
  const updated = await db.execute(sql`
    update refunds set status = ${status} where stripe_refund_id = ${refund.id} returning id
  `);
  if (updated.length > 0) return;
  const refundId = refund.metadata?.refund_id;
  if (refundId && /^[0-9a-f-]{36}$/.test(refundId)) {
    const byId = await db.execute(sql`
      update refunds set status = ${status}, stripe_refund_id = ${refund.id}
      where id = ${refundId} and stripe_refund_id is null returning id
    `);
    if (byId.length > 0) return;
  }
  const intentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (!intentId) return;
  const order = await loadOrderByIntent(intentId);
  if (!order) return;
  await db.execute(sql`
    insert into refunds (order_id, payment_id, amount_cents, reason, stripe_refund_id, status)
    select ${order.id}, p.id, ${refund.amount}, 'Issued in Stripe', ${refund.id}, ${status}
    from payments p where p.stripe_payment_intent_id = ${intentId}
    on conflict (stripe_refund_id) do nothing
  `);
  await writeAudit({ actorId: null, actorRole: null, action: "order.refund_mirrored", entityType: "order", entityId: order.id, meta: { amountCents: refund.amount } }).catch(() => undefined);
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid webhook." } }, { status: 400 });
  }
  const rawBody = await request.text();
  const stripe = requireStripeClient();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid signature." } }, { status: 400 });
  }

  const inserted = await db.execute(sql`
    insert into webhook_events (id, type) values (${event.id}, ${event.type})
    on conflict (id) do nothing returning id
  `);
  if (inserted.length === 0) {
    return Response.json({ received: true });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const order = await loadOrderByIntent(intent.id);
    if (!order) {
      logger.error({ intentId: intent.id }, "webhook: unknown payment intent");
      return Response.json({ received: true });
    }
    const verification = verifyPaymentIntent(
      { id: intent.id, amount: intent.amount, currency: intent.currency, metadata: intent.metadata as Record<string, string> },
      { id: order.id, number: order.number, payableCents: order.payable_cents, currency: order.currency },
    );
    if (!verification.ok) {
      logger.error({ orderId: order.id, reason: verification.reason }, "webhook: payment verification failed");
      return Response.json({ received: true });
    }
    try {
      const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
      const charge = chargeId ? await stripe.charges.retrieve(chargeId).catch(() => null) : null;
      await markOrderPaidByOrderId(order.id, {
        id: intent.id,
        brand: charge?.payment_method_details?.card?.brand ?? null,
        last4: charge?.payment_method_details?.card?.last4 ?? null,
      });
    } catch (error) {
      logger.error({ orderId: order.id, error: error instanceof Error ? error.message : "unknown" }, "webhook: mark paid failed");
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const order = await loadOrderByIntent(intent.id);
    if (order) {
      await db.execute(sql`
        update payments set status = 'failed' where order_id = ${order.id} and stripe_payment_intent_id = ${intent.id}
      `);
      await db.execute(sql`
        insert into order_events (order_id, from_status, to_status, actor, note)
        values (${order.id}, 'pending_payment', 'pending_payment', 'system', 'payment failed, you can retry')
      `);
      await writeAudit({ actorId: null, actorRole: null, action: "order.payment_failed", entityType: "order", entityId: order.id }).catch(() => undefined);
    }
  } else if (event.type === "refund.created" || event.type === "refund.updated" || event.type === "refund.failed") {
    await mirrorRefund(event.data.object as Stripe.Refund);
  }

  return Response.json({ received: true });
}
