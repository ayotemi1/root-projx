# Root ProjX

## Overview

Root ProjX is a community giving platform connecting diaspora supporters to verified grassroots organisations in Jamaica, the UK, and beyond.

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
- Platform fee: `STRIPE_PLATFORM_FEE_PERCENT` env var (default 3%)
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

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/mobile run dev` — run Expo mobile app
- `pnpm --filter @workspace/web run dev` — run web app
- `node artifacts/api-server/scripts/seed.mjs` — re-seed Firestore

## Environment Secrets Required

- `BREVO_API_KEY` — Brevo (Sendinblue) API key ✅ configured
- `SESSION_SECRET` — session signing secret ✅ configured

## Environment Variables (Non-secret)

- `BREVO_NEWSLETTER_LIST_ID` — Brevo list ID for newsletter subscribers (optional)
- `BREVO_SENDER_EMAIL` — sender email for transactional emails (optional, defaults to noreply@rootprojx.com)
- `STRIPE_PLATFORM_FEE_PERCENT` — platform fee % (optional, defaults to 3)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (set in production for signature verification)
