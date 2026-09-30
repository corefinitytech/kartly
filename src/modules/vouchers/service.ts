import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/lib/audit";
import type { PricingResult, PricingVoucher } from "@/modules/checkout/pricing";
import type { Staff } from "@/modules/admin/guard";
import * as repo from "./repo";
import {
  checkVoucher,
  describeVoucher,
  limitRejection,
  outcomeRejection,
  rejectionMessage,
  toPricingVoucher,
  type VoucherRejection,
  type VoucherRule,
} from "./rules";
import type { VoucherFormInput } from "./schemas";

// Checkout -------------------------------------------------------------------

export interface VoucherEvaluation {
  code: string;
  rule: VoucherRule | null;
  rejection: VoucherRejection | null;
  pricingVoucher: PricingVoucher | undefined;
}

/** What the checkout shows next to the code box. */
export interface VoucherSummary {
  code: string;
  applied: boolean;
  label: string | null;
  message: string | null;
}

/**
 * Look up a code for this cart and check every rule except min spend (which the
 * pricing engine reports). One parallel round trip. Never trusts the client:
 * the code string is the only input.
 */
export async function evaluateForCart(code: string, userId: string | null, cartId: string): Promise<VoucherEvaluation> {
  const [found, lines] = await Promise.all([repo.findByCodeWithUsage(code, userId), repo.cartLineScopes(cartId)]);
  const check = checkVoucher(found?.rule ?? null, {
    now: new Date(),
    signedIn: userId !== null,
    userRedemptions: found?.userRedemptions ?? 0,
    userOrders: found?.userOrders ?? 0,
    lines,
  });
  if (!check.ok) return { code, rule: found?.rule ?? null, rejection: check.reason, pricingVoucher: undefined };
  return { code, rule: found!.rule, rejection: null, pricingVoucher: toPricingVoucher(found!.rule, check.eligibleVariantIds) };
}

/** Combine the rule check with the priced outcome (min spend, scope). */
export function summarize(evaluation: VoucherEvaluation, priced: Pick<PricingResult, "voucherOutcome" | "subtotalCents">): VoucherSummary {
  const rejection = evaluation.rejection ?? outcomeRejection(priced.voucherOutcome);
  if (rejection) {
    return {
      code: evaluation.code,
      applied: false,
      label: null,
      message: rejectionMessage(rejection, evaluation.rule, priced.subtotalCents),
    };
  }
  return { code: evaluation.code, applied: true, label: evaluation.rule ? describeVoucher(evaluation.rule) : null, message: null };
}

/**
 * Record the redemption inside the place-order transaction. Throws a friendly
 * AppError (rolling the whole order back) if another order took the last use.
 */
export async function redeemInTx(tx: repo.Tx, voucherId: string, userId: string | null, orderId: string): Promise<void> {
  const claimed = await repo.claimInTx(tx, voucherId);
  if (!claimed) {
    throw new AppError("CONFLICT", rejectionMessage("limit_reached"));
  }
  let userSeq: number | null = null;
  if (userId) {
    const usage = await repo.userUsageInTx(tx, voucherId, userId, orderId);
    const limited = limitRejection(
      { ...claimed, usedCount: 0 }, // global limit already enforced by the conditional increment
      { signedIn: true, userRedemptions: usage.redemptions, userOrders: usage.orders },
    );
    if (limited) throw new AppError("CONFLICT", rejectionMessage(limited));
    userSeq = usage.redemptions + 1;
  } else if (claimed.perUserLimit !== null || claimed.firstOrderOnly) {
    throw new AppError("VALIDATION", rejectionMessage("sign_in_required"));
  }
  try {
    await repo.insertRedemptionInTx(tx, voucherId, userId, orderId, userSeq);
  } catch (error) {
    if (error instanceof Error && error.message.includes("voucher_redemptions_user_seq_unique")) {
      throw new AppError("CONFLICT", rejectionMessage("already_used"));
    }
    throw error;
  }
}

// Admin ----------------------------------------------------------------------

function audit(staff: Staff, action: string, entityId: string, meta?: Record<string, unknown>) {
  return writeAudit({ actorId: staff.id, actorRole: staff.role, action, entityType: "voucher", entityId, meta, ip: staff.ip }).catch(() =>
    logger.error({ action }, "audit write failed"),
  );
}

async function toWrite(input: VoucherFormInput, exceptId: string | null): Promise<repo.VoucherWrite> {
  const [taken, products, categories] = await Promise.all([
    repo.codeTaken(input.code, exceptId),
    repo.productsBySlugs(input.productSlugs),
    input.categoryIds.length > 0 ? repo.categoryOptions() : Promise.resolve([]),
  ]);
  if (taken) throw new AppError("CONFLICT", `The code ${input.code} is already in use.`);
  const missing = input.productSlugs.filter((s) => !products.some((p) => p.slug === s));
  if (missing.length > 0) throw new AppError("VALIDATION", `No product with the URL slug ${missing.slice(0, 3).join(", ")}.`);
  const known = new Set(categories.map((c) => c.id));
  if (input.categoryIds.some((id) => !known.has(id))) throw new AppError("VALIDATION", "Choose categories from the list.");
  return {
    code: input.code,
    type: input.type,
    value: input.value,
    minSpendCents: input.minSpendCents,
    appliesToJson: JSON.stringify({ productIds: products.map((p) => p.id), categoryIds: input.categoryIds }),
    firstOrderOnly: input.firstOrderOnly,
    perUserLimit: input.perUserLimit,
    globalLimit: input.globalLimit,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    isActive: input.isActive,
    note: input.note,
  };
}

function isConstraint(error: unknown, name: string): boolean {
  return error instanceof Error && error.message.includes(name);
}

export async function createVoucher(staff: Staff, input: VoucherFormInput): Promise<string> {
  const write = await toWrite(input, null);
  try {
    const id = await repo.insertVoucher(write);
    await audit(staff, "voucher.created", id, { type: write.type });
    return id;
  } catch (error) {
    if (isConstraint(error, "vouchers_code_unique")) throw new AppError("CONFLICT", `The code ${input.code} is already in use.`);
    throw error;
  }
}

export async function updateVoucher(staff: Staff, id: string, input: VoucherFormInput): Promise<void> {
  const current = await repo.getVoucher(id);
  if (!current) throw new AppError("NOT_FOUND", "That voucher no longer exists.");
  if (input.globalLimit !== null && input.globalLimit < current.usedCount) {
    throw new AppError("VALIDATION", `It has been used ${current.usedCount} times, so the total limit cannot be lower than that.`);
  }
  if (current.usedCount > 0 && (input.code !== current.code || input.type !== current.type)) {
    throw new AppError("VALIDATION", "This code has been used, so its code and type stay fixed. Create a new voucher instead.");
  }
  const write = await toWrite(input, id);
  try {
    if (!(await repo.updateVoucher(id, write))) throw new AppError("NOT_FOUND", "That voucher no longer exists.");
  } catch (error) {
    if (isConstraint(error, "vouchers_code_unique")) throw new AppError("CONFLICT", `The code ${input.code} is already in use.`);
    throw error;
  }
  await audit(staff, "voucher.updated", id);
}

export async function setVoucherActive(staff: Staff, id: string, isActive: boolean): Promise<void> {
  if (!(await repo.setVoucherActive(id, isActive))) throw new AppError("NOT_FOUND", "That voucher no longer exists.");
  await audit(staff, isActive ? "voucher.activated" : "voucher.deactivated", id);
}

export const listVouchers = repo.listVouchers;
export const getVoucher = repo.getVoucher;
export const categoryOptions = repo.categoryOptions;
export const productSlugsByIds = repo.productSlugsByIds;
