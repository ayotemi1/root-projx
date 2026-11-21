import { Router } from "express";
import { fsGet, fsPatch, fsDelete, fsQuery, fsIncrement, getServerToken } from "../lib/firebase-rest.js";
import { requireAuth } from "../lib/auth.js";
import { withoutPrivatePayoutSetup } from "../lib/payout-setup.js";

const router = Router();

// POST /follows — follow an organisation
router.post("/follows", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const { orgId } = req.body as { orgId: string };

    if (!orgId) {
      res.status(400).json({ error: "orgId is required" });
      return;
    }

    const serverToken = await getServerToken();
    const org = await fsGet("organisations", orgId, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    const followId = `${uid}_${orgId}`;
    const existingFollow = await fsGet("follows", followId, serverToken);
    if (existingFollow) {
      res.status(409).json({ error: "Already following this organisation" });
      return;
    }

    const followData = {
      userId: uid,
      orgId,
      createdAt: new Date().toISOString(),
    };
    await fsPatch("follows", followId, followData, token);

    // Organisation documents are server-only. Never write a stale whole-org
    // snapshot here: it could overwrite campaign or accounting updates.
    await fsIncrement("organisations", orgId, { followerCount: 1 }, serverToken);

    res.status(201).json({ _id: followId, ...followData });
  } catch (err) {
    req.log.error({ err }, "POST /follows error");
    res.status(500).json({ error: "Failed to follow organisation" });
  }
});

// DELETE /follows/:orgId — unfollow an organisation
router.delete("/follows/:orgId", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const orgId = req.params["orgId"] as string;

    const followId = `${uid}_${orgId}`;
    const existing = await fsGet("follows", followId, token);
    if (!existing) {
      res.status(404).json({ error: "You are not following this organisation" });
      return;
    }

    await fsDelete("follows", followId, token);

    // Decrement followerCount
    const serverToken = await getServerToken();
    const org = await fsGet("organisations", orgId, serverToken);
    if (org) {
      const currentCount = (org["followerCount"] as number) ?? 1;
      if (currentCount > 0) {
        await fsIncrement("organisations", orgId, { followerCount: -1 }, serverToken);
      }
    }

    res.json({ message: "Unfollowed successfully" });
  } catch (err) {
    req.log.error({ err }, "DELETE /follows/:orgId error");
    res.status(500).json({ error: "Failed to unfollow organisation" });
  }
});

// GET /follows/my — list orgs the authenticated user follows
router.get("/follows/my", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);

    const follows = await fsQuery("follows", [
      { field: "userId", op: "EQUAL", value: uid },
    ], token);
    const serverToken = await getServerToken();

    // Fetch org profiles in parallel
    const orgs = await Promise.all(
      follows.map(async (f) => {
        const orgId = f["orgId"] as string;
        const org = await fsGet("organisations", orgId, serverToken);
        if (!org) return null;
        const { campaigns: _campaigns, ...publicOrg } = org;
        return { _id: orgId, ...withoutPrivatePayoutSetup(publicOrg) };
      }),
    );

    res.json(orgs.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "GET /follows/my error");
    res.status(500).json({ error: "Failed to fetch followed organisations" });
  }
});

export default router;
