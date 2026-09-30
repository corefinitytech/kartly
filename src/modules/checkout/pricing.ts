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
  value: number;
  minSpendCents?: number;
}

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

  let voucherApplied = false;
  let orderDiscount = 0;
  const subtotalBeforePromo = subtotalCents;
  if (input.voucher) {
    assertAmount(input.voucher.value, "voucher value");
    const minSpend = input.voucher.minSpendCents ?? 0;
    assertAmount(minSpend, "voucher minSpendCents");
    const eligible = subtotalBeforePromo >= minSpend;
    if (eligible && input.voucher.type === "percent") {
      orderDiscount = Math.min(roundHalfUp((subtotalBeforePromo * input.voucher.value) / 100), subtotalBeforePromo);
      voucherApplied = true;
    } else if (eligible && input.voucher.type === "fixed_amount") {
      orderDiscount = Math.min(input.voucher.value, subtotalBeforePromo);
      voucherApplied = true;
    } else if (input.voucher.type === "free_shipping") {
      voucherApplied = true;
    }
  }
  orderDiscount = Math.min(orderDiscount, subtotalBeforePromo);

  const promoSplit = largestRemainderSplit(
    baseLines.map((l) => l.afterCents),
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
