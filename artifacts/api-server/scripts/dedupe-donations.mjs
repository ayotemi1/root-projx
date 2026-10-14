/**
 * Remove legacy confirmation duplicates only when a webhook record exists.
 *
 * Dry-run: node --experimental-strip-types artifacts/api-server/scripts/dedupe-donations.mjs
 * Delete:  node --experimental-strip-types artifacts/api-server/scripts/dedupe-donations.mjs --apply
 *
 * Uses the configured Firebase project and Stripe credentials. Does not adjust
 * totalRaised: the old confirmation endpoint never incremented that field.
 */
import { fsGet, fsQuery, fsDelete, getServerToken } from "../src/lib/firebase-rest.ts";
import { getUncachableStripeClient } from "../src/lib/stripeClient.ts";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--apply")) {
  throw new Error("Only --apply is supported; omit it for a dry-run.");
}
const apply = args.includes("--apply");

async function listDonations() {
  const base = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/donations`;
  const docs = [];
  let pageToken;
  do {
    const url = new URL(base);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${await getServerToken()}` },
    });
    if (!response.ok) throw new Error(`Donation listing failed (${response.status}).`);
    const page = await response.json();
    for (const doc of page.documents ?? []) {
      docs.push({
        id: doc.name.split("/").pop(),
        sessionId: doc.fields?.stripeSessionId?.stringValue,
        stripeRef: doc.fields?.stripeRef?.stringValue,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return docs;
}

async function main() {
  const docs = await listDonations();
  const candidates = docs.filter((doc) => doc.sessionId && !doc.stripeRef);
  const stripe = await getUncachableStripeClient();
  const matches = [];
  let failures = 0;
  for (const doc of candidates) {
    try {
      const session = await stripe.checkout.sessions.retrieve(doc.sessionId);
      const stripeRef = typeof session.payment_intent === "string"
        ? session.payment_intent : session.payment_intent?.id;
      if (!stripeRef) continue;
      const records = await fsQuery("donations", [
        { field: "stripeRef", op: "EQUAL", value: stripeRef },
      ], await getServerToken(), { limit: 1 });
      if (!records.some((record) => record._id !== doc.id)) continue;
      matches.push({ ...doc, paymentIntentId: stripeRef });
    } catch {
      failures++;
      console.error(`Could not verify donation ${doc.id}; no deletion authorised.`);
    }
  }
  console.log(`Scanned ${docs.length} donations; ${candidates.length} legacy candidates.`);
  console.log(`Dry-run: would remove ${matches.length} duplicate donation documents.`);
  if (failures) {
    throw new Error(`${failures} candidate checks failed. No documents deleted; resolve these errors and retry.`);
  }
  if (!apply) {
    console.log("No documents deleted. Re-run with --apply to delete verified duplicates.");
    return;
  }
  let removed = 0;
  for (const doc of matches) {
    // Recheck both sides immediately before deletion; never remove the canonical
    // webhook record or a legacy document that has since acquired a stripeRef.
    const token = await getServerToken();
    const legacy = await fsGet("donations", doc.id, token);
    const canonical = await fsQuery("donations", [
      { field: "stripeRef", op: "EQUAL", value: doc.paymentIntentId },
    ], token);
    if (!legacy || legacy.stripeRef || legacy.stripeSessionId !== doc.sessionId ||
        !canonical.some((record) => record._id !== doc.id)) {
      throw new Error(`Donation ${doc.id} changed since verification; stopped after ${removed} deletions.`);
    }
    await fsDelete("donations", doc.id, token);
    removed++;
    console.log(`Deleted legacy duplicate ${doc.id}`);
  }
  console.log(`Removed ${removed} duplicate donation documents.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
