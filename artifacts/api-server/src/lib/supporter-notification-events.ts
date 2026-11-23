import { fsGet, fsQuery } from "./firebase-rest.js";
import { brevoSendEmail } from "./brevo.js";
import { accountPreferences, verifiedNotificationEmail } from "./supporter-preferences.js";

type Doc = Record<string, any>;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const origin = "https://rootprojx.com"; // Verified published URL; never send inherited preview origins.
export async function emailSupporter(uid: string, category: "updates" | "messages", title: string, sentence: string, href: string, token: string) {
  // Preview must not send new live notification emails to real supporters.
  // Receipt and security email paths deliberately do not use this helper.
  if (process.env.NODE_ENV !== "production") return;
  const user = await fsGet("users", uid, token);
  if (!user || user.accountType !== "supporter" || !accountPreferences(user).notifications[category].email) return;
  const email = verifiedNotificationEmail(uid, user);
  if (!email) return;
  await brevoSendEmail({ to: [{ email }], subject: title,
    htmlContent: `<div style="font-family:Arial,sans-serif;color:#17100f"><h1>${escape(title)}</h1><p>${escape(sentence)}</p><p><a href="${origin}${escape(href)}">Open Root ProjX</a></p><p>You can change notification preferences in Settings.</p></div>` });
}
export async function emailOrganisationUpdate(orgId: string, name: string, postId: string, token: string) {
  if (process.env.NODE_ENV !== "production") return;
  const follows = await fsQuery("follows", [{ field: "orgId", op: "EQUAL", value: orgId }], token);
  const recipients = [...new Set(follows.filter(f => f.orgId === orgId && typeof f.userId === "string").map(f => String(f.userId)))];
  for (let i = 0; i < recipients.length; i += 8) {
    const batch = await Promise.allSettled(recipients.slice(i, i + 8).map(uid =>
      emailSupporter(uid, "updates", "A new update on Root ProjX", `${name} shared a new public update.`, `/feed?post=${encodeURIComponent(postId)}`, token)));
    if (batch.some(r => r.status === "rejected")) console.warn("Some supporter update emails could not be delivered");
  }
}
export async function personalMessageEvents(uid: string, token: string, kind: "supporter" | "organisation" = "supporter") {
  const [modern, legacy] = await Promise.all([
    fsQuery("conversations", [{ field: "participantKeys", op: "ARRAY_CONTAINS", value: `${kind}:${uid}` }], token),
    fsQuery("conversations", [{ field: kind === "organisation" ? "orgId" : "supporterId", op: "EQUAL", value: uid }], token),
  ]);
  const events = [];
  for (const thread of new Map([...modern, ...legacy].map(t => [t._id, t as Doc])).values()) {
    const p = thread.participants;
    const side = p && typeof p === "object"
      ? (["supporter", "organisation"] as const).find(s => p[s]?.kind === kind && p[s]?.id === uid)
      : kind === "organisation" && thread.orgId === uid ? "organisation" : kind === "supporter" && thread.supporterId === uid ? "supporter" : undefined;
    if (!side) continue;
    let incoming = thread[`${side}LastIncoming`];
    // Older organisation threads have no LastIncoming snapshot. Derive the
    // actual event from their persisted message history, never from counters
    // alone or a made-up timestamp.
    if (!incoming && kind === "organisation") {
      const history = await fsQuery("conversation_messages", [{ field: "conversationId", op: "EQUAL", value: thread._id }], token);
      const last = history.filter(m => m.conversationId === thread._id && m.side === (side === "supporter" ? "organisation" : "supporter"))
        .sort((a, b) => Number(b.sequence) - Number(a.sequence))[0];
      if (last) {
        const peer = p?.[side === "supporter" ? "organisation" : "supporter"];
        const person = peer?.id ? await fsGet(peer.kind === "organisation" ? "organisations" : "users", peer.id, token) : null;
        incoming = { recipientUid: uid, messageId: last._id, incomingIndex: last.incomingIndex,
          createdAt: last.createdAt, name: person?.name || thread.supporterName || "Someone", avatarUrl: null };
      }
    }
    if (!incoming || incoming.recipientUid !== uid || typeof incoming.messageId !== "string" ||
      typeof incoming.createdAt !== "string" || !Number.isFinite(Date.parse(incoming.createdAt))) continue;
    events.push({
      messageId: incoming.messageId, conversationId: String(thread._id),
      createdAt: incoming.createdAt, name: typeof incoming.name === "string" ? incoming.name.slice(0, 180) : "Someone",
      avatarUrl: typeof incoming.avatarUrl === "string" ? incoming.avatarUrl : null,
      read: typeof thread[`${side}Read`] === "number" && thread[`${side}Read`] >= incoming.incomingIndex,
    });
  }
  return events;
}
