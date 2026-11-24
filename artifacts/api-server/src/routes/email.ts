import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import {
  ReadEmailPreferencesBody, ReadEmailPreferencesResponse, SaveEmailPreferencesBody,
  SaveEmailPreferencesResponse, SaveEmailConfigurationBody, GetEmailConfigurationResponse,
  GetEmailHistoryResponse, InviteEmailTeamMemberBody, ListEmailTeamInvitationsResponse,
  AcceptEmailTeamInvitationBody, GetOwnEmailApplicationResponse,
  RespondToEmailApplicationBody, RequestEmailApplicationInformationBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/admin-auth.js";
import { requireAuth } from "../lib/auth.js";
import { fsGet, fsPatch, fsMutateApplicationState, getServerToken } from "../lib/firebase-rest.js";
import { EmailAccessError, parsePreferenceKey, preferenceIdentity, readMailPreferences, saveMailPreferences } from "../lib/email/preferences.js";
import { emailConfiguration, emailHistory, processEmailQueue, saveEmailConfiguration } from "../lib/email/service.js";
import { acceptTeamInvitation, inviteTeamMember, listInvitations } from "../lib/email/invitations.js";
import { applicationEmails, applicationView, currentOwnApplication } from "../lib/email/application-events.js";
import { runEmailWork } from "../lib/email/worker.js";
import { createEmailJobKey, emailJobStatus, requireEmailJobKey, runScheduledEmailWork } from "../lib/email/scheduled-job.js";

const router = Router();
const limited = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
const noStore: RequestHandler = (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); res.vary("Authorization"); next(); };
router.use(["/email", "/admin/email"], noStore);
const fail = (req: any, res: any, error: unknown) => {
  req.log?.warn("Email account operation could not be completed");
  res.status(error instanceof EmailAccessError ? error.status : 503).json({
    error: error instanceof EmailAccessError ? error.message : "We couldn't complete this email operation. Please try again.",
  });
};
const preferenceAuth: RequestHandler = (req, res, next) => {
  if (typeof req.body?.accessKey === "string") { next(); return; }
  return requireAuth(req, res, next);
};
function recipient(req: Parameters<RequestHandler>[0]) {
  if (typeof req.body?.accessKey === "string") return parsePreferenceKey(req.body.accessKey);
  if (!req.user || req.user.actingUserId || req.user.adminDelegated) throw new EmailAccessError(403, "Open your own account to change email preferences.");
  return { id: preferenceIdentity(req.user.email), isOrganisation: req.user.accountType === "organisation" };
}
router.post("/email/preferences/read", limited, preferenceAuth, async (req, res) => {
  try {
    if (!ReadEmailPreferencesBody.strict().safeParse(req.body).success) throw new EmailAccessError(400, "Invalid email preference request.");
    const identity = recipient(req);
    res.json(ReadEmailPreferencesResponse.parse(await readMailPreferences(identity.id, identity.isOrganisation)));
  } catch (e) { fail(req, res, e); }
});
router.patch("/email/preferences", limited, preferenceAuth, async (req, res) => {
  try {
    const parsed = SaveEmailPreferencesBody.strict().safeParse(req.body);
    if (!parsed.success) throw new EmailAccessError(400, "Choose valid email preferences.");
    const identity = recipient(req), { accessKey: _key, ...patch } = parsed.data;
    res.json(SaveEmailPreferencesResponse.parse(await saveMailPreferences(identity.id, identity.isOrganisation, patch)));
  } catch (e) { fail(req, res, e); }
});
router.get("/admin/email/config", requireAdmin, async (req, res) => {
  try { res.json(GetEmailConfigurationResponse.parse(await emailConfiguration())); } catch (e) { fail(req, res, e); }
});
router.get("/admin/email/job-status", requireAdmin, async (req, res) => {
  try { res.json(await emailJobStatus()); } catch (e) { fail(req, res, e); }
});
router.post("/admin/email/job-key", requireAdmin, limited, async (req, res) => {
  try { res.json(await createEmailJobKey()); } catch (e) { fail(req, res, e); }
});
router.post("/email/jobs/run", requireEmailJobKey, limited, async (req, res) => {
  try { res.json(await runScheduledEmailWork()); } catch (e) { fail(req, res, e); }
});
router.put("/admin/email/config", requireAdmin, async (req, res) => {
  try {
    const parsed = SaveEmailConfigurationBody.strict().safeParse(req.body);
    if (!parsed.success) throw new EmailAccessError(400, "Enter a valid administrative email address.");
    res.json(GetEmailConfigurationResponse.parse(await saveEmailConfiguration(parsed.data.adminRecipient)));
  } catch (e) { fail(req, res, e); }
});
router.get("/admin/email/history", requireAdmin, async (req, res) => {
  try { res.json(GetEmailHistoryResponse.parse(await emailHistory())); } catch (e) { fail(req, res, e); }
});
router.post("/admin/email/process", requireAdmin, limited, async (req, res) => {
  try { res.json(await runEmailWork(true)); } catch (e) { fail(req, res, e); }
});
router.get("/email/team-invitations", requireAuth, async (req, res) => {
  try { res.json(ListEmailTeamInvitationsResponse.parse(await listInvitations(req.user!))); } catch (e) { fail(req, res, e); }
});
router.post("/email/team-invitations", requireAuth, limited, async (req, res) => {
  try {
    const parsed = InviteEmailTeamMemberBody.strict().safeParse(req.body);
    if (!parsed.success) throw new EmailAccessError(400, "Enter a valid invitation email address.");
    res.status(201).json(ListEmailTeamInvitationsResponse.element.parse(await inviteTeamMember(req.user!, parsed.data.email)));
  } catch (e) { fail(req, res, e); }
});
router.post("/email/team-invitations/accept", requireAuth, limited, async (req, res) => {
  try {
    const parsed = AcceptEmailTeamInvitationBody.strict().safeParse(req.body);
    if (!parsed.success) throw new EmailAccessError(400, "This invitation link is invalid.");
    res.json(await acceptTeamInvitation(req.user!, parsed.data.accessKey));
  } catch (e) { fail(req, res, e); }
});
router.get("/email/application", requireAuth, async (req, res) => {
  try {
    if (req.user!.actingUserId || req.user!.adminDelegated) throw new EmailAccessError(403, "Open your own application.");
    const app = await currentOwnApplication(req.user!.userId);
    if (!app) throw new EmailAccessError(404, "No application was found for this account.");
    res.json(GetOwnEmailApplicationResponse.parse(applicationView(app)));
  } catch (e) { fail(req, res, e); }
});
router.patch("/email/application", requireAuth, limited, async (req, res) => {
  try {
    if (req.user!.actingUserId || req.user!.adminDelegated) throw new EmailAccessError(403, "Open your own application.");
    const parsed = RespondToEmailApplicationBody.strict().safeParse(req.body);
    if (!parsed.success || !parsed.data.response.trim()) throw new EmailAccessError(400, "Enter your response before submitting.");
    const app = await currentOwnApplication(req.user!.userId);
    if (!app || app.status !== "waiting") throw new EmailAccessError(409, "This application is not currently waiting for information. Refresh its status.");
    const changes = { response: parsed.data.response.trim(), respondedAt: new Date().toISOString(), status: "pending" };
    const updated = await fsMutateApplicationState(String(app._id), await getServerToken(), current => {
      if (!current || current.uid !== req.user!.userId || current.status !== "waiting") throw new EmailAccessError(409, "The application changed. Refresh its status before responding.");
      return { patch: changes, result: { ...current, ...changes, _id: app._id } };
    });
    res.json(GetOwnEmailApplicationResponse.parse(applicationView(updated)));
  } catch (e) { fail(req, res, e); }
});
router.post("/admin/applications/:id/request-info", requireAdmin, async (req, res) => {
  try {
    const body = RequestEmailApplicationInformationBody.strict().safeParse(req.body);
    if (!body.success || !body.data.message.trim()) throw new EmailAccessError(400, "Write the information you need from the organisation.");
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(String(req.params.id))) throw new EmailAccessError(400, "Invalid application.");
    const token = await getServerToken(), id = String(req.params.id), app = await fsGet("org_applications", id, token);
    if (!app || !["pending", "waiting"].includes(String(app.status))) throw new EmailAccessError(409, "This application can no longer be changed.");
    const changes = { status: "waiting", infoRequest: body.data.message.trim(), requestedAt: new Date().toISOString(), response: "", emailDecisionId: randomUUID(), emailDecisionPending: true };
    const updated = await fsMutateApplicationState(id, token, current => {
      if (!current || !["pending", "waiting"].includes(String(current.status))) throw new EmailAccessError(409, "The application changed. Refresh its status.");
      if (current.status === "waiting" && current.infoRequest === changes.infoRequest) return { result: current };
      return { patch: changes, result: { ...current, ...changes } };
    });
    await applicationEmails(id, updated, "waiting");
    res.json({ ok: true });
  } catch (e) { fail(req, res, e); }
});
export default router;
