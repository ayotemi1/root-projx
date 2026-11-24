import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

test("organisation content persists links with media, derives ownership, and keeps the full library public", async () => {
  const state = { writes: [] as Record<string, unknown>[], notifications: [] as unknown[][], posts: Array.from({ length: 35 }, (_, i) => ({
    _id: `post-${i}`, orgId: "org-owner", title: `Post ${i}`,
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    mediaUrls: ["https://media.example.test/clip.mp4"],
    externalUrl: "https://instagram.com/reel/abc/",
  })) };
  (globalThis as any).contentRouteState = state;
  const result = await build({
    entryPoints: [new URL("../routes/feed.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "content-boundaries", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname,
      }));
      b.onResolve({ filter: /^zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname,
      }));
      b.onResolve({ filter: /\/(auth|firebase-rest|supporter-notification-events)\.js$/ }, args => ({
        path: args.path.split("/").at(-1)!, namespace: "mock",
      }));
      b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({
        loader: "js", resolveDir: new URL("./", import.meta.url).pathname, contents: args.path === "auth.js" ? `
          import {organisationAccessDecision} from "./organisation-approval.ts";
          const identities={
            owner:{userId:"org-owner",accountType:"organisation",approvalStatus:"approved"},
            pending:{userId:"org-pending",accountType:"organisation",approvalStatus:"pending"},
            declined:{userId:"org-declined",accountType:"organisation",approvalStatus:"declined"},
            supporter:{userId:"supporter",accountType:"supporter"}
          };
          export const requireAuth=(req,res,next)=>{
            const identity=identities[req.headers.authorization?.replace(/^Bearer /,"")];
            if(!identity) return res.status(401).json({error:"Unauthorized"});
            req.user={...identity}; next();
          };
          export const requireApprovedOrganisation=(req,res,next)=>{
            if(organisationAccessDecision(req.user?.accountType,req.user?.approvalStatus)!=="allow")
              return res.status(403).json({error:"Organisation approval required"});
            next();
          };
          export const optionalAuth=(req,res,next)=>next();
        ` : args.path === "supporter-notification-events.js" ? `
          export const emailOrganisationUpdate=async(...args)=>{globalThis.contentRouteState.notifications.push(args);};
        ` : `
          export const getServerToken=async()=>"mock-server";
          export const fsGet=async(collection,id)=>{
            if(collection==="organisations"&&id==="org-owner") return {name:"Real organisation"};
            if(collection==="users"&&id==="org-owner") return {accountType:"organisation",approvalStatus:"approved"};
            return null;
          };
          export const fsPatch=async()=>{};
          // These operations are used by cover/pin routes, not by this plain-post fixture.
          export const fsMutateSupporterShowcase=async()=>{throw Error("Unexpected showcase mutation");};
          export const fsPublishSupporterPost=async()=>{throw Error("Unexpected cover publication");};
          export const fsQuery=async(collection,filters,token,options)=>{
            if(collection!=="updates" || (filters.length && filters[0].value!=="org-owner")) throw Error("Wrong scope");
            if(options?.limit) throw Error("Posts silently truncated");
            return [...globalThis.contentRouteState.posts];
          };
          export const fsCreate=async(collection,data)=>{
            if(collection!=="updates") throw Error("Wrong collection");
            globalThis.contentRouteState.writes.push(data); return "new-post";
          };
        `,
      }));
    }}],
  });
  const require = createRequire(import.meta.url);
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(require, mod, mod.exports);
  const app = require("express")();
  app.use(require("express").json());
  app.use((req: any, _res: any, next: () => void) => {
    req.log = { error() {}, warn() {} }; next();
  });
  app.use(mod.exports.default);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body: object, identity: string | false = "owner") => fetch(`${base}/feed`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(identity ? { Authorization: `Bearer ${identity}` } : {}) },
    body: JSON.stringify(body),
  });
  try {
    const body = { title: "Our work", content: "A day in the community", type: "update",
      mediaUrls: ["https://media.example.test/clip.mp4"],
      externalUrl: "https://www.instagram.com/reel/abc/?igsh=tracking", orgId: "another-org" };
    assert.equal((await post(body, false)).status, 401);
    for (const identity of ["pending", "declined", "supporter"]) {
      assert.equal((await post(body, identity)).status, 403);
    }
    assert.equal((await post({ ...body, externalUrl: "javascript:alert(1)" })).status, 400);
    assert.equal(state.writes.length, 0);
    const response = await post(body);
    assert.equal(response.status, 201);
    const saved = await response.json() as any;
    assert.equal(saved.orgId, "org-owner");
    assert.equal(saved.orgName, "Real organisation");
    assert.equal(saved.externalUrl, "https://www.instagram.com/reel/abc/");
    assert.deepEqual(saved.mediaUrls, body.mediaUrls);
    assert.equal(state.writes.length, 1);
    assert.equal((await post({ title: "Text only", content: "An update", type: "update" })).status, 201);
    assert.equal(state.writes[1]!.externalUrl, null);
    assert.equal((await post({ mediaUrls: ["https://media.example.test/device-video.mp4"] })).status, 201);
    assert.equal(state.writes[2]!.title, "");
    assert.equal(state.writes[2]!.content, "");
    assert.equal(state.writes[2]!.type, "update"); // Existing records remain compatible.
    assert.equal((await post({ content: "An ordinary post, not a progress update." })).status, 201);
    assert.equal((await post({ externalUrl: "https://instagram.com/reel/abc/" })).status, 201);
    assert.equal((await post({ title: "", content: "  ", mediaUrls: [] })).status, 400);
    const publicResponse = await fetch(`${base}/feed/org/org-owner`);
    assert.equal(publicResponse.status, 200);
    const library = await publicResponse.json() as any[];
    assert.equal(library.length, 35);
    assert.equal(library[0]._id, "post-34");
    assert.equal(library[0].externalUrl, state.posts[0]!.externalUrl);
    const liveFeed = await fetch(`${base}/feed/public`);
    assert.equal(liveFeed.status, 200);
    assert.equal((await liveFeed.json() as any[]).length, 35);
    assert.equal(state.notifications.length, state.writes.length);
    assert.ok(state.notifications.every(args => args[0] === "org-owner" && args[1] === "Real organisation"));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => err ? reject(err) : resolve()));
    delete (globalThis as any).contentRouteState;
  }
});
