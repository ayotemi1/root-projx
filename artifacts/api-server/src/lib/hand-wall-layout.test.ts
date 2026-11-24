import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const output = await build({
  entryPoints: [new URL("../../../web/src/lib/hand-wall-layout.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "node", format: "cjs",
});
const mod = { exports: {} as any };
new Function("require", "module", "exports", output.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
const {layoutHandWall, safeHandCount} = mod.exports;
type Hand = {x:number;y:number;s:number;r:number;o:number};
const bounds = (p:Hand) => {
  const half=p.s*(Math.abs(Math.cos(p.r))+Math.abs(Math.sin(p.r)))/2;
  return {left:p.x-half,right:p.x+half,top:p.y-half,bottom:p.y+half};
};

for (const view of [
  {name:"upright phone",width:320,height:240,compact:true},
  {name:"sideways phone",width:760,height:400,compact:false},
  {name:"desktop",width:880,height:400,compact:false},
  {name:"editor phone preview",width:340,height:255,compact:true},
]) for (const count of [15,50,200]) {
  test(`${count} hands fit ${view.name}, with no collisions and an empty ghost region`,()=>{
    const layout=layoutHandWall(count,view.width,view.height,{compact:view.compact});
    assert.equal(layout.items.length,count,"never replace donors with an uncountable band");
    for(let i=0;i<count;i++){
      const b=bounds(layout.items[i]);
      assert.ok(b.left>=0&&b.right<=view.width&&b.top>=0&&b.bottom<=view.height,`hand ${i} stays visible`);
      for(let j=i+1;j<count;j++){
        const other=bounds(layout.items[j]);
        assert.ok(b.right<=other.left||other.right<=b.left||b.bottom<=other.top||other.bottom<=b.top,
          `rotated bounds of hands ${i} and ${j} do not overlap at all`);
      }
      const g=layout.ghost;
      assert.ok(b.right<=g.x-g.width/2||b.left>=g.x+g.width/2||
        b.bottom<=g.y-g.height/2||b.top>=g.y+g.height/2,"label and ghost cannot obscure donors");
    }
    assert.ok(layout.ghost.x-layout.ghost.width/2>=0);
    assert.ok(layout.ghost.x+layout.ghost.width/2<=view.width+.000001);
    assert.ok(layout.ghost.y-layout.ghost.height/2>=-.000001);
    assert.ok(layout.ghost.y+layout.ghost.height/2<=view.height+.000001);
    const again=layoutHandWall(count,view.width,view.height,{compact:view.compact});
    assert.deepEqual(again,layout,"reloads never randomly relocate anyone");
  });
}

test("walls start at four phone columns and nine desktop columns, then gently shrink hands",()=>{
  for(const compact of [true,false]){
    const width=compact?320:880,height=compact?240:400;
    const layouts=[15,50,200].map(n=>layoutHandWall(n,width,height,{compact}));
    assert.equal(layouts[0].columns,compact?4:9);
    assert.ok(layouts[0].cell>layouts[1].cell);
    assert.ok(layouts[1].cell>layouts[2].cell);
    for(const layout of layouts){
      assert.ok(layout.items[0].y>layout.items.at(-1).y,"first donors are at the bottom");
      assert.ok(Math.abs(layout.items[0].r)<=.1);
    }
  }
});

test("donation-derived jitter is stable and independent of a donor's public name",()=>{
  const keys=Array.from({length:15},(_,i)=>`2026-01-01T00:${String(i).padStart(2,"0")}:00Z`);
  assert.deepEqual(layoutHandWall(15,320,240,{compact:true,keys}),layoutHandWall(15,320,240,{compact:true,keys:[...keys]}));
  const changed=layoutHandWall(15,320,240,{compact:true,keys:keys.map((k,i)=>i===7?k+"x":k)});
  const original=layoutHandWall(15,320,240,{compact:true,keys});
  assert.notDeepEqual(original.items[7],changed.items[7]);
  assert.deepEqual(original.items[6],changed.items[6]);
});

test("all counted hands are individually drawn, including beyond the old 300-hand cap",()=>{
  assert.equal(layoutHandWall(501,320,240,{compact:true}).items.length,501);
  assert.equal(layoutHandWall(0,320,240,{compact:true}).items.length,0);
  assert.ok(layoutHandWall(0,320,240,{compact:true}).ghost);
  assert.equal(layoutHandWall(15,320,240,{reserveGhost:false}).ghost,null);
  assert.equal(layoutHandWall(10,0,240).items.length,0);
  assert.equal(safeHandCount(Infinity),0);
  assert.equal(safeHandCount(NaN),0);
  assert.equal(safeHandCount(-3),0);
  assert.equal(safeHandCount(15.9),15);
});

test("the shared wall paints all hands immediately and reserves the invitation even for a returning donor",async()=>{
  const source=await readFile(new URL("../../../web/src/components/campaign/accumulation-field.tsx",import.meta.url),"utf8");
  assert.match(source,/const reduced = handprint \|\| still \|\| prefersReducedMotion\(\)/);
  assert.match(source,/const showGhost = handprint;/);
  assert.match(source,/const drawn = handprint \? safeCount : Math\.min/);
  assert.match(source,/Your hand here/);
  const page=await readFile(new URL("../../../web/src/components/campaign/campaign-page-view.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(page,/className="rc-you"/,"a receipt must not add a second copy of its canvas hand");
  assert.match(page,/safeHandCount\(campaign.supporterCount \?\? 0\)/);
});
