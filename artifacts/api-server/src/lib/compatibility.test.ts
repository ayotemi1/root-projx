import assert from "node:assert/strict";
import test from "node:test";
import { isCampaignPublished } from "./campaign-publication.ts";
import { fsPatch } from "./firebase-rest.ts";

test("legacy campaigns without an enabled field remain published", () => {
  assert.equal(isCampaignPublished({ status: "active" }), true);
  assert.equal(isCampaignPublished({ enabled: true, status: "active" }), true);
  assert.equal(isCampaignPublished({ enabled: false, status: "active" }), false);
  assert.equal(isCampaignPublished({ status: "deleted" }), false);
});

test("Firestore partial updates send an update mask for every supplied field", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedBody = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedBody = String(init?.body ?? "");
    return new Response("{}", { status: 200 });
  };

  try {
    await fsPatch("users", "user-1", {
      approvalStatus: "declined",
      declinedAt: "2026-09-10T00:00:00.000Z",
    }, "server-token");
  } finally {
    globalThis.fetch = originalFetch;
  }

  const url = new URL(requestedUrl);
  assert.deepEqual(
    url.searchParams.getAll("updateMask.fieldPaths").sort(),
    ["approvalStatus", "declinedAt"],
  );
  assert.deepEqual(Object.keys(JSON.parse(requestedBody).fields).sort(), ["approvalStatus", "declinedAt"]);
});