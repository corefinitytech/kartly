"use client";

import { Overlay } from "@/components/ui/overlay";
import { FiltersBody } from "./filters";

export function FilterSheet({
  open,
  onClose,
  basePath,
  params,
  facets,
  active,
}: {
  open: boolean;
  onClose: () => void;
  basePath: string;
  params: import("@/modules/catalog/schemas").ListingParams;
  facets: import("@/modules/catalog/types").ListingFacets;
  active: { key: string; label: string }[];
}) {
  return (
    <Overlay open={open} onClose={onClose} variant="sheet" label="Filters">
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-11 w-11 items-center justify-center rounded-btn hover:bg-sunken"
          >
            Close
          </button>
        </div>
        <FiltersBody basePath={basePath} params={params} facets={facets} active={active} />
      </div>
    </Overlay>
  );
}
