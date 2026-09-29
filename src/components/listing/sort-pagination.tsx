"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ListingParams, SortOption } from "@/modules/catalog/schemas";
import { buildListingUrl } from "@/modules/catalog/url";

const SORT_LABELS: Record<SortOption, string> = {
  relevance: "Relevance",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Rating",
  newest: "Newest",
};

export function SortSelect({ basePath, params }: { basePath: string; params: ListingParams }) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm text-inkSoft">
      Sort
      <select
        value={params.sort}
        onChange={(event) => {
          window.location.href = buildListingUrl(basePath, params, {
            sort: event.target.value as SortOption,
            page: 1,
          });
        }}
        className="h-11 rounded-btn border border-lineStrong bg-surface px-2 text-base text-ink"
      >
        {Object.entries(SORT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Pagination({
  basePath,
  params,
  pageCount,
}: {
  basePath: string;
  params: ListingParams;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const page = params.page;

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link
          href={buildListingUrl(basePath, params, { page: page - 1 })}
          scroll={false}
          aria-label="Previous page"
          className="flex h-11 w-11 items-center justify-center rounded-btn border border-lineStrong bg-surface hover:bg-sunken"
        >
          <ChevronLeft strokeWidth={1.75} className="h-5 w-5" />
        </Link>
      ) : null}
      <span className="px-2 text-sm text-inkSoft">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          href={buildListingUrl(basePath, params, { page: page + 1 })}
          scroll={false}
          aria-label="Next page"
          className="flex h-11 w-11 items-center justify-center rounded-btn border border-lineStrong bg-surface hover:bg-sunken"
        >
          <ChevronRight strokeWidth={1.75} className="h-5 w-5" />
        </Link>
      ) : null}
    </nav>
  );
}
