# Data Breach Runbook

> **Template — needs legal review and a named DPO / incident owner before production.**

## 1. Detect
- Sources: uptime alerts, `/api/health` failures, error rate spikes, Stripe/Resend/Neon incident notices, user reports.
- On-call engineer triages and opens an incident record (date, time, who detected, what was observed).

## 2. Contain
- Revoke exposed credentials/secrets (rotate `PII_ENC_KEY` via key-id rotation, Stripe, Resend, DB credentials).
- Block the affected account or route; roll back the offending deployment if needed.
- Preserve evidence (logs, 12 month audit trail) before purging anything.

## 3. Assess (Art. 33)
- Identify: categories of data, approximate number of data subjects, likely consequences.
- Classify risk. Personal data breaches include confidentiality, integrity and availability breaches.
- **The supervisory authority must be notified within 72 hours of becoming aware**, unless the breach is unlikely to result in a risk to data subjects (document that reasoning either way).

## 4. Notify the authority (within 72 hours)
- Competent authority: the lead authority per where the controller is established; otherwise the list at https://edpb.europa.eu.
- Content required by Art. 33(3): nature and categories/approximate numbers of data subjects and records, DPO contact, likely consequences, measures taken or proposed.
- If not all facts are known within 72 hours, notify in phases.

## 5. Notify data subjects (Art. 34)
- Required without undue delay if high risk to individuals (e.g. exposed addresses, emails, payment metadata; card numbers are never stored, D-09).
- Clear, plain language: what happened, what data, likely consequences, what we did, what they can do, contact point.
- Coordinate with Stripe/Resend if the breach originated at a sub-processor.

## 6. Log and follow up
- Record every breach and its effects and remediation in the internal register (Art. 33(5)), even if not notified.
- Post-incident review within 5 working days; remediation items tracked to completion; add an ADR if an architectural change is needed.
