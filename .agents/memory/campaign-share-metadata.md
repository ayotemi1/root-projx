---
name: Campaign share metadata
description: How campaign links provide organisation-branded previews while the web artifact remains statically served.
---

Campaign-specific social metadata must be rendered on the server rather than relying only on browser-side updates.

**Why:** The web artifact is statically served, and WhatsApp and similar crawlers do not reliably execute client-side JavaScript. Updating `document.title` and meta tags in React is useful in browsers but does not produce dependable link previews.

**How to apply:** When campaign links are shared externally, ensure the first HTML response contains campaign-specific title, description, and image tags. Browser-side metadata can supplement this but cannot replace it.