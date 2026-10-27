---
name: Donation event authority
description: User-defined Stripe event ownership and financial change boundary.
---

Paid one-off donations must be recorded from Checkout Session completion, never PaymentIntent success. Use the PaymentIntent ID as the shared deduplication reference, including for historical records. Carry identical attribution metadata on Session and PaymentIntent creation.

**Why:** The user confirmed a live campaign donation credited only the organisation and requested Session metadata be authoritative. Stripe does not propagate Session metadata onto the PaymentIntent automatically.

**How to apply:** Test event ordering, legacy PI replays and Session-only campaign metadata. Keep recurring invoice and merchandise handlers separate. The user explicitly confirmed fee and payout behaviour against a live £3.25 payment; do not change that logic incidentally when fixing attribution. Historical missing campaign credit needs explicit reconciliation, not replay that doubles organisation totals.
