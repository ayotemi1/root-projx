import type { CSSProperties, ReactNode } from "react";
import type { Campaign } from "./profile-fixtures";

/** Preserves campaign selection while routing the click to the local preview sheet. */
export function CampaignDonateButton({ campaign, onDonate, className, style, children }: {
  campaign: Campaign;
  onDonate: (campaign: Campaign) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return <button type="button" onClick={() => onDonate(campaign)}
    data-testid={`donate-campaign-${campaign._id}`} className={className} style={style}>
    {children}
  </button>;
}
