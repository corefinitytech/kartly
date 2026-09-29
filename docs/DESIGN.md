# Design System — Kartly

Direction: **quiet retail.** Information first, dense but calm, warm neutral surfaces, one brand colour, one action colour. A well run online store, not a startup landing page. No dark mode in M1.

## Colour tokens

Defined in `src/app/globals.css` as Tailwind theme variables, used via utility classes (`bg-canvas`, `text-ink`, `border-line`, …).

| Token | Hex | Use |
|---|---|---|
| canvas | #F6F4EF | Page background (~60% of surface) |
| surface | #FFFFFF | Cards, inputs, sheets |
| sunken | #EFECE5 | Image tiles, table stripes, quiet panels |
| line | #DDD8CE | Default borders, dividers |
| lineStrong | #C4BEB1 | Input borders, focus-adjacent edges |
| ink | #1B1F1E | Primary text |
| inkSoft | #4F5754 | Secondary text |
| inkMuted | #5F6663 | Captions, placeholders on canvas |
| brand | #0F4C4A | Structure: header, footer, active states, heading accents |
| brandDeep | #0E3F3D | Header background |
| brandLink | #0B5C59 | Text links |
| brandTint | #E3EEEC | Selected chips, subtle highlights |
| accent | #C2410C | Buying actions only (Add to cart, Place order) |
| accentHover | #A63709 | Accent hover |
| accentPressed | #8F2F07 | Accent pressed |
| success | #1F7A45 | Positive stock/status |
| warning | #8A5A00 | Low stock text, on warningTint #FFF4D6 |
| danger | #B42318 | Discount/sale, on dangerTint #FDECEA |
| star | #B7791F | Rating stars only |

Rules: accent appears only on primary buying buttons, never as decoration. Discount percentages and sale prices use danger. Links use brandLink. Focus ring: 2px `brand` ring with 2px offset on every interactive element.

### Contrast (WCAG 2.1 AA)

Checked pairs (normal text 4.5:1, large text and icons 3:1):

- ink on canvas/surface/sunken/brandTint/warningTint/dangerTint: ≥ 12:1. Pass.
- white on brand (#0F4C4A) 8.9:1, on brandDeep 10.2:1, on accent (#C2410C) 4.9:1, on accentHover 5.9:1. Pass.
- inkSoft on canvas 7.1:1, on surface 7.6:1, on sunken 6.6:1. Pass.
- inkMuted on canvas 5.4:1, on surface 5.8:1, on sunken 5.0:1. Pass (used ≥14px).
- brandLink on canvas 6.2:1, on surface 6.6:1. Pass.
- warning #8A5A00 on warningTint #FFF4D6: 6.1:1. Pass.
- danger #B42318 on dangerTint #FDECEA: 6.0:1; danger on surface 6.6:1. Pass.
- star #B7791F is decorative/icon-only (3.06:1 on surface). Pass as icon; never used for text.
- **Adjustments made:** original brandLink drafts and inkMuted on sunken were below 4.5:1; inkMuted darkened to #5F6663 (5.0:1 on sunken) and star reserved for icons only.

## Typography

Loaded with `next/font/google` (Source Serif 4: 600/700; Public Sans: 400/500/600/700). `next/font` self hosts the files at build time; no request goes to Google at runtime (FR-GDPR-07).

- Headings and the logo wordmark: Source Serif 4 600/700 — page title, section titles, wordmark only.
- Everything else (buttons, nav, prices, forms): Public Sans.
- Scale (px): 12, 14, 16, 18, 20, 24, 30, 38. Body is 16 on mobile and desktop; inputs are 16 (prevents iOS zoom). Line height 1.5 body, 1.2 headings.
- Prices: Public Sans 600 with tabular numerals (`font-variant-numeric: tabular-nums`). The strikethrough "was" price is inkMuted at 14.
- Sentence case everywhere. No all caps except tiny 12px labels with 0.04em letter spacing, used sparingly.

## Shape, spacing, depth

- Spacing scale on 4px. Container max width 1280px; gutters 16px mobile, 24px desktop.
- Radius: 4px badges/chips, 6px buttons/inputs, 8px cards/sheets. Full round only for avatars and count badges.
- Depth from 1px `line` borders, not shadows. One soft shadow only for popovers, dropdowns and the mobile bottom sheet: `0 1px 2px rgba(27,31,30,0.06), 0 8px 24px rgba(27,31,30,0.08)`.
- No gradients, glass, blur, glows, decorative blobs, gradient text.
- Touch targets ≥ 44px tall on mobile.
- Motion: 150ms ease-out hover/focus, 200ms sheets/dropdowns. No bounce, float, parallax, hover scale. `prefers-reduced-motion` respected. Skeletons: plain pulse.

## Assets

- Icons: `lucide-react`, stroke width 1.75, default size 20. No emoji, no sparkle/magic wand icons.
- Logo: text wordmark "kartly" (lowercase Source Serif 4 bold) + small accent square as the full stop — inline text/SVG component (`Logo`), not an image. Favicon: `src/app/icon.svg` (letter k + accent square).
- Product imagery: sunken tiles, 12px padding, `object-fit: contain`, fixed 1:1 aspect on cards and gallery. Never crop products.
- Category tiles: image of the top rated product in the category on a sunken tile, category name below in Public Sans 600. No stock photos, no illustrations.
- Empty/error states: one 24px Lucide line icon in inkMuted, one line title, one line help, one action button. No illustrations.
- Badges: 4px radius. Low stock = warning on warningTint; out of stock = inkSoft on sunken; discount = danger on dangerTint. Only when informative.

## Layout and components

- Desktop header: one brandDeep bar — wordmark, wide 44px search field (surface bg, 6px radius) with a category select on its left edge and a brand search icon button on its right, Account and Cart links in white with a count badge. Below: category strip on canvas with bottom border in line, top level categories as plain links, underline on hover, brand underline on current.
- Mobile header: row 1 wordmark + cart icon + menu button; row 2 search field. Menu opens a full height panel with categories.
- Footer: brandDeep, four columns (Shop, Help, Legal, Privacy with Cookie settings) collapsing to stacked lists on mobile. One plain line: prices are shown before checkout and there are no sponsored results.
- Product card: sunken image tile, title 2-line clamp ink 14/16, stars + count in inkSoft, price ink 600 + was price + discount badge when compare_at exists, stock badge only if low/out. Whole card is one link with visible focus ring. Hover: line → lineStrong border only, no shadow lift.
- Buttons: primary buy = accent, white text; secondary = brand, white text; tertiary = surface, lineStrong border, ink; text button = brandLink. 6px radius, 44px default height.

## Copy voice

Plain, specific, sentence case, no exclamation marks, no filler. Banned: "Welcome to", "Discover", "Elevate", "Unlock", "Seamless", "Curated", "Your one stop shop". No invented statistics, testimonials or lorem ipsum. Home headline: **"Plain prices. No sponsored results."** Supporting line: "See your full cost, including shipping and tax, before you check out."
