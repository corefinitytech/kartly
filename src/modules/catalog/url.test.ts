import { describe, expect, it } from "vitest";
import { parseListingParams } from "./schemas";
import { activeFilters, buildListingUrl, withoutFilter } from "./url";

describe("parseListingParams", () => {
  it("applies defaults", () => {
    const result = parseListingParams({}).data;
    expect(result?.sort).toBe("relevance");
    expect(result?.page).toBe(1);
  });

  it("coerces numbers and flags", () => {
    const result = parseListingParams({ minPrice: "1000", page: "2", inStock: "true" }).data;
    expect(result?.minPrice).toBe(1000);
    expect(result?.page).toBe(2);
    expect(result?.inStock).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(parseListingParams({ sort: "popular" }).success).toBe(false);
    expect(parseListingParams({ page: "0" }).success).toBe(false);
    expect(parseListingParams({ minRating: "9" }).success).toBe(false);
  });

  it("takes the first value of repeated params", () => {
    expect(parseListingParams({ q: ["phone", "laptop"] }).data?.q).toBe("phone");
  });
});

describe("buildListingUrl", () => {
  const base = { sort: "relevance" as const, page: 1 };

  it("omits defaults", () => {
    expect(buildListingUrl("/search", base)).toBe("/search");
  });

  it("keeps state and applies overrides", () => {
    const url = buildListingUrl("/c/phones", { ...base, brand: "Apple", page: 3 }, { page: 1 });
    expect(url).toBe("/c/phones?brand=Apple");
  });
});

describe("activeFilters and withoutFilter", () => {
  const params = {
    q: "phone",
    sort: "relevance" as const,
    page: 1,
    brand: "Apple",
    minPrice: 1000,
    inStock: true,
  };

  it("lists active filters", () => {
    const labels = activeFilters(params, (c) => `$${c / 100}`).map((f) => f.label);
    expect(labels).toContain("Apple");
    expect(labels).toContain("From $10");
    expect(labels).toContain("In stock");
  });

  it("removing a filter resets the page", () => {
    const next = withoutFilter({ ...params, page: 4 }, "brand");
    expect(next.brand).toBeUndefined();
    expect(next.page).toBe(1);
  });
});
