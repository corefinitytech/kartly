import { describe, expect, it } from "vitest";
import { stockState } from "./stock";

describe("stockState", () => {
  it("is out of stock at zero", () => {
    expect(stockState(0, 5)).toEqual({ kind: "out", label: "Out of stock" });
  });

  it("is low stock at or below the threshold with exact count", () => {
    expect(stockState(5, 5)).toEqual({ kind: "low", label: "Only 5 left" });
    expect(stockState(1, 5)).toEqual({ kind: "low", label: "Only 1 left" });
  });

  it("is in stock above the threshold without exposing the count", () => {
    expect(stockState(6, 5)).toEqual({ kind: "in", label: "In stock" });
    expect(stockState(500, 5).label).not.toContain("500");
  });
});
