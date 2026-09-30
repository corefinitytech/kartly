import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cartItems, carts } from "@/db/schema/cart";
import type { Owner } from "./identity";

export interface CartLineRow {
  [key: string]: unknown;
  id: string;
  variantId: string;
  qty: number;
  addedPriceCents: number;
  title: string;
  slug: string;
  imageUrl: string | null;
  optionsJson: string;
  unitPriceCents: number;
  stockQty: number;
  lowStockThreshold: number;
  productStatus: string;
}

export async function findCart(owner: Owner): Promise<{ id: string; estimateCountry: string | null } | null> {
  const condition =
    owner.kind === "guest"
      ? eq(carts.guestTokenHash, owner.tokenHash)
      : eq(carts.userId, owner.userId);
  const rows = await db
    .select({ id: carts.id, estimateCountry: carts.estimateCountry })
    .from(carts)
    .where(condition)
    .limit(1);
  return rows[0] ?? null;
}

export async function createCart(
  owner: Owner,
  estimateCountry: string,
): Promise<{ id: string; estimateCountry: string | null }> {
  const [row] = await db
    .insert(carts)
    .values(
      owner.kind === "guest"
        ? { guestTokenHash: owner.tokenHash, estimateCountry }
        : { userId: owner.userId, estimateCountry },
    )
    .returning({ id: carts.id, estimateCountry: carts.estimateCountry });
  return row!;
}

export async function touchCart(cartId: string): Promise<void> {
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
}

export async function getLines(cartId: string): Promise<CartLineRow[]> {
  const result = await db.execute<CartLineRow>(sql`
    select ci.id, ci.variant_id as "variantId", ci.qty, ci.added_price_cents as "addedPriceCents",
           p.title, p.slug, pi.url as "imageUrl", v.options_json as "optionsJson",
           v.price_cents as "unitPriceCents", v.stock_qty as "stockQty",
           v.low_stock_threshold as "lowStockThreshold",
           p.status as "productStatus"
    from cart_items ci
    join product_variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    left join product_images pi on pi.product_id = p.id and pi.position = 0
    where ci.cart_id = ${cartId} and ci.saved_for_later = false
    order by ci.id asc
  `);
  return result;
}

export async function insertItem(
  cartId: string,
  variantId: string,
  quantity: number,
  unitPriceCents: number,
  stockQty: number,
  maxQuantity: number,
): Promise<{ oldQty: number; newQty: number }> {
  const result = await db.execute<{ new_qty: number; old_qty: number }>(sql`
    with prev as (
      select qty from cart_items
      where cart_id = ${cartId} and variant_id = ${variantId}
      for update
    ), up as (
      insert into cart_items (cart_id, variant_id, qty, added_price_cents)
      values (${cartId}, ${variantId}, least(${quantity}::int, least(${stockQty}::int, ${maxQuantity}::int)), ${unitPriceCents}::int)
      on conflict (cart_id, variant_id) do update set
        qty = least(cart_items.qty + excluded.qty, least(${stockQty}::int, ${maxQuantity}::int)),
        added_price_cents = excluded.added_price_cents
      returning qty
    )
    select (select qty from up) as new_qty, coalesce((select qty from prev), 0) as old_qty
  `);
  return { oldQty: result[0]?.old_qty ?? 0, newQty: result[0]?.new_qty ?? 0 };
}

export interface AddItemRow {
  cartId: string | null;
  estimateCountry: string | null;
  variantFound: boolean;
  stockQty: number;
  oldQty: number;
  newQty: number | null;
  countBefore: number;
}

/**
 * Add to cart in ONE round trip: find or create the owner's cart, check the
 * variant is live, upsert the line clamped to stock and the per-line max, touch
 * the cart, and read the count. The database is far from the app in dev
 * (~250 ms per query), so round trips are what make the button feel slow.
 * Data-modifying CTEs do not see each other's writes, so the caller derives
 * the new count as countBefore - oldQty + newQty.
 */
export async function addItemAtomic(
  owner: Owner,
  variantId: string,
  quantity: number,
  maxQuantity: number,
  defaultCountry: string,
): Promise<AddItemRow> {
  const ownerMatch =
    owner.kind === "guest" ? sql`guest_token_hash = ${owner.tokenHash}` : sql`user_id = ${owner.userId}::uuid`;
  const ownerInsert =
    owner.kind === "guest"
      ? sql`insert into carts (guest_token_hash, estimate_country) select ${owner.tokenHash}, ${defaultCountry}`
      : sql`insert into carts (user_id, estimate_country) select ${owner.userId}::uuid, ${defaultCountry}`;
  const rows = await db.execute<{
    cart_id: string | null;
    estimate_country: string | null;
    variant_found: boolean;
    stock_qty: number | null;
    old_qty: number;
    new_qty: number | null;
    count_before: number;
  }>(sql`
    with v as (
      select pv.id, pv.price_cents, pv.stock_qty
      from product_variants pv join products p on p.id = pv.product_id
      where pv.id = ${variantId}::uuid and p.status = 'active'
    ), existing as (
      select id, estimate_country from carts where ${ownerMatch} limit 1
    ), created as (
      ${ownerInsert}
      where not exists (select 1 from existing) and exists (select 1 from v)
      on conflict do nothing
      returning id, estimate_country
    ), cart as (
      select id, estimate_country from existing union all select id, estimate_country from created limit 1
    ), prev as (
      select ci.qty from cart_items ci join cart on ci.cart_id = cart.id
      where ci.variant_id = ${variantId}::uuid and ci.saved_for_later = false
    ), up as (
      insert into cart_items (cart_id, variant_id, qty, added_price_cents)
      select cart.id, v.id, least(${quantity}::int, least(v.stock_qty, ${maxQuantity}::int)), v.price_cents
      from cart, v where v.stock_qty > 0
      on conflict (cart_id, variant_id) do update set
        qty = least(cart_items.qty + excluded.qty, least((select stock_qty from v), ${maxQuantity}::int)),
        added_price_cents = excluded.added_price_cents
      returning qty
    ), touch as (
      update carts set updated_at = now() where id = (select id from existing) returning id
    )
    select (select id from cart) as cart_id,
      (select estimate_country from cart) as estimate_country,
      exists (select 1 from v) as variant_found,
      (select stock_qty from v) as stock_qty,
      coalesce((select qty from prev), 0)::int as old_qty,
      (select qty from up) as new_qty,
      (select coalesce(sum(ci.qty), 0) from cart_items ci
        where ci.cart_id = (select id from existing) and ci.saved_for_later = false)::int as count_before
  `);
  const r = rows[0]!;
  return {
    cartId: r.cart_id,
    estimateCountry: r.estimate_country,
    variantFound: r.variant_found,
    stockQty: r.stock_qty ?? 0,
    oldQty: Number(r.old_qty),
    newQty: r.new_qty === null ? null : Number(r.new_qty),
    countBefore: Number(r.count_before),
  };
}

export async function setItemQuantity(
  cartId: string,
  variantId: string,
  quantity: number,
  stockQty: number,
  maxQuantity: number,
): Promise<number> {
  const result = await db.execute<{ qty: number }>(sql`
    update cart_items set qty = least(${quantity}::int, least(${stockQty}::int, ${maxQuantity}::int))
    where cart_id = ${cartId} and variant_id = ${variantId}
    returning qty
  `);
  return result[0]?.qty ?? 0;
}

export async function removeItem(cartId: string, variantId: string): Promise<void> {
  await db.delete(cartItems).where(
    sql`${cartItems.cartId} = ${cartId} and ${cartItems.variantId} = ${variantId}`,
  );
}

export async function getVariant(variantId: string): Promise<{
  id: string;
  productId: string;
  priceCents: number;
  stockQty: number;
  productStatus: string;
} | null> {
  const result = await db.execute<{
    id: string;
    productId: string;
    price_cents: number;
    stock_qty: number;
    product_status: string;
  }>(sql`
    select v.id, v.product_id, v.price_cents, v.stock_qty, p.status as product_status
    from product_variants v
    join products p on p.id = v.product_id
    where v.id = ${variantId} and p.status = 'active'
    limit 1
  `);
  const row = result[0];
  if (!row) return null;
  return {
    id: row.id,
    productId: row.productId,
    priceCents: row.price_cents,
    stockQty: row.stock_qty,
    productStatus: row.product_status,
  };
}

export async function getShippingMethods(): Promise<
  { code: string; name: string; priceCents: number; freeOverCents: number | null; isActive: boolean; minDays: number; maxDays: number }[]
> {
  return db.execute<{
    code: string;
    name: string;
    price_cents: number;
    free_over_cents: number | null;
    is_active: boolean;
    min_days: number;
    max_days: number;
  }>(sql`select code, name, price_cents, free_over_cents, is_active, min_days, max_days
         from shipping_methods order by position asc`).then((rows) =>
    rows.map((r) => ({
      code: r.code,
      name: r.name,
      priceCents: r.price_cents,
      freeOverCents: r.free_over_cents,
      isActive: r.is_active,
      minDays: r.min_days,
      maxDays: r.max_days,
    })),
  );
}

export async function getTaxRates(): Promise<{ countryCode: string; rateBps: number; label: string }[]> {
  return db.execute<{ country_code: string; rate_bps: number; label: string }>(
    sql`select country_code, rate_bps, label from tax_rates order by country_code asc`,
  ).then((rows) =>
    rows.map((r) => ({ countryCode: r.country_code, rateBps: r.rate_bps, label: r.label })),
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const result = await db.execute<{ value_json: string }>(
    sql`select value_json from settings where key = ${key}`,
  );
  return result[0]?.value_json ?? null;
}

export async function setEstimateCountry(cartId: string, country: string): Promise<void> {
  await db.update(carts).set({ estimateCountry: country, updatedAt: new Date() }).where(eq(carts.id, cartId));
}

export async function countItems(cartId: string): Promise<number> {
  const result = await db.execute<{ total: number }>(sql`
    select coalesce(sum(qty), 0)::int as total from cart_items
    where cart_id = ${cartId} and saved_for_later = false
  `);
  return Number(result[0]?.total ?? 0);
}
