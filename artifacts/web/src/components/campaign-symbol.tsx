import { Drum, Heart } from "lucide-react";
import { DonationHand } from "./donation-hand";
import { campaignPresentation, type CampaignPresentation } from "../../../api-server/src/lib/campaign-presentation";
export { campaignPresentation, campaignCounter } from "../../../api-server/src/lib/campaign-presentation";
export type { CampaignPresentation };

export function CampaignSymbol({ campaign, presentation, className = "" }: {
  campaign?: Parameters<typeof campaignPresentation>[0]; presentation?: CampaignPresentation; className?: string;
}) {
  const p = presentation ?? campaignPresentation(campaign);
  return <span className={`inline-flex items-center justify-center ${className}`} style={{ color: p.symbolColour }} aria-hidden="true">
    {p.icon === "hand" ? <DonationHand className="w-full h-full" />
      : p.icon === "drum" ? <Drum className="w-full h-full" strokeWidth={1.6} />
        : <Heart className="w-full h-full" fill="currentColor" strokeWidth={1.6} />}
  </span>;
}
