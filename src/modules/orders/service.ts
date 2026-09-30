import { type DbTimestamp, toIso, toIsoOrNull } from "@/lib/dates";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { decryptPii } from "@/lib/crypto";
import { CUSTOMER_CANCELLABLE, canAccessOrder, type OrderAccess } from "./access-token";

export { CUSTOMER_CANCELLABLE, canAccessOrder, type OrderAccess };

export interface OrderListItem {
  id: string;
  number: string;
  status: string;
  placedAt: string;
  totalCents: number;
  items: { title: string; quantity: number; imageUrl: string | null; slug: string }[];
}

interface OrderRowBase {
  [key: string]: unknown;
  id: string;
  number: string;
  status: string;
  placed_at: DbTimestamp;
  total_cents: number;
}

export async function listOrdersForUser(userId: string, page = 1): Promise<{ items: OrderListItem[]; total: number }> {
  const pageSize = 10;
  const rows = await db.execute<OrderRowBase & { total: number }>(sql`
    select o.id, o.number, o.status, o.placed_at, o.total_cents, count(*) over () as total
    from orders o
    where o.user_id = ${userId} and o.status <> 'cancelled'
    order by o.placed_at desc
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `);
  const total = Number(rows[0]?.total ?? 0);
  const items = await Promise.all(
    rows.map(async (row) => {
      const items = await db.execute<{ title_snapshot: string; qty: number; image_url: string | null; slug: string }>(sql`
        select oi.title_snapshot, oi.qty, pi.url as image_url, p.slug
        from order_items oi
        join product_variants v on v.id = oi.variant_id
        join products p on p.id = v.product_id
        left join product_images pi on pi.product_id = p.id and pi.position = 0
        where oi.order_id = ${row.id}
      `);
      return {
        id: row.id,
        number: row.number,
        status: row.status,
        placedAt: toIso(row.placed_at),
        totalCents: row.total_cents,
        items: items.map((i) => ({
          title: i.title_snapshot,
          quantity: i.qty,
          imageUrl: i.image_url,
          slug: i.slug,
        })),
      };
    }),
  );
  return { items, total };
}

export interface OrderDetail {
  id: string;
  canCancel: boolean;
  number: string;
  status: string;
  placedAt: string;
  contactEmail: string;
  shippingAddress: Record<string, unknown> | null;
  shippingMethodCode: string | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  items: { title: string; quantity: number; unitPriceCents: number; discountCents: number; taxCents: number }[];
  events: { fromStatus: string | null; toStatus: string; actor: string; note: string | null; at: string }[];
  payment: { brand: string | null; last4: string | null; status: string | null } | null;
  shipment: { carrier: string; trackingNumber: string; shippedAt: string; deliveredAt: string | null } | null;
  refunds: { amountCents: number; status: string; at: string }[];
}

export async function getOrderDetailByNumber(
  number: string,
  access: OrderAccess,
): Promise<OrderDetail> {
  const rows = await db.execute<{
    id: string; number: string; status: string; placed_at: DbTimestamp;
    contact_email_enc: string | null; guest_email_enc: string | null;
    shipping_address_json_enc: string | null; shipping_method_code: string | null;
    subtotal_cents: number; discount_cents: number; shipping_cents: number; tax_cents: number; total_cents: number;
    user_id: string | null; access_token_hash: string | null;
  }>(sql`
    select id, number, status, placed_at, contact_email_enc, guest_email_enc,
      shipping_address_json_enc, shipping_method_code,
      subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
      user_id, access_token_hash
    from orders where number = ${number} limit 1
  `);
  const row = rows[0];
  if (!row) throw new AppError("NOT_FOUND", "Order not found.");

  const contactEmail = row.contact_email_enc
    ? decryptPii(row.contact_email_enc)
    : row.guest_email_enc
      ? decryptPii(row.guest_email_enc)
      : "";
  if (!canAccessOrder(row, access, contactEmail)) throw new AppError("NOT_FOUND", "Order not found.");

  const [items, events, payment, shipment, refunds] = await Promise.all([
    db.execute<{ title_snapshot: string; qty: number; unit_price_cents: number; discount_cents: number; tax_cents: number }>(sql`
      select title_snapshot, qty, unit_price_cents, discount_cents, tax_cents from order_items where order_id = ${row.id}
    `),
    db.execute<{ from_status: string | null; to_status: string; actor: string; note: string | null; at: DbTimestamp }>(sql`
      select from_status, to_status, actor, note, at from order_events where order_id = ${row.id} order by at asc
    `),
    db.execute<{ method_brand: string | null; method_last4: string | null; status: string }>(sql`
      select method_brand, method_last4, status from payments where order_id = ${row.id} limit 1
    `),
    db.execute<{ carrier: string; tracking_number: string; shipped_at: DbTimestamp; delivered_at: DbTimestamp | null }>(sql`
      select carrier, tracking_number, shipped_at, delivered_at from shipments where order_id = ${row.id} limit 1
    `),
    db.execute<{ amount_cents: number; status: string; at: DbTimestamp }>(sql`
      select amount_cents, status, at from refunds where order_id = ${row.id} and status <> 'failed' order by at asc
    `),
  ]);

  return {
    id: row.id,
    number: row.number,
    status: row.status,
    placedAt: toIso(row.placed_at),
    canCancel: (CUSTOMER_CANCELLABLE as readonly string[]).includes(row.status),
    contactEmail,
    shippingAddress: row.shipping_address_json_enc
      ? (JSON.parse(decryptPii(row.shipping_address_json_enc)) as Record<string, unknown>)
      : null,
    shippingMethodCode: row.shipping_method_code,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    shippingCents: row.shipping_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    items: items.map((i) => ({
      title: i.title_snapshot,
      quantity: i.qty,
      unitPriceCents: i.unit_price_cents,
      discountCents: i.discount_cents,
      taxCents: i.tax_cents,
    })),
    events: events.map((e) => ({
      fromStatus: e.from_status,
      toStatus: e.to_status,
      actor: e.actor,
      note: e.note,
      at: toIso(e.at),
    })),
    payment: payment[0]
      ? { brand: payment[0].method_brand, last4: payment[0].method_last4, status: payment[0].status }
      : null,
    shipment: shipment[0]
      ? {
          carrier: shipment[0].carrier,
          trackingNumber: shipment[0].tracking_number,
          shippedAt: toIso(shipment[0].shipped_at),
          deliveredAt: toIsoOrNull(shipment[0].delivered_at),
        }
      : null,
    refunds: refunds.map((r) => ({ amountCents: r.amount_cents, status: r.status, at: toIso(r.at) })),
  };
}

/**
 * Customer cancel (FR-ORD-03): same path as the admin cancel, so stock comes
 * back and any payment is refunded through Stripe in one place.
 */
export async function cancelOwnOrder(
  number: string,
  access: OrderAccess,
  ip: string | null,
): Promise<{ refundError: string | null }> {
  const order = await getOrderDetailByNumber(number, access);
  if (!order.canCancel) {
    throw new AppError("CONFLICT", "This order has already shipped, so it can no longer be cancelled.");
  }
  const { cancelOrder } = await import("@/modules/admin/orders-service");
  return cancelOrder(
    { id: "userId" in access ? access.userId : null, role: "customer", ip },
    order.id,
    "Cancelled by the customer",
  );
}
