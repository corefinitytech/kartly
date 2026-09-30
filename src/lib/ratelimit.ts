interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMIT_POLICIES = {
  search: { limit: 60, windowSeconds: 60 },
  signIn: { limit: 5, windowSeconds: 900 },
  signUp: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 3, windowSeconds: 3600 },
  verificationResend: { limit: 3, windowSeconds: 3600 },
  checkout: { limit: 10, windowSeconds: 60 },
  orderLookup: { limit: 10, windowSeconds: 3600 },
  dsar: { limit: 3, windowSeconds: 86400 },
  consent: { limit: 20, windowSeconds: 3600 },
  cartMutate: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + policy.windowSeconds * 1000 });
    return { allowed: true, remaining: policy.limit - 1 };
  }
  bucket.count += 1;
  return { allowed: bucket.count <= policy.limit, remaining: Math.max(0, policy.limit - bucket.count) };
}

async function upstashLimit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const window = Math.floor(Date.now() / 1000 / policy.windowSeconds);
  const redisKey = `ratelimit:${key}:${window}`;
  try {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, policy.windowSeconds],
      ]),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const result = (await response.json()) as Array<{ result: number }>;
    const count = result[0]?.result ?? 0;
    return { allowed: count <= policy.limit, remaining: Math.max(0, policy.limit - count) };
  } catch {
    return null;
  }
}

export async function rateLimit(name: RateLimitPolicyName, identifier: string): Promise<RateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[name];
  const upstash = await upstashLimit(`${name}:${identifier}`, policy);
  if (upstash) return upstash;
  return memoryLimit(`${name}:${identifier}`, policy);
}
