import { ListSupporterNotificationsResponse } from "@workspace/api-zod";
import { fsGet, fsQuery, getServerToken } from "./firebase-rest.js";
import { notificationId, notificationMediaUrl } from "./supporter-notifications.js";
import { accountPreferences } from "./supporter-preferences.js";
import { activeManagedOrganisation } from "./organisation-team-access.js";
import { personalMessageEvents } from "./supporter-notification-events.js";

type Doc = Record<string, unknown>;
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
/** Real recipient-owned events only. No organisation subcollection rules are
 * required, no fabricated actors/dates, and no donation email address matching. */
export async function loadOrganisationNotifications(uid: string) {
  const token = await getServerToken();
  const [org, user, donations, follows] = await Promise.all([
    activeManagedOrganisation(uid, token), fsGet("users", uid, token),
    fsQuery("donations", [{ field: "orgId", op: "EQUAL", value: uid }], token),
    fsQuery("follows", [{ field: "orgId", op: "EQUAL", value: uid }], token),
  ]);
  if (!user) throw new Error("Organisation unavailable");
  const prefs = accountPreferences(user).notifications;
  const reads = new Set(Array.isArray(user.notificationReads) ? user.notificationReads : []);
  const items: ReturnType<typeof ListSupporterNotificationsResponse.parse>["items"] = [];
  for (const d of donations) {
    if (!prefs.receipts.inApp || d.orgId !== uid || d.removed === true ||
      (d.status != null && !["succeeded", "paid", "completed"].includes(String(d.status)))) continue;
    const createdAt = date(d.createdAt), sourceId = text(d._id);
    if (!createdAt || !sourceId) continue;
    const native = d.receiptAccounting as Doc | undefined;
    const amount = typeof native?.amountGbp === "number" ? native.amountGbp : d.amountGbp;
    const currency = typeof native?.amountGbp === "number" ? text(d.currency).toUpperCase() : "GBP";
    const money = typeof amount === "number" && Number.isFinite(amount) && amount > 0 && ["GBP", "USD"].includes(currency)
      ? new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount) : null;
    const id = notificationId("organisation_donation", sourceId);
    items.push({ id, type: "donation", name: "New donation",
      message: `Your organisation received a donation${money ? ` of ${money}` : ""}${text(d.campaignName) ? ` to ${text(d.campaignName).slice(0, 100)}` : ""}.`,
      createdAt, read: reads.has(id), href: "/dashboard?tab=overview", avatarUrl: null, thumbnailUrl: null });
  }
  for (const follow of follows) {
    if (!prefs.updates.inApp || follow.orgId !== uid) continue;
    const createdAt = date(follow.createdAt), sourceId = text(follow._id), followerId = text(follow.userId);
    if (!createdAt || !sourceId || !/^[A-Za-z0-9_-]{1,128}$/.test(followerId)) continue;
    const follower = await fsGet("users", followerId, token);
    const publicProfile = follower?.publicProfile as Doc | undefined;
    const isPublic = publicProfile?.enabled === true;
    const name = isPublic ? text(publicProfile?.displayName).slice(0, 120) || "A supporter" : "A supporter";
    const publicId = text(publicProfile?.publicId);
    const id = notificationId("organisation_follower", sourceId);
    items.push({ id, type: "follower", name, message: `${name} started following ${text(org.name) || "your organisation"}.`,
      createdAt, read: reads.has(id),
      href: isPublic && /^sp_[a-f0-9]{32}$/.test(publicId) ? `/supporters/${publicId}` : "/dashboard?tab=overview",
      avatarUrl: isPublic ? notificationMediaUrl(follower?.avatarUrl) : null, thumbnailUrl: null });
  }
  if (prefs.messages.inApp) for (const event of await personalMessageEvents(uid, token, "organisation")) {
    const id = notificationId("organisation_message", event.messageId);
    items.push({ id, type: "message", name: event.name, message: `${event.name} sent you a message.`,
      createdAt: event.createdAt, read: event.read || reads.has(id),
      href: `/inbox?orgId=${encodeURIComponent(uid)}&conversation=${encodeURIComponent(event.conversationId)}`,
      avatarUrl: notificationMediaUrl(event.avatarUrl), thumbnailUrl: null });
  }
  const recent = [...new Map(items.map(item => [item.id, item])).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 200);
  return ListSupporterNotificationsResponse.parse({ items: recent, unreadCount: recent.filter(item => !item.read).length });
}
