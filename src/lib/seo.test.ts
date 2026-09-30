import { describe, expect, it } from "vitest";

process.env.APP_URL ??= "https://kartly.example.com";
process.env.DATABASE_URL ??= "postgresql://t:t@localhost:5432/t";
process.env.PII_ENC_KEY ??= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
process.env.IP_HASH_SALT ??= "test-salt-1234567890";
process.env.CRON_SECRET ??= "test-secret-123456789";
process.env.BETTER_AUTH_SECRET ??= "test-secret-1234567890abcdefghij";

const { buildCanonical, toSchemaAvailability, truncateAtWord } = await import("./seo");

describe("buildCanonical", () => {
  it("joins base and path without double slashes", () => {
    expect(buildCanonical("/c/phones")).toBe("https://kartly.example.com/c/phones");
    expect(buildCanonical("/")).toBe("https://kartly.example.com/");
  });
});

describe("truncateAtWord", () => {
  it("returns short text unchanged", () => {
    expect(truncateAtWord("short text", 20)).toBe("short text");
  });

  it("cuts at a word boundary", () => {
    const result = truncateAtWord("one two three four five", 11);
    expect(result).toBe("one two");
    expect(result.length).toBeLessThanOrEqual(11);
  });

  it("collapses whitespace first", () => {
    expect(truncateAtWord("a\n  b", 5)).toBe("a b");
  });
});

describe("toSchemaAvailability", () => {
  it("maps stock states to schema.org values", () => {
    expect(toSchemaAvailability("in")).toContain("InStock");
    expect(toSchemaAvailability("low")).toContain("LimitedAvailability");
    expect(toSchemaAvailability("out")).toContain("OutOfStock");
  });
});
