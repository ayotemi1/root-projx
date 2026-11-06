import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import pino from "pino";

test("bank fields are redacted in root, nested and request/response bodies", async () => {
  const compiled = await build({
    entryPoints: [new URL("./logger.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const { BANK_LOG_FIELDS, LOG_REDACTION_PATHS } = mod.exports;
  let output = "";
  const logger = pino({ redact: LOG_REDACTION_PATHS }, { write(chunk: string) { output += chunk; } });
  const details = Object.fromEntries(BANK_LOG_FIELDS.map((field: string) => [field, `private-${field}`]));
  logger.info({ ...details, details, req: { body: details, headers: { "x-admin-token": "private-token" } },
    res: { body: { details } }, items: [details] }, "safe fixed message");
  assert.doesNotMatch(output, /private-/);
  assert.ok(output.includes("[Redacted]"));
  assert.ok(output.includes("safe fixed message"));
});
