import { useState } from "react";
import { Link } from "wouter";
import {
  Share2, MapPin, CheckCircle, Clock, Users, ArrowRight, ShieldCheck, Play, Handshake, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Campaign, PublicCampaignLanding, CampaignVideo } from "@/lib/api";
import { AccumulationField } from "./accumulation-field";
import { capOf, partnerMatch, ratioLabel } from "@/lib/partner-funding";
import { whereYourMoneyGoes } from "@/lib/money-disclosure";
import { CampaignFeeBreakdown } from "./campaign-fee-breakdown";

export type CampaignPageLayout = "responsive" | "phone" | "desktop";

// Keep responsive utilities as complete, static strings so Tailwind emits them.
// The phone/desktop modes are forced layouts for the editor preview.
const responsiveUtilities: Record<string, string> = {
  "px-10": "md:px-10",
  "grid-cols-[minmax(0,5fr)_minmax(0,7fr)]": "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
  "grid-cols-[minmax(0,1fr)_340px]": "md:grid-cols-[minmax(0,1fr)_340px]",
  "gap-14": "md:gap-14",
  "gap-10": "md:gap-10",
  "pt-6": "md:pt-6",
  "inline-flex": "md:inline-flex",
  "pb-16": "md:pb-16",
  "text-[2.75rem]": "md:text-[2.75rem]",
  "text-[3.5rem]": "md:text-[3.5rem]",
  "text-[5.5rem]": "md:text-[5.5rem]",
  "max-w-[14ch]": "md:max-w-[14ch]",
  "max-w-[12ch]": "md:max-w-[12ch]",
  "text-lg": "md:text-lg",
  "aspect-[16/9]": "md:aspect-[16/9]",
  "aspect-[21/9]": "md:aspect-[21/9]",
  "py-20": "md:py-20",
  "pb-20": "md:pb-20",
  "max-w-3xl": "md:max-w-3xl",
  "ml-auto": "md:ml-auto",
  "grid-cols-2": "md:grid-cols-2",
  "flex-row": "md:flex-row",
  "items-center": "md:items-center",
  "justify-between": "md:justify-between",
  "text-[2.5rem]": "md:text-[2.5rem]",
  "max-w-[18ch]": "md:max-w-[18ch]",
  "text-[3.25rem]": "md:text-[3.25rem]",
};

/** Applies responsive variants only where the layout calls for them. */
function useMd(layout: CampaignPageLayout) {
  return (cls: string) =>
    layout === "phone" ? "" : layout === "desktop" ? cls :
      cls.split(" ").map((c) => responsiveUtilities[c] ?? `md:${c}`).join(" ");
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?cc_load_policy=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?texttrack=en`;
  return null;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Lazy video: nothing loads until the visitor taps play. Never autoplays. */
export function CampaignVideoBlock({ video, title }: { video: CampaignVideo; title: string }) {
  const [active, setActive] = useState(false);
  const embed = embedUrl(video.url);
  return (
    <div className="rounded-2xl overflow-hidden bg-gray-900 aspect-video relative" data-testid="block-campaign-video">
      {!active ? (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="absolute inset-0 w-full h-full flex items-center justify-center group"
          aria-label={`Play video: ${title}`}
          data-testid="button-play-video"
        >
          {video.posterUrl && <img src={video.posterUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
          <span className="relative w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-7 h-7 text-gray-900 ml-1" />
          </span>
        </button>
      ) : embed ? (
        <iframe src={embed} title={title} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" className="absolute inset-0 w-full h-full border-0" />
      ) : (
        <video controls preload="none" playsInline poster={video.posterUrl ?? undefined} className="absolute inset-0 w-full h-full" data-testid="video-campaign">
          <source src={video.url} />
          {video.captionsUrl && <track kind="captions" src={video.captionsUrl} srcLang="en" label="English" default />}
        </video>
      )}
    </div>
  );
}

export interface CampaignPageViewProps {
  campaign: Campaign;
  organisation: PublicCampaignLanding["organisation"];
  /** Preview disables donations, sharing and navigation side effects. */
  preview?: boolean;
  layout?: CampaignPageLayout;
  scrolled?: boolean;
  /** Ring the newest unit (only after a recorded receipt). */
  highlightNewest?: boolean;
  onDonate?: () => void;
  onVolunteer?: () => void;
  /** Deprecated: sharing is handled inside the view with a copy-link fallback. */
  onShare?: () => void;
}

type ShareState = { k: "idle" } | { k: "copied" } | { k: "manual"; url: string };

async function shareOrCopy(title: string, text: string, url: string): Promise<ShareState> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return { k: "idle" };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return { k: "idle" };
      // Native share failed for another reason: fall through to copy.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return { k: "copied" };
  } catch {
    return { k: "manual", url };
  }
}

async function copyOnly(url: string): Promise<ShareState> {
  try { await navigator.clipboard.writeText(url); return { k: "copied" }; } catch { return { k: "manual", url }; }
}

/** The single render component for public campaign pages and editor previews. */
export function CampaignPageView({
  campaign, organisation: org, preview = false, layout = "responsive", scrolled = false,
  highlightNewest = false, onDonate, onVolunteer,
}: CampaignPageViewProps) {
  const md = useMd(layout);
  const [share, setShare] = useState<ShareState>({ k: "idle" });
  const theme = campaign.theme ?? {
    primaryColor: "#B50000", accentColor: "#F5B800", backgroundColor: "#ffffff", textColor: "#111111",
  };
  const red = theme.primaryColor;
  const gold = theme.accentColor;
  const isFundraising = campaign.type === "fundraising";
  const pf = campaign.partnerFunding && campaign.partnerFunding.amount > 0 ? campaign.partnerFunding : null;
  const isMatching = pf?.type === "matching";
  const funder = pf?.funderName?.trim() || "a funding partner";
  // Committed: the pledge counts now. Matching: only what has actually been allocated.
  const matchedSoFar = isMatching ? Math.max(0, campaign.partnerFundingMatchedGbp ?? 0) : 0;
  const committed = pf ? (isMatching ? matchedSoFar : pf.amount) : 0;
  const raised = campaign.amountRaised ?? 0;
  const goal = campaign.goal ?? 0;
  const stillNeeded = Math.max(0, goal - committed - raised);
  const denom = Math.max(goal, committed + raised, 1);
  const committedPct = (committed / denom) * 100;
  const raisedPct = (raised / denom) * 100;
  const matchLeft = isMatching ? partnerMatch(0, pf, matchedSoFar).availableGbp : 0;
  const partnerLabel = isMatching ? "Matched so far" : `Committed by ${funder}`;
  const breakdown = (campaign.breakdown ?? []).filter((b) => b.label || b.detail);
  const locations = (campaign.locations ?? []).filter((l) => l.name || l.description);
  const team = (org.team ?? []).filter((t) => t.name);
  const unit = campaign.theme?.unit;
  const unitSingular = unit?.singular?.trim() || "supporter";
  const unitPlural = unit?.plural?.trim() || "supporters";
  const supporters = campaign.supporterCount ?? 0;
  const recent = campaign.recentSupporters ?? [];
  const anon = campaign.unidentifiedGifts ?? 0;
  const phases = campaign.phases ?? [];
  const money = whereYourMoneyGoes(org.name);
  const description = campaign.description?.trim() ?? "";
  const paras = description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const lead = paras[0] ?? "";
  const rest = paras.slice(1);
  const orgBlurb = org.shortDescription || org.description;
  const pc = campaign.pageContent ?? {};
  const t = (k: string) => (typeof pc[k] === "string" ? (pc[k] as string).trim() : "");
  const splitParas = (v: string) => v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const donateLabel = t("donateLabel");
  const hasCustomSupport = !!(t("supportHeading") || t("supportBody") || t("cohortHeading") || t("cohortBody") || t("cohortNote"));
  const fundingNote = t("fundingNote");
  const pctOf = (n: number) => (goal > 0 ? ` · ${Math.round((n / goal) * 100)}%` : "");

  const donate = () => { if (!preview) onDonate?.(); };
  const volunteer = () => { if (!preview) onVolunteer?.(); };
  const pageUrl = () => window.location.href.split("#")[0];
  const doShare = async () => {
    if (preview) return;
    setShare(await shareOrCopy(campaign.name, campaign.tagline || description.slice(0, 140), pageUrl()));
  };
  const doCopy = async () => { if (!preview) setShare(await copyOnly(pageUrl())); };
  const previewTitle = preview ? "Disabled in preview" : undefined;

  const initials = org.name.split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "O";
  const orgBadge = org.logo ? (
    <img src={org.logo} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/70" />
  ) : (
    <span className="w-8 h-8 rounded-full ring-2 ring-white/80 flex items-center justify-center text-[10px] font-extrabold tracking-tight text-white">{initials}</span>
  );
  const display = { fontFamily: "'Instrument Serif', 'Playfair Display', Georgia, 'Times New Roman', serif" } as const;
  const sectionPad = `px-5 ${md("px-10")}`;
  const wrap = "max-w-6xl mx-auto";
  const twoCol = `grid gap-6 ${md("grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-14")}`;
  const sectionTitle = `text-[2rem] leading-[0.98] font-black tracking-[-0.03em] text-[#1c1410] break-words ${md("text-[2.75rem]")}`;

  const fundingBar = goal > 0 && (
    <div className="space-y-3" data-testid="text-campaign-progress">
      <div className="h-2.5 w-full rounded-full overflow-hidden flex gap-[3px] bg-[#E9E2D6]" role="img"
        aria-label={pf
          ? `${gbp(committed)} ${isMatching ? "matched so far by" : "already committed by"} ${funder}, ${gbp(raised)} raised here, ${gbp(stillNeeded)} still needed of ${gbp(goal)}`
          : `${gbp(raised)} raised of ${gbp(goal)}, ${gbp(stillNeeded)} still needed`}>
        {committed > 0 && <div className="h-full rounded-full" style={{ width: `${committedPct}%`, backgroundColor: "#7A0000" }} />}
        {raised > 0 && <div className="h-full rounded-full" style={{ width: `${raisedPct}%`, backgroundColor: red }} />}
      </div>
      <dl className="space-y-2.5" data-testid="block-funding-split">
        {pf && (
          <div className="flex gap-2.5"><span className="w-2.5 h-2.5 mt-1 rounded-sm shrink-0 bg-[#7A0000]" /><div><dt className="text-[11px] text-[#6b5f55]">{partnerLabel}</dt><dd className="font-extrabold tabular-nums text-[#1c1410]">{gbp(committed)}{pctOf(committed)}</dd></div></div>
        )}
        <div className="flex gap-2.5"><span className="w-2.5 h-2.5 mt-1 rounded-sm shrink-0" style={{ backgroundColor: red }} /><div><dt className="text-[11px] text-[#6b5f55]">Raised here</dt><dd className="font-extrabold tabular-nums text-[#1c1410]">{gbp(raised)}{pctOf(raised)}</dd></div></div>
        <div className="flex gap-2.5"><span className="w-2.5 h-2.5 mt-1 rounded-sm shrink-0 bg-[#E0D8CC]" /><div><dt className="text-[11px] text-[#6b5f55]">Still needed</dt><dd className="font-extrabold tabular-nums text-[#1c1410]">{gbp(stillNeeded)}{pctOf(stillNeeded)}</dd></div></div>
      </dl>
    </div>
  );

  return (
    <div
      className={`${preview ? "min-h-full relative" : "min-h-[100dvh]"} flex flex-col font-sans overflow-x-hidden bg-white text-[#1c1410]`}
      data-testid={preview ? "view-campaign-preview" : "view-campaign-page"}
    >
      {/* Top bar */}
      <header
        className={`${preview ? "relative" : "fixed top-0 inset-x-0"} z-40 transition-[background-color,box-shadow] duration-300 ${scrolled ? "shadow-md py-2" : "py-3.5"}`}
        style={{ backgroundColor: scrolled || preview ? red : `${red}F2` }}
      >
        <div className={`${wrap} ${sectionPad} flex items-center justify-between gap-3 text-white`}>
          {preview ? (
            <div className="flex items-center gap-2.5 min-w-0">{orgBadge}<span className="font-bold text-sm truncate">{org.name}</span></div>
          ) : (
            <Link href={`/organisations/${org._id}`} data-testid="link-organisation-profile" className="flex items-center gap-2.5 min-w-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              {orgBadge}
              <span className="font-bold text-sm truncate underline-offset-2 hover:underline">{org.name}</span>
            </Link>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={doShare} disabled={preview} title={previewTitle} aria-label="Share this campaign"
              className={`hidden ${md("inline-flex")} items-center gap-1.5 h-9 px-3.5 rounded-lg border border-white/70 text-sm font-bold hover:bg-white/10 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
              data-testid="button-header-share">
              <Share2 className="w-4 h-4" /> Share
            </button>
            <Button
              className="h-9 rounded-lg px-4 font-extrabold shadow-none hover:brightness-95"
              style={{ backgroundColor: gold, color: "#1c1410" }}
              onClick={() => (isFundraising ? donate() : volunteer())}
              disabled={preview}
              title={previewTitle}
              data-testid="button-header-campaign-action"
            >
              {isFundraising ? "Donate" : "Get involved"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 1. Red editorial opening */}
        <section className={`text-white ${preview ? "pt-6" : "pt-20"} pb-12 ${md("pb-16")}`} style={{ backgroundColor: red }}>
          <div className={`${wrap} ${sectionPad} grid gap-8 ${md("grid-cols-[minmax(0,1fr)_340px] gap-10 pt-6")}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 text-[12px] font-semibold text-white/85">
                {campaign.status === "completed" && <span className="px-2.5 py-0.5 rounded-full bg-white text-[11px] font-extrabold uppercase tracking-wider" style={{ color: red }}>Completed</span>}
                {campaign.deadline && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden="true" /> Ends {new Date(campaign.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span>}
                {org.city && org.country && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {org.city}, {org.country}</span>}
              </div>
              <h1 data-testid="text-campaign-name" style={display}
                className={`italic text-[3.1rem] leading-[0.92] tracking-[-0.01em] break-words ${md("text-[5.5rem] max-w-[14ch]")}`}>
                {campaign.name}
              </h1>
              {campaign.tagline && (
                <p data-testid="text-campaign-tagline" className={`mt-5 text-[1.05rem] leading-snug font-medium text-white/95 max-w-xl ${md("text-lg")}`}>
                  {campaign.tagline}
                </p>
              )}

              {isFundraising ? (
                <div className="mt-7 rounded-2xl overflow-hidden ring-1 ring-black/10 shadow-[0_24px_60px_-20px_rgba(60,0,0,0.6)]"
                  data-testid="block-campaign-hero" data-tour-id="campaign-accumulation">
                  <AccumulationField
                    count={supporters}
                    unitSingular={unitSingular}
                    unitPlural={unitPlural}
                    imageUrl={unit?.imageUrl ?? null}
                    colour={red}
                    accent={gold}
                    background="#F9F6F0"
                    highlightNewest={highlightNewest}
                    still={preview}
                    height={layout === "phone" ? 240 : 320}
                  />
                </div>
              ) : campaign.imageUrl ? (
                <div className="mt-7 rounded-2xl overflow-hidden">
                  <img src={campaign.imageUrl} alt="" data-testid="img-campaign-cover" className={`w-full object-cover aspect-[4/3] ${md("aspect-[16/9]")}`} />
                </div>
              ) : null}
            </div>

            {/* Sidebar */}
            <aside className="space-y-4 min-w-0" aria-label={isFundraising ? "Giving and funding" : "Volunteering"}>
              {isFundraising ? (
                <>
                  <div data-testid="text-supporter-count">
                    <div className="text-[4rem] leading-[0.85] font-black tabular-nums tracking-[-0.04em]" style={{ color: gold }}>
                      {supporters.toLocaleString("en-GB")}
                    </div>
                    <div className="mt-2 text-lg font-extrabold">{supporters === 1 ? unitSingular : unitPlural}</div>
                    <p className="text-sm text-white/85 mt-1 leading-snug">
                      {supporters === 0 ? `Every supporter adds one ${unitSingular}. Be the first.` : `One for every person who has given to ${campaign.name}, whatever the amount.`}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#F9F6F0] text-[#1c1410] p-5 shadow-lg">
                    <h2 className="text-lg font-extrabold leading-tight">{donateLabel || `Add your ${unitSingular}`}</h2>
                    <p className="text-[12px] text-[#6b5f55] mt-0.5">Choose your amount at the next step.</p>
                    <Button
                      className="mt-4 w-full h-12 text-base font-extrabold rounded-xl shadow-none hover:brightness-95"
                      style={{ backgroundColor: gold, color: "#1c1410" }}
                      onClick={donate}
                      disabled={preview}
                      title={previewTitle}
                      data-testid="button-donate-campaign"
                    >
                      Donate <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                    </Button>
                    <p className="mt-3 text-center text-[11px] font-medium text-[#6b5f55] flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-800" aria-hidden="true" />
                      {preview ? "Donations are switched off in preview" : "From £3 · Secure payment by Stripe"}
                    </p>
                  </div>

                  {(goal > 0 || pf || fundingNote) && (
                    <div className="rounded-2xl bg-white text-[#1c1410] p-5 shadow-lg">
                      <h2 className="text-base font-extrabold">How this is funded</h2>
                      {fundingNote && (
                        <p className="mt-3 text-[13px] leading-relaxed text-[#3a2f28] whitespace-pre-wrap" data-testid="text-funding-note">{fundingNote}</p>
                      )}
                      {pf && (
                        <p className="mt-3 rounded-lg bg-[#F2EDE4] p-3 text-[13px] leading-relaxed flex gap-2" data-testid="text-partner-funding">
                          <Handshake className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                          <span>
                            {!isMatching
                              ? `${gbp(pf.amount)} already committed by ${funder}. Donations help close the remaining gap.`
                              : matchLeft > 0
                                ? `${funder} will match gifts ${ratioLabel(pf)}, up to ${gbp(capOf(pf))}. ${gbp(matchedSoFar)} matched so far; ${gbp(matchLeft)} of matching is still available.`
                                : "Matching has been fully claimed."}
                          </span>
                        </p>
                      )}
                      {fundingBar && <div className="mt-4">{fundingBar}</div>}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl bg-[#F9F6F0] text-[#1c1410] p-5 shadow-lg space-y-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-6 h-6" style={{ color: red }} aria-hidden="true" />
                    <div>
                      <div className="text-3xl font-black tabular-nums">{campaign.volunteersNeeded}</div>
                      <div className="text-sm text-[#6b5f55]">volunteers needed</div>
                    </div>
                  </div>
                  <Button className="w-full h-12 text-base font-extrabold rounded-xl" style={{ backgroundColor: gold, color: "#1c1410" }}
                    onClick={volunteer} disabled={preview} title={previewTitle} data-testid="button-volunteer-campaign">
                    Apply to volunteer <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </aside>
          </div>
        </section>

        {/* 2. Story */}
        {(description || (isFundraising && campaign.imageUrl) || campaign.video?.url) && (
          <section className={`py-14 ${md("py-20")} bg-white`}>
            <div className={`${wrap} ${sectionPad} space-y-12`}>
              {lead && (
                <div className={twoCol}>
                  <h2 className={sectionTitle}>{t("storyHeading") || "The story"}</h2>
                  <div data-testid="text-campaign-description" className="space-y-4 text-[1.02rem] leading-relaxed text-[#3a2f28] break-words">
                    <p className="text-lg font-semibold text-[#1c1410] whitespace-pre-wrap">{lead}</p>
                    {rest.map((p, i) => <p key={i} className="whitespace-pre-wrap">{p}</p>)}
                  </div>
                </div>
              )}
              {isFundraising && campaign.imageUrl && (
                <img src={campaign.imageUrl} alt="" data-testid="img-campaign-cover" loading="lazy" className={`w-full rounded-2xl object-cover aspect-[4/3] ${md("aspect-[21/9]")}`} />
              )}
              {campaign.video?.url && (
                <div className={`${md("max-w-3xl ml-auto")}`}><CampaignVideoBlock video={campaign.video} title={`${campaign.name} video`} /></div>
              )}
            </div>
          </section>
        )}

        {/* 3. Breakdown + locations */}
        {(breakdown.length > 0 || locations.length > 0) && (
          <section className={`pb-14 ${md("pb-20")} bg-white`}>
            <div className={`${wrap} ${sectionPad} border-t-2 border-[#1c1410] pt-10 space-y-14`}>
              {breakdown.length > 0 && (
                <div className={twoCol} data-testid="list-campaign-breakdown">
                  <div className="min-w-0">
                    <h2 className={sectionTitle}>{t("programmeHeading") || "What your money buys"}</h2>
                    {t("programmeSummary") && (
                      <p className="mt-4 inline-block rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white" style={{ backgroundColor: red }} data-testid="text-programme-summary">{t("programmeSummary")}</p>
                    )}
                  </div>
                  <div className="min-w-0 space-y-5">
                  {t("programmeIntro") && (
                    <div className="space-y-3 text-[1.02rem] leading-relaxed text-[#3a2f28]" data-testid="text-programme-intro">
                      {splitParas(t("programmeIntro")).map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                  )}
                  <ul className="border-t border-[#E0D8CC]" aria-live="polite" aria-relevant="additions text" aria-label="Most recent campaign donors">
                    {breakdown.map((b, i) => (
                      <li key={i} className="py-4 border-b border-[#E0D8CC]" data-testid={`row-breakdown-${i}`}>
                        {b.label && <p className="text-lg font-extrabold tabular-nums break-words" style={{ color: red }}>{b.label}</p>}
                        {b.detail && <p className="text-sm leading-relaxed text-[#3a2f28] mt-1 break-words">{b.detail}</p>}
                      </li>
                    ))}
                  </ul>
                  {t("programmeAfterword") && (
                    <div className="space-y-3 text-[1.02rem] leading-relaxed text-[#3a2f28]" data-testid="text-programme-afterword">
                      {splitParas(t("programmeAfterword")).map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                  )}
                  </div>
                </div>
              )}
              {locations.length > 0 && (
                <div className={twoCol} data-testid="list-campaign-locations">
                  <h2 className={sectionTitle}>Where it happens</h2>
                  <div className={`grid gap-4 ${md("grid-cols-2")}`}>
                    {locations.map((l, i) => (
                      <div key={i} className="rounded-2xl overflow-hidden bg-[#F9F6F0]" data-testid={`card-location-${i}`}>
                        {l.photoUrl && <img src={l.photoUrl} alt={l.name} loading="lazy" className="w-full aspect-[16/10] object-cover" />}
                        <div className="p-4">
                          <p className="font-extrabold flex items-center gap-1.5"><MapPin className="w-4 h-4 shrink-0" style={{ color: red }} aria-hidden="true" />{l.name}</p>
                          {l.description && <p className="text-sm text-[#3a2f28] mt-1">{l.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 4. Impact moment: milestones on cream */}
        {phases.length > 0 && (
          <section className={`py-14 ${md("py-20")} bg-[#F2EDE4]`}>
            <div className={`${wrap} ${sectionPad}`}>
              {t("outcomesStatus") && (
                <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ borderColor: red, color: red }} data-testid="status-outcomes">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {t("outcomesStatus")}
                </p>
              )}
              <h2 className={`${sectionTitle} ${md("text-[3.5rem] max-w-[12ch]")}`}>What your support makes possible</h2>
              {t("outcomesIntro") && (
                <div className="mt-5 max-w-2xl space-y-3 text-[1.02rem] leading-relaxed text-[#3a2f28]" data-testid="text-outcomes-intro">
                  {splitParas(t("outcomesIntro")).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}
              <ol className={`mt-10 grid gap-x-8 ${md("grid-cols-2")} ${layout === "desktop" ? "" : "lg:grid-cols-4"}`} data-testid="list-campaign-milestones">
                {phases.map((phase) => (
                  <li key={phase.id} className="py-4 border-t border-[#d6ccbc] flex gap-3" data-testid={`card-campaign-milestone-${phase.id}`}>
                    {phase.completed
                      ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-green-800" aria-label="Completed" />
                      : <span className="w-5 h-5 shrink-0 mt-0.5 rounded-full border-2" style={{ borderColor: red }} aria-label="Not yet completed" />}
                    <div className="min-w-0">
                      <p className="font-extrabold">{phase.title}</p>
                      {phase.description && <p className="text-sm text-[#3a2f28] mt-0.5">{phase.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
              {t("outcomesNote") && (
                <p className="mt-6 max-w-2xl text-sm italic leading-relaxed text-[#6b5f55]" data-testid="text-outcomes-note">{t("outcomesNote")}</p>
              )}
            </div>
          </section>
        )}

        {/* 5a. Custom support appeal + cohort card */}
        {isFundraising && hasCustomSupport && (
          <section style={{ backgroundColor: gold }} className="text-[#1c1410]" data-testid="block-support-appeal">
            <div className={`${wrap} ${sectionPad} py-12 ${md("py-20")} ${twoCol}`}>
              <div className="min-w-0">
                {t("supportHeading") && <h2 className={`${sectionTitle} ${md("text-[3.25rem]")}`}>{t("supportHeading")}</h2>}
                {t("supportBody") && (
                  <div className="mt-4 space-y-3 text-[1.05rem] leading-relaxed">
                    {splitParas(t("supportBody")).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
                <Button className="mt-6 h-12 px-6 rounded-xl text-base font-extrabold text-white" style={{ backgroundColor: red }}
                  onClick={donate} disabled={preview} title={previewTitle} data-testid="button-donate-campaign-strip">
                  {donateLabel || `Add your ${unitSingular}`} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Button>
              </div>
              {(t("cohortHeading") || t("cohortBody") || t("cohortNote")) && (
                <div className="rounded-2xl bg-[#F9F6F0] p-6 shadow-lg min-w-0" data-testid="card-cohort">
                  {t("cohortHeading") && <h3 style={display} className="italic text-[2rem] leading-[1]" >{t("cohortHeading")}</h3>}
                  {t("cohortBody") && <p className="mt-3 leading-relaxed text-[#3a2f28]">{t("cohortBody")}</p>}
                  {t("cohortNote") && <p className="mt-4 pt-4 border-t border-[#E0D8CC] text-[13px] leading-relaxed text-[#6b5f55]">{t("cohortNote")}</p>}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 5. Support moment: gold strip */}
        {isFundraising && !hasCustomSupport && (
          <section style={{ backgroundColor: gold }} className="text-[#1c1410]">
            <div className={`${wrap} ${sectionPad} py-10 flex flex-col gap-5 ${md("flex-row items-center justify-between")}`}>
              <p className={`text-[1.9rem] leading-[1] font-black tracking-[-0.03em] ${md("text-[2.5rem] max-w-[18ch]")}`}>
                {supporters === 0 ? `The first ${unitSingular} could be yours.` : `${supporters.toLocaleString("en-GB")} ${supporters === 1 ? unitSingular : unitPlural} and counting.`}
              </p>
              <Button className="h-12 px-6 rounded-xl text-base font-extrabold shrink-0 text-white" style={{ backgroundColor: red }}
                onClick={donate} disabled={preview} title={previewTitle} data-testid="button-donate-campaign-strip">
                {donateLabel || `Add your ${unitSingular}`} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </div>
          </section>
        )}

        {/* 6. Organisation + money */}
        <section className={`py-14 ${md("py-20")} bg-white`}>
          <div className={`${wrap} ${sectionPad} space-y-14`}>
            <div className={twoCol} data-testid="block-organisation">
              <h2 className={sectionTitle}>Who's running it</h2>
              <div>
                <div className="flex items-center gap-3">
                  {org.logo ? <img src={org.logo} alt="" className="w-14 h-14 rounded-full object-cover" /> : (
                    <span className="w-14 h-14 rounded-full flex items-center justify-center text-base font-black text-white" style={{ backgroundColor: red }}>{initials}</span>
                  )}
                  <div className="min-w-0">
                    <p data-testid="text-organisation-name" className="text-xl font-extrabold break-words">{org.name}</p>
                    {org.verified && <p className="text-xs font-bold text-green-800 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Verified organisation</p>}
                  </div>
                </div>
                {orgBlurb && <p className="mt-4 text-[1.02rem] leading-relaxed text-[#3a2f28]">{orgBlurb}</p>}
                {team.length > 0 && (
                  <ul className={`mt-6 grid grid-cols-1 gap-4 ${md("grid-cols-2")}`} data-testid="list-campaign-team">
                    {team.map((t, i) => (
                      <li key={i} className="flex items-center gap-3 min-w-0" data-testid={`card-team-${i}`}>
                        {t.photoUrl ? <img src={t.photoUrl} alt="" loading="lazy" className="w-11 h-11 rounded-full object-cover shrink-0" /> : (
                          <span className="w-11 h-11 rounded-full bg-[#F2EDE4] flex items-center justify-center text-sm font-extrabold shrink-0" style={{ color: red }}>{t.name.charAt(0)}</span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-bold truncate">{t.name}</span>
                          {t.role && <span className="block text-xs text-[#6b5f55] truncate">{t.role}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {t("organisationNote") && (
                  <p className="mt-6 rounded-xl border-l-4 bg-[#F9F6F0] p-4 text-sm leading-relaxed text-[#3a2f28]" style={{ borderColor: red }} data-testid="text-organisation-note">{t("organisationNote")}</p>
                )}
                {!preview && (
                  <Link href={`/organisations/${org._id}`} className="mt-6 inline-flex items-center gap-1 text-sm font-extrabold underline-offset-4 hover:underline" style={{ color: red }} data-testid="link-organisation-profile-footer">
                    See their profile <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>

            {isFundraising && (
              <div className={`${twoCol} border-t-2 border-[#1c1410] pt-10`} data-testid="block-money-disclosure">
                <h2 className={sectionTitle}>Where your money goes</h2>
                <div className="rounded-2xl bg-[#F9F6F0] p-5 space-y-3">
                  <p className="text-[1.02rem] leading-relaxed text-[#1c1410]" data-testid="text-money-disclosure">{money.sentence}</p>
                  {campaign.pageContent && <CampaignFeeBreakdown orgName={org.name} colour={red} />}
                  {isMatching && matchLeft > 0 && (
                    <p className="text-sm leading-relaxed text-[#3a2f28]">
                      Matched funds come from {funder}'s pledge, not from your card. You are only ever charged what you choose to give.
                    </p>
                  )}
                </div>
              </div>
            )}

            {isFundraising && (
              <div className={`${twoCol} border-t-2 border-[#1c1410] pt-10`} data-testid="block-recent-supporters">
                <h2 className={sectionTitle}>{t("supportersHeading") || "Recent supporters"}</h2>
                {recent.length === 0 && anon === 0 ? (
                  <p className="text-2xl font-black" style={{ color: red }} data-testid="text-be-first">Be the first.</p>
                ) : (
                  <ul className="border-t border-[#E0D8CC]">
                    {recent.map((s, i) => (
                      <li key={`${s.createdAt}-${i}`} className="py-3 border-b border-[#E0D8CC] flex items-center justify-between gap-3" data-testid={`row-supporter-${i}`}>
                        <span className="flex items-center gap-2.5 min-w-0">
                          {unit?.imageUrl ? <img src={unit.imageUrl} alt="" className="w-6 h-6 shrink-0" /> : <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: red }} />}
                          <span className="font-bold truncate">{s.displayName || "Anonymous"}</span>
                        </span>
                        <span className="text-xs shrink-0 tabular-nums text-[#6b5f55]">{timeAgo(s.createdAt)}</span>
                      </li>
                    ))}
                    {anon > 0 && (
                      <li className="py-3 border-b border-[#E0D8CC] text-sm text-[#6b5f55]" data-testid="text-unidentified-gifts">
                        plus {anon.toLocaleString("en-GB")} earlier {anon === 1 ? "gift" : "gifts"} from before supporters were counted
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 7. Full-bleed share close */}
        <section className="text-white" style={{ backgroundColor: red }} data-testid="block-share">
          <div className={`${wrap} ${sectionPad} py-12 flex flex-col gap-6 ${md("flex-row items-center justify-between")}`}>
            <div className="min-w-0">
              <p style={display} className={`italic text-[2.4rem] leading-[0.95] break-words ${md("text-[3.25rem]")}`}>{t("shareHeading") || `Know someone who'd add a ${unitSingular}?`}</p>
              <p className="mt-2 text-white/90">{t("shareBody") || "Share the campaign. A share from you is worth more than any ad."}</p>
            </div>
            <div className="flex flex-col gap-3 shrink-0 min-w-0">
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={doShare} disabled={preview} title={previewTitle}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border-2 border-white font-extrabold text-sm hover:bg-white/10 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  data-testid="button-share-campaign">
                  <Share2 className="w-4 h-4" aria-hidden="true" /> Share the campaign
                </button>
                <button type="button" onClick={doCopy} disabled={preview} title={previewTitle}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#7A0000] font-extrabold text-sm hover:bg-[#5e0000] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  data-testid="button-copy-link">
                  <Link2 className="w-4 h-4" aria-hidden="true" /> Copy link
                </button>
              </div>
              <div aria-live="polite" className="text-sm min-h-[1.25rem]">
                {share.k === "copied" && <span className="inline-flex items-center gap-1.5 font-bold" data-testid="text-share-copied"><CheckCircle className="w-4 h-4" aria-hidden="true" /> Link copied</span>}
                {share.k === "manual" && (
                  <label className="block">
                    <span className="text-xs text-white/85">Copy this link:</span>
                    <input readOnly value={share.url} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm text-[#1c1410]" data-testid="input-share-url" />
                  </label>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#7A0000] text-white/85 text-xs">
        <div className={`${wrap} ${sectionPad} py-4 flex flex-wrap items-center justify-between gap-2`}>
          <p>Powered by <span className="font-bold text-white">Root ProjX</span></p>
          {!preview && (
            <div className="flex items-center gap-4">
              <Link href="/terms" className="hover:underline">Terms</Link>
              <Link href="/privacy" className="hover:underline">Privacy</Link>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
