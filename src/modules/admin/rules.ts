// Pure admin business rules: refunds, stock adjustments, money input, slugs.
import { AppError } from "@/lib/errors";
import type { OrderStatus } from "@/modules/orders/state-machine";

/** Refunds that count against the paid amount (failed ones gave nothing back). */
export function refundableCents(
  paidCents: number,
  refunds: { amountCents: number; status: string }[],
): number {
  const committed = refunds
    .filter((r) => r.status !== "failed" && r.status !== "canceled")
    .reduce((sum, r) => sum + r.amountCents, 0);
  return Math.max(0, paidCents - committed);
}

export function assertRefundAmount(amountCents: number, remainingCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new AppError("VALIDATION", "Enter a refund amount above zero.");
  }
  if (amountCents > remainingCents) {
    throw new AppError("VALIDATION", "That is more than the amount left to refund.");
  }
}

/**
 * Order status after a refund. Status tracks fulfilment first: before delivery
 * a partial refund is recorded without changing it (use cancel for a full
 * refund of an unshipped order). After delivery it moves to (partially_)refunded.
 */
export function statusAfterRefund(current: OrderStatus, remainingAfterCents: number): OrderStatus {
  if (current === "delivered" || current === "partially_refunded") {
    return remainingAfterCents === 0 ? "refunded" : "partially_refunded";
  }
  return current;
}

export const REFUNDABLE_STATUSES: readonly OrderStatus[] = [
  "paid",
  "processing",
  "shipped",
  "delivered",
  "partially_refunded",
  "cancelled",
];

export const ADJUSTMENT_REASONS = ["restock", "correction", "damaged", "lost", "returned"] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const MAX_STOCK = 1_000_000;

/** New stock level after a manual adjustment; never negative, never absurd. */
export function applyStockDelta(current: number, delta: number): number {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new AppError("VALIDATION", "Enter a whole number other than zero.");
  }
  const next = current + delta;
  if (next < 0) {
    throw new AppError("VALIDATION", `Stock cannot go below zero. There are ${current} in stock.`);
  }
  if (next > MAX_STOCK) throw new AppError("VALIDATION", "That stock level is too high.");
  return next;
}

/** "12", "12.5", "$1,299.99" -> integer cents without ever using floats. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * 100 + fraction;
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
