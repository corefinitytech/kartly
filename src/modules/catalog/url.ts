import type { ListingParams } from "@/modules/catalog/schemas";

export interface ActiveFilter {
  key: string;
  label: string;
}

export function listingSearchParams(params: ListingParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.minPrice !== undefined) search.set("minPrice", String(params.minPrice));
  if (params.maxPrice !== undefined) search.set("maxPrice", String(params.maxPrice));
  if (params.minRating) search.set("minRating", String(params.minRating));
  if (params.brand) search.set("brand", params.brand);
  if (params.inStock) search.set("inStock", "true");
  if (params.sort !== "relevance") search.set("sort", params.sort);
  if (params.page > 1) search.set("page", String(params.page));
  return search;
}

export function buildListingUrl(
  basePath: string,
  params: ListingParams,
  overrides: Partial<ListingParams> = {},
): string {
  const merged = { ...params, ...overrides };
  const search = listingSearchParams(merged);
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function activeFilters(params: ListingParams, formatCents: (cents: number) => string): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  if (params.brand) filters.push({ key: "brand", label: params.brand });
  if (params.minPrice !== undefined) filters.push({ key: "minPrice", label: `From ${formatCents(params.minPrice)}` });
  if (params.maxPrice !== undefined) filters.push({ key: "maxPrice", label: `Up to ${formatCents(params.maxPrice)}` });
  if (params.minRating) filters.push({ key: "minRating", label: `${params.minRating}★ and up` });
  if (params.inStock) filters.push({ key: "inStock", label: "In stock" });
  return filters;
}

export function withoutFilter(
  params: ListingParams,
  key: string,
): ListingParams {
  const next = { ...params, page: 1 };
  switch (key) {
    case "brand":
      delete next.brand;
      break;
    case "minPrice":
      delete next.minPrice;
      break;
    case "maxPrice":
      delete next.maxPrice;
      break;
    case "minRating":
      delete next.minRating;
      break;
    case "inStock":
      next.inStock = undefined;
      break;
  }
  return next;
}
