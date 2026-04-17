import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  organisationsTable,
  donationsTable,
  followsTable,
} from "@workspace/db/schema";
import { eq, count, sum } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        phone: usersTable.phone,
        accountType: usersTable.accountType,
        avatarInitials: usersTable.avatarInitials,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Org profile (if organisation account)
    const [org] = await db
      .select()
      .from(organisationsTable)
      .where(eq(organisationsTable.userId, userId))
      .limit(1);

    // Donation stats
    const [donationStats] = await db
      .select({
        donationCount: count(donationsTable.id),
        totalDonated: sum(donationsTable.amount),
      })
      .from(donationsTable)
      .where(eq(donationsTable.supporterId, userId));

    // Follow count
    const [followStats] = await db
      .select({ followCount: count(followsTable.id) })
      .from(followsTable)
      .where(eq(followsTable.supporterId, userId));

    res.json({
      user,
      organisation: org ?? null,
      donationCount: Number(donationStats?.donationCount ?? 0),
      totalDonated: donationStats?.totalDonated ?? "0.00",
      followCount: Number(followStats?.followCount ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "get profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /profile
router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { name, email, phone } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
    };

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (phone !== undefined) updates.phone = phone;

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        phone: usersTable.phone,
        accountType: usersTable.accountType,
        avatarInitials: usersTable.avatarInitials,
        createdAt: usersTable.createdAt,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "update profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
