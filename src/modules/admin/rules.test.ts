import { describe, expect, it } from "vitest";
import {
  applyStockDelta,
  assertRefundAmount,
  centsToInput,
  parseMoneyToCents,
  refundableCents,
  slugify,
  statusAfterRefund,
} from "./rules";

describe("refundableCents", () => {
  it("subtracts pending and succeeded refunds", () => {
    expect(
      refundableCents(10_000, [
        { amountCents: 2_500, status: "succeeded" },
        { amountCents: 1_000, status: "pending" },
      ]),
    ).toBe(6_500);
  });

  it("ignores failed and canceled refunds", () => {
    expect(
      refundableCents(10_000, [
        { amountCents: 10_000, status: "failed" },
        { amountCents: 5_000, status: "canceled" },
      ]),
    ).toBe(10_000);
  });

  it("never goes below zero", () => {
    expect(refundableCents(1_000, [{ amountCents: 1_500, status: "succeeded" }])).toBe(0);
  });
});

describe("assertRefundAmount", () => {
  it("accepts up to the remaining amount", () => {
    expect(() => assertRefundAmount(500, 500)).not.toThrow();
  });

  it("rejects zero, fractions and over-refunds", () => {
    expect(() => assertRefundAmount(0, 500)).toThrow(/above zero/);
    expect(() => assertRefundAmount(1.5, 500)).toThrow(/above zero/);
    expect(() => assertRefundAmount(501, 500)).toThrow(/more than/);
  });
});

describe("statusAfterRefund", () => {
  it("moves delivered orders to partially refunded, then refunded", () => {
    expect(statusAfterRefund("delivered", 100)).toBe("partially_refunded");
    expect(statusAfterRefund("delivered", 0)).toBe("refunded");
    expect(statusAfterRefund("partially_refunded", 0)).toBe("refunded");
    expect(statusAfterRefund("partially_refunded", 50)).toBe("partially_refunded");
  });

  it("keeps the fulfilment status before delivery", () => {
    expect(statusAfterRefund("paid", 100)).toBe("paid");
    expect(statusAfterRefund("shipped", 0)).toBe("shipped");
    expect(statusAfterRefund("cancelled", 0)).toBe("cancelled");
  });
});

describe("applyStockDelta", () => {
  it("adds and removes stock", () => {
    expect(applyStockDelta(5, 10)).toBe(15);
    expect(applyStockDelta(5, -5)).toBe(0);
  });

  it("never lets stock go negative", () => {
    expect(() => applyStockDelta(3, -4)).toThrow(/below zero/);
  });

  it("rejects zero and fractional deltas", () => {
    expect(() => applyStockDelta(3, 0)).toThrow();
    expect(() => applyStockDelta(3, 1.5)).toThrow();
  });

  it("caps absurd stock levels", () => {
    expect(() => applyStockDelta(0, 2_000_000)).toThrow(/too high/);
  });
});

describe("parseMoneyToCents", () => {
  it("parses whole and decimal amounts exactly", () => {
    expect(parseMoneyToCents("12")).toBe(1_200);
    expect(parseMoneyToCents("12.5")).toBe(1_250);
    expect(parseMoneyToCents("0.29")).toBe(29);
    expect(parseMoneyToCents("$1,299.99")).toBe(129_999);
    expect(parseMoneyToCents(" 19.99 ")).toBe(1_999);
  });

  it("rejects anything else", () => {
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("-5")).toBeNull();
    expect(parseMoneyToCents("1.999")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("1e3")).toBeNull();
  });

  it("round trips with centsToInput", () => {
    for (const cents of [0, 5, 99, 100, 129_999]) {
      expect(parseMoneyToCents(centsToInput(cents))).toBe(cents);
    }
    expect(centsToInput(null)).toBe("");
  });
});

describe("slugify", () => {
  it("makes url-safe slugs", () => {
    expect(slugify("Essence Mascara Lash Princess")).toBe("essence-mascara-lash-princess");
    expect(slugify("  Café & Crème — 2 Pack! ")).toBe("cafe-creme-2-pack");
  });

  it("caps the length without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});
