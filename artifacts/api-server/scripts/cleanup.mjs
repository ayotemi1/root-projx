/**
 * Root ProjX — Firestore cleanup script
 * Deletes all seeded/test data from every collection.
 * Run: node artifacts/api-server/scripts/cleanup.mjs
 */

const API_KEY = process.env.FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "rootprojx-1111";

if (!API_KEY) {
  console.error("FIREBASE_API_KEY not set — aborting.");
  process.exit(1);
}

const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SEED_EMAIL = "seeder@rootprojx.internal";
const SEED_PASS = "RootSeed2024!";

async function signIn(email, password) {
  const r = await fetch(`${AUTH_BASE}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function listDocs(collection, token) {
  const r = await fetch(`${FS_BASE}/${collection}?pageSize=300`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`List ${collection}: ${await r.text()}`);
  const json = await r.json();
  return (json.documents ?? []).map((d) => d.name.split("/").pop());
}

async function deleteDoc(collection, docId, token) {
  const r = await fetch(`${FS_BASE}/${collection}/${docId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok && r.status !== 404) {
    throw new Error(`Delete ${collection}/${docId}: ${await r.text()}`);
  }
}

async function nukeCollection(collection, token) {
  const ids = await listDocs(collection, token);
  if (ids.length === 0) {
    console.log(`  ${collection}: already empty`);
    return;
  }
  for (const id of ids) {
    await deleteDoc(collection, id, token);
    process.stdout.write(".");
  }
  console.log(` deleted ${ids.length} from ${collection}`);
}

async function main() {
  console.log("Root ProjX — Firestore cleanup");
  console.log("Project:", PROJECT_ID);
  console.log("");

  console.log("Signing in as seeder...");
  const { idToken } = await signIn(SEED_EMAIL, SEED_PASS);
  console.log("Authenticated.\n");

  const COLLECTIONS = ["organisations", "updates", "reviews", "resources", "users"];

  for (const col of COLLECTIONS) {
    process.stdout.write(`  Clearing ${col} `);
    await nukeCollection(col, idToken);
  }

  console.log("\nCleanup complete — all collections are empty.");
}

main().catch((e) => {
  console.error("Cleanup failed:", e.message ?? e);
  process.exit(1);
});
