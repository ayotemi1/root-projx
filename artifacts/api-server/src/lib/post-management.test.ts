import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

// All mutations are mocked. Never archive or delete a real organisation's posts.
const compiled = await build({
  stdin: { contents: `export {default as router} from "../routes/feed.ts";
    export {state} from "posts:state";`, resolveDir: new URL(".", import.meta.url).pathname },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{
    name: "mock-post-management", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url).pathname,
      }));
      b.onResolve({ filter: /^zod$/ }, () => ({
        path: new URL("../../../../lib/api-zod/node_modules/zod/index.cjs", import.meta.url).pathname,
      }));
      b.onResolve({ filter: /^posts:state$/ }, () => ({ path: "state", namespace: "posts" }));
      b.onResolve({ filter: /(?:^|\/)(auth|firebase-rest)\.js$/ }, (a) => ({
        path: a.path.includes("firebase-rest") ? "firebase" : "auth", namespace: "posts",
      }));
      b.onLoad({ filter: /.*/, namespace: "posts" }, (a) => ({
        loader: "js", contents: a.path === "state" ? `
          export const state={posts:[{_id:"post",orgId:"org",content:"Caption",createdAt:"2026-11-01",mediaUrls:["video.mp4"]}],
            writes:[],fail:false,hiddenOrg:false};
        ` : a.path === "auth" ? `
          export const requireAuth=(req,res,next)=>req.user?next():res.status(401).json({error:"Sign in"});
          export const requireApprovedOrganisation=(req,res,next)=>req.user.approved?next():res.status(403).json({error:"Approval required"});
          export const optionalAuth=(req,res,next)=>next();
        ` : `
          import {state} from "posts:state";
          export const getServerToken=async()=>"server";
          export const fsGet=async(c,id)=>c==="users"?{accountType:"organisation",approvalStatus:"approved"}:c==="organisations"?(state.hiddenOrg?null:{_id:id}):state.posts.find(p=>p._id===id)??null;
          export const fsQuery=async(c,filters)=>c==="follows"?[{orgId:"org"}]:state.posts.filter(p=>filters.every(f=>p[f.field]===f.value));
          export const fsCreate=async()=>{throw Error("Not used")};
          export const fsPublishSupporterPost=async()=>{throw Error("Not used")};
          export const fsMutateSupporterShowcase=async(uid,token,decide)=>decide({accountType:"organisation",profileShowcase:{}});
          export const fsPatch=async(c,id,patch)=>{
            if(state.fail)throw Error("Synthetic write failure");
            state.writes.push({c,id,patch});Object.assign(state.posts.find(p=>p._id===id),patch);
          };
        `,
      }));
    },
  }],
});
function fixture() {
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0]!.text)(
    createRequire(import.meta.url), mod, mod.exports);
  const { router, state } = mod.exports;
  return { state, async request(path: string, body?: unknown, user: any = {userId:"org",accountType:"organisation",approved:true}) {
    const method = body === undefined ? "get" : "patch";
    const route = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
    let status = 200, data: any;
    const req = { body, params: {postId:"post",id:"org"}, user, headers:{authorization:"Bearer mocked"},
      log:{error(){},warn(){}} };
    const res = {setHeader(){}, status(code: number){status=code;return this;},json(value: unknown){data=value;}};
    for (const layer of route.stack) {
      let next=false;
      await layer.handle(req,res,()=>{next=true;});
      if (!next) break;
    }
    return {status,data};
  }};
}
const statusRoute="/feed/:postId/status";
const publicRoutes=["/feed/public","/feed","/feed/org/:id"];

test("legacy posts remain published; archive is private on every feed and restore preserves media", async () => {
  const f=fixture();
  for(const path of publicRoutes) assert.equal((await f.request(path)).data.length,1);
  assert.equal((await f.request(statusRoute,{status:"archived"})).status,200);
  for(const path of publicRoutes) assert.deepEqual((await f.request(path)).data,[]);
  const managed=await f.request("/feed/managed");
  assert.equal(managed.data[0].status,"archived");
  assert.equal((await f.request(statusRoute,{status:"published"})).status,200);
  for(const path of publicRoutes) assert.equal((await f.request(path)).data.length,1);
  assert.deepEqual(f.state.posts[0].mediaUrls,["video.mp4"]);
  assert.equal(f.state.posts[0].content,"Caption");
});

test("deleted posts leave management and public feeds and cannot be restored",async()=>{
  const f=fixture();
  assert.equal((await f.request(statusRoute,{status:"deleted"})).status,200);
  for(const path of [...publicRoutes,"/feed/managed"]) assert.deepEqual((await f.request(path)).data,[]);
  assert.equal((await f.request(statusRoute,{status:"published"})).status,404);
  assert.equal(f.state.writes.length,1);
});

test("management rejects unauthenticated, unapproved and other organisations without writes",async()=>{
  const f=fixture();
  assert.equal((await f.request(statusRoute,{status:"deleted"},null)).status,401);
  assert.equal((await f.request("/feed/managed",undefined,null)).status,401);
  for(const user of [
    {userId:"org",accountType:"organisation",approved:false},
    {userId:"other",accountType:"organisation",approved:true},
    {userId:"org",accountType:"supporter",approved:true},
  ]) assert.equal((await f.request(statusRoute,{status:"deleted"},user)).status,403);
  assert.deepEqual((await f.request("/feed/managed",undefined,{userId:"other",accountType:"organisation",approved:true})).data,[]);
  assert.equal(f.state.writes.length,0);
});

test("invalid requests and failed storage writes never report success or hide the post",async()=>{
  const f=fixture();
  for(const body of [{},{status:"draft"},{status:null}]) assert.equal((await f.request(statusRoute,body)).status,400);
  f.state.fail=true;
  assert.equal((await f.request(statusRoute,{status:"archived"})).status,500);
  assert.equal((await f.request("/feed/public")).data.length,1);
  assert.equal(f.state.writes.length,0);
  f.state.hiddenOrg=true;
  assert.deepEqual((await f.request("/feed/public")).data,[]);
});
