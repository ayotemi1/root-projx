---
name: Media attachment recovery
description: Preserve the boundary between uploading a file and attaching it to an organisation or campaign.
---

A successful media upload is not a successful document save. Retain the returned
asset URL until its owning document confirms attachment, and make a pending
attachment explicitly resumable after reload without requiring another upload.
A local preview alone is not recovery.

**Why:** File storage and Firestore writes are separate operations. On an
interrupted connection the upload may succeed while attachment fails, leaving
the organisation with an unattached file and no way to finish unless both the
URL and a usable recovery action survive.

**How to apply:** Apply this boundary to profile, team and future campaign media
flows. Keep recovery scoped to the owning organisation and clear it only after
the intended attachment is confirmed; never display a pending preview as proof
that public content was saved.

Supporter media selection is intentionally a local draft until a supporter-owned
upload and publishing path is built. Do not relax organisation-only upload
permissions to make the supporter picker upload files.

**Why:** The existing upload paths assign ownership to an organisation. Reusing
those permissions for supporters would attach content to the wrong ownership
model; choosing files must not silently publish or upload them.

**How to apply:** Reuse storage and validation patterns, not organisation access
guards. Keep local-only draft status explicit, and add supporter-scoped
authorisation before introducing persistent uploads or publishing.
