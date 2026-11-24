---
name: Transactional email policy
description: Authoritative user-supplied email templates, recipients, consent and delivery boundaries.
---

The user's authoritative email pack is the 16 numbered HTML attachments and
`attached_assets/index_1795472618675.json`, supplied on 2026-11-23. Retain their
wording and design, substituting declared variables only. The supplied email
logo must be publicly hosted, not embedded as base64.

**Why:** The user explicitly requested those exact templates, not a redesign
or newly written copy.

**How to apply:** Use the manifest for subjects, preheaders and event mapping.
Sender is Root ProjX at info@rootprojx.com; reply-to and every admin alert also
use info@rootprojx.com, not a configurable alternative.
Keep the existing Brevo service and provide plain text and full HTTPS links.

**Why:** The owner clarified on 2026-11-24 that hello@rootprojx.com is not a real
inbox and explicitly asked to remove or deactivate that Brevo sender.

**How to apply:** Do not restore the hello sender or let legacy sender/team
environment variables override the monitored info mailbox.

Password resets must use Firebase Auth's existing email API and its owner-managed
Brevo SMTP settings, not app-managed template 06 or a service-account credential.

**Why:** The owner intentionally retains Google's organisation policy blocking
service-account key creation. On 2026-11-24 they confirmed Firebase Auth SMTP
already sends from info@rootprojx.com with public-facing name Root ProjX.

**How to apply:** Do not request keys, enable template 06 delivery, or change
Firebase Auth email settings. Preserve native expiry and single-use behaviour.

Receipts, password resets and application emails are essential. Welcome,
supporter campaign-goal and organisation new-gift emails respect email
preferences. Organisation gift delivery defaults to every gift and also needs
a daily-summary option; do not silently replace that with delayed individual
messages.

**Why:** The user distinguished necessary account/payment communication from
optional updates and requested control over notification frequency.

**How to apply:** Keep opt-outs separate from required receipts and security
messages. Never infer public donor identity from contact details; only use
checkout-consented first name plus last initial, otherwise Anonymous.

Daily gift summaries are a separate variant of template 12, retaining its
header, box, fonts and "View in your dashboard" button. The headline is
"Today's gifts to {{campaign_name}}". Show one donor-or-Anonymous and amount
row per gift, then a bold "You'll receive" proceeds total and the campaign's
raised-versus-goal total. Send only on days with at least one eligible gift.

**Why:** The user explicitly chose this summary format on 2026-11-23 rather
than reusing the singular gift email with aggregated variables.

**How to apply:** Keep the original template unchanged and group each summary
by campaign/day. Preserve donor consent and currency formatting; the daily
organisation-proceeds total is not the gross gifts or lifetime campaign total.

Receipt emails are webhook-owned, not redirect-owned; no event should produce
duplicate sends. Email delivery history is private administrative data. Test
messages go only to an explicitly authorised test recipient.

**Why:** The user explicitly asked for duplicate prevention, administrative
delivery records and a test-mode donation rather than live charges.

**How to apply:** Keep mail retries independent of financial mutations,
distinguish provider acceptance from delivery, and do not claim Gmail or
Apple Mail checks from browser-only HTML previews.

Brevo IP restrictions are a separate authentication gate from API-key validity.
An HTTP 401 can mean an unrecognised sending IP rather than an invalid key.

**Why:** A rollout preflight was rejected specifically by Brevo's IP security;
replacing credentials would not have addressed that cause.

**How to apply:** Distinguish the provider's error category without logging its
raw response. Ask the owner to approve the recognised app address in Brevo's
Authorized IPs settings; do not silently disable IP security or rotate keys.

The owner approved omitting inapplicable financial rows while keeping the
remaining supplied email wording, layout and colours unchanged.

**Why:** A receipt must not say the donor chose to cover a fee when they did not,
and a gift without a campaign target must not display invented goal progress.

**How to apply:** Keep original template assets unchanged; use narrowly scoped
conditional row omissions, never invented financial data.
