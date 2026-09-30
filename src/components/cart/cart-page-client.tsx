"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-store";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";

function QuantityStepper({
  value,
  min,
  max,
  disabled,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-btn border border-lineStrong" role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease quantity of ${label}`}
        className="flex h-11 w-11 items-center justify-center rounded-l-btn hover:bg-sunken disabled:opacity-40"
      >
        <Minus strokeWidth={1.75} className="h-5 w-5" />
      </button>
      <span aria-live="polite" className="w-10 text-center text-base font-medium">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase quantity of ${label}`}
        className="flex h-11 w-11 items-center justify-center rounded-r-btn hover:bg-sunken disabled:opacity-40"
      >
        <Plus strokeWidth={1.75} className="h-5 w-5" />
      </button>
    </div>
  );
}

function CartLines() {
  const { view, setQuantity, remove, undoRemove } = useCart();
  const { toast } = useToast();

  if (!view || view.lines.length === 0) return null;

  return (
    <ul className="divide-y divide-line">
      {view.lines.map((line) => (
        <li key={line.variantId} className="flex gap-3 py-4">
          <div className="h-20 w-20 shrink-0 rounded-btn bg-sunken p-2 sm:h-24 sm:w-24">
            {line.imageUrl ? (
              <Image src={line.imageUrl} alt="" width={96} height={96} className="h-full w-full object-contain" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/p/${line.slug}`} className="line-clamp-2 text-sm font-medium underline-offset-4 hover:underline sm:text-base">
                {line.title}
              </Link>
              <span className="price shrink-0 text-sm sm:text-base">
                {formatCents(line.unitPriceCents * line.quantity)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-inkSoft">
              {Object.entries(line.options)
                .filter(([, v]) => v !== true)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ") || "Default"}{" "}
              · {formatCents(line.unitPriceCents)} each
            </p>

            {line.unavailable ? (
              <p className="mt-2 rounded-badge bg-sunken px-3 py-1.5 text-sm text-inkSoft">
                This item is no longer available and is excluded from the total.
              </p>
            ) : (
              <>
                {line.priceChanged ? (
                  <p className="mt-2 rounded-badge bg-warningTint px-3 py-1.5 text-sm text-warning">
                    Price changed from {formatCents(line.priceChanged.fromCents)} to{" "}
                    {formatCents(line.priceChanged.toCents)} since you added it.
                  </p>
                ) : null}
                {line.stockQty <= 5 ? (
                  <p className="mt-2 text-sm text-warning">{line.stockLabel}</p>
                ) : null}
                <div className="mt-2 flex items-center gap-3">
                  <QuantityStepper
                    value={line.quantity}
                    min={1}
                    max={Math.max(1, line.maxQuantity)}
                    onChange={(quantity) => void setQuantity(line.variantId, quantity)}
                    label={line.title}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void remove(line.variantId);
                      toast({
                        title: "Removed",
                        description: `${line.title} removed from your cart.`,
                        actionLabel: "Undo",
                        onAction: () => void undoRemove(),
                      });
                    }}
                    className="min-h-11 px-2 text-sm text-brandLink underline underline-offset-4"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Summary({ sticky }: { sticky?: boolean }) {
  const { view, setCountry } = useCart();
  if (!view) return null;
  const summary = view.summary;

  return (
    <div className={sticky ? "rounded-card border border-line bg-surface p-5 lg:sticky lg:top-40" : "rounded-card border border-line bg-surface p-5"}>
      <h2 className="text-lg font-semibold">Order summary</h2>
      <label htmlFor="estimate-country" className="mt-3 block text-sm text-inkSoft">
        Estimate for
        <select
          id="estimate-country"
          value={summary.estimateCountry}
          onChange={(e) => void setCountry(e.target.value)}
          className="mt-1 h-11 w-full rounded-btn border border-lineStrong bg-surface px-2 text-base text-ink"
        >
          {view.countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label} ({(c.rateBps / 100).toFixed(0)}%)
            </option>
          ))}
        </select>
      </label>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-inkSoft">Subtotal</dt>
          <dd className="price">{formatCents(summary.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-inkSoft">Estimated shipping ({summary.shippingMethodName ?? "standard"})</dt>
          <dd className="price">{summary.shippingCents === 0 ? "Free" : formatCents(summary.shippingCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-inkSoft">Estimated tax {summary.taxLabel ? `(${summary.taxLabel})` : ""}</dt>
          <dd className="price">{formatCents(summary.taxCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base">
          <dt className="font-semibold">Total</dt>
          <dd className="price text-lg">{formatCents(summary.totalCents)}</dd>
        </div>
      </dl>
      {summary.freeShippingRemainingCents > 0 ? (
        <p className="mt-3 text-sm text-inkSoft">
          Add {formatCents(summary.freeShippingRemainingCents)} more for free shipping.
        </p>
      ) : null}
      <a
        href="/checkout"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-btn bg-accent px-4 text-base font-medium text-white transition-colors duration-150 hover:bg-accentHover active:bg-accentPressed"
      >
        Checkout
      </a>
      <p className="mt-2 text-sm text-inkMuted">Shipping and tax are estimates until checkout.</p>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-6 py-16 text-center">
      <ShoppingCart strokeWidth={1.75} className="h-6 w-6 text-inkMuted" />
      <h1 className="text-lg font-semibold">Your cart is empty</h1>
      <p className="text-sm text-inkSoft">Browse the store and add something you like.</p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-11 items-center rounded-btn bg-brand px-4 text-base font-medium text-white hover:bg-brandDeep"
      >
        Browse products
      </Link>
      <p className="mt-3 text-sm text-inkSoft">
        Have an account?{" "}
        <a href="/login" className="text-brandLink underline underline-offset-4">
          Sign in
        </a>{" "}
        to keep your cart across devices.
      </p>
    </div>
  );
}

export function CartPageClient() {
  const { view, loaded, error, refresh } = useCart();

  if (error && !view) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Could not load your cart</h1>
        <p className="text-sm text-inkSoft">Please try again.</p>
        <Button variant="tertiary" className="mt-2" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex gap-3 py-4">
            <Skeleton className="h-20 w-20 rounded-btn" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-11 w-36 rounded-btn" />
            </div>
          </div>
        ))}
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (!view || view.lines.length === 0) return <EmptyCart />;

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-card border border-line bg-surface px-4">
          <h1 className="py-4 text-2xl font-bold">Your cart</h1>
          <CartLines />
        </div>
        <Summary sticky />
      </div>
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-3 shadow-pop lg:hidden">
        <div className="flex items-center gap-3">
          <span className="price text-lg">{formatCents(view.summary.totalCents)}</span>
          <a
            href="/checkout"
            className="ml-auto inline-flex min-h-11 flex-1 items-center justify-center rounded-btn bg-accent px-4 text-base font-medium text-white transition-colors duration-150 hover:bg-accentHover active:bg-accentPressed"
          >
            Checkout
          </a>
        </div>
      </div>
      <div className="h-16 lg:hidden" />
    </>
  );
}
