export type StockState =
  | { kind: "in"; label: "In stock" }
  | { kind: "low"; label: string }
  | { kind: "out"; label: "Out of stock" };

export function stockState(stockQty: number, lowStockThreshold: number): StockState {
  if (stockQty <= 0) return { kind: "out", label: "Out of stock" };
  if (stockQty <= lowStockThreshold) return { kind: "low", label: `Only ${stockQty} left` };
  return { kind: "in", label: "In stock" };
}
