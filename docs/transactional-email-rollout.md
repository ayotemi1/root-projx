# Transactional email operations

## Implemented

- The original sixteen supplied HTML files and manifest remain unchanged.
  HTML/text rendering escapes data, validates links and uses the exact supplied
  logo, now available through the existing published object proxy.
- The separate daily-summary derivative uses template 12's design, individual
  consented-name/Anonymous gift rows, net organisation proceeds and campaign
  progress. Zero-gift days never produce a message.
- Sender: `Root ProjX <info@rootprojx.com>`. Reply-to and all admin alerts: `info@rootprojx.com`. Legacy sender and team-recipient overrides cannot change this identity.
  Brevo accepted all sixteen original sample messages and the daily summary.
  Acceptance is not proof of inbox delivery or client rendering.
- Welcome, actual application transitions, team invitations, confirmed
  donations, publication, campaign goals and confirmed sent payouts are wired.
  Signup does not introduce email confirmation: template 01 is preview-only
  while confirmation is disabled.
- Existing successful-donation accounting, checkout recording authority,
  settlement and fees are preserved. Receipt amounts come from native receipt
  accounting, not a USD campaign's GBP settlement amount. Public campaign
  progress includes committed or actually allocated partner funding, just as
  the campaign page does.
- The owner approved omitting only inapplicable financial rows: uncovered
  donor-fee rows, non-card payment details, absent campaign targets and unknown
  provider bank/arrival/period metadata. No amounts, dates or bank digits are
  invented. Financial policy wording is otherwise unchanged.
- Owner settings, scoped email-preference links, emailed team invitations,
  seven-day identity-bound acceptance, application information requests and
  admin configuration/history use private APIs. Managers remain content-and-
  Inbox only; accepting an old invitation cannot restore removed access.
- Application approval atomically changes the application, account role and
  initial profile. Information requests, responses and declines check current
  state to avoid overwriting a concurrent decision.

## External setup still required

### Password-reset delivery — no additional credential required

Password resets use Firebase Auth's existing reset-email API exclusively.
The owner configured Firebase Auth SMTP through Brevo from info@rootprojx.com
and set the public-facing project name to Root ProjX. Do not change those
Firebase Auth settings or request a service-account key: key creation is
intentionally blocked by the owner's Google organisation policy.
Template 06 is retained unchanged as a design reference, excluded from sample
sends and suppressed if found in the application outbox. No app-managed reset
email is sent. Any previously added reset-specific credential is unused.

### Durable scheduling

The website must remain a web deployment. Do not turn it into a Scheduled
Deployment. Deploy the updated website and API normally first.
Publishing and Scheduled Deployment activation require the owner's actions in
Replit's Publishing tool; a running Preview worker is not a durable schedule.

1. In Admin Tools, create the email-only scheduler key. It is shown once.
2. Store it as `ROOTPROJX_EMAIL_JOB_KEY` in a separate scheduled caller.
3. Every five minutes, run the supplied standalone Node script
   `artifacts/api-server/scripts/run-email-job.mjs`, or POST to the endpoint
   displayed in Admin Tools with the key in `x-email-job-key`.
4. Check the last-run status in Admin Tools. Creating a key does not start
   scheduling. Rotating it stops previous callers immediately.

Use cron `*/5 * * * *` for the caller. This checks for pending mail every five
minutes; it does not send a daily summary every five minutes. Summaries cover
completed Europe/London days and send only for days with eligible gifts.

The caller needs only that narrow key, not the app's Firebase, Stripe or Brevo
credentials. The API stores only its hash; request logging redacts the header.
For a finite maintenance pass in the actual app environment, build the API and
run `node artifacts/api-server/dist/email-worker.mjs`.

Daily summaries close completed Europe/London days, with a ten-minute midnight
grace period. Outstanding donation source markers and preparation journals
prevent partial batches. An immutable source manifest prevents a second
summary for the same campaign/day/currency/recipient. A genuinely late gift
is retained as **Needs attention** in admin history, never silently discarded
or falsely marked as included.

### Provider and storage setup already verified

The owner manually published the five API-only collection rules and previously
authorised Brevo access; the original sample batch passed. The owner subsequently
confirmed verifying `info@rootprojx.com` and deleting the hello sender directly
in Brevo. Do not repeat sender management.
The published site serves the exact original PNG bytes. Production egress may
differ from Preview, so check provider access after publication as well.

The full proposed rules remain in `docs/email-firestore-rules.proposed.txt`.
The root `firestore.rules` was not automatically changed or published.

## Delivery safety

Source-event journals are durable before deferred HTTP work. The worker
recovers source flags, composes pending events, prepares closed daily batches
and processes the outbox. Preparation failures back off so one broken event
does not starve newer work.

Recipients, message bodies and action links are encrypted at rest. Stable
event keys make retries create-only; signed-in/guest receipt variants share
one donation dedupe namespace. Essential mail cannot be disabled by optional
preferences. Existing explicit campaign-email opt-outs are also respected.

Provider 429s retry later. Definitive rejections can be retried explicitly.
Network ambiguity, unknown acceptance and abandoned `sending` claims are not
automatically resent: check the provider before doing anything that could
duplicate a message. `accepted` is not labelled `delivered`.

Wise payout messages wait for `outgoing_payment_sent`, not merely funding
completion. Stripe payout messages require a verified connected-account
`payout.paid` event and read-only provider confirmation. Ensure that event is
enabled for the existing webhook endpoint if Stripe automatic payouts are
used. No transfer, checkout or Stripe API version was changed.

Finish pending encrypted work before rotating `SESSION_SECRET`; rotation
invalidates old encrypted payloads and signed preference capabilities.

## Visual samples

`artifacts/api-server/scripts/email-samples.mjs` reads recipient and sample
values from stdin. It validates every message before sending anything.
Without `--send` it is preview-only. Sending also requires explicit sample
consent. Its stable sample-pack keys prevent accidental repeated batches.
It never changes saved preferences, creates payments or grants team access.
The confirmation/reset/invitation samples do not perform real account actions.
Template 06 is now excluded from this sample pack; Firebase Auth owns resets.

## Latest pre-publication checks

The API build passed. The full approval suite ran 467 checks: 456 passed and
the same 11 pre-existing checks failed. Details and user-facing implications
are in `docs/existing-test-failures.md`.

The owner republished. Production config, job-status and history endpoints now
return HTTP 200; the admin recipient is info@rootprojx.com. The scheduler status
reports no configured key and no recorded scheduled runs.

The two explicitly requested template proofs (03 and 07) were prepared with
clearly labelled test data and processed through the production API. Brevo
rejected both with HTTP 401. Neither was accepted. No payment or application
was created. Inspect Brevo's production authentication/IP rejection before
retrying; do not infer that verifying a sender authorises the production server.

When retrying, reuse the existing stable recipient-bound proof records. Do not
enqueue another copy with a new proof key.
Send only the two explicitly requested
template proofs (03 and 07) through the production API's delivery processor.
Use stable recipient-bound proof keys, clearly labelled test data, and no real
charge or application creation. Do not substitute a Preview send for a live
send, resend the whole sample pack, or claim inbox delivery from provider
acceptance alone. Successful live proof delivery and schedule activation remain
pending; a manual production processing pass is not an active schedule.
