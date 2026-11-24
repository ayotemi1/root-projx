import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { once } from "node:events";
import { build } from "esbuild";
import express from "express";

async function fixture(options: { missingKey?: boolean; failure?: string; production?: boolean } = {}) {
  const built = await build({
    stdin: {
      contents: 'export { default as router } from "./routes/admin-email.ts"; export { getAdminTokenValue } from "./lib/admin-auth.ts";',
      resolveDir: new URL("..", import.meta.url).pathname,
    },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    define: {
      "process.env.ADMIN_PASSWORD": '"synthetic-admin-password"',
      "process.env.ADMIN_SECRET": '""',
      "process.env.BREVO_API_KEY": JSON.stringify(options.missingKey ? "" : "synthetic-key"),
      "process.env.TEAM_EMAIL": '"team@example.test"',
      "process.env.NODE_ENV": JSON.stringify(options.production === false ? "development" : "production"),
    },
    plugins: [{
      name: "mock-email",
      setup(build) {
        build.onResolve({ filter: /\/brevo\.js$/ }, () => ({ path: "brevo", namespace: "mock-email" }));
        build.onLoad({ filter: /.*/, namespace: "mock-email" }, () => ({
          contents: `export async function brevoSendEmail(email) { calls.push(email); ${options.failure ? `throw new Error(${JSON.stringify(options.failure)});` : ""} }`,
          loader: "js",
        }));
      },
    }],
  });
  const calls: any[] = [];
  const module = { exports: {} as any };
  new Function("require", "module", "exports", "calls", built.outputFiles[0]!.text)(
    createRequire(import.meta.url), module, module.exports, calls,
  );
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { info() {}, error() {} } as any;
    next();
  });
  app.use("/api", module.exports.router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  return {
    calls,
    async request(auth = true, body = {}) {
      const result = await fetch(`http://127.0.0.1:${address.port}/api/admin/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(auth ? { "x-admin-token": module.exports.getAdminTokenValue() } : {}) },
        body: JSON.stringify(body),
      });
      return { status: result.status, body: await result.json() as Record<string, any>, retryAfter: result.headers.get("retry-after") };
    },
    close: () => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())),
  };
}

test("test email requires admin auth and cannot target an arbitrary recipient", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request(false)).status, 401);
    assert.equal(f.calls.length, 0);
    const result = await f.request(true, { to: "attacker@example.test", subject: "untrusted", htmlContent: "untrusted" });
    assert.equal(result.status, 200);
    assert.equal(result.body.accepted, true);
    assert.equal(result.body.environment, "production");
    assert.equal(result.body.recipient, "info@rootprojx.com");
    assert.ok(Date.parse(result.body.sentAt));
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0].to, [{ email: "info@rootprojx.com" }]);
    assert.equal(f.calls[0].subject, "Root ProjX — email delivery test");
    assert.match(f.calls[0].htmlContent, /production server/);
    assert.doesNotMatch(f.calls[0].htmlContent, /untrusted/);
    assert.equal((await f.request()).status, 429);
    assert.equal(f.calls.length, 1);
  } finally { await f.close(); }
});

test("test email fails explicitly when Brevo is unconfigured", async () => {
  const f = await fixture({ missingKey: true });
  try {
    assert.equal((await f.request()).status, 503);
    assert.equal(f.calls.length, 0);
  } finally { await f.close(); }
});

test("test email explains IP blocking without exposing provider payloads", async () => {
  const f = await fixture({ failure: "Brevo sendEmail failed 401: unrecognised IP address 192.0.2.1 private@example.test" });
  try {
    const result = await f.request();
    assert.equal(result.status, 502);
    assert.match(result.body.error, /Authorized IPs/);
    assert.doesNotMatch(JSON.stringify(result.body), /192\.0\.2\.1|private@example|synthetic-key/);
    assert.equal(f.calls.length, 1);
  } finally { await f.close(); }
});

test("test email reports provider authentication failures without claiming acceptance", async () => {
  const f = await fixture({ failure: "Brevo sendEmail failed 401: invalid key" });
  try {
    const result = await f.request();
    assert.equal(result.status, 502);
    assert.match(result.body.error, /authentication/);
    assert.equal(result.body.accepted, undefined);
  } finally { await f.close(); }
});

test("network failures remain uncertain, and development tests identify their origin", async () => {
  const f = await fixture({ failure: "fetch failed" });
  try {
    const result = await f.request();
    assert.equal(result.status, 502);
    assert.match(result.body.error, /delivery may be uncertain/);
  } finally { await f.close(); }
  const dev = await fixture({ production: false });
  try {
    assert.equal((await dev.request()).body.environment, "development");
    assert.match(dev.calls[0].htmlContent, /development server/);
  } finally { await dev.close(); }
});
