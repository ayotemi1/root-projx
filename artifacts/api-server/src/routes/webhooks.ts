import { Router } from "express";
import { fsCreate, fsGet, fsIncrement, fsPatch, fsQuery, getServerToken } from "../lib/firebase-rest.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { brevoSendEmail, donationConfirmationHtml, shopOrderConfirmationHtml } from "../lib/brevo.js";
import type Stripe from "stripe";

const router = Router();

// POST /webhooks/stripe — Stripe payment confirmation webhook
// IMPORTANT: must be mounted BEFORE express.json() — uses raw body
router.post(
  "/stripe",
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

      // SECURITY: signature verification is mandatory. Without it, anyone who can
      // reach this endpoint can fabricate payment_intent.succeeded events and
      // create fake donation records / inflate totalRaised. The ONLY exception is
      // local development with an explicit double opt-in that can never be
      // satisfied in a production deployment.
      const allowUnverified =
        process.env.NODE_ENV !== "production" &&
        process.env.REPLIT_DEPLOYMENT !== "1" &&
        process.env.ALLOW_UNVERIFIED_STRIPE_WEBHOOKS === "true";

      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          Array.isArray(sig) ? sig[0]! : sig,
          webhookSecret,
        );
      } else if (allowUnverified) {
        req.log.warn(
          {},
          "STRIPE WEBHOOK RUNNING UNVERIFIED (dev-only opt-in). Never enable ALLOW_UNVERIFIED_STRIPE_WEBHOOKS outside local development.",
        );
        event = JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
      } else {
        req.log.error(
          {},
          "STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook. Set it in Replit Secrets (from the Stripe dashboard webhook endpoint settings).",
        );
        res.status(500).json({ error: "Webhook not configured" });
        return;
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
    amountGbp = (invoice.amount_paid - ((invoice as Stripe.Invoice & { application_fee_amount?: number }).application_fee_amount ?? 0)) / 100;
    currency = invoice.currency ?? "gbp";
    stripeRef = invoice.id;
  }

  const { userId, orgId, orgName, note, type, guestEmail, feeCovered, originalAmountPence, feeAmountPence, wallOptIn, campaignId } = metadata;

  // ── Idempotency guard ─────────────────────────────────────────────────────────
  // Stripe retries webhook deliveries (network blips, non-2xx responses, manual
  // resends). Without this check, every retry creates a duplicate donation doc
  // AND increments the org's totalRaised again — silently corrupting the
  // transparency numbers this platform exists to protect.
  if (stripeRef) {
    const dedupCollection = type === "shop_order" ? "orders" : "donations";
    const existing = await fsQuery(
      dedupCollection,
      [{ field: "stripeRef", op: "EQUAL", value: stripeRef }],
      serverToken,
      { limit: 1 },
    );
    if (existing.length > 0) {
      log.info({ stripeRef, type: type ?? "one_time" }, "Webhook: event already processed — skipping (idempotent)");
      return;
    }
  }

  // ── Shop order — record in `orders` collection and return early ──────────────
  if (type === "shop_order") {
    await handleShopOrder({ metadata, amountGbp, currency, stripeRef, log });
    return;
  }

  // Must have at least orgId to process; userId OR guestEmail identifies the donor
  if (!orgId) {
    log.info({ metadata }, "Webhook: missing orgId in metadata — skipping");
    return;
  }
  const isGuest = !userId && !!guestEmail;

  // 1. Create donation document in Firestore
  const donationDate = new Date().toISOString();
  const isFeeCovered = feeCovered === "true";
  const origAmountGbp = originalAmountPence ? Number(originalAmountPence) / 100 : amountGbp;
  const netAmountGbp = origAmountGbp;
  const feeAmountGbp = feeAmountPence ? Number(feeAmountPence) / 100 : 0;

  const donationId = await fsCreate(
    "donations",
    {
      ...(userId ? { userId } : {}),
      ...(isGuest ? { guestEmail } : {}),
      orgId,
      orgName: orgName ?? "",
      ...(campaignId ? { campaignId } : {}),
      // Fee transparency fields
      grossAmountGbp: amountGbp,           // total charged to donor's card
      netAmountGbp,                       // original intended donation (what org counts toward)
      feeCovered: isFeeCovered,
      feeAmountGbp: isFeeCovered ? feeAmountGbp : 0,
      // Legacy field kept for backwards compatibility
      amountGbp,
      currency,
      type: type ?? "one_time",
      note: note ?? "",
      stripeRef,
      status: "succeeded",
      createdAt: donationDate,
    },
    serverToken,
  );
  log.info({ donationId, userId: userId ?? "guest", orgId, amountGbp }, "Donation recorded in Firestore");

  // 1b. Send donation confirmation email via Brevo (fire-and-forget)
  try {
    let recipientEmail: string | undefined;
    let recipientName = "Supporter";

    if (isGuest) {
      recipientEmail = guestEmail;
    } else if (userId) {
      const userDoc = await fsGet("users", userId, serverToken);
      recipientEmail = userDoc?.["email"] as string | undefined;
      recipientName = (userDoc?.["name"] as string | undefined) ?? "Supporter";
    }

    if (recipientEmail) {
      await brevoSendEmail({
        to: [{ email: recipientEmail, name: recipientName }],
        subject: `Your donation to ${orgName ?? "Root ProjX"} — confirmed ✓`,
        htmlContent: donationConfirmationHtml({
          name: recipientName,
          orgName: orgName ?? "the organisation",
          amountGbp,
          type: type ?? "one_time",
          donationDate: new Date(donationDate).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        }),
      });
      log.info({ recipient: recipientEmail, isGuest }, "Donation confirmation email sent via Brevo");
    }
  } catch (emailErr) {
    log.error({ emailErr }, "Brevo donation email failed (non-fatal)");
  }

  // 2. Auto-follow the org — only for authenticated users (guests have no account)
  if (userId) {
    const followId = `${userId}_${orgId}`;
    const existingFollow = await fsGet("follows", followId, serverToken);
    if (!existingFollow) {
      await fsPatch(
        "follows",
        followId,
        { userId, orgId, createdAt: new Date().toISOString(), autoFollowed: true },
        serverToken,
      );
      // Atomic increment — safe under concurrent webhooks, and never overwrites
      // other fields on the org document.
      try {
        await fsIncrement("organisations", orgId, { followerCount: 1 }, serverToken);
      } catch (incErr) {
        log.error({ incErr, orgId }, "followerCount increment failed (non-fatal)");
      }
      log.info({ userId, orgId }, "Auto-followed org after donation");
    }
  }

  // 3. Update org totalRaised (applies for both authenticated and guest donations)
  // Atomic server-side increment: two donations landing at the same moment both
  // count, and a concurrent profile edit is never clobbered by a stale full-doc write.
  try {
    await fsIncrement("organisations", orgId, { totalRaised: amountGbp }, serverToken);
    log.info({ orgId, amountGbp }, "Incremented org totalRaised");
  } catch (incErr) {
    log.error({ incErr, orgId, amountGbp }, "totalRaised increment failed — investigate: donation recorded but org total not updated");
  }

  if (campaignId) {
    try {
      const orgDoc = await fsGet("organisations", orgId, serverToken);
      const campaigns = orgDoc?.campaigns;
      if (!Array.isArray(campaigns)) throw new Error("Organisation has no campaigns array");
      const index = campaigns.findIndex((campaign: Record<string, unknown>) => campaign?._id === campaignId);
      if (index < 0) throw new Error("Campaign not found on organisation");
      const current = campaigns[index] as Record<string, unknown>;
      const previousAmount = typeof current.amountRaised === "number" ? current.amountRaised : 0;
      if (!Number.isFinite(previousAmount) || !Number.isFinite(netAmountGbp)) {
        throw new Error("Invalid campaign donation amount");
      }
      const updatedCampaigns = [...campaigns];
      updatedCampaigns[index] = {
        ...current,
        amountRaised: Math.round((previousAmount + netAmountGbp) * 100) / 100,
      };
      await fsPatch("organisations", orgId, { campaigns: updatedCampaigns }, serverToken);
      log.info({ orgId, campaignId, netAmountGbp }, "Updated campaign amountRaised");
    } catch (campaignErr) {
      log.error({ campaignErr, orgId, campaignId }, "Campaign amountRaised update failed (non-fatal)");
    }
  }

  // 4. Supporter wall opt-in — durable path; idempotent write, only on first event.
  // The browser /donations/confirm redirect is an unreliable fallback (user may
  // close the tab before it loads). Processing here guarantees the opt-in is
  // recorded for every verified payment. We skip writing if an entry already exists
  // to preserve any later explicit opt-out the user made via their account page.
  if (wallOptIn === "true" && userId && userId !== "guest" && orgId) {
    try {
      const orgDoc = await fsGet("organisations", orgId, serverToken);
      if (orgDoc) {
        const existingWall = ((orgDoc["supporterWall"] ?? []) as Array<Record<string, unknown>>);
        const alreadyHasEntry = existingWall.some((e) => e["userId"] === userId);
        if (!alreadyHasEntry) {
          const userDoc = await fsGet("users", userId, serverToken);
          const rawName = (userDoc?.["name"] as string | undefined) ?? "Supporter";
          const nameParts = rawName.trim().split(/\s+/).filter(Boolean);
          const displayName = nameParts.length <= 1
            ? (nameParts[0] ?? "Supporter")
            : `${nameParts[0]} ${(nameParts[nameParts.length - 1]![0] ?? "").toUpperCase()}.`;
          // Append + enforce 500-entry document-size cap
          let orgWall: Array<Record<string, unknown>> = [
            ...existingWall,
            { userId, displayName, optedIn: true },
          ];
          if (orgWall.length > 500) orgWall = orgWall.slice(-500);
          await fsPatch("organisations", orgId, { ...orgDoc, supporterWall: orgWall }, serverToken);
          // Mirror on user doc — one entry per org, naturally bounded
          const userWall = ((userDoc?.["supportedOrgs"] ?? []) as Array<Record<string, unknown>>)
            .filter((e) => e["orgId"] !== orgId);
          userWall.push({ orgId, orgName: orgName ?? orgId, displayName, optedIn: true });
          await fsPatch("users", userId, { ...(userDoc ?? {}), supportedOrgs: userWall }, serverToken);
          log.info({ userId, orgId }, "Supporter wall entry created via webhook");
        }
      }
    } catch (wallErr) {
      log.error({ wallErr }, "Supporter wall write failed (non-fatal)");
    }
  }
}

// ── Shop order handler ────────────────────────────────────────────────────────
// Called when a payment_intent.succeeded event has metadata.type === "shop_order".
// Records the order in the `orders` Firestore collection.
async function handleShopOrder({
  metadata,
  amountGbp,
  currency,
  stripeRef,
  log,
}: {
  metadata: Record<string, string>;
  amountGbp: number;
  currency: string;
  stripeRef: string;
  log: { info: (obj: unknown, msg: string) => void; error: (obj: unknown, msg: string) => void };
}): Promise<void> {
  const serverToken = await getServerToken();
  const { userId, itemsJson, itemCount } = metadata;

  let items: unknown = [];
  try {
    items = itemsJson ? JSON.parse(itemsJson) : [];
  } catch {
    log.error({ itemsJson }, "Shop order: failed to parse itemsJson");
  }

  const orderDate = new Date().toISOString();
  const orderId = await fsCreate(
    "orders",
    {
      ...(userId ? { userId } : {}),
      amountGbp,
      currency,
      stripeRef,
      itemCount: itemCount ? Number(itemCount) : 0,
      items,
      status: "paid",
      createdAt: orderDate,
    },
    serverToken,
  );

  log.info({ orderId, userId: userId ?? "guest", amountGbp }, "Shop order recorded in Firestore");

  // Send order confirmation email to authenticated buyers
  if (userId) {
    try {
      const userDoc = await fsGet("users", userId, serverToken);
      const recipientEmail = userDoc?.["email"] as string | undefined;
      const recipientName = (userDoc?.["name"] as string | undefined) ?? "Supporter";

      if (recipientEmail) {
        // Decode compact itemsJson for display: [{ p, q, s }] → [{ name, qty, size }]
        const PRODUCT_NAMES: Record<string, string> = {
          tshirt: "Root ProjX T-Shirt",
          hoodie: "Root ProjX Hoodie",
          tote: "Root ProjX Tote",
          cap: "Root ProjX Cap",
        };
        const compactItems = Array.isArray(items)
          ? (items as Array<{ p?: string; q?: number; s?: string }>)
          : [];
        const emailItems = compactItems.map((i) => ({
          name: PRODUCT_NAMES[i.p ?? ""] ?? "Root ProjX Merchandise",
          qty: i.q ?? 1,
          size: i.s ?? "One Size",
        }));

        await brevoSendEmail({
          to: [{ email: recipientEmail, name: recipientName }],
          subject: "Your Root ProjX order is confirmed",
          htmlContent: shopOrderConfirmationHtml({
            name: recipientName,
            items: emailItems,
            totalGbp: amountGbp,
            orderDate: new Date(orderDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          }),
        });
        log.info({ recipient: recipientEmail, orderId }, "Shop order confirmation email sent");
      }
    } catch (emailErr) {
      log.error({ emailErr }, "Shop order confirmation email failed (non-fatal)");
    }
  }
}

export default router;
