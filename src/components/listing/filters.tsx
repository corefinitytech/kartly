"use client";

import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import type { ListingParams } from "@/modules/catalog/schemas";
import { buildListingUrl, withoutFilter } from "@/modules/catalog/url";
import type { ListingFacets } from "@/modules/catalog/types";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface FiltersProps {
  basePath: string;
  params: ListingParams;
  facets: ListingFacets;
  active: { key: string; label: string }[];
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex min-h-11 items-center rounded-badge border px-3 text-sm transition-theme",
        active
          ? "border-brand bg-brandTint font-medium text-ink"
          : "border-line bg-surface text-inkSoft hover:border-lineStrong hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

const PRICE_RANGES = [
  { label: "Under $25", min: undefined, max: 2500 },
  { label: "$25 to $100", min: 2500, max: 10000 },
  { label: "$100 to $500", min: 10000, max: 50000 },
  { label: "$500 and up", min: 50000, max: undefined },
];

export function FiltersBody({ basePath, params, facets, active }: FiltersProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="label-caps w-full text-inkMuted">Brand</p>
        {facets.brands.slice(0, 12).map((b) => (
          <FilterLink
            key={b.brand}
            href={buildListingUrl(basePath, params, { brand: params.brand === b.brand ? undefined : b.brand })}
            active={params.brand === b.brand}
          >
            {b.brand} ({b.count})
          </FilterLink>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="label-caps w-full text-inkMuted">Price</p>
        {PRICE_RANGES.map((range) => (
          <FilterLink
            key={range.label}
            href={buildListingUrl(basePath, params, { minPrice: range.min, maxPrice: range.max })}
            active={params.minPrice === range.min && params.maxPrice === range.max}
          >
            {range.label}
          </FilterLink>
        ))}
        {facets.priceBounds.max > 0 ? (
          <span className="text-sm text-inkMuted">
            {formatCents(facets.priceBounds.min)} – {formatCents(facets.priceBounds.max)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="label-caps w-full text-inkMuted">Rating</p>
        {[4, 3].map((rating) => (
          <FilterLink
            key={rating}
            href={buildListingUrl(basePath, params, { minRating: params.minRating === rating ? undefined : rating })}
            active={params.minRating === rating}
          >
            {rating}★ and up
          </FilterLink>
        ))}
        <FilterLink
          href={buildListingUrl(basePath, params, { inStock: params.inStock ? undefined : true })}
          active={params.inStock}
        >
          In stock only
        </FilterLink>
      </div>

      {active.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {active.map((f) => (
            <Link
              key={f.key}
              href={buildListingUrl(basePath, withoutFilter(params, f.key))}
              scroll={false}
              className="anim-chip-in inline-flex min-h-9 items-center gap-1 rounded-badge bg-brandTint px-3 text-sm text-ink"
            >
              {f.label}
              <X strokeWidth={1.75} className="h-4 w-4" aria-label={`Remove ${f.label}`} />
            </Link>
          ))}
          <Link
            href={buildListingUrl(basePath, {
              ...params,
              brand: undefined,
              minPrice: undefined,
              maxPrice: undefined,
              minRating: undefined,
              inStock: undefined,
            })}
            scroll={false}
            className="min-h-9 text-sm text-brandLink underline underline-offset-4"
          >
            Clear all
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function FiltersSidebar(props: FiltersProps) {
  return (
    <aside aria-label="Filters" className="rounded-card border border-line bg-surface p-4 lg:sticky lg:top-40">
      <FiltersBody {...props} />
    </aside>
  );
}

export function FiltersToggleButton({ onClick, activeCount }: { onClick: () => void; activeCount: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-btn border border-lineStrong bg-surface px-4 text-base text-ink"
    >
      <SlidersHorizontal strokeWidth={1.75} className="h-5 w-5" />
      Filters
      {activeCount > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brandTint px-1 text-xs font-semibold text-ink">
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}
