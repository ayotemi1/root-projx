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
    orgId: "org-1", amountPence: 300, campaignId: "camp-123", anonymousDonorId: "anon-1",
  });
  assert.deepEqual(guestCheckoutBody("org-1", 300, chosen._id, "anon-1", true, " Alex Taylor "), {
    orgId: "org-1", amountPence: 300, campaignId: chosen._id, anonymousDonorId: "anon-1",
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
    orgId: "org-1", amountPence: 300, anonymousDonorId: "anon-1",
  });
});
