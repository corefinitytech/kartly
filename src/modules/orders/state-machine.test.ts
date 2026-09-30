import { describe, expect, it } from "vitest";
import { canTransition, assertTransition, isOrderStatus, nextFulfilmentStatus } from "./state-machine";

describe("order state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("paid", "processing")).toBe(true);
    expect(canTransition("processing", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("allows cancellation windows", () => {
    expect(canTransition("pending_payment", "cancelled")).toBe(true);
    expect(canTransition("paid", "cancelled")).toBe(true);
    expect(canTransition("processing", "cancelled")).toBe(true);
  });

  it("rejects illegal moves", () => {
    expect(canTransition("shipped", "pending_payment")).toBe(false);
    expect(canTransition("delivered", "shipped")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
    expect(canTransition("payment_failed", "paid")).toBe(false);
  });

  it("throws an AppError on illegal moves", () => {
    expect(() => assertTransition("shipped", "pending_payment")).toThrow(/cannot move/);
  });

  it("AC-12: an admin cannot move a shipped order back to pending payment", () => {
    expect(() => assertTransition("shipped", "pending_payment")).toThrow();
    expect(canTransition("shipped", "cancelled")).toBe(false);
  });

  it("allows refund states only after delivery", () => {
    expect(canTransition("delivered", "partially_refunded")).toBe(true);
    expect(canTransition("delivered", "refunded")).toBe(true);
    expect(canTransition("partially_refunded", "refunded")).toBe(true);
    expect(canTransition("refunded", "partially_refunded")).toBe(false);
    expect(canTransition("paid", "refunded")).toBe(false);
  });

  it("offers one next fulfilment step", () => {
    expect(nextFulfilmentStatus("paid")).toBe("processing");
    expect(nextFulfilmentStatus("processing")).toBe("shipped");
    expect(nextFulfilmentStatus("shipped")).toBe("delivered");
    expect(nextFulfilmentStatus("delivered")).toBeNull();
    expect(nextFulfilmentStatus("pending_payment")).toBeNull();
  });

  it("recognises known statuses", () => {
    expect(isOrderStatus("paid")).toBe(true);
    expect(isOrderStatus("teleported")).toBe(false);
  });
});
