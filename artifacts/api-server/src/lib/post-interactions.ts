import { createHash } from "node:crypto";
import type { PostActivity, PostViewerAuthor, PostViewerRecord } from "@workspace/api-zod";
import { fsGet, fsPatch, fsQuery, fsDelete, fsCreateIfAbsent } from "./firebase-rest.js";
import { canSeePost, PostError, POSTS, MEDIA } from "./supporter-posts.js";

type Doc = Record<string, any>;
export const INTERACTIONS = "post_interactions";
const ID = /^[A-Za-z0-9_-]{1,180}$/;
const keyOf = (...parts: string[]) => createHash("sha256").update(JSON.stringify(parts)).digest("base64url");
const mediaUrl = (v: unknown): v is string => typeof v === "string" && (/^https?:\/\//.test(v) || v.startsWith("/api/"));
const isVideo = (url: string) => /\.(mp4|mov|webm|m4v|ogv)(?:[?#]|$)/i.test(url);
export interface InteractionStore {
  get: (collection: string, id: string, token: string) => Promise<Doc | null>;
  put: (collection: string, id: string, doc: Doc, token: string) => Promise<void>;
  create: (collection: string, id: string, doc: Doc, token: string) => Promise<boolean>;
  remove: (collection: string, id: string, token: string) => Promise<void>;
  query: (postKey: string, token: string) => Promise<Doc[]>;
}
const realStore: InteractionStore = {
  get: fsGet, put: fsPatch, create: fsCreateIfAbsent, remove: fsDelete,
  query: (postKey, token) => fsQuery(INTERACTIONS, [{ field: "postKey", op: "EQUAL", value: postKey }], token),
};

/** Every operation rechecks source visibility. A saved URL or a reaction is
 * never a grant to a removed post or an owner-only supporter profile. */
export function createPostInteractions(store: InteractionStore = realStore) {
  function ref(kind: string, id: string) {
    if (!["update", "post"].includes(kind) || !ID.test(id)) throw new PostError(400);
    return `${kind}:${id}`;
  }

  async function visible(kind: string, id: string, viewer: string | null, token: string): Promise<{ record: PostViewerRecord; legacyLikes: number }> {
    ref(kind, id);
    if (kind === "update") {
      const post = await store.get("updates", id, token);
      if (!post || ["deleted", "archived", "draft"].includes(String(post.status)) || post.removed === true || post.published === false) throw new PostError(404);
      const org = await store.get("organisations", String(post.orgId), token);
      if (!org || org.deletedAt) throw new PostError(404);
      const urls = [...new Set([...(Array.isArray(post.mediaUrls) ? post.mediaUrls : []), post.imageUrl].filter(mediaUrl))] as string[];
      return { legacyLikes: Math.max(0, Number(post.likes) || 0), record: {
        id, kind: "update", title: String(post.title || ""), caption: String(post.content || ""), createdAt: String(post.createdAt || ""),
        author: { id: String(post.orgId), name: String(org.name || "Organisation"), avatarUrl: mediaUrl(org.logo) ? org.logo : null, verified: org.verified === true,
          href: `/organisations/${encodeURIComponent(String(post.orgId))}` },
        media: urls.map(url => ({ url, type: isVideo(url) ? "video" as const : "photo" as const, thumbnailUrl: mediaUrl(post.thumbnailUrl) ? post.thumbnailUrl : null })),
        externalUrl: typeof post.externalUrl === "string" && /^https?:\/\//.test(post.externalUrl) ? post.externalUrl : null,
      } };
    }
    const post = await store.get(POSTS, id, token);
    if (!post) throw new PostError(404);
    const author = await store.get("users", String(post.author_id), token);
    if (!canSeePost(post, author, viewer)) throw new PostError(404);
    const profile = author!.publicProfile ?? {};
    const media = await Promise.all((Array.isArray(post.media_ids) ? post.media_ids : []).map((mid: string) => store.get(MEDIA, mid, token)));
    if (media.some(m => !m || m.post_id !== post.id || m.author_id !== post.author_id || !mediaUrl(m.url))) throw new PostError(503);
    return { legacyLikes: 0, record: {
      id, kind: "post", title: "", caption: String(post.caption || ""), createdAt: String(post.created_at || ""),
      author: { id: String(post.author_id), name: String(profile.displayName || author!.name || "Supporter"), avatarUrl: mediaUrl(author!.avatarUrl) ? author!.avatarUrl : null,
        verified: false, href: profile.enabled && profile.publicId ? `/supporters/${encodeURIComponent(profile.publicId)}` : null },
      media: media.sort((a, b) => Number(a!.order) - Number(b!.order)).map(m => ({
        url: m!.url, type: m!.type === "video" ? "video" as const : "photo" as const,
        thumbnailUrl: mediaUrl(m!.video_thumbnail_url) ? m!.video_thumbnail_url : null,
        ...(m!.crop && typeof m!.crop === "object" ? { crop: m!.crop } : {}),
        ...(typeof m!.filter === "string" ? { filter: m!.filter } : {}),
        ...(m!.adjustments && typeof m!.adjustments === "object" ? { adjustments: m!.adjustments } : {}),
        width: typeof m!.width === "number" ? m!.width : null, height: typeof m!.height === "number" ? m!.height : null,
      })), externalUrl: null,
    } };
  }

  async function actor(uid: string, token: string): Promise<PostViewerAuthor> {
    const user = await store.get("users", uid, token);
    if (!user || !["supporter", "organisation"].includes(user.accountType)) throw new PostError(403);
    if (user.accountType === "organisation") {
      const org = await store.get("organisations", uid, token);
      if (!org || org.deletedAt || user.approvalStatus && user.approvalStatus !== "approved") throw new PostError(403);
      return { id: uid, name: String(org.name || "Organisation"), avatarUrl: mediaUrl(org.logo) ? org.logo : null, verified: org.verified === true, href: `/organisations/${encodeURIComponent(uid)}` };
    }
    const p = user.publicProfile ?? {};
    return { id: uid, name: String(p.displayName || user.name || "Supporter"), avatarUrl: mediaUrl(user.avatarUrl) ? user.avatarUrl : null,
      verified: false, href: p.enabled && p.publicId ? `/supporters/${encodeURIComponent(p.publicId)}` : null };
  }

  async function activity(kind: string, id: string, uid: string | null, token: string): Promise<PostActivity> {
    const { legacyLikes } = await visible(kind, id, uid, token);
    const rows = await store.query(ref(kind, id), token);
    const likes = rows.filter(r => r.type === "like");
    const comments = rows.filter(r => r.type === "comment" && !r.removed).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.id).localeCompare(String(b.id)));
    return { likes: legacyLikes + likes.length, liked: !!uid && likes.some(l => l.uid === uid), commentCount: comments.length,
      comments: comments.map(c => {
        const hearts = rows.filter(r => r.type === "comment_like" && r.commentId === c.id);
        return { id: c.id, parentId: c.parentId ?? null, text: String(c.text), author: c.author, createdAt: String(c.createdAt), likes: hearts.length, liked: !!uid && hearts.some(h => h.uid === uid) };
      }),
    };
  }

  async function like(kind: string, id: string, uid: string, liked: boolean, token: string, commentId?: string): Promise<PostActivity> {
    await visible(kind, id, uid, token);
    await actor(uid, token);
    const postKey = ref(kind, id);
    if (commentId) {
      if (!ID.test(commentId)) throw new PostError(400);
      const comment = await store.get(INTERACTIONS, commentId, token);
      if (!comment || comment.type !== "comment" || comment.postKey !== postKey || comment.removed) throw new PostError(404);
    }
    const interactionId = keyOf(postKey, commentId || "", uid);
    if (liked) await store.put(INTERACTIONS, interactionId, { id: interactionId, postKey, uid, type: commentId ? "comment_like" : "like", commentId: commentId ?? null }, token);
    else await store.remove(INTERACTIONS, interactionId, token);
    return activity(kind, id, uid, token);
  }

  async function comment(kind: string, id: string, uid: string, input: { clientId: string; text: string; parentId?: string | null }, token: string): Promise<PostActivity> {
    await visible(kind, id, uid, token);
    const author = await actor(uid, token), text = input.text.trim();
    if (!text || text.length > 2000 || !/^[0-9a-f-]{36}$/i.test(input.clientId)) throw new PostError(400);
    const postKey = ref(kind, id), commentId = keyOf("comment", uid, input.clientId);
    const existing = await store.get(INTERACTIONS, commentId, token);
    if (existing) {
      if (existing.postKey !== postKey || existing.uid !== uid || existing.text !== text || (existing.parentId ?? null) !== (input.parentId ?? null)) throw new PostError(409);
      return activity(kind, id, uid, token);
    }
    if (input.parentId) {
      if (!ID.test(input.parentId)) throw new PostError(400);
      const parent = await store.get(INTERACTIONS, input.parentId, token);
      if (!parent || parent.postKey !== postKey || parent.type !== "comment" || parent.removed) throw new PostError(404);
    }
    const created = await store.create(INTERACTIONS, commentId, { id: commentId, postKey, type: "comment", uid, text, author,
      parentId: input.parentId ?? null, createdAt: new Date().toISOString() }, token);
    if (!created) {
      const duplicate = await store.get(INTERACTIONS, commentId, token);
      if (!duplicate || duplicate.postKey !== postKey || duplicate.uid !== uid || duplicate.text !== text || (duplicate.parentId ?? null) !== (input.parentId ?? null)) throw new PostError(409);
    }
    return activity(kind, id, uid, token);
  }
  return { visible, activity, like, comment };
}

export const postInteractions = createPostInteractions();
