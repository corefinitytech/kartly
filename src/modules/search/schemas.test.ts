import { describe, expect, it } from "vitest";
import { suggestQuerySchema } from "./schemas";

describe("suggestQuerySchema", () => {
  it("accepts a two character query", () => {
    expect(suggestQuerySchema.parse({ q: "ip" }).q).toBe("ip");
  });

  it("trims and rejects short or long queries", () => {
    expect(suggestQuerySchema.safeParse({ q: " i " }).success).toBe(false);
    expect(suggestQuerySchema.safeParse({ q: "x".repeat(121) }).success).toBe(false);
  });
});
