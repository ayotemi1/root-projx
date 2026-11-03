import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

// Bundle the real web controls with the web React instance. No network calls or
// charges: click wiring, recipient text and checkout payload are tested locally.
const webRoot = new URL("../../../web/", import.meta.url);
const webRequire = createRequire(new URL("package.json", webRoot));
const { createElement } = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const { Router } = webRequire("wouter");
const renderSheet = (Sheet: any, props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(Router, {hook: () => ["/", () => {}]},
    createElement(Sheet, {open: true, onClose() {}, orgId: "org-1", orgName: "Community Trust", ...props})));

async function loadComponent(path: string) {
  const result = await build({
    entryPoints: [new URL(path, webRoot).pathname],
    bundle: true, write: false, format: "cjs", platform: "node",
    packages: "external", jsx: "automatic",
    alias: { "@": new URL("src/", webRoot).pathname },
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(webRequire, mod, mod.exports);
  return mod.exports;
}

test("USD campaign sheet displays dollars and sends USD without changing organisation-level GBP", async () => {
  const { GuestDonateSheet, guestCheckoutBody } = await loadComponent("src/components/GuestDonateSheet.tsx");
  const html = renderSheet(GuestDonateSheet, { campaignId: "usd-campaign", campaignName: "Skills",
    currency: "usd" });
  assert.match(html, /\$25/);
  assert.doesNotMatch(html, /£25/);
  assert.equal(guestCheckoutBody("org", 500, "usd-campaign", "anon", false, "", "usd").currency, "usd");
  const orgHtml = renderSheet(GuestDonateSheet, { currency: "usd" });
  assert.match(orgHtml, /£25/);
});

test("real campaign public/preview component renders multiple captioned videos, USD totals, and no empty video boxes", async () => {
  const { CampaignPageView } = await loadComponent("src/components/campaign/campaign-page-view.tsx");
  const organisation = { _id: "org", name: "Community Trust", country: "Jamaica" };
  const campaign = { _id: "campaign", name: "Skills for life", currency: "usd", type: "fundraising",
    goal: 1000, amountRaised: 25, description: "", phases: [], status: "active", enabled: true,
    videos: [
      { url: "/api/uploads/object/first.mp4", posterUrl: null, captionsUrl: null, caption: "First workshop" },
      { url: "https://youtu.be/test123", posterUrl: null, captionsUrl: null, caption: "Building together" },
      { url: "", posterUrl: null, captionsUrl: null, caption: "Not uploaded" },
    ],
  };
  const render = (c: any, preview: boolean) => renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
    createElement(CampaignPageView, { campaign: c, organisation, preview, layout: "phone" })));
  for (const preview of [true, false]) {
    const html = render(campaign, preview);
    assert.equal((html.match(/data-testid="block-campaign-video"/g) ?? []).length, 2);
    assert.match(html, /First workshop/);
    assert.match(html, /Building together/);
    assert.doesNotMatch(html, /Not uploaded/);
    assert.match(html, /\$1,000/);
    assert.doesNotMatch(html, /£1,000/);
    assert.equal((render({ ...campaign, videos: [], video: campaign.videos[0] }, preview)
      .match(/data-testid="block-campaign-video"/g) ?? []).length, 0);
    const { videos, ...legacy } = campaign;
    assert.equal((render({ ...legacy, video: campaign.videos[0] }, preview)
      .match(/data-testid="block-campaign-video"/g) ?? []).length, 1);
  }
});

test("campaign cards expose a full-card accessible link without nesting the donation button", async () => {
  const { CampaignCardLink } = await loadComponent("src/components/campaign-card-link.tsx");
  const markup = renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] },
    createElement(CampaignCardLink, { href: "/campaigns/community/youth-arts", name: "Youth Arts" },
      createElement("button", { className: "relative z-10" }, "Donate to this campaign"))));
  assert.match(markup, /href="\/campaigns\/community\/youth-arts"/);
  assert.match(markup, /aria-label="Open campaign: Youth Arts"/);
  assert.match(markup, /absolute inset-0 z-\[1\]/);
  assert.match(markup, /<\/a><button class="relative z-10"/);
  assert.doesNotMatch(markup, /<a[^>]*>[^<]*<button/);
});

test("draft card opens its existing editor while preview and delete remain separate controls", async () => {
  const { CampaignEditorCard } = await loadComponent("src/components/campaign-builder/campaign-editor-card.tsx");
  let edits = 0, deletions = 0;
  const card = CampaignEditorCard({
    id: "draft-1", name: "Out of Many Hands", onEdit: () => edits++,
    children: [
      createElement("a", { key: "preview", href: "/campaign/preview/org/draft-1", className: "relative z-10" }, "Preview as donor"),
      createElement("button", { key: "delete", className: "relative z-10", onClick: () => deletions++ }, "Delete"),
    ],
  });
  const overlay = card.props.children[0];
  assert.equal(overlay.type, "button");
  assert.equal(overlay.props.type, "button");
  assert.equal(overlay.props["aria-label"], "Continue editing Out of Many Hands");
  overlay.props.onClick();
  assert.equal(edits, 1);
  const markup = renderToStaticMarkup(card);
  assert.match(markup, /absolute inset-0 z-\[1\]/);
  assert.match(markup, /<\/button><a /, "preview is a sibling, not nested in the editor button");
  assert.equal(card.props.onClick, undefined, "secondary controls cannot bubble into an editor action");
  card.props.children[1][1].props.onClick();
  assert.equal(deletions, 1);
  assert.equal(edits, 1);
  const busy = CampaignEditorCard({ id: "draft-1", name: "", onEdit() {}, disabled: true, children: null });
  assert.equal(busy.props.children[0].props.disabled, true);
  assert.equal(busy.props.children[0].props["aria-label"], "Continue editing Untitled draft");
  const live = renderToStaticMarkup(createElement(CampaignEditorCard, { id: "live", name: "Live", children: "Live campaign" }));
  assert.doesNotMatch(live, /button-open-draft/);
});

test("donor-icon hit testing respects rotation, overlap and newest-first name ordering", async () => {
  const { hitSupporterUnit, supporterUnitName } = await loadComponent("src/lib/supporter-unit-hit.ts");
  const lower = { x: 30, y: 30, s: 20, r: 0, index: 0 };
  const upper = { x: 30, y: 30, s: 12, r: Math.PI / 4, index: 1 };
  assert.equal(hitSupporterUnit([lower, upper], 30, 30).index, 1);
  assert.equal(hitSupporterUnit([upper], 38, 30).index, 1, "rotated edge is inside");
  assert.equal(hitSupporterUnit([upper], 38, 38), null, "outside the rotated square");
  assert.equal(hitSupporterUnit([lower, upper], 100, 100), null);
  const names = [{ displayName: "Newest N." }, { displayName: "Anonymous" }, { displayName: "Oldest O." }];
  assert.equal(supporterUnitName(names, 3, 2), "Newest N.");
  assert.equal(supporterUnitName(names, 3, 1), "Anonymous");
  assert.equal(supporterUnitName(names, 3, 0), "Oldest O.");
  assert.equal(supporterUnitName([], 3, 0), "Anonymous");
  assert.equal(supporterUnitName(names, 300, 299), "Newest N.");
});

test("accumulation animation clamps early RAF timestamps instead of indexing a negative unit", async () => {
  const { accumulationProgress } = await loadComponent("src/lib/supporter-unit-hit.ts");
  assert.equal(accumulationProgress(99, 100, 1400), 0);
  assert.equal(accumulationProgress(100, 100, 1400), 0);
  assert.equal(accumulationProgress(800, 100, 1400), 0.5);
  assert.equal(accumulationProgress(2000, 100, 1400), 1);
});

test("campaign Donate button delivers its id and name to the sheet and checkout body", async () => {
  const { CampaignDonateButton } = await loadComponent("src/components/campaign-donate-button.tsx");
  const { GuestDonateSheet, guestCheckoutBody } = await loadComponent("src/components/GuestDonateSheet.tsx");
  const campaign = { _id: "camp-123", name: "Youth Arts" };
  let selected: typeof campaign | null = null;
  const button = CampaignDonateButton({
    campaign, onDonate: (c: typeof campaign) => { selected = c; }, children: "Donate",
  });
  button.props.onClick();
  assert.deepEqual(selected, campaign);
  const chosen = selected as typeof campaign | null;
  assert.ok(chosen);
  const sheet = renderSheet(GuestDonateSheet, {
    campaignId: chosen._id, campaignName: chosen.name,
  });
  assert.match(sheet, /Donating to<\/p><h2[^>]*>Youth Arts<\/h2>/);
  assert.match(sheet, /<p[^>]*>Community Trust<\/p>/);
  assert.ok(sheet.includes(encodeURIComponent("?campaign=camp-123")));
  assert.deepEqual(guestCheckoutBody("org-1", 300, chosen._id, "anon-1"), {
    orgId: "org-1", amountPence: 300, currency: "gbp", campaignId: "camp-123", anonymousDonorId: "anon-1",
  });
  assert.deepEqual(guestCheckoutBody("org-1", 300, chosen._id, "anon-1", true, " Alex Taylor "), {
    orgId: "org-1", amountPence: 300, currency: "gbp", campaignId: chosen._id, anonymousDonorId: "anon-1",
    wallOptIn: true, donorName: "Alex Taylor",
  });
  const optedOut = guestCheckoutBody("org-1", 300, chosen._id, "anon-1", false, "Alex Taylor");
  assert.equal(Object.hasOwn(optedOut, "donorName"), false, "unchecking removes the public name from the request");
});

test("organisation Donate stays unassigned to a campaign", async () => {
  const { GuestDonateSheet, guestCheckoutBody } = await loadComponent("src/components/GuestDonateSheet.tsx");
  const sheet = renderSheet(GuestDonateSheet, {});
  assert.match(sheet, /Donating to<\/p><h2[^>]*>Community Trust<\/h2>/);
  assert.doesNotMatch(sheet, /campaign%3D/);
  assert.deepEqual(guestCheckoutBody("org-1", 300, undefined, "anon-1"), {
    orgId: "org-1", amountPence: 300, currency: "gbp", anonymousDonorId: "anon-1",
  });
});
