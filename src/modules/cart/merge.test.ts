import { describe, expect, it } from "vitest";
import { planGuestCartMerge } from "./merge";

describe("planGuestCartMerge", () => {
  it("sums quantities and keeps the user price on overlap", () => {
    const plan = planGuestCartMerge([
      {
        variantId: "v1",
        guestQty: 2,
        userQty: 3,
        guestAddedPriceCents: 1000,
        userAddedPriceCents: 1200,
        stockQty: 50,
      },
    ]);
    expect(plan.lines[0]).toMatchObject({ quantity: 5, addedPriceCents: 1200 });
    expect(plan.mergedAnything).toBe(true);
    expect(plan.clampedAnything).toBe(false);
  });

  it("clamps to stock and the line max and keeps the guest price for new lines", () => {
    const plan = planGuestCartMerge([
      { variantId: "v1", guestQty: 8, userQty: 5, guestAddedPriceCents: 900, userAddedPriceCents: 900, stockQty: 12 },
      { variantId: "v2", guestQty: 4, userQty: null, guestAddedPriceCents: 500, userAddedPriceCents: null, stockQty: 3 },
    ]);
    expect(plan.lines[0]).toMatchObject({ variantId: "v1", quantity: 10, clamped: true });
    expect(plan.lines[1]).toMatchObject({ variantId: "v2", quantity: 3, clamped: true, addedPriceCents: 500 });
    expect(plan.clampedAnything).toBe(true);
  });

  it("handles empty carts", () => {
    expect(planGuestCartMerge([])).toEqual({ lines: [], mergedAnything: false, clampedAnything: false });
  });
});
