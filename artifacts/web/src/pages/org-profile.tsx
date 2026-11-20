import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, ArrowLeft, ChevronRight, Heart, HeartOff,
  MapPin, Tag, Users, TrendingUp, Zap, DollarSign,
  Clock, Mail, Phone, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { Review, Org, VolunteerRole, Campaign } from "@/lib/api";
import { GuestDonateSheet } from "@/components/GuestDonateSheet";
import { formatWhole } from "@/lib/currency";
import { ContentGallery } from "@/components/org-content/content-gallery";
import { CampaignDonateButton } from "@/components/campaign-donate-button";
import { CampaignCardLink } from "@/components/campaign-card-link";
import ReactMarkdown from "react-markdown";
import { PROFILE_ANCHORS, orgSectors } from "@/lib/sectors";
import "@/components/org-content/org-profile.css";

const ABOUT_ANCHORS: string[] = [PROFILE_ANCHORS.story, PROFILE_ANCHORS.funds, PROFILE_ANCHORS.contact, PROFILE_ANCHORS.team];

/** Markdown story rendering. Raw HTML is skipped; links open safely. */
function StoryText({ text }: { text: string }) {
  return (
    <div className="text-sm text-foreground/80 leading-relaxed space-y-3 break-words">
      <ReactMarkdown
        skipHtml
        components={{
          h1: ({ children }) => <h4 className="text-base font-extrabold text-foreground mt-4">{children}</h4>,
          h2: ({ children }) => <h4 className="text-base font-extrabold text-foreground mt-4">{children}</h4>,
          h3: ({ children }) => <h5 className="text-sm font-bold text-foreground mt-3">{children}</h5>,
          h4: ({ children }) => <h5 className="text-sm font-bold text-foreground mt-3">{children}</h5>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
          blockquote: ({ children }) => <blockquote className="border-l-2 pl-3 italic" style={{ borderColor: RED }}>{children}</blockquote>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2" style={{ color: RED }}>{children}</a>
          ),
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

const METRIC_ORDER = ["peopleReached", "groundCovered", "resourcesDelivered"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

/** Human-readable "Last active …" label derived from a post timestamp. */
function lastActiveLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 864e5);
  if (days === 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days}d ago`;
  if (days < 14) return "Active last week";
  if (days < 30) return `Active ${Math.floor(days / 7)}w ago`;
  if (days < 60) return "Active last month";
  return `Active ${Math.floor(days / 30)}mo ago`;
}

/** True when the org has not posted in more than 6 months (~180 days). */
function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 180 * 864e5;
}

const RED = "#CA0813";
const GOLD = "#F3BF2C";
const PRIMARY_ACTION_STYLE = { backgroundColor: GOLD, color: "#17100F", minHeight: 48, border: "1px solid #17100F" };

// ── Campaign card (visitor view) ──────────────────────────────────────────────

function CampaignCard({ campaign, orgId, onDonate }: { campaign: Campaign; orgId: string; onDonate: (campaign: Campaign) => void }) {
  const [showPhases, setShowPhases] = useState(false);
  const pct = campaign.goal > 0
    ? Math.min(100, Math.round((campaign.amountRaised / campaign.goal) * 100))
    : 0;
  const completedPhases = (campaign.phases ?? []).filter((p) => p.completed).length;
  const totalPhases = (campaign.phases ?? []).length;

  return (
    <CampaignCardLink name={campaign.name} href={campaign.sharePath || (campaign.publicId ? `/campaigns/${encodeURIComponent(campaign.publicId)}` : null)}>
      {campaign.imageUrl && (
        <img src={campaign.imageUrl} alt={campaign.name} className="w-full h-36 object-cover" />
      )}
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          {!campaign.imageUrl && (
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${RED} 0%, #7A0000 100%)` }}
            >
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h5 className="font-bold text-sm text-foreground leading-snug">{campaign.name}</h5>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#FFF7E6", color: "#B45309" }}
              >
                {campaign.type}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{campaign.description}</p>
          </div>
        </div>

        {/* Progress bar (fundraising) */}
        {campaign.type === "fundraising" && campaign.goal > 0 && (
          <div className="space-y-1.5">
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: RED }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {formatWhole(campaign.amountRaised ?? 0, campaign.currency)} raised
              </span>
              <span className="font-bold" style={{ color: RED }}>
                {pct}% of {formatWhole(campaign.goal, campaign.currency)}
              </span>
            </div>
          </div>
        )}

        {/* Volunteer count */}
        {campaign.type === "volunteer" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{campaign.volunteersNeeded} volunteers needed</span>
          </div>
        )}

        {/* Deadline */}
        {campaign.deadline && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Deadline: {new Date(campaign.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        )}

        {/* Phases progress */}
        {totalPhases > 0 && (
          <div>
            <button
              onClick={() => setShowPhases((v) => !v)}
              className="relative z-10 flex items-center gap-2 text-xs w-full"
            >
              {/* Phase progress bar */}
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0}%`,
                    backgroundColor: GOLD,
                  }}
                />
              </div>
              <span className="text-muted-foreground whitespace-nowrap">
                {completedPhases}/{totalPhases} phases
              </span>
              <span className="text-muted-foreground">{showPhases ? "▲" : "▼"}</span>
            </button>

            {showPhases && (
              <div className="mt-2 space-y-2">
                {(campaign.phases ?? []).map((phase, i) => (
                  <div
                    key={phase.id ?? i}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                      phase.completed
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${
                        phase.completed ? "bg-green-500 border-green-500" : "border-gray-300"
                      }`}
                    >
                      {phase.completed && <span className="text-white text-[8px]">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${phase.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {phase.title}
                      </p>
                      {phase.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                      )}
                      {phase.targetAmount != null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Target: {formatWhole(phase.targetAmount, campaign.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Donate CTA */}
        {campaign.type === "volunteer" ? <a className="relative z-10 block" href={`/donate/${orgId}`}>
          <button
            className="w-full py-2 text-sm font-bold text-white rounded-lg transition-opacity hover:opacity-90"
            style={PRIMARY_ACTION_STYLE}
          >
            Get Involved
          </button>
        </a> : <CampaignDonateButton campaign={campaign} onDonate={onDonate}
          className="relative z-10 w-full py-2 text-sm font-bold text-white rounded-lg transition-opacity hover:opacity-90"
          style={PRIMARY_ACTION_STYLE}>Donate to this campaign</CampaignDonateButton>}
      </div>
    </CampaignCardLink>
  );
}

// ── Review row ────────────────────────────────────────────────────────────────

function ReviewRow({ item }: { item: Review }) {
  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-sm text-foreground">{item.authorName}</span>
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ color: i < item.rating ? GOLD : "#d1d5db" }}>★</span>
          ))}
        </div>
      </div>
      <p className="text-foreground/70 text-sm leading-relaxed">{item.content}</p>
      <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(item.createdAt)}</p>
    </div>
  );
}



// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrgProfilePage() {
  const [, params] = useRoute("/organisations/:id");
  const id = params?.id ?? "";
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"updates" | "campaigns" | "volunteer" | "about">("updates");
  const [localFollow, setLocalFollow] = useState<boolean | null>(null);
  const [donateModalOpen, setDonateModalOpen] = useState(false);
  const [donationCampaign, setDonationCampaign] = useState<Campaign | null>(null);

  const orgQ = useQuery({
    queryKey: ["org", id],
    queryFn: () => api.getOrganisation(id, token),
    enabled: !!id,
  });

  // Owner opened "Preview as a donor": record the real open after the page rendered.
  const { user: authUser } = useAuth();
  const previewRecorded = useRef(false);
  const [previewRecordFailed, setPreviewRecordFailed] = useState(false);
  const isOwnerPreview = new URLSearchParams(window.location.search).get("preview") === "1" && !!authUser && authUser.id === id;
  const recordProfilePreview = () => {
    if (!token) return;
    previewRecorded.current = true;
    setPreviewRecordFailed(false);
    api.postWalkthroughEvent(id, { event: "profile_preview" }, token)
      .then(() => queryClient.invalidateQueries({ queryKey: ["walkthrough", id] }))
      .catch(() => setPreviewRecordFailed(true));
  };
  const recordRef = useRef(recordProfilePreview);
  recordRef.current = recordProfilePreview;
  useEffect(() => {
    if (!isOwnerPreview || !orgQ.data || !token || previewRecorded.current) return;
    recordRef.current();
  }, [isOwnerPreview, orgQ.data, token]);

  const updatesQ = useQuery({
    queryKey: ["org-feed", id],
    queryFn: () => api.getOrgFeed(id),
    enabled: !!id,
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchInterval: 30_000,
  });

  const reviewsQ = useQuery({
    queryKey: ["org-reviews", id],
    queryFn: () => api.getOrgReviews(id),
    enabled: !!id,
  });

  const rolesQ = useQuery({
    queryKey: ["volunteerRoles", id],
    queryFn: () => api.getOrgVolunteerRoles(id),
  });

  const campaignsQ = useQuery({
    queryKey: ["campaigns", id],
    queryFn: () => api.getCampaigns(id),
    enabled: !!id,
  });

  const supportersQ = useQuery({
    queryKey: ["org-supporters", id],
    queryFn: () => api.getOrgSupporters(id),
    enabled: !!id,
  });

  const followsQ = useQuery({
    queryKey: ["follows", "my"],
    queryFn: () => api.getMyFollows(token!),
    enabled: isAuthenticated,
  });

  const followed =
    localFollow !== null
      ? localFollow
      : (followsQ.data ?? []).some((o) => o._id === id);

  const followMut = useMutation({
    mutationFn: async () => {
      if (followed) {
        await api.unfollowOrg(id, token!);
      } else {
        await api.followOrg(id, token!);
      }
    },
    onSuccess: () => {
      setLocalFollow(!followed);
      queryClient.invalidateQueries({ queryKey: ["follows", "my"] });
      queryClient.invalidateQueries({ queryKey: ["org", id] });
    },
  });

  const org = orgQ.data;

  // Deep links from the profile editor: /organisations/:id#profile-story etc.
  useEffect(() => {
    if (!org) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    if (ABOUT_ANCHORS.includes(hash)) setTab("about");
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [org?._id]);

  if (orgQ.isLoading) {
    return (
      <div className="rp-orgp rp-page-shell space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="rp-orgp rp-page-shell orgp-notfound">
        <p className="rp-label">Error 404</p>
        <h1 className="orgp-name">Organisation not found.</h1>
        <Link href="/discover" className="rp-btn rp-btn-yellow mt-6">Back to Discover</Link>
      </div>
    );
  }

  const initials = org.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const allUpdates = updatesQ.data ?? [];
  const updates = allUpdates;
  const realCampaigns = (campaignsQ.data ?? []).filter((c) => c.status !== "deleted");

  // lastPostAt is written to the org doc on each new post.
  // Fall back to the most recent update in the already-fetched feed for existing orgs
  // that don't have the field yet (client-side backfill — no migration needed).
  const derivedLastPostAt: string | null =
    org.lastPostAt ??
    (allUpdates.length > 0 ? (allUpdates[0]?.createdAt ?? null) : null);

  const sectors = orgSectors(org);
  const metrics = METRIC_ORDER
    .map((k) => ({ key: k, m: org.impactMetrics?.[k] }))
    .filter((x): x is { key: typeof METRIC_ORDER[number]; m: NonNullable<typeof x.m> } =>
      !!x.m && !!x.m.label && Number.isFinite(x.m.value));
  const goalCampaign = realCampaigns.find(
    (c) => c.status === "active" && c.enabled !== false && c.type === "fundraising" && c.goal > 0,
  );
  const goalPct = goalCampaign ? Math.min(100, Math.round((goalCampaign.amountRaised / goalCampaign.goal) * 100)) : 0;
  const team = (org.team ?? []).filter((m) => m.name?.trim());

  function handleDonateClick() {
    setDonationCampaign(null);
    if (isAuthenticated) {
      window.location.href = `/donate/${id}`;
    } else {
      setDonateModalOpen(true);
    }
  }
  function handleCampaignDonate(campaign: Campaign) {
    setDonationCampaign(campaign);
    setDonateModalOpen(true);
  }
  function openOrgDonateSheet() {
    setDonationCampaign(null);
    setDonateModalOpen(true);
  }

  const TABS = [
    { key: "updates",   label: "Posts",   count: updates.length },
    { key: "campaigns", label: "Campaigns", count: realCampaigns.length },
    { key: "volunteer", label: "Volunteer",  count: null },
    { key: "about",     label: "About",      count: null },
  ] as const;

  return (
    <div className="rp-orgp rp-page-shell">
      {isOwnerPreview && previewRecordFailed && (
        <div role="alert" className="mb-4 rounded-xl bg-destructive/10 text-sm px-4 py-2 flex items-center gap-3" data-testid="alert-profile-preview-record-failed">
          <span className="flex-1">We couldn't record this preview, so the walkthrough can't tick it off yet.</span>
          <Button size="sm" variant="outline" onClick={recordProfilePreview} data-testid="button-retry-profile-preview-record">Retry</Button>
        </div>
      )}
      <GuestDonateSheet
        open={donateModalOpen}
        onClose={() => setDonateModalOpen(false)}
        orgId={id}
        orgName={org.name}
        campaignId={donationCampaign?._id}
        campaignName={donationCampaign?.name}
        partnerFunding={donationCampaign?.partnerFunding}
        partnerFundingMatchedGbp={donationCampaign?.partnerFundingMatchedGbp}
        currency={donationCampaign?.currency ?? "gbp"}
      />

      {/* Back nav */}
      <Link href="/discover" className="orgp-back rp-label" data-testid="link-back-discover">
        <ArrowLeft className="w-4 h-4" /> Back to Discover
      </Link>

      {/* Two-column grid */}
      <div className="orgp-grid">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Hero — pack identity block */}
          <header id={PROFILE_ANCHORS.identity} className="scroll-mt-20 orgp-hero rp-rise">
            <div className="orgp-cover">
              {org.coverImage ? (
                <img src={org.coverImage} alt={org.name} data-testid="img-org-cover" />
              ) : (
                <div className="orgp-cover-fallback" aria-hidden><span>{initials}</span></div>
              )}
              <span className="orgp-cover-tag rp-label">{org.category}</span>
            </div>
            <div className="orgp-id">
              <div className="orgp-logo">
                {org.logo ? (
                  <img src={org.logo} alt={org.name} data-testid="img-org-logo" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="orgp-id-main">
                <p className="rp-label orgp-kicker">Grassroots organisation{org.verified ? " · Verified" : ""}</p>
                <h1 className="orgp-name" data-testid="text-org-name">{org.name}</h1>
                {org.verified && (
                  <span className="orgp-verified"><CheckCircle className="w-4 h-4" /> Verified by Root ProjX</span>
                )}
                <div className="orgp-meta">
                  {(org.city || org.country) && (
                    <span><MapPin className="w-4 h-4" />{[org.city, org.country].filter(Boolean).join(", ")}</span>
                  )}
                  <span><Tag className="w-4 h-4" />{org.category}</span>
                  {derivedLastPostAt ? (
                    <span><Clock className="w-4 h-4" />{lastActiveLabel(derivedLastPostAt)}</span>
                  ) : !updatesQ.isLoading && (
                    <span><Clock className="w-4 h-4" />No posts yet</span>
                  )}
                </div>
                <p className="orgp-lede" data-testid="text-org-short-description">
                  {org.shortDescription?.trim() || org.description}
                </p>
                {sectors.length > 0 && (
                  <ul id={PROFILE_ANCHORS.sectors} className="scroll-mt-20 orgp-sectors" aria-label="Sectors">
                    {sectors.map((sec) => <li key={sec}>{sec}</li>)}
                  </ul>
                )}
                {derivedLastPostAt && isStale(derivedLastPostAt) && (
                  <div className="orgp-stale">
                    <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>This org hasn't shared a post in over 6 months</p>
                  </div>
                )}
                <div className="orgp-actions">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      className={`rp-btn ${followed ? "orgp-btn-ink" : "rp-btn-ghost"}`}
                      onClick={() => followMut.mutate()}
                      disabled={followMut.isPending}
                      data-testid="button-follow-org"
                    >
                      {followMut.isPending ? "Saving" : followed ? (<><HeartOff className="w-4 h-4" /> Following</>) : (<><Heart className="w-4 h-4" /> Follow</>)}
                    </button>
                  ) : (
                    <button type="button" className="rp-btn rp-btn-ghost" onClick={openOrgDonateSheet} data-testid="button-follow-org">
                      <Heart className="w-4 h-4" /> Follow
                    </button>
                  )}
                  <button type="button" className="rp-btn rp-btn-yellow orgp-donate" onClick={handleDonateClick} data-testid="button-donate-org">
                    <Heart className="w-4 h-4" /> Donate
                  </button>
                </div>
              </div>
            </div>
            <dl className="orgp-stats">
              {[
                { Icon: Users,      label: "Followers", value: (org.followerCount ?? 0).toLocaleString() },
                { Icon: Zap,        label: "Posts",   value: allUpdates.length.toString() },
                { Icon: TrendingUp, label: "Impact",    value: (org.impactScore ?? 0).toString() },
                { Icon: DollarSign, label: "Raised",    value: `£${(org.totalRaised ?? 0).toLocaleString()}` },
              ].map(({ Icon, label, value }) => (
                <div key={label} data-testid={`stat-${label.toLowerCase()}`}>
                  <dt className="rp-label"><Icon className="w-3.5 h-3.5" />{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </header>

          {(metrics.length > 0 || goalCampaign) && (
            <section id={PROFILE_ANCHORS.impact} aria-labelledby="impact-title" className="scroll-mt-20 orgp-panel orgp-impact">
              <h2 id="impact-title" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Impact</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {metrics.map(({ key, m }) => (
                  <div key={key} data-testid={`metric-${key}`}>
                    <div className="text-2xl font-extrabold text-foreground tabular-nums">{m.value.toLocaleString()}</div>
                    <div className="text-xs text-foreground/70 leading-snug mt-0.5">{m.label}</div>
                    {m.updatedAt && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        as of {new Date(m.updatedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                      </div>
                    )}
                  </div>
                ))}
                {goalCampaign && (
                  <div className="col-span-2 sm:col-span-1" data-testid="metric-progress-to-goal">
                    <div className="text-2xl font-extrabold tabular-nums" style={{ color: RED }}>{goalPct}%</div>
                    <div className="text-xs text-foreground/70 leading-snug mt-0.5">to goal: {goalCampaign.name}</div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                      <div className="h-full rounded-full" style={{ width: `${goalPct}%`, backgroundColor: RED }} />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Tabs */}
          <div className="orgp-panel">
            {/* Tab bar */}
            <div className="orgp-tabs" role="tablist" aria-label="Profile sections">
              {TABS.map(({ key, label, count }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className="orgp-tab"
                  data-testid={`tab-${key}`}
                >
                  {label}
                  {count !== null && count > 0 && <span className="orgp-tab-count">{count}</span>}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="orgp-tabbody">

              {/* ── Updates ── */}
              {tab === "updates" && (
                <ContentGallery items={updates} isLoading={updatesQ.isLoading} isError={updatesQ.isError} onRetry={() => updatesQ.refetch()} />
              )}

              {/* ── Campaigns ── */}
              {tab === "campaigns" && (
                campaignsQ.isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-48" /><Skeleton className="h-48" />
                  </div>
                ) : realCampaigns.length === 0 ? (
                  <div className="text-center py-12">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ backgroundColor: "#FEF2F2" }}
                    >
                      <Heart className="w-6 h-6" style={{ color: RED }} />
                    </div>
                    <p className="font-semibold text-foreground mb-1">No active campaigns</p>
                    <p className="text-sm text-muted-foreground">
                      Check back soon — campaigns will appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Active campaigns */}
                    {realCampaigns.filter((c) => c.status === "active").length > 0 && (
                      <div className="space-y-4 mb-6">
                        <h3 className="font-bold text-foreground text-base">Active Campaigns</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {realCampaigns
                            .filter((c) => c.status === "active")
                            .map((c) => (
                              <CampaignCard key={c._id} campaign={c} orgId={id} onDonate={handleCampaignDonate} />
                            ))}
                        </div>
                      </div>
                    )}
                    {/* Completed campaigns */}
                    {realCampaigns.filter((c) => c.status === "completed").length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-foreground text-base text-muted-foreground">Completed</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-75">
                          {realCampaigns
                            .filter((c) => c.status === "completed")
                            .map((c) => (
                              <CampaignCard key={c._id} campaign={c} orgId={id} onDonate={handleCampaignDonate} />
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              )}

              {/* ── Volunteer ── */}
              {tab === "volunteer" && (
                <div>
                  <h3 className="font-bold text-foreground text-base mb-1">Ways to Volunteer</h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    Help {org.name} make a greater impact.
                  </p>
                  {rolesQ.isLoading ? (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-secondary animate-pulse" />)}
                    </div>
                  ) : (rolesQ.data ?? []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(181,0,0,0.08)" }}>
                        <Users className="w-7 h-7" style={{ color: RED }} />
                      </div>
                      <p className="font-bold text-foreground">No volunteer roles listed</p>
                      <p className="text-sm text-muted-foreground max-w-xs">This organisation hasn't listed any volunteer opportunities yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(rolesQ.data ?? []).map((role: VolunteerRole) => (
                        <div
                          key={role._id}
                          className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer group"
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: GOLD + "33" }}
                          >
                            <Users className="w-5 h-5" style={{ color: "#7A5000" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground">{role.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {role.location} · {role.commitment}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    className="w-full mt-5 py-3 rounded-xl font-bold text-white text-sm transition-opacity hover:opacity-90"
                    style={PRIMARY_ACTION_STYLE}
                    onClick={handleDonateClick}
                  >
                    Apply to Volunteer
                  </button>
                </div>
              )}

              {/* ── About ── */}
              {tab === "about" && (
                <div className="space-y-5">
                  {org.description?.trim() && (
                    <div id={PROFILE_ANCHORS.story} className="scroll-mt-20">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Our story
                      </h3>
                      <StoryText text={org.description} />
                    </div>
                  )}
                  {org.mission && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Mission
                      </h3>
                      <p className="text-sm text-foreground/80 leading-relaxed">{org.mission}</p>
                    </div>
                  )}

                  {/* Funds usage — only shown when the org has filled it in */}
                  {org.fundsUsage && (() => {
                    const fu = org.fundsUsage!;
                    const categories: { key: keyof typeof fu; label: string; color: string }[] = [
                      { key: "operations", label: "Operations",          color: "#B50000" },
                      { key: "materials",  label: "Materials & Supplies", color: "#D97706" },
                      { key: "staff",      label: "Staff & Volunteers",   color: "#059669" },
                      { key: "events",     label: "Community Events",     color: "#2563EB" },
                      { key: "other",      label: "Other",                color: "#7C3AED" },
                    ];
                    return (
                      <div id={PROFILE_ANCHORS.funds} className="scroll-mt-20">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            How funds are used
                          </h3>
                          <span className="text-[10px] text-muted-foreground italic">
                            Self-reported by the organisation
                          </span>
                        </div>

                        {/* Stacked horizontal bar */}
                        <div className="h-5 rounded-full overflow-hidden flex mb-3">
                          {categories.map(({ key, color }) => {
                            const pct = fu[key];
                            if (!pct) return null;
                            return (
                              <div
                                key={key}
                                title={`${pct}%`}
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="space-y-1.5">
                          {categories.map(({ key, label, color }) => {
                            const pct = fu[key];
                            if (!pct) return null;
                            return (
                              <div key={key} className="flex items-center gap-2 text-xs">
                                <div
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="text-foreground/70 flex-1">{label}</span>
                                <span className="font-semibold text-foreground">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {team.length > 0 && (
                    <div id={PROFILE_ANCHORS.team} className="scroll-mt-20">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Team</h3>
                      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {team.slice(0, 6).map((m, i) => (
                          <li key={i} className="flex items-center gap-3 min-w-0" data-testid={`team-member-${i}`}>
                            {m.photoUrl ? (
                              <img src={m.photoUrl} alt={m.name} loading="lazy" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-extrabold" style={{ backgroundColor: GOLD, color: "#111" }}>
                                {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
                              {m.role && <p className="text-xs text-muted-foreground truncate">{m.role}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div id={PROFILE_ANCHORS.contact} className="scroll-mt-20 space-y-5">
                  {org.contact && Object.values(org.contact).some(Boolean) && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Contact
                      </h3>
                      <div className="space-y-1 text-sm text-foreground/80">
                        {org.contact.email && (
                          <a
                            href={`mailto:${org.contact.email}`}
                            className="flex items-center gap-2 hover:text-primary transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5" /> {org.contact.email}
                          </a>
                        )}
                        {org.contact.phone && (
                          <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {org.contact.phone}</p>
                        )}
                        {org.contact.website && (
                          <a
                            href={org.contact.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:text-primary transition-colors"
                            style={{ color: RED }}
                          >
                            <Globe className="w-3.5 h-3.5" /> {org.contact.website}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {org.socialLinks && Object.keys(org.socialLinks).length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Social
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(org.socialLinks).map(([platform, url]) => (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors capitalize"
                          >
                            {platform}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

          {/* The Campaigns tab already shows the full list; don't repeat it in the sidebar. */}
          {tab !== "campaigns" && (
          <div className="orgp-panel">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-bold text-foreground text-base">Active Campaigns</h3>
              <button
                className="text-sm font-semibold"
                style={{ color: RED }}
                onClick={() => setTab("campaigns")}
              >
                View all
              </button>
            </div>

            <div className="px-5 pb-3">
              {campaignsQ.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20" /><Skeleton className="h-20" />
                </div>
              ) : realCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No active campaigns right now.
                </p>
              ) : (
                realCampaigns.slice(0, 3).map((c) => (
                  <CampaignCard key={c._id} campaign={c} orgId={id} onDonate={handleCampaignDonate} />
                ))
              )}
            </div>

            <div className="px-5 pb-5">
              <Link
                href={`/organisations/${id}/campaigns`}
                className="block w-full py-2.5 rounded-xl font-bold text-white text-sm text-center hover:opacity-90 transition-opacity"
                style={PRIMARY_ACTION_STYLE}
              >
                See All Campaigns
              </Link>
            </div>
          </div>
          )}

          {/* Ways to Volunteer card */}
          <div className="orgp-panel">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-bold text-foreground text-base">Ways to Volunteer</h3>
              <button
                className="text-sm font-semibold"
                style={{ color: RED }}
                onClick={() => setTab("volunteer")}
              >
                View all
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 px-5 pb-3 flex-wrap">
              {["Local", "Remote", "Short Term", "Long Term"].map((label, i) => (
                <span
                  key={label}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                  style={
                    i === 0
                      ? { backgroundColor: RED, color: "#fff" }
                      : { backgroundColor: "#F2EDE4", color: "#555" }
                  }
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="px-5 pb-3 space-y-0">
              {rolesQ.isLoading ? (
                <div className="space-y-2 py-2">
                  {[1,2].map(i => <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />)}
                </div>
              ) : (rolesQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No volunteer roles listed yet.</p>
              ) : (
                (rolesQ.data ?? []).slice(0, 4).map((role: VolunteerRole) => (
                  <div
                    key={role._id}
                    className="flex items-center gap-3 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/30 -mx-1 px-1 rounded-lg transition-colors"
                    onClick={() => setTab("volunteer")}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: GOLD + "33" }}
                    >
                      <Users className="w-4 h-4" style={{ color: "#7A5000" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground leading-snug">{role.title}</p>
                      <p className="text-xs text-muted-foreground">{role.location} · {role.commitment}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))
              )}
            </div>

            <div className="px-5 pb-5">
              <button
                className="w-full py-2.5 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
                style={PRIMARY_ACTION_STYLE}
                onClick={handleDonateClick}
              >
                Apply to Volunteer
              </button>
            </div>
          </div>

          {/* Reviews sidebar snippet */}
          {(reviewsQ.data ?? []).length > 0 && (
            <div className="orgp-panel">
              <div className="px-5 pt-5 pb-3">
                <h3 className="font-bold text-foreground text-base">Reviews</h3>
              </div>
              <div className="px-5 pb-5">
                {(reviewsQ.data ?? []).slice(0, 2).map((r) => (
                  <ReviewRow key={r._id} item={r} />
                ))}
              </div>
            </div>
          )}

          {/* Supporter wall — only shown when there are opted-in supporters */}
          {(() => {
            const supporters = supportersQ.data?.supporters ?? [];
            const totalCount = supportersQ.data?.totalCount ?? 0;
            if (!supporters.length) return null;
            const shown = supporters.slice(0, 10);
            const extra = totalCount - shown.length;
            return (
              <div className="orgp-panel">
                <div className="px-5 pt-5 pb-2">
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    <Heart className="w-4 h-4" style={{ color: RED }} />
                    Supporters
                  </h3>
                </div>
                <div className="px-5 pb-5">
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {shown.map((s, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        <span className="font-semibold">{s.displayName}</span>
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="text-muted-foreground">
                        {" "}and {extra} other{extra !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  {!isAuthenticated && (
                    <button
                      onClick={openOrgDonateSheet}
                      className="mt-3 text-xs font-semibold underline underline-offset-2"
                      style={{ color: RED }}
                    >
                      Add your name by donating
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
