import test from "node:test";
import assert from "node:assert/strict";
import { accountPreferences, notificationDeliveryFor, verifiedNotificationEmail } from "./supporter-preferences.ts";
import { build } from "esbuild";
import { createRequire } from "node:module";

process.env.SESSION_SECRET = "notification-preference-unit-test-only";
test("defaults and malformed preferences fail safely; receipt emails are mandatory", () => {
  const defaults = accountPreferences({});
  assert.equal(defaults.messagePolicy, "followed");
  assert.equal(defaults.notifications.updates.inApp, true);
  assert.equal(defaults.notifications.updates.email, false);
  assert.equal(defaults.notifications.messages.email, true);
  const saved = accountPreferences({ profileShowcase: { settings: { messagePolicy: "replies", notifications: {
    updates: { inApp: false, email: true }, receipts: { inApp: false, email: false },
    comments: { inApp: "yes", email: null },
  } } } });
  assert.equal(saved.messagePolicy, "replies");
  assert.deepEqual(saved.notifications.updates, { inApp: false, email: true });
  assert.deepEqual(saved.notifications.receipts, { inApp: false, email: true });
  assert.deepEqual(saved.notifications.comments, { inApp: true, email: false });
});
test("notification emails require a server MAC binding the Firebase-verified address to its recipient UID", () => {
  const proof = notificationDeliveryFor("alice", "alice@account.invalid");
  assert.equal(verifiedNotificationEmail("alice", { notificationDelivery: proof }), "alice@account.invalid");
  assert.equal(verifiedNotificationEmail("bob", { notificationDelivery: proof }), null);
  assert.equal(verifiedNotificationEmail("alice", { notificationDelivery: { ...proof, email: "forged@account.invalid" } }), null);
  assert.equal(verifiedNotificationEmail("alice", { email: "forged@account.invalid" }), null);
  assert.equal(verifiedNotificationEmail("alice", { notificationDelivery: { email: proof.email, proof: "fake" } }), null);
});

test("live update/message emails respect saved opt-outs and verified recipients; Preview sends no live notification emails", async () => {
  const js = await build({
    stdin: { contents: `export {emailSupporter} from "./supporter-notification-events.ts";export {state} from "email-test";`,
      resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true, platform: "node", format: "cjs", write: false, packages: "external",
    plugins: [{ name: "email-test", setup(b) {
      b.onResolve({ filter: /^email-test$/ }, () => ({ path: "state", namespace: "email-test" }));
      b.onResolve({ filter: /(firebase-rest|brevo)\.js$/ }, a => ({ path: a.path, namespace: "email-test" }));
      b.onLoad({ filter: /.*/, namespace: "email-test" }, a => ({ contents: a.path === "state"
        ? `export const state={user:null,sent:[]}`
        : a.path.includes("firebase-rest")
        ? `import{state}from"email-test";export const fsGet=async()=>state.user;export const fsQuery=async()=>[];`
        : `import{state}from"email-test";export const brevoSendEmail=async value=>{state.sent.push(value)};` }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", js.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const { state, emailSupporter } = mod.exports;
  const oldMode = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    state.user = { accountType: "supporter", notificationDelivery: notificationDeliveryFor("alice", "alice@account.invalid"),
      profileShowcase: { settings: { notifications: { messages: { email: false }, updates: { email: false } } } } };
    const send = (category: string, uid = "alice") => emailSupporter(uid, category, "A new message", "<Name> sent a message.", "/inbox", "unit");
    await send("messages"); await send("updates");
    assert.equal(state.sent.length, 0);
    state.user.profileShowcase.settings.notifications.messages.email = true;
    await send("messages");
    assert.equal(state.sent.length, 1);
    assert.equal(state.sent[0].to[0].email, "alice@account.invalid");
    assert.match(state.sent[0].htmlContent, /&lt;Name&gt;/);
    assert.doesNotMatch(state.sent[0].htmlContent, /<Name>/);
    await send("messages", "bob");
    assert.equal(state.sent.length, 1, "a signed address cannot be reused for another UID");
    process.env.NODE_ENV = "development";
    await send("messages");
    assert.equal(state.sent.length, 1, "Preview doesn't contact the live email service");
  } finally {
    if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
  }
});
