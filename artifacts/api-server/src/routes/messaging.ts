import { Router, type IRouter, type Request, type RequestHandler } from "express";
import {
  GetMessagingContextResponse, ListMessageConversationsQueryParams, ListMessageConversationsResponse,
  StartMessageConversationBody, StartMessageConversationResponse,
  GetConversationMessagesQueryParams, GetConversationMessagesResponse,
  SendConversationMessageParams, SendConversationMessageBody, SendConversationMessageResponse,
  MarkConversationReadParams, MarkConversationReadBody, MarkConversationReadResponse,
  GetMessagingTeamParams, GetMessagingTeamResponse, AddMessagingTeamMemberParams, AddMessagingTeamMemberBody,
  AddMessagingTeamMemberResponse, RemoveMessagingTeamMemberParams, RemoveMessagingTeamMemberResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth.js";
import {
  MessagingError, messagingContext, listConversations, startConversation, conversationMessages,
  sendMessage, readConversation, messagingTeam, changeMessagingTeam,
} from "../lib/messaging.js";

const router: IRouter = Router();
router.use("/messaging", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  next();
}, requireAuth, (req, res, next) => {
  if (!["supporter", "organisation"].includes(req.user!.accountType)) {
    res.status(403).json({ error: "Sign in with your supporter or organisation account." }); return;
  }
  next();
});

function parse<T>(schema: { parse: (input: unknown) => T }, input: unknown): T {
  try { return schema.parse(input); }
  catch { throw new MessagingError(400, "Check the message or account details and try again."); }
}

const rates = new Map<string, { since: number; attempts: number }>();
function limit(actorId: string) {
  const now = Date.now();
  if (rates.size > 5000) for (const [key, row] of rates) if (now - row.since >= 60000) rates.delete(key);
  const row = rates.get(actorId);
  if (!row || now - row.since >= 60000) { rates.set(actorId, { since: now, attempts: 1 }); return; }
  if (++row.attempts > 60) throw new MessagingError(429, "You're sending too quickly. Wait a minute and try again. Your message is still available.");
}

const handle = (run: (req: Request) => Promise<unknown>): RequestHandler => async (req, res): Promise<void> => {
  try { res.json(await run(req)); }
  catch (error) {
    if (error instanceof MessagingError) {
      if (error.status === 429) res.setHeader("Retry-After", "60");
      res.status(error.status).json({ error: error.message }); return;
    }
    // Never log message text, participant identities, provider bodies or tokens.
    req.log?.warn("Private messaging operation could not be completed");
    res.status(503).json({ error: "Messaging couldn't complete that request. Please try again. Any unsent message has not been cleared." });
  }
};

router.get("/messaging/context", handle(async req =>
  GetMessagingContextResponse.parse(await messagingContext(req.user!))));
router.get("/messaging/conversations", handle(async req => {
  const query = parse(ListMessageConversationsQueryParams, req.query);
  return ListMessageConversationsResponse.parse(await listConversations(req.user!, query.orgId));
}));
router.post("/messaging/conversations", handle(async req => {
  const body = parse(StartMessageConversationBody, req.body);
  limit(req.user!.userId);
  return StartMessageConversationResponse.parse(await startConversation(req.user!, body.orgId));
}));
router.get("/messaging/messages", handle(async req => {
  const query = parse(GetConversationMessagesQueryParams, req.query);
  return GetConversationMessagesResponse.parse(await conversationMessages(req.user!, query.conversationId, query.beforeSequence, query.orgId));
}));
router.post("/messaging/conversations/:id/messages", handle(async req => {
  const { id } = parse(SendConversationMessageParams, req.params);
  const body = parse(SendConversationMessageBody, req.body);
  limit(req.user!.userId);
  return SendConversationMessageResponse.parse(await sendMessage(req.user!, id, body.text, body.clientId, body.orgId));
}));
router.post("/messaging/conversations/:id/read", handle(async req => {
  const { id } = parse(MarkConversationReadParams, req.params);
  const body = parse(MarkConversationReadBody, req.body);
  return MarkConversationReadResponse.parse(await readConversation(req.user!, id, body.through, body.orgId));
}));
router.get("/messaging/access/:orgId", handle(async req => {
  const { orgId } = parse(GetMessagingTeamParams, req.params);
  return GetMessagingTeamResponse.parse(await messagingTeam(req.user!, orgId));
}));
router.post("/messaging/access/:orgId", handle(async req => {
  const { orgId } = parse(AddMessagingTeamMemberParams, req.params);
  const body = parse(AddMessagingTeamMemberBody, req.body);
  limit(req.user!.userId);
  return AddMessagingTeamMemberResponse.parse(await changeMessagingTeam(req.user!, orgId, body));
}));
router.delete("/messaging/access/:orgId/:userId", handle(async req => {
  const { orgId, userId } = parse(RemoveMessagingTeamMemberParams, req.params);
  return RemoveMessagingTeamMemberResponse.parse(await changeMessagingTeam(req.user!, orgId, { removeId: userId }));
}));
export default router;
