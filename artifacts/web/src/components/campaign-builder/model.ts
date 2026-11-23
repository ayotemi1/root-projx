import { currencyName, currencySymbol } from "@/lib/currency";
import type {
  Campaign, CampaignBreakdownItem, CampaignEditorPatch, CampaignGate, CampaignLocation,
  CampaignPageDesign, CampaignTheme, CampaignUnit, CampaignVideo, DrumExperience, DrumUpdate, Org,
} from "@/lib/api";
import { PD, isStructured, narrativeLength, pageDesignProblem } from "./story-design";

export const TAGLINE_MAX = 140;
export const TITLE_MAX = PD.title;
export const STORY_MIN = 200;
export const MAX_LOCATIONS = 3;
export const MAX_VIDEOS = 10;

export type CampaignCurrencyCode = "gbp" | "usd";

/** One video row in the editor. Blank rows are kept so half-finished uploads survive autosave. */
export interface VideoDraft {
  id: string;
  url: string;
  posterUrl: string | null;
  captionsUrl: string | null;
  /** Optional descriptive text shown under the video (not subtitles). */
  caption: string;
}

export const emptyVideo = (): VideoDraft => ({ id: crypto.randomUUID(), url: "", posterUrl: null, captionsUrl: null, caption: "" });

function videoDraftOf(v: (Partial<CampaignVideo> & { id?: string }) | null | undefined, index = 0): VideoDraft {
  return { id: v?.id ?? `saved-video-${index}`, url: v?.url ?? "", posterUrl: v?.posterUrl ?? null, captionsUrl: v?.captionsUrl ?? null, caption: v?.caption ?? "" };
}

/** videos wins when the server sends it; legacy single video only when videos is undefined. */
export function campaignVideos(c: Pick<Campaign, "video" | "videos">): CampaignVideo[] {
  if (c.videos !== undefined) return c.videos ?? [];
  return c.video ? [c.video] : [];
}

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

const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");
export const BUILTIN_UNITS: BuiltinUnit[] = [
  { id: "hand", singular: "hand", plural: "hands", imageUrl: `${base}/campaign-units/handprint.svg` },
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
  currency: CampaignCurrencyCode;
  videos: VideoDraft[];
  colours: typeof DEFAULT_COLOURS;
  unit: CampaignUnit | null;
  unitChosen: boolean;
  assistUsed: boolean;
  drumExperience: DrumExperience;
  /** Editorial sections. Only sections the organiser has edited are present; the rest stay legacy. */
  pageDesign: CampaignPageDesign;
}

function pageDesignOf(x: unknown): CampaignPageDesign {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as CampaignPageDesign) : {};
}

export const MAX_DRUM_UPDATES = 20;
export const emptyDrumUpdate = (): DrumUpdate => ({
  id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), text: "", photoUrl: null, caption: "",
});

function drumExperienceOf(x: Partial<DrumExperience> | null | undefined): DrumExperience {
  const updates = Array.isArray(x?.updates) ? x!.updates : [];
  return {
    enabled: x?.enabled === true,
    updates: updates.slice(0, MAX_DRUM_UPDATES).map((u, i) => ({
      id: u?.id || `saved-drum-update-${i}`, date: u?.date ?? "", text: u?.text ?? "",
      photoUrl: u?.photoUrl ?? null, caption: u?.caption ?? "",
    })),
  };
}

/** Drum display needs a USD fundraising campaign; never change currency to fit it. */
export function drumBlockReason(d: Pick<CampaignDraft, "type" | "currency">): string | null {
  if (d.type !== "fundraising") return "The drum build counts money raised, so it only works for fundraising campaigns.";
  if (d.currency !== "usd") return "Each drum costs US$150, so the drum build needs this campaign to raise in US dollars. Switch currency in Money first.";
  return null;
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
    currency: c.currency === "usd" ? "usd" : "gbp",
    videos: campaignVideos(c).slice(0, MAX_VIDEOS).map(videoDraftOf),
    colours: t
      ? { primaryColor: t.primaryColor, accentColor: t.accentColor, backgroundColor: t.backgroundColor, textColor: t.textColor }
      : { ...DEFAULT_COLOURS },
    unit: t?.unit ?? null,
    unitChosen: c.unitChosen === true,
    assistUsed: !!c.assistUsed,
    drumExperience: drumExperienceOf(c.drumExperience),
    pageDesign: pageDesignOf(c.pageDesign),
  };
}

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Returns a plain-words message when the draft cannot be saved as-is. */
export function validateDraft(d: CampaignDraft): string | null {
  if (d.name.length > TITLE_MAX) return `Shorten the campaign title to ${TITLE_MAX} characters before saving. Your changes are kept on this device.`;
  const unit = currencyName(d.currency);
  const sym = currencySymbol(d.currency);
  if (d.tagline.length > TAGLINE_MAX) return `The one-line ask is ${d.tagline.length - TAGLINE_MAX} characters too long. Shorten it to ${TAGLINE_MAX}.`;
  const g = num(d.goal);
  if (g !== null && (Number.isNaN(g) || g < 0)) return `Goal must be a number of ${unit}, 0 or more.`;
  const v = num(d.volunteersNeeded);
  if (v !== null && (Number.isNaN(v) || v < 0)) return "Volunteers needed must be a whole number.";
  if (d.partnerOn) {
    const m = num(d.partnerAmount);
    if (m !== null && (Number.isNaN(m) || m < 0)) return `Partner funding must be a number of ${unit}.`;
    if (d.partnerType === "matching") {
      const r = num(d.partnerRatio);
      if (r !== null && (Number.isNaN(r) || r <= 0)) return `Match ratio must be a number above 0, like 1 for ${sym}1 per ${sym}1.`;
      const cap = num(d.partnerCap);
      if (cap !== null && (Number.isNaN(cap) || cap < 0)) return `Match cap must be a number of ${unit}.`;
    }
  }
  if (d.locations.length > MAX_LOCATIONS) return `Add up to ${MAX_LOCATIONS} locations.`;
  if (d.videos.length > MAX_VIDEOS) return `Add up to ${MAX_VIDEOS} videos.`;
  const pdProblem = pageDesignProblem(d.pageDesign);
  if (pdProblem) return pdProblem;
  if (d.drumExperience?.enabled) {
    const why = drumBlockReason(d);
    if (why) return why;
    if (d.drumExperience.updates.length > MAX_DRUM_UPDATES) return `Add up to ${MAX_DRUM_UPDATES} build updates.`;
  }
  return null;
}

/** Old local drafts stored one video as videoOn/videoUrl/videoPoster/videoCaptions. */
export function migrateLegacyVideoDraft(v: CampaignDraft): CampaignDraft {
  const old = v as CampaignDraft & { videoOn?: boolean; videoUrl?: string; videoPoster?: string | null; videoCaptions?: string | null };
  const hasOld = "videoOn" in old || "videoUrl" in old || "videoPoster" in old || "videoCaptions" in old;
  const { videoOn, videoUrl, videoPoster, videoCaptions, pageDesign, ...rest } = old;
  const videos = Array.isArray(rest.videos)
    ? rest.videos.map(videoDraftOf)
    : hasOld && videoOn ? [videoDraftOf({ url: videoUrl ?? "", posterUrl: videoPoster ?? null, captionsUrl: videoCaptions ?? null })] : undefined;
  return {
    ...rest,
    ...(videos ? { videos: videos.slice(0, MAX_VIDEOS) } : {}),
    ...(rest.currency ? { currency: rest.currency === "usd" ? "usd" : "gbp" } : {}),
    drumExperience: drumExperienceOf((rest as Partial<CampaignDraft>).drumExperience),
    // Older local drafts have no pageDesign: drop the key so the server copy is kept.
    ...(pageDesign && typeof pageDesign === "object" && !Array.isArray(pageDesign) ? { pageDesign: pageDesignOf(pageDesign) } : {}),
  } as CampaignDraft;
}

function serializeVideos(d: CampaignDraft): CampaignVideo[] {
  return d.videos.slice(0, MAX_VIDEOS).map((v) => ({
    url: v.url.trim(), posterUrl: v.posterUrl, captionsUrl: v.captionsUrl, caption: v.caption,
  }));
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
    currency: d.currency,
    // Every row (including blank ones) survives autosave; public render filters empties.
    videos: serializeVideos(d),
    // Legacy single video: first finished video, for older clients.
    video: serializeVideos(d).find((v) => v.url) ?? null,
    theme: { ...(prevTheme ?? {}), ...d.colours, unit: d.unit },
    assistUsed: d.assistUsed,
    partnerFundingAnswer: d.partnerAnswer,
    unitChosen: d.unitChosen,
    drumExperience: d.drumExperience
      ? { enabled: d.drumExperience.enabled, updates: d.drumExperience.updates.slice(0, MAX_DRUM_UPDATES).map((u) => ({ ...u })) }
      : null,
    pageDesign: d.pageDesign ?? {},
  };
}

/** Builds a Campaign object the public page component can render. */
export function draftToPreviewCampaign(d: CampaignDraft, c: Campaign): Campaign {
  const p = draftToPatch(d, c.theme);
  return {
    ...c,
    name: p.name ?? "",
    tagline: p.tagline,
    type: d.type,
    goal: p.goal ?? 0,
    volunteersNeeded: p.volunteersNeeded ?? 0,
    partnerFunding: p.partnerFunding ?? null,
    deadline: p.deadline ?? null,
    description: p.description ?? "",
    breakdown: p.breakdown,
    locations: p.locations,
    imageUrl: p.imageUrl ?? null,
    currency: d.currency,
    video: p.video ?? null,
    videos: p.videos ?? [],
    theme: p.theme,
    drumExperience: p.drumExperience ?? null,
    pageDesign: d.pageDesign ?? {},
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
  if (d.name.trim().length > TITLE_MAX)
    out.push({ id: "campaign_name_length", message: `Shorten the campaign title to ${TITLE_MAX} characters (${d.name.trim().length} now).`, step: 1 });
  const len = isStructured(d.pageDesign) ? narrativeLength(d.description, d.pageDesign) : d.description.trim().length;
  if (len < STORY_MIN)
    out.push({ id: "story", message: `Write at least ${STORY_MIN} characters of story (${STORY_MIN - len} to go).`, step: 3 });
  const pd = d.pageDesign;
  if (pd?.programme?.boxes.some((b) => !b.title.trim()))
    out.push({ id: "programme_titles", message: "Give every programme box a title.", step: 3 });
  if (pd?.outcomes?.boxes.some((b) => !b.title.trim()))
    out.push({ id: "outcome_titles", message: "Give every outcome box a title.", step: 3 });
  if (pd?.team?.people.some((p) => !p.name.trim()))
    out.push({ id: "team_names", message: "Add a name for every person in Who's running it.", step: 3 });
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
