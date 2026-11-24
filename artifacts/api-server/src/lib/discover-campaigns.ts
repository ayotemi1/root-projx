import { campaignSharePath } from "./campaign-links.js";
import { campaignFundingTotal, partnerFundingFor } from "./campaign-matching.js";

type RecordData = Record<string, unknown>;
const text = (v: unknown) => typeof v === "string" ? v : "";
const record = (v: unknown): RecordData => v && typeof v === "object" && !Array.isArray(v) ? v as RecordData : {};
const hex = (v: unknown, fallback: string) => /^#[0-9a-f]{6}$/i.test(text(v)) ? text(v) : fallback;

/** Date-only deadlines include the whole stated day, rather than ending at midnight. */
export function discoverDeadline(value: unknown): number | null {
  if (value == null || value === "") return Infinity;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** One collection read, no owner/card request waterfall. Only public fields are copied;
 * editorDraft and all other private revisions are deliberately never merged. */
export function discoverCampaignEntries(orgs: RecordData[], now = Date.now()) {
  return orgs.flatMap(org => {
    if (!text(org._id) || !text(org.name).trim() || org.deletedAt || org.disabled === true ||
        org.enabled === false || org.archivedAt || org.public === false || org.visibility === "private" ||
        ["deleted", "disabled", "archived", "suspended", "pending", "declined"].includes(text(org.status)) ||
        org.approvalStatus != null && org.approvalStatus !== "approved") return [];
    const organisation = {
      _id: text(org._id), name: text(org.name), logo: text(org.logo) || null,
      country: text(org.country), city: text(org.city), category: text(org.category),
      sectors: Array.isArray(org.categories) ? org.categories.filter((s): s is string => typeof s === "string") : [],
      categories: Array.isArray(org.categories) ? org.categories.filter((s): s is string => typeof s === "string") : [],
      verified: org.verified === true,
    };
    return (Array.isArray(org.campaigns) ? org.campaigns : []).flatMap(value => {
      const c = record(value);
      const deadline = discoverDeadline(c.deadline);
      if (!text(c._id) || !text(c.name).trim() || c.enabled === false || c.status !== "active" ||
          c.type !== "fundraising" || c.deletedAt || c.archivedAt || c.archived === true ||
          c.disabled === true || c.visibility === "private" || c.published === false ||
          deadline == null || deadline <= now || typeof c.goal !== "number" || !Number.isFinite(c.goal) || c.goal <= 0) return [];
      // Validate the same funding inputs the public campaign uses; never invent totals.
      campaignFundingTotal(c);
      const partner = partnerFundingFor(c);
      const theme = record(c.theme);
      return [{
        organisation,
        campaign: {
          _id: text(c._id), ...(text(c.publicId) ? { publicId: text(c.publicId) } : {}),
          name: text(c.name), description: text(c.description), imageUrl: text(c.imageUrl) || null,
          amountRaised: typeof c.amountRaised === "number" ? c.amountRaised : 0,
          goal: c.goal, currency: c.currency === "usd" ? "usd" : "gbp",
          status: "active", type: "fundraising", enabled: true,
          deadline: text(c.deadline) || null, createdAt: text(c.publishedAt) || text(c.createdAt),
          updatedAt: text(c.updatedAt), volunteersNeeded: 0, phases: [],
          ...campaignSharePath(org, c),
          theme: {
            primaryColor: hex(theme.primaryColor, "#17100F"), accentColor: hex(theme.accentColor, "#F3BF2C"),
            backgroundColor: hex(theme.backgroundColor, "#F4EFE6"), textColor: hex(theme.textColor, "#FFFFFF"),
          },
          partnerFunding: partner ? {
            amount: partner.amount, funderName: partner.funderName, type: partner.type,
            ...(partner.matchRatio != null ? {matchRatio: partner.matchRatio} : {}),
            ...(partner.matchCap != null ? {matchCap: partner.matchCap} : {}),
          } : null,
          partnerFundingMatchedGbp: typeof c.partnerFundingMatchedGbp === "number" ? c.partnerFundingMatchedGbp : 0,
        },
      }];
    });
  });
}
