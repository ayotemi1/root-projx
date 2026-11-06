---
name: Payout data boundaries
description: Organisation bank-transfer privacy policy and the limits of payout setup.
---

Bank-transfer details are collected privately through the organisation dashboard
and kept in Root ProjX records for administrators to pay organisations. They must
be encrypted with a dedicated, persistent secret, isolated from public profile
data and accessible only through authorised server endpoints. Never put banking
details in logs, public APIs, browser persistence, exports or agent memory.
Changing details withdraws approval; approval must apply to the exact reviewed
revision and must not race an in-progress payout. The selected payout method is
exclusive; keeping a provider connection does not select it.

**Why:** On 2026-11-06 the user explicitly replaced the previous off-platform
policy: “We should collect it through the site and store in our records this is
how we will pay them out.”

**How to apply:** Preserve this boundary in forms, validation, logging and future
payout execution. Legacy approved off-platform arrangements may remain, but
must not be described as bank details already saved on the site. Approval does
not initiate a transfer. New account details require fresh independent review.

Bank-detail disclosure must require a durable audit, and approvals must not
succeed without their audit record. Audit storage is create-only even for the
ordinary server identity. Reviews must remain masked until explicit reveal.
Never imply shared administrator credentials identify an individual person.

**Why:** On 2026-11-06 the user made immutable access/approval auditing the highest
priority prerequisite for enabling bank-detail saving and required masked review.

**How to apply:** Fail closed if audit persistence fails; retain the manual
Firestore-rule publication boundary. Describe privileged Firebase IAM bypasses
honestly rather than claiming project-administrator-proof immutability.

Public payout routing uses `stripe_connect`, `wise`, `manual`, or `none`;
dashboard selections retain `stripe`, `wise`, and `bank_transfer` for backwards
compatibility. Manual donation routing requires explicit admin approval: a
pending bank-transfer request must resolve to `none`, even if old provider
credentials remain. Stripe routing requires an account ID. Resolution still
does not authorize executing a payout. Keep approval flags and payee reminders
private.

**Why:** The user requires a confirmed way to pay an organisation before a manual
route can accept donations. Existing provider credentials must not override an
explicitly selected alternative; donation eligibility and transfer execution
authorization remain separate concerns.

**How to apply:** Reuse the shared resolver for future Checkout metadata and
payout records; validate readiness and authorization separately before transfers.

Bank-transfer setup approvals must be discoverable independently of donation
and payout-ledger entries, including organisations with no money raised.

**Why:** An unapproved manual organisation cannot receive donations. Requiring a
ledger entry before showing its setup request creates a circular blocker.

**How to apply:** Source setup requests from organisations, not outstanding
payouts. Keep “approve setup” distinct from “mark payout as sent”.

An interrupted settlement must be reconciled with provider records before any
resend. Do not automatically expire settlement locks or retry failed payouts:
a timeout can happen after the provider has already accepted money movement.

**Why:** Automatically treating an ambiguous result as “not paid” risks paying
an organisation twice. Unrelated profile writes must never clear a settlement
lock, including legacy writes that pass an entire organisation snapshot.

**How to apply:** Preserve exclusive settlement across concurrent requests and
server processes. Any future recovery control must distinguish known failures
from funded transfers whose ledger update failed.
