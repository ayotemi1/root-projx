import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

// Exercise the real routes without contacting Firebase, Brevo or any real user.
const compiled = await build({
  stdin: {
    contents: `export {default as help} from "../routes/help.ts";
      export {default as newsletter} from "../routes/newsletter.ts";
      export {state} from "visitor:state";`,
    resolveDir: new URL(".", import.meta.url).pathname,
  },
  bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
  plugins: [{
    name: "visitor-services-fixtures",
    setup(b) {
      b.onResolve({ filter: /^visitor:state$|\/(?:firebase-rest|auth|brevo)\.js$/ }, a => ({
        path: a.path === "visitor:state" ? "state" : a.path.split("/").at(-1)!,
        namespace: "visitor-fixture",
      }));
      b.onLoad({ filter: /.*/, namespace: "visitor-fixture" }, a => ({
        contents: a.path === "state" ? `export const state={calls:[],logs:[],rows:[],failStore:false,failProvider:false};`
          : a.path === "auth.js" ? `export const requireAuth=(_q,_s,next)=>next(),optionalAuth=requireAuth;`
          : a.path === "brevo.js" ? `import {state} from "visitor:state";
            export async function brevoAddContact(contact){state.calls.push({op:"subscribe",contact});
              if(state.failProvider)throw Error("PRIVATE provider payload with visitor@example.test");}`
          : `import {state} from "visitor:state";
            export async function getServerToken(){state.calls.push({op:"token"});return "server-fixture";}
            export async function fsList(collection,token){state.calls.push({op:"list",collection,token});
              if(state.failStore)throw Error("PRIVATE datastore failure");return state.rows;}
            export async function fsQuery(collection,filters,token){state.calls.push({op:"query",collection,filters,token});
              if(state.failStore)throw Error("PRIVATE datastore failure");
              return state.rows.filter(row=>filters.every(f=>row[f.field]===f.value));}
            export async function fsCreate(){throw Error("Unexpected database write");}`,
      }));
    },
  }],
});

function fixture() {
  const mod = { exports: {} as any };
  // An isolated process object avoids reading or modifying project credentials.
  const env: Record<string, string> = { BREVO_API_KEY: "fixture-key", BREVO_NEWSLETTER_LIST_ID: "8" };
  new Function("require", "module", "exports", "process", compiled.outputFiles[0]!.text)(
    createRequire(import.meta.url), mod, mod.exports, { env });
  const { help, newsletter, state } = mod.exports;
  const log = { error: (...args: unknown[]) => state.logs.push(args) };
  async function request(path: string, body?: unknown, query: Record<string, unknown> = {}, authorization?: string) {
    const router = path === "/newsletter/subscribe" ? newsletter : help;
    const route = router.stack.find((l: any) => l.route?.path === path).route;
    let status = 200, data: any;
    const res = {
      status(code: number) { status = code; return this; },
      json(value: unknown) { data = value; },
    };
    const req = { body, query, headers: { authorization }, log };
    for (const layer of route.stack) {
      let next = false;
      await layer.handle(req, res, () => { next = true; });
      if (!next) break;
    }
    return { status, data };
  }
  return { env, state, request };
}

test("visitor directory uses the permitted real collection, also for signed-in callers", async () => {
  const f = fixture();
  f.state.rows = [
    { _id: "one", title: "Real directory fixture", category: "Housing", country: "Jamaica" },
    { _id: "two", title: "Another fixture", category: "Legal", country: "United Kingdom" },
  ];
  const all = await f.request("/help/orgs", undefined, {}, "Bearer supporter-fixture");
  assert.equal(all.status, 200);
  assert.equal(all.data.length, 2);
  assert.deepEqual(f.state.calls.at(-1), { op: "list", collection: "help_entries", token: "server-fixture" });
  const filtered = await f.request("/help/orgs", undefined, { category: "Housing", country: "Jamaica" });
  assert.deepEqual(filtered.data.map((r: any) => r._id), ["one"]);
  assert.equal(f.state.calls.at(-1).collection, "help_entries");
  assert.equal(f.state.calls.at(-1).token, "server-fixture");
});

test("empty directory is confirmed empty; a failed read never becomes an empty success", async () => {
  const f = fixture();
  assert.deepEqual(await f.request("/help/orgs"), { status: 200, data: [] });
  f.state.failStore = true;
  const failed = await f.request("/help/orgs");
  assert.equal(failed.status, 500);
  assert.doesNotMatch(JSON.stringify(failed.data), /PRIVATE|datastore/);
});

test("newsletter validates and normalises email, and saves to the configured list", async () => {
  const f = fixture();
  for (const body of [null, [], {}, { email: 3 }, { email: "bad@" }, { email: "bad @example.test" }, { email: "a".repeat(255) + "@example.test" }]) {
    assert.equal((await f.request("/newsletter/subscribe", body)).status, 400);
  }
  assert.equal(f.state.calls.length, 0);
  const ok = await f.request("/newsletter/subscribe", { email: " VISITOR@EXAMPLE.TEST ", name: "Visitor Example" });
  assert.equal(ok.status, 200);
  assert.deepEqual(f.state.calls[0], { op: "subscribe", contact: {
    email: "visitor@example.test", firstName: "Visitor", lastName: "Example", listIds: [8], updateEnabled: true,
  } });
});

test("newsletter fails closed for missing credentials or list and retains private provider errors", async () => {
  for (const list of ["", "NaN", "3oops", "-2", "0", "9007199254740992"]) {
    const f = fixture();
    f.env.BREVO_NEWSLETTER_LIST_ID = list;
    assert.equal((await f.request("/newsletter/subscribe", { email: "visitor@example.test" })).status, 503);
    assert.equal(f.state.calls.length, 0);
  }
  const missing = fixture();
  delete missing.env.BREVO_API_KEY;
  assert.equal((await missing.request("/newsletter/subscribe", { email: "visitor@example.test" })).status, 503);
  assert.equal(missing.state.calls.length, 0);
  const failed = fixture();
  failed.state.failProvider = true;
  const response = await failed.request("/newsletter/subscribe", { email: "visitor@example.test" });
  assert.equal(response.status, 500);
  assert.doesNotMatch(JSON.stringify([response, failed.state.logs]), /PRIVATE|visitor@example.test|fixture-key/);
});
