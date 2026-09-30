export interface MergeInput {
  userId: string;
  guestTokenHash: string;
}

export interface MergeLine {
  variantId: string;
  guestQty: number;
  userQty: number | null;
  guestAddedPriceCents: number;
  userAddedPriceCents: number | null;
  stockQty: number;
}

export interface MergePlanLine {
  variantId: string;
  quantity: number;
  addedPriceCents: number;
  clamped: boolean;
}

export interface MergePlan {
  lines: MergePlanLine[];
  mergedAnything: boolean;
  clampedAnything: boolean;
}

const MAX_QUANTITY = 10;

export function planGuestCartMerge(lines: MergeLine[]): MergePlan {
  const planned: MergePlanLine[] = lines.map((line) => {
    const cap = Math.min(line.stockQty, MAX_QUANTITY);
    const sum = line.guestQty + (line.userQty ?? 0);
    const quantity = Math.min(sum, cap);
    return {
      variantId: line.variantId,
      quantity,
      addedPriceCents:
        line.userQty !== null && line.userQty > 0 ? line.userAddedPriceCents! : line.guestAddedPriceCents,
      clamped: sum > cap,
    };
  });
  return {
    lines: planned,
    mergedAnything: planned.some((l) => l.quantity > (lines.find((x) => x.variantId === l.variantId)?.userQty ?? 0)),
    clampedAnything: planned.some((l) => l.clamped),
  };
}
