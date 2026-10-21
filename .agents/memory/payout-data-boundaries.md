---
name: Payout data boundaries
description: Organisation bank-transfer privacy policy and the limits of payout setup.
---

Bank-transfer account details must be exchanged off-platform and held in the
banking provider, never collected or stored in Root ProjX. This includes account
numbers, sort codes, routing numbers and IBANs. Manual setup may hold only a
request, approval and an optional short provider/payee reminder. The selected
payout method is exclusive; keeping a provider connection does not select it.

**Why:** The user deliberately excludes banking credentials from the platform.
If a future flow appears to require another bank-detail field, stop and ask
instead of introducing it.

**How to apply:** Preserve this boundary in organisation/admin forms, API
validation, logging, exports and future payout execution. Manual setup approval
confirms an off-platform arrangement; it does not initiate a transfer.

Public payout routing uses `stripe_connect`, `wise`, `manual`, or `none`;
dashboard selections retain `stripe`, `wise`, and `bank_transfer` for backwards
compatibility. A resolved method identifies the selected route, not provider
readiness or approval to send funds. Keep approval flags and payee reminders
private.

**Why:** Routing and settlement authorization are separate concerns. Existing
provider credentials must not override an explicitly selected alternative.

**How to apply:** Reuse the shared resolver for future Checkout metadata and
payout records; validate readiness and authorization separately before transfers.
