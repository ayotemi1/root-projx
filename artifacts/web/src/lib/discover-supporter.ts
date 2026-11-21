import type { Org } from "./api";
import { orgSectors } from "./sectors";

export type DiscoverFilters = { search: string; country: string; cause: string };
export type DiscoverSignals = {
  interests: readonly string[];
  followedOrgs: readonly Org[];
  supportedOrgIds: readonly string[];
  supportedOrgs?: readonly Org[];
};

const normal = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function uniqueOrgs(orgs: readonly Org[]): Org[] {
  const seen = new Set<string>();
  return orgs.filter(org => {
    if (!org._id || !org.name?.trim() || seen.has(org._id)) return false;
    seen.add(org._id);
    return true;
  });
}

export function filterDiscoverOrgs(orgs: readonly Org[], filters: DiscoverFilters): Org[] {
  const search = normal(filters.search).replace(/\s+/g, " ");
  const country = normal(filters.country);
  const cause = normal(filters.cause);
  return uniqueOrgs(orgs).filter(org =>
    (!search || normal([org.name, org.city, org.country].filter(Boolean).join(" ")).includes(search)) &&
    (!country || normal(org.country ?? "") === country) &&
    (!cause || orgSectors(org).some(sector => normal(sector) === cause)));
}

export function recommendDiscoverOrgs(
  orgs: readonly Org[], signals: DiscoverSignals, limit = 3,
): { personalised: boolean; organisations: Org[] } {
  const publicOrgs = uniqueOrgs(orgs);
  const followed = new Set(signals.followedOrgs.map(org => org._id));
  const interests = new Set(signals.interests.map(normal).filter(Boolean));
  const followedSectors = new Set(signals.followedOrgs.flatMap(orgSectors).map(normal).filter(Boolean));
  const supportedIds = new Set(signals.supportedOrgIds);
  const supported = signals.supportedOrgs ?? publicOrgs.filter(org => supportedIds.has(org._id));
  const supportedSectors = new Set(supported.flatMap(orgSectors).map(normal).filter(Boolean));
  const personalised = interests.size > 0 || followedSectors.size > 0 || supportedIds.size > 0;
  const score = (org: Org) => orgSectors(org).reduce((sum, sector) => {
    const key = normal(sector);
    return sum + (interests.has(key) ? 4 : 0) + (followedSectors.has(key) ? 2 : 0) + (supportedSectors.has(key) ? 1 : 0);
  }, supportedIds.has(org._id) ? 1 : 0);
  const organisations = publicOrgs.filter(org => !followed.has(org._id))
    .map((org, index) => ({ org, index, score: score(org) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit)).map(entry => entry.org);
  return { personalised, organisations };
}

/** Never infer a pin from country/city or invent jitter around a country centre.
 * Public profiles without a saved coordinate remain visible in the directory. */
export function mappedOrgPosition(org: Org): [number, number] | null {
  const record = org as unknown as Record<string, unknown>;
  const candidates = [record, record.location, record.coordinates];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const obj = candidate as Record<string, unknown>;
    const lat = obj.latitude ?? obj.lat;
    const lng = obj.longitude ?? obj.lng;
    if (typeof lat === "number" && typeof lng === "number" &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lat, lng];
  }
  return null;
}

/** Organisation-wide totalRaised is the canonical GBP accounting aggregate,
 * even when some campaigns charge in USD. Do not relabel it using country. */
export function discoverRaisedLabel(org: Org): string | null {
  if (typeof org.totalRaised !== "number" || !Number.isFinite(org.totalRaised) || org.totalRaised < 0) return null;
  return `${new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(org.totalRaised)} GBP`;
}
