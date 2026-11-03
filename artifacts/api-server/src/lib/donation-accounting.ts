// Browser-safe accounting and disclosure shared by website estimates and the
// server fee wrapper. Amounts use the input currency's minor units. The *Gbp
// aliases are retained for compatibility; USD receiptAccounting must always be
// paired with its currency, while stored top-level *Gbp values are converted.
// Keep environment variables and external services out.
export function calculatePlatformFeePence(basePence: number, percent: number): number {
  return Math.round(basePence * percent / 100);
}

export function estimateStripeFeePence(intendedPence: number, cardCountry?: string | null, currency: "gbp" | "usd" = "gbp"): number {
  // USD checkout uses an explicitly labelled estimate, not a settlement quote.
  if (currency === "usd") return Math.round(intendedPence * 0.0325 + 30);
  const country = cardCountry?.trim().toUpperCase();
  const rate = !country || country === "GB" || country === "UK" ? 0.015 : 0.0325;
  return Math.round(intendedPence * rate + 20);
}

export function calculateDonationAccounting(input: {
  chargedPence: number;
  intendedPence?: number;
  feeCovered: boolean;
  cardCountry?: string | null;
  currency?: "gbp" | "usd";
}, platformFeePercent = 5) {
  const intendedPence = input.intendedPence ?? input.chargedPence;
  if (!Number.isSafeInteger(input.chargedPence) || input.chargedPence < 0 ||
      !Number.isSafeInteger(intendedPence) || intendedPence < 0) {
    throw new Error("Invalid donation accounting amounts");
  }
  const platformPence = calculatePlatformFeePence(intendedPence, platformFeePercent);
  const stripePence = estimateStripeFeePence(intendedPence, input.cardCountry, input.currency);
  const toOrgPence = intendedPence - platformPence - (input.feeCovered ? 0 : stripePence);
  return {
    chargedGbp: input.chargedPence / 100,
    intendedGbp: intendedPence / 100,
    platformFeeGbp: platformPence / 100,
    feeCovered: input.feeCovered,
    feeCoverGbp: input.feeCovered ? (input.chargedPence - intendedPence) / 100 : 0,
    toOrgGbp: toOrgPence / 100,
    estimatedStripeFeeGbp: stripePence / 100,
    amountGbp: intendedPence / 100,
    netAmountGbp: toOrgPence / 100,
    grossAmountGbp: input.chargedPence / 100,
  };
}

export type DonationAccounting = ReturnType<typeof calculateDonationAccounting>;

export function donationDisclosure(accounting: DonationAccounting, orgName: string, platformFeePercent = 5, currency: "gbp" | "usd" = "gbp") {
  const money = (value: number) => `${currency === "usd" ? "US$" : "£"}${value.toFixed(2)}`;
  return {
    donationLine: `Your donation ${money(accounting.intendedGbp)}` +
      (accounting.feeCovered ? ` · Fee cover ${money(accounting.feeCoverGbp)}` : "") +
      ` · Total charged ${money(accounting.chargedGbp)}`,
    orgLine: `${orgName} receives ${money(accounting.toOrgGbp)} · Root ProjX platform fee ` +
      `${money(accounting.platformFeeGbp)} (${platformFeePercent}%)` +
      (accounting.feeCovered ? "" : ` · Card processing ${money(accounting.estimatedStripeFeeGbp)}`),
  };
}
