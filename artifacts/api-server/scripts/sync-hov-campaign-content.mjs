/**
 * Complete the existing HOV campaign from the user's PDF. Dry run by default.
 * Does not publish, create a second campaign or alter any financial fields.
 */
import { readFile } from "node:fs/promises";
import { fsGet, fsMutateCampaigns, getServerToken } from "../src/lib/firebase-rest.ts";
import { campaignPageContent } from "../src/lib/campaign-page-content.ts";
import { withHovContent } from "./lib/hov-content.mjs";

const orgId = "wjrO1hiK6gfS7og1KVSjs5euRlC2";
const campaignId = "hov_out_of_many_hands";
const source = JSON.parse(await readFile(new URL("./content/hov-campaign.json", import.meta.url), "utf8"));
campaignPageContent(source.pageContent);
const token = await getServerToken();
const org = await fsGet("organisations", orgId, token);
if (org?.name !== "Humanity Ova Vanity") throw new Error("Expected organisation not found; no changes made.");
const existing = (org.campaigns ?? []).find(c => c._id === campaignId);
if (!existing || existing.name !== "Out of Many Hands") throw new Error("Expected campaign not found; no changes made.");
console.log(`Complete editorial copy: story, three trades, five planned outcomes, cohort plan, training appeal, funder context, responsibility and sharing.`);
console.log(`Campaign is ${existing.enabled !== false ? "published: changes will remain private revisions" : "unpublished: publication status will be preserved"}. No financial figures or images will be invented.`);
if (!process.argv.includes("--apply")) {
  console.log("Dry run only. Add --apply to save.");
} else {
  await fsMutateCampaigns(orgId, token, latest => {
    if (latest.name !== "Humanity Ova Vanity") throw new Error("Organisation identity changed.");
    const campaigns = Array.isArray(latest.campaigns) ? latest.campaigns : [];
    const found = campaigns.find(c => c._id === campaignId);
    if (!found || found.name !== "Out of Many Hands") throw new Error("Campaign identity changed.");
    const updated = withHovContent(found, source);
    const financial = c => JSON.stringify({
      amountRaised: c.amountRaised, goal: c.goal, partnerFunding: c.partnerFunding,
      partnerFundingMatchedGbp: c.partnerFundingMatchedGbp, enabled: c.enabled,
      status: c.status, publicId: c.publicId,
    });
    if (financial(found) !== financial(updated)) throw new Error("Financial/publication preservation check failed.");
    return {
      campaigns: campaigns.map(c => c._id === campaignId ? { ...updated, updatedAt: new Date().toISOString() } : c),
      result: null,
    };
  });
  const saved = await fsGet("organisations", orgId, token);
  const campaign = saved.campaigns.find(c => c._id === campaignId);
  const copy = campaign.enabled !== false ? campaign.editorDraft : campaign;
  if (copy?.pageContent?.storyHeading !== source.pageContent.storyHeading ||
      copy?.phases?.length !== 5 || copy?.breakdown?.length !== 3) throw new Error("Saved content did not verify.");
  console.log("Saved and re-read successfully. Publication, donation totals and funding fields preserved.");
}
