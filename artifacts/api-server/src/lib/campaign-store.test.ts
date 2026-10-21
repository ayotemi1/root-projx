import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

test("embedded campaign writes retry against current data and cannot overwrite a concurrent donation", async () => {
  const bundle = await build({
    stdin: { contents: `export {fsMutateCampaigns} from "./firebase-rest.ts";`,
      resolveDir: new URL("./", import.meta.url).pathname, loader: "ts" },
    bundle: true, write: false, format: "cjs", platform: "node",
    define: { "process.env.FIREBASE_PROJECT_ID": JSON.stringify("synthetic-project"),
      "process.env.FIREBASE_API_KEY": JSON.stringify("synthetic-api-key"),
      "process.env.FIREBASE_SERVER_PASSWORD": JSON.stringify("synthetic-password") },
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
  const originalFetch = globalThis.fetch;
  let reads = 0;
  const commits: any[] = [];
  globalThis.fetch = async (url: any, options: any = {}) => {
    assert.match(String(url), /firestore\.googleapis\.com/);
    assert.equal(options.headers.Authorization, "Bearer synthetic-token");
    if (String(url).endsWith(":commit")) {
      commits.push(JSON.parse(options.body));
      return commits.length === 1
        ? new Response(JSON.stringify({ error: { status: "FAILED_PRECONDITION" } }), { status: 409 })
        : new Response("{}", { status: 200 });
    }
    reads++;
    return new Response(JSON.stringify({
      name: "projects/synthetic-project/databases/(default)/documents/organisations/org",
      updateTime: `time-${reads}`,
      fields: { totalRaised: { doubleValue: 999 }, payoutSettlementBatchId: { stringValue: "locked" },
        campaigns: { arrayValue: { values: [{ mapValue: { fields: {
          _id: { stringValue: "camp" }, amountRaised: { doubleValue: reads === 1 ? 123 : 126 },
        } } }] } } },
    }));
  };
  try {
    const result = await mod.exports.fsMutateCampaigns("org", "synthetic-token", (org: any) => {
      org.campaigns[0].tagline = "Saved without losing a donation";
      return { campaigns: org.campaigns, result: org.campaigns[0].amountRaised };
    });
    assert.equal(result, 126);
    assert.equal(reads, 2);
    assert.equal(commits.length, 2);
    const write = commits[1].writes[0];
    assert.deepEqual(write.updateMask.fieldPaths, ["campaigns"]);
    assert.deepEqual(Object.keys(write.update.fields), ["campaigns"]);
    assert.equal(write.currentDocument.updateTime, "time-2");
    assert.equal(write.update.fields.campaigns.arrayValue.values[0].mapValue.fields.amountRaised.integerValue, "126");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
