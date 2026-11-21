import type { Org } from "./api";
import { orgSectors } from "./sectors";

/** The public organisation endpoint owns visibility; never invent filler cards.
 * Keep its order within each group and include multi-sector profile matches. */
export function selectOnboardingSuggestions(orgs: Org[], interests: readonly string[]): Org[] {
  const seen = new Set<string>();
  const unique = orgs.filter(org => {
    if (!org._id || !org.name?.trim() || seen.has(org._id)) return false;
    seen.add(org._id);
    return true;
  });
  const wanted = new Set(interests);
  const matches = (org: Org) => orgSectors(org).some(sector => wanted.has(sector));
  return [...unique.filter(matches), ...unique.filter(org => !matches(org))].slice(0, 6);
}

export function onboardingDestination(org: Org): { href: string; label: "Donate" | "Visit" } {
  const canDonate = ["stripe_connect", "wise", "manual"].includes(org.payoutMethod);
  return {
    href: `${canDonate ? "/donate" : "/organisations"}/${encodeURIComponent(org._id)}`,
    label: canDonate ? "Donate" : "Visit",
  };
}
