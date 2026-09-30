import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { PAGE_SIZE } from "./schemas";
import type { ListingParams } from "./schemas";
import * as repo from "./repo";
import { stockState } from "./stock";
import { orderCategories } from "./category-names";
import type {
  CategoryWithChildren,
  ListingResult,
  ProductDetail,
  ProductListItem,
} from "./types";

export interface CategoryWithCount {
  slug: string;
  productCount: number;
}

export interface CachedCategory extends CategoryWithCount {
  name: string;
}

function cached<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  key: string,
  tags: string[],
) {
  return unstable_cache(fn, [key], { revalidate: 300, tags });
}

const getTopLevelCategoriesCached = cached(async () => {
  const rows = await db.execute<{ slug: string; product_count: number }>(sql`
    select c.slug,
      (select count(*) from products p where p.category_id = c.id) as product_count
    from categories c
    where c.parent_id is null
  `);
  const categories: CategoryWithCount[] = rows.map((r) => ({
    slug: r.slug,
    productCount: Number(r.product_count),
  }));
  return orderCategories(categories).map((c) => ({
    ...c,
    name: c.slug,
  }));
}, "top-level-categories", ["catalog"]);

export async function getTopLevelCategories(): Promise<CachedCategory[]> {
  return getTopLevelCategoriesCached();
}

export async function getCategoryBySlug(slug: string): Promise<CategoryWithChildren | null> {
  return getCategoryBySlugCached(slug);
}

const getCategoryBySlugCached = cached(async (slug: string): Promise<CategoryWithChildren | null> => {
  const rows = await db.execute<{ id: string; slug: string; name: string }>(sql`
    select id, slug, name from categories where slug = ${slug} limit 1
  `);
  const category = rows[0];
  if (!category) return null;
  const children = await db.execute<{ slug: string }>(sql`
    select slug from categories where parent_id = ${category.id} order by slug asc
  `);
  return {
    slug: category.slug,
    name: category.slug,
    children: children.map((c) => ({ slug: c.slug, name: c.slug })),
  };
}, "category-by-slug", ["catalog"]);

export async function getListing(params: ListingParams, categorySlug?: string): Promise<ListingResult> {
  return getListingCached(params, categorySlug ?? null);
}

const getListingCached = cached(async (params: ListingParams, categorySlug: string | null): Promise<ListingResult> => {
  const { ids } = categorySlug ? await repo.findCategoryIds(categorySlug) : { ids: [] as string[] };
  const [{ rows, total }, facets] = await Promise.all([
    repo.searchListing(params, ids),
    repo.listingFacets(params, ids),
  ]);

  const items: ProductListItem[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    brand: r.brand,
    imageUrl: r.image_url,
    imageAlt: r.image_alt,
    priceCents: r.price_cents,
    compareAtCents: r.compare_at_cents,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    stockQty: r.stock_qty,
    lowStockThreshold: r.low_stock_threshold,
  }));

  return {
    items,
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    facets,
  };
}, "listing", ["catalog"]);

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  return getProductDetailCached(slug);
}

const getProductDetailCached = cached(async (slug: string): Promise<ProductDetail | null> => {
  const { product, images, variants, categoryPath } = await repo.productDetail(slug);
  if (!product) return null;

  const variantDtos = variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    options: JSON.parse(v.options_json) as Record<string, string | boolean>,
    priceCents: v.price_cents,
    compareAtCents: v.compare_at_cents,
    stockQty: v.stock_qty,
    stockState: stockState(v.stock_qty, v.low_stock_threshold),
  }));

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    description: product.description,
    categoryPath,
    images,
    variants: variantDtos,
    defaultVariant: variantDtos[0] ?? null,
    ratingAvg: Number(product.rating_avg),
    ratingCount: product.rating_count,
    specs: [
      ...(product.brand ? [{ label: "Brand", value: product.brand }] : []),
      { label: "SKU", value: variants[0]?.sku ?? "" },
    ],
  };
}, "product-detail", ["catalog"]);

interface HomeProductRow {
  [key: string]: unknown;
  slug: string;
  title: string;
  image_url: string | null;
  price_cents: number;
  rating_avg: number;
  rating_count: number;
}

export interface HomeProduct {
  slug: string;
  title: string;
  imageUrl: string | null;
  priceCents: number;
  ratingAvg: number;
  ratingCount: number;
}

export async function getHomeData(): Promise<{
  categories: (CategoryWithCount & { imageUrl: string | null })[];
  topRated: HomeProduct[];
  newArrivals: HomeProduct[];
}> {
  return getHomeDataCached();
}

const getHomeDataCached = cached(async (): Promise<{
  categories: (CategoryWithCount & { imageUrl: string | null })[];
  topRated: HomeProduct[];
  newArrivals: HomeProduct[];
}> => {
  const categories = await db.execute<{ slug: string; product_count: number; image_url: string | null }>(sql`
    with counts as (
      select c.slug, c.id,
        (select count(*) from products p where p.category_id = c.id) as product_count
      from categories c where c.parent_id is null
    )
    select counts.slug, counts.product_count,
      (select pi.url from products p join product_images pi on pi.product_id = p.id and pi.position = 0
       where p.category_id = counts.id and p.status = 'active'
       order by p.rating_avg desc, p.rating_count desc limit 1) as image_url
    from counts
    order by product_count desc, slug asc
    limit 8
  `);

  const toProduct = (r: HomeProductRow): HomeProduct => ({
    slug: r.slug,
    title: r.title,
    imageUrl: r.image_url,
    priceCents: r.price_cents,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
  });

  const topRated = await db.execute<HomeProductRow>(sql`
    select p.slug, p.title, pi.url as image_url,
      (select min(price_cents) from product_variants v where v.product_id = p.id) as price_cents,
      p.rating_avg, p.rating_count
    from products p
    left join product_images pi on pi.product_id = p.id and pi.position = 0
    where p.status = 'active' and p.rating_count > 0
    order by p.rating_avg desc, p.rating_count desc
    limit 6
  `);

  const newArrivals = await db.execute<HomeProductRow>(sql`
    select p.slug, p.title, pi.url as image_url,
      (select min(price_cents) from product_variants v where v.product_id = p.id) as price_cents,
      p.rating_avg, p.rating_count
    from products p
    left join product_images pi on pi.product_id = p.id and pi.position = 0
    where p.status = 'active'
    order by p.created_at desc
    limit 6
  `);

  return {
    categories: orderCategories(
      categories.map((c) => ({ slug: c.slug, productCount: Number(c.product_count) })),
    ).map((c) => ({
      ...c,
      imageUrl: categories.find((row) => row.slug === c.slug)?.image_url ?? null,
    })),
    topRated: topRated.map(toProduct),
    newArrivals: newArrivals.map(toProduct),
  };
}, "home-data", ["catalog"]);
