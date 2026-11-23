import { createHash } from "node:crypto";
import type { SupporterNotification } from "@workspace/api-zod";
import { fsQuery } from "./firebase-rest.js";
import { INTERACTIONS, postInteractions } from "./post-interactions.js";

type Event = Record<string, any>;
const defaults = {
  query: (uid: string, token: string) => fsQuery(INTERACTIONS, [{ field: "recipientId", op: "EQUAL", value: uid }], token),
  visible: postInteractions.visible,
};

/** Only recorded, timestamped events for this recipient; source visibility is
 * checked again so removed/private posts never become notification backdoors. */
export async function interactionNotifications(uid: string, token: string, reads: Set<unknown>,
  deps = defaults): Promise<SupporterNotification[]> {
  const rows = (await deps.query(uid, token) as Event[]).filter(e =>
    e.recipientId === uid && e.uid !== uid && !e.removed && ["like", "comment"].includes(e.type) &&
    typeof e.id === "string" && typeof e.createdAt === "string" && Number.isFinite(Date.parse(e.createdAt)) &&
    typeof e.author?.name === "string" && e.author.id === e.uid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  const items: SupporterNotification[] = [];
  for (let start = 0; start < rows.length; start += 8) {
    await Promise.all(rows.slice(start, start + 8).map(async event => {
      const match = /^(post|update):([A-Za-z0-9_-]{1,180})$/.exec(String(event.postKey));
      if (!match) return;
      let target;
      try { target = await deps.visible(match[1]!, match[2]!, uid, token); }
      catch (e) { if ((e as { status?: number }).status === 404) return; throw e; }
      if (target.record.author.id !== uid) return;
      const type = event.type as "like" | "comment";
      const name = event.author.name.trim().slice(0, 180) || "An account";
      const image = target.record.media.find(m => m.type === "photo" || m.thumbnailUrl);
      const avatar = typeof event.author.avatarUrl === "string" && /^(https?:\/\/|\/api\/)/.test(event.author.avatarUrl)
        ? event.author.avatarUrl : null;
      const id = `n_${createHash("sha256").update(`post_${type}/${event.id}`).digest("base64url").slice(0, 32)}`;
      items.push({ id, type, name, read: reads.has(id),
        message: type === "like" ? `${name} liked your post.` : `${name} commented: ${String(event.text || "").slice(0, 180)}`,
        createdAt: new Date(event.createdAt).toISOString(),
        href: `/posts/${encodeURIComponent(match[2]!)}?kind=${match[1]}${type === "comment" ? "&comments=1" : ""}`,
        avatarUrl: avatar, thumbnailUrl: image ? image.type === "photo" ? image.url : image.thumbnailUrl ?? null : null,
      });
    }));
  }
  return items;
}
