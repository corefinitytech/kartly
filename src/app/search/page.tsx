import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingView } from "@/components/listing/listing-view";
import { getListing } from "@/modules/catalog/service";
import { parseListingParams } from "@/modules/catalog/schemas";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const raw = await searchParams;
  const q = Array.isArray(raw.q) ? raw.q[0] : raw.q;
  return { title: q ? `Search: ${q}` : "Search" };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const rawSearchParams = await searchParams;
  const parsed = parseListingParams(rawSearchParams);
  if (!parsed.success) notFound();

  const params = parsed.data;
  const result = await getListing(params, params.category);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
        <h1 className="text-2xl font-bold lg:text-3xl">
          {params.q ? (
            <>
              Results for &ldquo;{params.q}&rdquo;
            </>
          ) : (
            "All products"
          )}
        </h1>
      </div>
      <ListingView basePath="/search" params={params} result={result} />
    </div>
  );
}
