import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { emailEventsStubPlugin } from "../test-support/email-stubs.ts";
import { createRequire } from "node:module";
import { PASSWORD_RESET_MESSAGE, passwordResetEmail } from "./password-reset.ts";

// No real Firebase/Brevo, reset emails, passwords or accounts are used here.
const compiled = await build({
  stdin: {
    contents: 'export {default as router} from "../routes/auth.ts"; export {state} from "reset:state";',
    resolveDir: new URL(".", import.meta.url).pathname,
  },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [emailEventsStubPlugin(), {
    name: "isolated-password-reset",
    setup(b) {
      b.onResolve({ filter: /^reset:state$/ }, () => ({ path: "state", namespace: "reset" }));
      b.onResolve({ filter: /\/lib\/(firebase-rest|brevo|auth)\.js$/ }, a =>
        ({ path: a.path.split("/").pop()!, namespace: "reset" }));
      b.onLoad({ filter: /.*/, namespace: "reset" }, a => ({
        loader: "js",
        contents: a.path === "state"
          ? 'export const state = {calls: [], actions: [], mode: "success", logs: []};'
          : a.path === "firebase-rest.js" ? `
            import {state} from "reset:state";
            const forbidden = async () => {throw Error("Unexpected account read/write");};
            export const firebaseSignUp=forbidden, firebaseSignIn=forbidden, firebaseUpdateProfile=forbidden,
              fsGet=forbidden, fsPatch=forbidden, getServerToken=forbidden;
            export async function firebaseSendPasswordResetEmail(email) {
              state.calls.push(email);
              if (state.mode !== "success") throw Object.assign(new Error("Private provider payload"), {firebaseCode: state.mode});
            }
            export async function firebaseResetPassword(code, password) {
              state.actions.push({code, password});
              if (state.mode !== "success") throw Object.assign(new Error("Private provider payload"), {firebaseCode: state.mode});
            }`
          : a.path === "auth.js" ? "export const requireAuth=()=>{throw Error('Reset must not require login');};"
          : "export const brevoAddContact=()=>{}, brevoSendEmail=()=>{}, welcomeEmailHtml=()=>'', internalNotificationHtml=()=>'';",
      }));
    },
  }],
});
function fixture() {
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(
    createRequire(import.meta.url), mod, mod.exports);
  const { router, state } = mod.exports;
  const route = router.stack.find((l: any) => l.route?.path === "/auth/forgot-password").route;
  return {
    state,
    async request(body: unknown, path = "/auth/forgot-password") {
      let status = 200, data: any;
      const res = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { data = value; } };
      const req = { body, headers: {}, socket: { remoteAddress: "synthetic-client" },
        log: { info() {}, error(...args: unknown[]) { state.logs.push(args); } } };
      const selected = path === "/auth/forgot-password" ? route : router.stack.find((l: any) => l.route?.path === path).route;
      for (const layer of selected.stack) {
        let next = false;
        await layer.handle(req, res, () => { next = true; });
        if (!next) break;
      }
      return { status, data };
    },
  };
}

test("password recovery accepts normalised emails only, not missing data, malformed input or oversized addresses", () => {
  assert.equal(passwordResetEmail({ email: " Owner@Example.TEST " }), "owner@example.test");
  for (const input of [null, [], {}, { email: 3 }, { email: "not-an-email" },
    { email: "a@b.test\nbcc@example.test" }, { email: "x".repeat(255) + "@test.test" }]) {
    assert.equal(passwordResetEmail(input), null);
  }
});

test("existing and unknown accounts receive the exact same neutral response; no account read or password write", async () => {
  const f = fixture();
  const result = await f.request({ email: " Owner@Example.TEST " });
  assert.deepEqual(result, { status: 200, data: { message: PASSWORD_RESET_MESSAGE } });
  assert.deepEqual(f.state.calls, ["owner@example.test"]);
  f.state.mode = "EMAIL_NOT_FOUND";
  assert.deepEqual(await f.request({ email: "unknown@example.test" }), result);
  assert.deepEqual(f.state.logs, []);
});

test("invalid requests cannot send emails, and provider failures give a usable retry error without private payloads", async () => {
  const f = fixture();
  assert.equal((await f.request({ email: "bad" })).status, 400);
  assert.deepEqual(f.state.calls, []);
  f.state.mode = "OPERATION_NOT_ALLOWED";
  const failed = await f.request({ email: "private@example.test" });
  assert.equal(failed.status, 503);
  assert.match(failed.data.error, /try again later/i);
  assert.doesNotMatch(JSON.stringify([failed, f.state.logs]), /private@example|Private provider payload|OPERATION_NOT_ALLOWED/);
});

test("reset-email requests are limited to five per client per window", async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) assert.equal((await f.request({ email: "owner@example.test" })).status, 200);
  const blocked = await f.request({ email: "another@example.test" });
  assert.equal(blocked.status, 429);
  assert.match(blocked.data.error, /too many/i);
  assert.equal(f.state.calls.length, 5);
});

test("a valid code can be checked without changing a password, then used to reset it", async () => {
  const f = fixture();
  const path = "/auth/reset-password";
  assert.equal((await f.request({ oobCode: "synthetic-code" }, path)).status, 200);
  assert.equal((await f.request({ oobCode: "synthetic-code", newPassword: "synthetic-password" }, path)).status, 200);
  assert.deepEqual(f.state.actions, [
    { code: "synthetic-code", password: undefined },
    { code: "synthetic-code", password: "synthetic-password" },
  ]);
  assert.deepEqual(f.state.calls, []);
});

test("expired and used links lead to recovery, and a new email can be requested without signing in", async () => {
  const f = fixture();
  for (const [provider, expected] of [["EXPIRED_OOB_CODE", "RESET_LINK_EXPIRED"], ["INVALID_OOB_CODE", "RESET_LINK_INVALID"]]) {
    f.state.mode = provider;
    const result = await f.request({ oobCode: "synthetic-code" }, "/auth/reset-password");
    assert.equal(result.status, 400);
    assert.equal(result.data.code, expected);
    assert.match(result.data.error, /request a new link/i);
  }
  f.state.mode = "success";
  assert.equal((await f.request({ email: "owner@example.test" })).status, 200);
});

test("password validation, retryable outages and rate limits never expose provider payloads", async () => {
  const f = fixture();
  const path = "/auth/reset-password";
  for (const body of [{}, { oobCode: [] }, { oobCode: "code", newPassword: "123" }]) {
    assert.equal((await f.request(body, path)).status, 400);
  }
  assert.deepEqual(f.state.actions, []);
  f.state.mode = "WEAK_PASSWORD";
  const weak = await f.request({ oobCode: "code", newPassword: "123456" }, path);
  assert.equal(weak.data.code, "WEAK_PASSWORD");
  f.state.mode = "INTERNAL_ERROR";
  const outage = await f.request({ oobCode: "code" }, path);
  assert.equal(outage.status, 503);
  assert.doesNotMatch(JSON.stringify([outage, f.state.logs]), /Private provider payload|synthetic-code|INTERNAL_ERROR/);
  const limited = fixture();
  for (let i = 0; i < 30; i++) assert.equal((await limited.request({ oobCode: "code" }, path)).status, 200);
  assert.equal((await limited.request({ oobCode: "code" }, path)).status, 429);
  // Exhausting code attempts does not exhaust the separate email recovery limit.
  assert.equal((await limited.request({ email: "owner@example.test" })).status, 200);
});
