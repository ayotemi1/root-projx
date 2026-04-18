import { Router } from "express";
import { fsCreate, fsGet, fsPatch, fsQuery, getServerToken } from "../lib/firebase-rest.js";
import { requireAuth } from "../lib/auth.js";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient.js";

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
