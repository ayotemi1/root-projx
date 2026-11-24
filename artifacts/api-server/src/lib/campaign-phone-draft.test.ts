import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

async function fixture(campaignOverride: Record<string, unknown> = {}) {
  const result = await build({
    stdin: { contents: `
      export {useCampaignDraft,campaignDraftKey} from "./components/campaign-builder/use-campaign-draft.ts";
      export * as navigation from "./lib/supporter-navigation.ts";
      export {state} from "draft-fixture";
    `, resolveDir: new URL("../../../web/src/", import.meta.url).pathname, loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    define: {"import.meta.env": JSON.stringify({BASE_URL:"/"})},
    alias: {"@": new URL("../../../web/src/", import.meta.url).pathname},
    plugins: [{name:"draft-lifecycle-fixture", setup(b) {
      b.onResolve({filter:/^react$|^draft-fixture$|\/lib\/api$/}, a => ({
        path:a.path === "react" ? "react" : a.path === "draft-fixture" ? "state" : "api",
        namespace:"draft-fixture",
      }));
      b.onLoad({filter:/.*/,namespace:"draft-fixture"}, a => ({loader:"js",contents:
        a.path === "state" ? `export const state={slots:[],cursor:0,effects:[],calls:[],saved:[],fail:false,gate:null};` :
        a.path === "react" ? `
          import {state} from "draft-fixture";
          export const useRef=v=>{const n=state.cursor++;return state.slots[n]??(state.slots[n]={current:v});};
          export const useState=v=>{const n=state.cursor++;if(!(n in state.slots))state.slots[n]=typeof v==="function"?v():v;return[state.slots[n],v=>state.slots[n]=typeof v==="function"?v(state.slots[n]):v];};
          export const useCallback=fn=>fn;
          export const useEffect=fn=>{state.effects.push(fn);};
        ` : `
          import {state} from "draft-fixture";
          export async function saveCampaignDraft(org,id,patch,token){
            state.calls.push({org,id,patch,token});
            if(state.gate)await state.gate;
            if(state.fail)throw Error("NetworkError");
            const saved={...state.campaign,...patch,_id:id};state.campaign=saved;return saved;
          }
        `,
      }));
    }}],
  });
  const timers = new Map<number, () => void>(); let timerId=0;
  const events = new Map<string, () => void>();
  const storage = new Map<string,string>();
  const document = {
    visibilityState:"visible",
    addEventListener:(e:string,fn:()=>void)=>events.set(e,fn),
    removeEventListener:(e:string)=>events.delete(e),
  };
  const window = {addEventListener(){}, removeEventListener(){}};
  const localStorage = {getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)};
  const mod={exports:{} as any};
  new Function("require","module","exports","window","document","localStorage","setTimeout","clearTimeout",result.outputFiles[0]!.text)(
    createRequire(import.meta.url),mod,mod.exports,window,document,localStorage,
    (fn:()=>void)=>{timers.set(++timerId,fn);return timerId;},(id:number)=>timers.delete(id),
  );
  const {state,useCampaignDraft,campaignDraftKey}=mod.exports;
  state.campaign={_id:"phone-draft",name:"",description:"",type:"fundraising",status:"active",enabled:false,
    goal:0,amountRaised:0,deadline:null,imageUrl:null,phases:[],createdAt:"2026-11-24",updatedAt:"2026-11-24",...campaignOverride};
  const hook=useCampaignDraft({campaign:state.campaign,orgId:"lifeyard",userId:"owner",token:"synthetic",
    onSaved:(c:unknown)=>state.saved.push(c)});
  const cleanups=state.effects.map((fn:()=>unknown)=>fn()).filter((fn:unknown)=>typeof fn==="function");
  return {hook,state,timers,events,document,storage,navigation:mod.exports.navigation,key:campaignDraftKey("owner","lifeyard","phone-draft"),
    unmount:()=>cleanups.forEach((fn:()=>void)=>fn())};
}
const settle=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};

test("phone draft automatically saves to the server and can be opened on a second device", async()=>{
  const f=await fixture();
  f.hook.setValue((v:any)=>({...v,name:"LifeYard phone draft",tagline:"Keep the rhythm going"}));
  for(const fn of [...f.timers.values()])fn();
  await settle();
  assert.equal(f.state.saved.at(-1).name,"LifeYard phone draft");
  assert.equal(f.storage.has(f.key),false);
  const laptop=await fixture(f.state.saved.at(-1));
  assert.equal(laptop.hook.value.name,"LifeYard phone draft");
  assert.equal(laptop.hook.recovered,false,"second device reads the server, not a phone-only backup");
  f.unmount();laptop.unmount();
});

test("leaving before the debounce still saves the latest phone edit",async()=>{
  const f=await fixture();
  f.hook.setValue((v:any)=>({...v,name:"Saved when leaving"}));
  assert.equal(f.state.calls.length,0);
  f.unmount();
  await settle();
  assert.equal(f.state.calls.length,1);
  assert.equal(f.state.saved.at(-1).name,"Saved when leaving");
  assert.equal(f.timers.size,0);
});

test("navigation during an in-flight save queues later edits instead of losing them",async()=>{
  const f=await fixture();
  let release!:()=>void;
  f.state.gate=new Promise<void>(r=>{release=r;});
  f.hook.setValue((v:any)=>({...v,name:"First"}));
  const first=f.hook.commit();
  await settle();
  f.hook.setValue((v:any)=>({...v,name:"Latest"}));
  f.unmount();
  release();
  await first;await settle();
  assert.equal(f.state.saved.at(-1).name,"Latest");
  assert.equal(f.state.calls.length,2);
});

test("backgrounding a phone triggers a save without waiting for the debounce",async()=>{
  const f=await fixture();
  f.hook.setValue((v:any)=>({...v,name:"Background save"}));
  f.document.visibilityState="hidden";f.events.get("visibilitychange")!();
  await settle();
  assert.equal(f.state.saved.at(-1).name,"Background save");
  f.unmount();
});

test("a failed phone save keeps its recovery copy and never reports server success",async()=>{
  const f=await fixture();f.state.fail=true;
  f.hook.setValue((v:any)=>({...v,name:"Keep my draft"}));
  assert.equal(await f.hook.flush(),false);
  assert.equal(f.state.saved.length,0);
  assert.match(f.storage.get(f.key)!,/Keep my draft/);
  f.unmount();await settle();
  assert.match(f.storage.get(f.key)!,/Keep my draft/);
});

test("campaign shortcuts preserve owner and admin-managed organisation routes",async()=>{
  const f=await fixture();
  const href=f.navigation.organisationDashboardHref;
  assert.equal(href("owner-token","yard","tab=campaigns&new=1"),"/dashboard?tab=campaigns&new=1");
  assert.equal(href("org-admin.synthetic","yard","tab=campaigns&new=1"),"/admin/organisations/yard/manage?tab=campaigns&new=1");
  assert.equal(f.hook.step,1,"a new campaign starts at Ask");
  f.unmount();
});

test("campaign lists separate drafts, live and ended without ending a campaign early",async()=>{
  const f=await fixture(), group=f.navigation.campaignManagerGroup;
  const noon=Date.parse("2026-11-24T12:00:00Z");
  assert.equal(group({enabled:true,status:"active",deadline:"2026-11-24"},noon),"live");
  assert.equal(group({enabled:true,status:"active",deadline:"2026-11-23"},noon),"ended");
  assert.equal(group({enabled:false,status:"active",deadline:"2026-11-23"},noon),"draft");
  assert.equal(group({enabled:false,status:"completed"},noon),"ended");
  f.unmount();
});

test("organisation campaign menu does not add Campaign to supporter options",async()=>{
  const menu=await readFile(new URL("../../../web/src/components/supporter/SupporterCreateMenu.tsx",import.meta.url),"utf8");
  const existing=menu.slice(menu.indexOf("const options:"),menu.indexOf("const DESKTOP"));
  assert.doesNotMatch(existing,/[Cc]ampaign/);
  assert.match(menu,/isAuthenticated && isApprovedOrganisation\(user\)/);
  assert.match(menu,/data-testid="sheet-create-campaign"/);
  assert.match(menu,/data-testid="sheet-create-post"/);
  assert.match(menu,/data-testid="sheet-create-story"/);
});
