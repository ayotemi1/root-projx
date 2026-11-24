import type Stripe from "stripe";
import { ROOT_ADMIN_EMAIL } from "../email-identity.ts";
import { fsCreateIfAbsent, fsGet, fsPatch, fsQuery, getServerToken } from "../firebase-rest.ts";
import { getUncachableStripeClient } from "../stripeClient.ts";
import { PLATFORM_FEE_PERCENT } from "../fees.ts";
import { campaignPresentation } from "../campaign-presentation.ts";
import { campaignSharePath } from "../campaign-links.ts";
import { donationReceivedHtml } from "../brevo.ts";
import type { DonationAccounting } from "../donation-accounting.ts";
import { emailRecordId, sealEmail } from "./crypto.ts";
import { emailPreferencesLink, preferenceIdentity, readMailPreferences } from "./preferences.ts";
import { recordAndFulfilEmail } from "./obligations.ts";
import { campaignFundingTotal } from "../campaign-matching.ts";
import { emailDate, firstName, submitRenderedEmail } from "./service.ts";
import { EMAIL_SITE_URL, emailMoney, emailPlainText, renderFinancialEmail } from "./templates.ts";

export type EmailCurrency = "gbp" | "usd";
export function nativeDonationEmailAmounts(donation: Record<string, unknown>) {
  const currency = donation.currency;
  if (currency !== "gbp" && currency !== "usd") throw new Error("Donation receipt currency is unavailable.");
  const accounting = donation.receiptAccounting as Record<string, unknown> | undefined;
  if (!accounting) throw new Error("Native receipt accounting is unavailable.");
  const minor = (key: string) => {
    const value = accounting[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 0.0001) throw new Error("Donation receipt amount is unavailable.");
    return Math.round(value * 100);
  };
  return { currency: currency as EmailCurrency, accounting, gift: minor("intendedGbp"), receives: minor("toOrgGbp"),
    charged: minor("chargedGbp"), cover: minor("feeCoverGbp"), covered: accounting.feeCovered === true };
}
export function londonDay(value: string | number | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Gift date is unavailable.");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export async function receiptPaymentCard(donation: Record<string, unknown>) {
  const stripe = await getUncachableStripeClient();
  let intentId = String(donation.stripeRef ?? "");
  if (intentId.startsWith("in_")) {
    const invoice = await stripe.invoices.retrieve(intentId, { expand: ["payments.data.payment.payment_intent"] });
    const data = invoice as unknown as {
      payment_intent?: string | Stripe.PaymentIntent | null;
      payments?: { data?: Array<{ payment?: { payment_intent?: string | Stripe.PaymentIntent | null } }> };
    };
    const value = data.payments?.data?.find(p => p.payment?.payment_intent)?.payment?.payment_intent ?? data.payment_intent;
    intentId = typeof value === "string" ? value : value?.id ?? "";
  }
  if (!intentId.startsWith("pi_")) throw new Error("Receipt payment identity is unavailable.");
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
  const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  if (!charge?.payment_method_details) throw new Error("Receipt payment details are not available yet.");
  const method = charge.payment_method_details;
  if (method.type !== "card") return null;
  if (!method.card?.brand || typeof method.card.last4 !== "string" || !/^[0-9]{4}$/.test(method.card.last4)) throw new Error("Receipt card details are unavailable.");
  return { brand: method.card.brand.toUpperCase(), last4: method.card.last4 };
}
export async function deliverDonationEmails(id: string) {
  const token = await getServerToken(), donation = await fsGet("donations", id, token);
  if (!donation) throw new Error("Recorded donation is unavailable.");
  // Never manufacture receipts from unconfirmed intents or failed Checkout.
  if (donation.status !== "succeeded") return;
  const { currency, accounting, gift, receives, charged, cover, covered } = nativeDonationEmailAmounts(donation);
  const eventId = String(donation.stripeRef || id);
  const orgId = String(donation.orgId), org = await fsGet("organisations", orgId, token, { includeDeleted: true });
  if (!org) throw new Error("Donation organisation is unavailable.");
  const owner = await fsGet("users", orgId, token);
  const campaign = Array.isArray(org.campaigns)
    ? org.campaigns.find((c: Record<string, unknown>) => c._id === donation.campaignId) as Record<string, unknown> | undefined : undefined;
  const campaignName = String(campaign?.name || org.name);
  const campaignUrl = campaign ? `${EMAIL_SITE_URL}${campaignSharePath({ ...org, _id: orgId }, campaign).sharePath}`
    : `${EMAIL_SITE_URL}/organisations/${encodeURIComponent(orgId)}`;
  const publicName = typeof donation.publicDonorName === "string" && donation.publicDonorName.trim() ? donation.publicDonorName : null;
  const money = (minor: number) => emailMoney(minor, currency);
  const giftIsGuest = !donation.userId || ["guest", "anonymous"].includes(String(donation.userId));
  const donor = giftIsGuest ? null : await fsGet("users", String(donation.userId), token);
  const recipient = giftIsGuest ? donation.guestEmail : donor?.email;
  const results = await Promise.allSettled([(async () => {
  if (typeof recipient !== "string") throw new Error("Donation has no private receipt address.");
  if (PLATFORM_FEE_PERCENT !== 5) throw new Error("The supplied receipt's fee policy does not match the configured platform policy.");
  const card = await receiptPaymentCard(donation);
  const presentation = campaignPresentation(campaign);
  const receipt = {
    campaign_name: campaignName, org_name: String(org.name), gift_amount: money(gift),
    org_receives: money(receives), card_fee: money(cover), total_paid: money(charged),
    receipt_number: id, date: emailDate(String(donation.createdAt)),
    ...(card ? { card_brand: card.brand, card_last4: card.last4 } : {}),
    impact_line: presentation.confirmationLine ? `, ${presentation.confirmationLine}` : "",
  };
  const omissions = [...(!covered ? ["card_fee"] : []), ...(!card ? ["card_last4"] : [])];
  if (giftIsGuest) {
    await submitRenderedEmail(`donation:${eventId}`, recipient, renderFinancialEmail("04-donation-receipt-guest",
      { ...receipt, signup_url: `${EMAIL_SITE_URL}/register` }, omissions));
  } else {
    const shareUrl = campaign?.publicId && typeof donation.checkoutSessionId === "string"
      ? `${EMAIL_SITE_URL}/campaigns/${encodeURIComponent(String(campaign.publicId))}/thank-you/share?session_id=${encodeURIComponent(donation.checkoutSessionId)}`
      : `${EMAIL_SITE_URL}/giving-history`;
    await submitRenderedEmail(`donation:${eventId}`, recipient, renderFinancialEmail("03-donation-receipt",
      { ...receipt, first_name: firstName(donor?.name), giving_history_url: `${EMAIL_SITE_URL}/giving-history`,
        share_url: shareUrl, campaign_url: campaignUrl }, omissions));
  }
  })(), (async () => {
  if (typeof owner?.email !== "string") throw new Error("Organisation has no private notification address.");
  const preferences = await readMailPreferences(preferenceIdentity(owner.email), true);
  if (preferences.orgGifts && preferences.giftFrequency === "daily_summary") {
    const dailyId = emailRecordId("daily-gift", eventId);
    await fsCreateIfAbsent("email_events", dailyId, {
      kind: "daily-gift", day: londonDay(String(donation.createdAt)), orgId, campaignId: String(donation.campaignId || "general"),
      currency, createdAt: String(donation.createdAt),
      encryptedPayload: sealEmail({ email: owner.email, publicDonorName: publicName, giftMinor: gift,
        orgReceivesMinor: receives, orgName: String(org.name), firstName: firstName(owner.name), campaignName }, dailyId),
    }, token);
  } else {
    const goal = Number(campaign?.goal), hasTarget = !!campaign && Number.isFinite(goal) && goal > 0;
    const raised = hasTarget ? campaignFundingTotal(campaign!) : 0;
    await submitRenderedEmail(`donation:${eventId}`, owner.email, renderFinancialEmail("12-org-new-donation", {
      first_name: firstName(owner.name), org_name: String(org.name), campaign_name: campaignName,
      donor_display_name: publicName || "Anonymous", gift_amount: money(gift), org_receives: money(receives),
      ...(hasTarget ? { campaign_raised: money(Math.round(raised * 100)), goal_amount: money(Math.round(goal * 100)) } : {}),
      dashboard_url: `${EMAIL_SITE_URL}/dashboard`, preferences_url: emailPreferencesLink(owner.email, true),
    }, hasTarget ? [] : ["campaign_raised"]));
  }
  })(), (async () => {
  // Operational platform alert remains essential and independent of an org's
  // optional notification frequency. Only the consented public name is used.
  const html = donationReceivedHtml({
    orgName: String(org.name), campaignName: campaign?.name ? String(campaign.name) : undefined,
    donorName: publicName, accounting: accounting as unknown as DonationAccounting, currency,
    recurring: donation.type === "recurring", reference: String(donation.stripeRef),
    donationDate: String(donation.createdAt), platformFeePercent: PLATFORM_FEE_PERCENT,
  });
  await submitRenderedEmail(`donation:${eventId}`, ROOT_ADMIN_EMAIL, {
    templateId: "operational-donation", subject: `New ${donation.type === "recurring" ? "monthly " : ""}donation: ${money(gift)} to ${org.name}`,
    preheader: "", htmlContent: html, textContent: emailPlainText(html),
  });
  })()]);
  if (results.some(result => result.status === "rejected")) throw new Error("At least one donation email remains pending.");
}
export async function donationEmailEvent(id: string, defer = true) {
  const source = await fsGet("donations", id, await getServerToken());
  if (!source) throw new Error("Donation email source is unavailable.");
  await recordAndFulfilEmail(String(source.stripeRef || id), "donation", { id }, defer);
  await fsPatch("donations", id, { emailDonationPending: false }, await getServerToken());
}
