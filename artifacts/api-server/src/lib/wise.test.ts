import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

test("Wise helper runs profile → quote → transfer → fund and returns transfer ID; uncertain funding fails explicitly",async()=>{
  const result=await build({stdin:{contents:`
    export * from "./wise.ts";
    export {state} from "./firebase-rest.js";
  `,resolveDir:new URL(".",import.meta.url).pathname,loader:"ts"},
    bundle:true,write:false,platform:"node",format:"cjs",packages:"external",
    define:{"process.env.WISE_API_KEY":JSON.stringify("synthetic-key")},
    plugins:[{name:"mock-firestore",setup(b){
      b.onResolve({filter:/\/firebase-rest\.js$/},()=>({path:"firebase",namespace:"mock"}));
      b.onLoad({filter:/.*/,namespace:"mock"},()=>({loader:"js",contents:`
        export const getServerToken=async()=>"synthetic";
        export const fsGet=async(c)=>c==="users"?{approvalStatus:"approved"}:
          {name:"Test Org",wise_recipient_id:99,wise_email:"payee@example.test"};
        export const state={history:[],summary:null,failHistory:false,failSummary:false,failQuery:false};
        export const fsQuery=async()=>{
          if(state.failQuery)throw Error("History access denied");return [];
        };
        export const fsCreate=async(c,data,token)=>{
          if(state.failHistory)throw Error("Synthetic history failure");
          state.history.push({collection:c,data,token});return "history-"+state.history.length;
        };
        export const fsPatch=async(c,id,data)=>{
          if(state.failSummary)throw Error("Synthetic summary failure");
          state.summary=data;
        };
      `}));
    }}]});
  const calls:Array<{url:string;body:any}>=[];
  let failFunding=false;
  const fetchMock=async(url:string,options:any={})=>{
    const body=options.body?JSON.parse(options.body):null;calls.push({url,body});
    if(url.endsWith("/v1/profiles"))return Response.json([{id:1,type:"PERSONAL"},{id:2,type:"BUSINESS"}]);
    if(url.endsWith("/quotes"))return Response.json({id:"quote_synthetic"});
    if(url.endsWith("/v1/transfers"))return Response.json({id:123,status:"incoming_payment_waiting"});
    if(url.endsWith("/payments"))return failFunding ? new Response("Synthetic failure",{status:503}):Response.json({status:"COMPLETED"});
    throw Error("Unexpected external boundary");
  };
  const module={exports:{} as any};
  new Function("require","module","exports","fetch",result.outputFiles[0]!.text)(
    createRequire(import.meta.url),module,module.exports,fetchMock);
  assert.equal(await module.exports.disburseToOrg("org",300,"TEST-REF"),123);
  assert.equal(calls.length,4);
  assert.ok(calls[1]!.url.includes("/profiles/2/quotes"));
  assert.equal(calls[1]!.body.sourceAmount,300);
  assert.equal(calls[2]!.body.targetAccount,99);
  assert.equal(calls[2]!.body.details.reference,"TEST-REF");
  assert.deepEqual(calls[3]!.body,{type:"BALANCE"});
  const {state}=module.exports;
  assert.equal(state.history.length,1);
  const first=structuredClone(state.history[0]);
  assert.deepEqual(first,{
    collection:"disbursements",token:"synthetic",data:{
      orgId:"org",amountGbp:300,transferId:123,recipientEmail:"payee@example.test",
      disbursedAt:state.summary.lastDisbursementAt,
    },
  });
  assert.ok(Number.isFinite(Date.parse(first.data.disbursedAt)));
  assert.equal(state.summary.lastDisbursementAmountGbp,300);
  assert.equal(state.summary.lastDisbursementTransferId,123);
  await module.exports.disburseToOrg("org",125.50,"SECOND");
  assert.equal(state.history.length,2);
  assert.deepEqual(state.history[0],first,"A second payout must preserve the first");
  assert.equal(state.history[1].data.amountGbp,125.50);
  assert.equal(state.summary.lastDisbursementAmountGbp,125.50);
  failFunding=true;
  await assert.rejects(module.exports.disburseToOrg("org",300,"TEST-REF"),(error:any)=>{
    assert.equal(error.wiseTransferId,123);
    assert.match(error.message,/Reconcile/);return true;
  });
  assert.equal(state.history.length,2,"Unconfirmed funding must not appear as disbursed");
  failFunding=false;
  state.failHistory=true;
  await assert.rejects(module.exports.disburseToOrg("org",10,""),(error:any)=>{
    assert.equal(error.wiseTransferId,123);
    assert.match(error.message,/funded, but recording failed.*Reconcile/);return true;
  });
  assert.equal(state.summary.lastDisbursementAmountGbp,125.50);
  state.failHistory=false;
  state.failSummary=true;
  await assert.rejects(module.exports.disburseToOrg("org",20,""),/Reconcile/);
  assert.equal(state.history.length,3,"History must survive a summary write failure");
  assert.equal(state.history[2].data.amountGbp,20);
  state.failQuery=true;
  const before=calls.length;
  await assert.rejects(module.exports.disburseToOrg("org",20,""),/History access denied/);
  assert.equal(calls.length,before,"Unavailable history must stop the payout before contacting Wise");
});
