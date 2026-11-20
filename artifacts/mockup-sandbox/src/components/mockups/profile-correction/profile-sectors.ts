/** Application sector list, shared with onboarding. Stored in Org.categories; Org.category = first. */
export const SECTORS = [
  "Education",
  "Health & Wellbeing",
  "Environment",
  "Community Development",
  "Arts & Culture",
  "Economic Empowerment",
  "Youth",
  "Sport & Recreation",
  "Housing & Homelessness",
  "Disaster Relief",
  "Faith & Spirituality",
  "Other",
] as const;

/** Public profile anchors used by editor links and later walkthroughs. */
export const PROFILE_ANCHORS = {
  identity: "profile-identity",
  story: "profile-story",
  sectors: "profile-sectors",
  impact: "profile-impact",
  funds: "profile-funds",
  contact: "profile-contact",
  team: "profile-team",
} as const;

export type ProfileSection = keyof typeof PROFILE_ANCHORS;

export function orgSectors(org: { categories?: string[] | null; category?: string | null }): string[] {
  if (org.categories && org.categories.length > 0) return org.categories;
  return org.category ? [org.category] : [];
}
