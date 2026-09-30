# Lighthouse Readiness

Targets (mobile profile): Performance ≥ 90, Accessibility 100, Best Practices 100, SEO 100, on home, category, product and search pages.

## How the code addresses each category

### Performance
- Catalog routes are statically generated with ISR (`generateStaticParams`, `revalidate = 3600`, `dynamicParams = true`); data reads are cached (`unstable_cache`, 300s, `catalog` tag). Confirm static/ISR in the build output.
- `next/image` everywhere with fixed aspect ratios, `sizes` attributes, `priority` on the first four above-the-fold images and the main product image; the rest lazy.
- `preconnect` to `cdn.dummyjson.com`; fonts self hosted via `next/font` with `display: swap` and weights limited to those used.
- Heavy client pieces (cookie dialog, filter bottom sheet) load through `next/dynamic` with `ssr: false`.
- No animation of layout properties; only opacity/transform; `prefers-reduced-motion` kills all motion.

### Accessibility
- Skip-to-content link as the first focusable element; visible 2px brand focus ring everywhere.
- Landmarks (`header`, labelled `nav`s, `main`, `footer`), one `h1` per page, ordered headings.
- Product card images use empty alt (title sits next to them); the gallery keeps meaningful alt text.
- ARIA live region announces the result count; `aria-current` on the current category, breadcrumb and page.
- Touch targets ≥ 44px; inputs are 16px to prevent iOS zoom; contrast pairs audited in `docs/DESIGN.md`.

### Best Practices
- No `console` output in shipped code; `poweredByHeader: false`.
- CSP on every route (nonce-based on dynamic routes, static CSP elsewhere — ADR-0002); HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors.
- No deprecated APIs, no cross-origin issues, images served through the Next image optimizer.

### SEO
- Per-page metadata with canonicals, robots rules, Open Graph and Twitter cards (see `docs/SEO.md`), `robots.txt` and `sitemap.xml` generated from the database, JSON-LD for Organization, WebSite, BreadcrumbList and Product, semantic HTML underneath.

## Scores (fill in after running)

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Home `/` | | | | |
| Category `/c/{slug}` | | | | |
| Product `/p/{slug}` | | | | |
| Search `/search?q=` | | | | |

## How to run

**Lighthouse (Chrome DevTools):** open the deployed URL in an incognito window (no extensions), open DevTools → Lighthouse tab, select device **Mobile**, all four categories, then **Analyze page load**. Run once per page above; use a product page with an image and a category with several pages of results.

**PageSpeed Insights:** open https://pagespeed.web.dev, paste the deployed URL (home page first), and read the Mobile scores and the Core Web Vitals field data; repeat for a product URL.
