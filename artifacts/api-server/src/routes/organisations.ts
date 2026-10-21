import { randomUUID } from "crypto";
import { profilePatch, ProfileValidationError } from "../lib/organisation-profile.js";
import { Router } from "express";
import multer from "multer";
import { fsGet, fsPatch, fsList, fsQuery, fsCreate, getServerToken } from "../lib/firebase-rest.js";
import { requireApprovedOrganisation, requireAuth } from "../lib/auth.js";
import { isCampaignPublished } from "../lib/campaign-publication.js";
import { objectStorageClient } from "../lib/objectStorage.js";
import { withoutPrivatePayoutSetup } from "../lib/payout-setup.js";

const router = Router();
const PUBLIC_CAMPAIGN_ID_PATTERN = /^cp_[a-f0-9]{24}$/;
const DEFAULT_CAMPAIGN_THEME = {
  primaryColor: "#B50000",
  accentColor: "#F5B800",
  backgroundColor: "#FFF9F2",
  textColor: "#1A1A1A",
};

// ---------------------------------------------------------------------------
// Org image upload helpers
// ---------------------------------------------------------------------------

function getOrgImageBucketName(): string {
  const dir = (process.env.PRIVATE_OBJECT_DIR ?? "").replace(/^\//, "");
  const bucket = dir.split("/")[0] ?? "";
  if (!bucket) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return bucket;
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error(`File type "${file.mimetype}" is not allowed`), {}));
  },
});

// ---------------------------------------------------------------------------
// GET /org-images/:orgId/:type — serve org profile image directly from GCS
// No auth. 5-minute cache so re-uploads appear quickly.
// ---------------------------------------------------------------------------
router.get("/org-images/:orgId/:type", async (req, res) => {
  const { orgId, type } = req.params;
  if (type !== "logo" && type !== "cover") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const bucketName = getOrgImageBucketName();
    const objectPath = `org-profiles/${orgId}/${type}`;
    const file = objectStorageClient.bucket(bucketName).file(objectPath);

    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: "Image not found" }); return; }

    const [metadata] = await file.getMetadata();
    res.set("Content-Type", (metadata.contentType as string) || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    if (metadata.size) res.set("Content-Length", String(metadata.size));

    file.createReadStream().pipe(res);
  } catch (err) {
    req.log.error({ err }, "GET /org-images error");
    res.status(500).json({ error: "Failed to serve image" });
  }
});

// ---------------------------------------------------------------------------
// POST /organisations/:orgId/images?type=logo|cover
// Single call: upload file → write to GCS → update Firestore → return updated org.
// Replaces the old two-step (upload + PATCH) flow.
// ---------------------------------------------------------------------------
router.post(
  "/organisations/:orgId/images",
  requireAuth,
  requireApprovedOrganisation,
  (req, res, next) => {
    imageUpload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: err.message });
        return;
      }
      if (err) {
        res.status(400).json({ error: (err as Error).message || "Invalid file" });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const uid = req.user!.userId;
      const orgId = req.params.orgId!;
      if (uid !== orgId) {
        res.status(403).json({ error: "You can only update your own organisation" });
        return;
      }

      const type = req.query.type as string;
      if (type !== "logo" && type !== "cover") {
        res.status(400).json({ error: "type must be logo or cover" });
        return;
      }

      const file = req.file;
      if (!file) { res.status(400).json({ error: "No file provided" }); return; }

      // Write to GCS — overwrites any previous image at the same stable path
      const bucketName = getOrgImageBucketName();
      const objectPath = `org-profiles/${orgId}/${type}`;
      const gcsFile = objectStorageClient.bucket(bucketName).file(objectPath);
      await gcsFile.save(file.buffer, { contentType: file.mimetype, resumable: false });

      // Store a root-relative URL so it's domain-independent
      const imageUrl = `/api/org-images/${orgId}/${type}`;
      const field = type === "logo" ? "logo" : "coverImage";

      const serverToken = await getServerToken();
      const existing = await fsGet("organisations", orgId, serverToken);
      if (!existing) { res.status(404).json({ error: "Organisation not found" }); return; }

      const merged = { ...existing, [field]: imageUrl };
      await fsPatch("organisations", orgId, { [field]: imageUrl }, serverToken);

      req.log.info({ orgId, type }, "Org profile image uploaded");
      res.json({ _id: orgId, ...merged });
    } catch (err) {
      req.log.error({ err }, "POST /organisations/:orgId/images error");
      res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  },
);

// GET /organisations — list all; optional ?category= &country= filters
router.get("/organisations", async (req, res) => {
  try {
    const { category, country } = req.query as Record<string, string | undefined>;
    const token = await getServerToken();
    let orgs: Array<Record<string, unknown>>;
    if (category || country) {
      const filters: Array<{ field: string; op: string; value: unknown }> = [];
      if (category) filters.push({ field: "category", op: "EQUAL", value: category });
      if (country) filters.push({ field: "country", op: "EQUAL", value: country });
      orgs = await fsQuery("organisations", filters, token);
    } else {
      orgs = await fsList("organisations", token);
    }
    res.json(
      orgs
        .filter((org) => typeof org["name"] === "string" && org["name"].trim().length > 0)
        .map(({ campaigns: _campaigns, ...org }) => withoutPrivatePayoutSetup(org)),
    );
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

// ---------------------------------------------------------------------------
// Campaign helpers — campaigns are stored as an embedded array on the org doc
// rather than a Firestore subcollection. Public campaign data is always
// projected explicitly; the embedded array itself is never a public API shape.
// ---------------------------------------------------------------------------

function parsePhases(phases: unknown): Record<string, unknown>[] {
  if (!Array.isArray(phases)) return [];
  return (phases as Record<string, unknown>[]).slice(0, 10).map((p, i) => ({
    id: (p["id"] as string) ?? `phase_${i}`,
    title: typeof p["title"] === "string" ? p["title"].slice(0, 200) : `Phase ${i + 1}`,
    description: typeof p["description"] === "string" ? p["description"].slice(0, 1000) : "",
    targetAmount: typeof p["targetAmount"] === "number" ? p["targetAmount"] : null,
    completed: p["completed"] === true,
  }));
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function parseCampaignTheme(theme: unknown): Record<string, string> {
  const input = (theme && typeof theme === "object" ? theme : {}) as Record<string, unknown>;
  return {
    primaryColor: normalizeHexColor(input["primaryColor"], DEFAULT_CAMPAIGN_THEME.primaryColor),
    accentColor: normalizeHexColor(input["accentColor"], DEFAULT_CAMPAIGN_THEME.accentColor),
    backgroundColor: normalizeHexColor(input["backgroundColor"], DEFAULT_CAMPAIGN_THEME.backgroundColor),
    textColor: normalizeHexColor(input["textColor"], DEFAULT_CAMPAIGN_THEME.textColor),
  };
}

function createPublicCampaignId(): string {
  return `cp_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function slugifyPublicName(value: unknown, fallback: string): string {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return slug || fallback;
}

export function campaignSharePath(
  org: Record<string, unknown>,
  campaign: Record<string, unknown>,
): { organisationSlug: string; campaignSlug: string; sharePath: string } {
  const orgId = String(org["_id"] ?? "").slice(-6).toLowerCase();
  const campaignId = String(campaign["_id"] ?? campaign["publicId"] ?? "").slice(-6).toLowerCase();
  const storedOrganisationSlug =
    typeof campaign["organisationSlug"] === "string" ? campaign["organisationSlug"] : "";
  const storedCampaignSlug =
    typeof campaign["campaignSlug"] === "string" ? campaign["campaignSlug"] : "";
  const organisationSlug =
    storedOrganisationSlug && orgId && storedOrganisationSlug.endsWith(`-${orgId}`)
      ? storedOrganisationSlug
      : `${slugifyPublicName(org["name"], "organisation")}-${orgId}`;
  const campaignSlug =
    storedCampaignSlug && campaignId && storedCampaignSlug.endsWith(`-${campaignId}`)
      ? storedCampaignSlug
      : `${slugifyPublicName(campaign["name"], "campaign")}-${campaignId}`;
  return {
    organisationSlug,
    campaignSlug,
    sharePath: `/campaigns/${organisationSlug}/${campaignSlug}`,
  };
}

function organisationDisplayName(
  org: Record<string, unknown>,
  owner?: Record<string, unknown> | null,
): string {
  if (typeof org["name"] === "string" && org["name"].trim()) return org["name"];
  if (typeof owner?.["orgName"] === "string" && owner["orgName"].trim()) return owner["orgName"];
  return "Community organisation";
}

function publicCampaignFields(campaign: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: campaign["_id"],
    publicId: campaign["publicId"],
    enabled: campaign["enabled"] !== false,
    name: campaign["name"] ?? "",
    description: campaign["description"] ?? "",
    imageUrl: campaign["imageUrl"] ?? null,
    amountRaised: typeof campaign["amountRaised"] === "number" ? campaign["amountRaised"] : 0,
    goal: typeof campaign["goal"] === "number" ? campaign["goal"] : 0,
    status: campaign["status"] === "completed" ? "completed" : "active",
    type: campaign["type"] === "volunteer" ? "volunteer" : "fundraising",
    volunteersNeeded: typeof campaign["volunteersNeeded"] === "number" ? campaign["volunteersNeeded"] : 0,
    deadline: campaign["deadline"] ?? null,
    phases: parsePhases(campaign["phases"]),
    createdAt: campaign["createdAt"] ?? null,
    updatedAt: campaign["updatedAt"] ?? null,
    theme: parseCampaignTheme(campaign["theme"]),
    organisationSlug: campaign["organisationSlug"] ?? null,
    campaignSlug: campaign["campaignSlug"] ?? null,
    sharePath: campaign["sharePath"] ?? null,
  };
}

async function getStoredCampaigns(orgId: string): Promise<Record<string, unknown>[]> {
  const serverToken = await getServerToken();
  const org = await fsGet("organisations", orgId, serverToken);
  if (!org || !Array.isArray(org.campaigns)) return [];
  return org.campaigns as Record<string, unknown>[];
}

async function saveCampaigns(
  orgId: string,
  campaigns: Record<string, unknown>[],
): Promise<void> {
  const serverToken = await getServerToken();
  await fsPatch("organisations", orgId, { campaigns }, serverToken);
}

// GET /organisations/:id/campaigns/manage — private full campaign list for owner dashboard
router.get("/organisations/:id/campaigns/manage", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    const orgId = req.params.id!;
    if (req.user!.accountType !== "organisation" || req.user!.userId !== orgId) {
      res.status(403).json({ error: "You can only manage your own campaigns" });
      return;
    }
    const token = await getServerToken();
    const org = await fsGet("organisations", orgId, token);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    const owner = await fsGet("users", orgId, token);
    const orgWithIdentity = { ...org, _id: orgId, name: organisationDisplayName(org, owner) };
    const campaigns = (await getStoredCampaigns(orgId))
      .filter((campaign) => campaign["status"] !== "deleted")
      .map((campaign) => ({ ...campaign, ...campaignSharePath(orgWithIdentity, campaign) }));
    res.json(campaigns);
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id/campaigns/manage error");
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// GET /organisations/:id/campaigns — public, published campaign summaries only
router.get("/organisations/:id/campaigns", async (req, res) => {
  try {
    const orgId = req.params.id!;
    const token = await getServerToken();
    const org = await fsGet("organisations", orgId, token);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    const owner = await fsGet("users", orgId, token);
    const orgWithIdentity = { ...org, _id: orgId, name: organisationDisplayName(org, owner) };
    const campaigns = (await getStoredCampaigns(orgId))
      .filter(isCampaignPublished)
      .map((campaign) => publicCampaignFields({
        ...campaign,
        ...campaignSharePath(orgWithIdentity, campaign),
      }));
    res.json(campaigns);
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id/campaigns error");
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

export async function findPublicCampaign(
  predicate: (campaign: Record<string, unknown>, org: Record<string, unknown>) => boolean,
) {
  const token = await getServerToken();
  const organisations = await fsList("organisations", token);
  for (const org of organisations) {
    const campaigns = Array.isArray(org["campaigns"])
      ? (org["campaigns"] as Record<string, unknown>[])
      : [];
    const owner = await fsGet("users", String(org["_id"]), token);
    const organisationName = organisationDisplayName(org, owner);
    const orgWithIdentity = { ...org, name: organisationName };
    const campaign = campaigns.find(
      (candidate) =>
        isCampaignPublished(candidate) &&
        predicate(candidate, orgWithIdentity),
    );
    if (!campaign) continue;
    const share = campaignSharePath(orgWithIdentity, campaign);
    return {
      campaign: publicCampaignFields({ ...campaign, ...share }),
      organisation: {
        _id: org["_id"],
        name: organisationName,
        country: org["country"] ?? "",
        city: org["city"] ?? null,
        category: org["category"] ?? "",
        description: org["description"] ?? "",
        logo: org["logo"] ?? null,
        coverImage: org["coverImage"] ?? null,
        verified: org["verified"] === true,
      },
    };
  }
  return null;
}

// GET /campaigns/landing/:organisationSlug/:campaignSlug — human-readable public route
router.get("/campaigns/landing/:organisationSlug/:campaignSlug", async (req, res) => {
  try {
    const organisationSlug = req.params.organisationSlug!;
    const campaignSlug = req.params.campaignSlug!;
    const landing = await findPublicCampaign((candidate, org) => {
      const share = campaignSharePath(org, candidate);
      return share.organisationSlug === organisationSlug && share.campaignSlug === campaignSlug;
    });
    if (!landing) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    res.json(landing);
  } catch (err) {
    req.log.error({ err }, "GET human-readable campaign landing error");
    res.status(500).json({ error: "Failed to fetch campaign landing page" });
  }
});

// GET /campaigns/landing/:publicId — stable legacy public route
router.get("/campaigns/landing/:publicId", async (req, res) => {
  try {
    const publicId = req.params.publicId!;
    if (!PUBLIC_CAMPAIGN_ID_PATTERN.test(publicId)) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const landing = await findPublicCampaign((candidate) => candidate["publicId"] === publicId);
    if (!landing) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    res.json(landing);
  } catch (err) {
    req.log.error({ err }, "GET /campaigns/landing/:publicId error");
    res.status(500).json({ error: "Failed to fetch campaign landing page" });
  }
});

// POST /organisations/:id/campaigns — create a campaign (org owner only)
router.post("/organisations/:id/campaigns", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const orgId = req.params.id!;
    if (req.user!.accountType !== "organisation" || uid !== orgId) {
      res.status(403).json({ error: "You can only manage your own campaigns" });
      return;
    }
    const serverToken = await getServerToken();
    const org = await fsGet("organisations", orgId, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    const owner = await fsGet("users", orgId, serverToken);
    const orgWithIdentity = {
      ...org,
      _id: orgId,
      name: organisationDisplayName(org, owner),
    };

    const { name, description, type, goal, volunteersNeeded, deadline, imageUrl, phases } =
      req.body as Record<string, unknown>;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Campaign name is required" });
      return;
    }
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      res.status(400).json({ error: "Campaign description is required" });
      return;
    }

    const now = new Date().toISOString();
    const campaignId = randomUUID().replace(/-/g, "").slice(0, 20);
    const share = campaignSharePath(orgWithIdentity, { _id: campaignId, name });
    const newCampaign: Record<string, unknown> = {
      _id: campaignId,
      publicId: createPublicCampaignId(),
      enabled: false,
      ...share,
      name: name.trim().slice(0, 200),
      description: description.trim().slice(0, 2000),
      type: type === "volunteer" ? "volunteer" : "fundraising",
      goal: typeof goal === "number" && goal > 0 ? goal : 0,
      amountRaised: 0,
      volunteersNeeded: typeof volunteersNeeded === "number" ? volunteersNeeded : 0,
      status: "active",
      deadline: typeof deadline === "string" && deadline ? deadline : null,
      imageUrl: typeof imageUrl === "string" && imageUrl ? imageUrl : null,
      phases: parsePhases(phases),
      theme: { ...DEFAULT_CAMPAIGN_THEME },
      createdAt: now,
      updatedAt: now,
    };

    const existing = Array.isArray(org["campaigns"]) ? org["campaigns"] as Record<string, unknown>[] : [];
    await saveCampaigns(orgId, [...existing, newCampaign]);
    req.log.info({ orgId, campaignId: newCampaign._id }, "Campaign created");
    res.status(201).json(newCampaign);
  } catch (err) {
    req.log.error({ err }, "POST /organisations/:id/campaigns error");
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// PATCH /organisations/:id/campaigns/:campId — update a campaign (org owner only)
router.patch("/organisations/:id/campaigns/:campId", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const orgId = req.params.id!;
    const campId = req.params.campId!;
    if (req.user!.accountType !== "organisation" || uid !== orgId) {
      res.status(403).json({ error: "You can only manage your own campaigns" });
      return;
    }

    const serverToken = await getServerToken();
    const org = await fsGet("organisations", orgId, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    const owner = await fsGet("users", orgId, serverToken);
    const orgWithIdentity = {
      ...org,
      _id: orgId,
      name: organisationDisplayName(org, owner),
    };
    const allCampaigns = Array.isArray(org["campaigns"]) ? org["campaigns"] as Record<string, unknown>[] : [];
    const idx = allCampaigns.findIndex((c) => c._id === campId && c["status"] !== "deleted");
    if (idx === -1) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const allowed = ["name", "description", "goal", "amountRaised", "volunteersNeeded",
                     "status", "deadline", "imageUrl", "phases", "enabled", "theme"] as const;
    const updates: Record<string, unknown> = {};
    const body = req.body as Record<string, unknown>;
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    if ("phases" in updates) {
      updates["phases"] = parsePhases(updates["phases"]);
    }
    if ("enabled" in updates && typeof updates["enabled"] !== "boolean") {
      res.status(400).json({ error: "enabled must be a boolean" });
      return;
    }
    if (updates["enabled"] === true) {
      const hasPublicOrganisationName =
        (typeof org?.["name"] === "string" && org["name"].trim()) ||
        (typeof owner?.["orgName"] === "string" && owner["orgName"].trim());
      if (!hasPublicOrganisationName) {
        res.status(400).json({ error: "Add an organisation name before publishing a campaign page" });
        return;
      }
    }
    if ("theme" in updates) {
      updates["theme"] = parseCampaignTheme(updates["theme"]);
    }

    const merged: Record<string, unknown> = {
      ...allCampaigns[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (merged["enabled"] === true && !PUBLIC_CAMPAIGN_ID_PATTERN.test(String(merged["publicId"] ?? ""))) {
      merged["publicId"] = createPublicCampaignId();
    }
    if (merged["enabled"] === true) {
      Object.assign(merged, campaignSharePath(orgWithIdentity, merged));
    }
    if (!merged["theme"]) merged["theme"] = { ...DEFAULT_CAMPAIGN_THEME };
    allCampaigns[idx] = merged;
    await saveCampaigns(orgId, allCampaigns);
    req.log.info({ orgId, campId }, "Campaign updated");
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "PATCH /organisations/:id/campaigns/:campId error");
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

// DELETE /organisations/:id/campaigns/:campId — delete a campaign (org owner only)
router.delete("/organisations/:id/campaigns/:campId", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const orgId = req.params.id!;
    const campId = req.params.campId!;
    if (req.user!.accountType !== "organisation" || uid !== orgId) {
      res.status(403).json({ error: "You can only manage your own campaigns" });
      return;
    }

    const serverToken = await getServerToken();
    const org = await fsGet("organisations", orgId, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    const allCampaigns = Array.isArray(org["campaigns"]) ? org["campaigns"] as Record<string, unknown>[] : [];
    const idx = allCampaigns.findIndex((c) => c._id === campId && c["status"] !== "deleted");
    if (idx === -1) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // Soft-delete: keep the entry so array indices are stable, but mark deleted
    allCampaigns[idx] = {
      ...allCampaigns[idx],
      status: "deleted",
      updatedAt: new Date().toISOString(),
    };
    await saveCampaigns(orgId, allCampaigns);
    req.log.info({ orgId, campId }, "Campaign deleted");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /organisations/:id/campaigns/:campId error");
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

// GET /organisations/:id — single org profile
router.get("/organisations/:id", async (req, res) => {
  try {
    const token = await getServerToken();
    const org = await fsGet("organisations", req.params.id!, token);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    const { campaigns: _campaigns, ...publicOrg } = org;
    res.json({ _id: req.params.id, ...withoutPrivatePayoutSetup(publicOrg) });
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id error");
    res.status(500).json({ error: "Failed to fetch organisation" });
  }
});

// POST /organisations — create org profile (accountType=organisation only)
router.post("/organisations", requireAuth, requireApprovedOrganisation, async (req, res) => {
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
    const { name, country, city, category, description, mission, contact, socialLinks,
            whoYouServe, yearsOperating, registrationNumber } =
      req.body as Record<string, unknown>;
    if (!name || !country || !category || !description) {
      res.status(400).json({ error: "name, country, category and description are required" });
      return;
    }
    if (existing?.category) {
      // Fully onboarded already — idempotent return so mobile retries are safe.
      res.status(200).json({ _id: uid, ...existing });
      return;
    }
    // Create or update (upsert) — merges onboarding data into any existing stub.
    const base: Record<string, unknown> = existing ?? {
      coverImage: null, logo: null,
      verified: false, followerCount: 0, totalRaised: 0, impactScore: 0,
      createdAt: new Date().toISOString(),
    };
    const data: Record<string, unknown> = {
      ...base,
      name, country, city: city ?? null, category, description,
      mission: mission ?? null,
      contact: contact ?? null,
      socialLinks: socialLinks ?? null,
      whoYouServe: whoYouServe ?? null,
      yearsOperating: yearsOperating ?? null,
      registrationNumber: registrationNumber ?? null,
    };
    await fsPatch("organisations", uid, data, serverToken);
    res.status(existing ? 200 : 201).json({ _id: uid, ...data });
  } catch (err) {
    req.log.error({ err }, "POST /organisations error");
    res.status(500).json({ error: "Failed to create organisation profile" });
  }
});

// PATCH /organisations/:id — update org profile (owner only)
router.patch("/organisations/:id", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const orgId = req.params.id!;
    if (uid !== orgId || req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "You can only update your own organisation profile" });
      return;
    }
    const serverToken = await getServerToken();
    const existing = await fsGet("organisations", orgId, serverToken);
    if (!existing) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    const updates = profilePatch(req.body, existing);
    await fsPatch("organisations", orgId, updates, serverToken);
    // A private snapshot must not escape through the edit response. Also re-read
    // so a concurrent section save isn't replaced by this request's old snapshot.
    const current = await fsGet("organisations", orgId, serverToken) ?? { ...existing, ...updates };
    const { campaigns: _campaigns, ...publicOrg } = current;
    res.json({ _id: orgId, ...withoutPrivatePayoutSetup(publicOrg) });
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "PATCH /organisations/:id error");
    res.status(500).json({ error: "Failed to update organisation" });
  }
});

// GET /organisations/:id/analytics
router.get("/organisations/:id/analytics", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    if (req.user!.userId !== req.params.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const token = await getServerToken();
    const doc = await fsGet(`organisations/${req.params.id}/analytics`, "summary", token);
    if (!doc) {
      res.json({
        profileViews: 1245, profileViewsTrend: 18,
        engagement: 532,    engagementTrend: 24,
        donations: 3210,    donationsTrend: 18,
      });
      return;
    }
    res.json(doc);
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id/analytics error");
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// GET /organisations/:id/notifications
router.get("/organisations/:id/notifications", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    const uid = req.user!.userId;
    if (uid !== req.params.id) { res.status(403).json({ error: "Forbidden" }); return; }
    const token = await getServerToken();
    const docs = await fsList(`organisations/${req.params.id}/notifications`, token);
    const sorted = (docs as { createdAt?: string; read?: boolean }[])
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 20);
    res.json(sorted);
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id/notifications error");
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// PATCH /organisations/:id/notifications/read-all
router.patch("/organisations/:id/notifications/read-all", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    const uid = req.user!.userId;
    if (uid !== req.params.id) { res.status(403).json({ error: "Forbidden" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PATCH notifications/read-all error");
    res.status(500).json({ error: "Failed" });
  }
});

// ── Supporter Wall ─────────────────────────────────────────────────────────────
// Stored as a bounded embedded array on the org doc (org.supporterWall, max
// SUPPORTER_WALL_LIMIT entries) and a mirror array on the user doc
// (user.supportedOrgs) — avoids needing a new Firestore collection (which would
// require a Firebase security-rules deployment). This is a low-frequency write
// path (one write per donation opt-in), so read-modify-write race conditions are
// accepted as a known, documented limitation.
//
// Opt-in is gated on a verified paid donation to the org. Opt-out is always
// allowed, regardless of donation history.
//
// Org entry shape:  { userId, displayName, optedIn }
// User entry shape: { orgId, orgName, displayName, optedIn }

const SUPPORTER_WALL_LIMIT = 500; // prevent unbounded Firestore document growth

function formatSupporterName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Supporter";
  if (parts.length === 1) return parts[0]!;
  const firstName = parts[0]!;
  const lastInitial = (parts[parts.length - 1]![0] ?? "").toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

type OrgWallEntry  = { userId: string; displayName: string; optedIn: boolean };
type UserWallEntry = { orgId: string; orgName: string; displayName: string; optedIn: boolean };

// GET /organisations/:id/supporters — public; returns opted-in names (up to 50)
router.get("/organisations/:id/supporters", async (req, res) => {
  try {
    const orgId = req.params["id"] as string;
    const serverToken = await getServerToken();
    const orgDoc = await fsGet("organisations", orgId, serverToken);
    if (!orgDoc) { res.json({ supporters: [], totalCount: 0 }); return; }
    const wall = ((orgDoc["supporterWall"] ?? []) as OrgWallEntry[]).filter((e) => e.optedIn);
    res.json({
      supporters: wall.slice(0, 50).map((e) => ({ displayName: e.displayName })),
      totalCount: wall.length,
    });
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id/supporters error");
    res.status(500).json({ error: "Failed to fetch supporters" });
  }
});

// GET /organisations/:id/supporters/me — authenticated; own opt-in status
router.get("/organisations/:id/supporters/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.params["id"] as string;
    const serverToken = await getServerToken();
    const orgDoc = await fsGet("organisations", orgId, serverToken);
    const wall = ((orgDoc?.["supporterWall"] ?? []) as OrgWallEntry[]);
    const entry = wall.find((e) => e.userId === userId);
    res.json({ optedIn: entry?.optedIn === true, displayName: entry?.displayName ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /organisations/:id/supporters/me error");
    res.status(500).json({ error: "Failed to fetch supporter status" });
  }
});

// PATCH /organisations/:id/supporters/me — authenticated; opt in or out.
// Opt-in requires a verified paid donation. Opt-out is always permitted.
router.patch("/organisations/:id/supporters/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.params["id"] as string;
    const { optedIn } = req.body as { optedIn: boolean };
    if (typeof optedIn !== "boolean") {
      res.status(400).json({ error: "optedIn must be a boolean" });
      return;
    }

    const serverToken = await getServerToken();

    // Read user doc, org doc, and (when opting in) user's donations in parallel
    const [userDoc, orgDoc, allDonations] = await Promise.all([
      fsGet("users", userId, serverToken),
      fsGet("organisations", orgId, serverToken),
      optedIn
        ? fsQuery("donations", [{ field: "userId", op: "EQUAL", value: userId }], serverToken)
        : Promise.resolve(null),
    ]);

    // Verify org exists
    if (!orgDoc) { res.status(404).json({ error: "Organisation not found" }); return; }

    // Gate opt-in: must have at least one paid donation to this org
    if (optedIn) {
      // Accept both "paid" (confirm-redirect path) and "succeeded" (webhook path)
      const hasPaidDonation = (allDonations ?? []).some(
        (d) => d["orgId"] === orgId && (d["status"] === "paid" || d["status"] === "succeeded"),
      );
      if (!hasPaidDonation) {
        res.status(403).json({
          error: "You must have donated to this organisation to join its supporter wall",
        });
        return;
      }
    }

    const rawName    = (userDoc?.["name"] as string | undefined) ?? "Supporter";
    const displayName = formatSupporterName(rawName);
    const orgName    = (orgDoc["name"] as string | undefined) ?? orgId;

    // Upsert in org's bounded supporterWall array
    let orgWall = ((orgDoc["supporterWall"] ?? []) as OrgWallEntry[]).filter(
      (e) => e.userId !== userId,
    );
    orgWall.push({ userId, displayName, optedIn });
    // Enforce document size limit: keep only the most recent SUPPORTER_WALL_LIMIT entries
    if (orgWall.length > SUPPORTER_WALL_LIMIT) orgWall = orgWall.slice(-SUPPORTER_WALL_LIMIT);
    await fsPatch("organisations", orgId, { ...(orgDoc), supporterWall: orgWall }, serverToken);

    // Mirror on user doc for fast account-page listing
    const userWall = ((userDoc?.["supportedOrgs"] ?? []) as UserWallEntry[]).filter(
      (e) => e.orgId !== orgId,
    );
    userWall.push({ orgId, orgName, displayName, optedIn });
    await fsPatch("users", userId, { ...(userDoc ?? {}), supportedOrgs: userWall }, serverToken);

    res.json({ optedIn, displayName });
  } catch (err) {
    req.log.error({ err }, "PATCH /organisations/:id/supporters/me error");
    res.status(500).json({ error: "Failed to update supporter status" });
  }
});

// GET /supporters/my — authenticated; all wall entries for this user (from user doc)
router.get("/supporters/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const serverToken = await getServerToken();
    const userDoc = await fsGet("users", userId, serverToken);
    const entries = ((userDoc?.["supportedOrgs"] ?? []) as UserWallEntry[]);
    res.json(entries);
  } catch (err) {
    req.log.error({ err }, "GET /supporters/my error");
    res.status(500).json({ error: "Failed to fetch supporter entries" });
  }
});

export default router;
