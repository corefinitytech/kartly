import { MessageSquareOff } from "lucide-react";
import { RatingStars } from "@/components/rating-stars";
import type { ProductReviews } from "@/modules/reviews/service";
import { ReviewComposer } from "./review-composer";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * Static-safe: renders cached public data only. The composer, which needs the
 * shopper's session, loads in the browser after hydration.
 */
export function ReviewsSection({ productId, productSlug, data }: { productId: string; productSlug: string; data: ProductReviews }) {
  const { summary, reviews } = data;
  return (
    <section aria-labelledby="reviews" className="mt-10">
      <h2 id="reviews" className="text-xl font-semibold">
        Reviews
      </h2>
      <div className="mt-3 grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          {summary.count > 0 ? (
            <div className="rounded-card border border-line bg-surface p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{summary.average.toFixed(1)}</span>
                <span className="text-sm text-inkSoft">out of 5</span>
              </div>
              <RatingStars rating={summary.average} count={summary.count} className="mt-1" />
              <p className="mt-1 text-sm text-inkSoft">
                From {summary.count} verified {summary.count === 1 ? "buyer" : "buyers"}
              </p>
              <dl className="mt-3 space-y-1.5">
                {summary.distribution.map((d) => (
                  <div key={d.stars} className="flex items-center gap-2 text-sm">
                    <dt className="w-12 shrink-0 text-inkSoft">{d.stars} star</dt>
                    <dd className="flex flex-1 items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                        <span className="block h-full rounded-full bg-star" style={{ width: `${d.percent}%` }} />
                      </span>
                      <span className="w-10 text-right tabular-nums text-inkSoft">{d.percent}%</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <ReviewComposer productId={productId} productSlug={productSlug} />
        </div>

        {reviews.length === 0 ? (
          <div className="anim-fade-in flex flex-col items-start gap-2 rounded-card border border-line bg-surface px-6 py-10 text-left">
            <MessageSquareOff strokeWidth={1.75} className="h-6 w-6 text-inkMuted" aria-hidden="true" />
            <p className="text-lg font-semibold">No reviews yet</p>
            <p className="text-sm text-inkSoft">Customers can review once their order with this product is delivered.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {reviews.map((r) => (
              <li key={r.id} className="p-4">
                <RatingStars rating={r.rating} />
                <h3 className="mt-1 text-base font-semibold text-ink">{r.title}</h3>
                <p className="mt-0.5 text-sm text-inkMuted">
                  {r.author} · Verified buyer · {dateFormat.format(new Date(r.createdAt))}
                  {r.edited ? " · edited" : ""}
                </p>
                <p className="mt-2 whitespace-pre-line break-words text-base text-inkSoft">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
