/** Presentation only: never used to calculate a charge, payout or campaign total. */
export interface CampaignPresentation {
  icon: "hand" | "drum" | "heart";
  symbolColour: string;
  confirmationLine: string;
  counterLabel: string;
  hasWall: boolean;
}
type CampaignLike = { _id?: unknown; name?: unknown; amountRaised?: unknown; donationPresentation?: unknown };
export function campaignPresentation(campaign?: CampaignLike | null): CampaignPresentation {
  const wall = campaign?._id === "hov_out_of_many_hands" || campaign?.name === "Out of Many Hands";
  const drum = campaign?._id === "9d5e9d29323a434f8706" || campaign?.name === "Drum Life";
  const defaults: CampaignPresentation = wall
    ? { icon: "hand", symbolColour: "#CA0813", confirmationLine: "and your hand is on the wall", counterLabel: "Your hand · No. {n}", hasWall: true }
    : drum
      ? { icon: "drum", symbolColour: "#F3BF2C", confirmationLine: "and you're helping light up a drum", counterLabel: "Drum {n} of 50", hasWall: false }
      : { icon: "heart", symbolColour: "#CA0813", confirmationLine: "", counterLabel: "Supporter no. {n}", hasWall: false };
  const saved = campaign?.donationPresentation as Partial<CampaignPresentation> | undefined;
  return {
    ...defaults,
    icon: saved?.icon === "drum" || saved?.icon === "heart" || (wall && saved?.icon === "hand")
      ? saved.icon : defaults.icon,
    confirmationLine: typeof saved?.confirmationLine === "string" && saved.confirmationLine.length <= 180 &&
      (wall || !/\b(hand|wall)\b/i.test(saved.confirmationLine)) ? saved.confirmationLine : defaults.confirmationLine,
    counterLabel: typeof saved?.counterLabel === "string" && saved.counterLabel.includes("{n}") &&
      saved.counterLabel.length <= 80 && (wall || !/\b(hand|wall)\b/i.test(saved.counterLabel))
      ? saved.counterLabel : defaults.counterLabel,
    // Hands and wall language belong exclusively to the wall campaign.
    symbolColour: typeof saved?.symbolColour === "string" && /^#[0-9a-f]{6}$/i.test(saved.symbolColour)
      ? saved.symbolColour : defaults.symbolColour,
  };
}
export function campaignCounter(campaign: CampaignLike | null | undefined, number?: number | null): string {
  const p = campaignPresentation(campaign);
  const n = p.icon === "drum"
    ? Math.max(1, Math.min(50, Math.ceil(Number(campaign?.amountRaised ?? 0) / 150)))
    : number;
  return p.counterLabel.replace("{n}", n && Number.isFinite(n) ? String(n) : "—");
}
