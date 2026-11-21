import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";
import { build } from "esbuild";

test("splash uses sampled red and a transparent original-size logo without changing its placement", async () => {
  const web = new URL("../../../web/", import.meta.url);
  const require = createRequire(new URL("package.json", web));
  const result = await build({
    entryPoints: [new URL("src/components/SplashScreen.tsx", web).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
  });
  const mod = { exports: {} as Record<string, any> };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(require, mod, mod.exports);
  const { createElement } = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const html = renderToStaticMarkup(createElement(mod.exports.default));
  assert.match(html, /background-color:#C80503/);
  assert.match(html, /src="\/logo-splash-transparent.png"/);
  assert.doesNotMatch(html, /src="\/logo.jpg"|#E31C23/);
  assert.match(html, /fixed inset-0 z-\[9999\] flex items-center justify-center/);
  assert.match(html, /w-64 max-w-xs animate-pulse/);

  const png = await readFile(new URL("public/logo-splash-transparent.png", web));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1536, "preserve original canvas width/padding");
  assert.equal(png.readUInt32BE(20), 1024, "preserve original canvas height/padding");
  assert.equal(png[24], 8);
  assert.equal(png[25], 6, "RGBA is required, not an opaque flattened logo");
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  // For the very first pixel, left/up neighbours are zero for every PNG filter;
  // the fourth channel is therefore its actual alpha without a full decoder.
  assert.equal(inflateSync(Buffer.concat(chunks))[4], 0, "the asset background corner must be transparent");
});
