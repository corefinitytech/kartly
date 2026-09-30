import { describe, expect, it } from "vitest";
import { clampQuantity, hashCartToken, resolveLineView } from "./identity";

describe("clampQuantity", () => {
  it("allows quantities within stock and the max", () => {
    expect(clampQuantity(2, 1, 10, 10)).toEqual({ quantity: 3 });
  });

  it("clamps to stock with a reason", () => {
    const result = clampQuantity(5, 0, 3, 10);
    expect(result.quantity).toBe(3);
    expect(result.reason).toBe("stock");
  });

  it("clamps to the line maximum", () => {
    const result = clampQuantity(5, 8, 50, 10);
    expect(result.quantity).toBe(10);
    expect(result.reason).toBe("max");
  });

  it("flags out of stock without changing the current quantity", () => {
    expect(clampQuantity(1, 4, 0, 10)).toEqual({ quantity: 4, reason: "out_of_stock" });
  });
});

describe("hashCartToken", () => {
  it("is deterministic and one way", () => {
    const hash = hashCartToken("token-a");
    expect(hash).toBe(hashCartToken("token-a"));
    expect(hash).not.toBe(hashCartToken("token-b"));
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("token-a");
  });
});

describe("resolveLineView", () => {
  const base = {
    variantId: "v1",
    qty: 2,
    addedPriceCents: 1000,
    title: "Product",
    slug: "product",
    imageUrl: null,
    optionsJson: '{"size":"M"}',
    unitPriceCents: 1200,
    stockQty: 5,
    lowStockThreshold: 5,
    productStatus: "active",
  };

  it("maps a line and detects price changes", () => {
    const view = resolveLineView(base, 10);
    expect(view.priceChanged).toEqual({ fromCents: 1000, toCents: 1200 });
    expect(view.options).toEqual({ size: "M" });
    expect(view.maxQuantity).toBe(5);
    expect(view.unavailable).toBe(false);
  });

  it("marks unavailable lines and hides their price change", () => {
    const view = resolveLineView({ ...base, stockQty: 0 }, 10);
    expect(view.unavailable).toBe(true);
    expect(view.priceChanged).toBeNull();
    expect(view.maxQuantity).toBe(0);
  });
});
