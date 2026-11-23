import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { campaignPageContent } from "./campaign-page-content.ts";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { withHovContent } from "../../scripts/lib/hov-content.mjs";

const source = JSON.parse(await readFile(new URL("../../scripts/content/hov-campaign.json", import.meta.url), "utf8"));

test("the HOV import includes all substantive PDF sections without placeholder figures or invented results", () => {
  assert.equal(source.breakdown.length, 3);
  assert.equal(source.phases.length, 5);
  assert.ok(source.phases.every((phase: any) => phase.completed === false));
  assert.ok(campaignPageContent(source.pageContent));
  const text = JSON.stringify(source);
  assert.doesNotMatch(text, /1,?247|50%|18%|32%|\[.*?to confirm|First name L|30 places|three months/i);
  assert.match(text, /High Commission of Canada/);
  assert.match(text, /quarter/);
  assert.match(text, /intended outcomes/);
});

test("importing the PDF copy never overwrites real funds, payout data, identity or publication", () => {
  const original = {
    _id: "campaign", enabled: false, name: "Out of Many Hands", goal: 4567, amountRaised: 9,
    partnerFunding: { amount: 1234, type: "committed" }, partnerFundingMatchedGbp: 0,
    phases: [{ id: "parents-childcare", completed: true }], imageUrl: "https://example.test/real.jpg",
    publicId: "stable-link", customOwnerField: "Keep me",
  };
  const result = withHovContent(original, source);
  for (const key of Object.keys(original).filter(key => key !== "phases")) {
    assert.deepEqual(result[key], original[key], key);
  }
  assert.equal(result.phases.find((p: any) => p.id === "parents-childcare").completed, true);
  assert.equal(result.pageContent.storyHeading, "The storm took more than roofs");
  for (const enabled of [true, undefined]) {
    const published = { ...original, enabled, description: "Existing public story", editorDraft: { custom: "Owner's draft" } };
    const changed = withHovContent(published, source);
    assert.equal(changed.description, published.description);
    assert.equal(changed.editorDraft.custom, "Owner's draft");
    assert.equal(changed.editorDraft.description, source.description);
    assert.equal(changed.enabled, enabled);
  }
});

test("campaign editorial copy rejects HTML, unexpected data and financial fields", () => {
  for (const value of [{ storyHeading: "<script>alert(1)</script>" }, { totalRaised: "999" },
    { cohortBody: 4 }, { programmeIntro: "x".repeat(5001) }, []]) {
    assert.throws(() => campaignPageContent(value));
  }
  assert.equal(campaignPageContent(null), null);
});

test("all imported sections render through the shared campaign component in public and owner preview modes", async () => {
  const root = new URL("../../../web/", import.meta.url);
  const require = createRequire(new URL("package.json", root));
  const result = await build({
    entryPoints: [new URL("src/components/campaign/campaign-page-view.tsx", root).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    plugins: [{ name: "signed-out-bookmarks", setup(b) {
      b.onResolve({ filter: /bookmarks\/BookmarkButton/ }, () => ({ path: "guest", namespace: "bookmark" }));
      b.onLoad({ filter: /.*/, namespace: "bookmark" }, () => ({ contents: "export const BookmarkButton=()=>null;" }));
    } }],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(require, mod, mod.exports);
  const { createElement } = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  // Wouter's static hook is needed for real shared Links in raw Node SSR.
  const { Router } = require("wouter");
  const organisation = { _id: "hov", name: "Humanity Ova Vanity", country: "Jamaica", team: [] };
  const campaign = { _id: "out-of-many-hands", orgId: "hov", name: "Out of Many Hands",
    type: "fundraising", amountRaised: 0, goal: 0, supporterCount: 0, recentSupporters: [],
    status: "active", enabled: false, ...source };
  for (const preview of [false, true]) {
    const html = renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
      createElement(mod.exports.CampaignPageView, { campaign, organisation, preview, layout: "phone" })));
    const text = html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
    for (const key of ["storyHeading", "programmeHeading", "programmeIntro", "programmeSummary", "programmeAfterword",
      "outcomesIntro", "outcomesStatus", "supportHeading", "supportBody",
      "cohortHeading", "cohortBody", "cohortNote", "fundingNote", "organisationNote",
      "supportersHeading", "shareHeading", "shareBody", "donateLabel"]) {
      assert.ok(text.includes(source.pageContent[key].replace(/\s+/g, " ")), `Missing ${key} in ${preview ? "preview" : "public"}`);
    }
    for (const trade of source.breakdown) assert.ok(text.includes(trade.label));
    for (const outcome of source.phases) assert.ok(text.includes(outcome.title));
    assert.doesNotMatch(html, /text-outcomes-note/);
    assert.match(html, /campaign-fee-breakdown/);
    assert.match(text, /£2\.85/);
    assert.match(text, /£2\.60/);
    assert.doesNotMatch(text, /1,247|£ amount|First name L|→|doubles/i);
  }
});
