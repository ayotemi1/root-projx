import { createHmac, timingSafeEqual } from "node:crypto";
import { fsGet, getServerToken } from "./firebase-rest.js";
import { organisationAccessDecision, type OrganisationApprovalStatus } from "./organisation-approval.js";

type Doc = Record<string, unknown>;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const PREFIX = "org-team.";
export class OrganisationTeamError extends Error {
  constructor(public status: number, message = "This organisation account isn't available to you.") { super(message); }
}
export function managerIds(doc: Doc | null): string[] {
  return Array.isArray(doc?.managerIds) ? doc.managerIds.filter((id): id is string => typeof id === "string" && UID.test(id)) : [];
}
const signature = (payload: string) => {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("Organisation access signing is unavailable");
  return createHmac("sha256", key).update(`organisation-manager-v1:${payload}`).digest("hex");
};
export function createManagerSession(orgId: string, actorId: string, now = Date.now()) {
  if (typeof orgId !== "string" || typeof actorId !== "string" || !UID.test(orgId) || !UID.test(actorId) || orgId === actorId) throw new OrganisationTeamError(400);
  const payload = Buffer.from(JSON.stringify({ orgId, actorId, expires: now + 60 * 60_000 })).toString("base64url");
  return `${PREFIX}${payload}.${signature(payload)}`;
}
export function parseManagerSession(token: string, now = Date.now()): { orgId: string; actorId: string } | null {
  if (!token.startsWith(PREFIX)) return null;
  try {
    const [payload, sig, extra] = token.slice(PREFIX.length).split(".");
    if (!payload || !sig || extra) return null;
    const expected = signature(payload);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof value.orgId === "string" && typeof value.actorId === "string" &&
      UID.test(value.orgId) && UID.test(value.actorId) && value.orgId !== value.actorId &&
      typeof value.expires === "number" && value.expires > now && value.expires <= now + 60 * 60_000
      ? { orgId: value.orgId, actorId: value.actorId } : null;
  } catch { return null; }
}
/** Positive content-only allowlist: financial reads and owner/team/admin
 * operations are deliberately excluded. */
export function managerAccessAllows(orgId: string, method: string, originalUrl: string): boolean {
  if (!UID.test(orgId)) return false;
  const bookmarkPath = originalUrl.split("?")[0];
  if (bookmarkPath === "/api/bookmarks") return method === "GET" || method === "POST";
  if (/^\/api\/bookmarks\/[A-Za-z0-9_-]+$/.test(bookmarkPath ?? "")) return method === "DELETE";
  if (/^\/api\/post-viewer\/(?:post|update)\/[A-Za-z0-9_-]+(?:\/activity|\/like|\/comments(?:\/[A-Za-z0-9_-]+\/like)?)?$/.test(originalUrl.split("?")[0]!)) {
    return ["GET", "POST", "PUT"].includes(method);
  }
  const path = originalUrl.split("?")[0]!, root = `/api/organisations/${orgId}`;
  if (path === root) return method === "GET" || method === "PATCH";
  const tail = path.startsWith(`${root}/`) ? path.slice(root.length) : "";
  if (/^\/campaigns(?:\/manage|\/[A-Za-z0-9_-]+(?:\/preview)?)?$/.test(tail)) return ["GET", "POST", "PATCH", "DELETE"].includes(method);
  if (/^\/walkthrough(?:\/events)?$/.test(tail)) return ["GET", "POST", "PATCH"].includes(method);
  if (tail === "/dashboard-summary" || tail === "/analytics") return method === "GET";
  if (tail === "/images") return method === "POST";
  if (path === "/api/organisation-team/session") return method === "GET";
  if (path === "/api/auth/logout") return method === "POST";
  if (path === "/api/supporter/account") return method === "GET";
  if (path === "/api/supporter/account/settings") return method === "PATCH";
  if (path === "/api/supporter-notifications") return method === "GET";
  if (/^\/api\/supporter-notifications\/n_[A-Za-z0-9_-]+\/read$/.test(path)) return method === "POST";
  if (path === "/api/messaging/context" || path === "/api/messaging/messages") return method === "GET";
  if (path === "/api/messaging/conversations") return method === "GET" || method === "POST";
  if (/^\/api\/messaging\/conversations\/[A-Za-z0-9_-]+\/(?:messages|read)$/.test(path)) return method === "POST";
  if (path === "/api/feed") return method === "GET" || method === "POST";
  if (path === "/api/feed/managed" || path === `/api/feed/org/${orgId}`) return method === "GET";
  if (/^\/api\/feed\/[A-Za-z0-9_-]+\/status$/.test(path)) return method === "PATCH";
  if (["/api/uploads/media", "/api/uploads/video/request", "/api/uploads/video/complete"].includes(path)) return method === "POST";
  if (path === "/api/campaigns/assist/status") return method === "GET";
  if (path === "/api/campaigns/assist") return method === "POST";
  return false;
}
export async function activeManagedOrganisation(orgId: string, token: string): Promise<Doc> {
  if (!UID.test(orgId)) throw new OrganisationTeamError(404);
  const [org, owner] = await Promise.all([fsGet("organisations", orgId, token), fsGet("users", orgId, token)]);
  if (!org || org.deletedAt || !owner || owner.accountType !== "organisation" ||
    organisationAccessDecision("organisation", owner.approvalStatus as OrganisationApprovalStatus) === "deny") throw new OrganisationTeamError(404);
  return org;
}
export function managedOrganisationView(orgId: string, org: Doc) {
  return { id: orgId, name: String(org.name || "Organisation"), logo: typeof org.logo === "string" ? org.logo : null };
}
export async function validateManagerSession(bearer: string) {
  const session = parseManagerSession(bearer);
  if (!session) return null;
  const token = await getServerToken();
  const [access, actor] = await Promise.all([
    fsGet("organisation_messaging_access", session.orgId, token), fsGet("users", session.actorId, token),
  ]);
  if (!managerIds(access).includes(session.actorId) || !actor || actor.deletedAt ||
    !["supporter", "organisation"].includes(String(actor.accountType)) ||
    actor.accountType === "organisation" &&
      organisationAccessDecision("organisation", actor.approvalStatus as OrganisationApprovalStatus) === "deny") return null;
  let org: Doc;
  try { org = await activeManagedOrganisation(session.orgId, token); }
  catch (e) { if (e instanceof OrganisationTeamError) return null; throw e; }
  return { ...session, actorAccountType: String(actor.accountType), org };
}
