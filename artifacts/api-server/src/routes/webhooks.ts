import { Router } from "express";
import { fsCreate, fsGet, fsPatch, fsQuery, getServerToken } from "../lib/firebase-rest.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import type Stripe from "stripe";

const router = Router();

// POST /webhooks/stripe — Stripe payment confirmation webhook
// IMPORTANT: must be mounted BEFORE express.json() — uses raw body
router.post(
  "/webhooks/stripe",
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }

    let event: Stripe.Event;
    try {
      const stripe = await getUncachableStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          Array.isArray(sig) ? sig[0]! : sig,
          webhookSecret,
        );
      } else {
        // Dev mode — parse raw JSON without signature verification
        event = JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
      }
    } catch (err) {
      req.log.error({ err }, "Stripe webhook signature error");
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    try {
      if (
        event.type === "payment_intent.succeeded" ||
        event.type === "invoice.payment_succeeded"
      ) {
        await handlePaymentSuccess(event, req.log as { info: (obj: unknown, msg: string) => void; error: (obj: unknown, msg: string) => void });
      }
      res.json({ received: true });
    } catch (err) {
      req.log.error({ err }, "Stripe webhook processing error");
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
);

async function handlePaymentSuccess(
  event: Stripe.Event,
  log: { info: (obj: unknown, msg: string) => void; error: (obj: unknown, msg: string) => void },
) {
  const serverToken = await getServerToken();
  let metadata: Record<string, string> = {};
  let amountGbp = 0;
  let currency = "gbp";
  let stripeRef = "";

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    metadata = pi.metadata ?? {};
    amountGbp = (pi.amount - (pi.application_fee_amount ?? 0)) / 100;
    currency = pi.currency;
    stripeRef = pi.id;
  } else if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription_details?: { metadata?: Record<string, string> };
    };
    metadata = invoice.subscription_details?.metadata ?? {};
    amountGbp = (invoice.amount_paid - (invoice.application_fee_amount ?? 0)) / 100;
    currency = invoice.currency ?? "gbp";
    stripeRef = invoice.id;
  }

  const { userId, orgId, orgName, note, type } = metadata;
  if (!userId || !orgId) {
    log.info({ metadata }, "Webhook: missing userId/orgId in metadata — skipping");
    return;
  }

  // 1. Create donation document in Firestore
  const donationId = await fsCreate(
    "donations",
    {
      userId,
      orgId,
      orgName: orgName ?? "",
      amountGbp,
      currency,
      type: type ?? "one_time",
      note: note ?? "",
      stripeRef,
      status: "succeeded",
      createdAt: new Date().toISOString(),
    },
    serverToken,
  );
  log.info({ donationId, userId, orgId, amountGbp }, "Donation recorded in Firestore");

  // 2. Auto-follow the org if not already following
  const followId = `${userId}_${orgId}`;
  const existingFollow = await fsGet("follows", followId, serverToken);
  if (!existingFollow) {
    await fsPatch(
      "follows",
      followId,
      { userId, orgId, createdAt: new Date().toISOString(), autoFollowed: true },
      serverToken,
    );
    // Increment followerCount
    const org = await fsGet("organisations", orgId, serverToken);
    if (org) {
      const currentCount = (org["followerCount"] as number) ?? 0;
      await fsPatch("organisations", orgId, { ...org, followerCount: currentCount + 1 }, serverToken);
    }
    log.info({ userId, orgId }, "Auto-followed org after donation");
  }

  // 3. Update org totalRaised
  const org = await fsGet("organisations", orgId, serverToken);
  if (org) {
    const currentRaised = (org["totalRaised"] as number) ?? 0;
    await fsPatch("organisations", orgId, { ...org, totalRaised: currentRaised + amountGbp }, serverToken);
    log.info({ orgId, totalRaised: currentRaised + amountGbp }, "Updated org totalRaised");
  }
}

export default router;
