import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

async function harness() {
  const compiled = await build({
    stdin: { contents: `import express from "express";import router from "../routes/bookmarks.ts";import{state}from"bookmark-fixture";const app=express();app.use(express.json());app.use("/api",router);export{app,state};`,
      resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
    plugins: [{ name: "bookmarks-fixture", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname }));
      b.onResolve({ filter: /^zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname }));
      b.onResolve({ filter: /^bookmark-fixture$|firebase-rest\.js$/ }, () => ({ path: "db", namespace: "fixture" }));
      b.onResolve({ filter: /\/lib\/auth\.js$/ }, () => ({ path: "auth", namespace: "fixture" }));
      b.onResolve({ filter: /supporter-posts\.js$/ }, () => ({ path: "posts", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({
        resolveDir: new URL(".", import.meta.url).pathname,
        contents: a.path === "auth" ? `export function requireAuth(req,res,next){const id=req.headers.authorization?.slice(7);if(!["owner","other","org"].includes(id)){res.status(401).json({error:"Sign in"});return}req.user={userId:id,accountType:id==="org"?"organisation":"supporter"};next()}export function requireApprovedOrganisation(req,res,next){next();}` :
        a.path === "campaign" ? `export function campaignSharePath(o,c){return{sharePath:"/campaigns/test-org/test-campaign"}}` :
        a.path === "posts" ? `export {canSeePost,postDto,POSTS,PostError,POST_ERROR} from ${JSON.stringify(new URL("./supporter-posts.ts", import.meta.url).pathname)};export function setMediaSession(){}` :
        `export const state={docs:new Map(),fail:false};export const getServerToken=async()=>"server";
         export async function fsGet(c,id){if(state.fail)throw Error("RAW_PRIVATE_DATA");const d=state.docs.get(c+"/"+id);return c==="organisations"&&d?.deletedAt?null:structuredClone(d??null)}
         export async function fsQuery(){return[]}
         export async function fsMutateSupporterShowcase(uid,t,decide){if(state.fail)throw Error("RAW_PRIVATE_DATA");const u=state.docs.get("users/"+uid);u.profileShowcase=decide(structuredClone(u))}`
      }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const { app, state } = mod.exports;
  state.docs.set("users/owner", { accountType: "supporter", name: "Owner", profileShowcase: { location: "Keep this", entries: [{ id: "keep" }] } });
  state.docs.set("users/other", { accountType: "supporter", name: "Other", publicProfile: { enabled: true, publicId: `sp_${"a".repeat(32)}` } });
  state.docs.set("supporter_posts/p", { id: "p", author_id: "other", caption: "Public caption", type: "text", created_at: "2026-11-23", media_ids: [] });
  state.docs.set("organisations/org", { name: "Org", campaigns: [
    { _id: "c", name: "Public campaign", enabled: true, imageUrl: "https://example.test/campaign.jpg", editorDraft: { name: "SECRET_DRAFT" } },
    { _id: "disabled", name: "SECRET_DISABLED", enabled: false },
  ] });
  state.docs.set("updates/u", { orgId: "org", content: "Real update", mediaUrls: ["https://example.test/image.jpg"] });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  return { state, close: () => new Promise<void>(r => server.close(() => r())), async call(who: string, path = "", method = "GET", body?: unknown) {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/bookmarks${path}`, { method,
      headers: { Authorization: `Bearer ${who}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, headers: r.headers, data: r.status === 204 ? null : await r.json() as any };
  } };
}

test("bookmarks: private durable references, all types, safe current projections and idempotent removal", async () => {
  const h = await harness();
  try {
    const p = await h.call("owner", "", "POST", { kind: "post", targetId: "p" });
    assert.equal(p.status, 200);
    assert.equal((await h.call("owner", "", "POST", { kind: "post", targetId: "p" })).data.id, p.data.id);
    assert.equal((await h.call("owner")).data.length, 1);
    assert.equal((await h.call("other")).data.length, 0);
    assert.match((await h.call("owner")).headers.get("cache-control")!, /private.*no-store/);
    assert.match(p.data.href, /^\/supporters\/sp_.*\?post=p$/);
    const u = await h.call("owner", "", "POST", { kind: "update", targetId: "u", orgId: "ignored-spoof" });
    assert.equal(u.status, 200);
    assert.equal(u.data.href, "/feed?post=u");
    h.state.docs.set("updates/video", { orgId: "org", content: "Real video", mediaUrls: ["https://example.test/clip.mp4"] });
    const v = await h.call("owner", "", "POST", { kind: "update", targetId: "video" });
    assert.equal(v.data.imageUrl, null);
    assert.equal(v.data.videoUrl, "https://example.test/clip.mp4");
    assert.equal(v.data.isVideo, true);
    await h.call("owner", `/${v.data.id}`, "DELETE");
    const c = await h.call("owner", "", "POST", { kind: "campaign", targetId: "c", orgId: "org" });
    assert.equal(c.status, 200);
    assert.equal(c.data.href, "/campaign/org-org/public-campaign-c");
    assert.doesNotMatch(JSON.stringify(c.data), /SECRET_DRAFT/);
    assert.equal((await h.call("owner", "", "POST", { kind: "campaign", targetId: "disabled", orgId: "org" })).status, 404);
    const owner = h.state.docs.get("users/owner");
    assert.equal(owner.profileShowcase.location, "Keep this");
    assert.equal(owner.profileShowcase.entries.length, 1);
    assert.doesNotMatch(JSON.stringify(owner.profileShowcase.bookmarks), /caption|mediaUrls|image\.jpg|Public campaign/);
    await h.call("other", `/${p.data.id}`, "DELETE");
    assert.equal((await h.call("owner")).data.length, 3, "another account cannot delete the reference");
    h.state.docs.get("users/other").publicProfile.enabled = false;
    const hidden = (await h.call("owner")).data.find((b: any) => b.id === p.data.id);
    assert.equal(hidden.available, false);
    assert.equal(hidden.title, ""); assert.equal(hidden.imageUrl, null); assert.equal(hidden.href, null);
    h.state.docs.get("updates/u").status = "archived";
    h.state.docs.get("organisations/org").campaigns[0].enabled = false;
    assert.ok((await h.call("owner")).data.every((b: any) => !b.available));
    await h.call("owner", `/${p.data.id}`, "DELETE");
    await h.call("owner", `/${p.data.id}`, "DELETE");
    assert.equal((await h.call("owner")).data.length, 2);
  } finally { await h.close(); }
});

test("bookmarks: owner-private posts, role enforcement, validation and non-raw failures", async () => {
  const h = await harness();
  try {
    h.state.docs.get("supporter_posts/p").author_id = "owner";
    const own = await h.call("owner", "", "POST", { kind: "post", targetId: "p" });
    assert.equal(own.status, 200);
    assert.equal(own.data.href, "/profile?post=p");
    assert.equal((await h.call("other", "", "POST", { kind: "post", targetId: "p" })).status, 404);
    assert.equal((await h.call("unknown")).status, 401);
    assert.equal((await h.call("org")).status, 403);
    h.state.docs.get("users/owner").profileShowcase.bookmarks.push(
      { kind: "update", targetId: "../users/other", id: "forged", createdAt: "2026-11-23" },
      { kind: "campaign", orgId: "../private", targetId: "c", id: "forged", createdAt: "2026-11-23" },
    );
    assert.equal((await h.call("owner")).data.length, 1, "stored references are validated as carefully as requests");
    for (const body of [{ kind: "post", targetId: "../users" }, { kind: "campaign", targetId: "c" },
      { kind: "post", targetId: "p", author_id: "other" }]) assert.equal((await h.call("owner", "", "POST", body)).status, 400);
    h.state.fail = true;
    const fail = await h.call("owner");
    assert.equal(fail.status, 503);
    assert.equal(fail.data.error, "Something went wrong, please try again");
    assert.doesNotMatch(JSON.stringify(fail.data), /RAW_PRIVATE/);
  } finally { await h.close(); }
});
