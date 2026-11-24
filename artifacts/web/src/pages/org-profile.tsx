import { useEffect, useRef, useState } from "react";
import { DiscoverCampaignCard } from "@/components/campaign-card/DiscoverCampaignCard";
import { useRoute, Link } from "wouter";
import { organisationDashboardHref } from "@/lib/supporter-navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { Campaign } from "@/lib/api";
import { StartMessageButton } from "@/components/messaging/StartMessageButton";
import { DonationAmountDialog } from "@/components/donation-amount-dialog";
import { GuestJoinPrompt } from "@/components/guest-feed/GuestJoinPrompt";
import { ContentGallery } from "@/components/org-content/content-gallery";
import { CampaignDonateButton } from "@/components/campaign-donate-button";
import { formatWhole } from "@/lib/currency";
import { PROFILE_ANCHORS, orgSectors } from "@/lib/sectors";
import "@/components/org-content/org-profile.css";

function VerifiedTick() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1D6B3A" role="img" aria-label="Verified organisation" data-testid="icon-org-verified">
      <path d="M12 2l2.4 2.1 3.1-.4.9 3 2.8 1.5-1 3 1 3-2.8 1.5-.9 3-3.1-.4L12 22l-2.4-2.1-3.1.4-.9-3-2.8-1.5 1-3-1-3 2.8-1.5.9-3 3.1.4z" />
      <path d="M8.5 12.2l2.3 2.3 4.7-4.7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function campaignHref(c: Campaign): string | null {
  return c.sharePath || (c.publicId ? `/campaigns/${encodeURIComponent(c.publicId)}` : null);
}

function endsLabel(c: Campaign) {
  return c.deadline ? `Ends ${new Date(c.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : null;
}

/** Published = not removed and not switched off by the organisation. */
function isPublished(c: Campaign) {
  return c.status !== "deleted" && c.enabled !== false;
}

function LiveCampaignCard({ campaign, onDonate, testId }: { campaign: Campaign; onDonate: (c: Campaign) => void; testId: string }) {
  const pct = campaign.goal > 0 ? Math.min(100, (campaign.amountRaised / campaign.goal) * 100) : 0;
  const href = campaignHref(campaign);
  const ends = endsLabel(campaign);
  return (
    <section className="orgp-box orgp-live" data-testid={testId}>
      {href ? (
        <Link href={href} className="orgp-live-media" tabIndex={-1} aria-hidden data-testid={`${testId}-image`}>
          {campaign.imageUrl ? <img src={campaign.imageUrl} alt="" /> : <span className="orgp-live-fallback">Live</span>}
        </Link>
      ) : (
        <span className="orgp-live-media">{campaign.imageUrl ? <img src={campaign.imageUrl} alt="" /> : <span className="orgp-live-fallback">Live</span>}</span>
      )}
      <div className="orgp-live-bd">
      <div className="orgp-box-top">
        <span className="orgp-mono" style={{ fontWeight: 700, fontSize: 11 }}>Live campaign</span>
        <span className="orgp-tag">Live</span>
      </div>
      <div className="orgp-h" style={{ fontSize: 32, marginTop: 12 }}>{campaign.name}</div>
      <div className="orgp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Raised so far">
        <div style={{ width: `${Math.round(pct)}%` }} />
      </div>
      <p className="orgp-hint" data-testid={`${testId}-progress`}>
        {formatWhole(campaign.amountRaised ?? 0, campaign.currency)} of {formatWhole(campaign.goal, campaign.currency)}{ends ? ` · ${ends}` : ""}
      </p>
      <div className="orgp-box-btns">
        <CampaignDonateButton campaign={campaign} onDonate={onDonate} className="orgp-btn y">Donate</CampaignDonateButton>
        {href ? <Link href={href} className="orgp-btn" data-testid={`${testId}-view`}>View</Link> : <button type="button" className="orgp-btn" disabled>View</button>}
      </div>
      </div>
    </section>
  );
}

function CampaignRow({ campaign, orgId, onDonate }: { campaign: Campaign; orgId: string; onDonate: (c: Campaign) => void }) {
  const href = campaignHref(campaign);
  const ends = endsLabel(campaign);
  const fundraising = campaign.type === "fundraising";
  return (
    <article className="orgp-camp" data-testid={`card-campaign-${campaign._id}`}>
      <span className="orgp-camp-thumb">{campaign.imageUrl && <img src={campaign.imageUrl} alt="" loading="lazy" />}</span>
      <div className="orgp-camp-bd">
        <span className="orgp-mono orgp-mut" style={{ fontSize: 10 }}>
          {fundraising ? "Fundraising" : "Volunteering"}{campaign.status === "completed" ? " · Completed" : ""}
        </span>
        <b>{campaign.name}</b>
        {fundraising && campaign.goal > 0 ? (
          <span className="orgp-hint" style={{ margin: 0 }}>
            {formatWhole(campaign.amountRaised ?? 0, campaign.currency)} of {formatWhole(campaign.goal, campaign.currency)}{ends ? ` · ${ends}` : ""}
          </span>
        ) : campaign.type === "volunteer" ? (
          <span className="orgp-hint" style={{ margin: 0 }}>{campaign.volunteersNeeded} volunteers needed{ends ? ` · ${ends}` : ""}</span>
        ) : null}
        <div className="orgp-camp-row">
          {href && <Link href={href} className="orgp-btn" data-testid={`link-campaign-${campaign._id}`}>View campaign</Link>}
          {campaign.status === "active" && (fundraising
            ? <CampaignDonateButton campaign={campaign} onDonate={onDonate} className="orgp-btn y">Donate</CampaignDonateButton>
            : <a className="orgp-btn y" href={`/donate/${orgId}`}>Get involved</a>)}
        </div>
      </div>
    </article>
  );
}

export default function OrgProfilePage() {
  const [, params] = useRoute("/organisations/:id");
  const id = params?.id ?? "";
  const { isAuthenticated, token, user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"posts" | "campaigns">("posts");
  const [localFollow, setLocalFollow] = useState<boolean | null>(null);
  const [donateModalOpen, setDonateModalOpen] = useState(false);
  const [donationCampaign, setDonationCampaign] = useState<Campaign | null>(null);
  const [guestAction, setGuestAction] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const orgQ = useQuery({
    queryKey: ["org", id],
    queryFn: () => api.getOrganisation(id, token),
    enabled: !!id,
  });

  // Owner opened "Preview as a donor": record the real open once the page has rendered.
  const previewMode = new URLSearchParams(window.location.search).get("preview") === "1";
  const isOwnerPreview = previewMode && !!authUser && String(authUser.id) === id;
  const previewRecorded = useRef(false);
  const [previewRecordFailed, setPreviewRecordFailed] = useState(false);
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

  const campaignsQ = useQuery({
    queryKey: ["campaigns", id],
    queryFn: () => api.getCampaigns(id),
    enabled: !!id,
  });

  const followsQ = useQuery({
    queryKey: ["follows", "my"],
    queryFn: () => api.getMyFollows(token!),
    enabled: isAuthenticated && !!token,
  });

  const followed = localFollow !== null ? localFollow : (followsQ.data ?? []).some((o) => o._id === id);

  const followMut = useMutation({
    mutationFn: async () => {
      if (followed) await api.unfollowOrg(id, token!);
      else await api.followOrg(id, token!);
    },
    onSuccess: () => {
      setLocalFollow(!followed);
      queryClient.invalidateQueries({ queryKey: ["follows", "my"] });
      queryClient.invalidateQueries({ queryKey: ["org", id] });
    },
  });

  const org = orgQ.data;

  useEffect(() => {
    if (!shareNote) return;
    const t = window.setTimeout(() => setShareNote(null), 2600);
    return () => window.clearTimeout(t);
  }, [shareNote]);

  // Deep links from the editor: scroll to the identity block if requested.
  useEffect(() => {
    if (!org) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const timer = window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    return () => window.clearTimeout(timer);
  }, [org?._id]);

  const previewBar = previewMode ? (
    <div className="orgp-preview" role="status" data-testid="bar-donor-preview">
      <span>You're previewing your page as a donor</span>
      <Link href="/dashboard" data-testid="link-back-dashboard">Back to dashboard</Link>
    </div>
  ) : null;

  if (orgQ.isLoading) {
    return (
      <div className="rp-orgp" data-testid="status-org-loading">
        {previewBar}
        <div className="orgp-wrap">
          <div className="orgp-cols">
            <div className="orgp-main">
              <div className="orgp-head">
                <div className="orgp-av orgp-sk" style={{ border: 0 }} />
                <div className="orgp-info">
                  <div className="orgp-sk" style={{ height: 44, width: "70%" }} />
                  <div className="orgp-sk" style={{ height: 44, width: "60%" }} />
                  <div className="orgp-sk" style={{ height: 22, width: "50%" }} />
                </div>
              </div>
              <div className="orgp-sk" style={{ height: 60, marginTop: 28, maxWidth: 600 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 40 }}>
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="orgp-sk" style={{ aspectRatio: "1" }} />)}
              </div>
            </div>
            <aside className="orgp-rail"><div className="orgp-sk" style={{ height: 240 }} /></aside>
          </div>
        </div>
      </div>
    );
  }

  if (orgQ.isError && !org) {
    return (
      <div className="rp-orgp">
        {previewBar}
        <div className="orgp-wrap orgp-state" role="alert">
          <p className="orgp-mono orgp-mut">Something went wrong</p>
          <h1 className="orgp-h" style={{ fontSize: 40, marginTop: 10 }}>We couldn't load this organisation.</h1>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
            <button type="button" className="orgp-btn y" onClick={() => orgQ.refetch()} data-testid="button-retry-org">Try again</button>
            <Link href="/discover" className="orgp-btn">Back to Discover</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="rp-orgp">
        {previewBar}
        <div className="orgp-wrap orgp-state">
          <p className="orgp-mono orgp-mut">Error 404</p>
          <h1 className="orgp-h" style={{ fontSize: 40, marginTop: 10 }}>Organisation not found.</h1>
          <Link href="/discover" className="orgp-btn y" style={{ marginTop: 24 }}>Back to Discover</Link>
        </div>
      </div>
    );
  }

  const initials = org.name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const updates = updatesQ.data ?? [];
  const campaigns = (campaignsQ.data ?? []).filter(isPublished);
  const liveCampaign = campaigns.find((c) => c.status === "active" && c.type === "fundraising" && c.goal > 0) ?? null;
  const sectors = orgSectors(org);
  const sector = sectors[0] || org.category;
  const where = [org.city, org.country].filter(Boolean).join(", ");
  const bio = org.shortDescription?.trim() || org.description;
  const isSelfOrg = authUser?.accountType === "organisation" && String(authUser.id) === id;

  function handleDonateClick() {
    setDonationCampaign(liveCampaign);
    setDonateModalOpen(true);
  }
  function handleCampaignDonate(campaign: Campaign) {
    setDonationCampaign(campaign);
    setDonateModalOpen(true);
  }
  async function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: org!.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setShareNote("Couldn't share. Copy the address bar link instead.");
    }
  }

  const stats: { key: string; value: string; label: string }[] = [];
  if (updatesQ.isSuccess) stats.push({ key: "posts", value: updates.length.toLocaleString(), label: updates.length === 1 ? "post" : "posts" });
  if (campaignsQ.isSuccess) stats.push({ key: "campaigns", value: campaigns.length.toLocaleString(), label: campaigns.length === 1 ? "campaign" : "campaigns" });
  if (typeof org.totalRaised === "number") stats.push({ key: "raised", value: formatWhole(org.totalRaised, "gbp"), label: "raised" });
  if (typeof org.followerCount === "number") stats.push({ key: "followers", value: org.followerCount.toLocaleString(), label: org.followerCount === 1 ? "follower" : "followers" });

  return (
    <div className="rp-orgp">
      {previewBar}
      {donateModalOpen && <DonationAmountDialog
        onClose={() => setDonateModalOpen(false)}
        orgId={id}
        orgName={org.name}
        campaignId={donationCampaign?._id}
        campaignName={donationCampaign?.name}
        campaignPath={donationCampaign ? campaignHref(donationCampaign) : null}
        currency={donationCampaign?.currency ?? "gbp"}
      />}
      <div className="orgp-wrap">
        {isOwnerPreview && previewRecordFailed && (
          <div role="alert" className="orgp-alert" data-testid="alert-profile-preview-record-failed">
            <span style={{ flex: 1 }}>We couldn't record this preview, so the walkthrough can't tick it off yet.</span>
            <button type="button" className="orgp-btn" onClick={recordProfilePreview} data-testid="button-retry-profile-preview-record">Retry</button>
          </div>
        )}
        <div className="orgp-cols">
          <div className="orgp-main">
            <header id={PROFILE_ANCHORS.identity} className="orgp-head" style={{ scrollMarginTop: 80 }}>
              <span className={`orgp-av${org.logo ? " has-img" : ""}`}>
                {org.logo ? <img src={org.logo} alt={org.name} data-testid="img-org-logo" /> : <span aria-hidden>{initials}</span>}
              </span>
              <div className="orgp-info">
                <div className="orgp-name-row">
                  <h1 className="orgp-h orgp-name" data-testid="text-org-name">{org.name}</h1>
                  {org.verified && <VerifiedTick />}
                </div>
                <div className="orgp-actions">
                  {isAuthenticated ? (
                    <button type="button" className={`orgp-btn ${followed ? "following" : "ink"}`} onClick={() => followMut.mutate()} disabled={followMut.isPending || isSelfOrg} aria-pressed={followed} data-testid="button-follow-org">
                      {followMut.isPending ? "Saving" : followed ? "Following" : "Follow"}
                    </button>
                  ) : (
                    <button type="button" className="orgp-btn ink" onClick={() => setGuestAction("follow organisations")} data-testid="button-follow-org">Follow</button>
                  )}
                  {!isSelfOrg && (
                    <StartMessageButton recipient={{ kind: "organisation", id }} recipientName={org.name} testId="button-message-org" className="orgp-btn"
                      onGuest={() => setGuestAction("message organisations")}>
                      <Mail className="w-4 h-4" /> Message
                    </StartMessageButton>
                  )}
                  <button type="button" className="orgp-btn y" onClick={handleDonateClick} data-testid="button-donate-org">Donate</button>
                  <button type="button" className="orgp-btn icon-only" onClick={handleShare} aria-label="Share" data-testid="button-share-org">
                    <Send className="w-[18px] h-[18px]" />
                  </button>
                </div>
                {isSelfOrg && (
                  <Link href={organisationDashboardHref(token, id, "tab=campaigns")} className="orgp-btn w-full mt-2 justify-center lg:!hidden" data-testid="link-your-campaigns-profile">Your campaigns</Link>
                )}
                {shareNote && <span className="orgp-toast" role="status" data-testid="status-share">{shareNote}</span>}
                {stats.length > 0 && (
                  <dl className="orgp-stats">
                    {stats.map((s) => (
                      <div key={s.key} data-testid={`stat-${s.key}`}>
                        <dt>{s.label}</dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </header>
            <GuestJoinPrompt action={guestAction} onClose={() => setGuestAction(null)} />

            <div className="orgp-bio">
              <div className="orgp-mono orgp-mut" data-testid="text-org-place-sector">{[where, sector].filter(Boolean).join(" · ")}</div>
              {bio && <p data-testid="text-org-short-description">{bio}</p>}
            </div>

            {liveCampaign && (
              <div className="orgp-live-mobile">
                <LiveCampaignCard campaign={liveCampaign} onDonate={handleCampaignDonate} testId="card-live-campaign-mobile" />
              </div>
            )}

            <div className="orgp-tabs" role="tablist" aria-label="Profile sections">
              {([["posts", "Posts"], ["campaigns", "Campaigns"]] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`}>{l}</button>
              ))}
            </div>

            <div className="orgp-tabbody" role="tabpanel">
              {tab === "posts" && (
                <ContentGallery items={updates} isLoading={updatesQ.isLoading} isError={updatesQ.isError} onRetry={() => updatesQ.refetch()} />
              )}
              {tab === "campaigns" && (
                campaignsQ.isLoading ? (
                  <div className="orgp-camps">{[0, 1].map((i) => <div key={i} className="orgp-sk" style={{ height: 96 }} />)}</div>
                ) : campaignsQ.isError ? (
                  <div className="orgp-empty" role="alert">
                    We couldn't load campaigns.{" "}
                    <button type="button" className="orgp-btn" style={{ marginLeft: 8 }} onClick={() => campaignsQ.refetch()} data-testid="button-retry-campaigns">Try again</button>
                  </div>
                ) : campaigns.length === 0 ? (
                  <p className="orgp-empty">No live campaigns.</p>
                ) : (
                  <div className="orgp-camps orgp-camp-grid">
                    {campaigns.map((c) => c.type === "fundraising"
                      ? <DiscoverCampaignCard key={c._id} campaign={c} org={{ name: org.name, logo: org.logo, verified: org.verified, href: `/organisations/${encodeURIComponent(id)}` }} onDonate={handleCampaignDonate} />
                      : <CampaignRow key={c._id} campaign={c} orgId={id} onDonate={handleCampaignDonate} />)}
                  </div>
                )
              )}
            </div>
          </div>

          <aside className="orgp-rail">
            {liveCampaign && <LiveCampaignCard campaign={liveCampaign} onDonate={handleCampaignDonate} testId="card-live-campaign" />}
            <section className="orgp-about" data-testid="section-org-about">
              <h3>About</h3>
              {bio && <p>{bio}</p>}
              <div className="orgp-about-grid">
                <div><div className="orgp-hint" style={{ margin: 0 }}>Based in</div><b>{where || "Not listed"}</b></div>
                <div><div className="orgp-hint" style={{ margin: 0 }}>Sector</div><b>{sector || "Not listed"}</b></div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
