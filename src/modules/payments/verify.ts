export interface PaymentIntentLike {
  id: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string> | null;
}

export interface OrderLike {
  id: string;
  number: string;
  payableCents: number;
  currency: string;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "amount_mismatch" | "currency_mismatch" | "metadata_mismatch" };

export function verifyPaymentIntent(intent: PaymentIntentLike, order: OrderLike): VerifyResult {
  if (intent.metadata?.order_id !== order.id) return { ok: false, reason: "metadata_mismatch" };
  if (intent.amount !== order.payableCents) return { ok: false, reason: "amount_mismatch" };
  if (intent.currency.toLowerCase() !== order.currency.toLowerCase()) {
    return { ok: false, reason: "currency_mismatch" };
  }
  return { ok: true };
}
