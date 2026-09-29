export function roundHalfUp(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  const scaled = Number((Math.abs(value) * factor).toFixed(6));
  return (Math.sign(value) * Math.round(scaled)) / factor;
}

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error("Invalid amount");
  return roundHalfUp(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number): string {
  return formatter.format(fromCents(cents));
}
