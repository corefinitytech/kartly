import type { NextRequest } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { rateLimit, type RateLimitPolicyName } from "@/lib/ratelimit";
import { writeAudit } from "@/lib/audit";

export const { GET } = toNextJsHandler(auth.handler);

interface RoutePolicy {
  policy: RateLimitPolicyName;
  includeEmail?: boolean;
}

const ROUTE_POLICIES: Record<string, RoutePolicy> = {
  "/api/auth/sign-in/email": { policy: "signIn", includeEmail: true },
  "/api/auth/sign-up/email": { policy: "signUp" },
  "/api/auth/forget-password": { policy: "passwordReset" },
  "/api/auth/send-verification-email": { policy: "verificationResend" },
};

export async function POST(request: NextRequest) {
  const path = new URL(request.url).pathname;
  const routePolicy = ROUTE_POLICIES[path];

  if (routePolicy) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    let email = "";
    if (routePolicy.includeEmail) {
      try {
        const body = (await request.clone().json()) as { email?: string };
        email = body.email?.toLowerCase() ?? "";
      } catch {
        email = "";
      }
    }
    const key = [routePolicy.policy, email, ip].join(":");
    const limit = await rateLimit(routePolicy.policy, key);
    if (!limit.allowed) {
      const response = Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait and try again." } },
        { status: 429 },
      );
      response.headers.set("Retry-After", "60");
      return response;
    }
  }

  const response = await auth.handler(request);

  if (path === "/api/auth/sign-in/email" && response.status === 401) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    await writeAudit({
      actorId: null,
      actorRole: null,
      action: "auth.sign_in_failed",
      entityType: "session",
      entityId: "anonymous",
      ip,
    }).catch(() => undefined);
  }

  return response;
}
