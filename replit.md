# Root ProjX

## Overview

Root ProjX is a community giving platform connecting diaspora supporters to verified grassroots organisations in Jamaica, the UK, and beyond.

## Phase 0 — stabilisation (Oct 2026)

The **website is the product**. The iOS app hands off to Safari via
`expo-web-browser` for payments; donations are not collected through native
payment sheets. The last Apple-reviewed build was 1.0 (7); the next configured
iOS build number is 8.

Six stabilisation fixes:

1. **Unified platform fee:** shared fee calculation defaults to 5%, with
   `STRIPE_PLATFORM_FEE_PERCENT` retaining its override; donation copy says 5%.
2. **Single donation writer:** the Stripe webhook owns donation writes,
   with `checkout.session.completed` authoritative for paid one-off donations,
   using Session metadata. `payment_intent.succeeded` is a logged donation no-op;
   invoice events still own recurring payments, and shop orders retain their
   separate handler. Session metadata is also supplied to PaymentIntent creation
   for reconciliation. Donations are deduplicated by PaymentIntent `stripeRef`,
   including historical records, with create-only IDs for new Checkout records.
   Checkout confirmation is read-only
   and the website polls while webhook recording is pending. The legacy
   duplicate-cleanup script is dry-run by default and must be run manually.
3. **Campaign credit:** campaign IDs pass through checkout metadata and the
   webhook credits `amountRaised` in the organisation's embedded campaigns array.
4. **Subscription lifecycle:** successful invoices create/update recurring
   records; subscription updates/deletion track active, paused, past-due, and
   canceled states. The website account page displays these statuses.
5. **Mobile payment hand-off:** donation entry points open the organisation's
   website donation page, preserving campaign context. The native Stripe SDK and
   publishable-key fetches are removed; the merch shop uses hosted checkout.
6. **£3 minimum:** all five donation creation endpoints and both web donation
   forms enforce the intended donation amount, before optional fee coverage.
   Presets are £3 / £5 / £10 / £25 / £50 / £100 / Custom.

Verification must use synthetic events and mocked Firestore, Stripe, and email
services: configured Stripe keys are **LIVE**, so never use a real charge as a
verification step. Run all API library tests with
`pnpm --filter @workspace/api-server run test:approval`.
Firestore rules are published manually; do not assume the `recurring` rules
block or Stripe subscription event subscriptions have been enabled merely
because the corresponding code is implemented.

Phase 0 verification includes
`artifacts/api-server/src/lib/phase0-verification.test.ts`, which uses the real
Checkout and webhook handlers with synthetic events and in-memory services.
It verifies 15p platform fees on £3 intended donations, one donation write after
replay and confirmation, and £3 campaign credit with fee coverage on and off.

**Donation accounting:** the shared helper in `lib/fees.ts` calculates whole-pence
amounts for all newly recorded donation payments and invoices:
`chargedGbp` is the card charge, `intendedGbp` is the original intended donation,
`platformFeeGbp` is the shared platform fee on that intended amount,
`feeCoverGbp` is the actual top-up when covered (otherwise zero), and `toOrgGbp`
is the organisation's estimated proceeds. `feeCovered` is a boolean.
UK processing is estimated at 1.5% + £0.20; international cards at 3.25% + £0.20.
Missing card country defaults to UK. Without original-amount metadata, the
intended amount defaults to the card charge for legacy/native and invoice flows.
With fee coverage, proceeds are intended minus platform fee; without it,
estimated processing fees are also deducted. These are estimates, not Stripe
settlement reconciliation.

Legacy aliases now mean `amountGbp = intendedGbp`,
`netAmountGbp = toOrgGbp`, and `grossAmountGbp = chargedGbp`.
Both public raised aggregates (organisation `totalRaised` and campaign
`amountRaised`) increment by intended donation. Organisation `totalOwedGbp`
increments by estimated proceeds for future Phase 1 payouts.
For a £3 intended UK donation, covered fees charge £3.25 and accrue £2.85 owed;
uncovered fees charge £3.00 and accrue £2.60 owed. Raised increases by £3 in both.
Confirmation emails show the intended donation and any covered-fee top-up;
the admin Donations table separates intended, charged, platform fee and to-org.
The fee-cover toggle says "Cover the card processing fees so more of my donation
reaches [org name]". Website previews and confirmation emails share canonical
accounting/disclosure functions from the browser-safe
`artifacts/api-server/src/lib/donation-accounting.ts`; the server `fees.ts`
wrapper supplies the configured platform percentage. Breakdowns itemise intended
donation, any fee cover, total charged, estimated organisation proceeds, platform
fee, and uncovered card processing. Fee cover never waives the platform fee.

Historical donations and totals have **not** been migrated or recalculated.
Older admin rows show — where canonical accounting fields are unavailable.
`totalOwedGbp` starts accumulating only from newly recorded events; it is not
yet a complete historical payable balance and must not drive payouts until
historical reconciliation is explicitly completed.

## Organisation self-service — campaign builder

Campaigns can use **GBP or USD**, including the actual one-off Stripe card charge.
Organisation-wide donations and existing monthly subscriptions remain GBP.
Legacy campaigns default to GBP. Goals, partner commitments/matches, progress,
donor checkout, receipt and confirmation email use the campaign currency.
Currency locks when a donor first starts checkout (or money has already been
raised), so existing or in-flight gifts can never be relabelled.

Organisation totals and the settlement ledger remain **GBP**. USD donations
retain native `receiptAccounting`, the presentment `currency`, and Stripe's
verified `exchangeRateToGbp`; top-level accounting fields remain GBP equivalents.
The campaign's `amountRaised` increases in its own currency, while the
organisation's `totalRaised` and `totalOwedGbp` increase by converted pounds.
USD settlement must supply a GBP balance transaction and exchange rate; if that
data is not ready, fail the webhook before writes so Stripe can retry. Never
assume USD equals GBP or invent a conversion. USD checkout estimates processing
at 3.25% + US$0.30; existing GBP estimates and the platform percentage are unchanged.

Campaigns support up to **10 videos**, uploaded from a device or linked from
YouTube/Vimeo. Each has optional descriptive caption text, poster and subtitles.
Website video uploads support MP4, MOV and WebM up to **500 MB per video**.
The authenticated API issues a short-lived direct-storage PUT URL, so file bytes
do not pass through the old 20 MB multipart/application request limit. Pending
objects are not served publicly. Completion validates actual storage metadata
and organisation ownership before moving the video into the existing media
proxy namespace; repeated completion returns the same asset. Images/subtitles
retain their existing multipart path. A completed upload still needs its campaign
draft saved; never treat file transfer alone as publication.
The ordered `videos` array takes precedence over the legacy single `video`;
an explicit empty array removes all videos. Unfinished rows remain in drafts,
but only videos with URLs render publicly. Upload completion merges by stable
editor row identity into the latest draft, never a stale array index.

The main organisation dashboard is `/dashboard` (`pages/dashboard.tsx`).
`/org-dashboard` remains a separate routed dashboard; it is not dead code.
The Campaigns tab uses a five-step editor: ask, money, story, appearance,
and preview/publish. Drafts save on every step and autosave during editing;
device recovery is scoped to the account, organisation and campaign.
Existing live campaigns stay public while revisions are saved privately.
Publishing explicitly promotes those revisions after server-side content,
organisation-profile and payout-readiness checks. Pending manual bank-transfer
requests do not satisfy the payout gate.

Campaigns remain an embedded array on the organisation. Editor writes, deletion
and webhook campaign credits use update-time preconditions and retry conflicts,
so a save cannot replace a concurrent donation credit. The editor cannot write
financial totals. New optional content includes tagline, committed funding,
itemised breakdown, three locations, lazy video with poster/captions, and a
custom visual donor unit with four built-in SVG choices. Editor previews,
owner-only direct draft links and public landing pages render the same component.
The hero uses one accessible canvas: up to 300 units are drawn individually,
with mass for the remainder, one fill animation and a reduced-motion still state.
Supporters are deduplicated from successful payments; consent controls names.
Historical anonymous gifts without a reusable identity are shown separately,
never presented as a count of distinct people.
Individually drawn campaign icons show the donor's consent-filtered public name
on hover, tap or keyboard selection (arrow keys/Home/End; Escape dismisses).
The artwork uses the newest 300 counted supporters, separately from the six-name
recent wall, and shows Anonymous without consent. Raw names, emails, payment IDs
and identity hashes are never sent for tooltips. Earlier aggregate units have no
invented individual attribution.

`partnerFunding` distinguishes **committed** funding already secured regardless
of donations from **matching** pledges triggered by donations. Committed is the
default: show "£X already committed by [funder]" and the three programme-funding
segments, never a donation multiplier. Matching alone uses `matchRatio` (default
1) and `matchCap` (default `amount`). Successful donation webhooks atomically
increase the server-owned `partnerFundingMatchedGbp`, capped at the remainder.
That allocation is neither another card charge nor a Root ProjX payout liability.
The multiplier disappears once exhausted and says matching has been fully claimed.
Editors cannot reset used matching or publish a cap below money already matched.

Legacy `matchFunding`, including private unpublished revisions, is migrated to
committed funding on read/save. For bulk persisted migration use
`node --experimental-strip-types artifacts/api-server/scripts/migrate-partner-funding.mjs`;
it is dry-run by default, with `--apply` for update-time-protected writes. It
changes funding metadata only, never donation, organisation or campaign totals.
Public pages retain the canonical £3 fee example.
Recorded donation receipts link back to the campaign with a one-time unit
highlight; client code never fabricates an increased supporter count.
The November landing-page amendments add scoped Inter typography and a centred
Dancing Script Bold campaign title. The hero contains inline amount selection
(default 10), optional estimated card-fee coverage and a canonical accounting
breakdown; these choices carry into the guest checkout sheet. Subsequent giving
buttons return to this box. Only a recorded campaign receipt enables its
thank-you state, showing the native gift amount and currency. A single circled
gold acknowledgement marker is permitted after confirmation; it is not an
identity link to another donor's unit and does not alter the supporter count.
Pre-checkout card charges remain explicitly estimated, not guaranteed Stripe fees.

Campaign `pageContent` optionally holds plain-text editorial section headings,
programme details, intended-outcome context, cohort plans and sharing copy.
Both owner preview and public pages use it; sparse campaigns keep their defaults.
The HOV PDF copy is retained in `artifacts/api-server/scripts/content/hov-campaign.json`.
Its sync script is dry-run by default, preserves financial fields and publication,
and saves private revisions rather than silently replacing a published version.
Illustrative PDF figures and placeholder people/photos are not imported as facts.

Campaign recent-donor walls show the latest six distinct donors, newest first,
using successful campaign-attributed payments only. Guest names require explicit
`wallOptIn` and are reduced to first name/last initial before Stripe metadata.
Without consent the payment remains anonymous; never infer a public name from
billing details or email. Public responses contain no donor contact details,
payment references or identity hashes. Campaign pages refresh this list while open.

### Password recovery

Web sign-in links to `/forgot-password`, which requests
`POST /api/auth/forgot-password`. Organisation and supporter accounts both use
the existing Firebase reset-email flow. The website `/reset-password` action
handler verifies Firebase codes, accepts a confirmed new password, and offers
fresh-link recovery for expired, invalid or already-used links. Provider outages
remain retryable without being misreported as expiry. `/forgot-password` offers
resend after a 60-second cooldown, a different-email option, and sign-in links.
Firebase still enforces code expiry, single use and its password policy.
**Activation:** after publishing, Firebase Console → Authentication → Templates
→ Password reset → Edit → Customize action URL must point to
`https://rootprojx.com/reset-password`. This is an external Firebase setting;
deploying code does not change it. Previously sent emails still open their
original Firebase-hosted handler; request a fresh link after activation.
Do not retrieve, display or set users' passwords through administrator tooling.
Registered and unknown addresses receive identical confirmation; malformed
input is rejected and requests are limited separately from sign-in attempts.
Email-provider failures remain explicit retryable errors. Verify using mocked
Firebase/email calls, not by resetting a real organisation account.

**Accounting follow-up before publication:** destination-charge Checkout still
sets Stripe `application_fee_amount` to the platform fee alone. That does not
withhold the processing estimate used by the canonical `toOrgGbp` model. The
displayed £2.85/£2.60 examples describe the accounting model, not a verified
Connect destination-transfer amount. Financial routing was not changed in this
self-service UI pass; reconcile that split explicitly rather than silently
changing live payment behaviour.

Draft preview links are `/campaign/preview/:orgId/:campId`, owner-only and
non-cacheable. They show "Draft — only you can see this", disable donations and
sharing, and record an actual preview-open event for the walkthrough. Unpublish
preserves the draft and can be reversed by publishing after gates pass.
Dashboard and editor preview actions save the latest open-editor changes first.
Profile previews wait for all mounted sections; campaign previews flush the
wizard draft. Failed saves block navigation and preserve recovery data.

The main dashboard defaults to Overview: money, supporters, campaigns, updates,
then impact metrics. Outstanding owed comes from unpaid payout ledger entries,
not lifetime `totalOwedGbp`. A next payout date is shown only when actually
scheduled; otherwise it says "Not scheduled". The summary requires the existing
server-side payout/disbursement collection permissions from the payout phase.
Money includes per-campaign intended totals. The setup checklist sits below the
main dashboard content, not above Money. Monthly impact reminders include the
active goal as well as the three impact metrics. Monetary examples use the shared
accounting helper; never describe organisation proceeds as a blanket percentage.

Dashboard summary sources fail independently: unreadable legacy disbursements
must not suppress confirmed raised totals, ledger balances, supporters or campaigns.
`unavailable` identifies affected sections; unknown owed balances stay null and
unknown payout history must never be presented as "None yet". The web displays
one neutral refresh notice, not repeated failure labels. Firestore must allow the
existing API server identity to read `disbursements`; publish that rules change
manually in Firebase Console. Do not silently substitute zero for denied queries.

The guided setup uses Driver.js and declarative, stable-anchor steps. It checks
saved content, not typing or clicking Next. Every walkthrough step can be browsed
past with "Skip to next step"; this never completes missing content or bypasses
publication/payout gates. Failed, pending or unsaved edits still block skipping.
Preview steps require recorded opens. Exit/resume/replay progress lives on the
organisation document, separate from editable content and financial fields.
Pending progress remains in memory even if device storage fails, and only the
acknowledged snapshot is cleared after a successful save.
The profile tour has 10 steps and the campaign tour 12. Manual and delayed
automatic advancement both recheck current save/error state. Dirty, saving or
failed editors cannot advance, even if an older saved value met the content
check. Campaign preview completion must match the selected campaign; publication
completion also requires that no private revision remains unpublished.

`CAMPAIGN_ASSIST_ENABLED` defaults off. The writing-assistant endpoint is an
authenticated, owner-scoped, rate-limited socket only; its provider-free adapter
returns unavailable. Manual writing/saving never depends on it. A future
suggestion must be explicitly accepted before `assistUsed` is saved.
Requests flush the current campaign draft first so the socket receives the latest
saved context. A failed flush makes no assistant request. Acceptance applies the
chosen text and `assistUsed` together; editing a suggestion alone never saves it.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Firebase Firestore (REST API via `firebase-rest.ts` helper — no Admin SDK required)
- **Auth**: Firebase Auth REST API (ID token stored in AsyncStorage on mobile, localStorage on web)
- **Build**: esbuild (CJS bundle via `build.mjs`)
- **Mobile**: Expo (React Native), Expo Router, TanStack Query
- **Web**: React + Vite, Wouter routing, TanStack Query, Tailwind CSS
- **Payments**: Stripe (Replit connector — credentials fetched per-request, never cached)
- **Email/Newsletter**: Brevo REST API v3 (`BREVO_API_KEY` secret)

## Packages

| Package | Description |
|---|---|
| `@workspace/api-server` | Express + TypeScript API server (port 8080) |
| `@workspace/api-zod` | Shared Zod validation schemas |
| `@workspace/mobile` | Expo React Native mobile app |
| `@workspace/web` | React + Vite web app (port 22333) |
| `@workspace/mockup-sandbox` | Component preview server for canvas mockups |

## Colour System (CRITICAL — do not deviate)

- **--red**: `#B50000` — primary buttons, destructive
- **--red-deep**: `#7A0000` — nav bar background, tab bar background
- **--red-mid**: `#9E0000` — hover/pressed states
- **--gold**: `#F5B800` — active tab, highlights, CTAs, goal fill
- **--white**: `#FFFFFF` — backgrounds, inactive tab
- **--white-faint**: `rgba(255,255,255,0.12)` — overlay text on dark surfaces
- **Card surface**: `#F9F6F0`
- **Secondary surface**: `#F2EDE4`
- **Border**: `#E0D8CC`
- **Muted text**: `#888888`

## Firestore Collections

- `users` — supporters and organisations (includes `stripeCustomerId` field added on first payment)
- `organisations` — org profiles, includes `followerCount`, `totalRaised`, `impactScore`
- `donations` — donation records (created by Stripe webhook on payment success)
- `follows` — supporter-to-org follow relationships (auto-created after donation)
- `updates` — impact feed posts (Before/During/After tags)
- `reviews` — Get Help directory reviews
- `help_entries` — Get Help directory entries

## API Routes

All routes prefixed `/api`:
- `/auth/*` — register, login, logout, me
- `/organisations/*` — CRUD, list, profile
- `/feed/*` — impact feed, personalised, org updates
- `/follows/*` — follow/unfollow/my
- `/help/*` — directory + reviews + contact events
- `/profile/*` — get/patch user profile
- `/donations/*` — Stripe payment-intent, subscription, publishable-key, my donations
- `/newsletter/subscribe` — Brevo contact upsert
- `/webhooks/stripe` — Stripe payment webhook (raw body, mounted BEFORE express.json())

## Private bank-transfer details

Organisations choosing bank transfer enter payout account details under Dashboard
→ Payouts → Bank transfer. Only approved organisation owners can submit. The
private `organisation_bank_details/{orgId}` record stores an AES-256-GCM envelope,
bound to the organisation ID, plus revision and submission time. A dedicated
`BANK_DETAILS_ENCRYPTION_KEY` must contain a random 32-byte key encoded as base64;
there is no fallback to session secrets or plaintext. Keep a secure backup: losing
or replacing it without a migration makes existing records unreadable.

Owner reads return submission status only. Admin full-detail reads require
explicit review, are not cached, and log access without account data. The browser
keeps raw input/review data in component memory only. Public organisation
responses exclude the bank revision and contain no bank record or identifiers.
Saving details atomically withdraws prior approval. Admin approval is bound to
the reviewed revision; concurrent changes require review again. Edits are blocked
while a payout settlement/reconciliation lock exists. Approval never sends money.
Legacy approved off-platform arrangements are not silently deleted; submitting
their first on-site record withdraws the old approval and requires fresh review.

Admin credentials now use `ADMIN_PASSWORD`, or existing `ADMIN_SECRET` when no
password is configured. There is no built-in default. Existing sessions based
on the old default must sign in again after publication.

Activation also requires manually publishing the server-only
`organisation_bank_details` rules block in Firebase Console. Do not edit or
publish `firestore.rules` automatically. Preserve other live collection rules.

Bank reviews open with metadata and masked placeholders only; no partial bank
identifiers are stored for display. Explicit Reveal decrypts and creates a
`bank_details_audit` record before returning plaintext. A failed audit prevents
disclosure. Approval and its audit entry are in one atomic Firestore commit, so
neither can succeed alone. Audit fields are `adminIdentity`, `identityType`,
`action`, `timestamp`, `orgId`, and `revision`. The present shared credential can
only identify `shared-admin`, not an individual person. No credentials, tokens
or banking values are audit fields.

The audit collection needs server-only read/create rules and unconditional denial
of update/delete, including for the ordinary API server identity. Do not add an
overlapping permissive wildcard: Firestore allow rules are additive. Firebase
privileged IAM/Admin SDK access can bypass rules; this is application-level
append-only storage, not a WORM guarantee against project administrators.
Until those rules are manually published, reveals/approvals fail closed.

New encryption envelopes are `v2.primary.<iv>.<tag>.<ciphertext>` with the key ID
authenticated as part of AAD. `primary` names the existing dedicated key.
Legacy `v1` records use that same current key and are not rewritten by deployment.
Unknown key IDs fail closed. A rotation still needs a retained keyring and an
explicit re-encryption migration; do not replace the secret assuming the key ID
alone preserves readability. The storage helper validates the envelope and
permits only encrypted/revision/submittedAt fields. Structured logger redaction
covers bank identifiers and names in common nested body/detail objects; never
interpolate banking values into message strings.

## Organisation content library

The public profile's Posts tab is an Instagram-style three-column square grid.
These are general posts, not restricted to progress updates or milestones.
Organisations and delegated admins publish through Dashboard → Posts; a device
photo/video upload, social link or caption is enough, with no required title or
category. Existing `updates` records/API routes remain compatible internally.
The Live Feed includes all post types and refreshes while open.
Uploaded videos play in a post dialog on both profiles and the Live Feed;
YouTube/Vimeo players load only after an explicit Play action. Instagram links
open externally without requiring a connected Instagram account; upload the
original media as well when it should be viewable on the profile itself.
Supported public HTTPS post links are validated on both client and server.
Uploaded-but-unpublished attachment URLs are recoverable per organisation in
the browser, and retries reuse them rather than uploading the same files again.
No separate collection or Firestore rules change is required.

## Critical Implementation Notes

### Stripe
- Credentials fetched per-request via Replit connector API (`getUncachableStripeClient()`) — NEVER cache the Stripe instance
- Stripe customer IDs stored in `users/{uid}.stripeCustomerId` in Firestore (NOT PostgreSQL)
- Webhook route mounted at `/api/webhooks` with `express.raw()` BEFORE `express.json()` in `app.ts`
- Platform fee: `STRIPE_PLATFORM_FEE_PERCENT` env var (default 5%)
- On payment success webhook: creates donation doc in Firestore, auto-follows org, updates `totalRaised`

### Brevo
- API key in `BREVO_API_KEY` secret
- Admin dashboard includes **Send test email**, calling authenticated
  `POST /api/admin/email/test`. It sends only to `TEAM_EMAIL` (fallback
  `info@rootprojx.com`), never a caller-selected recipient. One attempt per minute
  per server instance; no automatic retry. The response identifies production
  versus development and reports Brevo acceptance, not inbox delivery. Test from
  the published admin page to check the production server's IP authorisation.
- Optional `BREVO_NEWSLETTER_LIST_ID` env var for list subscription
- Optional `BREVO_SENDER_EMAIL` env var (defaults to `noreply@rootprojx.com`)
- All Brevo calls are fire-and-forget — errors are logged but never block responses
- Triggers: registration (welcome email + contact upsert) and donation success (confirmation email)
- Each newly recorded successful one-off donation and recurring invoice payment
  also sends separate notifications to the receiving organisation and Root ProjX.
  Organisation alerts use `users/{orgId}.email`, falling back to `contact.email`;
  team alerts use `TEAM_EMAIL`, falling back to `info@rootprojx.com`.
  They include campaign attribution, native-currency canonical accounting and
  payment reference, never the donor's email. Only consented public donor names
  appear; otherwise the donor is anonymous. Existing webhook dedup guards prevent
  replay alerts. Each recipient is attempted independently; notification failures
  are logged without interrupting accounting. As with receipts, these are Brevo
  delivery attempts, not a durable retry queue or a guarantee of inbox delivery.

### Firebase REST API
- No Admin SDK service account needed — uses Firebase REST API with ID tokens
- Server-side calls use a server token (`getServerToken()`) from `firebase-rest.ts`
- All Firestore queries sorted JS-side to avoid composite index requirements

## Build Progress

- [x] Firebase Step 1 — PostgreSQL/Drizzle removed, Firebase Admin init
- [x] Firebase Step 2 — Firebase Auth + Firestore REST client
- [x] Firebase Step 3 — Auth routes (register/login/logout/me)
- [x] Firebase Step 4 — Firebase env vars wired to mobile
- [x] Firebase Step 5 — Firestore seeded (6 orgs, 10 updates, 4 reviews, 3 resources, 3 user stubs)
- [x] Firebase Step 6 — All API route groups live (organisations, feed, follows, help, profile, donations)
- [x] Firebase Step 7 — Mobile app fully connected to live API (14 screens, auth, tabs, org profile, donate, dashboard)
- [x] Firebase Step 8 — Web app connected to Firestore via API (9 pages: discover/feed/help/account/org-profile/donate/dashboard/login/register + Navbar)
- [x] Firebase Step 9 — Stripe donation flow (one-time + recurring, web + mobile, webhook handlers, platform fee, auto-follow)
- [x] Firebase Step 10 — Brevo newsletter (welcome email on register, donation confirmation, subscribe endpoint, web footer with newsletter form)
- [x] Firebase Step 11 — Firebase Storage for media uploads (init in `lib/firebase-storage.ts` + startup assertion in `index.ts`; feed cards render uploaded photos/videos inline on web and mobile)
- [x] Firebase Step 12 — Org application flow (questionnaire-only `/onboarding`, `org_applications` Firestore collection, admin dashboard at `/admin` + `/admin/login`, approve/decline with Firebase account creation, 5 Brevo email types, internal team notifications)

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/mobile run dev` — run Expo mobile app
- `pnpm --filter @workspace/web run dev` — run web app
- `node artifacts/api-server/scripts/seed.mjs` — re-seed Firestore

## Environment Secrets Required

- `BREVO_API_KEY` — Brevo (Sendinblue) API key ✅ configured
- `SESSION_SECRET` — session signing secret ✅ configured

## Admin Dashboard

### Removing an organisation

Admin → Organisations → **Delete organisation** requires typing `DELETE` in
capitals for every organisation, never its name. Nameless records also show
the organisation ID; empty text is never accepted. Removal is a retained-record
deletion: `deletedAt`/`deletedBy` hide the
organisation and its embedded campaigns from normal API reads, block organisation
bearer access and checkout, and hide its posts from public/personalised feeds.
The admin list removes it after confirmation. No restore button is provided.
Deletion is blocked while any recurring donation is not canceled; it does not
cancel subscriptions or close Stripe/Wise accounts automatically.
Donations, payouts, balances and the underlying organisation record remain for
accounting. Financial settlement and in-flight webhooks explicitly read retained
organisations, so deleting a profile does not prevent settling existing liabilities.
No Firestore rules changes or real organisation deletions are used for verification.

- URL: `/admin` (login at `/admin/login`)
- Password: non-empty `ADMIN_PASSWORD` takes precedence, otherwise `ADMIN_SECRET`; no built-in default. Missing both fails closed.
- Tabs: **Applications** (pending/approved/declined org applications, approve/decline actions) | **Supporters** (all registered supporters)
- Approve action: creates Firebase Auth account + org profile, emails temp password to org
- Decline action: sends decline email

## Brevo Emails (5 types)

1. **Supporter welcome** — sent on supporter registration
2. **Donation confirmation** — sent after successful payment (via Stripe webhook)
3. **Org application received** — sent to org on questionnaire submission
4. **Org accepted** — sent on admin approval (includes temp login password)
5. **Org declined** — sent on admin decline
6. **Internal notification** — sent to `TEAM_EMAIL` (or `info@rootprojx.com`) on every new signup (org or supporter)

## Firestore Collections

(See above for full list.) New: `org_applications` — org application submissions with status `pending | approved | declined`.

> ⚠️ The `org_applications` Firestore security rules must be deployed manually if the collection doesn't exist yet. See `firestore.rules` and deploy via Firebase Console → Firestore → Rules.

## Environment Variables (Non-secret)

- `BREVO_NEWSLETTER_LIST_ID` — Brevo list ID for newsletter subscribers (optional)
- `BREVO_SENDER_EMAIL` — sender email for transactional emails (optional, defaults to noreply@rootprojx.com)
- `STRIPE_PLATFORM_FEE_PERCENT` — platform fee % (default 5)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (set in production for signature verification)
- `ADMIN_PASSWORD` — optional admin password, takes precedence over `ADMIN_SECRET`; no built-in default or strength validation
- `TEAM_EMAIL` — internal notification recipient (defaults to `info@rootprojx.com`)
