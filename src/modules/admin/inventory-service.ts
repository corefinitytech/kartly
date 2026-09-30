import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { Staff } from "./guard";
import { applyStockDelta } from "./rules";
import type { StockAdjustmentInput } from "./schemas";

/**
 * Manual stock change (FR-ADM-04). Locks the variant row so a concurrent
 * checkout decrement cannot interleave, and writes the ledger in the same
 * transaction so stock and ledger never disagree.
 */
export async function adjustStock(staff: Staff, input: StockAdjustmentInput): Promise<{ stockAfter: number }> {
  const note = input.note ? `${input.reason}: ${input.note}` : input.reason;
  const stockAfter = await db.transaction(async (tx) => {
    const rows = await tx.execute<{ stock_qty: number }>(sql`
      select stock_qty from product_variants where id = ${input.variantId} for update
    `);
    const current = rows[0]?.stock_qty;
    if (current === undefined) throw new AppError("NOT_FOUND", "Variant not found.");
    const next = applyStockDelta(current, input.delta);
    await tx.execute(sql`update product_variants set stock_qty = ${next} where id = ${input.variantId}`);
    await tx.execute(sql`
      insert into inventory_ledger (variant_id, delta, reason, ref_id, actor_id, note)
      values (${input.variantId}, ${input.delta}, 'adjust', null, ${staff.id}, ${note})
    `);
    return next;
  });
  await writeAudit({
    actorId: staff.id,
    actorRole: staff.role,
    action: "inventory.adjusted",
    entityType: "variant",
    entityId: input.variantId,
    meta: { delta: input.delta, reason: input.reason, stockAfter },
    ip: staff.ip,
  }).catch(() => undefined);
  revalidateTag("catalog");
  revalidatePath("/", "layout");
  return { stockAfter };
}

export async function setLowStockThreshold(staff: Staff, variantId: string, threshold: number): Promise<void> {
  const rows = await db.execute(sql`
    update product_variants set low_stock_threshold = ${threshold} where id = ${variantId} returning id
  `);
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Variant not found.");
  await writeAudit({
    actorId: staff.id,
    actorRole: staff.role,
    action: "inventory.threshold_changed",
    entityType: "variant",
    entityId: variantId,
    meta: { threshold },
    ip: staff.ip,
  }).catch(() => undefined);
  revalidateTag("catalog");
  revalidatePath("/", "layout");
}
