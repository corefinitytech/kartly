"use client";

import { useState } from "react";
import { SearchX } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FiltersBottomSheet,
  FiltersSidebar,
  FiltersToggleButton,
} from "@/components/listing/filters";
import { Pagination, SortSelect } from "@/components/listing/sort-pagination";
import { activeFilters } from "@/modules/catalog/url";
import type { ListingParams } from "@/modules/catalog/schemas";
import type { ListingResult } from "@/modules/catalog/types";
import { formatCents } from "@/lib/money";

export function ListingView({
  basePath,
  params,
  result,
}: {
  basePath: string;
  params: ListingParams;
  result: ListingResult;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = activeFilters(params, formatCents);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <div className="flex gap-8">
        <div className="hidden w-64 shrink-0 lg:block">
          <FiltersSidebar basePath={basePath} params={params} facets={result.facets} active={active} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-inkSoft">
              {result.total} {result.total === 1 ? "product" : "products"}
            </p>
            <div className="flex items-center gap-2">
              <div className="lg:hidden">
                <FiltersToggleButton onClick={() => setSheetOpen(true)} activeCount={active.length} />
              </div>
              <SortSelect basePath={basePath} params={params} />
            </div>
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No products match"
              description="Try removing a filter or searching for something else."
              actionLabel="Clear all filters"
              onAction={() => {
                window.location.href = params.q ? `/search?q=${encodeURIComponent(params.q)}` : basePath;
              }}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {result.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <Pagination basePath={basePath} params={params} pageCount={result.pageCount} />
        </div>
      </div>

      <FiltersBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        basePath={basePath}
        params={params}
        facets={result.facets}
        active={active}
      />
    </div>
  );
}
