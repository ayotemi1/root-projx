import { Link } from "wouter";
import type { Campaign } from "@/lib/api";
import { CampaignDonateButton } from "@/components/campaign-donate-button";
import { formatWhole } from "@/lib/currency";
import "./discover-campaign-card.css";

export interface DiscoverCampaignCardOrg {
  name: string;
  logo?: string | null;
  verified?: boolean;
  href?: string | null;
}

export function campaignCardHref(c: Campaign): string | null {
  return c.sharePath || (c.publicId ? `/campaigns/${encodeURIComponent(c.publicId)}` : null);
}

function initialsOf(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Reusable Discover-style campaign card: square image, linked name, owning org, native-currency progress, Donate. */
export function DiscoverCampaignCard({ campaign, org, onDonate }: {
  campaign: Campaign;
  org: DiscoverCampaignCardOrg;
  onDonate: (c: Campaign) => void;
}) {
  const href = campaignCardHref(campaign);
  const pct = campaign.goal > 0 ? Math.min(100, ((campaign.amountRaised ?? 0) / campaign.goal) * 100) : 0;
  const ends = campaign.deadline
    ? `Ends ${new Date(campaign.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : null;
  const done = campaign.status === "completed";
  const image = campaign.imageUrl
    ? <img src={campaign.imageUrl} alt="" loading="lazy" />
    : <span className="dcc-fallback" aria-hidden>{initialsOf(campaign.name || org.name)}</span>;
  const orgInner = (
    <>
      <span className="dcc-logo">{org.logo ? <img src={org.logo} alt="" /> : <span aria-hidden>{initialsOf(org.name)}</span>}</span>
      <span className="dcc-org-name">{org.name}</span>
      {org.verified && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#1D6B3A" role="img" aria-label="Verified organisation">
          <path d="M12 2l2.4 2.1 3.1-.4.9 3 2.8 1.5-1 3 1 3-2.8 1.5-.9 3-3.1-.4L12 22l-2.4-2.1-3.1.4-.9-3-2.8-1.5 1-3-1-3 2.8-1.5.9-3 3.1.4z" />
          <path d="M8.5 12.2l2.3 2.3 4.7-4.7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </>
  );
  return (
    <article className="dcc" data-testid={`card-campaign-${campaign._id}`}>
      {href
        ? <Link href={href} className="dcc-media" tabIndex={-1} aria-hidden data-testid={`link-campaign-image-${campaign._id}`}>{image}</Link>
        : <span className="dcc-media">{image}</span>}
      <div className="dcc-body">
        {href
          ? <Link href={href} className="dcc-name" data-testid={`link-campaign-${campaign._id}`}>{campaign.name}</Link>
          : <span className="dcc-name">{campaign.name}</span>}
        {org.href
          ? <Link href={org.href} className="dcc-org">{orgInner}</Link>
          : <span className="dcc-org">{orgInner}</span>}
        {campaign.goal > 0 && (
          <>
            <div className="dcc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Raised so far">
              <div style={{ transform: `scaleX(${pct / 100})` }} />
            </div>
            <p className="dcc-meta" data-testid={`text-campaign-progress-${campaign._id}`}>
              <b>{formatWhole(campaign.amountRaised ?? 0, campaign.currency)}</b> of {formatWhole(campaign.goal, campaign.currency)}
              {done ? " · Completed" : ends ? ` · ${ends}` : ""}
            </p>
          </>
        )}
        {campaign.status === "active" && (
          <CampaignDonateButton campaign={campaign} onDonate={onDonate} className="dcc-donate">Donate</CampaignDonateButton>
        )}
      </div>
    </article>
  );
}
