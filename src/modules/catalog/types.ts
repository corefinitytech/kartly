export type StockStateDto = "in" | "low" | "out";

export interface CategoryNode {
  slug: string;
  name: string;
}

export interface CategoryWithChildren extends CategoryNode {
  children: CategoryNode[];
}

export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  priceCents: number;
  compareAtCents: number | null;
  ratingAvg: number;
  ratingCount: number;
  stockQty: number;
  lowStockThreshold: number;
}

export interface ListingFacets {
  brands: { brand: string; count: number }[];
  priceBounds: { min: number; max: number };
}

export interface ListingResult {
  items: ProductListItem[];
  total: number;
  page: number;
  pageCount: number;
  facets: ListingFacets;
}

export interface ProductImage {
  url: string;
  alt: string | null;
  position: number;
}

export interface ProductVariantDto {
  id: string;
  sku: string;
  options: Record<string, string | boolean>;
  priceCents: number;
  compareAtCents: number | null;
  stockQty: number;
  stockState: { kind: StockStateDto; label: string };
}

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  description: string | null;
  categoryPath: { slug: string; name: string }[];
  images: ProductImage[];
  variants: ProductVariantDto[];
  defaultVariant: ProductVariantDto | null;
  ratingAvg: number;
  ratingCount: number;
  specs: { label: string; value: string }[];
}
