import { describe, expect, it } from "vitest";
import { generateOrderNumber } from "./order-number";

describe("generateOrderNumber", () => {
  it("uses the KT-YYYYMMDD-XXXXX format", () => {
    const number = generateOrderNumber(new Date("2026-09-30T12:00:00Z"));
    expect(number).toMatch(/^KT-20260930-[A-HJ-NP-Z2-9]{5}$/);
  });

  it("avoids ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOrderNumber().split("-")[2]!).not.toMatch(/[O0I1]/);
    }
  });
});
