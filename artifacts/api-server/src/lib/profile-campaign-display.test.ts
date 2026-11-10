import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("profile does not repeat the Campaigns tab list in the sidebar", async () => {
  const source = await readFile(new URL("../../../web/src/pages/org-profile.tsx", import.meta.url), "utf8");
  const sidebar = source.slice(source.indexOf("{/* ── RIGHT COLUMN"));
  const campaigns = sidebar.slice(0, sidebar.indexOf("{/* Ways to Volunteer card"));
  assert.match(campaigns, /\{tab !== "campaigns" && \(/);
  assert.match(campaigns, /campaignsQ\.isLoading/);
  assert.doesNotMatch(campaigns, /updatesQ\.isLoading/);
  assert.match(campaigns, /realCampaigns\.slice\(0, 3\)/);
});
