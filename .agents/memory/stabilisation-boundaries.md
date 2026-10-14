---
name: Stabilisation boundaries
description: User-defined scope and reporting requirements for the Root ProjX stabilisation pass.
---

Handle one user-specified fix at a time. Read project conventions before changes, avoid unrelated refactors, and do not change the colour system.

Run the existing API library tests after each implemented fix. Report the files changed and anything uncertain.

Do not edit firestore.rules unless explicitly asked. If a fix needs a rules update, print the full proposed updated rules file in the reply for the user to publish manually in Firebase Console.

**Why:** The user explicitly set these boundaries for the stabilisation pass on 2026-10-14 to keep changes focused and retain control of rules publication.

**How to apply:** Follow these constraints throughout the stabilisation pass; implementation still requires Build mode and the specific fix from the user.
