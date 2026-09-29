"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PriceText } from "@/components/price-text";
import type { ProductDetail } from "@/modules/catalog/types";

export function BuyBox({ product }: { product: ProductDetail }) {
  const [variantId, setVariantId] = useState(product.defaultVariant?.id ?? "");
  const variants = product.variants;
  const selected = variants.find((v) => v.id === variantId) ?? product.defaultVariant;
  const hasChoice = variants.length > 1;
  const state = selected?.stockState;

  const stockBadge =
    state?.kind === "out" ? (
      <Badge variant="outOfStock">{state.label}</Badge>
    ) : state?.kind === "low" ? (
      <Badge variant="lowStock">{state.label}</Badge>
    ) : state ? (
      <span className="text-sm text-success">{state.label}</span>
    ) : null;

  const body = (
    <div className="space-y-3">
      {selected ? <PriceText cents={selected.priceCents} compareAtCents={selected.compareAtCents} size="lg" /> : null}
      {stockBadge}
      {hasChoice ? (
        <label className="block text-sm text-inkSoft">
          Option
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="mt-1 h-11 w-full rounded-btn border border-lineStrong bg-surface px-2 text-base text-ink"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {Object.entries(v.options)
                  .filter(([, value]) => value !== true)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ") || "Default"}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        disabled
        className="min-h-11 w-full rounded-btn bg-accent px-4 text-base font-medium text-white opacity-60"
      >
        Cart opens soon
      </button>
      <p className="text-sm text-inkMuted">Taxes and shipping calculated at the next step.</p>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block rounded-card border border-line bg-surface p-5">{body}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-3 shadow-pop lg:hidden">
        <div className="flex items-center gap-3">
          {selected ? (
            <span className="price text-lg">{PriceTextMobile(selected.priceCents)}</span>
          ) : null}
          <button
            type="button"
            disabled
            className="ml-auto min-h-11 flex-1 rounded-btn bg-accent px-4 text-base font-medium text-white opacity-60"
          >
            Cart opens soon
          </button>
        </div>
      </div>
    </>
  );
}

function PriceTextMobile(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
