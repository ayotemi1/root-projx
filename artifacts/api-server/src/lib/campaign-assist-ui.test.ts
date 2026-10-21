// Writing assistant UI: real SSR of AssistButton plus the actual request/accept logic.
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../../web");
const webRequire = createRequire(path.join(webRoot, "package.json"));
const apiRequire = createRequire(path.resolve(here, "../../package.json"));

function loadEsbuild(): typeof import("esbuild") {
  for (const r of [apiRequire, webRequire]) {
    try { return r("esbuild"); } catch { /* try next */ }
  }
  return createRequire(path.resolve(webRoot, "../../package.json"))("esbuild");
}

const ENTRY = `
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistButton } from "@/components/campaign-builder/fields";
export function renderAssist(enabled) {
  return renderToStaticMarkup(h(AssistButton, { enabled, campaignId: "c1", field: "description", token: "t", fieldLabel: "your story", onAccept: () => {} }));
}
`;

type Mod = { renderAssist: (enabled: boolean) => string };

let modPromise: Promise<Mod> | null = null;
function load(): Promise<Mod> {
  modPromise ??= (async () => {
    const esbuild = loadEsbuild();
    const reactIds = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/server", "react-dom"];
    const out = await esbuild.build({
      stdin: { contents: ENTRY, resolveDir: webRoot, loader: "tsx" },
      bundle: true, write: false, format: "esm", platform: "node", target: "node20",
      jsx: "automatic", logLevel: "silent",
      // Bundled CJS deps require React: give them a real require.
      banner: { js: `import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);` },
      alias: { "@": path.join(webRoot, "src") },
      nodePaths: [path.join(webRoot, "node_modules")],
      define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
      loader: { ".svg": "text", ".png": "dataurl", ".css": "empty" },
      plugins: [{
        name: "web-react-and-mocks",
        setup(b) {
          // Use exactly the web app's React, loaded at runtime.
          b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) =>
            reactIds.includes(a.path) ? { path: webRequire.resolve(a.path), external: true } : undefined);
          // wouter Link → plain anchor; no router needed for SSR.
          b.onResolve({ filter: /^wouter$/ }, () => ({ path: "wouter", namespace: "mock" }));
          b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
            loader: "tsx", resolveDir: webRoot,
            contents: `import { createElement as h } from "react";
              export const Link = ({ href, children, ...p }) => h("a", { href, ...p }, children);
              export const useLocation = () => ["/", () => {}];
              export const useSearch = () => "";
              export const useParams = () => ({});`,
          }));
        },
      }],
    });
    const dir = mkdtempSync(path.join(tmpdir(), "dash-render-"));
    const file = path.join(dir, "bundle.mjs");
    writeFileSync(file, out.outputFiles[0].text);
    return (await import(pathToFileURL(file).href)) as Mod;
  })();
  return modPromise;
}


const assistUrl = new URL("../../../web/src/components/campaign-builder/assist-logic.ts", import.meta.url).href;
const { acceptPatch, runAssistRequest } = (await import(assistUrl)) as {
  acceptPatch: (d: unknown, field: string, text: string, i?: number, max?: number) => unknown;
  runAssistRequest: (before: (() => Promise<boolean>) | undefined, req: () => Promise<unknown>) => Promise<{ k: string; text?: string }>;
};

const draft = {
  tagline: "old", description: "old story", assistUsed: false,
  breakdown: [{ label: "£25", detail: "a" }, { label: "£50", detail: "b" }],
  locations: [{ name: "Hall", description: "x", photoUrl: null }],
} as never;

test("flag off renders nothing; flag on renders only the trigger, no suggestion", async () => {
  const { renderAssist } = await load();
  assert.equal(renderAssist(false), "");
  const on = renderAssist(true);
  assert.match(on, /Help me write/);
  assert.ok(!/Use this|text-assist-suggestion/.test(on));
});

test("ask flushes the current draft first and only then calls the API", async () => {
  const order: string[] = [];
  const r = await runAssistRequest(async () => { order.push("flush"); return true; }, async () => { order.push("api"); return { suggestion: "New words" }; });
  assert.deepEqual(order, ["flush", "api"]);
  assert.deepEqual(r, { k: "suggestion", text: "New words" });
});

test("failed or throwing flush makes no API call", async () => {
  let calls = 0;
  const api = async () => { calls++; return { suggestion: "x" }; };
  assert.equal((await runAssistRequest(async () => false, api)).k, "unsaved");
  assert.equal((await runAssistRequest(async () => { throw new Error("net"); }, api)).k, "unsaved");
  assert.equal(calls, 0);
});

test("empty/invalid suggestion and API errors never produce text", async () => {
  assert.equal((await runAssistRequest(undefined, async () => ({ suggestion: "  " }))).k, "invalid");
  assert.equal((await runAssistRequest(undefined, async () => null)).k, "invalid");
  assert.equal((await runAssistRequest(undefined, async () => { throw new Error("503"); })).k, "failed");
});

test("acceptance is one atomic patch with assistUsed; other rows untouched; draft not mutated", () => {
  const before = JSON.stringify(draft);
  const p = acceptPatch(draft, "breakdown.detail", "childcare on site", 1) as Record<string, unknown>;
  assert.deepEqual(p, { breakdown: [{ label: "£25", detail: "a" }, { label: "£50", detail: "childcare on site" }], assistUsed: true });
  const l = acceptPatch(draft, "locations.description", "Saturday classes", 0) as Record<string, unknown>;
  assert.deepEqual(l, { locations: [{ name: "Hall", description: "Saturday classes", photoUrl: null }], assistUsed: true });
  assert.deepEqual(acceptPatch(draft, "tagline", "abcdef", 0, 3), { tagline: "abc", assistUsed: true });
  assert.deepEqual(acceptPatch(draft, "description", "s"), { description: "s", assistUsed: true });
  assert.equal(JSON.stringify(draft), before);
});
