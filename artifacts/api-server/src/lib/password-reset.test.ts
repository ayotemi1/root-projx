import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { PASSWORD_RESET_MESSAGE, passwordResetEmail } from "./password-reset.ts";

// No real Firebase/Brevo, reset emails, passwords or accounts are used here.
const compiled = await build({
  stdin: {
    contents: 'export {default as router} from "../routes/auth.ts"; export {state} from "reset:state";',
    resolveDir: new URL(".", import.meta.url).pathname,
  },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{
    name: "isolated-password-reset",
    setup(b) {
      b.onResolve({ filter: /^reset:state$/ }, () => ({ path: "state", namespace: "reset" }));
      b.onResolve({ filter: /\/lib\/(firebase-rest|brevo|auth)\.js$/ }, a =>
        ({ path: a.path.split("/").pop()!, namespace: "reset" }));
      b.onLoad({ filter: /.*/, namespace: "reset" }, a => ({
        loader: "js",
        contents: a.path === "state"
          ? 'export const state = {calls: [], mode: "success", logs: []};'
          : a.path === "firebase-rest.js" ? `
            import {state} from "reset:state";
            const forbidden = async () => {throw Error("Unexpected account read/write");};
            export const firebaseSignUp=forbidden, firebaseSignIn=forbidden, firebaseUpdateProfile=forbidden,
              fsGet=forbidden, fsPatch=forbidden, getServerToken=forbidden;
            export async function firebaseSendPasswordResetEmail(email) {
              state.calls.push(email);
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
    async request(body: unknown) {
      let status = 200, data: any;
      const res = { status(code: number) { status = code; return this; }, json(value: unknown) { data = value; } };
      const req = { body, headers: {}, socket: { remoteAddress: "synthetic-client" },
        log: { error(...args: unknown[]) { state.logs.push(args); } } };
      for (const layer of route.stack) {
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
