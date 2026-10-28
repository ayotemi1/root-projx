import { Router } from "express";
import { fsCreate, fsCreateIfAbsent, fsGet, fsIncrement, fsPatch, fsQuery, fsMutateCampaigns, getServerToken } from "../lib/firebase-rest.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { brevoSendEmail, donationConfirmationHtml, shopOrderConfirmationHtml } from "../lib/brevo.js";
import type Stripe from "stripe";
import { recurringStatus } from "../lib/recurring-status.js";
import { donationAccounting, PLATFORM_FEE_PERCENT } from "../lib/fees.js";
import { queueDonationPayout } from "../lib/payouts.js";
import { donorIdentity, firstNameLastInitial } from "../lib/campaign-supporters.js";
import { campaignMatch, migrateCampaignPartnerFunding, partnerFundingFor } from "../lib/campaign-matching.js";

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
        event.type === "checkout.session.completed" ||
        event.type === "invoice.payment_succeeded"
      ) {
        await handlePaymentSuccess(event, req.log as { info: (obj: unknown, msg: string) => void; error: (obj: unknown, msg: string) => void });
      } else if (
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        await handleSubscriptionChange(event);
      }
      res.json({ received: true });
    } catch (err) {
      req.log.error({ err }, "Stripe webhook processing error");
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
);

async function handleSubscriptionChange(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const token = await getServerToken();
  const records = await fsQuery("recurring", [
    { field: "stripeSubscriptionId", op: "EQUAL", value: subscription.id },
  ], token, { limit: 1 });
  const record = records[0];
  // Recurring records are first created by a successful invoice, not by an
  // incomplete subscription or an unrelated subscription in the Stripe account.
  if (!record) return;
  if (typeof record.statusUpdatedAt === "number" && record.statusUpdatedAt > event.created) return;

  const status = event.type === "customer.subscription.deleted"
    ? "canceled"
    : recurringStatus(subscription.status, !!subscription.pause_collection);
  await fsPatch("recurring", String(record._id), {
    status,
    statusUpdatedAt: event.created,
    canceledAt: status === "canceled"
      ? new Date((subscription.canceled_at ?? subscription.ended_at ?? event.created) * 1000).toISOString()
      : null,
  }, token);
}

async function recordRecurringPayment(
  invoice: Stripe.Invoice,
  subscriptionId: string,
  metadata: Record<string, string>,
  paidAt: string,
  token: string,
) {
  const records = await fsQuery("recurring", [
    { field: "stripeSubscriptionId", op: "EQUAL", value: subscriptionId },
  ], token, { limit: 1 });
  const existing = records[0];
  if (existing) {
    // Older/repeated invoices cannot move lastPaidAt backwards or reactivate a
    // subscription canceled/paused by a subsequent lifecycle event.
    if (typeof existing.lastPaidAt !== "string" || existing.lastPaidAt < paidAt) {
      await fsPatch("recurring", String(existing._id), { lastPaidAt: paidAt }, token);
    }
    return;
  }
  if (!metadata.userId || !metadata.orgId) return;
  // Deterministic ID prevents duplicate recurring documents on invoice retries.
  await fsPatch("recurring", subscriptionId, {
    userId: metadata.userId,
    orgId: metadata.orgId,
    orgName: metadata.orgName ?? "",
    stripeSubscriptionId: subscriptionId,
    amountGbp: invoice.amount_paid / 100,
    status: "active",
    startedAt: paidAt,
    lastPaidAt: paidAt,
  }, token);
}

async function handlePaymentSuccess(
  event: Stripe.Event,
  log: { info: (obj: unknown, msg: string) => void; error: (obj: unknown, msg: string) => void },
) {
  // Checkout is the sole writer for one-off donations. Ignore even legacy PI
  // replays with no Checkout marker; they must not recreate a donation.
  if (event.type === "payment_intent.succeeded" &&
      (event.data.object as Stripe.PaymentIntent).metadata?.type !== "shop_order") {
    log.info({ stripeRef: event.data.object.id }, "PaymentIntent succeeded — no-op; donation recording belongs to Checkout");
    return;
  }
  const serverToken = await getServerToken();
  let metadata: Record<string, string> = {};
  let amountGbp = 0;
  let currency = "gbp";
  let stripeRef = "";
  let chargedPence = 0;
  let cardCountry: string | null | undefined;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "payment" || session.payment_status !== "paid") {
      log.info({ sessionId: session.id }, "Checkout not a paid one-off payment — skipping");
      return;
    }
    // Merch keeps its existing PaymentIntent writer; subscription invoices
    // remain authoritative for recurring donations.
    if (session.metadata?.type === "shop_order" || !session.metadata?.orgId) return;
    const pi = typeof session.payment_intent === "object" ? session.payment_intent : null;
    stripeRef = typeof session.payment_intent === "string" ? session.payment_intent : pi?.id ?? "";
    if (!stripeRef || !Number.isSafeInteger(session.amount_total) || session.amount_total! <= 0) {
      throw new Error("Paid donation Checkout is missing its PaymentIntent or amount");
    }
    metadata = { ...session.metadata };
    if (!metadata.originalAmountPence && metadata.intendedGbp !== undefined) {
      const intendedPence = Math.round(Number(metadata.intendedGbp) * 100);
      if (!Number.isSafeInteger(intendedPence) || intendedPence <= 0) {
        throw new Error("Invalid intended amount in Checkout metadata");
      }
      metadata.originalAmountPence = String(intendedPence);
    }
    chargedPence = session.amount_total!;
    currency = session.currency ?? "gbp";
    // Same card-country estimate policy as before: expanded data if supplied,
    // otherwise UK. Session metadata, not PI metadata, owns attribution.
    const charge = typeof pi?.latest_charge === "object" ? pi.latest_charge : null;
    cardCountry = charge?.payment_method_details?.card?.country;
  } else if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    metadata = pi.metadata ?? {};
    amountGbp = (pi.amount - (pi.application_fee_amount ?? 0)) / 100;
    chargedPence = pi.amount;
    // Stripe often supplies only a charge ID. Do not make a live lookup merely
    // for a fee estimate; missing card country intentionally uses the UK rate.
    const legacyCharges = (pi as Stripe.PaymentIntent & { charges?: { data?: Stripe.Charge[] } }).charges;
    const charge = typeof pi.latest_charge === "object" && pi.latest_charge
      ? pi.latest_charge : legacyCharges?.data?.[0];
    cardCountry = charge?.payment_method_details?.card?.country;
    currency = pi.currency;
    stripeRef = pi.id;
  } else if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription_details?: { metadata?: Record<string, string> };
      subscription?: string | Stripe.Subscription | null;
    };
    // Basil stores subscription information under parent; older events used
    // invoice.subscription and invoice.subscription_details.
    const details = invoice.parent?.subscription_details;
    const reference = details?.subscription ?? invoice.subscription;
    const subscriptionId = typeof reference === "string" ? reference : reference?.id;
    metadata = {
      ...(typeof reference === "object" && reference ? reference.metadata : {}),
      ...invoice.subscription_details?.metadata,
      ...details?.metadata,
    };
    if (subscriptionId && (!metadata.userId || !metadata.orgId)) {
      const stripe = await getUncachableStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      metadata = { ...subscription.metadata, ...metadata };
    }
    if (subscriptionId) {
      const paidAt = new Date((invoice.status_transitions?.paid_at ?? event.created) * 1000).toISOString();
      // Do this before the donation dedup guard so an invoice retry can repair
      // recurring tracking without creating another donation.
      await recordRecurringPayment(invoice, subscriptionId, metadata, paidAt, serverToken);
      metadata.type = "recurring";
    }
    amountGbp = (invoice.amount_paid - ((invoice as Stripe.Invoice & { application_fee_amount?: number }).application_fee_amount ?? 0)) / 100;
    chargedPence = invoice.amount_paid;
    const legacyInvoice = invoice as Stripe.Invoice & {
      charge?: string | Stripe.Charge | null;
      payment_intent?: string | Stripe.PaymentIntent | null;
    };
    const invoiceIntent = typeof legacyInvoice.payment_intent === "object" ? legacyInvoice.payment_intent : null;
    const invoiceCharge = typeof legacyInvoice.charge === "object" && legacyInvoice.charge
      ? legacyInvoice.charge
      : typeof invoiceIntent?.latest_charge === "object" ? invoiceIntent.latest_charge : null;
    cardCountry = invoiceCharge?.payment_method_details?.card?.country;
    currency = invoice.currency ?? "gbp";
    stripeRef = invoice.id;
  }

  const { userId, orgId, orgName, note, type, guestEmail, feeCovered, originalAmountPence, wallOptIn, campaignId } = metadata;

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
      // Repair a ledger write that failed after the donation was recorded.
      // Atomic create-only semantics preserve sent/failed rows on every replay.
      if (dedupCollection === "donations") {
        await queueDonationPayout(String(existing[0]!._id), existing[0]!, serverToken);
      }
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
  const accounting = donationAccounting({
    chargedPence,
    intendedPence: originalAmountPence === undefined ? undefined : Number(originalAmountPence),
    feeCovered: feeCovered === "true",
    cardCountry,
  });
  const { intendedGbp, toOrgGbp } = accounting;
  let identityEmail = guestEmail;
  let publicDonorName: string | null =
    (!userId || ["guest", "anonymous"].includes(userId)) && wallOptIn === "true"
      ? firstNameLastInitial(metadata.publicDonorName) : null;
  if (userId && !["guest", "anonymous"].includes(userId)) {
    try {
      const donor = await fsGet("users", userId, serverToken);
      if (typeof donor?.email === "string") identityEmail = donor.email;
      const optedOut = Array.isArray(donor?.supportedOrgs) && donor.supportedOrgs.some((entry: Record<string, unknown>) => entry.orgId === orgId && entry.optedIn === false);
      if (wallOptIn === "true" && !optedOut) publicDonorName = firstNameLastInitial(donor?.name);
    } catch (err) {
      log.error({ err, orgId }, "Donor identity unavailable; retaining donation without a public name");
    }
  }

  const donationData = {
      ...(userId ? { userId } : {}),
      ...(isGuest ? { guestEmail } : {}),
      orgId,
      orgName: orgName ?? "",
      ...(campaignId ? { campaignId } : {}),
      ...accounting,
      donorIdentityKey: donorIdentity({ userId, email: identityEmail, anonymousDonorId: metadata.anonymousDonorId, stripeRef }),
      publicDonorName,
      ...(metadata.payoutMethod ? { payoutMethod: metadata.payoutMethod } : {}),
      feeAmountGbp: accounting.feeCoverGbp, // legacy top-up field
      currency,
      type: type ?? "one_time",
      note: note ?? "",
      stripeRef,
      status: "succeeded",
      createdAt: donationDate,
    };
  // Keep the PI ID as stripeRef for compatibility with old records and confirm.
  // Create-only also closes the query-then-create race on simultaneous retries.
  let donationId: string;
  if (event.type === "checkout.session.completed") {
    donationId = stripeRef;
    if (!await fsCreateIfAbsent("donations", donationId, donationData, serverToken)) {
      const existing = await fsGet("donations", donationId, serverToken);
      if (!existing) throw new Error("Existing Checkout donation could not be loaded");
      await queueDonationPayout(donationId, existing, serverToken);
      log.info({ stripeRef }, "Checkout donation already created — skipping");
      return;
    }
  } else {
    donationId = await fsCreate("donations", donationData, serverToken);
  }
  log.info({ donationId, userId: userId ?? "guest", orgId, intendedGbp, toOrgGbp }, "Donation recorded in Firestore");

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
          accounting,
          platformFeePercent: PLATFORM_FEE_PERCENT,
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
    await fsIncrement("organisations", orgId, {
      totalRaised: intendedGbp,
      totalOwedGbp: toOrgGbp,
    }, serverToken);
    log.info({ orgId, intendedGbp, toOrgGbp }, "Incremented org totalRaised and totalOwedGbp");
  } catch (incErr) {
    log.error({ incErr, orgId, intendedGbp, toOrgGbp }, "Donation aggregate increment failed — investigate: donation recorded but org totals not updated");
  }

  if (campaignId) {
    try {
      await fsMutateCampaigns(orgId, serverToken, orgDoc => {
      const campaigns = orgDoc.campaigns;
      if (!Array.isArray(campaigns)) throw new Error("Organisation has no campaigns array");
      const index = campaigns.findIndex((campaign: Record<string, unknown>) => campaign?._id === campaignId);
      if (index < 0) throw new Error("Campaign not found on organisation");
      const current = migrateCampaignPartnerFunding(campaigns[index] as Record<string, unknown>);
      const previousAmount = typeof current.amountRaised === "number" ? current.amountRaised : 0;
      if (!Number.isFinite(previousAmount) || !Number.isFinite(intendedGbp)) {
        throw new Error("Invalid campaign donation amount");
      }
      const updatedCampaigns = [...campaigns];
      const funding = partnerFundingFor(current);
      const matchedUsed = typeof current.partnerFundingMatchedGbp === "number" && Number.isFinite(current.partnerFundingMatchedGbp)
        ? Math.max(0, current.partnerFundingMatchedGbp) : 0;
      // Same update-time precondition as amountRaised: concurrent successful
      // payments re-read the remaining cap, so allocated partner money cannot exceed it.
      const match = campaignMatch(intendedGbp, funding, matchedUsed);
      updatedCampaigns[index] = {
        ...current,
        amountRaised: Math.round((previousAmount + intendedGbp) * 100) / 100,
        ...(funding?.type === "matching" ? {
          partnerFundingMatchedGbp: Math.round((matchedUsed + match.matchedGbp) * 100) / 100,
        } : {}),
      };
      return { campaigns: updatedCampaigns, result: undefined };
      });
      log.info({ orgId, campaignId, intendedGbp }, "Updated campaign amountRaised");
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
      const orgDoc = await fsGet("organisations", orgId, serverToken, { includeDeleted: true });
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
          await fsPatch("organisations", orgId, { supporterWall: orgWall }, serverToken);
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
  // Propagate ledger failures so Stripe retries. The donation dedup branch
  // repairs only this create-only write without repeating other side effects.
  await queueDonationPayout(donationId, {
    orgId, orgName: orgName ?? "", stripeRef, toOrgGbp, currency,
    payoutMethod: metadata.payoutMethod, createdAt: donationDate,
  }, serverToken);
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
