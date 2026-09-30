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
