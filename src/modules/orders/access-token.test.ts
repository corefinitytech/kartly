import { describe, expect, it } from "vitest";
import { accessTokenMatches, canAccessOrder, generateAccessToken, hashAccessToken } from "./access-token";

describe("access tokens", () => {
  it("hashes tokens deterministically without leaking them", () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hashAccessToken(token)).toBe(hash);
  });

  it("matches in constant time and rejects wrong tokens", () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);
    expect(accessTokenMatches(token, hash)).toBe(true);
    expect(accessTokenMatches(generateAccessToken(), hash)).toBe(false);
    expect(accessTokenMatches(token, null)).toBe(false);
  });
});

describe("canAccessOrder (IDOR, AC-6)", () => {
  const token = generateAccessToken();
  const userOrder = { user_id: "user-a", access_token_hash: null };
  const guestOrder = { user_id: null, access_token_hash: hashAccessToken(token) };

  it("lets a user see only their own orders", () => {
    expect(canAccessOrder(userOrder, { userId: "user-a" }, "a@example.com")).toBe(true);
    expect(canAccessOrder(userOrder, { userId: "user-b" }, "a@example.com")).toBe(false);
  });

  it("never lets a signed-in user open a guest order by id", () => {
    expect(canAccessOrder(guestOrder, { userId: "user-a" }, "g@example.com")).toBe(false);
  });

  it("checks the guest token against its hash", () => {
    expect(canAccessOrder(guestOrder, { accessToken: token }, "g@example.com")).toBe(true);
    expect(canAccessOrder(guestOrder, { accessToken: generateAccessToken() }, "g@example.com")).toBe(false);
    expect(canAccessOrder(userOrder, { accessToken: token }, "a@example.com")).toBe(false);
  });

  it("matches lookup email case-insensitively and rejects empty or wrong emails", () => {
    expect(canAccessOrder(guestOrder, { email: " G@Example.com " }, "g@example.com")).toBe(true);
    expect(canAccessOrder(guestOrder, { email: "other@example.com" }, "g@example.com")).toBe(false);
    expect(canAccessOrder(guestOrder, { email: "" }, "")).toBe(false);
  });
});
