import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

test("Admin history validates orgId, isolates orgs, returns all rows newest first, and fails explicitly", async () => {
  const result = await build({
    stdin: { contents: `
      export {default as router} from "./routes/wise-connect.ts";
      export {state} from "./lib/firebase-rest.js";
    `, resolveDir: new URL("../", import.meta.url).pathname, loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    define: { "process.env.ADMIN_SECRET": JSON.stringify("synthetic-admin") },
    plugins: [{ name: "mock-services", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname,
      }));
      b.onResolve({ filter: /^zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname,
      }));
      // Use real requireAdmin; no Firebase authentication or provider calls.
      b.onResolve({ filter: /\/(firebase-rest|wise)\.js$/ }, a => ({
        path: a.path.split("/").at(-1)!, namespace: "mock",
      }));
      b.onLoad({ filter: /.*/, namespace: "mock" }, a => ({
        loader: "js", contents: a.path === "firebase-rest.js" ? `
          export const state={rows:[],queries:[],fail:false};
          export const getServerToken=async()=>"synthetic-token";
          export const fsQuery=async(collection,filters,token,opts)=>{
            state.queries.push({collection,filters,token,opts});
            if(state.fail)throw Error("Synthetic Firestore failure");
            return state.rows.filter(row=>filters.every(f=>row[f.field]===f.value));
          };
          export const fsGet=async()=>{throw Error("Unexpected document lookup")};
          export const fsPatch=async()=>{throw Error("Unexpected write")};
          export const firebaseLookup=async()=>{throw Error("Unexpected auth lookup")};
        ` : `
          export const disburseToOrg=async()=>{throw Error("Unexpected money movement")};
          export const getWisePlatformProfileId=async()=>{throw Error("Unexpected Wise call")};
        `,
      }));
    }}],
  });
  const require = createRequire(import.meta.url);
  const module = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(require, module, module.exports);
  const { state, router } = module.exports;
  const app = require("express")();
  app.use((req: any, _res: any, next: () => void) => {
    req.log = { error() {} }; next();
  });
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/wise/disbursements`;
  const headers = { "X-Admin-Secret": "synthetic-admin" };
  try {
    for (const options of [{}, { headers: { "X-Admin-Secret": "wrong" } }, { headers: { Authorization: "Bearer org" } }]) {
      assert.equal((await fetch(base + "?orgId=org-a", options)).status, 401);
    }
    assert.equal(state.queries.length, 0);
    for (const suffix of ["", "?orgId=", "?orgId=%20", "?orgId=a/b", "?orgId=a&orgId=b", "?orgId[x]=a"]) {
      assert.equal((await fetch(base + suffix, { headers })).status, 400, suffix);
    }
    assert.equal(state.queries.length, 0);
    let response = await fetch(base + "?orgId=org-a", { headers });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { disbursements: [] });
    state.rows = Array.from({ length: 125 }, (_, i) => ({
      _id: `payout-${i}`, orgId: "org-a", amountGbp: 10.25, transferId: i + 1,
      disbursedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      recipientEmail: "payee@example.test",
    }));
    state.rows.push({ ...state.rows[0], _id: "other-org", orgId: "org-b" });
    response = await fetch(base + "?orgId=org-a", { headers });
    assert.equal(response.status, 200);
    const body = await response.json() as { disbursements: Array<{ _id: string; orgId: string }> };
    assert.equal(body.disbursements.length, 125);
    assert.equal(body.disbursements[0]._id, "payout-124");
    assert.equal(body.disbursements.at(-1)?._id, "payout-0");
    assert.ok(body.disbursements.every((r: any) => r.orgId === "org-a"));
    assert.deepEqual(state.queries.at(-1), {
      collection: "disbursements",
      filters: [{ field: "orgId", op: "EQUAL", value: "org-a" }],
      token: "synthetic-token", opts: undefined,
    });
    state.fail = true;
    response = await fetch(base + "?orgId=org-a", { headers });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Failed to fetch disbursement history" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => err ? reject(err) : resolve()));
  }
});
