import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, signToken } from "../lib/auth.js";

const router = Router();

// POST /auth/register
router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password, accountType } = req.body as {
      name: string;
      email: string;
      phone?: string;
      password: string;
      accountType: "supporter" | "organisation";
    };

    if (!name || !email || !password || !accountType) {
      res.status(400).json({ error: "name, email, password and accountType are required" });
      return;
    }

    if (!["supporter", "organisation"].includes(accountType)) {
      res.status(400).json({ error: "accountType must be supporter or organisation" });
      return;
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      res.status(400).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const avatarInitials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const [user] = await db
      .insert(usersTable)
      .values({
        name,
        email: email.toLowerCase(),
        phone: phone ?? null,
        passwordHash,
        accountType,
        avatarInitials,
      })
      .returning();

    if (!user) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, accountType: user.accountType });

    // Store token on user for logout invalidation
    await db
      .update(usersTable)
      .set({ token })
      .where(eq(usersTable.id, user.id));

    const { passwordHash: _ph, token: _t, ...publicUser } = user;

    res.status(201).json({ token, user: { ...publicUser, token: undefined } });
  } catch (err) {
    req.log.error({ err }, "register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, accountType: user.accountType });

    await db
      .update(usersTable)
      .set({ token })
      .where(eq(usersTable.id, user.id));

    const { passwordHash: _ph, token: _t, ...publicUser } = user;
    res.json({ token, user: publicUser });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/logout
router.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    await db
      .update(usersTable)
      .set({ token: null })
      .where(eq(usersTable.id, req.user!.userId));
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    req.log.error({ err }, "logout error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
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
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (err) {
    req.log.error({ err }, "me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
