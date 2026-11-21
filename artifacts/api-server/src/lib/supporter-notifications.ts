import { createHash } from "node:crypto";
import { ListSupporterNotificationsResponse } from "@workspace/api-zod";
import { fsGet, fsQuery, getServerToken } from "./firebase-rest.js";

type Doc = Record<string, unknown>;
type Inbox = ReturnType<typeof ListSupporterNotificationsResponse.parse>;
type Notification = Inbox["items"][number];

export function notificationId(type: string, sourceId: string): string {
  return `n_${createHash("sha256").update(`${type}/${sourceId}`).digest("base64url").slice(0, 32)}`;
}

const text = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : "";
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const mediaUrl = (value: unknown): string | null => {
  const url = text(value, 2048);
  return /^https?:\/\//i.test(url) || /^\/(?:api\/|logo)[^\\]*$/.test(url) ? url : null;
};

function donationMessage(donation: Doc): string {
  const org = text(donation.orgName) || "an organisation";
  const native = donation.receiptAccounting as Doc | undefined;
  // Same native/GBP distinction as Giving history; do not label GBP settlement
  // amounts as USD or include the voluntary fee contribution in the gift.
  const nativeAmount = native && typeof native.amountGbp === "number" ? native.amountGbp : null;
  const amount = nativeAmount ?? donation.amountGbp;
  const currency = nativeAmount !== null ? text(donation.currency).toUpperCase() : "GBP";
  const formatted = typeof amount === "number" && Number.isFinite(amount) && amount > 0 && /^(GBP|USD)$/.test(currency)
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount) : null;
  return `Your donation${formatted ? ` of ${formatted}` : ""} to ${org} was recorded. View your giving history.`;
}

/** Existing events only. No financial/event writes and no invented milestones.
 * Recipient-private sources are read with the recipient's Firebase token.
 */
export async function loadSupporterNotifications(uid: string, userToken: string): Promise<Inbox> {
  const [user, follows, donations] = await Promise.all([
    fsGet("users", uid, userToken),
    fsQuery("follows", [{ field: "userId", op: "EQUAL", value: uid }], userToken),
    fsQuery("donations", [{ field: "userId", op: "EQUAL", value: uid }], userToken),
  ]);
  if (!user || user.accountType !== "supporter") throw new Error("Supporter unavailable");
  const readIds = new Set(Array.isArray(user.notificationReads) ? user.notificationReads.filter(v => typeof v === "string") : []);
  const items: Notification[] = [];
  const token = await getServerToken();
  const followTimes = new Map<string, number>();
  for (const follow of follows) {
    if (follow.userId !== uid) continue;
    const orgId = text(follow.orgId);
    if (!orgId || orgId.includes("/")) continue;
    const time = timestamp(follow.createdAt);
    followTimes.set(orgId, time ? Date.parse(time) : 0);
  }
  // Reuse the followed feed's existing single-field queries: no new Firebase
  // collections, composite indexes or client-readable notification records.
  const ids = [...followTimes.keys()];
  for (let start = 0; start < ids.length; start += 8) {
    await Promise.all(ids.slice(start, start + 8).map(async orgId => {
      const org = await fsGet("organisations", orgId, token);
      if (!org || org.deletedAt) return;
      const posts = await fsQuery("updates", [{ field: "orgId", op: "EQUAL", value: orgId }], token);
      for (const post of posts) {
        if (post.orgId !== orgId || (post.status != null && post.status !== "published")) continue;
        const date = timestamp(post.createdAt);
        const sourceId = text(post._id, 512);
        if (!date || !sourceId || Date.parse(date) < followTimes.get(orgId)!) continue;
        const id = notificationId("organisation_post", sourceId);
        const name = text(org.name) || text(post.orgName) || "An organisation";
        const title = text(post.title, 140);
        const urls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
        const thumbnail = mediaUrl(post.posterUrl) ?? mediaUrl(post.thumbnailUrl) ??
          ((post.type === "image" || post.type === "photo") ? mediaUrl(urls[0]) : null);
        items.push({
          id, type: "organisation_post", name, read: readIds.has(id),
          message: `${name} posted${title ? ` “${title}”` : " a new post"}.`,
          createdAt: date, href: `/feed?post=${encodeURIComponent(sourceId)}`,
          avatarUrl: mediaUrl(org.logo), thumbnailUrl: thumbnail,
        });
      }
    }));
  }
  for (const donation of donations) {
    // Defense in depth even if a future storage helper accidentally returns
    // another recipient's row. Guest-email matching is intentionally not used.
    if (donation.userId !== uid || donation.removed === true ||
      (donation.status != null && !["succeeded", "paid", "completed"].includes(String(donation.status)))) continue;
    const date = timestamp(donation.createdAt);
    const sourceId = text(donation._id, 512);
    if (!date || !sourceId) continue;
    const id = notificationId("donation", sourceId);
    items.push({
      id, type: "donation", name: "Donation", read: readIds.has(id),
      message: donationMessage(donation), createdAt: date,
      href: `/giving-history#donation-${encodeURIComponent(sourceId)}`,
      avatarUrl: null, thumbnailUrl: null,
    });
  }
  const recent = [...new Map(items.map(item => [item.id, item])).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 200);
  return ListSupporterNotificationsResponse.parse({ items: recent, unreadCount: recent.filter(item => !item.read).length });
}
