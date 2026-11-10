import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

async function configuredAuth(password: string, secret: string) {
  const result = await build({
    stdin: {
      contents: 'export {getAdminTokenValue, requireAdmin} from "./admin-auth.ts";',
      resolveDir: new URL(".", import.meta.url).pathname,
    },
    bundle: true, write: false, platform: "node", format: "cjs",
    define: {
      "process.env.ADMIN_PASSWORD": JSON.stringify(password),
      "process.env.ADMIN_SECRET": JSON.stringify(secret),
    },
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(
    createRequire(import.meta.url), module, module.exports,
  );
  return module.exports;
}

test("configured admin password takes precedence; SECRET fallback remains supported", async () => {
  const password = await configuredAuth("synthetic-password", "");
  const both = await configuredAuth("synthetic-password", "synthetic-secret");
  const fallback = await configuredAuth("", "synthetic-secret");
  assert.equal(both.getAdminTokenValue(), password.getAdminTokenValue());
  assert.notEqual(both.getAdminTokenValue(), fallback.getAdminTokenValue());
  let allowed = false;
  both.requireAdmin({ headers: { "x-admin-token": both.getAdminTokenValue() } }, {}, () => { allowed = true; });
  assert.equal(allowed, true);
});

test("missing administrator credentials fail closed without a built-in password", async () => {
  const auth = await configuredAuth("", "");
  assert.throws(() => auth.getAdminTokenValue(), /not configured/);
  let status = 0;
  auth.requireAdmin({ headers: {} }, {
    status(code: number) { status = code; return this; },
    json() {},
  }, () => assert.fail("must not authenticate"));
  assert.equal(status, 503);
});
