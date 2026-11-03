import { calculateDonationAccounting, calculatePlatformFeePence } from "./donation-accounting.ts";

export const MIN_DONATION_PENCE = 300;

export const PLATFORM_FEE_PERCENT: number = parseFloat(
  process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "5",
);

/** Calculate the platform fee in whole pence from a base amount in pence. */
export function platformFeePence(basePence: number): number {
  return calculatePlatformFeePence(basePence, PLATFORM_FEE_PERCENT);
}

/** Calculate in whole minor units; USD needs explicit conversion for the GBP ledger. */
export function donationAccounting(input: {
  chargedPence: number;
  intendedPence?: number;
  feeCovered: boolean;
  cardCountry?: string | null;
  currency?: "gbp" | "usd";
}) {
  return calculateDonationAccounting(input, PLATFORM_FEE_PERCENT);
}
