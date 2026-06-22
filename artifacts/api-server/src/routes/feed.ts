import { Router } from "express";
import { fsQuery, fsCreate, fsGet, getServerToken } from "../lib/firebase-rest.js";
import { requireAuth, optionalAuth } from "../lib/auth.js";

const router = Router();

// GET /feed/public — latest 30 updates; no auth required
router.get("/feed/public", async (req, res) => {
  try {
    const serverToken = await getServerToken();
    const updates = await fsQuery(
      "updates",
      [],
      serverToken,
      { orderBy: { field: "createdAt", dir: "DESCENDING" }, limit: 30 },
    );
    res.json(updates);
  } catch (err) {
    req.log.error({ err }, "GET /feed/public error");
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

// GET /feed — personalised feed: updates from orgs the user follows
router.get("/feed", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);

    // Get followed org IDs
    const follows = await fsQuery("follows", [
      { field: "userId", op: "EQUAL", value: uid },
    ], token);

    if (follows.length === 0) {
      res.json([]);
      return;
    }

    const orgIds = follows.map((f) => f["orgId"] as string);

    // Firestore REST doesn't support IN queries easily — fetch per org in parallel
    // No orderBy to avoid composite-index requirement; sort in JS after merge
    const perOrg = await Promise.all(
      orgIds.map((orgId) =>
        fsQuery(
          "updates",
          [{ field: "orgId", op: "EQUAL", value: orgId }],
          token,
        ),
      ),
    );

    const all = perOrg
      .flat()
      .sort((a, b) =>
        ((b["createdAt"] as string) ?? "").localeCompare((a["createdAt"] as string) ?? ""),
      )
      .slice(0, 50);

    res.json(all);
  } catch (err) {
    req.log.error({ err }, "GET /feed error");
    res.status(500).json({ error: "Failed to fetch personalised feed" });
  }
});

// GET /feed/org/:id — updates for a specific organisation
router.get("/feed/org/:id", optionalAuth, async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7) ?? await getServerToken();
    const updates = await fsQuery(
      "updates",
      [{ field: "orgId", op: "EQUAL", value: req.params.id }],
      token,
      // No orderBy here — composite index would be required; sort in JS instead
    );
    updates.sort((a, b) =>
      ((b["createdAt"] as string) ?? "").localeCompare((a["createdAt"] as string) ?? ""),
    );
    res.json(updates.slice(0, 20));
  } catch (err) {
    req.log.error({ err }, "GET /feed/org/:id error");
    res.status(500).json({ error: "Failed to fetch org feed" });
  }
});

// POST /feed — publish a new update (org accounts only)
router.post("/feed", requireAuth, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts can post updates" });
      return;
    }
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);

    const { title, content, type, mediaUrls } = req.body as Record<string, unknown>;
    if (!title || !content) {
      res.status(400).json({ error: "title and content are required" });
      return;
    }
    if (typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
      res.status(400).json({ error: "title must be between 1 and 200 characters" });
      return;
    }
    if (typeof content !== "string" || content.trim().length === 0 || content.length > 5000) {
      res.status(400).json({ error: "content must be between 1 and 5000 characters" });
      return;
    }
    const ALLOWED_TYPES = ["update", "milestone", "campaign", "before", "during", "after"];
    const resolvedType = typeof type === "string" && ALLOWED_TYPES.includes(type) ? type : "update";

    // Fetch the org name for denormalisation
    const org = await fsGet("organisations", uid, token);
    const orgName = (org?.["name"] as string) ?? "";

    // Validate mediaUrls if provided — cap at 10 items, string URLs only
    const urls: string[] = Array.isArray(mediaUrls)
      ? (mediaUrls as unknown[])
          .filter((u): u is string => typeof u === "string")
          .slice(0, 10)
      : [];

    const data: Record<string, unknown> = {
      orgId: uid,
      orgName,
      type: resolvedType,
      title,
      content,
      mediaUrls: urls,
      likes: 0,
      createdAt: new Date().toISOString(),
    };

    const newId = await fsCreate("updates", data, token);
    res.status(201).json({ _id: newId, ...data });
  } catch (err) {
    req.log.error({ err }, "POST /feed error");
    res.status(500).json({ error: "Failed to publish update" });
  }
});

export default router;
