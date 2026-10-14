export const MIN_DONATION_PENCE = 300;

export const PLATFORM_FEE_PERCENT: number = parseFloat(
  process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "5",
);

/** Calculate the platform fee in whole pence from a base amount in pence. */
export function platformFeePence(basePence: number): number {
  return Math.round(basePence * PLATFORM_FEE_PERCENT / 100);
}
