import { Router } from "express";
import { fsGet, fsPatch, fsQuery, fsMutateCampaigns, fsMutateSupporterShowcase, fsPublishSupporterPost, getServerToken } from "../lib/firebase-rest.js";
import { checkoutCurrency } from "../lib/donation-currency.js";
import { requireAuth, optionalAuth } from "../lib/auth.js";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient.js";
import { MIN_DONATION_PENCE, PLATFORM_FEE_PERCENT, platformFeePence, donationAccounting } from "../lib/fees.js";
import { resolvePayoutMethod } from "../lib/payout-setup.js";
import { publicSiteOrigin } from "../lib/site-origin.js";
import { checkoutWallMetadata, DonorWallInputError } from "../lib/donor-wall.js";
import { estimateStripeFeePence } from "../lib/donation-accounting.js";
import { createHash } from "node:crypto";
import { POSTS } from "../lib/supporter-posts.js";

const DOMAIN = publicSiteOrigin(process.env);

const router = Router();
async function campaignCheckoutCurrency(orgId: string, org: Record<string, unknown>, campaignId: string | undefined, requested: unknown, token: string) {
  const currency = checkoutCurrency(org, campaignId, requested);
  if (campaignId) {
    await fsMutateCampaigns(orgId, token, latest => {
      const confirmedCurrency = checkoutCurrency(latest, campaignId, requested);
      if (confirmedCurrency !== currency) throw new Error("Campaign currency changed. Refresh before donating.");
      const campaigns = (latest.campaigns as Record<string, unknown>[]).map(c => c._id === campaignId
        ? { ...c, currency, currencyLockedAt: c.currencyLockedAt ?? new Date().toISOString() } : c);
      return { campaigns, result: undefined };
    });
  }
  return currency;
}
function anonymousIdentityMetadata(body: Record<string, unknown>): Record<string, string> {
  return typeof body.anonymousDonorId === "string" && /^[a-f0-9-]{36}$/i.test(body.anonymousDonorId)
    ? { anonymousDonorId: body.anonymousDonorId } : {};
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
      res.status(400).json({ error: req.body.currency === "usd" ? "Minimum donation is US$3." : "Minimum donation is £3." });
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

    const payoutMethod = resolvePayoutMethod(org);
    if (payoutMethod === "none") {
      res.status(400).json({ error: "This organisation isn't set up to receive donations yet." });
      return;
    }
    let currency: "gbp" | "usd";
    try { currency = await campaignCheckoutCurrency(orgId, org, campaignId, req.body.currency, serverToken); }
    catch (err) { res.status(400).json({ error: (err as Error).message }); return; }

    const stripe = await getUncachableStripeClient();
    // Platform fee calculated on original donation amount (not the grossed-up amount)
    const feePence = platformFeePence(basePence!);
    const metadata = {
      userId: "anonymous", payoutMethod,
      ...anonymousIdentityMetadata(req.body),
      ...checkoutWallMetadata(req.body),
      orgId, orgName: (org["name"] as string) ?? "",
      amountPence: String(amountPence), feePence: String(feePence),
      currency, intendedAmount: String(basePence! / 100),
      ...(currency === "gbp" ? { intendedGbp: String(basePence! / 100) } : {}),
      feeCovered: feeCovered ? "true" : "false",
      originalAmountPence: String(basePence),
      feeAmountPence: String(feeAmountPence ?? 0),
      type: "anonymous_one_time", ...(campaignId ? { campaignId } : {}),
      platform: "rootprojx",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      metadata,
      line_items: [
        {
          price_data: {
            currency,
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
        ...(payoutMethod === "stripe_connect" ? {
          application_fee_amount: feePence,
          transfer_data: { destination: org["stripe_account_id"] as string },
        } : {}),
        metadata,
      },
      success_url: `${DOMAIN}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    if (err instanceof DonorWallInputError) {
      res.status(400).json({ error: err.message }); return;
    }
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

// ── POST /donations/checkout — Checkout routed by payout method ───────────────
// Supports both authenticated users and guests (with guestEmail in body).
router.post("/donations/checkout", optionalAuth, async (req, res) => {
  try {
    const { orgId, amountPence, guestEmail, feeCovered, originalAmountPence, feeAmountPence, campaignId } = req.body as {
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
      res.status(400).json({ error: req.body.currency === "usd" ? "Minimum donation is US$3." : "Minimum donation is £3." });
      return;
    }

    // Checkout collects a guest's email. Never require it before the hosted page.
    const uid = req.user?.userId;

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

    const payoutMethod = resolvePayoutMethod(org);
    if (payoutMethod === "none") {
      res.status(400).json({ error: "This organisation isn't set up to receive donations yet." });
      return;
    }
    let currency: "gbp" | "usd";
    try { currency = await campaignCheckoutCurrency(orgId, org, campaignId, req.body.currency, serverToken); }
    catch (err) { res.status(400).json({ error: (err as Error).message }); return; }
    const calculatedCardFee = feeCovered ? estimateStripeFeePence(basePence, null, currency) : 0;
    if (amountPence !== basePence + calculatedCardFee ||
        (feeAmountPence !== undefined && feeAmountPence !== calculatedCardFee)) {
      res.status(400).json({ error: "Donation amount changed. Please try again." });
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
    const selectedCampaign = campaignId
      ? (org.campaigns as Record<string, unknown>[]).find(c => c._id === campaignId)
      : undefined;
    const campaignName = typeof selectedCampaign?.name === "string" ? selectedCampaign.name : undefined;
    const publicCampaignId = typeof selectedCampaign?.publicId === "string" ? selectedCampaign.publicId : campaignId;
    const campaignPath = publicCampaignId ? `/campaigns/${encodeURIComponent(publicCampaignId)}` : null;
    const stripe = await getUncachableStripeClient();
    const metadata = {
      userId: uid ?? "guest", payoutMethod,
      ...anonymousIdentityMetadata(req.body),
      ...(donorEmail ? { guestEmail: donorEmail } : {}),
      orgId, orgName: (org["name"] as string) ?? "",
      amountPence: String(amountPence), feePence: String(feePence),
      currency, intendedAmount: String(basePence / 100),
      ...(currency === "gbp" ? { intendedGbp: String(basePence / 100) } : {}),
      feeCovered: feeCovered ? "true" : "false",
      originalAmountPence: String(basePence),
      feeAmountPence: String(calculatedCardFee),
      platform: "rootprojx",
      ...checkoutWallMetadata(req.body, !!uid),
      ...(campaignId ? { campaignId } : {}),
      ...(publicCampaignId ? { campaignPublicId: publicCampaignId } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      metadata,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: basePence,
            product_data: {
              name: campaignName ?? `Donation to ${org["name"] as string}`,
              description: feeCovered
                ? "You cover card processing fees so more of your donation reaches the organisation. A 5% platform fee still applies."
                : "Your donation supports the organisation after the 5% platform fee and card processing fees.",
            },
          },
          quantity: 1,
        },
        ...(calculatedCardFee > 0 ? [{
          price_data: { currency, unit_amount: calculatedCardFee, product_data: { name: "Card fee (you chose to cover it)" } },
          quantity: 1,
        }] : []),
      ],
      custom_fields: [{
        key: "wall_name",
        label: { type: "custom", custom: "Show your name on the wall?" },
        type: "dropdown",
        dropdown: { options: [
          { label: "Yes, show my first name and last initial", value: "yes" },
          { label: "No, give anonymously", value: "no" },
        ], default_value: "no" },
      }],
      name_collection: { individual: { enabled: true } },
      payment_intent_data: {
        ...(payoutMethod === "stripe_connect" ? {
          application_fee_amount: feePence,
          transfer_data: { destination: org["stripe_account_id"] as string },
        } : {}),
        metadata,
      },
      ...(donorEmail ? { customer_email: donorEmail } : {}),
      success_url: `${DOMAIN}${campaignPath ? `${campaignPath}/thank-you` : "/donate/success"}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}${campaignPath ?? `/organisations/${encodeURIComponent(orgId)}`}${campaignPath ? `?amount=${encodeURIComponent(String(basePence / 100))}&cover=${feeCovered ? "1" : "0"}` : ""}`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    if (err instanceof DonorWallInputError) {
      res.status(400).json({ error: err.message }); return;
    }
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

    const currency = session.currency === "usd" ? "usd" : "gbp";
    const receiptAccounting = donationAccounting({
      chargedPence: paymentIntent.amount,
      intendedPence: Number(meta.originalAmountPence ?? amountPence),
      feeCovered: meta.feeCovered === "true",
      currency,
    });
    const saved = existing[0];
    const accounting = { ...receiptAccounting };
    if (saved && typeof saved.toOrgGbp === "number") {
      for (const key of ["chargedGbp", "intendedGbp", "platformFeeGbp", "feeCovered", "feeCoverGbp", "toOrgGbp",
        "grossAmountGbp", "netAmountGbp", "amountGbp"] as const) {
        if (saved[key] !== undefined) (accounting as Record<string, unknown>)[key] = saved[key];
      }
    }
    const campaignId = meta.campaignId ?? null;
    const org = campaignId ? await fsGet("organisations", orgId, serverToken) : null;
    const campaign = (Array.isArray(org?.campaigns) ? org.campaigns as Record<string, unknown>[] : []).find(c => c._id === campaignId);
    const theme = campaign?.theme as { unit?: { singular?: string; plural?: string; imageUrl?: string } } | undefined;
    const campaignPath = campaign && campaign.enabled !== false && campaign.status !== "deleted"
      ? (typeof campaign.sharePath === "string" ? campaign.sharePath : typeof campaign.publicId === "string" ? `/campaigns/${encodeURIComponent(campaign.publicId)}` : null) : null;
    let wallNumber: number | null = null;
    if (saved && campaignId) {
      const gifts = await fsQuery("donations", [
        { field: "orgId", op: "EQUAL", value: orgId },
        { field: "campaignId", op: "EQUAL", value: campaignId },
      ], serverToken);
      const people = new Map<string, number>();
      for (const gift of gifts.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))) {
        if (gift.status !== "succeeded" || typeof gift.donorIdentityKey !== "string" ||
            gift.donorIdentityKey.startsWith("unidentified:")) continue;
        if (!people.has(gift.donorIdentityKey)) people.set(gift.donorIdentityKey, people.size + 1);
        if (gift.stripeRef === paymentIntent.id) wallNumber = people.get(gift.donorIdentityKey) ?? null;
      }
    }
    res.json({
      orgId,
      orgName,
      ...accounting,
      ...(currency === "usd" && !saved ? Object.fromEntries(Object.keys(accounting)
        .filter(key => key !== "feeCovered").map(key => [key, null])) : {}),
      currency,
      receiptAccounting: saved?.receiptAccounting ?? receiptAccounting,
      feePence: Math.round(receiptAccounting.platformFeeGbp * 100),
      donorEmail: session.customer_details?.email ?? session.customer_email,
      recorded: existing.length > 0,
      donationId: saved?._id ?? null,
      wallNumber,
      campaignId, campaignPath, campaignName: typeof campaign?.name === "string" ? campaign.name : null,
      unit: theme?.unit ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "GET /donations/confirm error");
    res.status(500).json({ error: "Failed to confirm donation" });
  }
});

// A return URL is not proof of payment. This read-only status is used for the
// pending/failed screens; /confirm and the signed webhook own the receipt.
router.get("/donations/checkout-status", async (req, res) => {
  try {
    const id = req.query.session_id;
    if (typeof id !== "string" || !/^cs_(test_|live_)[a-zA-Z0-9]+$/.test(id)) {
      res.status(400).json({ error: "Invalid checkout session" }); return;
    }
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
    const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
    const failed = session.status === "expired" || intent?.status === "canceled" ||
      intent?.status === "requires_payment_method";
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: session.payment_status === "paid" ? "paid" : failed ? "failed" : "pending",
      campaignId: session.metadata?.campaignId ?? null,
      amount: Number(session.metadata?.originalAmountPence ?? session.amount_total ?? 1000) / 100,
      feeCovered: session.metadata?.feeCovered === "true",
    });
  } catch (err) {
    req.log.warn({ err }, "Checkout status unavailable");
    res.status(503).json({ error: "Checkout status unavailable" });
  }
});

function sharingId(prefix: string, donationId: string) {
  const s = createHash("sha256").update(`${prefix}:${donationId}`).digest("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-8${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

// Sharing changes an existing, paid gift's presentation only. No donation or
// financial totals are ever written from this endpoint.
router.post("/donations/:id/sharing", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const choice = req.body?.choice;
  const text = req.body?.text;
  const showAmount = req.body?.showAmount === true;
  if (!/^pi_[A-Za-z0-9]+$/.test(id) || !["post", "involvement", "private"].includes(choice) ||
      (choice === "post" && (typeof text !== "string" || !text.trim() || text.length > 280))) {
    res.status(400).json({ error: "Something went wrong, please try again" }); return;
  }
  try {
    const uid = req.user!.userId;
    if (req.user?.accountType !== "supporter") { res.sendStatus(403); return; }
    const token = await getServerToken();
    const gift = await fsGet("donations", id, token);
    if (!gift || gift.userId !== uid || gift.status !== "succeeded" || !gift.campaignId) {
      res.sendStatus(404); return;
    }
    const org = await fsGet("organisations", String(gift.orgId), token);
    const campaign = (Array.isArray(org?.campaigns) ? org.campaigns : [])
      .find((c: Record<string, unknown>) => c._id === gift.campaignId);
    if (!org || !campaign) { res.sendStatus(404); return; }
    const postId = sharingId("post", id);
    const involvementId = sharingId("involvement", id);
    const oldPost = await fsGet(POSTS, postId, token);
    if (oldPost && oldPost.author_id !== uid) { res.sendStatus(409); return; }
    if (choice === "post") {
      const raw = text.trim();
      const native = gift.receiptAccounting as { intendedGbp?: number } | undefined;
      const giftAmount = Number(native?.intendedGbp ?? gift.intendedGbp);
      const money = gift.currency === "usd" ? "US$" : "£";
      const caption = showAmount && Number.isFinite(giftAmount)
        ? `${raw}\n${money}${giftAmount.toFixed(2)} given to ${campaign.name}` : raw;
      if (oldPost) {
        await fsPatch(POSTS, postId, { caption, removed: false, edited_at: new Date().toISOString(), donation_post: true }, token);
      } else {
        try {
          await fsPublishSupporterPost({
            id: postId, author_id: uid, type: "text", caption, community_tag: null,
            tag: null, organisation_id: gift.orgId, campaign_id: gift.campaignId,
            activity_type: "Gave", donation_post: true, created_at: new Date().toISOString(),
            edited_at: null, removed: false, media_ids: [], fingerprint: sharingId("fingerprint", id),
          }, [], token);
        } catch (e) {
          const committed = await fsGet(POSTS, postId, token);
          if (!committed || committed.author_id !== uid) throw e;
        }
      }
    } else if (oldPost && !oldPost.removed) {
      await fsPatch(POSTS, postId, { removed: true }, token);
    }
    await fsMutateSupporterShowcase(uid, token, user => {
      if (user.accountType !== "supporter") throw new Error("Not a supporter");
      const showcase = (user.profileShowcase ?? {}) as Record<string, unknown>;
      const entries = Array.isArray(showcase.entries) ? showcase.entries as Record<string, unknown>[] : [];
      const without = entries.filter(entry => entry.id !== involvementId);
      return {
        ...showcase, entries: choice === "involvement"
          ? [...without, {
            id: involvementId, organisationId: gift.orgId, projectName: String(org.name),
            activity: "Gave", details: `Supporter · ${campaign.name}`,
            when: String(gift.createdAt).slice(0, 10), shared: true, createdAt: new Date().toISOString(),
          }] : without,
      };
    });
    await fsPatch("donations", id, { sharingChoice: choice, sharingPostId: choice === "post" ? postId : null }, token);
    res.json({ choice, postId: choice === "post" ? postId : null });
  } catch (err) {
    req.log.error({ err }, "Donation sharing failed");
    res.status(503).json({ error: "Something went wrong, please try again" });
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
