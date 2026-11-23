import type { QueryClient } from "@tanstack/react-query";
import {
  getGetMySupporterShowcaseQueryKey,
  getMySupporterShowcase,
  getVisitorSupporterShowcase,
  saveSupporterShowcaseDetails,
  addSupporterInvolvement,
  removeSupporterInvolvement,
  type SupporterInvolvementInput,
  type SupporterProfileActivity,
  type SupporterShowcaseDetailsInput,
} from "@workspace/api-client-react";
import { SP_KEY } from "./supporter-publishing";

const bearer = (token: string): RequestInit => ({ headers: { Authorization: `Bearer ${token}` }, credentials: "include" });

/** Owner key includes the token so a different session never reads another owner's cache. */
export const myShowcaseKey = (token: string | null) => [...getGetMySupporterShowcaseQueryKey(), token ?? null] as const;
/** Public projection: deliberately anonymous; same key whether the viewer is signed in or not. */
export const visitorShowcaseKey = (publicId: string) => ["supporter-showcase-public", publicId] as const;

export const fetchMyShowcase = (token: string) => getMySupporterShowcase(bearer(token));
/** Never sends Authorization: Preview must see exactly what a stranger sees. */
export const fetchVisitorShowcase = (publicId: string) => getVisitorSupporterShowcase(publicId, { credentials: "omit" });
export const saveShowcaseDetails = (body: SupporterShowcaseDetailsInput, token: string) => saveSupporterShowcaseDetails(body, bearer(token));
export const addInvolvement = (body: SupporterInvolvementInput, token: string) => addSupporterInvolvement(body, bearer(token));
export const removeInvolvement = (id: string, token: string) => removeSupporterInvolvement(id, bearer(token));

export function refreshShowcase(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: getGetMySupporterShowcaseQueryKey() });
  void qc.invalidateQueries({ queryKey: ["supporter-showcase-public"] });
  void qc.invalidateQueries({ queryKey: [SP_KEY] });
}

export const MANUAL_LIMIT = 100;

export const newEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export interface InvolvementGroup {
  key: string;
  organisationId: string | null;
  name: string;
  logo: string | null;
  sector: string | null;
  location: string | null;
  items: SupporterProfileActivity[];
}

/** Explicit organisation link wins; otherwise entries share a group by normalised project name. */
export function groupInvolvement(items: SupporterProfileActivity[]): InvolvementGroup[] {
  const map = new Map<string, InvolvementGroup>();
  for (const it of items) {
    const key = it.organisationId ? `o:${it.organisationId}` : `p:${norm(it.projectName)}`;
    let g = map.get(key);
    if (!g) {
      g = { key, organisationId: it.organisationId, name: it.projectName, logo: it.logo, sector: it.sector, location: it.location, items: [] };
      map.set(key, g);
    }
    g.logo ??= it.logo; g.sector ??= it.sector; g.location ??= it.location;
    g.items.push(it);
  }
  return [...map.values()];
}

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("") || "?";

/** Real ISO dates become "4 Nov 2026"; approximate text like "Summer 2025" is kept exactly. */
export function formatWhen(when: string): string {
  const t = when.trim();
  if (!/^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(t)) return when;
  const d = new Date(t.length === 10 ? `${t}T00:00:00Z` : t);
  if (Number.isNaN(d.getTime())) return when;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: t.length === 10 ? "UTC" : undefined });
}
