---
name: Campaign template reference
description: User-selected design reference and its intended scope for public campaign pages.
---

Use the user's three HTML references supplied on 2026-11-23 for the shared campaign page and the editor's Story and Look steps. They supersede the earlier PDF where they differ.

**Why:** The user explicitly required the editor preview to be the real donor page, not a separate approximation. The example's campaign, funder, stories and figures are not defaults for other organisations.

**How to apply:** Keep the reference's editorial opening, accumulation artwork, giving/funding sidebar, section schemes and black closing Give section while rendering each campaign's own content. Apply changes to the shared donor/owner-preview template. The HTML contains demo donation JavaScript: never copy its fake totals or hand-stamping payment action into the live app.

Campaign unit artwork (hands and the other built-in icons) normally appears without
surrounding circular backgrounds or borders.

**Why:** The user explicitly requested removing the circle around the hands and
around the other campaign icons.

**How to apply:** Preserve the icon shapes and existing colours. The later
“Landing Page Amendments” document (5 November 2026) explicitly requests one gold,
circled, centred marker after the donor's confirmed payment. This is the sole
exception, not permission to circle the other icons. Do not attribute that
acknowledgement to another donor's named unit just because theirs is newest.

The current campaign typography is Archivo headings, JetBrains Mono labels and
Familjen Grotesk body text. Keep inline amount selection and the itemised giving
breakdown before checkout.

**Why:** The user explicitly retained these fonts in the 2026-11-23 brief,
superseding the older Inter/Dancing Script typography instruction. Financial
behaviour was expressly outside the requested Story/Look changes.

**How to apply:** Keep the shared template, but use each campaign's own editorial
labels, currency, funder and cohort data. HOV's “Support the training” is not a
default statement about other organisations' work. Confirmation amounts must come
from the recorded receipt, never from the currently selected donation amount.

Donor names on campaign icons must follow the same consent and abbreviated-name
policy as the public donor wall; entering a payment email is not public consent.

**Why:** The user requested hover names on the hands/bricks, not exposure of
private donor details. Anonymous historical gifts cannot safely identify a person.

**How to apply:** Attribute only real, deduplicated counted supporters to icons,
keep non-consenting donors anonymous, and keep aggregate artwork unattributed.

Text fitting in scaled previews must compare text and available space in the
same coordinate system, with rounding room rather than positive overflow
tolerance. Do not let emergency mid-word wrapping conceal a fit error.

**Why:** A word that appeared to fit numerically in a scaled preview still
split its final letter onto another line, including ordinary campaign titles.
The public page alone did not expose this boundary case.

**How to apply:** Check both public and scaled Phone/Desktop views after fonts
load. Include normal titles and maximum-length unbroken words, leave a small
physical/logical pixel margin, and keep headline words intact.
