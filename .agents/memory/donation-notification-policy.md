---
name: Donation notification policy
description: Organisation and Root ProjX alerts for all successful donation payments.
---

Notify both the receiving organisation and Root ProjX for every successful
donation payment, including recurring payments, while preserving the donor receipt.
Keep recipients separate and disclose only consented public donor names.

**Why:** The user explicitly requested organisation and platform email notifications
whenever someone donates. Receipt delivery alone did not meet their operational needs.
Donating does not imply consent to disclose donor contact details.

**How to apply:** Preserve these alerts when modifying donation recording. Exercise
one-off, invoice, unsuccessful-payment and webhook-replay paths with mocked email;
never test by charging a live card or emailing real organisations.
