import { Router } from "express";
import { fsGet, fsPatch } from "../lib/firebase-rest.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

function avatarInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

// GET /profile — return the authenticated user's full profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const userData = await fsGet("users", uid, token);
    if (!userData) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json({ id: uid, ...userData });
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

export default router;
