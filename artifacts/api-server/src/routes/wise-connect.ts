import { Router } from "express";
import { randomUUID } from "crypto";
import { fsGet, fsPatch, getServerToken } from "../lib/firebase-rest.js";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

const WISE_BASE =
  process.env.REPLIT_DEPLOYMENT === "1"
    ? "https://api.wise.com"
    : "https://api.sandbox.transferwise.tech";

// ── Wise API helpers ───────────────────────────────────────────────────────────

async function getWisePlatformProfileId(apiKey: string): Promise<number> {
  const res = await fetch(`${WISE_BASE}/v1/profiles`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Failed to reach the Wise API — check that WISE_API_KEY is valid.");
  }
  const profiles = (await res.json()) as Array<{ id: number; type: string }>;
  const biz = profiles.find((p) => p.type === "BUSINESS") ?? profiles[0];
  if (!biz) throw new Error("No Wise profile found on this API key.");
  return biz.id;
}

async function createWiseRecipient(
  apiKey: string,
  profileId: number,
  email: string,
): Promise<number> {
  const res = await fetch(`${WISE_BASE}/v1/accounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currency: "GBP",
      type: "email",
      profile: profileId,
      ownedByCustomer: false,
      details: { email },
    }),
  });

  if (!res.ok) {
    let msg = "Wise could not verify this account.";
    try {
      const body = (await res.json()) as {
        errors?: Array<{ message: string }>;
        error_description?: string;
      };
      if (body.errors?.[0]?.message) msg = body.errors[0].message;
      else if (body.error_description) msg = body.error_description;
    } catch {
      // leave default message
    }
    throw new Error(msg);
  }

  const account = (await res.json()) as { id: number };
  return account.id;
}

// ── GET /wise/connect/status ───────────────────────────────────────────────────
router.get("/wise/connect/status", requireAuth, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts" });
      return;
    }

    const uid = req.user!.userId;
    const serverToken = await getServerToken();
    const org = await fsGet("organisations", uid, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    res.json({
      wise_email: (org["wise_email"] as string | null) ?? null,
      wise_recipient_id: (org["wise_recipient_id"] as number | null) ?? null,
      wise_verified: (org["wise_verified"] as boolean) ?? false,
    });
  } catch (err) {
    req.log.error({ err }, "GET /wise/connect/status error");
    res.status(500).json({ error: "Failed to fetch Wise status" });
  }
});

// ── PUT /wise/connect — save/verify Wise email ────────────────────────────────
router.put("/wise/connect", requireAuth, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts can connect a Wise account" });
      return;
    }

    const { email } = req.body as { email?: string };
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "email is required" });
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }

    const uid = req.user!.userId;
    const serverToken = await getServerToken();
    const org = await fsGet("organisations", uid, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    const apiKey = process.env.WISE_API_KEY;
    let wiseRecipientId: number | null = null;
    let wiseVerified = false;

    if (apiKey) {
      // Verify account exists and create a recipient record on the platform's Wise account
      const profileId = await getWisePlatformProfileId(apiKey);
      wiseRecipientId = await createWiseRecipient(apiKey, profileId, trimmedEmail);
      wiseVerified = true;
    }
    // If no API key configured, store email unverified — admin can verify later

    await fsPatch(
      "organisations",
      uid,
      {
        ...org,
        wise_email: trimmedEmail,
        wise_recipient_id: wiseRecipientId,
        wise_verified: wiseVerified,
      },
      serverToken,
    );

    res.json({
      wise_email: trimmedEmail,
      wise_recipient_id: wiseRecipientId,
      wise_verified: wiseVerified,
    });
  } catch (err) {
    req.log.error({ err }, "PUT /wise/connect error");
    // Surface Wise API errors directly to the client
    const msg = err instanceof Error ? err.message : "Failed to connect Wise account";
    res.status(422).json({ error: msg });
  }
});

// ── DELETE /wise/connect — disconnect Wise account ────────────────────────────
router.delete("/wise/connect", requireAuth, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts" });
      return;
    }

    const uid = req.user!.userId;
    const serverToken = await getServerToken();
    const org = await fsGet("organisations", uid, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    await fsPatch(
      "organisations",
      uid,
      { ...org, wise_email: null, wise_recipient_id: null, wise_verified: false },
      serverToken,
    );

    res.json({ disconnected: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /wise/connect error");
    res.status(500).json({ error: "Failed to disconnect Wise account" });
  }
});

export default router;
