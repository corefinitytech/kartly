# Cookie Inventory

> **Template — needs legal review.** No non-essential cookies or storage may be set before consent (FR-GDPR-01, AC-7).

| Name | Purpose | Category | Duration | Set by |
|---|---|---|---|---|
| `kt_consent` | Stores the consent decision (categories, policy version) and the random `anon_id` (FR-GDPR-02). First party, SameSite=Lax, not HttpOnly (must be readable to reopen the banner). Written by the consent API on every decision. | Necessary (holds the choices for all categories) | 180 days | Kartly |
| `cart_id` | Identifies the guest cart. Signed, HttpOnly, SameSite=Lax (D-03) | Necessary | 30 days | Kartly (M2) |
| `session` (name per auth library, HttpOnly) | Login session | Necessary | 30 days sliding (12h admin) | Kartly (M3) |
| CSRF token cookie (name per auth library) | Mutation protection (FR-SEC-02) | Necessary | Session | Kartly (M3) |

No functional, analytics or marketing cookies are set at M1. When added, they must be consent gated (`ConsentGate`) and appended to this table with name, purpose, category and duration. Withdrawing a category takes effect immediately: gated scripts stop loading on the next page view and the cookie is rewritten the same moment.
