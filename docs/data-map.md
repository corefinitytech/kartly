# Data Map

> **Template — needs legal review.** Starter content drawn from the PRD. Complete against the built system in M6 (PRD 9.7). Covers every personal data field in the M0 schema.

Legal basis reference: contract = Art. 6(1)(b); legal obligation = 6(1)(c); legitimate interest = 6(1)(f); consent = 6(1)(a).

| Table | Field | Personal data | Purpose | Legal basis | Retention | Recipients | Location |
|---|---|---|---|---|---|---|---|
| users | email | Yes | Account, login, order and transactional email | Contract | Life of account; orders anonymized then 7 years | Resend (transactional email) | Hosting region |
| users | email_verified | No (metadata) | Proof of verification | Contract | Life of account | None | Hosting region |
| accounts.password | argon2id hash (moved from users.password_hash per Better Auth) | Yes (credential) | Login credential storage | Contract, Art. 32 | Life of account | None | Hosting region |
| users | role, status | No | Authorization, account state | Contract | Life of account | None | Hosting region |
| users | name | Yes | Delivery, order and email personalization | Contract | Life of account; anonymized in retained orders | Stripe (billing name if provided), shipping (simulated) | Hosting region |
| users | phone_enc (encrypted) | Yes | Optional contact for delivery issues | Contract (optional) | Life of account | None stored in clear; decrypt only in checkout flow | Hosting region |
| users | locale | No | Language preference | Contract | Life of account | None | Hosting region |
| users | referral_code | Indirectly | Referral attribution | Legitimate interest (see DPIA-lite) | Life of account | None | Hosting region |
| users | age_confirmed_at | No (metadata) | Proof of 16+ confirmation (D-18) | Consent to process (self-declaration) | Life of account | None | Hosting region |
| users | created_at | No | Account age, retention | Contract | Life of account | None | Hosting region |
| sessions | token, expires_at, ip_address (stored only as a salted SHA-256 hash via a session-create hook), user_agent | Yes (security metadata) | Session management, abuse detection | Legitimate interest (security) | 30 days sliding; deleted on expiry or password change | None | Hosting region |
| accounts | provider_id, account_id, tokens (null for email login) | Yes (credential) | Credential account (Better Auth) | Contract | Life of account; deleted on erasure | None | Hosting region |
| verifications | identifier (email), value (single-use token), expires_at | Yes (credential) | Email verification (24h) and password reset (1h) tokens | Contract | Deleted on use or expiry | None | Hosting region |
| addresses | name_enc, line1_enc, line2_enc, phone_enc (encrypted) | Yes | Shipping and billing | Contract | Life of account; anonymized in retained orders (7 years) | Stripe (billing address for payment), simulated carrier | Hosting region |
| addresses | city, region, postal_code, country | Yes | Shipping, tax by country | Contract, legal obligation (tax) | As above | As above | Hosting region |
| consents | user_id / anon_id, category, granted, policy_version, source | Yes (consent proof) | Proof of consent / objection (ePrivacy, Art. 7). Append only: every grant, reject or change inserts rows; nothing is updated or deleted. | Legitimate interest (compliance proof) | Life of account + 3 years | None | Hosting region |
| cookie kt_consent | anon_id (random UUID), category choices, policy_version | Yes (consent state) | Stops the banner reappearing and gates optional scripts client side. The anon_id links consent rows to a browser, not a person; it is never joined to account data. | Legitimate interest (ePrivacy compliance) | 180 days, refreshed on each decision | None (first party) | Browser |
| audit_log | actor_id, action, entity, meta_json, ip_hash (salted hash) | Limited | Accountability, security (Art. 32) | Legitimate interest (security) | 12 months | None | Hosting region |
| orders | guest_email_enc, shipping/billing address JSON (encrypted) | Yes | Order fulfilment, invoices | Contract, legal obligation | 7 years (anonymized after account deletion, D-11) | Stripe, email provider | Hosting region |
| orders | amounts, status, pricing_json | No | Accounting, support | Legal obligation | 7 years | Accountant/tax authority on request | Hosting region |
| order_items, order_events | title/sku snapshots, status history | No | Invoices, dispute handling | Legal obligation | 7 years | As orders | Hosting region |
| payments | stripe ids, brand, last4 | Yes (payment metadata) | Payment reconciliation, support | Contract, legal obligation | 7 years (anonymized) | Stripe (processor) | Stripe regions + hosting region |
| webhook_events, idempotency_keys | ids, hashes | No | Exactly-once processing | Legitimate interest (reliability) | 90 days | None | Hosting region |
| carts | guest_token_hash (SHA256 of the cookie token), estimate_country | Limited | Guest cart ownership (D-03) and shipping/tax estimation. The token hash cannot identify a person without the cookie. | Legitimate interest | 30 days sliding | None | Hosting region |
| cart_items | variant_id, qty, added_price_cents, saved_for_later | No personal data | Cart contents | Legitimate interest | 30 days sliding (purged with the cart) | None | Hosting region |
| products, categories, variants, images, inventory_ledger | No personal data | — | Catalog | — | Indefinite (business data) | None | Hosting region |

Card data: never collected or stored (D-09). Date of birth: not collected (age confirmation only, 9.1).
