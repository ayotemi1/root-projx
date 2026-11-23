import { createHash } from "node:crypto";
import { fsGet, fsMutateSupporterShowcase } from "./firebase-rest.js";
import { canSeePost, postDto, POSTS, PostError } from "./supporter-posts.js";
import { isCampaignPublished } from "./campaign-publication.js";
import { campaignSharePath } from "./campaign-links.js";
import { SaveBookmarkBody, type BookmarkInput, type BookmarkView } from "@workspace/api-zod";

type Doc = Record<string, any>;
type Reference = BookmarkInput & { id: string; createdAt: string };
export const bookmarkId = (r: BookmarkInput) => createHash("sha256")
  .update(JSON.stringify([r.kind, r.targetId, r.kind === "campaign" ? r.orgId : null])).digest("base64url");
export const bookmarkReferences = (user: Doc): Reference[] => {
  const rows = Array.isArray(user.profileShowcase?.bookmarks) ? user.profileShowcase.bookmarks : [];
  return rows.slice(0, 1000).flatMap((r: any) => {
    if (!r || typeof r !== "object") return [];
    const parsed = SaveBookmarkBody.safeParse({ kind: r.kind, targetId: r.targetId,
      ...(r.kind === "campaign" ? { orgId: r.orgId } : {}) });
    if (!parsed.success || parsed.data.kind === "campaign" && !parsed.data.orgId ||
        r.id !== bookmarkId(parsed.data) || typeof r.createdAt !== "string" ||
        r.createdAt.length > 40 || !Number.isFinite(Date.parse(r.createdAt))) return [];
    return [{ ...parsed.data, id: r.id, createdAt: r.createdAt }];
  });
};
const safeImage = (url: unknown): string | null => typeof url === "string" &&
  /^(https?:\/\/|\/api\/)/.test(url) ? url : null;
const video = (url: string) => /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(url);

/** All metadata is resolved again. A bookmark is not permission to content,
 * nor a durable copy of someone's private caption or media URL. */
export async function resolveBookmark(ref: Reference, uid: string, token: string): Promise<BookmarkView> {
  const empty: BookmarkView = {
    id: ref.id, kind: ref.kind, targetId: ref.targetId, orgId: ref.orgId ?? null,
    createdAt: ref.createdAt, available: false, title: "", authorName: "",
    imageUrl: null, isVideo: false, href: null,
  };
  if (ref.kind === "post") {
    const post = await fsGet(POSTS, ref.targetId, token);
    if (!post) return empty;
    const author = await fsGet("users", String(post.author_id), token);
    if (!canSeePost(post, author, uid)) return empty;
    const dto = await postDto(post, uid, token, author!);
    const lead = dto.media[0];
    return { ...empty, available: true, title: dto.caption, authorName: dto.author.name,
      imageUrl: lead ? safeImage(lead.type === "video" ? lead.video_thumbnail_url : lead.url) : null,
      videoUrl: lead?.type === "video" && !lead.video_thumbnail_url ? safeImage(lead.url) : null,
      isVideo: lead?.type === "video",
      href: post.author_id === uid ? `/profile?post=${encodeURIComponent(ref.targetId)}` :
        `/supporters/${encodeURIComponent(String(dto.author.publicId))}?post=${encodeURIComponent(ref.targetId)}` };
  }
  if (ref.kind === "update") {
    const update = await fsGet("updates", ref.targetId, token);
    if (!update || ["deleted", "archived"].includes(String(update.status))) return empty;
    const org = await fsGet("organisations", String(update.orgId), token);
    if (!org) return empty;
    const media = Array.isArray(update.mediaUrls) ? update.mediaUrls : [];
    const lead = safeImage(media[0]);
    return { ...empty, available: true, title: String(update.content || update.title || ""),
      authorName: String(org.name || "Organisation"), imageUrl: lead && !video(lead) ? lead : safeImage(update.thumbnailUrl),
      videoUrl: lead && video(lead) && !safeImage(update.thumbnailUrl) ? lead : null,
      isVideo: !!lead && video(lead), href: `/feed?post=${encodeURIComponent(ref.targetId)}` };
  }
  const org = ref.orgId ? await fsGet("organisations", ref.orgId, token) : null;
  const campaign = (Array.isArray(org?.campaigns) ? org.campaigns : []).find((c: Doc) =>
    (c._id === ref.targetId || c.id === ref.targetId || c.publicId === ref.targetId) && isCampaignPublished(c));
  if (!org || !campaign) return empty;
  const path = campaignSharePath({ ...org, _id: ref.orgId }, campaign);
  return { ...empty, available: true, title: String(campaign.name || "Campaign"),
    authorName: String(org.name || "Organisation"), imageUrl: safeImage(campaign.imageUrl), isVideo: false,
    href: path.sharePath.replace(/^\/campaigns\//, "/campaign/") };
}

export async function saveReference(uid: string, input: BookmarkInput, token: string) {
  if (input.kind === "campaign" && !input.orgId) throw new PostError(400);
  // An update's organisation is authoritative on the update, not the caller.
  if (input.kind !== "campaign") input = { kind: input.kind, targetId: input.targetId };
  const ref = { ...input, id: bookmarkId(input), createdAt: new Date().toISOString() };
  const view = await resolveBookmark(ref, uid, token);
  if (!view.available) throw new PostError(404);
  let saved = ref;
  await fsMutateSupporterShowcase(uid, token, user => {
    if (user.accountType !== "supporter") throw new PostError(403);
    const list = bookmarkReferences(user);
    const old = list.find(b => b.id === ref.id);
    if (old) saved = old;
    else if (list.length >= 1000) throw new PostError(400, "You can keep up to 1,000 saved items. Remove one before saving another.");
    return { ...(user.profileShowcase ?? {}), bookmarks: old ? list : [ref, ...list] };
  });
  return { ...view, createdAt: saved.createdAt };
}
