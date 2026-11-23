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
Sender is Root ProjX at hello@rootprojx.com, reply-to info@rootprojx.com;
application-admin recipient is configurable and defaults to info@rootprojx.com.
Keep the existing Brevo service and provide plain text and full HTTPS links.

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
