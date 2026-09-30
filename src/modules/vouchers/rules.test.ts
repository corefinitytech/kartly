import { describe, expect, it } from "vitest";
import { priceCart } from "@/modules/checkout/pricing";
import {
  checkVoucher,
  describeVoucher,
  eligibleVariantIds,
  limitRejection,
  normalizeCode,
  outcomeRejection,
  parseAppliesTo,
  rejectionMessage,
  toPricingVoucher,
  type VoucherContext,
  type VoucherRule,
} from "./rules";
import { voucherCodeSchema, voucherFormSchema } from "./schemas";

const now = new Date("2026-09-30T12:00:00Z");

function rule(overrides: Partial<VoucherRule> = {}): VoucherRule {
  return {
    id: "v-1",
    code: "SAVE10",
    type: "percent",
    value: 10,
    minSpendCents: 0,
    appliesTo: { productIds: [], categoryIds: [] },
    firstOrderOnly: false,
    perUserLimit: null,
    globalLimit: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    ...overrides,
  };
}

function ctx(overrides: Partial<VoucherContext> = {}): VoucherContext {
  return {
    now,
    signedIn: true,
    userRedemptions: 0,
    userOrders: 0,
    lines: [
      { variantId: "va", productId: "pa", categoryIds: ["cat-shoes", "cat-fashion"] },
      { variantId: "vb", productId: "pb", categoryIds: ["cat-phones"] },
    ],
    ...overrides,
  };
}

describe("normalizeCode and schema", () => {
  it("upper cases and strips spaces", () => {
    expect(normalizeCode(" save 10 ")).toBe("SAVE10");
    expect(voucherCodeSchema.parse("welcome-5")).toBe("WELCOME-5");
  });
  it("rejects odd shapes", () => {
    expect(voucherCodeSchema.safeParse("a").success).toBe(false);
    expect(voucherCodeSchema.safeParse("drop table;").success).toBe(false);
  });
});

describe("checkVoucher", () => {
  it("accepts a plain active code for the whole cart", () => {
    expect(checkVoucher(rule(), ctx())).toEqual({ ok: true, eligibleVariantIds: undefined });
  });
  it("reports unknown, inactive, not started and expired codes", () => {
    expect(checkVoucher(null, ctx())).toEqual({ ok: false, reason: "not_found" });
    expect(checkVoucher(rule({ isActive: false }), ctx())).toEqual({ ok: false, reason: "inactive" });
    expect(checkVoucher(rule({ startsAt: new Date("2026-10-01T00:00:00Z") }), ctx())).toEqual({ ok: false, reason: "not_started" });
    expect(checkVoucher(rule({ endsAt: now }), ctx())).toEqual({ ok: false, reason: "expired" });
    expect(checkVoucher(rule({ endsAt: new Date(now.getTime() + 1000) }), ctx()).ok).toBe(true);
  });
  it("scopes by product or category (parent categories included)", () => {
    expect(checkVoucher(rule({ appliesTo: { productIds: ["pb"], categoryIds: [] } }), ctx())).toEqual({ ok: true, eligibleVariantIds: ["vb"] });
    expect(checkVoucher(rule({ appliesTo: { productIds: [], categoryIds: ["cat-fashion"] } }), ctx())).toEqual({ ok: true, eligibleVariantIds: ["va"] });
    expect(checkVoucher(rule({ appliesTo: { productIds: ["other"], categoryIds: [] } }), ctx())).toEqual({ ok: false, reason: "not_applicable" });
  });
  it("needs sign in for limited or first order codes", () => {
    expect(checkVoucher(rule({ perUserLimit: 1 }), ctx({ signedIn: false }))).toEqual({ ok: false, reason: "sign_in_required" });
    expect(checkVoucher(rule({ firstOrderOnly: true }), ctx({ signedIn: false }))).toEqual({ ok: false, reason: "sign_in_required" });
    expect(checkVoucher(rule(), ctx({ signedIn: false })).ok).toBe(true);
  });
  it("enforces first order only", () => {
    expect(checkVoucher(rule({ firstOrderOnly: true }), ctx({ userOrders: 1 }))).toEqual({ ok: false, reason: "first_order_only" });
    expect(checkVoucher(rule({ firstOrderOnly: true }), ctx({ userOrders: 0 })).ok).toBe(true);
  });
});

describe("usage limits (AC-5)", () => {
  it("allows exactly per_user_limit uses", () => {
    const v = rule({ perUserLimit: 2 });
    expect(limitRejection(v, { signedIn: true, userRedemptions: 0, userOrders: 0 })).toBeNull();
    expect(limitRejection(v, { signedIn: true, userRedemptions: 1, userOrders: 1 })).toBeNull();
    expect(limitRejection(v, { signedIn: true, userRedemptions: 2, userOrders: 2 })).toBe("already_used");
  });

  it("allows exactly global_limit uses", () => {
    expect(limitRejection(rule({ globalLimit: 3, usedCount: 2 }), { signedIn: false, userRedemptions: 0, userOrders: 0 })).toBeNull();
    expect(limitRejection(rule({ globalLimit: 3, usedCount: 3 }), { signedIn: false, userRedemptions: 0, userOrders: 0 })).toBe("limit_reached");
  });

  it("two concurrent orders with per user limit 1: once serialised by the row lock, only one redeems", () => {
    // Model of redeemInTx: each transaction claims the row (serialised by the
    // UPDATE lock), then reads the committed redemption count and inserts.
    const v = rule({ perUserLimit: 1, globalLimit: 10 });
    const store = { usedCount: 0, redemptions: [] as { userId: string; seq: number }[] };
    const redeem = (userId: string): "ok" | string => {
      if (v.globalLimit !== null && store.usedCount >= v.globalLimit) return "limit_reached";
      store.usedCount += 1; // claim
      const mine = store.redemptions.filter((r) => r.userId === userId).length;
      const rejected = limitRejection({ ...v, usedCount: 0 }, { signedIn: true, userRedemptions: mine, userOrders: 0 });
      if (rejected) {
        store.usedCount -= 1; // transaction rolls back
        return rejected;
      }
      const seq = mine + 1;
      if (store.redemptions.some((r) => r.userId === userId && r.seq === seq)) return "already_used"; // unique index
      store.redemptions.push({ userId, seq });
      return "ok";
    };
    const results = [redeem("u1"), redeem("u1")];
    expect(results).toEqual(["ok", "already_used"]);
    expect(store.usedCount).toBe(1);
    expect(redeem("u2")).toBe("ok");
  });
});

describe("pricing integration", () => {
  const base = {
    lines: [
      { variantId: "va", unitPriceCents: 2000, quantity: 1 },
      { variantId: "vb", unitPriceCents: 3000, quantity: 1 },
    ],
    shippingMethod: { priceCents: 499, freeOverCents: null },
    taxRateBps: 0,
  };
  it("applies a scoped percent code to eligible lines only", () => {
    const v = rule({ appliesTo: { productIds: ["pb"], categoryIds: [] } });
    const check = checkVoucher(v, ctx());
    if (!check.ok) throw new Error("expected ok");
    const priced = priceCart({ ...base, voucher: toPricingVoucher(v, check.eligibleVariantIds) });
    expect(priced.discountCents).toBe(300);
  });
  it("turns a missed min spend into a friendly message with the gap", () => {
    const v = rule({ minSpendCents: 6000 });
    const priced = priceCart({ ...base, voucher: toPricingVoucher(v, undefined) });
    const reason = outcomeRejection(priced.voucherOutcome);
    expect(reason).toBe("min_spend");
    expect(rejectionMessage(reason!, v, priced.subtotalCents)).toBe("Spend $60.00 or more to use this code. Add $10.00 more.");
  });
  it("free shipping ignores the value", () => {
    const v = rule({ type: "free_shipping", value: 999 });
    const priced = priceCart({ ...base, voucher: toPricingVoucher(v, undefined) });
    expect(priced.shippingCents).toBe(0);
    expect(priced.discountCents).toBe(0);
  });
});

describe("messages and labels", () => {
  it("has a specific message for every rejection", () => {
    expect(rejectionMessage("expired", rule({ endsAt: new Date("2026-09-01T00:00:00Z") }))).toBe("This code expired on Sep 1, 2026.");
    expect(rejectionMessage("already_used")).toBe("You have already used this code.");
    expect(rejectionMessage("not_applicable")).toMatch(/does not apply/);
  });
  it("describes codes", () => {
    expect(describeVoucher({ type: "percent", value: 15 })).toBe("15% off");
    expect(describeVoucher({ type: "fixed_amount", value: 500 })).toBe("$5.00 off");
    expect(describeVoucher({ type: "free_shipping", value: 0 })).toBe("Free shipping");
  });
  it("parses applies_to defensively", () => {
    expect(parseAppliesTo("not json")).toEqual({ productIds: [], categoryIds: [] });
    expect(parseAppliesTo('{"productIds":["a",1],"categoryIds":"x"}')).toEqual({ productIds: ["a"], categoryIds: [] });
    expect(eligibleVariantIds({ productIds: [], categoryIds: [] }, ctx().lines)).toBeUndefined();
  });
});

describe("admin voucher form", () => {
  const form = {
    code: "welcome10",
    type: "percent",
    value: "10",
    minSpend: "",
    perUserLimit: "1",
    globalLimit: "",
    firstOrderOnly: false,
    startsAt: "",
    endsAt: "",
    isActive: true,
    note: "",
    categoryIds: [],
    productSlugs: "",
  };
  it("parses a percent code", () => {
    const parsed = voucherFormSchema.parse(form);
    expect(parsed).toMatchObject({ code: "WELCOME10", value: 10, perUserLimit: 1, globalLimit: null, minSpendCents: 0 });
  });
  it("parses money to cents and dates as UTC", () => {
    const parsed = voucherFormSchema.parse({ ...form, type: "fixed_amount", value: "5.50", minSpend: "25", startsAt: "2026-10-01T09:00" });
    expect(parsed.value).toBe(550);
    expect(parsed.minSpendCents).toBe(2500);
    expect(parsed.startsAt?.toISOString()).toBe("2026-10-01T09:00:00.000Z");
  });
  it("rejects bad values", () => {
    expect(voucherFormSchema.safeParse({ ...form, value: "150" }).success).toBe(false);
    expect(voucherFormSchema.safeParse({ ...form, type: "fixed_amount", value: "0" }).success).toBe(false);
    expect(voucherFormSchema.safeParse({ ...form, startsAt: "2026-10-02T00:00", endsAt: "2026-10-01T00:00" }).success).toBe(false);
    expect(voucherFormSchema.safeParse({ ...form, perUserLimit: "0" }).success).toBe(false);
  });
  it("dedupes product slugs", () => {
    expect(voucherFormSchema.parse({ ...form, productSlugs: "a-1, A-1\nb-2" }).productSlugs).toEqual(["a-1", "b-2"]);
  });
});
