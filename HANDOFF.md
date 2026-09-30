# HANDOFF — Kartly, M0–M5 complete, next is M6 (GDPR privacy centre)

Written 2026-09-30 for the next agent (Claude Code or otherwise). Read `docs/PRD.md` (single source of truth), `AGENTS.md`, `docs/DESIGN.md` and `CHANGELOG.md` before any work.

## Read-first order

1. `docs/PRD.md` — the PRD (was renamed from `docs/pr.md`; all references updated)
2. `AGENTS.md` — conventions, commands, env rules
3. `docs/DESIGN.md` — design system (all UI work must follow it)
4. `docs/adr/` — ADRs 0001–0004 (stack, static CSP, auth, payment flow)
5. `CHANGELOG.md` — what each milestone changed, file lists
6. `docs/ASSUMPTIONS.md` — 75 recorded assumptions (M5 is #53–69, speed fixes #70–75); add new ones there

## Hard rules (from the PRD and task briefs)

- Never read, print or edit `.env`. Only `.env.example` may be edited.
- Money is integer cents, never floats. Never trust the client for prices/stock/totals.
- Catalog routes (home, category, product, legal) MUST stay statically generated — no cookies/headers/session in the root layout or catalog pages. All cart/session state reaches the browser client-side after hydration.
- Business logic lives in `services/`, never in components or routes. Zod validates every route input.
- No PII in logs. Errors use the shared AppError shape (`src/lib/errors.ts`, `errorResponse` in `src/app/api/cart/_shared.ts`).
- Audit entries via `writeAudit` (ids/actions only) for meaningful events.

## Milestone status

| Milestone | Status | Notes |
|---|---|---|
| M0 foundation | done | tokens, schema, utilities, CI, governance docs |
| M1 browse + polish | done | catalog/search, SEO layer, consent, design pass |
| M2 cart + pricing | done | pricing engine (tested), guest cart, cart UI |
| M3 accounts | done | Better Auth, addresses, cart merge |
| M4 checkout | done | Stripe, orders, webhook, expiry cron |
| M5 minimal admin | done | `/admin`: orders (fulfil, cancel, refund), products, inventory, audit viewer, roles |
| M6 GDPR privacy centre | **next** | |

## Commands

`npm run dev/build/lint/typecheck/test`, `npm run db:generate` (`--custom` for hand-written SQL), `db:migrate`, `db:seed` (DummyJSON catalog), `db:seed:settings` (shipping/tax/settings demo rows). Vercel deploy is live; repo pushed to `https://github.com/corefinitytech/kartly` (branch `main`). Install new deps with `--legacy-peer-deps` (better-auth's optional SvelteKit peer conflicts with vitest's vite).

## Environment

Required in `.env`/Vercel: `DATABASE_URL` (Neon direct for migrations; **pooled** `-pooler` URL as `DATABASE_URL` on Vercel, add `&channel_binding=disable` if it refuses), `PII_ENC_KEY` (base64 32 bytes), `IP_HASH_SALT`, `CRON_SECRET`, `BETTER_AUTH_SECRET`, `APP_URL` (falls back to `VERCEL_URL`). Optional until needed: `STRIPE_*`, `RESEND_*`, `UPSTASH_*`. CI provides dummy values.

## Migrations

`drizzle/0000…0005`. **0003 (auth tables), 0004 (checkout/orders) and 0005 (admin: shipments, refunds, ledger note, unique slug, stock check, audit trigger) are hand-written `--custom` migrations** and the drizzle snapshot is NOT realigned — if you run `drizzle-kit generate` it may emit spurious diffs for the auth/order tables. Review generated SQL before applying, or keep using `--custom`. 0000–0002 applied to Neon; confirm 0003–0005 applied (`npm run db:migrate`). `db:seed` and `db:seed:settings` are idempotent.

## Architecture map

- `src/app/` — routes only. Static catalog: `page.tsx`, `c/[slug]`, `p/[slug]` (generateStaticParams + revalidate 3600, cached service reads with `catalog` tag). Dynamic: `/search`, `/cart`, `/account/*`, `/checkout/*`, `/orders/*`, `/signup|login|forgot-password|reset-password|verify-email`, all `/api/*`.
- `src/middleware.ts` — nonce CSP only on dynamic routes (matcher list); Stripe sources allowed **only** on `/checkout*`. Static routes get a fixed CSP from `next.config.ts` (`'unsafe-eval'` added in dev only).
- `src/modules/{catalog,search,cart,checkout,orders,payments,auth,addresses,privacy}` — service/repo/schemas layering (checkout/orders fold repo queries into the service for M4 lean-ness; noted in ASSUMPTIONS #50).
- `src/lib/` — env (fail-fast Zod), db, auth (Better Auth config), auth-client, mailer (never throws), stripe, money, crypto (AES-256-GCM PII), audit, errors, consent(-cookie), ratelimit (Upstash + memory fallback, named policies incl. `cartMutate`, `signIn`), seo.
- Client stores: `components/cart/cart-store.tsx` (optimistic cart, sequence guard, ARIA), `components/consent-provider.tsx` (client cookie read — keeps catalog static).

## Known issues just fixed (uncommitted work in the tree)

1. `POST /api/cart/items` 500 — fixed: untyped `least(...)` params coerced to text; `src/modules/cart/repo.ts` now casts `::int` in the upsert and setQuantity. Typecheck green; **verify add-to-cart in the browser once dev is running**.
2. Category recursive CTE + price-bounds facet query SQL errors — fixed in `src/modules/catalog/repo.ts`.
3. Dev-mode CSP blocked react-refresh — fixed in `next.config.ts` (dev-only `'unsafe-eval'`).
4. Hydration warning `cz-shortcut-listen="true"` on `<body>` is the user's ColorZilla extension — not a bug; do not chase it.
5. Cart empty-state once showed an infinite skeleton — fixed (`loaded` flag in cart-store).
6. Perceived slowness is dev-mode compile-on-demand (13–30s first compile per route in the user's logs). Judge performance on the Vercel build. Category pagination already exists (24/page, hides under 24 items).

## Stripe (M4)

Order-first flow: `POST /api/checkout/place` (Idempotency-Key UUID header) creates the order + decrements stock transactionally, then the PaymentIntent; failure compensates. Paid ONLY via verified webhook `POST /api/webhooks/stripe` (dedup via `webhook_events`, amount/metadata/currency verified in `src/modules/payments/verify.ts`). `expireStaleOrders()` (30 min) runs on every place call + daily cron `/api/cron/expire-orders` (bearer CRON_SECRET; `vercel.json` has one entry). Guest order access: 32-byte token in URL fragment + sessionStorage, SHA-256 hash in `orders.access_token_hash`, sent via `x-order-token` header. Test cards: 4242… success, 4000 0000 0000 0002 decline.

## Admin (M5)

`/admin` (dynamic, nonce CSP) for roles `admin` and `support`. Grant a role with `npm run admin:role -- <email> admin`; the user must sign up first and sign in again after. Permissions are one pure matrix in `src/modules/admin/permissions.ts` (support: view and fulfil orders only; masked email). `requireStaffPage` / `requireStaffAction` in `src/modules/admin/guard.ts` enforce role, active status and the 12 hour admin session on every page and action; non-staff get a 404. Services: `products-service`, `inventory-service`, `orders-service`; reads in `repo.ts`; server actions in `actions.ts` echo typed values back on failure. Stock only changes through Inventory (ledger + row lock). Refunds need the Stripe webhook to also send `refund.created`, `refund.updated` and `refund.failed`. Image uploads need `BLOB_READ_WRITE_TOKEN` (Vercel Blob). Decisions: ASSUMPTIONS #53–69.

## M6 pointers (from PRD 9.3–9.5, FR-ADM-12)

Privacy Centre at `/account/privacy` (consent management, export ZIP via a 24h signed link, deletion with 7 day cool off per 9.4 exactly), step-up auth (FR-AUTH-09), retention cron jobs using `src/lib/retention.ts` (the audit_log trigger allows deleting rows older than 12 months), DSAR queue in admin (add a `privacy.manage` permission — admin only, support has no DSAR execution), policy-version re-prompt, abandoned cart purge, and completing the governance docs. `dsar_requests` needs a migration.

## Housekeeping

- `.agent-logs/` (gitignored) is the prompt/response capture fed by `scripts/agent-capture.mjs`, hooked for Claude Code (`.claude/settings.json`) and ZCode (`.zcode/config.json`). One file per session. Claude Code prompts and responses verified 2026-09-30. ZCode captured prompts only: its Stop event has no transcript, so every ZCode response entry is an empty marker.
- Keep `CHANGELOG.md` and `docs/ASSUMPTIONS.md` updated per task. Nothing since the initial `first commit` push has been committed — review `git status`, commit and push when the user asks.
