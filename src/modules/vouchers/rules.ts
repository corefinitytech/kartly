// Voucher rules (PRD 5.8, FR-VCH-01/02). Pure, so every rule is unit tested.
// The money maths lives in the pricing engine (checkout/pricing.ts); this file
// decides whether a code may be used at all and which lines it may touch.
import { formatCents } from "@/lib/money";
import type { PricingVoucher, VoucherOutcome } from "@/modules/checkout/pricing";

export const VOUCHER_TYPES = ["percent", "fixed_amount", "free_shipping"] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

export interface AppliesTo {
  productIds: string[];
  categoryIds: string[];
}

export interface VoucherRule {
  id: string;
  code: string;
  type: VoucherType;
  value: number;
  minSpendCents: number;
  appliesTo: AppliesTo;
  firstOrderOnly: boolean;
  perUserLimit: number | null;
  globalLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface VoucherLine {
  variantId: string;
  productId: string;
  /** The product's category and its parent, so a top level category covers its children. */
  categoryIds: string[];
}

export interface VoucherContext {
  now: Date;
  signedIn: boolean;
  /** Redemptions of this code by this user (0 for guests). */
  userRedemptions: number;
  /** The user's earlier orders that were not cancelled (0 for guests). */
  userOrders: number;
  lines: VoucherLine[];
}

export type VoucherRejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "sign_in_required"
  | "first_order_only"
  | "already_used"
  | "limit_reached"
  | "not_applicable"
  | "min_spend";

export type VoucherCheck =
  | { ok: true; eligibleVariantIds: string[] | undefined }
  | { ok: false; reason: VoucherRejection };

/** Codes are case-insensitive and stored upper case; spaces people paste are dropped. */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

export const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export function parseAppliesTo(json: string | null | undefined): AppliesTo {
  try {
    const raw = JSON.parse(json || "{}") as Partial<Record<keyof AppliesTo, unknown>>;
    const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    return { productIds: ids(raw.productIds), categoryIds: ids(raw.categoryIds) };
  } catch {
    return { productIds: [], categoryIds: [] };
  }
}

export function isUnrestricted(appliesTo: AppliesTo): boolean {
  return appliesTo.productIds.length === 0 && appliesTo.categoryIds.length === 0;
}

/** Variant ids a scoped code may discount; undefined means the whole cart. */
export function eligibleVariantIds(appliesTo: AppliesTo, lines: VoucherLine[]): string[] | undefined {
  if (isUnrestricted(appliesTo)) return undefined;
  return lines
    .filter(
      (l) => appliesTo.productIds.includes(l.productId) || l.categoryIds.some((c) => appliesTo.categoryIds.includes(c)),
    )
    .map((l) => l.variantId);
}

/**
 * Usage limits (AC-5). Used for the friendly pre-check and again inside the
 * place-order transaction after the voucher row is locked, where it is final.
 */
export function limitRejection(
  v: Pick<VoucherRule, "perUserLimit" | "globalLimit" | "usedCount" | "firstOrderOnly">,
  usage: { signedIn: boolean; userRedemptions: number; userOrders: number },
): VoucherRejection | null {
  if ((v.perUserLimit !== null || v.firstOrderOnly) && !usage.signedIn) return "sign_in_required";
  if (v.perUserLimit !== null && usage.userRedemptions >= v.perUserLimit) return "already_used";
  if (v.firstOrderOnly && usage.userOrders > 0) return "first_order_only";
  if (v.globalLimit !== null && v.usedCount >= v.globalLimit) return "limit_reached";
  return null;
}

/** Everything except min spend, which the pricing engine reports on the real subtotal. */
export function checkVoucher(v: VoucherRule | null, ctx: VoucherContext): VoucherCheck {
  if (!v) return { ok: false, reason: "not_found" };
  if (!v.isActive) return { ok: false, reason: "inactive" };
  if (v.startsAt && ctx.now < v.startsAt) return { ok: false, reason: "not_started" };
  if (v.endsAt && ctx.now >= v.endsAt) return { ok: false, reason: "expired" };
  const limited = limitRejection(v, ctx);
  if (limited) return { ok: false, reason: limited };
  const eligible = eligibleVariantIds(v.appliesTo, ctx.lines);
  if (eligible && eligible.length === 0) return { ok: false, reason: "not_applicable" };
  return { ok: true, eligibleVariantIds: eligible };
}

export function toPricingVoucher(v: VoucherRule, eligible: string[] | undefined): PricingVoucher {
  return {
    type: v.type,
    value: v.type === "free_shipping" ? 0 : v.value,
    minSpendCents: v.minSpendCents,
    ...(eligible ? { eligibleVariantIds: eligible } : {}),
  };
}

export function outcomeRejection(outcome: VoucherOutcome | undefined): VoucherRejection | null {
  if (outcome === "min_spend" || outcome === "not_applicable") return outcome;
  return null;
}

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Specific, friendly messages (FR-VCH-01). Never says more than the shopper needs. */
export function rejectionMessage(
  reason: VoucherRejection,
  v?: Pick<VoucherRule, "minSpendCents" | "startsAt" | "endsAt"> | null,
  subtotalCents?: number,
): string {
  switch (reason) {
    case "not_found":
      return "We don't recognise that code. Check the spelling and try again.";
    case "inactive":
      return "This code is no longer active.";
    case "not_started":
      return v?.startsAt ? `This code starts on ${dateFormat.format(v.startsAt)}.` : "This code is not active yet.";
    case "expired":
      return v?.endsAt ? `This code expired on ${dateFormat.format(v.endsAt)}.` : "This code has expired.";
    case "sign_in_required":
      return "Sign in to use this code. It is limited per customer.";
    case "first_order_only":
      return "This code is for a first order only.";
    case "already_used":
      return "You have already used this code.";
    case "limit_reached":
      return "This code has been fully used.";
    case "not_applicable":
      return "This code does not apply to the items in your cart.";
    case "min_spend": {
      const min = v?.minSpendCents ?? 0;
      const gap = subtotalCents !== undefined ? Math.max(0, min - subtotalCents) : 0;
      return gap > 0
        ? `Spend ${formatCents(min)} or more to use this code. Add ${formatCents(gap)} more.`
        : `Spend ${formatCents(min)} or more to use this code.`;
    }
  }
}

/** Short label for the order summary and admin list, e.g. "10% off", "$5.00 off", "Free shipping". */
export function describeVoucher(v: Pick<VoucherRule, "type" | "value">): string {
  if (v.type === "percent") return `${v.value}% off`;
  if (v.type === "fixed_amount") return `${formatCents(v.value)} off`;
  return "Free shipping";
}
