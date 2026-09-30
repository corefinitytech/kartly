import { roundHalfUp } from "@/lib/money";

export interface PricingLine {
  variantId: string;
  unitPriceCents: number;
  quantity: number;
  dealPriceCents?: number;
  clippedCouponDiscountCents?: number;
}

export interface PricingVoucher {
  type: "percent" | "fixed_amount" | "free_shipping";
  /** Percent 1-100, or cents for fixed_amount. Ignored for free_shipping. */
  value: number;
  minSpendCents?: number;
  /** Lines the promo may discount. Omitted means every line. */
  eligibleVariantIds?: readonly string[];
}

/** Why a supplied voucher did or did not change the price. */
export type VoucherOutcome = "applied" | "min_spend" | "not_applicable";

export interface PricingShippingMethod {
  priceCents: number;
  freeOverCents?: number | null;
}

export interface PricingInstruments {
  giftCardCents?: number;
  storeCreditCents?: number;
}

export interface PricingInput {
  lines: PricingLine[];
  voucher?: PricingVoucher;
  shippingMethod: PricingShippingMethod;
  taxRateBps: number;
  instruments?: PricingInstruments;
}

export interface PricedLine {
  variantId: string;
  quantity: number;
  baseCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  instrumentsCents: number;
  payableCents: number;
  freeShippingRemainingCents: number;
  /** Present only when a voucher was supplied. */
  voucherOutcome?: VoucherOutcome;
  breakdown: Record<string, unknown>;
}

function assertAmount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function largestRemainderSplit(amounts: number[], total: number): number[] {
  if (amounts.length === 0) return [];
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum === 0 || total === 0) return amounts.map(() => 0);
  const raw = amounts.map((a) => (a * total) / sum);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  let i = 0;
  while (remainder > 0 && order.length > 0) {
    result[order[i % order.length]!.index]! += 1;
    remainder -= 1;
    i += 1;
  }
  return result;
}

function lineItemDiscountCents(line: PricingLine): number {
  const dealDiscount =
    line.dealPriceCents !== undefined
      ? Math.max(0, line.unitPriceCents - line.dealPriceCents) * line.quantity
      : 0;
  const coupon = line.clippedCouponDiscountCents ?? 0;
  return Math.min(Math.max(dealDiscount, coupon), line.unitPriceCents * line.quantity);
}

export function freeShippingRemaining(subtotal: number, threshold: number | null | undefined): number {
  if (threshold === null || threshold === undefined) return 0;
  return Math.max(0, threshold - subtotal);
}

export function estimateShipping<T extends { priceCents: number; isActive: boolean }>(
  methods: T[],
): T | null {
  const active = methods.filter((m) => m.isActive);
  if (active.length === 0) return null;
  return active.reduce((cheapest, m) => (m.priceCents < cheapest.priceCents ? m : cheapest));
}

export function priceCart(input: PricingInput): PricingResult {
  if (input.lines.length === 0) {
    throw new Error("At least one line is required");
  }
  if (!Number.isInteger(input.taxRateBps) || input.taxRateBps < 0) {
    throw new Error("taxRateBps must be a non-negative integer");
  }

  const baseLines = input.lines.map((line) => {
    assertAmount(line.unitPriceCents, "unitPriceCents");
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("quantity must be a positive integer");
    }
    if (line.dealPriceCents !== undefined) assertAmount(line.dealPriceCents, "dealPriceCents");
    if (line.clippedCouponDiscountCents !== undefined) {
      assertAmount(line.clippedCouponDiscountCents, "clippedCouponDiscountCents");
    }
    const baseCents = line.unitPriceCents * line.quantity;
    const itemDiscount = lineItemDiscountCents(line);
    return { line, baseCents, itemDiscount, afterCents: baseCents - itemDiscount };
  });

  const subtotalCents = baseLines.reduce((sum, l) => sum + l.afterCents, 0);

  // Step 4: one order level promo (D-08). Min spend is checked on the whole
  // post item discount subtotal; the discount itself only touches eligible lines.
  let voucherApplied = false;
  let voucherOutcome: VoucherOutcome | undefined;
  let orderDiscount = 0;
  const subtotalBeforePromo = subtotalCents;
  const eligibleMask = baseLines.map(
    (l) => !input.voucher?.eligibleVariantIds || input.voucher.eligibleVariantIds.includes(l.line.variantId),
  );
  if (input.voucher) {
    assertAmount(input.voucher.value, "voucher value");
    if (input.voucher.type === "percent" && input.voucher.value > 100) {
      throw new Error("percent voucher value must be at most 100");
    }
    const minSpend = input.voucher.minSpendCents ?? 0;
    assertAmount(minSpend, "voucher minSpendCents");
    const eligibleSubtotal = baseLines.reduce((sum, l, i) => sum + (eligibleMask[i] ? l.afterCents : 0), 0);
    if (!eligibleMask.some(Boolean)) {
      voucherOutcome = "not_applicable";
    } else if (subtotalBeforePromo < minSpend) {
      voucherOutcome = "min_spend";
    } else {
      voucherOutcome = "applied";
      voucherApplied = true;
      if (input.voucher.type === "percent") {
        orderDiscount = roundHalfUp((eligibleSubtotal * input.voucher.value) / 100);
      } else if (input.voucher.type === "fixed_amount") {
        orderDiscount = input.voucher.value;
      }
      orderDiscount = Math.min(orderDiscount, eligibleSubtotal);
    }
  }
  orderDiscount = Math.min(orderDiscount, subtotalBeforePromo);

  // Fixed and percent discounts are spread over eligible lines (exact sum) for refunds and tax.
  const promoSplit = largestRemainderSplit(
    baseLines.map((l, i) => (eligibleMask[i] ? l.afterCents : 0)),
    orderDiscount,
  );

  const linesAfterPromo = baseLines.map((l, i) => l.afterCents - promoSplit[i]!);
  const subtotalAfterPromo = linesAfterPromo.reduce((a, b) => a + b, 0);

  const freeShipping =
    (input.voucher?.type === "free_shipping" && voucherApplied) ||
    (input.shippingMethod.freeOverCents !== null &&
      input.shippingMethod.freeOverCents !== undefined &&
      subtotalAfterPromo >= input.shippingMethod.freeOverCents);
  const shippingCents = freeShipping ? 0 : input.shippingMethod.priceCents;

  const taxCents = roundHalfUp(((subtotalAfterPromo + shippingCents) * input.taxRateBps) / 10000);
  const goodsTaxCents = roundHalfUp((subtotalAfterPromo * input.taxRateBps) / 10000);
  const taxSplit = largestRemainderSplit(linesAfterPromo, goodsTaxCents);

  const totalCents = subtotalAfterPromo + shippingCents + taxCents;

  const giftCard = input.instruments?.giftCardCents ?? 0;
  const storeCredit = input.instruments?.storeCreditCents ?? 0;
  assertAmount(giftCard, "giftCardCents");
  assertAmount(storeCredit, "storeCreditCents");
  const giftApplied = Math.min(giftCard, totalCents);
  const creditApplied = Math.min(storeCredit, totalCents - giftApplied);
  const instrumentsCents = giftApplied + creditApplied;
  const payableCents = totalCents - instrumentsCents;

  const pricedLines: PricedLine[] = baseLines.map((l, i) => ({
    variantId: l.line.variantId,
    quantity: l.line.quantity,
    baseCents: l.baseCents,
    discountCents: l.itemDiscount + promoSplit[i]!,
    taxCents: taxSplit[i]!,
    totalCents: l.baseCents - l.itemDiscount - promoSplit[i]! + taxSplit[i]!,
  }));

  return {
    lines: pricedLines,
    subtotalCents: subtotalBeforePromo,
    discountCents: orderDiscount,
    shippingCents,
    taxCents,
    totalCents,
    instrumentsCents,
    payableCents,
    freeShippingRemainingCents: freeShipping
      ? 0
      : freeShippingRemaining(subtotalAfterPromo, input.shippingMethod.freeOverCents),
    ...(voucherOutcome ? { voucherOutcome } : {}),
    breakdown: {
      lines: baseLines.map((l, i) => ({
        variantId: l.line.variantId,
        baseCents: l.baseCents,
        itemDiscountCents: l.itemDiscount,
        promoDiscountCents: promoSplit[i],
        taxCents: taxSplit[i],
        totalCents: pricedLines[i]!.totalCents,
      })),
      subtotalCents: subtotalBeforePromo,
      orderDiscountCents: orderDiscount,
      voucher: input.voucher ? { type: input.voucher.type, outcome: voucherOutcome } : null,
      subtotalAfterPromoCents: subtotalAfterPromo,
      shippingCents,
      freeShipping,
      taxRateBps: input.taxRateBps,
      taxCents,
      totalCents,
      instrumentsCents: { giftCardCents: giftApplied, storeCreditCents: creditApplied },
      payableCents,
    },
  };
}
