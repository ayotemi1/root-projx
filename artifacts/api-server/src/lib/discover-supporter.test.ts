import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const logic = await (async () => {
  const result = await build({
    entryPoints: [new URL("../../../web/src/lib/discover-supporter.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs",
  });
  const mod = { exports: {} as Record<string, any> };
  new Function("module", "exports", result.outputFiles[0]!.text)(mod, mod.exports);
  return mod.exports;
})();

const orgs = [
  { _id: "arts", name: "Arts Studio", city: "Kingston", country: "Jamaica", category: "Arts & Culture" },
  { _id: "school", name: "Community School", city: "Kingston", country: "Jamaica", category: "Education" },
  { _id: "health", name: "Health Group", city: "London", country: "United Kingdom", category: "Health & Wellbeing", categories: ["Health & Wellbeing", "Education"] },
  { _id: "nature", name: "Conservation", city: "Negril", country: "Jamaica", category: "Environment" },
];
const noSignals = { interests: [], followedOrgs: [], supportedOrgIds: [] };
const ids = (items: Array<{ _id: string }>) => items.map(org => org._id);

test("Discover search, country and multi-sector cause filters intersect without mutating the directory", () => {
  assert.deepEqual(ids(logic.filterDiscoverOrgs(orgs, { search: " KINGSTON ", country: "jamaica", cause: "Education" })), ["school"]);
  assert.deepEqual(ids(logic.filterDiscoverOrgs(orgs, { search: "London", country: "", cause: "Education" })), ["health"]);
  assert.deepEqual(logic.filterDiscoverOrgs(orgs, { search: "Kingston", country: "United Kingdom", cause: "" }), []);
  assert.equal(orgs.length, 4);
  assert.equal(logic.filterDiscoverOrgs(orgs, { search: "", country: "", cause: "" }).length, 4);
});

test("recommendations prefer interests, followed sectors and giving signals and exclude already-followed profiles", () => {
  const result = logic.recommendDiscoverOrgs(orgs, {
    interests: ["Education"], followedOrgs: [orgs[0]], supportedOrgIds: ["nature"],
  }, 6);
  assert.equal(result.personalised, true);
  assert.deepEqual(ids(result.organisations), ["school", "health", "nature"]);
  assert.ok(!ids(result.organisations).includes("arts"));
  const byGiving = logic.recommendDiscoverOrgs(orgs, { ...noSignals, supportedOrgIds: ["nature"] });
  assert.equal(byGiving.organisations[0]._id, "nature");
  assert.equal(byGiving.personalised, true);
});

test("without personal signals Explore uses real profiles in stable order, never fabricated filler", () => {
  const result = logic.recommendDiscoverOrgs([...orgs, orgs[0], { _id: "blank", name: "" }], noSignals);
  assert.equal(result.personalised, false);
  assert.deepEqual(ids(result.organisations), ["arts", "school", "health"]);
  assert.deepEqual(logic.recommendDiscoverOrgs([], noSignals).organisations, []);
});

test("recommendations use the same filtered input and show no followed or out-of-filter suggestions", () => {
  const filtered = logic.filterDiscoverOrgs(orgs, { search: "", country: "United Kingdom", cause: "Education" });
  const result = logic.recommendDiscoverOrgs(filtered, { ...noSignals, interests: ["Arts & Culture"] });
  assert.deepEqual(ids(result.organisations), ["health"]);
  assert.deepEqual(logic.recommendDiscoverOrgs(filtered, { ...noSignals, followedOrgs: [orgs[2]] }).organisations, []);
  const candidates = [orgs[0], orgs[2]];
  const fromOtherCountry = logic.recommendDiscoverOrgs(candidates, {
    ...noSignals, supportedOrgIds: ["school"], supportedOrgs: [orgs[1]],
  });
  assert.deepEqual(ids(fromOtherCountry.organisations), ["health", "arts"], "giving sectors survive a country filter that hides the supported organisation");
});

test("map positions require actual valid saved coordinates, never country centres or random jitter", () => {
  assert.equal(logic.mappedOrgPosition(orgs[0]), null);
  assert.deepEqual(logic.mappedOrgPosition({ ...orgs[0], latitude: 18, longitude: -77 }), [18, -77]);
  assert.deepEqual(logic.mappedOrgPosition({ ...orgs[0], location: { lat: 0, lng: 0 } }), [0, 0]);
  assert.deepEqual(logic.mappedOrgPosition({ ...orgs[0], coordinates: { latitude: 51.5, longitude: -0.1 } }), [51.5, -0.1]);
  for (const coords of [{ lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }, { lat: "18", lng: "-77" }]) {
    assert.equal(logic.mappedOrgPosition({ ...orgs[0], location: coords }), null);
  }
});

test("raised totals preserve actual canonical GBP and pence without inventing amounts or currencies", () => {
  assert.equal(logic.discoverRaisedLabel({ ...orgs[0], totalRaised: 3.25, currency: "usd" }), "£3.25 GBP");
  assert.equal(logic.discoverRaisedLabel({ ...orgs[0], totalRaised: 0 }), "£0 GBP");
  assert.equal(logic.discoverRaisedLabel(orgs[0]), null);
  assert.equal(logic.discoverRaisedLabel({ ...orgs[0], totalRaised: NaN }), null);
});
