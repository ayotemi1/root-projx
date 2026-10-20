import { Router, type Request, type Response } from "express";
import { fsGet, fsPatch, getServerToken } from "../lib/firebase-rest.js";
import { requireApprovedOrganisation, requireAuth } from "../lib/auth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";

const router = Router();

const DOMAIN = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : process.env.REPLIT_DEPLOYMENT === "1"
  ? `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN ?? ""}`
  : "http://localhost:3000";

// ── GET /stripe/connect/onboard — initiate Stripe Express onboarding ──────────
async function startOnboarding(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts can connect to Stripe" });
      return;
    }

    const uid = req.user!.userId;
    const serverToken = await getServerToken();
    const org = await fsGet("organisations", uid, serverToken);

    if (!org) {
      res.status(404).json({ error: "Organisation profile not found" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    let stripeAccountId = org["stripe_account_id"] as string | undefined;

    // Create the Express account if we don't have one yet
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: (org["name"] as string) ?? undefined,
          url: (org["contact"] as Record<string, string> | null)?.["website"] ?? undefined,
        },
        metadata: { orgId: uid, platform: "rootprojx" },
      });
      stripeAccountId = account.id;

      // Persist to Firestore immediately
      await fsPatch(
        "organisations",
        uid,
        { stripe_account_id: stripeAccountId, payouts_enabled: false },
        serverToken,
      );
    }

    // Generate a fresh Account Link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${DOMAIN}/api/stripe/connect/onboard`,
      return_url: `${DOMAIN}/dashboard?connect=complete`,
      type: "account_onboarding",
    });

    if (req.method === "POST") res.json({ url: accountLink.url });
    else res.redirect(accountLink.url);
  } catch (err) {
    req.log.error({ err }, "GET /stripe/connect/onboard error");
    res.status(500).json({ error: "Failed to start Stripe Connect onboarding" });
  }
}

router.get("/stripe/connect/onboard", requireAuth, requireApprovedOrganisation, startOnboarding);
router.post("/stripe/connect/onboard", requireAuth, requireApprovedOrganisation, startOnboarding);

// ── GET /stripe/connect/status — get org's Connect account status ─────────────
router.get("/stripe/connect/status", requireAuth, requireApprovedOrganisation, async (req, res) => {
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

    const stripeAccountId = org["stripe_account_id"] as string | undefined;

    if (!stripeAccountId) {
      res.json({ stripe_account_id: null, payouts_enabled: false, charges_enabled: false });
      return;
    }

    // Refresh status from Stripe
    const stripe = await getUncachableStripeClient();
    const account = await stripe.accounts.retrieve(stripeAccountId);

    const payoutsEnabled = account.payouts_enabled ?? false;
    const chargesEnabled = account.charges_enabled ?? false;

    // Sync to Firestore if status changed
    if (org["payouts_enabled"] !== payoutsEnabled) {
      await fsPatch("organisations", uid, { payouts_enabled: payoutsEnabled }, serverToken);
    }

    res.json({
      stripe_account_id: stripeAccountId,
      payouts_enabled: payoutsEnabled,
      charges_enabled: chargesEnabled,
    });
  } catch (err) {
    req.log.error({ err }, "GET /stripe/connect/status error");
    res.status(500).json({ error: "Failed to fetch Connect status" });
  }
});

// ── GET /stripe/connect/dashboard-link — Stripe Express dashboard login ────────
router.get("/stripe/connect/dashboard-link", requireAuth, requireApprovedOrganisation, async (req, res) => {
  try {
    if (req.user!.accountType !== "organisation") {
      res.status(403).json({ error: "Only organisation accounts" });
      return;
    }

    const uid = req.user!.userId;
    const serverToken = await getServerToken();
    const org = await fsGet("organisations", uid, serverToken);
    const stripeAccountId = org?.["stripe_account_id"] as string | undefined;

    if (!stripeAccountId) {
      res.status(404).json({ error: "No Stripe account connected" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);
    res.json({ url: loginLink.url });
  } catch (err) {
    req.log.error({ err }, "GET /stripe/connect/dashboard-link error");
    res.status(500).json({ error: "Failed to create Stripe dashboard link" });
  }
});

export default router;
