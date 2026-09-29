import { db } from "@/lib/db";
import { consents } from "@/db/schema/identity";
import { CURRENT_CONSENT_POLICY_VERSION, type ConsentCategory } from "@/lib/consent";

export interface ConsentInput {
  anonId: string;
  categories: Record<ConsentCategory, boolean>;
  source: string;
  policyVersion?: string;
}

export async function recordConsent(input: ConsentInput): Promise<void> {
  const policyVersion = input.policyVersion ?? CURRENT_CONSENT_POLICY_VERSION;
  await db.insert(consents).values(
    (Object.entries(input.categories) as [ConsentCategory, boolean][]).map(([category, granted]) => ({
      anonId: input.anonId,
      category,
      granted: category === "necessary" ? true : granted,
      policyVersion,
      source: input.source,
    })),
  );
}
