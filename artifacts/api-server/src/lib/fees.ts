export const MIN_DONATION_PENCE = 300;

export const PLATFORM_FEE_PERCENT: number = parseFloat(
  process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "5",
);

/** Calculate the platform fee in whole pence from a base amount in pence. */
export function platformFeePence(basePence: number): number {
  return Math.round(basePence * PLATFORM_FEE_PERCENT / 100);
}

/** Donation accounting is calculated in whole pence, then exposed in GBP. */
export function donationAccounting(input: {
  chargedPence: number;
  intendedPence?: number;
  feeCovered: boolean;
  cardCountry?: string | null;
}) {
  const intendedPence = input.intendedPence ?? input.chargedPence;
  if (!Number.isSafeInteger(input.chargedPence) || input.chargedPence < 0 ||
      !Number.isSafeInteger(intendedPence) || intendedPence < 0) {
    throw new Error("Invalid donation accounting amounts");
  }
  const platformPence = platformFeePence(intendedPence);
  const country = input.cardCountry?.trim().toUpperCase();
  const stripeRate = !country || country === "GB" || country === "UK" ? 0.015 : 0.0325;
  const estimatedStripeFeePence = Math.round(intendedPence * stripeRate + 20);
  const toOrgPence = intendedPence - platformPence -
    (input.feeCovered ? 0 : estimatedStripeFeePence);
  return {
    chargedGbp: input.chargedPence / 100,
    intendedGbp: intendedPence / 100,
    platformFeeGbp: platformPence / 100,
    feeCovered: input.feeCovered,
    feeCoverGbp: input.feeCovered ? (input.chargedPence - intendedPence) / 100 : 0,
    toOrgGbp: toOrgPence / 100,
    estimatedStripeFeeGbp: estimatedStripeFeePence / 100,
    amountGbp: intendedPence / 100,
    netAmountGbp: toOrgPence / 100,
    grossAmountGbp: input.chargedPence / 100,
  };
}
