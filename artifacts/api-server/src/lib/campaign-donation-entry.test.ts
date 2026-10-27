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
