---
name: Post viewer scope
description: Shared viewer entry points preserve inline Home playback and give nested management layers keyboard priority.
---
Use the shared post viewer for profile grids, supporter Posts and Media, Saved,
explicit feed caption/More/comments actions and post notifications. Keep Home's
card media inline: tapping its video changes playback rather than opening a
viewer. Viewer videos intentionally autoplay with sound after an explicit open;
feed autoplay starts muted and respects the person's speaker preference.

**Why:** The user expanded the shared viewer's entry points but explicitly kept
inline feed playback and distinguished its sound policy from a chosen viewer.

**How to apply:** Preserve the source page, scroll position and ordered post set.
Archived posts still use owner-authorised management, not public visibility.

Nested menus, editors and cover pickers must own the keyboard while open.

**Why:** Window capture listeners run in registration order. A later-mounted
menu's stopPropagation cannot undo an earlier viewer listener closing the page.

**How to apply:** Make the underlying viewer explicitly yield keyboard handling
to an active management layer; test Escape from inside a viewer, not just a card.
