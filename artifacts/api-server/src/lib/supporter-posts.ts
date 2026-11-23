import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { fsGet, fsQuery, getServerToken } from "./firebase-rest.js";

export const POST_ERROR = "Something went wrong, please try again";
export const POSTS = "supporter_posts";
export const MEDIA = "supporter_post_media";
export const FOLLOWERS = "supporter_follows";
export const DEFAULT_CROP = { aspect: "original", zoom: 1, x: 0, y: 0 };
export const DEFAULT_ADJUSTMENTS = { brightness: 1, contrast: 1, saturation: 1 };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COOKIE = "rp_post_media";
const COOKIE_PATH = "/api/supporter-posts/media";
type Doc = Record<string, any>;
function mediaCookieOptions(req: Request) {
  const secure = req.secure || req.get("x-forwarded-proto") === "https";
  return {
    path: COOKIE_PATH, httpOnly: true, secure,
    // Partitioned cookies also work inside the embedded HTTPS Preview without
    // allowing one top-level site's media session to be reused by another.
    sameSite: secure ? "none" as const : "lax" as const, partitioned: secure,
  };
}

export class PostError extends Error {
  constructor(public status: number, message = POST_ERROR) { super(message); }
}

export const fingerprint = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");

// Separate, read-only media credential, not the Firebase token. Scoped to media
// GETs and HttpOnly so <img>/<video> can request private byte ranges without
// putting credentials in URLs or buffering a 500 MB video in browser memory.
// An explicit identity is allowed only from a Firebase-verified sign-in result,
// never a UID or role supplied by an HTTP caller.
export function setMediaSession(req: Request, res: Response,
  identity: { userId: string; accountType: string; actingUserId?: string } | undefined = req.user) {
  if (!identity || !["supporter", "organisation"].includes(identity.accountType)) return;
  const key = process.env.SESSION_SECRET;
  if (!key) throw new PostError(503);
  // A manager's media permission must be rechecked against their real identity,
  // not retained as an owner cookie after their team grant is revoked.
  const value = Buffer.from(JSON.stringify({ uid: identity.actingUserId ?? identity.userId, exp: Date.now() + 3600_000 })).toString("base64url");
  const signature = createHmac("sha256", key).update(value).digest("base64url");
  res.cookie(COOKIE, `${value}.${signature}`, { ...mediaCookieOptions(req), maxAge: 3600_000 });
}
export function clearMediaSession(req: Request, res: Response) {
  res.clearCookie(COOKIE, mediaCookieOptions(req));
}
export function mediaViewer(req: Request): string | null {
  if (req.user && ["supporter", "organisation"].includes(req.user.accountType)) return req.user.userId;
  const cookie = req.headers.cookie?.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!cookie || cookie.length > 1500 || !process.env.SESSION_SECRET) return null;
  try {
    const [value, signature] = cookie.split(".");
    if (!value || !signature) return null;
    const supplied = Buffer.from(signature, "base64url");
    const expected = createHmac("sha256", process.env.SESSION_SECRET).update(value).digest();
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const payload = JSON.parse(Buffer.from(value, "base64url").toString());
    return typeof payload.uid === "string" && payload.exp > Date.now() ? payload.uid : null;
  } catch { return null; }
}
export function canSeePost(post: Doc, author: Doc | null, viewer?: string | null) {
  return !post.removed && author?.accountType === "supporter" &&
    (post.author_id === viewer || author.publicProfile?.enabled === true);
}
export function matchesPostInterests(post: Doc, interests: string[], organisation: Doc | null) {
  if (!interests.length) return true;
  const normalise = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const tags = [post.community_tag, organisation?.category,
    ...(Array.isArray(organisation?.sectors) ? organisation.sectors : []),
    ...(Array.isArray(organisation?.categories) ? organisation.categories : [])].filter(Boolean).map(normalise);
  return interests.some(s => tags.includes(normalise(s)));
}
export function mediaDto(media: Doc) {
  return {
    id: media.id, post_id: media.post_id ?? null, url: media.url, type: media.type,
    order: media.order ?? 0, crop: media.crop ?? DEFAULT_CROP, filter: media.filter ?? "original",
    adjustments: media.adjustments ?? DEFAULT_ADJUSTMENTS,
    width: media.width, height: media.height, duration: media.duration ?? null,
    video_thumbnail_url: media.video_thumbnail_url ?? null,
  };
}
export async function postDto(post: Doc, viewer: string | null, token: string, author?: Doc) {
  author ??= await fsGet("users", post.author_id, token) as Doc;
  const pp = author?.publicProfile ?? {};
  const name = pp.displayName || author?.name || "Supporter";
  const following = !!viewer && viewer !== post.author_id &&
    !!await fsGet(FOLLOWERS, `${viewer}_${post.author_id}`, token);
  const media = await Promise.all((post.media_ids ?? []).map((id: string) => fsGet(MEDIA, id, token)));
  if (media.some(m => !m || m.post_id !== post.id || m.author_id !== post.author_id)) throw new PostError(503);
  return {
    id: post.id, type: post.type, caption: post.caption, community_tag: post.community_tag ?? null,
    tag: post.tag && typeof post.tag === "object" ? {
      type: post.tag.type, value: post.tag.value, label: post.tag.label,
      description: typeof post.tag.description === "string" ? post.tag.description : null,
    } : null,
    organisation_id: post.organisation_id ?? null, campaign_id: post.campaign_id ?? null,
    created_at: post.created_at, edited_at: post.edited_at ?? null, removed: !!post.removed,
    visibility: pp.enabled === true ? "public" : "private",
    author: {
      avatarUrl: typeof author?.avatarUrl === "string" ? author.avatarUrl : null,
      name, initials: String(name).split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase(),
      publicId: pp.enabled === true ? pp.publicId ?? null : null,
      isOwner: post.author_id === viewer, following,
    },
    media: media.filter(Boolean).map(m => mediaDto(m!)).sort((a, b) => Number(a.order) - Number(b.order)),
  };
}
export async function publicSupporter(publicId: string, token?: string): Promise<Doc | null> {
  if (!/^sp_[a-f0-9]{32}$/.test(publicId)) return null;
  const rows = await fsQuery("users", [{ field: "publicProfile.publicId", op: "EQUAL", value: publicId }], token ?? await getServerToken());
  return rows.find(u => u.accountType === "supporter" && (u.publicProfile as Doc)?.enabled === true) ?? null;
}
