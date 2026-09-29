# ADR-0001: Stack choice for Kartly

**Status:** Accepted
**Date:** 2026-09-29

## Context
Kartly is a 1-day assessment build judged on speed, product judgement and UX quality. The PRD (Section 3) fixes the stack; this record explains the choice and its consequences.

## Decision
Next.js (App Router) + TypeScript strict on Vercel; PostgreSQL (Neon/Supabase) with Drizzle ORM and drizzle-kit migrations; Zod shared validation; Stripe test-mode payments; Resend email; Upstash Redis for rate limiting/cache; Tailwind + shadcn/ui patterns; Vitest for unit/integration tests; GitHub Actions CI.

## Rationale
- **Next.js App Router + Vercel**: fastest path from zero to a deployed, polished storefront; server components keep the catalog fast and secrets server side.
- **Drizzle**: typed SQL without a heavy runtime; incremental schema creation per milestone (D-19) is natural with drizzle-kit.
- **Postgres full text search + pg_trgm**: good-enough product search without another system to run.
- **Stripe + Resend + Upstash**: managed, free-tier-friendly integrations that unblock checkout, transactional email and rate limits quickly.
- **Tailwind + shadcn/ui-style components**: one design token set and consistent components satisfy the UX quality bar (Section 10.1) with minimal overhead.

## Consequences
- Money is integer cents everywhere (D-01); no floats.
- The auth library (Better Auth, fallback Auth.js v5) is chosen in M3; M0 defines users/sessions/accounts tables to match the PRD data model and reconciles with the library's schema when it is adopted (`VERIFY` against current docs).
- All PII fields (phone, address lines, guest email) are AES-256-GCM encrypted with a versioned key id from day one (D-13).
