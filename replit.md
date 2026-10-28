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

## Critical Implementation Notes

### Stripe
- Credentials fetched per-request via Replit connector API (`getUncachableStripeClient()`) — NEVER cache the Stripe instance
- Stripe customer IDs stored in `users/{uid}.stripeCustomerId` in Firestore (NOT PostgreSQL)
- Webhook route mounted at `/api/webhooks` with `express.raw()` BEFORE `express.json()` in `app.ts`
- Platform fee: `STRIPE_PLATFORM_FEE_PERCENT` env var (default 5%)
- On payment success webhook: creates donation doc in Firestore, auto-follows org, updates `totalRaised`

### Brevo
- API key in `BREVO_API_KEY` secret
- Optional `BREVO_NEWSLETTER_LIST_ID` env var for list subscription
- Optional `BREVO_SENDER_EMAIL` env var (defaults to `noreply@rootprojx.com`)
- All Brevo calls are fire-and-forget — errors are logged but never block responses
- Triggers: registration (welcome email + contact upsert) and donation success (confirmation email)

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

- URL: `/admin` (login at `/admin/login`)
- Password: `ADMIN_PASSWORD` env var (defaults to `rootprojx-admin` — set in Replit Secrets for production)
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
- `ADMIN_PASSWORD` — password for `/admin` dashboard (set in Replit Secrets; defaults to `rootprojx-admin`)
- `TEAM_EMAIL` — internal notification recipient (defaults to `info@rootprojx.com`)
