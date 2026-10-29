import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";

const output = await build({
  stdin: { contents: 'export {checkoutWallMetadata} from "./donor-wall.ts"; export {summariseSupporters} from "./campaign-supporters.ts";',
    resolveDir: new URL(".", import.meta.url).pathname },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
});
const module = { exports: {} as any };
new Function("require", "module", "exports", output.outputFiles[0]!.text)(
  createRequire(import.meta.url), module, module.exports);
const { checkoutWallMetadata, summariseSupporters } = module.exports;

test("guest wall names require explicit consent and never use email, billing or account names", () => {
  assert.deepEqual(checkoutWallMetadata({ donorName: "Alex Taylor" }), { wallOptIn: "false" });
  assert.deepEqual(checkoutWallMetadata({ donorName: "Alex Taylor", wallOptIn: "true" }), { wallOptIn: "false" });
  assert.deepEqual(checkoutWallMetadata({ donorName: " Alex Taylor ", wallOptIn: true }),
    { wallOptIn: "true", publicDonorName: "Alex T." });
  for (const name of ["", "a@b.test", "<script>", "x".repeat(81)]) {
    assert.throws(() => checkoutWallMetadata({ wallOptIn: true, donorName: name }));
  }
  assert.deepEqual(checkoutWallMetadata({ wallOptIn: true, donorName: "Spoofed Name" }, true), { wallOptIn: "true" });
});

test("recent wall is newest first, capped at six distinct donors, private and payment-deduplicated", () => {
  const donations = Array.from({ length: 9 }, (_, i) => ({
    stripeRef: `pi${i}`, donorIdentityKey: `person${i}`, publicDonorName: `Person${i} Surname`,
    createdAt: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
    guestEmail: `private${i}@example.test`, note: "Private note", chargedGbp: 3, status: "succeeded",
  }));
  const summary = summariseSupporters([...donations, donations[8],
    { ...donations[8], stripeRef: "repeat", createdAt: "2026-10-10T12:00:00Z" },
    { stripeRef: "hidden", donorIdentityKey: "hidden", publicDonorName: null, createdAt: "2026-10-11T12:00:00Z" },
    { stripeRef: "failed", donorIdentityKey: "failed", publicDonorName: "Never Show", status: "failed", createdAt: "2026-10-12T12:00:00Z" },
  ]);
  assert.equal(summary.supporterCount, 10);
  assert.equal(summary.recentSupporters.length, 6);
  assert.equal(summary.recentSupporters[0].displayName, "Anonymous");
  assert.equal(summary.recentSupporters[1].displayName, "Person8 S.");
  assert.equal(summary.supporterUnits.length, 10, "the artwork is not limited to the six-person wall");
  assert.equal(summary.supporterUnits[0].displayName, "Anonymous");
  assert.equal(summary.supporterUnits[1].displayName, "Person8 S.");
  assert.doesNotMatch(JSON.stringify(summary), /@|Surname|Private note|stripeRef|donorIdentityKey|chargedGbp|Never Show/);
  for (let i = 1; i < summary.recentSupporters.length; i++) {
    assert.ok(summary.recentSupporters[i - 1].createdAt >= summary.recentSupporters[i].createdAt);
  }
});

test("artwork names cover only counted people, obey opt-out and cap individually drawn units at 300", () => {
  const rows = Array.from({ length: 305 }, (_, i) => ({
    stripeRef: `pi_unit_${i}`, donorIdentityKey: `person:${i}`, userId: `user-${i}`,
    publicDonorName: `Supporter${i} Surname`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
  }));
  const summary = summariseSupporters([
    ...rows,
    { ...rows[304], stripeRef: "pi_repeat", createdAt: "2026-12-30" },
    { stripeRef: "historical_no_identity", createdAt: "2026-12-31" },
  ], [{ userId: "user-304", optedIn: false }]);
  assert.equal(summary.supporterCount, 305);
  assert.equal(summary.unidentifiedGifts, 1);
  assert.equal(summary.supporterUnits.length, 300);
  assert.equal(summary.supporterUnits[0].displayName, "Anonymous");
  assert.equal(summary.supporterUnits[1].displayName, "Supporter303 S.");
  assert.doesNotMatch(JSON.stringify(summary.supporterUnits), /Surname|stripeRef|userId|donorIdentityKey|Supporter304/);
});
