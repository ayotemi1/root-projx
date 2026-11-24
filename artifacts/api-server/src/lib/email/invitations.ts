import { randomBytes } from "node:crypto";
import type { AuthPayload } from "../auth.ts";
import { fsAcceptEmailInvitation, fsCreateIfAbsent, fsGet, fsMutateEmailState, fsQuery, getServerToken } from "../firebase-rest.ts";
import { activeManagedOrganisation } from "../organisation-team.ts";
import { emailRecordId, openEmail, sealEmail } from "./crypto.ts";
import { normaliseEmailAddress } from "./delivery.ts";
import { EmailAccessError, preferenceIdentity } from "./preferences.ts";
import { submitTemplateEmail } from "./service.ts";
import { EMAIL_SITE_URL } from "./templates.ts";

export async function teamMailOwner(actor: AuthPayload) {
  if (actor.actingUserId || actor.adminDelegated || actor.accountType !== "organisation") {
    throw new EmailAccessError(403, "Only the organisation owner can invite managers.");
  }
  return activeManagedOrganisation(actor.userId, await getServerToken());
}
export async function listInvitations(actor: AuthPayload) {
  await teamMailOwner(actor);
  const rows = await fsQuery("email_invitations", [{ field: "orgId", op: "EQUAL", value: actor.userId }], await getServerToken(), { limit: 100 });
  return rows.map(row => {
    const data = openEmail<{ email: string }>(String(row.encryptedPayload), String(row._id));
    return { id: String(row._id), email: data.email,
      status: row.status === "pending" && Date.parse(String(row.expiresAt)) <= Date.now() ? "expired" : String(row.status),
      expiresAt: String(row.expiresAt) };
  });
}
export async function inviteTeamMember(actor: AuthPayload, address: string) {
  const org = await teamMailOwner(actor), email = normaliseEmailAddress(address);
  if (preferenceIdentity(email) === preferenceIdentity(actor.email)) throw new EmailAccessError(400, "The owner already manages this account.");
  const token = await getServerToken();
  const owner = await fsGet("users", actor.userId, token);
  const newKey = randomBytes(32).toString("base64url");
  const newId = emailRecordId("team-invitation", newKey);
  const newExpiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const newVars = {
    inviter_name: typeof owner?.name === "string" ? owner.name : String(org.name),
    org_name: String(org.name), invite_url: `${EMAIL_SITE_URL}/team-invitation#key=${newKey}`,
  };
  const reservationId = emailRecordId("team-invitation-reservation", `${actor.userId}:${preferenceIdentity(email)}`);
  const reservation = await fsGet("email_events", reservationId, token);
  const previous = typeof reservation?.invitationId === "string"
    ? await fsGet("email_invitations", reservation.invitationId, token) : null;
  const previousConsumed = previous?.status === "accepted";
  const selected = await fsMutateEmailState("email_events", reservationId, token, current => {
    if (current && Date.parse(String(current.expiresAt)) > Date.now() &&
        !(previousConsumed && current.invitationId === reservation?.invitationId)) {
      return { result: openEmail<{ id: string; expiresAt: string; vars: typeof newVars }>(String(current.encryptedPayload), reservationId) };
    }
    const value = { id: newId, expiresAt: newExpiresAt, vars: newVars };
    return { patch: {
      kind: "team-invitation-reservation", invitationId: newId, expiresAt: newExpiresAt,
      encryptedPayload: sealEmail(value, reservationId),
    }, result: value };
  });
  // Reservation and immutable token material survive a crash before creation.
  // Concurrent double clicks use the same token and the same outbox event.
  const { id, vars } = selected, expiresAt = new Date(selected.expiresAt);
  await fsCreateIfAbsent("email_invitations", id, {
    orgId: actor.userId, recipientDigest: preferenceIdentity(email), status: "pending",
    createdAt: new Date().toISOString(), expiresAt: expiresAt.toISOString(),
    encryptedPayload: sealEmail({ email, vars }, id),
  }, token);
  await submitTemplateEmail(`team-invitation:${id}`, "11-org-team-invite", email, vars, expiresAt);
  return { id, email, status: "pending", expiresAt: expiresAt.toISOString() };
}
export async function acceptTeamInvitation(actor: AuthPayload, accessKey: string) {
  if (actor.actingUserId || actor.adminDelegated) throw new EmailAccessError(403, "Sign in to your own account to accept.");
  if (!/^[A-Za-z0-9_-]{43}$/.test(accessKey)) throw new EmailAccessError(400, "This invitation link is invalid.");
  if (actor.accountType === "organisation") await activeManagedOrganisation(actor.userId, await getServerToken());
  const id = emailRecordId("team-invitation", accessKey);
  try {
    await fsAcceptEmailInvitation(id, actor.userId, preferenceIdentity(actor.email), await getServerToken());
  } catch (error) {
    // Messages from this bounded helper never contain tokens or addresses.
    throw new EmailAccessError(409, error instanceof Error ? error.message : "Invitation could not be accepted.");
  }
  return { ok: true };
}
