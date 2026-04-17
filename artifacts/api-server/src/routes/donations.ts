import { Router } from "express";
import { db } from "@workspace/db";
import {
  donationsTable,
  organisationsTable,
  followsTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// POST /donations — create a donation record (Stripe payment intent in Step 6)
router.post("/donations", requireAuth, async (req, res) => {
  try {
    const { orgId, amount, currency, type, processor } = req.body as {
      orgId: number;
      amount: number;
      currency?: string;
      type: "one-time" | "recurring";
      processor: "stripe" | "paypal";
    };

    if (!orgId || !amount || !type || !processor) {
      res.status(400).json({ error: "orgId, amount, type and processor are required" });
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

    const feePct = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "5");
    const platformFee = ((amount * feePct) / 100).toFixed(2);

    const [donation] = await db
      .insert(donationsTable)
      .values({
        supporterId: req.user!.userId,
        orgId,
        amount: amount.toFixed(2),
        currency: currency ?? "GBP",
        type,
        processor,
        platformFee,
        status: "pending",
      })
      .returning();

    res.status(201).json({
      donationId: donation!.id,
      clientSecret: null, // populated in Step 6 with Stripe
      approvalUrl: null,  // populated in Step 8 with PayPal
    });
  } catch (err) {
    req.log.error({ err }, "create donation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /donations/my
router.get("/donations/my", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: donationsTable.id,
        orgId: donationsTable.orgId,
        orgName: organisationsTable.orgName,
        amount: donationsTable.amount,
        currency: donationsTable.currency,
        type: donationsTable.type,
        processor: donationsTable.processor,
        status: donationsTable.status,
        createdAt: donationsTable.createdAt,
      })
      .from(donationsTable)
      .leftJoin(organisationsTable, eq(donationsTable.orgId, organisationsTable.id))
      .where(eq(donationsTable.supporterId, req.user!.userId))
      .orderBy(desc(donationsTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "get donations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
