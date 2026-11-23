import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

async function harness() {
  const bundle = await build({
    stdin: { contents: `import express from "express";import router from "../routes/messaging.ts";
      import {state} from "messaging-fixture";const app=express();app.use(express.json());app.use("/api",router);export{app,state};`, resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "messaging-fixtures", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname }));
      b.onResolve({ filter: /^zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname }));
      b.onResolve({ filter: /^messaging-fixture$|firebase-rest\.js$/ }, () => ({ path: "fixture", namespace: "fixture" }));
      b.onResolve({ filter: /\/lib\/auth\.js$/ }, () => ({ path: "auth", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
        contents: args.path === "auth" ? `export function requireAuth(req,res,next){const key=req.headers.authorization?.slice(7);
          if(!["alice","bob","staff","org","otherorg"].includes(key)){res.status(401).json({error:"Sign in required"});return}
          req.user={userId:key,email:key+"@example.test",accountType:key.includes("org")?"organisation":"supporter",approvalStatus:"approved"};next();}` :
          `export const state={docs:new Map(),calls:[],queues:new Map(),fail:false,failBefore:false,loseResponse:false};
          export const getServerToken=async()=>"server-fixture";
          export const fsGet=async(c,id,t)=>{if(state.fail)throw Error("PRIVATE_MESSAGE_BODY");state.calls.push({c,id,t});return structuredClone(state.docs.get(c+"/"+id)||null)};
          export const fsQuery=async(c,filters,t)=>{if(state.fail)throw Error("PRIVATE_MESSAGE_BODY");state.calls.push({c,filters,t});
            return [...state.docs.entries()].filter(([k,v])=>k.startsWith(c+"/")&&filters.every(f=>{const x=f.field.split(".").reduce((o,k)=>o?.[k],v);return f.op==="ARRAY_CONTAINS"?x?.includes(f.value):x===f.value})).map(([k,v])=>({...structuredClone(v),_id:k.slice(c.length+1)}));};
          export const fsCreateIfAbsent=async(c,id,data)=>{if(state.fail)throw Error("PRIVATE_MESSAGE_BODY");if(state.docs.has(c+"/"+id))return false;state.docs.set(c+"/"+id,structuredClone(data));return true};
          export const fsMutateMessaging=async(c,id,t,decide,mid)=>{const key=c+"/"+id;const previous=state.queues.get(key)||Promise.resolve();let release;
            const current=new Promise(r=>release=r);state.queues.set(key,current);await previous;
            try{if(state.failBefore||state.fail)throw Error("PRIVATE_MESSAGE_BODY");
              const plan=decide(structuredClone(state.docs.get(key)||null),structuredClone(state.docs.get("conversation_messages/"+mid)||null));
              if(plan.patch)state.docs.set(key,{...(state.docs.get(key)||{}),...structuredClone(plan.patch)});
              if(plan.message){if(state.docs.has("conversation_messages/"+mid))throw Error("immutable");state.docs.set("conversation_messages/"+mid,structuredClone(plan.message))}
              if(state.loseResponse){state.loseResponse=false;throw Error("PRIVATE_MESSAGE_BODY")}return plan.result;
            }finally{release()}};`
      }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const { app, state } = mod.exports;
  for (const uid of ["alice", "bob", "staff", "org", "otherorg"]) {
    state.docs.set(`users/${uid}`, { name: uid, email: `${uid}@example.test`, accountType: uid.includes("org") ? "organisation" : "supporter", approvalStatus: "approved" });
  }
  state.docs.set("organisations/org", { name: "Test organisation", team: [{ userId: "bob", role: "owner" }] });
  state.docs.set("organisations/otherorg", { name: "Unrelated organisation" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/messaging`;
  async function call(who: string, path: string, method = "GET", data?: unknown) {
    const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${who}`, "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: r.status, headers: r.headers, body: await r.json() as any };
  }
  const start = async (who = "alice") => (await call(who, "/conversations", "POST", { orgId: "org" })).body;
  const send = (who: string, cid: string, text: string, key: string, orgId?: string) =>
    call(who, `/conversations/${cid}/messages`, "POST", { text, clientId: key.padEnd(20, "_"), orgId });
  return { state, call, start, send, close: () => new Promise<void>(r => server.close(() => r())) };
}

test("messaging: real round trip, one thread per pair, private DTOs, persistent independent unread cursors", async () => {
  const h = await harness();
  try {
    const c = await h.start();
    assert.equal(c.side, "supporter");
    assert.equal((await h.start()).id, c.id);
    assert.equal(h.state.docs.size, 8);
    assert.equal((await h.call("org", "/conversations")).body.conversations.length, 0, "an empty composer is not an incoming message");
    const sent = await h.send("alice", c.id, " Can I help? ", "first");
    assert.equal(sent.status, 200); assert.equal(sent.body.text, "Can I help?"); assert.equal(sent.body.side, "supporter");
    assert.equal((await h.send("alice", c.id, "Can I help?", "first")).body.id, sent.body.id);
    assert.equal((await h.send("alice", c.id, "Different text", "first")).status, 409);
    const orgInbox = await h.call("org", "/conversations");
    assert.equal(orgInbox.body.unreadCount, 1);
    assert.equal(orgInbox.body.conversations[0].name, "alice");
    assert.match(orgInbox.headers.get("cache-control")!, /private.*no-store/);
    assert.doesNotMatch(JSON.stringify(orgInbox.body), /example.test|senderId|supporterId|memberIds/);
    const messages = await h.call("org", `/messages?conversationId=${c.id}&orgId=org`);
    assert.equal(messages.body.readThrough, 1);
    assert.equal((await h.call("org", "/context")).body.unreadCount, 1, "GET does not clear unread");
    await h.call("org", `/conversations/${c.id}/read`, "POST", { through: 1, orgId: "org" });
    assert.equal((await h.call("org", "/context")).body.unreadCount, 0);
    await h.send("org", c.id, "Yes, tell us more.", "reply", "org");
    assert.equal((await h.call("alice", "/context")).body.unreadCount, 1);
    const own = await h.call("alice", `/messages?conversationId=${c.id}`);
    assert.deepEqual(own.body.messages.map((m: any) => m.side), ["supporter", "organisation"]);
    assert.equal(own.body.readThrough, 1);
    await h.call("alice", `/conversations/${c.id}/read`, "POST", { through: 1 });
    assert.equal((await h.call("alice", "/conversations")).body.unreadCount, 0);
    assert.equal((await h.call("org", "/conversations")).body.unreadCount, 0);
    assert.equal(h.state.docs.get(`conversations/${c.id}`).supporterRead, 1);
  } finally { await h.close(); }
});

test("messaging: unrelated users, public team names and self-claimed roles never grant access", async () => {
  const h = await harness();
  try {
    const c = await h.start(); await h.send("alice", c.id, "Private text", "private");
    h.state.docs.get("users/bob").organisationRoles = { org: "owner" };
    for (const who of ["bob", "otherorg"]) {
      assert.equal((await h.call(who, `/messages?conversationId=${c.id}`)).status, 404);
      assert.equal((await h.send(who, c.id, "Spoof", "spoof")).status, 404);
      assert.equal((await h.call(who, `/conversations/${c.id}/read`, "POST", { through: 999 })).status, 404);
      assert.equal((await h.call(who, "/conversations?orgId=org")).status, 404);
      assert.equal((await h.call(who, "/access/org")).status, 404);
      assert.equal((await h.call(who, "/access/org", "POST", { userId: "bob" })).status, 404);
    }
    assert.equal((await h.call("bob", "/context")).body.unreadCount, 0);
    assert.equal((await h.call("bob", "/conversations")).body.conversations.length, 0);
    assert.equal((await h.call("unknown", "/context")).status, 401);
    assert.equal((await h.call("org", "/conversations", "POST", { orgId: "otherorg" })).status, 403);
    assert.equal((await h.call("alice", `/messages?conversationId=${c.id}&orgId=otherorg`)).status, 404);
  } finally { await h.close(); }
});

test("messaging: owner-managed staff can reply on behalf, cannot manage team, lose access on revocation", async () => {
  const h = await harness();
  try {
    const c = await h.start(); await h.send("alice", c.id, "Hello team", "hello");
    assert.equal((await h.call("org", "/access/org", "POST", { email: "staff@example.test" })).status, 400, "email is not an identity grant");
    assert.equal((await h.call("org", "/access/org", "POST", { userId: "staff" })).status, 200);
    const context = (await h.call("staff", "/context")).body;
    assert.equal(context.personal, true);
    assert.equal(context.organisations[0].canManageTeam, false);
    assert.equal(context.organisations[0].unreadCount, 1);
    assert.equal((await h.call("staff", "/access/org", "POST", { userId: "bob" })).status, 404);
    assert.equal((await h.send("staff", c.id, "We can help.", "staff-reply", "org")).body.side, "organisation");
    const ownStaffThread = await h.start("staff");
    assert.equal((await h.send("staff", ownStaffThread.id, "Personal", "personal")).body.side, "supporter");
    assert.equal((await h.send("staff", ownStaffThread.id, "Personal", "personal", "org")).status, 409, "the same attempt cannot change sender side");
    assert.equal((await h.send("staff", ownStaffThread.id, "For the organisation", "on-behalf", "org")).body.side, "organisation");
    assert.equal((await h.call("org", "/access/org/staff", "DELETE")).status, 200);
    assert.equal((await h.call("staff", `/messages?conversationId=${c.id}&orgId=org`)).status, 404);
    assert.equal((await h.send("staff", c.id, "Revoked", "revoked", "org")).status, 404);
    assert.equal((await h.call("staff", `/messages?conversationId=${ownStaffThread.id}`)).status, 200, "personal history remains theirs");
  } finally { await h.close(); }
});

test("messaging: failed and ambiguous sends retain server consistency and idempotent retry", async () => {
  const h = await harness();
  try {
    const c = await h.start();
    h.state.failBefore = true;
    const failed = await h.send("alice", c.id, "Keep this draft", "retry");
    assert.equal(failed.status, 503);
    assert.doesNotMatch(JSON.stringify(failed.body), /PRIVATE_MESSAGE_BODY|Keep this draft/);
    assert.equal(h.state.docs.get(`conversations/${c.id}`).lastSequence, 0);
    h.state.failBefore = false; h.state.loseResponse = true;
    assert.equal((await h.send("alice", c.id, "Keep this draft", "retry")).status, 503);
    assert.equal((await h.send("alice", c.id, "Keep this draft", "retry")).status, 200);
    assert.equal(h.state.docs.get(`conversations/${c.id}`).lastSequence, 1);
    assert.equal((await h.call("org", "/context")).body.unreadCount, 1);
    h.state.fail = true;
    const unreadable = await h.call("alice", "/conversations");
    assert.equal(unreadable.status, 503); assert.equal(unreadable.body.conversations, undefined);
    assert.doesNotMatch(JSON.stringify(unreadable.body), /PRIVATE_MESSAGE_BODY/);
  } finally { await h.close(); }
});

test("messaging: pagination retains history; read cursors never regress or clear future incoming messages", async () => {
  const h = await harness();
  try {
    const c = await h.start();
    await h.send("org", c.id, "An earlier reply", "old-reply", "org");
    await Promise.all(Array.from({ length: 55 }, (_, i) => h.send("alice", c.id, `Message ${i}`, `batch-${i}`)));
    const page = (await h.call("alice", `/messages?conversationId=${c.id}`)).body;
    assert.equal(page.messages.length, 50); assert.equal(page.hasMore, true); assert.equal(page.readThrough, 1);
    const earlier = (await h.call("alice", `/messages?conversationId=${c.id}&beforeSequence=${page.nextBeforeSequence}`)).body;
    assert.equal(earlier.messages.length, 6); assert.equal(earlier.hasMore, false);
    assert.equal(new Set([...earlier.messages, ...page.messages].map(m => m.sequence)).size, 56);
    await h.call("org", `/conversations/${c.id}/read`, "POST", { through: 9999, orgId: "org" });
    assert.equal((await h.call("org", "/context")).body.unreadCount, 0);
    await h.send("alice", c.id, "After read", "after-read");
    await h.call("org", `/conversations/${c.id}/read`, "POST", { through: 1, orgId: "org" });
    assert.equal((await h.call("org", "/context")).body.unreadCount, 1);
  } finally { await h.close(); }
});

test("messaging: message validation, actor spoofing, removed organisations and declined owners fail closed", async () => {
  const h = await harness();
  try {
    h.state.docs.get("organisations/org").name = "";
    const c = await h.start();
    assert.equal(c.name, "Organisation", "incomplete organisation names have a usable fallback");
    for (const text of ["", "   ", "x".repeat(2001)]) assert.equal((await h.send("alice", c.id, text, "invalid")).status, 400);
    const sent = await h.call("alice", `/conversations/${c.id}/messages`, "POST", {
      text: "<script>alert('plain text')</script>", clientId: "spoof".padEnd(20, "_"), side: "organisation", senderId: "org",
    });
    assert.equal(sent.body.side, "supporter"); assert.match(sent.body.text, /<script>/);
    const unicode = `${"x".repeat(179)}😀 tail`;
    assert.equal((await h.send("alice", c.id, unicode, "unicode")).status, 200);
    assert.equal(h.state.docs.get(`conversations/${c.id}`).lastMessage, `${"x".repeat(179)}😀`, "preview truncation never splits a valid Unicode character");
    h.state.docs.get("users/org").approvalStatus = "declined";
    assert.equal((await h.call("org", `/messages?conversationId=${c.id}`)).status, 404);
    assert.equal((await h.start("bob")).id, undefined);
    h.state.docs.get("users/org").approvalStatus = "approved"; h.state.docs.get("organisations/org").deletedAt = "2026-01-01";
    const kept = (await h.call("alice", `/messages?conversationId=${c.id}`)).body;
    assert.equal(kept.conversation.canSend, false); assert.equal(kept.messages.length, 2);
    assert.equal((await h.send("alice", c.id, "Unavailable", "deleted")).status, 404);
  } finally { await h.close(); }
});

test("messaging: all participant directions, canonical pairs, explicit team context and private recipient protection", async () => {
  const h = await harness();
  const aid = `sp_${"a".repeat(32)}`, bid = `sp_${"b".repeat(32)}`;
  h.state.docs.get("users/alice").publicProfile = { enabled: true, publicId: aid };
  h.state.docs.get("users/bob").publicProfile = { enabled: true, publicId: bid };
  const start = (who: string, kind: string, id: string, asOrgId?: string) =>
    h.call(who, "/conversations", "POST", { recipient: { kind, id }, asOrgId });
  try {
    const pp = await start("alice", "supporter", bid);
    assert.equal(pp.status, 200);
    assert.equal(pp.body.participantLabel, "Supporter");
    assert.equal(pp.body.peerHref, `/supporters/${bid}`);
    assert.equal((await start("bob", "supporter", aid)).body.id, pp.body.id);
    assert.equal((await h.send("alice", pp.body.id, "Personal hello", "personal-hello")).status, 200);
    assert.equal((await h.call("bob", "/conversations")).body.unreadCount, 1);
    assert.equal((await h.call("org", `/messages?conversationId=${pp.body.id}`)).status, 404);
    assert.equal((await start("alice", "supporter", aid)).status, 400);
    h.state.docs.get("users/bob").publicProfile.enabled = false;
    assert.equal((await start("alice", "supporter", bid)).status, 404, "hidden supporters cannot be discovered through start");
    assert.equal((await h.call("bob", `/messages?conversationId=${pp.body.id}`)).status, 200, "hiding profile does not erase a participant's private history");
    const oo = await start("org", "organisation", "otherorg");
    assert.equal(oo.status, 200);
    assert.equal(oo.body.participantLabel, "Organisation");
    assert.equal((await start("otherorg", "organisation", "org")).body.id, oo.body.id);
    assert.equal((await h.send("org", oo.body.id, "Organisation hello", "org-hello")).status, 200);
    assert.equal((await h.call("otherorg", "/context")).body.unreadCount, 1);
    assert.equal((await start("alice", "organisation", "otherorg", "org")).status, 404, "cannot spoof organisation sender");
    const op = await start("org", "supporter", aid);
    assert.equal(op.status, 200);
    assert.equal(op.body.id, (await h.start()).id, "org-initiated pair reopens legacy supporter/org ID");
    assert.equal((await h.send("org", op.body.id, "We would like to connect", "org-initiates")).status, 200);
    const legacy = h.state.docs.get(`conversations/${op.body.id}`);
    delete legacy.participants; delete legacy.participantKeys; delete legacy.initiatorKey;
    assert.equal((await start("org", "supporter", aid)).body.id, op.body.id, "new requests reopen an unmigrated legacy document");
    assert.equal((await h.call("alice", `/messages?conversationId=${op.body.id}`)).status, 200);
    assert.equal((await h.send("alice", op.body.id, "Legacy reply", "legacy-reply")).status, 200);
    await h.call("org", "/access/org", "POST", { userId: "staff" });
    assert.equal((await start("staff", "organisation", "otherorg", "org")).body.id, oo.body.id);
    assert.equal((await h.send("staff", oo.body.id, "Without context", "no-scope")).status, 404);
    assert.equal((await h.send("staff", oo.body.id, "On behalf", "scoped", "org")).status, 200);
    await h.call("org", "/access/org/staff", "DELETE");
    for (const operation of [
      () => h.call("staff", `/messages?conversationId=${oo.body.id}&orgId=org`),
      () => h.send("staff", oo.body.id, "Revoked", "revoked-new", "org"),
      () => h.call("staff", `/conversations/${oo.body.id}/read`, "POST", { through: 999, orgId: "org" }),
      () => start("staff", "organisation", "otherorg", "org"),
    ]) assert.equal((await operation()).status, 404);
    assert.equal((await h.call("alice", "/conversations")).body.conversations.length, 2);
  } finally { await h.close(); }
});

test("messaging storage: versioned atomic commits prevent lost counters, duplicate messages and partial writes", async () => {
  const bundled = await build({
    stdin: { contents: `export {fsMutateMessaging} from "./firebase-rest.ts";`, resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", bundled.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const mutate = mod.exports.fsMutateMessaging;
  const originalFetch = globalThis.fetch;
  const docs = new Map<string, any>([["conversations/test", { fields: { lastSequence: { integerValue: "0" } }, updateTime: "v1" }]]);
  let revision = 1, conflicts = 0, commits = 0;
  let failCommit = false, badVersion = false;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    if (String(url).endsWith(":commit")) {
      const { writes } = JSON.parse(init!.body as string);
      if (failCommit) return new Response("PROVIDER_PRIVATE_DETAIL", { status: 503 });
      for (const write of writes) {
        const key = write.update.name.split("/documents/")[1];
        const existing = docs.get(key);
        assert.ok(write.currentDocument?.updateTime || write.currentDocument?.exists === false);
        if (write.currentDocument.exists === false ? existing : write.currentDocument.updateTime !== existing?.updateTime) {
          conflicts++; return new Response("conflict", { status: 409 });
        }
      }
      assert.ok(writes.length === 1 || writes.length === 2);
      for (const write of writes) {
        const key = write.update.name.split("/documents/")[1];
        docs.set(key, { fields: { ...(docs.get(key)?.fields ?? {}), ...write.update.fields }, updateTime: `v${++revision}` });
      }
      commits++; return new Response("{}");
    }
    const key = String(url).split("/documents/")[1];
    const raw = structuredClone(docs.get(key));
    // Both concurrent callers can read the same old version before either commits.
    await new Promise<void>(r => setImmediate(r));
    if (!raw) return new Response("not found", { status: 404 });
    if (badVersion && key.startsWith("conversations/")) delete raw.updateTime;
    return new Response(JSON.stringify(raw));
  }) as typeof fetch;
  const first = `m_${"a".repeat(43)}`, second = `m_${"b".repeat(43)}`;
  const send = (mid: string) => mutate("conversations", "test", "fixture-token", (current: any, existing: any) => {
    if (existing) return { result: existing.sequence };
    const sequence = current.lastSequence + 1;
    return { patch: { lastSequence: sequence }, message: { conversationId: "test", sequence, text: "Synthetic test text" }, result: sequence };
  }, mid);
  try {
    const results = await Promise.all([send(first), send(second)]);
    assert.deepEqual([...results].sort(), [1, 2]);
    assert.ok(conflicts >= 1);
    assert.equal(docs.get("conversations/test").fields.lastSequence.integerValue, "2");
    assert.equal(docs.size, 3);
    const beforeRetry = commits;
    assert.equal(await send(first), 1);
    assert.equal(commits, beforeRetry);
    failCommit = true;
    await assert.rejects(send(`m_${"c".repeat(43)}`), /Could not save private messaging record/);
    assert.equal(docs.size, 3); assert.equal(docs.get("conversations/test").fields.lastSequence.integerValue, "2");
    failCommit = false; badVersion = true;
    await assert.rejects(send(`m_${"d".repeat(43)}`), /Invalid messaging record version/);
    await assert.rejects(mutate("donations", "test", "fixture-token", () => ({ patch: { amount: 0 }, result: null })), /Invalid messaging collection/);
    await assert.rejects(mutate("conversations", "../other", "fixture-token", () => ({ result: null })), /Invalid messaging record/);
  } finally { globalThis.fetch = originalFetch; }
});
