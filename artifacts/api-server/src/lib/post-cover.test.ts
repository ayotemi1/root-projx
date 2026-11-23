import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
const source = new URL("../../../web/src/components/post-management/ChangeCoverDialog.tsx", import.meta.url);
const result = await build({ entryPoints: [source.pathname], bundle: true, write: false, platform: "node",
  format: "cjs", packages: "external", loader: { ".css": "empty" } });
const mod = { exports: {} as any };
new Function("require", "module", "exports", result.outputFiles[0]!.text)(
  createRequire(new URL("../../../web/package.json", import.meta.url)), mod, mod.exports);
const { coverSourceRect, defaultCoverTime } = mod.exports;
test("cover crops fill 4:5 without stretching and positions stay within the original", () => {
  for (const [w, h] of [[1920, 1080], [1080, 1920], [1080, 1350], [2400, 2400]]) {
    for (const zoom of [1, 2, 3, 20]) for (const x of [-2, 0, 2]) for (const y of [-2, 0, 2]) {
      const r = coverSourceRect(w, h, { zoom, x, y });
      assert.ok(Math.abs(r.sw / r.sh - 4 / 5) < 0.00001);
      assert.ok(r.sw > 0 && r.sh > 0 && r.sx >= 0 && r.sy >= 0);
      assert.ok(r.sx + r.sw <= w + 0.00001 && r.sy + r.sh <= h + 0.00001);
    }
  }
  assert.deepEqual(coverSourceRect(1080, 1350, { zoom: 1, x: 0, y: 0 }), { sx: 0, sy: 0, sw: 1080, sh: 1350 });
});
test("new video cover defaults to one second, bounded for short clips", () => {
  assert.equal(defaultCoverTime(51), 1);
  assert.equal(defaultCoverTime(0.5), 0.5);
  assert.equal(defaultCoverTime(Infinity), 0);
  assert.equal(defaultCoverTime(0), 0);
});
