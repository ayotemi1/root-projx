---
name: Campaign publication safety
description: Live revisions stay private; already committed funding and donation-triggered matching are distinct
---

Keep an already published campaign available while its organisation edits.
Only an explicit publish action should replace its public content after the
current organisation and payout gates pass.

**Why:** Quiet autosaves must not expose unfinished asks or take a live
fundraiser offline. Organisations need to prepare revisions without disrupting
existing donor links.

**How to apply:** Preserve the public version during draft saves, retain pending
edits when unpublishing, and keep previously published links stable after renames.
Blank drafts should acquire readable links from the final name at first publish.

Keep two distinct partner-funding types. **Committed** money is secured
regardless of donations and never multiplies a donor's gift. **Matching**
money is triggered by gifts, with an explicit ratio and cap; stop showing a
multiplier when the cap is used. Default to committed. All legacy `matchFunding`
data must mean committed, not matching.

**Why:** The user corrected the conflation on 2026-10-22. Their first campaign
has a government commitment for about half the programme cost before any donation
existed: a donor's £10 only reduces the remaining gap. The earlier note claiming
they confirmed a general matching model was incorrect.

**How to apply:** Ask which type in plain language. For committed funding say
"£X already committed by [funder]"; never imply donations unlock it. Track actual
matching allocation separately from donations raised, cap it atomically, and
never treat a pledge as another card payment or settled payout money.
