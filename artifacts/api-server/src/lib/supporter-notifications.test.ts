import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

async function fixture() {
  const bundle = await build({
    stdin: { contents: `import express from "express";import router from "./src/routes/supporter-notifications.js";
      export{state}from"fixture:state";export{notificationId}from"./src/lib/supporter-notifications.js";
      export const app=express();app.use(express.json());app.use((req,res,next)=>{req.log={error(){}};next()});app.use(router);`,
      resolveDir: new URL("../../", import.meta.url).pathname },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "notification-fixture", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname }));
      b.onResolve({ filter: /^zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname }));
      b.onResolve({ filter: /^fixture:state$/ }, () => ({ path: "state", namespace: "fixture" }));
      b.onResolve({ filter: /\/(auth|firebase-rest)\.js$/ }, a => ({ path: a.path.endsWith("auth.js") ? "auth" : "storage", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ loader: "js", contents:
        a.path === "state" ? `export const state={docs:new Map(),calls:[],writes:[],fail:false,failMark:false,mix:false};` :
        a.path === "auth" ? `import{state}from"fixture:state";export function requireAuth(req,res,next){const id=req.headers.authorization?.replace("Bearer ","");
          if(!id)return res.sendStatus(401);req.user={userId:id,accountType:id==="org"?"organisation":"supporter"};next();}
          export function requireApprovedOrganisation(req,res,next){if(state.docs.get("users/"+req.user.userId)?.approvalStatus!=="approved")return res.sendStatus(403);next();}` :
        `import{state}from"fixture:state";export const getServerToken=async()=>"server";
        export const fsGet=async(c,id,token)=>{if(state.fail)throw Error("PRIVATE_INTERNAL_SECRET");state.calls.push({c,id,token});return state.docs.get(c+"/"+id)||null};
        export const fsQuery=async(c,filters,token)=>{if(state.fail)throw Error("PRIVATE_INTERNAL_SECRET");state.calls.push({c,filters,token});
          return [...state.docs.entries()].filter(([k,v])=>k.startsWith(c+"/")&&(state.mix&&c==="donations"||filters.every(f=>f.op==="ARRAY_CONTAINS"?Array.isArray(v[f.field])&&v[f.field].includes(f.value):v[f.field]===f.value))).map(([k,v])=>({...v,_id:k.slice(c.length+1)}));};
        export const fsMarkSupporterNotificationRead=async(uid,id,token)=>{if(state.failMark)throw Error("PRIVATE_INTERNAL_SECRET");
          state.writes.push({uid,id,token});const user=state.docs.get("users/"+uid);user.notificationReads=[...new Set([...(user.notificationReads||[]),id])];};`
      }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const { app, state, notificationId } = mod.exports;
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path = "/supporter-notifications", who: string | null = "alice", method = "GET") => {
    const response = await fetch(base + path, { method, headers: who ? { Authorization: `Bearer ${who}` } : {} });
    const raw = await response.text();
    return { status: response.status, data: raw.startsWith("{") ? JSON.parse(raw) : raw, headers: response.headers };
  };
  state.docs.set("users/alice", { accountType: "supporter" });
  state.docs.set("users/bob", { accountType: "supporter" });
  state.docs.set("users/org", { accountType: "organisation", approvalStatus: "approved" });
  state.docs.set("organisations/org", { name: "Own organisation" });
  state.docs.set("organisations/school", { name: "School", logo: "/logo.png" });
  state.docs.set("organisations/removed", { name: "Removed", deletedAt: "2026-01-01" });
  state.docs.set("follows/alice_school", { userId: "alice", orgId: "school", createdAt: "2026-11-01T00:00:00Z" });
  state.docs.set("follows/alice_removed", { userId: "alice", orgId: "removed" });
  for (const [id, data] of Object.entries({
    published: { createdAt: "2026-11-20T15:00:00Z", title: "A real post", type: "image", mediaUrls: ["/api/uploads/object/a.jpg"] },
    beforeFollow: { createdAt: "2026-10-01T15:00:00Z" },
    archived: { createdAt: "2026-11-20T14:00:00Z", status: "archived" },
    deleted: { createdAt: "2026-11-20T14:00:00Z", status: "deleted" },
    draft: { createdAt: "2026-11-20T14:00:00Z", status: "draft" },
  })) state.docs.set(`updates/${id}`, { orgId: "school", ...data });
  state.docs.set("updates/removedOrg", { orgId: "removed", createdAt: "2026-11-20T00:00:00Z" });
  state.docs.set("donations/own", { userId: "alice", orgName: "School", amountGbp: 12, currency: "usd",
    receiptAccounting: { amountGbp: 15, chargedGbp: 16 }, status: "succeeded", createdAt: "2026-11-21T15:00:00Z",
    guestEmail: "PRIVATE_INTERNAL_SECRET", stripeRef: "PRIVATE_INTERNAL_SECRET" });
  state.docs.set("donations/other", { userId: "bob", orgName: "BOBS_PRIVATE_GIFT", amountGbp: 99, status: "succeeded", createdAt: "2026-11-21T16:00:00Z" });
  state.docs.set("donations/pending", { userId: "alice", status: "pending", createdAt: "2026-11-21T16:00:00Z" });
  return { state, call, notificationId, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

test("notifications derive real published posts and own successful gifts, never leak donor data, and keep persistent recipient read state", async () => {
  const f = await fixture();
  try {
    const result = await f.call();
    assert.equal(result.status, 200);
    assert.match(result.headers.get("cache-control")!, /private, no-store/);
    assert.equal(result.data.unreadCount, 2);
    assert.deepEqual(result.data.items.map((n: any) => n.type), ["donation", "organisation_post"]);
    assert.match(result.data.items[0].message, /US\$15\.00/);
    assert.doesNotMatch(JSON.stringify(result.data), /PRIVATE_INTERNAL_SECRET|BOBS_PRIVATE_GIFT|chargedGbp|stripeRef/);
    assert.equal(result.data.items[1].thumbnailUrl, "/api/uploads/object/a.jpg");
    assert.equal(result.data.items[1].href, "/feed?post=published");
    assert.equal(result.data.items[0].href, "/giving-history#donation-own");
    const ownId = result.data.items[0].id;
    const read = await f.call(`/supporter-notifications/${ownId}/read`, "alice", "POST");
    assert.equal(read.status, 200); assert.equal(read.data.unreadCount, 1);
    assert.equal((await f.call()).data.items[0].read, true, "survives a fresh request/session");
    await f.call(`/supporter-notifications/${ownId}/read`, "alice", "POST");
    assert.equal(f.state.writes.length, 1, "already-read action is idempotent");
    assert.deepEqual(f.state.writes[0], { uid: "alice", id: ownId, token: "server" });
    assert.equal((await f.call(`/supporter-notifications/${ownId}/read`, "bob", "POST")).status, 404);
    assert.equal((await f.call()).data.unreadCount, 1);
    assert.ok(f.state.calls.some((c: any) => c.c === "donations" && c.token === "alice" && c.filters[0].value === "alice"));
    f.state.mix = true;
    assert.doesNotMatch(JSON.stringify((await f.call()).data), /BOBS_PRIVATE_GIFT/);
    assert.equal((await f.call(`/supporter-notifications/${f.notificationId("donation", "other")}/read`, "alice", "POST")).status, 404);
    f.state.docs.delete("follows/alice_school");
    assert.deepEqual((await f.call()).data.items.map((n: any) => n.type), ["donation"], "unfollowed org posts disappear");
  } finally { await f.close(); }
});

test("notification preferences gate bell items and new personal message events are recipient-private and follow Inbox read state", async () => {
  const f = await fixture();
  try {
    const user = f.state.docs.get("users/alice");
    user.profileShowcase = { settings: { notifications: { updates: { inApp: false }, receipts: { inApp: false } } } };
    f.state.docs.set("conversations/own", {
      participantKeys: ["supporter:alice", "organisation:school"],
      participants: { supporter: { kind: "supporter", id: "alice" }, organisation: { kind: "organisation", id: "school" } },
      supporterLastIncoming: { recipientUid: "alice", messageId: "real-message", incomingIndex: 1, name: "School",
        createdAt: "2026-11-22T10:00:00Z", avatarUrl: "/logo.png" }, supporterRead: 0,
    });
    f.state.docs.set("conversations/malformed", {
      participantKeys: ["supporter:alice"],
      participants: { supporter: { kind: "supporter", id: "bob" }, organisation: { kind: "organisation", id: "school" } },
      supporterLastIncoming: { recipientUid: "alice", messageId: "DO_NOT_EXPOSE", name: "NOT_ALICE",
        incomingIndex: 1, createdAt: "2026-11-22T10:00:00Z" },
    });
    const messages = await f.call();
    assert.equal(messages.status, 200);
    assert.equal(messages.data.items.length, 1);
    assert.equal(messages.data.items[0].type, "message");
    assert.equal(messages.data.items[0].href, "/inbox?conversation=own");
    assert.equal(messages.data.unreadCount, 1);
    assert.doesNotMatch(JSON.stringify(messages.data), /NOT_ALICE|DO_NOT_EXPOSE/);
    f.state.docs.get("conversations/own").supporterRead = 1;
    assert.equal((await f.call()).data.unreadCount, 0);
    user.profileShowcase.settings.notifications.messages = { inApp: false };
    assert.equal((await f.call()).data.items.length, 0);
  } finally { await f.close(); }
});

test("notification auth, absent IDs, failed storage and failed marking never report false empty success or leak raw errors", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call(undefined, null)).status, 401);
    assert.equal((await f.call(undefined, "org")).status, 200);
    assert.equal((await f.call("/supporter-notifications/not-valid/read", "alice", "POST")).status, 404);
    f.state.failMark = true;
    const read = await f.call(`/supporter-notifications/${f.notificationId("donation", "own")}/read`, "alice", "POST");
    assert.equal(read.status, 503); assert.doesNotMatch(JSON.stringify(read.data), /PRIVATE_INTERNAL_SECRET/);
    assert.equal((await f.call()).data.unreadCount, 2, "failed marking stays unread");
    f.state.fail = true;
    const unavailable = await f.call();
    assert.equal(unavailable.status, 503); assert.equal(unavailable.data.items, undefined);
    assert.doesNotMatch(JSON.stringify(unavailable.data), /PRIVATE_INTERNAL_SECRET/);
  } finally { await f.close(); }
});

test("organisation bell uses only its real donations and follows, respects private followers and persists individual reads", async () => {
  const f = await fixture();
  try {
    f.state.docs.set("donations/org-gift", { orgId: "org", userId: "bob", amountGbp: 12, currency: "usd",
      receiptAccounting: { amountGbp: 15 }, status: "succeeded", createdAt: "2026-11-22T12:00:00Z", donorEmail: "PRIVATE_DONOR" });
    f.state.docs.set("donations/unrelated-org", { orgId: "school", amountGbp: 99, status: "succeeded", createdAt: "2026-11-22T14:00:00Z", campaignName: "PRIVATE_OTHER_CAMPAIGN" });
    f.state.docs.get("users/alice").publicProfile = { enabled: false, displayName: "PRIVATE_FOLLOWER" };
    f.state.docs.get("users/alice").avatarUrl = "/api/PRIVATE_AVATAR";
    f.state.docs.set("follows/alice_org", { userId: "alice", orgId: "org", createdAt: "2026-11-22T13:00:00Z" });
    f.state.mix = true; // Deliberately over-broad storage response; defend again in the loader.
    const inbox = await f.call(undefined, "org");
    assert.equal(inbox.status, 200); assert.equal(inbox.data.items.length, 2); assert.equal(inbox.data.unreadCount, 2);
    assert.deepEqual(inbox.data.items.map((n: any) => n.type), ["follower", "donation"]);
    assert.match(inbox.data.items[1].message, /\$15\.00/);
    assert.doesNotMatch(JSON.stringify(inbox.data), /PRIVATE_DONOR|PRIVATE_OTHER_CAMPAIGN|PRIVATE_FOLLOWER|PRIVATE_AVATAR|BOBS_PRIVATE_GIFT/);
    assert.equal((await f.call(`/supporter-notifications/${f.notificationId("organisation_donation", "unrelated-org")}/read`, "org", "POST")).status, 404);
    const id = inbox.data.items[0].id;
    assert.equal((await f.call(`/supporter-notifications/${id}/read`, "org", "POST")).data.unreadCount, 1);
    assert.equal((await f.call(undefined, "org")).data.items.find((n: any) => n.id === id).read, true);
    f.state.docs.get("users/org").profileShowcase = { settings: { notifications: { updates: { inApp: false }, receipts: { inApp: false } } } };
    assert.equal((await f.call(undefined, "org")).data.items.length, 0);
  } finally { await f.close(); }
});

test("organisation message alerts reuse real history and follow the shared Inbox read state", async () => {
  const f = await fixture();
  try {
    f.state.docs.set("conversations/org-thread", { orgId: "org", supporterId: "alice", supporterSent: 1, organisationRead: 0 });
    f.state.docs.set("conversation_messages/incoming", { conversationId: "org-thread", side: "supporter", sequence: 1,
      incomingIndex: 1, createdAt: "2026-11-22T15:00:00Z", text: "PRIVATE_MESSAGE_BODY" });
    const result = await f.call(undefined, "org");
    assert.equal(result.status, 200); assert.equal(result.data.items.length, 1);
    assert.equal(result.data.items[0].type, "message"); assert.equal(result.data.unreadCount, 1);
    assert.match(result.data.items[0].href, /conversation=org-thread/);
    assert.doesNotMatch(JSON.stringify(result.data), /PRIVATE_MESSAGE_BODY/);
    f.state.docs.get("conversations/org-thread").organisationRead = 1;
    assert.equal((await f.call(undefined, "org")).data.unreadCount, 0);
  } finally { await f.close(); }
});

test("read-state transform appends uniquely to the existing account without replacing profile or financial data", async () => {
  const result = await build({ entryPoints: [new URL("./firebase-rest.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external" });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const original = globalThis.fetch;
  const calls: any[] = [];
  try {
    globalThis.fetch = (async (_url: unknown, options: any) => { calls.push(JSON.parse(options.body)); return new Response("{}", { status: 200 }); }) as typeof fetch;
    const id = `n_${"a".repeat(32)}`;
    await mod.exports.fsMarkSupporterNotificationRead("alice", id, "fixture-token");
    const write = calls[0].writes[0];
    assert.equal(write.currentDocument.exists, true);
    assert.ok(write.transform.document.endsWith("/users/alice"));
    assert.deepEqual(write.transform.fieldTransforms, [{ fieldPath: "notificationReads", appendMissingElements: { values: [{ stringValue: id }] } }]);
    assert.equal(write.update, undefined);
    await assert.rejects(mod.exports.fsMarkSupporterNotificationRead("alice/bob", id, "fixture-token"));
    globalThis.fetch = (async () => new Response("PRIVATE_INTERNAL_SECRET", { status: 403 })) as typeof fetch;
    await assert.rejects(mod.exports.fsMarkSupporterNotificationRead("alice", id, "fixture-token"), /Could not save notification read state/);
  } finally { globalThis.fetch = original; }
});
