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

export type CampaignPageLayout = "responsive" | "phone" | "desktop";

/** Applies md: variants only where the layout calls for it, so a phone preview renders at phone layout on any screen. */
function useMd(layout: CampaignPageLayout) {
  return (cls: string) =>
    layout === "phone" ? "" : layout === "desktop" ? cls : cls.split(" ").map((c) => `md:${c}`).join(" ");
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

/** The single render component for public campaign pages and editor previews. */
export function CampaignPageView({
  campaign, organisation: org, preview = false, layout = "responsive", scrolled = false,
  highlightNewest = false, onDonate, onVolunteer,
}: CampaignPageViewProps) {
  const md = useMd(layout);
  const [share, setShare] = useState<ShareState>({ k: "idle" });
  const theme = campaign.theme ?? {
    primaryColor: "#E31C23", accentColor: "#F5C200", backgroundColor: "#ffffff", textColor: "#111111",
  };
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
  const partnerLabel = isMatching ? "Matched so far" : `Committed by ${pf?.funderName?.trim() || "a funding partner"}`;
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

  const donate = () => { if (!preview) onDonate?.(); };
  const volunteer = () => { if (!preview) onVolunteer?.(); };
  const doShare = async () => {
    if (preview) return;
    const url = window.location.href.split("#")[0];
    setShare(await shareOrCopy(campaign.name, campaign.tagline || campaign.description.slice(0, 140), url));
  };
  const previewTitle = preview ? "Disabled in preview" : undefined;

  const orgBadge = org.logo ? (
    <img src={org.logo} alt="" className="w-9 h-9 rounded-full object-cover border border-black/10 shadow-sm" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-sm font-bold border border-black/10" style={{ color: theme.primaryColor }}>
      {org.name.charAt(0) || "O"}
    </div>
  );
  const muted = `${theme.textColor}B3`;
  const hairline = `${theme.textColor}1A`;

  return (
    <div
      className={`${preview ? "min-h-full relative" : "min-h-[100dvh]"} flex flex-col font-sans overflow-x-hidden`}
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
      data-testid={preview ? "view-campaign-preview" : "view-campaign-page"}
    >
      {/* 1. Organisation, linked to its profile */}
      <header
        className={`${preview ? "sticky" : "fixed"} top-0 inset-x-0 z-40 transition-[background-color,box-shadow] duration-300 ${
          scrolled || preview ? "bg-white/92 backdrop-blur-md shadow-sm py-2.5" : "bg-transparent py-4"
        }`}
      >
        <div className={`max-w-5xl mx-auto px-4 ${md("px-8")} flex items-center justify-between gap-3`}>
          {preview ? (
            <div className="flex items-center gap-2.5 min-w-0">{orgBadge}<div className="font-semibold text-sm text-gray-900 truncate">{org.name}</div></div>
          ) : (
            <Link href={`/organisations/${org._id}`} data-testid="link-organisation-profile" className="flex items-center gap-2.5 min-w-0">
              {orgBadge}
              <div className="font-semibold text-sm text-gray-900 truncate underline-offset-2 hover:underline">{org.name}</div>
            </Link>
          )}
          <Button
            className="rounded-full px-5 font-bold shadow-sm shrink-0"
            style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
            onClick={() => (isFundraising ? donate() : volunteer())}
            disabled={preview}
            title={previewTitle}
            data-testid="button-header-campaign-action"
          >
            {isFundraising ? "Donate" : "Get involved"}
          </Button>
        </div>
      </header>

      <main className={`flex-1 ${preview ? "pt-4" : "pt-20"}`}>
        {/* 2. Name, tagline, accumulation hero, donate */}
        <section className={`max-w-5xl mx-auto px-4 ${md("px-8 pt-8")}`}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {campaign.status === "completed" && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-black/5">Completed</span>
            )}
            {campaign.deadline && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: muted }}>
                <Clock className="w-3.5 h-3.5" /> Ends {new Date(campaign.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
              </span>
            )}
            {org.city && org.country && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: muted }}>
                <MapPin className="w-3.5 h-3.5" /> {org.city}, {org.country}
              </span>
            )}
          </div>
          <h1 data-testid="text-campaign-name" className={`text-[2.15rem] leading-[1.05] font-extrabold tracking-tight break-words ${md("text-6xl max-w-3xl")}`}>
            {campaign.name}
          </h1>
          {campaign.tagline && (
            <p data-testid="text-campaign-tagline" className={`mt-3 text-lg font-medium leading-snug max-w-2xl ${md("text-xl")}`} style={{ color: muted }}>
              {campaign.tagline}
            </p>
          )}

          {campaign.imageUrl && (
            <div className="mt-6 rounded-3xl overflow-hidden shadow-lg">
              <img src={campaign.imageUrl} alt="" data-testid="img-campaign-cover" className={`w-full object-cover aspect-[4/3] ${md("aspect-[21/9]")}`} />
            </div>
          )}

          {isFundraising ? (
            <div
              className={`mt-6 rounded-3xl overflow-hidden bg-white shadow-xl border grid ${md("grid-cols-[1.35fr_1fr]")}`}
              style={{ borderColor: hairline }}
              data-testid="block-campaign-hero"
              data-tour-id="campaign-accumulation"
            >
              <AccumulationField
                count={supporters}
                unitSingular={unitSingular}
                unitPlural={unitPlural}
                imageUrl={unit?.imageUrl ?? null}
                colour={theme.primaryColor}
                accent={theme.accentColor}
                background={`${theme.primaryColor}0D`}
                highlightNewest={highlightNewest}
                still={preview}
                height={layout === "phone" ? 220 : 260}
              />
              <div className="p-5 sm:p-6 flex flex-col gap-5 text-gray-900">
                <div>
                  <div className="flex items-baseline gap-2" data-testid="text-supporter-count">
                    <span className="text-5xl font-extrabold tabular-nums tracking-tight" style={{ color: theme.primaryColor }}>
                      {supporters.toLocaleString("en-GB")}
                    </span>
                    <span className="text-lg font-bold">{supporters === 1 ? unitSingular : unitPlural}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {supporters === 0 ? `Every supporter adds one ${unitSingular}. Be the first.` : `One for every person who has given. Every supporter adds one ${unitSingular}.`}
                  </p>
                </div>

                {goal > 0 && (
                  <div className="space-y-2" data-testid="text-campaign-progress">
                    <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-gray-100" role="img"
                      aria-label={pf
                        ? `${gbp(committed)} ${isMatching ? "matched so far by" : "already committed by"} ${funder}, ${gbp(raised)} raised here, ${gbp(stillNeeded)} still needed of ${gbp(goal)}`
                        : `${gbp(raised)} raised of ${gbp(goal)}, ${gbp(stillNeeded)} still needed`}>
                      {committed > 0 && <div className="h-full" style={{ width: `${committedPct}%`, backgroundColor: theme.accentColor }} />}
                      <div className="h-full" style={{ width: `${raisedPct}%`, backgroundColor: theme.primaryColor }} />
                    </div>
                    <dl className={`grid gap-2 text-xs ${pf ? "grid-cols-3" : "grid-cols-2"}`} data-testid="block-funding-split">
                      {pf && (
                        <div><dt className="text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: theme.accentColor }} />{partnerLabel}</dt><dd className="font-extrabold text-sm tabular-nums">{gbp(committed)}</dd></div>
                      )}
                      <div><dt className="text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: theme.primaryColor }} />Raised here</dt><dd className="font-extrabold text-sm tabular-nums">{gbp(raised)}</dd></div>
                      <div><dt className="text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full shrink-0 bg-gray-200" />Still needed</dt><dd className="font-extrabold text-sm tabular-nums">{gbp(stillNeeded)}</dd></div>
                    </dl>
                    {pf && (
                      <p className="text-xs text-gray-700 flex items-start gap-1.5 pt-1" data-testid="text-partner-funding">
                        <Handshake className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {!isMatching
                          ? `${gbp(pf.amount)} already committed by ${funder}.`
                          : matchLeft > 0
                            ? `${funder} will match gifts ${ratioLabel(pf)}, up to ${gbp(capOf(pf))}. ${gbp(matchedSoFar)} matched so far; ${gbp(matchLeft)} of matching is still available.`
                            : "Matching has been fully claimed."}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2 mt-auto">
                  <Button
                    className="w-full h-14 text-lg font-bold rounded-2xl shadow-md"
                    style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
                    onClick={donate}
                    disabled={preview}
                    title={previewTitle}
                    data-testid="button-donate-campaign"
                  >
                    Add your {unitSingular} <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <p className="text-center text-xs font-medium text-gray-500 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-700" />
                    {preview ? "Donations are switched off in preview" : "From £3 · Secure payment by Stripe"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl bg-white shadow-xl border p-6 space-y-5 text-gray-900" style={{ borderColor: hairline }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${theme.primaryColor}14` }}>
                  <Users className="w-6 h-6" style={{ color: theme.primaryColor }} />
                </div>
                <div>
                  <div className="text-2xl font-extrabold tabular-nums">{campaign.volunteersNeeded}</div>
                  <div className="text-sm font-medium text-gray-600">volunteers needed</div>
                </div>
              </div>
              <Button className="w-full h-14 text-lg font-bold rounded-2xl" style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
                onClick={volunteer} disabled={preview} title={previewTitle} data-testid="button-volunteer-campaign">
                Apply to volunteer <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}
        </section>

        <div className={`max-w-2xl mx-auto px-4 ${md("px-0")} py-10 space-y-12`}>
          {/* 3. Video */}
          {campaign.video?.url && <CampaignVideoBlock video={campaign.video} title={`${campaign.name} video`} />}

          {/* 4. Story */}
          {campaign.description?.trim() && (
            <section>
              <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] mb-3" style={{ color: theme.primaryColor }}>The story</h2>
              <p data-testid="text-campaign-description" className="text-[1.05rem] leading-relaxed whitespace-pre-wrap break-words" style={{ color: `${theme.textColor}DD` }}>
                {campaign.description}
              </p>
            </section>
          )}

          {/* 5. Breakdown */}
          {breakdown.length > 0 && (
            <section data-testid="list-campaign-breakdown">
              <h2 className="text-xl font-extrabold mb-4">What your money buys</h2>
              <ul className="divide-y border-y" style={{ borderColor: hairline }}>
                {breakdown.map((b, i) => (
                  <li key={i} className="py-3.5 flex gap-4" style={{ borderColor: hairline }} data-testid={`row-breakdown-${i}`}>
                    <span className="font-extrabold shrink-0 max-w-[40%] break-words tabular-nums" style={{ color: theme.primaryColor }}>{b.label}</span>
                    <span className="text-sm leading-relaxed min-w-0 break-words" style={{ color: muted }}>{b.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 6. Locations */}
          {locations.length > 0 && (
            <section data-testid="list-campaign-locations">
              <h2 className="text-xl font-extrabold mb-4">Where it happens</h2>
              <div className={`grid gap-3 ${md("grid-cols-2")}`}>
                {locations.map((l, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden bg-white border shadow-sm text-gray-900" style={{ borderColor: hairline }} data-testid={`card-location-${i}`}>
                    {l.photoUrl && <img src={l.photoUrl} alt={l.name} loading="lazy" className="w-full aspect-[16/10] object-cover" />}
                    <div className="p-4">
                      <p className="font-bold flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" />{l.name}</p>
                      {l.description && <p className="text-sm text-gray-600 mt-1">{l.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {phases.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold mb-4">Milestones</h2>
              <ol className="space-y-3" data-testid="list-campaign-milestones">
                {phases.map((phase) => (
                  <li key={phase.id} className="flex gap-3" data-testid={`card-campaign-milestone-${phase.id}`}>
                    {phase.completed
                      ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-green-700" />
                      : <span className="w-5 h-5 shrink-0 mt-0.5 rounded-full border-2" style={{ borderColor: hairline }} />}
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{phase.title}</p>
                      {phase.description && <p className="text-sm" style={{ color: muted }}>{phase.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 7. Who's running it */}
          <section className="rounded-2xl bg-white border p-5 text-gray-900" style={{ borderColor: hairline }} data-testid="block-organisation">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-gray-500 mb-3 flex items-center gap-1.5">
              {org.verified && <ShieldCheck className="w-4 h-4 text-green-700" />} Who's running it
            </h2>
            <div className="flex items-center gap-3">
              {org.logo ? <img src={org.logo} alt="" className="w-12 h-12 rounded-full object-cover" /> : (
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold">{org.name.charAt(0) || "O"}</div>
              )}
              <div className="min-w-0">
                <p data-testid="text-organisation-name" className="font-bold">{org.name}{org.verified && <span className="ml-2 text-[11px] font-bold text-green-700">Verified</span>}</p>
                {(org.shortDescription || org.description) && (
                  <p className="text-sm text-gray-600 line-clamp-2">{org.shortDescription || org.description}</p>
                )}
              </div>
            </div>
            {team.length > 0 && (
              <ul className="mt-4 grid grid-cols-2 gap-3" data-testid="list-campaign-team">
                {team.map((t, i) => (
                  <li key={i} className="flex items-center gap-2.5 min-w-0" data-testid={`card-team-${i}`}>
                    {t.photoUrl ? <img src={t.photoUrl} alt="" loading="lazy" className="w-10 h-10 rounded-full object-cover shrink-0" /> : (
                      <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold shrink-0">{t.name.charAt(0)}</span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate">{t.name}</span>
                      {t.role && <span className="block text-xs text-gray-500 truncate">{t.role}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!preview && (
              <Link href={`/organisations/${org._id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-bold underline-offset-2 hover:underline" style={{ color: theme.primaryColor }} data-testid="link-organisation-profile-footer">
                See their profile <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </section>

          {/* 8. Where your money goes */}
          {isFundraising && (
            <section data-testid="block-money-disclosure">
              <h2 className="text-xl font-extrabold mb-2">Where your money goes</h2>
              <p className="text-sm leading-relaxed" style={{ color: muted }} data-testid="text-money-disclosure">{money.sentence}</p>
              {isMatching && matchLeft > 0 && (
                <p className="text-sm leading-relaxed mt-2" style={{ color: muted }}>
                  Matched funds come from {funder}'s pledge, not from your card. You are only ever charged what you choose to give.
                </p>
              )}
            </section>
          )}

          {/* 9. Recent supporters (always rendered: "Be the first." is the empty state) */}
          {isFundraising && (
            <section data-testid="block-recent-supporters">
              <h2 className="text-xl font-extrabold mb-3">Recent supporters</h2>
              {recent.length === 0 && anon === 0 ? (
                <p className="text-base font-semibold" style={{ color: theme.primaryColor }} data-testid="text-be-first">Be the first.</p>
              ) : (
                <ul className="divide-y" style={{ borderColor: hairline }}>
                  {recent.map((s, i) => (
                    <li key={`${s.createdAt}-${i}`} className="py-2.5 flex items-center justify-between gap-3" style={{ borderColor: hairline }} data-testid={`row-supporter-${i}`}>
                      <span className="flex items-center gap-2.5 min-w-0">
                        {unit?.imageUrl ? <img src={unit.imageUrl} alt="" className="w-6 h-6 shrink-0" /> : <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: theme.primaryColor }} />}
                        <span className="font-semibold truncate">{s.displayName || "Anonymous"}</span>
                      </span>
                      <span className="text-xs shrink-0 tabular-nums" style={{ color: muted }}>{timeAgo(s.createdAt)}</span>
                    </li>
                  ))}
                  {anon > 0 && (
                    <li className="py-2.5 text-sm" style={{ color: muted, borderColor: hairline }} data-testid="text-unidentified-gifts">
                      plus {anon.toLocaleString("en-GB")} earlier {anon === 1 ? "gift" : "gifts"} from before supporters were counted
                    </li>
                  )}
                </ul>
              )}
            </section>
          )}

          {/* 10. Share */}
          <section className="rounded-2xl p-5 text-center" style={{ backgroundColor: `${theme.primaryColor}0D` }} data-testid="block-share">
            <p className="font-extrabold text-lg">Know someone who'd add a {unitSingular}?</p>
            <p className="text-sm mt-1" style={{ color: muted }}>A share from you is worth more than any ad.</p>
            <Button
              variant="outline"
              className="mt-4 rounded-full font-bold bg-white"
              onClick={doShare}
              disabled={preview}
              title={previewTitle}
              data-testid="button-share-campaign"
            >
              <Share2 className="w-4 h-4 mr-2" /> Share this campaign
            </Button>
            <div aria-live="polite" className="mt-3 text-sm min-h-[1.25rem]">
              {share.k === "copied" && <span className="inline-flex items-center gap-1.5 font-semibold text-green-800" data-testid="text-share-copied"><Link2 className="w-4 h-4" /> Link copied</span>}
              {share.k === "manual" && (
                <label className="block text-left">
                  <span className="text-xs" style={{ color: muted }}>Copy this link:</span>
                  <input readOnly value={share.url} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900" data-testid="input-share-url" />
                </label>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="py-8 text-center text-sm border-t" style={{ borderColor: hairline, color: muted }}>
        <p>Powered by <span className="font-bold">Root ProjX</span></p>
        {!preview && (
          <div className="flex items-center justify-center gap-4 mt-2">
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </div>
        )}
      </footer>
    </div>
  );
}
