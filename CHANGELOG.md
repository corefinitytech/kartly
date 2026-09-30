# Changelog

## 2026-09-30 (M3: accounts)
Better Auth foundation (argon2id hooks, DB sessions with hashed IPs, table reconciliation migration 0003, ADR-0003), rate-limited auth handler, Resend mailer with accessible templates, signup/login/forgot/reset/verify pages with full form UX, account area (overview, profile with encrypted phone, security, encrypted addresses with defaults and a 10-address cap), guest cart merge into the user cart, header signed-in state, audit entries for auth and account actions, and pure-logic tests. Catalog routes remain static.

Files touched: package.json, .env.example, drizzle/0003_auth_tables.sql, src/db/schema/{identity,cart}.ts, src/lib/{auth,auth-client,mailer,env,ratelimit}.ts, src/modules/auth/{actions,password,session,safe-next,lockout,tokens,emails}.ts + tests, src/modules/addresses/{schemas,service,actions}.ts + test, src/modules/cart/{merge,merge-service}.ts + test, src/app/api/auth/[...all]/route.ts, src/app/api/cart/{_shared.ts,merge/}, src/app/{signup,login,forgot-password,reset-password,verify-email}/*, src/app/account/{layout,page,nav,profile,security,addresses}/*, src/components/auth/form-kit.tsx, src/components/layout/site-header.tsx, src/components/cart/cart-page-client.tsx, src/middleware.ts, docs/{adr/0003-auth,data-map,cookies,sub-processors,ROPA,retention,ASSUMPTIONS}.md.

## 2026-09-29 (M2: guest cart and pricing engine)
Shipping/tax/settings tables with idempotent settings seed, pure pricing engine with largest-remainder allocations and property tests, guest cart module (hashed token cookie, owner-scoped service and repo, clamped atomic upserts, price-change and unavailable flags) with rate-limited API routes, client cart store with optimistic updates and ARIA announcements, wired header badge and product buy box, mini cart drawer, and a full cart page with estimates, country select and mobile sticky bar. Catalog routes remain static (all cart state is client-side after hydration).

Files touched: drizzle/0002_grey_squirrel_girl.sql, src/db/schema/{settings,cart,index}.ts, scripts/seed-settings.ts, package.json, src/modules/checkout/pricing.ts + test, src/modules/cart/{identity,schemas,repo,service}.ts + identity.test, src/app/api/cart/{route,count/items,items/[id],estimate}, src/components/cart/{cart-store,buy-box,mini-cart,cart-page-client}.tsx, src/components/ui/{overlay,toast}.tsx, src/components/layout/site-header.tsx, src/app/layout.tsx, src/app/p/[slug]/page.tsx, src/app/cart/page.tsx, src/app/globals.css, src/lib/ratelimit.ts, docs/{cookies,data-map,ROPA,ASSUMPTIONS}.md.

## 2026-09-29 (build fix)
Moved the SVG favicon from src/app/icon.svg (file convention crashed page data collection) to public/icon.svg and referenced it through metadata icons.

Files touched: public/icon.svg, src/app/layout.tsx.

## 2026-09-29 (M1 polish, SEO and performance pass)
Category display names and ordering, header More dropdown and mobile scroll strip, redesigned cookie banner and dialogs with focus traps and exit animations, micro animation token set, cart/account placeholders, ratings honesty fixes, empty-alt card images, full SEO layer (metadata, canonicals, OG/Twitter, generated social images, robots, sitemap, manifest, JSON-LD without fake ratings), static rendering for catalog routes with cached queries, static CSP split with ADR-0002, LCP/a11y groundwork, and docs/SEO.md + docs/LIGHTHOUSE.md.

Files touched: src/app/globals.css, src/app/layout.tsx, src/app/page.tsx, src/app/{cart,account}/page.tsx, src/app/{opengraph-image,twitter-image,apple-icon,manifest,robots,sitemap}.tsx, src/app/{privacy,cookies,terms,returns,contact,faq}/page.tsx, src/app/c/[slug]/page.tsx, src/app/p/[slug]/page.tsx, src/app/search/page.tsx, src/middleware.ts, next.config.ts, src/components/consent-provider.tsx, src/components/consent/{shared,customize-dialog}.tsx, src/components/layout/{site-header,site-footer}.tsx, src/components/listing/{listing-view,filters,filter-sheet,sort-pagination}.tsx, src/components/product/{gallery,buy-box}.tsx, src/components/{product-card,json-ld,route-progress,use-bump,add-to-cart-button}.tsx, src/components/ui/{overlay,toast}.tsx, src/modules/catalog/{category-names.ts + test,service.ts}, src/lib/{seo.ts + test,consent-cookie.ts}, docs/{DESIGN.md,SEO.md,LIGHTHOUSE.md,ASSUMPTIONS.md,adr/0002-static-csp-catalog.md}.

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
