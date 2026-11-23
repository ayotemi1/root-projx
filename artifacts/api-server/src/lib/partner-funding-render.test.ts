// Real React SSR regression tests: bundles the actual web CampaignPageView and
// GuestDonateSheet with esbuild and renders them to HTML with the web app's React.
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
import { CampaignPageView } from "@/components/campaign/campaign-page-view";
import { GuestDonateSheet } from "@/components/GuestDonateSheet";
export function renderPage(campaign, organisation) {
  return renderToStaticMarkup(h(CampaignPageView, { campaign, organisation, layout: "phone", onDonate: () => {} }));
}
export function renderPreview(campaign, organisation) {
  return renderToStaticMarkup(h(CampaignPageView, { campaign, organisation, layout: "phone", preview: true }));
}
export function renderSheet(props) {
  return renderToStaticMarkup(h(GuestDonateSheet, { open: true, onClose: () => {}, orgId: "o1", orgName: "Kisumu Readers", campaignId: "c1", ...props }));
}
`;

type Mod = {
  renderPage: (c: unknown, o: unknown) => string;
  renderPreview: (c: unknown, o: unknown) => string;
  renderSheet: (p: Record<string, unknown>) => string;
};

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
          // Campaign rendering is a signed-out view; auth-bound bookmarking is
          // exercised separately with a real account, not during static SSR.
          b.onResolve({ filter: /bookmarks\/BookmarkButton/ }, () => ({ path: "guest", namespace: "bookmark" }));
          b.onLoad({ filter: /.*/, namespace: "bookmark" }, () => ({ contents: "export const BookmarkButton=()=>null;" }));
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
    const dir = mkdtempSync(path.join(tmpdir(), "pf-render-"));
    const file = path.join(dir, "bundle.mjs");
    writeFileSync(file, out.outputFiles[0].text);
    return (await import(pathToFileURL(file).href)) as Mod;
  })();
  return modPromise;
}

const org = {
  _id: "o1", name: "Kisumu Readers", country: "Kenya", city: "Kisumu", category: "Education",
  description: "We teach reading.", logo: null, coverImage: null, verified: true, shortDescription: "Reading club", team: [],
};

const campaign = (over: Record<string, unknown>) => ({
  _id: "c1", orgId: "o1", name: "Books for 62 children", description: "Story ".repeat(50),
  type: "fundraising", goal: 4800, amountRaised: 600, volunteersNeeded: 0, deadline: null, imageUrl: null,
  status: "active", enabled: true, createdAt: "2025-01-01T00:00:00.000Z", supporterCount: 12, recentSupporters: [],
  theme: { primaryColor: "#B50000", accentColor: "#F5B800", backgroundColor: "#FFF9F2", textColor: "#1A1A1A" },
  ...over,
});

const committed = { amount: 1000, funderName: "the High Commission", type: "committed" };
const matching = { amount: 500, funderName: "Lakeside Trust", type: "matching", matchRatio: 1, matchCap: 500 };
const noClaim = (html: string) => {
  const text = html.replace(/<[^>]*>/g, " ");
  assert.ok(!text.includes("→"), "no arrow");
  assert.ok(!/doubl|becomes|×\s*2|\b2x\b|£1 for £1/i.test(text), "no doubling/multiplier claim");
};

test("committed partner funding: page shows three honest segments and no match claim", async () => {
  const { renderPage } = await load();
  const html = renderPage(campaign({ partnerFunding: committed, partnerFundingMatchedGbp: 0 }), org);
  assert.match(html, /£1,000 already committed by the High Commission/);
  assert.match(html, /Raised here/);
  assert.match(html, /Still needed/);
  assert.ok(!/will match|Matching has been/i.test(html));
  noClaim(html);
});

test("committed partner funding: open donate sheet shows no arrow or multiplier", async () => {
  const { renderSheet } = await load();
  const html = renderSheet({ partnerFunding: committed, partnerFundingMatchedGbp: 0 });
  assert.ok(!html.includes('data-testid="block-match-boost"'));
  noClaim(html);
});

test("matching with funds remaining: sheet shows capped programme impact arrow", async () => {
  const { renderSheet, renderPage } = await load();
  const html = renderSheet({ partnerFunding: matching, partnerFundingMatchedGbp: 100 });
  assert.ok(html.includes('data-testid="block-match-boost"'));
  assert.ok(html.includes("→"));
  assert.match(html, /£25.*→.*£50/s);
  assert.match(html, /charged £25\.00/);
  const page = renderPage(campaign({ partnerFunding: matching, partnerFundingMatchedGbp: 100 }), org);
  assert.match(page, /will match gifts £1 for £1, up to £500/);
  assert.match(page, /£100 matched so far; £400 of matching is still available/);
  // The pledge is not presented as money already received.
  assert.ok(!/£500 already committed/.test(page));
});

test("matching partially available: arrow capped by what is left", async () => {
  const { renderSheet } = await load();
  const html = renderSheet({ partnerFunding: matching, partnerFundingMatchedGbp: 490 });
  assert.match(html, /£25.*→.*£35/s);
});

test("matching cap used up: no arrow anywhere, says fully claimed", async () => {
  const { renderSheet, renderPage } = await load();
  const sheet = renderSheet({ partnerFunding: matching, partnerFundingMatchedGbp: 500 });
  noClaim(sheet);
  assert.match(sheet, /Matching has been fully claimed\./);
  const page = renderPage(campaign({ partnerFunding: matching, partnerFundingMatchedGbp: 500 }), org);
  noClaim(page);
  assert.match(page, /Matching has been fully claimed\./);
  assert.ok(!/will match/i.test(page));
});

test("PDF-inspired campaign template uses real data and leaves sparse optional sections out", async () => {
  const { renderPage } = await load();
  const html = renderPage(campaign({
    name: "A book in every home", tagline: "Small reading circles, lasting change",
    description: "First paragraph.\n\nSecond paragraph.", goal: 4800, amountRaised: 600,
    partnerFunding: null, phases: [], breakdown: [], locations: [], video: null,
  }), org);
  assert.match(html, /A book in every home/);
  assert.match(html, /Small reading circles, lasting change/);
  assert.match(html, /First paragraph\./);
  assert.match(html, /Second paragraph\./);
  assert.match(html, /data-tour-id="campaign-accumulation"/);
  assert.match(html, /data-testid="block-campaign-hero"/);
  assert.match(html, /data-testid="block-money-disclosure"/);
  assert.match(html, /data-testid="block-share"/);
  for (const absent of ["list-campaign-milestones", "list-campaign-breakdown", "list-campaign-locations", "block-campaign-video", "text-partner-funding"]) {
    assert.ok(!html.includes(`data-testid="${absent}"`), `${absent} should not render without content`);
  }
});

test("the same campaign template disables payments and sharing in draft preview", async () => {
  const { renderPreview } = await load();
  const html = renderPreview(campaign({}), org);
  assert.match(html, /data-testid="view-campaign-preview"/);
  for (const action of ["button-header-campaign-action", "button-donate-campaign", "button-donate-campaign-strip", "button-share-campaign", "button-copy-link"]) {
    assert.match(html, new RegExp(`<button[^>]*disabled=""[^>]*data-testid="${action}"`), action);
  }
});
