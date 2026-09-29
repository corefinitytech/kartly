export const CONSENT_CATEGORIES = ["necessary", "functional", "analytics", "marketing"] as const;

export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export const CURRENT_CONSENT_POLICY_VERSION = "2026-09-29.1";

export interface ConsentRecord {
  category: ConsentCategory;
  granted: boolean;
}
