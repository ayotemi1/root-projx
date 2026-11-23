---
name: Supporter notification meaning
description: Real event sources, recipient privacy, and what opening a notification means.
---

Notification messages must describe recorded events, not inferred activity.
Do not turn a campaign's current percentage into a historical milestone, or an
ordinary video into a Story with an invented expiry. A recorded donation does
not prove an email was delivered or a downloadable PDF receipt exists.

**Why:** The user requested real existing sources and explicitly asked to be
told which types still lack a source. Sample names, amounts and counts in the
design are not product data.

**How to apply:** Connect new event types only with a reliable event source and
a working destination. Keep transaction notifications scoped to the recipient;
do not use guest-email matching to attach old financial history to an account.

Only opening an individual notification marks it read. Viewing the inbox or
changing a filter must not clear unread items.

**Why:** The user defined opening the notification as the read action and
expects the unread badge to agree across desktop and mobile.

**How to apply:** Persist the individual recipient's read action before
navigating. On failure retain the unread state and offer retry.

Message alerts may reflect that their actual conversation was read; simply
opening the Notifications panel still must not clear anything.

**Why:** Messages have an authoritative conversation read cursor. Showing an
already-read message as unread creates two conflicting message unread states.

**How to apply:** Derive message-alert read state only from opening the actual
thread or an explicit notification read, not from a list fetch or filter.

Optional email destinations must come from the authenticated Firebase identity,
not a browser-writable profile email. Keep optional preferences separate from
mandatory receipts and security emails. Suppress newly added optional outbound
notification emails in Preview.

**Why:** Basic profile creation does not establish ownership of an arbitrary
profile email. Unpublished review must not send new alerts to real supporters.

**How to apply:** Bind notification addresses to the authenticated account with
server-verifiable evidence; never substitute a profile email when evidence is
missing. Preserve the existing receipt/security delivery paths.
