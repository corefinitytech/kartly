import { describe, expect, it } from "vitest";
import { RESET_TOKEN_TTL_MS, VERIFY_TOKEN_TTL_MS, isTokenExpired, tokenExpiresAt } from "./tokens";

describe("token expiry", () => {
  it("computes expiry from issue time", () => {
    const issued = 1_000_000;
    expect(tokenExpiresAt(issued, RESET_TOKEN_TTL_MS)).toBe(issued + 3_600_000);
    expect(tokenExpiresAt(issued, VERIFY_TOKEN_TTL_MS)).toBe(issued + 86_400_000);
  });

  it("expires at and after the boundary", () => {
    const expires = tokenExpiresAt(0, 1000);
    expect(isTokenExpired(expires, 999)).toBe(false);
    expect(isTokenExpired(expires, 1000)).toBe(true);
  });
});
