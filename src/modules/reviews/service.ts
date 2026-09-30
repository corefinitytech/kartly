import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/lib/audit";
import { toIso, type DbTimestamp } from "@/lib/dates";
import { decideEligibility, reviewerDisplayName, summarizeRatings, type RatingSummary, type ReviewEligibility, type ReviewInput } from "./rules";

export const REVIEWS_SHOWN = 20;

export interface PublicReview {
  id: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  edited: boolean;
}

export interface ProductReviews {
  summary: RatingSummary;
  reviews: PublicReview[];
}

/**
 * Public reviews for a static product page. Cached under the `catalog` tag and
 * refreshed by every review write. Only the display name leaves this function.
 */
export const getProductReviews = unstable_cache(
  async (productId: string): Promise<ProductReviews> => {
    const [counts, rows] = await Promise.all([
      db.execute<{ rating: number; n: number }>(sql`
        select rating, count(*)::int as n from reviews
        where product_id = ${productId} and status = 'visible' group by rating
      `),
      db.execute<{ id: string; rating: number; title: string; body: string; name: string | null; created_at: DbTimestamp; updated_at: DbTimestamp }>(sql`
        select r.id, r.rating, r.title, r.body, u.name, r.created_at, r.updated_at
        from reviews r join users u on u.id = r.user_id
        where r.product_id = ${productId} and r.status = 'visible'
        order by r.created_at desc
        limit ${REVIEWS_SHOWN}
      `),
    ]);
    return {
      summary: summarizeRatings(Object.fromEntries(counts.map((c) => [Number(c.rating), Number(c.n)]))),
      reviews: rows.map((r) => {
        const createdAt = toIso(r.created_at);
        const updatedAt = toIso(r.updated_at);
        return {
          id: r.id,
          rating: Number(r.rating),
          title: r.title,
          body: r.body,
          author: reviewerDisplayName(r.name),
          createdAt,
          edited: Date.parse(updatedAt) - Date.parse(createdAt) > 60_000,
        };
      }),
    };
  },
  ["product-reviews"],
  { revalidate: 300, tags: ["catalog"] },
);

export interface MyReviewState {
  eligibility: ReviewEligibility;
  review: { id: string; rating: number; title: string; body: string } | null;
}

/** For the client-side composer: can this user review, and their existing review. One round trip. */
export async function myReviewState(userId: string | null, productId: string): Promise<MyReviewState> {
  if (!userId) return { eligibility: decideEligibility({ signedIn: false, deliveredOrderId: null, hasReview: false }), review: null };
  const rows = await db.execute<{
    delivered_order_id: string | null;
    review_id: string | null;
    rating: number | null;
    title: string | null;
    body: string | null;
  }>(sql`
    select
      (select o.id from orders o
        join order_items oi on oi.order_id = o.id
        join product_variants v on v.id = oi.variant_id
        where o.user_id = ${userId} and v.product_id = ${productId}
          and exists (select 1 from order_events e where e.order_id = o.id and e.to_status = 'delivered')
        order by o.placed_at desc limit 1) as delivered_order_id,
      r.id as review_id, r.rating, r.title, r.body
    from (select 1) one
    left join reviews r on r.product_id = ${productId} and r.user_id = ${userId}
  `);
  const row = rows[0];
  const review = row?.review_id ? { id: row.review_id, rating: Number(row.rating), title: row.title ?? "", body: row.body ?? "" } : null;
  return {
    eligibility: decideEligibility({ signedIn: true, deliveredOrderId: row?.delivered_order_id ?? null, hasReview: Boolean(review) }),
    review,
  };
}

async function invalidate(productId: string): Promise<void> {
  revalidateTag("catalog");
  const rows = await db.execute<{ slug: string }>(sql`select slug from products where id = ${productId}`);
  if (rows[0]) revalidatePath(`/p/${rows[0].slug}`);
}

function audit(userId: string, action: string, reviewId: string, ip: string | null) {
  return writeAudit({ actorId: userId, actorRole: "customer", action, entityType: "review", entityId: reviewId, ip }).catch(() =>
    logger.error({ action }, "audit write failed"),
  );
}

/**
 * Post a review. Eligibility is re-checked here, never trusted from the client.
 * The rating aggregate on products is updated by a trigger in the same
 * transaction as the insert (FR-REV-02).
 */
export async function createReview(userId: string, productId: string, input: ReviewInput, ip: string | null): Promise<string> {
  const state = await myReviewState(userId, productId);
  if (!state.eligibility.canReview) {
    throw new AppError(
      state.eligibility.reason === "already_reviewed" ? "CONFLICT" : "FORBIDDEN",
      state.eligibility.reason === "already_reviewed"
        ? "You have already reviewed this product. Edit your review instead."
        : "Reviews are open to customers once their order with this product is delivered.",
    );
  }
  let id: string;
  try {
    const rows = await db.execute<{ id: string }>(sql`
      insert into reviews (product_id, user_id, order_id, rating, title, body)
      values (${productId}, ${userId}, ${state.eligibility.orderId}, ${input.rating}, ${input.title}, ${input.body})
      returning id
    `);
    id = rows[0]!.id;
  } catch (error) {
    if (error instanceof Error && error.message.includes("reviews_product_user_unique")) {
      throw new AppError("CONFLICT", "You have already reviewed this product. Edit your review instead.");
    }
    throw error;
  }
  await Promise.all([invalidate(productId), audit(userId, "review.created", id, ip)]);
  return id;
}

/** Author only: the user id is part of the WHERE clause. */
export async function updateReview(userId: string, reviewId: string, input: ReviewInput, ip: string | null): Promise<void> {
  const rows = await db.execute<{ product_id: string }>(sql`
    update reviews set rating = ${input.rating}, title = ${input.title}, body = ${input.body}, updated_at = now()
    where id = ${reviewId} and user_id = ${userId}
    returning product_id
  `);
  if (!rows[0]) throw new AppError("NOT_FOUND", "That review no longer exists.");
  await Promise.all([invalidate(rows[0].product_id), audit(userId, "review.updated", reviewId, ip)]);
}

export async function deleteReview(userId: string, reviewId: string, ip: string | null): Promise<void> {
  const rows = await db.execute<{ product_id: string }>(sql`
    delete from reviews where id = ${reviewId} and user_id = ${userId} returning product_id
  `);
  if (!rows[0]) throw new AppError("NOT_FOUND", "That review no longer exists.");
  await Promise.all([invalidate(rows[0].product_id), audit(userId, "review.deleted", reviewId, ip)]);
}
