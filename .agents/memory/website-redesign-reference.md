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

For supporter Home and navigation, the newer references are `attached_assets/supporter-home-first-visit-phone_1795193019651.png` and `attached_assets/supporter-home-first-visit-desktop_1795193019652.png`.

**Why:** On 2026-11-20 the user introduced a distinct supporter dashboard direction: desktop sidebar/central feed/following panel, and compact phone header/organisation strip/bottom navigation. This supersedes the earlier standalone Live Feed layout for the supporter experience.

**How to apply:** Use these screen-specific references for supporter layout work while retaining Root ProjX branding and real existing functionality. Reference stories, counts and conversations are not evidence that those features or records exist.

Supporter creation belongs in the desktop sidebar and mobile bottom navigation,
not in a duplicate composer bar on Home.

**Why:** On 2026-11-21 the user explicitly removed the “What's caught your attention?”
bar on both screen sizes while keeping the navigation Create menus and actions.

**How to apply:** Do not reintroduce the feed composer when extending supporter
posting; retain the organisation strip and let the feed follow it naturally.

Create is an action, not a selected navigation page. It must look like the
other inactive sidebar items and phone tabs, with no permanent yellow fill,
border, bold weight or open-menu selection decoration, for either account type.

**Why:** On 2026-11-21 the user explicitly requested that only the current page
receive the existing active style and that Create never be highlighted.

**How to apply:** Keep Create's click actions intact when extending either
navigation system; do not restore special prominence or route-active styling.
