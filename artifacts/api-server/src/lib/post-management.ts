import type { ManageOwnPostInput, OwnerPostDetails } from "@workspace/api-zod";
import { fsGet, fsPatch, fsQuery, fsMutateSupporterShowcase } from "./firebase-rest.js";
import { PostError, POSTS, MEDIA } from "./supporter-posts.js";
import { pinnedPostKeys } from "./post-metadata.js";

type Doc = Record<string, any>;
const valid = /^[A-Za-z0-9_-]{1,180}$/;
const imageUrl = (v: unknown): v is string => typeof v === "string" && /^(https:\/\/|\/api\/)/.test(v);
const video = (v: string) => /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(v);
interface Store {
  get: (collection: string, id: string, token: string) => Promise<Doc | null>;
  put: (collection: string, id: string, patch: Doc, token: string) => Promise<void>;
  query: (collection: string, filters: { field: string; op: "EQUAL"; value: string }[], token: string) => Promise<Doc[]>;
  mutate: (uid: string, token: string, decide: (user: Doc) => Doc) => Promise<void>;
}
const defaults: Store = { get: fsGet, put: fsPatch, query: fsQuery, mutate: fsMutateSupporterShowcase };

export function createPostManagement(store = defaults) {
  async function owned(kind: string, id: string, uid: string, token: string) {
    if (!["post", "update"].includes(kind) || !valid.test(id)) throw new PostError(400);
    const collection = kind === "post" ? POSTS : "updates";
    const post = await store.get(collection, id, token);
    if (!post || post.removed || post.status === "deleted") throw new PostError(404);
    if ((kind === "post" ? post.author_id : post.orgId) !== uid) throw new PostError(403);
    const user = await store.get("users", uid, token);
    if (!user || user.deleted || user.deletedAt || user.accountType !== (kind === "post" ? "supporter" : "organisation")) throw new PostError(403);
    const org = kind === "update" ? await store.get("organisations", uid, token) : null;
    if (kind === "update" && (!org || org.deletedAt || user.approvalStatus && user.approvalStatus !== "approved")) throw new PostError(403);
    return { post, user, org, collection };
  }
  async function details(kind: string, id: string, uid: string, token: string): Promise<OwnerPostDetails> {
    const { post, user, org } = await owned(kind, id, uid, token);
    const profile = user.publicProfile ?? {};
    const urls = [...new Set((Array.isArray(post.mediaUrls) ? post.mediaUrls : []).filter(imageUrl))] as string[];
    if (imageUrl(post.imageUrl) && !urls.includes(post.imageUrl)) urls.unshift(post.imageUrl);
    const media = kind === "update" ? urls.map(url => ({ url, type: video(url) ? "video" as const : "photo" as const, thumbnailUrl: post.coverUrl || post.thumbnailUrl || null }))
      : (await Promise.all((post.media_ids ?? []).map((mid: string) => store.get(MEDIA, mid, token))))
        .filter((m): m is Doc => !!m && m.post_id === id && m.author_id === uid)
        .sort((a, b) => Number(a.order) - Number(b.order))
        .map(m => ({ url: String(m.url), type: m.type === "video" ? "video" as const : "photo" as const, thumbnailUrl: post.coverUrl || m.video_thumbnail_url || null }));
    return {
      id, kind: kind as "post" | "update", caption: String(kind === "post" ? post.caption || "" : post.content || ""),
      communityTag: post.community_tag ?? null, campaignId: (kind === "post" ? post.campaign_id : post.campaignId) ?? null,
      status: post.status === "archived" ? "archived" : "published",
      pinned: pinnedPostKeys(user).includes(`${kind}:${id}`), commentsDisabled: post.commentsDisabled === true,
      hideLikeCount: post.hideLikeCount === true, coverUrl: post.coverUrl || post.thumbnailUrl || media.find(m => m.type === "video")?.thumbnailUrl || null,
      editedAt: post.edited_at || post.editedAt || null, media,
      author: { id: uid, name: String(org?.name || profile.displayName || user.name || "Supporter"),
        avatarUrl: org?.logo || user.avatarUrl || null, verified: org?.verified === true,
        href: org ? `/organisations/${uid}` : profile.enabled && profile.publicId ? `/supporters/${profile.publicId}` : null },
      campaigns: (Array.isArray(org?.campaigns) ? org.campaigns : [])
        .filter((c: Doc) => !c.removed && c.status !== "deleted")
        .map((c: Doc) => ({ id: String(c._id || c.id || c.publicId), name: String(c.name || "Campaign") })),
    };
  }
  async function change(kind: string, id: string, uid: string, input: ManageOwnPostInput, token: string) {
    const { post, user, org, collection } = await owned(kind, id, uid, token);
    const beforeDelete = input.status === "deleted" ? await details(kind, id, uid, token) : null;
    if (!Object.keys(input).length) throw new PostError(400);
    if (input.campaignId && (kind !== "update" || !(org?.campaigns ?? []).some((c: Doc) =>
      [c._id, c.id, c.publicId].includes(input.campaignId) && !c.removed && c.status !== "deleted"))) throw new PostError(400);
    if (kind === "post" && input.campaignId != null) throw new PostError(400);
    const patch: Doc = {};
    if (input.caption !== undefined) {
      if (input.caption.length > 2200) throw new PostError(400);
      patch[kind === "post" ? "caption" : "content"] = input.caption;
    }
    if (input.communityTag !== undefined) patch.community_tag = input.communityTag;
    if (input.campaignId !== undefined && kind === "update") patch.campaignId = input.campaignId;
    for (const key of ["commentsDisabled", "hideLikeCount", "status"] as const)
      if (input[key] !== undefined) patch[key] = input[key];
    if (input.status !== undefined) patch.statusChangedAt = new Date().toISOString();
    if (input.status === "deleted") { patch.removed = true; patch.removed_at = new Date().toISOString(); }
    if (input.coverMediaId !== undefined) {
      const cover = await store.get(MEDIA, input.coverMediaId, token);
      if (!cover || cover.author_id !== uid || cover.type !== "photo" || cover.state !== "ready" ||
        cover.post_id && (cover.post_id !== id || (cover.post_kind ?? "post") !== kind) ||
        !(Number(cover.width) >= 1080 && Number(cover.height) >= 1350)) throw new PostError(400);
      const source = kind === "update" ? [...(post.mediaUrls ?? []), post.imageUrl].filter(Boolean) : await Promise.all((post.media_ids ?? []).map((mid: string) => store.get(MEDIA, mid, token)));
      if (!source.some((m: any) => kind === "update" ? video(String(m)) : m?.type === "video")) throw new PostError(400);
      await store.put(MEDIA, input.coverMediaId, { post_id: id, post_kind: kind }, token);
      patch.cover_media_id = input.coverMediaId;
      patch.coverUrl = `/api/supporter-posts/media/${input.coverMediaId}`;
    }
    if (["caption", "communityTag", "campaignId"].some(k => Object.hasOwn(input, k))) patch[kind === "post" ? "edited_at" : "editedAt"] = new Date().toISOString();
    if (input.pinned !== undefined || input.status === "archived" || input.status === "deleted") {
      const key = `${kind}:${id}`;
      await store.mutate(uid, token, fresh => {
        if (fresh.accountType !== user.accountType) throw new PostError(403);
        const old = pinnedPostKeys(fresh), pin = input.pinned === true && !["archived", "deleted"].includes(input.status ?? post.status);
        const keys = old.filter(k => k !== key);
        if (pin && keys.length >= 3) throw new PostError(409, "You can pin up to 3 posts. Unpin one first.");
        return { ...(fresh.profileShowcase ?? {}), pinnedPosts: pin ? [key, ...keys] : keys };
      });
    }
    if (Object.keys(patch).length) await store.put(collection, id, patch, token);
    if (beforeDelete) return { ...beforeDelete, status: "deleted" as const, pinned: false };
    return details(kind, id, uid, token);
  }
  async function archived(uid: string, token: string) {
    const user = await store.get("users", uid, token);
    if (!user || !["supporter", "organisation"].includes(user.accountType)) throw new PostError(403);
    const kind = user.accountType === "organisation" ? "update" : "post";
    const rows = await store.query(kind === "update" ? "updates" : POSTS, [{ field: kind === "update" ? "orgId" : "author_id", op: "EQUAL", value: uid }], token);
    const own = rows.filter(p => p.status === "archived" && !p.removed && (kind === "update" ? p.orgId : p.author_id) === uid)
      .sort((a, b) => String(b.createdAt || b.created_at).localeCompare(String(a.createdAt || a.created_at)));
    return Promise.all(own.map(p => details(kind, String(p._id || p.id), uid, token)));
  }
  return { details, change, archived };
}
export const postManagement = createPostManagement();
