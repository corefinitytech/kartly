# Retention Schedule

> **Template — needs legal review.** Constants live in `src/lib/retention.ts`; enforcement cron jobs land in M6 (PRD 9.5). Jobs are idempotent, log counts only, and are covered by tests.

| Data | Retention | Basis |
|---|---|---|
| Unverified accounts | 7 days | Data minimisation |
| Sessions | 30 days sliding, deleted on expiry | Security |
| Guest carts and abandoned carts | 30 days | Data minimisation |
| Password reset and verification tokens | Deleted on use or expiry | Security |
| Search history | 90 days | Consent gated |
| Notifications and email outbox | 90 days | Data minimisation |
| DSAR export files | 24 hours | Data minimisation |
| DSAR request records | 3 years | Accountability proof |
| Audit log | 12 months | Security, Art. 32 |
| Consent records | Life of account + 3 years (proof) | Art. 7 |
| Orders and invoices (anonymized after deletion) | 7 years | Tax/legal obligation (D-11) |
| Server logs | 30 days | Security |
| Inactive accounts | P2: notify at 23 months, delete at 24 | Data minimisation |

Erasure follows PRD 9.4 exactly (7 day cool off, hard delete or anonymize, never soft delete, D-17).
