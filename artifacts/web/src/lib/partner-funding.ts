// Display helpers for partner funding. Calculation is the shared server helper;
// this file only decides what is honest to say. Never changes charges or totals.
import { campaignMatch } from "../../../api-server/src/lib/campaign-matching";
import type { PartnerFunding } from "@/lib/api";

export const ratioOf = (pf: PartnerFunding) => (pf.matchRatio && pf.matchRatio > 0 ? pf.matchRatio : 1);
export const capOf = (pf: PartnerFunding) => (pf.matchCap && pf.matchCap > 0 ? pf.matchCap : pf.amount);

/** "£1 for £1" / "£2 for every £1". */
export const ratioLabel = (pf: PartnerFunding, currency?: string | null) => {
  const c = currency === "usd" ? "$" : "£";
  const r = ratioOf(pf);
  return r === 1 ? `${c}1 for ${c}1` : `${c}${Number(r.toFixed(2))} for every ${c}1`;
};

/** Matching only; committed funding never produces a match. */
export function partnerMatch(donationGbp: number, pf: PartnerFunding | null | undefined, matchedUsedGbp: number) {
  if (!pf || pf.type !== "matching" || !(pf.amount > 0)) {
    const d = Math.max(0, Math.round((donationGbp || 0) * 100)) / 100;
    return { donationGbp: d, matchedGbp: 0, programmeGbp: d, availableGbp: 0 };
  }
  return campaignMatch(donationGbp, pf, matchedUsedGbp || 0);
}
