import { Router } from "express";
import { randomUUID } from "node:crypto";
import { fsGet, fsPatch, fsQuery, getServerToken } from "../lib/firebase-rest.js";
import { requireAuth } from "../lib/auth.js";
import { GetSupporterInterestsResponse, SaveSupporterInterestsBody } from "@workspace/api-zod";

const router = Router();
const MAX_PUBLIC_DISPLAY_NAME = 80;
const MAX_PUBLIC_BIO = 280;
const PUBLIC_PROFILE_ID_PATTERN = /^sp_[a-f0-9]{32}$/;

// Private account preferences. Never project these onto /supporters/:publicId.
router.get("/profile/interests", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.user!.accountType !== "supporter") {
    res.status(403).json({ error: "Interests are available to supporter accounts only." });
    return;
  }
  try {
    const user = await fsGet("users", req.user!.userId, req.headers.authorization!.slice(7));
    if (!user) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(GetSupporterInterestsResponse.parse({ interests: user.interests ?? [] }));
  } catch {
    req.log.error("Could not load supporter interests");
    res.status(503).json({ error: "We couldn't load your interests. Please try again." });
  }
});

router.put("/profile/interests", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.user!.accountType !== "supporter") {
    res.status(403).json({ error: "Interests are available to supporter accounts only." });
    return;
  }
  const parsed = SaveSupporterInterestsBody.strict().safeParse(req.body);
  if (!parsed.success || new Set(parsed.data.interests).size !== parsed.data.interests.length) {
    res.status(400).json({ error: "Choose interests from the available sectors, with each selected only once." });
    return;
  }
  try {
    const uid = req.user!.userId;
    const user = await fsGet("users", uid, req.headers.authorization!.slice(7));
    if (!user) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    // Existing rules restrict preference writes to the server. Identity is
    // derived from requireAuth, never a caller-supplied UID. Patch only this
    // field so a concurrent profile edit cannot be overwritten.
    await fsPatch("users", uid, { interests: parsed.data.interests }, await getServerToken());
    res.json(GetSupporterInterestsResponse.parse(parsed.data));
  } catch {
    req.log.error("Could not save supporter interests");
    res.status(503).json({ error: "Your interests weren't saved. Keep your selections and try again." });
  }
});

type StoredPublicProfile = {
  enabled?: boolean;
  displayName?: string;
  bio?: string;
  publicId?: string;
};

function avatarInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

function newPublicProfileId(): string {
  return `sp_${randomUUID().replaceAll("-", "")}`;
}

async function ensurePublicProfileId(
  currentId: unknown,
  ownerId: string,
  serverToken: string,
): Promise<string> {
  if (typeof currentId === "string" && PUBLIC_PROFILE_ID_PATTERN.test(currentId)) {
    const matches = await fsQuery(
      "users",
      [{ field: "publicProfile.publicId", op: "EQUAL", value: currentId }],
      serverToken,
      { limit: 2 },
    );
    if (matches.every((match) => match["_id"] === ownerId)) return currentId;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = newPublicProfileId();
    const matches = await fsQuery(
      "users",
      [{ field: "publicProfile.publicId", op: "EQUAL", value: candidate }],
      serverToken,
      { limit: 1 },
    );
    if (matches.length === 0) return candidate;
  }
  throw new Error("Could not allocate a unique public profile ID");
}

// GET /profile — return the authenticated user's full profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    let userData = await fsGet("users", uid, token);
    if (!userData) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    // Lazy migration for profiles created before opaque IDs existed. A public
    // profile only becomes reachable through the new opaque route after this
    // server-owned ID has been stored.
    let storedPublicProfile = userData["publicProfile"] as StoredPublicProfile | undefined;
    if (storedPublicProfile?.enabled === true && !PUBLIC_PROFILE_ID_PATTERN.test(storedPublicProfile.publicId ?? "")) {
      const serverToken = await getServerToken();
      const publicId = await ensurePublicProfileId(storedPublicProfile.publicId, uid, serverToken);
      userData = {
        ...userData,
        publicProfile: { ...storedPublicProfile, publicId },
      };
      await fsPatch("users", uid, userData, token);
      storedPublicProfile = userData["publicProfile"] as StoredPublicProfile;
    }

    res.json({
      id: uid,
      ...userData,
      publicProfileSettings: {
        enabled: storedPublicProfile?.enabled === true,
        displayName: storedPublicProfile?.displayName ?? userData["name"] ?? "",
        bio: storedPublicProfile?.bio ?? "",
        publicId: storedPublicProfile?.publicId ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "GET /profile error");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /profile — update name / phone for the authenticated user
router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);

    const existing = await fsGet("users", uid, token);
    if (!existing) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const allowed = ["name", "phone"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in (req.body as Record<string, unknown>)) {
        updates[key] = (req.body as Record<string, unknown>)[key];
      }
    }

    // Recompute initials if name changed
    const newName = (updates["name"] as string | undefined) ?? (existing["name"] as string);
    updates["avatarInitials"] = avatarInitials(newName);

    const merged = { ...existing, ...updates };
    await fsPatch("users", uid, merged, token);
    res.json({ id: uid, ...merged });
  } catch (err) {
    req.log.error({ err }, "PATCH /profile error");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /supporters/:publicId — public, privacy-safe supporter profile
router.get("/supporters/:publicId", async (req, res) => {
  try {
    const publicId = req.params["publicId"] as string;
    if (!PUBLIC_PROFILE_ID_PATTERN.test(publicId)) {
      res.status(404).json({ error: "Supporter profile not found" });
      return;
    }
    const token = await getServerToken();
    const matches = await fsQuery(
      "users",
      [{ field: "publicProfile.publicId", op: "EQUAL", value: publicId }],
      token,
      { limit: 2 },
    );
    const userData = matches.find((match) => {
      const candidate = match["publicProfile"] as StoredPublicProfile | undefined;
      return match["accountType"] === "supporter" && candidate?.enabled === true;
    });

    // Keep hidden profiles and organisation accounts indistinguishable from
    // missing profiles so the endpoint cannot be used to enumerate accounts.
    const publicProfile = userData?.["publicProfile"] as StoredPublicProfile | undefined;
    if (!userData || !publicProfile) {
      res.status(404).json({ error: "Supporter profile not found" });
      return;
    }
    const uid = userData["_id"] as string;

    const follows = await fsQuery(
      "follows",
      [{ field: "userId", op: "EQUAL", value: uid }],
      token,
    );
    const followedOrganisations = (
      await Promise.all(
        follows.map(async (follow) => {
          const orgId = follow["orgId"] as string;
          const org = await fsGet("organisations", orgId, token);
          if (!org) return null;
          return {
            _id: orgId,
            name: org["name"] as string,
            country: org["country"] as string,
            category: org["category"] as string,
            verified: org["verified"] === true,
          };
        }),
      )
    ).filter(Boolean);

    const supportedOrgs = (
      (userData["supportedOrgs"] ?? []) as Array<{
        orgId?: string;
        orgName?: string;
        optedIn?: boolean;
      }>
    )
      .filter((entry) => entry.optedIn === true && entry.orgId && entry.orgName)
      .map((entry) => ({ orgId: entry.orgId!, orgName: entry.orgName! }));

    // Explicit allowlist: never spread userData into this public response.
    res.json({
      displayName: publicProfile.displayName ?? userData["name"] ?? "Supporter",
      bio: publicProfile.bio ?? "",
      avatarInitials: avatarInitials(String(publicProfile.displayName ?? userData["name"] ?? "S")),
      createdAt: userData["createdAt"] ?? null,
      followedOrganisations,
      supportedOrganisations: supportedOrgs,
    });
  } catch (err) {
    req.log.error({ err }, "GET /supporters/:publicId error");
    res.status(500).json({ error: "Failed to fetch supporter profile" });
  }
});

// PATCH /profile/public — update the authenticated supporter's public profile
router.patch("/profile/public", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const existing = await fsGet("users", uid, token);
    if (!existing) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    if (existing["accountType"] !== "supporter") {
      res.status(403).json({ error: "Only supporter accounts can create a public profile" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (typeof body["enabled"] !== "boolean") {
      res.status(400).json({ error: "enabled must be a boolean" });
      return;
    }
    if (typeof body["displayName"] !== "string" || !body["displayName"].trim()) {
      res.status(400).json({ error: "A public display name is required" });
      return;
    }
    if (typeof body["bio"] !== "string") {
      res.status(400).json({ error: "bio must be a string" });
      return;
    }

    const displayName = body["displayName"].trim();
    const bio = body["bio"].trim();
    if (displayName.length > MAX_PUBLIC_DISPLAY_NAME) {
      res.status(400).json({ error: `Display name must be ${MAX_PUBLIC_DISPLAY_NAME} characters or fewer` });
      return;
    }
    if (bio.length > MAX_PUBLIC_BIO) {
      res.status(400).json({ error: `Bio must be ${MAX_PUBLIC_BIO} characters or fewer` });
      return;
    }

    const storedPublicProfile = existing["publicProfile"] as StoredPublicProfile | undefined;
    const serverToken = await getServerToken();
    const publicId = await ensurePublicProfileId(storedPublicProfile?.publicId, uid, serverToken);
    const publicProfile = { enabled: body["enabled"], displayName, bio, publicId };
    await fsPatch("users", uid, { ...existing, publicProfile }, token);
    res.json(publicProfile);
  } catch (err) {
    req.log.error({ err }, "PATCH /profile/public error");
    res.status(500).json({ error: "Failed to update public profile" });
  }
});

export default router;
