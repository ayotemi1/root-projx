export type CampaignCurrency = "gbp" | "usd";

/** Normalise any server value to a supported charge currency. Default GBP. */
export function currencyOf(c?: string | null): CampaignCurrency {
  return typeof c === "string" && c.toLowerCase() === "usd" ? "usd" : "gbp";
}

export function currencySymbol(c?: string | null): string {
  return currencyOf(c) === "usd" ? "$" : "£";
}

export function currencyName(c?: string | null): string {
  return currencyOf(c) === "usd" ? "US dollars" : "pounds";
}

/** Whole-unit amount, e.g. £4,800 or $4,800. */
export function formatWhole(n: number, c?: string | null): string {
  const locale = currencyOf(c) === "usd" ? "en-US" : "en-GB";
  return `${currencySymbol(c)}${Math.round(n || 0).toLocaleString(locale)}`;
}

/** Two-decimal amount, e.g. £12.50 or $12.50. */
export function formatMoney(n: number, c?: string | null): string {
  return `${currencySymbol(c)}${(n || 0).toFixed(2)}`;
}
