# PRD: Kartly (working name), an Amazon.com inspired e-commerce platform

> **Purpose:** Single source of truth for all AI agents and humans building this project. If something is not here, do not invent it. Ask, or log an assumption in `docs/ASSUMPTIONS.md`.
> **Context:** 1 day assessment. Brief: "Use the product as your reference, not your blueprint. Show what you would change, what you would cut and how you would make it better to use."
> **How it is judged:** (1) Speed: how much working product exists in the time. (2) Product judgement: what was built first and what was left out. (3) UX and UI: whether what shipped is good to use.
> **Our edge:** A polished, deployed core shopping loop, plus privacy by design and GDPR readiness that other submissions will not have.
> **Priority legend:** P0 = must ship in the assessment window. P1 = ship if time allows. P2 = designed and documented, not built.

---

## 0. Agent Operating Rules (READ FIRST)

1. **Do not change the stack** (Section 3) or any item in the Decision Log (Section 4) without adding a new ADR in `docs/adr/`.
2. **Build in the order of Section 14.** Finish one milestone fully (service, validation, tests, UI states) before starting the next.
3. **All money is integer minor units** (cents). Never use floats for money.
4. **Never trust the client** for prices, totals, stock, discounts, roles, or user IDs. Recompute server side.
5. **Every DB query touching user data is scoped by the authenticated user.** No exceptions.
6. **No PII in logs, error messages, analytics, or URLs.** Use user IDs or hashes.
7. **No feature outside this PRD.** If you think one is needed, add it to `docs/ASSUMPTIONS.md` and continue.
8. **Every new personal data field must be added to `docs/data-map.md`** (purpose, legal basis, retention, recipients) in the same change.
9. **Business logic lives in `services/`**, never in components, route handlers, or server actions. Those only parse, authorize, call a service, and format the response.
10. **Update `CHANGELOG.md`** (date, one line summary, files touched) for every task.
11. When unsure about Amazon's behavior, mark it `VERIFY` and note it. Do not guess and present it as fact.
12. **Judging criteria are speed, product judgement and UX quality.** Prefer a working, polished, deployed core loop over breadth. Every screen must have loading, empty and error states and must work on a phone. Never leave the app in a broken state between milestones.
13. **Compliance never blocks the core loop.** Build privacy by design as you go (Section 9), and complete the Privacy Center and documents in their milestone.

---

## 1. Product Overview

**Vision:** A fast, transparent, privacy first online store that keeps Amazon's best shopping mechanics and removes its friction and dark patterns.

**Users and Roles**
| Role | Description |
|---|---|
| Guest | Browses, carts, and can check out without an account |
| Customer | Registered and verified user |
| Support | Admin panel access to orders and customers (limited PII, cannot delete or export data) |
| Admin | Full admin panel access |

**Model:** Single vendor store (the operator sells everything). Multi seller marketplace is out of scope (P2, documented only).
**Region:** Global storefront, GDPR applied as the baseline for all users.
**Currency:** Single currency USD, stored as integer cents.

---

## 2. Product Decisions

### 2.1 Kept / Cut / Changed / Added
| Type | Decision | Why |
|---|---|---|
| Keep | Cart, reviews with verified purchase badge, order tracking timeline, saved addresses, coupon field at checkout, "Buy it again" | Core shopping mechanics that work |
| Keep | Fast checkout for returning users (saved address) | Reduces friction |
| Cut | Sponsored results, ad slots, Prime upsell interstitials, countdown pressure timers | Dark patterns and clutter |
| Cut | Forced account creation | Guest checkout instead |
| Change | Total price incl. shipping and tax shown in the cart before checkout | No surprise costs |
| Change | Privacy Center ("What we store about you") with one click export and delete | GDPR rights as first class features |
| Change | Consent gated cookies, with "Reject all" as prominent as "Accept all" | GDPR and ePrivacy |
| Change | Recommendations carry a "Why am I seeing this?" label and can be turned off | Right to object to profiling |
| Add | Referral program (Amazon has no consumer referral) | Growth mechanic |
| Add | Notification preference center | Compliance and UX |

### 2.2 Build first vs leave out (product judgement, restate in README)
| Built first (core loop) | Why first |
|---|---|
| Search, category browse, product page | Where every shopper starts |
| Guest cart with live totals | Removes signup friction |
| Checkout with real payment (Stripe test mode) and orders | Proves an end to end working system |
| Accounts and order history | Needed to return and track |
| Minimal admin (products, stock, order status) | A store needs an operator |
| Thin GDPR layer | Cheap by design, strong differentiator |

| Deliberately left out or deferred | Why |
|---|---|
| Multi seller marketplace, ads, Prime, Q&A, live chat, real carriers | Not needed to prove the core experience |
| Referral, wishlist, returns, saved cards | Valuable, but after the core loop is polished |

---

## 3. Tech Stack (fixed)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript (strict) |
| DB | PostgreSQL (Neon or Supabase free tier) |
| ORM and migrations | Drizzle ORM + drizzle-kit |
| Validation | Zod (shared schemas for API and forms) |
| Auth | Better Auth (email and password, Google OAuth, DB sessions). Fallback: Auth.js v5. `VERIFY` current docs before use |
| Password hashing | argon2id |
| Payments | Stripe (test mode): PaymentIntents, webhooks, Customer objects |
| Email | Resend (free tier) |
| Rate limiting and cache | Upstash Redis |
| Search | Postgres full text search plus `pg_trgm` (typeahead) |
| Jobs | Vercel Cron hitting authenticated `/api/cron/*` routes, plus a `jobs` table |
| File storage | Supabase Storage or Vercel Blob (product images, DSAR export files) |
| UI | Tailwind + shadcn/ui |
| Tests | Vitest (unit and integration), Playwright (e2e, P1) |
| CI | GitHub Actions: lint, typecheck, test, build |
| Seed data | DummyJSON products imported by a seed script into our own DB |
| Hosting | Vercel |

**Folder structure**
```
src/
  app/                 # routes only (thin)
    (shop)/ (account)/ (admin)/ api/
  modules/
    auth/ catalog/ search/ cart/ checkout/ orders/ payments/
    vouchers/ referrals/ notifications/ reviews/ wishlist/
    admin/ privacy/
      service.ts  repo.ts  schemas.ts  types.ts  *.test.ts
  lib/  (db, env, logger, errors, money, crypto, audit, retention, consent, ratelimit, mailer)
  components/
docs/  (PRD, data-map, ROPA, retention, cookies, breach-runbook, sub-processors, adr/, ASSUMPTIONS)
```
Layering: `route or action -> service -> repo -> db`. Repos contain queries only. Services contain rules and transactions.

---

## 4. Decision Log

| ID | Decision |
|---|---|
| D-01 | Money: integer cents, currency USD, rounding half up per line item |
| D-02 | Prices stored pre tax. Tax is computed at checkout from destination country and shown as its own line |
| D-03 | Guest carts identified by a signed, HttpOnly, functional cookie `cart_id`; merged into the user cart on login |
| D-04 | Stock is decremented inside the order creation transaction (no long cart reservations). If stock fails at payment time, the order is cancelled and the user is notified |
| D-05 | Orders are created `pending_payment` before payment, and become `paid` only through a **verified Stripe webhook** (never via client redirect) |
| D-06 | Checkout is idempotent using an `Idempotency-Key`. Webhooks are deduplicated via `webhook_events` |
| D-07 | Shipping is simulated: admin advances shipment status, and an optional cron simulator auto advances for demos |
| D-08 | One order level promo code per order. Item level deals and clipped coupons apply first. Gift cards and store credit are payment instruments applied last |
| D-09 | Card data never touches our servers or DB. We store only Stripe IDs (customer, payment method) and last4/brand |
| D-10 | Account deletion: 7 day cool off, then hard delete PII and anonymize retained order records (see 9.4) |
| D-11 | Order and invoice financial records are retained 7 years (legal obligation) in anonymized form after account deletion |
| D-12 | Authorization is enforced in services via `requireUser()` and `requireRole()`. Postgres RLS is optional defense in depth (P1) |
| D-13 | PII columns (phone, address lines) are encrypted at app level with AES 256 GCM, key from env (`PII_ENC_KEY`) |
| D-14 | All timestamps stored UTC (`timestamptz`) |
| D-15 | IDs are UUIDv7 (or cuid2), never sequential integers. Human facing order numbers are separate (`KT-YYYYMMDD-XXXXX`) |
| D-16 | Marketing email requires explicit opt in (double opt in). Transactional emails do not |
| D-17 | Soft delete is not used for personal data. Personal data is hard deleted or anonymized |
| D-18 | Age: users must confirm they are 16 or older at signup (checkbox) |
| D-19 | Schema is created incrementally: M0 creates only the tables listed in its milestone row, later milestones add the rest via migrations |
| D-20 | Deploy to Vercel after M1 and keep the deployment working after every milestone |

---

## 5. Functional Requirements

### 5.1 Authentication and Account (FR-AUTH)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-AUTH-01 | P0 | M3 | Signup with email and password (min 10 chars, strength meter, checked against a small common password list), age confirmation, ToS and Privacy links (marketing consent not pre ticked) |
| FR-AUTH-02 | P0 | M3 | Email verification via signed, expiring link (24h). Unverified accounts cannot save payment methods or leave reviews |
| FR-AUTH-03 | P0 | M3 | Login, logout, session expiry (30 days sliding, 12h for admin) |
| FR-AUTH-04 | P0 | M3 | Forgot and reset password via one time token (1h expiry, single use). Response is identical whether or not the email exists |
| FR-AUTH-05 | P0 | M3 | Throttling: 5 failed logins per 15 min per account and IP, then backoff. Generic error messages |
| FR-AUTH-06 | P1 | M8 | Google OAuth login |
| FR-AUTH-07 | P1 | M8 | Sessions page: list active sessions, revoke one or all |
| FR-AUTH-08 | P1 | M8 | New login email alert |
| FR-AUTH-09 | P0 | M6 | Step up auth (re enter password) for: change email, change password, export data, delete account |
| FR-AUTH-10 | P2 | | TOTP 2FA (mandatory for admin roles when built) |
| FR-AUTH-11 | P0 | M3 | Profile: name, email, phone (optional), language. Editable (right to rectification) |
| FR-AUTH-12 | P0 | M3 | Address book: CRUD, default shipping and billing, max 10 addresses |

### 5.2 Catalog (FR-CAT)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-CAT-01 | P0 | M1 | Category tree (max 2 levels), category listing pages |
| FR-CAT-02 | P0 | M1 | Product detail: title, brand, image gallery, description, specs table, price, stock state, rating summary, reviews area |
| FR-CAT-03 | P0 | M1 | Variants (option groups like size or color) with own SKU, price, stock. Products without variants have one default variant |
| FR-CAT-04 | P0 | M1 | Stock states: In stock, Low stock (5 or fewer), Out of stock. Exact counts are never shown except "Only N left" at 5 or fewer |
| FR-CAT-05 | P1 | M8 | "Customers also bought" (co purchase counts) and "Recently viewed" (stored only with consent) |
| FR-CAT-06 | P1 | M8 | Price history chart (last 90 days) |
| FR-CAT-07 | P1 | M8 | Deals page: time boxed discounted items (see 5.8) |

### 5.3 Search (FR-SRCH)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-SRCH-01 | P0 | M1 | Full text search over title, brand, description, category with weighted ranking |
| FR-SRCH-02 | P0 | M1 | Filters: category, price range, min rating, brand, in stock only |
| FR-SRCH-03 | P0 | M1 | Sort: relevance, price asc and desc, rating, newest. Pagination (page size 24) |
| FR-SRCH-04 | P1 | M1 stretch | Typeahead suggestions (pg_trgm), debounced, rate limited |
| FR-SRCH-05 | P1 | M8 | Recent searches per user, stored only with consent, deletable, 90 day retention |
| FR-SRCH-06 | P0 | M1 | No sponsored or paid ranking. Ranking is documented in `docs/search-ranking.md` |

### 5.4 Cart (FR-CART)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-CART-01 | P0 | M2 | Add, remove, change quantity (1 to 10 per line, capped by stock), with instant UI feedback |
| FR-CART-02 | P0 | M2 | Guest cart via cookie, merged into the user cart on login (sum quantities, cap by stock) |
| FR-CART-03 | P0 | M2 | Cart shows live price. If price changed since add, show a "price changed" notice |
| FR-CART-04 | P0 | M2 | Cart summary: subtotal, discounts, estimated shipping, estimated tax, total. Recomputed server side |
| FR-CART-05 | P0 | M2 | Unavailable or out of stock lines flagged and excluded from checkout |
| FR-CART-06 | P1 | M8 | Save for later |
| FR-CART-07 | P0 | M6 | Abandoned carts (logged in) purged after 30 days |

### 5.5 Wishlist (FR-WISH)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-WISH-01 | P1 | M8 | Add or remove product to a single default wishlist (logged in only), move to cart |
| FR-WISH-02 | P2 | | Multiple and shareable lists |

### 5.6 Checkout, Billing, Payment (FR-CHK)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-CHK-01 | P0 | M4 | Single page checkout: contact, shipping address, shipping method, promo code and gift card box, payment, order review. Inline validation, form state preserved on error |
| FR-CHK-02 | P0 | M4 | Guest checkout (email and address). Optional "create account" after purchase |
| FR-CHK-03 | P0 | M4 | Shipping methods from `shipping_methods` (Standard, Express, free over threshold, configurable) |
| FR-CHK-04 | P0 | M4 | Tax computed per destination country from `tax_rates` (flat rate per country, default 0) |
| FR-CHK-05 | P0 | M4 | Payment via Stripe Elements (PaymentIntent). 3DS supported. Test cards only |
| FR-CHK-06 | P1 | M8 | Saved payment methods (Stripe Customer and PaymentMethod). We store brand, last4, expiry only |
| FR-CHK-07 | P0 | M4 | Billing address (same as shipping toggle) |
| FR-CHK-08 | P0 | M4 | Place order: one transaction creates the order and items with **price snapshots**, decrements stock, creates a PaymentIntent. Idempotent |
| FR-CHK-09 | P0 | M4 | Payment failed: order stays `pending_payment` for 30 min, then auto cancelled and stock restored (cron) |
| FR-CHK-10 | P0 | M4 | Order confirmation page and email |
| FR-CHK-11 | P1 | M8 | Invoice (HTML or PDF) per paid order with tax breakdown |
| FR-CHK-12 | P0 | M4 | Totals are re validated at webhook time (amount matches order total) |
| FR-CHK-13 | P1 | M8 | "Buy now" for logged in users with default address and saved payment method |

### 5.7 Orders (FR-ORD)
**State machine**
```
pending_payment -> paid -> processing -> shipped -> delivered
pending_payment -> cancelled | payment_failed
paid | processing -> cancelled (refund issued)
delivered -> return_requested -> return_approved -> returned -> refunded
delivered -> return_requested -> return_rejected
paid onward -> partially_refunded (admin partial refund)
```
Illegal transitions must throw. Every transition writes `order_events` (actor, from, to, timestamp, note).

| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-ORD-01 | P0 | M4 | Order history list (paginated) and order detail with timeline |
| FR-ORD-02 | P0 | M4 | Guest order lookup via order number and email (rate limited) or a signed link in the confirmation email |
| FR-ORD-03 | P0 | M4 | Customer cancel while `pending_payment`, `paid`, or `processing`. Stock restored, refund via Stripe |
| FR-ORD-04 | P1 | M8 | Return request within 30 days of delivery, with reason. Admin approves or rejects and triggers a refund |
| FR-ORD-05 | P1 | M8 | Reorder ("Buy it again") |
| FR-ORD-06 | P0 | M4 | Tracking timeline (simulated events: Processing, Shipped with carrier and tracking number, Out for delivery, Delivered) |
| FR-ORD-07 | P0 | M4 | Refunds recorded in `refunds` and mirrored from Stripe webhooks |

### 5.8 Vouchers, Coupons, Gift Cards, Deals (FR-VCH)
**Voucher types:** `percent`, `fixed_amount`, `free_shipping`.
**Constraints:** min spend, applicable categories or products, first order only, per user limit, global limit, start and end, stackable with deals flag, active flag.
The pricing engine (Section 6) accepts an optional voucher from M2 onward, so these features plug in without refactoring.

| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-VCH-01 | P0 | M7 | Enter promo code at checkout. Validation returns a specific, friendly error (expired, min spend not met, already used, not applicable) |
| FR-VCH-02 | P0 | M7 | Redemptions recorded atomically (unique constraint per user per code where limited) to prevent races |
| FR-VCH-03 | P1 | M8 | **Claimable coupons:** product pages show "Clip coupon". Clipped coupons auto apply at checkout when eligible |
| FR-VCH-04 | P1 | M8 | **My Vouchers** page: available, used, expired, with expiry countdown |
| FR-VCH-05 | P1 | M8 | **Gift cards:** admin issued codes with balance, redeemed into account balance, auto applied at checkout up to the payable amount. Partial use supported. Ledgered |
| FR-VCH-06 | P1 | M8 | **Store credit** ledger (refunds to credit, referral rewards). Applied like a gift card |
| FR-VCH-07 | P1 | M8 | **Deals:** admin creates a deal (variant, deal price, start, end, quantity limit). Product page shows deal price and "X% claimed", real numbers only |
| FR-VCH-08 | P0 | M2 | Pricing engine order (Section 6) is the only place discounts are computed |

### 5.9 Referral System (FR-REF)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-REF-01 | P1 | M8 | Each verified user gets a unique referral code and link `/r/{code}` |
| FR-REF-02 | P1 | M8 | Referee signs up via the link (code carried in the signup form or query, **no tracking cookie**) and receives a welcome voucher (config in admin) |
| FR-REF-03 | P1 | M8 | Referrer earns store credit only after the referee's first order is **delivered and past the return window** |
| FR-REF-04 | P1 | M8 | Anti abuse: no self referral (same account, email, or normalized address), max N rewards per referrer per month, one reward per referee, admin can void |
| FR-REF-05 | P1 | M8 | Referral dashboard: link, invited count, pending and earned rewards |
| FR-REF-06 | P1 | M8 | Reward events produce notifications (in app and email) |
| FR-REF-07 | P0 (doc) | M6 | Referral data is personal data: listed in the data map, included in export and erasure |

### 5.10 Reviews and Ratings (FR-REV)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-REV-01 | P1 | M7 | Verified buyers (delivered order containing the product) can post 1 review per product: 1 to 5 stars, title, body |
| FR-REV-02 | P1 | M7 | Rating aggregates (avg, count, distribution) maintained transactionally |
| FR-REV-03 | P1 | M8 | "Helpful" votes (one per user per review) |
| FR-REV-04 | P1 | M8 | Report review, admin moderation queue |
| FR-REV-05 | P1 | M7 | Reviews display first name and last initial only, and reviewers can edit or delete their reviews |

Seeded products may show seed ratings so the product page looks complete from M1. Mark seed ratings clearly in the seed script.

### 5.11 Notifications (FR-NTF)
**Channels:** in app (bell and list, unread count) and email. Web push is P2.
**Architecture:** transactional outbox (`notifications` and `email_outbox`), processed by a cron worker with retry, backoff and a dead letter state. Templates are versioned in code.

| Event key | Channels | Type |
|---|---|---|
| `auth.verify_email` | email | transactional (always) |
| `auth.password_reset` | email | transactional |
| `auth.new_login` | email | security (always) |
| `order.placed` | in app, email | transactional |
| `order.payment_failed` | in app, email | transactional |
| `order.shipped` and `order.delivered` | in app, email | transactional |
| `order.cancelled` and `refund.issued` | in app, email | transactional |
| `return.approved` and `return.rejected` | in app, email | transactional |
| `voucher.received` | in app | service |
| `voucher.expiring` (3 days) | in app, email (opt in) | marketing |
| `referral.welcome` and `referral.reward` | in app, email | service |
| `alert.back_in_stock` | in app, email | user requested |
| `alert.price_drop` | in app, email | user requested |
| `privacy.export_ready` | email | transactional |
| `privacy.deletion_scheduled` and `privacy.deletion_done` | email | transactional |
| `privacy.consent_changed` | email | transactional |

| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-NTF-01 | P1 | M7 | In app notification center: list, mark read, mark all read, unread badge |
| FR-NTF-02 | P0 | M3, M4 | Transactional emails for auth and order events |
| FR-NTF-03 | P1 | M8 | Preference center: per event group, per channel toggles. Security and transactional cannot be disabled |
| FR-NTF-04 | P1 | M8 | Back in stock and price drop alerts (opt in per product) |
| FR-NTF-05 | P1 | M8 | Marketing emails only with opt in consent. One click unsubscribe (`List-Unsubscribe` header) |
| FR-NTF-06 | P0 | M3, M4 | Emails contain no more personal data than needed. Never include full addresses or payment details |
| FR-NTF-07 | P1 | M8 | Notification retention: in app 90 days, outbox 90 days |

### 5.12 Admin Panel (FR-ADM)
Route group `/admin`, requires role `admin` or `support`, separate layout, stricter session (12h), every mutating action audit logged.

| ID | P | Milestone | Module | Requirement |
|---|---|---|---|---|
| FR-ADM-01 | P1 | M8 | Dashboard | KPIs: revenue (7 and 30 days), orders by status, low stock count, new users, open DSAR requests with due dates |
| FR-ADM-02 | P0 | M5 | Products | CRUD, variants, images, publish or unpublish, category assignment |
| FR-ADM-03 | P1 | M8 | Products | CSV bulk import and export with validation report |
| FR-ADM-04 | P0 | M5 | Inventory | Manual stock adjustments with reason, written to `inventory_ledger`, low stock threshold |
| FR-ADM-05 | P0 | M5 | Orders | List, filter, search, detail. Advance status (validated by the state machine), add tracking, cancel, full or partial refund |
| FR-ADM-06 | P1 | M8 | Returns | Queue: approve or reject, trigger refund |
| FR-ADM-07 | P1 | M8 | Customers | List and search, view profile and orders (support sees masked email and phone), disable account, trigger password reset |
| FR-ADM-08 | P1 | M7 | Vouchers | CRUD for codes, coupons, gift cards, deals. Usage stats |
| FR-ADM-09 | P1 | M8 | Referrals | Config (reward amounts, delay, limits), view referrals, void reward |
| FR-ADM-10 | P1 | M8 | Reviews | Moderation queue |
| FR-ADM-11 | P1 | M8 | Notifications | View outbox status and failures, retry failed |
| FR-ADM-12 | P0 | M6 | Privacy | DSAR queue (type, requester, status, due date, SLA timer), run export, run erasure, notes. Consent log lookup |
| FR-ADM-13 | P0 | M5 | Audit log | Searchable, append only viewer (actor, action, entity, timestamp, IP hash) |
| FR-ADM-14 | P1 | M8 | Settings | Shipping methods, tax rates, free shipping threshold, return window, low stock threshold |
| FR-ADM-15 | P0 | M5 | Roles | `admin` (all), `support` (orders, masked customers, returns; no DSAR execution, no exports) |

### 5.13 Static and Legal Pages (FR-LEG)
P0 (M1 for links, M6 for final content): Privacy Policy, Cookie Policy, Terms, Returns Policy, Contact and DPO contact, FAQ. Content is templated and marked "template, needs legal review".

---

## 6. Pricing Engine (single source of truth)

Implemented in `modules/checkout/pricing.ts`, pure and fully unit tested. Built in M2 with the voucher and instrument inputs optional. Order of operations:

1. **Line base** = variant unit price times qty
2. **Item level discounts:** active deal price, then clipped coupon (best single item level discount per line, no stacking within a line)
3. **Subtotal** = sum of discounted lines
4. **Order level promo code** (percent or fixed, capped at subtotal, min spend checked on the post item discount subtotal). `free_shipping` affects step 5
5. **Shipping** = method price (0 if free shipping voucher or over the threshold)
6. **Tax** = (subtotal after promo plus shipping) times country rate, rounded half up
7. **Total** = subtotal after promo plus shipping plus tax
8. **Instruments:** gift card, then store credit, applied up to the total
9. **Payable** (charged via Stripe) = total minus instruments (min 0. If 0, skip Stripe and mark paid)

Every order stores the full breakdown snapshot (`orders.pricing_json` plus total columns). Fixed discounts are distributed across lines proportionally (for correct refunds and tax).

---

## 7. Data Model

Created incrementally (D-19). **M0 creates only:** users and auth tables for the chosen auth library, `addresses`, `consents`, `audit_log`, `categories`, `products`, `product_variants`, `product_images`, `inventory_ledger`, `carts`, `cart_items`, `orders`, `order_items`, `order_events`, `payments`, `webhook_events`, `idempotency_keys`. Everything else is added in the milestone that needs it.

`users`(id, email unique, email_verified_at, password_hash, role, status[active|disabled|pending_deletion], name, phone_enc, locale, referral_code, age_confirmed_at, created_at)
`sessions`, `accounts` (OAuth) per auth library
`addresses`(id, user_id, label, name_enc, line1_enc, line2_enc, city, region, postal_code, country, phone_enc, is_default_shipping, is_default_billing)
`consents`(id, user_id?, anon_id?, category[necessary|functional|analytics|marketing], granted bool, policy_version, source, created_at) append only
`dsar_requests`(id, user_id, type[access|export|erasure|rectification|restriction|objection], status[received|verifying|in_progress|completed|rejected], due_at, completed_at, notes)
`audit_log`(id, actor_id, actor_role, action, entity_type, entity_id, meta_json (no PII), ip_hash, created_at) append only
`categories`(id, parent_id, slug, name)
`products`(id, slug, title, brand, description, category_id, status, rating_avg, rating_count, search_vector)
`product_variants`(id, product_id, sku unique, options_json, price_cents, compare_at_cents, stock_qty, low_stock_threshold)
`product_images`(id, product_id, url, alt, position)
`price_history`(variant_id, price_cents, at)
`inventory_ledger`(id, variant_id, delta, reason[order|cancel|adjust|return], ref_id, actor_id, at)
`carts`(id, user_id?, guest_token_hash?, updated_at) `cart_items`(cart_id, variant_id, qty, saved_for_later, added_price_cents)
`wishlist_items`(user_id, product_id, created_at)
`orders`(id, number unique, user_id?, guest_email_enc?, status, currency, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, instruments_cents, payable_cents, pricing_json, shipping_address_json_enc, billing_address_json_enc, voucher_id?, idempotency_key unique, placed_at, anonymized_at)
`order_items`(id, order_id, variant_id, title_snapshot, sku_snapshot, unit_price_cents, qty, discount_cents, tax_cents)
`order_events`(id, order_id, from_status, to_status, actor, note, at)
`payments`(id, order_id, stripe_payment_intent_id, status, amount_cents, method_brand, method_last4, created_at)
`refunds`(id, order_id, payment_id, amount_cents, reason, stripe_refund_id, status, at)
`returns`(id, order_id, status, reason, requested_at, decided_at)
`shipments`(id, order_id, carrier, tracking_number, status, shipped_at, delivered_at)
`stripe_customers`(user_id, stripe_customer_id) `saved_payment_methods`(id, user_id, stripe_pm_id, brand, last4, exp_month, exp_year, is_default)
`vouchers`(id, code unique, type, value, min_spend_cents, applies_to_json, first_order_only, per_user_limit, global_limit, used_count, starts_at, ends_at, is_active, is_public_coupon)
`voucher_redemptions`(id, voucher_id, user_id?, order_id, at) `coupon_clips`(user_id, voucher_id, at)
`gift_cards`(id, code_hash, initial_cents, balance_cents, status, expires_at) `store_credit_ledger`(id, user_id, delta_cents, reason, ref_id, at)
`deals`(id, variant_id, deal_price_cents, starts_at, ends_at, qty_limit, qty_claimed)
`referrals`(id, referrer_id, referee_id, code, status[pending|qualified|rewarded|voided], reward_cents, qualified_at)
`reviews`(id, product_id, user_id, order_id, rating, title, body, status[visible|hidden|pending], helpful_count) `review_votes`, `review_reports`
`notifications`(id, user_id, event_key, payload_json, read_at, created_at) `notification_prefs`(user_id, group, channel, enabled)
`email_outbox`(id, user_id?, to_enc, template, payload_json, status[queued|sent|failed|dead], attempts, next_attempt_at)
`stock_alerts` and `price_alerts`(user_id, variant_id, threshold_cents?)
`search_queries`(id, user_id, q, at) consent gated
`webhook_events`(id[stripe event id] PK, type, processed_at) `idempotency_keys`, `jobs`, `settings`, `shipping_methods`, `tax_rates`

Required indexes: `products.search_vector` (GIN), trigram on `title`, `orders(user_id, placed_at)`, `order_items(order_id)`, `voucher_redemptions(voucher_id, user_id)`, `notifications(user_id, read_at)`.

---

## 8. API Surface (route groups)

Server actions may be used for UI mutations, but each calls the same service. Public HTTP routes:

- `POST /api/auth/*` (library managed) and `/api/account/*` (profile, addresses, sessions)
- `GET /api/products`, `GET /api/products/:slug`, `GET /api/search?q=`, `GET /api/search/suggest`
- `/api/cart` (GET, POST item, PATCH item, DELETE item, POST merge)
- `POST /api/checkout/quote` (pricing preview), `POST /api/checkout/place` (Idempotency-Key required)
- `POST /api/webhooks/stripe` (signature verified, deduplicated)
- `/api/orders`, `/api/orders/:id`, `POST /api/orders/:id/cancel`, `/api/orders/:id/return`
- `/api/vouchers/validate`, `/api/vouchers/mine`, `POST /api/coupons/:id/clip`
- `/api/notifications` (list, read, prefs), `/api/alerts`
- `/api/referrals/me`
- `/api/reviews`, `/api/wishlist`
- `/api/privacy/consent`, `/api/privacy/export`, `/api/privacy/delete`, `/api/privacy/requests`
- `/api/admin/*` (role guarded), `/api/cron/*` (secret guarded), `GET /api/health`

All responses are typed: `{ data }` or `{ error: { code, message } }`. Errors never leak stack traces or internals.

---

## 9. GDPR and Compliance Requirements (FR-GDPR)

> Positioning: "GDPR ready by design." Never claim "fully compliant." Real production use needs legal review, signed DPAs, and a DPO or representative assessment. List remaining gaps in `docs/COMPLIANCE-GAPS.md`.
> Delivery plan: foundations (headers, audit, retention constants, consent constants, encrypted PII, documents) in M0. Cookie banner in M1. Privacy by design as features are built. Privacy Center, export, erasure, retention jobs and DSAR queue in M6.

### 9.1 Principles mapping
| Principle (Art. 5) | Implementation |
|---|---|
| Lawfulness, fairness, transparency | Privacy policy, legal basis table in `docs/data-map.md`, Privacy Center |
| Purpose limitation | Every field has a documented purpose. No secondary use without consent |
| Data minimisation | Collect only what checkout needs. Phone optional. No date of birth (age confirmation only) |
| Accuracy | Users can edit profile and addresses |
| Storage limitation | Retention jobs (9.5) |
| Integrity and confidentiality | argon2id, TLS, field encryption, access control, audit logging |
| Accountability | ROPA, ADRs, audit log, DSAR SLA tracking, breach runbook |

### 9.2 Consent and cookies (ePrivacy)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-GDPR-01 | P0 | M1 | Cookie banner on first visit: Accept all, **Reject all (equal prominence)**, Customize. Categories: necessary, functional, analytics, marketing. No non essential cookies or storage before consent |
| FR-GDPR-02 | P0 | M1 | Consent stored (`consents`, append only) with policy version, timestamp, source. Anonymous visitors use a random `anon_id` held only in the necessary consent cookie |
| FR-GDPR-03 | P0 | M1 | Withdrawal is as easy as granting (footer "Cookie settings" link, later also the Privacy Center). Takes effect immediately |
| FR-GDPR-04 | P0 | M6 | Re prompt consent when the policy version changes |
| FR-GDPR-05 | P0 | M0 | Cookie inventory in `docs/cookies.md` (name, purpose, category, duration) |
| FR-GDPR-06 | P1 | M8 | Marketing email: double opt in, unchecked by default, separate from ToS acceptance |
| FR-GDPR-07 | P0 | M0 | Third party embeds (fonts, maps, analytics) are self hosted or consent gated. Use self hosted fonts |

### 9.3 Data subject rights (Privacy Center at `/account/privacy`, built in M6)
| Right | ID | P | Implementation |
|---|---|---|---|
| Access and portability (Art. 15, 20) | FR-GDPR-10 | P0 | "Download my data" (step up auth). Async job builds a ZIP of JSON and CSV: profile, addresses, orders, reviews, wishlist, notifications, consents, referrals, search history, vouchers. Delivered via a 24h signed link, emailed. Logged in `audit_log` and `dsar_requests` |
| Rectification (Art. 16) | FR-GDPR-11 | P0 | Edit profile and addresses in app (built in M3) |
| Erasure (Art. 17) | FR-GDPR-12 | P0 | See 9.4 |
| Restriction (Art. 18) | FR-GDPR-13 | P1 | Request form to pause non essential processing. Sets account flag `processing_restricted` |
| Objection (Art. 21) | FR-GDPR-14 | P1 | Toggles: personalised recommendations, marketing, analytics |
| Automated decisions (Art. 22) | FR-GDPR-15 | P0 (doc) | Document that there are no solely automated decisions with legal effect |
| Request tracking | FR-GDPR-16 | P0 | All requests visible to the user (status, due date) and to admins with an SLA timer (30 days) |

### 9.4 Erasure procedure (must be exact)
1. User requests deletion (step up auth). Blocked if any order is `pending_payment`, `paid`, `processing`, or `shipped`. The user is told to wait or cancel.
2. Status becomes `pending_deletion` and a **7 day cool off** begins. Login is allowed and the user can cancel the deletion. Confirmation email sent.
3. After 7 days the cron job executes in a transaction:
   - Delete: sessions, OAuth accounts, addresses, wishlist, cart, notifications, notification prefs, search queries, coupon clips, alerts, saved payment method rows, consent rows linked to `user_id` (keep an anonymized proof of consent hash if required, documented)
   - Stripe: delete the Customer via API
   - Reviews: anonymize (author becomes "Deleted user", `user_id` nulled). Default stated on the deletion screen
   - Orders and invoices: **retain but anonymize** (replace name, address, email, phone with a static token, unlink `user_id`), keep amounts, tax, dates, SKUs (D-11)
   - Referrals: null personal links, keep aggregate counts, void unpaid pending rewards
   - Store credit and gift card balance: forfeited unless refunded (stated before confirming)
   - Users row: hard delete, or a minimal tombstone (id only) if needed for foreign keys
4. Write an audit entry (no PII) and send a final confirmation email to the old address, then purge it from the outbox.
5. Guest orders: erasure by email and verification link.

### 9.5 Retention schedule (`docs/retention.md`, constants in `src/lib/retention.ts`, enforced by cron in M6)
| Data | Retention |
|---|---|
| Unverified accounts | 7 days |
| Sessions | 30 days sliding, deleted on expiry |
| Guest carts and abandoned carts | 30 days |
| Password reset and verification tokens | Deleted on use or expiry |
| Search history | 90 days |
| Notifications and email outbox | 90 days |
| DSAR export files | 24 hours |
| DSAR request records | 3 years |
| Audit log | 12 months |
| Consent records | Life of account plus 3 years (proof) |
| Orders and invoices (anonymized after deletion) | 7 years |
| Inactive accounts | P2: notify at 23 months, delete at 24 |

Retention jobs are idempotent, logged (counts only), and covered by tests.

### 9.6 Security controls (Art. 32)
| ID | P | Milestone | Requirement |
|---|---|---|---|
| FR-SEC-01 | P0 | M0 | argon2id hashing. Secrets only in env. `.env.example` committed, real values never |
| FR-SEC-02 | P0 | M0 | HTTPS only, HSTS, Secure, HttpOnly, SameSite=Lax cookies, CSRF protection for mutations |
| FR-SEC-03 | P0 | M0 | Security headers: nonce based CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors |
| FR-SEC-04 | P0 | every milestone | Zod validation on every input. Output encoding. Parameterized queries only |
| FR-SEC-05 | P0 | M3, M4 | Rate limits (Upstash): login 5 per 15 min, signup 5 per hour per IP, password reset 3 per hour, search 60 per min, checkout 10 per min, order lookup 10 per hour, DSAR 3 per day |
| FR-SEC-06 | P0 | M0 | Field level encryption for phone and address lines (AES 256 GCM, `PII_ENC_KEY`, versioned key id for rotation) |
| FR-SEC-07 | P0 | every milestone | IDOR prevention: all resource access checks ownership in the service layer, with tests that user A cannot access user B's cart, order, address or notification |
| FR-SEC-08 | P0 | M4 | Stripe webhook signature verification. Secrets never exposed to the client |
| FR-SEC-09 | P0 | M0 | Structured JSON logging (pino), request ID, **PII redaction list**, IPs stored only as salted hashes, 30 day log retention |
| FR-SEC-10 | P0 | M0 | Dependency audit in CI (`npm audit`), lockfile committed |
| FR-SEC-11 | P1 | M8 | Postgres RLS as defense in depth |
| FR-SEC-12 | P0 | M5 | Admin image uploads: type and size allowlist, randomized names |

### 9.7 Governance documents (in `docs/`)
M0 creates each file with real starter content drawn from this PRD (not empty stubs). M6 completes them against the built system. Each file is marked "template, needs legal review".
- `data-map.md` (every field: purpose, legal basis, retention, recipients, location)
- `ROPA.md` (Art. 30 record of processing)
- `sub-processors.md` (Vercel, Neon or Supabase, Stripe, Resend, Upstash: purpose, data, region, DPA link)
- `breach-runbook.md` (detect, contain, assess, notify the authority within 72h, notify users if high risk, log)
- `retention.md`, `cookies.md`, `COMPLIANCE-GAPS.md`
- `DPIA-lite.md` (referral system and recommendations, the two activities with profiling risk)
- `international-transfers.md` (note on SCCs and the Data Privacy Framework for US processors)
- `privacy-policy.md` template (plain language, layered)

### 9.8 Legal basis reference (starter, refine in data-map)
| Processing | Basis |
|---|---|
| Account, orders, payment, shipping | Contract (6(1)(b)) |
| Invoices, tax records | Legal obligation (6(1)(c)) |
| Fraud prevention, security logs, rate limiting | Legitimate interest (6(1)(f)) |
| Marketing emails, analytics, recommendation personalization, search history | Consent (6(1)(a)) |
| Referral rewards | Contract or legitimate interest (documented in DPIA-lite) |

---

## 10. Non Functional Requirements

| Area | Target |
|---|---|
| Performance | Product and list pages p95 under 500ms server time on 200+ seeded products. Lighthouse performance 85 or higher. Catalog pages use caching or ISR where safe |
| Accessibility | WCAG 2.1 AA basics: semantic HTML, labels, focus states, contrast, keyboard operable checkout |
| Reliability | Idempotent checkout and webhooks. Cron jobs safe to re run |
| Observability | Structured logs, request IDs, error pages, `/api/health` |
| Code quality | ESLint and Prettier, TS strict, no `any` without a comment, conventional commits, ADRs |
| Testing | Unit: pricing engine, voucher validation, state machine, stock logic, retention, erasure, encryption, IDOR checks. Integration: checkout and webhook flow. E2E (P1): guest happy path |
| i18n | English only (strings centralized to allow later i18n) |
| Responsive | Mobile first layouts |

### 10.1 UX Quality Requirements (judged directly)
1. **States:** every data view has a loading skeleton, an empty state with a next action, and an error state with retry.
2. **Feedback:** add to cart, quantity changes, address saves and errors give instant visible feedback (optimistic updates with rollback, toasts).
3. **Mobile first:** sticky add to cart bar on product pages, thumb reachable controls, filters in a bottom sheet, checkout usable one handed.
4. **Speed feel:** no layout shift, lazy loaded images with fixed aspect ratios, prefetch on hover or focus for product links.
5. **Forms:** inline validation, correct input types and autocomplete attributes, form state preserved on error, clear error copy.
6. **Clarity:** total cost visible before checkout, stock and delivery states are honest, no dark patterns.
7. **Consistency:** one design token set (colors, type scale, spacing, radius), one component library, one interaction pattern per task.
8. **Accessibility:** visible focus, keyboard navigation for menus, filters and checkout, sufficient contrast, alt text.
9. **Microcopy:** short, plain, human. No filler text, no placeholder lorem ipsum in shipped screens.

---

## 11. Key Acceptance Criteria (Given / When / Then)

**AC-1 Checkout integrity:** Given a cart with item A ($10) and a tampered client total of $1, when placing an order, then the server ignores the client total and charges the recomputed amount.
**AC-2 Idempotency:** Given two identical `place` requests with the same Idempotency-Key, then exactly one order and one PaymentIntent exist.
**AC-3 Stock race:** Given stock = 1 and two simultaneous checkouts, then exactly one succeeds and the other fails with a clear out of stock message. Stock is never negative.
**AC-4 Webhook:** Given a `payment_intent.succeeded` event delivered twice, then the order becomes `paid` once and only one confirmation email is sent. Given an invalid signature, then it is rejected with 400.
**AC-5 Voucher limits:** Given a voucher with per user limit 1, when the same user applies it in two concurrent orders, then only one redemption succeeds.
**AC-6 IDOR:** Given user A, when requesting user B's order, address, or notification by ID, then the response is 404 (not 403).
**AC-7 Consent:** Given a new visitor, when the page loads, then no analytics or marketing cookies or requests exist until consent is granted. "Reject all" results in only necessary cookies.
**AC-8 Export:** Given an authenticated user who completes step up, when they request export, then they receive a signed, expiring link to a ZIP containing all their data sets, and an audit and DSAR record exists.
**AC-9 Erasure:** Given a user with delivered orders who requests deletion and waits 7 days, then personal data is removed or anonymized per 9.4, orders remain with anonymized PII, the Stripe customer is deleted, and a test asserts no row in any table still contains their email.
**AC-10 Referral:** Given the referee's first order is delivered and past the return window, then the referrer receives store credit exactly once. Self referral yields none.
**AC-11 Logs:** Given any request flow in tests, then log output contains no email, name, address, or card data.
**AC-12 State machine:** Given an order `shipped`, when an admin tries to set it to `pending_payment`, then it is rejected.
**AC-13 Core loop:** Given a new guest on a phone, when they search, open a product, add to cart and pay with a Stripe test card, then they land on a confirmation page and receive an email, with no dead ends or unhandled errors.

---

## 12. Reference Audit Checklist (hour 1 on live Amazon, mark VERIFY items)

Capture and note behavior for: header and search bar with category dropdown, search results with filters and sort, product page (gallery, variants, buy box, deal badge, coupon clip, delivery estimate, reviews), cart page (save for later, quantity control), checkout steps (address, delivery options, payment, promo and gift card box, review), order confirmation, "Your Orders" (filters, buy again, track package, return item), Account hub, Wishlist, Notifications, Gift card page, Deals page, cookie banner, Seller Central (inspiration for admin only).
Note: public sources on Amazon's internals are unreliable. Treat this PRD as a scoped interpretation, not a claim about how Amazon works internally.

---

## 13. Out of Scope

Multi vendor marketplace and seller onboarding, Prime and subscriptions, real carrier integrations, live chat, product Q&A, ads and sponsored listings, multi currency, multi language, mobile apps, live shipping rate APIs, real tax engines, fraud ML, web push (P2), multi warehouse inventory, 2FA (P2), real KYC.

---

## 14. Build Order (milestones and cut line)

| M | Scope | Rough time |
|---|---|---|
| M0 | Foundation: scaffold, UX foundation (tokens, layout, shared components), DB and schema (M0 tables), seed script, utilities (env, logger, errors, money, crypto, audit, retention, consent), security headers, governance docs with starter content, CI, AGENTS.md, CHANGELOG.md | Before the clock if allowed |
| M1 | Browse: home, category pages, search with filters and sort, product page, cookie banner and consent log, legal page links. **Deploy to Vercel** | 1.5h |
| M2 | Cart: guest cart, cart page or drawer, pricing engine with tests | 1h |
| M3 | Accounts: signup with age confirmation, email verification, login, password reset, profile, addresses, cart merge | 1.5h |
| M4 | Checkout: shipping method, tax, Stripe payment, webhook, orders and state machine, order history and detail, guest lookup, confirmation email, cancel | 2h |
| M5 | Minimal admin: products, inventory, orders and status updates, roles, audit log viewer | 1.5h |
| **CUT LINE** | **Deploy. Everything above must work end to end (AC-13).** | |
| M6 | GDPR: Privacy Center (consent management, export, deletion), step up auth, retention cron jobs, DSAR queue in admin, policy version reprompt, complete all governance docs, abandoned cart purge | 2h |
| M7 | Vouchers at checkout and admin, reviews, in app notifications | 1.5h |
| M8 | Referral, wishlist, returns, saved payment methods, deals, coupon clips, gift cards, preference center, dashboard, and remaining P1 items | Only if time remains |
| Final | README with what was built first, what was left out and why (Section 2), what is built versus designed only, known gaps, test credentials | 1h |

If time runs short, ship M0 to M6 solid rather than M0 to M8 shaky. Unbuilt P1 and P2 features stay documented in this PRD with their data models where cheap.

---

## 15. Deliverables

1. Live deployed URL (seeded data, test admin and customer credentials in the README)
2. Repo with clean commit history and passing CI
3. `README.md`: architecture overview, setup, env vars, what was built first and what was left out and why, what is built versus designed only, known gaps
4. `docs/` governance set (9.7)
5. `CHANGELOG.md`

---

## 16. Glossary

**DSAR:** data subject access or rights request. **PII:** personally identifiable information. **ROPA:** record of processing activities. **DPIA:** data protection impact assessment. **SKU:** stock keeping unit. **Instrument:** a payment method that is not a card (gift card, store credit). **Outbox:** table of pending side effects processed reliably by a worker.