import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingView } from "@/components/listing/listing-view";
import { getCategoryBySlug, getListing } from "@/modules/catalog/service";
import { parseListingParams } from "@/modules/catalog/schemas";

export const revalidate = 120;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return { title: category ? category.name : "Category" };
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
      <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
        <h1 className="text-2xl font-bold lg:text-3xl">{category.name}</h1>
        {category.children.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {category.children.map((child) => (
              <li key={child.slug}>
                <a href={`/c/${child.slug}`} className="text-sm text-brandLink underline-offset-4 hover:underline">
                  {child.name}
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
