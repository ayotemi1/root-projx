// Private interests must survive sessions without leaking onto public profiles.
// Exercise the real profile handlers, with no Firebase or email side effects.
import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const compiled = await build({
  stdin: {
    contents: 'export {default as router} from "../routes/profile.ts"; export {state} from "interests:state";',
    resolveDir: new URL(".", import.meta.url).pathname,
  },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{
    name: "private-interests",
    setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/src/index.ts", import.meta.url).pathname,
      }));
      b.onResolve({ filter: /^zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname,
      }));
      b.onResolve({ filter: /^interests:state$/ }, () => ({ path: "state", namespace: "interests" }));
      b.onResolve({ filter: /\/lib\/(firebase-rest|auth)\.js$/ }, a =>
        ({ path: a.path.split("/").pop()!, namespace: "interests" }));
      b.onLoad({ filter: /.*/, namespace: "interests" }, a => ({
        loader: "js",
        contents: a.path === "state" ? `
          export const state = {writes:[], fail:false, user:{
            _id:"owner", name:"Supporter", accountType:"supporter",
            publicProfile:{enabled:true,publicId:"sp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
          }};
        ` : a.path === "auth.js" ? `
          export function requireAuth(req,res,next){
            if(!req.user){res.status(401).json({error:"Unauthorized"});return;}
            next();
          }
        ` : `
          import {state} from "interests:state";
          export const getServerToken=async()=>"synthetic-server";
          export async function fsGet(collection,id,token){
            if(state.fail)throw Error("Synthetic storage failure");
            return state.user;
          }
          export async function fsPatch(collection,id,data,token){
            if(state.fail)throw Error("Synthetic storage failure");
            state.writes.push({collection,id,data,token});
            Object.assign(state.user,data);
          }
          export async function fsQuery(collection){
            return collection==="users" ? [state.user] : [];
          }
        `,
      }));
    },
  }],
});

function fixture() {
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(
    createRequire(import.meta.url), mod, mod.exports,
  );
  const { router, state } = mod.exports;
  return {
    state,
    async request(method = "get", path = "/profile/interests", body?: unknown, role: string | null = "supporter") {
      const route = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
      let status = 200;
      let data: any;
      const headers: Record<string, string> = {};
      const req = {
        body, params: { publicId: "sp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        user: role ? { userId: "owner", accountType: role } : undefined,
        headers: { authorization: "Bearer synthetic-owner" }, log: { error() {} },
      };
      const res = {
        setHeader(key: string, value: string) { headers[key] = value; },
        status(code: number) { status = code; return this; },
        json(value: unknown) { data = value; },
      };
      for (const layer of route.stack) {
        let next = false;
        await layer.handle(req, res, () => { next = true; });
        if (!next) break;
      }
      return { status, data, headers };
    },
  };
}

test("legacy supporter starts unselected, with a private uncached response", async () => {
  const f = fixture(), result = await f.request();
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { interests: [] });
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(f.state.writes.length, 0);
});

test("saved interests persist across fresh authenticated reads; empty clears all", async () => {
  const f = fixture();
  const interests = ["Education", "Arts & Culture"];
  assert.equal((await f.request("put", undefined, { interests })).status, 200);
  assert.deepEqual(f.state.writes, [{
    collection: "users", id: "owner", data: { interests }, token: "synthetic-server",
  }]);
  assert.deepEqual((await f.request()).data, { interests });
  assert.equal((await f.request("put", undefined, { interests: [] })).status, 200);
  assert.deepEqual((await f.request()).data, { interests: [] });
  assert.equal(f.state.user.name, "Supporter");
});

test("unauthenticated and organisation accounts cannot read or save interests", async () => {
  for (const role of [null, "organisation"]) {
    const f = fixture();
    for (const method of ["get", "put"]) {
      assert.equal((await f.request(method, undefined, { interests: [] }, role)).status, role ? 403 : 401);
    }
    assert.equal(f.state.writes.length, 0);
  }
});

test("unknown sectors, invalid arrays, duplicates and caller-owned IDs are rejected", async () => {
  const f = fixture();
  for (const body of [{}, null, { interests: "Education" }, { interests: [12] },
    { interests: ["Invented sector"] }, { interests: ["Education", "Education"] },
    { interests: [], userId: "someone-else" }, { interests: [], accountType: "organisation" }]) {
    assert.equal((await f.request("put", undefined, body)).status, 400);
  }
  assert.equal(f.state.writes.length, 0);
});

test("missing profiles and storage failures fail without claiming a save", async () => {
  const f = fixture();
  f.state.user = null;
  assert.equal((await f.request()).status, 404);
  assert.equal((await f.request("put", undefined, { interests: [] })).status, 404);
  f.state.fail = true;
  assert.equal((await f.request()).status, 503);
  assert.equal((await f.request("put", undefined, { interests: [] })).status, 503);
  assert.equal(f.state.writes.length, 0);
});

test("an enabled public supporter profile never exposes saved interests", async () => {
  const f = fixture();
  await f.request("put", undefined, { interests: ["Education"] });
  const result = await f.request("get", "/supporters/:publicId");
  assert.equal(result.status, 200);
  assert.equal("interests" in result.data, false);
  assert.equal(JSON.stringify(result.data).includes("Education"), false);
});

test("every organisation-profile sector is accepted by the interests contract", async () => {
  const source = readFileSync(new URL("../../../web/src/lib/sectors.ts", import.meta.url), "utf8");
  const sectors = [...source.split("] as const")[0]!.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const f = fixture();
  assert.equal((await f.request("put", undefined, { interests: sectors })).status, 200);
  assert.deepEqual((await f.request()).data.interests, sectors);
});
