# Kartly

Kartly is a privacy-first, GDPR-ready e-commerce platform (single vendor, USD, global storefront with GDPR as baseline). M0 to M5 are built (foundation, browse, cart, accounts, checkout, minimal admin). Feature work continues at **M6 (GDPR privacy centre)**.

**Read `docs/PRD.md` before making any changes. It is the single source of truth.**

## Key directories

- `src/app/` — Next.js App Router routes only (thin); `c/[slug]`, `search`, `p/[slug]`, `api/*`
- `src/modules/<name>/` — business logic per module (service, repo, schemas, types, tests); layering: route -> service -> repo -> db
- `src/lib/` — cross-cutting utilities (db, env, logger, errors, money, crypto, audit, retention, consent, consent-cookie, ratelimit)
- `src/db/schema/` — Drizzle schema, added incrementally per milestone
- `src/components/` — shared UI components (hand written, no component library)
- `scripts/` — seed script
- `docs/` — PRD, DESIGN.md, governance documents, ADRs, assumptions

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript strict check
- `npm run test` — Vitest unit tests (pure logic only at M1)
- `npm run db:generate` — generate Drizzle migrations (`--custom` for hand written SQL)
- `npm run db:migrate` — apply Drizzle migrations
- `npm run db:seed` — import DummyJSON catalog data (seed ratings are synthetic)
- `npm run admin:role -- <email> <admin|support|customer>` — grant a staff role (the user must have signed up)

## Conventions (from PRD Section 0)

- Never read, print or edit `.env` files. Only `.env.example` may be edited.
- Follow `docs/DESIGN.md` for all UI work.
- Money is integer cents. Never floats.
- Never trust the client for prices, totals, stock, discounts, roles or user IDs.
- Every DB query touching user data is scoped by the authenticated user.
- No PII in logs, error messages, analytics or URLs.
- Business logic lives in `services/`, never in components or route handlers.
- Every route input is validated with Zod.
- Every new personal data field is added to `docs/data-map.md` in the same change.
- Update `CHANGELOG.md` for every task.
- Decisions that change the stack or a Decision Log item require an ADR in `docs/adr/`.
