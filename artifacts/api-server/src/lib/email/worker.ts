import { fsMutateCampaigns, fsPatch, fsQuery, getServerToken } from "../firebase-rest.ts";
import { logger } from "../logger.ts";
import { applicationEmails } from "./application-events.ts";
import { welcomeEmailEvent } from "./account-events.ts";
import { campaignEmailEvent } from "./campaign-events.ts";
import { processEmailObligations } from "./obligations.ts";
import { processEmailQueue } from "./service.ts";
import { donationEmailEvent } from "./donation-events.ts";
import { processDailySummaries } from "./daily-summary.ts";
import { payoutEmailEvent } from "./payout-events.ts";

/** Recovery reads source-side markers, not money totals. It never records a
 * donation, changes balances, publishes a campaign or initiates a transfer. */
export async function recoverEmailSources() {
  const token = await getServerToken();
  let processed = 0, failed = 0;
  const recover = async (run: () => Promise<unknown>) => {
    try { await run(); processed++; }
    catch { failed++; logger.warn("A source email marker remains pending for recovery"); }
  };
  const users = await fsQuery("users", [{ field: "emailWelcomePending", op: "EQUAL", value: true }], token, { limit: 100 });
  for (const user of users) await recover(() => welcomeEmailEvent(String(user._id), String(user.email), String(user.name), false));
  const gifts = await fsQuery("donations", [{ field: "emailDonationPending", op: "EQUAL", value: true }], token, { limit: 100 });
  for (const gift of gifts) await recover(() => donationEmailEvent(String(gift._id), false));
  const payouts = await fsQuery("payouts", [{ field: "emailPayoutPending", op: "EQUAL", value: true }], token, { limit: 100 });
  for (const batchId of new Set(payouts.map(payout => String(payout.batchId)))) {
    await recover(() => payoutEmailEvent(batchId, false));
  }
  for (const field of ["emailReceivedPending", "emailDecisionPending"]) {
    const rows = await fsQuery("org_applications", [{ field, op: "EQUAL", value: true }], token, { limit: 100 });
    for (const app of rows) await recover(async () => {
      const transition = field === "emailReceivedPending" ? "received" : app.status;
      if (!["received", "approved", "declined", "waiting"].includes(String(transition))) {
        // A response may have returned a waiting application to pending before
        // its superseded request was recovered. Do not invent another request.
        if (field === "emailDecisionPending" && app.status === "pending") {
          await fsPatch("org_applications", String(app._id), { emailDecisionPending: false }, token);
          return;
        }
        throw new Error("Application email transition is unavailable.");
      }
      await applicationEmails(String(app._id), app, transition as "received" | "approved" | "declined" | "waiting", false);
    });
  }
  // The project embeds campaigns in org documents. An array cannot be queried
  // by a nested marker; reuse that storage rather than creating a second truth.
  const orgs = await fsQuery("organisations", [], token);
  for (const org of orgs) {
    if (!Array.isArray(org.campaigns) || org.deletedAt) continue;
    for (const campaign of org.campaigns as Array<Record<string, unknown>>) {
      for (const [flag, type] of [["emailPublicationPending", "live"], ["emailGoalPending", "goal"]] as const) {
        if (campaign[flag] !== true) continue;
        await recover(async () => {
          await campaignEmailEvent(String(org._id), String(campaign._id), type, false);
          await fsMutateCampaigns(String(org._id), token, latest => ({
            campaigns: (latest.campaigns as Array<Record<string, unknown>>).map(c =>
              c._id === campaign._id ? { ...c, [flag]: false } : c), result: undefined,
          }));
        });
      }
    }
  }
  return { processed, failed };
}
export async function runEmailWork(retryRejected = false) {
  const sources = await recoverEmailSources();
  const obligations = await processEmailObligations();
  const summaries = await processDailySummaries();
  const queue = await processEmailQueue(retryRejected);
  return {
    processed: sources.processed + obligations.processed + summaries.processed + queue.processed,
    failed: sources.failed + obligations.failed + summaries.failed + queue.failed,
  };
}
