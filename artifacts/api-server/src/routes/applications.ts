import { Router } from "express";
import crypto from "crypto";
import {
  fsCreate,
  fsPatch,
  fsList,
  fsQuery,
  getServerToken,
  firebaseSignUp,
  firebaseUpdateProfile,
} from "../lib/firebase-rest.js";
import {
  brevoSendEmail,
  orgApplicationReceivedHtml,
  orgAcceptedHtml,
  orgDeclinedHtml,
  internalNotificationHtml,
} from "../lib/brevo.js";

const router = Router();

const TEAM_EMAIL = process.env.TEAM_EMAIL ?? "info@rootprojx.com";

// ── Admin auth ────────────────────────────────────────────────────────────────

function getAdminTokenValue(): string {
  const pwd = process.env.ADMIN_PASSWORD ?? "rootprojx-admin";
  return crypto.createHmac("sha256", pwd).update("rootprojx-admin-session").digest("hex");
}

function requireAdmin(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction): void {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || token !== getAdminTokenValue()) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

function generateTempPassword(): string {
  return crypto.randomBytes(8).toString("hex");
}

function avatarInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

// ── Public: submit org application ───────────────────────────────────────────

// POST /applications/org
router.post("/applications/org", async (req, res) => {
  try {
    const { orgName, contactName, email, sectors } = req.body as {
      orgName?: string;
      contactName?: string;
      email?: string;
      sectors?: string[];
    };

    if (!orgName?.trim() || !contactName?.trim() || !email?.trim()) {
      res.status(400).json({ error: "orgName, contactName and email are required" });
      return;
    }
    if (!Array.isArray(sectors) || sectors.length === 0) {
      res.status(400).json({ error: "At least one sector must be selected" });
      return;
    }

    const token = await getServerToken();
    const now = new Date().toISOString();

    // Check for duplicate pending application from same email
    const existing = await fsQuery(
      "org_applications",
      [{ field: "email", op: "EQUAL", value: email.toLowerCase().trim() },
       { field: "status", op: "EQUAL", value: "pending" }],
      token,
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "An application from this email is already under review" });
      return;
    }

    const applicationId = await fsCreate("org_applications", {
      orgName: orgName.trim(),
      contactName: contactName.trim(),
      email: email.toLowerCase().trim(),
      sectors,
      status: "pending",
      createdAt: now,
    }, token);

    // Fire-and-forget emails
    Promise.all([
      brevoSendEmail({
        to: [{ email: email.toLowerCase().trim(), name: contactName.trim() }],
        subject: `Application received — ${orgName.trim()}`,
        htmlContent: orgApplicationReceivedHtml({ orgName: orgName.trim(), contactName: contactName.trim() }),
      }),
      brevoSendEmail({
        to: [{ email: TEAM_EMAIL, name: "Root ProjX Team" }],
        subject: `New org application: ${orgName.trim()}`,
        htmlContent: internalNotificationHtml({
          type: "org_application",
          name: contactName.trim(),
          email: email.toLowerCase().trim(),
          orgName: orgName.trim(),
          sectors,
        }),
      }),
    ]).catch((err) => {
      console.error("[Brevo] org application email error:", err);
    });

    res.status(201).json({ id: applicationId, status: "pending" });
  } catch (err) {
    req.log.error({ err }, "POST /applications/org error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: login ──────────────────────────────────────────────────────────────

// POST /admin/login
router.post("/admin/login", async (req, res) => {
  try {
    const { password } = req.body as { password?: string };
    const adminPassword = process.env.ADMIN_PASSWORD ?? "rootprojx-admin";
    if (!password || password !== adminPassword) {
      res.status(401).json({ error: "Invalid admin password" });
      return;
    }
    res.json({ token: getAdminTokenValue() });
  } catch (err) {
    req.log.error({ err }, "POST /admin/login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: applications ───────────────────────────────────────────────────────

// GET /admin/applications?status=pending|approved|declined
router.get("/admin/applications", requireAdmin, async (req, res) => {
  try {
    const token = await getServerToken();
    const { status } = req.query as { status?: string };
    let apps: Array<Record<string, unknown>>;
    if (status && ["pending", "approved", "declined"].includes(status)) {
      apps = await fsQuery("org_applications", [{ field: "status", op: "EQUAL", value: status }], token);
    } else {
      apps = await fsList("org_applications", token);
    }
    // Sort newest first
    apps.sort((a, b) => {
      const da = typeof a.createdAt === "string" ? a.createdAt : "";
      const db = typeof b.createdAt === "string" ? b.createdAt : "";
      return db.localeCompare(da);
    });
    res.json(apps);
  } catch (err) {
    req.log.error({ err }, "GET /admin/applications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/applications/:id/approve
router.post("/admin/applications/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const serverToken = await getServerToken();

    // Get application
    const apps = await fsQuery("org_applications", [{ field: "_id", op: "EQUAL", value: id }], serverToken);
    const app = apps[0] as Record<string, unknown> | undefined;
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    if (app.status !== "pending") {
      res.status(400).json({ error: `Application is already ${app.status}` });
      return;
    }

    const orgName = app.orgName as string;
    const contactName = app.contactName as string;
    const email = app.email as string;
    const sectors = (app.sectors as string[]) ?? [];

    // Create Firebase Auth account for the org
    const tempPassword = generateTempPassword();
    let uid: string;
    let initialToken: string;
    try {
      const result = await firebaseSignUp(email, tempPassword);
      uid = result.uid;
      initialToken = result.idToken;
    } catch (err: unknown) {
      const code = (err as { firebaseCode?: string }).firebaseCode ?? "";
      if (code.includes("EMAIL_EXISTS")) {
        res.status(409).json({ error: "A Firebase account with this email already exists" });
      } else {
        req.log.error({ err }, "firebaseSignUp failed during approval");
        res.status(500).json({ error: "Failed to create organisation account" });
      }
      return;
    }

    await firebaseUpdateProfile(initialToken, contactName);

    const now = new Date().toISOString();
    const initials = avatarInitials(contactName);

    // Create user doc
    await fsPatch("users", uid, {
      uid,
      name: contactName,
      email,
      accountType: "organisation",
      orgName,
      avatarInitials: initials,
      createdAt: now,
    }, initialToken);

    // Create org profile
    await fsPatch("organisations", uid, {
      _id: uid,
      name: orgName,
      category: sectors[0] ?? "Community Development",
      categories: sectors,
      country: "Jamaica",
      city: null,
      description: "",
      mission: null,
      verified: true,
      followerCount: 0,
      totalRaised: 0,
      impactScore: 0,
      coverImage: null,
      logo: null,
      contact: { email },
      socialLinks: null,
      createdAt: now,
    }, serverToken);

    // Update application status
    await fsPatch("org_applications", id, { status: "approved", approvedAt: now, uid }, serverToken);

    // Send acceptance email
    brevoSendEmail({
      to: [{ email, name: contactName }],
      subject: `Your Root ProjX application has been approved 🎉`,
      htmlContent: orgAcceptedHtml({ orgName, contactName, email, tempPassword }),
    }).catch((err) => console.error("[Brevo] org accepted email error:", err));

    res.json({ ok: true, uid });
  } catch (err) {
    req.log.error({ err }, "POST /admin/applications/:id/approve error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/applications/:id/decline
router.post("/admin/applications/:id/decline", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const serverToken = await getServerToken();

    const apps = await fsQuery("org_applications", [{ field: "_id", op: "EQUAL", value: id }], serverToken);
    const app = apps[0] as Record<string, unknown> | undefined;
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    if (app.status !== "pending") {
      res.status(400).json({ error: `Application is already ${app.status}` });
      return;
    }

    const orgName = app.orgName as string;
    const contactName = app.contactName as string;
    const email = app.email as string;
    const now = new Date().toISOString();

    await fsPatch("org_applications", id, { status: "declined", declinedAt: now }, serverToken);

    brevoSendEmail({
      to: [{ email, name: contactName }],
      subject: `Update on your Root ProjX application`,
      htmlContent: orgDeclinedHtml({ orgName, contactName }),
    }).catch((err) => console.error("[Brevo] org declined email error:", err));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "POST /admin/applications/:id/decline error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: supporters ─────────────────────────────────────────────────────────

// GET /admin/supporters — reads from dedicated supporters collection
router.get("/admin/supporters", requireAdmin, async (req, res) => {
  try {
    const serverToken = await getServerToken();
    const supporters = await fsList("supporters", serverToken);
    supporters.sort((a, b) => {
      const da = typeof a.createdAt === "string" ? a.createdAt : "";
      const db = typeof b.createdAt === "string" ? b.createdAt : "";
      return db.localeCompare(da);
    });
    res.json(supporters);
  } catch (err) {
    req.log.error({ err }, "GET /admin/supporters error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: organisations ───────────────────────────────────────────────────────

// GET /admin/organisations — all approved orgs, sorted by name
router.get("/admin/organisations", requireAdmin, async (req, res) => {
  try {
    const serverToken = await getServerToken();
    const orgs = await fsList("organisations", serverToken);
    orgs.sort((a, b) => {
      const na = typeof a.name === "string" ? a.name : "";
      const nb = typeof b.name === "string" ? b.name : "";
      return na.localeCompare(nb);
    });
    res.json(orgs);
  } catch (err) {
    req.log.error({ err }, "GET /admin/organisations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/donations — all donations, newest first (limit 200)
router.get("/admin/donations", requireAdmin, async (req, res) => {
  try {
    const serverToken = await getServerToken();
    const donations = await fsList("donations", serverToken);
    donations.sort((a, b) => {
      const ta = typeof a.createdAt === "string" ? a.createdAt : "";
      const tb = typeof b.createdAt === "string" ? b.createdAt : "";
      return tb.localeCompare(ta);
    });
    res.json(donations.slice(0, 200));
  } catch (err) {
    req.log.error({ err }, "GET /admin/donations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
