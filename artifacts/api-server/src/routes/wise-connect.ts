import { Router } from "express";
import { disburseToOrg, getWisePlatformProfileId } from "../lib/wise.js";
import { fsGet, fsPatch, getServerToken } from "../lib/firebase-rest.js";
import { requireApprovedOrganisation, requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

const WISE_BASE =
  process.env.REPLIT_DEPLOYMENT === "1"
    ? "https://api.wise.com"
    : "https://api.sandbox.transferwise.tech";

// ── Wise API helpers ───────────────────────────────────────────────────────────

async function createWiseRecipient(
  apiKey: string,
  profileId: number,
  email: string,
): Promise<number> {
  const existingRes = await fetch(
    `${WISE_BASE}/v1/accounts?profileId=${encodeURIComponent(profileId)}&currency=GBP`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!existingRes.ok) {
    throw new Error("Failed to check existing Wise recipients.");
  }

  const existingAccounts = (await existingRes.json()) as Array<{
    id: number;
    details?: { email?: string };
  }>;
  const existingRecipient = existingAccounts.find(
    (account) => account.details?.email?.trim().toLowerCase() === email,
  );
  if (existingRecipient) {
    return existingRecipient.id;
  }

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
router.get("/wise/connect/status", requireAuth, requireApprovedOrganisation, async (req, res) => {
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
router.put("/wise/connect", requireAuth, requireApprovedOrganisation, async (req, res) => {
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
router.delete("/wise/connect", requireAuth, requireApprovedOrganisation, async (req, res) => {
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
      { wise_email: null, wise_recipient_id: null, wise_verified: false },
      serverToken,
    );

    res.json({ disconnected: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /wise/connect error");
    res.status(500).json({ error: "Failed to disconnect Wise account" });
  }
});

// ── POST /wise/disburse — admin-only: send funds to an org via Wise ───────────
//
// Flow:
//   1. Load org → wise_recipient_id
//   2. GET /v1/profiles          → platform profileId
//   3. POST /v3/profiles/{id}/quotes → lock in amount + exchange rate (quoteId)
//   4. POST /v1/transfers         → create transfer instruction (transferId)
//   5. POST /v3/profiles/{id}/transfers/{id}/payments → fund from Wise balance
//   6. Patch Firestore org doc with disbursement record
//
// Auth: X-Admin-Secret header must match ADMIN_SECRET env var.
//
router.post("/wise/disburse", requireAdmin, async (req, res) => {
  try {
    const { orgId, amountGbp, reference } = req.body as {
      orgId?: string;
      amountGbp?: number;
      reference?: string;
    };

    if (!orgId || typeof orgId !== "string") {
      res.status(400).json({ error: "orgId is required" });
      return;
    }
    if (!amountGbp || typeof amountGbp !== "number" || amountGbp <= 0) {
      res.status(400).json({ error: "amountGbp must be a positive number" });
      return;
    }

    const apiKey = process.env.WISE_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "WISE_API_KEY is not configured on this server." });
      return;
    }

    // Load org — verify Wise is connected
    const serverToken = await getServerToken();
    const org = await fsGet("organisations", orgId, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }
    const owner = await fsGet("users", orgId, serverToken);
    if (owner?.["approvalStatus"] === "pending" || owner?.["approvalStatus"] === "declined") {
      res.status(403).json({ error: "This organisation is not approved for payouts" });
      return;
    }

    const wiseRecipientId = org["wise_recipient_id"] as number | null;
    const wiseEmail = org["wise_email"] as string | null;

    if (!wiseRecipientId) {
      res.status(422).json({
        error:
          "This organisation has not connected a Wise account yet. Ask them to add their Wise email in the dashboard first.",
      });
      return;
    }

    const transferId = await disburseToOrg(orgId, amountGbp, reference?.trim() ?? "");
    const settled = await fsGet("organisations", orgId, serverToken);
    const disbursedAt = settled?.lastDisbursementAt;

    req.log.info(
      { orgId, amountGbp, transferId },
      "Wise disbursement initiated",
    );

    res.json({
      ok: true,
      transferId,
      transferStatus: settled?.lastDisbursementTransferStatus,
      paymentStatus: settled?.lastDisbursementPaymentStatus,
      amountGbp,
      recipientEmail: wiseEmail,
      disbursedAt,
    });
  } catch (err) {
    req.log.error({ err }, "POST /wise/disburse error");
    const msg = err instanceof Error ? err.message : "Disbursement failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
