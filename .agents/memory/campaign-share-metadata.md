---
name: Campaign share metadata
description: How campaign links provide organisation-branded previews while the web artifact remains statically served.
---

Public campaign share URLs must be handled by the API service so social crawlers receive campaign-specific Open Graph metadata. Human visitors are then redirected to the interactive React route.

**Why:** The web artifact is statically served, and WhatsApp and similar crawlers do not reliably execute client-side JavaScript. Updating `document.title` and meta tags in React is useful in browsers but does not produce dependable link previews.

**How to apply:** Keep `/campaigns/<organisation>/<campaign>` as the public share URL owned by the API service, and use a separate React route for the interactive page. Preserve opaque public IDs for legacy lookup, not as the preferred shared URL.