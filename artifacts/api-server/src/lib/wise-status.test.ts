import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

test("Wise status returns the organisation's last payout or explicit nulls", async () => {
  const result = await build({
    entryPoints: [new URL("../routes/wise-connect.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "mock-boundaries", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname,
      }));
      b.onResolve({ filter: /^zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname,
      }));
      b.onResolve({ filter: /\/(auth|firebase-rest|wise)\.js$/ }, args => ({
        path: args.path.split("/").at(-1)!, namespace: "mock",
      }));
      b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({
        loader: "js", contents: args.path === "auth.js" ? `
          export const requireAuth=(req,res,next)=>{req.user={userId:"org",accountType:"organisation"};next()};
          export const requireApprovedOrganisation=(req,res,next)=>next();
          export const requireAdmin=(req,res,next)=>next();
        ` : args.path === "firebase-rest.js" ? `
          export const getServerToken=async()=>"synthetic";
          export const fsGet=async()=>globalThis.wiseStatusTestOrg;
          export const fsPatch=async()=>{throw Error("Unexpected write")};
          export const fsQuery=async()=>{throw Error("Unexpected query")};
        ` : `
          export const disburseToOrg=async()=>{throw Error("Unexpected transfer")};
          export const getWisePlatformProfileId=async()=>{throw Error("Unexpected Wise call")};
        `,
      }));
    }}],
  });
  const module = { exports: {} as any };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(require, module, module.exports);
  const express = require("express");
  const app = express();
  app.use(module.exports.default);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/wise/connect/status`;
  const connected = { wise_email: "org@example.test", wise_recipient_id: 99, wise_verified: true };
  try {
    (globalThis as any).wiseStatusTestOrg = connected;
    let response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ...connected, lastDisbursementAt: null, lastDisbursementAmountGbp: null,
      lastDisbursementTransferId: null,
    });
    const paid = { ...connected, lastDisbursementAt: "2026-08-22T12:00:00.000Z",
      lastDisbursementAmountGbp: 475.25, lastDisbursementTransferId: 12345 };
    (globalThis as any).wiseStatusTestOrg = paid;
    response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), paid);
  } finally {
    delete (globalThis as any).wiseStatusTestOrg;
    await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => err ? reject(err) : resolve()));
  }
});

test("Wise payout summary formats GBP and date, links safely, and hides missing or invalid payouts", async () => {
  const componentUrl = new URL("../../../web/src/components/wise-last-payout.tsx", import.meta.url);
  const result = await build({
    entryPoints: [componentUrl.pathname], bundle: true, write: false,
    platform: "node", format: "cjs", packages: "external", jsx: "automatic",
  });
  const require = createRequire(componentUrl);
  const module = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(require, module, module.exports);
  const { createElement } = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const render = (status: object) => renderToStaticMarkup(createElement(module.exports.WiseLastPayout, { status }));
  const paid = { lastDisbursementAt: "2026-08-22T12:00:00Z",
    lastDisbursementAmountGbp: 475, lastDisbursementTransferId: 12345 };
  const html = render(paid);
  assert.match(html, /Last paid: £475 on 22 Aug 2026/);
  assert.match(html, /href="https:\/\/wise.com\/transfers\/12345"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(render({ ...paid, lastDisbursementAmountGbp: 475.25 }), /£475.25/);
  assert.equal(render({ wise_email: "org@example.test", wise_verified: true }), "");
  assert.equal(render({ ...paid, lastDisbursementAt: null }), "");
  assert.equal(render({ ...paid, lastDisbursementAt: "invalid" }), "");
  assert.equal(render({ ...paid, lastDisbursementAmountGbp: null }), "");
  assert.doesNotMatch(render({ ...paid, lastDisbursementTransferId: null }), /<a /);
});
