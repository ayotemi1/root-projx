import { Router } from "express";
import { db } from "@workspace/db";
import {
  organisationsTable,
  contactEventsTable,
  helpReviewsTable,
} from "@workspace/db/schema";
import { eq, ilike, and, SQL } from "drizzle-orm";

const router = Router();

// GET /help/orgs?need=&country=
router.get("/help/orgs", async (req, res) => {
  try {
    const { need, country } = req.query as { need?: string; country?: string };

    const conditions: SQL[] = [
      eq(organisationsTable.helpOptedIn, true),
    ];

    if (country) {
      conditions.push(ilike(organisationsTable.country, `%${country}%`));
    }

    let rows = await db
      .select()
      .from(organisationsTable)
      .where(and(...conditions));

    // Filter by need service if provided
    if (need) {
      const needLower = need.toLowerCase();
      rows = rows.filter(
        (org) =>
          org.helpServices?.some((s) => s.toLowerCase().includes(needLower)) ??
          false,
      );
    }

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "get help orgs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /help/contact — log a contact event
router.post("/help/contact", async (req, res) => {
  try {
    const { sessionId, orgId, needCategory, channel } = req.body as {
      sessionId?: string;
      orgId: number;
      needCategory: string;
      channel: "whatsapp" | "email";
    };

    if (!orgId || !needCategory || !channel) {
      res.status(400).json({ error: "orgId, needCategory and channel are required" });
      return;
    }

    await db.insert(contactEventsTable).values({
      sessionId: sessionId ?? null,
      orgId,
      needCategory,
      channel,
      reviewLeft: false,
    });

    res.status(201).json({ message: "Contact event logged" });
  } catch (err) {
    req.log.error({ err }, "log contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /help/reviews/:orgId
router.get("/help/reviews/:orgId", async (req, res) => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid orgId" });
      return;
    }

    const rows = await db
      .select({
        id: helpReviewsTable.id,
        orgId: helpReviewsTable.orgId,
        reviewerName: helpReviewsTable.reviewerName,
        rating: helpReviewsTable.rating,
        body: helpReviewsTable.body,
        verifiedRecipient: helpReviewsTable.verifiedRecipient,
        createdAt: helpReviewsTable.createdAt,
      })
      .from(helpReviewsTable)
      .where(
        and(
          eq(helpReviewsTable.orgId, orgId),
          eq(helpReviewsTable.flagged, false),
        ),
      );

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "get reviews error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /help/reviews
router.post("/help/reviews", async (req, res) => {
  try {
    const { orgId, reviewerName, rating, body, sessionId } = req.body as {
      orgId: number;
      reviewerName?: string;
      rating: number;
      body?: string;
      sessionId?: string;
    };

    if (!orgId || rating === undefined) {
      res.status(400).json({ error: "orgId and rating are required" });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be between 1 and 5" });
      return;
    }

    const [review] = await db
      .insert(helpReviewsTable)
      .values({
        orgId,
        reviewerSession: sessionId ?? null,
        reviewerName: reviewerName ?? "Anonymous",
        rating,
        body: body ?? null,
        verifiedRecipient: false,
        flagged: false,
      })
      .returning({
        id: helpReviewsTable.id,
        orgId: helpReviewsTable.orgId,
        reviewerName: helpReviewsTable.reviewerName,
        rating: helpReviewsTable.rating,
        body: helpReviewsTable.body,
        verifiedRecipient: helpReviewsTable.verifiedRecipient,
        createdAt: helpReviewsTable.createdAt,
      });

    res.status(201).json(review);
  } catch (err) {
    req.log.error({ err }, "submit review error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
