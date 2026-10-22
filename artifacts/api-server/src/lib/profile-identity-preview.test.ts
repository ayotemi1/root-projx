// Uploaded media is not saved profile content until its attachment PATCH succeeds.
// Exercise the real IdentitySection's preview registration, not a duplicated helper.
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
      import { IdentitySection } from "@/components/profile-editor/sections";
      import { state } from "identity-save-fixture";
      export async function flushIdentity(results) {
        state.results = results; state.calls = [];
        const element = IdentitySection({ org: { name: "Org", country: "Kenya" }, orgId: "org", userId: "org", token: "synthetic", onSaved() {} });
        return { saved: await element.props.onFlush(), calls: state.calls };
      }`,
    resolveDir: webRoot, loader: "tsx",
  },
  bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
  alias: { "@": path.join(webRoot, "src") },
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  plugins: [{
    name: "identity-save-fixture",
    setup(b) {
      b.onResolve({ filter: /^react(\/.*)?$/ }, a => ({ path: webRequire.resolve(a.path), external: true }));
      b.onResolve({ filter: /use-section-autosave$|^identity-save-fixture$/ }, () => ({ path: "saves", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
        loader: "js",
        contents: `
          export const state = { results: {}, calls: [] };
          export function useSectionAutosave(opts) {
            return { value: opts.initial, status: "idle", flush: async () => {
              state.calls.push(opts.section); return state.results[opts.section] ?? true;
            }};
          }`,
      }));
    },
  }],
});
const dir = mkdtempSync(path.join(tmpdir(), "identity-preview-"));
const file = path.join(dir, "bundle.mjs");
writeFileSync(file, out.outputFiles[0].text);
const { flushIdentity } = await import(pathToFileURL(file).href) as {
  flushIdentity: (results: Record<string, boolean>) => Promise<{ saved: boolean; calls: string[] }>;
};

test("identity preview waits for text, logo and cover attachment saves", async () => {
  const result = await flushIdentity({});
  assert.equal(result.saved, true);
  assert.deepEqual(result.calls.sort(), ["identity", "identity-cover", "identity-logo"]);
});

for (const section of ["identity", "identity-logo", "identity-cover"]) {
  test(`identity preview refuses stale content when ${section} fails`, async () => {
    assert.equal((await flushIdentity({ [section]: false })).saved, false);
  });
}
