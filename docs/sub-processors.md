# Sub-processors

> **Template — needs legal review and signed DPAs before production use.**

| Sub-processor | Purpose | Data shared | Region | DPA |
|---|---|---|---|---|
| Vercel | Hosting, CDN, serverless functions | All request data; no standalone PII store | Global edge; US primary | https://vercel.com/legal/dpa |
| Neon (or Supabase) | PostgreSQL database, file storage | All application data incl. encrypted PII fields | EU/US region chosen at creation | https://neon.tech/legal/dpa (or https://supabase.com/dpa) |
| Stripe | Payment processing (PCI DSS) | Payment details, billing name/address, order amount | Global (see Stripe docs) | https://stripe.com/legal/upstream-data-processor-agreement |
| Resend | Transactional email delivery (verification, password reset, password changed) | Email address and first name; minimal content only (FR-NTF-06) | US/EU | https://resend.com/legal/dpa |
| Upstash | Rate limiting, cache (Redis) | IP-derived rate keys (hashed), session counters | EU/US region chosen | https://upstash.com/dpa |
| Google | OAuth login (when enabled, M8) | Email, account id for auth only | US | Google API Services Terms |

Card data never touches Kartly servers (D-09). No other sub-processors are used. Analytics, if added later, will be consent gated and listed here.
