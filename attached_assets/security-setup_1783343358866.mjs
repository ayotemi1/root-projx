#!/usr/bin/env node
/**
 * Root ProjX — one-shot security setup
 * =====================================
 * Run from the Replit shell at the project root:
 *
 *     node security-setup.mjs https://your-production-domain.com
 *
 * What it does automatically:
 *   1. Rotates the seeder@rootprojx.internal Firebase password to a strong
 *      random one (signs in with the old password, updates it via the
 *      Firebase Auth API, verifies the new one works).
 *   2. Creates (or recreates) the Stripe webhook endpoint for
 *      <domain>/api/webhooks/stripe and captures its signing secret.
 *   3. Prints the exact two values to paste into Replit Secrets.
 *
 * Requires: Node 18+ (Replit has Node 24). Zero npm dependencies.
 */

import crypto from "node:crypto";

const ANSI = { g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", b: "\x1b[1m", x: "\x1b[0m" };
const ok = (m) => console.log(`${ANSI.g}✔${ANSI.x} ${m}`);
const warn = (m) => console.log(`${ANSI.y}⚠${ANSI.x} ${m}`);
const fail = (m) => { console.error(`${ANSI.r}✘ ${m}${ANSI.x}`); process.exit(1); };

// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY = process.env.FIREBASE_API_KEY;
if (!API_KEY) fail("FIREBASE_API_KEY is not set in this environment. Run this inside your Replit workspace shell.");

const SERVER_EMAIL = process.env.FIREBASE_SERVER_EMAIL ?? "seeder@rootprojx.internal";
// Passwords to try, in order: current env value first, then the old committed fallback.
const OLD_PASSWORD_CANDIDATES = [
  ...(process.env.FIREBASE_SERVER_PASSWORD ? [process.env.FIREBASE_SERVER_PASSWORD] : []),
  "RootSeed2024!",
];

const IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts";

const domainArg = process.argv[2];

// ─── Step 1: rotate the Firebase server account password ─────────────────────
async function signIn(email, password) {
  const res = await fetch(`${IDENTITY}:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  return res.ok ? data.idToken : null;
}

async function rotatePassword() {
  console.log(`\n${ANSI.b}Step 1 — Rotating Firebase server account password${ANSI.x}`);

  let idToken = null;
  let usedOld = null;
  for (const candidate of OLD_PASSWORD_CANDIDATES) {
    idToken = await signIn(SERVER_EMAIL, candidate);
    if (idToken) { usedOld = candidate; break; }
  }
  if (!idToken) {
    fail(
      `Could not sign in as ${SERVER_EMAIL} with any known password.\n` +
      `  If you already rotated it manually: great — just make sure FIREBASE_SERVER_PASSWORD\n` +
      `  in Replit Secrets matches, and re-run this script to set up the Stripe webhook only.`,
    );
  }
  if (usedOld === "RootSeed2024!") {
    warn("Signed in with the OLD COMMITTED password — rotation is urgent. Rotating now.");
  } else {
    ok("Signed in with the password from FIREBASE_SERVER_PASSWORD.");
  }

  // 24 random bytes → ~32 chars, URL-safe. Far beyond brute-force range.
  const newPassword = crypto.randomBytes(24).toString("base64url");

  const res = await fetch(`${IDENTITY}:update?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, password: newPassword, returnSecureToken: true }),
  });
  if (!res.ok) fail(`Password update failed: ${(await res.text()).slice(0, 300)}`);

  // Verify the new password actually works before we report success.
  const verify = await signIn(SERVER_EMAIL, newPassword);
  if (!verify) fail("New password was set but verification sign-in failed — check Firebase console.");
  ok("Password rotated and verified. Old password is now dead.");
  return newPassword;
}

// ─── Step 2: Stripe webhook endpoint ─────────────────────────────────────────
async function getStripeSecretKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;

  // Replicate the Replit connector lookup used by the app itself.
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) return null;

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", isProduction ? "production" : "development");

  const res = await fetch(url, { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } });
  const data = await res.json();
  return data.items?.[0]?.settings?.secret ?? null;
}

async function stripeApi(secretKey, method, path, form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe ${method} ${path} failed`);
  return data;
}

async function setupWebhook() {
  console.log(`\n${ANSI.b}Step 2 — Stripe webhook endpoint${ANSI.x}`);

  const secretKey = await getStripeSecretKey();
  if (!secretKey) {
    warn("Couldn't obtain a Stripe secret key (no STRIPE_SECRET_KEY, no connector). Skipping webhook setup.");
    return null;
  }
  const mode = secretKey.startsWith("sk_live") ? "LIVE" : "TEST";
  if (mode === "TEST") {
    warn("Using a TEST-mode Stripe key (the connector returns test credentials in the workspace shell).");
    warn("This creates a TEST webhook. For the LIVE webhook, temporarily set STRIPE_SECRET_KEY to your");
    warn("live key in Replit Secrets and re-run — or create it once in the Stripe dashboard.");
  } else {
    ok("Using LIVE Stripe credentials.");
  }

  const domain = domainArg
    ?? (process.env.REPLIT_DEPLOYMENT_DOMAIN ? `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN}` : null);
  if (!domain) {
    warn("No domain provided. Re-run as:  node security-setup.mjs https://your-production-domain.com");
    return null;
  }
  const webhookUrl = `${domain.replace(/\/$/, "")}/api/webhooks/stripe`;

  // If an endpoint for this URL already exists, delete it — Stripe only reveals
  // the signing secret at creation time, so recreating is the way to obtain it.
  const existing = await stripeApi(secretKey, "GET", "/webhook_endpoints?limit=100");
  for (const ep of existing.data ?? []) {
    if (ep.url === webhookUrl) {
      await stripeApi(secretKey, "DELETE", `/webhook_endpoints/${ep.id}`);
      ok(`Removed existing endpoint for ${webhookUrl} (secret not retrievable — recreating).`);
    }
  }

  const endpoint = await stripeApi(secretKey, "POST", "/webhook_endpoints", {
    url: webhookUrl,
    "enabled_events[0]": "payment_intent.succeeded",
    "enabled_events[1]": "invoice.payment_succeeded",
    description: "Root ProjX donation webhook (created by security-setup script)",
  });
  ok(`Webhook endpoint created (${mode}): ${webhookUrl}`);
  return endpoint.secret;
}

// ─── Run ──────────────────────────────────────────────────────────────────────
const newPassword = await rotatePassword();
const webhookSecret = await setupWebhook();

console.log(`\n${ANSI.b}${"═".repeat(60)}${ANSI.x}`);
console.log(`${ANSI.b}FINAL STEP — paste these into Replit Secrets (Tools → Secrets):${ANSI.x}\n`);
console.log(`  FIREBASE_SERVER_PASSWORD = ${newPassword}`);
if (webhookSecret) console.log(`  STRIPE_WEBHOOK_SECRET    = ${webhookSecret}`);
else console.log(`  STRIPE_WEBHOOK_SECRET    = (not created — see warnings above)`);
console.log(`\nThen click Redeploy so the deployment picks up the new secrets.`);
console.log(`${ANSI.y}Note:${ANSI.x} donations will not record until BOTH secrets are set — that's the`);
console.log(`fail-closed protection working as intended.\n`);
