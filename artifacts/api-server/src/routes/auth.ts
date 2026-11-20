import { Router } from "express";
import { PASSWORD_RESET_MESSAGE, passwordResetEmail } from "../lib/password-reset.js";
import { signInDiagnosticCode } from "../lib/sign-in-diagnostics.js";
import type { Request, Response, NextFunction } from "express";
import {
  firebaseSignUp,
  firebaseSignIn,
  firebaseUpdateProfile,
  firebaseSendPasswordResetEmail,
  firebaseResetPassword,
  fsGet,
  fsPatch,
  getServerToken,
} from "../lib/firebase-rest.js";
import { requireAuth } from "../lib/auth.js";
import { brevoAddContact, brevoSendEmail, welcomeEmailHtml, internalNotificationHtml } from "../lib/brevo.js";

const TEAM_EMAIL = process.env.TEAM_EMAIL ?? "info@rootprojx.com";

const router = Router();

async function effectiveApprovalStatus(
  uid: string,
  userData: Record<string, unknown>,
): Promise<"pending" | "approved" | "declined" | null> {
  const status = userData.approvalStatus;
  if (status === "pending" || status === "approved" || status === "declined") return status;
  if (userData.accountType !== "organisation") return null;
  const serverToken = await getServerToken();
  const establishedOrganisation = await fsGet("organisations", uid, serverToken);
  return establishedOrganisation ? "approved" : "pending";
}

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
// Limits repeated attempts from a single IP to prevent brute-force attacks.
// State is per-process; a restart clears it (acceptable for our scale).
interface RateBucket { count: number; resetAt: number }

function makeRateLimiter(maxRequests: number, windowMs: number) {
  const rateBuckets = new Map<string, RateBucket>();
  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress
      ?? "unknown";
    const now = Date.now();
    let bucket = rateBuckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      rateBuckets.set(ip, bucket);
    }
    bucket.count++;
    if (bucket.count > maxRequests) {
      res.status(429).json({ error: "Too many attempts — please try again later" });
      return;
    }
    next();
  };
}

// 10 attempts per 15 minutes on auth endpoints
const authRateLimit = makeRateLimiter(10, 15 * 60 * 1000);
const passwordResetRateLimit = makeRateLimiter(5, 15 * 60 * 1000);
const passwordResetActionRateLimit = makeRateLimiter(30, 15 * 60 * 1000);

// Firebase owns token generation, expiry and single use.
// Never look up accounts or disclose whether a particular address is registered.
router.post("/auth/forgot-password", passwordResetRateLimit, async (req, res) => {
  const email = passwordResetEmail(req.body);
  if (!email) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  try {
    await firebaseSendPasswordResetEmail(email);
  } catch (err) {
    const code = (err as { firebaseCode?: string }).firebaseCode;
    if (code !== "EMAIL_NOT_FOUND") {
      // Do not put email addresses, passwords, tokens or provider payloads in logs.
      req.log?.error("Firebase password reset could not be requested");
      res.status(503).json({ error: "We couldn't send a reset link right now. Please try again later." });
      return;
    }
  }
  res.json({ message: PASSWORD_RESET_MESSAGE });
});

// Public, token-authorised action. No admin lookup or password storage.
router.post("/auth/reset-password", passwordResetActionRateLimit, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { oobCode, newPassword } = req.body ?? {};
  if (typeof oobCode !== "string" || !oobCode.trim() || oobCode.length > 2048) {
    res.status(400).json({ error: "This reset link is invalid. Request a new link.", code: "RESET_LINK_INVALID" });
    return;
  }
  if (newPassword !== undefined && (typeof newPassword !== "string" || newPassword.length < 6 || newPassword.length > 4096)) {
    res.status(400).json({ error: "Choose a password with at least 6 characters.", code: "WEAK_PASSWORD" });
    return;
  }
  try {
    await firebaseResetPassword(oobCode, newPassword);
    res.json({ message: newPassword === undefined ? "Reset link is valid." : "Your password has been changed. You can now sign in." });
  } catch (err) {
    const code = (err as { firebaseCode?: string }).firebaseCode;
    if (code === "EXPIRED_OOB_CODE" || code === "INVALID_OOB_CODE") {
      res.status(400).json({
        error: code === "EXPIRED_OOB_CODE"
          ? "This reset link has expired. Request a new link."
          : "This reset link is invalid or has already been used. Request a new link.",
        code: code === "EXPIRED_OOB_CODE" ? "RESET_LINK_EXPIRED" : "RESET_LINK_INVALID",
      });
    } else if (code === "WEAK_PASSWORD" || code === "PASSWORD_DOES_NOT_MEET_REQUIREMENTS") {
      res.status(400).json({ error: "This password doesn't meet the account's security requirements. Choose a stronger password.", code: "WEAK_PASSWORD" });
    } else {
      req.log?.error("Firebase password reset action could not be completed");
      res.status(503).json({ error: "We couldn't reset your password right now. Please try again.", code: "RESET_UNAVAILABLE" });
    }
  }
});

function avatarInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

// POST /auth/register
router.post("/auth/register", authRateLimit, async (req, res) => {
  try {
    const { name, email, phone, password, accountType } = req.body as {
      name: string;
      email: string;
      phone?: string;
      password: string;
      accountType: "supporter" | "organisation";
    };

    if (!name || !email || !password || !accountType) {
      res.status(400).json({ error: "name, email, password and accountType are required" });
      return;
    }
    if (accountType !== "supporter") {
      res.status(400).json({ error: "Organisation accounts must be created through the application process" });
      return;
    }

    // 1. Create Firebase Auth user via REST
    let uid: string;
    let initialToken: string;
    try {
      const result = await firebaseSignUp(email, password);
      uid = result.uid;
      initialToken = result.idToken;
    } catch (err: unknown) {
      const code = (err as { firebaseCode?: string }).firebaseCode ?? "";
      if (code.includes("EMAIL_EXISTS")) {
        res.status(400).json({ error: "An account with this email already exists" });
      } else if (code.includes("WEAK_PASSWORD")) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
      } else {
        res.status(400).json({ error: "Registration failed — check email format and password length" });
      }
      return;
    }

    // 2. Set display name in Firebase Auth
    await firebaseUpdateProfile(initialToken, name);

    // 3. Create Firestore user document (authenticated as the new user)
    const initials = avatarInitials(name);
    const now = new Date().toISOString();
    const userDoc: Record<string, unknown> = {
      uid,
      name,
      email: email.toLowerCase(),
      phone: phone ?? null,
      accountType,
      avatarInitials: initials,
      createdAt: now,
    };
    await fsPatch("users", uid, userDoc, initialToken);

    // Mirror supporters to their own collection for dedicated admin tracking
    if (accountType === "supporter") {
      try {
        const serverToken = await getServerToken();
        await fsPatch("supporters", uid, {
          uid,
          name,
          email: email.toLowerCase(),
          phone: phone ?? null,
          signedUpAt: now,
          createdAt: now,
        }, serverToken);
      } catch (mirrorErr) {
        req.log.warn({ err: mirrorErr }, "supporters mirror write failed (non-fatal)");
      }
    }

    // Fire-and-forget: add contact to Brevo + send welcome email
    // Errors here must never block the registration response
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0] ?? name;
    const lastName = nameParts.slice(1).join(" ") || undefined;
    const newsletterListId = process.env.BREVO_NEWSLETTER_LIST_ID
      ? [parseInt(process.env.BREVO_NEWSLETTER_LIST_ID, 10)]
      : undefined;

    Promise.all([
      brevoAddContact({
        email: email.toLowerCase(),
        firstName,
        lastName,
        listIds: newsletterListId,
      }),
      brevoSendEmail({
        to: [{ email: email.toLowerCase(), name }],
        subject: "Welcome to Root ProjX",
        htmlContent: welcomeEmailHtml(name),
      }),
      // Internal notification to team for tracking
      brevoSendEmail({
        to: [{ email: TEAM_EMAIL, name: "Root ProjX Team" }],
        subject: `New supporter sign-up: ${name}`,
        htmlContent: internalNotificationHtml({
          type: "supporter_signup",
          name,
          email: email.toLowerCase(),
        }),
      }),
    ]).catch((err) => {
      // Log but never throw — registration already succeeded
      console.error("[Brevo] Welcome email/contact error:", err);
    });

    res.status(201).json({
      token: initialToken,
      user: {
        id: uid,
        name,
        email: email.toLowerCase(),
        phone: phone ?? null,
        accountType,
        avatarInitials: initials,
        approvalStatus: undefined,
        createdAt: now,
      },
    });
  } catch (err) {
    req.log.error({ err }, "register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
router.post("/auth/login", authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    let idToken: string;
    let uid: string;
    try {
      const result = await firebaseSignIn(email, password);
      idToken = result.idToken;
      uid = result.uid;
    } catch (err: unknown) {
      req.log.warn({ firebaseCode: signInDiagnosticCode(err) }, "Firebase sign-in rejected");
      const code = (err as { firebaseCode?: string }).firebaseCode ?? "";
      if (
        code.includes("INVALID_LOGIN_CREDENTIALS") ||
        code.includes("EMAIL_NOT_FOUND") ||
        code.includes("INVALID_PASSWORD") ||
        code.includes("INVALID_EMAIL")
      ) {
        res.status(401).json({ error: "Invalid email or password" });
      } else {
        res.status(401).json({ error: "Invalid email or password" });
      }
      return;
    }

    // Fetch user profile from Firestore
    const userData = await fsGet("users", uid, idToken);
    if (!userData) {
      res.status(404).json({ error: "User profile not found" });
      return;
    }
    const approvalStatus = await effectiveApprovalStatus(uid, userData);

    res.json({
      token: idToken,
      user: {
        id: uid,
        name: userData.name,
        email: userData.email,
        phone: userData.phone ?? null,
        accountType: userData.accountType,
        avatarInitials: userData.avatarInitials,
        approvalStatus,
        createdAt: userData.createdAt ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/logout
// Firebase REST API has no server-side token revocation without Admin SDK.
// The client should discard their token. We return success immediately.
router.post("/auth/logout", requireAuth, async (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const userData = await fsGet("users", uid, token);
    if (!userData) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const approvalStatus = await effectiveApprovalStatus(uid, userData);
    const payload: Record<string, unknown> = {
      id: uid,
      name: userData.name,
      email: userData.email,
      phone: userData.phone ?? null,
      accountType: userData.accountType,
      avatarInitials: userData.avatarInitials,
      approvalStatus,
      createdAt: userData.createdAt ?? null,
    };
    if (userData.accountType === "organisation") {
      payload.orgName = userData.orgName ?? null;
      payload.country = userData.country ?? null;
    }
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
