// Part 6: real SSR of the web DashboardOverview (esbuild bundle, web React).
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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardOverview } from "@/components/dashboard/overview";
export function renderOverview(summary, opts = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
  const key = ["dashboard-summary", "o1"];
  if (opts.error) {
    qc.getQueryCache().build(qc, { queryKey: key }).setState({ status: "error", error: new Error("ledger down"), data: undefined, fetchStatus: "idle", dataUpdatedAt: 0, errorUpdatedAt: Date.now() });
  } else {
    qc.setQueryData(key, summary);
  }
  return renderToStaticMarkup(h(QueryClientProvider, { client: qc },
    h(DashboardOverview, { orgId: "o1", token: "t", org: opts.org, campaigns: opts.campaigns ?? [] })));
}
`;

type Mod = { renderOverview: (s: unknown, opts?: Record<string, unknown>) => string };

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


const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const summary = {
  raisedGbp: 1234.5, owedGbp: 87.25, nextPayoutAt: "2026-07-03T09:00:00.000Z",
  lastPayout: { amountGbp: 412.8, reference: "WISE-778812", sentAt: "2026-06-19T09:00:00.000Z" },
  recentSupporters: [{ displayName: "Amina O.", createdAt: "2026-06-20T10:00:00.000Z" }],
  campaignRaised: [{ campaignId: "c1", name: "Books for 62 children", raisedGbp: 600 }, { campaignId: "c2", name: "Well repair", raisedGbp: 634.5 }],
  latestUpdateAt: null, impactMetricsStale: false,
};
const campaigns = [{ _id: "c1", name: "Books for 62 children", type: "fundraising", goal: 4800, amountRaised: 1, enabled: true, status: "active" }];

test("dashboard blocks render money first, then supporters, campaigns, updates, impact", async () => {
  const { renderOverview } = await load();
  const html = renderOverview(summary, { campaigns });
  const ids = ["money", "supporters", "campaigns", "updates", "impact"].map((b) => html.indexOf(`block-overview-${b}`));
  assert.ok(ids.every((i) => i >= 0), "all five blocks present");
  assert.deepEqual([...ids].sort((a, b) => a - b), ids, "exact order");
});

test("money block shows all-time raised, ledger owed, per-campaign raised, next payout and payout reference", async () => {
  const { renderOverview } = await load();
  const t = text(renderOverview(summary, { campaigns }));
  const money = t.slice(0, t.indexOf("Supporters"));
  assert.match(money, /£1,234\.50/);
  assert.match(money, /Owed to you now £87\.25/);
  assert.match(money, /Books for 62 children £600/);
  assert.match(money, /Well repair £634\.50/);
  assert.match(money, /Ref WISE-778812/);
  assert.match(money, /3 Jul 2026/);
  assert.ok(!/\b95%|\b100%/.test(t), "no blanket percentage claims");
  // Campaign progress uses summary per-campaign raised, not campaign.amountRaised.
  assert.match(t, /£600 of £4,800/);
});

test("unknown owed and no schedule are never shown as zero or an invented date", async () => {
  const { renderOverview } = await load();
  const t = text(renderOverview({ ...summary, owedGbp: null, nextPayoutAt: null, lastPayout: null }, { campaigns }));
  assert.match(t, /Owed to you now —/);
  assert.match(t, /Not scheduled/);
  assert.match(t, /None yet/);
  assert.ok(!/Owed to you now £0/.test(t));
});

test("summary failure shows one calm refresh notice and unknown values, never invented zeros", async () => {
  const { renderOverview } = await load();
  const t = text(renderOverview(null, { error: true, campaigns }));
  assert.match(t, /Some figures are temporarily unavailable/);
  assert.match(t, /Refresh/);
  assert.match(t, /Raised, all time —/);
  assert.match(t, /Owed to you now —/);
  assert.doesNotMatch(t, /couldn't load|Nothing below is a guess|No supporters yet|haven't shared a post/i);
  assert.ok(!/£0\b/.test(t.slice(0, t.indexOf("Supporters"))));
});

test("partial history failure keeps raised, owed, supporters and campaigns visible with no false empty history", async () => {
  const { renderOverview } = await load();
  const t = text(renderOverview({ ...summary, unavailable: ["payoutHistory"], lastPayout: null }, { campaigns }));
  assert.match(t, /Raised, all time £1,234.50/);
  assert.match(t, /Owed to you now £87.25/);
  assert.match(t, /Amina O\./);
  assert.match(t, /Last payout —/);
  assert.doesNotMatch(t, /None yet|couldn't load/i);
  assert.equal(t.split("Some figures are temporarily unavailable").length - 1, 1);
});

test("on summary failure the confirmed organisation total remains visible", async () => {
  const { renderOverview } = await load();
  const t = text(renderOverview(null, { error: true, org: { totalRaised: 123 }, campaigns }));
  assert.match(t, /Raised, all time £123/);
  assert.match(t, /Owed to you now —/);
});
