import { createHash } from "node:crypto";
import type { AuthPayload } from "./auth.js";
import { fsCreateIfAbsent, fsGet, fsMutateMessaging, fsQuery, getServerToken } from "./firebase-rest.js";
import { organisationAccessDecision, type OrganisationApprovalStatus } from "./organisation-approval.js";
import { accountPreferences } from "./supporter-preferences.js";
import { emailSupporter } from "./supporter-notification-events.js";
import { managerIds } from "./organisation-team-access.js";

type Doc = Record<string, unknown>;
export class MessagingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const unavailable = () => new MessagingError(404, "This conversation or inbox is not available to your account.");
const id = (prefix: string, ...values: string[]) => `${prefix}_${createHash("sha256").update(JSON.stringify(values)).digest("base64url")}`;
const count = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : 0;
const str = (v: unknown, fallback = "") => typeof v === "string" ? v : fallback;
const label = (v: unknown, fallback: string) => str(v).trim() || fallback;
const image = (v: unknown) => typeof v === "string" && /^(https?:\/\/|\/api\/)/.test(v) ? v : null;
const members = (d: Doc | null) => Array.isArray(d?.memberIds) ? d.memberIds.filter((v): v is string => typeof v === "string") : [];
export const conversationIdFor = (supporterId: string, orgId: string) => id("c", supporterId, orgId);
type Participant = { kind: "supporter" | "organisation"; id: string };
type Side = "supporter" | "organisation"; // Stable thread slots, not a person's role.
const opposite = (side: Side): Side => side === "supporter" ? "organisation" : "supporter";
const identityKey = (p: Participant) => `${p.kind}:${p.id}`;
function participants(thread: Doc): Record<Side, Participant> {
  const stored = thread.participants as Record<Side, Participant> | undefined;
  const result = stored ?? {
    supporter: { kind: "supporter", id: str(thread.supporterId) },
    organisation: { kind: "organisation", id: str(thread.orgId) },
  };
  for (const p of Object.values(result)) if (!p || !["supporter", "organisation"].includes(p.kind) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(p.id)) throw unavailable();
  if (!result.supporter || !result.organisation || identityKey(result.supporter) === identityKey(result.organisation)) throw unavailable();
  return result;
}
async function activeParticipant(p: Participant, token: string): Promise<Doc | null> {
  if (p.kind === "organisation") return activeOrganisation(p.id, token);
  const user = await fsGet("users", p.id, token);
  return user?.accountType === "supporter" ? user : null;
}
async function senderIdentity(actor: AuthPayload, token: string, scope?: string): Promise<Participant> {
  const orgId = scope ?? (actor.accountType === "organisation" ? actor.userId : undefined);
  if (orgId) {
    if (!await canUseOrganisation(actor, orgId, token)) throw unavailable();
    return { kind: "organisation", id: orgId };
  }
  if (actor.accountType !== "supporter" || !await activeParticipant({ kind: "supporter", id: actor.userId }, token)) throw unavailable();
  return { kind: "supporter", id: actor.userId };
}

async function activeOrganisation(orgId: string, token: string): Promise<Doc | null> {
  const org = await fsGet("organisations", orgId, token);
  if (!org || org.deletedAt) return null;
  const owner = await fsGet("users", orgId, token);
  if (!owner || owner.accountType !== "organisation") return null;
  const decision = organisationAccessDecision("organisation", owner.approvalStatus as OrganisationApprovalStatus | undefined);
  return decision === "deny" ? null : org;
}

async function canUseOrganisation(actor: AuthPayload, orgId: string, token: string) {
  if (actor.actingUserId && orgId !== actor.userId) return null;
  const org = await activeOrganisation(orgId, token);
  if (!org) return null;
  if (!actor.actingUserId && actor.accountType === "organisation" && actor.userId === orgId) return org;
  const access = await fsGet("organisation_messaging_access", orgId, token);
  const uid = actor.actingUserId ?? actor.userId;
  return members(access).includes(uid) || managerIds(access).includes(uid) ? org : null;
}

async function requireOwner(actor: AuthPayload, orgId: string, token: string) {
  if (actor.actingUserId || actor.accountType !== "organisation" || actor.userId !== orgId) throw unavailable();
  const org = await activeOrganisation(orgId, token);
  if (!org) throw unavailable();
  return org;
}

async function authorisedThread(actor: AuthPayload, conversationId: string, token: string, orgScope?: string) {
  const thread = await fsGet("conversations", conversationId, token);
  if (!thread) throw unavailable();
  const parts = participants(thread);
  const sender = await senderIdentity(actor, token, orgScope);
  const side = (["supporter", "organisation"] as const).find(s => identityKey(parts[s]) === identityKey(sender));
  if (!side) throw unavailable();
  return { thread, side, org: await activeParticipant(parts[opposite(side)], token) };
}

async function contactAllowed(sender: Participant, recipient: Participant, thread: Doc, token: string): Promise<boolean> {
  if (sender.kind !== "organisation" || recipient.kind !== "supporter") return true;
  const parts = thread.participants || thread.supporterId ? participants(thread) : null;
  const supporterSide = parts && (["supporter", "organisation"] as const).find(s => identityKey(parts[s]) === identityKey(recipient));
  if (supporterSide && count(thread[`${supporterSide}Sent`]) > 0) return true;
  const user = await activeParticipant(recipient, token);
  if (!user || accountPreferences(user).messagePolicy === "replies") return false;
  const follows = await fsQuery("follows", [{ field: "userId", op: "EQUAL", value: recipient.id }], token);
  return follows.some(f => f.userId === recipient.id && f.orgId === sender.id);
}

/** Private photos are visible only to their owner or authorised participants
 * in real message history; public team cards never authorise this access. */
export async function canSeePrivateSupporterAvatar(viewer: string, supporter: string, token: string) {
  const user = await fsGet("users", viewer, token);
  if (!user || !["supporter", "organisation"].includes(str(user.accountType))) return false;
  const actor = { userId: viewer, accountType: user.accountType, email: "" } as AuthPayload;
  const [legacy, modern] = await Promise.all([
    fsQuery("conversations", [{ field: "supporterId", op: "EQUAL", value: supporter }], token),
    fsQuery("conversations", [{ field: "participantKeys", op: "ARRAY_CONTAINS", value: `supporter:${supporter}` }], token),
  ]);
  for (const thread of [...legacy, ...modern]) {
    if (!count(thread.sequence) && !count(thread.supporterSent) && !count(thread.organisationSent)) continue;
    let parts: Record<Side, Participant>;
    try { parts = participants(thread); } catch { continue; }
    const ownerSide = (["supporter", "organisation"] as const).find(s => parts[s].kind === "supporter" && parts[s].id === supporter);
    if (!ownerSide) continue;
    const peer = parts[opposite(ownerSide)];
    if (peer.kind === "supporter" ? user.accountType === "supporter" && peer.id === viewer : !!await canUseOrganisation(actor, peer.id, token)) return true;
  }
  return false;
}

function unread(thread: Doc, side: "supporter" | "organisation") {
  return Math.max(0, count(thread[side === "supporter" ? "organisationSent" : "supporterSent"]) -
    count(thread[side === "supporter" ? "supporterRead" : "organisationRead"]));
}

async function conversationView(threadId: string, thread: Doc, side: "supporter" | "organisation", org: Doc | null, token: string) {
  const parts = participants(thread);
  const peer = parts[opposite(side)], me = parts[side];
  const person = org;
  const publicProfile = person?.publicProfile as Doc | undefined;
  const peerName = label(peer.kind === "organisation" ? person?.name : publicProfile?.displayName,
    label(person?.name, label(thread[opposite(side) === "supporter" ? "supporterName" : "orgName"], peer.kind === "organisation" ? "Organisation" : "Supporter")));
  const mine = await activeParticipant(me, token);
  return {
    id: threadId, orgId: str(thread.orgId, peer.kind === "organisation" ? peer.id : me.kind === "organisation" ? me.id : ""), side,
    name: peerName, avatarUrl: image(peer.kind === "organisation" ? person?.logo : person?.avatarUrl),
    participantLabel: peer.kind === "organisation" ? "Organisation" : "Supporter",
    peerHref: !person ? null : peer.kind === "organisation" ? `/organisations/${peer.id}` :
      publicProfile?.enabled === true && /^sp_[a-f0-9]{32}$/.test(str(publicProfile.publicId)) ? `/supporters/${publicProfile.publicId}` : null,
    senderLabel: label(mine?.name, me.kind === "organisation" ? "Organisation" : "Personal"),
    lastMessage: str(thread.lastMessage),
    updatedAt: str(thread.updatedAt, str(thread.createdAt)),
    unreadCount: unread(thread, side), canSend: !!org && !!mine && await contactAllowed(me, peer, thread, token),
  };
}

function messageView(messageId: string, message: Doc) {
  if (message.side !== "supporter" && message.side !== "organisation") throw new Error("Invalid stored message.");
  return { id: messageId, text: str(message.text), side: message.side as "supporter" | "organisation",
    createdAt: str(message.createdAt), sequence: count(message.sequence), incomingIndex: count(message.incomingIndex) };
}

export async function listConversations(actor: AuthPayload, requestedOrgId?: string) {
  const token = await getServerToken();
  const sender = await senderIdentity(actor, token, requestedOrgId);
  const [legacy, modern] = await Promise.all([
    fsQuery("conversations", [{ field: sender.kind === "organisation" ? "orgId" : "supporterId", op: "EQUAL", value: sender.id }], token),
    fsQuery("conversations", [{ field: "participantKeys", op: "ARRAY_CONTAINS", value: identityKey(sender) }], token),
  ]);
  const rows = [...new Map([...legacy, ...modern].map(row => [str(row._id), row])).values()];
  const conversations = [];
  for (const row of rows) {
    let parts: Record<Side, Participant>;
    try { parts = participants(row); } catch { continue; }
    const side = (["supporter", "organisation"] as const).find(s => identityKey(parts[s]) === identityKey(sender));
    if (!side) continue;
    if (count(row.lastSequence) === 0 && row.initiatorKey !== identityKey(sender) &&
        !(row.initiatorKey === undefined && sender.kind === "supporter")) continue;
    const org = await activeParticipant(parts[opposite(side)], token);
    conversations.push(await conversationView(str(row._id), row, side, org, token));
  }
  conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  return { conversations, unreadCount: conversations.reduce((sum, c) => sum + c.unreadCount, 0) };
}

export async function messagingContext(actor: AuthPayload) {
  const token = await getServerToken();
  const accessRows = actor.actingUserId ? [] : (await Promise.all(["memberIds", "managerIds"].map(field =>
    fsQuery("organisation_messaging_access", [{ field, op: "ARRAY_CONTAINS", value: actor.userId }], token)))).flat();
  const orgIds = new Set(accessRows.filter(row => members(row).includes(actor.userId) || managerIds(row).includes(actor.userId)).map(row => str(row._id)).filter(Boolean));
  if (actor.accountType === "organisation") orgIds.add(actor.userId);
  const organisations = [];
  for (const orgId of orgIds) {
    const org = await canUseOrganisation(actor, orgId, token);
    if (!org) continue;
    const inbox = await listConversations(actor, orgId);
    organisations.push({ id: orgId, name: label(org.name, "Organisation"), logo: image(org.logo),
      canManageTeam: !actor.actingUserId && actor.accountType === "organisation" && actor.userId === orgId, unreadCount: inbox.unreadCount });
  }
  const personal = actor.accountType === "supporter";
  const personalUnreadCount = personal ? (await listConversations(actor)).unreadCount : 0;
  return { personal, personalUnreadCount, organisations, unreadCount: personalUnreadCount + organisations.reduce((sum, org) => sum + org.unreadCount, 0) };
}

export async function startConversation(actor: AuthPayload, input: string | { recipient: Participant; asOrgId?: string }) {
  if (typeof input === "string" && actor.accountType !== "supporter") throw new MessagingError(403, "Choose a sender and recipient.");
  const token = await getServerToken();
  const sender = await senderIdentity(actor, token, typeof input === "string" ? undefined : input.asOrgId);
  let recipient: Participant = typeof input === "string" ? { kind: "organisation", id: input } : input.recipient;
  if (recipient.kind === "supporter") {
    if (!/^sp_[a-f0-9]{32}$/.test(recipient.id)) throw unavailable();
    const users = await fsQuery("users", [{ field: "publicProfile.publicId", op: "EQUAL", value: recipient.id }], token);
    const user = users.find(u => u.accountType === "supporter" && (u.publicProfile as Doc)?.enabled === true);
    if (!user) throw unavailable();
    recipient = { kind: "supporter", id: str(user._id) };
  }
  const peer = await activeParticipant(recipient, token);
  if (!peer) throw unavailable();
  if (identityKey(sender) === identityKey(recipient)) throw new MessagingError(400, "Choose someone else to message.");
  const pair = [sender, recipient].sort((a, b) => a.kind === b.kind ? identityKey(a).localeCompare(identityKey(b)) : a.kind === "supporter" ? -1 : 1);
  const a = pair[0]!, b = pair[1]!;
  const mixed = a.kind !== b.kind;
  const conversationId = mixed ? conversationIdFor(a.id, b.id) : id("c", identityKey(a), identityKey(b));
  if (!await fsGet("conversations", conversationId, token) && !await contactAllowed(sender, recipient, {}, token)) throw unavailable();
  const own = await activeParticipant(sender, token);
  const now = new Date().toISOString();
  await fsCreateIfAbsent("conversations", conversationId, {
    ...(mixed ? { supporterId: a.id, orgId: b.id } : {}),
    participants: { supporter: a, organisation: b }, participantKeys: pair.map(identityKey),
    initiatorKey: identityKey(sender),
    supporterName: label((identityKey(a) === identityKey(sender) ? own : peer)?.name, "Supporter"),
    orgName: label((identityKey(b) === identityKey(sender) ? own : peer)?.name, "Organisation"),
    createdAt: now, updatedAt: now, lastMessage: "", lastSequence: 0,
    supporterSent: 0, organisationSent: 0, supporterRead: 0, organisationRead: 0,
  }, token);
  const { thread, side, org } = await authorisedThread(actor, conversationId, token, typeof input === "string" ? undefined : input.asOrgId);
  return conversationView(conversationId, thread, side, org, token);
}

export async function conversationMessages(actor: AuthPayload, conversationId: string, before?: number, orgScope?: string) {
  const token = await getServerToken();
  const { thread, side, org } = await authorisedThread(actor, conversationId, token, orgScope);
  const all = await fsQuery("conversation_messages", [{ field: "conversationId", op: "EQUAL", value: conversationId }], token);
  const rows = all.filter(row => row.conversationId === conversationId && count(row.sequence) > 0 && (!before || count(row.sequence) < before))
    .sort((a, b) => count(b.sequence) - count(a.sequence));
  const page = rows.slice(0, 50).reverse();
  const messages = page.map(row => messageView(str(row._id), row));
  return {
    conversation: await conversationView(conversationId, thread, side, org, token), messages,
    hasMore: rows.length > page.length, nextBeforeSequence: rows.length > page.length ? messages[0]!.sequence : null,
    readThrough: page.reduce((n, m) => Math.max(n, count(m[side === "supporter" ? "organisationSent" : "supporterSent"]),
      m.side !== side ? count(m.incomingIndex) : 0), 0),
  };
}

export async function sendMessage(actor: AuthPayload, conversationId: string, text: string, clientId: string, orgScope?: string) {
  text = text.trim();
  if (!text || text.length > 2000) throw new MessagingError(400, "Write a message between 1 and 2,000 characters.");
  const token = await getServerToken();
  const { thread, side, org } = await authorisedThread(actor, conversationId, token, orgScope);
  if (!org) throw new MessagingError(404, "This organisation is no longer available for messaging.");
  const parts = participants(thread);
  if (!await contactAllowed(parts[side], parts[opposite(side)], thread, token)) throw unavailable();
  const sender = await activeParticipant(parts[side], token);
  const senderName = label(parts[side].kind === "organisation" ? sender?.name : (sender?.publicProfile as Doc)?.displayName, label(sender?.name, "Someone"));
  const recipient = parts[opposite(side)];
  const senderId = actor.actingUserId ?? actor.userId;
  const messageId = id("m", conversationId, senderId, clientId);
  const sent = await fsMutateMessaging("conversations", conversationId, token, (current, existing) => {
    if (!current) throw unavailable();
    if (existing) {
      if (existing.senderId !== senderId || existing.conversationId !== conversationId || existing.text !== text || existing.side !== side) {
        throw new MessagingError(409, "This send attempt was already used. Keep the original message and retry it.");
      }
      return { result: { view: messageView(messageId, existing), created: false } };
    }
    const sequence = count(current.lastSequence) + 1;
    const field = side === "supporter" ? "supporterSent" : "organisationSent";
    const incomingIndex = count(current[field]) + 1;
    const now = new Date().toISOString();
    const message = { conversationId, senderId, side, text, createdAt: now, sequence, incomingIndex,
      supporterSent: side === "supporter" ? incomingIndex : count(current.supporterSent),
      organisationSent: side === "organisation" ? incomingIndex : count(current.organisationSent) };
    return {
      patch: { lastSequence: sequence, [field]: incomingIndex, updatedAt: now, lastMessage: Array.from(text).slice(0, 180).join(""),
        ...(recipient.kind === "supporter" ? { [`${opposite(side)}LastIncoming`]: {
          recipientUid: recipient.id, messageId, incomingIndex, createdAt: now, name: senderName,
          avatarUrl: image(parts[side].kind === "organisation" ? sender?.logo : sender?.avatarUrl),
        } } : {}) },
      message, result: { view: messageView(messageId, message), created: true },
    };
  }, messageId);
  if (sent.created && recipient.kind === "supporter") {
    try { await emailSupporter(recipient.id, "messages", "A new message on Root ProjX",
      `${senderName} sent you a message. Open your private Inbox to read and reply.`, `/inbox?conversation=${encodeURIComponent(conversationId)}`, token); }
    catch { console.warn("A supporter message email could not be delivered"); }
  }
  return sent.view;
}

export async function readConversation(actor: AuthPayload, conversationId: string, through: number, orgScope?: string) {
  const token = await getServerToken();
  const { side, org } = await authorisedThread(actor, conversationId, token, orgScope);
  const thread = await fsMutateMessaging("conversations", conversationId, token, current => {
    if (!current) throw unavailable();
    const field = side === "supporter" ? "supporterRead" : "organisationRead";
    const sent = count(current[side === "supporter" ? "organisationSent" : "supporterSent"]);
    const value = Math.max(count(current[field]), Math.min(sent, through));
    return { patch: value !== count(current[field]) ? { [field]: value } : undefined, result: { ...current, [field]: value } };
  });
  return conversationView(conversationId, thread, side, org, token);
}

export async function messagingTeam(actor: AuthPayload, orgId: string) {
  const token = await getServerToken();
  await requireOwner(actor, orgId, token);
  const access = await fsGet("organisation_messaging_access", orgId, token);
  const result = [];
  for (const userId of members(access)) {
    const person = await fsGet("users", userId, token);
    if (person) result.push({ userId, name: str(person.name, "Team member") });
  }
  return { members: result };
}

export async function changeMessagingTeam(actor: AuthPayload, orgId: string, change: { userId: string } | { removeId: string }) {
  const token = await getServerToken();
  await requireOwner(actor, orgId, token);
  let memberId: string;
  if ("userId" in change) {
    const person = await fsGet("users", change.userId, token);
    if (!person || !["supporter", "organisation"].includes(str(person.accountType)) || change.userId === orgId) {
      throw new MessagingError(400, "Check the account ID. The team member can copy it from their Inbox.");
    }
    memberId = change.userId;
  } else memberId = change.removeId;
  await fsMutateMessaging("organisation_messaging_access", orgId, token, current => {
    const ids = new Set(members(current));
    if ("userId" in change) ids.add(memberId); else ids.delete(memberId);
    if (ids.size > 25) throw new MessagingError(400, "You can give messaging access to up to 25 team members.");
    return { patch: { memberIds: [...ids], updatedAt: new Date().toISOString(), updatedBy: actor.userId }, result: null };
  });
  return messagingTeam(actor, orgId);
}
