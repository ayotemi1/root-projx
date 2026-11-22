import { createHash } from "node:crypto";
import type { AuthPayload } from "./auth.js";
import { fsCreateIfAbsent, fsGet, fsMutateMessaging, fsQuery, getServerToken } from "./firebase-rest.js";
import { organisationAccessDecision, type OrganisationApprovalStatus } from "./organisation-approval.js";

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

async function activeOrganisation(orgId: string, token: string): Promise<Doc | null> {
  const org = await fsGet("organisations", orgId, token);
  if (!org || org.deletedAt) return null;
  const owner = await fsGet("users", orgId, token);
  if (!owner || owner.accountType !== "organisation") return null;
  const decision = organisationAccessDecision("organisation", owner.approvalStatus as OrganisationApprovalStatus | undefined);
  return decision === "deny" ? null : org;
}

async function canUseOrganisation(actor: AuthPayload, orgId: string, token: string) {
  const org = await activeOrganisation(orgId, token);
  if (!org) return null;
  if (actor.accountType === "organisation" && actor.userId === orgId) return org;
  const access = await fsGet("organisation_messaging_access", orgId, token);
  return members(access).includes(actor.userId) ? org : null;
}

async function requireOwner(actor: AuthPayload, orgId: string, token: string) {
  if (actor.accountType !== "organisation" || actor.userId !== orgId) throw unavailable();
  const org = await activeOrganisation(orgId, token);
  if (!org) throw unavailable();
  return org;
}

async function authorisedThread(actor: AuthPayload, conversationId: string, token: string, orgScope?: string) {
  const thread = await fsGet("conversations", conversationId, token);
  if (!thread || typeof thread.orgId !== "string" || typeof thread.supporterId !== "string") throw unavailable();
  if (orgScope && orgScope !== thread.orgId) throw unavailable();
  if (!orgScope && actor.accountType === "supporter" && thread.supporterId === actor.userId) {
    return { thread, side: "supporter" as const, org: await activeOrganisation(thread.orgId, token) };
  }
  const org = await canUseOrganisation(actor, thread.orgId, token);
  if (!org) throw unavailable();
  return { thread, side: "organisation" as const, org };
}

function unread(thread: Doc, side: "supporter" | "organisation") {
  return Math.max(0, count(thread[side === "supporter" ? "organisationSent" : "supporterSent"]) -
    count(thread[side === "supporter" ? "supporterRead" : "organisationRead"]));
}

async function conversationView(threadId: string, thread: Doc, side: "supporter" | "organisation", org: Doc | null, token: string) {
  const person = side === "organisation" ? await fsGet("users", str(thread.supporterId), token) : null;
  return {
    id: threadId, orgId: str(thread.orgId), side,
    name: side === "supporter" ? label(org?.name, label(thread.orgName, "Organisation")) : label(person?.name, label(thread.supporterName, "Supporter")),
    avatarUrl: side === "supporter" ? image(org?.logo) : image(person?.avatarUrl),
    participantLabel: side === "supporter" ? "Organisation" : "Supporter",
    lastMessage: str(thread.lastMessage),
    updatedAt: str(thread.updatedAt, str(thread.createdAt)),
    unreadCount: unread(thread, side), canSend: !!org,
  };
}

function messageView(messageId: string, message: Doc) {
  if (message.side !== "supporter" && message.side !== "organisation") throw new Error("Invalid stored message.");
  return { id: messageId, text: str(message.text), side: message.side as "supporter" | "organisation",
    createdAt: str(message.createdAt), sequence: count(message.sequence), incomingIndex: count(message.incomingIndex) };
}

export async function listConversations(actor: AuthPayload, requestedOrgId?: string) {
  const token = await getServerToken();
  const orgId = requestedOrgId ?? (actor.accountType === "organisation" ? actor.userId : undefined);
  const side = orgId ? "organisation" as const : "supporter" as const;
  if (!orgId && actor.accountType !== "supporter") throw unavailable();
  const scopedOrg = orgId ? await canUseOrganisation(actor, orgId, token) : null;
  if (orgId && !scopedOrg) throw unavailable();
  const rows = await fsQuery("conversations", [{ field: orgId ? "orgId" : "supporterId", op: "EQUAL", value: orgId ?? actor.userId }], token);
  const conversations = [];
  for (const row of rows) {
    // Defence in depth: never trust a broad/malformed storage result.
    if (orgId ? row.orgId !== orgId : row.supporterId !== actor.userId) continue;
    if (side === "organisation" && count(row.lastSequence) === 0) continue;
    const org = scopedOrg ?? await activeOrganisation(str(row.orgId), token);
    conversations.push(await conversationView(str(row._id), row, side, org, token));
  }
  conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  return { conversations, unreadCount: conversations.reduce((sum, c) => sum + c.unreadCount, 0) };
}

export async function messagingContext(actor: AuthPayload) {
  const token = await getServerToken();
  const accessRows = await fsQuery("organisation_messaging_access", [{ field: "memberIds", op: "ARRAY_CONTAINS", value: actor.userId }], token);
  const orgIds = new Set(accessRows.filter(row => members(row).includes(actor.userId)).map(row => str(row._id)).filter(Boolean));
  if (actor.accountType === "organisation") orgIds.add(actor.userId);
  const organisations = [];
  for (const orgId of orgIds) {
    const org = await canUseOrganisation(actor, orgId, token);
    if (!org) continue;
    const inbox = await listConversations(actor, orgId);
    organisations.push({ id: orgId, name: label(org.name, "Organisation"), logo: image(org.logo),
      canManageTeam: actor.accountType === "organisation" && actor.userId === orgId, unreadCount: inbox.unreadCount });
  }
  const personal = actor.accountType === "supporter";
  const personalUnreadCount = personal ? (await listConversations(actor)).unreadCount : 0;
  return { personal, personalUnreadCount, organisations, unreadCount: personalUnreadCount + organisations.reduce((sum, org) => sum + org.unreadCount, 0) };
}

export async function startConversation(actor: AuthPayload, orgId: string) {
  if (actor.accountType !== "supporter") throw new MessagingError(403, "Sign in with a supporter account to start a conversation.");
  const token = await getServerToken();
  const org = await activeOrganisation(orgId, token);
  if (!org) throw new MessagingError(404, "This organisation is not available for messaging.");
  const supporter = await fsGet("users", actor.userId, token);
  if (!supporter || supporter.accountType !== "supporter") throw unavailable();
  const conversationId = conversationIdFor(actor.userId, orgId);
  const now = new Date().toISOString();
  await fsCreateIfAbsent("conversations", conversationId, {
    supporterId: actor.userId, orgId, orgName: label(org.name, "Organisation"), supporterName: label(supporter.name, "Supporter"),
    createdAt: now, updatedAt: now, lastMessage: "", lastSequence: 0,
    supporterSent: 0, organisationSent: 0, supporterRead: 0, organisationRead: 0,
  }, token);
  const { thread } = await authorisedThread(actor, conversationId, token);
  return conversationView(conversationId, thread, "supporter", org, token);
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
  const { side, org } = await authorisedThread(actor, conversationId, token, orgScope);
  if (!org) throw new MessagingError(404, "This organisation is no longer available for messaging.");
  const messageId = id("m", conversationId, actor.userId, clientId);
  return fsMutateMessaging("conversations", conversationId, token, (current, existing) => {
    if (!current) throw unavailable();
    if (existing) {
      if (existing.senderId !== actor.userId || existing.conversationId !== conversationId || existing.text !== text || existing.side !== side) {
        throw new MessagingError(409, "This send attempt was already used. Keep the original message and retry it.");
      }
      return { result: messageView(messageId, existing) };
    }
    const sequence = count(current.lastSequence) + 1;
    const field = side === "supporter" ? "supporterSent" : "organisationSent";
    const incomingIndex = count(current[field]) + 1;
    const now = new Date().toISOString();
    const message = { conversationId, senderId: actor.userId, side, text, createdAt: now, sequence, incomingIndex,
      supporterSent: side === "supporter" ? incomingIndex : count(current.supporterSent),
      organisationSent: side === "organisation" ? incomingIndex : count(current.organisationSent) };
    return {
      patch: { lastSequence: sequence, [field]: incomingIndex, updatedAt: now, lastMessage: Array.from(text).slice(0, 180).join("") },
      message, result: messageView(messageId, message),
    };
  }, messageId);
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
