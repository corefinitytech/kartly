import { createHash, randomBytes } from "node:crypto";

export const CART_COOKIE_NAME = "kt_cart";
export const CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export type Owner =
  | { kind: "guest"; tokenHash: string }
  | { kind: "user"; userId: string };

export function newCartToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashCartToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ClampResult {
  quantity: number;
  reason?: "stock" | "max" | "out_of_stock";
}

export function clampQuantity(
  requested: number,
  current: number,
  stock: number,
  max: number,
): ClampResult {
  if (stock <= 0) return { quantity: current, reason: "out_of_stock" };
  const cap = Math.min(stock, max);
  const total = current + requested;
  if (total <= cap) return { quantity: total };
  return { quantity: cap, reason: stock < max ? "stock" : "max" };
}

export function resolveLineView(
  line: {
    variantId: string;
    qty: number;
    addedPriceCents: number;
    title: string;
    slug: string;
    imageUrl: string | null;
    optionsJson: string;
    unitPriceCents: number;
    stockQty: number;
    lowStockThreshold: number;
    productStatus: string;
  },
  maxQuantity: number,
) {
  const unavailable = line.productStatus !== "active" || line.stockQty <= 0;
  return {
    variantId: line.variantId,
    title: line.title,
    slug: line.slug,
    imageUrl: line.imageUrl,
    options: JSON.parse(line.optionsJson) as Record<string, string | boolean>,
    quantity: line.qty,
    unitPriceCents: line.unitPriceCents,
    addedPriceCents: line.addedPriceCents,
    priceChanged:
      !unavailable && line.addedPriceCents !== line.unitPriceCents
        ? { fromCents: line.addedPriceCents, toCents: line.unitPriceCents }
        : null,
    stockQty: line.stockQty,
    maxQuantity: Math.min(line.stockQty, maxQuantity),
    unavailable,
  };
}
