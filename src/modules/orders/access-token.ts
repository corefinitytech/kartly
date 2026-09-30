import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function accessTokenMatches(token: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(hashAccessToken(token));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** How a caller proves an order is theirs: signed in, the guest link token, or order number + email lookup. */
export type OrderAccess = { userId: string } | { accessToken: string } | { email: string };

/** Statuses a customer may cancel themselves (FR-ORD-03); after this it has shipped. */
export const CUSTOMER_CANCELLABLE = ["pending_payment", "payment_failed", "paid", "processing"] as const;

/**
 * Ownership check (FR-SEC-07, AC-6). Pure so it is unit tested. A signed-in
 * user only matches their own user_id (never a guest order); a token matches
 * its stored hash; an email matches the order's contact email, case-insensitive.
 */
export function canAccessOrder(
  row: { user_id: string | null; access_token_hash: string | null },
  access: OrderAccess,
  contactEmail: string,
): boolean {
  if ("userId" in access) return row.user_id !== null && row.user_id === access.userId;
  if ("accessToken" in access) return accessTokenMatches(access.accessToken, row.access_token_hash);
  const given = access.email.trim().toLowerCase();
  return given.length > 0 && given === contactEmail.trim().toLowerCase();
}
