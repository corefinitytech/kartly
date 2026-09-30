"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { SearchX } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { RouteProgress } from "@/components/route-progress";
import { FiltersSidebar, FiltersToggleButton } from "@/components/listing/filters";
import { Pagination, SortSelect } from "@/components/listing/sort-pagination";
import { activeFilters } from "@/modules/catalog/url";
import type { ListingParams } from "@/modules/catalog/schemas";
import type { ListingResult } from "@/modules/catalog/types";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const FilterSheet = dynamic(
  () => import("./filter-sheet").then((m) => m.FilterSheet),
  { ssr: false },
);

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
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = activeFilters(params, formatCents);

  useEffect(() => {
    setPending(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      setPending(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <RouteProgress />
      <div className="flex gap-8">
        <div className="hidden w-64 shrink-0 lg:block">
          <FiltersSidebar basePath={basePath} params={params} facets={result.facets} active={active} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-sm text-inkSoft">
              <span key={result.total} className="anim-fade-in inline-block">
                {result.total} {result.total === 1 ? "product" : "products"}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <div className="lg:hidden">
                <FiltersToggleButton onClick={() => setSheetOpen(true)} activeCount={active.length} />
              </div>
              <SortSelect basePath={basePath} params={params} />
            </div>
          </div>

          <div
            aria-busy={pending}
            className={cn(
              "transition-opacity duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]",
              pending ? "pointer-events-none opacity-60" : "opacity-100",
            )}
          >
            {result.items.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No products match"
                description="Try removing a filter or searching for something else."
                actionLabel="Clear all filters"
                onAction={() => {
                  setPending(true);
                  window.location.href = params.q
                    ? `/search?q=${encodeURIComponent(params.q)}`
                    : basePath;
                }}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {result.items.map((product, index) => (
                  <div key={product.id} className="anim-fade-in">
                    <ProductCard product={product} priority={index < 4} />
                  </div>
                ))}
              </div>
            )}

            <Pagination basePath={basePath} params={params} pageCount={result.pageCount} />
          </div>
        </div>
      </div>

      <FilterSheet
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
