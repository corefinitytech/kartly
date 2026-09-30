import { describe, expect, it } from "vitest";
import { NOTIFICATION_EVENTS, cleanPayload, parsePayload, renderNotification } from "./events";

describe("notification templates", () => {
  it("renders every event with an order link", () => {
    for (const key of NOTIFICATION_EVENTS) {
      const n = renderNotification(key, { orderNumber: "KT-20260930-ABCDE" });
      expect(n.title).toContain("KT-20260930-ABCDE");
      expect(n.href).toBe("/orders/KT-20260930-ABCDE");
      expect(n.body.length).toBeGreaterThan(0);
    }
  });
  it("explains an expired payment differently from a store cancel", () => {
    expect(renderNotification("order.cancelled", { orderNumber: "KT-1-ABCDE", reason: "payment_expired" }).body).toMatch(/nothing was charged/);
    expect(renderNotification("order.cancelled", { orderNumber: "KT-1-ABCDE" }).body).toMatch(/refunded/);
  });
  it("shows refund amounts in dollars", () => {
    expect(renderNotification("refund.issued", { orderNumber: "KT-1-ABCDE", amountCents: 1250 }).body).toMatch(/^\$12\.50 /);
  });
  it("falls back safely for unknown keys", () => {
    expect(renderNotification("something.else", {})).toEqual({ title: "Update", body: "Something changed on your account.", href: null });
  });
});

describe("payload hygiene", () => {
  it("keeps only known, non-personal fields", () => {
    const dirty = { orderNumber: "KT-20260930-ABCDE", email: "a@b.c", name: "Sam", amountCents: 5 } as never;
    expect(cleanPayload(dirty)).toEqual({ orderNumber: "KT-20260930-ABCDE", amountCents: 5 });
  });
  it("drops malformed values", () => {
    expect(cleanPayload({ orderNumber: "<script>", amountCents: -1, reason: "hack" as never })).toEqual({});
    expect(parsePayload("not json")).toEqual({});
  });
});
