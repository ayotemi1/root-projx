import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import type { Payout } from "./payouts.ts";

const today = new Date("2026-10-22T00:00:00Z");
const row = (age: number, amountGbp: number, status = "queued") => ({
  _id: "test", orgId: "org", orgName: "Test", donationId: "donation", stripeRef: "pi_test",
  amountGbp, currency: "gbp", method: "manual", status,
  createdAt: new Date(+today - age * 86_400_000).toISOString(),
}) as Payout;

test("payout settlement constants and hold, threshold, age boundaries", async () => {
  const result = await build({entryPoints:[new URL("./payouts.ts",import.meta.url).pathname],
    bundle:true,write:false,platform:"node",format:"cjs",packages:"external"});
  const module={exports:{} as any};
  new Function("require","module","exports",result.outputFiles[0]!.text)(
    createRequire(import.meta.url),module,module.exports);
  const {payoutDue,PAYOUT_HOLD_DAYS,PAYOUT_THRESHOLD_GBP,PAYOUT_MAX_AGE_DAYS}=module.exports;
  assert.deepEqual([PAYOUT_HOLD_DAYS, PAYOUT_THRESHOLD_GBP, PAYOUT_MAX_AGE_DAYS], [7, 250, 30]);
  assert.equal(payoutDue([row(6.99, 1000)], today).eligibleTotalGbp, 0);
  assert.equal(payoutDue([row(7, 250)], today).due, true);
  assert.equal(payoutDue([row(7, 249.99)], today).due, false);
  assert.equal(payoutDue([row(30, 1)], today).due, false);
  assert.equal(payoutDue([row(30.01, 1)], today).due, true);
  const mixed = payoutDue([row(8, 100), row(9, 150), row(1, 500), row(40, 900, "sent"), row(40, 900, "failed")], today);
  assert.equal(mixed.eligibleTotalGbp, 250);
  assert.equal(mixed.eligible.length, 2);
  assert.equal(mixed.due, true);
  assert.equal(payoutDue([], today).due, false);
});

test("ledger create-only and settlement lock use Firestore atomic preconditions",async()=>{
  const result=await build({entryPoints:[new URL("./firebase-rest.ts",import.meta.url).pathname],
    bundle:true,write:false,platform:"node",format:"cjs",packages:"external",
    define:{"process.env.FIREBASE_PROJECT_ID":JSON.stringify("synthetic-project")}});
  const calls:any[]=[];
  let locked=false;let conflict=false;
  const mockFetch=async(url:string,options:any={})=>{
    calls.push({url,options});
    if(options.method==="POST"&&url.includes("?documentId="))return new Response("{}",{status:conflict?409:200});
    if(options.method==="POST")return new Response("{}",{status:conflict?409:200});
    return Response.json({name:"projects/synthetic-project/databases/(default)/documents/organisations/org",
      updateTime:"2026-10-22T00:00:00Z",fields:{payoutSettlementBatchId:locked?{stringValue:"previous"}:{nullValue:null}}});
  };
  const module={exports:{} as any};
  new Function("require","module","exports","fetch",result.outputFiles[0]!.text)(
    createRequire(import.meta.url),module,module.exports,mockFetch);
  assert.equal(await module.exports.fsCreateIfAbsent("payouts","pi_test",{status:"queued"},"synthetic"),true);
  conflict=true;
  assert.equal(await module.exports.fsCreateIfAbsent("payouts","pi_test",{status:"queued"},"synthetic"),false);
  conflict=false;
  assert.equal(await module.exports.fsTrySettlementLock("org","batch","synthetic"),true);
  const commit=JSON.parse(calls.at(-1).options.body);
  assert.deepEqual(commit.writes[0].currentDocument,{updateTime:"2026-10-22T00:00:00Z"});
  assert.deepEqual(commit.writes[0].updateMask.fieldPaths,["payoutSettlementBatchId"]);
  locked=true;
  const count=calls.length;
  assert.equal(await module.exports.fsTrySettlementLock("org","batch-2","synthetic"),false);
  assert.equal(calls.length,count+1,"Existing lock must not issue a write");
  await module.exports.fsPatch("organisations","org",{name:"Changed",payoutSettlementBatchId:null},"synthetic");
  const patch=JSON.parse(calls.at(-1).options.body);
  assert.equal(Object.hasOwn(patch.fields,"payoutSettlementBatchId"),false,
    "A stale full-org update cannot overwrite the settlement lock");
  assert.ok(!calls.at(-1).url.includes("payoutSettlementBatchId"));
});
