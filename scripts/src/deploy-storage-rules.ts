/**
 * deploy-storage-rules.ts
 *
 * Deploys ./storage.rules to the Firebase project via the Security Rules REST
 * API.  The script obtains a Google OAuth2 access token from Application Default
 * Credentials (ADC) through the firebase-admin SDK — the same credential path
 * used by the API server.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run deploy-storage-rules
 *
 * Requirements:
 *   - FIREBASE_PROJECT_ID env var must be set.
 *   - GOOGLE_APPLICATION_CREDENTIALS must point to a service-account JSON file
 *     (or the process must run inside a GCP environment with attached ADC).
 *
 * If credentials are unavailable the script prints clear instructions for
 * deploying the rules manually via the Firebase Console instead.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, "../../storage.rules");
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

if (!PROJECT_ID) {
  console.error("ERROR: FIREBASE_PROJECT_ID is not set.");
  process.exit(1);
}

const rulesSource = readFileSync(RULES_PATH, "utf8");

// ── Initialise firebase-admin (only if not already done) ─────────────────────
if (getApps().length === 0) {
  try {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  } catch (err) {
    console.error(
      "Could not initialise Firebase Admin (no Application Default Credentials found).\n",
      "To deploy storage rules you can either:\n",
      "  1. Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key JSON file, or\n",
      "  2. Paste the rules below directly into Firebase Console → Storage → Rules:\n\n",
      rulesSource,
    );
    process.exit(1);
  }
}

// ── Retrieve OAuth2 access token from ADC ────────────────────────────────────
const { getApp } = await import("firebase-admin/app");
let accessToken: string;
try {
  const tokenResult = await getApp().options.credential!.getAccessToken();
  accessToken = tokenResult.access_token;
} catch (err) {
  console.error(
    "Could not obtain an OAuth2 access token from Application Default Credentials.\n",
    "To deploy storage rules manually, paste the following into\n",
    "Firebase Console → Storage → Rules:\n\n",
    rulesSource,
  );
  process.exit(1);
}

const BASE = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}`;
const headers = {
  "Authorization": `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

// ── Step 1: Create a new ruleset ─────────────────────────────────────────────
console.log(`Deploying storage rules to project "${PROJECT_ID}"...`);

const createRes = await fetch(`${BASE}/rulesets`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    source: {
      files: [{ name: "storage.rules", content: rulesSource }],
    },
  }),
});

if (!createRes.ok) {
  const text = await createRes.text();
  console.error(`Failed to create ruleset (HTTP ${createRes.status}):\n${text}`);
  process.exit(1);
}

const ruleset = await createRes.json() as { name: string };
console.log(`Ruleset created: ${ruleset.name}`);

// ── Step 2: Release the ruleset to firebase.storage ──────────────────────────
// Strategy: POST to create the release; if the release already exists (409),
// PATCH it with an updateMask to point it at the new ruleset.
const releaseName = `projects/${PROJECT_ID}/releases/firebase.storage`;

const postRes = await fetch(`${BASE}/releases`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: releaseName,
    rulesetName: ruleset.name,
  }),
});

if (!postRes.ok && postRes.status !== 409) {
  const text = await postRes.text();
  console.error(
    `Ruleset created but release POST failed (HTTP ${postRes.status}):\n${text}\n`,
    `Ruleset name: ${ruleset.name}\n`,
    "You can activate it manually in Firebase Console → Storage → Rules.",
  );
  process.exit(1);
}

if (postRes.status === 409) {
  // Release already exists — PATCH only the rulesetName field.
  const patchRes = await fetch(
    `${BASE}/releases/${encodeURIComponent("firebase.storage")}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        release: { name: releaseName, rulesetName: ruleset.name },
        updateMask: "rulesetName",
      }),
    },
  );

  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error(
      `Ruleset created but release PATCH failed (HTTP ${patchRes.status}):\n${text}\n`,
      `Ruleset name: ${ruleset.name}\n`,
      "You can activate it manually in Firebase Console → Storage → Rules.",
    );
    process.exit(1);
  }
}

console.log("Storage rules deployed successfully.");
console.log("Updates path is now publicly readable. Writes still require auth.");
