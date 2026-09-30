// Review rules (PRD 5.10, FR-REV-01/02/05). Pure and unit tested.
import { z } from "zod";

export const reviewInputSchema = z.object({
  rating: z.coerce
    .number({ invalid_type_error: "Choose a star rating." })
    .int("Choose a star rating.")
    .min(1, "Choose a star rating.")
    .max(5, "Choose a star rating."),
  title: z.string().trim().min(3, "Give the review a short title.").max(120, "Keep the title under 120 characters."),
  body: z.string().trim().min(10, "Write at least a sentence (10 characters).").max(4000, "Keep the review under 4000 characters."),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const createReviewSchema = reviewInputSchema.extend({ productId: z.string().uuid() });

/** "Sam Keller" -> "Sam K.", "Prince" -> "Prince". Only this ever leaves the server (FR-REV-05). */
export function reviewerDisplayName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Verified buyer";
  const first = parts[0]!.slice(0, 40);
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  const initial = last ? `${Array.from(last)[0]!.toUpperCase()}.` : "";
  return initial ? `${first} ${initial}` : first;
}

export type ReviewEligibility =
  | { canReview: true; orderId: string }
  | { canReview: false; reason: "sign_in" | "not_delivered" | "already_reviewed" };

/** Verified buyers only: a delivered order with the product, and one review per product. */
export function decideEligibility(input: {
  signedIn: boolean;
  deliveredOrderId: string | null;
  hasReview: boolean;
}): ReviewEligibility {
  if (!input.signedIn) return { canReview: false, reason: "sign_in" };
  if (input.hasReview) return { canReview: false, reason: "already_reviewed" };
  if (!input.deliveredOrderId) return { canReview: false, reason: "not_delivered" };
  return { canReview: true, orderId: input.deliveredOrderId };
}

export interface RatingSummary {
  count: number;
  /** Mean of visible ratings, 2 decimals (same rounding as the database trigger). */
  average: number;
  /** Index 0 is 5 stars, index 4 is 1 star. */
  distribution: { stars: number; count: number; percent: number }[];
}

/** Counts per star (1-5) into the summary shown on product pages. Percents are whole and sum to 100. */
export function summarizeRatings(countsByStar: Partial<Record<number, number>>): RatingSummary {
  const stars = [5, 4, 3, 2, 1];
  const counts = stars.map((s) => Math.max(0, Math.floor(countsByStar[s] ?? 0)));
  const count = counts.reduce((a, b) => a + b, 0);
  if (count === 0) {
    return { count: 0, average: 0, distribution: stars.map((s) => ({ stars: s, count: 0, percent: 0 })) };
  }
  const total = stars.reduce((sum, s, i) => sum + s * counts[i]!, 0);
  const average = Math.round((total / count) * 100) / 100;
  // Largest remainder so the bars add up to exactly 100%.
  const raw = counts.map((c) => (c * 100) / count);
  const percents = raw.map(Math.floor);
  let left = 100 - percents.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0; k++, left--) percents[order[k % order.length]!.i]! += 1;
  return { count, average, distribution: stars.map((s, i) => ({ stars: s, count: counts[i]!, percent: percents[i]! })) };
}
