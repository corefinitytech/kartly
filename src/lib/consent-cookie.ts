import { z } from "zod";
import { CURRENT_CONSENT_POLICY_VERSION, type ConsentCategory } from "./consent";

export const CONSENT_COOKIE_NAME = "kt_consent";
export const CONSENT_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;

export const consentCookieSchema = z.object({
  categories: z.object({
    necessary: z.literal(true),
    functional: z.boolean(),
    analytics: z.boolean(),
    marketing: z.boolean(),
  }),
  policyVersion: z.string(),
  anonId: z.string().uuid(),
});

export type ConsentCookie = z.infer<typeof consentCookieSchema>;

export interface ConsentDecision {
  categories: Record<ConsentCategory, boolean>;
}

export function serializeConsentCookie(decision: ConsentDecision, anonId: string): string {
  return JSON.stringify({
    categories: decision.categories,
    policyVersion: CURRENT_CONSENT_POLICY_VERSION,
    anonId,
  });
}

export function parseConsentCookie(value: string | undefined): ConsentCookie | null {
  if (!value) return null;
  try {
    return consentCookieSchema.parse(JSON.parse(decodeURIComponent(value)));
  } catch {
    return null;
  }
}

export function isCompleteConsent(cookie: ConsentCookie): boolean {
  return cookie.policyVersion === CURRENT_CONSENT_POLICY_VERSION;
}
