// The guided walkthrough, as data. Reorder or reword here without touching the builders.
// completionCheck reads ONLY real saved data (org/campaign queries, server walkthrough
// events). There are no "step done" flags. null = a deliberate action step (Start/Continue).
import type { Campaign, Org, WalkthroughState } from "@/lib/api";

export type TourId = "profile" | "campaign";

export interface TourCtx {
  org: Org | undefined;
  campaigns: Campaign[];
  /** The campaign the campaign tour is working on (saved data). */
  campaign: Campaign | undefined;
  wt: WalkthroughState | undefined;
}

export interface TourPlace {
  tab: "build" | "campaigns" | "profile" | "overview";
  /** Campaign wizard step that holds the anchor. */
  wizardStep?: 1 | 2 | 3 | 4 | 5;
  /** Needs the selected campaign open in the wizard. */
  inWizard?: boolean;
}

export interface TourStep {
  id: string;
  tour: TourId;
  /** data-tour-id of a real element; null = centred panel. */
  anchor: string | null;
  title: string;
  body: string;
  completionCheck: ((c: TourCtx) => boolean) | null;
  skippable: boolean;
  place: TourPlace;
  /** Optional side-trip when a required field lives elsewhere (e.g. country in Identity). */
  helper?: (c: TourCtx) => { label: string; target: string; doneWhen: (c: TourCtx) => boolean } | null;
  /** Label for action steps (completionCheck === null). */
  actionLabel?: string;
}

const len = (s: string | null | undefined) => (s ?? "").trim().length;

export const STORY_EXAMPLE =
  "Example: \u201CIn 2019 four mothers in Kisumu started teaching their children to read under a mango tree. Today 62 children come every afternoon. Most will be the first in their family to finish school. We buy books, pay two teachers a small wage, and serve a hot meal so nobody learns hungry.\u201D Say who you are, who you serve, what changes, and why it matters to you.";

export const TOUR_STEPS: TourStep[] = [
  // ── Tour 1: Your profile ────────────────────────────────────────────────
  { id: "p-welcome", tour: "profile", anchor: null, place: { tab: "build" }, skippable: false, completionCheck: null, actionLabel: "Start",
    title: "Let's get you donor-ready",
    body: "We'll build what donors see about you, one thing at a time. It takes about 10 minutes, everything saves as you go, and you can stop any time." },
  { id: "p-logo", tour: "profile", anchor: "profile-identity-logo", place: { tab: "build" }, skippable: false,
    completionCheck: (c) => !!c.org?.logo,
    title: "Your logo", body: "Donors recognise you by this first. Upload your logo — a square picture works best." },
  { id: "p-cover", tour: "profile", anchor: "profile-identity-cover", place: { tab: "build" }, skippable: false,
    completionCheck: (c) => !!c.org?.coverImage,
    title: "A cover photo", body: "One wide photo of your work or your people. It sits across the top of your profile." },
  { id: "p-short", tour: "profile", anchor: "profile-identity-short-description", place: { tab: "build" }, skippable: false,
    completionCheck: (c) => len(c.org?.shortDescription) >= 20,
    title: "One line about you", body: "What you do, in one sentence (20 to 120 characters). It saves when you tap outside the box." },
  { id: "p-story", tour: "profile", anchor: "profile-story-description", place: { tab: "build" }, skippable: false,
    completionCheck: (c) => len(c.org?.description) >= 200,
    title: "Your full story", body: `At least 200 characters. ${STORY_EXAMPLE}` },
  { id: "p-where", tour: "profile", anchor: "profile-section-sectors", place: { tab: "build" }, skippable: false,
    completionCheck: (c) => !!c.org?.country?.trim() && ((c.org?.categories?.length ?? 0) > 0 || !!c.org?.category),
    helper: (c) => (c.org?.country?.trim() ? null : { label: "Add your country first", target: "edit-identity", doneWhen: (x) => !!x.org?.country?.trim() }),
    title: "Where you work", body: "Pick at least one sector. Your country and city sit in the identity section above — make sure the country is saved too." },
  { id: "p-metrics", tour: "profile", anchor: "profile-section-impact", place: { tab: "build" }, skippable: true,
    completionCheck: (c) => !!c.org?.impactMetrics && Object.keys(c.org.impactMetrics).length > 0,
    title: "Impact numbers (optional)", body: "Donors see these as big numbers on your profile — people reached, ground covered. Save one, or skip for now." },
  { id: "p-payout", tour: "profile", anchor: "payout-setup", place: { tab: "profile" }, skippable: false,
    completionCheck: (c) => !!c.wt?.payoutSetupSelected,
    title: "How you get paid", body: "Choose how donations reach you. You can return to this later, but an approved payout method is required before you can publish a campaign." },
  { id: "p-preview", tour: "profile", anchor: "profile-view-public", place: { tab: "build" }, skippable: false,
    completionCheck: (c) => !!c.wt?.profilePreviewedAt,
    title: "See it as a donor", body: "Open your profile exactly as a donor will see it. It opens in a new tab — come back here when you've looked." },
  { id: "p-handoff", tour: "profile", anchor: null, place: { tab: "build" }, skippable: false, completionCheck: null, actionLabel: "Build a campaign",
    title: "Next: your first campaign",
    body: "Let's build something to raise for. Anything you skipped stays on your setup checklist so you can come back to it." },

  // ── Tour 2: Your first campaign ─────────────────────────────────────────
  { id: "c-create", tour: "campaign", anchor: "campaign-new", place: { tab: "campaigns" }, skippable: false,
    // A saved draft from an earlier run legitimately counts (resume/replay): no duplicate needed.
    completionCheck: (c) => !!c.campaign && c.campaigns.some((x) => x._id === c.campaign!._id),
    title: "Start a campaign", body: "A campaign is one thing you're raising for. Tap New campaign to start a draft — nothing goes live yet." },
  { id: "c-name", tour: "campaign", anchor: "campaign-name", place: { tab: "campaigns", inWizard: true, wizardStep: 1 }, skippable: false,
    completionCheck: (c) => len(c.campaign?.name) > 0 && len(c.campaign?.tagline) > 0,
    title: "Name and one-line ask", body: "Give it a name, then the one-line ask below it. Both save automatically." },
  { id: "c-goal", tour: "campaign", anchor: "campaign-goal", place: { tab: "campaigns", inWizard: true, wizardStep: 2 }, skippable: false,
    completionCheck: (c) => (c.campaign?.goal ?? 0) > 0,
    title: "Your goal", body: "What the whole thing costs, in pounds." },
  { id: "c-match", tour: "campaign", anchor: "campaign-match-funding", place: { tab: "campaigns", inWizard: true, wizardStep: 2 }, skippable: false,
    completionCheck: (c) => c.campaign?.partnerFundingAnswer === "yes" || c.campaign?.partnerFundingAnswer === "no",
    title: "Funding partner", body: "Has a funder already committed money to this, or promised to match what donors give? Answer yes or no — no is common and fine." },
  { id: "c-story", tour: "campaign", anchor: "campaign-story", place: { tab: "campaigns", inWizard: true, wizardStep: 3 }, skippable: false,
    completionCheck: (c) => len(c.campaign?.description) >= 200,
    title: "The story", body: "At least 200 characters: who it's for, what changes, why now." },
  { id: "c-breakdown", tour: "campaign", anchor: "campaign-breakdown", place: { tab: "campaigns", inWizard: true, wizardStep: 3 }, skippable: true,
    completionCheck: (c) => (c.campaign?.breakdown ?? []).some((b) => len(b.label) > 0),
    title: "What the money buys", body: "Add one line like \u201C£10 — a term of exercise books\u201D. Or skip." },
  { id: "c-locations", tour: "campaign", anchor: "campaign-locations", place: { tab: "campaigns", inWizard: true, wizardStep: 3 }, skippable: true,
    completionCheck: (c) => (c.campaign?.locations ?? []).some((l) => len(l.name) > 0),
    title: "Where it happens", body: "Add one place. Or skip." },
  { id: "c-hero", tour: "campaign", anchor: "campaign-hero", place: { tab: "campaigns", inWizard: true, wizardStep: 4 }, skippable: false,
    completionCheck: (c) => !!c.campaign?.imageUrl,
    title: "Hero image", body: "The big picture at the top of your page. Faces near the centre work best." },
  { id: "c-video", tour: "campaign", anchor: "campaign-video", place: { tab: "campaigns", inWizard: true, wizardStep: 4 }, skippable: true,
    completionCheck: (c) => len(c.campaign?.video?.url) > 0,
    title: "Video (optional)", body: "A YouTube or Vimeo link, or upload a file. Add captions — most people watch on mute. Or skip." },
  { id: "c-unit", tour: "campaign", anchor: "campaign-unit", place: { tab: "campaigns", inWizard: true, wizardStep: 4 }, skippable: false,
    completionCheck: (c) => c.campaign?.unitChosen === true,
    title: "What does each donor add?", body: "Pick a hand, a brick, a seedling, a drop — or your own. Watch the field fill with it. Every donor adds one: this is the moment the page becomes yours." },
  { id: "c-preview", tour: "campaign", anchor: "campaign-preview-open", place: { tab: "campaigns", inWizard: true }, skippable: false,
    completionCheck: (c) => !!c.wt?.campaignPreviewedAt && !!c.campaign && c.wt.campaignPreviewedId === c.campaign._id,
    title: "Preview as a donor", body: "Open the real page with your draft in it. Donations are switched off there. Come back when you've looked." },
  { id: "c-publish", tour: "campaign", anchor: "campaign-publish-gates", place: { tab: "campaigns", inWizard: true, wizardStep: 5 }, skippable: false,
    // Published AND no saved private revision waiting: only an explicit publish promotes the draft.
    completionCheck: (c) => c.campaign?.enabled === true && c.campaign.hasUnpublishedChanges !== true && c.campaigns.some((x) => x._id === c.campaign!._id),
    title: "Publish", body: "Anything still missing is listed here with a link to fix it. When the list is clear, publish." },
];

export const stepsFor = (tour: TourId) => TOUR_STEPS.filter((s) => s.tour === tour);

// ── Checklist underneath (also real data) ────────────────────────────────
export interface ChecklistItem { id: string; label: string; done: boolean; href: string }

export function checklist(c: TourCtx): ChecklistItem[] {
  const o = c.org;
  return [
    { id: "images", label: "Logo and cover image", done: !!o?.logo && !!o?.coverImage, href: "/dashboard?tab=build#edit-identity" },
    { id: "story", label: "Your story", done: len(o?.description) >= 200, href: "/dashboard?tab=build#edit-story" },
    { id: "where", label: "Where you work", done: !!o?.country?.trim() && ((o?.categories?.length ?? 0) > 0 || !!o?.category), href: "/dashboard?tab=build#edit-sectors" },
    { id: "payout", label: "How you get paid", done: !!c.wt?.payoutSetupSelected || (!!o?.payoutMethod && o.payoutMethod !== "none"), href: "/dashboard?tab=profile" },
    { id: "campaign", label: "Your first campaign", done: c.campaigns.some((x) => x.enabled), href: "/dashboard?tab=campaigns" },
  ];
}
