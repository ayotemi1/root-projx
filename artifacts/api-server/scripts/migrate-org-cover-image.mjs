/**
 * Migrate the existing organisation cover URL from the legacy domain-baked
 * upload proxy to the stable root-relative org image route.
 *
 * The migration is intentionally narrow and idempotent:
 * - it targets only the known organisation document;
 * - it writes only the coverImage field via Firestore updateMask;
 * - it succeeds without writing when the stable URL is already present;
 * - it refuses to overwrite an unexpected cover URL.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server run migrate:org-cover-image
 */

const ORG_ID = "qxN5TwsBYiYYKJUynRMjxmNVoLw1";
const LEGACY_URL = `https://rootprojx.com/api/uploads/object/org-profiles/${ORG_ID}/cover`;
const STABLE_URL = `/api/org-images/${ORG_ID}/cover`;

const apiKey = process.env.FIREBASE_API_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID;
const serverPassword = process.env.FIREBASE_SERVER_PASSWORD;
const serverEmail = process.env.FIREBASE_SERVER_EMAIL ?? "seeder@rootprojx.internal";

if (!apiKey || !projectId || !serverPassword) {
  throw new Error(
    "FIREBASE_API_KEY, FIREBASE_PROJECT_ID, and FIREBASE_SERVER_PASSWORD must be configured.",
  );
}

const authUrl =
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
const documentUrl =
  `https://firestore.googleapis.com/v1/projects/${projectId}` +
  `/databases/(default)/documents/organisations/${ORG_ID}`;

async function getServerToken() {
  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: serverEmail,
      password: serverPassword,
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firebase authentication failed (${response.status}).`);
  }

  const result = await response.json();
  if (!result.idToken) {
    throw new Error("Firebase authentication returned no ID token.");
  }
  return result.idToken;
}

async function readDocument(idToken) {
  const response = await fetch(documentUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (response.status === 404) {
    throw new Error(`Organisation ${ORG_ID} was not found.`);
  }
  if (!response.ok) {
    throw new Error(`Firestore document read failed (${response.status}).`);
  }
  return response.json();
}

async function main() {
  const idToken = await getServerToken();
  const before = await readDocument(idToken);
  const currentUrl = before.fields?.coverImage?.stringValue ?? null;

  if (currentUrl === STABLE_URL) {
    console.log(`Organisation ${ORG_ID} already uses the stable cover URL.`);
    return;
  }

  if (currentUrl !== LEGACY_URL) {
    throw new Error(
      `Refusing to overwrite an unexpected coverImage value for organisation ${ORG_ID}.`,
    );
  }

  const updateResponse = await fetch(
    `${documentUrl}?updateMask.fieldPaths=coverImage`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          coverImage: { stringValue: STABLE_URL },
        },
      }),
    },
  );

  if (!updateResponse.ok) {
    throw new Error(`Firestore cover URL update failed (${updateResponse.status}).`);
  }

  const after = await readDocument(idToken);
  const persistedUrl = after.fields?.coverImage?.stringValue ?? null;
  if (persistedUrl !== STABLE_URL) {
    throw new Error("Firestore did not persist the stable cover URL.");
  }

  console.log(`Organisation ${ORG_ID} cover URL migrated and verified.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});