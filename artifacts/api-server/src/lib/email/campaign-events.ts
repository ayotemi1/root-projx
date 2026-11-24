import { fsGet, fsQuery, getServerToken } from "../firebase-rest.ts";
import { campaignSharePath } from "../campaign-links.ts";
import { emailPreferencesLink } from "./preferences.ts";
import { firstName, submitTemplateEmail } from "./service.ts";
import { EMAIL_SITE_URL, emailMoney } from "./templates.ts";
import { recordAndFulfilEmail } from "./obligations.ts";
import { EmailEventDeferred } from "./pending.ts";
import { campaignFundingTotal } from "../campaign-matching.ts";

export async function deliverCampaignEmailEvent(orgId: string, campaignId: string, type: "live" | "goal") {
  const token = await getServerToken();
  const [org, owner] = await Promise.all([fsGet("organisations", orgId, token), fsGet("users", orgId, token)]);
  if (!org || org.deletedAt || !Array.isArray(org.campaigns)) throw new Error("Campaign email organisation is unavailable.");
  const campaign = org.campaigns.find((c: Record<string, unknown>) => c._id === campaignId) as Record<string, unknown> | undefined;
  if (!campaign || campaign.enabled !== true || campaign.status === "deleted") return;
  if (typeof owner?.email !== "string") throw new Error("Campaign owner has no delivery identity.");
  const currency = campaign.currency === "usd" ? "usd" : "gbp";
  const common = { org_name: String(org.name), campaign_name: String(campaign.name) };
  const campaignUrl = `${EMAIL_SITE_URL}${campaignSharePath({ ...org, _id: orgId }, campaign).sharePath}`;
  if (type === "live") {
    await submitTemplateEmail(`campaign-live:${orgId}:${campaignId}`, "13-org-campaign-live", owner.email,
      { ...common, first_name: firstName(owner.name), campaign_url: campaignUrl });
    return;
  }
  const goal = Number(campaign.goal), raised = campaignFundingTotal(campaign);
  if (!Number.isFinite(goal) || goal <= 0 || !Number.isFinite(raised) || raised < goal) {
    throw new EmailEventDeferred("Campaign is no longer at its goal; do not send an inaccurate milestone.");
  }
  const gifts = (await fsQuery("donations", [{ field: "campaignId", op: "EQUAL", value: campaignId }], token))
    .filter(d => d.orgId === orgId && d.status === "succeeded");
  const distinct = new Set(gifts.map(d => String(d.donorIdentityKey || d.userId || d._id)));
  const progress = { goal_amount: emailMoney(Math.round(goal * 100), currency), supporter_count: String(distinct.size) };
  await submitTemplateEmail(`campaign-goal:${orgId}:${campaignId}`, "14-org-campaign-goal-reached", owner.email, {
    ...common, ...progress, first_name: firstName(owner.name), create_post_url: `${EMAIL_SITE_URL}/dashboard?tab=posts`,
  });
  const recipients = new Map<string, { email: string; name: unknown }>();
  for (const gift of gifts) {
    if (typeof gift.userId === "string" && !["guest", "anonymous"].includes(gift.userId)) {
      const user = await fsGet("users", gift.userId, token);
      if (typeof user?.email === "string") recipients.set(user.email.trim().toLowerCase(), { email: user.email, name: user.name });
    } else if (typeof gift.guestEmail === "string") {
      // The guest's successful Checkout supplied this private address. Never
      // infer the identity from a public wall name or editable org contact.
      recipients.set(gift.guestEmail.trim().toLowerCase(), { email: gift.guestEmail, name: "Supporter" });
    }
  }
  for (const recipient of recipients.values()) {
    await submitTemplateEmail(`campaign-goal:${orgId}:${campaignId}`, "05-supporter-campaign-goal-reached", recipient.email, {
      ...common, ...progress, first_name: firstName(recipient.name), campaign_url: campaignUrl,
      preferences_url: emailPreferencesLink(recipient.email),
    });
  }
}
export function campaignEmailEvent(orgId: string, campaignId: string, type: "live" | "goal", defer = true) {
  return recordAndFulfilEmail(`${orgId}:${campaignId}`, type === "live" ? "campaign-live" : "campaign-goal", { orgId, campaignId }, defer);
}
