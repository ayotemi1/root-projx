import type { AuthPayload } from "./auth.js";
import { fsGet, fsMutateMessaging, fsQuery, getServerToken } from "./firebase-rest.js";
import { OrganisationTeamError, activeManagedOrganisation, managedOrganisationView, managerIds } from "./organisation-team-access.js";
export { OrganisationTeamError, activeManagedOrganisation, managedOrganisationView, managerIds, createManagerSession } from "./organisation-team-access.js";
const UID = /^[A-Za-z0-9_-]{1,128}$/;
async function ownerOnly(actor: AuthPayload, orgId: string, token: string) {
  if (actor.actingUserId || actor.accountType !== "organisation" || actor.userId !== orgId) throw new OrganisationTeamError(403);
  return activeManagedOrganisation(orgId, token);
}
export async function organisationManagers(actor: AuthPayload, orgId: string) {
  const token = await getServerToken();
  await ownerOnly(actor, orgId, token);
  const access = await fsGet("organisation_messaging_access", orgId, token);
  const members = [];
  for (const userId of managerIds(access)) {
    const user = await fsGet("users", userId, token);
    members.push({ userId, name: typeof user?.name === "string" ? user.name : "Account" });
  }
  return { ownerId: orgId, members };
}
export async function changeOrganisationManager(actor: AuthPayload, orgId: string, userId: string, add: boolean) {
  const token = await getServerToken();
  await ownerOnly(actor, orgId, token);
  if (!UID.test(userId) || userId === orgId) throw new OrganisationTeamError(400, "Use the team member's account ID, not the owner's.");
  if (add) {
    const user = await fsGet("users", userId, token);
    if (!user || !["supporter", "organisation"].includes(String(user.accountType)) || user.deletedAt)
      throw new OrganisationTeamError(400, "We couldn't find that account. Ask them to copy their account ID from their Inbox.");
    if (user.accountType === "organisation") await activeManagedOrganisation(userId, token);
  }
  await fsMutateMessaging("organisation_messaging_access", orgId, token, current => {
    const ids = new Set(managerIds(current));
    if (add) ids.add(userId); else ids.delete(userId);
    if (ids.size > 25) throw new OrganisationTeamError(400, "You can add up to 25 account managers.");
    return { patch: { managerIds: [...ids], updatedAt: new Date().toISOString(), updatedBy: actor.userId }, result: null };
  });
  return organisationManagers(actor, orgId);
}
export async function managedOrganisations(actor: AuthPayload) {
  const token = await getServerToken();
  const rows = await fsQuery("organisation_messaging_access", [{ field: "managerIds", op: "ARRAY_CONTAINS", value: actor.userId }], token);
  const organisations = [];
  for (const row of rows) {
    if (!managerIds(row).includes(actor.userId) || typeof row._id !== "string") continue;
    try { organisations.push(managedOrganisationView(row._id, await activeManagedOrganisation(row._id, token))); }
    catch (e) { if (!(e instanceof OrganisationTeamError)) throw e; }
  }
  return { organisations };
}
