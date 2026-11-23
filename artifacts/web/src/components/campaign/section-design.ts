import type { CampaignColourScheme, CampaignEditableSection } from "@/lib/api";

/** Default order is the page as it has always rendered. */
export const SECTION_ORDER: CampaignEditableSection[] = ["need", "programme", "outcomes", "team", "money", "wall"];

/** Accept only an exact permutation of the six ids; anything else falls back to the default. */
export function resolveSectionOrder(order: readonly string[] | null | undefined): CampaignEditableSection[] {
  if (!order || order.length !== SECTION_ORDER.length) return SECTION_ORDER;
  const set = new Set(order);
  return set.size === SECTION_ORDER.length && SECTION_ORDER.every((k) => set.has(k)) ? (order as CampaignEditableSection[]) : SECTION_ORDER;
}

/** The reference page's schemes, overridden only by an organisation's saved choice. */
export const DEFAULT_SCHEMES: Record<CampaignEditableSection, CampaignColourScheme> = {
  need: "cream", programme: "ink", outcomes: "yellow", team: "cream", money: "white", wall: "red",
};

const SCHEME_CLASS: Record<CampaignColourScheme, string> = {
  cream: "rc-t-cream rc-s rc-s-light",
  white: "rc-t-paper rc-s rc-s-light",
  yellow: "rc-on-hi rc-s rc-s-light rc-s-yellow",
  ink: "rc-on-dark rc-s rc-s-dark",
  red: "rc-s rc-s-dark rc-s-red",
};

/** Scoped section class: the saved scheme, else the section's existing class untouched. */
export function schemeSectionClass(scheme: CampaignColourScheme | null | undefined, fallback: string) {
  return scheme && SCHEME_CLASS[scheme] ? SCHEME_CLASS[scheme] : fallback;
}
