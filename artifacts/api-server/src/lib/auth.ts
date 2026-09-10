import type { Request, Response, NextFunction } from "express";
import { firebaseLookup, fsGet, getServerToken } from "./firebase-rest.js";
import {
  organisationAccessDecision,
  type OrganisationApprovalStatus,
} from "./organisation-approval.js";

export interface AuthPayload {
  userId: string;
  email: string;
  accountType: string;
  approvalStatus?: OrganisationApprovalStatus;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

async function resolveUser(token: string): Promise<AuthPayload | null> {
  const firebaseUser = await firebaseLookup(token);
  if (!firebaseUser) return null;

  const userDoc = await fsGet("users", firebaseUser.uid, token);
  const accountType = (userDoc?.accountType as string) ?? "supporter";
  const rawApprovalStatus = userDoc?.approvalStatus;
  const approvalStatus =
    rawApprovalStatus === "pending" || rawApprovalStatus === "approved" || rawApprovalStatus === "declined"
      ? rawApprovalStatus
      : undefined;

  return { userId: firebaseUser.uid, email: firebaseUser.email, accountType, approvalStatus };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized — no token provided" });
    return;
  }
  try {
    const token = authHeader.slice(7);
    const user = await resolveUser(token);
    if (!user) {
      res.status(401).json({ error: "Unauthorized — invalid or expired token" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized — invalid or expired token" });
  }
}

export async function requireApprovedOrganisation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(403).json({ error: "Only approved organisation accounts can access this feature" });
    return;
  }
  const decision = organisationAccessDecision(user.accountType, user.approvalStatus);
  if (decision === "deny") {
    res.status(403).json({ error: "Your organisation must be approved before accessing this feature" });
    return;
  }
  if (decision === "allow") {
    next();
    return;
  }

  try {
    const serverToken = await getServerToken();
    const legacyOrganisation = await fsGet("organisations", user.userId, serverToken);
    if (!legacyOrganisation) {
      res.status(403).json({ error: "Your organisation must be approved before accessing this feature" });
      return;
    }
    next();
  } catch {
    res.status(503).json({ error: "Could not verify organisation approval status" });
  }
}

// ── Admin-only middleware ──────────────────────────────────────────────────────
// Requires X-Admin-Secret header matching the ADMIN_SECRET env var.
// Use for platform-operator endpoints (disbursements, etc).
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(503).json({ error: "Admin access is not configured on this server." });
    return;
  }
  const provided = req.headers["x-admin-secret"];
  if (!provided || provided !== secret) {
    res.status(401).json({ error: "Unauthorized — invalid admin secret." });
    return;
  }
  next();
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }
  try {
    const token = authHeader.slice(7);
    const user = await resolveUser(token);
    if (user) req.user = user;
  } catch {
    // ignore — optional
  }
  next();
}
