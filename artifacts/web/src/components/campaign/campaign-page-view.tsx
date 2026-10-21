import { useState } from "react";
import { Link } from "wouter";
import {
  Share2, MapPin, CheckCircle, Clock, Users, ArrowRight, ShieldCheck, Play, Handshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Campaign, PublicCampaignLanding, CampaignVideo } from "@/lib/api";

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
          <span className="relative w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Play className="w-7 h-7 text-gray-900 ml-1" />
          </span>
        </button>
      ) : embed ? (
        <iframe
          src={embed}
          title={title}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          className="absolute inset-0 w-full h-full border-0"
        />
      ) : (
        <video
          controls
          preload="none"
          playsInline
          poster={video.posterUrl ?? undefined}
          className="absolute inset-0 w-full h-full"
          data-testid="video-campaign"
        >
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
  onDonate?: () => void;
  onVolunteer?: () => void;
  onShare?: () => void;
}

/** The single render component for public campaign pages and editor previews. */
export function CampaignPageView({
  campaign, organisation: org, preview = false, layout = "responsive", scrolled = false,
  onDonate, onVolunteer, onShare,
}: CampaignPageViewProps) {
  const md = useMd(layout);
  const theme = campaign.theme ?? {
    primaryColor: "#E31C23",
    accentColor: "#F5C200",
    backgroundColor: "#ffffff",
    textColor: "#111111",
  };
  const isFundraising = campaign.type === "fundraising";
  const committed = campaign.matchFunding?.amount ?? 0;
  const raised = campaign.amountRaised ?? 0;
  const goal = campaign.goal ?? 0;
  const pct = isFundraising && goal > 0 ? Math.min(100, Math.round(((raised + committed) / goal) * 100)) : 0;
  const committedPct = goal > 0 ? Math.min(100, (committed / goal) * 100) : 0;
  const raisedPct = goal > 0 ? Math.min(100 - committedPct, (raised / goal) * 100) : 0;
  const stillNeeded = Math.max(0, goal - committed - raised);
  const breakdown = (campaign.breakdown ?? []).filter((b) => b.label || b.detail);
  const locations = (campaign.locations ?? []).filter((l) => l.name || l.description);
  const unit = campaign.theme?.unit;
  const phases = campaign.phases ?? [];

  const donate = () => { if (!preview) onDonate?.(); };
  const volunteer = () => { if (!preview) onVolunteer?.(); };
  const share = () => { if (!preview) onShare?.(); };
  const previewTitle = preview ? "Disabled in preview" : undefined;

  const orgBadge = org.logo ? (
    <img src={org.logo} alt={org.name} className="w-9 h-9 rounded-full object-cover border border-gray-200 shadow-sm" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold border border-gray-200 text-gray-700">
      {org.name.charAt(0) || "O"}
    </div>
  );

  return (
    <div
      className={`${preview ? "min-h-full relative" : "min-h-screen"} flex flex-col font-sans transition-colors duration-500 overflow-x-hidden`}
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
      data-testid={preview ? "view-campaign-preview" : "view-campaign-page"}
    >
      <header
        className={`${preview ? "sticky" : "fixed"} top-0 inset-x-0 z-40 transition-all duration-300 ${
          scrolled || preview ? "bg-white/90 backdrop-blur-md shadow-sm py-3" : "bg-transparent py-5"
        }`}
      >
        <div className={`max-w-5xl mx-auto px-4 ${md("px-8")} flex items-center justify-between gap-3`}>
          {preview ? (
            <div className="flex items-center gap-3 min-w-0">{orgBadge}<div className="font-semibold text-sm text-gray-900 truncate">{org.name}</div></div>
          ) : (
            <Link href={`/organisations/${org._id}`} data-testid="link-organisation-profile" className="flex items-center gap-3 group min-w-0">
              {orgBadge}
              <div className="font-semibold text-sm text-gray-900 transition-colors truncate">{org.name}</div>
            </Link>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={share}
              disabled={preview}
              title={previewTitle}
              data-testid="button-share-campaign"
              className={`p-2.5 rounded-full transition-colors disabled:opacity-60 ${
                scrolled || preview ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-white/60 hover:bg-white/80 text-gray-900 backdrop-blur-sm"
              }`}
              aria-label="Share campaign"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Button
              className="rounded-full px-5 font-bold shadow-md"
              style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
              onClick={() => (isFundraising ? donate() : volunteer())}
              disabled={preview}
              title={previewTitle}
              data-testid="button-header-campaign-action"
            >
              {isFundraising ? "Donate Now" : "Get Involved"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className={`relative ${preview ? "pt-8" : "pt-24"} pb-12 px-4 ${md(`${preview ? "pt-12" : "pt-32"} pb-20 px-8`)} max-w-5xl mx-auto`}>
          <div
            className="absolute top-0 left-0 w-full h-96 -z-10 opacity-20"
            style={{ background: `linear-gradient(180deg, ${theme.primaryColor}33 0%, ${theme.backgroundColor} 100%)` }}
          />

          <div className={`grid gap-10 items-start ${md("grid-cols-[1.2fr_1fr] gap-16")}`}>
            <div className={`space-y-6 min-w-0 ${md("space-y-8")}`}>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                    style={{ backgroundColor: `${theme.accentColor}22`, color: theme.accentColor === "#FFFFFF" ? theme.textColor : theme.accentColor }}
                  >
                    {campaign.type}
                  </span>
                  {campaign.status === "completed" && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600">Completed</span>
                  )}
                </div>
                <h1
                  data-testid="text-campaign-name"
                  className={`text-4xl font-extrabold leading-[1.1] tracking-tight break-words ${md("text-5xl")}`}
                  style={{ color: theme.textColor }}
                >
                  {campaign.name}
                </h1>
                {campaign.tagline && (
                  <p data-testid="text-campaign-tagline" className="text-lg font-medium leading-snug" style={{ color: `${theme.textColor}CC` }}>
                    {campaign.tagline}
                  </p>
                )}
                <div data-testid="text-campaign-meta" className="flex flex-wrap items-center gap-4 text-sm text-gray-600 font-medium pt-2">
                  {org.city && org.country && (
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 opacity-70" />{org.city}, {org.country}</div>
                  )}
                  {campaign.deadline && (
                    <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 opacity-70" />Ends {new Date(campaign.deadline).toLocaleDateString("en-GB")}</div>
                  )}
                </div>
              </div>

              {campaign.imageUrl && (
                <div className={`rounded-3xl overflow-hidden shadow-2xl ${md("hidden")}`}>
                  <img src={campaign.imageUrl} alt="Campaign cover" data-testid="img-campaign-cover-mobile" className="w-full h-auto aspect-[4/3] object-cover" />
                </div>
              )}

              <div className="prose prose-lg max-w-none leading-relaxed" style={{ color: `${theme.textColor}CC` }}>
                <p data-testid="text-campaign-description" className="whitespace-pre-wrap break-words">{campaign.description}</p>
              </div>

              {campaign.video?.url && (
                <section className="space-y-2">
                  <CampaignVideoBlock video={campaign.video} title={`${campaign.name} video`} />
                </section>
              )}

              {breakdown.length > 0 && (
                <section data-testid="list-campaign-breakdown">
                  <h3 className="font-bold text-lg mb-4" style={{ color: theme.textColor }}>What your money buys</h3>
                  <ul className="divide-y divide-gray-200 border-y border-gray-200">
                    {breakdown.map((b, i) => (
                      <li key={i} className="py-3 flex gap-4" data-testid={`row-breakdown-${i}`}>
                        <span className="font-extrabold shrink-0 max-w-[40%] break-words" style={{ color: theme.primaryColor }}>{b.label}</span>
                        <span className="text-sm leading-relaxed min-w-0 break-words" style={{ color: `${theme.textColor}CC` }}>{b.detail}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {locations.length > 0 && (
                <section data-testid="list-campaign-locations">
                  <h3 className="font-bold text-lg mb-4" style={{ color: theme.textColor }}>Where it happens</h3>
                  <div className={`grid gap-3 ${md("grid-cols-2")}`}>
                    {locations.map((l, i) => (
                      <div key={i} className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm" data-testid={`card-location-${i}`}>
                        {l.photoUrl && <img src={l.photoUrl} alt={l.name} loading="lazy" className="w-full aspect-[16/10] object-cover" />}
                        <div className="p-4">
                          <p className="font-bold text-gray-900 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" />{l.name}</p>
                          {l.description && <p className="text-sm text-gray-600 mt-1">{l.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="mt-10 p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ShieldCheck className={`w-5 h-5 ${org.verified ? "text-green-600" : "text-gray-400"}`} />
                  {org.verified ? "Verified Organisation" : "About the organisation"}
                </h3>
                <div className="flex items-center gap-4">
                  {org.logo ? (
                    <img src={org.logo} alt={org.name} className="w-14 h-14 rounded-full object-cover shadow-sm" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-xl font-bold shadow-sm text-gray-700 border border-gray-200">{org.name.charAt(0) || "O"}</div>
                  )}
                  <div className="min-w-0">
                    <h4 data-testid="text-organisation-name" className="font-bold text-gray-900">{org.name}</h4>
                    <p className="text-sm text-gray-500 line-clamp-1">{org.description}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`space-y-6 min-w-0 ${md("sticky top-28")}`}>
              {campaign.imageUrl && (
                <div className={`hidden rounded-3xl overflow-hidden shadow-2xl mb-8 -rotate-1 ${md("block")}`}>
                  <img src={campaign.imageUrl} alt="Campaign cover" data-testid="img-campaign-cover-desktop" className="w-full h-auto aspect-[4/3] object-cover" />
                </div>
              )}

              <div className={`bg-white rounded-3xl p-6 shadow-xl border border-gray-100 ${md("p-8")}`}>
                {isFundraising ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-end justify-between gap-x-3" data-testid="text-campaign-progress">
                        <div className="text-4xl font-extrabold text-gray-900">{gbp(raised)}</div>
                        <div className="text-gray-500 font-medium mb-1">raised of {gbp(goal)}</div>
                      </div>
                      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex" aria-label={`${pct}% funded`}>
                        {committed > 0 && <div className="h-full" style={{ width: `${committedPct}%`, backgroundColor: theme.accentColor }} />}
                        <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${raisedPct}%`, backgroundColor: theme.primaryColor }} />
                      </div>
                      {committed > 0 && (
                        <dl className="grid grid-cols-3 gap-2 pt-2 text-xs" data-testid="block-funding-split">
                          <div><dt className="text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.accentColor }} />Committed</dt><dd className="font-bold text-gray-900">{gbp(committed)}</dd></div>
                          <div><dt className="text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.primaryColor }} />Raised here</dt><dd className="font-bold text-gray-900">{gbp(raised)}</dd></div>
                          <div><dt className="text-gray-500">Still needed</dt><dd className="font-bold text-gray-900">{gbp(stillNeeded)}</dd></div>
                        </dl>
                      )}
                      {committed > 0 && campaign.matchFunding?.funderName && (
                        <p className="text-xs text-gray-600 flex items-start gap-1.5 pt-1" data-testid="text-match-funder">
                          <Handshake className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          {gbp(committed)} already committed by {campaign.matchFunding.funderName}.
                        </p>
                      )}
                    </div>

                    {unit?.singular && (
                      <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3" data-testid="block-campaign-unit">
                        {unit.imageUrl && <img src={unit.imageUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />}
                        <p className="text-sm text-gray-700">Every donor adds one {unit.singular} to this campaign.</p>
                      </div>
                    )}

                    <Button
                      className="w-full py-6 text-lg font-bold rounded-xl shadow-md group"
                      style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
                      onClick={donate}
                      disabled={preview}
                      title={previewTitle}
                      data-testid="button-donate-campaign"
                    >
                      Donate Now
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    <div className="text-center text-sm font-medium text-gray-500 flex items-center justify-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      {preview ? "Donations are switched off in preview" : "Secure payment processed by Stripe"}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 bg-blue-50 text-blue-900 p-4 rounded-2xl">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><Users className="w-6 h-6 text-blue-600" /></div>
                      <div>
                        <div className="text-2xl font-extrabold">{campaign.volunteersNeeded}</div>
                        <div className="text-sm font-medium opacity-80">Volunteers Needed</div>
                      </div>
                    </div>
                    <Button
                      className="w-full py-6 text-lg font-bold rounded-xl shadow-md group"
                      style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
                      onClick={volunteer}
                      disabled={preview}
                      title={previewTitle}
                      data-testid="button-volunteer-campaign"
                    >
                      Apply to Volunteer
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                )}
              </div>

              {phases.length > 0 && (
                <div className={`bg-white rounded-3xl p-6 shadow-md border border-gray-100 ${md("p-8")}`}>
                  <h3 className="font-bold text-gray-900 mb-6 text-lg">Campaign Milestones</h3>
                  <div className="space-y-0" data-testid="list-campaign-milestones">
                    {phases.map((phase, i) => (
                      <div key={phase.id} data-testid={`card-campaign-milestone-${phase.id}`} className="relative flex gap-4 pb-6 last:pb-0">
                        {i !== phases.length - 1 && <div className="absolute top-8 left-3.5 bottom-0 w-[2px] bg-gray-100 -ml-[1px]" />}
                        <div className="relative z-10 shrink-0 mt-1">
                          {phase.completed ? (
                            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center border-4 border-white shadow-sm"><CheckCircle className="w-4 h-4 text-white" /></div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white border-2 border-gray-200 shadow-sm" />
                          )}
                        </div>
                        <div className="flex-1 pt-1 min-w-0">
                          <h4 className={`font-bold text-sm ${phase.completed ? "text-gray-900" : "text-gray-600"}`}>{phase.title}</h4>
                          {phase.description && <p className="text-sm text-gray-500 mt-1">{phase.description}</p>}
                          {phase.targetAmount != null && <p className="text-xs font-semibold text-gray-400 mt-2">Target: {gbp(phase.targetAmount)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-gray-500 text-sm border-t border-gray-100 bg-gray-50 mt-auto">
        <p>Powered by <span className="font-bold text-gray-900">Root ProjX</span></p>
        {!preview && (
          <div className="flex items-center justify-center gap-4 mt-2">
            <Link href="/terms" className="hover:text-gray-900 hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-900 hover:underline">Privacy</Link>
          </div>
        )}
      </footer>
    </div>
  );
}

