/**
 * Rename legacy funding, including unpublished revisions, without changing totals.
 * Dry run: node --experimental-strip-types artifacts/api-server/scripts/migrate-partner-funding.mjs
 * Apply: append --apply. Uses update-time preconditions against concurrent saves/donations.
 */
import { fsQuery, fsMutateCampaigns, getServerToken } from "../src/lib/firebase-rest.ts";
import { migrateCampaignPartnerFunding } from "../src/lib/campaign-matching.ts";

const apply = process.argv.includes("--apply");
const changed = (campaign) => !!campaign && typeof campaign === "object" &&
  ("matchFunding" in campaign || "matchFundingAnswer" in campaign || changed(campaign.editorDraft));
let organisationsChanged = 0;
let campaignsChanged = 0;
try {
  const token = await getServerToken();
  // Unbounded runQuery, not fsList's first-page-only listing.
  const orgs = await fsQuery("organisations", [], token);
  for (const org of orgs) {
    const campaigns = Array.isArray(org.campaigns) ? org.campaigns : [];
    const count = campaigns.filter(changed).length;
    if (!count) continue;
    if (!apply) { organisationsChanged++; campaignsChanged += count; continue; }
    const result = await fsMutateCampaigns(org._id, token, latest => {
      const current = Array.isArray(latest.campaigns) ? latest.campaigns : [];
      return { campaigns: current.map(campaign => changed(campaign) ? migrateCampaignPartnerFunding(campaign) : campaign),
        result: current.filter(changed).length };
    });
    if (result) { organisationsChanged++; campaignsChanged += result; }
  }
  console.log(`${apply ? "Migrated" : "Would migrate"} ${campaignsChanged} campaign(s) across ${organisationsChanged} organisation(s) to partnerFunding. Legacy funding is committed; financial totals unchanged.`);
} catch (error) {
  console.error(`Migration stopped (${error instanceof Error ? error.name : "unknown error"}). ${campaignsChanged} campaign(s) ${apply ? "migrated so far" : "identified"}. Safe to rerun; credentials and document contents are not logged.`);
  process.exitCode = 1;
}
