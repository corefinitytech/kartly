# DPIA-lite

> **Template — needs legal review.** Lightweight assessment of the two activities with profiling risk (PRD 9.7). A full DPIA (Art. 35) may be required; this document is the starting point.

## Scope
1. **Referral program** (M8, designed only): linking a referrer and a referee, rewarding after delivery.
2. **Personalized recommendations** ("Customers also bought", "Recently viewed", M8, designed only).

Neither activity involves automated decision-making with legal effect (Art. 22, FR-GDPR-15).

## Referral program
- **Data:** user ids, referral codes, email (for matching abuse), reward ledger.
- **Purpose:** attribution and reward; fraud prevention (no self referral by account, email or normalized address).
- **Risks:** linking two individuals' accounts; reward manipulation; retention of the link after deletion.
- **Mitigations:** reward only after delivery + return window; no tracking cookie (code carried in signup form/query); erasure nulls personal links, keeps aggregates, voids unpaid rewards (9.4); anti-abuse limits per month; data map and export include referral data (FR-REF-07).
- **Residual risk:** low.

## Recommendations
- **Data:** co-purchase counts (aggregate), recently viewed (consent gated, per user).
- **Purpose:** product discovery.
- **Risks:** profiling without consent; opaque personalization.
- **Mitigations:** "Recently viewed" stored only with consent; recommendations carry a "Why am I seeing this?" label and can be turned off (right to object, Art. 21); ranking never paid/sponsored (FR-SRCH-06); 90 day retention.
- **Residual risk:** low.

## Conclusion
Neither activity is likely to result in high risk given the mitigations above. Revisit this assessment before M8 ships, with legal review.
