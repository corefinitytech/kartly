import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { recordConsent } from "@/modules/privacy/service";
import {
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_COOKIE_NAME,
  serializeConsentCookie,
} from "@/lib/consent-cookie";
import { rateLimit } from "@/lib/ratelimit";

const bodySchema = z.object({
  categories: z.object({
    necessary: z.literal(true),
    functional: z.boolean(),
    analytics: z.boolean(),
    marketing: z.boolean(),
  }),
  anonId: z.string().uuid(),
  source: z.enum(["banner", "customize", "footer_link", "privacy_center"]).default("banner"),
  policyVersion: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit("consent", ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
      { status: 429 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Invalid consent request." } },
      { status: 422 },
    );
  }

  try {
    await recordConsent({
      anonId: parsed.anonId,
      categories: parsed.categories,
      source: parsed.source,
      policyVersion: parsed.policyVersion,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Could not save the decision. Please try again." } },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ data: { saved: true } });
  response.cookies.set(CONSENT_COOKIE_NAME, serializeConsentCookie({ categories: parsed.categories }, parsed.anonId), {
    maxAge: CONSENT_COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
