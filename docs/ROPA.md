# Record of Processing Activities (ROPA) — Art. 30

> **Template — needs legal review.** Controller: Kartly operator (fill in legal entity and address). DPO/contact: fill in (also `/legal/contact`). Complete against the built system in M6.

| # | Processing activity | Purpose | Data subjects | Categories of data | Legal basis | Recipients | Transfers | Retention |
|---|---|---|---|---|---|---|---|---|
| 1 | Account management | Signup, login, profile, addresses | Customers | Email, name, phone (encrypted), password hash, age confirmation, locale | Contract 6(1)(b) | Email provider | See international-transfers.md | Life of account |
| 2 | Authentication and sessions | Session management, abuse prevention | Customers, admins | Session token hash, IP hash, user agent | Legitimate interest 6(1)(f) | None | — | 30 days sliding |
| 3 | Catalog browsing and search | Product discovery | Visitors, customers | Search queries (consent gated), product views | Consent 6(1)(a) | None | — | 90 days |
| 4 | Cart | Guest and user carts | Visitors, customers | Cart token hash (SHA256), items, estimate country | Legitimate interest 6(1)(f) / Contract | None | — | 30 days sliding |
| 5 | Checkout and payments | Order placement and payment | Customers, guests | Contact email, shipping address (encrypted), order amounts, Stripe ids, card brand/last4, guest order access token hash | Contract 6(1)(b) | Stripe, Resend | Stripe regions | 7 years (anonymized after deletion) |
| 6 | Order fulfilment | Status tracking, shipping with tracking numbers, cancellations, refunds by staff in the admin panel (M5). Support staff see masked email and city/country only | Customers, guests | Order data, address snapshots, shipment carrier and tracking number, refund records | Contract, legal obligation 6(1)(c) | Resend (status emails), Stripe (refunds) | Stripe regions | 7 years |
| 7 | Transactional email | Order and account notifications | Customers, guests | Email, first name, action link (minimal) | Contract 6(1)(b) | Resend | US/EU | 90 days (outbox) |
| 8 | Marketing email | Newsletters, vouchers (opt in) | Consenting users | Email, consent record | Consent 6(1)(a) | Resend | US/EU | Until withdrawal + 3 years proof |
| 9 | Consent management | Cookie and marketing consent, proof | Visitors, users | anon_id, consent choices, policy version | Legitimate interest (compliance) | None | — | Account life + 3 years |
| 10 | Security and audit | Accountability, incident response, rate limiting. Every admin mutation is audit logged; the log is append only and viewable by admins (M5) | All, incl. staff | Audit entries (ids, actions, no PII), salted IP hashes, staff names in the admin viewer | Legitimate interest 6(1)(f) | None | — | 12 months |
| 11 | DSAR handling | Access, export, erasure, rectification | Data subjects | Request record, exported data | Legal obligation 6(1)(c) | None | — | 3 years; exports 24h |
| 12 | Referrals (M8, designed) | Referral attribution and rewards | Users | Referral code, link between users | Contract / legitimate interest (see DPIA-lite) | None | — | Aggregate after anonymization |
| 13 | Recommendations (M8, designed) | Personalized suggestions | Consenting users | View/purchase history | Consent 6(1)(a) | None | — | Account life |

Roles: Kartly operator is the controller. Vercel, Neon/Supabase, Stripe, Resend and Upstash are processors (see sub-processors.md).
