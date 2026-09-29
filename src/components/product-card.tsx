import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceText } from "@/components/price-text";
import { RatingStars } from "@/components/rating-stars";
import { stockState } from "@/modules/catalog/stock";

export interface ProductCardData {
  slug: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  priceCents: number;
  compareAtCents?: number | null;
  ratingAvg: number;
  ratingCount: number;
  stockQty: number;
  lowStockThreshold: number;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const state = stockState(product.stockQty, product.lowStockThreshold);

  return (
    <Card className="group overflow-hidden border-line transition-colors duration-150 hover:border-lineStrong">
      <Link href={`/p/${product.slug}`} className="focus-visible:outline-none">
        <div className="aspect-square w-full bg-sunken p-3">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.title}
              loading="lazy"
              width={400}
              height={400}
              className="h-full w-full object-contain transition-colors duration-150"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-inkMuted">
              No image
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 p-4">
          {product.brand ? (
            <span className="text-sm text-inkSoft">{product.brand}</span>
          ) : null}
          <h3 className="line-clamp-2 text-base font-medium leading-snug">{product.title}</h3>
          <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
          <PriceText cents={product.priceCents} compareAtCents={product.compareAtCents} />
          {state.kind === "out" ? (
            <Badge variant="outOfStock">Out of stock</Badge>
          ) : state.kind === "low" ? (
            <Badge variant="lowStock">Only {product.stockQty} left</Badge>
          ) : null}
        </div>
      </Link>
    </Card>
  );
}
