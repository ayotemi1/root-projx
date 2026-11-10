import { fsGet } from "./firebase-rest.js";
import { brevoSendEmail, donationReceivedHtml } from "./brevo.js";
import type { DonationAccounting } from "./donation-accounting.ts";
import { PLATFORM_FEE_PERCENT } from "./fees.js";

type Log = { info: (obj: unknown, message: string) => void; error: (obj: unknown, message: string) => void };

/** Called only after a new donation passes the webhook's duplicate guards.
 * Keep recipients separate: neither receives the other's address or donor email.
 * As with donor receipts, email failures must not interrupt financial recording.
 */
export async function notifyDonationReceived(input: {
  orgId: string;
  orgName: string;
  campaignId?: string;
  publicDonorName: string | null;
  accounting: DonationAccounting;
  currency: "gbp" | "usd";
  type: string;
  stripeRef: string;
  donationDate: string;
}, token: string, log: Log): Promise<void> {
  const lookups = await Promise.allSettled([
    fsGet("organisations", input.orgId, token),
    fsGet("users", input.orgId, token),
  ]);
  const org = lookups[0].status === "fulfilled" ? lookups[0].value : null;
  const owner = lookups[1].status === "fulfilled" ? lookups[1].value : null;
  const validEmail = (value: unknown): value is string =>
    typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  // Prefer the registered account address over the editable public contact.
  const contact = org?.contact as { email?: unknown } | undefined;
  const orgEmail = validEmail(owner?.email) ? owner.email
    : validEmail(contact?.email) ? contact.email : undefined;
  const campaign = Array.isArray(org?.campaigns)
    ? org.campaigns.find((item: Record<string, unknown>) => item._id === input.campaignId)
    : undefined;
  const campaignName = typeof campaign?.name === "string" ? campaign.name
    : typeof campaign?.title === "string" ? campaign.title : undefined;
  const orgName = typeof org?.name === "string" ? org.name : input.orgName || "the organisation";
  const htmlContent = donationReceivedHtml({
    orgName, campaignName, donorName: input.publicDonorName,
    accounting: input.accounting, currency: input.currency,
    recurring: input.type === "recurring", reference: input.stripeRef,
    donationDate: input.donationDate, platformFeePercent: PLATFORM_FEE_PERCENT,
  });
  const amount = `${input.currency === "usd" ? "US$" : "£"}${input.accounting.intendedGbp.toFixed(2)}`;
  const recipients = [
    { audience: "organisation", email: orgEmail },
    { audience: "team", email: process.env.TEAM_EMAIL || "info@rootprojx.com" },
  ];
  await Promise.all(recipients.map(async ({ audience, email }) => {
    if (!email) {
      log.error({ orgId: input.orgId, stripeRef: input.stripeRef, audience }, "Donation notification has no organisation email address");
      return;
    }
    try {
      await brevoSendEmail({
        to: [{ email }],
        subject: `New ${input.type === "recurring" ? "monthly " : ""}donation: ${amount} to ${orgName}`,
        htmlContent,
      });
      log.info({ orgId: input.orgId, stripeRef: input.stripeRef, audience }, "Donation notification submitted to Brevo");
    } catch {
      // Do not log provider payloads containing recipient information.
      log.error({ orgId: input.orgId, stripeRef: input.stripeRef, audience }, "Donation notification email failed (non-fatal)");
    }
  }));
}
