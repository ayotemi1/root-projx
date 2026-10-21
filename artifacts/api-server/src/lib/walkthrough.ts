import { activePayoutMethod } from "./payout-setup.js";
import { campaignPublishGates } from "./campaign-editor.js";

export const EMPTY_WALKTHROUGH = { profileStep: null as number | null, campaignStep: null as number | null,
  profileDone: false, campaignDone: false, exitedAt: null as string | null, selectedCampaignId: null as string | null };

export function walkthroughState(org: Record<string, unknown>) {
  return { ...EMPTY_WALKTHROUGH, ...(org.walkthrough && typeof org.walkthrough === "object" ? org.walkthrough : {}) };
}

export function walkthroughPatch(org: Record<string, unknown>, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Choose a walkthrough step and retry saving.");
  const body = input as Record<string, unknown>;
  const next = { ...walkthroughState(org) };
  for (const key of Object.keys(body)) {
    if (!(key in EMPTY_WALKTHROUGH)) throw new Error("Only walkthrough progress can be saved here.");
  }
  for (const [key, max] of [["profileStep", 10], ["campaignStep", 12]] as const) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max)) throw new Error("Choose a valid walkthrough step and retry.");
    next[key] = value as number | null;
  }
  for (const key of ["profileDone", "campaignDone"] as const) if (key in body) {
    if (typeof body[key] !== "boolean") throw new Error("Save walkthrough completion as true or false.");
    next[key] = body[key];
  }
  if ("exitedAt" in body) {
    if (body.exitedAt !== null && (typeof body.exitedAt !== "string" || !Number.isFinite(Date.parse(body.exitedAt)))) throw new Error("Retry Finish later to save the current time.");
    next.exitedAt = body.exitedAt as string | null;
  }
  const campaigns = Array.isArray(org.campaigns) ? org.campaigns as Record<string, unknown>[] : [];
  if ("selectedCampaignId" in body) {
    if (body.selectedCampaignId !== null && !campaigns.some(c => c._id === body.selectedCampaignId && c.status !== "deleted")) throw new Error("Choose one of your own campaigns, then resume.");
    next.selectedCampaignId = body.selectedCampaignId as string | null;
  }
  if (body.profileDone === true) {
    if (campaignPublishGates(org, {}).some(gate => gate.id === "profile") ||
      !activePayoutMethod(org) || !org.profilePreviewedAt) {
      throw new Error("Finish the required saved profile fields, choose how you get paid, and open the donor preview before finishing.");
    }
  }
  if (body.campaignDone === true) {
    const campaign = campaigns.find(c => c._id === next.selectedCampaignId && c.enabled === true && c.status !== "deleted");
    if (!campaign || campaignPublishGates(org, campaign).length || !org.campaignPreviewedAt || org.campaignPreviewedId !== campaign._id) {
      throw new Error("Preview and publish your selected campaign before finishing the walkthrough.");
    }
  }
  return next;
}
