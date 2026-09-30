# ADR-0004: Payment flow — order first, webhook confirms

**Status:** Accepted
**Date:** 2026-09-30

## Flow

1. `POST /api/checkout/place` requires an `Idempotency-Key` (UUID) header. In one database transaction it recomputes pricing server-side from the cart (destination tax rate, chosen shipping method), decrements stock with `UPDATE … WHERE stock_qty >= qty RETURNING id` (aborting and naming the failing lines if any update matches no row), inserts the order as `pending_payment` with encrypted address and contact email, order_items snapshots, inventory_ledger rows, an order event, and the idempotency key record. Only after commit is the Stripe PaymentIntent created with the same idempotency key; a Stripe failure compensates by cancelling the order and restoring stock in a second transaction.

2. The order becomes **paid only through the verified webhook** (`payment_intent.succeeded`): signature verified, event deduplicated via `webhook_events`, and the intent checked against the order (metadata order id, amount = payable_cents, currency) by a pure verify function. On mismatch the order stays unpaid, an ids-only error is logged, and 200 is returned so Stripe does not retry forever.

3. A payable of zero skips Stripe and marks paid through the same handler.

## Idempotency

The client generates one UUID per checkout attempt and reuses it on retry. A repeat place call finds the existing order by key and returns a fresh client secret retrieved from Stripe — no second order, no second intent (Stripe also idempotently keys the intent). Concurrent duplicates are blocked by the idempotency key row and the order number unique index (3-attempt collision retry on `KT-YYYYMMDD-XXXXX`).

## Stock

Stock is decremented in the order-creation transaction (PRD D-04) — no cart reservations. Compensation restores it with ledger rows (reason `cancel`) if Stripe setup fails.

## Lazy expiry instead of frequent cron

`expireStaleOrders()` cancels `pending_payment` orders older than 30 minutes, restores stock with ledger rows, cancels the PaymentIntent best-effort, and writes order events. It runs bounded to 20 orders at the start of every place-order call and via a daily `GET /api/cron/expire-orders` (bearer `CRON_SECRET`, one `vercel.json` cron entry). This keeps the flow correct without a per-minute scheduler on the free tier.

## Guest token in the URL fragment

Guest orders get a one-time 32-byte access token returned only by the place call; the database stores its SHA-256 hash. The token is passed in the success URL's **fragment** (`#token`) — fragments are not sent to servers or analytics — and mirrored into `sessionStorage` for order page access via the `x-order-token` header. Order pages accept the signed-in owner or a matching token hash; anything else is a calm 404 (PRD FR-SEC-07). The confirmation email for guests links to the success page (which reads the session-stored token) rather than embedding the token itself.
