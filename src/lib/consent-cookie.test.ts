import { describe, expect, it } from "vitest";
import {
  CONSENT_COOKIE_NAME,
  isCompleteConsent,
  parseConsentCookie,
  serializeConsentCookie,
} from "./consent-cookie";
import { CURRENT_CONSENT_POLICY_VERSION } from "./consent";

const decision = {
  categories: { necessary: true, functional: false, analytics: true, marketing: false },
};

describe("consent cookie", () => {
  it("round trips a decision", () => {
    const serialized = serializeConsentCookie(decision, "11111111-1111-4111-8111-111111111111");
    const parsed = parseConsentCookie(serialized);
    expect(parsed?.categories.analytics).toBe(true);
    expect(parsed?.categories.marketing).toBe(false);
    expect(parsed?.policyVersion).toBe(CURRENT_CONSENT_POLICY_VERSION);
  });

  it("rejects invalid payloads", () => {
    expect(parseConsentCookie(undefined)).toBeNull();
    expect(parseConsentCookie("not json")).toBeNull();
    expect(
      parseConsentCookie(
        JSON.stringify({ categories: { necessary: false, functional: true, analytics: false, marketing: false }, policyVersion: "x", anonId: "nope" }),
      ),
    ).toBeNull();
  });

  it("flags stale policy versions", () => {
    const stale = JSON.stringify({
      categories: decision.categories,
      policyVersion: "2000-01-01.0",
      anonId: "11111111-1111-4111-8111-111111111111",
    });
    expect(isCompleteConsent(parseConsentCookie(stale)!)).toBe(false);
  });

  it("uses the documented cookie name", () => {
    expect(CONSENT_COOKIE_NAME).toBe("kt_consent");
  });
});
