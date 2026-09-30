import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { PAGE_SIZE, type ListingParams, type SortOption } from "./schemas";

export interface ProductRow {
  [key: string]: unknown;
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  image_url: string | null;
  image_alt: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  rating_avg: number;
  rating_count: number;
  stock_qty: number;
  low_stock_threshold: number;
}

export interface ListingRow extends ProductRow {
  rank: number | null;
}

interface FacetRow {
  [key: string]: unknown;
  brand: string | null;
  count: number;
}

interface BoundsRow {
  [key: string]: unknown;
  min_price: number | null;
  max_price: number | null;
}

const bestVariant = sql`(
  select json_build_object(
    'price_cents', min(v.price_cents),
    'compare_at_cents', min(v.compare_at_cents::int),
    'stock_qty', coalesce(sum(v.stock_qty), 0),
    'low_stock_threshold', max(v.low_stock_threshold)
  ) as v
  from product_variants v where v.product_id = p.id
)`;

function variantValue(field: "price_cents" | "compare_at_cents" | "stock_qty" | "low_stock_threshold"): SQL {
  return sql`(v->>'${sql.raw(field)}')::int`;
}

function filterConditions(params: ListingParams, categoryIds: string[]): SQL[] {
  const conditions: SQL[] = [sql`p.status = 'active'`];
  if (categoryIds.length > 0) {
    conditions.push(sql`p.category_id in (${sql.join(categoryIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  if (params.brand) conditions.push(sql`p.brand = ${params.brand}`);
  if (params.minRating) conditions.push(sql`p.rating_avg >= ${params.minRating}`);
  if (params.inStock) conditions.push(sql`${variantValue("stock_qty")} > 0`);
  if (params.minPrice !== undefined) conditions.push(sql`${variantValue("price_cents")} >= ${params.minPrice}`);
  if (params.maxPrice !== undefined) conditions.push(sql`${variantValue("price_cents")} <= ${params.maxPrice}`);
  return conditions;
}

function orderClause(sort: SortOption, hasQuery: boolean, context: "inner" | "ranked"): SQL {
  const price = context === "inner" ? variantValue("price_cents") : sql`price_cents`;
  switch (sort) {
    case "price_asc":
      return sql`order by ${price} asc`;
    case "price_desc":
      return sql`order by ${price} desc`;
    case "rating":
      return sql`order by p.rating_avg desc nulls last, p.rating_count desc`;
    case "newest":
      return sql`order by p.created_at desc`;
    default:
      return hasQuery ? sql`order by rank desc` : sql`order by p.rating_avg desc, p.rating_count desc`;
  }
}

export async function findCategoryIds(slug: string): Promise<{ ids: string[]; category: { id: string; slug: string; name: string; parentId: string | null } | null }> {
  const rows = await db.execute<{ id: string; slug: string; name: string; parent_id: string | null }>(sql`
    with cat as (
      select id, slug, name, parent_id from categories where slug = ${slug}
    )
    select id, slug, name, parent_id from cat
    union all
    select c.id, c.slug, c.name, c.parent_id from categories c
    join cat on c.parent_id = cat.id
  `);
  const category = rows.find((r) => r.slug === slug) ?? null;
  return {
    ids: rows.map((r) => r.id),
    category: category ? { id: category.id, slug: category.slug, name: category.name, parentId: category.parent_id } : null,
  };
}

export async function searchListing(params: ListingParams, categoryIds: string[]): Promise<{ rows: ListingRow[]; total: number }> {
  const conditions = filterConditions(params, categoryIds);
  const where = sql.join(conditions, sql` and `);
  const hasQuery = Boolean(params.q);
  const query = hasQuery ? sql`websearch_to_tsquery('english', ${params.q})` : sql`null`;

  const fullText = sql`
    select p.id, ${bestVariant} as v,
           ts_rank_cd(p.search_vector, ${query}) as rank
    from products p
    where ${where} and p.search_vector @@ ${query}
    ${orderClause(params.sort, true, "inner")}
  `;

  const trigramFallback = sql`
    select p.id, ${bestVariant} as v, null::float4 as rank
    from products p
    where ${where} and similarity(p.title, ${params.q ?? ""}) > 0.3
    order by similarity(p.title, ${params.q ?? ""}) desc
  `;

  const source = hasQuery
    ? sql`
      select * from (${fullText}) ftx
      union all
      select * from (${trigramFallback}) tg
      where not exists (select 1 from (${fullText}) limit 1)
    `
    : sql`select p.id, ${bestVariant} as v, null::float4 as rank from products p where ${where}
          ${orderClause(params.sort, false, "inner")}`;

  const result = await db.execute<ListingRow & { total: number }>(sql`
    with candidates as (${source}),
    img as (
      select pi.product_id, pi.url as image_url, pi.alt as image_alt
      from product_images pi
      where pi.position = 0
    ),
    ranked as (
      select c.rank, p.id, p.slug, p.title, p.brand, i.image_url, i.image_alt,
             (c.v->>'price_cents')::int as price_cents,
             (c.v->>'compare_at_cents')::int as compare_at_cents,
             p.rating_avg, p.rating_count,
             (c.v->>'stock_qty')::int as stock_qty,
             (c.v->>'low_stock_threshold')::int as low_stock_threshold,
             count(*) over () as total
      from candidates c
      join products p on p.id = c.id
      left join img i on i.product_id = p.id
      ${orderClause(params.sort, hasQuery, "ranked")}
      limit ${PAGE_SIZE} offset ${(params.page - 1) * PAGE_SIZE}
    )
    select * from ranked
  `);

  const total = Number(result[0]?.total ?? 0);
  return { rows: result, total };
}

export interface FacetBrandRow {
  brand: string;
  count: number;
}

export async function listingFacets(params: ListingParams, categoryIds: string[]): Promise<{ brands: FacetBrandRow[]; priceBounds: { min: number; max: number } }> {
  const conditions = filterConditions({ ...params, brand: undefined }, categoryIds);
  const where = sql.join(conditions, sql` and `);

  const brands = await db.execute<FacetRow>(sql`
    select p.brand, count(*)::int as count
    from products p
    where ${where} and p.brand is not null
    group by p.brand
    order by count desc, p.brand asc
  `);

  const bounds = await db.execute<BoundsRow>(sql`
    select min((select min(v.price_cents) from product_variants v where v.product_id = p.id)) as min_price,
           max((select min(v.price_cents) from product_variants v where v.product_id = p.id)) as max_price
    from products p
    where ${where}
  `);

  const min = Number(bounds[0]?.min_price ?? 0);
  const max = Number(bounds[0]?.max_price ?? 0);
  return {
    brands: brands.map((b) => ({ brand: b.brand!, count: Number(b.count) })),
    priceBounds: { min, max },
  };
}

export async function productDetail(slug: string): Promise<{
  product: {
    id: string; slug: string; title: string; brand: string | null; description: string | null;
    category_id: string | null; rating_avg: number; rating_count: number;
  } | null;
  images: { url: string; alt: string | null; position: number }[];
  variants: {
    id: string; sku: string; options_json: string; price_cents: number;
    compare_at_cents: number | null; stock_qty: number; low_stock_threshold: number;
  }[];
  categoryPath: { slug: string; name: string }[];
}> {
  const products = await db.execute<{
    id: string; slug: string; title: string; brand: string | null; description: string | null;
    category_id: string | null; rating_avg: number; rating_count: number;
  }>(sql`select id, slug, title, brand, description, category_id, rating_avg, rating_count
         from products where slug = ${slug} and status = 'active' limit 1`);
  const product = products[0] ?? null;
  if (!product) return { product: null, images: [], variants: [], categoryPath: [] };

  const [images, variants, categoryPath] = await Promise.all([
    db.execute<{ url: string; alt: string | null; position: number }>(sql`
      select url, alt, position from product_images
      where product_id = ${product.id} order by position asc
    `),
    db.execute<{
      id: string; sku: string; options_json: string; price_cents: number;
      compare_at_cents: number | null; stock_qty: number; low_stock_threshold: number;
    }>(sql`
      select id, sku, options_json, price_cents, compare_at_cents, stock_qty, low_stock_threshold
      from product_variants where product_id = ${product.id} order by price_cents asc
    `),
    db.execute<{ slug: string; name: string }>(sql`
      with recursive up as (
        select id, slug, name, parent_id, 0 as depth from categories where id = ${product.category_id}
        union all
        select c.id, c.slug, c.name, c.parent_id, up.depth + 1
        from categories c join up on c.id = up.parent_id
      )
      select slug, name from up order by depth desc
    `),
  ]);

  return { product, images, variants, categoryPath };
}
