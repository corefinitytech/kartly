"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Eligibility = { canReview: true; orderId: string } | { canReview: false; reason: "sign_in" | "not_delivered" | "already_reviewed" };
interface OwnReview {
  id: string;
  rating: number;
  title: string;
  body: string;
}
interface State {
  eligibility: Eligibility;
  review: OwnReview | null;
}

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

function StarPicker({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  return (
    <fieldset>
      <legend className="text-sm text-inkSoft">Your rating</legend>
      <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-invalid={error ? true : undefined}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded-btn p-1.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
            <input
              type="radio"
              name="rating"
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
              aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${STAR_LABELS[n]}`}
            />
            <Star strokeWidth={1.75} className={cn("h-7 w-7", n <= value ? "fill-star text-star" : "text-lineStrong")} aria-hidden="true" />
          </label>
        ))}
        <span className="ml-2 text-sm text-inkSoft" aria-live="polite">
          {value ? STAR_LABELS[value] : ""}
        </span>
      </div>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}

function ReviewForm({
  productId,
  existing,
  onDone,
  onCancel,
}: {
  productId: string;
  existing: OwnReview | null;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!rating) local.rating = "Choose a star rating.";
    if (title.trim().length < 3) local.title = "Give the review a short title.";
    if (body.trim().length < 10) local.body = "Write at least a sentence (10 characters).";
    setErrors(local);
    setMessage("");
    if (Object.keys(local).length > 0) return;
    setSaving(true);
    try {
      const response = await fetch(existing ? `/api/reviews/${existing.id}` : "/api/reviews", {
        method: existing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(existing ? { rating, title, body } : { productId, rating, title, body }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: { message: string; fieldErrors?: Record<string, string> } };
      if (!response.ok) {
        setErrors(json.error?.fieldErrors ?? {});
        setMessage(json.error?.message ?? "Could not save the review. Please try again.");
        return;
      }
      onDone(existing ? "Review updated." : "Thanks. Your review is live.");
    } catch {
      setMessage("Network problem. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <StarPicker value={rating} onChange={setRating} error={errors.rating} />
      <div>
        <label htmlFor="review-title" className="block text-sm text-inkSoft">
          Title
        </label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="mt-1"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "review-title-error" : undefined}
        />
        {errors.title ? (
          <p id="review-title-error" className="mt-1 text-sm text-danger">
            {errors.title}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="review-body" className="block text-sm text-inkSoft">
          Review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          rows={5}
          className="mt-1 w-full rounded-btn border border-lineStrong bg-surface px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? "review-body-error" : "review-body-hint"}
        />
        {errors.body ? (
          <p id="review-body-error" className="mt-1 text-sm text-danger">
            {errors.body}
          </p>
        ) : (
          <p id="review-body-hint" className="mt-1 text-sm text-inkMuted">
            Shown with your first name and last initial.
          </p>
        )}
      </div>
      {message ? (
        <p role="alert" className="rounded-badge bg-dangerTint px-3 py-2 text-sm text-danger">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? "Saving" : existing ? "Save review" : "Post review"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="tertiary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** Loads after hydration so the product page itself stays static. */
export function ReviewComposer({ productId, productSlug }: { productId: string; productSlug: string }) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setFailed(false);
    try {
      const response = await fetch(`/api/reviews?productId=${productId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const json = (await response.json()) as { data: State };
      setState(json.data);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const done = async (message: string) => {
    setNotice(message);
    setEditing(false);
    setConfirmDelete(false);
    await load();
    router.refresh(); // pick up the regenerated static page with the new review
  };

  const remove = async () => {
    if (!state?.review) return;
    setBusy(true);
    const response = await fetch(`/api/reviews/${state.review.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setNotice("Could not delete the review. Please try again.");
      return;
    }
    await done("Review deleted.");
  };

  const box = "rounded-card border border-line bg-surface p-4";

  if (failed) {
    return (
      <div className={box}>
        <p className="text-sm text-inkSoft">Could not check whether you can review this product.</p>
        <Button variant="text" size="sm" onClick={() => void load()} className="mt-1">
          Try again
        </Button>
      </div>
    );
  }
  if (!state) {
    return (
      <div className={box} aria-busy="true" aria-label="Loading review options">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-full" />
      </div>
    );
  }

  const noticeLine = notice ? (
    <p role="status" className="anim-fade-in mb-3 rounded-badge bg-brandTint px-3 py-2 text-sm text-ink">
      {notice}
    </p>
  ) : null;

  if (state.review) {
    return (
      <div className={box}>
        {noticeLine}
        <h3 className="text-base font-semibold">Your review</h3>
        {editing ? (
          <div className="mt-3">
            <ReviewForm productId={productId} existing={state.review} onDone={done} onCancel={() => setEditing(false)} />
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-inkSoft">
              {state.review.rating} of 5 stars · {state.review.title}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="tertiary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
              {confirmDelete ? (
                <span role="group" aria-label="Delete your review?" className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">Delete your review?</span>
                  <Button variant="tertiary" size="sm" className="border-danger text-danger" onClick={() => void remove()} disabled={busy} autoFocus>
                    {busy ? "Deleting" : "Delete"}
                  </Button>
                  <Button variant="text" size="sm" onClick={() => setConfirmDelete(false)} disabled={busy}>
                    Keep it
                  </Button>
                </span>
              ) : (
                <Button variant="tertiary" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  const e = state.eligibility;
  if (!e.canReview) {
    return (
      <div className={box}>
        {noticeLine}
        <h3 className="text-base font-semibold">Review this product</h3>
        {e.reason === "sign_in" ? (
          <p className="mt-1 text-sm text-inkSoft">
            <a href={`/login?next=${encodeURIComponent(`/p/${productSlug}#reviews`)}`} className="text-brandLink underline underline-offset-4">
              Sign in
            </a>{" "}
            to review a product you bought.
          </p>
        ) : (
          <p className="mt-1 text-sm text-inkSoft">You can review this once your order with it is delivered.</p>
        )}
      </div>
    );
  }

  return (
    <div className={box}>
      {noticeLine}
      <h3 className="text-base font-semibold">Review this product</h3>
      <p className="mb-3 mt-1 text-sm text-inkSoft">You bought this. Tell other shoppers what you think.</p>
      <ReviewForm productId={productId} existing={null} onDone={done} />
    </div>
  );
}
