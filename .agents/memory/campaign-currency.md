---
name: Campaign currency boundaries
description: Actual GBP/USD campaign charges, native campaign progress and GBP settlement must remain distinct
---

Campaign dollars mean US dollars, and donors must be charged in that currency,
not merely shown a different symbol.

**Why:** The user explicitly chose USD and actual selected-currency charging.
Organisation-wide giving and existing subscriptions were not requested to change.

**How to apply:** Preserve native-currency amounts for campaign progress,
partner funding and donor receipts. Keep existing GBP organisation/payout
accounting distinct, using verified Stripe settlement conversion rather than
assuming equivalence. Do not allow currency changes that relabel existing or
in-flight donations. Missing conversion data must not become invented GBP money.
