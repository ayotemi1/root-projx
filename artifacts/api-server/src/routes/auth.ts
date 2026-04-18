import { Router } from "express";
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

function avatarInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

// POST /auth/register
router.post("/auth/register", async (req, res) => {
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
    if (!["supporter", "organisation"].includes(accountType)) {
      res.status(400).json({ error: "accountType must be supporter or organisation" });
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
    const userDoc = {
      uid,
      name,
      email: email.toLowerCase(),
      phone: phone ?? null,
      accountType,
      avatarInitials: initials,
      createdAt: now,
    };
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
router.post("/auth/login", async (req, res) => {
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
    res.json({
      id: uid,
      name: userData.name,
      email: userData.email,
      phone: userData.phone ?? null,
      accountType: userData.accountType,
      avatarInitials: userData.avatarInitials,
      createdAt: userData.createdAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
