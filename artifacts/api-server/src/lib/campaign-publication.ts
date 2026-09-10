export function isCampaignPublished(campaign: Record<string, unknown>): boolean {
  return campaign.enabled !== false && campaign.status !== "deleted";
}