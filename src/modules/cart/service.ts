import { AppError } from "@/lib/errors";
import { estimateShipping, priceCart, type PricingResult } from "@/modules/checkout/pricing";
import { stockState } from "@/modules/catalog/stock";
import * as repo from "./repo";
import { clampQuantity, resolveLineView, type Owner } from "./identity";

export interface CartLineView {
  variantId: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  options: Record<string, string | boolean>;
  quantity: number;
  unitPriceCents: number;
  addedPriceCents: number;
  priceChanged: { fromCents: number; toCents: number } | null;
  stockQty: number;
  maxQuantity: number;
  unavailable: boolean;
  stockLabel: string;
  lineTotalCents: number;
  pricing: { baseCents: number; discountCents: number; taxCents: number; totalCents: number } | null;
}

export interface CartView {
  lines: CartLineView[];
  summary: {
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
    payableCents: number;
    freeShippingRemainingCents: number;
    shippingMethodName: string | null;
    taxLabel: string | null;
    estimateCountry: string;
  };
  countries: { code: string; label: string; rateBps: number }[];
  count: number;
}

export interface AddItemResult {
  appliedQuantity: number;
  clamped: boolean;
  reason?: "stock" | "max" | "out_of_stock";
  cartCount: number;
}

const DEFAULT_COUNTRY = "US";
const MAX_QUANTITY = 10;

async function buildView(cart: { id: string; estimateCountry: string | null }): Promise<CartView> {
  const [lineRows, methods, taxRates] = await Promise.all([
    repo.getLines(cart.id),
    repo.getShippingMethods(),
    repo.getTaxRates(),
  ]);

  const estimateCountry = cart.estimateCountry ?? DEFAULT_COUNTRY;
  const tax = taxRates.find((r) => r.countryCode === estimateCountry);
  const method = estimateShipping(methods.filter((m) => m.isActive));

  const available = lineRows.filter((row) => row.productStatus === "active" && row.stockQty > 0);
  const pricing: PricingResult | null =
    available.length > 0 && method
      ? priceCart({
          lines: available.map((row) => ({
            variantId: row.variantId,
            unitPriceCents: row.unitPriceCents,
            quantity: row.qty,
          })),
          shippingMethod: { priceCents: method.priceCents, freeOverCents: method.freeOverCents },
          taxRateBps: tax?.rateBps ?? 0,
        })
      : null;

  const pricedById = new Map(pricing?.lines.map((l) => [l.variantId, l]) ?? []);

  const lines: CartLineView[] = lineRows.map((row) => {
    const view = resolveLineView(row, MAX_QUANTITY);
    const priced = pricedById.get(row.variantId);
    return {
      ...view,
      stockLabel: stockState(row.stockQty, row.lowStockThreshold).label,
      lineTotalCents: view.unavailable ? 0 : row.unitPriceCents * row.qty,
      pricing: priced
        ? {
            baseCents: priced.baseCents,
            discountCents: priced.discountCents,
            taxCents: priced.taxCents,
            totalCents: priced.totalCents,
          }
        : null,
    };
  });

  return {
    lines,
    summary: {
      subtotalCents: pricing?.subtotalCents ?? 0,
      shippingCents: pricing?.shippingCents ?? 0,
      taxCents: pricing?.taxCents ?? 0,
      totalCents: pricing?.totalCents ?? 0,
      payableCents: pricing?.payableCents ?? 0,
      freeShippingRemainingCents: pricing?.freeShippingRemainingCents ?? 0,
      shippingMethodName: method?.name ?? null,
      taxLabel: tax ? `${tax.countryCode} ${tax.label}` : null,
      estimateCountry,
    },
    countries: taxRates.map((r) => ({ code: r.countryCode, label: r.label, rateBps: r.rateBps })),
    count: lines.reduce((sum, line) => sum + (line.unavailable ? 0 : line.quantity), 0),
  };
}

async function cartFor(owner: Owner): Promise<{ id: string; estimateCountry: string | null } | null> {
  return repo.findCart(owner);
}

export async function getCart(owner: Owner): Promise<CartView | null> {
  const cart = await cartFor(owner);
  if (!cart) return null;
  return buildView(cart);
}

export async function getCartCount(owner: Owner): Promise<number> {
  const cart = await cartFor(owner);
  if (!cart) return 0;
  return repo.countItems(cart.id);
}

/**
 * Add to cart and return the refreshed cart, so the client needs no follow-up
 * requests. Two database round trips in total: the atomic add, then the view.
 */
export async function addItem(
  owner: Owner,
  variantId: string,
  quantity: number,
): Promise<AddItemResult & { cart: CartView | null }> {
  let row = await repo.addItemAtomic(owner, variantId, quantity, MAX_QUANTITY, DEFAULT_COUNTRY);
  // Two first-adds racing to create the same cart: the loser saw no cart. Retry once.
  if (row.variantFound && !row.cartId) {
    row = await repo.addItemAtomic(owner, variantId, quantity, MAX_QUANTITY, DEFAULT_COUNTRY);
  }
  if (!row.variantFound) throw new AppError("NOT_FOUND", "This product is no longer available.");
  if (!row.cartId) throw new AppError("INTERNAL", "Could not add to your cart. Please try again.");

  const cart = await buildView({ id: row.cartId, estimateCountry: row.estimateCountry });

  if (row.stockQty <= 0 || row.newQty === null) {
    return { appliedQuantity: 0, clamped: true, reason: "out_of_stock", cartCount: cart.count, cart };
  }

  const applied = row.newQty - row.oldQty;
  const clamp = clampQuantity(quantity, row.oldQty, row.stockQty, MAX_QUANTITY);
  return {
    appliedQuantity: applied,
    clamped: clamp.reason !== undefined && applied < quantity,
    reason: applied < quantity ? clamp.reason ?? "stock" : undefined,
    cartCount: cart.count,
    cart,
  };
}

export async function setQuantity(
  owner: Owner,
  variantId: string,
  quantity: number,
): Promise<{ quantity: number; clamped: boolean; cart: CartView }> {
  const [cart, variant] = await Promise.all([cartFor(owner), repo.getVariant(variantId)]);
  if (!cart) throw new AppError("NOT_FOUND", "Cart item not found.");

  let applied = 0;
  if (quantity === 0 || !variant) {
    // A line whose product went away can still be removed.
    if (quantity !== 0) throw new AppError("NOT_FOUND", "This product is no longer available.");
    await Promise.all([repo.removeItem(cart.id, variantId), repo.touchCart(cart.id)]);
  } else {
    [applied] = await Promise.all([
      repo.setItemQuantity(cart.id, variantId, quantity, variant.stockQty, MAX_QUANTITY),
      repo.touchCart(cart.id),
    ]);
  }
  return { quantity: applied, clamped: applied < quantity, cart: await buildView(cart) };
}

export async function removeItem(owner: Owner, variantId: string): Promise<CartView> {
  const cart = await cartFor(owner);
  if (!cart) throw new AppError("NOT_FOUND", "Cart item not found.");
  await Promise.all([repo.removeItem(cart.id, variantId), repo.touchCart(cart.id)]);
  return buildView(cart);
}

export async function setEstimateCountry(owner: Owner, country: string): Promise<void> {
  const tax = (await repo.getTaxRates()).find((r) => r.countryCode === country);
  if (!tax) throw new AppError("VALIDATION", "Unknown country code.");
  const cart = (await cartFor(owner)) ?? (await repo.createCart(owner, country));
  await repo.setEstimateCountry(cart.id, country);
}
