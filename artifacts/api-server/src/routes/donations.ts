import { Router } from "express";
import { fsGet, fsPatch, fsQuery, getServerToken } from "../lib/firebase-rest.js";
import { requireAuth, optionalAuth } from "../lib/auth.js";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient.js";
import { MIN_DONATION_PENCE, PLATFORM_FEE_PERCENT, platformFeePence } from "../lib/fees.js";

const DOMAIN = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : process.env.REPLIT_DEPLOYMENT === "1"
  ? `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN ?? ""}`
  : "http://localhost:3000";

const router = Router();

// ── Get / upsert Stripe customer — stored in Firestore users/{uid} ─────────────
async function ensureStripeCustomer(userId: string, email: string, token: string): Promise<string> {
  // Check for existing stripeCustomerId in Firestore user doc
  const serverToken = await getServerToken();
  const userDoc = await fsGet("users", userId, serverToken);

  if (userDoc?.["stripeCustomerId"]) {
    return userDoc["stripeCustomerId"] as string;
  }

  // Create a new Stripe customer and persist the ID back to Firestore
  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  // Write stripeCustomerId to the Firestore user document
  await fsPatch(
    "users",
    userId,
    { ...(userDoc ?? {}), stripeCustomerId: customer.id },
    serverToken,
  );

  return customer.id;
}

// ── Guest customer helper — find or create by email (no Firebase uid) ─────────
async function ensureGuestStripeCustomer(email: string): Promise<string> {
  const stripe = await getUncachableStripeClient();
  const existing = await stripe.customers.search({
    query: `email:"${email}"`,
    limit: 1,
  });
  if (existing.data.length > 0) {
    return existing.data[0]!.id;
  }
  const customer = await stripe.customers.create({
    email,
    metadata: { type: "guest" },
  });
  return customer.id;
}

// ── POST /donations/guest-payment-intent — one-time donation for unauthenticated users ──
router.post("/donations/guest-payment-intent", async (req, res) => {
  try {
    const { orgId, amountGbp, guestEmail, note } = req.body as {
      orgId: string;
      amountGbp: number;
      guestEmail: string;
      note?: string;
    };

    if (!orgId || typeof amountGbp !== "number" || !Number.isFinite(amountGbp)) {
      res.status(400).json({ error: "orgId and a valid amountGbp are required" });
      return;
    }
    if (amountGbp * 100 < MIN_DONATION_PENCE) {
      res.status(400).json({ error: "Minimum donation is £3." });
      return;
    }
    if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      res.status(400).json({ error: "A valid email address is required" });
      return;
    }

    const serverToken = await getServerToken();
    const org = await fsGet("organisations", orgId, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    const customerId = await ensureGuestStripeCustomer(guestEmail);
    const stripe = await getUncachableStripeClient();
    const amountPence = Math.round(amountGbp * 100);
    const feePence = platformFeePence(amountPence);

    const intent = await stripe.paymentIntents.create({
      amount: amountPence,
      currency: "gbp",
      customer: customerId,
      application_fee_amount: feePence,
      receipt_email: guestEmail,
      metadata: {
        guestEmail,
        orgId,
        orgName: (org["name"] as string) ?? "",
        note: note ?? "",
        type: "guest_one_time",
      },
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountGbp,
      feePence,
    });
  } catch (err) {
    req.log.error({ err }, "POST /donations/guest-payment-intent error");
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// ── POST /donations/anonymous-checkout — one-time donation, no login required ──
// Stripe Checkout handles email collection during payment itself.
router.post("/donations/anonymous-checkout", async (req, res) => {
  try {
    const { orgId, amountPence, feeCovered, originalAmountPence, feeAmountPence, campaignId } = req.body as {
      orgId?: string;
      amountPence?: number;
      feeCovered?: boolean;
      originalAmountPence?: number;
      feeAmountPence?: number;
      campaignId?: string;
    };

    const basePence = originalAmountPence ?? amountPence;
    if (!orgId || !Number.isSafeInteger(amountPence) || !Number.isSafeInteger(basePence) ||
        (feeCovered && originalAmountPence === undefined)) {
      res.status(400).json({ error: "orgId and valid donation amounts in pence are required" });
      return;
    }
    if (basePence! < MIN_DONATION_PENCE || amountPence! < MIN_DONATION_PENCE) {
      res.status(400).json({ error: "Minimum donation is £3." });
      return;
    }

    const serverToken = await getServerToken();
    const org = await fsGet("organisations", orgId, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    if (campaignId !== undefined && (
      typeof campaignId !== "string" || !campaignId ||
      !Array.isArray(org.campaigns) ||
      !org.campaigns.some((campaign: Record<string, unknown>) => campaign?._id === campaignId)
    )) {
      res.status(400).json({ error: "Campaign not found for this organisation" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    // Platform fee calculated on original donation amount (not the grossed-up amount)
    const feePence = platformFeePence(basePence!);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: amountPence,
            product_data: {
              name: `Donation to ${org["name"] as string}`,
              description: "Support straight to the source — Root ProjX",
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: {
          userId: "anonymous",
          orgId,
          orgName: (org["name"] as string) ?? "",
          amountPence: String(amountPence),
          feePence: String(feePence),
          feeCovered: feeCovered ? "true" : "false",
          originalAmountPence: String(originalAmountPence ?? amountPence),
          feeAmountPence: String(feeAmountPence ?? 0),
          type: "anonymous_one_time",
          ...(campaignId ? { campaignId } : {}),
          platform: "rootprojx",
        },
      },
      success_url: `${DOMAIN}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "POST /donations/anonymous-checkout error");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ── GET /donations/publishable-key — return public Stripe key for client ───────
router.get("/donations/publishable-key", async (_req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch {
    res.status(503).json({ error: "Stripe not configured" });
  }
});

// ── POST /donations/payment-intent — one-time donation ────────────────────────
router.post("/donations/payment-intent", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const { orgId, amountGbp, note } = req.body as {
      orgId: string;
      amountGbp: number;
      note?: string;
    };

    if (!orgId || typeof amountGbp !== "number" || !Number.isFinite(amountGbp)) {
      res.status(400).json({ error: "orgId and a valid amountGbp are required" });
      return;
    }
    if (amountGbp * 100 < MIN_DONATION_PENCE) {
      res.status(400).json({ error: "Minimum donation is £3." });
      return;
    }

    const org = await fsGet("organisations", orgId, token);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    const userDoc = await fsGet("users", uid, token);
    const email = (userDoc?.["email"] as string | undefined) ?? `user-${uid}@rootprojx.internal`;

    const customerId = await ensureStripeCustomer(uid, email, token);
    const stripe = await getUncachableStripeClient();

    const amountPence = Math.round(amountGbp * 100);
    const feePence = platformFeePence(amountPence);

    const intent = await stripe.paymentIntents.create({
      amount: amountPence,
      currency: "gbp",
      customer: customerId,
      application_fee_amount: feePence,
      metadata: {
        userId: uid,
        orgId,
        orgName: (org["name"] as string) ?? "",
        note: note ?? "",
        type: "one_time",
      },
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountGbp,
      feePence,
    });
  } catch (err) {
    req.log.error({ err }, "POST /donations/payment-intent error");
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// ── POST /donations/subscription — recurring monthly donation ─────────────────
router.post("/donations/subscription", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const { orgId, amountGbp, note } = req.body as {
      orgId: string;
      amountGbp: number;
      note?: string;
    };

    if (!orgId || typeof amountGbp !== "number" || !Number.isFinite(amountGbp)) {
      res.status(400).json({ error: "orgId and a valid amountGbp are required" });
      return;
    }
    if (amountGbp * 100 < MIN_DONATION_PENCE) {
      res.status(400).json({ error: "Minimum donation is £3." });
      return;
    }

    const org = await fsGet("organisations", orgId, token);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    const userDoc = await fsGet("users", uid, token);
    const email = (userDoc?.["email"] as string | undefined) ?? `user-${uid}@rootprojx.internal`;

    const customerId = await ensureStripeCustomer(uid, email, token);
    const stripe = await getUncachableStripeClient();

    const amountPence = Math.round(amountGbp * 100);
    const feePence = platformFeePence(amountPence);

    const price = await stripe.prices.create({
      unit_amount: amountPence,
      currency: "gbp",
      recurring: { interval: "month" },
      product_data: {
        name: `Monthly donation to ${org["name"] as string}`,
        metadata: { orgId, platform: "rootprojx" },
      },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      application_fee_percent: PLATFORM_FEE_PERCENT,
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.confirmation_token", "latest_invoice.payment_intent"],
      metadata: {
        userId: uid,
        orgId,
        orgName: (org["name"] as string) ?? "",
        note: note ?? "",
        type: "recurring",
      },
    });

    const latestInvoice = subscription.latest_invoice as import("stripe").Stripe.Invoice & {
      payment_intent?: import("stripe").Stripe.PaymentIntent;
    };
    const paymentIntent = latestInvoice?.payment_intent;
    const clientSecret = typeof paymentIntent === "object" ? paymentIntent?.client_secret : null;

    res.json({
      subscriptionId: subscription.id,
      clientSecret,
      amountGbp,
      feePence,
    });
  } catch (err) {
    req.log.error({ err }, "POST /donations/subscription error");
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

// ── POST /donations/checkout — Stripe Connect Checkout Session ────────────────
// Supports both authenticated users and guests (with guestEmail in body).
router.post("/donations/checkout", optionalAuth, async (req, res) => {
  try {
    const { orgId, amountPence, guestEmail, feeCovered, originalAmountPence, feeAmountPence, wallOptIn, campaignId } = req.body as {
      orgId: string;
      amountPence: number;
      guestEmail?: string;
      feeCovered?: boolean;
      originalAmountPence?: number;
      feeAmountPence?: number;
      wallOptIn?: boolean;
      campaignId?: string;
    };

    const basePence = originalAmountPence ?? amountPence;
    if (!orgId || !Number.isSafeInteger(amountPence) || !Number.isSafeInteger(basePence) ||
        (feeCovered && originalAmountPence === undefined)) {
      res.status(400).json({ error: "orgId and valid donation amounts in pence are required" });
      return;
    }
    if (basePence < MIN_DONATION_PENCE || amountPence < MIN_DONATION_PENCE) {
      res.status(400).json({ error: "Minimum donation is £3." });
      return;
    }

    // Either an authenticated user or a valid guest email is required
    const uid = req.user?.userId;
    if (!uid && !guestEmail) {
      res.status(400).json({ error: "Sign in or provide an email to donate" });
      return;
    }

    const serverToken = await getServerToken();
    const org = await fsGet("organisations", orgId, serverToken);
    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    if (campaignId !== undefined && (
      typeof campaignId !== "string" || !campaignId ||
      !Array.isArray(org.campaigns) ||
      !org.campaigns.some((campaign: Record<string, unknown>) => campaign?._id === campaignId)
    )) {
      res.status(400).json({ error: "Campaign not found for this organisation" });
      return;
    }

    const stripeAccountId = org["stripe_account_id"] as string | undefined;
    if (!stripeAccountId) {
      res.status(400).json({
        error: "This organisation has not connected their bank account yet",
      });
      return;
    }

    // Determine donor email: authenticated user's email takes priority
    let donorEmail: string | undefined = guestEmail;
    if (uid) {
      const userDoc = await fsGet("users", uid, serverToken);
      donorEmail = (userDoc?.["email"] as string | undefined) ?? guestEmail;
    }

    // Platform fee is calculated on the original donation amount, not the grossed-up total
    const feePence = platformFeePence(basePence);
    const stripe = await getUncachableStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: amountPence,
            product_data: {
              name: `Donation to ${org["name"] as string}`,
              description: feeCovered
                ? "You cover card processing fees so more of your donation reaches the organisation. A 5% platform fee still applies."
                : "Your donation supports the organisation after the 5% platform fee and card processing fees.",
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: feePence,
        transfer_data: { destination: stripeAccountId },
        metadata: {
          userId: uid ?? "guest",
          orgId,
          orgName: (org["name"] as string) ?? "",
          amountPence: String(amountPence),
          feePence: String(feePence),
          feeCovered: feeCovered ? "true" : "false",
          originalAmountPence: String(originalAmountPence ?? amountPence),
          feeAmountPence: String(feeAmountPence ?? 0),
          platform: "rootprojx",
          wallOptIn: (wallOptIn && uid) ? "true" : "false",
          ...(campaignId ? { campaignId } : {}),
        },
      },
      customer_email: donorEmail,
      success_url: `${DOMAIN}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/donate/${orgId}${campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : ""}`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "POST /donations/checkout error");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ── GET /donations/confirm — read-only receipt; webhook owns all writes ────────
router.get("/donations/confirm", async (req, res) => {
  try {
    const { session_id } = req.query as { session_id?: string };
    if (!session_id) {
      res.status(400).json({ error: "session_id is required" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    if (session.payment_status !== "paid") {
      res.status(402).json({ error: "Payment not yet complete" });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    const paymentIntent = session.payment_intent;
    if (!paymentIntent || typeof paymentIntent === "string") {
      res.status(502).json({ error: "Could not retrieve payment details" });
      return;
    }
    const meta = paymentIntent.metadata ?? {};
    const orgId = meta["orgId"] ?? "";
    const orgName = meta["orgName"] ?? "";
    const amountPence = parseInt(meta["amountPence"] ?? String(session.amount_total ?? paymentIntent.amount), 10);
    const feePence = parseInt(meta["feePence"] ?? String(paymentIntent.application_fee_amount ?? 0), 10);

    // The verified webhook is the sole writer. Match its PaymentIntent key,
    // never the Checkout session ID, and return receipt data even while pending.
    const serverToken = await getServerToken();
    const existing = await fsQuery(
      "donations",
      [{ field: "stripeRef", op: "EQUAL", value: paymentIntent.id }],
      serverToken,
      { limit: 1 },
    );

    res.json({
      orgId,
      orgName,
      amountGbp: amountPence / 100,
      feePence,
      donorEmail: session.customer_details?.email ?? session.customer_email,
      recorded: existing.length > 0,
    });
  } catch (err) {
    req.log.error({ err }, "GET /donations/confirm error");
    res.status(500).json({ error: "Failed to confirm donation" });
  }
});

// ── POST /donations/portal — create Stripe billing portal session ──────────────
router.post("/donations/portal", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const email = req.user!.email ?? "";
    const token = req.headers.authorization!.slice(7);
    const customerId = await ensureStripeCustomer(uid, email, token);
    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${DOMAIN}/account`,
    });
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "POST /donations/portal error");
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

// GET /donations/recurring — only the authenticated supporter's subscriptions
router.get("/donations/recurring", requireAuth, async (req, res) => {
  try {
    const token = await getServerToken();
    const records = await fsQuery("recurring", [
      { field: "userId", op: "EQUAL", value: req.user!.userId },
    ], token);
    records.sort((a, b) => String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")));
    res.setHeader("Cache-Control", "no-store");
    res.json(records.map((record) => ({
      _id: record._id,
      userId: record.userId,
      orgId: record.orgId,
      orgName: record.orgName,
      stripeSubscriptionId: record.stripeSubscriptionId,
      amountGbp: record.amountGbp,
      status: record.status,
      startedAt: record.startedAt,
      lastPaidAt: record.lastPaidAt,
      canceledAt: record.canceledAt ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "GET /donations/recurring error");
    res.status(500).json({ error: "Failed to fetch recurring donations" });
  }
});

// ── GET /donations/my — authenticated user's donation history ──────────────────
router.get("/donations/my", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const token = req.headers.authorization!.slice(7);
    const donations = await fsQuery(
      "donations",
      [{ field: "userId", op: "EQUAL", value: uid }],
      token,
    );
    donations.sort(
      (a, b) =>
        ((b["createdAt"] as string) ?? "").localeCompare((a["createdAt"] as string) ?? ""),
    );
    res.json(donations);
  } catch (err) {
    req.log.error({ err }, "GET /donations/my error");
    res.status(500).json({ error: "Failed to fetch donation history" });
  }
});

export default router;
