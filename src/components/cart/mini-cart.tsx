"use client";

import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { Overlay } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";

export function MiniCart({
  item,
  subtotalCents,
  onClose,
}: {
  item: { title: string; imageUrl: string | null; unitPriceCents: number; quantity: number };
  subtotalCents: number;
  onClose: () => void;
}) {
  return (
    <Overlay open onClose={onClose} variant="drawer" label="Added to cart">
      <div className="p-5">
        <p className="flex items-center gap-2 text-base font-medium text-success">
          <Check strokeWidth={1.75} className="h-5 w-5" aria-hidden="true" />
          Added to cart
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-card border border-line bg-sunken p-3">
          <div className="h-16 w-16 shrink-0 rounded-btn bg-surface p-1.5">
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt="" width={64} height={64} className="h-full w-full object-contain" />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
            <p className="text-sm text-inkSoft">
              {item.quantity} × {formatCents(item.unitPriceCents)}
            </p>
          </div>
        </div>
        <p className="mt-4 flex items-baseline justify-between text-base">
          <span className="text-inkSoft">Subtotal</span>
          <span className="price text-lg">{formatCents(subtotalCents)}</span>
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/cart"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-btn bg-brand px-4 text-base font-medium text-white hover:bg-brandDeep"
          >
            View cart
          </Link>
          <Button variant="tertiary" disabled>
            Checkout opens soon
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
