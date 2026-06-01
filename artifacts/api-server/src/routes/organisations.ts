import { Router } from "express";
import { fsGet, fsPatch, fsList, fsQuery, fsCreate, getServerToken } from "../lib/firebase-rest.js";
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

// Placeholder campaigns returned when the subcollection is empty
const PLACEHOLDER_CAMPAIGNS = [
  {
    _id: "camp_001",
    name: "School Supplies Drive",
    description: "Help us provide school supplies to 200 underserved children in Kingston.",
    imageUrl: null,
    amountRaised: 6500,
    goal: 10000,
    status: "active",
    type: "fundraising",
    volunteersNeeded: 0,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    _id: "camp_002",
    name: "Youth Mentorship Programme",
    description: "We need mentors to support youth in their personal and professional growth.",
    imageUrl: null,
    amountRaised: 0,
    goal: 0,
    status: "active",
    type: "volunteer",
    volunteersNeeded: 42,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    _id: "camp_003",
    name: "Tools for Training",
    description: "Help us purchase modern tools and equipment for our carpentry students.",
    imageUrl: null,
    amountRaised: 2100,
    goal: 6000,
    status: "active",
    type: "fundraising",
    volunteersNeeded: 0,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    _id: "camp_004",
    name: "2023 Back-to-School Drive",
    description: "Supplied stationery and bags to 150 children across Kingston parishes.",
    imageUrl: null,
    amountRaised: 8200,
    goal: 8000,
    status: "completed",
    type: "fundraising",
    volunteersNeeded: 0,
    createdAt: new Date(Date.now() - 365 * 86400000).toISOString(),
  },
  {
    _id: "camp_005",
    name: "Community Clean-Up 2023",
    description: "Mobilised 80 volunteers to clean and restore three inner-city parks.",
    imageUrl: null,
    amountRaised: 0,
    goal: 0,
    status: "completed",
    type: "volunteer",
    volunteersNeeded: 0,
    createdAt: new Date(Date.now() - 300 * 86400000).toISOString(),
  },
];

// Placeholder volunteer roles returned when the subcollection is empty
const PLACEHOLDER_ROLES = [
  { _id: "vr_001", title: "Graphic Designer",        locationType: "remote", frequency: "Flexible hours", term: "short", iconType: "palette",    description: "Create graphics and visual content for our programmes and social media." },
  { _id: "vr_002", title: "Mentorship Support",      locationType: "local",  frequency: "Weekly",         term: "long",  iconType: "users",      description: "Mentor young people on their personal and professional development journey." },
  { _id: "vr_003", title: "Event Support",           locationType: "local",  frequency: "Occasional",     term: "short", iconType: "calendar",   description: "Help plan and run our community events and graduation ceremonies." },
  { _id: "vr_004", title: "Social Media Assistant",  locationType: "remote", frequency: "Flexible hours", term: "short", iconType: "smartphone", description: "Manage and grow our social media presence across platforms." },
  { _id: "vr_005", title: "Fundraising Support",     locationType: "remote", frequency: "Flexible hours", term: "long",  iconType: "heart",      description: "Support grant writing, donor outreach, and fundraising campaigns." },
  { _id: "vr_006", title: "Administrative Support",  locationType: "remote", frequency: "Flexible hours", term: "short", iconType: "briefcase",  description: "Help with data entry, communications, and general admin tasks." },
];

// GET /organisations/:id/volunteerRoles
router.get("/organisations/:id/volunteerRoles", async (req, res) => {
  try {
    const token = await getServerToken();
    const roles = await fsList(`organisations/${req.params.id}/volunteerRoles`, token);
    res.json(roles.length > 0 ? roles : PLACEHOLDER_ROLES);
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id/volunteerRoles error");
    res.status(500).json({ error: "Failed to fetch volunteer roles" });
  }
});

// POST /organisations/:id/skillSuggestions
router.post("/organisations/:id/skillSuggestions", requireAuth, async (req, res) => {
  try {
    const { skill, availability, locationPreference } = req.body as Record<string, unknown>;
    if (!skill) { res.status(400).json({ error: "skill is required" }); return; }
    const token = await getServerToken();
    const id = await fsCreate(`organisations/${req.params.id}/skillSuggestions`, {
      skill, availability: availability ?? "flexible", locationPreference: locationPreference ?? "remote",
      userId: req.user!.userId, createdAt: new Date().toISOString(),
    }, token);
    res.status(201).json({ id });
  } catch (err) {
    req.log.error({ err }, "POST /organisations/:id/skillSuggestions error");
    res.status(500).json({ error: "Failed to save skill suggestion" });
  }
});

// POST /organisations/:id/volunteerApplications
router.post("/organisations/:id/volunteerApplications", requireAuth, async (req, res) => {
  try {
    const { roleId, roleTitle, motivation, experience } = req.body as Record<string, unknown>;
    if (!roleId || !motivation) { res.status(400).json({ error: "roleId and motivation are required" }); return; }
    const token = await getServerToken();
    const id = await fsCreate(`organisations/${req.params.id}/volunteerApplications`, {
      roleId, roleTitle: roleTitle ?? "", motivation, experience: experience ?? "",
      userId: req.user!.userId, createdAt: new Date().toISOString(),
    }, token);
    res.status(201).json({ id });
  } catch (err) {
    req.log.error({ err }, "POST /organisations/:id/volunteerApplications error");
    res.status(500).json({ error: "Failed to save application" });
  }
});

// GET /organisations/:id/campaigns — list campaigns subcollection
router.get("/organisations/:id/campaigns", async (req, res) => {
  try {
    const token = await getServerToken();
    const campaigns = await fsList(`organisations/${req.params.id}/campaigns`, token);
    res.json(campaigns.length > 0 ? campaigns : PLACEHOLDER_CAMPAIGNS);
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id/campaigns error");
    res.status(500).json({ error: "Failed to fetch campaigns" });
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
    // Use server token for Firestore writes — user tokens are subject to client-side
    // security rules that may block writes to the organisations collection.
    const serverToken = await getServerToken();
    const existing = await fsGet("organisations", uid, serverToken);
    if (existing) {
      // Profile already exists — return it instead of erroring so the mobile
      // onboarding flow can re-call this idempotently after a network retry.
      res.status(200).json({ _id: uid, ...existing });
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
    await fsPatch("organisations", uid, data, serverToken);
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
    if (uid !== orgId) {
      res.status(403).json({ error: "You can only update your own organisation profile" });
      return;
    }
    const serverToken = await getServerToken();
    const existing = await fsGet("organisations", orgId, serverToken);
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
    await fsPatch("organisations", orgId, merged, serverToken);
    res.json({ _id: orgId, ...merged });
  } catch (err) {
    req.log.error({ err }, "PATCH /organisations/:id error");
    res.status(500).json({ error: "Failed to update organisation" });
  }
});

export default router;
