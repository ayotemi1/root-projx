import { Router } from "express";
import { fsQuery, fsCreate, fsGet, fsPatch, getServerToken } from "../lib/firebase-rest.js";
import { requireApprovedOrganisation, requireAuth, optionalAuth } from "../lib/auth.js";
import { normaliseContentLink } from "../lib/feed-content.js";

const router = Router();

// GET /feed/public — all published organisation posts; no auth required
router.get("/feed/public", async (req, res) => {
  try {
    const serverToken = await getServerToken();
    const updates = await fsQuery(
      "updates",
      [],
      serverToken,
      { orderBy: { field: "createdAt", dir: "DESCENDING" } },
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
      );

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
    res.json(updates);
  } catch (err) {
    req.log.error({ err }, "GET /feed/org/:id error");
    res.status(500).json({ error: "Failed to fetch org feed" });
  }
});

// POST /feed — publish a new update (org accounts only)
router.post("/feed", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts can post updates" });
      return;
    }
    const uid = req.user!.userId;
    const serverToken = await getServerToken();

    const { title, content, type, mediaUrls, externalUrl } = req.body as Record<string, unknown>;
    let contentLink: string | null;
    try {
      contentLink = normaliseContentLink(externalUrl);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    if (title != null && (typeof title !== "string" || title.length > 200)) {
      res.status(400).json({ error: "Post title must be at most 200 characters." });
      return;
    }
    if (content != null && (typeof content !== "string" || content.length > 5000)) {
      res.status(400).json({ error: "Post caption must be at most 5000 characters." });
      return;
    }
    const ALLOWED_TYPES = ["update", "milestone", "campaign", "before", "during", "after"];
    const resolvedType = typeof type === "string" && ALLOWED_TYPES.includes(type) ? type : "update";

    // Fetch the org name for denormalisation
    const org = await fsGet("organisations", uid, serverToken);
    const orgName = (org?.["name"] as string) ?? "";

    // Validate mediaUrls if provided — cap at 10 items, string URLs only
    const urls: string[] = Array.isArray(mediaUrls)
      ? (mediaUrls as unknown[])
          .filter((u): u is string => typeof u === "string")
          .slice(0, 10)
      : [];
    const caption = typeof content === "string" ? content.trim() : "";
    const postTitle = typeof title === "string" ? title.trim() : "";
    if (!caption && !postTitle && !urls.length && !contentLink) {
      res.status(400).json({ error: "Add a photo, video, link or caption to your post." });
      return;
    }

    const data: Record<string, unknown> = {
      orgId: uid,
      orgName,
      type: resolvedType,
      title: postTitle,
      content: caption,
      mediaUrls: urls,
      externalUrl: contentLink,
      likes: 0,
      createdAt: new Date().toISOString(),
    };

    const newId = await fsCreate("updates", data, serverToken);

    // Keep lastPostAt on the org doc so profile pages don't need a separate
    // feed query just to show "last active" — best-effort, non-blocking.
    try {
      if (org) {
        await fsPatch("organisations", uid, { ...org, lastPostAt: data.createdAt }, serverToken);
      }
    } catch (patchErr) {
      req.log.warn({ patchErr }, "POST /feed: failed to update lastPostAt on org doc (non-fatal)");
    }

    res.status(201).json({ _id: newId, ...data });
  } catch (err) {
    req.log.error({ err }, "POST /feed error");
    res.status(500).json({ error: "Failed to publish update" });
  }
});

export default router;
