import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("donor profile sidebar shows one live campaign rather than repeating the Campaigns list", async () => {
  const source = await readFile(new URL("../../../web/src/pages/org-profile.tsx", import.meta.url), "utf8");
  const sidebar = source.slice(source.lastIndexOf('<aside className="orgp-rail">'));
  assert.match(sidebar, /liveCampaign && <LiveCampaignCard/);
  assert.match(sidebar, /section-org-about/);
  assert.doesNotMatch(sidebar, /campaigns\.map|realCampaigns|CampaignRow/);
  assert.match(source, /campaigns\.map\(\(c\) => <CampaignRow/);
});
