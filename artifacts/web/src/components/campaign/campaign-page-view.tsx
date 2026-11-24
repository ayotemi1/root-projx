import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import { BookmarkButton } from "@/components/bookmarks/BookmarkButton";
import {
  Share2, MapPin, CheckCircle, Users, ArrowRight, ShieldCheck, Play, Handshake, Link2,
} from "lucide-react";
import type { Campaign, PublicCampaignLanding, CampaignVideo, CampaignEditableSection } from "@/lib/api";
import { DEFAULT_SCHEMES, resolveSectionOrder, schemeSectionClass } from "./section-design";
import { AccumulationField } from "./accumulation-field";
import { safeHandCount } from "@/lib/hand-wall-layout";
import { capOf, partnerMatch, ratioLabel } from "@/lib/partner-funding";
import { whereYourMoneyGoes } from "@/lib/money-disclosure";
import { CampaignFeeBreakdown } from "./campaign-fee-breakdown";
import { CampaignSymbol, campaignPresentation } from "@/components/campaign-symbol";
import { DonationHand, HANDPRINT_URL } from "@/components/donation-hand";
import { CampaignDonatePanel, focusDonateBox, type DonateChoice, type ConfirmedReceiptView } from "./campaign-donate-panel";
import { currencyOf, formatWhole } from "@/lib/currency";
import { campaignVideos } from "@/components/campaign-builder/model";
import { DrumCircle } from "./drum-circle";
import { fundedDrums, isDrumCampaign, canUseDrumExperience } from "@/lib/drum-experience";
import { LifeyardStory, LifeyardBreakdown } from "./lifeyard-sections";
import { DRUM_LIFE_COPY } from "@/lib/drum-life-copy";
import { useFitSplit } from "./use-fit-split";
import { useFitTitle } from "./use-fit-title";
import "./campaign-redesign.css";

export type CampaignPageLayout = "responsive" | "phone" | "desktop";

/** Supplied campaign model colours. Old platform defaults map onto these; custom choices are kept. */
export const CAMPAIGN_ACCENT = "#B3121B";
export const CAMPAIGN_HIGHLIGHT = "#F5B82E";
const LEGACY_PRIMARY = ["#b50000"];
const LEGACY_ACCENT = ["#f5b800"];

export function campaignColours(theme?: Campaign["theme"] | null) {
  const p = theme?.primaryColor?.trim();
  const a = theme?.accentColor?.trim();
  return {
    accent: !p || LEGACY_PRIMARY.includes(p.toLowerCase()) ? CAMPAIGN_ACCENT : p,
    highlight: !a || LEGACY_ACCENT.includes(a.toLowerCase()) ? CAMPAIGN_HIGHLIGHT : a,
  };
}

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
    <div className="rc-video" data-testid="block-campaign-video">
      {!active ? (
        <button type="button" onClick={() => setActive(true)} className="rc-play" aria-label={`Play video: ${title}`} data-testid="button-play-video">
          {video.posterUrl && <img src={video.posterUrl} alt="" loading="lazy" />}
          <span className="rc-play-mark"><Play className="w-7 h-7 ml-1" aria-hidden="true" /></span>
        </button>
      ) : embed ? (
        <iframe src={embed} title={title} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" />
      ) : (
        <video controls preload="none" playsInline poster={video.posterUrl ?? undefined} data-testid="video-campaign">
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
  /** Verified, recorded receipt for this campaign (never inferred from the chosen amount). */
  confirmedReceipt?: ConfirmedReceiptView | null;
  /** Called from the hero donate box with the chosen amount and fee-cover choice. */
  onDonate?: (choice?: DonateChoice) => void;
  initialDonateAmount?: number | null;
  initialFeeCovered?: boolean;
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

function Strip({ n, label, right }: { n: number; label: string; right?: ReactNode }) {
  return (
    <div className="rc-strip rc-mono">
      <span className="rc-num">{String(n).padStart(2, "0")}</span>
      <span>{label}</span>
      {right && <span className="rc-strip-right">{right}</span>}
    </div>
  );
}

/** The single render component for public campaign pages and editor previews. */
export function CampaignPageView({
  campaign, organisation: org, preview = false, layout = "responsive", scrolled = false,
  highlightNewest = false, confirmedReceipt = null, onDonate, onVolunteer, initialDonateAmount, initialFeeCovered,
}: CampaignPageViewProps) {
  const currency = currencyOf(campaign.currency);
  const gbp = (n: number) => formatWhole(n, currency);
  const videos = campaignVideos(campaign).filter((v) => v?.url?.trim());
  const [share, setShare] = useState<ShareState>({ k: "idle" });
  const [smallViewport, setSmallViewport] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    if (layout !== "responsive") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setSmallViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [layout]);
  const { accent: red, highlight: gold } = campaignColours(campaign.theme);
  const isFundraising = campaign.type === "fundraising";
  const drumMode = isDrumCampaign(campaign, org._id);
  const lifeyard = canUseDrumExperience(org._id, campaign._id);
  const pf = campaign.partnerFunding && campaign.partnerFunding.amount > 0 ? campaign.partnerFunding : null;
  const isMatching = pf?.type === "matching";
  const funder = pf?.funderName?.trim() || "a funding partner";
  // Committed: the pledge counts now. Matching: only what has actually been allocated.
  const matchedSoFar = isMatching ? Math.max(0, campaign.partnerFundingMatchedGbp ?? 0) : 0;
  const committed = pf ? (isMatching ? matchedSoFar : pf.amount) : 0;
  const raised = campaign.amountRaised ?? 0;
  const completedDrums = drumMode ? fundedDrums(raised) : 0;
  const drumDonateLabel = completedDrums < 50 ? "Help fund a drum" : "Support this campaign";
  const goal = campaign.goal ?? 0;
  const stillNeeded = Math.max(0, goal - committed - raised);
  const denom = Math.max(goal, committed + raised, 1);
  const committedPct = (committed / denom) * 100;
  const raisedPct = (raised / denom) * 100;
  const matchLeft = isMatching ? partnerMatch(0, pf, matchedSoFar).availableGbp : 0;
  const partnerLabel = isMatching ? "Matched so far" : `Committed by ${funder}`;
  // Editorial overrides: a saved section wins (blank values included); otherwise legacy content shows.
  const pd = campaign.pageDesign ?? {};
  const sectionOrder = resolveSectionOrder(pd.order);
  const schemeClass = (k: CampaignEditableSection, fallback: string) => schemeSectionClass(pd.schemes?.[k] ?? DEFAULT_SCHEMES[k], fallback);
  const breakdown = pd.programme
    ? (pd.programme.boxes ?? []).map((b) => ({ label: b.title, detail: b.text }))
    : (campaign.breakdown ?? []).filter((b) => b.label || b.detail);
  const locations = (campaign.locations ?? []).filter((l) => l.name || l.description);
  // Campaign-specific people replace the organisation team for display only.
  const team = pd.team ? pd.team.people.map((p) => ({ name: p.name, role: p.role, photoUrl: p.photoUrl ?? null })) : (org.team ?? []).filter((m) => m.name);
  const presentation = campaignPresentation(campaign);
  const unitSingular = presentation.hasWall ? "hand" : "supporter";
  const unitPlural = presentation.hasWall ? "hands" : "supporters";
  // Hand walls: header count uses the same finite clamp as the canvas, so both always match.
  const supporters = presentation.hasWall ? safeHandCount(campaign.supporterCount ?? 0) : campaign.supporterCount ?? 0;
  const recent = campaign.recentSupporters ?? [];
  const anon = campaign.unidentifiedGifts ?? 0;
  // Outcome boxes replace the displayed phases only; saved phases and their money targets are untouched.
  const phases = pd.outcomes
    ? (pd.outcomes.boxes ?? []).map((b) => ({ id: b.id, title: b.title, description: b.text, targetAmount: null, completed: false }))
    : campaign.phases ?? [];
  const money = whereYourMoneyGoes(org.name, 300, currency);
  const description = campaign.description?.trim() ?? "";
  const paras = description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const lead = pd.need ? pd.need.intro.trim() : paras[0] ?? "";
  const rest = paras.slice(1);
  const orgBlurb = org.shortDescription || org.description;
  const pc = campaign.pageContent ?? {};
  const t = (k: string) => (typeof pc[k] === "string" ? (pc[k] as string).trim() : "");
  const splitParas = (v: string) => v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const storyHeading = pd.need ? pd.need.headline : t("storyHeading");
  const programmeIntroText = pd.programme ? pd.programme.intro : t("programmeIntro");
  const outcomesIntroText = pd.outcomes ? pd.outcomes.intro : t("outcomesIntro");
  const moneyHeading = pd.money?.headline ?? "Where your money goes";
  const wallHeading = presentation.hasWall ? (pd.wall?.headline ?? (t("supportersHeading") || "Latest hands")) : "Recent supporters";
  const donateLabel = t("donateLabel");
  const hasCustomSupport = !!(t("supportHeading") || t("supportBody") || t("cohortHeading") || t("cohortBody") || t("cohortNote"));
  const fundingNote = t("fundingNote");
  const programmeHeading = pd.programme ? pd.programme.headline : (t("programmeHeading") || "What your money buys");
  const outcomesHeading = pd.outcomes?.headline ?? "What your support makes possible";
  const programmeFitRef = useFitSplit<HTMLDivElement>([programmeHeading, t("programmeSummary"), programmeIntroText, layout].join("\u0000"));
  const outcomesFitRef = useFitSplit<HTMLDivElement>([outcomesHeading, outcomesIntroText, layout].join("\u0000"));
  const storyFitRef = useFitSplit<HTMLDivElement>([storyHeading, lead, ...rest, layout].join("\u0000"));
  const teamFitRef = useFitSplit<HTMLDivElement>([pd.team?.headline, pd.team?.intro, layout].join("\u0000"));
  const moneyFitRef = useFitSplit<HTMLDivElement>([moneyHeading, pd.money?.intro, money.sentence, layout].join("\u0000"));
  const wallFitRef = useFitSplit<HTMLDivElement>([wallHeading, pd.wall?.intro, layout].join("\u0000"));
  const heroFitRef = useFitTitle<HTMLDivElement>([campaign.name, campaign.tagline ?? "", campaign.imageUrl ?? "", org.verified && !drumMode ? "v" : "", drumMode ? "d" : "", layout].join("\u0000"));
  const pctOf = (n: number) => (goal > 0 ? ` · ${Math.round((n / goal) * 100)}%` : "");

  // Later "give" buttons jump back to the hero box; only the box itself starts checkout.
  const donate = () => { if (!preview) focusDonateBox(); };
  const donateWith = (c: DonateChoice) => { if (!preview) onDonate?.(c); };
  const volunteer = () => { if (!preview) onVolunteer?.(); };
  const pageUrl = () => window.location.href.split("#")[0];
  const doShare = async () => {
    if (preview) return;
    setShare(await shareOrCopy(campaign.name, campaign.tagline || description.slice(0, 140), pageUrl()));
  };
  const doCopy = async () => { if (!preview) setShare(await copyOnly(pageUrl())); };
  const previewTitle = preview ? "Disabled in preview" : undefined;

  const initials = org.name.split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "O";
  const logo = <span className="rc-logo">{org.logo ? <img src={org.logo} alt="" /> : initials}</span>;
  const cohortName = t("cohortName") || (t("cohortHeading") ? campaign.name : "");
  const place = [org.city, org.country].filter(Boolean).join(", ");
  const deadline = campaign.deadline ? new Date(campaign.deadline) : null;
  const deadlineLabel = deadline && Number.isFinite(deadline.getTime())
    ? deadline.toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "";
  const stripAction = donateLabel || (drumMode ? drumDonateLabel : `Add your ${unitSingular}`);

  // Title: last word takes the highlight, like the supplied models. Full name stays as one text node for readers.
  const nameWords = campaign.name.trim().split(/\s+/);
  const lastWord = nameWords.length > 1 ? nameWords[nameWords.length - 1] : "";
  const headWords = lastWord ? nameWords.slice(0, -1).join(" ") : campaign.name;

  // Sections are numbered in the order they actually render; sparse campaigns never skip a number.
  let sectionNo = 1;
  const next = () => ++sectionNo;

  const rootStyle = { "--rc-accent": red, "--rc-hi": gold } as CSSProperties;
  const showStory = !!description || !!lead || videos.length > 0;
  const showFunding = isFundraising && (goal > 0 || !!pf || !!fundingNote);

  const fundingBar = goal > 0 && (
    <div data-testid="text-campaign-progress">
      <div className="rc-bar" role="img"
        aria-label={pf
          ? `${gbp(committed)} ${isMatching ? "matched so far by" : "already committed by"} ${funder}, ${gbp(raised)} raised here, ${gbp(stillNeeded)} still needed of ${gbp(goal)}`
          : `${gbp(raised)} raised of ${gbp(goal)}, ${gbp(stillNeeded)} still needed`}>
        {committed > 0 && <span style={{ width: `${committedPct}%`, backgroundColor: gold }} />}
        {raised > 0 && <span style={{ width: `${raisedPct}%`, backgroundColor: red }} />}
      </div>
      <dl className="rc-legend" data-testid="block-funding-split">
        {pf && (
          <div><span className="rc-sw" style={{ backgroundColor: gold }} /><div><dd>{gbp(committed)}{pctOf(committed)}</dd><dt>{partnerLabel}</dt></div></div>
        )}
        <div><span className="rc-sw" style={{ backgroundColor: red }} /><div><dd>{gbp(raised)}{pctOf(raised)}</dd><dt>Raised here</dt></div></div>
        <div><span className="rc-sw" style={{ backgroundColor: "transparent" }} /><div><dd>{gbp(stillNeeded)}{pctOf(stillNeeded)}</dd><dt>Still needed</dt></div></div>
      </dl>
    </div>
  );

  // Editable sections render in the saved order, so DOM, reading order and
  // strip numbers all follow it. Hero/give stays first, share stays last.
  const renderSection: Record<CampaignEditableSection, () => ReactNode> = {
    need: () => (
      <>
        {/* Story */}
        {showStory && (
          <section className={schemeClass("need", "rc-t-cream")} data-section="need">
            <div className="rc-wrap rc-section">
              <Strip n={next()} label="The story" />
              {lead && lifeyard && (
                <LifeyardStory heading={pd.need ? storyHeading : (storyHeading || DRUM_LIFE_COPY.storyHeading)} lead={lead} rest={rest} red={red} layout={layout} />
              )}
              {lead && !lifeyard && (
                <>
                  <div ref={storyFitRef} className="rc-fit-split has-intro">
                    {(pd.need ? storyHeading : true) && <h2 className="rc-display rc-h2">{pd.need ? storyHeading : (storyHeading || "The story")}</h2>}
                    <div className="rc-fit-intro">
                      <div data-testid="text-campaign-description" className="rc-story-body rc-story-readable">
                        <p className="rc-lead">{lead}</p>
                        {rest.map((p, i) => <p key={i}>{p}</p>)}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {videos.length > 0 && (
                <div className={`rc-videos ${videos.length > 1 ? "is-multi" : ""}`} data-testid="list-campaign-videos">
                  {videos.map((v, i) => (
                    <figure key={`${v.url}-${i}`} data-testid={`figure-campaign-video-${i}`}>
                      <CampaignVideoBlock video={v} title={v.caption?.trim() || `${campaign.name} video${videos.length > 1 ? ` ${i + 1}` : ""}`} />
                      {v.caption?.trim() && (
                        <figcaption data-testid={`text-video-caption-${i}`}>{v.caption.trim()}</figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

      </>
    ),
    programme: () => (
      <>
        {/* What your money buys + where it happens */}
        {(breakdown.length > 0 || locations.length > 0) && (
          <section className={schemeClass("programme", "rc-on-dark")} data-section="programme">
            <div className="rc-wrap rc-section">
              <Strip n={next()} label={breakdown.length > 0 ? (programmeHeading || "What your money buys") : "Where it happens"} />
              {breakdown.length > 0 && lifeyard && !pd.programme && (
                <div className="mt-10">
                  <LifeyardBreakdown heading={pd.programme ? programmeHeading : (t("programmeHeading") || DRUM_LIFE_COPY.budgetHeading)} summary={t("programmeSummary")}
                    intro={splitParas(programmeIntroText)} afterword={splitParas(t("programmeAfterword"))} rows={breakdown} red={red} gold={gold} currency={campaign.currency} layout={layout} />
                </div>
              )}
              {breakdown.length > 0 && (!lifeyard || pd.programme) && (
                <div data-testid="list-campaign-breakdown">
                  <div ref={programmeFitRef} className={`rc-fit-split ${t("programmeSummary") || programmeIntroText ? "has-intro" : ""}`}>
                    <h2 className="rc-display rc-h2">{programmeHeading}</h2>
                    {(t("programmeSummary") || programmeIntroText) && (
                      <div className="rc-fit-intro">
                        {t("programmeSummary") && <p className="rc-pill rc-mono" data-testid="text-programme-summary">{t("programmeSummary")}</p>}
                        {programmeIntroText && (
                          <div className="rc-prose" data-testid="text-programme-intro">
                            {splitParas(programmeIntroText).map((p, i) => <p key={i}>{p}</p>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <ul className="rc-bento-grid rc-boxes list-none p-0 mt-12 mb-0" data-n={breakdown.length} aria-label={programmeHeading || "What your money buys"}>
                    {breakdown.map((b, i) => (
                      <li key={i} className="rc-trade" data-testid={`row-breakdown-${i}`}>
                        <span className="rc-mono rc-trade-code">B—{String(i + 1).padStart(2, "0")}</span>
                        {b.label && <h3 className="rc-display">{b.label}</h3>}
                        {b.detail && <p>{b.detail}</p>}
                      </li>
                    ))}
                  </ul>
                  {t("programmeAfterword") && (
                    <div className="rc-bento" style={{ borderTop: 0 }}>
                      <div className="rc-loc-close">
                        <div className="rc-prose" data-testid="text-programme-afterword">
                          {splitParas(t("programmeAfterword")).map((p, i) => <p key={i}>{p}</p>)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {locations.length > 0 && (
                <div className={breakdown.length > 0 ? "mt-0" : "mt-10"} data-testid="list-campaign-locations">
                  {breakdown.length === 0 && <h2 className="rc-display rc-h2 mb-10">Where it happens</h2>}
                  <div className="rc-bento" style={breakdown.length > 0 ? { borderTop: 0 } : undefined}>
                    {locations.map((l, i) => (
                      <div key={i} className="rc-loc" data-testid={`card-location-${i}`}>
                        {l.photoUrl && <img src={l.photoUrl} alt={l.name} loading="lazy" />}
                        <div className="rc-loc-body">
                          <p className="rc-mono m-0 mb-3" style={{ color: "var(--on-ink)" }}>Where it happens</p>
                          <p className="m-0 font-bold flex items-center gap-1.5"><MapPin className="w-4 h-4 shrink-0" style={{ color: gold }} aria-hidden="true" />{l.name}</p>
                          {l.description && <p className="m-0 mt-1 text-sm" style={{ color: "var(--on-ink)" }}>{l.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      </>
    ),
    outcomes: () => (
      <>
        {/* Outcomes */}
        {phases.length > 0 && (
          <section className={schemeClass("outcomes", "rc-t-cream")} data-section="outcomes">
            <div className="rc-wrap rc-section">
              <Strip n={next()} label="Outcomes" />
              {t("outcomesStatus") && (
                <p className="rc-status rc-mono" data-testid="status-outcomes"><span className="rc-strip-dot" style={{ background: red }} aria-hidden="true" />{t("outcomesStatus")}</p>
              )}
              <div ref={outcomesFitRef} className={`rc-fit-split ${outcomesIntroText ? "has-intro" : ""}`}>
                <h2 className="rc-display rc-h2">{outcomesHeading}</h2>
                {outcomesIntroText && (
                  <div className="rc-fit-intro">
                    <div className="rc-prose" data-testid="text-outcomes-intro">
                      {splitParas(outcomesIntroText).map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                  </div>
                )}
              </div>
              <ol className="rc-bento-grid rc-boxes list-none p-0 mt-12 mb-0" data-n={phases.length} data-testid="list-campaign-milestones">
                {phases.map((phase) => (
                  <li key={phase.id} className={`rc-outcome ${phase.completed ? "is-done" : ""}`} data-testid={`card-campaign-milestone-${phase.id}`}>
                    <b>{phase.title}</b>
                    {phase.description && <span className="d">{phase.description}</span>}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* Custom support appeal + cohort card */}
        {isFundraising && hasCustomSupport && (
          <section className="rc-on-hi" data-testid="block-support-appeal">
            <div className="rc-wrap rc-section">
              <Strip n={next()} label={donateLabel || "Support"} />
              <div className="rc-split">
                <div className="min-w-0">
                  {t("supportHeading") && <h2 className="rc-display rc-appeal-h">{t("supportHeading")}</h2>}
                  {t("supportBody") && (
                    <div className="rc-prose mt-5">
                      {splitParas(t("supportBody")).map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                  )}
                  <button type="button" className="rc-btn rc-btn-ink mt-7" style={{ minHeight: 52, padding: "0 24px" }}
                    onClick={donate} disabled={preview} title={previewTitle} data-testid="button-donate-campaign-strip">
                    {stripAction} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                {(t("cohortHeading") || t("cohortBody") || t("cohortNote")) && (
                  <div className="rc-bento self-start">
                    <div className="rc-tile rc-t-paper" style={{ flex: "1 1 100%" }} data-testid="card-cohort">
                      {t("cohortHeading") && <h3 className="rc-display m-0 text-[2rem] leading-[.95]">{t("cohortHeading")}</h3>}
                      {t("cohortBody") && <p className="mt-3 mb-0 leading-relaxed" style={{ color: "var(--muted-dark)" }}>{t("cohortBody")}</p>}
                      {t("cohortNote") && <p className="mt-4 mb-0 pt-4 text-[13px] leading-relaxed rc-muted" style={{ borderTop: "2px solid var(--ink)" }}>{t("cohortNote")}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Default support strip */}
        {isFundraising && !hasCustomSupport && (
          <section className="rc-on-hi">
            <div className="rc-wrap rc-strip-cta">
              <p className="rc-display m-0">
                {drumMode
                  ? `${completedDrums} of 50 drums funded.${completedDrums < 50 ? " Help fund the next." : ""}`
                  : supporters === 0 ? `The first ${unitSingular} could be yours.` : `${supporters.toLocaleString("en-GB")} ${supporters === 1 ? unitSingular : unitPlural} and counting.`}
              </p>
              <button type="button" className="rc-btn rc-btn-ink shrink-0" style={{ minHeight: 56, padding: "0 28px" }}
                onClick={donate} disabled={preview} title={previewTitle} data-testid="button-donate-campaign-strip">
                {stripAction} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

      </>
    ),
    team: () => (
      <>
        {/* Who's running it */}
        <section className={schemeClass("team", "rc-t-cream")} data-section="team">
          <div className={`rc-wrap rc-section${lifeyard ? " rc-organiser-centered" : ""}`} data-testid="block-organisation">
            <Strip n={next()} label="Who's running it" />
            <div ref={teamFitRef} className={`rc-fit-split ${pd.team?.intro ? "has-intro" : ""}`}>
              {(pd.team ? pd.team.headline : "Who's running it") && <h2 className="rc-display rc-h2">{pd.team ? pd.team.headline : "Who's running it"}</h2>}
              {pd.team?.intro && <div className="rc-fit-intro"><p className="rc-lede" data-testid="text-team-intro">{pd.team.intro}</p></div>}
            </div>
            <div className="rc-bento mt-12">
              <div className="rc-tile rc-t-paper flex flex-col gap-4" style={{ flex: "1 1 340px" }}>
                <div className="rc-person">
                  {org.logo ? <img src={org.logo} alt="" className="rc-avatar rc-avatar-lg" /> : <span className="rc-avatar rc-avatar-lg">{initials}</span>}
                  <div className="min-w-0">
                    <p data-testid="text-organisation-name" className="m-0 text-[19px] font-bold break-words leading-tight">{org.name}</p>
                    {place && <p className="m-0 text-[13px] rc-muted">{place}</p>}
                    {org.verified && <p className="m-0 mt-1 rc-mono text-[11px] inline-flex items-center gap-1" style={{ color: red }}><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Verified organisation</p>}
                  </div>
                </div>
                {orgBlurb && <p className="m-0 leading-relaxed" style={{ color: "var(--muted-dark)" }}>{orgBlurb}</p>}
                {!preview && (
                  <Link href={`/organisations/${org._id}`} className="rc-link mt-auto" data-testid="link-organisation-profile-footer">
                    See their profile <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>
              {team.length > 0 && (
                <div className="rc-tile rc-t-paper" style={{ flex: "999 1 520px" }}>
                  <p className="rc-mono rc-muted m-0 mb-4">The team</p>
                  <ul className="rc-team" data-testid="list-campaign-team">
                    {team.map((m, i) => (
                      <li key={i} className="rc-person" data-testid={`card-team-${i}`}>
                        {m.photoUrl ? <img src={m.photoUrl} alt="" loading="lazy" className="rc-avatar" /> : (
                          <span className="rc-avatar">{m.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
                        )}
                        <span className="min-w-0">
                          <span className="rc-truncate font-bold text-[15px]">{m.name}</span>
                          {m.role && <span className="rc-truncate text-[13px] rc-muted">{m.role}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {t("organisationNote") && (
                <div className="rc-tile rc-t-ink" style={{ flex: "1 1 100%" }}>
                  <p className="m-0 text-[15px] leading-relaxed" data-testid="text-organisation-note">{t("organisationNote")}</p>
                </div>
              )}
            </div>
          </div>
        </section>

      </>
    ),
    money: () => (
      <>
        {/* Where your money goes */}
        {isFundraising && (
          <section className={schemeClass("money", "rc-t-paper")} data-section="money">
            <div className="rc-wrap rc-section" data-testid="block-money-disclosure">
              <Strip n={next()} label="Where your money goes" />
              <div ref={moneyFitRef} className="rc-fit-split has-intro">
                {moneyHeading && <h2 className="rc-display rc-h2">{moneyHeading}</h2>}
                <div className="rc-fit-intro">
                  {pd.money?.intro && <p className="rc-lede" data-testid="text-money-intro">{pd.money.intro}</p>}
                  <p className={`rc-lede ${pd.money?.intro ? "rc-following" : ""}`} data-testid="text-money-disclosure">{money.sentence}</p>
                </div>
              </div>
              {(campaign.pageContent || (isMatching && matchLeft > 0)) && (
                <div className="rc-money-box">
                  {campaign.pageContent && <CampaignFeeBreakdown orgName={org.name} colour={red} highlight={gold} currency={currency} />}
                  {isMatching && matchLeft > 0 && (
                    <p className="m-0 text-sm leading-relaxed" style={{ color: "var(--muted-dark)" }}>
                      Matched funds come from {funder}'s pledge, not from your card. You are only ever charged what you choose to give.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

      </>
    ),
    wall: () => (
      <>
        {/* Recent supporters */}
        {isFundraising && presentation.hasWall && (
          <section className={schemeClass("wall", "rc-t-cream")} data-section="wall">
            <div className="rc-wrap rc-section" data-testid="block-recent-supporters">
              <Strip n={next()} label={wallHeading || "Recent supporters"} />
              <div ref={wallFitRef} className={`rc-fit-split ${pd.wall?.intro ? "has-intro" : ""}`}>
                {wallHeading && <h2 className="rc-display rc-h2">{wallHeading}</h2>}
                {pd.wall?.intro && <div className="rc-fit-intro"><p className="rc-lede" data-testid="text-wall-intro">{pd.wall.intro}</p></div>}
              </div>
              {recent.length === 0 && anon === 0 ? (
                <p className="rc-display rc-first" data-testid="text-be-first">Be the first.</p>
              ) : (
                <ul className="rc-givers rc-bento-grid">
                  {recent.map((s, i) => (
                    <li key={`${s.createdAt}-${i}`} className="rc-giver" data-testid={`row-supporter-${i}`}>
                      <CampaignSymbol campaign={campaign} className="w-7 h-7 shrink-0" />
                      <span className="font-bold truncate flex-1 min-w-0">{s.displayName || "Anonymous"}</span>
                      <span className="rc-mono text-[11px] shrink-0 rc-muted">{timeAgo(s.createdAt)}</span>
                    </li>
                  ))}
                  {anon > 0 && (
                    <li className="rc-giver text-sm rc-muted" data-testid="text-unidentified-gifts">
                      plus {anon.toLocaleString("en-GB")} earlier {anon === 1 ? "gift" : "gifts"} from before supporters were counted
                    </li>
                  )}
                </ul>
              )}
            </div>
          </section>
        )}

      </>
    ),
  };

  return (
    <div
      className={`rc ${preview ? "min-h-full relative" : "min-h-[100dvh]"}`}
      style={rootStyle}
      data-layout={layout}
      data-testid={preview ? "view-campaign-preview" : "view-campaign-page"}
    >
      {/* Top bar */}
      <header className={`rc-top ${preview ? "" : "is-fixed"} ${scrolled ? "is-scrolled" : ""}`}>
        <div className="rc-wrap rc-top-in">
          {preview ? (
            <div className="rc-org-link">{logo}<span className="min-w-0"><span className="rc-org-name">{org.name}</span><span className="rc-org-sub rc-mono">on Root ProjX</span></span></div>
          ) : (
            <Link href={`/organisations/${org._id}`} data-testid="link-organisation-profile" className="rc-org-link">
              {logo}
              <span className="min-w-0"><span className="rc-org-name">{org.name}</span><span className="rc-org-sub rc-mono">on Root ProjX</span></span>
            </Link>
          )}
          <div className="rc-top-actions">
            <button type="button" onClick={doShare} disabled={preview} title={previewTitle} aria-label="Share this campaign"
              className="rc-btn rc-btn-ghost-cream" data-testid="button-header-share">
              <Share2 className="w-4 h-4" aria-hidden="true" /><span className="rc-top-share-label">Share</span>
            </button>
            {!preview && <BookmarkButton kind="campaign" targetId={campaign._id} orgId={org._id} unstyled className="rc-btn rc-btn-ghost-cream" />}
            <button type="button" className="rc-btn rc-btn-hi" onClick={() => (isFundraising ? donate() : volunteer())}
              disabled={preview} title={previewTitle} data-testid="button-header-campaign-action">
              {isFundraising ? "Donate" : "Get involved"}
            </button>
          </div>
        </div>
      </header>

      <div className="rc-body">
      <main>
        {/* 01 Hero + give */}
        <section className="rc-hero rc-on-accent" style={preview ? undefined : { paddingTop: 68 }}>
          <div className="rc-wrap rc-hero-in">
            <Strip n={1} label={[campaign.status === "completed" ? "Completed" : "", place].filter(Boolean).join(" · ") || org.name}
              right={deadlineLabel ? <span data-testid="text-campaign-deadline" className="inline-flex items-center gap-2"><span className="rc-strip-dot" aria-hidden="true" />Ends {deadlineLabel}</span> : undefined} />

            <div ref={heroFitRef} className={`rc-hero-top ${campaign.imageUrl ? "has-img" : ""} ${drumMode ? "is-drum" : ""}`}>
              <div className="rc-hero-copy">
                <h1 data-testid="text-campaign-name" className="rc-display rc-h1">
                  <span className="rc-sr">{campaign.name}</span>
                  <span aria-hidden="true">{headWords}{lastWord ? " " : ""}{lastWord && <span className="rc-hi">{lastWord}</span>}</span>
                </h1>
                {(campaign.tagline || org.verified) && (
                  <div className="flex flex-col gap-4 items-start">
                    {campaign.tagline && <p data-testid="text-campaign-tagline" className="rc-tagline">{campaign.tagline}</p>}
                    {org.verified && !drumMode && <span className="rc-badge rc-mono"><ShieldCheck className="w-4 h-4" aria-hidden="true" />Verified organisation</span>}
                  </div>
                )}
              </div>
              {campaign.imageUrl && (
                <div className={`rc-hero-img ${drumMode ? "is-crop" : ""}`}>
                  <img src={campaign.imageUrl} alt="" data-testid="img-campaign-cover" />
                </div>
              )}
            </div>

            {isFundraising ? (
              <>
                <div className="rc-bento rc-give">
                  <div className="rc-tile rc-t-cream rc-wall-tile">
                    {drumMode ? (
                      <>
                        <div data-testid="block-campaign-hero" data-tour-id="campaign-accumulation">
                          <DrumCircle campaign={campaign} orgName={org.name} />
                        </div>
                        {lifeyard && DRUM_LIFE_COPY.drumIntro && (
                          <p className="mt-4 mb-0 text-[14px] leading-relaxed rc-muted" data-testid="text-drum-intro">{DRUM_LIFE_COPY.drumIntro}</p>
                        )}
                      </>
                    ) : !presentation.hasWall ? (
                      <div className="flex flex-col items-center justify-center gap-5 min-h-[260px]" data-testid="block-campaign-hero">
                        <CampaignSymbol campaign={campaign} className="w-24 h-24" />
                        <p className="rc-mono">{supporters.toLocaleString("en-GB")} {supporters === 1 ? "supporter" : "supporters"}</p>
                      </div>
                    ) : (
                      <>
                        <div className="rc-count-row" data-testid="text-supporter-count">
                          <span className="rc-count">{supporters.toLocaleString("en-GB")}</span>
                          <span className="flex-[1_1_220px] min-w-0">
                            <span className="rc-mono block font-bold">{supporters === 1 ? unitSingular : unitPlural} on the wall</span>
                            <span className="block text-sm rc-muted">{supporters === 0 ? `Every supporter adds one ${unitSingular}. Be the first.` : `One for every person who has given, whatever the amount.`}</span>
                          </span>
                        </div>
                        <div className="rc-wall" data-testid="block-campaign-hero" data-tour-id="campaign-accumulation">
                          <AccumulationField
                            count={supporters}
                            supporters={campaign.supporterUnits}
                            unitSingular={unitSingular}
                            unitPlural={unitPlural}
                            imageUrl={HANDPRINT_URL}
                            handprint
                            colour="#17100F"
                            accent="#B3121B"
                            background="#EDE4D6"
                            highlightNewest={highlightNewest || !!confirmedReceipt}
                            still={preview}
                            compact={layout === "phone" || (layout === "responsive" && smallViewport)}
                            ownLabel={!!confirmedReceipt}
                            height={400}
                          />
                        </div>
                        <button type="button" className="rc-wall-cta" onClick={donate} disabled={preview} title={previewTitle} data-testid="button-wall-add">
                          <DonationHand className="w-4 h-4" /> Add your {unitSingular} to the wall <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="rc-tile rc-t-paper rc-donate-tile">
                    <CampaignDonatePanel
                      currency={currency}
                      orgName={org.name}
                      initialAmount={initialDonateAmount}
                      initialFeeCovered={initialFeeCovered}
                      heading={donateLabel || "Support this campaign"}
                      cohortName={cohortName || undefined}
                      preview={preview}
                      receipt={presentation.hasWall ? confirmedReceipt : null}
                      onDonate={donateWith}
                      onShare={doShare}
                    />
                    <div aria-live="polite" className="text-sm">
                      {share.k === "copied" && <span className="inline-flex items-center gap-1.5 font-semibold mt-3"><CheckCircle className="w-4 h-4" aria-hidden="true" /> Link copied</span>}
                    </div>
                  </div>
                </div>
                {showFunding && (
                  <div className="rc-bento">
                    <div className="rc-tile rc-t-ink" style={{ flex: "1 1 100%" }}>
                      <h2 className="rc-mono m-0" style={{ color: "var(--on-ink)" }}>{cohortName ? "This cohort\u2019s funding" : "How this is funded"}</h2>
                      {goal > 0 && (
                        <p className="rc-funding-total"><span className="rc-display">{gbp(raised + committed)}</span><span className="rc-mono" style={{ color: "var(--on-ink)" }}>of {gbp(goal)}</span></p>
                      )}
                      {fundingNote && (
                        <p className="mt-3 mb-0 text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--body-on-ink)" }} data-testid="text-funding-note">{fundingNote}</p>
                      )}
                      {pf && (
                        <p className="rc-note-box" data-testid="text-partner-funding">
                          <Handshake className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                          <span>
                            {!isMatching
                              ? `${gbp(pf.amount)} already committed by ${funder}. Donations help close the remaining gap.`
                              : matchLeft > 0
                                ? `${funder} will match gifts ${ratioLabel(pf, currency)}, up to ${gbp(capOf(pf))}. ${gbp(matchedSoFar)} matched so far; ${gbp(matchLeft)} of matching is still available.`
                                : "Matching has been fully claimed."}
                          </span>
                        </p>
                      )}
                      {fundingBar}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rc-bento rc-give">
                <div className="rc-tile rc-t-paper rc-vol" style={{ flex: "1 1 100%" }} aria-label="Volunteering">
                  <div className="flex items-end gap-4">
                    <span className="rc-count">{campaign.volunteersNeeded}</span>
                    <span className="pb-1"><span className="rc-mono block font-bold">Volunteers needed</span><span className="flex items-center gap-1.5 text-sm rc-muted"><Users className="w-4 h-4" aria-hidden="true" />{org.name}</span></span>
                  </div>
                  <button type="button" className="rc-btn rc-btn-ink" style={{ minHeight: 56, padding: "0 28px" }}
                    onClick={volunteer} disabled={preview} title={previewTitle} data-testid="button-volunteer-campaign">
                    Apply to volunteer <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {sectionOrder.map((k) => <Fragment key={k}>{renderSection[k]()}</Fragment>)}

        {/* Share close */}
        <section className="rc-hero rc-on-dark" data-testid="block-share">
          <div className="rc-wrap rc-share-in">
            <Strip n={next()} label="Pass it on" />
            <div className="rc-share-grid">
              <div className="min-w-0">
                <p className="rc-display rc-share-h m-0">{t("shareHeading") || `Know someone who'd add a ${unitSingular}?`}</p>
                <p className="mt-4 mb-0 text-[17px]" style={{ color: "rgba(255,253,249,.9)" }}>{t("shareBody") || "Share the campaign. A share from you is worth more than any ad."}</p>
              </div>
              <div className="flex flex-col gap-3 min-w-0">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={doShare} disabled={preview} title={previewTitle} className="rc-btn rc-btn-hi" data-testid="button-share-campaign">
                    <Share2 className="w-4 h-4" aria-hidden="true" /> Share the campaign
                  </button>
                  <button type="button" onClick={doCopy} disabled={preview} title={previewTitle} className="rc-btn rc-btn-ghost-white" data-testid="button-copy-link">
                    <Link2 className="w-4 h-4" aria-hidden="true" /> Copy link
                  </button>
                </div>
                <div aria-live="polite" className="text-sm min-h-[1.25rem]">
                  {share.k === "copied" && <span className="inline-flex items-center gap-1.5 font-bold" data-testid="text-share-copied"><CheckCircle className="w-4 h-4" aria-hidden="true" /> Link copied</span>}
                  {share.k === "manual" && (
                    <label className="block">
                      <span className="rc-mono text-[11px]">Copy this link</span>
                      <input readOnly value={share.url} onFocus={(e) => e.currentTarget.select()} className="rc-share-input" data-testid="input-share-url" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="rc-foot">
        <div className="rc-wrap rc-foot-in">
          <p className="m-0 rc-mono">Powered by <span style={{ color: "var(--cream)", fontWeight: 700 }}>Root ProjX</span></p>
          {!preview && (
            <div className="flex items-center gap-5 rc-mono">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
          )}
        </div>
      </footer>
      </div>
    </div>
  );
}
