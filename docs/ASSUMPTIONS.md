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
