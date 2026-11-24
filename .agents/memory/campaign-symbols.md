---
name: Campaign donation symbols
description: Campaign-specific donor confirmation symbols and language
---
The handprint, hand wall, “Your hand” counter and “Latest hands” belong only to Out of Many Hands. Drum Life uses a drum and “you're helping light up a drum”; uncommissioned campaigns use a heart and neutral supporter wording.

**Why:** The user explicitly corrected the universal hand treatment on 2026-11-23. Donor confirmation, shared gift cards, failed-payment artwork and Involvement must reflect the campaign rather than copy another campaign's identity.

**How to apply:** Use each campaign's presentation settings consistently across donation-related views. A donor count is not a funded drum count: keep Drum Life's interactive progress based on actual native-currency funds. Presentation changes must not alter payment calculations, webhooks or the donate card.

Out of Many Hands must use the exact handprint from the original campaign design's `handprint` symbol, not a similar hand icon. Its normal wall hands are ink (`#17100F`), the donor's own hand and thank-you stamp are campaign red (`#B3121B`), and the ghost is light grey.

**Why:** The user explicitly rejected the older red hand and requested the original drawing consistently across the wall, confirmation, failed-payment, shared-gift and Involvement views.

**How to apply:** Treat the original SVG geometry as campaign artwork, preserve its `currentColor` fill and do not generalise its drawing or wall colours to Drum Life or default-heart campaigns.

The wall count must mean individually visible donor hands, not a decorative mass
or an additional receipt hand. The faded invitation is not a donor.

**Why:** On 2026-11-24 the user replaced the old fixed-size wall layout with a
responsive, bottom-up wall and explicitly required the count to match its hands.

**How to apply:** Keep count, artwork and reserved invitation space consistent
in the public page and editor previews without changing financial totals.
