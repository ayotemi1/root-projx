---
name: Campaign share metadata
description: How campaign links provide organisation-branded previews while the web artifact remains statically served.
---

Campaign-specific social metadata must be rendered on the server rather than relying only on browser-side updates.

**Why:** The web artifact is statically served, and WhatsApp and similar crawlers do not reliably execute client-side JavaScript. Updating `document.title` and meta tags in React is useful in browsers but does not produce dependable link previews.

**How to apply:** When campaign links are shared externally, ensure the first HTML response contains campaign-specific title, description, and image tags. Browser-side metadata can supplement this but cannot replace it.

Keep authenticated draft-preview routes outside the server-owned `/campaigns`
prefix; use the singular `/campaign/preview/…` SPA route.

**Why:** Client-side navigation can appear to work under a server-reserved prefix,
while opening the same link directly reaches the metadata API and returns 404.
Private draft content must never be included in crawler HTML.

A browser-only mocked campaign does not exist in the server's share-link
resolver. Its invented or noncanonical URL returning 404 is not evidence that
real campaign links are broken.

**Why:** Browser checks have incorrectly flagged mock-only single-segment links
as production routing regressions.

**How to apply:** Use generated two-slug share paths for route verification and
distinguish the server's document lookup from intercepted browser JSON requests.
Do not publish or mutate real campaigns just to make a browser fixture resolve.

**How to apply:** Check direct hard navigation through the artifact router, not
just in-app links. Keep owner authorization on the separate JSON preview API.