/**
 * deploy-firestore-rules.ts
 *
 * Deploys ./firestore.rules to the Firebase project via the Security Rules REST API.
 * Mirrors the pattern used by deploy-storage-rules.ts.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run deploy-firestore-rules
 *
 * Requirements:
 *   - FIREBASE_PROJECT_ID env var must be set.
 *   - GOOGLE_APPLICATION_CREDENTIALS must point to a service-account JSON file
 *     (or the process must run inside a GCP environment with ADC).
 *
 * If credentials are unavailable the script prints clear instructions for
 * deploying the rules manually via the Firebase Console instead.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, "../../firestore.rules");
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

if (!PROJECT_ID) {
  console.error("ERROR: FIREBASE_PROJECT_ID is not set.");
  process.exit(1);
}

const rulesSource = readFileSync(RULES_PATH, "utf8");

if (getApps().length === 0) {
  try {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  } catch (err) {
    console.error(
      "Could not initialise Firebase Admin (no Application Default Credentials found).\n\n",
      "To deploy Firestore rules manually:\n",
      "  1. Go to Firebase Console → https://console.firebase.google.com/project/" + PROJECT_ID + "/firestore/rules\n",
      "  2. Replace the rules with the content below and click Publish.\n\n",
      "─".repeat(60) + "\n",
      rulesSource,
      "\n" + "─".repeat(60),
    );
    process.exit(1);
  }
}

const { getApp } = await import("firebase-admin/app");
let accessToken: string;
try {
  const tokenResult = await getApp().options.credential!.getAccessToken();
  accessToken = tokenResult.access_token;
} catch (err) {
  console.error(
    "Could not obtain OAuth2 access token.\n\n",
    "Deploy Firestore rules manually:\n",
    "  https://console.firebase.google.com/project/" + PROJECT_ID + "/firestore/rules\n\n",
    rulesSource,
  );
  process.exit(1);
}

const BASE = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}`;
const headers = {
  "Authorization": `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

console.log(`Deploying Firestore rules to project "${PROJECT_ID}"...`);

const createRes = await fetch(`${BASE}/rulesets`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    source: { files: [{ name: "firestore.rules", content: rulesSource }] },
  }),
});

if (!createRes.ok) {
  const text = await createRes.text();
  console.error(`Failed to create ruleset (HTTP ${createRes.status}):\n${text}`);
  process.exit(1);
}

const ruleset = await createRes.json() as { name: string };
console.log(`Ruleset created: ${ruleset.name}`);

const releaseName = `projects/${PROJECT_ID}/releases/cloud.firestore`;

const postRes = await fetch(`${BASE}/releases`, {
  method: "POST",
  headers,
  body: JSON.stringify({ name: releaseName, rulesetName: ruleset.name }),
});

if (!postRes.ok && postRes.status !== 409) {
  const text = await postRes.text();
  console.error(`Ruleset created but release POST failed (HTTP ${postRes.status}):\n${text}`);
  process.exit(1);
}

if (postRes.status === 409) {
  const patchRes = await fetch(
    `${BASE}/releases/${encodeURIComponent("cloud.firestore")}`,
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
    console.error(`Release PATCH failed (HTTP ${patchRes.status}):\n${text}`);
    process.exit(1);
  }
}

console.log("Firestore rules deployed successfully.");
