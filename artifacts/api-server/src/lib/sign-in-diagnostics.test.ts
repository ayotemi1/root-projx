import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { signInDiagnosticCode } from "./sign-in-diagnostics.ts";

// Run the real auth route without Firebase, email, account writes or real credentials.
const compiled = await build({
  stdin: {
    contents: 'export {default as router} from "../routes/auth.ts"; export {state} from "signin:state";',
    resolveDir: new URL(".", import.meta.url).pathname,
  },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{
    name: "isolated-sign-in",
    setup(b) {
      b.onResolve({ filter: /^signin:state$/ }, () => ({ path: "state", namespace: "signin" }));
      b.onResolve({ filter: /\/lib\/(firebase-rest|brevo|auth)\.js$/ }, a =>
        ({ path: a.path.split("/").pop()!, namespace: "signin" }));
      b.onLoad({ filter: /.*/, namespace: "signin" }, a => ({
        loader: "js",
        contents: a.path === "state"
          ? 'export const state = {failure: null, signIns: 0, profileReads: 0, logs: []};'
          : a.path === "firebase-rest.js" ? `
            import {state} from "signin:state";
            const forbidden = async () => {throw Error("Unexpected account write or email");};
            export const firebaseSignUp=forbidden, firebaseUpdateProfile=forbidden,
              firebaseSendPasswordResetEmail=forbidden, firebaseResetPassword=forbidden,
              fsPatch=forbidden, getServerToken=forbidden;
            export async function firebaseSignIn() {
              state.signIns++;
              if (state.failure) throw state.failure;
              return {uid:"synthetic-supporter", idToken:"synthetic-private-token"};
            }
            export async function fsGet() {
              state.profileReads++;
              return {name:"Synthetic Supporter", email:"private@example.invalid", accountType:"supporter"};
            }`
          : a.path === "auth.js" ? "export const requireAuth=()=>{throw Error('Login must not require a session');};"
          : "export const brevoAddContact=()=>{throw Error('Unexpected email');}, brevoSendEmail=brevoAddContact, welcomeEmailHtml=brevoAddContact, internalNotificationHtml=brevoAddContact;",
      }));
    },
  }],
});

function fixture() {
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(
    createRequire(import.meta.url), mod, mod.exports);
  const { router, state } = mod.exports;
  const route = router.stack.find((l: any) => l.route?.path === "/auth/login").route;
  return {
    state,
    async request(body: unknown = { email: "private@example.invalid", password: "synthetic-private-password" }) {
      let status = 200, data: any;
      const req = {
        body, headers: { authorization: "Bearer synthetic-private-header" },
        socket: { remoteAddress: "synthetic-client" },
        log: {
          warn(...args: unknown[]) { state.logs.push({ level: "warn", args }); },
          error(...args: unknown[]) { state.logs.push({ level: "error", args }); },
        },
      };
      const res = {
        setHeader() {},
        status(code: number) { status = code; return this; },
        json(value: unknown) { data = value; },
      };
      for (const layer of route.stack) {
        let next = false;
        await layer.handle(req, res, () => { next = true; });
        if (!next) break;
      }
      return { status, data };
    },
  };
}

test("sign-in diagnostics allow known codes but discard provider descriptions", () => {
  for (const code of ["INVALID_LOGIN_CREDENTIALS", "EMAIL_NOT_FOUND", "INVALID_PASSWORD",
    "USER_DISABLED", "TOO_MANY_ATTEMPTS_TRY_LATER", "OPERATION_NOT_ALLOWED",
    "API_KEY_INVALID", "QUOTA_EXCEEDED"]) {
    assert.equal(signInDiagnosticCode({ firebaseCode: code }), code);
    assert.equal(signInDiagnosticCode({ firebaseCode: `${code} : private@example.invalid synthetic-private-token` }), code);
  }
});

test("missing, malformed and unrecognised errors cannot become arbitrary log values", () => {
  for (const error of [null, undefined, "private@example.invalid", 42,
    new Error("synthetic-private-password"), {}, { firebaseCode: null },
    { firebaseCode: 42 }, { firebaseCode: {} }, { firebaseCode: " " }]) {
    assert.equal(signInDiagnosticCode(error), "NO_PROVIDER_CODE");
  }
  for (const firebaseCode of ["private@example.invalid", "synthetic-private-token",
    "UNEXPECTED_ERROR : synthetic-private-password", "INVALID_PASSWORD\nprivate@example.invalid"]) {
    assert.equal(signInDiagnosticCode({ firebaseCode }), "UNRECOGNISED_PROVIDER_CODE");
  }
});

test("real login failures log only a safe code, with unchanged generic responses", async () => {
  for (const code of ["INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "EMAIL_NOT_FOUND",
    "USER_DISABLED", "TOO_MANY_ATTEMPTS_TRY_LATER", "OPERATION_NOT_ALLOWED",
    "API_KEY_INVALID", "UNEXPECTED_ERROR"]) {
    const f = fixture();
    f.state.failure = Object.assign(new Error("Private provider payload: private@example.invalid"), {
      firebaseCode: `${code} : synthetic-private-token`,
      password: "synthetic-private-password",
      idToken: "synthetic-private-token",
    });
    const result = await f.request();
    assert.deepEqual(result, { status: 401, data: { error: "Invalid email or password" } });
    assert.deepEqual(f.state.logs, [{
      level: "warn",
      args: [{ firebaseCode: code === "UNEXPECTED_ERROR" ? "UNRECOGNISED_PROVIDER_CODE" : code },
        "Firebase sign-in rejected"],
    }]);
    assert.equal(f.state.profileReads, 0);
    assert.doesNotMatch(JSON.stringify([result, f.state.logs]),
      /private@example|synthetic-private|Private provider payload|password":|idToken/);
  }
});

test("network and other errors without a Firebase code do not log exception payloads", async () => {
  const f = fixture();
  f.state.failure = new TypeError("fetch failed: private@example.invalid synthetic-private-token");
  assert.equal((await f.request()).status, 401);
  assert.deepEqual(f.state.logs, [{
    level: "warn", args: [{ firebaseCode: "NO_PROVIDER_CODE" }, "Firebase sign-in rejected"],
  }]);
});

test("successful login preserves the user and token response without diagnostic logging", async () => {
  const f = fixture();
  const result = await f.request();
  assert.equal(result.status, 200);
  assert.equal(result.data.user.id, "synthetic-supporter");
  assert.equal(result.data.user.accountType, "supporter");
  assert.equal(result.data.token, "synthetic-private-token");
  assert.equal(f.state.signIns, 1);
  assert.equal(f.state.profileReads, 1);
  assert.deepEqual(f.state.logs, []);
});

test("missing credentials still stop before contacting Firebase or logging a rejection", async () => {
  const f = fixture();
  assert.equal((await f.request({ email: "private@example.invalid" })).status, 400);
  assert.equal(f.state.signIns, 0);
  assert.deepEqual(f.state.logs, []);
});

test("existing brute-force limit still blocks attempts without extra provider calls or logs", async () => {
  const f = fixture();
  f.state.failure = Object.assign(new Error("Private provider payload"), { firebaseCode: "INVALID_PASSWORD" });
  for (let i = 0; i < 10; i++) assert.equal((await f.request()).status, 401);
  assert.equal((await f.request()).status, 429);
  assert.equal(f.state.signIns, 10);
  assert.equal(f.state.logs.length, 10);
});
