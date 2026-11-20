---
name: Website redesign reference
description: User-supplied visual brief and boundaries separating prototype presentation from live behaviour.
---
The user supplied `attached_assets/Root-ProjX-Website-Preview-Pack_1795160842235.zip` as the reference for changing the existing site's appearance. It contains a Start-here handover, nine original HTML models and visual references covering sign-in, welcome, feed, Discover, About, both bespoke campaigns, the organisation dashboard and admin.

The redesign scope includes public organisation profiles, not only the owner's dashboard "Profile" screen. Public pages must remain comfortably readable and use the available desktop width.

**Why:** On 2026-11-20 the user explicitly pointed out that the public profile had been missed and the feed content looked too small.

**How to apply:** Include the public profile reached from Feed/Discover in appearance reviews, even though the pack has no separate public-profile HTML model. Verify actual routed pages at phone and desktop widths; matching fonts alone is not a complete restyle.

**Why:** The user requested a redesign based on this pack on 2026-11-20, not a replacement application or a switch to a different authentication provider.

**How to apply:** Read the handover and the relevant HTML model when working on that surface. Integrate presentation into the actual routed components and verify those components, not only isolated mockups. Prototype sample donors, money, organisations and simulated donations are not real records.

The pack mixes visual requirements with potential behavioural changes. Its handover says a 30-day payout hold while its own admin example says seven days. Donor-selected currencies and giving-history feed ranking also extend beyond appearance.

**Why:** Silently copying prototype wording or interaction code could misstate financial behaviour or change verified payment and payout rules.

**How to apply:** Preserve canonical accounting and existing financial/security behaviour during visual changes. Obtain an explicit policy decision before changing payout rules, and distinguish genuine new functional work from restyling rather than showing unsupported controls or claims.

For supporter registration, the user supplied `attached_assets/signup-join_1795191250295.png` as the desktop/mobile visual reference on 2026-11-20. Retain the optional phone field even though that mockup only shows three fields.

**Why:** The user explicitly prioritised preserving every existing field, required/optional status, validation and account-creation behaviour over reproducing the mockup's three-field form.

**How to apply:** Treat this as a presentation-only registration reference. Do not remove optional phone or simplify the supporter registration contract merely to match the picture.
