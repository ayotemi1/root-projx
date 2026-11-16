import assert from "node:assert/strict";
import test from "node:test";
import { drumsFunded, parseDrumExperience, publicDrumExperience, canUseDrumExperience, assertDrumExperienceAccess, DRUM_LIFE_ORG_ID, DRUM_LIFE_CAMPAIGN_ID } from "./drum-experience.ts";

test("bespoke drum appearance is exclusive to Lifeyard's Drum Life, not HOV or another Lifeyard campaign", () => {
  assert.equal(canUseDrumExperience(DRUM_LIFE_ORG_ID, DRUM_LIFE_CAMPAIGN_ID), true);
  for (const [org, campaign] of [["hov", DRUM_LIFE_CAMPAIGN_ID], [DRUM_LIFE_ORG_ID, "other"], [undefined, undefined]]) {
    assert.equal(canUseDrumExperience(org, campaign), false);
    assert.throws(() => assertDrumExperienceAccess(org, campaign, { drumExperience: { enabled: true } }), /exclusive to Lifeyard/);
    assert.doesNotThrow(() => assertDrumExperienceAccess(org, campaign, { drumExperience: { enabled: false } }));
  }
});

const update = { id: "build-1", date: "2026-11-12", text: "The reclaimed wood has arrived.",
  photoUrl: "/api/uploads/object/org-media/wood.jpg", caption: "Reclaimed wood for the centre drum" };

test("50 drum progress uses native USD donations in whole US$150 units, never GBP settlement or donor count", () => {
  for (const [amount, expected] of [[0, 0], [149.99, 0], [150, 1], [299.99, 1], [300, 2],
    [7350, 49], [7499.99, 49], [7500, 50], [15000, 50], [-150, 0]]) {
    assert.equal(drumsFunded(amount!, "usd"), expected);
  }
  assert.equal(drumsFunded(7500, "gbp"), 0);
  assert.equal(drumsFunded(NaN, "usd"), 0);
  assert.equal(drumsFunded(Infinity, "usd"), 0);
});

test("build content is bounded plain text with safe images and valid calendar dates", () => {
  const value = { enabled: true, updates: [update] };
  assert.deepEqual(parseDrumExperience(value), value);
  assert.equal(parseDrumExperience(null), null);
  for (const bad of [
    { ...value, funded: 50 }, { enabled: "true", updates: [] }, { enabled: true, updates: Array(21).fill(update) },
    { ...value, updates: [update, update] },
    ...[{ id: "../other" }, { date: "2026-02-30" }, { text: "<script>bad</script>" },
      { photoUrl: "javascript:alert(1)" }, { photoUrl: "https://user:pass@example.test/image" },
      { photoUrl: "//example.test/image" }, { caption: "x".repeat(501) }, { amountRaised: 7500 }]
      .map(patch => ({ ...value, updates: [{ ...update, ...patch }] })),
  ]) assert.throws(() => parseDrumExperience(bad));
});

test("public drum content excludes unfinished rows and never enables invalid currency or content", () => {
  const value = { enabled: true, updates: [update,
    { id: "unfinished", date: "", text: "Not ready", photoUrl: null, caption: "" },
    { id: "empty", date: "2026-11-12", text: "", photoUrl: null, caption: "" }] };
  assert.equal(parseDrumExperience(value)?.updates.length, 3);
  assert.deepEqual(publicDrumExperience(value, "usd", "fundraising"), { enabled: true, updates: [update] });
  assert.equal(publicDrumExperience(value, "gbp", "fundraising"), null);
  assert.equal(publicDrumExperience(value, "usd", "volunteer"), null);
  assert.equal(publicDrumExperience({ ...value, enabled: false }, "usd", "fundraising"), null);
  assert.equal(publicDrumExperience({ ...value, updates: [{}] }, "usd", "fundraising"), null);
});
