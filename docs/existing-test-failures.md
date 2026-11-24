# Existing failing checks

The full API approval suite on 24 November 2026 ran 467 checks:
456 passed and 11 failed. These are the same 11 failures recorded before the
email rollout changes. The API production build passed.

These failures do not establish that the live features are broken. Nine fail
while assembling isolated test substitutes, before exercising the feature.
Two make assertions that no longer match the current presentation. That still
leaves gaps in automated coverage; it is not proof that every feature works.

| # | What the check covers | Why it fails now | User-facing effect of this failure |
| --- | --- | --- | --- |
| 1 | Organisation photo/video gallery cards, filters, loading, error and empty states, and avoiding automatic embedded players. | It expects square thumbnails; the current design renders 4:5 thumbnails. | The visible thumbnails are 4:5. This assertion does not demonstrate a broken gallery. |
| 2 | Saving organisation posts with their media and links, deriving the correct owner and keeping public content available. | Its database substitute lacks the newer profile-update and post-publishing operations. | None demonstrated. The test cannot reach those operations, so this coverage is currently unavailable. |
| 3 | Campaign pages showing real campaign data and omitting optional sections when there is no content. | It expects an older campaign-accumulation walkthrough marker that is absent from the rendered campaign. | It flags a removed walkthrough target, not a proven missing campaign or donation feature. That particular walkthrough target is not verified by this test. |
| 4 | Rejecting empty, too-long or incorrectly media-bearing text posts, and saving public/private text posts without duplicates. | Its sign-in/permissions substitute lacks the approved-organisation check now imported by the route. | None demonstrated; posting validation and privacy coverage cannot run. |
| 5 | Real community tags and personalised For You matching using interests, followed places/organisations and previous choices. | Same incomplete sign-in/permissions substitute as check 4. | None demonstrated; recommendation coverage cannot run. |
| 6 | Publishing correctly owned media in order, public/private visibility, feed appearance, retry safety and direct media access. | Same incomplete sign-in/permissions substitute as check 4. | None demonstrated; this publishing and visibility coverage cannot run. |
| 7 | Rejecting other people's media, duplicate attachments and unfinished uploads without exposing internal errors. | Same incomplete sign-in/permissions substitute as check 4. | None demonstrated; this ownership and error-handling coverage cannot run. |
| 8 | Accepting only supported upload formats within the exact file-size limits. | Same incomplete sign-in/permissions substitute as check 4. | None demonstrated; format and size-limit coverage cannot run. |
| 9 | Inspecting JPEG, MP4, MOV and HEIC files and rejecting overlong videos or disguised files. | Same incomplete sign-in/permissions substitute as check 4. | None demonstrated; real media-inspection coverage cannot run. |
| 10 | Signed-out visitors seeing the public organisation feed without supporter-only feed modes. | Its post-viewer substitute lacks the post-link helper used by the current viewer controls. | None demonstrated; the isolated feed-rendering check cannot start. |
| 11 | Public feed width, readable captions and sign-in form sizing. | Same incomplete post-viewer substitute as check 10. | None demonstrated; the isolated layout check cannot start. |

No unrelated product code or assertions were changed to make these pass.
