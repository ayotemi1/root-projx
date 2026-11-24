import type { Campaign, DiscoverCampaignItem, PartnerFunding } from "./api";

/** Frontend mirror of the backend campaignFundingTotal: raised here + committed partner funding,
 *  or + matched-so-far for matching funders (same rule as the campaign page). */
export function campaignFundingTotal(c: Pick<Campaign, "amountRaised" | "partnerFunding" | "partnerFundingMatchedGbp">): number {
  const raised = Math.max(0, Number(c.amountRaised) || 0);
  const pf = c.partnerFunding;
  if (!pf) return raised;
  const extra = pf.type === "matching" ? Math.max(0, Number(c.partnerFundingMatchedGbp) || 0) : Math.max(0, Number(pf.amount) || 0);
  return raised + extra;
}

/** Canonical funding percentage (0-100); 0 when there's no usable goal. */
export function campaignFundedPercent(c: Pick<Campaign, "amountRaised" | "goal" | "partnerFunding" | "partnerFundingMatchedGbp">): number {
  const goal = Number(c.goal);
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  return Math.min(100, (campaignFundingTotal(c) / goal) * 100);
}

/** "Ends 31 January" (year added only when it isn't the current year). */
export function campaignEndsLabel(deadline: string | null | undefined, now = new Date()): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return `Ends ${d.toLocaleDateString("en-GB", opts)}`;
}

type GeneratedEntry = {
  campaign: { _id: string; name: string; partnerFunding?: unknown };
  organisation: { _id: string; name: string; logo: string | null; country: string; city: string; category: string; sectors: string[]; verified: boolean; categories?: string[] };
};
/** Adapts the generated DiscoverCampaignEntry payload to the app's Campaign-based item. */
export function adaptDiscoverEntries(entries: readonly GeneratedEntry[] | undefined): DiscoverCampaignItem[] {
  return (entries ?? []).map(e => ({
    campaign: { ...(e.campaign as unknown as Campaign), partnerFunding: (e.campaign.partnerFunding as PartnerFunding | null | undefined) ?? null },
    organisation: { ...e.organisation, sectors: [...(e.organisation.sectors ?? []), ...(e.organisation.categories ?? [])] },
  }));
}

export type DiscoverTab = "all" | "organisations" | "campaigns";
export type CampaignSort = "ending" | "funded" | "newest";
export const DISCOVER_TABS: { value: DiscoverTab; label: string }[] = [
  { value: "all", label: "All" }, { value: "organisations", label: "Organisations" }, { value: "campaigns", label: "Campaigns" },
];
export const CAMPAIGN_SORTS: { value: CampaignSort; label: string }[] = [
  { value: "ending", label: "Ending soon" }, { value: "funded", label: "Nearly funded" }, { value: "newest", label: "Newest" },
];

export function parseDiscoverTab(search: string): DiscoverTab {
  const t = new URLSearchParams(search).get("tab");
  return t === "organisations" || t === "campaigns" ? t : "all";
}
/** Returns a query string with tab set, keeping unrelated params. */
export function withDiscoverTab(search: string, tab: DiscoverTab): string {
  const p = new URLSearchParams(search);
  if (tab === "all") p.delete("tab"); else p.set("tab", tab);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const normal = (v: string) => v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function validDiscoverCampaigns(items: readonly DiscoverCampaignItem[] | undefined): DiscoverCampaignItem[] {
  const seen = new Set<string>();
  return (items ?? []).filter(i => {
    if (!i?.campaign?._id || !i.organisation?._id || !i.campaign.name?.trim() || seen.has(i.campaign._id)) return false;
    seen.add(i.campaign._id);
    return true;
  });
}

/** Same normalisation as the org filters; campaigns inherit their organisation's country and cause.
 *  `cause` empty or "All Causes" means no cause filter; `country` empty or "All" means no country filter. */
export function filterDiscoverCampaigns(items: readonly DiscoverCampaignItem[], f: { search: string; country: string; cause: string }) {
  const search = normal(f.search).replace(/\s+/g, " ");
  const country = f.country === "All" ? "" : normal(f.country);
  const cause = f.cause === "All Causes" ? "" : normal(f.cause);
  return items.filter(({ campaign: c, organisation: o }) => {
    const causes = [o.category, ...(o.sectors ?? [])].filter((s): s is string => !!s).map(normal);
    return (!search || normal([c.name, o.name, o.city, o.country].filter(Boolean).join(" ")).includes(search)) &&
      (!country || normal(o.country ?? "") === country) &&
      (!cause || causes.includes(cause));
  });
}

const time = (v: string | null | undefined) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null; };
const tie = (a: DiscoverCampaignItem, b: DiscoverCampaignItem) =>
  a.campaign.name.localeCompare(b.campaign.name, "en-GB") || (a.campaign._id < b.campaign._id ? -1 : a.campaign._id > b.campaign._id ? 1 : 0);

export function sortDiscoverCampaigns(items: readonly DiscoverCampaignItem[], sort: CampaignSort): DiscoverCampaignItem[] {
  return [...items].sort((a, b) => {
    if (sort === "ending") {
      const x = time(a.campaign.deadline), y = time(b.campaign.deadline);
      if (x !== y) { if (x === null) return 1; if (y === null) return -1; return x - y; }
    } else if (sort === "funded") {
      const d = campaignFundedPercent(b.campaign) - campaignFundedPercent(a.campaign);
      if (d !== 0) return d;
    } else {
      const x = time(a.campaign.publishedAt ?? a.campaign.createdAt) ?? 0, y = time(b.campaign.publishedAt ?? b.campaign.createdAt) ?? 0;
      if (x !== y) return y - x;
    }
    return tie(a, b);
  });
}
