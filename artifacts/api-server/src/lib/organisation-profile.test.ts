import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";
import { profilePatch, PROFILE_SECTORS } from "./organisation-profile.ts";
import { suggest } from "./campaign-assist.ts";
import { drumsFunded, DRUM_LIFE_ORG_ID, DRUM_LIFE_CAMPAIGN_ID } from "./drum-experience.ts";

test("drum configuration survives owner autosave and reopening without changing money or publication", async () => {
  const f = await fixture();
  const org = readyCampaignFixture(f);
  org.campaigns[0].currency = "usd";
  const before = structuredClone(org.campaigns[0]);
  const lifeyard = structuredClone(org);
  lifeyard.campaigns[0]._id = DRUM_LIFE_CAMPAIGN_ID;
  f.state.docs.set(`organisations/${DRUM_LIFE_ORG_ID}`, lifeyard);
  f.state.docs.set(`users/${DRUM_LIFE_ORG_ID}`, f.state.docs.get("users/org"));
  const drumExperience = { enabled: true, updates: [
    { id: "wood", date: "2026-11-12", text: "Building the centre drum", photoUrl: null, caption: "" },
  ] };
  const response = await invoke(f.router, "patch", DRUM_LIFE_ORG_ID, { drumExperience, saveAsDraft: true }, DRUM_LIFE_ORG_ID, campaignRoute);
  assert.equal(response.status, 200);
  const stored = f.state.docs.get(`organisations/${DRUM_LIFE_ORG_ID}`).campaigns[0];
  assert.equal(stored.amountRaised, before.amountRaised);
  assert.equal(stored.goal, before.goal);
  assert.equal(stored.currency, "usd");
  assert.equal(stored.enabled, before.enabled);
  const reopened = f.draftFromCampaign(f.campaignForEditor(stored));
  assert.deepEqual(reopened.drumExperience, drumExperience);
  assert.deepEqual(f.draftToPatch(reopened).drumExperience, drumExperience);
  if (before.enabled !== false) assert.equal(stored.drumExperience, undefined, "published page remains unchanged until publish");
  const forbidden = await invoke(f.router, "patch", "org", { drumExperience }, "other", campaignRoute);
  assert.equal(forbidden.status, 403);
  const otherOrg = await invoke(f.router, "patch", "org", { drumExperience }, "org", campaignRoute);
  assert.equal(otherOrg.status, 400);
  assert.match(otherOrg.body.error, /exclusive to Lifeyard/);
  const appearance = { ...stored, _id: DRUM_LIFE_CAMPAIGN_ID, drumExperience };
  assert.equal(f.publicCampaignFields(appearance, "hov").drumExperience, null);
  assert.equal(f.publicCampaignFields(appearance).drumExperience, null);
  assert.deepEqual(f.publicCampaignFields(appearance, DRUM_LIFE_ORG_ID).drumExperience, drumExperience);
});

test("drum circle cannot be enabled for pounds or volunteer campaigns, or reset verified financial progress", async () => {
  const f = await fixture();
  const config = { enabled: true, updates: [] };
  assert.throws(() => f.campaignPatch({ drumExperience: config }, { currency: "gbp" }), /USD/);
  assert.throws(() => f.campaignPatch({ drumExperience: config }, { currency: "usd", type: "volunteer" }), /fundraising/);
  const previous = { currency: "usd", type: "fundraising", amountRaised: 300, drumExperience: config };
  assert.throws(() => f.campaignPatch({ currency: "gbp" }, previous));
  assert.throws(() => f.campaignPatch({ type: "volunteer" }, previous));
  assert.deepEqual(f.campaignPatch({ drumExperience: config, amountRaised: 7500, totalRaised: 7500 }, previous),
    { drumExperience: config });
  assert.equal(drumsFunded(previous.amountRaised, previous.currency), 2);
  assert.deepEqual(f.campaignPatch({ drumExperience: null }, previous), { drumExperience: null });
});

test("profile patches are partial and cannot touch financial or campaign fields", () => {
  assert.deepEqual(profilePatch({
    shortDescription: "  Local work, lasting change  ", totalRaised: 0,
    totalOwedGbp: 0, campaigns: [], payoutMethod: "none", payoutSettlementBatchId: null,
  }, {}), { shortDescription: "Local work, lasting change" });
  assert.deepEqual(profilePatch({ description: "A draft" }, {}), { description: "A draft" });
  assert.deepEqual(profilePatch({ categories: ["Education", "Youth", "Education"] }, {}),
    { categories: ["Education", "Youth"], category: "Education" });
  assert.equal(PROFILE_SECTORS.length, 12);
});

test("profile validation rejects overlong copy, empty/unknown sectors and pasted HTML", () => {
  for (const body of [
    { shortDescription: "x".repeat(121) }, { categories: [] }, { categories: ["Invented"] },
    { description: "<script>alert(1)</script>" }, { name: 123 }, { logo: "javascript:alert(1)" },
    { contact: { iban: "never-stored" } },
  ]) assert.throws(() => profilePatch(body, {}));
  assert.deepEqual(profilePatch({ description: "## Our work\nWe serve our community." }, {}),
    { description: "## Our work\nWe serve our community." });
});

test("impact timestamps are server-owned and unchanged metrics retain their dates", () => {
  const old = { label: "trainees", value: 12, updatedAt: "2026-09-01" };
  const result = profilePatch({ impactMetrics: {
    peopleReached: { ...old, updatedAt: "forged" },
    groundCovered: { label: "communities", value: 4, updatedAt: "forged" },
  } }, { impactMetrics: { peopleReached: old } }, "2026-10-22");
  assert.deepEqual(result.impactMetrics, {
    peopleReached: old,
    groundCovered: { label: "communities", value: 4, updatedAt: "2026-10-22" },
  });
  for (const metric of [{ label: "", value: 1 }, { label: "people", value: -1 }, { label: "people", value: NaN }]) {
    assert.throws(() => profilePatch({ impactMetrics: { peopleReached: metric } }, {}));
  }
  assert.deepEqual(profilePatch({ impactMetrics: null, team: [] }, {}), { impactMetrics: null, team: [] });
});

test("team and funds usage retain their bounded, backwards-compatible shapes", () => {
  const person = { name: "Alex", role: "Coordinator", photoUrl: "/api/uploads/object/org-media/photo.jpg" };
  assert.deepEqual(profilePatch({ team: [person] }, {}), { team: [person] });
  assert.throws(() => profilePatch({ team: Array(7).fill(person) }, {}));
  assert.throws(() => profilePatch({ team: [{ ...person, role: "" }] }, {}));
  const split = { operations: 20, materials: 20, staff: 20, events: 20, other: 20 };
  assert.deepEqual(profilePatch({ fundsUsage: split }, {}), { fundsUsage: split });
  assert.throws(() => profilePatch({ fundsUsage: { ...split, other: 19 } }, {}));
  assert.throws(() => profilePatch({ fundsUsage: { ...split, other: 20.5 } }, {}));
});

async function fixture(assistSetting = "true") {
  const mocks: Record<string, string> = {
    state: `export const state={docs:new Map(),writes:[],assistInputs:[],queryFailure:false};`,
    "firebase-rest.js": `
      import {state} from "profile-test:state";
      export const getServerToken=async()=>"synthetic-server";
      export const firebaseLookup=async(token)=>["org","other","pending","supporter","LTMwjXVEgxNideK0XtIQudxZXjc2"].includes(token)?{uid:token,email:token+"@example.test"}:null;
      export const fsGet=async(c,id)=>structuredClone(state.docs.get(c+"/"+id)??null);
      export const fsPatch=async(c,id,patch)=>{
        state.writes.push({c,id,patch:structuredClone(patch)});
        const key=c+"/"+id;
        state.docs.set(key,{...state.docs.get(key),...structuredClone(patch)});
      };
      export const fsList=async(c)=>[...state.docs].filter(([key])=>key.startsWith(c+"/")).map(([key,d])=>({...structuredClone(d),_id:key.split("/")[1]}));
      export const fsQuery=async(c,filters)=>{
        if(state.queryFailure === true || state.queryFailure === c) throw Error("Synthetic unavailable summary");
        return [...state.docs.entries()].filter(([key,doc])=>key.startsWith(c+"/")&&filters.every(f=>doc[f.field]===f.value))
          .map(([key,doc])=>({...structuredClone(doc),_id:key.slice(c.length+1)}));
      };
      export const fsCreate=async()=>{throw Error("Unexpected write");};
      export const fsMutateCampaigns=async(id,token,mutate)=>{
        const key="organisations/"+id;
        const current=structuredClone(state.docs.get(key));
        const {campaigns,result}=mutate(current);
        state.docs.set(key,{...current,campaigns});
        state.writes.push({c:"organisations",id,patch:{campaigns}});
        return result;
      };
    `,
    "objectStorage.js": `export const objectStorageClient={bucket(){throw Error("No storage calls permitted");}};`,
    "campaign-assist.js": `import {state} from "profile-test:state";
      export const suggest=async(input)=>{state.assistInputs.push(input);return {unavailable:true};};`,
  };
  const bundle = await build({
    define: { "process.env.CAMPAIGN_ASSIST_ENABLED": assistSetting === "unset" ? "undefined" : JSON.stringify(assistSetting),
      "import.meta.env.BASE_URL": '"/"' },
    stdin: { contents: `export {default as router,publicCampaignFields} from "./routes/organisations.ts";
      export {campaignPatch,campaignPublishGates,campaignForEditor} from "./lib/campaign-editor.ts";
      export {draftFromCampaign,draftToPatch} from "../../web/src/components/campaign-builder/model.ts";
      export {suggest} from "./lib/campaign-assist.ts";
      export {default as selfServiceRouter} from "./routes/organisation-self-service.ts";
      export {default as assistRouter} from "./routes/campaign-assist.ts";
      export {summariseSupporters,donorIdentity} from "./lib/campaign-supporters.ts";
      export {walkthroughPatch} from "./lib/walkthrough.ts";
      export {state} from "profile-test:state";`,
      resolveDir: new URL("../", import.meta.url).pathname, loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "synthetic-profile-services", setup(b) {
      b.onResolve({ filter: /^profile-test:state$|\/(firebase-rest|objectStorage|campaign-assist)\.js$/ },
        args => ({ path: args.path === "profile-test:state" ? "state" : args.path.split("/").at(-1)!, namespace: "profile-test" }));
      b.onLoad({ filter: /.*/, namespace: "profile-test" }, args => ({ contents: mocks[args.path]!, loader: "js" }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const api = mod.exports;
  for (const id of ["org", "other", "pending", "supporter"]) {
    api.state.docs.set("users/" + id, { accountType: id === "supporter" ? "supporter" : "organisation",
      approvalStatus: id === "pending" ? "pending" : "approved" });
  }
  api.state.docs.set("organisations/org", {
    name: "Original Org", category: "Education", description: "Legacy story", campaigns: [{ _id: "draft", enabled: false }],
    totalRaised: 300, totalOwedGbp: 285, payoutSettlementBatchId: "locked",
    payoutMethod: "bank_transfer", payoutManualApproved: true, payoutManualLabel: "Private reminder",
  });
  return api;
}

async function invoke(router: any, method: string, token?: string, body: unknown = {}, orgId = "org", path = "/organisations/:id") {
  const route = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method])?.route;
  assert.ok(route);
  let status = 200;
  let result: any;
  const req = { body, params: { id: orgId, campId: orgId === DRUM_LIFE_ORG_ID ? DRUM_LIFE_CAMPAIGN_ID : "camp" }, headers: token ? { authorization: "Bearer " + token } : {},
    query: {}, log: { error() {}, info() {} } };
  const headers: Record<string, string> = {};
  const res = { status(code: number) { status = code; return this; }, json(data: unknown) { result = data; },
    setHeader(key: string, value: string) { headers[key] = value; } };
  for (const layer of route.stack) {
    let next = false;
    await layer.handle(req, res, () => { next = true; });
    if (!next) break;
  }
  return { status, body: result, headers };
}

test("real profile route enforces owner/approval/auth and returns actionable validation", async () => {
  const f = await fixture();
  for (const [token, expected] of [[undefined, 401], ["other", 403], ["pending", 403], ["supporter", 403]] as const) {
    assert.equal((await invoke(f.router, "patch", token, { name: "Changed" })).status, expected);
  }
  assert.equal(f.state.writes.length, 0);
  const invalid = await invoke(f.router, "patch", "org", { shortDescription: "a".repeat(121) });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error, /Shorten/);
});

test("independent section saves preserve campaigns, settlement locks and balances; response is public-safe", async () => {
  const f = await fixture();
  await Promise.all([
    invoke(f.router, "patch", "org", { shortDescription: "Learning together", totalRaised: 0 }),
    invoke(f.router, "patch", "org", { description: "A new story" }),
  ]);
  assert.deepEqual(f.state.writes.map((w: any) => Object.keys(w.patch).sort()).sort(),
    [["description"], ["shortDescription"]].sort());
  const stored = f.state.docs.get("organisations/org");
  assert.equal(stored.totalRaised, 300);
  assert.equal(stored.totalOwedGbp, 285);
  assert.equal(stored.payoutSettlementBatchId, "locked");
  assert.equal(stored.campaigns[0]._id, "draft");
  assert.equal(stored.shortDescription, "Learning together");
  assert.equal(stored.description, "A new story");
  const response = await invoke(f.router, "patch", "org", { team: [], impactMetrics: null });
  assert.equal(response.status, 200);
  for (const key of ["campaigns", "payoutManualLabel", "payoutManualApproved", "payoutSettlementBatchId"]) {
    assert.equal(key in response.body, false, key);
  }
  const publicResponse = await invoke(f.router, "get");
  assert.equal(publicResponse.body.shortDescription, "Learning together");
  assert.equal(publicResponse.body.impactMetrics, null);
  assert.equal(publicResponse.body.payoutManualLabel, undefined);
});

const campaignRoute = "/organisations/:id/campaigns/:campId";
function readyCampaignFixture(f: any, enabled = false) {
  const org = f.state.docs.get("organisations/org");
  Object.assign(org, {
    logo: "/api/logo.jpg", coverImage: "/api/cover.jpg", country: "Jamaica",
    shortDescription: "Training the next generation together", description: "Our community story. ".repeat(15),
    categories: ["Education"], payoutMethod: "bank_transfer", payoutManualApproved: true,
    campaigns: [{ _id: "camp", name: "Community learning", tagline: "Help fund 30 places",
      description: "Our campaign story. ".repeat(15), goal: 3000, imageUrl: "/api/hero.jpg",
      amountRaised: 123, enabled, status: "active", theme: { primaryColor: "#B50000", accentColor: "#F5B800" } }],
  });
  return org;
}

test("campaign creation accepts empty private drafts and initialises structured optional content", async () => {
  const f = await fixture();
  const result = await invoke(f.router, "post", "org", { amountRaised: 999, enabled: true }, "org", "/organisations/:id/campaigns");
  assert.equal(result.status, 201);
  assert.equal(result.body.enabled, false);
  assert.equal(result.body.name, "");
  assert.equal(result.body.amountRaised, 0);
  assert.deepEqual(result.body.breakdown, []);
  assert.deepEqual(result.body.locations, []);
  assert.equal(result.body.partnerFunding, null);
  assert.equal(result.body.video, null);
  assert.equal(result.body.editorStep, 1);
  assert.equal(result.body.sharePath, undefined); // Acquire the readable name on first publish, not from an empty draft.
});

test("campaign structured drafts round trip without changing totals or requiring publish completeness", async () => {
  const f = await fixture();
  const org = readyCampaignFixture(f);
  org.campaigns[0].partnerFundingMatchedGbp = 25;
  const patch = {
    saveAsDraft: true, editorStep: 4, tagline: "A revised ask", description: "An unfinished draft",
    partnerFunding: { amount: 500, funderName: "Community Foundation", type: "committed" },
    breakdown: [{ label: "30 places", detail: "Training and childcare" }],
    locations: [{ name: "Kingston", description: "At our community centre", photoUrl: "/api/place.jpg" }],
    video: { url: "https://youtu.be/test123", posterUrl: "/api/poster.jpg", captionsUrl: "/api/captions.vtt" },
    theme: { unit: { singular: "seedling", plural: "seedlings", imageUrl: "/campaign-units/seedling.svg" } },
    amountRaised: 0,
    partnerFundingMatchedGbp: 0,
  };
  const result = await invoke(f.router, "patch", "org", patch, "org", campaignRoute);
  assert.equal(result.status, 200);
  assert.equal(result.body.amountRaised, 123);
  assert.equal(result.body.partnerFundingMatchedGbp, 25, "Editors cannot reset matching already allocated by webhooks");
  assert.equal(result.body.editorStep, 4);
  assert.equal(result.body.theme.primaryColor, "#B50000");
  for (const key of ["partnerFunding", "breakdown", "locations", "video"]) assert.deepEqual(result.body[key], patch[key as keyof typeof patch]);
  const stored = f.state.docs.get("organisations/org");
  assert.equal(stored.totalRaised, org.totalRaised);
  assert.equal(stored.payoutSettlementBatchId, "locked");
});

test("story autosaves round trip the real wizard payload before selecting unit artwork", async () => {
  const f = await fixture();
  const org = readyCampaignFixture(f);
  Object.assign(org.campaigns[0].theme, { backgroundColor: "#FFF9F2", textColor: "#1A1A1A" });
  for (const unit of [null, { singular: "", plural: "", imageUrl: null },
    { singular: "brick", plural: "bricks", imageUrl: null },
    { singular: "brick", plural: "bricks", imageUrl: "/campaign-units/brick.svg" }]) {
    const draft = f.draftFromCampaign(org.campaigns[0]);
    draft.description = "Updated story, not yet ready to publish.";
    draft.unit = unit;
    draft.unitChosen = unit !== null;
    const payload = { ...f.draftToPatch(draft, org.campaigns[0].theme), saveAsDraft: true, editorStep: 3 };
    const result = await invoke(f.router, "patch", "org", payload, "org", campaignRoute);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.description, draft.description);
    assert.deepEqual(result.body.theme.unit, unit);
    assert.equal(result.body.amountRaised, 123);
    const persisted = f.state.docs.get("organisations/org").campaigns[0];
    const reopened = f.draftFromCampaign(f.campaignForEditor(persisted));
    assert.equal(reopened.description, draft.description);
    assert.deepEqual(reopened.unit, unit);
    assert.equal(persisted.editorStep, 3);
  }
});

test("campaign currency and ordered uploaded videos survive save/reopen with legacy fallback and explicit removal", async () => {
  const f = await fixture();
  const org = readyCampaignFixture(f);
  org.campaigns[0].amountRaised = 0;
  const videos = [
    { url: "/api/uploads/object/org-media/first.mp4", posterUrl: null, captionsUrl: null, caption: "Our work in Kingston" },
    { url: "https://youtu.be/test123", posterUrl: "/api/poster.jpg", captionsUrl: "/api/captions.vtt", caption: "" },
    { url: "", posterUrl: null, captionsUrl: null, caption: "Upload still pending" },
  ];
  const saved = await invoke(f.router, "patch", "org", {
    currency: "usd", videos, editorStep: 4, saveAsDraft: true,
  }, "org", campaignRoute);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.currency, "usd");
  assert.deepEqual(saved.body.videos, videos);
  const reopened = f.draftFromCampaign(f.campaignForEditor(f.state.docs.get("organisations/org").campaigns[0]));
  assert.equal(reopened.currency, "usd");
  assert.deepEqual(reopened.videos.map(({ id, ...video }: any) => video), videos);
  const removed = await invoke(f.router, "patch", "org", { videos: [], saveAsDraft: true }, "org", campaignRoute);
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body.videos, []);
  assert.equal(removed.body.video, null);
  assert.equal(f.draftFromCampaign(removed.body).videos.length, 0);
  const legacy = f.draftFromCampaign({ video: videos[0] });
  assert.equal(legacy.currency, "gbp");
  assert.equal(legacy.videos.length, 1);
  assert.equal(legacy.videos[0].caption, "Our work in Kingston");
  assert.equal(f.draftFromCampaign({ videos: [], video: videos[0] }).videos.length, 0);
});

test("campaign currency cannot relabel existing or in-flight donations and videos remain bounded/validated", async () => {
  const f = await fixture();
  const org = readyCampaignFixture(f);
  const change = () => invoke(f.router, "patch", "org", { currency: "usd", saveAsDraft: true }, "org", campaignRoute);
  assert.equal((await change()).status, 400);
  org.campaigns[0].amountRaised = 0;
  org.campaigns[0].currencyLockedAt = "2026-11-04T00:00:00Z";
  assert.equal((await change()).status, 400);
  for (const body of [
    { currency: "eur" }, { videos: Array(11).fill({ url: "" }) },
    { videos: [{ url: "https://unsafe.example/video.mp4" }] },
    { videos: [{ url: "", caption: "x".repeat(2001) }] },
  ]) assert.throws(() => f.campaignPatch(body));
});

test("unfinished units do not bypass malformed artwork validation or private revision boundaries", async () => {
  const f = await fixture();
  const org = readyCampaignFixture(f, true);
  const originalStory = org.campaigns[0].description;
  const result = await invoke(f.router, "patch", "org", {
    saveAsDraft: true, description: "Private revision", theme: { unit: null }, editorStep: 3,
  }, "org", campaignRoute);
  assert.equal(result.status, 200);
  const persisted = f.state.docs.get("organisations/org").campaigns[0];
  assert.equal(persisted.description, originalStory);
  assert.equal(persisted.enabled, true);
  assert.equal(f.campaignForEditor(persisted).description, "Private revision");
  assert.equal(f.campaignForEditor(persisted).theme.unit, null);
  for (const unit of ["invalid", [], 0, { singular: 42, plural: "", imageUrl: null },
    { singular: "", plural: "", imageUrl: "javascript:bad" }]) {
    assert.throws(() => f.campaignPatch({ theme: { unit } }));
  }
});

test("publish gates are server enforced, including unapproved manual and unset payouts", async () => {
  const f = await fixture();
  readyCampaignFixture(f);
  const current = () => f.state.docs.get("organisations/org");
  current().payoutManualApproved = false;
  const pending = await invoke(f.router, "patch", "org", { enabled: true }, "org", campaignRoute);
  assert.equal(pending.status, 400);
  assert.ok(pending.body.unmetGates.some((g: any) => g.id === "payout"));
  assert.equal(current().campaigns[0].enabled, false);
  current().payoutMethod = "none";
  assert.equal((await invoke(f.router, "patch", "org", { enabled: true }, "org", campaignRoute)).status, 400);
  current().payoutMethod = "bank_transfer"; current().payoutManualApproved = true;
  current().campaigns[0].description = "Too short";
  const short = await invoke(f.router, "patch", "org", { enabled: true }, "org", campaignRoute);
  assert.ok(short.body.unmetGates.some((g: any) => g.id === "story" && g.step === 3));
  current().campaigns[0].description = "Campaign story. ".repeat(20);
  current().logo = null;
  const profile = await invoke(f.router, "patch", "org", { enabled: true }, "org", campaignRoute);
  assert.ok(profile.body.unmetGates.some((g: any) => g.id === "profile"));
});

test("published edits stay private until publish; unpublish preserves pending edits and is reversible", async () => {
  const f = await fixture();
  readyCampaignFixture(f);
  assert.equal((await invoke(f.router, "patch", "org", { enabled: true }, "org", campaignRoute)).status, 200);
  const edited = await invoke(f.router, "patch", "org", { saveAsDraft: true, name: "Unpublished new title", editorStep: 2 }, "org", campaignRoute);
  assert.equal(edited.body.name, "Unpublished new title");
  assert.equal(edited.body.enabled, true);
  assert.equal(edited.body.hasUnpublishedChanges, true);
  const stored = () => f.state.docs.get("organisations/org").campaigns[0];
  assert.equal(stored().name, "Community learning");
  assert.equal(stored().editorDraft.name, "Unpublished new title");
  const publicList = await invoke(f.router, "get", undefined, {}, "org", "/organisations/:id/campaigns");
  assert.equal(publicList.body[0].name, "Community learning");
  assert.equal(publicList.body[0].editorDraft, undefined);
  const managed = await invoke(f.router, "get", "org", {}, "org", "/organisations/:id/campaigns/manage");
  assert.equal(managed.body[0].name, "Unpublished new title");
  await invoke(f.router, "patch", "org", { enabled: false }, "org", campaignRoute);
  assert.equal(stored().enabled, false);
  assert.equal(stored().editorDraft.name, "Unpublished new title");
  await invoke(f.router, "patch", "org", { saveAsDraft: true, name: "Final title" }, "org", campaignRoute);
  assert.equal(stored().name, "Final title");
  assert.equal(stored().editorDraft, undefined);
  const published = await invoke(f.router, "patch", "org", { enabled: true }, "org", campaignRoute);
  assert.equal(published.status, 200);
  assert.equal(stored().name, "Final title");
  assert.equal(stored().amountRaised, 123);
  assert.equal(stored().enabled, true);
  assert.match(stored().sharePath, /community-learning/); // Published share links remain stable after a rename.
});

test("campaign validation bounds structured fields and never accepts financial edits", async () => {
  const f = await fixture();
  for (const body of [
    { tagline: "x".repeat(141) }, { locations: Array(4).fill({}) }, { goal: -1 },
    { description: "<script>bad</script>" }, { theme: { unit: { singular: "a", plural: "b", imageUrl: "javascript:bad" } } },
    { video: { url: "https://unrecognised.example/video", posterUrl: "", captionsUrl: "" } },
  ]) assert.throws(() => f.campaignPatch(body));
  assert.deepEqual(f.campaignPatch({ amountRaised: 0, _id: "overwritten", stripeRef: "bad" }), {});
  assert.deepEqual(await f.suggest({ field: "description", orgContext: {}, campaignDraft: {}, instruction: "" }), { unavailable: true });
});

test("campaign mutations require approved ownership", async () => {
  const f = await fixture();
  readyCampaignFixture(f);
  for (const token of ["other", "supporter", "pending"]) {
    assert.equal((await invoke(f.router, "post", token, {}, "org", "/organisations/:id/campaigns")).status, 403);
    assert.equal((await invoke(f.router, "patch", token, { name: "Not mine" }, "org", campaignRoute)).status, 403);
  }
  assert.equal(f.state.writes.length, 0);
});

test("partner funding defaults safely, validates matching terms and preserves old commitments", async () => {
  const f = await fixture();
  const details = { amount: 100, funderName: "Government" };
  assert.deepEqual(f.campaignPatch({ partnerFunding: details }).partnerFunding, { ...details, type: "committed" });
  assert.deepEqual(f.campaignPatch({ matchFunding: details }).partnerFunding, { ...details, type: "committed" });
  assert.deepEqual(f.campaignPatch({ partnerFunding: { ...details, type: "matching" } }).partnerFunding,
    { ...details, type: "matching", matchRatio: 1, matchCap: 100 });
  assert.deepEqual(f.campaignPatch({ partnerFunding: { ...details, type: "committed", matchRatio: 2, matchCap: 500 } }).partnerFunding,
    { ...details, type: "committed" });
  assert.throws(() => f.campaignPatch({ partnerFunding: { ...details, type: "matching", matchRatio: 0 } }));
  assert.throws(() => f.campaignPatch({ partnerFunding: { ...details, type: "matching", matchCap: -1 } }));
  const org = readyCampaignFixture(f);
  const campaign = { ...org.campaigns[0], partnerFunding: { ...details, type: "matching", matchCap: 20 }, partnerFundingMatchedGbp: 25 };
  assert.ok(f.campaignPublishGates(org, campaign).some((gate: any) => gate.id === "partner-cap"));
});

test("supporter counts deduplicate people and payments; names respect opt-outs and never disclose email", async () => {
  const f = await fixture();
  const emailKey = f.donorIdentity({ email: " Donor@Example.test ", stripeRef: "pi1" });
  assert.equal(emailKey, f.donorIdentity({ email: "donor@example.test", stripeRef: "pi2" }));
  const deviceKey = f.donorIdentity({ userId: "anonymous", anonymousDonorId: "a-device-id", stripeRef: "pi7" });
  assert.match(deviceKey, /^device:/);
  assert.equal(deviceKey, f.donorIdentity({ userId: "anonymous", anonymousDonorId: "a-device-id", stripeRef: "pi8" }));
  assert.match(f.donorIdentity({ userId: "anonymous", stripeRef: "historical" }), /^unidentified:/);
  const result = f.summariseSupporters([
    { stripeRef: "pi1", userId: "a", donorIdentityKey: emailKey, publicDonorName: "Ada Lovelace", createdAt: "2026-10-20" },
    { stripeRef: "pi2", userId: "a", donorIdentityKey: emailKey, createdAt: "2026-10-21" },
    { stripeRef: "pi2", userId: "a", donorIdentityKey: emailKey },
    { stripeRef: "pi3", guestEmail: "donor@example.test" },
    { stripeRef: "pi4", userId: "b", publicDonorName: "Grace Hopper", createdAt: "2026-10-22" },
    { stripeRef: "pi5", status: "refunded", userId: "c" },
    { stripeRef: "pi6" },
  ], [{ userId: "a", optedIn: true, displayName: "Ada L." }, { userId: "b", optedIn: false, displayName: "Grace H." }]);
  assert.equal(result.supporterCount, 2);
  assert.equal(result.unidentifiedGifts, 1);
  assert.equal(result.recentSupporters[0].displayName, "Anonymous");
  assert.equal(result.recentSupporters[1].displayName, "Ada L.");
  assert.doesNotMatch(JSON.stringify(result), /@|userId|donorIdentityKey/);
});

test("direct draft preview is approved-owner-only, no-store and contains no payee data", async () => {
  const f = await fixture();
  readyCampaignFixture(f);
  const path = "/organisations/:id/campaigns/:campId/preview";
  assert.equal((await invoke(f.selfServiceRouter, "get", undefined, {}, "org", path)).status, 401);
  for (const token of ["other", "supporter", "pending"]) assert.equal((await invoke(f.selfServiceRouter, "get", token, {}, "org", path)).status, 403);
  const response = await invoke(f.selfServiceRouter, "get", "org", {}, "org", path);
  assert.equal(response.status, 200);
  assert.equal(response.body.campaign.enabled, false);
  assert.equal(response.body.preview, true);
  assert.equal(response.body.organisation.payoutManualLabel, undefined);
  assert.equal(response.body.campaign.supporterCount, 0);
  assert.equal(response.headers["Cache-Control"], "no-store");
  const org = f.state.docs.get("organisations/org");
  org.campaigns[0].enabled = true;
  const publicName = org.campaigns[0].name;
  org.campaigns[0].editorDraft = { name: "Private revision for donor preview" };
  const revisedPreview = await invoke(f.selfServiceRouter, "get", "org", {}, "org", path);
  assert.equal(revisedPreview.body.campaign.name, "Private revision for donor preview");
  assert.equal(revisedPreview.body.campaign.editorDraft, undefined);
  const publicView = await invoke(f.router, "get", undefined, {}, "org", "/organisations/:id/campaigns");
  assert.equal(publicView.body[0].name, publicName);
});

test("running dashboard uses actual unpaid ledger and real payout references, not accrued lifetime totals", async () => {
  const f = await fixture();
  const org = readyCampaignFixture(f);
  org.totalOwedGbp = 9999;
  f.state.docs.set("payouts/queued", { orgId: "org", amountGbp: 250, status: "queued" });
  f.state.docs.set("payouts/failed", { orgId: "org", amountGbp: 50, status: "failed" });
  f.state.docs.set("payouts/sent", { orgId: "org", amountGbp: 33, status: "sent", sentAt: "2026-10-01", reference: "bank-confirmed-33" });
  const response = await invoke(f.selfServiceRouter, "get", "org", {}, "org", "/organisations/:id/dashboard-summary");
  assert.equal(response.status, 200);
  assert.equal(response.body.owedGbp, 300);
  assert.equal(response.body.raisedGbp, org.totalRaised);
  assert.equal(response.body.nextPayoutAt, null);
  assert.equal(response.body.lastPayout.reference, "bank-confirmed-33");
  assert.equal(response.body.lastPayout.amountGbp, 33);
  assert.equal(response.body.impactMetricsStale, true);
  assert.equal(response.body.campaignRaised[0].raisedGbp, 123);
  f.state.queryFailure = true;
  const partial = await invoke(f.selfServiceRouter, "get", "org", {}, "org", "/organisations/:id/dashboard-summary");
  assert.equal(partial.status, 200);
  assert.equal(partial.body.raisedGbp, 300);
  assert.equal(partial.body.owedGbp, null);
  assert.equal(partial.body.lastPayout, null);
  assert.deepEqual(partial.body.unavailable, ["supporters", "payouts", "payoutHistory", "posts"]);
});

test("denied payout history does not discard confirmed balances, supporters or campaign totals", async () => {
  const f = await fixture();
  f.state.queryFailure = "disbursements";
  f.state.docs.set("payouts/queued", { orgId: "org", amountGbp: 42.15, status: "queued" });
  f.state.docs.set("donations/paid", { orgId: "org", stripeRef: "pi_mock", userId: "donor", publicDonorName: "Ada L.", createdAt: "2026-10-31" });
  const path = "/organisations/:id/dashboard-summary";
  const response = await invoke(f.selfServiceRouter, "get", "org", {}, "org", path);
  assert.equal(response.status, 200);
  assert.equal(response.body.raisedGbp, 300);
  assert.equal(response.body.owedGbp, 42.15);
  assert.equal(response.body.recentSupporters[0].displayName, "Ada L.");
  assert.deepEqual(response.body.unavailable, ["payoutHistory"]);
  assert.equal(response.body.lastPayout, null);
  assert.equal(response.body.campaignRaised.length, 1);
  f.state.queryFailure = false;
  const recovered = await invoke(f.selfServiceRouter, "get", "org", {}, "org", path);
  assert.deepEqual(recovered.body.unavailable, []);
});

test("an unreadable ledger remains unknown, never a zero balance, while other dashboard data survives", async () => {
  const f = await fixture();
  f.state.queryFailure = "payouts";
  const response = await invoke(f.selfServiceRouter, "get", "org", {}, "org", "/organisations/:id/dashboard-summary");
  assert.equal(response.status, 200);
  assert.equal(response.body.owedGbp, null);
  assert.equal(response.body.raisedGbp, 300);
  assert.deepEqual(response.body.unavailable, ["payouts"]);
});

test("monthly impact reminder includes the active goal, not only the other three figures", async () => {
  const f = await fixture();
  const org = readyCampaignFixture(f);
  const now = new Date().toISOString();
  org.impactMetrics = Object.fromEntries(["peopleReached", "groundCovered", "resourcesDelivered"]
    .map(key => [key, { value: 10, updatedAt: now }]));
  org.activeGoal = { title: "Community target", current: 1, target: 5,
    updatedAt: new Date(Date.now() - 31 * 86_400_000).toISOString() };
  const path = "/organisations/:id/dashboard-summary";
  assert.equal((await invoke(f.selfServiceRouter, "get", "org", {}, "org", path)).body.impactMetricsStale, true);
  org.activeGoal.updatedAt = now;
  assert.equal((await invoke(f.selfServiceRouter, "get", "org", {}, "org", path)).body.impactMetricsStale, false);
});

test("walkthrough resumes across requests, persists real preview opens and cannot fake completion", async () => {
  const f = await fixture();
  readyCampaignFixture(f);
  const path = "/organisations/:id/walkthrough";
  let response = await invoke(f.selfServiceRouter, "patch", "org", { profileStep: 6, exitedAt: "2026-10-22", selectedCampaignId: "camp" }, "org", path);
  assert.equal(response.status, 200);
  assert.equal((await invoke(f.selfServiceRouter, "get", "org", {}, "org", path)).body.walkthrough.profileStep, 6);
  assert.equal((await invoke(f.selfServiceRouter, "patch", "org", { profileDone: true }, "org", path)).status, 400);
  const eventPath = "/organisations/:id/walkthrough/events";
  await invoke(f.selfServiceRouter, "post", "org", { event: "profile_preview" }, "org", eventPath);
  assert.equal((await invoke(f.selfServiceRouter, "patch", "org", { profileDone: true }, "org", path)).status, 200);
  assert.equal((await invoke(f.selfServiceRouter, "patch", "org", { campaignDone: true }, "org", path)).status, 400);
  await invoke(f.router, "patch", "org", { enabled: true }, "org", campaignRoute);
  await invoke(f.selfServiceRouter, "post", "org", { event: "campaign_preview", campaignId: "camp" }, "org", eventPath);
  assert.equal((await invoke(f.selfServiceRouter, "patch", "org", { campaignDone: true, campaignStep: null }, "org", path)).status, 200);
  await invoke(f.router, "patch", "org", { saveAsDraft: true, tagline: "A private revision, not a new publication" }, "org", campaignRoute);
  assert.equal((await invoke(f.selfServiceRouter, "patch", "org", { campaignDone: true }, "org", path)).status, 400);
  await invoke(f.router, "patch", "org", { enabled: true }, "org", campaignRoute);
  assert.equal((await invoke(f.selfServiceRouter, "patch", "org", { campaignDone: true }, "org", path)).status, 200);
  const publicOrg = (await invoke(f.router, "get", undefined)).body;
  assert.equal(publicOrg.walkthrough, undefined);
  assert.equal(publicOrg.profilePreviewedAt, undefined);
  assert.equal(f.state.docs.get("organisations/org").payoutSettlementBatchId, "locked");
});

test("assistant is default-off, returns 503 without calling a provider, and its real adapter is unavailable", async () => {
  assert.deepEqual(await suggest({ field: "description", orgContext: {}, campaignDraft: {}, instruction: "" }), { unavailable: true });
  const f = await fixture("unset");
  readyCampaignFixture(f);
  assert.equal((await invoke(f.assistRouter, "get", "org", {}, "org", "/campaigns/assist/status")).body.enabled, false);
  const express = createRequire(import.meta.url)("express");
  const app = express();
  app.use(express.json());
  app.use(f.assistRouter);
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>(r => server.listening ? r() : server.once("listening", r));
    const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/campaigns/assist`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer org" },
      body: JSON.stringify({ campaignId: "camp", field: "description", instruction: "Shorten this" }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json() as any).unavailable, true);
    assert.equal(f.state.assistInputs.length, 0);
    assert.equal(f.state.writes.length, 0);
  } finally {
    await new Promise<void>(r => server.close(r));
  }
});

test("assistant socket is authenticated, owner scoped, unavailable and rate limited; public routes remain public", async () => {
  const f = await fixture();
  readyCampaignFixture(f);
  const express = createRequire(import.meta.url)("express");
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => { req.log = { error() {}, info() {} }; next(); });
  app.use(f.selfServiceRouter, f.assistRouter);
  app.get("/organisations/public", (_req: any, res: any) => res.json({ public: true }));
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>(r => server.listening ? r() : server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port;
    assert.equal((await fetch(base + "/organisations/public")).status, 200);
    assert.equal((await fetch(base + "/campaigns/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
    const call = (id = "camp") => fetch(base + "/campaigns/assist", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer org" },
      body: JSON.stringify({ campaignId: id, field: "description", instruction: "Make this clearer" }) });
    assert.equal((await call("someone-elses-campaign")).status, 404);
    for (let i = 0; i < 9; i++) assert.equal((await call()).status, 503);
    assert.equal((await call()).status, 429);
    assert.equal(f.state.assistInputs.length, 9);
    const context = f.state.assistInputs[0];
    assert.equal(context.orgContext.name, "Original Org");
    assert.equal(context.campaignDraft.name, "Community learning");
    assert.doesNotMatch(JSON.stringify(context), /totalOwed|amountRaised|donor|payout|Private reminder/);
    assert.equal(f.state.writes.length, 0);
  } finally {
    await new Promise<void>(r => server.close(r));
  }
});
