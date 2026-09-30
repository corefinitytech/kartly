import { describe, expect, it } from "vitest";
import { buildOrderSnapshot } from "./order-snapshot";

describe("buildOrderSnapshot", () => {
  const lines = [
    {
      variantId: "v1",
      title: "Product A",
      sku: "SKU-1",
      quantity: 2,
      unitPriceCents: 333,
      priced: { baseCents: 666, discountCents: 100, taxCents: 39, totalCents: 605 },
    },
    {
      variantId: "v2",
      title: "Product B",
      sku: "SKU-2",
      quantity: 1,
      unitPriceCents: 1000,
      priced: { baseCents: 1000, discountCents: 0, taxCents: 70, totalCents: 1070 },
    },
  ];

  it("keeps per line rounding and snapshots titles and skus", () => {
    const snapshot = buildOrderSnapshot(lines, {
      subtotalCents: 1566,
      discountCents: 100,
      shippingCents: 499,
      taxCents: 109,
      totalCents: 2074,
      payableCents: 2074,
      breakdown: { subtotalCents: 1566 },
    }, "standard");
    expect(snapshot.lines[0]).toMatchObject({ title: "Product A", sku: "SKU-1", quantity: 2, unitPriceCents: 333 });
    expect(snapshot.lines.reduce((s, l) => s + l.taxCents, 0)).toBe(109);
    expect(snapshot.totalCents).toBe(2074);
    expect(snapshot.pricingJson).toMatchObject({ shippingMethodCode: "standard" });
  });
});
