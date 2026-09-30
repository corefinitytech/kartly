export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function tokenExpiresAt(issuedAt: number, ttlMs: number): number {
  return issuedAt + ttlMs;
}

export function isTokenExpired(expiresAt: number, now: number): boolean {
  return now >= expiresAt;
}
