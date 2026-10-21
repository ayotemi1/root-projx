// Canonical wording for "Where your money goes". All numbers come from the
// shared Phase 0 accounting helper; nothing is recomputed here.
import { calculateDonationAccounting } from "../../../api-server/src/lib/donation-accounting";

export { calculateDonationAccounting, donationDisclosure } from "../../../api-server/src/lib/donation-accounting";

const money = (v: number) => (v < 1 ? `${Math.round(v * 100)}p` : `£${v.toFixed(2)}`);

export function whereYourMoneyGoes(orgName: string, examplePence = 300) {
  const covered = calculateDonationAccounting({ chargedPence: examplePence, intendedPence: examplePence, feeCovered: true });
  const uncovered = calculateDonationAccounting({ chargedPence: examplePence, feeCovered: false });
  const gift = `£${(examplePence / 100).toFixed(0)}`;
  return {
    covered, uncovered,
    sentence:
      `${orgName} receives £${covered.toOrgGbp.toFixed(2)} of a ${gift} gift when you cover the card fee, ` +
      `or £${uncovered.toOrgGbp.toFixed(2)} when you don't. Root ProjX keeps 5% — ${money(covered.platformFeeGbp)} — either way.`,
  };
}
