import { Router } from "express";
import {
  ListManagedOrganisationsResponse, GetOrganisationManagersParams, GetOrganisationManagersResponse,
  AddOrganisationManagerBody, RemoveOrganisationManagerParams, StartOrganisationManagerSessionParams,
  StartOrganisationManagerSessionResponse, GetOrganisationManagerSessionResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth.js";
import { fsGet, getServerToken } from "../lib/firebase-rest.js";
import {
  OrganisationTeamError, activeManagedOrganisation, changeOrganisationManager, createManagerSession,
  managedOrganisations, managedOrganisationView, managerIds, organisationManagers,
} from "../lib/organisation-team.js";

const router = Router();
router.use("/organisation-team", requireAuth, (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); res.vary("Authorization"); next(); });
const fail = (req: any, res: any, e: unknown) => {
  req.log?.warn("Organisation team operation could not be completed");
  res.status(e instanceof OrganisationTeamError ? e.status : 503).json({ error: e instanceof OrganisationTeamError ? e.message : "Something went wrong, please try again" });
};
router.get("/organisation-team", async (req, res) => {
  try { res.json(ListManagedOrganisationsResponse.parse(await managedOrganisations(req.user!))); }
  catch (e) { fail(req, res, e); }
});
router.get("/organisation-team/session", async (req, res) => {
  try {
    if (!req.user!.actingUserId) throw new OrganisationTeamError(403);
    res.json(GetOrganisationManagerSessionResponse.parse(managedOrganisationView(req.user!.userId,
      await activeManagedOrganisation(req.user!.userId, await getServerToken()))));
  } catch (e) { fail(req, res, e); }
});
router.get("/organisation-team/:orgId", async (req, res) => {
  try {
    const { orgId } = GetOrganisationManagersParams.parse(req.params);
    res.json(GetOrganisationManagersResponse.parse(await organisationManagers(req.user!, orgId)));
  } catch (e) { fail(req, res, e); }
});
router.post("/organisation-team/:orgId", async (req, res) => {
  try {
    const params = GetOrganisationManagersParams.safeParse(req.params), body = AddOrganisationManagerBody.strict().safeParse(req.body);
    if (!params.success || !body.success) throw new OrganisationTeamError(400, "Enter a valid account ID.");
    res.json(GetOrganisationManagersResponse.parse(await changeOrganisationManager(req.user!, params.data.orgId, body.data.userId, true)));
  } catch (e) { fail(req, res, e); }
});
router.delete("/organisation-team/:orgId/:userId", async (req, res) => {
  try {
    const { orgId, userId } = RemoveOrganisationManagerParams.parse(req.params);
    res.json(GetOrganisationManagersResponse.parse(await changeOrganisationManager(req.user!, orgId, userId, false)));
  } catch (e) { fail(req, res, e); }
});
router.post("/organisation-team/:orgId/session", async (req, res) => {
  try {
    if (req.user!.actingUserId) throw new OrganisationTeamError(403);
    const { orgId } = StartOrganisationManagerSessionParams.parse(req.params), token = await getServerToken();
    if (!managerIds(await fsGet("organisation_messaging_access", orgId, token)).includes(req.user!.userId)) throw new OrganisationTeamError(403);
    const org = await activeManagedOrganisation(orgId, token);
    res.json(StartOrganisationManagerSessionResponse.parse({
      token: createManagerSession(orgId, req.user!.userId), organisation: managedOrganisationView(orgId, org),
    }));
  } catch (e) { fail(req, res, e); }
});
export default router;
