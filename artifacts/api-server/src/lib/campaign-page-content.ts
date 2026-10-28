/** Optional editorial copy. No financial totals, HTML or executable content. */
export const CAMPAIGN_PAGE_COPY_FIELDS = [
  "storyHeading", "programmeHeading", "programmeIntro", "programmeSummary",
  "programmeAfterword", "outcomesIntro", "outcomesNote", "outcomesStatus",
  "supportHeading", "supportBody", "cohortHeading", "cohortBody", "cohortNote",
  "fundingNote", "organisationNote", "supportersHeading", "shareHeading",
  "shareBody", "donateLabel",
] as const;

export function campaignPageContent(value: unknown): Record<string, string> | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Enter valid campaign page copy.");
  }
  const result: Record<string, string> = {};
  for (const [key, text] of Object.entries(value)) {
    if (!(CAMPAIGN_PAGE_COPY_FIELDS as readonly string[]).includes(key)) {
      throw new Error(`Unknown campaign page copy field: ${key}.`);
    }
    if (typeof text !== "string" || text.length > 5000 || /<\/?[a-z][^>]*>/i.test(text)) {
      throw new Error("Campaign page copy must be plain text of 5000 characters or fewer per section.");
    }
    result[key] = text;
  }
  return result;
}
