import { describe, expect, it } from "vitest";
import { formatCents, roundHalfUp, toCents } from "./money";

describe("roundHalfUp", () => {
  it("rounds half away from zero", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.4)).toBe(2);
  });

  it("supports decimals", () => {
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
  });
});

describe("toCents", () => {
  it("converts dollars to integer cents", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it("rejects non finite amounts", () => {
    expect(() => toCents(Number.NaN)).toThrow();
  });
});

describe("formatCents", () => {
  it("formats USD", () => {
    expect(formatCents(1999)).toBe("$19.99");
    expect(formatCents(5)).toBe("$0.05");
  });
});
