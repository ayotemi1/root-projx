/** Shared canonical link calculation for public campaign pages and Saved.
 * Private editorDraft fields must never be used to build public destinations. */
function slugifyPublicName(value: unknown, fallback: string): string {
  const slug = String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return slug || fallback;
}
export function campaignSharePath(
  org: Record<string, unknown>, campaign: Record<string, unknown>,
): { organisationSlug: string; campaignSlug: string; sharePath: string } {
  const orgId = String(org["_id"] ?? "").slice(-6).toLowerCase();
  const campaignId = String(campaign["_id"] ?? campaign["publicId"] ?? "").slice(-6).toLowerCase();
  const os = typeof campaign.organisationSlug === "string" ? campaign.organisationSlug : "";
  const cs = typeof campaign.campaignSlug === "string" ? campaign.campaignSlug : "";
  const organisationSlug = os && orgId && os.endsWith(`-${orgId}`) ? os : `${slugifyPublicName(org.name, "organisation")}-${orgId}`;
  const campaignSlug = cs && campaignId && cs.endsWith(`-${campaignId}`) ? cs : `${slugifyPublicName(campaign.name, "campaign")}-${campaignId}`;
  return { organisationSlug, campaignSlug, sharePath: `/campaigns/${organisationSlug}/${campaignSlug}` };
}
