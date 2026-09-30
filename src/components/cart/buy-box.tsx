"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriceText } from "@/components/price-text";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { useCart } from "@/components/cart/cart-store";
import { useToast } from "@/components/ui/toast";
import type { ProductDetail } from "@/modules/catalog/types";
import { formatCents } from "@/lib/money";

const MiniCart = dynamic(() => import("./mini-cart").then((m) => m.MiniCart), { ssr: false });

function variantLabel(options: Record<string, string | boolean>): string {
  return (
    Object.entries(options)
      .filter(([, value]) => value !== true)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ") || "Default"
  );
}

function QuantityStepper({
  value,
  min,
  max,
  onChange,
  idPrefix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  idPrefix: string;
}) {
  return (
    <div
      className="flex w-full items-center justify-between rounded-btn border border-lineStrong"
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="flex h-11 w-11 items-center justify-center rounded-l-btn hover:bg-sunken disabled:opacity-40"
      >
        <Minus strokeWidth={1.75} className="h-5 w-5" />
      </button>
      <span id={`${idPrefix}-qty`} aria-live="polite" className="text-base font-medium">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="flex h-11 w-11 items-center justify-center rounded-r-btn hover:bg-sunken disabled:opacity-40"
      >
        <Plus strokeWidth={1.75} className="h-5 w-5" />
      </button>
    </div>
  );
}

export function BuyBox({ product, imageForLine }: { product: ProductDetail; imageForLine: string | null }) {
  const [variantId, setVariantId] = useState(product.defaultVariant?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<"idle" | "pending" | "added">("idle");
  const [drawer, setDrawer] = useState(false);
  const { add, announce, view } = useCart();
  const { toast } = useToast();

  const variants = product.variants;
  const selected = variants.find((v) => v.id === variantId) ?? product.defaultVariant;
  const hasChoice = variants.length > 1;
  const outOfStock = selected?.stockState.kind === "out";
  const maxQuantity = Math.min(10, selected?.stockQty ?? 1);
  const state2 = selected?.stockState;

  const stockBadge =
    state2?.kind === "out" ? (
      <Badge variant="outOfStock">{state2.label}</Badge>
    ) : state2?.kind === "low" ? (
      <Badge variant="lowStock">{state2.label}</Badge>
    ) : state2 ? (
      <span className="text-sm text-success">{state2.label}</span>
    ) : null;

  const onAdd = async () => {
    if (!selected || outOfStock) return;
    setState("pending");
    const result = await add(selected.id, product.title, quantity);
    setState("added");
    setTimeout(() => setState("idle"), 2000);
    if (!result) {
      toast({ title: "Could not add to cart", description: "Please try again.", variant: "error" });
      return;
    }
    if (result.clamped) {
      const message =
        result.reason === "out_of_stock"
          ? "This item just went out of stock."
          : `Only ${result.appliedQuantity} available, we added ${result.appliedQuantity}.`;
      toast({ title: message, variant: "error" });
    } else {
      announce(`Added ${product.title} to cart`);
      setDrawer(true);
    }
  };

  const controls = (
    <>
      {selected ? <PriceText cents={selected.priceCents} compareAtCents={selected.compareAtCents} size="lg" /> : null}
      {stockBadge}
      {hasChoice ? (
        <label className="block text-sm text-inkSoft">
          Option
          <select
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setQuantity(1);
            }}
            className="mt-1 h-11 w-full rounded-btn border border-lineStrong bg-surface px-2 text-base text-ink transition-theme focus-visible:border-brand"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {variantLabel(v.options)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!outOfStock ? (
        <QuantityStepper value={quantity} min={1} max={maxQuantity} onChange={setQuantity} idPrefix={product.slug} />
      ) : null}
      <AddToCartButton
        state={state}
        disabled={outOfStock}
        onClick={onAdd}
        aria-label={outOfStock ? "Out of stock" : `Add ${product.title} to cart`}
      >
        {outOfStock ? "Out of stock" : "Add to cart"}
      </AddToCartButton>
      <p className="text-sm text-inkMuted">Taxes and shipping calculated at the next step.</p>
    </>
  );

  return (
    <>
      <div className="hidden rounded-card border border-line bg-surface p-5 lg:block">
        <div className="flex flex-col gap-3">{controls}</div>
      </div>
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-3 shadow-pop lg:hidden">
        <div className="flex items-center gap-3">
          {selected ? <span className="price text-lg">{formatCents(selected.priceCents)}</span> : null}
          <div className="ml-auto flex-1">
            <AddToCartButton
              state={state}
              disabled={outOfStock}
              onClick={onAdd}
              aria-label={outOfStock ? "Out of stock" : `Add ${product.title} to cart`}
            >
              {outOfStock ? "Out of stock" : "Add to cart"}
            </AddToCartButton>
          </div>
        </div>
      </div>
      {drawer && selected ? (
        <MiniCart
          item={{
            title: product.title,
            imageUrl: imageForLine,
            unitPriceCents: selected.priceCents,
            quantity,
          }}
          subtotalCents={view?.summary.subtotalCents ?? selected.priceCents * quantity}
          onClose={() => setDrawer(false)}
        />
      ) : null}
    </>
  );
}
