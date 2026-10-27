// Accounts creation alone needs the Managed Risk / Express public preview.
// Keep the shared payments client's API version unchanged.
export const CONNECT_ACCOUNT_API_VERSION = "2026-09-30.preview";

const regions = new Intl.DisplayNames(["en"], { type: "region" });
const countryCodes = new Map<string, string>();
for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    const name = regions.of(code);
    if (name && name !== code) {
      if (!countryCodes.has(name.toLowerCase())) countryCodes.set(name.toLowerCase(), code);
      countryCodes.set(code.toLowerCase(), code);
    }
  }
}
for (const [name, code] of Object.entries({
  uk: "GB", usa: "US", "united states of america": "US",
  turkey: "TR", "south korea": "KR", "north korea": "KP",
  "ivory coast": "CI", "czech republic": "CZ",
})) countryCodes.set(name, code);

export function stripeCountry(country: unknown): string | null {
  return typeof country === "string"
    ? countryCodes.get(country.trim().toLowerCase()) ?? null
    : null;
}

export { publicSiteOrigin as onboardingOrigin } from "./site-origin.ts";
