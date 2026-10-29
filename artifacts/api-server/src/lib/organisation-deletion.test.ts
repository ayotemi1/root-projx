import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { fsGet, fsList, fsQuery } from "./firebase-rest.ts";
import { organisationDeletionConfirmation } from "./organisation-deletion-confirmation.ts";

// All writes are in-memory. Never delete a real organisation for verification.
const compiled = await build({
  stdin: { contents: `
    export {default as router} from "../routes/organisation-deletion.ts";
    export {getAdminTokenValue} from "./admin-auth.ts";
    export {state} from "deletion:state";`, resolveDir: new URL(".", import.meta.url).pathname },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{
    name: "mock-deletion-store", setup(b) {
      b.onResolve({ filter: /^deletion:state$/ }, () => ({ path: "state", namespace: "deletion" }));
      b.onResolve({ filter: /\/lib\/firebase-rest\.js$/ }, () => ({ path: "firebase", namespace: "deletion" }));
      b.onLoad({ filter: /.*/, namespace: "deletion" }, a => ({
        loader: "js", contents: a.path === "state" ? `
          export const state={org:{name:"Example Org",totalRaised:3,totalOwedGbp:2.85,campaigns:[{_id:"camp",amountRaised:3}]},writes:[],fail:false,recurring:[]};
        ` : `
          import {state} from "deletion:state";
          export const getServerToken=async()=>"mock-server";
          export const fsGet=async()=>state.org;
          export const fsQuery=async()=>state.recurring;
          export const fsPatch=async(collection,id,patch)=>{
            if(state.fail)throw Error("synthetic failure");
            state.writes.push({collection,id,patch}); Object.assign(state.org,patch);
          };
        `,
      }));
    },
  }],
});
function fixture() {
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(
    createRequire(import.meta.url), mod, mod.exports);
  const { router, state, getAdminTokenValue } = mod.exports;
  const route = router.stack.find((l: any) => l.route?.path === "/admin/organisations/:id").route;
  return { state, async request(body: unknown, authenticated = true, id = "example-org") {
    let status = 200, data: any;
    const req = { body, params: { id }, headers: authenticated ? { "x-admin-token": getAdminTokenValue() } : {},
      log: { error() {}, info() {} } };
    const res = { setHeader() {}, status(code: number) { status = code; return this; },
      json(value: unknown) { data = value; } };
    for (const layer of route.stack) {
      let next = false;
      await layer.handle(req, res, () => { next = true; });
      if (!next) break;
    }
    return { status, data };
  } };
}

test("organisation deletion requires admin auth and uppercase DELETE; invalid requests never write", async () => {
  const f = fixture();
  assert.equal((await f.request({ confirmationName: "DELETE" }, false)).status, 401);
  for (const body of [null, {}, { confirmationName: "Example Org" }, { confirmationName: "delete" }, { confirmationName: "" }, { confirmationName: " DELETE " }, { confirmationName: true }])
    assert.equal((await f.request(body)).status, 400);
  assert.equal((await f.request({ confirmationName: "DELETE" }, true, "../bad")).status, 400);
  assert.equal(f.state.writes.length, 0);
});
test("deletion retains balances, campaigns and financial records; retry is idempotent", async () => {
  const f = fixture();
  assert.deepEqual(await f.request({ confirmationName: "DELETE" }), {
    status: 200, data: { deleted: true, orgId: "example-org" },
  });
  assert.equal(f.state.writes.length, 1);
  assert.equal(f.state.writes[0].collection, "organisations");
  assert.deepEqual(Object.keys(f.state.writes[0].patch).sort(), ["deletedAt", "deletedBy"]);
  assert.equal(f.state.org.totalRaised, 3);
  assert.equal(f.state.org.totalOwedGbp, 2.85);
  assert.equal(f.state.org.campaigns[0].amountRaised, 3);
  assert.equal((await f.request({ confirmationName: "DELETE" })).status, 200);
  assert.equal(f.state.writes.length, 1);
});
test("unnamed, missing and whitespace-only names require a visible DELETE confirmation", async () => {
  for (const name of ["", "   ", null, undefined, 42]) {
    const f = fixture();
    f.state.org.name = name;
    assert.equal(organisationDeletionConfirmation(), "DELETE");
    for (const confirmationName of ["", "exactly", "delete"]) {
      const result = await f.request({ confirmationName });
      assert.equal(result.status, 400);
      assert.match(result.data.error, /type "DELETE"/);
    }
    assert.equal(f.state.writes.length, 0);
    assert.equal((await f.request({ confirmationName: "DELETE" })).status, 200);
    assert.equal(f.state.writes.length, 1);
  }
});
test("named and padded organisation names use DELETE rather than the organisation name", async () => {
  const f = fixture();
  f.state.org.name = "  Example Org  ";
  assert.equal(organisationDeletionConfirmation(), "DELETE");
  assert.equal((await f.request({ confirmationName: "exactly" })).status, 400);
  assert.equal((await f.request({ confirmationName: "Example Org" })).status, 400);
  assert.equal((await f.request({ confirmationName: "DELETE" })).status, 200);
});
test("missing organisations, live recurring payments and failed writes fail explicitly", async () => {
  const missing = fixture(); missing.state.org = null;
  assert.equal((await missing.request({ confirmationName: "DELETE" })).status, 404);
  const subscribed = fixture(); subscribed.state.recurring = [{ status: "active" }];
  assert.equal((await subscribed.request({ confirmationName: "DELETE" })).status, 409);
  assert.equal(subscribed.state.writes.length, 0);
  const broken = fixture(); broken.state.fail = true;
  assert.equal((await broken.request({ confirmationName: "DELETE" })).status, 500);
  assert.equal(broken.state.org.deletedAt, undefined);
});
test("Firestore hides deleted organisations from direct, list and query reads; settlement explicitly retains access", async () => {
  const original = globalThis.fetch;
  const doc = (id: string, deleted: boolean) => ({
    name: `projects/test/databases/(default)/documents/organisations/${id}`,
    fields: { name: { stringValue: id }, ...(deleted ? { deletedAt: { stringValue: "2026-10-29T00:00:00Z" } } : {}) },
  });
  try {
    globalThis.fetch = async () => Response.json(doc("deleted", true));
    assert.equal(await fsGet("organisations", "deleted", "mock"), null);
    assert.equal((await fsGet("organisations", "deleted", "mock", { includeDeleted: true }))?.name, "deleted");
    globalThis.fetch = async () => Response.json({ documents: [doc("live", false), doc("deleted", true)] });
    assert.deepEqual((await fsList("organisations", "mock")).map(o => o._id), ["live"]);
    globalThis.fetch = async () => Response.json([doc("live", false), doc("deleted", true)].map(document => ({ document })));
    assert.deepEqual((await fsQuery("organisations", [], "mock")).map(o => o._id), ["live"]);
    // Financial collections are never filtered, even if they carry a deletedAt field.
    assert.equal((await fsQuery("donations", [], "mock")).length, 2);
  } finally { globalThis.fetch = original; }
});
