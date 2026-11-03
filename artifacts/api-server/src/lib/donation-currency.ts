import type Stripe from "stripe";
import type { DonationAccounting } from "./donation-accounting.js";

export type DonationCurrency = "gbp" | "usd";

/** Currency is owned by the campaign, never an arbitrary checkout request. */
export function checkoutCurrency(org: Record<string, unknown>, campaignId: unknown, requested: unknown): DonationCurrency {
  const campaign = (Array.isArray(org.campaigns) ? org.campaigns : [])
    .find((c: Record<string, unknown>) => c._id === campaignId);
  const currency = campaign?.currency ?? "gbp";
  if (!["gbp", "usd"].includes(currency)) throw new Error("This campaign has an unsupported currency.");
  if (requested !== undefined && requested !== currency) throw new Error("Donation currency must match the campaign currency.");
  return currency;
}

/**
 * GBP is still the organisation/payout ledger currency. A USD charge must have
 * Stripe's actual USD→GBP settlement rate before it can enter that ledger.
 * Throw before writing a donation when Stripe has not supplied it yet: webhook
 * retries must never silently equate a dollar with a pound.
 */
export async function donationGbpRate(stripe: Stripe, stripeRef: string): Promise<number> {
  const pi = await stripe.paymentIntents.retrieve(stripeRef, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const tx = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  if (tx?.currency !== "gbp" || typeof tx.exchange_rate !== "number" ||
    !Number.isFinite(tx.exchange_rate) || tx.exchange_rate <= 0) {
    throw new Error("USD donation is awaiting a verified Stripe GBP settlement exchange rate.");
  }
  return tx.exchange_rate;
}

export function accountingInGbp(native: DonationAccounting, rate: number): DonationAccounting {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid GBP exchange rate");
  return Object.fromEntries(Object.entries(native).map(([key, value]) =>
    [key, typeof value === "number" ? Math.round(value * rate * 100) / 100 : value])) as DonationAccounting;
}
