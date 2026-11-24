import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const bundled = await build({
  stdin: { contents: `
    export * from "./discover-campaigns.ts";
    export * as ui from "../../../web/src/lib/discover-campaigns.ts";
  `, resolveDir: new URL(".", import.meta.url).pathname, loader: "ts" },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
});
const mod = {exports: {} as any};
new Function("require", "module", "exports", bundled.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
const {discoverCampaignEntries: entries, discoverDeadline, ui} = mod.exports;
const now = Date.parse("2026-11-24T12:00:00Z");
const campaign = (patch = {}) => ({
  _id: "hands", publicId: "cp_hands", name: "Out of Many Hands", enabled: true, status: "active",
  type: "fundraising", goal: 30000, amountRaised: 475, currency: "gbp",
  deadline: "2027-01-31", createdAt: "2026-11-01", ...patch,
});
const org = (patch = {}) => ({
  _id: "hov", name: "Humanity Ova Vanity", country: "Jamaica", city: "Kingston",
  category: "Education", categories: ["Education", "Arts & Culture"], verified: true,
  campaigns: [campaign()], ...patch,
});

test("Discover only lists live published fundraising campaigns, excluding all non-public states", () => {
  for (const patch of [
    {enabled:false}, {status:"draft"}, {status:"deleted"}, {status:"ended"}, {status:"completed"},
    {status:"archived"}, {archived:true}, {archivedAt:"2026-11-01"}, {deletedAt:"2026-11-01"},
    {disabled:true}, {visibility:"private"}, {published:false}, {type:"volunteer"},
    {deadline:"2026-11-23"}, {deadline:"not a date"}, {goal:0},
  ]) assert.deepEqual(entries([org({campaigns:[campaign(patch)]})], now), [], JSON.stringify(patch));
  assert.equal(entries([org()], now).length, 1);
  // Legacy publication uses enabled not-false, exactly as the current public campaign.
  assert.equal(entries([org({campaigns:[campaign({enabled:undefined})]})], now).length, 1);
});

test("Discover excludes unavailable organisations", () => {
  for (const patch of [
    {name:""}, {deletedAt:"today"}, {enabled:false}, {disabled:true}, {public:false},
    {visibility:"private"}, {archivedAt:"today"}, {status:"suspended"},
    {approvalStatus:"pending"}, {approvalStatus:"declined"},
  ]) assert.deepEqual(entries([org(patch)], now), [], JSON.stringify(patch));
});

test("Discover deadlines include the stated day, exclude elapsed timestamps, allow no deadline", () => {
  assert.equal(entries([org({campaigns:[campaign({deadline:"2026-11-24"})]})], now).length, 1);
  assert.equal(entries([org({campaigns:[campaign({deadline:"2026-11-24T11:00:00Z"})]})], now).length, 0);
  assert.equal(discoverDeadline(null), Infinity);
  assert.equal(discoverDeadline("bad"), null);
});

test("Discover projects only public fields and never merges unpublished campaign revisions", () => {
  const result = entries([org({
    bankDetails:"secret bank", email:"private email", payoutManualLabel:"secret note",
    campaigns:[campaign({editorDraft:{name:"Private draft name", amountRaised:999},
      privateNotes:"secret note", secret:"hidden", theme:{primaryColor:"#B3121B", secret:"hidden"},
      partnerFunding:{amount:100, funderName:"Public partner", type:"committed", secret:"hidden"}})],
  })], now);
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /secret|private email|hidden|editorDraft|Private draft name/);
  assert.equal(result[0].campaign.name, "Out of Many Hands");
  assert.equal(result[0].campaign.amountRaised, 475);
  assert.match(result[0].campaign.sharePath, /^\/campaigns\//);
  assert.deepEqual(result[0].organisation.categories, ["Education", "Arts & Culture"]);
});

test("Discover preserves native USD and canonical committed and allocated funding", () => {
  const result = entries([org({campaigns:[campaign({currency:"usd",
    partnerFunding:{amount:1000, funderName:"Partner", type:"committed"}})]})], now);
  assert.equal(result[0].campaign.currency, "usd");
  assert.equal(ui.campaignFundingTotal(result[0].campaign), 1475);
  assert.equal(ui.campaignFundingTotal(campaign({partnerFunding:{type:"matching",amount:1000},
    partnerFundingMatchedGbp:25})), 500);
});

test("Discover searches hands and inherits country and every organisation cause", () => {
  const all = ui.adaptDiscoverEntries(entries([org(), org({_id:"yard",name:"LifeYard",
    campaigns:[campaign({_id:"drum",name:"Drum Life",currency:"usd"})]})], now));
  assert.equal(ui.filterDiscoverCampaigns(all,{search:" hands ",country:"",cause:""}).length,1);
  assert.equal(ui.filterDiscoverCampaigns(all,{search:"",country:" jamaica ",cause:"arts & culture"}).length,2);
  assert.equal(ui.filterDiscoverCampaigns(all,{search:"",country:"Ghana",cause:""}).length,0);
  assert.equal(ui.filterDiscoverCampaigns(all,{search:"Kingston",country:"All",cause:"All Causes"}).length,2);
});

test("Discover sorts by deadline, canonical percentage and publication date without mutating inputs", () => {
  const all = entries([org({campaigns:[
    campaign({_id:"later",name:"Later",deadline:null,createdAt:"2026-11-20"}),
    campaign({_id:"soon",name:"Soon",deadline:"2026-12-01",createdAt:"2026-11-01"}),
    campaign({_id:"funded",name:"Funded",deadline:"2026-12-31",amountRaised:1000,
      partnerFunding:{type:"committed",amount:20000,funderName:"Partner"},createdAt:"2026-11-10"}),
  ]})], now);
  assert.deepEqual(ui.sortDiscoverCampaigns(all,"ending").map((i:any)=>i.campaign._id),["soon","funded","later"]);
  assert.equal(ui.sortDiscoverCampaigns(all,"funded")[0].campaign._id,"funded");
  assert.equal(ui.sortDiscoverCampaigns(all,"newest")[0].campaign._id,"later");
  assert.equal(all[0].campaign._id,"later");
});

test("Discover tabs round-trip shared URLs and preserve unrelated query parameters", () => {
  for (const tab of ["all","organisations","campaigns"]) {
    const query = ui.withDiscoverTab("?source=friend&keep=one&keep=two&tab=campaigns",tab);
    assert.equal(ui.parseDiscoverTab(query),tab);
    assert.deepEqual(new URLSearchParams(query).getAll("keep"),["one","two"]);
    assert.equal(new URLSearchParams(query).get("source"),"friend");
  }
  assert.equal(ui.parseDiscoverTab("?tab=unknown"),"all");
});

test("Both Discover entry points reuse the campaign surfaces and existing donation dialog context", async () => {
  const read = (path:string) => readFile(new URL(path,import.meta.url),"utf8");
  const [legacy,supporter,surface,route] = await Promise.all([
    read("../../../web/src/pages/discover.tsx"),read("../../../web/src/components/supporter/SupporterDiscoverPage.tsx"),
    read("../../../web/src/components/discover/DiscoverCampaigns.tsx"),read("../routes/organisations.ts"),
  ]);
  for (const page of [legacy,supporter]) {
    assert.match(page,/LiveCampaignsRow/); assert.match(page,/CampaignsGrid/); assert.match(page,/DiscoverTabs/);
  }
  assert.match(surface,/DonationAmountDialog/);
  for (const prop of ["orgId","orgName","campaignId","campaignName","campaignPath","currency"])
    assert.match(surface,new RegExp(`${prop}=\\{item\\.`));
  assert.match(route,/router\.get\("\/discover\/campaigns"/);
  assert.match(route,/ListDiscoverCampaignsResponse\.parse\(discoverCampaignEntries\(orgs\)\)/);
});
