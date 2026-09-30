import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  CART_COOKIE_MAX_AGE,
  CART_COOKIE_NAME,
  hashCartToken,
  newCartToken,
  type Owner,
} from "@/modules/cart/identity";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getSession } from "@/modules/auth/session";

export interface OwnerContext {
  owner: Owner;
  token: string;
  isNewGuest: boolean;
}

export async function resolveOwner(): Promise<OwnerContext> {
  const session = await getSession();
  if (session) {
    return { owner: { kind: "user", userId: session.user.id }, token: "", isNewGuest: false };
  }
  const store = await cookies();
  const token = store.get(CART_COOKIE_NAME)?.value;
  if (token && /^[A-Za-z0-9_-]+$/.test(token)) {
    return { owner: { kind: "guest", tokenHash: hashCartToken(token) }, token, isNewGuest: false };
  }
  const token2 = newCartToken();
  return { owner: { kind: "guest", tokenHash: hashCartToken(token2) }, token: token2, isNewGuest: true };
}

export async function saveCartCookie(context: OwnerContext): Promise<void> {
  if (!context.token) return;
  const store = await cookies();
  store.set(CART_COOKIE_NAME, context.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CART_COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  // Unexpected: log the type and message (no request data, so no PII) so 500s are diagnosable.
  logger.error(
    { err: error instanceof Error ? `${error.name}: ${error.message.slice(0, 300)}` : "non-error thrown" },
    "unhandled API error",
  );
  return Response.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

export async function limitMutations(request: NextRequest): Promise<Response | null> {
  const { rateLimit } = await import("@/lib/ratelimit");
  const limit = await rateLimit("cartMutate", clientIp(request));
  if (!limit.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many changes. Please slow down." } },
      { status: 429 },
    );
  }
  return null;
}
