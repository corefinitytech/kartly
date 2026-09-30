# ADR-0002: Static CSP for catalog routes, nonce CSP only for dynamic routes

**Status:** Accepted
**Date:** 2026-09-29

## Context

FR-SEC-03 requires a nonce based Content Security Policy. Reading the consent cookie server side and generating a nonce per request in middleware forced every page to render dynamically, which removed CDN caching from the catalog (the highest-traffic pages) and slowed first response.

## Decision

1. The consent cookie read moved to the client, and catalog pages (home, category, product, legal) are statically generated with `generateStaticParams` and `revalidate = 3600`, their data reads wrapped in `unstable_cache` (300s, `catalog` tag) so admin edits can invalidate them later.
2. The nonce CSP middleware now matches only routes that are already dynamic: `/search`, `/cart`, `/account`, `/checkout/*`.
3. Statically generated routes get a fixed CSP through `next.config` headers: `script-src 'self' 'unsafe-inline'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. The `'unsafe-inline'` script allowance is what Next.js needs for its inline bootstrap/hydration scripts on pages whose HTML is cached without a nonce.

## Why the risk is low

The catalog and legal pages render no user supplied HTML: all content comes from the seeded database and trusted source files, and output is React-escaped. There is no third-party script on these pages, `default-src 'self'` blocks external script origins entirely, and framing, object embedding and form submission to other origins remain blocked. The residual risk of inline script injection would require a stored XSS in catalog data or a compromised build, both of which the nonce CSP would not meaningfully stop either (a compromised build could inject the nonce).

## Consequences

- Catalog pages serve from the CDN with ISR; first response no longer waits on a per-request middleware nonce.
- If a future feature adds user-generated content to a static route (for example reviews), that route must move to the nonce middleware matcher first.
- `x-nonce` is only available on dynamic routes; no static code path may rely on it.
