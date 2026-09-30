import { AppError } from "@/lib/errors";

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "payment_failed",
  "partially_refunded",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled", "payment_failed"],
  payment_failed: ["pending_payment", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded"],
  refunded: [],
  cancelled: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError("CONFLICT", `Order cannot move from ${from} to ${to}.`);
  }
}

/** The single fulfilment step an operator can take next, if any. */
export function nextFulfilmentStatus(from: OrderStatus): "processing" | "shipped" | "delivered" | null {
  if (from === "paid") return "processing";
  if (from === "processing") return "shipped";
  if (from === "shipped") return "delivered";
  return null;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};
