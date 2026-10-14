import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

// Isolated processes ensure tests neither depend on nor alter configured secrets
// and each import evaluates the module's environment-based constant afresh.
function evaluateFees(env: NodeJS.ProcessEnv) {
  const moduleUrl = new URL("./fees.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types",
    "--input-type=module",
    "-e",
    `import { PLATFORM_FEE_PERCENT, platformFeePence } from ${JSON.stringify(moduleUrl)};
     console.log(JSON.stringify({
       percent: PLATFORM_FEE_PERCENT,
       fee: platformFeePence(10000),
       rounded: platformFeePence(101),
       zero: platformFeePence(0)
     }));`,
  ], { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("platform fee defaults to 5% and rounds to whole pence", () => {
  assert.deepEqual(evaluateFees({}), {
    percent: 5, fee: 500, rounded: 5, zero: 0,
  });
});

test("platform fee honours STRIPE_PLATFORM_FEE_PERCENT override", () => {
  assert.deepEqual(evaluateFees({ STRIPE_PLATFORM_FEE_PERCENT: "7.5" }), {
    percent: 7.5, fee: 750, rounded: 8, zero: 0,
  });
});
