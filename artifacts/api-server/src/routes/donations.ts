import { Router } from "express";
import { fsCreate, fsGet, fsPatch, fsQuery, getServerToken } from "../lib/firebase-rest.js";
import { requireAuth, optionalAuth } from "../lib/auth.js";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient.js";

const DOMAIN = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : process.env.REPLIT_DEPLOYMENT === "1"
  ? `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN ?? ""}`
  : "http://localhost:3000";

const router = Router();

// ── Platform fee ──────────────────────────────────────────────────────────────
const FEE_PERCENT = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "3");

function platformFee(amountGbp: number): number {
  return Math.round(amountGbp * 100 * (FEE_PERCENT / 100));
}

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

    if (!orgId || !amountGbp || amountGbp <= 0) {
      res.status(400).json({ error: "orgId and a positive amountGbp are required" });
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
    const feePence = platformFee(amountGbp);

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

    if (!orgId || !amountGbp || amountGbp <= 0) {
      res.status(400).json({ error: "orgId and a positive amountGbp are required" });
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
    const feePence = platformFee(amountGbp);

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

    if (!orgId || !amountGbp || amountGbp <= 0) {
      res.status(400).json({ error: "orgId and a positive amountGbp are required" });
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
    const feePence = platformFee(amountGbp);

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
      application_fee_percent: FEE_PERCENT,
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
    const { orgId, amountPence, guestEmail } = req.body as {
      orgId: string;
      amountPence: number;
      guestEmail?: string;
    };

    if (!orgId || !amountPence || amountPence < 100) {
      res.status(400).json({ error: "orgId and amountPence (≥100) are required" });
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

    const feePence = Math.round(amountPence * 0.05);
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
              description: "Your support goes straight to the source.",
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
          platform: "rootprojx",
        },
      },
      customer_email: donorEmail,
      success_url: `${DOMAIN}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/donate/${orgId}`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "POST /donations/checkout error");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ── GET /donations/confirm — verify session + log donation idempotently ────────
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

    const meta = (session.payment_intent as import("stripe").Stripe.PaymentIntent)?.metadata ?? {};
    const orgId = meta["orgId"] ?? "";
    const orgName = meta["orgName"] ?? "";
    const amountPence = parseInt(meta["amountPence"] ?? "0", 10);
    const feePence = parseInt(meta["feePence"] ?? "0", 10);
    const userId = meta["userId"] ?? "";

    // Idempotent — only write if not already logged
    const serverToken = await getServerToken();
    const existing = await fsQuery(
      "donations",
      [{ field: "stripeSessionId", op: "EQUAL", value: session_id }],
      serverToken,
    );

    if (existing.length === 0) {
      await fsCreate(
        "donations",
        {
          stripeSessionId: session_id,
          userId,
          orgId,
          orgName,
          amountPence,
          amountGbp: amountPence / 100,
          feePence,
          donorEmail: session.customer_email ?? "",
          currency: "gbp",
          status: "paid",
          createdAt: new Date().toISOString(),
        },
        serverToken,
      );
    }

    res.json({
      orgId,
      orgName,
      amountGbp: amountPence / 100,
      feePence,
      donorEmail: session.customer_email,
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
