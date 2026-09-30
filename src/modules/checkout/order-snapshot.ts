export interface SnapshotLine {
  variantId: string;
  title: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  baseCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export interface SnapshotResult {
  lines: SnapshotLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  payableCents: number;
  pricingJson: Record<string, unknown>;
}

export interface SnapshotInputLine {
  variantId: string;
  title: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  priced: { baseCents: number; discountCents: number; taxCents: number; totalCents: number };
}

export interface SnapshotPricing {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  payableCents: number;
  breakdown: Record<string, unknown>;
}

export function buildOrderSnapshot(
  lines: SnapshotInputLine[],
  pricing: SnapshotPricing,
  shippingMethodCode: string,
): SnapshotResult {
  return {
    lines: lines.map((line) => ({
      variantId: line.variantId,
      title: line.title,
      sku: line.sku,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      baseCents: line.priced.baseCents,
      discountCents: line.priced.discountCents,
      taxCents: line.priced.taxCents,
      totalCents: line.priced.totalCents,
    })),
    subtotalCents: pricing.subtotalCents,
    discountCents: pricing.discountCents,
    shippingCents: pricing.shippingCents,
    taxCents: pricing.taxCents,
    totalCents: pricing.totalCents,
    payableCents: pricing.payableCents,
    pricingJson: {
      ...pricing.breakdown,
      shippingMethodCode,
    },
  };
}
