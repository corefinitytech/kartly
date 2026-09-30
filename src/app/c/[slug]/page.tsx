import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ListingView } from "@/components/listing/listing-view";
import { getCategoryBySlug, getListing } from "@/modules/catalog/service";
import { parseListingParams } from "@/modules/catalog/schemas";
import { categoryDisplayName } from "@/modules/catalog/category-names";
import { buildCanonical } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/json-ld";

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  const rows = await db.execute<{ slug: string }>(sql`
    select slug from categories where parent_id is null
  `);
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const [category, listing] = await Promise.all([
    getCategoryBySlug(slug),
    getListing({ sort: "relevance", page: 1 }, slug),
  ]);
  if (!category) return {};
  const displayName = categoryDisplayName(slug);
  const parsed = parseListingParams(raw);
  const page = parsed.success ? parsed.data.page : 1;
  const canonical =
    page > 1 ? buildCanonical(`/c/${slug}?page=${page}`) : buildCanonical(`/c/${slug}`);
  return {
    title: displayName,
    description: `Browse ${listing.total} ${displayName.toLowerCase()} products. Prices are shown in full, including shipping and tax, before you check out.`,
    alternates: { canonical },
    openGraph: { title: displayName, url: canonical, type: "website" },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const parsed = parseListingParams(rawSearchParams);
  if (!parsed.success) notFound();

  const result = await getListing(parsed.data, slug);

  return (
    <div>
      <BreadcrumbJsonLd path={[{ slug: "", name: "Home" }, { slug, name: slug }]} />
      <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-inkSoft">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" className="underline-offset-4 hover:underline">
                Home
              </Link>
            </li>
            <li aria-current="page" className="text-ink">
              / {categoryDisplayName(slug)}
            </li>
          </ol>
        </nav>
        <h1 className="mt-2 text-2xl font-bold lg:text-3xl">{categoryDisplayName(slug)}</h1>
        {category.children.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {category.children.map((child) => (
              <li key={child.slug}>
                <a href={`/c/${child.slug}`} className="text-sm text-brandLink underline-offset-4 hover:underline">
                  {categoryDisplayName(child.slug)}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <ListingView basePath={`/c/${slug}`} params={parsed.data} result={result} />
    </div>
  );
}
