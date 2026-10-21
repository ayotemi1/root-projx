/** Partner commitments are not donor-triggered matching promises. */
export interface PartnerFunding {
  amount: number;
  funderName: string;
  type: "committed" | "matching";
  matchRatio?: number;
  matchCap?: number;
}

/** Legacy data always means committed, including private unpublished revisions. */
export function migrateCampaignPartnerFunding(campaign: Record<string, unknown>): Record<string, unknown> {
  const { matchFunding, matchFundingAnswer, editorDraft, ...rest } = campaign;
  if (!("partnerFunding" in rest) && "matchFunding" in campaign) {
    rest.partnerFunding = matchFunding && typeof matchFunding === "object"
      ? { amount: (matchFunding as Record<string, unknown>).amount,
          funderName: (matchFunding as Record<string, unknown>).funderName, type: "committed" }
      : null;
  }
  if (!("partnerFundingAnswer" in rest) && "matchFundingAnswer" in campaign) rest.partnerFundingAnswer = matchFundingAnswer;
  if (editorDraft && typeof editorDraft === "object" && !Array.isArray(editorDraft)) {
    rest.editorDraft = migrateCampaignPartnerFunding(editorDraft as Record<string, unknown>);
  }
  return rest;
}

export function partnerFundingFor(campaign: Record<string, unknown>): PartnerFunding | null {
  const value = migrateCampaignPartnerFunding(campaign).partnerFunding;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const funding = value as PartnerFunding;
  // An absent/unknown type cannot silently make a matching promise.
  return { ...funding, type: funding.type === "matching" ? "matching" : "committed" };
}

/** Cap is measured in partner money, not donor money. Work in whole pennies. */
export function campaignMatch(donationGbp: number, funding: PartnerFunding | null | undefined, matchedUsedGbp = 0) {
  const pence = Number.isFinite(donationGbp) ? Math.max(0, Math.round(donationGbp * 100)) : 0;
  const cap = funding?.matchCap ?? funding?.amount ?? 0;
  const ratio = funding?.matchRatio ?? 1;
  const used = Number.isFinite(matchedUsedGbp) ? Math.max(0, Math.round(matchedUsedGbp * 100)) : 0;
  const available = funding?.type === "matching" && Number.isFinite(cap) && cap > 0 &&
    Number.isFinite(ratio) && ratio > 0 ? Math.max(0, Math.round(cap * 100) - used) : 0;
  const matched = available > 0 ? Math.min(Math.round(pence * ratio), available) : 0;
  return { donationGbp: pence / 100, matchedGbp: matched / 100,
    programmeGbp: (pence + matched) / 100, availableGbp: available / 100 };
}
