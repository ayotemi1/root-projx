import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  firebaseSignUp,
  firebaseSignIn,
  firebaseUpdateProfile,
  fsGet,
  fsPatch,
} from "../lib/firebase-rest.js";
import { requireAuth } from "../lib/auth.js";
import { brevoAddContact, brevoSendEmail, welcomeEmailHtml } from "../lib/brevo.js";

const router = Router();

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
// Limits repeated attempts from a single IP to prevent brute-force attacks.
// State is per-process; a restart clears it (acceptable for our scale).
interface RateBucket { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>();

function makeRateLimiter(maxRequests: number, windowMs: number) {
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
    const { name, email, phone, password, accountType, orgName, country, registrationNumber } = req.body as {
      name: string;
      email: string;
      phone?: string;
      password: string;
      accountType: "supporter" | "organisation";
      orgName?: string;
      country?: string;
      registrationNumber?: string;
    };

    if (!name || !email || !password || !accountType) {
      res.status(400).json({ error: "name, email, password and accountType are required" });
      return;
    }
    if (!["supporter", "organisation"].includes(accountType)) {
      res.status(400).json({ error: "accountType must be supporter or organisation" });
      return;
    }
    if (accountType === "organisation" && !orgName) {
      res.status(400).json({ error: "orgName is required for organisation accounts" });
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
    if (accountType === "organisation") {
      userDoc.orgName = orgName ?? null;
      userDoc.country = country ?? null;
      userDoc.registrationNumber = registrationNumber ?? null;
    }
    await fsPatch("users", uid, userDoc, initialToken);

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
        subject: "Welcome to Root ProjX 🌱",
        htmlContent: welcomeEmailHtml(name),
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

    res.json({
      token: idToken,
      user: {
        id: uid,
        name: userData.name,
        email: userData.email,
        phone: userData.phone ?? null,
        accountType: userData.accountType,
        avatarInitials: userData.avatarInitials,
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
    const payload: Record<string, unknown> = {
      id: uid,
      name: userData.name,
      email: userData.email,
      phone: userData.phone ?? null,
      accountType: userData.accountType,
      avatarInitials: userData.avatarInitials,
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
