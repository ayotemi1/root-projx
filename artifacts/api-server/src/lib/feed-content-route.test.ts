import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

test("organisation content persists links with media, derives ownership, and keeps the full library public", async () => {
  const state = { writes: [] as Record<string, unknown>[], posts: Array.from({ length: 35 }, (_, i) => ({
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
      b.onResolve({ filter: /\/(auth|firebase-rest)\.js$/ }, args => ({
        path: args.path.split("/").at(-1)!, namespace: "mock",
      }));
      b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({
        loader: "js", contents: args.path === "auth.js" ? `
          export const requireAuth=(req,res,next)=>{
            if(req.headers.authorization!=="Bearer owner") return res.status(401).json({error:"Unauthorized"});
            req.user={userId:"org-owner",accountType:"organisation"}; next();
          };
          export const requireApprovedOrganisation=(req,res,next)=>next();
          export const optionalAuth=(req,res,next)=>next();
        ` : `
          export const getServerToken=async()=>"mock-server";
          export const fsGet=async()=>({name:"Real organisation"});
          export const fsPatch=async()=>{};
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
  const post = (body: object, authorised = true) => fetch(`${base}/feed`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(authorised ? { Authorization: "Bearer owner" } : {}) },
    body: JSON.stringify(body),
  });
  try {
    const body = { title: "Our work", content: "A day in the community", type: "update",
      mediaUrls: ["https://media.example.test/clip.mp4"],
      externalUrl: "https://www.instagram.com/reel/abc/?igsh=tracking", orgId: "another-org" };
    assert.equal((await post(body, false)).status, 401);
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
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => err ? reject(err) : resolve()));
    delete (globalThis as any).contentRouteState;
  }
});
