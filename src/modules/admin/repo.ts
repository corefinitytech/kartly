// Admin read queries only. Rules and writes live in the *-service files.
import { type DbTimestamp } from "@/lib/dates";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { categoryDisplayName } from "@/modules/catalog/category-names";

export const ADMIN_PAGE_SIZE = 25;
export const AUDIT_PAGE_SIZE = 50;

const offset = (page: number, size: number) => (page - 1) * size;
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// Orders ---------------------------------------------------------------------

export interface OrderListRow {
  [key: string]: unknown;
  id: string;
  number: string;
  status: string;
  placed_at: DbTimestamp;
  total_cents: number;
  item_count: number;
  user_id: string | null;
  contact_email_enc: string | null;
  guest_email_enc: string | null;
  total: number;
}

export async function listOrders(f: { status: string; q: string; page: number }) {
  const where: SQL[] = [sql`true`];
  if (f.status !== "all") where.push(sql`o.status = ${f.status}`);
  if (f.q) where.push(sql`o.number like ${like(f.q)}`);
  return db.execute<OrderListRow>(sql`
    select o.id, o.number, o.status, o.placed_at, o.total_cents, o.user_id,
      o.contact_email_enc, o.guest_email_enc,
      (select coalesce(sum(qty), 0)::int from order_items oi where oi.order_id = o.id) as item_count,
      count(*) over ()::int as total
    from orders o
    where ${sql.join(where, sql` and `)}
    order by o.placed_at desc
    limit ${ADMIN_PAGE_SIZE} offset ${offset(f.page, ADMIN_PAGE_SIZE)}
  `);
}

export async function countOrdersByStatus() {
  return db.execute<{ status: string; count: number }>(sql`
    select status, count(*)::int as count from orders group by status
  `);
}

export async function findOrderByNumber(number: string) {
  const rows = await db.execute<{
    id: string; number: string; status: string; placed_at: DbTimestamp; user_id: string | null;
    contact_email_enc: string | null; guest_email_enc: string | null; access_token_hash: string | null;
    shipping_address_json_enc: string | null; shipping_method_code: string | null;
    subtotal_cents: number; discount_cents: number; shipping_cents: number; tax_cents: number;
    total_cents: number; payable_cents: number;
  }>(sql`
    select id, number, status, placed_at, user_id, contact_email_enc, guest_email_enc, access_token_hash,
      shipping_address_json_enc, shipping_method_code, subtotal_cents, discount_cents,
      shipping_cents, tax_cents, total_cents, payable_cents
    from orders where number = ${number} limit 1
  `);
  return rows[0] ?? null;
}

export async function orderChildren(orderId: string) {
  const [items, events, payments, shipments, refunds] = await Promise.all([
    db.execute<{ variant_id: string; title_snapshot: string; sku: string | null; qty: number; unit_price_cents: number; product_id: string | null }>(sql`
      select oi.variant_id, oi.title_snapshot, v.sku, oi.qty, oi.unit_price_cents, v.product_id
      from order_items oi left join product_variants v on v.id = oi.variant_id
      where oi.order_id = ${orderId}
    `),
    db.execute<{ from_status: string | null; to_status: string; actor: string; note: string | null; at: DbTimestamp }>(sql`
      select from_status, to_status, actor, note, at from order_events where order_id = ${orderId} order by at asc
    `),
    db.execute<{ id: string; status: string; amount_cents: number; method_brand: string | null; method_last4: string | null; stripe_payment_intent_id: string | null }>(sql`
      select id, status, amount_cents, method_brand, method_last4, stripe_payment_intent_id
      from payments where order_id = ${orderId} order by created_at desc
    `),
    db.execute<{ carrier: string; tracking_number: string; status: string; shipped_at: DbTimestamp; delivered_at: DbTimestamp | null }>(sql`
      select carrier, tracking_number, status, shipped_at, delivered_at from shipments where order_id = ${orderId} limit 1
    `),
    db.execute<{ id: string; amount_cents: number; reason: string | null; status: string; at: DbTimestamp }>(sql`
      select id, amount_cents, reason, status, at from refunds where order_id = ${orderId} order by at asc
    `),
  ]);
  return { items, events, payments, shipment: shipments[0] ?? null, refunds };
}

// Products -------------------------------------------------------------------

export interface ProductListRow {
  [key: string]: unknown;
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  status: string;
  category_name: string | null;
  image_url: string | null;
  variant_count: number;
  min_price: number | null;
  max_price: number | null;
  total_stock: number;
  low_variants: number;
  total: number;
}

export async function listProducts(f: { q: string; status: string; page: number }) {
  const where: SQL[] = [sql`true`];
  if (f.status !== "all") where.push(sql`p.status = ${f.status}`);
  if (f.q) where.push(sql`(p.title ilike ${like(f.q)} or p.brand ilike ${like(f.q)} or exists (select 1 from product_variants sv where sv.product_id = p.id and sv.sku ilike ${like(f.q)}))`);
  return db.execute<ProductListRow>(sql`
    select p.id, p.slug, p.title, p.brand, p.status, c.name as category_name,
      (select url from product_images i where i.product_id = p.id order by position asc limit 1) as image_url,
      (select count(*)::int from product_variants v where v.product_id = p.id) as variant_count,
      (select min(price_cents) from product_variants v where v.product_id = p.id) as min_price,
      (select max(price_cents) from product_variants v where v.product_id = p.id) as max_price,
      (select coalesce(sum(stock_qty), 0)::int from product_variants v where v.product_id = p.id) as total_stock,
      (select count(*)::int from product_variants v where v.product_id = p.id and v.stock_qty <= v.low_stock_threshold) as low_variants,
      count(*) over ()::int as total
    from products p left join categories c on c.id = p.category_id
    where ${sql.join(where, sql` and `)}
    order by p.created_at desc, p.title asc
    limit ${ADMIN_PAGE_SIZE} offset ${offset(f.page, ADMIN_PAGE_SIZE)}
  `);
}

export async function findProduct(id: string) {
  const rows = await db.execute<{
    id: string; slug: string; title: string; brand: string | null; description: string | null;
    category_id: string | null; status: string;
  }>(sql`
    select id, slug, title, brand, description, category_id, status from products where id = ${id} limit 1
  `);
  return rows[0] ?? null;
}

export async function productVariants(productId: string) {
  return db.execute<{
    id: string; sku: string; options_json: string; price_cents: number; compare_at_cents: number | null;
    stock_qty: number; low_stock_threshold: number; ordered: boolean;
  }>(sql`
    select v.id, v.sku, v.options_json, v.price_cents, v.compare_at_cents, v.stock_qty, v.low_stock_threshold,
      exists (select 1 from order_items oi where oi.variant_id = v.id) as ordered
    from product_variants v where v.product_id = ${productId}
    order by v.sku asc
  `);
}

export async function productImages(productId: string) {
  return db.execute<{ id: string; url: string; alt: string | null; position: number }>(sql`
    select id, url, alt, position from product_images where product_id = ${productId} order by position asc, id asc
  `);
}

export async function listCategoryOptions() {
  const rows = await db.execute<{ id: string; slug: string; parent_slug: string | null }>(sql`
    select c.id, c.slug, p.slug as parent_slug
    from categories c left join categories p on p.id = c.parent_id
  `);
  const options = rows.map((r) => ({
    value: r.id,
    label: r.parent_slug
      ? `${categoryDisplayName(r.parent_slug)} › ${categoryDisplayName(r.slug)}`
      : categoryDisplayName(r.slug),
  }));
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export async function slugTaken(slug: string, exceptProductId: string | null): Promise<boolean> {
  const rows = await db.execute(sql`
    select 1 from products where slug = ${slug} and (${exceptProductId}::uuid is null or id <> ${exceptProductId}::uuid) limit 1
  `);
  return rows.length > 0;
}

export async function skuTaken(sku: string, exceptVariantId: string | null): Promise<boolean> {
  const rows = await db.execute(sql`
    select 1 from product_variants where upper(sku) = ${sku.toUpperCase()}
      and (${exceptVariantId}::uuid is null or id <> ${exceptVariantId}::uuid) limit 1
  `);
  return rows.length > 0;
}

// Inventory ------------------------------------------------------------------

export interface InventoryRow {
  [key: string]: unknown;
  id: string;
  sku: string;
  options_json: string;
  stock_qty: number;
  low_stock_threshold: number;
  product_id: string;
  product_title: string;
  product_status: string;
  total: number;
}

export async function listInventory(f: { q: string; stock: string; page: number }) {
  const where: SQL[] = [sql`true`];
  if (f.stock === "low") where.push(sql`v.stock_qty > 0 and v.stock_qty <= v.low_stock_threshold`);
  if (f.stock === "out") where.push(sql`v.stock_qty = 0`);
  if (f.q) where.push(sql`(v.sku ilike ${like(f.q)} or p.title ilike ${like(f.q)})`);
  return db.execute<InventoryRow>(sql`
    select v.id, v.sku, v.options_json, v.stock_qty, v.low_stock_threshold,
      p.id as product_id, p.title as product_title, p.status as product_status,
      count(*) over ()::int as total
    from product_variants v join products p on p.id = v.product_id
    where ${sql.join(where, sql` and `)}
    order by (v.stock_qty <= v.low_stock_threshold) desc, v.stock_qty asc, p.title asc
    limit ${ADMIN_PAGE_SIZE} offset ${offset(f.page, ADMIN_PAGE_SIZE)}
  `);
}

export async function countStockAlerts() {
  const rows = await db.execute<{ low: number; out: number }>(sql`
    select
      count(*) filter (where stock_qty > 0 and stock_qty <= low_stock_threshold)::int as low,
      count(*) filter (where stock_qty = 0)::int as out
    from product_variants
  `);
  return rows[0] ?? { low: 0, out: 0 };
}

export async function recentLedger(variantId: string | null, limit = 20) {
  return db.execute<{
    id: string; delta: number; reason: string; note: string | null; ref_id: string | null; at: DbTimestamp;
    sku: string; product_title: string; actor_name: string | null;
  }>(sql`
    select l.id, l.delta, l.reason, l.note, l.ref_id, l.at, v.sku, p.title as product_title, u.name as actor_name
    from inventory_ledger l
    join product_variants v on v.id = l.variant_id
    join products p on p.id = v.product_id
    left join users u on u.id = l.actor_id
    where ${variantId}::uuid is null or l.variant_id = ${variantId}::uuid
    order by l.at desc
    limit ${limit}
  `);
}

// Audit ----------------------------------------------------------------------

export interface AuditRow {
  [key: string]: unknown;
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  meta_json: string;
  ip_hash: string | null;
  created_at: DbTimestamp;
  actor_name: string | null;
}

/** Count-free paging: fetch one extra row to know whether there is a next page. */
export async function listAudit(f: { action: string; entityType: string; entityId: string; actorId: string; page: number }) {
  const where: SQL[] = [sql`true`];
  if (f.action) where.push(sql`a.action like ${`${f.action.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}`);
  if (f.entityType) where.push(sql`a.entity_type = ${f.entityType}`);
  if (f.entityId) where.push(sql`a.entity_id = ${f.entityId}`);
  if (f.actorId) where.push(sql`a.actor_id = ${f.actorId}::uuid`);
  // Only staff names are shown; customer actors appear as their role and id.
  return db.execute<AuditRow>(sql`
    select a.id, a.actor_id, a.actor_role, a.action, a.entity_type, a.entity_id, a.meta_json, a.ip_hash, a.created_at,
      case when u.role in ('admin', 'support') then u.name end as actor_name
    from audit_log a left join users u on u.id = a.actor_id
    where ${sql.join(where, sql` and `)}
    order by a.created_at desc, a.id desc
    limit ${AUDIT_PAGE_SIZE + 1} offset ${offset(f.page, AUDIT_PAGE_SIZE)}
  `);
}

export async function auditActionPrefixes() {
  return db.execute<{ prefix: string }>(sql`
    select distinct split_part(action, '.', 1) as prefix from audit_log order by 1 limit 30
  `);
}
