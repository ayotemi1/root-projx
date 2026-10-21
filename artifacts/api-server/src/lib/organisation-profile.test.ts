import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";
import { profilePatch, PROFILE_SECTORS } from "./organisation-profile.ts";

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

async function fixture() {
  const mocks: Record<string, string> = {
    state: `export const state={docs:new Map(),writes:[]};`,
    "firebase-rest.js": `
      import {state} from "profile-test:state";
      export const getServerToken=async()=>"synthetic-server";
      export const firebaseLookup=async(token)=>["org","other","pending","supporter"].includes(token)?{uid:token,email:token+"@example.test"}:null;
      export const fsGet=async(c,id)=>structuredClone(state.docs.get(c+"/"+id)??null);
      export const fsPatch=async(c,id,patch)=>{
        state.writes.push({c,id,patch:structuredClone(patch)});
        const key=c+"/"+id;
        state.docs.set(key,{...state.docs.get(key),...structuredClone(patch)});
      };
      export const fsList=async(c)=>[...state.docs].filter(([key])=>key.startsWith(c+"/")).map(([key,d])=>({...structuredClone(d),_id:key.split("/")[1]}));
      export const fsQuery=async()=>[];
      export const fsCreate=async()=>{throw Error("Unexpected write");};
    `,
    "objectStorage.js": `export const objectStorageClient={bucket(){throw Error("No storage calls permitted");}};`,
  };
  const bundle = await build({
    stdin: { contents: `export {default as router} from "./routes/organisations.ts";export {state} from "profile-test:state";`,
      resolveDir: new URL("../", import.meta.url).pathname, loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "synthetic-profile-services", setup(b) {
      b.onResolve({ filter: /^profile-test:state$|\/(firebase-rest|objectStorage)\.js$/ },
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

async function invoke(router: any, method: string, token?: string, body: unknown = {}, orgId = "org") {
  const route = router.stack.find((l: any) => l.route?.path === "/organisations/:id" && l.route.methods[method])?.route;
  assert.ok(route);
  let status = 200;
  let result: any;
  const req = { body, params: { id: orgId }, headers: token ? { authorization: "Bearer " + token } : {},
    query: {}, log: { error() {}, info() {} } };
  const res = { status(code: number) { status = code; return this; }, json(data: unknown) { result = data; } };
  for (const layer of route.stack) {
    let next = false;
    await layer.handle(req, res, () => { next = true; });
    if (!next) break;
  }
  return { status, body: result };
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
