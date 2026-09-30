import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { carts } from "@/db/schema/cart";
import { planGuestCartMerge } from "./merge";
import type { MergePlan } from "./merge";

export async function mergeGuestCartIntoUser(guestTokenHash: string, userId: string): Promise<MergePlan> {
  return db.transaction(async (tx) => {
    const guestCart = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.guestTokenHash, guestTokenHash), sql`${carts.userId} is null`))
      .limit(1);
    const guestCartId = guestCart[0]?.id;
    if (!guestCartId) {
      return { lines: [], mergedAnything: false, clampedAnything: false };
    }

    const rows = await tx.execute<{
      variant_id: string;
      guest_qty: number;
      user_qty: number | null;
      guest_price: number;
      user_price: number | null;
      stock_qty: number;
    }>(sql`
      with guest_items as (
        select ci.variant_id, ci.qty as guest_qty, ci.added_price_cents as guest_price,
               v.stock_qty
        from cart_items ci
        join product_variants v on v.id = ci.variant_id
        join products p on p.id = v.product_id and p.status = 'active'
        where ci.cart_id = ${guestCartId} and ci.saved_for_later = false
      )
      select g.variant_id, g.guest_qty, g.guest_price, g.stock_qty,
             u.qty as user_qty, u.added_price_cents as user_price
      from guest_items g
      left join cart_items u on u.variant_id = g.variant_id and u.cart_id = (
        select id from carts where user_id = ${userId} limit 1
      )
    `);

    if (rows.length === 0) {
      await tx.delete(carts).where(eq(carts.id, guestCartId));
      return { lines: [], mergedAnything: false, clampedAnything: false };
    }

    const plan = planGuestCartMerge(
      rows.map((r) => ({
        variantId: r.variant_id,
        guestQty: r.guest_qty,
        userQty: r.user_qty,
        guestAddedPriceCents: r.guest_price,
        userAddedPriceCents: r.user_price,
        stockQty: r.stock_qty,
      })),
    );

    const userCartRows = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, userId))
      .limit(1);
    const userCartId =
      userCartRows[0]?.id ??
      (await tx
        .insert(carts)
        .values({ userId, estimateCountry: "US" })
        .returning({ id: carts.id }))[0]!.id;

    for (const line of plan.lines) {
      await tx.execute(sql`
        insert into cart_items (cart_id, variant_id, qty, added_price_cents)
        values (${userCartId}, ${line.variantId}, ${line.quantity}, ${line.addedPriceCents})
        on conflict (cart_id, variant_id) do update set
          qty = excluded.qty,
          added_price_cents = excluded.added_price_cents
      `);
    }

    await tx.delete(carts).where(eq(carts.id, guestCartId));
    return plan;
  });
}

export async function cartExistsForUser(userId: string): Promise<boolean> {
  const rows = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
  return rows.length > 0;
}
