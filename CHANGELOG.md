# Changelog

## 2026-09-29 (M1 fix)
Fixed a runtime crash in the root layout: ConsentProvider no longer takes render-prop children (functions cannot cross the server-to-client boundary in Next 15). SiteFooter now reads openSettings from useConsent() directly.

Files touched: src/app/layout.tsx, src/components/consent-provider.tsx, src/components/layout/site-footer.tsx.

## 2026-09-29 (M1: browse + design system)
Design system pass (docs/DESIGN.md, tokens, fonts, restyled components, header/footer) and M1 browse: home, category and search listings with filters/sort/pagination in URL state, product pages with gallery and buy box, trigram typeahead with rate limiting, cookie consent (banner, kt_consent cookie, consent log API, ConsentGate), legal pages, search_vector custom migration, tests.

Files touched: docs/{PRD.md renamed from pr.md, DESIGN.md, search-ranking.md, cookies.md, data-map.md, ASSUMPTIONS.md}, AGENTS.md, src/app/globals.css, src/app/{layout,page,not-found,error,global-error,loading}.tsx, src/app/icon.svg, src/app/{privacy,cookies,terms,returns,contact,faq}/page.tsx, src/app/{c/[slug],search,p/[slug]}/{page,loading}.tsx, src/app/api/search/suggest/route.ts, src/app/api/privacy/consent/route.ts, src/components/{logo,legal-page,consent-provider}.tsx, src/components/layout/{site-header,site-footer}.tsx, src/components/listing/{listing-view,filters,sort-pagination}.tsx, src/components/product/{gallery,buy-box}.tsx, src/components/{product-card,price-text,rating-stars}.tsx, src/components/ui/{button,input,card,badge,skeleton,toast,empty-state,error-state}.tsx, src/modules/catalog/{repo,service,schemas,types,stock,url}.ts + tests, src/modules/search/{repo,schemas}.ts + test, src/modules/privacy/service.ts, src/lib/{ratelimit,consent-cookie}.ts + test, src/db/schema/catalog.ts, drizzle/0001_search_vector.sql.

## 2026-09-29 (migrate + seed fixes)
Fixed the M0 migration: search_vector is now a tsvector column (valid GIN index), the trigram index generates correct gist syntax, and the migration installs pg_trgm. Seed script is now idempotent (truncates catalog tables first). Migration applied and 194 products + 24 categories seeded on Neon.

Files touched: src/db/schema/catalog.ts, scripts/seed.ts, drizzle/0000_dry_rictor.sql, docs/ASSUMPTIONS.md.

## 2026-09-29 (fixes)
Fixed float rounding bug in roundHalfUp (1.005 case); upgraded drizzle-orm to 0.45.3 (GHSA-gpj5-g38j-94v9) and pinned a postcss override ^8.5.28 (GHSA fixes under Next 15) so npm audit --audit-level=high passes.

Files touched: src/lib/money.ts, package.json, package-lock.json.

## 2026-09-29
M0 foundation: Next.js App Router + TS strict scaffold with Tailwind and shadcn-style components, Drizzle schema for the M0 tables, lib utilities (env, logger, errors, money, crypto, audit, retention, consent), security headers with nonce CSP, health endpoint, DummyJSON seed script, CI workflow, UX foundation (tokens, layout, shared components, 404/error pages), governance docs, ADR-0001, AGENTS.md.

Files touched: package.json, package-lock.json, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs, .prettierrc, .prettierignore, vitest.config.ts, drizzle.config.ts, .env.example, .gitignore, .github/workflows/ci.yml, AGENTS.md, src/middleware.ts, src/app/**, src/components/**, src/db/**, src/lib/**, src/modules/*/README.md, scripts/seed.ts, docs/{data-map,ROPA,sub-processors,breach-runbook,retention,cookies,COMPLIANCE-GAPS,DPIA-lite,international-transfers,privacy-policy,ASSUMPTIONS}.md, docs/adr/0001-stack-choice.md.
