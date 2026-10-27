import { Router, type Request, type Response } from "express";
import { fsGet, fsPatch, getServerToken } from "../lib/firebase-rest.js";
import { requireApprovedOrganisation, requireAuth } from "../lib/auth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { CONNECT_ACCOUNT_API_VERSION, onboardingOrigin, stripeCountry } from "../lib/stripe-onboarding.js";

const router = Router();

const DOMAIN = onboardingOrigin(process.env);

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
      const country = stripeCountry(org["country"]);
      if (!country) {
        res.status(400).json({ error: "Set a valid country in your organisation profile before connecting Stripe." });
        return;
      }
      const account = await stripe.accounts.create({
        type: "express",
        country,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: (org["name"] as string) ?? undefined,
          url: (org["contact"] as Record<string, string> | null)?.["website"] ?? undefined,
        },
        metadata: { orgId: uid, platform: "rootprojx" },
      }, { apiVersion: CONNECT_ACCOUNT_API_VERSION });
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
      // Return to the signed-in app; it can attach the organisation's bearer
      // token when requesting a replacement link. Stripe's redirect cannot.
      refresh_url: `${DOMAIN}/dashboard?tab=profile&connect=refresh`,
      return_url: `${DOMAIN}/dashboard?tab=profile&connect=complete`,
      type: "account_onboarding",
    });

    if (req.method === "POST") res.json({ url: accountLink.url });
    else res.redirect(accountLink.url);
  } catch (err) {
    req.log.error({ err }, "GET /stripe/connect/onboard error");
    const stripeError = err as { type?: string; message?: string; statusCode?: number };
    if (stripeError.type?.startsWith("Stripe") && stripeError.message) {
      res.status(stripeError.statusCode && stripeError.statusCode >= 400 && stripeError.statusCode < 600
        ? stripeError.statusCode : 502).json({ error: stripeError.message });
    } else {
      res.status(500).json({ error: "Unable to start Stripe onboarding. Please try again." });
    }
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
