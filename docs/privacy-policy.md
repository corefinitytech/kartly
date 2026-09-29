# Privacy Policy

> **Template — needs legal review.** Layered, plain language. Final version ships in M6 (FR-LEG). Version: 2026-09-29.1.

**Summary (layer 1):** We store what a shop needs to sell you things: your account details, addresses, orders and payment metadata (never full card numbers). We do not sell your data. You can export or delete everything from the Privacy Center, and reject all optional cookies with one click.

## Who we are
Kartly, [legal entity, address]. Contact and DPO: [email / /legal/contact].

## What we store and why
See the full field-by-field table at `docs/data-map.md` (also available in the Privacy Center). In short:

- **Account (contract):** email, name, optional phone (encrypted), password hash, language, age confirmation.
- **Orders (contract, legal obligation):** addresses (encrypted), order lines, amounts, invoices. Retained 7 years for tax law, anonymized after account deletion.
- **Payments (contract):** handled by Stripe. We store only brand, last 4 digits and Stripe ids. Card numbers never reach our servers.
- **Security (legitimate interest):** salted IP hashes, audit entries without personal data, 12 month retention.
- **Optional (consent only):** analytics, marketing email, personalized recommendations, recently viewed. All off unless you opt in; withdrawal is one click and immediate.

## Cookies
Only strictly necessary cookies before consent (cart, session, consent record). Reject all is as prominent as Accept all. Full inventory: `docs/cookies.md`.

## Your rights
Access, export (portability), rectification, erasure, restriction, objection. Request them in the Privacy Center (`/account/privacy`) or by contacting us. We respond within 30 days and track every request. No solely automated decisions with legal effect are made about you.

## Deleting your account
Deletion has a 7 day cool off, then: personal data is hard deleted, orders are kept 7 years in anonymized form for tax law, reviews become "Deleted user", and your Stripe customer record is deleted.

## Sharing
Processors only: hosting, database, payments (Stripe), email (Resend), cache/rate limiting (Upstash). List with purposes and DPAs: `docs/sub-processors.md`. We never sell personal data.

## International transfers
Some processors operate in the US. Transfers rely on the EU-US Data Privacy Framework or Standard Contractual Clauses (see `international-transfers.md`).

## Security
TLS, argon2id password hashing, AES-256-GCM field encryption for addresses and phone, audit logging, least privilege access.

## Changes
We re-prompt for consent when this policy version changes. Breach notifications follow Art. 33/34.
