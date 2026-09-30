import { describe, expect, it } from "vitest";
import { accessTokenMatches, generateAccessToken, hashAccessToken } from "./access-token";

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
