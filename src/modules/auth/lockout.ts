const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

interface Failure {
  count: number;
  firstAt: number;
}

const failures = new Map<string, Failure>();

export function lockoutKey(email: string, ip: string): string {
  return `${email.toLowerCase()}|${ip}`;
}

export function lockoutRemainingMs(key: string, now = Date.now()): number {
  const entry = failures.get(key);
  if (!entry) return 0;
  if (entry.count < MAX_FAILURES) return 0;
  const windowEnd = entry.firstAt + LOCK_WINDOW_MS;
  const remaining = windowEnd - now;
  if (remaining <= 0) {
    failures.delete(key);
    return 0;
  }
  return remaining;
}

export function recordFailure(key: string, now = Date.now()): void {
  const entry = failures.get(key);
  if (!entry || now - entry.firstAt > LOCK_WINDOW_MS) {
    failures.set(key, { count: 1, firstAt: now });
    return;
  }
  entry.count += 1;
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

export function formatRemaining(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  return minutes <= 1 ? "less than a minute" : `${minutes} minutes`;
}
