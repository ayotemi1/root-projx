import type { CSSProperties, ReactNode } from "react";
import type { Campaign } from "@/lib/api";

/** Keep the selected campaign attached to the click, not just the organisation. */
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
