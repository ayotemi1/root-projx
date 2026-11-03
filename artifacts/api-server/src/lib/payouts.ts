import { createHash } from "node:crypto";
import { fsCreateIfAbsent } from "./firebase-rest.js";

export const PAYOUT_HOLD_DAYS = 7;
export const PAYOUT_THRESHOLD_GBP = 250;
export const PAYOUT_MAX_AGE_DAYS = 30;
const DAY = 86_400_000;

export interface Payout {
  _id: string;
  orgId: string;
  orgName: string;
  donationId: string;
  stripeRef: string;
  amountGbp: number;
  currency: string;
  method: "wise" | "manual";
  status: "queued" | "sent" | "failed";
  createdAt: string;
  batchId?: string;
  wiseTransferId?: number;
  sentAt?: string;
  sentBy?: string;
  reference?: string;
  error?: string;
}

export function payoutDue(payouts: Payout[], today = new Date()) {
  const eligible = payouts.filter(p => p.status === "queued" &&
    Number.isFinite(Date.parse(p.createdAt)) &&
    today.getTime() - Date.parse(p.createdAt) >= PAYOUT_HOLD_DAYS * DAY);
  const totalPence = eligible.reduce((sum, p) => sum + Math.round(p.amountGbp * 100), 0);
  const oldest = eligible.length ? Math.min(...eligible.map(p => Date.parse(p.createdAt))) : null;
  return {
    due: totalPence > 0 && (totalPence >= PAYOUT_THRESHOLD_GBP * 100 ||
      (oldest !== null && today.getTime() - oldest > PAYOUT_MAX_AGE_DAYS * DAY)),
    eligibleTotalGbp: totalPence / 100,
    eligible,
  };
}

export async function queueDonationPayout(
  donationId: string, donation: Record<string, unknown>, token: string,
) {
  if (donation.payoutMethod !== "wise" && donation.payoutMethod !== "manual") return;
  const stripeRef = String(donation.stripeRef ?? "");
  if (!stripeRef || typeof donation.toOrgGbp !== "number" || !Number.isFinite(donation.toOrgGbp)) {
    throw new Error("Cannot queue payout without Stripe reference and canonical proceeds");
  }
  await fsCreateIfAbsent("payouts", createHash("sha256").update(stripeRef).digest("hex"), {
    orgId: donation.orgId, orgName: donation.orgName ?? "", donationId, stripeRef,
    amountGbp: donation.toOrgGbp, currency: donation.accountingCurrency ?? donation.currency ?? "gbp",
    method: donation.payoutMethod, status: "queued", createdAt: donation.createdAt,
  }, token);
}
