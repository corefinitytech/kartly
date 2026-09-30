import { describe, expect, it } from "vitest";
import { categoryDisplayName, orderCategories } from "./category-names";

describe("categoryDisplayName", () => {
  it("uses the named overrides", () => {
    expect(categoryDisplayName("home-decoration")).toBe("Home decor");
    expect(categoryDisplayName("kitchen-accessories")).toBe("Kitchen");
    expect(categoryDisplayName("sports-accessories")).toBe("Sports");
  });

  it("handles possessives", () => {
    expect(categoryDisplayName("mens")).toBe("Men's");
    expect(categoryDisplayName("womens")).toBe("Women's");
    expect(categoryDisplayName("mens-shirts")).toBe("Men's shirts");
  });

  it("sentence cases everything else", () => {
    expect(categoryDisplayName("smartphones")).toBe("Smartphones");
    expect(categoryDisplayName("home-decoration") === "Home decoration").toBe(false);
  });
});

describe("orderCategories", () => {
  it("sorts by product count descending, then display name", () => {
    const ordered = orderCategories([
      { slug: "beauty", productCount: 5 },
      { slug: "smartphones", productCount: 12 },
      { slug: "fragrances", productCount: 12 },
    ]);
    expect(ordered.map((c) => c.slug)).toEqual(["fragrances", "smartphones", "beauty"]);
  });
});
