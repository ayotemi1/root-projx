/** Settings-only migration. No donation, balance, publication or Stripe writes. */
import { fsGet, fsMutateCampaigns, getServerToken } from "../src/lib/firebase-rest.js";
import { campaignPresentation } from "../src/lib/campaign-presentation.js";

const targets = [
  ["wjrO1hiK6gfS7og1KVSjs5euRlC2", "hov_out_of_many_hands"],
  ["LTMwjXVEgxNideK0XtIQudxZXjc2", "9d5e9d29323a434f8706"],
] as const;
const token = await getServerToken();
for (const [orgId, campaignId] of targets) {
  const org = await fsGet("organisations", orgId, token);
  if (!org || !Array.isArray(org.campaigns) || !org.campaigns.some(c => c._id === campaignId)) {
    throw new Error("Expected campaign unavailable; no settings written for this organisation");
  }
  if (process.argv.includes("--apply")) {
    await fsMutateCampaigns(orgId, token, latest => ({
      campaigns: (latest.campaigns as Record<string, unknown>[]).map(c => c._id !== campaignId ? c : {
        ...c,
        donationPresentation: campaignPresentation({ ...c, donationPresentation: undefined }),
        ...(c.editorDraft && typeof c.editorDraft === "object" ? {
          editorDraft: { ...c.editorDraft, donationPresentation: campaignPresentation({ ...c, donationPresentation: undefined }) },
        } : {}),
      }),
      result: null,
    }));
  }
  console.log(`${process.argv.includes("--apply") ? "Saved" : "Would save"} ${campaignId} presentation settings`);
}
