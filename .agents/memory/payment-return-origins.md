---
name: Payment return origins
description: Production payment callbacks must not inherit the workspace development domain.
---

Use the canonical published website for production payment return URLs even when development-domain variables are present.

**Why:** A live donation returned the donor to an unavailable Replit preview page because the donation routes preferred the inherited development domain. Fixing Connect onboarding callbacks alone had not fixed Checkout callbacks.

**How to apply:** Cover success, cancellation and portal/onboarding returns in production URL regression checks. A broken return page does not establish whether a payment failed; never ask the donor to pay again as a retry.
