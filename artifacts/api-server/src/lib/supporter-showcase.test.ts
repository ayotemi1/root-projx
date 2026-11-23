import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";

const compiled = await build({
  stdin: { contents: 'export {default as router} from "../routes/supporter-showcase.ts"; export {state} from "showcase:state";',
    resolveDir: new URL(".", import.meta.url).pathname },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "showcase-fixture", setup(b) {
    b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/src/index.ts", import.meta.url).pathname }));
    b.onResolve({ filter: /^zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname }));
    b.onResolve({ filter: /^showcase:state$/ }, () => ({ path: "state", namespace: "fixture" }));
    b.onResolve({ filter: /\/?(firebase-rest|auth|supporter-posts)\.js$/ }, a => ({ path: a.path.split("/").pop()!, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ loader: "js", resolveDir: new URL(".", import.meta.url).pathname, contents: a.path === "state" ? `
      export const state={docs:new Map(), writes:[], fail:false, queries:[]};
    ` : a.path === "auth.js" ? `
      export function requireAuth(req,res,next){if(!req.user)return res.status(401).json({error:"Unauthorized"});next();}
    ` : a.path === "supporter-posts.js" ? `
      export { POST_ERROR, PostError, publicSupporter, UUID, canSeePost, postDto, POSTS, FOLLOWERS }
        from ${JSON.stringify(new URL("./supporter-posts.ts", import.meta.url).pathname)};
      export function setMediaSession(){}
    ` : `
      import {state} from "showcase:state";
      export const getServerToken=async()=>"test-server";
      export async function fsGet(c,id){if(state.fail)throw Error("PRIVATE_RAW_FAILURE");return state.docs.get(c+"/"+id)??null;}
      export async function fsQuery(c,filters){if(state.fail)throw Error("PRIVATE_RAW_FAILURE");state.queries.push(c);
        return [...state.docs.entries()].filter(([k,v])=>k.startsWith(c+"/")&&filters.every(f=>f.field.split(".").reduce((o,k)=>o?.[k],v)===f.value))
          .map(([k,v])=>({...v,_id:k.slice(c.length+1)}));}
      export async function fsMutateSupporterShowcase(uid,token,decide){
        if(state.fail)throw Error("PRIVATE_RAW_FAILURE");
        const user=state.docs.get("users/"+uid);if(!user)throw Error("missing");
        const result=decide(structuredClone(user));state.docs.set("users/"+uid,{...user,profileShowcase:structuredClone(result)});
        state.writes.push({uid,result});}
    ` }));
  } }],
});

const PUBLIC_ID = "sp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ENTRY = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const { router, state } = mod.exports;
  state.docs.set("users/owner", { accountType: "supporter", name: "Owner", email: "PRIVATE_EMAIL",
    phone: "PRIVATE_PHONE", interests: ["Education", "Health"], createdAt: "2026-11-01",
    publicProfile: { enabled: true, publicId: PUBLIC_ID, displayName: "Public Name", bio: "Biography" },
    profileShowcase: { location: "London", visibleInterests: ["Education", "NOT_CHOSEN"] },
    supportedOrgs: [{ optedIn: true, orgId: "org", amount: 123456789 }] });
  state.docs.set("users/other", { accountType: "supporter", name: "Other", interests: [] });
  state.docs.set("organisations/org", { name: "Real Org", category: "Education", country: "Jamaica" });
  state.docs.set("follows/one", { userId: "owner", orgId: "org" });
  state.docs.set("supporter_follows/one", { follower_id: "owner", author_id: "other" });
  state.docs.set("donations/one", { userId: "owner", amountGbp: 123456789, private: true });
  state.docs.set("supporter_posts/post", { id: "post", author_id: "owner", type: "text", caption: "Linked real post",
    created_at: "2026-11-02T12:00:00Z", organisation_id: "org", activity_type: "Visited", media_ids: [] });
  state.docs.set("supporter_posts/removed", { id: "removed", author_id: "owner", type: "text", caption: "REMOVED_SECRET",
    created_at: "2026-11-03T12:00:00Z", removed: true, media_ids: [] });
  state.docs.set("supporter_posts/other", { id: "other", author_id: "other", type: "text", caption: "OTHER_POST_SECRET", media_ids: [] });
  return { state, async call(path = "/supporter-showcase/me", method = "get", body?: unknown, uid: string | null = "owner", role = "supporter") {
    const route = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
    const req = { body, user: uid ? { userId: uid, accountType: role } : undefined,
      headers: { authorization: uid ? `Bearer ${uid}` : undefined }, params: { publicId: PUBLIC_ID, id: ENTRY }, log: { warn() {} } };
    let status = 200; let data: any;
    const res = { setHeader() {}, status(s: number) { status = s; return this; }, json(d: any) { data = d; return this; },
      sendStatus(s: number) { status = s; } };
    for (const layer of route.stack) {
      let next = false;
      await layer.handle(req, res, () => { next = true; });
      if (!next) break;
    }
    return { status, data };
  } };
}
const activity = (changes = {}) => ({ id: ENTRY, organisationId: "org", projectName: "Forged label ignored", activity: "Visited",
  details: "Saw the workshop", when: "Summer 2025", shared: true, ...changes });

test("supporter showcase: strict public projection, real counts and linked-post activity without donations", async () => {
  const f = fixture();
  const owner = await f.call();
  assert.equal(owner.status, 200);
  assert.deepEqual(owner.data.counts, { posts: 1, following: 2, organisations: 1 });
  assert.equal(owner.data.posts[0].author.isOwner, true);
  assert.deepEqual(owner.data.availableInterests, ["Education", "Health"]);
  assert.equal(owner.data.involvement[0].activity, "Visited");
  assert.equal(owner.data.involvement[0].href, "#post-post");
  for (const uid of [null, "owner", "other"]) {
    const publicView = await f.call("/supporter-showcase/public/:publicId", "get", undefined, uid);
    assert.equal(publicView.status, 200);
    assert.equal(publicView.data.isOwner, false);
    assert.equal(publicView.data.posts[0].author.isOwner, false);
    assert.deepEqual(publicView.data.availableInterests, []);
    assert.deepEqual(publicView.data.visibleInterests, ["Education"]);
    assert.doesNotMatch(JSON.stringify(publicView.data), /PRIVATE_|REMOVED_SECRET|OTHER_POST_SECRET|Health|NOT_CHOSEN|123456789/);
  }
  assert.ok(!f.state.queries.includes("donations"), "private giving isn't even queried");
});
test("supporter showcase: private profile hides public posts and activity even from authenticated owner Preview", async () => {
  const f = fixture();
  f.state.docs.get("users/owner").publicProfile.enabled = false;
  assert.equal((await f.call()).data.posts.length, 1, "owner retains their private posts");
  for (const uid of [null, "owner", "other"]) {
    assert.equal((await f.call("/supporter-showcase/public/:publicId", "get", undefined, uid)).status, 404);
  }
  assert.equal((await f.call(undefined, "get", undefined, null)).status, 401);
  assert.equal((await f.call(undefined, "get", undefined, "owner", "organisation")).status, 403);
});
test("supporter showcase: persisted manual organisation and outside entries, private choice and owner-only removal", async () => {
  const f = fixture();
  assert.equal((await f.call("/supporter-showcase/involvement", "post", activity())).status, 201);
  // Lost-response retry doesn't duplicate the entry.
  assert.equal((await f.call("/supporter-showcase/involvement", "post", activity())).status, 201);
  const outsideId = "22222222-2222-4222-8222-222222222222";
  await f.call("/supporter-showcase/involvement", "post", activity({
    id: outsideId, organisationId: null, projectName: "Outside group", activity: "Gave", shared: false,
  }));
  const refreshed = await f.call();
  assert.equal(refreshed.data.involvement.length, 3);
  assert.equal(refreshed.data.involvement.find((a: any) => a.id === ENTRY).projectName, "Real Org");
  assert.equal(refreshed.data.involvement.find((a: any) => a.id === outsideId).when, "Summer 2025");
  const publicView = await f.call("/supporter-showcase/public/:publicId", "get", undefined, "other");
  assert.equal(publicView.data.involvement.length, 2);
  assert.doesNotMatch(JSON.stringify(publicView), /Outside group/);
  assert.equal((await f.call("/supporter-showcase/involvement/:id", "delete", undefined, "other")).status, 204);
  assert.ok((await f.call()).data.involvement.some((a: any) => a.id === ENTRY), "unrelated delete cannot remove owner's entry");
  assert.equal((await f.call("/supporter-showcase/involvement/:id", "delete")).status, 204);
  assert.equal((await f.call()).data.involvement.length, 2);
  assert.equal(f.state.docs.get("donations/one").amountGbp, 123456789, "manual Gave never alters gifts");
});
test("supporter showcase: validates input, idempotency conflicts, unavailable organisations and friendly retry failures", async () => {
  const f = fixture();
  for (const change of [{ activity: "Invented" }, { when: "  " }, { projectName: "" }, { organisationId: "../users" },
    { details: "x".repeat(501) }, { authorId: "other" }]) {
    assert.equal((await f.call("/supporter-showcase/involvement", "post", activity(change))).status, 400);
  }
  assert.equal((await f.call("/supporter-showcase/involvement", "post", activity({ organisationId: "missing" }))).status, 400);
  await f.call("/supporter-showcase/involvement", "post", activity());
  assert.equal((await f.call("/supporter-showcase/involvement", "post", activity({ details: "Changed retry" }))).status, 409);
  f.state.fail = true;
  const result = await f.call("/supporter-showcase/involvement", "post", activity());
  assert.equal(result.status, 503);
  assert.equal(result.data.error, "Something went wrong, please try again");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_RAW_FAILURE/);
});
test("supporter showcase: opt-in interest publication and presentation-only writes", async () => {
  const f = fixture();
  const original = structuredClone(f.state.docs.get("users/owner"));
  const route = "/supporter-showcase/details";
  assert.equal((await f.call(route, "patch", { location: " London ", visibleInterests: ["Health"] })).status, 204);
  assert.deepEqual((await f.call()).data.visibleInterests, ["Health"]);
  assert.equal((await f.call()).data.location, "London");
  assert.equal((await f.call(route, "patch", { location: "", visibleInterests: ["Invented"] })).status, 400);
  assert.equal((await f.call(route, "patch", { location: "", visibleInterests: [], public: true })).status, 400);
  const latest = f.state.docs.get("users/owner");
  assert.deepEqual(latest.publicProfile, original.publicProfile);
  assert.deepEqual(latest.interests, original.interests);
  assert.deepEqual(latest.supportedOrgs, original.supportedOrgs);
});

test("supporter showcase: community activity and organisation counts use visible involvement, not follows", async () => {
  const f = fixture();
  const user = f.state.docs.get("users/owner");
  user.avatarUrl = "https://example.test/avatar.png";
  user.profileShowcase.entries = [
    { id: ENTRY, organisationId: null, projectName: "Outside project", activity: "Visited", details: "", when: "Summer 2025", shared: true },
    { id: "private", organisationId: null, projectName: "PRIVATE_GROUP", activity: "Gave", details: "", when: "2020", shared: false },
  ];
  const post = f.state.docs.get("supporter_posts/post");
  post.tag = { type: "community", value: "volunteers", label: "Volunteers" };
  delete post.activity_type;
  f.state.docs.set("follows/unrelated", { userId: "owner", orgId: "not-involved" });
  assert.equal((await f.call()).data.counts.organisations, 3);
  const publicView = (await f.call("/supporter-showcase/public/:publicId")).data;
  assert.equal(publicView.counts.organisations, 2);
  assert.equal(publicView.avatarUrl, "https://example.test/avatar.png");
  assert.equal(publicView.storyExpiresAt, null);
  assert.equal(publicView.involvement[0].activity, "Volunteered");
  for (const [value, expected] of [["visitors", "Visited"], ["fundraisers", "Fundraised"]]) {
    post.tag.value = value;
    assert.equal((await f.call()).data.involvement[0].activity, expected);
  }
  post.tag = null; post.community_tag = "Volunteers";
  assert.equal((await f.call()).data.involvement[0].activity, "Posted", "untrusted label alone isn't a structured activity");
  assert.doesNotMatch(JSON.stringify(publicView), /PRIVATE_GROUP/);
});

test("supporter showcase: atomic field-only writes preserve concurrent additions and unrelated account fields", async () => {
  const js = await build({
    stdin: { contents: 'export {fsMutateSupporterShowcase} from "./firebase-rest.ts";', resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  });
  let version = 0, writes = 0;
  let fields: any = {
    accountType: { stringValue: "supporter" }, name: { stringValue: "Do not replace" },
    profileShowcase: { mapValue: { fields: { entries: { arrayValue: { values: [] } } } } },
  };
  const fakeFetch = async (url: string, options: RequestInit = {}) => {
    if (!options.method) return new Response(JSON.stringify({ fields: structuredClone(fields), updateTime: `version-${version}` }));
    const params = new URL(url).searchParams;
    assert.deepEqual(params.getAll("updateMask.fieldPaths"), ["profileShowcase"]);
    const data = JSON.parse(String(options.body));
    assert.deepEqual(Object.keys(data.fields), ["profileShowcase"]);
    if (params.get("currentDocument.updateTime") !== `version-${version}`) return new Response("", { status: 409 });
    fields = { ...fields, ...data.fields }; version++; writes++;
    return new Response("{}");
  };
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", "fetch", js.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports, fakeFetch);
  await Promise.all(["first", "second"].map(id => mod.exports.fsMutateSupporterShowcase("owner", "fixture-token",
    (u: any) => ({ ...u.profileShowcase, entries: [...u.profileShowcase.entries, { id }] }))));
  assert.equal(writes, 2);
  const saved = fields.profileShowcase.mapValue.fields.entries.arrayValue.values.map((v: any) => v.mapValue.fields.id.stringValue).sort();
  assert.deepEqual(saved, ["first", "second"]);
  assert.equal(fields.name.stringValue, "Do not replace");
});
