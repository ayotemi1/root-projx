import { fsGet, fsMutateEmailState, fsQuery, getServerToken } from "../firebase-rest.ts";
import { logger } from "../logger.ts";
import { emailRecordId, openEmail } from "./crypto.ts";
import { londonDay, type EmailCurrency } from "./donation-events.ts";
import { campaignFundingTotal } from "../campaign-matching.ts";
import { emailPreferencesLink } from "./preferences.ts";
import { submitRenderedEmail } from "./service.ts";
import { EMAIL_SITE_URL, renderDailySummary, type DailyGift } from "./templates.ts";
import { DAILY_GIFT_SUMMARIES_ENABLED } from "./policy.ts";

interface DailyPayload extends DailyGift {
  email: string; orgName: string; firstName: string; campaignName: string;
}
/** Run after source recovery. A ten-minute London-midnight grace period keeps
 * an in-flight confirmed gift in the correct day's complete batch. */
export async function processDailySummaries(now = new Date()) {
  if (!DAILY_GIFT_SUMMARIES_ENABLED) return { processed: 0, failed: 0 };
  const today = londonDay(now.getTime() - 10 * 60_000);
  const token = await getServerToken();
  const rows = (await fsQuery("email_events", [{ field: "kind", op: "EQUAL", value: "daily-gift" }], token))
    .filter(row => typeof row.day === "string" && row.day < today);
  const incompleteSources = await fsQuery("donations", [{ field: "emailDonationPending", op: "EQUAL", value: true }], token);
  const pendingEvents = await fsQuery("email_events", [{ field: "state", op: "EQUAL", value: "pending" }], token);
  for (const event of pendingEvents) {
    if (event.kind !== "mail-obligation") continue;
    const obligation = openEmail<{ type: string; input: { id?: string } }>(String(event.encryptedPayload), String(event._id));
    if (obligation.type !== "donation" || !obligation.input.id) continue;
    const source = await fsGet("donations", obligation.input.id, token);
    if (source) incompleteSources.push(source);
  }
  const groups = new Map<string, Array<{ row: Record<string, unknown>; value: DailyPayload }>>();
  for (const row of rows) {
    const value = openEmail<DailyPayload>(String(row.encryptedPayload), String(row._id));
    const key = JSON.stringify([row.orgId, row.campaignId, row.currency, row.day, value.email.toLowerCase()]);
    const group = groups.get(key) ?? []; group.push({ row, value }); groups.set(key, group);
  }
  let processed = 0, failed = 0;
  for (const [key, group] of groups) {
    try {
      const first = group[0]!, { value, row } = first;
      if (incompleteSources.some(source => source.orgId === row.orgId &&
          String(source.campaignId || "general") === row.campaignId && String(source.currency ?? "gbp") === row.currency &&
          londonDay(String(source.createdAt)) === row.day)) continue;
      const manifestId = emailRecordId("daily-summary-manifest", key);
      const sourceIds = await fsMutateEmailState("email_events", manifestId, token, current => {
        if (current) {
          if (!Array.isArray(current.sourceIds) || current.sourceIds.some(id => typeof id !== "string")) throw new Error("Invalid daily-summary manifest.");
          return { result: current.sourceIds as string[] };
        }
        const ids = group.map(item => String(item.row._id));
        return { patch: { kind: "daily-summary-manifest", sourceIds: ids, createdAt: now.toISOString() }, result: ids };
      });
      const included = group.filter(item => sourceIds.includes(String(item.row._id)));
      const late = group.filter(item => !sourceIds.includes(String(item.row._id)));
      for (const item of late) await fsMutateEmailState("email_events", String(item.row._id), token, () => ({
        patch: { kind: "late-daily-gift", state: "needs_attention", updatedAt: now.toISOString() }, result: undefined,
      }));
      if (late.length) failed++;
      // Never silently discard a late gift, overwrite an accepted email or
      // issue a second summary for that same campaign/day/recipient.
      if (!included.length) continue;
      const org = await fsGet("organisations", String(row.orgId), token, { includeDeleted: true });
      if (!org) throw new Error("Daily-summary organisation is unavailable.");
      const campaign = Array.isArray(org.campaigns)
        ? org.campaigns.find((c: Record<string, unknown>) => c._id === row.campaignId) as Record<string, unknown> | undefined : undefined;
      const goal = Number(campaign?.goal), raised = campaignFundingTotal(campaign ?? {});
      const target = !!campaign && Number.isFinite(goal) && goal > 0 && Number.isFinite(raised);
      if (row.currency !== "gbp" && row.currency !== "usd") throw new Error("Daily-summary currency is unavailable.");
      const message = renderDailySummary({
        firstName: value.firstName, orgName: value.orgName, campaignName: value.campaignName,
        currency: row.currency as EmailCurrency, hasCampaignTarget: target,
        raisedMinor: target ? Math.round(raised * 100) : 0, goalMinor: target ? Math.round(goal * 100) : 0,
        dashboardUrl: `${EMAIL_SITE_URL}/dashboard`, preferencesUrl: emailPreferencesLink(value.email, true),
        gifts: included.map(item => item.value),
      });
      if (!message) continue;
      const eventId = emailRecordId("daily-summary", key);
      await submitRenderedEmail(`daily-summary:${eventId}`, value.email, message);
      for (const item of included) await fsMutateEmailState("email_events", String(item.row._id), token, () =>
        ({ patch: { kind: "daily-gift-queued", summaryEvent: eventId }, result: undefined }));
      processed++;
    } catch { failed++; logger.warn("A daily gift summary remains pending for recovery"); }
  }
  return { processed, failed };
}
