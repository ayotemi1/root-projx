import { Router } from "express";
import { fsList, fsQuery, fsCreate, getServerToken } from "../lib/firebase-rest.js";
import { requireAuth, optionalAuth } from "../lib/auth.js";

const router = Router();

// GET /help/orgs — directory listing from "resources" collection
// Optional ?category= &country= filters
router.get("/help/orgs", optionalAuth, async (req, res) => {
  try {
    const { category, country } = req.query as Record<string, string | undefined>;
    const token = req.headers.authorization?.slice(7) ?? await getServerToken();
    let resources: Array<Record<string, unknown>>;
    if (category || country) {
      const filters: Array<{ field: string; op: string; value: unknown }> = [];
      if (category) filters.push({ field: "category", op: "EQUAL", value: category });
      if (country) filters.push({ field: "country", op: "EQUAL", value: country });
      resources = await fsQuery("resources", filters, token);
    } else {
      resources = await fsList("resources", token);
    }
    res.json(resources);
  } catch (err) {
    req.log.error({ err }, "GET /help/orgs error");
    res.status(500).json({ error: "Failed to fetch help resources" });
  }
});

// POST /help/contact — submit a contact enquiry (stored in Firestore for now)
router.post("/help/contact", optionalAuth, async (req, res) => {
  try {
    const { name, email, message, orgId } = req.body as Record<string, unknown>;
    if (!name || !email || !message) {
      res.status(400).json({ error: "name, email and message are required" });
      return;
    }
    const token = req.headers.authorization?.slice(7);
    const data: Record<string, unknown> = {
      name,
      email,
      message,
      orgId: orgId ?? null,
      userId: req.user?.userId ?? null,
      createdAt: new Date().toISOString(),
    };
    const id = await fsCreate("contact_enquiries", data, token);
    res.status(201).json({ _id: id, ...data });
  } catch (err) {
    req.log.error({ err }, "POST /help/contact error");
    res.status(500).json({ error: "Failed to submit contact enquiry" });
  }
});

// GET /help/reviews/:orgId — reviews for a specific organisation
router.get("/help/reviews/:orgId", optionalAuth, async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7) ?? await getServerToken();
    const reviews = await fsQuery(
      "reviews",
      [{ field: "orgId", op: "EQUAL", value: req.params.orgId }],
      token,
      // No orderBy — composite index required; sort in JS instead
    );
    reviews.sort((a, b) =>
      ((b["createdAt"] as string) ?? "").localeCompare((a["createdAt"] as string) ?? ""),
    );
    res.json(reviews);
  } catch (err) {
    req.log.error({ err }, "GET /help/reviews/:orgId error");
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// POST /help/reviews — submit a review (authenticated supporters only)
router.post("/help/reviews", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const { orgId, rating, content } = req.body as Record<string, unknown>;

    if (!orgId || !rating || !content) {
      res.status(400).json({ error: "orgId, rating and content are required" });
      return;
    }
    const ratingNum = Number(rating);
    if (ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: "rating must be between 1 and 5" });
      return;
    }

    // Fetch user name for denormalisation
    const userData = await fsQuery("users", [
      { field: "uid", op: "EQUAL", value: uid },
    ], token);
    const authorName = (userData[0]?.["name"] as string) ?? req.user!.email;

    const data: Record<string, unknown> = {
      orgId,
      authorId: uid,
      authorName,
      rating: ratingNum,
      content,
      verified: false,
      createdAt: new Date().toISOString(),
    };

    const newId = await fsCreate("reviews", data, token);
    res.status(201).json({ _id: newId, ...data });
  } catch (err) {
    req.log.error({ err }, "POST /help/reviews error");
    res.status(500).json({ error: "Failed to submit review" });
  }
});

export default router;
