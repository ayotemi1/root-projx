import { Router } from "express";
import { db } from "@workspace/db";
import {
  followsTable,
  organisationsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// POST /follows
router.post("/follows", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.body as { orgId: number };

    if (!orgId) {
      res.status(400).json({ error: "orgId is required" });
      return;
    }

    // Check org exists
    const [org] = await db
      .select({ id: organisationsTable.id })
      .from(organisationsTable)
      .where(eq(organisationsTable.id, orgId))
      .limit(1);

    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    // Upsert — ignore duplicate follows
    await db
      .insert(followsTable)
      .values({ supporterId: req.user!.userId, orgId })
      .onConflictDoNothing();

    // Recalculate follower count
    const allFollows = await db
      .select({ id: followsTable.id })
      .from(followsTable)
      .where(eq(followsTable.orgId, orgId));

    await db
      .update(organisationsTable)
      .set({ followerCount: allFollows.length })
      .where(eq(organisationsTable.id, orgId));

    res.status(201).json({ message: "Followed successfully" });
  } catch (err) {
    req.log.error({ err }, "follow error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /follows/:orgId
router.delete("/follows/:orgId", requireAuth, async (req, res) => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid orgId" });
      return;
    }

    await db
      .delete(followsTable)
      .where(
        and(
          eq(followsTable.supporterId, req.user!.userId),
          eq(followsTable.orgId, orgId),
        ),
      );

    // Recalculate follower count
    const allFollows = await db
      .select({ id: followsTable.id })
      .from(followsTable)
      .where(eq(followsTable.orgId, orgId));

    await db
      .update(organisationsTable)
      .set({ followerCount: allFollows.length })
      .where(eq(organisationsTable.id, orgId));

    res.json({ message: "Unfollowed successfully" });
  } catch (err) {
    req.log.error({ err }, "unfollow error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /follows/my
router.get("/follows/my", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: organisationsTable.id,
        userId: organisationsTable.userId,
        orgName: organisationsTable.orgName,
        mission: organisationsTable.mission,
        location: organisationsTable.location,
        country: organisationsTable.country,
        causeCategory: organisationsTable.causeCategory,
        goalAmount: organisationsTable.goalAmount,
        raisedAmount: organisationsTable.raisedAmount,
        distributedAmount: organisationsTable.distributedAmount,
        donorCount: organisationsTable.donorCount,
        followerCount: organisationsTable.followerCount,
        verified: organisationsTable.verified,
        helpOptedIn: organisationsTable.helpOptedIn,
        helpServices: organisationsTable.helpServices,
        responseCommitment: organisationsTable.responseCommitment,
        whatsappNumber: organisationsTable.whatsappNumber,
        createdAt: organisationsTable.createdAt,
      })
      .from(followsTable)
      .innerJoin(
        organisationsTable,
        eq(followsTable.orgId, organisationsTable.id),
      )
      .where(eq(followsTable.supporterId, req.user!.userId));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "get follows error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
