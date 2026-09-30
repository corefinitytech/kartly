import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { toDate, toIso, toIsoOrNull, type DbTimestamp } from "@/lib/dates";
import { parseAppliesTo, type VoucherLine, type VoucherRule, type VoucherType } from "./rules";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface VoucherRow {
  [key: string]: unknown;
  id: string;
  code: string;
  type: string;
  value: number;
  min_spend_cents: number;
  applies_to_json: string;
  first_order_only: boolean;
  per_user_limit: number | null;
  global_limit: number | null;
  used_count: number;
  starts_at: DbTimestamp | null;
  ends_at: DbTimestamp | null;
  is_active: boolean;
}

function toRule(row: VoucherRow): VoucherRule {
  return {
    id: row.id,
    code: row.code,
    type: row.type as VoucherType,
    value: Number(row.value),
    minSpendCents: Number(row.min_spend_cents),
    appliesTo: parseAppliesTo(row.applies_to_json),
    firstOrderOnly: row.first_order_only,
    perUserLimit: row.per_user_limit === null ? null : Number(row.per_user_limit),
    globalLimit: row.global_limit === null ? null : Number(row.global_limit),
    usedCount: Number(row.used_count),
    startsAt: row.starts_at ? toDate(row.starts_at) : null,
    endsAt: row.ends_at ? toDate(row.ends_at) : null,
    isActive: row.is_active,
  };
}

/** The code plus this user's usage, in one round trip. Guests get zero counts. */
export async function findByCodeWithUsage(
  code: string,
  userId: string | null,
): Promise<{ rule: VoucherRule; userRedemptions: number; userOrders: number } | null> {
  const rows = await db.execute<VoucherRow & { user_redemptions: number; user_orders: number }>(sql`
    select v.id, v.code, v.type, v.value, v.min_spend_cents, v.applies_to_json, v.first_order_only,
      v.per_user_limit, v.global_limit, v.used_count, v.starts_at, v.ends_at, v.is_active,
      case when ${userId}::uuid is null then 0 else
        (select count(*)::int from voucher_redemptions r where r.voucher_id = v.id and r.user_id = ${userId}::uuid) end as user_redemptions,
      case when ${userId}::uuid is null then 0 else
        (select count(*)::int from orders o where o.user_id = ${userId}::uuid and o.status <> 'cancelled') end as user_orders
    from vouchers v where v.code = ${code} limit 1
  `);
  const row = rows[0];
  if (!row) return null;
  return { rule: toRule(row), userRedemptions: Number(row.user_redemptions), userOrders: Number(row.user_orders) };
}

/** Product and category scope of each active cart line, for applies_to checks. */
export async function cartLineScopes(cartId: string): Promise<VoucherLine[]> {
  const rows = await db.execute<{ variant_id: string; product_id: string; category_id: string | null; parent_id: string | null }>(sql`
    select v.id as variant_id, p.id as product_id, p.category_id, c.parent_id
    from cart_items ci
    join product_variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    left join categories c on c.id = p.category_id
    where ci.cart_id = ${cartId} and ci.saved_for_later = false
  `);
  return rows.map((r) => ({
    variantId: r.variant_id,
    productId: r.product_id,
    categoryIds: [r.category_id, r.parent_id].filter((x): x is string => Boolean(x)),
  }));
}

/**
 * Take one use inside the place-order transaction (FR-VCH-02, AC-5).
 * The conditional increment locks the voucher row, so concurrent orders for the
 * same code queue here and each re-checks the window and global limit against
 * the committed count. The per-user count read after the lock is therefore
 * exact, and the unique (voucher, user, user_seq) index is the last line of defence.
 */
export async function claimInTx(
  tx: Tx,
  voucherId: string,
): Promise<{ usedCount: number; perUserLimit: number | null; globalLimit: number | null; firstOrderOnly: boolean } | null> {
  const rows = await tx.execute<{ used_count: number; per_user_limit: number | null; global_limit: number | null; first_order_only: boolean }>(sql`
    update vouchers set used_count = used_count + 1, updated_at = now()
    where id = ${voucherId} and is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and (global_limit is null or used_count < global_limit)
    returning used_count, per_user_limit, global_limit, first_order_only
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    usedCount: Number(row.used_count),
    perUserLimit: row.per_user_limit === null ? null : Number(row.per_user_limit),
    globalLimit: row.global_limit === null ? null : Number(row.global_limit),
    firstOrderOnly: row.first_order_only,
  };
}

export async function userUsageInTx(tx: Tx, voucherId: string, userId: string, orderId: string): Promise<{ redemptions: number; orders: number }> {
  const rows = await tx.execute<{ redemptions: number; orders: number }>(sql`
    select
      (select count(*)::int from voucher_redemptions where voucher_id = ${voucherId} and user_id = ${userId}) as redemptions,
      (select count(*)::int from orders where user_id = ${userId} and status <> 'cancelled' and id <> ${orderId}) as orders
  `);
  return { redemptions: Number(rows[0]?.redemptions ?? 0), orders: Number(rows[0]?.orders ?? 0) };
}

export async function insertRedemptionInTx(tx: Tx, voucherId: string, userId: string | null, orderId: string, userSeq: number | null): Promise<void> {
  await tx.execute(sql`
    insert into voucher_redemptions (voucher_id, user_id, order_id, user_seq)
    values (${voucherId}, ${userId}, ${orderId}, ${userSeq})
  `);
}

// Admin -----------------------------------------------------------------------

export interface VoucherListRow {
  id: string;
  code: string;
  type: VoucherType;
  value: number;
  minSpendCents: number;
  usedCount: number;
  globalLimit: number | null;
  perUserLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  scoped: boolean;
  createdAt: string;
}

export const VOUCHER_PAGE_SIZE = 25;

export async function listVouchers(filters: { status: "all" | "active" | "inactive"; q: string; page: number }): Promise<{ items: VoucherListRow[]; total: number }> {
  const status =
    filters.status === "active" ? sql`and is_active` : filters.status === "inactive" ? sql`and not is_active` : sql``;
  const q = filters.q ? sql`and code like ${`%${filters.q}%`}` : sql``;
  const rows = await db.execute<{
    id: string; code: string; type: string; value: number; min_spend_cents: number; used_count: number;
    global_limit: number | null; per_user_limit: number | null; starts_at: DbTimestamp | null; ends_at: DbTimestamp | null;
    is_active: boolean; applies_to_json: string; created_at: DbTimestamp; total: number;
  }>(sql`
    select id, code, type, value, min_spend_cents, used_count, global_limit, per_user_limit, starts_at, ends_at,
      is_active, applies_to_json, created_at, count(*) over ()::int as total
    from vouchers where true ${status} ${q}
    order by created_at desc
    limit ${VOUCHER_PAGE_SIZE} offset ${(filters.page - 1) * VOUCHER_PAGE_SIZE}
  `);
  return {
    total: Number(rows[0]?.total ?? 0),
    items: rows.map((r) => {
      const scope = parseAppliesTo(r.applies_to_json);
      return {
        id: r.id,
        code: r.code,
        type: r.type as VoucherType,
        value: Number(r.value),
        minSpendCents: Number(r.min_spend_cents),
        usedCount: Number(r.used_count),
        globalLimit: r.global_limit === null ? null : Number(r.global_limit),
        perUserLimit: r.per_user_limit === null ? null : Number(r.per_user_limit),
        startsAt: toIsoOrNull(r.starts_at),
        endsAt: toIsoOrNull(r.ends_at),
        isActive: r.is_active,
        scoped: scope.productIds.length > 0 || scope.categoryIds.length > 0,
        createdAt: toIso(r.created_at),
      };
    }),
  };
}

export interface VoucherDetail extends VoucherListRow {
  appliesToJson: string;
  firstOrderOnly: boolean;
  note: string | null;
  recent: { orderNumber: string; orderStatus: string; at: string; signedIn: boolean }[];
}

export async function getVoucher(id: string): Promise<VoucherDetail | null> {
  const [rows, recent] = await Promise.all([
    db.execute<{
      id: string; code: string; type: string; value: number; min_spend_cents: number; used_count: number;
      global_limit: number | null; per_user_limit: number | null; starts_at: DbTimestamp | null; ends_at: DbTimestamp | null;
      is_active: boolean; applies_to_json: string; created_at: DbTimestamp; first_order_only: boolean; note: string | null;
    }>(sql`select * from vouchers where id = ${id} limit 1`),
    db.execute<{ number: string; status: string; at: DbTimestamp; user_id: string | null }>(sql`
      select o.number, o.status, r.at, r.user_id from voucher_redemptions r
      join orders o on o.id = r.order_id
      where r.voucher_id = ${id} order by r.at desc limit 10
    `),
  ]);
  const r = rows[0];
  if (!r) return null;
  const scope = parseAppliesTo(r.applies_to_json);
  return {
    id: r.id,
    code: r.code,
    type: r.type as VoucherType,
    value: Number(r.value),
    minSpendCents: Number(r.min_spend_cents),
    usedCount: Number(r.used_count),
    globalLimit: r.global_limit === null ? null : Number(r.global_limit),
    perUserLimit: r.per_user_limit === null ? null : Number(r.per_user_limit),
    startsAt: toIsoOrNull(r.starts_at),
    endsAt: toIsoOrNull(r.ends_at),
    isActive: r.is_active,
    scoped: scope.productIds.length > 0 || scope.categoryIds.length > 0,
    createdAt: toIso(r.created_at),
    appliesToJson: r.applies_to_json,
    firstOrderOnly: r.first_order_only,
    note: r.note,
    recent: recent.map((x) => ({ orderNumber: x.number, orderStatus: x.status, at: toIso(x.at), signedIn: Boolean(x.user_id) })),
  };
}

export interface VoucherWrite {
  code: string;
  type: VoucherType;
  value: number;
  minSpendCents: number;
  appliesToJson: string;
  firstOrderOnly: boolean;
  perUserLimit: number | null;
  globalLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  note: string | null;
}

export async function insertVoucher(v: VoucherWrite): Promise<string> {
  const rows = await db.execute<{ id: string }>(sql`
    insert into vouchers (code, type, value, min_spend_cents, applies_to_json, first_order_only, per_user_limit,
      global_limit, starts_at, ends_at, is_active, note)
    values (${v.code}, ${v.type}, ${v.value}, ${v.minSpendCents}, ${v.appliesToJson}, ${v.firstOrderOnly},
      ${v.perUserLimit}, ${v.globalLimit}, ${v.startsAt?.toISOString() ?? null}, ${v.endsAt?.toISOString() ?? null},
      ${v.isActive}, ${v.note})
    returning id
  `);
  return rows[0]!.id;
}

export async function updateVoucher(id: string, v: VoucherWrite): Promise<boolean> {
  const rows = await db.execute(sql`
    update vouchers set code = ${v.code}, type = ${v.type}, value = ${v.value}, min_spend_cents = ${v.minSpendCents},
      applies_to_json = ${v.appliesToJson}, first_order_only = ${v.firstOrderOnly}, per_user_limit = ${v.perUserLimit},
      global_limit = ${v.globalLimit}, starts_at = ${v.startsAt?.toISOString() ?? null}, ends_at = ${v.endsAt?.toISOString() ?? null},
      is_active = ${v.isActive}, note = ${v.note}, updated_at = now()
    where id = ${id} returning id
  `);
  return rows.length > 0;
}

export async function setVoucherActive(id: string, isActive: boolean): Promise<boolean> {
  const rows = await db.execute(sql`update vouchers set is_active = ${isActive}, updated_at = now() where id = ${id} returning id`);
  return rows.length > 0;
}

export async function codeTaken(code: string, exceptId: string | null): Promise<boolean> {
  const rows = await db.execute(sql`select 1 from vouchers where code = ${code} and (${exceptId}::uuid is null or id <> ${exceptId}::uuid) limit 1`);
  return rows.length > 0;
}

function inList(values: string[]) {
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );
}

export async function productsBySlugs(slugs: string[]): Promise<{ id: string; slug: string }[]> {
  if (slugs.length === 0) return [];
  return db.execute<{ id: string; slug: string }>(sql`select id, slug from products where slug in (${inList(slugs)})`);
}

export async function productSlugsByIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.execute<{ slug: string }>(sql`select slug from products where id in (${inList(ids)}) order by slug`);
  return rows.map((r) => r.slug);
}

export async function categoryOptions(): Promise<{ id: string; slug: string; parentId: string | null }[]> {
  const rows = await db.execute<{ id: string; slug: string; parent_id: string | null }>(sql`
    select id, slug, parent_id from categories order by slug
  `);
  return rows.map((r) => ({ id: r.id, slug: r.slug, parentId: r.parent_id }));
}
