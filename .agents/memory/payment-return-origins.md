---
name: Payment return origins
description: Production payment callbacks must not inherit the workspace development domain.
---

Use the canonical published website for production payment return URLs even when development-domain variables are present.

**Why:** A live donation returned the donor to an unavailable Replit preview page because the donation routes preferred the inherited development domain. Fixing Connect onboarding callbacks alone had not fixed Checkout callbacks.

**How to apply:** Cover success, cancellation and portal/onboarding returns in production URL regression checks. A broken return page does not establish whether a payment failed; never ask the donor to pay again as a retry.

Test payment returns with a full page load, not only client-side navigation.

**Why:** The crawler-metadata API can own a URL prefix that also looks valid to the React router. A screen working after client navigation does not mean Stripe can return to it.

**How to apply:** Follow the actual redirect through the artifact router for success, cancellation and sharing links. Keep payment-return handoffs ahead of generic campaign-share matching.
