// The tour anchor must survive Choose image -> crop -> upload -> retry.
// Anchoring the conditional chooser button stranded first-time organisations.
import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = fileURLToPath(new URL("../../../web/", import.meta.url));
const webRequire = createRequire(path.join(webRoot, "package.json"));
const out = await build({
  stdin: {
    contents: `
      import { renderToStaticMarkup } from "react-dom/server";
      import { ImageUploadField } from "@/components/profile-editor/image-upload-field";
      import { setPhase } from "image-tour-state";
      export function render(phase, field = "logo") {
        setPhase(phase);
        return renderToStaticMarkup(ImageUploadField({
          id: "pe-" + field, label: field, guidance: "Upload a photo",
          spec: { aspect: 1, minWidth: 400, minHeight: 400, width: 400, height: 400 },
          currentUrl: null, token: "synthetic", onUploaded() {},
          tourId: "profile-identity-" + field
        }));
      }`,
    resolveDir: webRoot, loader: "tsx",
  },
  bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
  alias: { "@": path.join(webRoot, "src") },
  define: { "import.meta.env.BASE_URL": '"/"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  plugins: [{
    name: "image-tour-state",
    setup(b) {
      b.onResolve({ filter: /^image-tour-state$/ }, () => ({ path: "hooks", namespace: "fixture" }));
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, a => {
        if (a.path === "react" && a.importer.endsWith("image-upload-field.tsx"))
          return { path: "hooks", namespace: "fixture" };
        return { path: webRequire.resolve(a.path), external: true };
      });
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
        loader: "js",
        contents: `
          let values = [], index = 0;
          export function setPhase(phase) {
            const image = { src: "synthetic.png", naturalWidth: 800, naturalHeight: 600 };
            values = [phase === "idle" ? null : image, 0.5,
              phase === "uploading" ? 0.5 : null,
              phase === "error" ? "Synthetic upload failed" : null,
              phase === "error" ? {} : null];
            index = 0;
          }
          export const useState = () => [values[index++], () => {}];
          export const useRef = () => ({ current: null });
          export const useEffect = () => {};`,
      }));
    },
  }],
});
const file = path.join(mkdtempSync(path.join(tmpdir(), "image-tour-")), "bundle.mjs");
writeFileSync(file, out.outputFiles[0].text);
const { render } = await import(pathToFileURL(file).href) as { render: (phase: string, field: string) => string };

for (const field of ["logo", "cover"]) {
  test(`${field} tour anchor stays on the upload panel through crop, upload and failure`, () => {
    for (const phase of ["idle", "crop", "uploading", "error"]) {
      const html = render(phase, field);
      assert.match(html, new RegExp(`<div[^>]*data-tour-id="profile-identity-${field}"`));
      assert.equal((html.match(new RegExp(`data-tour-id="profile-identity-${field}"`, "g")) ?? []).length, 1);
      if (phase === "idle") assert.match(html, /Choose image/);
      else assert.match(html, new RegExp(`data-testid="button-upload-pe-${field}"`));
      if (phase === "crop") assert.match(html, /data-save-state="dirty"/);
      if (phase === "uploading") assert.match(html, /data-save-state="saving"/);
      if (phase === "error") {
        assert.match(html, /data-save-state="error"/);
        assert.match(html, new RegExp(`data-testid="button-retry-upload-pe-${field}"`));
      }
    }
  });
}
