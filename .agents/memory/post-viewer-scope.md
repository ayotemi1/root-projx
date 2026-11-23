---
name: Post viewer scope
description: Shared viewer entry points preserve inline Home playback and give nested management layers keyboard priority.
---
Use the shared post viewer for profile grids, supporter Posts and Media, Saved,
explicit feed caption/More/comments actions and post notifications. Keep Home's
card media inline: tapping its video changes playback rather than opening a
viewer. Viewer videos intentionally autoplay with sound after an explicit open;
feed autoplay starts muted and respects the person's speaker preference.

The same viewer must cover signed-out visitors, supporters, organisations and
admin-managed organisations on public/own profiles, donor preview, Saved, feed
entry points, notifications and shared links. Shared links keep a real feed or
profile behind the overlay, not a separate blank post page. Desktop/tablet stay
around 480px wide and at most 860px high; only phones under 700px fill the viewport.
Native full screen is an explicit control, never a side effect of opening video.

**Why:** The user repeated that consistency must hold outside the organisation
dashboard and for signed-out visitors too, while retaining inline feed playback.

**How to apply:** Preserve the source page, scroll position and ordered post set.
Archived posts still use owner-authorised management, not public visibility.

Nested menus, editors and cover pickers must own the keyboard while open.

**Why:** Window capture listeners run in registration order. A later-mounted
menu's stopPropagation cannot undo an earlier viewer listener closing the page.

**How to apply:** Make the underlying viewer explicitly yield keyboard handling
to an active management layer; test Escape from inside a viewer, not just a card.
