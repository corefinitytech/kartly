import { describe, expect, it } from "vitest";
import { createReviewSchema, decideEligibility, reviewInputSchema, reviewerDisplayName, summarizeRatings } from "./rules";

describe("reviewerDisplayName (FR-REV-05)", () => {
  it("shows first name and last initial only", () => {
    expect(reviewerDisplayName("Sam Keller")).toBe("Sam K.");
    expect(reviewerDisplayName("  maria  de la  cruz ")).toBe("maria C.");
    expect(reviewerDisplayName("Prince")).toBe("Prince");
  });
  it("never leaks an empty or missing name", () => {
    expect(reviewerDisplayName("")).toBe("Verified buyer");
    expect(reviewerDisplayName(null)).toBe("Verified buyer");
  });
  it("handles non latin initials", () => {
    expect(reviewerDisplayName("Émile Øster")).toBe("Émile Ø.");
  });
});

describe("decideEligibility (FR-REV-01)", () => {
  it("requires sign in", () => {
    expect(decideEligibility({ signedIn: false, deliveredOrderId: "o1", hasReview: false })).toEqual({ canReview: false, reason: "sign_in" });
  });
  it("requires a delivered order with the product", () => {
    expect(decideEligibility({ signedIn: true, deliveredOrderId: null, hasReview: false })).toEqual({ canReview: false, reason: "not_delivered" });
  });
  it("allows one review per product", () => {
    expect(decideEligibility({ signedIn: true, deliveredOrderId: "o1", hasReview: true })).toEqual({ canReview: false, reason: "already_reviewed" });
    expect(decideEligibility({ signedIn: true, deliveredOrderId: "o1", hasReview: false })).toEqual({ canReview: true, orderId: "o1" });
  });
});

describe("review input", () => {
  it("accepts 1 to 5 stars with a title and body", () => {
    expect(reviewInputSchema.parse({ rating: "4", title: " Good ", body: "Works well for daily use." })).toEqual({
      rating: 4,
      title: "Good",
      body: "Works well for daily use.",
    });
  });
  it("rejects out of range ratings and thin text", () => {
    expect(reviewInputSchema.safeParse({ rating: 0, title: "Good", body: "Works well for me." }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 6, title: "Good", body: "Works well for me." }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 3.5, title: "Good", body: "Works well for me." }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 3, title: "Ok", body: "Works well for me." }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 3, title: "Good", body: "Meh" }).success).toBe(false);
  });
  it("requires a product id on create", () => {
    expect(createReviewSchema.safeParse({ rating: 5, title: "Great", body: "Exactly as described." }).success).toBe(false);
  });
});

describe("summarizeRatings (FR-REV-02)", () => {
  it("is empty with no reviews", () => {
    const s = summarizeRatings({});
    expect(s.count).toBe(0);
    expect(s.average).toBe(0);
    expect(s.distribution.every((d) => d.percent === 0)).toBe(true);
  });
  it("averages to 2 decimals like the database trigger", () => {
    const s = summarizeRatings({ 5: 2, 4: 1 });
    expect(s.count).toBe(3);
    expect(s.average).toBe(4.67);
    expect(s.distribution[0]).toEqual({ stars: 5, count: 2, percent: 67 });
    expect(s.distribution[1]).toEqual({ stars: 4, count: 1, percent: 33 });
  });
  it("keeps percents summing to 100 for awkward splits", () => {
    for (const counts of [{ 5: 1, 4: 1, 3: 1 }, { 5: 1, 1: 2 }, { 5: 7, 4: 3, 3: 1, 2: 1, 1: 1 }, { 2: 1 }]) {
      const s = summarizeRatings(counts);
      expect(s.distribution.reduce((a, d) => a + d.percent, 0)).toBe(100);
    }
  });
  it("updates correctly as reviews are added and removed", () => {
    expect(summarizeRatings({ 5: 1 }).average).toBe(5);
    expect(summarizeRatings({ 5: 1, 1: 1 }).average).toBe(3);
    expect(summarizeRatings({ 1: 1 }).average).toBe(1);
  });
});
