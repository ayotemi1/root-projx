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

- **Primary (Deep Red)**: `#8B1A1A` — nav bar, primary buttons
- **Accent (Gold)**: `#C9A84C` — active tab, highlights, CTAs
- **Background**: `#FFFFFF`
- **Card surface**: `#F9F6F0`
- **Secondary surface**: `#F2EDE4`
- **Border**: `#E0D8CC`
- **Muted text**: `#888888`
- **Tab bar background**: `#8B1A1A` (deep red)
- **Active tab**: `#C9A84C` (gold)
- **Inactive tab**: `#FFFFFF`

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
- [ ] Step 2 — Database schema push + seed data
- [ ] Step 3 — API server routes
- [ ] Step 4 — Mobile app
- [ ] Step 5 — Web app
- [ ] Step 6 — Stripe donation flow
- [ ] Step 7 — Brevo newsletter
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
