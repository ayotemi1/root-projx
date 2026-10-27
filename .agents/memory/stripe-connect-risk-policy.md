---
name: Stripe Connect risk policy
description: Platform responsibility choice and the scope of preview API use.
---

Preserve Stripe's responsibility for connected-account losses. Do not switch
loss responsibility to Root ProjX merely to make Express onboarding succeed.

**Why:** The user stated that the platform is configured with
`losses_collector: stripe` and explicitly chose the Express / Managed Risk
preview approach rather than accepting platform responsibility for losses.

**How to apply:** Treat changes to loss liability as a financial policy decision
requiring explicit approval. Keep any preview API adoption confined to the
requested Connect operation; do not upgrade payments or webhooks incidentally.
