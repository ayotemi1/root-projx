import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("donor profile sidebar shows one live campaign rather than repeating the Campaigns list", async () => {
  const source = await readFile(new URL("../../../web/src/pages/org-profile.tsx", import.meta.url), "utf8");
  const sidebar = source.slice(source.lastIndexOf('<aside className="orgp-rail">'));
  assert.match(sidebar, /liveCampaign && <LiveCampaignCard/);
  assert.match(sidebar, /section-org-about/);
  assert.doesNotMatch(sidebar, /campaigns\.map|realCampaigns|CampaignRow/);
  assert.match(source, /campaigns\.map\(\(c\) => c\.type === "fundraising"/);
  assert.match(source, /<DiscoverCampaignCard key=\{c\._id\}/);
  assert.match(source, /<CampaignRow key=\{c\._id\}/);
});

test("organisation profiles hide banners without editing saved banner data", async () => {
  const web = new URL("../../../web/src/", import.meta.url);
  const [profile, dashboard, editor, checklist, steps] = await Promise.all([
    readFile(new URL("pages/org-profile.tsx", web), "utf8"),
    readFile(new URL("pages/dashboard.tsx", web), "utf8"),
    readFile(new URL("components/profile-editor/sections.tsx", web), "utf8"),
    readFile(new URL("components/profile-editor/profile-editor.tsx", web), "utf8"),
    readFile(new URL("lib/tour/steps.ts", web), "utf8"),
  ]);
  assert.doesNotMatch(profile, /OrganisationBanner/);
  assert.doesNotMatch(dashboard, /OrganisationBanner/);
  assert.doesNotMatch(editor, /pe-cover|coverImage\s*:|identity-cover/);
  assert.doesNotMatch(checklist, /Cover image/);
  assert.doesNotMatch(steps, /id: "p-cover"/);
});
