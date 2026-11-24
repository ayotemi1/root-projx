import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

async function fixture() {
  const result = await build({
    stdin: {
      contents: `import express from "express";
        import router from "./src/routes/supporter-posts.js";
        export {state} from "fixture:state";
        export * from "./src/lib/supporter-posts.js";
        export * from "./src/lib/supporter-post-uploads.js";
        export const app=express(); app.use(express.json()); app.use(router);`,
      resolveDir: new URL("../../", import.meta.url).pathname,
    },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{
      name: "supporter-publishing-fixtures", setup(b) {
        b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
          path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname,
        }));
        b.onResolve({ filter: /^zod$/ }, () => ({
          path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname,
        }));
        b.onResolve({ filter: /^fixture:state$/ }, () => ({ path: "state", namespace: "fixture" }));
        b.onResolve({ filter: /(?:^|\/)(auth|firebase-rest|objectStorage)\.js$/ }, a =>
          ({ path: a.path.split("/").pop()!, namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({
          loader: "js", resolveDir: new URL("./", import.meta.url).pathname,
          contents: a.path === "state" ? `
            export const state={docs:new Map(),writes:[],fail:false,failCommit:false,objects:new Map()};
          ` : a.path === "auth.js" ? `
            import{state}from"fixture:state";
            import{organisationAccessDecision}from"./organisation-approval.ts";
            import{fsGet,getServerToken}from"./firebase-rest.js";
            const auth=req=>{ const id=req.headers.authorization?.replace("Bearer ","");
              const user=state.docs.get("users/"+id);
              if(user&&!user.deletedAt)req.user={userId:id,accountType:user.accountType,approvalStatus:user.approvalStatus}; };
            export function optionalAuth(req,res,next){auth(req);next();}
            export function requireAuth(req,res,next){auth(req);if(!req.user)return res.status(401).json({error:"Sign in"});next();}
            export async function requireApprovedOrganisation(req,res,next){
              const decision=organisationAccessDecision(req.user?.accountType,req.user?.approvalStatus);
              if(decision==="allow")return next();
              if(decision==="deny")return res.status(403).json({error:"Organisation approval required"});
              try{
                if(await fsGet("organisations",req.user.userId,await getServerToken()))return next();
                return res.status(403).json({error:"Organisation approval required"});
              }catch{return res.status(503).json({error:"Could not verify organisation approval status"});}
            }
          ` : a.path === "objectStorage.js" ? `
            import {Readable} from "node:stream";import{state}from"fixture:state";
            import {readFile} from "node:fs/promises";
            export const objectStorageClient={bucket:()=>({name:"test-bucket",
              upload:async(local,options)=>{state.objects.set(options.destination,await readFile(local));},
              file:(path)=>({
              getMetadata:async()=>[{size:state.objects.get(path)?.length||4,contentType:"video/mp4",generation:"1"}],
              delete:async()=>{state.objects.delete(path);},
              createReadStream:({start=0,end}={})=>{const data=state.objects.get(path)||Buffer.from("data");return Readable.from(data.subarray(start,end===undefined?data.length:end+1));}
            })})};
            export async function signObjectURL(){return "https://storage.invalid/one-private-upload";}
          ` : `
            import{state}from"fixture:state";
            export const getServerToken=async()=>"server-test";
            export async function fsGet(c,id){if(state.fail)throw Error("private backend detail");return state.docs.get(c+"/"+id)||null;}
            export async function fsQuery(c,filters=[],token,opts){if(state.fail)throw Error("private backend detail");
              return [...state.docs].filter(([key,val])=>key.startsWith(c+"/")&&filters.every(f=>{
                let v=val;for(const s of f.field.split("."))v=v?.[s];return f.op==="EQUAL"?v===f.value:false;
              })).map(([key,val])=>({_id:key.slice(c.length+1),...val}));}
            export async function fsPatch(c,id,data){if(state.fail)throw Error("private backend detail");
              state.docs.set(c+"/"+id,{...state.docs.get(c+"/"+id),...data});state.writes.push({c,id,data});}
            export async function fsDelete(c,id){state.docs.delete(c+"/"+id);}
            export async function fsCompleteSupporterMedia(id,ready){const key="supporter_post_media/"+id;
              const row=state.docs.get(key);if(row?.state==="ready")return row;
              state.docs.set(key,ready);return ready;}
            export async function fsPublishSupporterPost(post,edits){
              if(state.failCommit)throw Error("private commit failure");
              if(state.docs.has("supporter_posts/"+post.id))throw Error("duplicate");
              for(const e of edits){const m=state.docs.get("supporter_post_media/"+e.id);
                if(!m||m.author_id!==post.author_id||m.post_id||m.state!=="ready")throw Error("ownership failure");}
              state.docs.set("supporter_posts/"+post.id,post);
              for(const e of edits){const key="supporter_post_media/"+e.id;state.docs.set(key,{...state.docs.get(key),...e,post_id:post.id});}
              state.writes.push({c:"publication",id:post.id});
            }
          `,
        }));
      },
    }],
  });
  const mod = { exports: {} as any };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(require, mod, mod.exports);
  process.env.SESSION_SECRET = "synthetic-test-only-read-session";
  process.env.PRIVATE_OBJECT_DIR = "/test-bucket/private";
  const api = mod.exports;
  const pub = (id: string, enabled = true) => ({
    accountType: "supporter", name: id, interests: ["Education"],
    publicProfile: { enabled, publicId: `sp_${(id === "alice" ? "a" : "b").repeat(32)}`, displayName: id },
  });
  api.state.docs.set("users/alice", pub("alice"));
  api.state.docs.set("users/bob", pub("bob"));
  api.state.docs.set("users/org", { accountType: "organisation", approvalStatus: "pending" });
  const server = api.app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = async (path: string, user?: string, method = "GET", data?: unknown, extra: Record<string, string> = {}) =>
    fetch(url + path.replace(/^\/api(?=\/)/, ""), { method, headers: { ...(user ? { Authorization: `Bearer ${user}` } : {}),
      "Content-Type": "application/json", ...extra }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const media = (type = "photo") => {
    const id = randomUUID();
    const row = { id, author_id: "alice", post_id: null, state: "ready", type, width: 100, height: 100,
      url: `/api/supporter-posts/media/${id}`, storage_path: `supporter-private/alice/${id}/verified/media`,
      thumbnail_path: `supporter-private/alice/${id}/verified/thumbnail`, content_type: type === "video" ? "video/mp4" : "image/jpeg",
      video_thumbnail_url: type === "video" ? `/api/supporter-posts/media/${id}/thumbnail` : null };
    api.state.docs.set("supporter_post_media/" + id, row);
    return { id, order: 0, crop: { aspect: "1:1", zoom: 1.5, x: 5, y: -5 }, filter: "warm",
      adjustments: { brightness: 1.1, contrast: 0.9, saturation: 1.2 } };
  };
  return { ...api, call, media, close: () => new Promise<void>((resolve, reject) => server.close((e: Error) => e ? reject(e) : resolve())) };
}

test("media routes retain organisation approval checks with the current permission fixture", async () => {
  const f = await fixture();
  try {
    const input = { name: "photo.jpg", contentType: "image/jpeg", size: 4 };
    assert.equal((await f.call("/supporter-posts/uploads/request", undefined, "POST", input)).status, 401);
    assert.equal((await f.call("/supporter-posts/uploads/request", "unknown", "POST", input)).status, 401);
    f.state.docs.set("users/declined-org", { accountType: "organisation", approvalStatus: "declined" });
    f.state.docs.set("users/legacy-org", { accountType: "organisation" });
    for (const user of ["org", "declined-org", "legacy-org"]) {
      assert.equal((await f.call("/supporter-posts/uploads/request", user, "POST", input)).status, 403);
      assert.equal((await f.call("/supporter-posts/uploads/complete", user, "POST", { objectPath: "not-owned" })).status, 403);
    }
    assert.equal(f.state.writes.length, 0, "denied accounts must not stage uploads");
    f.state.docs.set("users/approved-org", { accountType: "organisation", approvalStatus: "approved" });
    const approved = await f.call("/supporter-posts/uploads/request", "approved-org", "POST", input);
    assert.equal(approved.status, 200);
    assert.match((await approved.json() as any).objectPath, /^supporter-pending\/approved-org\//);
    f.state.docs.set("organisations/legacy-org", { name: "Existing legacy organisation" });
    assert.equal((await f.call("/supporter-posts/uploads/request", "legacy-org", "POST", input)).status, 200);
    f.state.fail = true;
    assert.equal((await f.call("/supporter-posts/uploads/request", "legacy-org", "POST", input)).status, 503);
    assert.equal(f.state.writes.length, 2);
  } finally { await f.close(); }
});

test("text publishing rejects blank, long or media-bearing input and saves a retry-safe owner-only/private or public post", async () => {
  const f = await fixture();
  try {
    const input = { id: randomUUID(), type: "text", caption: "A".repeat(500), media: [], tag: null };
    for (const caption of ["", " \n\t ", "A".repeat(501)]) {
      assert.equal((await f.call("/supporter-posts", "alice", "POST", { ...input, caption })).status, 400);
    }
    assert.equal((await f.call("/supporter-posts", "alice", "POST", { ...input, media: [f.media()] })).status, 400);
    assert.equal((await f.call("/supporter-posts", undefined, "POST", input)).status, 401);
    assert.equal((await f.call("/supporter-posts", "org", "POST", input)).status, 403);
    const response = await f.call("/supporter-posts", "alice", "POST", input);
    assert.equal(response.status, 201);
    const post = await response.json() as any;
    assert.equal(post.caption.length, 500);
    assert.equal(post.type, "text");
    assert.deepEqual(post.media, []);
    assert.equal(post.tag, null);
    assert.equal(post.visibility, "public");
    assert.equal((await f.call("/supporter-posts", "alice", "POST", input)).status, 201);
    assert.equal(f.state.writes.filter((w: any) => w.c === "publication").length, 1);
    assert.equal((await (await f.call("/supporter-posts?feed=mine", "alice")).json() as any[]).length, 1);
    f.state.docs.set("supporter_follows/bob_alice", { follower_id: "bob", author_id: "alice" });
    assert.equal((await (await f.call("/supporter-posts?feed=following", "bob")).json() as any[]).length, 1);
    f.state.docs.get("users/alice").publicProfile.enabled = false;
    assert.equal((await (await f.call("/supporter-posts?feed=following", "bob")).json() as any[]).length, 0);
    assert.equal((await (await f.call("/supporter-posts?feed=for-you", "bob")).json() as any[]).length, 0);
    assert.equal((await (await f.call("/supporter-posts?feed=mine", "alice")).json() as any[]).length, 1);
    f.state.fail = true;
    const failed = await f.call("/supporter-posts", "alice", "POST", { ...input, id: randomUUID() });
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), { error: "Something went wrong, please try again" });
  } finally { await f.close(); }
});

test("real tag catalogue and text For you matching use interests, followed places/organisations and prior community choices", async () => {
  const f = await fixture();
  try {
    f.state.docs.set("organisations/school", { name: "Real School", country: "Jamaica", location: "Kingston", category: "Education" });
    f.state.docs.set("organisations/other", { name: "Unfollowed Organisation", country: "United Kingdom" });
    f.state.docs.set("organisations/deleted", { name: "Deleted", country: "Hidden Country", deletedAt: "2026-01-01" });
    for (const id of ["alice", "bob"]) f.state.docs.set(`follows/${id}_school`, { userId: id, orgId: "school" });
    assert.equal((await f.call("/supporter-posts/tags")).status, 401);
    const tags = await (await f.call("/supporter-posts/tags", "alice")).json() as any[];
    assert.equal(tags.filter(t => t.type === "community").length, 5);
    assert.ok(tags.some(t => t.type === "cause" && t.value === "Education"));
    assert.ok(tags.some(t => t.type === "place" && t.value === "jamaica"));
    assert.ok(tags.some(t => t.type === "organisation" && t.value === "school"));
    assert.ok(!tags.some(t => t.value === "other" || t.label === "Hidden Country"));
    const publish = async (tag: unknown, caption: string, user = "alice") => {
      const response = await f.call("/supporter-posts", user, "POST", { id: randomUUID(), type: "text", caption, tag, media: [] });
      assert.equal(response.status, 201);
      return await response.json() as any;
    };
    const school = await publish({ type: "organisation", value: "school", label: "Forged label" }, "Organisation");
    assert.equal(school.tag.label, "Real School");
    assert.equal(school.community_tag, "Real School");
    assert.equal(school.organisation_id, "school");
    assert.equal((await f.call("/supporter-posts", "alice", "POST", {
      id: randomUUID(), type: "text", caption: "Conflicting organisation", media: [],
      tag: { type: "organisation", value: "school" }, organisation_id: "other",
    })).status, 400);
    await publish({ type: "cause", value: "Education" }, "Matching cause");
    await publish({ type: "cause", value: "Environment" }, "Wrong cause");
    await publish({ type: "place", value: "jamaica" }, "Matching place");
    await publish({ type: "community", value: "volunteers" }, "Community");
    for (const tag of [
      { type: "community", value: "invented" }, { type: "organisation", value: "other" },
      { type: "place", value: "atlantis" }, { type: "cause", value: "invented" },
    ]) {
      assert.equal((await f.call("/supporter-posts", "alice", "POST", { id: randomUUID(), type: "text", caption: "Invalid tag", media: [], tag })).status, 400);
    }
    const feed = async () => await (await f.call("/supporter-posts?feed=for-you", "bob")).json() as any[];
    let captions = (await feed()).map(p => p.caption);
    assert.deepEqual(new Set(captions), new Set(["Organisation", "Matching cause", "Matching place"]));
    f.state.docs.get("follows/bob_school").orgId = "SCHOOL";
    assert.ok(!(await feed()).some(p => p.caption === "Organisation"), "organisation IDs must remain case-sensitive");
    f.state.docs.get("follows/bob_school").orgId = "school";
    const choice = await publish({ type: "community", value: "volunteers" }, "My own choice", "bob");
    assert.ok((await feed()).some(p => p.caption === "Community"));
    await f.call(`/supporter-posts/${choice.id}`, "bob", "DELETE");
    assert.ok(!(await feed()).some(p => p.caption === "Community"), "removed posts must not supply a community preference");
    f.state.docs.get("users/alice").publicProfile.enabled = false;
    assert.deepEqual(await feed(), [], "tag relevance must never override current author privacy");
  } finally { await f.close(); }
});

test("supporter publishing: owned ordered media, visibility, feeds, retry and direct media access", async () => {
  const f = await fixture();
  try {
    const selected = [f.media(), f.media(), f.media()].map((m: any, order) => ({ ...m, order }));
    const input = { id: randomUUID(), type: "photo", caption: "My caption stays", community_tag: "Education", media: selected };
    let response = await f.call("/supporter-posts", "alice", "POST", input);
    assert.equal(response.status, 201);
    const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
    const published = await response.json() as any;
    assert.equal(published.caption, input.caption);
    assert.equal(published.author.name, "alice");
    assert.equal(published.visibility, "public");
    assert.deepEqual(published.media.map((m: any) => m.id), selected.map((m: any) => m.id));
    assert.deepEqual(published.media[0].crop, selected[0]!.crop);
    assert.equal(published.media[0].filter, "warm");
    assert.equal(published.media[2].post_id, input.id);
    response = await f.call("/supporter-posts", "alice", "POST", input);
    assert.equal(response.status, 201, "lost response retries safely");
    assert.equal(f.state.writes.filter((w: any) => w.c === "publication").length, 1);
    assert.equal((await (await f.call("/supporter-posts?feed=mine", "alice")).json() as any[]).length, 1);
    assert.equal((await (await f.call("/supporter-posts?feed=for-you", "bob")).json() as any[]).length, 1);
    f.state.docs.get("users/bob").interests = ["Conservation"];
    assert.equal((await (await f.call("/supporter-posts?feed=for-you", "bob")).json() as any[]).length, 0);
    f.state.docs.get("users/bob").interests = ["Education"];
    assert.equal((await (await f.call("/supporter-posts?feed=following", "bob")).json() as any[]).length, 0);
    response = await f.call("/supporter-posts/follows/sp_" + "a".repeat(32), "bob", "POST");
    assert.equal(response.status, 200);
    assert.equal((await (await f.call("/supporter-posts?feed=following", "bob")).json() as any[]).length, 1);
    const publicMedia = await f.call(published.media[0].url);
    assert.equal(publicMedia.status, 200);
    assert.equal(await publicMedia.text(), "data");
    f.state.docs.get("users/alice").publicProfile.enabled = false;
    assert.equal((await (await f.call("/supporter-posts?feed=following", "bob")).json() as any[]).length, 0);
    assert.equal((await (await f.call("/supporter-posts?feed=for-you", "bob")).json() as any[]).length, 0);
    assert.equal((await (await f.call("/supporter-posts?feed=mine", "alice")).json() as any[])[0].visibility, "private");
    assert.equal((await f.call(published.media[0].url)).status, 404);
    assert.equal((await f.call(published.media[0].url, "bob")).status, 404);
    response = await f.call(published.media[0].url, undefined, "GET", undefined, { Cookie: cookie });
    assert.equal(response.status, 200, "owner's scoped cookie authorises private img/video");
    assert.match(response.headers.get("cache-control")!, /no-store/);
    assert.equal(await response.text(), "data");
    response = await f.call(published.media[0].url, "alice", "GET", undefined, { Range: "bytes=1-2" });
    assert.equal(response.status, 206); assert.equal(await response.text(), "at");
    assert.equal((await f.call(published.media[0].url, "alice", "GET", undefined, { Range: "bytes=8-9" })).status, 416);
    assert.equal((await f.call("/supporter-posts/" + input.id, "bob", "DELETE")).status, 404);
    assert.equal((await f.call("/supporter-posts/" + input.id, "alice", "DELETE")).status, 204);
    assert.equal((await f.call(published.media[0].url, "alice")).status, 404, "removed media cannot be read even by owner");
  } finally { await f.close(); }
});

test("supporter publishing rejects unowned, duplicate and unready media, and hides internal errors", async () => {
  const f = await fixture();
  try {
    const media = f.media();
    const input = { id: randomUUID(), type: "photo", caption: "", media: [media] };
    assert.equal((await f.call("/supporter-posts", undefined, "POST", input)).status, 401);
    assert.equal((await f.call("/supporter-posts", "org", "POST", input)).status, 403);
    assert.equal((await f.call("/supporter-posts", "bob", "POST", input)).status, 400);
    assert.equal((await f.call("/supporter-posts", "alice", "POST", { ...input, media: [media, { ...media, order: 1 }] })).status, 400);
    f.state.docs.get("supporter_post_media/" + media.id).state = "pending";
    assert.equal((await f.call("/supporter-posts", "alice", "POST", input)).status, 400);
    f.state.docs.get("supporter_post_media/" + media.id).state = "ready";
    f.state.failCommit = true;
    let response = await f.call("/supporter-posts", "alice", "POST", input);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Something went wrong, please try again" });
    assert.equal(f.state.docs.get("supporter_post_media/" + media.id).post_id, null);
    f.state.failCommit = false;
    response = await f.call("/supporter-posts", "alice", "POST", input);
    assert.equal(response.status, 201, "same retained draft can be retried");
    assert.equal((await f.call("/supporter-posts", "alice", "POST", { ...input, id: randomUUID() })).status, 400);
    f.state.fail = true;
    response = await f.call("/supporter-posts?feed=mine", "alice");
    assert.deepEqual(await response.json(), { error: "Something went wrong, please try again" });
  } finally { await f.close(); }
});

test("supporter upload validation accepts requested formats and exact size limits only", async () => {
  const f = await fixture();
  try {
    for (const contentType of ["image/jpeg", "image/png", "image/heic", "image/heif", "video/mp4", "video/quicktime"]) {
      assert.doesNotThrow(() => f.validateUpload({ name: "source", contentType, size: contentType.startsWith("video") ? 500 * 1024 * 1024 : 20 * 1024 * 1024 }));
    }
    assert.throws(() => f.validateUpload({ name: "file", contentType: "text/html", size: 100 }), /JPG, PNG or HEIC/);
    assert.throws(() => f.validateUpload({ name: "photo", contentType: "image/jpeg", size: 20 * 1024 * 1024 + 1 }), /20 MB/);
    assert.throws(() => f.validateUpload({ name: "video", contentType: "video/mp4", size: 500 * 1024 * 1024 + 1 }), /500 MB/);
    assert.throws(() => f.validateUpload({ name: "empty", contentType: "image/jpeg", size: 0 }), /empty/);
    const video = f.media("video");
    const input = { id: randomUUID(), type: "video", caption: "A video", media: [video] };
    const response = await f.call("/supporter-posts", "alice", "POST", input);
    assert.equal(response.status, 201);
    const post = await response.json() as any;
    assert.equal(post.media[0].type, "video");
    assert.match(post.media[0].video_thumbnail_url, /thumbnail$/);
    const session = await f.call("/supporter-posts/media-session", undefined, "DELETE");
    assert.equal(session.status, 204);
    assert.match(session.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
  } finally { await f.close(); }
});

test("real media inspection handles JPEG, MP4, MOV and HEIC, and rejects oversized-duration and disguised files", async () => {
  const f = await fixture();
  try {
    const cases = [
      { name: "photo.jpg", type: "image/jpeg", bytes: execFileSync("magick", ["-size", "40x30", "xc:yellow", "jpg:-"]) },
      { name: "phone.heic", type: "image/heic", bytes: execFileSync("magick", ["-size", "40x30", "xc:yellow", "heic:-"], { maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }) },
      { name: "video.mp4", type: "video/mp4", bytes: execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=s=80x60:r=5:d=1",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-f", "mp4", "-movflags", "frag_keyframe+empty_moov", "pipe:1"]) },
      { name: "phone.mov", type: "video/quicktime", bytes: execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=s=80x60:r=5:d=1",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-f", "mov", "-movflags", "frag_keyframe+empty_moov", "pipe:1"]) },
    ];
    for (const file of cases) {
      const pending = await f.requestPostUpload("alice", { name: file.name, size: file.bytes.length, contentType: file.type });
      f.state.objects.set(pending.objectPath, file.bytes);
      const complete = await f.completePostUpload("alice", pending.objectPath);
      assert.ok(complete.width > 0 && complete.height > 0);
      assert.match(complete.url, /^\/api\/supporter-posts\/media\//);
      assert.equal(complete.type, file.type.startsWith("video") ? "video" : "photo");
      assert.equal(complete.post_id, null, "upload is still not a published post");
      if (complete.type === "video") {
        assert.ok(complete.duration <= 600);
        assert.ok(complete.video_thumbnail_url);
        assert.equal(f.state.docs.get("supporter_post_media/" + complete.id).content_type, "video/mp4");
      }
      const again = await f.completePostUpload("alice", pending.objectPath);
      assert.equal(again.id, complete.id, "completion retries reuse the ready media");
      await assert.rejects(() => f.completePostUpload("bob", pending.objectPath));
    }
    const long = execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=s=40x30:r=1:d=601",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-f", "mp4", "-movflags", "frag_keyframe+empty_moov", "pipe:1"]);
    const pending = await f.requestPostUpload("alice", { name: "long.mp4", contentType: "video/mp4", size: long.length });
    f.state.objects.set(pending.objectPath, long);
    await assert.rejects(() => f.completePostUpload("alice", pending.objectPath), /10 minutes/);
    const bad = await f.requestPostUpload("alice", { name: "bad.jpg", contentType: "image/jpeg", size: 20 });
    f.state.objects.set(bad.objectPath, Buffer.from("<html>not a JPG</html>"));
    await assert.rejects(() => f.completePostUpload("alice", bad.objectPath));
  } finally { await f.close(); }
});
