import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

test("Wise helper runs profile → quote → transfer → fund and returns transfer ID; uncertain funding fails explicitly",async()=>{
  const result=await build({entryPoints:[new URL("./wise.ts",import.meta.url).pathname],
    bundle:true,write:false,platform:"node",format:"cjs",packages:"external",
    define:{"process.env.WISE_API_KEY":JSON.stringify("synthetic-key")},
    plugins:[{name:"mock-firestore",setup(b){
      b.onResolve({filter:/\/firebase-rest\.js$/},()=>({path:"firebase",namespace:"mock"}));
      b.onLoad({filter:/.*/,namespace:"mock"},()=>({loader:"js",contents:`
        export const getServerToken=async()=>"synthetic";
        export const fsGet=async(c)=>c==="users"?{approvalStatus:"approved"}:
          {name:"Test Org",wise_recipient_id:99,wise_email:"payee@example.test"};
        export const fsPatch=async()=>{};
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
  failFunding=true;
  await assert.rejects(module.exports.disburseToOrg("org",300,"TEST-REF"),(error:any)=>{
    assert.equal(error.wiseTransferId,123);
    assert.match(error.message,/Reconcile/);return true;
  });
});
