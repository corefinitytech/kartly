# Assumptions

Decisions taken under ambiguity, per PRD Section 0 rule 7. Each is the smallest reasonable interpretation.

1. **PRD location:** the PRD is `docs/PRD.md` (the repo had no `docs/PRD.md`). Treated as the single source of truth; not renamed to avoid breaking existing references.
2. **shadcn/ui:** installed as hand-written shadcn-style components (`class-variance-authority` + `tailwind-merge` + lucide icons) rather than via the shadcn CLI, which requires an initialized app and interactive setup. Visual/API conventions match shadcn.
3. **Auth tables:** Better Auth (with Auth.js v5 fallback) is an M3 decision (`VERIFY` in the PRD). M0 defines `users`, `sessions`, `accounts` to match the PRD Section 7 column lists; they will be reconciled with the chosen library's expected schema in M3 via migration.
4. **IDs:** D-15 prefers UUIDv7. Drizzle's `defaultRandom()` emits UUIDv4 (Postgres `gen_random_uuid()`); no Postgres UUIDv7 generator is bundled. UUIDv4 satisfies "never sequential integers"; switch to v7 in a later milestone if needed.
5. **`search_vector`:** stored as a `tsvector` column with a GIN index; `pg_trgm` is installed by the migration itself (prepended `CREATE EXTENSION IF NOT EXISTS pg_trgm`, since drizzle-kit cannot manage extensions). The `to_tsvector` generation over title/brand/description is applied in the M1 migration.
6. **Fonts:** "self hosted fonts only" (FR-GDPR-07) is satisfied with a system font stack — zero font requests, zero third parties.
7. **Cart count:** header cart count is a placeholder (0) until the cart module lands in M2.
8. **Seed ratings:** DummyJSON `rating` is imported as `rating_avg` with a derived count; both are synthetic and clearly marked in `scripts/seed.ts`, to be recomputed from real reviews in M7.
9. **Legal pages:** footer links point at `/legal/*`, `/cookie-settings`, `/account/privacy` which do not exist until M1/M6 (links only, per FR-LEG M1 row).
10. **Indexes:** Section 7 indexes referencing tables outside the M0 set (`voucher_redemptions`, `notifications`) are deferred to the milestone that creates those tables.
11. **CSP:** nonce-based CSP is set in middleware (edge). `style-src 'unsafe-inline'` is required by Next.js styled-jsx/Tailwind runtime; everything else is `self`.
12. **CI env:** CI uses dummy env values (including a zero-filled 32-byte `PII_ENC_KEY`) purely so env validation passes during lint/typecheck/test/build; no real secrets in CI.
13. **`idempotency_keys` shape:** Section 7 lists the table without columns; modeled with key, scope, request hash and cached response body per D-06.

## M1

14. **Rendering:** the root layout reads the consent cookie server side (so the banner does not flash), which makes all pages dynamically rendered. The `revalidate` exports on catalog pages document intended ISR and take effect if the cookie read moves to a leaf. Catalog data is served fast enough for the p95 target either way.
15. **Listing variant:** each product lists its lowest priced variant; in-stock filtering uses the summed stock of all variants. Seed data has exactly one variant per product, so this is equivalent today.
16. **Search scope:** `websearch_to_tsquery('english', q)` over the generated `search_vector` (title A, brand B, description C per the brief; categories are matched via the category filter, not the vector). Trigram fallback threshold 0.3 on title.
17. **Typeahead is the stretch item and is included** (debounced 200ms, keyboard navigable, 60/min rate limit via `src/lib/ratelimit.ts`, in-memory fallback when Upstash env vars are absent).
18. **Consent cookie** `kt_consent` is not HttpOnly so client script can read the state for gating; it contains no PII beyond a random `anon_id`. Written by both the API (Set-Cookie) and directly by the client for instant effect.
19. **`kt_consent` duration is 180 days** (per brief), differing from the 12-month placeholder in the earlier M0 cookie draft; docs/cookies.md updated.
20. **Legal pages** live at `/privacy`, `/cookies`, `/terms`, `/returns`, `/contact`, `/faq` (flat paths, footer links updated accordingly).
21. **Accent buttons:** the disabled Add to cart button uses accent at reduced opacity (60%) with the label "Cart opens soon", since a fully-styled accent button communicates the intended M2 design better than a grey one.
22. **No new dependencies were added**; fonts ship via `next/font/google` (self hosted at build) and lucide-react was already present.

## M1 polish pass

23. **Structured data omits aggregateRating** deliberately: seed ratings are synthetic and publishing them would break search engine guidelines (recorded per brief).
24. **Category display names** are derived from slugs (`category-names.ts`); the DB `name` column is no longer trusted for display.
25. **Static CSP tradeoff:** catalog/legal routes use a fixed CSP with `'unsafe-inline'` scripts instead of a nonce, because those pages are statically generated and render no user supplied HTML. Full reasoning in `docs/adr/0002-static-csp-catalog.md`.
26. **The consent cookie read moved to the client** to keep catalog routes static; the banner renders only after mount, so static HTML ships without it and nothing flashes for returning visitors (one frame of banner on first paint for new visitors is the accepted cost).
27. **The mobile category strip fade** uses a CSS mask (not a painted gradient), keeping the no-gradients rule.
28. **og:type on product pages stays `website`**; the price is exposed via metadata `other` (`product:price:amount`/`currency`) because Next has no first-class Open Graph `product` type and renders `other` as name-based meta tags.
29. **The typeahead dropdown stays in the initial bundle** (tiny, conditionally rendered, and its data loads on demand); the cookie dialog and filter sheet use `next/dynamic`.
30. **Cart and account placeholder pages** use a text link as the home action because the shared EmptyState action requires a client callback; the pages are noindex and will be replaced.
31. **generateStaticParams for products covers the first 200 slugs** with `dynamicParams = true` so the rest render (and cache) on demand.

## M2

32. **Cart token is hashed, not signed** (brief allows either): the cookie holds a random 32-byte token, the database stores only its SHA256 hash. A stolen database cannot be used to hijack carts.
33. **Tax rates and shipping methods are clearly labelled demo data**; the estimate country defaults to US (settings row) and unknown countries price tax at zero.
34. **The estimate always uses the cheapest active shipping method** (Standard) since checkout does not exist yet; the cart page shows the method name so the number is not mysterious.
35. **Per-line tax excludes the tax on shipping**: line taxes are an exact largest-remainder allocation of the goods tax, so refund math stays correct; shipping tax is kept only in the summary total.
36. **PATCH /api/cart/items/[id] treats quantity 0 as a delete** and `[id]` is the variant UUID; there is no separate line id in the UI.
37. **The mini cart subtotal comes from the store's most recent view** (refreshed right after the add), falling back to the added item's price on a race.
38. **`kt_cart` is set only on the first successful add** (strictly necessary, HttpOnly, 30 days sliding); plain page views and GETs never set it.

## M3

39. **Schema reconciliation:** Better Auth's expected columns replace `users.password_hash` and `users.email_verified_at` (credential hash now lives in `accounts.password`; verification is the boolean `email_verified`). Our listed columns (role, status, phone_enc, locale, referral_code, age_confirmed_at) are kept. Sessions store the library's `token` column; the library hashes tokens itself, and our hook replaces the stored `ip_address` with a salted SHA-256 hash so no raw IP is kept.
40. **Cart merge trigger:** Better Auth hooks do not expose the guest cookie, so the merge runs server-side inside the sign-in/sign-up server actions (reading `kt_cart` from the request cookies), with `POST /api/cart/merge` as a fallback.
41. **Password reset revokes sessions** through Better Auth's default reset behaviour (single-use token, 1 hour); `revokeSessions` is not an explicit body option in this version.
42. **Timing-safe sign-in:** unknown emails verify a dummy argon2id hash before returning the same generic error, on top of the library's own handling.
43. **Emails carry only the first name and a link.** Send failures never fail the flow; the mailer logs the subject only, no PII.
44. **`kt_cart_merged` notice** is delivered by reading the merge result directly in the sign-in action redirect; no extra cookie is used.
45. **Snapshot divergence:** migration 0003 is hand-written (`--custom`); future drizzle generates may re-diff the auth tables until the snapshot is realigned, so review generated SQL for auth tables before applying.

## M4

46. **No separate billing address form:** Stripe Elements collects billing details; the shipping address is the only address captured (per the cut list).
47. **Demo tax rates** are used at checkout exactly as in the cart estimate; the checkout notes this in the summary.
48. **Lazy expiry** (30 minutes) runs bounded to 20 orders on every place call plus one daily cron (`vercel.json`), not a frequent scheduler.
49. **Guest token** lives in the URL fragment of the success link and in `sessionStorage`; the guest confirmation email links to the success page rather than embedding the token (the database stores only its hash, so the token cannot be recovered for the email).
50. **Repo layer folded into the checkout/orders service modules** for this lean milestone; queries remain owner-scoped and the layering rule is not broken for future modules.
51. **Stripe secret/webhook keys stay optional in env validation** so the site builds without them; the place route returns a friendly error when Stripe is unconfigured. The publishable key is read client-side from `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
52. **The mini cart and cart page Checkout buttons** link straight to `/checkout` (the quote page redirects back when the cart is empty).

## M5

53. **Support permissions:** support can view orders and move them through processing, shipped and delivered (with tracking). Cancelling and refunding move money, so they are admin only, as are products, inventory and the audit log. The PRD lists support as "orders, masked customers, returns"; refund approval for returns (M8) can be granted to support then.
54. **Masked PII for support:** support sees `j•••@e•••.com` and the city and country of the shipping address only. Admins see the full contact email and address.
55. **12 hour admin session** (FR-AUTH-03) is enforced by the admin guard from the session's `created_at`, not by a separate cookie. A staff session older than 12 hours is deleted server-side on its next admin request and the user is sent to sign in. The storefront session length is unchanged.
56. **Non-staff get a 404 at `/admin`**, not a 403, so the area is not advertised (same idea as AC-6).
57. **Refund status rule:** order status tracks fulfilment first. A partial refund before delivery is recorded (refund row and timeline note) without changing the status; use Cancel for a full refund of an unshipped order. After delivery the order moves to `partially_refunded`, then `refunded`. The PRD's "paid onward -> partially_refunded" is narrowed this way so a partly refunded order can still ship.
58. **Shipped orders cannot be cancelled** (the state machine has no shipped -> cancelled). Money for a shipped order goes back through Refund; returns arrive in M8.
59. **Refund safety:** the refund row is reserved under a `for update` lock on the order before calling Stripe, so two admins cannot over-refund. It is sent with the idempotency key `refund-<id>` and marked failed if Stripe rejects it. `refund.created`, `refund.updated` and `refund.failed` webhooks update the row (matched by Stripe id or our `refund_id` metadata) and record refunds issued in the Stripe dashboard; those do not change the order status. **Enable these three events on the Stripe webhook endpoint.**
60. **Stock changes only through Inventory:** the product editor never writes `stock_qty`, so it cannot overwrite a concurrent checkout decrement. New variants start at 0. Adjustments lock the variant row and write `inventory_ledger` (reason `adjust`, with the chosen reason and note in the new `note` column) in the same transaction. A `stock_qty >= 0` check constraint backs this in the database.
61. **No hard delete of ordered products:** order history joins through variants, so products and variants that were ever ordered can only be unpublished. Never-ordered ones can be deleted, with their cart lines and uploaded images.
62. **Unpublished means `draft`:** `products.status` is `active` (live) or `draft`. The storefront already shows only `active`, and carts already flag non-active lines as unavailable.
63. **Product slugs are now unique** (index added in 0005; seed slugs are `title-id`, already unique). Slug edits break old links; there are no redirects.
64. **Image uploads use Vercel Blob** (listed in PRD Section 3, so no ADR). The type is sniffed from the file bytes (JPEG, PNG, WebP only; no SVG), max 2 MB, with random 128-bit names. Without `BLOB_READ_WRITE_TOKEN` uploads are disabled with a message; existing seed images can still be reordered, described and removed. The server action body limit is raised to 3 MB for this.
65. **Catalog cache after edits:** every product, variant, image or stock change calls `revalidateTag("catalog")` and `revalidatePath("/", "layout")`, so static catalog pages rebuild on the next request.
66. **Audit log is append only in the database:** a trigger blocks every UPDATE and blocks DELETE of rows younger than 12 months, leaving room for the M6 retention job. The viewer shows staff names only; customer actors show as role and id.
67. **Admin order search is by order number only.** Contact emails are encrypted with a random IV, so they cannot be searched without a blind index; that is left for the M8 customer search.
68. **Roles are granted from the CLI** (`npm run admin:role -- <email> <role>`) until the M8 customer admin exists. It revokes the user's sessions so the new role applies at next sign in, and writes an audit entry with actor role `cli`.
69. **Snapshot divergence continues:** migration 0005 is hand-written (`--custom`); the drizzle snapshot is still not realigned (see #45).
70. **Session cookie cache (5 minutes)** on the storefront saves a database round trip per request. Trade-off: a session revoked elsewhere (sign out, password reset) keeps working on the storefront for up to 5 minutes. The admin guard passes `disableCookieCache`, so staff access ends immediately.
71. **Prepared statements everywhere:** Drizzle's raw queries are sent as named prepared statements (postgres.js `unsafe` default flipped). Neon's pooler supports protocol-level prepared statements; if a pooler ever rejects them, remove `preferPrepared` in `src/lib/db.ts`.
72. **Stale order expiry runs in the background** of place-order instead of before it; the daily cron still guarantees cleanup.
73. **Vercel region `cle1`** (Cleveland) is pinned because Neon is in us-east-2 (Ohio). If the database moves, move the region with it.
74. **Demo admin password `Test1@3` is below the 10 character signup rule** by the owner's choice. It is created by `npm run db:seed:admin` (sign-in does not re-check length). The admin sign-in form is prefilled only in development, or when `DEMO_ADMIN_PREFILL=true` is set.
75. **Local payments need `stripe listen`:** orders become paid only through the verified webhook (D-05), which cannot reach localhost. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and start the dev server with the printed `whsec_` as `STRIPE_WEBHOOK_SECRET`; otherwise the success page shows "taking longer than usual".
