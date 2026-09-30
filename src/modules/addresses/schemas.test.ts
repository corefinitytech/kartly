import { describe, expect, it } from "vitest";
import { addressSchema, COUNTRY_CODES, countryName } from "./schemas";

describe("addressSchema", () => {
  const base = {
    fullName: "Jane Doe",
    line1: "1 Main St",
    line2: "",
    city: "London",
    region: "",
    postalCode: "E1 1AA",
    country: "GB" as const,
    phone: "",
  };

  it("accepts a minimal valid address", () => {
    expect(addressSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an unknown country and bad phone", () => {
    expect(addressSchema.safeParse({ ...base, country: "ZZ" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, phone: "abc" }).success).toBe(false);
  });

  it("requires the core fields", () => {
    expect(addressSchema.safeParse({ ...base, city: "" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, postalCode: "" }).success).toBe(false);
  });
});

describe("countryName", () => {
  it("resolves names for the shipped codes", () => {
    expect(countryName("US")).toBe("United States");
    expect(COUNTRY_CODES).toContain("PK");
  });
});
