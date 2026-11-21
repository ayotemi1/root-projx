import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";

const helperBundle = await build({
  entryPoints: [new URL("../../../web/src/lib/onboarding-suggestions.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "node", format: "cjs",
});
const helperModule = { exports: {} as any };
new Function("module", "exports", helperBundle.outputFiles[0]!.text)(helperModule, helperModule.exports);
const { selectOnboardingSuggestions, onboardingDestination } = helperModule.exports;
const org = (id: string, category = "Education", extra = {}) =>
  ({ _id: id, name: id, category, payoutMethod: "none", ...extra });

test("first follows ranks multi-sector matches before filling with other public organisations", () => {
  const rows = [org("other", "Environment"), org("primary"), org("multi", "Other", { categories: ["Youth", "Education"] })];
  assert.deepEqual(selectOnboardingSuggestions(rows, ["Education"]).map((o: any) => o._id),
    ["primary", "multi", "other"]);
  assert.deepEqual(selectOnboardingSuggestions(rows, []).map((o: any) => o._id), ["other", "primary", "multi"]);
});

test("suggestions are real, unique, at most six, and gracefully handle small or empty lists", () => {
  const rows = Array.from({ length: 9 }, (_, i) => org(String(i)));
  assert.equal(selectOnboardingSuggestions(rows, ["Education"]).length, 6);
  assert.deepEqual(selectOnboardingSuggestions([rows[0], rows[0], org("blank", "Education", { name: " " })], []), [rows[0]]);
  assert.deepEqual(selectOnboardingSuggestions([], []), []);
});

test("donation destinations respect the public payout capability; other cards link to profiles", () => {
  for (const payoutMethod of ["stripe_connect", "wise", "manual"]) {
    assert.deepEqual(onboardingDestination(org("real", "Youth", { payoutMethod })), { href: "/donate/real", label: "Donate" });
  }
  for (const payoutMethod of ["none", undefined]) {
    assert.deepEqual(onboardingDestination(org("not-ready", "Youth", { payoutMethod })),
      { href: "/organisations/not-ready", label: "Visit" });
  }
});

// The existing Firestore rules make organisation docs server-only. Mock this
// boundary explicitly, including reads of a follow document that doesn't exist.
const compiled = await build({
  stdin: {
    contents: 'export {default as router} from "../routes/follows.ts"; export {state} from "follow-test:state";',
    resolveDir: new URL(".", import.meta.url).pathname,
  },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{
    name: "follows-private-storage",
    setup(b) {
      b.onResolve({ filter: /^follow-test:state$/ }, () => ({ path: "state", namespace: "follows" }));
      b.onResolve({ filter: /\/lib\/(firebase-rest|auth)\.js$/ }, a => ({
        path: a.path.split("/").pop()!, namespace: "follows",
      }));
      b.onLoad({ filter: /.*/, namespace: "follows" }, a => ({
        loader: "js",
        contents: a.path === "state" ? `
          export const state = {follow:null, org:{name:"Public Org",followerCount:4,totalRaised:37,
            campaigns:[{status:"draft",story:"private draft"}]}, changes:[]};
        ` : a.path === "auth.js" ? `
          export function requireAuth(req,res,next){
            if(!req.user){res.status(401).json({error:"Unauthorized"});return;} next();
          }
        ` : `
          import {state} from "follow-test:state";
          export const getServerToken=async()=>"server-only";
          export async function fsGet(collection,id,token){
            if(collection==="organisations"){
              if(token!=="server-only")throw Error("Organisation access denied");
              return state.org;
            }
            if(!state.follow && token!=="server-only")throw Error("Missing follow read denied");
            return state.follow;
          }
          export async function fsPatch(collection,id,data,token){
            if(collection!=="follows" || data.userId!=="owner" || token!=="owner-token")
              throw Error("Follow must be owned by signed-in supporter");
            state.follow={_id:id,...data};
          }
          export async function fsDelete(collection,id,token){state.follow=null;}
          export async function fsQuery(collection,filters,token){
            if(filters[0].value!=="owner" || token!=="owner-token")throw Error("Wrong owner");
            return state.follow?[state.follow]:[];
          }
          export async function fsIncrement(collection,id,fields,token){
            if(token!=="server-only")throw Error("Count update denied");
            state.changes.push({collection,id,fields});
            state.org.followerCount+=fields.followerCount;
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
    async request(method: string, path: string, signedIn = true) {
      const route = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
      let status = 200, data: any;
      const req = {
        body: { orgId: "org" }, params: { orgId: "org" },
        headers: { authorization: "Bearer owner-token" },
        user: signedIn ? { userId: "owner" } : undefined, log: { error() {} },
      };
      const res = {
        status(code: number) { status = code; return this; },
        json(value: unknown) { data = value; },
      };
      for (const layer of route.stack) {
        let next = false;
        await layer.handle(req, res, () => { next = true; });
        if (!next) break;
      }
      return { status, data };
    },
  };
}

test("follow, authenticated reload, and unfollow use correct permissions and only update the follower aggregate", async () => {
  const f = fixture();
  assert.equal((await f.request("get", "/follows/my")).status, 200);
  assert.equal((await f.request("post", "/follows")).status, 201);
  assert.equal(f.state.follow.userId, "owner");
  const reloaded = await f.request("get", "/follows/my");
  assert.equal(reloaded.data[0]._id, "org");
  assert.equal(reloaded.data[0].followerCount, 5);
  assert.equal("campaigns" in reloaded.data[0], false);
  assert.equal((await f.request("post", "/follows")).status, 409);
  assert.equal(f.state.org.followerCount, 5);
  assert.equal((await f.request("delete", "/follows/:orgId")).status, 200);
  assert.deepEqual((await f.request("get", "/follows/my")).data, []);
  assert.equal(f.state.org.totalRaised, 37);
  assert.deepEqual(f.state.changes, [
    { collection: "organisations", id: "org", fields: { followerCount: 1 } },
    { collection: "organisations", id: "org", fields: { followerCount: -1 } },
  ]);
});

test("following still requires authentication and rejects missing organisations", async () => {
  const f = fixture();
  assert.equal((await f.request("post", "/follows", false)).status, 401);
  f.state.org = null;
  assert.equal((await f.request("post", "/follows")).status, 404);
  assert.equal(f.state.follow, null);
});
