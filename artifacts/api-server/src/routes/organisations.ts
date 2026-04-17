import { Router } from "express";
import { db } from "@workspace/db";
import { organisationsTable } from "@workspace/db/schema";
import { eq, ilike, and, or, SQL } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /organisations
router.get("/organisations", async (req, res) => {
  try {
    const { country, search, category } = req.query as {
      country?: string;
      search?: string;
      category?: string;
    };

    const conditions: SQL[] = [];

    if (country) {
      conditions.push(ilike(organisationsTable.country, `%${country}%`));
    }
    if (category) {
      conditions.push(ilike(organisationsTable.causeCategory, `%${category}%`));
    }
    if (search) {
      conditions.push(
        or(
          ilike(organisationsTable.orgName, `%${search}%`),
          ilike(organisationsTable.mission, `%${search}%`),
          ilike(organisationsTable.location, `%${search}%`),
        ) as SQL,
      );
    }

    const rows =
      conditions.length > 0
        ? await db.select().from(organisationsTable).where(and(...conditions))
        : await db.select().from(organisationsTable);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list organisations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /organisations/:id
router.get("/organisations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [org] = await db
      .select()
      .from(organisationsTable)
      .where(eq(organisationsTable.id, id))
      .limit(1);

    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    res.json(org);
  } catch (err) {
    req.log.error({ err }, "get organisation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /organisations
router.post("/organisations", requireAuth, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts can create an org profile" });
      return;
    }

    const {
      orgName,
      mission,
      location,
      country,
      causeCategory,
      goalAmount,
      helpOptedIn,
      helpServices,
      responseCommitment,
      whatsappNumber,
    } = req.body as {
      orgName: string;
      mission?: string;
      location?: string;
      country?: string;
      causeCategory?: string;
      goalAmount?: string;
      helpOptedIn?: boolean;
      helpServices?: string[];
      responseCommitment?: string;
      whatsappNumber?: string;
    };

    if (!orgName) {
      res.status(400).json({ error: "orgName is required" });
      return;
    }

    const [org] = await db
      .insert(organisationsTable)
      .values({
        userId: req.user!.userId,
        orgName,
        mission: mission ?? null,
        location: location ?? null,
        country: country ?? "Jamaica",
        causeCategory: causeCategory ?? null,
        goalAmount: goalAmount ?? "0",
        helpOptedIn: helpOptedIn ?? false,
        helpServices: helpServices ?? [],
        responseCommitment: responseCommitment ?? null,
        whatsappNumber: whatsappNumber ?? null,
      })
      .returning();

    res.status(201).json(org);
  } catch (err) {
    req.log.error({ err }, "create organisation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /organisations/:id
router.patch("/organisations/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [existing] = await db
      .select({ userId: organisationsTable.userId })
      .from(organisationsTable)
      .where(eq(organisationsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    if (existing.userId !== req.user!.userId) {
      res.status(403).json({ error: "Not authorised to update this organisation" });
      return;
    }

    const {
      orgName,
      mission,
      location,
      country,
      causeCategory,
      goalAmount,
      helpOptedIn,
      helpServices,
      responseCommitment,
      whatsappNumber,
    } = req.body as {
      orgName?: string;
      mission?: string;
      location?: string;
      country?: string;
      causeCategory?: string;
      goalAmount?: string;
      helpOptedIn?: boolean;
      helpServices?: string[];
      responseCommitment?: string;
      whatsappNumber?: string;
    };

    const updates: Partial<typeof organisationsTable.$inferInsert> = {};
    if (orgName !== undefined) updates.orgName = orgName;
    if (mission !== undefined) updates.mission = mission;
    if (location !== undefined) updates.location = location;
    if (country !== undefined) updates.country = country;
    if (causeCategory !== undefined) updates.causeCategory = causeCategory;
    if (goalAmount !== undefined) updates.goalAmount = goalAmount;
    if (helpOptedIn !== undefined) updates.helpOptedIn = helpOptedIn;
    if (helpServices !== undefined) updates.helpServices = helpServices;
    if (responseCommitment !== undefined) updates.responseCommitment = responseCommitment;
    if (whatsappNumber !== undefined) updates.whatsappNumber = whatsappNumber;

    const [updated] = await db
      .update(organisationsTable)
      .set(updates)
      .where(eq(organisationsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "update organisation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
