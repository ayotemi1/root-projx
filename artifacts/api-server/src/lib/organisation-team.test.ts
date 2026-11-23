import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

async function fixture() {
  const bundle = await build({
    stdin: { contents: `import express from"express";import team from"./src/routes/organisation-team.ts";import messaging from"./src/routes/messaging.ts";
      import{requireAuth}from"./src/lib/auth.ts";export*from"./src/lib/organisation-team-access.ts";export{state}from"team-fixture";
      export const app=express();app.use(express.json());app.use((req,res,next)=>{req.log={info(){},warn(){},error(){}};next()});
      app.use("/api",team);app.use("/api",messaging);app.use("/api",requireAuth,(req,res)=>res.json({user:req.user}));`,
      resolveDir: new URL("../../", import.meta.url).pathname },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "team-fixtures", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname }));
      b.onResolve({ filter: /^zod$/ }, () => ({ path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname }));
      b.onResolve({ filter: /^team-fixture$|firebase-rest\.js$/ }, () => ({ path: "state", namespace: "team" }));
      b.onLoad({ filter: /.*/, namespace: "team" }, () => ({ contents: `
        export const state={docs:new Map(),calls:[]};export const getServerToken=async()=>"server";
        export const firebaseLookup=async uid=>state.docs.has("users/"+uid)?{uid,email:uid+"@example.test"}:null;
        export const fsGet=async(c,id)=>{state.calls.push(c+"/"+id);const d=state.docs.get(c+"/"+id);return d?{...structuredClone(d),_id:id}:null};
        export const fsQuery=async(c,filters)=>[...state.docs].filter(([k,v])=>k.startsWith(c+"/")&&filters.every(f=>{
          const x=f.field.split(".").reduce((o,k)=>o?.[k],v);return f.op==="ARRAY_CONTAINS"?Array.isArray(x)&&x.includes(f.value):x===f.value
        })).map(([k,v])=>({...structuredClone(v),_id:k.slice(c.length+1)}));
        export const fsCreateIfAbsent=async(c,id,d)=>{if(state.docs.has(c+"/"+id))return false;state.docs.set(c+"/"+id,structuredClone(d));return true};
        export const fsMutateMessaging=async(c,id,t,decide,mid)=>{
          const key=c+"/"+id,plan=decide(structuredClone(state.docs.get(key)||null),structuredClone(state.docs.get("conversation_messages/"+mid)||null));
          if(plan.patch)state.docs.set(key,{...(state.docs.get(key)||{}),...structuredClone(plan.patch)});
          if(plan.message)state.docs.set("conversation_messages/"+mid,structuredClone(plan.message));return plan.result;
        };`
      }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const { app, state } = mod.exports;
  for (const id of ["org", "otherorg", "staff", "inbox", "alice", "outsider"]) {
    state.docs.set(`users/${id}`, { accountType: id.includes("org") ? "organisation" : "supporter", approvalStatus: "approved", name: id });
  }
  state.docs.set("organisations/org", { name: "Owned organisation" });
  state.docs.set("organisations/otherorg", { name: "Other organisation" });
  state.docs.set("organisation_messaging_access/org", { memberIds: ["inbox"], publicTeam: ["outsider"] });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path: string, who = "org", method = "GET", body?: unknown) => {
    const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${who}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: await r.json() as any, headers: r.headers };
  };
  return { ...mod.exports, call, close: () => new Promise<void>(r => server.close(() => r())) };
}

test("manager sessions are signed, short-lived and content-only, not financial or owner credentials", async () => {
  const f = await fixture(); const old = process.env.SESSION_SECRET; process.env.SESSION_SECRET = "unit-test-organisation-team";
  try {
    const token = f.createManagerSession("org", "staff", 1000);
    assert.deepEqual(f.parseManagerSession(token, 1001), { orgId: "org", actorId: "staff" });
    assert.equal(f.parseManagerSession(token, 3_601_000), null);
    assert.equal(f.parseManagerSession(token + "tampered", 1001), null);
    for (const path of ["/api/payouts/my", "/api/payout/setup", "/api/bank-details", "/api/stripe/connect/status",
      "/api/wise/status", "/api/organisation-team/org", "/api/messaging/access/org", "/api/admin/organisations", "/api/auth/me",
      "/api/organisations/otherorg", "/api/organisations/org/payouts", "/api/donations/checkout"])
      for (const method of ["GET", "POST", "PATCH", "DELETE"]) assert.equal(f.managerAccessAllows("org", method, path), false, `${method} ${path}`);
    assert.equal(f.managerAccessAllows("org", "PATCH", "/api/organisations/org"), true);
    assert.equal(f.managerAccessAllows("org", "POST", "/api/organisations/org/campaigns"), true);
    assert.equal(f.managerAccessAllows("org", "GET", "/api/messaging/context"), true);
  } finally { if (old === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old; await f.close(); }
});

test("only the owner grants managers; Inbox-only grants do not escalate, revocation applies to existing sessions", async () => {
  const f = await fixture(); const old = process.env.SESSION_SECRET; process.env.SESSION_SECRET = "unit-test-organisation-team";
  try {
    assert.equal((await f.call("/organisation-team/org", "staff", "POST", { userId: "outsider" })).status, 403);
    assert.equal((await f.call("/organisation-team/org/session", "inbox", "POST")).status, 403);
    assert.equal((await f.call("/organisation-team/otherorg", "org", "POST", { userId: "staff" })).status, 403);
    assert.equal((await f.call("/organisation-team/org", "org", "POST", { userId: "unknown" })).status, 400);
    const grant = await f.call("/organisation-team/org", "org", "POST", { userId: "staff" });
    assert.equal(grant.status, 200); assert.equal(grant.data.members[0].userId, "staff");
    assert.deepEqual(f.state.docs.get("organisation_messaging_access/org").memberIds, ["inbox"]);
    assert.equal((await f.call("/organisation-team", "staff")).data.organisations[0].id, "org");
    assert.equal((await f.call("/organisation-team", "outsider")).data.organisations.length, 0);
    const token = (await f.call("/organisation-team/org/session", "staff", "POST")).data.token;
    const content = await f.call("/organisations/org", token, "PATCH", { name: "Draft" });
    assert.equal(content.status, 200); assert.equal(content.data.user.userId, "org"); assert.equal(content.data.user.actingUserId, "staff");
    assert.equal((await f.call("/organisation-team/session", token)).data.name, "Owned organisation");
    for (const path of ["/payouts/my", "/organisation-team/org", "/messaging/access/org", "/organisations/otherorg"])
      assert.equal((await f.call(path, token)).status, 401);
    const contextResponse = await f.call("/messaging/context", token);
    const context = contextResponse.data;
    assert.equal(context.personal, false); assert.equal(context.organisations.length, 1); assert.equal(context.organisations[0].canManageTeam, false);
    const cookie = contextResponse.headers.get("set-cookie")!.split(";")[0]!.split("=")[1]!.split(".")[0]!;
    assert.equal(JSON.parse(Buffer.from(decodeURIComponent(cookie), "base64url").toString()).uid, "staff", "Media permissions retain the real actor, not the owner identity");
    const conversation = (await f.call("/messaging/conversations", "alice", "POST", { orgId: "org" })).data.id;
    await f.call(`/messaging/conversations/${conversation}/messages`, "alice", "POST", { text: "Can I help?", clientId: "supporter_message_001" });
    const reply = await f.call(`/messaging/conversations/${conversation}/messages`, token, "POST", { text: "Yes, thank you", clientId: "manager_message_0001", orgId: "org" });
    assert.equal(reply.status, 200);
    assert.equal(f.state.docs.get(`conversation_messages/${reply.data.id}`).senderId, "staff");
    assert.equal((await f.call("/messaging/conversations?orgId=otherorg", token)).status, 404);
    assert.equal((await f.call("/organisation-team/org/staff", "org", "DELETE")).status, 200);
    assert.equal((await f.call("/organisations/org", token, "PATCH", {})).status, 401);
    assert.equal((await f.call("/messaging/context", token)).status, 401);
    assert.deepEqual(f.state.docs.get("organisation_messaging_access/org").memberIds, ["inbox"]);
    assert.equal((await f.call("/organisation-team", "staff")).data.organisations.length, 0);
  } finally { if (old === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old; await f.close(); }
});

test("organisation navigation shares the shell, exact order and five phone tabs without highlighting Create", async () => {
  const result = await build({ entryPoints: [new URL("../../../web/src/lib/supporter-navigation.ts", import.meta.url).pathname], bundle: true, write: false, platform: "node", format: "cjs" });
  const mod = { exports: {} as any };
  new Function("module", "exports", result.outputFiles[0]!.text)(mod, mod.exports);
  const nav = mod.exports, org = { accountType: "organisation", approvalStatus: "approved" };
  assert.deepEqual(nav.navigationFor(org).map((n: any) => n.label), ["Home", "Discover", "Create", "Inbox", "Notifications", "Profile", "Campaigns", "Payouts"]);
  assert.deepEqual(nav.supporterMobileNavigation, ["home", "discover", "create", "inbox", "profile"]);
  for (const item of nav.navigationFor(org)) {
    const active = nav.navigationFor(org).filter((other: any) => nav.isSupporterNavigationActive(other, item.href));
    assert.deepEqual(active.map((n: any) => n.id), item.id === "create" ? [] : [item.id]);
    assert.equal(nav.shouldUseSupporterLayout(item.href, "organisation", "approved"), true);
  }
  assert.equal(nav.navigationFor({ accountType: "supporter" }).some((n: any) => n.id === "saved"), true);
  assert.equal(nav.shouldUseSupporterLayout("/feed", "organisation", "pending"), false);
});
