import { createHmac, timingSafeEqual } from "node:crypto";
import { getAdminTokenValue } from "./admin-auth.js";

const PREFIX = "org-admin.";
function signature(payload: string): string {
  return createHmac("sha256", getAdminTokenValue()).update(payload).digest("hex");
}

/** Short-lived delegation, never a Firebase login or an organisation password. */
export function createOrganisationAccess(orgId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ orgId, expires: now + 60 * 60 * 1000 })).toString("base64url");
  return `${PREFIX}${payload}.${signature(payload)}`;
}

export function resolveOrganisationAccess(token: string, now = Date.now()): string | null {
  if (!token.startsWith(PREFIX)) return null;
  try {
    const [payload, sig, extra] = token.slice(PREFIX.length).split(".");
    if (!payload || !sig || extra) return null;
    const expected = signature(payload);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof value.orgId === "string" && /^[\w-]+$/.test(value.orgId) &&
      typeof value.expires === "number" && value.expires > now ? value.orgId : null;
  } catch { return null; }
}

/** Deliberately exclude banking, payment, account and admin operations. */
export function organisationAccessAllows(orgId: string, method: string, originalUrl: string): boolean {
  const path = originalUrl.split("?")[0];
  if (/^\/api\/post-viewer\/(?:post|update)\/[A-Za-z0-9_-]+(?:\/activity|\/like|\/comments(?:\/[A-Za-z0-9_-]+\/like)?)?$/.test(path ?? "")) {
    return ["GET", "POST", "PUT"].includes(method);
  }
  const root = `/api/organisations/${orgId}`;
  if (path === root || path?.startsWith(`${root}/`)) {
    if (/\/(payout|stripe|wise|bank)/i.test(path.slice(root.length))) {
      return method === "GET";
    }
    return method !== "DELETE" || path !== root;
  }
  return (path === "/api/payouts/my" && method === "GET") ||
    (path?.startsWith("/api/uploads/") && method === "POST") ||
    (path === "/api/uploads" && method === "POST") ||
    (path === "/api/feed" && method === "POST") ||
    (path === "/api/feed/managed" && method === "GET") ||
    (/^\/api\/feed\/[\w-]+\/status$/.test(path ?? "") && method === "PATCH") ||
    (path === `/api/feed/org/${orgId}` && method === "GET") ||
    (path === "/api/campaigns/assist/status" && method === "GET") ||
    (path === "/api/campaigns/assist" && method === "POST");
}
