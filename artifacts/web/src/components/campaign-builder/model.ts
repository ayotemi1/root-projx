import type {
  Campaign, CampaignBreakdownItem, CampaignEditorPatch, CampaignGate, CampaignLocation,
  CampaignTheme, CampaignUnit, Org,
} from "@/lib/api";

export const TAGLINE_MAX = 140;
export const STORY_MIN = 200;
export const MAX_LOCATIONS = 3;

export const DEFAULT_COLOURS = {
  primaryColor: "#B50000",
  accentColor: "#F5B800",
  backgroundColor: "#FFF9F2",
  textColor: "#1A1A1A",
};

export interface BuiltinUnit extends CampaignUnit {
  id: string;
  imageUrl: string;
}

const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
export const BUILTIN_UNITS: BuiltinUnit[] = [
  { id: "hand", singular: "hand", plural: "hands", imageUrl: `${base}/campaign-units/hand.svg` },
  { id: "brick", singular: "brick", plural: "bricks", imageUrl: `${base}/campaign-units/brick.svg` },
  { id: "seedling", singular: "seedling", plural: "seedlings", imageUrl: `${base}/campaign-units/seedling.svg` },
  { id: "drop", singular: "drop", plural: "drops", imageUrl: `${base}/campaign-units/drop.svg` },
];

/** Editor state. Numbers are kept as strings so half-typed input is never lost. */
export interface CampaignDraft {
  name: string;
  tagline: string;
  type: "fundraising" | "volunteer";
  goal: string;
  volunteersNeeded: string;
  partnerOn: boolean;
  partnerAnswer: "yes" | "no" | null;
  partnerType: "committed" | "matching";
  partnerAmount: string;
  partnerFunder: string;
  partnerRatio: string;
  partnerCap: string;
  deadline: string;
  description: string;
  breakdown: CampaignBreakdownItem[];
  locations: CampaignLocation[];
  imageUrl: string | null;
  videoOn: boolean;
  videoUrl: string;
  videoPoster: string | null;
  videoCaptions: string | null;
  colours: typeof DEFAULT_COLOURS;
  unit: CampaignUnit | null;
  unitChosen: boolean;
  assistUsed: boolean;
}

export function draftFromCampaign(c: Campaign): CampaignDraft {
  const t = c.theme;
  return {
    name: c.name ?? "",
    tagline: c.tagline ?? "",
    type: c.type ?? "fundraising",
    goal: c.goal ? String(c.goal) : "",
    volunteersNeeded: c.volunteersNeeded ? String(c.volunteersNeeded) : "",
    partnerOn: !!c.partnerFunding,
    partnerAnswer: c.partnerFundingAnswer ?? null,
    // Anything not explicitly "matching" (incl. legacy) is committed.
    partnerType: c.partnerFunding?.type === "matching" ? "matching" : "committed",
    partnerAmount: c.partnerFunding ? String(c.partnerFunding.amount) : "",
    partnerFunder: c.partnerFunding?.funderName ?? "",
    partnerRatio: c.partnerFunding?.type === "matching" && c.partnerFunding.matchRatio ? String(c.partnerFunding.matchRatio) : "1",
    partnerCap: c.partnerFunding?.type === "matching" && c.partnerFunding.matchCap != null ? String(c.partnerFunding.matchCap) : "",
    deadline: c.deadline ? c.deadline.slice(0, 10) : "",
    description: c.description ?? "",
    breakdown: (c.breakdown ?? []).map((b) => ({ label: b.label ?? "", detail: b.detail ?? "" })),
    locations: (c.locations ?? []).slice(0, MAX_LOCATIONS).map((l) => ({
      name: l.name ?? "", description: l.description ?? "", photoUrl: l.photoUrl ?? null,
    })),
    imageUrl: c.imageUrl ?? null,
    videoOn: !!c.video,
    videoUrl: c.video?.url ?? "",
    videoPoster: c.video?.posterUrl ?? null,
    videoCaptions: c.video?.captionsUrl ?? null,
    colours: t
      ? { primaryColor: t.primaryColor, accentColor: t.accentColor, backgroundColor: t.backgroundColor, textColor: t.textColor }
      : { ...DEFAULT_COLOURS },
    unit: t?.unit ?? null,
    unitChosen: c.unitChosen === true,
    assistUsed: !!c.assistUsed,
  };
}

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Returns a plain-words message when the draft cannot be saved as-is. */
export function validateDraft(d: CampaignDraft): string | null {
  if (d.tagline.length > TAGLINE_MAX) return `The one-line ask is ${d.tagline.length - TAGLINE_MAX} characters too long. Shorten it to ${TAGLINE_MAX}.`;
  const g = num(d.goal);
  if (g !== null && (Number.isNaN(g) || g < 0)) return "Goal must be a number of pounds, 0 or more.";
  const v = num(d.volunteersNeeded);
  if (v !== null && (Number.isNaN(v) || v < 0)) return "Volunteers needed must be a whole number.";
  if (d.partnerOn) {
    const m = num(d.partnerAmount);
    if (m !== null && (Number.isNaN(m) || m < 0)) return "Partner funding must be a number of pounds.";
    if (d.partnerType === "matching") {
      const r = num(d.partnerRatio);
      if (r !== null && (Number.isNaN(r) || r <= 0)) return "Match ratio must be a number above 0, like 1 for £1 per £1.";
      const cap = num(d.partnerCap);
      if (cap !== null && (Number.isNaN(cap) || cap < 0)) return "Match cap must be a number of pounds.";
    }
  }
  if (d.locations.length > MAX_LOCATIONS) return `Add up to ${MAX_LOCATIONS} locations.`;
  return null;
}

export function draftToPatch(d: CampaignDraft, prevTheme?: CampaignTheme): CampaignEditorPatch {
  const g = num(d.goal);
  const v = num(d.volunteersNeeded);
  const m = num(d.partnerAmount);
  const r = num(d.partnerRatio);
  const cap = num(d.partnerCap);
  const amount = m !== null && !Number.isNaN(m) ? m : 0;
  return {
    name: d.name.trim(),
    tagline: d.tagline.trim(),
    type: d.type,
    goal: g && !Number.isNaN(g) ? g : 0,
    volunteersNeeded: v && !Number.isNaN(v) ? Math.round(v) : 0,
    partnerFunding: d.partnerOn
      ? d.partnerType === "matching"
        ? {
            amount, funderName: d.partnerFunder.trim(), type: "matching",
            matchRatio: r !== null && !Number.isNaN(r) && r > 0 ? r : 1,
            matchCap: cap !== null && !Number.isNaN(cap) && cap >= 0 ? cap : amount,
          }
        : { amount, funderName: d.partnerFunder.trim(), type: "committed" }
      : null,
    deadline: d.deadline || null,
    description: d.description,
    // Keep every editor row (including blank ones); public render filters empties.
    breakdown: d.breakdown.map((b) => ({ ...b })),
    locations: d.locations.slice(0, MAX_LOCATIONS).map((l) => ({ ...l })),
    imageUrl: d.imageUrl,
    // Video switched on keeps its (possibly blank) slot so the controls survive autosave.
    video: d.videoOn
      ? { url: d.videoUrl.trim(), posterUrl: d.videoPoster, captionsUrl: d.videoCaptions }
      : null,
    theme: { ...(prevTheme ?? {}), ...d.colours, unit: d.unit },
    assistUsed: d.assistUsed,
    partnerFundingAnswer: d.partnerAnswer,
    unitChosen: d.unitChosen,
  };
}

/** Builds a Campaign object the public page component can render. */
export function draftToPreviewCampaign(d: CampaignDraft, c: Campaign): Campaign {
  const p = draftToPatch(d, c.theme);
  return {
    ...c,
    name: p.name || "Your campaign name",
    tagline: p.tagline,
    type: d.type,
    goal: p.goal ?? 0,
    volunteersNeeded: p.volunteersNeeded ?? 0,
    partnerFunding: p.partnerFunding ?? null,
    deadline: p.deadline ?? null,
    description: p.description || "Your story will appear here.",
    breakdown: p.breakdown,
    locations: p.locations,
    imageUrl: p.imageUrl ?? null,
    video: p.video ?? null,
    theme: p.theme,
    enabled: true,
  };
}

export type ClientGate = CampaignGate & { href?: string };

export const PROFILE_FIX_HREF = "/dashboard?tab=build";
/** Payout setup lives on the "Updates & Payouts" tab (value "profile"). */
export const PAYOUT_FIX_HREF = "/dashboard?tab=profile";

/** Client mirror of the server publish gates. Server stays authoritative. */
export function computeGates(d: CampaignDraft, org: Org | null | undefined): ClientGate[] {
  const out: ClientGate[] = [];
  if (!d.name.trim() || !d.tagline.trim())
    out.push({ id: "campaign_name", message: "Add a campaign name and a one-line ask.", step: 1 });
  const g = Number(d.goal);
  if (!(g > 0)) out.push({ id: "goal", message: "Set a goal above zero.", step: 2 });
  const len = d.description.trim().length;
  if (len < STORY_MIN)
    out.push({ id: "story", message: `Write at least ${STORY_MIN} characters of story (${STORY_MIN - len} to go).`, step: 3 });
  if (!d.imageUrl) out.push({ id: "hero", message: "Add a hero image.", step: 4 });
  if (org) {
    const short = (org.shortDescription ?? "").trim().length;
    const identity = !!org.name?.trim() && !!org.logo && !!org.coverImage && !!org.country && short >= 20 && short <= 120;
    const story = (org.description ?? "").trim().length >= 200;
    const sectors = (org.categories?.length ?? 0) > 0 || !!org.category;
    if (!identity || !story || !sectors) {
      const missing = [!identity && "name, logo, cover, country and short description", !story && "a 200-character story", !sectors && "a sector"]
        .filter(Boolean).join("; ");
      out.push({ id: "profile", message: `Finish your organisation profile: ${missing}.`, step: 0, href: PROFILE_FIX_HREF });
    }
    if (!org.payoutMethod || org.payoutMethod === "none")
      out.push({ id: "payout", message: "Set up how you receive money, so donations can reach you.", step: 0, href: PAYOUT_FIX_HREF });
  }
  return out;
}

export function gateHref(g: CampaignGate): string | undefined {
  if (g.step !== 0) return undefined;
  return /payout/i.test(g.id) ? PAYOUT_FIX_HREF : PROFILE_FIX_HREF;
}
