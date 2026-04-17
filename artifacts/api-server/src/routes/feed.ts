import { Router } from "express";
import { db } from "@workspace/db";
import {
  updatesTable,
  followsTable,
  organisationsTable,
} from "@workspace/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth.js";

const router = Router();

// GET /feed/public — no auth required, all recent updates
router.get("/feed/public", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: updatesTable.id,
        orgId: updatesTable.orgId,
        title: updatesTable.title,
        body: updatesTable.body,
        tag: updatesTable.tag,
        mediaUrls: updatesTable.mediaUrls,
        sentToCount: updatesTable.sentToCount,
        createdAt: updatesTable.createdAt,
        orgName: organisationsTable.orgName,
        orgCountry: organisationsTable.country,
        orgVerified: organisationsTable.verified,
      })
      .from(updatesTable)
      .leftJoin(organisationsTable, eq(updatesTable.orgId, organisationsTable.id))
      .orderBy(desc(updatesTable.createdAt))
      .limit(50);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "public feed error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /feed — updates from orgs the current user follows
router.get("/feed", requireAuth, async (req, res) => {
  try {
    // Get orgs this user follows
    const followed = await db
      .select({ orgId: followsTable.orgId })
      .from(followsTable)
      .where(eq(followsTable.supporterId, req.user!.userId));

    const orgIds = followed.map((f) => f.orgId).filter((id): id is number => id !== null);

    if (orgIds.length === 0) {
      // Return public feed if no follows yet
      const publicRows = await db
        .select({
          id: updatesTable.id,
          orgId: updatesTable.orgId,
          title: updatesTable.title,
          body: updatesTable.body,
          tag: updatesTable.tag,
          mediaUrls: updatesTable.mediaUrls,
          sentToCount: updatesTable.sentToCount,
          createdAt: updatesTable.createdAt,
          orgName: organisationsTable.orgName,
          orgCountry: organisationsTable.country,
          orgVerified: organisationsTable.verified,
        })
        .from(updatesTable)
        .leftJoin(organisationsTable, eq(updatesTable.orgId, organisationsTable.id))
        .orderBy(desc(updatesTable.createdAt))
        .limit(50);
      res.json(publicRows);
      return;
    }

    const rows = await db
      .select({
        id: updatesTable.id,
        orgId: updatesTable.orgId,
        title: updatesTable.title,
        body: updatesTable.body,
        tag: updatesTable.tag,
        mediaUrls: updatesTable.mediaUrls,
        sentToCount: updatesTable.sentToCount,
        createdAt: updatesTable.createdAt,
        orgName: organisationsTable.orgName,
        orgCountry: organisationsTable.country,
        orgVerified: organisationsTable.verified,
      })
      .from(updatesTable)
      .leftJoin(organisationsTable, eq(updatesTable.orgId, organisationsTable.id))
      .where(inArray(updatesTable.orgId, orgIds))
      .orderBy(desc(updatesTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "feed error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /feed/org/:id — updates for a specific org
router.get("/feed/org/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const rows = await db
      .select()
      .from(updatesTable)
      .where(eq(updatesTable.orgId, id))
      .orderBy(desc(updatesTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "org feed error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /feed — org posts a new update
router.post("/feed", requireAuth, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts can post updates" });
      return;
    }

    // Find this user's org
    const [org] = await db
      .select({ id: organisationsTable.id })
      .from(organisationsTable)
      .where(eq(organisationsTable.userId, req.user!.userId))
      .limit(1);

    if (!org) {
      res.status(404).json({ error: "No organisation profile found for this account" });
      return;
    }

    const { title, body, tag, mediaUrls } = req.body as {
      title: string;
      body: string;
      tag: "Before" | "During" | "After";
      mediaUrls?: string[];
    };

    if (!title || !body || !tag) {
      res.status(400).json({ error: "title, body and tag are required" });
      return;
    }

    if (!["Before", "During", "After"].includes(tag)) {
      res.status(400).json({ error: "tag must be Before, During or After" });
      return;
    }

    const [update] = await db
      .insert(updatesTable)
      .values({
        orgId: org.id,
        title,
        body,
        tag,
        mediaUrls: mediaUrls ?? [],
        sentToCount: 0,
      })
      .returning();

    res.status(201).json(update);
  } catch (err) {
    req.log.error({ err }, "post update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
