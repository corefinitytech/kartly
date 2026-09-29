# International Transfers

> **Template — needs legal review.**

Kartly is GDPR-baseline for all users (PRD Section 1). Sub-processors Vercel, Stripe, Resend, Upstash and Neon/Supabase may involve processing or backups in the United States.

**Safeguards:**

- EU-US **Data Privacy Framework (DPF)**: verify each sub-processor's DPF certification status at the time of review (list at https://dataprivacyframework.gov).
- Where a sub-processor is not DPF-certified, execute **Standard Contractual Clauses (SCCs)** with it before transferring personal data. DPA links per sub-processor are listed in `sub-processors.md`.
- Choose EU/US regions consciously: prefer EU regions for the database (Neon/Supabase) and Redis (Upstash) where latency allows.
- Transfer impact assessments: on first transfer and on material change (e.g. a sub-processor changes region).

Supplementary measures already in place: TLS in transit, AES-256-GCM field level encryption of PII (D-13), salted IP hashes, no card data stored (D-09), audit logging.
