import { Router } from "express";
import { fsQuery } from "../lib/firebase-rest.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// POST /donations — Stripe payment intent (Step 9)
router.post("/donations", requireAuth, async (_req, res) => {
  res.status(503).json({
    error: "Stripe donation integration coming in Step 9",
    hint: "Use POST /donations with { orgId, amount, currency } once Stripe is configured",
  });
});

// GET /donations/my — authenticated user's donation history
router.get("/donations/my", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const donations = await fsQuery(
      "donations",
      [{ field: "userId", op: "EQUAL", value: uid }],
      token,
      // No orderBy — composite index required; sort in JS instead
    );
    donations.sort((a, b) =>
      ((b["createdAt"] as string) ?? "").localeCompare((a["createdAt"] as string) ?? ""),
    );
    res.json(donations);
  } catch (err) {
    req.log.error({ err }, "GET /donations/my error");
    res.status(500).json({ error: "Failed to fetch donation history" });
  }
});

export default router;
