# Wise disbursement history

Successful funding is recorded in the top-level `disbursements` collection
before the organisation's last-paid summary is updated. Records contain
`orgId`, `amountGbp`, `transferId`, `disbursedAt` (UTC ISO timestamp), and
`recipientEmail` (the email used for that payout, or null for legacy recipients).
The shared Wise helper covers both direct admin disbursements and batch payouts.

`GET /api/wise/disbursements?orgId=...` requires the same `X-Admin-Secret`
header as direct disbursement. It returns `{ disbursements: [...] }`, newest
first, including each Firestore document's `_id`. There is no row limit.
An organisation with no records returns an empty array. Older payouts are not
reconstructed from last-paid summaries: those summaries cannot recover history
that was already overwritten.

## Required manual Firebase rules publication

The checked-in `firestore.rules` is deliberately unchanged. Before using payouts
with this release, merge the following block into the **current live rules**
inside `match /databases/{database}/documents` and publish in Firebase Console.
Preserve all other live rules (which may include newer payout collections absent
from the checked-in file).

```text
match /disbursements/{disbursementId} {
  allow read, create: if isServer();
  allow update, delete: if false;
}
```

These rules keep recipient emails private and make the history append-only
through Firestore's authenticated API. Do not grant organisation users direct
access to this collection. Existing rules must retain the `isServer()` helper.

Before any Wise request the helper queries history, so a denied collection
read stops the payout before money moves. This preflight does not guarantee a
later write will succeed (for example, on a network outage or different live
write permissions). If funding succeeds but a history or summary write fails,
the helper throws an explicit error including the Wise transfer ID. Reconcile
that transfer in Wise before retrying; never treat the error as proof no money
was sent. A history record already written survives a failed summary update.
