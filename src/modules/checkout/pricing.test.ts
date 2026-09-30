import { describe, expect, it } from "vitest";
import { estimateShipping, priceCart, type PricingInput } from "./pricing";

function input(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    lines: [{ variantId: "v1", unitPriceCents: 1000, quantity: 1 }],
    shippingMethod: { priceCents: 499, freeOverCents: 5000 },
    taxRateBps: 700,
    ...overrides,
  };
}

describe("priceCart basics", () => {
  it("prices a single line", () => {
    const result = priceCart(input());
    expect(result.subtotalCents).toBe(1000);
    expect(result.discountCents).toBe(0);
    expect(result.shippingCents).toBe(499);
    expect(result.taxCents).toBe(Math.round((1499 * 700) / 10000));
    expect(result.totalCents).toBe(1000 + 499 + result.taxCents);
    expect(result.payableCents).toBe(result.totalCents);
    expect(result.lines[0]).toMatchObject({ baseCents: 1000, discountCents: 0 });
  });

  it("sums multiple lines", () => {
    const result = priceCart(
      input({
        lines: [
          { variantId: "a", unitPriceCents: 333, quantity: 1 },
          { variantId: "b", unitPriceCents: 333, quantity: 1 },
          { variantId: "c", unitPriceCents: 334, quantity: 1 },
        ],
      }),
    );
    expect(result.subtotalCents).toBe(1000);
    expect(result.lines).toHaveLength(3);
    expect(result.lines.reduce((s, l) => s + l.baseCents, 0)).toBe(1000);
  });

  it("applies the best item level discount without stacking", () => {
    const result = priceCart(
      input({
        lines: [
          {
            variantId: "a",
            unitPriceCents: 1000,
            quantity: 2,
            dealPriceCents: 800,
            clippedCouponDiscountCents: 100,
          },
        ],
      }),
    );
    expect(result.lines[0]!.discountCents).toBe(400);
    expect(result.subtotalCents).toBe(1600);
  });
});

describe("vouchers", () => {
  it("applies a percent voucher", () => {
    const result = priceCart(input({ voucher: { type: "percent", value: 10 } }));
    expect(result.discountCents).toBe(100);
  });

  it("applies a fixed voucher capped at the subtotal", () => {
    const result = priceCart(input({ voucher: { type: "fixed_amount", value: 5000 } }));
    expect(result.discountCents).toBe(1000);
  });

  it("skips the voucher when min spend is not met", () => {
    const result = priceCart(input({ voucher: { type: "fixed_amount", value: 100, minSpendCents: 2000 } }));
    expect(result.discountCents).toBe(0);
  });

  it("distributes a fixed discount with exact sum (333 x3 with 100 off)", () => {
    const result = priceCart(
      input({
        lines: [
          { variantId: "a", unitPriceCents: 333, quantity: 1 },
          { variantId: "b", unitPriceCents: 333, quantity: 1 },
          { variantId: "c", unitPriceCents: 333, quantity: 1 },
        ],
        voucher: { type: "fixed_amount", value: 100 },
      }),
    );
    const allocations = result.lines.map((l) => l.discountCents);
    expect(allocations.reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocations).toEqual([34, 33, 33]);
  });

  it("gives free shipping with a free_shipping voucher", () => {
    const result = priceCart(input({ voucher: { type: "free_shipping", value: 0 } }));
    expect(result.shippingCents).toBe(0);
    expect(result.voucherOutcome).toBe("applied");
  });

  it("keeps shipping when a free_shipping voucher misses its min spend", () => {
    const result = priceCart(input({ voucher: { type: "free_shipping", value: 0, minSpendCents: 2000 } }));
    expect(result.shippingCents).toBe(499);
    expect(result.voucherOutcome).toBe("min_spend");
  });

  it("reports min_spend and leaves the total alone", () => {
    const plain = priceCart(input());
    const result = priceCart(input({ voucher: { type: "percent", value: 20, minSpendCents: 1001 } }));
    expect(result.voucherOutcome).toBe("min_spend");
    expect(result.totalCents).toBe(plain.totalCents);
  });

  it("rejects a percent above 100", () => {
    expect(() => priceCart(input({ voucher: { type: "percent", value: 101 } }))).toThrow();
  });

  it("applies 100 percent without going negative", () => {
    const result = priceCart(input({ voucher: { type: "percent", value: 100 } }));
    expect(result.discountCents).toBe(1000);
    expect(result.totalCents).toBe(499 + Math.round(499 * 0.07));
  });

  it("discounts only eligible lines and allocates to them only", () => {
    const result = priceCart(
      input({
        lines: [
          { variantId: "a", unitPriceCents: 2000, quantity: 1 },
          { variantId: "b", unitPriceCents: 3000, quantity: 1 },
        ],
        voucher: { type: "percent", value: 10, eligibleVariantIds: ["b"] },
      }),
    );
    expect(result.discountCents).toBe(300);
    expect(result.lines.map((l) => l.discountCents)).toEqual([0, 300]);
  });

  it("caps a fixed voucher at the eligible lines' subtotal", () => {
    const result = priceCart(
      input({
        lines: [
          { variantId: "a", unitPriceCents: 2000, quantity: 1 },
          { variantId: "b", unitPriceCents: 500, quantity: 1 },
        ],
        voucher: { type: "fixed_amount", value: 1000, eligibleVariantIds: ["b"] },
      }),
    );
    expect(result.discountCents).toBe(500);
    expect(result.lines.map((l) => l.discountCents)).toEqual([0, 500]);
  });

  it("reports not_applicable when no line is eligible", () => {
    const result = priceCart(input({ voucher: { type: "percent", value: 10, eligibleVariantIds: ["other"] } }));
    expect(result.voucherOutcome).toBe("not_applicable");
    expect(result.discountCents).toBe(0);
  });

  it("computes tax after the promo (PRD 6 step 6)", () => {
    const result = priceCart(input({ voucher: { type: "fixed_amount", value: 500 } }));
    expect(result.taxCents).toBe(Math.round(((1000 - 500 + 499) * 700) / 10000));
    expect(result.totalCents).toBe(500 + 499 + result.taxCents);
  });

  it("uses the post promo subtotal for the free shipping threshold", () => {
    const result = priceCart(
      input({
        lines: [{ variantId: "a", unitPriceCents: 5000, quantity: 1 }],
        voucher: { type: "fixed_amount", value: 1 },
      }),
    );
    expect(result.shippingCents).toBe(499);
  });
});

describe("shipping and tax", () => {
  it("free shipping exactly at the threshold", () => {
    const result = priceCart(
      input({ lines: [{ variantId: "a", unitPriceCents: 5000, quantity: 1 }] }),
    );
    expect(result.shippingCents).toBe(0);
    expect(result.freeShippingRemainingCents).toBe(0);
  });

  it("reports the remaining amount under the threshold", () => {
    const result = priceCart(input({ lines: [{ variantId: "a", unitPriceCents: 4900, quantity: 1 }] }));
    expect(result.shippingCents).toBe(499);
    expect(result.freeShippingRemainingCents).toBe(100);
  });

  it("rounds tax half up", () => {
    const result = priceCart(
      input({ lines: [{ variantId: "a", unitPriceCents: 333, quantity: 1 }], shippingMethod: { priceCents: 0 } }),
    );
    expect(result.taxCents).toBe(23);
  });

  it("tax line allocations sum to the tax total", () => {
    const result = priceCart(
      input({
        lines: [
          { variantId: "a", unitPriceCents: 111, quantity: 1 },
          { variantId: "b", unitPriceCents: 222, quantity: 2 },
          { variantId: "c", unitPriceCents: 333, quantity: 3 },
        ],
      }),
    );
    expect(result.subtotalCents).toBe(1554);
    const goodsTax = Math.round((1554 * 700) / 10000);
    expect(result.lines.reduce((s, l) => s + l.taxCents, 0)).toBe(goodsTax);
    expect(result.taxCents).toBe(Math.round(((1554 + 499) * 700) / 10000));
  });
});

describe("instruments", () => {
  it("applies gift card then store credit", () => {
    const result = priceCart(input({ instruments: { giftCardCents: 500, storeCreditCents: 100000 } }));
    expect(result.instrumentsCents).toBe(result.totalCents);
    expect(result.payableCents).toBe(0);
  });

  it("never lets payable go below zero", () => {
    const result = priceCart(input({ instruments: { giftCardCents: 10, storeCreditCents: 10 } }));
    expect(result.payableCents).toBe(result.totalCents - 20);
  });
});

describe("validation", () => {
  it("rejects zero quantity", () => {
    expect(() => priceCart(input({ lines: [{ variantId: "a", unitPriceCents: 100, quantity: 0 }] }))).toThrow();
  });

  it("rejects negative values", () => {
    expect(() => priceCart(input({ lines: [{ variantId: "a", unitPriceCents: -1, quantity: 1 }] }))).toThrow();
    expect(() => priceCart(input({ voucher: { type: "percent", value: -5 } }))).toThrow();
  });
});

describe("freeShippingRemaining", () => {
  it("returns the gap under the threshold and zero above it", async () => {
    const { freeShippingRemaining } = await import("./pricing");
    expect(freeShippingRemaining(4000, 5000)).toBe(1000);
    expect(freeShippingRemaining(6000, 5000)).toBe(0);
    expect(freeShippingRemaining(6000, null)).toBe(0);
  });
});

describe("estimateShipping helper", () => {
  it("picks the cheapest active method", () => {
    const methods = [
      { code: "e", priceCents: 1299, isActive: true },
      { code: "s", priceCents: 499, isActive: true },
      { code: "x", priceCents: 1, isActive: false },
    ];
    expect(estimateShipping(methods)?.priceCents).toBe(499);
  });

  it("returns null when none are active", () => {
    expect(estimateShipping([{ code: "x", priceCents: 1, isActive: false }])).toBeNull();
  });
});

describe("property checks", () => {
  function mulberry32(seed: number) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("keeps allocations exact and values non-negative across random inputs", () => {
    const rand = mulberry32(42);
    for (let i = 0; i < 500; i++) {
      const lineCount = 1 + Math.floor(rand() * 5);
      const lines = Array.from({ length: lineCount }, (_, j) => ({
        variantId: `v${j}`,
        unitPriceCents: Math.floor(rand() * 5000) + 1,
        quantity: Math.floor(rand() * 10) + 1,
        dealPriceCents: rand() > 0.7 ? Math.floor(rand() * 3000) : undefined,
        clippedCouponDiscountCents: rand() > 0.8 ? Math.floor(rand() * 500) : undefined,
      }));
      const voucherType = (["percent", "fixed_amount", "free_shipping"] as const)[Math.floor(rand() * 3)]!;
      const voucher =
        rand() > 0.5
          ? {
              type: voucherType,
              value: voucherType === "percent" ? Math.floor(rand() * 101) : Math.floor(rand() * 2000),
              minSpendCents: Math.floor(rand() * 3000),
              eligibleVariantIds: rand() > 0.5 ? lines.filter(() => rand() > 0.4).map((l) => l.variantId) : undefined,
            }
          : undefined;
      const result = priceCart({
        lines,
        voucher,
        shippingMethod: { priceCents: 499, freeOverCents: rand() > 0.5 ? 5000 : null },
        taxRateBps: Math.floor(rand() * 2500),
        instruments: { giftCardCents: Math.floor(rand() * 5000), storeCreditCents: Math.floor(rand() * 5000) },
      });

      const itemDiscounts = lines.map((l) => {
        const deal = l.dealPriceCents !== undefined ? Math.max(0, l.unitPriceCents - l.dealPriceCents) * l.quantity : 0;
        return Math.min(Math.max(deal, l.clippedCouponDiscountCents ?? 0), l.unitPriceCents * l.quantity);
      });
      const promoTotal = result.lines.reduce((s, l, idx) => s + (l.discountCents - itemDiscounts[idx]!), 0);
      expect(promoTotal).toBe(result.discountCents);
      const bd = result.breakdown as { subtotalAfterPromoCents: number; taxRateBps: number };
      const goodsTax = Math.round((bd.subtotalAfterPromoCents * bd.taxRateBps) / 10000);
      expect(result.lines.reduce((s, l) => s + l.taxCents, 0)).toBe(goodsTax);
      expect(result.lines.reduce((s, l) => s + l.taxCents, 0)).toBeLessThanOrEqual(result.taxCents);
      expect(result.payableCents).toBeGreaterThanOrEqual(0);
      expect(result.payableCents).toBeLessThanOrEqual(result.totalCents);
      for (const value of [
        result.subtotalCents,
        result.discountCents,
        result.shippingCents,
        result.taxCents,
        result.totalCents,
        result.instrumentsCents,
        result.payableCents,
        ...result.lines.flatMap((l) => [l.baseCents, l.discountCents, l.taxCents, l.totalCents]),
      ]) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
