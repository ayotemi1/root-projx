# Website error-message audit — 2026-11-16

## Findings and corrections

- **Video posts:** the dashboard still sent videos through the old multipart
  upload path and enforced 20 MB. Posts now use the existing direct-storage
  request → transfer → completion flow, with 500 MB MP4/MOV/WebM validation.
  Photos remain 20 MB; a post can contain five attachments. Limits are visible
  beside the file picker.
- **Partial success:** each completed attachment is recorded before the next
  file uploads. Failed publication retains those URLs and optional captions;
  retry does not re-upload successful attachments.
- **Opaque browser failures:** all website fetch call sites use a shared
  boundary for lost connections and unavailable services. Messages do not
  pretend that “Failed to fetch” establishes a particular server cause.
- **Authentication and permissions:** expired sessions, wrong sign-in details
  and permission failures have different instructions. Cancellation of an
  intentionally aborted request is preserved.
- **File errors:** size, unsupported format, expired storage permission,
  interrupted upload and timeout have next steps. Missing upload links or
  unconfirmed completion cannot be treated as an uploaded asset.
- **Forms and account management:** sign-in, registration, reset, applications,
  account/profile edits and newsletter failures use actionable copy.
- **Campaign/profile editing:** existing local draft recovery remains intact.
  Creation, publication, unpublication, images and writing-help failures have
  next steps. No payment, fee or publication-ownership rules were changed.
- **Administration:** application decisions, lists, organisation access/deletion,
  email tests and bank-detail review/save failures received clearer guidance.
  Sensitive infrastructure messages are not exposed as user-facing diagnostics.
- **Payments/payouts:** transport failures warn that the result is uncertain.
  Donors/admins are directed to check receipts/history before retrying; no
  automatic financial retry was introduced. Existing structured payout error
  details remain available to their callers.
- **Volunteer pages:** generic “Something went wrong” copy now names the failed
  operation and gives a recovery action.

## Verification and boundaries

Regression tests cover network errors, intentional aborts, authentication,
permissions, missing records, upload limits/formats, rate limits, safe service
messages, financial uncertainty, direct-storage post uploads and completion
failure. A source guard catches website fetch calls that bypass the shared
network boundary.

This is a source and mocked-failure audit of the website, not a claim to have
reproduced every third-party outage, device failure or historical upload.
“Failed to fetch” alone cannot establish whether the partner’s original failure
was a connection interruption, browser/storage restriction or an unavailable
service. No actual user video, live charge, payout or email was used for tests.
Native-app and generated-client error messages are outside this website pass.
