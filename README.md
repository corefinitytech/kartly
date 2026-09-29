# Kartly

A fast, transparent, privacy-first e-commerce platform inspired by Amazon's shopping mechanics, minus the dark patterns: no sponsored results, no forced account creation, and the full cost (shipping and tax) is visible before checkout. GDPR is applied as the baseline for all users.

## Status

- **M0 (foundation):** Next.js App Router + TypeScript strict scaffold, Tailwind design system tokens, Drizzle schema for the core tables, privacy-first utilities (env, logger, errors, money, crypto, audit, retention, consent), security headers with nonce CSP, CI, governance docs.
- **M1 (browse):** home page, category and search listings (full-text search with typo tolerance, filters, sort, pagination), product pages, typeahead, cookie consent with an append-only consent log, legal pages.
- Next: M2 cart, M3 accounts, M4 checkout with Stripe. See `docs/PRD.md` (single source of truth) and `docs/DESIGN.md` for UI work.

## Setup

```bash
npm install
cp .env.example .env   # fill in the values below
npm run db:migrate
npm run db:seed
npm run dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Direct Postgres connection (Neon/Supabase). Used for migrations and seeding. |
| `DATABASE_URL_POOLED` | Neon pooled connection string. **Use this on Vercel** (set it as `DATABASE_URL` in the project settings). |
| `PII_ENC_KEY` | Base64 32-byte key for AES-256-GCM PII field encryption. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `IP_HASH_SALT` | Salt for hashing IPs in the audit log. |
| `CRON_SECRET` | Shared secret for `/api/cron/*` routes. |
| `APP_URL` | Public app URL. |
| `STRIPE_*`, `RESEND_*`, `UPSTASH_*` | Payments, email, rate limiting (test keys; see `.env.example`). |

## Commands

`dev`, `build`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`, `db:seed` — documented in `AGENTS.md`.

## Docs

- `docs/PRD.md` — product requirements, decision log, build order. Read first.
- `docs/DESIGN.md` — design system used for all UI work.
- `docs/` — GDPR governance set (data map, ROPA, retention, cookies, breach runbook, sub-processors, DPIA-lite). All templates pending legal review.
