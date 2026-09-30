# SEO Strategy

## Metadata

- `metadataBase` comes from `APP_URL` (`src/lib/env`), so a custom domain works without code changes. Every absolute URL (canonicals, sitemap, robots, JSON-LD, OG) is built through `src/lib/seo.ts` (`buildCanonical` / `absoluteUrl`).
- Root layout sets the default title (`Kartly: plain prices, no sponsored results`), the `%s | Kartly` template, description, applicationName, robots index/follow with `max-image-preview:large`, and the theme colour (brandDeep) via the viewport export.
- Every page defines `generateMetadata` (or static `metadata`) with a unique title and description and `alternates.canonical`.

## Canonical rules

| Page | Canonical |
|---|---|
| Home | `/` |
| Category | `/c/{slug}` without sort/filter/view parameters; page 2+ self-references with only `?page=N` |
| Product | `/p/{slug}` |
| Search | `/search` (with `noindex, follow`) |
| Legal | the page path itself |

## noindex rules

- `/search`, `/cart`, `/account` (and future `/checkout`, `/admin`, `/api`) are `noindex`.
- `robots.txt` additionally disallows crawling of `/api/`, `/account`, `/cart`, `/admin`, `/checkout`, but **not** `/search` — crawlers must be able to fetch it to see the noindex tag.
- The 404 page returns the 404 status via `notFound()` and is not in the sitemap.

## Structured data (JSON-LD)

- Serialized with `<` escaped, rendered as `application/ld+json` by `src/components/json-ld.tsx`.
- Home: `Organization` + `WebSite` with a `SearchAction` targeting `/search?q={search_term_string}`.
- Category and product pages: `BreadcrumbList` using category display names.
- Product pages: `Product` with name, image, description, sku, brand and an `Offer` (price, USD, availability from the stock state, url, NewCondition). **No `aggregateRating` or review markup**: the ratings are seed data and publishing fake ratings breaks search engine guidelines.
- Semantic HTML backs the structured data: one `h1` per page, ordered-list breadcrumbs with `aria-current` on the last item, labelled landmarks.

## Icons and sharing

- SVG favicon at `src/app/icon.svg`, PNG apple icon (`apple-icon.tsx`), web manifest (`manifest.ts`) with brandDeep theme colour.
- Default social images generated at the edge by `opengraph-image.tsx` / `twitter-image.tsx` (1200×630 `ImageResponse`, canvas background, wordmark, tagline, brand bar). Product pages override `og:image` with the product's first image and add `product:price:amount` / `product:price:currency` through the metadata `other` field.

## Launch checklist

1. Set `APP_URL` in Vercel to the final domain (or add the custom domain; `VERCEL_URL` is the fallback).
2. Verify the favicon and apple icon appear in the tab and no icon request 404s.
3. Add the site to Google Search Console and verify ownership.
4. Submit `https://<domain>/sitemap.xml`.
5. Test a product URL and the home page in a share debugger (e.g. opengraph.xyz) to confirm the OG image, title and product price meta render.
6. Spot-check canonicals: a filtered category URL must canonical to the clean one; page 2 to `?page=2`.
