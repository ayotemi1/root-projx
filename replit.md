# Root ProjX

## Overview

Root ProjX is a community giving platform connecting diaspora supporters to verified grassroots organisations in Jamaica, the UK, and beyond.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: bcryptjs (password hashing) + jsonwebtoken (JWT, 30-day expiry)
- **Mobile**: Expo (React Native), Expo Router
- **Web**: React + Vite (to be built in Step 5)

## Packages

| Package | Description |
|---|---|
| `@workspace/api-server` | Express + TypeScript API server |
| `@workspace/db` | Drizzle ORM schema + PostgreSQL connection |
| `@workspace/api-spec` | OpenAPI spec + codegen (Orval) |
| `@workspace/api-client-react` | Generated React Query hooks |
| `@workspace/api-zod` | Generated Zod validation schemas |
| `@workspace/mobile` | Expo React Native mobile app |

## Colour System (CRITICAL — do not deviate)

- **--red**: `#B50000` — primary buttons, destructive
- **--red-deep**: `#7A0000` — nav bar background, tab bar background
- **--red-mid**: `#9E0000` — hover/pressed states
- **--gold**: `#F5B800` — active tab, highlights, CTAs, goal fill
- **--white**: `#FFFFFF` — backgrounds, inactive tab
- **--white-faint**: `rgba(255,255,255,0.12)` — overlay text on dark surfaces
- **--gold-dim**: `rgba(245,184,0,0.55)` — subtle highlights, backgrounds
- **Card surface**: `#F9F6F0`
- **Secondary surface**: `#F2EDE4`
- **Border**: `#E0D8CC`
- **Muted text**: `#888888`

## Database Schema (8 tables)

- `users` — supporters and organisations
- `organisations` — org profiles with goal tracker fields
- `donations` — donation records with Stripe/PayPal processor info
- `follows` — supporter-to-org follow relationships
- `updates` — impact feed posts (Before/During/After tags)
- `help_reviews` — Get Help directory reviews
- `contact_events` — WhatsApp/email contact logging
- `resources` — org resource library

## Build Progress

- [x] Step 1 — Project scaffold complete
- [x] Step 2 — Database schema pushed, all 8 tables live, seed data verified
- [x] Step 3 — API server routes — all 7 route groups live and tested (PostgreSQL/Drizzle era)
- [x] Firebase Step 1 — PostgreSQL, Drizzle ORM, bcrypt, JWT fully removed. lib/db deleted. 35 packages uninstalled. api-server typechecks clean, builds clean, health endpoint live.
- [x] Firebase Step 2 — firebase-admin + firebase installed. Admin SDK initialised with applicationDefault() + projectId=rootprojx-1111. Client SDK init module created in mobile/lib/firebase.ts.
- [x] Firebase Step 3 — Firebase client and Admin initialised (REST-based, no GCP credentials needed)
- [x] Firebase Step 4 — Firebase Auth complete. register/login/logout/me all working. Uses Firebase Auth REST API + Firestore REST API with user's ID token. EXPO_PUBLIC_ vars passed through mobile dev script.
- [x] Firebase Step 5 — Firestore seed complete: 6 orgs, 10 updates, 4 reviews, 3 resources, 3 user stubs. Seed script: artifacts/api-server/scripts/seed.mjs (no build needed). Server token cached for public reads.
- [x] Firebase Step 6 — All 6 route groups live and tested (18/18 passing): organisations (CRUD), feed (public + personalised + org + post), follows (follow/unfollow/my), help (directory + reviews + contact), profile (get/patch), donations (stub ready for Stripe Step 9). JS-side sorting used to avoid Firestore composite index requirements.
- [ ] Firebase Step 7 — Connect mobile screens to Firestore
- [ ] Firebase Step 8 — Connect web pages to Firestore
- [ ] Firebase Step 9 — Stripe donation flow
- [ ] Firebase Step 10 — Brevo newsletter trigger
- [ ] Firebase Step 11 — Firebase Storage for media uploads
- [ ] Step 8 — PayPal

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema to PostgreSQL
- `pnpm --filter @workspace/db run seed` — seed database with dummy data
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/mobile run dev` — run Expo mobile app

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection string (Replit DB)
- `JWT_SECRET` — JWT signing secret
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` — Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook secret
- `STRIPE_PLATFORM_FEE_PERCENT` — platform fee percentage
- `PAYPAL_CLIENT_ID` — PayPal client ID
- `PAYPAL_CLIENT_SECRET` — PayPal client secret
- `BREVO_API_KEY` — Brevo (Sendinblue) API key
- `BREVO_SENDER_EMAIL` — sender email for newsletters
- `BREVO_SENDER_NAME` — sender name for newsletters
