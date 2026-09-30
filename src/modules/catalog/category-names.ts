const FULL_NAME_OVERRIDES: Record<string, string> = {
  "home-decoration": "Home decor",
  "kitchen-accessories": "Kitchen",
  "sports-accessories": "Sports",
};

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function categoryDisplayName(slug: string): string {
  if (FULL_NAME_OVERRIDES[slug]) return FULL_NAME_OVERRIDES[slug]!;
  const words = slug
    .replace(/-/g, " ")
    .replace(/\bmens\b/g, "men's")
    .replace(/\bwomens\b/g, "women's");
  return words
    .split(" ")
    .map((word, index) => (index === 0 ? sentenceCase(word) : word))
    .join(" ");
}

export function orderCategories<T extends { slug: string; productCount: number }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    if (b.productCount !== a.productCount) return b.productCount - a.productCount;
    return categoryDisplayName(a.slug).localeCompare(categoryDisplayName(b.slug));
  });
}
