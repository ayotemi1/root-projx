import { SaveSupporterInterestsBody } from "@workspace/api-zod";
import { fsQuery } from "./firebase-rest.js";
import { PostError } from "./supporter-posts.js";

export type TagKind = "community" | "cause" | "place" | "organisation";
export type PostTag = { type: TagKind; value: string; label: string; description?: string | null };
type Doc = Record<string, any>;
export const normaliseTag = (value: unknown) => String(value ?? "").trim().toLowerCase();
const COMMUNITIES: PostTag[] = [
  { type: "community", value: "volunteers", label: "Volunteers", description: "People who give their time" },
  { type: "community", value: "donors", label: "Donors", description: "People who give money" },
  { type: "community", value: "fundraisers", label: "Fundraisers", description: "People raising money for causes" },
  { type: "community", value: "visitors", label: "Visitors", description: "People who’ve been to see projects" },
  { type: "community", value: "diaspora", label: "Diaspora", description: "People connecting with communities across borders" },
];

export async function postTagOptions(uid: string, token: string): Promise<PostTag[]> {
  const [organisations, follows] = await Promise.all([
    fsQuery("organisations", [], token),
    fsQuery("follows", [{ field: "userId", op: "EQUAL", value: uid }], token),
  ]);
  const followed = new Set(follows.map(f => String(f.orgId)));
  const visible = organisations.filter(o => !o.deletedAt && typeof o.name === "string" && o.name.trim());
  const places = new Map<string, string>();
  for (const org of visible) for (const field of ["country", "location"]) {
    const label = typeof org[field] === "string" ? org[field].trim() : "";
    if (label && label.length <= 160) places.set(normaliseTag(label), label);
  }
  return [
    ...COMMUNITIES,
    ...SaveSupporterInterestsBody.shape.interests.element.options.map(value => ({
      type: "cause" as const, value, label: value,
    })),
    ...[...places].sort(([, a], [, b]) => a.localeCompare(b)).map(([value, label]) => ({
      type: "place" as const, value, label,
    })),
    ...visible.filter(o => followed.has(String(o._id))).sort((a, b) => String(a.name).localeCompare(String(b.name))).map(o => ({
      type: "organisation" as const, value: String(o._id), label: String(o.name),
    })),
  ];
}

export async function resolvePostTag(input: { type: TagKind; value: string } | null | undefined, uid: string, token: string) {
  if (!input) return null;
  const options = await postTagOptions(uid, token);
  const tag = options.find(t => t.type === input.type && t.value === input.value);
  if (!tag) throw new PostError(400);
  // Labels come from trusted data, not the caller's arbitrary display text.
  return tag;
}

export type PostAudience = { places: string[]; organisations: string[]; communities: string[] };
export function matchesStructuredTag(tag: unknown, interests: string[], audience: PostAudience) {
  if (!tag || typeof tag !== "object" || !("type" in tag) || !("value" in tag) || typeof tag.value !== "string") return false;
  const value = normaliseTag(tag.value);
  const includes = (list: string[]) => list.some(v => normaliseTag(v) === value);
  if (tag.type === "cause") return !interests.length || includes(interests);
  if (tag.type === "place") return includes(audience.places);
  if (tag.type === "organisation") return audience.organisations.includes(tag.value);
  if (tag.type === "community") return includes(audience.communities);
  return false;
}

/** Past tag choices are recommendation signals, never group membership. */
export function communityChoices(posts: Doc[]) {
  return [...new Set(posts.filter(p => !p.removed && p.tag?.type === "community")
    .map(p => String(p.tag.value)))];
}
