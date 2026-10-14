---
name: Campaign storage constraint
description: User-confirmed campaign storage model to preserve during stabilisation.
---

Campaigns must remain embedded in the organisation document rather than being migrated to a subcollection.

**Why:** The user explicitly confirmed this storage boundary during the stabilisation pass and asked that campaign donations use the embedded array.

**How to apply:** Preserve this model when changing donation attribution or campaign management. Do not introduce a storage migration as an unrelated refactor.
