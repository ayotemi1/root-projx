import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

process.env.SESSION_SECRET = "supporter-account-unit-test-only";
process.env.PRIVATE_OBJECT_DIR = "/unit-bucket/private";
process.env.NODE_ENV = "test";

async function fixture() {
  const bundle = await build({
    stdin: { contents: `import express from "express";import router from "../routes/supporter-account.ts";
      import {state} from "account-fixture";const app=express();app.use(express.json());app.use(router);export{app,state};`, resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true, platform: "node", format: "cjs", write: false, packages: "external",
    plugins: [{ name: "account-fixture", setup(b) {
      b.onResolve({ filter: /^account-fixture$/ }, () => ({ path: "state", namespace: "account-fixture" }));
      b.onLoad({ filter: /.*/, namespace: "account-fixture" }, () => ({ contents: `export const state={docs:new Map(),files:new Map(),fail:false};` }));
      b.onResolve({ filter: /\/lib\/auth\.js$/ }, () => ({ path: "auth", namespace: "fake-account" }));
      b.onResolve({ filter: /firebase-rest\.js$/ }, () => ({ path: "firebase", namespace: "fake-account" }));
      b.onResolve({ filter: /objectStorage\.js$/ }, () => ({ path: "storage", namespace: "fake-account" }));
      b.onResolve({ filter: /supporter-posts\.js$/ }, () => ({ path: "media", namespace: "fake-account" }));
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname }));
      b.onResolve({ filter: /^zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname }));
      b.onLoad({ filter: /.*/, namespace: "fake-account" }, a => ({ contents:
        a.path === "auth" ? `import{state}from"account-fixture";export function requireAuth(req,res,next){
          const uid=req.headers.authorization?.replace("Bearer ",""),u=state.docs.get("users/"+uid);
          if(!u)return res.status(401).json({error:"Sign in"});req.user={userId:uid,email:uid+"@account.invalid",accountType:u.accountType};next();}` :
        a.path === "media" ? `export function mediaViewer(req){return req.headers["x-media-user"]||null}export function setMediaSession(){}` :
        a.path === "storage" ? `import{state}from"account-fixture";import{Readable}from"node:stream";export const objectStorageClient={bucket:()=>({file:path=>({
          save:async(bytes,opts)=>state.files.set(path,{bytes,metadata:opts.metadata}),exists:async()=>[state.files.has(path)],
          getMetadata:async()=>[state.files.get(path).metadata],delete:async()=>{state.files.delete(path)},
          createReadStream:()=>Readable.from(state.files.get(path).bytes)})})};` :
        `import{state}from"account-fixture";export const getServerToken=async()=>"server";
          export const fsGet=async(c,id)=>state.docs.has(c+"/"+id)?{...structuredClone(state.docs.get(c+"/"+id)),_id:id}:null;
          export const fsQuery=async(c,filters)=>[...state.docs].filter(([k,v])=>k.startsWith(c+"/")&&filters.every(f=>{
            const value=f.field.split(".").reduce((x,p)=>x?.[p],v);return f.op==="ARRAY_CONTAINS"?Array.isArray(value)&&value.includes(f.value):value===f.value;
          })).map(([k,v])=>({...structuredClone(v),_id:k.slice(c.length+1)}));
          export const fsMutateSupporterAccount=async(uid,t,decide)=>{if(state.fail)throw Error("PRIVATE_PROVIDER_BODY");
            const current=state.docs.get("users/"+uid);if(current.accountType!=="supporter")throw Error("No");
            state.docs.set("users/"+uid,{...current,...decide(structuredClone(current))});};
          export const fsCreateIfAbsent=async()=>{throw Error("not used")};
          export const fsMutateMessaging=async()=>{throw Error("not used")};`
      }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const { app, state } = mod.exports;
  state.docs.set("users/alice", { name: "Alice", email: "UNTRUSTED_EMAIL", accountType: "supporter", publicProfile: { enabled: false },
    profileShowcase: { entries: [{ id: "keep-involvement" }], bookmarks: [{ id: "keep-bookmark" }] }, financialPrivateField: "keep-financial" });
  state.docs.set("users/bob", { name: "Bob", accountType: "supporter" });
  state.docs.set("users/eve", { name: "Eve", accountType: "supporter" });
  state.docs.set("users/org", { name: "Org", accountType: "organisation", approvalStatus: "approved" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path = "/supporter/account", options: { who?: string | null; method?: string; body?: unknown; form?: FormData; media?: string } = {}) => {
    const who = options.who === undefined ? "alice" : options.who;
    const response = await fetch(base + path.replace(/^\/api(?=\/)/, ""), { method: options.method || "GET",
      headers: { ...(who ? { Authorization: `Bearer ${who}` } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.media ? { "x-media-user": options.media } : {}) },
      body: options.form || (options.body ? JSON.stringify(options.body) : undefined),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const data = response.headers.get("content-type")?.includes("application/json") ? JSON.parse(bytes.toString()) : bytes;
    return { status: response.status, data, headers: response.headers };
  };
  return { state, call, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}
const profile = { displayName: "Alice New", location: "London", bio: "A short bio" };
const png = (size = 400) => execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `color=c=yellow:s=${size}x${size}`,
  "-frames:v", "1", "-threads", "1", "-f", "image2pipe", "-c:v", "png", "pipe:1"]);
const imageForm = (bytes: Buffer, type = "image/png") => {
  const form = new FormData(); form.append("file", new Blob([new Uint8Array(bytes)], { type }), "avatar.png"); return form;
};

test("supporter settings persist individual controls, keep mandatory receipts and never expose private account metadata", async () => {
  const f = await fixture();
  try {
    const get = await f.call();
    assert.equal(get.status, 200);
    assert.equal(get.data.email, "alice@account.invalid");
    assert.equal(get.data.visibility, "private");
    assert.equal(get.data.messagePolicy, "followed");
    assert.equal(get.data.notifications.receipts.email, true);
    assert.doesNotMatch(JSON.stringify(get.data), /proof|financial|UNTRUSTED_EMAIL|keep-bookmark/);
    assert.match(get.headers.get("cache-control")!, /private, no-store/);
    const set = (body: unknown) => f.call("/supporter/account/settings", { method: "PATCH", body });
    assert.equal((await set({ messagePolicy: "replies" })).status, 200);
    await set({ notification: { category: "updates", channel: "inApp", enabled: false } });
    await set({ notification: { category: "messages", channel: "email", enabled: false } });
    await set({ visibility: "public" });
    const actual = (await f.call()).data;
    assert.equal(actual.messagePolicy, "replies");
    assert.equal(actual.notifications.updates.inApp, false);
    assert.equal(actual.notifications.messages.email, false);
    assert.equal(actual.visibility, "public");
    const publicId = f.state.docs.get("users/alice").publicProfile.publicId;
    assert.match(publicId, /^sp_[a-f0-9]{32}$/);
    await set({ visibility: "private" });
    assert.equal(f.state.docs.get("users/alice").publicProfile.publicId, publicId);
    assert.equal((await set({ notification: { category: "receipts", channel: "email", enabled: false } })).status, 400);
    assert.equal((await set({ visibility: "public", messagePolicy: "replies" })).status, 400);
    assert.equal((await set({ approvalStatus: "approved" })).status, 400);
    assert.equal((await f.call(undefined, { who: null })).status, 401);
    assert.equal((await f.call(undefined, { who: "org" })).status, 403);
    const stored = f.state.docs.get("users/alice");
    assert.equal(stored.financialPrivateField, "keep-financial");
    assert.equal(stored.profileShowcase.bookmarks[0].id, "keep-bookmark");
    assert.equal(stored.profileShowcase.entries[0].id, "keep-involvement");
  } finally { await f.close(); }
});

test("profile saves validate name and bio, preserve privacy and unrelated data, and return only friendly failures", async () => {
  const f = await fixture();
  try {
    const save = (body: unknown) => f.call("/supporter/account/profile", { method: "PATCH", body });
    assert.equal((await save({ ...profile, displayName: "  " })).data.error, "Add a display name");
    assert.equal((await save({ ...profile, bio: "b".repeat(161) })).data.error, "Keep your bio to 160 characters");
    assert.equal((await save({ ...profile, userId: "bob" })).status, 400);
    const saved = await save({ ...profile, location: " London " });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.displayName, profile.displayName);
    assert.equal(saved.data.location, "London");
    assert.equal(saved.data.avatarInitials, "AN");
    assert.equal(saved.data.visibility, "private");
    assert.equal((await f.call()).data.bio, profile.bio);
    assert.equal(f.state.docs.get("users/alice").profileShowcase.entries[0].id, "keep-involvement");
    f.state.fail = true;
    const failed = await save({ ...profile, displayName: "Do not save" });
    assert.equal(failed.status, 503);
    assert.equal(failed.data.error, "Something went wrong, please try again");
    assert.doesNotMatch(JSON.stringify(failed.data), /PRIVATE_PROVIDER_BODY/);
    assert.equal(f.state.docs.get("users/alice").name, "Alice New");
  } finally { await f.close(); }
});

test("real JPG/PNG processing stages privately, enforces ownership, and revokes public access when hidden or removed", async () => {
  const f = await fixture();
  try {
    const small = await f.call("/supporter/account/photo", { method: "POST", form: imageForm(png(100)) });
    assert.equal(small.status, 400); assert.equal(small.data.error, "That photo is too small");
    const spoof = await f.call("/supporter/account/photo", { method: "POST", form: imageForm(Buffer.from("not an image")) });
    assert.equal(spoof.status, 400);
    const uploaded = await f.call("/supporter/account/photo", { method: "POST", form: imageForm(png()) });
    assert.equal(uploaded.status, 200);
    const { photoId, previewUrl } = uploaded.data;
    assert.equal((await f.call(previewUrl, { who: null })).status, 404);
    assert.equal((await f.call(previewUrl, { who: null, media: "alice" })).status, 200);
    assert.equal((await f.call(previewUrl, { who: null, media: "bob" })).status, 404);
    const wrongOwner = await f.call("/supporter/account/profile", { who: "bob", method: "PATCH", body: { ...profile, photoId } });
    assert.equal(wrongOwner.status, 404);
    await f.call("/supporter/account/profile", { method: "PATCH", body: { ...profile, photoId } });
    await f.call("/supporter/account/settings", { method: "PATCH", body: { visibility: "public" } });
    const publicImage = await f.call(previewUrl, { who: null });
    assert.equal(publicImage.status, 200); assert.equal(publicImage.headers.get("content-type"), "image/jpeg");
    assert.match(publicImage.headers.get("cache-control")!, /no-store/);
    assert.equal(publicImage.data[0], 255); assert.equal(publicImage.data[1], 216);
    await f.call("/supporter/account/settings", { method: "PATCH", body: { visibility: "private" } });
    assert.equal((await f.call(previewUrl, { who: null })).status, 404);
    f.state.docs.set("conversations/real-history", { participants: {
      supporter: { kind: "supporter", id: "alice" }, organisation: { kind: "supporter", id: "bob" },
    }, participantKeys: ["supporter:alice", "supporter:bob"], supporterSent: 1, lastSequence: 1 });
    assert.equal((await f.call(previewUrl, { who: null, media: "bob" })).status, 200);
    assert.equal((await f.call(previewUrl, { who: null, media: "eve" })).status, 404);
    f.state.docs.set("organisations/org", { name: "Private chat organisation" });
    f.state.docs.set("conversations/org-history", { participants: {
      supporter: { kind: "supporter", id: "alice" }, organisation: { kind: "organisation", id: "org" },
    }, participantKeys: ["supporter:alice", "organisation:org"], supporterSent: 1, lastSequence: 1 });
    assert.equal((await f.call(previewUrl, { who: null, media: "org" })).status, 200);
    f.state.docs.get("users/org").approvalStatus = "pending";
    assert.equal((await f.call(previewUrl, { who: null, media: "org" })).status, 404);
    await f.call("/supporter/account/profile", { method: "PATCH", body: { ...profile, photoId: null } });
    assert.equal((await f.call()).data.avatarUrl, null);
    assert.equal((await f.call(previewUrl, { who: null, media: "bob" })).status, 404);
    assert.equal((await f.call(`/supporter/account/photo/${photoId}`, { method: "DELETE", who: "bob" })).status, 404);
    assert.equal((await f.call(`/supporter/account/photo/${photoId}`, { method: "DELETE" })).status, 204);
    assert.equal((await f.call(previewUrl, { who: null, media: "alice" })).status, 404);
  } finally { await f.close(); }
});

test("account compare-and-write merges concurrent form, preference and bookmark changes without privileged-field writes", async () => {
  const js = await build({
    stdin: { contents: 'export {fsMutateSupporterAccount} from "./firebase-rest.ts";', resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  });
  let version = 0, writes = 0;
  let fields: any = {
    accountType: { stringValue: "supporter" }, name: { stringValue: "Before" }, approvalStatus: { stringValue: "unchanged" },
    profileShowcase: { mapValue: { fields: { bookmarks: { arrayValue: { values: [] } } } } },
  };
  const fakeFetch = async (url: string, options: RequestInit = {}) => {
    if (!options.method) return new Response(JSON.stringify({ fields: structuredClone(fields), updateTime: `v-${version}` }));
    const params = new URL(url).searchParams, body = JSON.parse(String(options.body));
    const mask = params.getAll("updateMask.fieldPaths");
    assert.ok(mask.every(k => ["name", "profileShowcase"].includes(k)));
    assert.deepEqual(Object.keys(body.fields).sort(), mask.sort());
    if (params.get("currentDocument.updateTime") !== `v-${version}`) return new Response("", { status: 412 });
    fields = { ...fields, ...body.fields }; version++; writes++;
    return new Response("{}");
  };
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", "fetch", js.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports, fakeFetch);
  const mutate = (decide: (u: any) => any) => mod.exports.fsMutateSupporterAccount("owner", "unit-token", decide);
  await Promise.all([
    mutate(u => ({ name: "After", profileShowcase: { ...u.profileShowcase, location: "London" } })),
    mutate(u => ({ profileShowcase: { ...u.profileShowcase, settings: { messagePolicy: "replies" } } })),
    mutate(u => ({ profileShowcase: { ...u.profileShowcase, bookmarks: [...u.profileShowcase.bookmarks, { id: "saved" }] } })),
  ]);
  assert.equal(writes, 3);
  const showcase = fields.profileShowcase.mapValue.fields;
  assert.equal(showcase.location.stringValue, "London");
  assert.equal(showcase.settings.mapValue.fields.messagePolicy.stringValue, "replies");
  assert.equal(showcase.bookmarks.arrayValue.values[0].mapValue.fields.id.stringValue, "saved");
  assert.equal(fields.name.stringValue, "After");
  assert.equal(fields.approvalStatus.stringValue, "unchanged");
  await assert.rejects(mutate(() => ({ approvalStatus: "approved" })), /Invalid account field/);
  assert.equal(writes, 3);
});
