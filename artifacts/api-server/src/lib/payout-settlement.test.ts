import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

async function fixture(key = true) {
  const mocks: Record<string,string> = {
    state:`export const state={docs:new Map(),transfers:[],failOrg:null,patchFailOrg:null};`,
    "firebase-rest.js":`
      import {state} from "settlement:state";
      export const getServerToken=async()=>"synthetic-server";
      export const fsGet=async(c,id)=>structuredClone(state.docs.get(c+"/"+id)??null);
      export const fsQuery=async(c,filters)=>[...state.docs].filter(([k,d])=>
        k.startsWith(c+"/")&&filters.every(f=>d[f.field]===f.value)).map(([k,d])=>({...structuredClone(d),_id:k.split("/")[1]}));
      export const fsCreateIfAbsent=async()=>{throw Error("Unexpected create");};
      export const fsTrySettlementLock=async(id,batch)=>{
        const org=state.docs.get("organisations/"+id);
        if(org.payoutSettlementBatchId)return false;
        org.payoutSettlementBatchId=batch;return true;
      };
      export const fsReleaseSettlementLock=async(id)=>{state.docs.get("organisations/"+id).payoutSettlementBatchId=null;};
      export const fsPatch=async(c,id,patch)=>{
        if(c==="payouts"&&patch.status==="sent"&&state.patchFailOrg===state.docs.get(c+"/"+id).orgId)throw Error("Synthetic recording outage");
        state.docs.set(c+"/"+id,{...state.docs.get(c+"/"+id),...structuredClone(patch)});
      };
    `,
    "wise.js":`
      import {state} from "settlement:state";
      export const disburseToOrg=async(orgId,amountGbp,reference)=>{
        state.transfers.push({orgId,amountGbp,reference});
        if(state.failOrg===orgId)throw Error("Synthetic Wise failure");
        return 100+state.transfers.length;
      };
    `,
    "auth.js":`
      export const requireAuth=(req,res,next)=>{
        if(req.headers.authorization!=="Bearer synthetic-org"){res.status(401).json({error:"Unauthorized"});return;}
        req.user={userId:"org-a"};next();
      };
      export const requireApprovedOrganisation=(req,res,next)=>next();
    `,
  };
  const result=await build({
    stdin:{contents:`export * from "./lib/payout-settlement.ts";
      export {default as router} from "./routes/payouts.ts";export {state} from "settlement:state";`,
      resolveDir:new URL("../",import.meta.url).pathname,loader:"ts"},
    bundle:true,write:false,platform:"node",format:"cjs",packages:"external",
    define:{"process.env.WISE_API_KEY":key?JSON.stringify("synthetic-key"):"undefined",
      "process.env.ADMIN_PASSWORD":JSON.stringify("synthetic-admin")},
    plugins:[{name:"synthetic-services",setup(b){
      b.onResolve({filter:/^@workspace\/api-zod$/},()=>({
        path:new URL("../../../../lib/api-zod/src/generated/api.ts",import.meta.url).pathname}));
      b.onResolve({filter:/^zod$/},()=>({
        path:new URL("../../../../lib/api-zod/node_modules/zod/index.cjs",import.meta.url).pathname}));
      b.onResolve({filter:/^settlement:state$|\/(firebase-rest|wise|auth)\.js$/},a=>({
        path:a.path==="settlement:state"?"state":a.path.split("/").at(-1)!,namespace:"mock"}));
      b.onLoad({filter:/.*/,namespace:"mock"},a=>({contents:mocks[a.path]!,loader:"js"}));
    }}],
  });
  const module={exports:{} as any};
  new Function("require","module","exports",result.outputFiles[0]!.text)(createRequire(import.meta.url),module,module.exports);
  const api=module.exports;
  const old=new Date(Date.now()-10*86_400_000).toISOString();
  for(const id of ["org-a","org-b"]) {
    api.state.docs.set("organisations/"+id,{name:id,payoutMethod:"wise",wise_email:"payee@example.test"});
    for(let i=0;i<2;i++)api.state.docs.set(`payouts/${id}-${i}`,{
      orgId:id,orgName:id,donationId:"d"+i,stripeRef:"pi_"+id+i,amountGbp:150,currency:"gbp",
      method:"wise",status:"queued",createdAt:old,
    });
  }
  return api;
}
test("no Wise key leaves due payouts queued and reports correct manual totals",async()=>{
  const api=await fixture(false);
  const {results}=await api.runPayouts();
  assert.deepEqual(results.map((r:any)=>[r.status,r.amountGbp]),[
    ["needs_manual_settlement",300],["needs_manual_settlement",300]]);
  assert.equal(api.state.transfers.length,0);
  assert.equal((await api.payoutOverview()).totalQueuedGbp,600);
});
test("Wise sends once per organisation; one failure does not abort another",async()=>{
  const api=await fixture();
  api.state.failOrg="org-a";
  const {results}=await api.runPayouts();
  assert.deepEqual(results.map((r:any)=>r.status),["failed","sent"]);
  assert.deepEqual(api.state.transfers.map((t:any)=>t.amountGbp),[300,300]);
  const overview=await api.payoutOverview();
  assert.equal(overview.failureCount,2);
  const sent=overview.payouts.filter((p:any)=>p.orgId==="org-b");
  assert.equal(sent[0].batchId,sent[1].batchId);
  assert.equal(sent[0].wiseTransferId,sent[1].wiseTransferId);
  await api.runPayouts();
  assert.equal(api.state.transfers.length,2,"Failed or sent payouts must not send again");
});
test("manual method stays queued until explicitly marked; holds stay untouched and last settlement is the batch total",async()=>{
  const api=await fixture();
  api.state.docs.set("organisations/org-a",{name:"Manual Org",payoutMethod:"bank_transfer",payoutManualApproved:true});
  api.state.docs.set("payouts/recent",{...api.state.docs.get("payouts/org-a-0"),amountGbp:50,createdAt:new Date().toISOString()});
  const run=await api.runPayouts();
  assert.equal(run.results[0].status,"needs_manual_settlement");
  const result=await api.markPayoutsSent("org-a","Bank reference TEST-123");
  assert.equal(result.amountGbp,300);
  assert.equal(api.state.docs.get("payouts/org-a-0").sentBy,"manual");
  assert.equal(api.state.docs.get("payouts/recent").status,"queued");
  const summary=await api.organisationPayoutSummary("org-a");
  assert.equal(summary.pendingGbp,50);
  assert.equal(summary.lastSettled.amountGbp,300);
});
test("concurrent runs cannot duplicate transfers; interrupted recording retains lock",async()=>{
  const api=await fixture();
  await Promise.all([api.runPayouts(),api.runPayouts()]);
  assert.equal(api.state.transfers.length,2);
  const interrupted=await fixture();
  interrupted.state.patchFailOrg="org-a";
  await interrupted.runPayouts();
  assert.ok(interrupted.state.docs.get("organisations/org-a").payoutSettlementBatchId);
  await interrupted.runPayouts();
  assert.equal(interrupted.state.transfers.filter((t:any)=>t.orgId==="org-a").length,1);
});
test("admin routes use x-admin-token; organisations can only read their own payout summary",async()=>{
  const api=await fixture();
  const admin=createHmac("sha256","synthetic-admin").update("rootprojx-admin-session").digest("hex");
  async function invoke(path:string,method:string,headers:Record<string,string>,body:any={}) {
    const route=api.router.stack.find((l:any)=>l.route?.path===path&&l.route.methods[method])?.route;
    let status=200;let response:any;
    const res={status(n:number){status=n;return this;},json(v:any){response=v;}};
    const req={headers,body,log:{error(){}}};
    for(const layer of route.stack) {
      let next=false;await layer.handle(req,res,()=>{next=true;});if(!next)break;
    }
    return {status,response};
  }
  for(const [path,method] of [["/admin/payouts","get"],["/admin/payouts/run","post"],["/admin/payouts/mark-sent","post"]]) {
    assert.equal((await invoke(path!,method!,{})).status,401);
  }
  assert.equal((await invoke("/admin/payouts","get",{"x-admin-token":admin})).response.totalQueuedGbp,600);
  assert.equal((await invoke("/admin/payouts/mark-sent","post",{"x-admin-token":admin},{orgId:"org-a",reference:""})).status,400);
  const own=await invoke("/payouts/my","get",{authorization:"Bearer synthetic-org"});
  assert.equal(own.response.pendingGbp,300);
  assert.equal(own.response.payoutMethod,"wise");
});
