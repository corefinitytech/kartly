import { describe, expect, it } from "vitest";
import { verifyPaymentIntent } from "./verify";

const order = { id: "o1", number: "KT-20260930-ABCDE", payableCents: 2074, currency: "USD" };

describe("verifyPaymentIntent", () => {
  it("accepts a matching intent", () => {
    expect(verifyPaymentIntent({ id: "pi_1", amount: 2074, currency: "usd", metadata: { order_id: "o1" } }, order)).toEqual({ ok: true });
  });

  it("rejects amount and currency mismatches", () => {
    expect(verifyPaymentIntent({ id: "pi_1", amount: 100, currency: "usd", metadata: { order_id: "o1" } }, order)).toEqual({ ok: false, reason: "amount_mismatch" });
    expect(verifyPaymentIntent({ id: "pi_1", amount: 2074, currency: "eur", metadata: { order_id: "o1" } }, order)).toEqual({ ok: false, reason: "currency_mismatch" });
  });

  it("rejects intents for another order", () => {
    expect(verifyPaymentIntent({ id: "pi_1", amount: 2074, currency: "usd", metadata: { order_id: "other" } }, order)).toEqual({ ok: false, reason: "metadata_mismatch" });
    expect(verifyPaymentIntent({ id: "pi_1", amount: 2074, currency: "usd" }, order).ok).toBe(false);
  });
});
