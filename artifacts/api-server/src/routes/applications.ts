import { Router } from "express";
import crypto from "crypto";
import { getAdminTokenValue, requireAdmin } from "../lib/admin-auth.js";
import { activePayoutMethod, manualPayoutLabel } from "../lib/payout-setup.js";
import {
  fsCreate,
  fsPatch,
  fsList,
  fsGet,
  fsQuery,
  getServerToken,
  firebaseSignUp,
  firebaseSignIn,
  firebaseSendPasswordResetEmail,
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
    const { orgName, country, contactName, email, password, sectors, website, socialLinks } = req.body as {
      orgName?: string;
      country?: string;
      contactName?: string;
      email?: string;
      password?: string;
      sectors?: string[];
      website?: string;
      socialLinks?: {
        instagram?: string;
        facebook?: string;
        twitter?: string;
        linkedin?: string;
      };
    };

    if (typeof country !== "string" || !country.trim() || country.trim() === "All" || country.trim().length > 100) {
      res.status(400).json({ error: "Country is required and must be 100 characters or fewer" });
      return;
    }
    if (!orgName?.trim() || !contactName?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: "orgName, contactName, email and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    if (!Array.isArray(sectors) || sectors.length === 0) {
      res.status(400).json({ error: "At least one sector must be selected" });
      return;
    }

    const token = await getServerToken();
    const now = new Date().toISOString();
    const normalisedEmail = email.toLowerCase().trim();

    // Normalise optional fields
    const cleanWebsite = website?.trim() || null;
    const cleanSocials = {
      instagram: socialLinks?.instagram?.trim() || null,
      facebook: socialLinks?.facebook?.trim() || null,
      twitter: socialLinks?.twitter?.trim() || null,
      linkedin: socialLinks?.linkedin?.trim() || null,
    };
    const hasSocials = Object.values(cleanSocials).some(Boolean);

    // Check for duplicate pending application from same email
    const existing = await fsQuery(
      "org_applications",
      [{ field: "email", op: "EQUAL", value: normalisedEmail },
       { field: "status", op: "EQUAL", value: "pending" }],
      token,
    );
    if (existing.length > 0) {
      try {
        const signedIn = await firebaseSignIn(normalisedEmail, password);
        const existingUid = existing[0]?.uid;
        if (existingUid && existingUid === signedIn.uid) {
          await fsPatch("org_applications", String(existing[0]!._id), { country: country.trim() }, token);
          res.status(200).json({ id: existing[0]?._id, status: "pending", token: signedIn.idToken });
          return;
        }
      } catch {
        // Return the same response for a mismatched password or account.
      }
      res.status(409).json({ error: "An application from this email is already under review" });
      return;
    }

    let uid: string;
    let initialToken: string;
    try {
      const created = await firebaseSignUp(normalisedEmail, password);
      uid = created.uid;
      initialToken = created.idToken;
    } catch (err: unknown) {
      const code = (err as { firebaseCode?: string }).firebaseCode ?? "";
      if (!code.includes("EMAIL_EXISTS")) {
        res.status(400).json({
          error: code.includes("WEAK_PASSWORD")
            ? "Password must be at least 6 characters"
            : "Account creation failed — check your email and password",
        });
        return;
      }
      try {
        const signedIn = await firebaseSignIn(normalisedEmail, password);
        uid = signedIn.uid;
        initialToken = signedIn.idToken;
        const user = await fsGet("users", uid, initialToken);
        if (user && user.accountType !== "organisation") {
          res.status(409).json({ error: "This email is already used by a supporter account" });
          return;
        }
      } catch {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }
    }

    await firebaseUpdateProfile(initialToken, contactName.trim());
    await fsPatch("users", uid, {
      uid,
      name: contactName.trim(),
      email: normalisedEmail,
      accountType: "organisation",
      orgName: orgName.trim(),
      avatarInitials: avatarInitials(contactName.trim()),
      approvalStatus: "pending",
      createdAt: now,
    }, token);

    const applicationId = await fsCreate("org_applications", {
      uid,
      orgName: orgName.trim(),
      country: country.trim(),
      contactName: contactName.trim(),
      email: normalisedEmail,
      sectors,
      website: cleanWebsite,
      socialLinks: hasSocials ? cleanSocials : null,
      status: "pending",
      createdAt: now,
    }, token);

    // Fire-and-forget emails
    Promise.all([
      brevoSendEmail({
        to: [{ email: normalisedEmail, name: contactName.trim() }],
        subject: `We've received your application, ${orgName.trim()}`,
        htmlContent: orgApplicationReceivedHtml({ orgName: orgName.trim(), contactName: contactName.trim() }),
      }),
      brevoSendEmail({
        to: [{ email: TEAM_EMAIL, name: "Root ProjX Team" }],
        subject: `New organisation sign-up: ${orgName.trim()}`,
        htmlContent: internalNotificationHtml({
          type: "org_application",
          name: contactName.trim(),
          email: normalisedEmail,
          orgName: orgName.trim(),
          sectors,
          website: cleanWebsite,
          socialLinks: hasSocials ? cleanSocials : null,
        }),
      }),
    ]).catch((err) => {
      console.error("[Brevo] org application email error:", err);
    });

    res.status(201).json({ id: applicationId, status: "pending", token: initialToken });
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
    const id = String(req.params.id);
    const serverToken = await getServerToken();

    // The dashboard sends Firestore's document ID. It is not a field stored
    // inside the document, so it must be retrieved by document ID, not queried
    // as `_id`.
    const app = await fsGet("org_applications", id, serverToken);
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
    const appWebsite = (app.website as string | null) ?? null;
    const appSocialLinks = (app.socialLinks as Record<string, string | null> | null) ?? null;

    let uid = app.uid as string | undefined;
    let passwordSetupRequired = false;
    if (!uid) {
      const matchingUsers = await fsQuery(
        "users",
        [{ field: "email", op: "EQUAL", value: email.toLowerCase().trim() }],
        serverToken,
        { limit: 1 },
      );
      const existingUser = matchingUsers[0];
      if (existingUser) {
        if (existingUser.accountType !== "organisation") {
          res.status(409).json({ error: "This email is already used by a supporter account" });
          return;
        }
        uid = String(existingUser._id);
      } else {
        try {
          const created = await firebaseSignUp(
            email.toLowerCase().trim(),
            crypto.randomBytes(32).toString("base64url"),
          );
          uid = created.uid;
          passwordSetupRequired = true;
        } catch (err: unknown) {
          const code = (err as { firebaseCode?: string }).firebaseCode ?? "";
          res.status(409).json({
            error: code.includes("EMAIL_EXISTS")
              ? "An authentication account already exists for this legacy application but cannot be matched safely. Link the account before approval."
              : "Could not create an account for this legacy application",
          });
          return;
        }
      }
      await fsPatch("org_applications", id, {
        uid,
        accountProvisionedAt: new Date().toISOString(),
      }, serverToken);
    }

    const now = new Date().toISOString();
    const initials = avatarInitials(contactName);

    // Create org profile — carry over website and social links from the application
    await fsPatch("organisations", uid, {
      _id: uid,
      name: orgName,
      category: sectors[0] ?? "Community Development",
      categories: sectors,
      country: typeof app.country === "string" ? app.country.trim() || null : null,
      city: null,
      description: "",
      mission: null,
      verified: true,
      followerCount: 0,
      totalRaised: 0,
      impactScore: 0,
      coverImage: null,
      logo: null,
      contact: { email, website: appWebsite },
      socialLinks: appSocialLinks,
      createdAt: now,
    }, serverToken);

    await fsPatch("users", uid, {
      uid,
      name: contactName,
      email,
      accountType: "organisation",
      orgName,
      avatarInitials: initials,
      approvalStatus: "approved",
      approvedAt: now,
    }, serverToken);

    // Update application status
    await fsPatch("org_applications", id, { status: "approved", approvedAt: now, uid }, serverToken);

    // Send acceptance email
    brevoSendEmail({
      to: [{ email, name: contactName }],
      subject: `Welcome to Root ProjX, ${orgName}!`,
      htmlContent: orgAcceptedHtml({ orgName, contactName, email, passwordSetupRequired }),
    }).catch((err) => console.error("[Brevo] org accepted email error:", err));
    if (passwordSetupRequired) {
      firebaseSendPasswordResetEmail(email)
        .catch((err) => console.error("[Firebase] legacy applicant password setup email error:", err));
    }

    res.json({ ok: true, uid });
  } catch (err) {
    req.log.error({ err }, "POST /admin/applications/:id/approve error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/applications/:id/decline
router.post("/admin/applications/:id/decline", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const serverToken = await getServerToken();

    // See approval route: `id` is the Firestore document ID, not a stored
    // application field.
    const app = await fsGet("org_applications", id, serverToken);
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
    const uid = typeof app.uid === "string" ? app.uid : null;
    if (uid) {
      await fsPatch("users", uid, { approvalStatus: "declined", declinedAt: now }, serverToken);
    }

    // The admin UI does not currently send a request body. Treat it as an
    // empty body so a missing optional decline reason cannot turn a successful
    // decline into a 500 response after the status has already been written.
    const { reason } = (req.body ?? {}) as { reason?: string };
    brevoSendEmail({
      to: [{ email, name: contactName }],
      subject: `An update on your Root ProjX application`,
      htmlContent: orgDeclinedHtml({ orgName, contactName, reason }),
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
    res.json(orgs.map((org) => ({ ...org, payoutMethod: activePayoutMethod(org) })));
  } catch (err) {
    req.log.error({ err }, "GET /admin/organisations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manual bank-transfer setup stores no banking credentials, only a reminder
// referencing the payee held in the operator's banking provider.
router.patch("/admin/organisations/:id/manual-payout", requireAdmin, async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["payoutManualApproved", "payoutManualLabel"].includes(key)) ||
      body.payoutManualApproved !== true) {
      res.status(400).json({ error: "Provide payoutManualApproved: true and an optional short payoutManualLabel only" });
      return;
    }
    let label: string | null | undefined;
    try {
      if ("payoutManualLabel" in body) label = manualPayoutLabel(body.payoutManualLabel);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid payout label" });
      return;
    }
    const id = String(req.params.id);
    const token = await getServerToken();
    const org = await fsGet("organisations", id, token);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    if (org.payoutManualRequested !== true || activePayoutMethod(org) !== "bank_transfer") {
      res.status(409).json({ error: "The organisation must first request bank transfer as its payout method" });
      return;
    }
    const updates: Record<string, unknown> = { payoutManualApproved: true };
    if (label !== undefined) updates.payoutManualLabel = label;
    await fsPatch("organisations", id, updates, token);
    req.log.info({ organisationId: id }, "Admin confirmed off-platform bank transfer setup");
    res.json({ ...org, ...updates, _id: id });
  } catch (err) {
    req.log.error({ err }, "Manual payout approval failed");
    res.status(500).json({ error: "Could not confirm bank transfer setup" });
  }
});

// PATCH /admin/organisations/:id — edit public profile fields on an org's behalf
router.patch("/admin/organisations/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const serverToken = await getServerToken();
    const existing = await fsGet("organisations", id, serverToken);
    if (!existing) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const cleanText = (key: string, max: number, required = false): string | null | undefined => {
      if (!(key in body)) return undefined;
      if (body[key] === null && !required) return null;
      if (typeof body[key] !== "string") throw new Error(`${key} must be text`);
      const value = body[key].trim();
      if (required && !value) throw new Error(`${key} is required`);
      if (value.length > max) throw new Error(`${key} must be ${max} characters or fewer`);
      return value || null;
    };
    const cleanUrl = (value: unknown, label: string): string | null => {
      if (value === null || value === undefined || value === "") return null;
      if (typeof value !== "string") throw new Error(`${label} must be a URL`);
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        const parsed = new URL(trimmed);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        return parsed.toString();
      } catch {
        throw new Error(`${label} must be a valid http or https URL`);
      }
    };

    let updates: Record<string, unknown>;
    try {
      updates = {};
      for (const [key, max, required] of [
        ["name", 120, true],
        ["country", 100, true],
        ["city", 100, false],
        ["category", 100, true],
        ["description", 2000, false],
        ["mission", 1000, false],
      ] as const) {
        const value = cleanText(key, max, required);
        if (value !== undefined) updates[key] = value;
      }

      if ("contact" in body) {
        if (!body.contact || typeof body.contact !== "object" || Array.isArray(body.contact)) {
          throw new Error("contact must be an object");
        }
        const contact = body.contact as Record<string, unknown>;
        const email = typeof contact.email === "string" ? contact.email.trim() : "";
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Contact email is invalid");
        const phone = typeof contact.phone === "string" ? contact.phone.trim() : "";
        if (email.length > 254 || phone.length > 50) throw new Error("Contact details are too long");
        updates.contact = { email: email || null, phone: phone || null, website: cleanUrl(contact.website, "Website") };
      }

      if ("socialLinks" in body) {
        if (!body.socialLinks || typeof body.socialLinks !== "object" || Array.isArray(body.socialLinks)) {
          throw new Error("socialLinks must be an object");
        }
        const socials = body.socialLinks as Record<string, unknown>;
        updates.socialLinks = Object.fromEntries(
          ["instagram", "facebook", "twitter", "linkedin", "youtube", "tiktok"]
            .map((key) => [key, cleanUrl(socials[key], key)]),
        );
      }

      if ("logo" in body) updates.logo = cleanUrl(body.logo, "Logo");
      if ("coverImage" in body) updates.coverImage = cleanUrl(body.coverImage, "Banner");
    } catch (validationError) {
      res.status(400).json({ error: validationError instanceof Error ? validationError.message : "Invalid profile details" });
      return;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No editable profile fields were provided" });
      return;
    }

    await fsPatch("organisations", id, updates, serverToken);
    req.log.info({ organisationId: id, changedFields: Object.keys(updates) }, "Admin updated organisation profile");
    res.json({ _id: id, ...existing, ...updates });
  } catch (err) {
    req.log.error({ err }, "PATCH /admin/organisations/:id error");
    res.status(500).json({ error: "Failed to update organisation profile" });
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
