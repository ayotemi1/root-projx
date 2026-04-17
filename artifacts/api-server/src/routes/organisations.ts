import { Router } from "express";
import { fsGet, fsPatch, fsList, fsQuery, getServerToken } from "../lib/firebase-rest.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /organisations — list all; optional ?category= &country= filters
router.get("/organisations", async (req, res) => {
  try {
    const { category, country } = req.query as Record<string, string | undefined>;
    const token = req.headers.authorization?.slice(7) ?? await getServerToken();
    let orgs: Array<Record<string, unknown>>;
    if (category || country) {
      const filters: Array<{ field: string; op: string; value: unknown }> = [];
      if (category) filters.push({ field: "category", op: "EQUAL", value: category });
      if (country) filters.push({ field: "country", op: "EQUAL", value: country });
      orgs = await fsQuery("organisations", filters, token);
    } else {
      orgs = await fsList("organisations", token);
    }
    res.json(orgs);
  } catch (err) {
    req.log.error({ err }, "GET /organisations error");
    res.status(500).json({ error: "Failed to fetch organisations" });
  }
});

// GET /organisations/:id — single org profile
router.get("/organisations/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7) ?? await getServerToken();
    const org = await fsGet("organisations", req.params.id!, token);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    res.json({ _id: req.params.id, ...org });
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id error");
    res.status(500).json({ error: "Failed to fetch organisation" });
  }
});

// POST /organisations — create org profile (accountType=organisation only)
router.post("/organisations", requireAuth, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts can create an org profile" });
      return;
    }
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const existing = await fsGet("organisations", uid, token);
    if (existing) {
      res.status(409).json({ error: "An organisation profile already exists for this account" });
      return;
    }
    const { name, country, city, category, description, mission, contact, socialLinks } =
      req.body as Record<string, unknown>;
    if (!name || !country || !category || !description) {
      res.status(400).json({ error: "name, country, category and description are required" });
      return;
    }
    const data: Record<string, unknown> = {
      name, country, city: city ?? null, category, description, mission: mission ?? null,
      contact: contact ?? null, socialLinks: socialLinks ?? null,
      coverImage: null, logo: null,
      verified: false, followerCount: 0, totalRaised: 0, impactScore: 0,
      createdAt: new Date().toISOString(),
    };
    await fsPatch("organisations", uid, data, token);
    res.status(201).json({ _id: uid, ...data });
  } catch (err) {
    req.log.error({ err }, "POST /organisations error");
    res.status(500).json({ error: "Failed to create organisation profile" });
  }
});

// PATCH /organisations/:id — update org profile (owner only)
router.patch("/organisations/:id", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const orgId = req.params.id!;
    const token = req.headers.authorization!.slice(7);
    if (uid !== orgId) {
      res.status(403).json({ error: "You can only update your own organisation profile" });
      return;
    }
    const existing = await fsGet("organisations", orgId, token);
    if (!existing) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    const allowed = ["name", "country", "city", "category", "description", "mission",
                     "contact", "socialLinks", "coverImage", "logo"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in (req.body as Record<string, unknown>)) {
        updates[key] = (req.body as Record<string, unknown>)[key];
      }
    }
    const merged = { ...existing, ...updates };
    await fsPatch("organisations", orgId, merged, token);
    res.json({ _id: orgId, ...merged });
  } catch (err) {
    req.log.error({ err }, "PATCH /organisations/:id error");
    res.status(500).json({ error: "Failed to update organisation" });
  }
});

export default router;
