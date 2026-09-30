# Kartly

Kartly is a single-vendor online store with a privacy-first design. It covers the core shopping loop: search and browse a catalog, add items to a guest cart, check out with Stripe (test mode), track orders, and run the store from an admin panel. Prices are in USD. GDPR applies to every shopper, wherever they are. The store shows full costs (shipping and tax) before payment, has no sponsored results and does not force account creation.

It was built as a one-day assessment. `docs/PRD.md` is the full specification, including the parts that are designed but not built.

- **Live site:** `<VERCEL_URL>`
- **Repository:** https://github.com/corefinitytech/kartly

## Test credentials

| What | Details |
|---|---|
| Admin | `admin@kartly.com` / `Test1@3` at `/admin`. Signing out and opening `/admin` sends you to the sign-in page. On a local dev server the form is already filled in. |
| Customer | Create your own account at `/signup`. Guest checkout also works without an account. |
| Stripe card (success) | `4242 4242 4242 4242`, any future expiry date, any CVC, any postcode |
| Stripe card (declined) | `4000 0000 0000 0002` |

Stripe runs in test mode, so no real money moves.

## Try the core loop

1. Search for a product or open a category, then add an item to the cart. No account is needed.
2. Open the cart. It shows shipping and tax estimates before checkout.
3. Check out as a guest or signed in, and pay with the test card.
4. An order is marked paid only after the verified Stripe webhook arrives. The success page waits for it.
5. Sign in to `/admin` and open **Orders → To process**. Move the order to processing, then to shipped (add a carrier and tracking number), then to delivered. The customer's order page shows the tracking details.
6. In **Inventory**, adjust stock with a reason. In **Audit log**, find the entry for each action.

## Setup

Requirements: Node.js 20 or later, and a Postgres database (Neon was used). Stripe, Resend and Upstash accounts are optional until you need those features.

```bash
npm install --legacy-peer-deps   # better-auth's optional SvelteKit peer conflicts with vitest's vite
cp .env.example .env             # then fill in the values
npm run db:migrate               # applies drizzle/0000-0005
npm run db:seed                  # imports the DummyJSON catalog (ratings are synthetic)
npm run db:seed:settings         # shipping methods, tax rates, store settings
npm run db:seed:admin            # creates or resets the demo admin above
npm run dev                      # http://localhost:3000
```

To test payments locally, forward Stripe webhooks in a second terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Put the `whsec_...` secret it prints into `STRIPE_WEBHOOK_SECRET`. Without the webhook, orders stay in "Awaiting payment" and expire after 30 minutes.

To give staff access to another account, the user signs up first. Then run `npm run admin:role -- <email> <admin|support|customer>`.

### Environment variables

`.env.example` lists every variable with comments. The app validates them at startup and stops with a clear error if a required one is missing.

| Variable | Required | Purpose |
|---|---|---|
| `APP_URL` | yes (falls back to `VERCEL_URL`) | Public base URL, used in emails and links |
| `BETTER_AUTH_SECRET` | yes | Signs auth sessions |
| `DATABASE_URL` | yes | Postgres connection. On Vercel, use Neon's pooled (`-pooler`) URL. |
| `PII_ENC_KEY` | yes | Base64 32-byte key for AES-256-GCM encryption of personal fields (phone, addresses, order contact) |
| `IP_HASH_SALT` | yes | Salt for hashing IP addresses. Raw IPs are never stored. |
| `CRON_SECRET` | yes | Bearer secret for `/api/cron/*` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | for checkout | Stripe test keys |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Transactional email. Without them, emails are skipped and nothing crashes. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | optional | Rate limiting. Falls back to in-memory limits. |
| `BLOB_READ_WRITE_TOKEN` | optional | Vercel Blob for admin image uploads. Without it, the admin shows "Uploads are off". |
| `DEMO_ADMIN_PREFILL` | optional | Set to `true` to prefill the admin sign-in on a deployed site (local dev always prefills) |

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build (do not run it while `dev` is running: it overwrites `.next`) |
| `npm run typecheck` / `lint` / `test` | TypeScript strict check, ESLint, Vitest unit tests |
| `npm run db:generate` | Generates a Drizzle migration (`--custom` for hand-written SQL) |

## Architecture

- **Stack:** Next.js 15 App Router, TypeScript strict, Tailwind with hand-written components, Drizzle ORM on Neon Postgres, Better Auth (argon2id), Stripe PaymentElement, Resend, Upstash, Vercel. See `docs/adr/0001-stack-choice.md`.
- **Layering:** route → service → repo → db. Route handlers and pages are thin. Business logic lives in `src/modules/<name>/` (service, repo, Zod schemas, tests). Zod validates every route and server action input.
- **Modules built:** `catalog`, `search`, `cart`, `checkout` (pricing engine, order snapshots), `orders` (state machine, emails, access tokens), `payments` (webhook verification), `auth`, `addresses`, `privacy` (consent log), `admin` (permissions, products, inventory, orders, audit). The folders `vouchers`, `reviews`, `referrals`, `wishlist` and `notifications` are placeholders for later milestones.
- **Shared code:** `src/lib/` holds env validation, db, auth, money (integer cents only), crypto (PII encryption), audit, errors, rate limiting, consent and SEO helpers.
- **Rendering:** catalog pages (home, category, product, legal) are statically generated and revalidated through a `catalog` cache tag, which admin edits clear. They never read cookies or sessions. Cart and account state loads in the browser after hydration. Account, checkout, orders, search and admin pages are dynamic, with a per-request nonce CSP (ADR-0002).
- **Payments:** the order is created first. Placing an order reserves stock in a transaction and then creates the PaymentIntent. The order becomes paid only through the verified, deduplicated Stripe webhook, which checks the amount, currency and metadata. Unpaid orders expire after 30 minutes. Details are in ADR-0004.
- **Admin:** `/admin` for the `admin` and `support` roles. One tested permission matrix controls access. Support can view and fulfil orders and sees masked customer details. Admin sessions are limited to 12 hours. Stock changes only through Inventory, with a reason written to a ledger. The audit log is append-only, enforced by a database trigger.

## What was built first, and what was left out

Built first, because together they prove the core loop end to end:

| Built | Why first |
|---|---|
| Search, category browse, product pages | Every shopper starts here |
| Guest cart with live totals | No signup before buying |
| Checkout with Stripe (test mode) and orders | Proves a working end-to-end system |
| Accounts and order history | Customers need to come back and track orders |
| Minimal admin (orders, products, stock, audit) | A store needs an operator |
| Thin GDPR layer (consent log, encrypted PII, data map) | Cheap when designed in from the start |

Left out on purpose:

| Left out | Why |
|---|---|
| Multi-seller marketplace, ads, Prime, Q&A, live chat, real carrier integrations | Not needed to prove the core experience |
| Referrals, wishlist, returns, saved cards | Useful, but only after the core loop works well |

## Built vs designed only

| Milestone | Status |
|---|---|
| M0 Foundation (schema, utilities, security headers, CI, governance docs) | Built |
| M1 Browse (catalog, search with typo tolerance, filters, product pages, cookie consent) | Built |
| M2 Cart and pricing engine | Built |
| M3 Accounts (signup, email verification, reset, profile, encrypted addresses, cart merge) | Built |
| M4 Checkout (Stripe, webhook, orders, state machine, expiry cron, guest order access) | Built |
| M5 Minimal admin (orders, fulfilment, refunds, products, inventory, audit log, roles) | Built |
| M6 GDPR privacy centre (consent management, data export, account deletion, DSAR queue, retention jobs, step-up auth) | Designed in the PRD, not built |
| M7 Vouchers, reviews, in-app notifications | Designed in the PRD, not built |
| M8 Referrals, wishlist, returns, saved cards and other P1 items | Designed in the PRD, not built |

The governance documents are in `docs/`: data map, ROPA, retention, cookies, sub-processors, breach runbook and DPIA-lite. They are starting templates and have not been legally reviewed.

## Known gaps

- **No self-service privacy tools yet.** Export, deletion and consent changes after the first choice are M6. The consent log and PII encryption already exist.
- **The success page depends on the Stripe webhook.** Without `stripe listen` locally, or a configured webhook endpoint on Vercel, paid orders stay in "Awaiting payment". Refunds also need the `refund.created`, `refund.updated` and `refund.failed` events enabled on the webhook.
- **Admin order search matches order numbers only.** Contact emails are encrypted with a random IV, so searching them needs a blind index (ASSUMPTIONS #67).
- **Image uploads need Vercel Blob** (`BLOB_READ_WRITE_TOKEN`). Seeded products use DummyJSON image URLs.
- **Roles are granted from the command line** (`npm run admin:role`). There is no customer admin screen yet (ASSUMPTIONS #68).
- **Ordered products cannot be deleted**, only unpublished, so order history stays intact. Changing a slug breaks old links because there are no redirects (ASSUMPTIONS #61, #63).
- **Shipped orders cannot be cancelled.** Money goes back through a refund. A partial refund before delivery does not change the order status (ASSUMPTIONS #57, #58).
- **Hand-written migrations.** Migrations 0003 to 0005 are `--custom` SQL, and the Drizzle snapshot has not been realigned. Review any `drizzle-kit generate` output before applying it (ASSUMPTIONS #45, #69).
- **The demo admin password is shorter than the signup policy** (10+ characters). This was the owner's choice for the reviewer account.
- The full list of decisions and trade-offs is in `docs/ASSUMPTIONS.md`.

## Docs

- `docs/PRD.md`: requirements, decision log and build order (the source of truth)
- `docs/DESIGN.md`: design system for all UI work
- `docs/adr/`: architecture decisions (stack, static CSP, auth, payment flow)
- `docs/ASSUMPTIONS.md`: every assumption made during the build
- `CHANGELOG.md`: what changed in each milestone
