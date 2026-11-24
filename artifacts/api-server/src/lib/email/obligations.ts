import { fsCreateIfAbsent, fsGet, fsMutateEmailState, fsQuery, getServerToken } from "../firebase-rest.ts";
import { logger } from "../logger.ts";
import { emailRecordId, openEmail, sealEmail } from "./crypto.ts";
import { EmailEventDeferred } from "./pending.ts";

export type EmailObligationKind = "welcome" | "application-received" | "application-decision" | "donation" | "campaign-live" | "campaign-goal" | "payout";
export interface EmailObligation { type: EmailObligationKind; input: Record<string, unknown> }
export async function recordEmailObligation(eventKey: string, type: EmailObligationKind, input: Record<string, unknown>) {
  const id = emailRecordId("obligation", `${type}:${eventKey}`);
  await fsCreateIfAbsent("email_events", id, {
    kind: "mail-obligation", state: "pending", createdAt: new Date().toISOString(),
    encryptedPayload: sealEmail({ type, input } satisfies EmailObligation, id),
  }, await getServerToken());
  return id;
}
export async function fulfilEmailObligation(id: string): Promise<boolean> {
  const token = await getServerToken(), record = await fsGet("email_events", id, token);
  if (!record || record.state !== "pending") return true;
  if (typeof record.nextAttemptAt === "string" && Date.parse(record.nextAttemptAt) > Date.now()) return false;
  const { type, input } = openEmail<EmailObligation>(String(record.encryptedPayload), id);
  try { switch (type) {
    case "welcome": {
      const { deliverWelcomeEmail } = await import("./account-events.ts");
      await deliverWelcomeEmail(input); break;
    }
    case "application-received":
    case "application-decision": {
      const { deliverApplicationEmails } = await import("./application-events.ts");
      await deliverApplicationEmails(String(input.id), input.app as Record<string, unknown>,
        input.transition as "received" | "approved" | "declined" | "waiting"); break;
    }
    case "campaign-live":
    case "campaign-goal": {
      const { deliverCampaignEmailEvent } = await import("./campaign-events.ts");
      await deliverCampaignEmailEvent(String(input.orgId), String(input.campaignId), type === "campaign-live" ? "live" : "goal"); break;
    }
    case "donation": {
      const { deliverDonationEmails } = await import("./donation-events.ts");
      await deliverDonationEmails(String(input.id)); break;
    }
    case "payout": {
      const { deliverPayoutEmail } = await import("./payout-events.ts");
      await deliverPayoutEmail(input); break;
    }
    default: throw new Error("Unsupported private email event.");
  } } catch (error) {
    const deferred = error instanceof EmailEventDeferred;
    await fsMutateEmailState("email_events", id, token, current => current?.state === "pending" ? {
      patch: {
        attempts: Number(current.attempts ?? 0) + 1, lastAttemptAt: new Date().toISOString(),
        nextAttemptAt: new Date(Date.now() + (deferred ? 5 : 15) * 60_000).toISOString(),
        lastErrorCode: deferred ? "awaiting-event" : "preparation-failed",
      }, result: undefined,
    } : { result: undefined });
    if (error instanceof EmailEventDeferred) return false;
    throw error;
  }
  await fsMutateEmailState("email_events", id, token, current => current?.state === "pending"
    ? { patch: { state: "queued", queuedAt: new Date().toISOString() }, result: undefined } : { result: undefined });
  return true;
}
export async function recordAndFulfilEmail(eventKey: string, type: EmailObligationKind, input: Record<string, unknown>, defer = false) {
  const id = await recordEmailObligation(eventKey, type, input);
  if (defer) {
    // The journal is durable before the HTTP request finishes. The external
    // scheduler recovers this work if an autoscaled process stops immediately.
    setImmediate(() => { void fulfilEmailObligation(id).catch(() => logger.warn({ mailEventId: id }, "Email event remains pending for recovery")); });
  } else await fulfilEmailObligation(id);
  return id;
}
export async function processEmailObligations() {
  const rows = (await fsQuery("email_events", [{ field: "state", op: "EQUAL", value: "pending" }], await getServerToken()))
    .filter(row => row.kind === "mail-obligation" && !(typeof row.nextAttemptAt === "string" && Date.parse(row.nextAttemptAt) > Date.now()))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).slice(0, 100);
  let processed = 0, failed = 0;
  for (const row of rows) {
    if (row.kind !== "mail-obligation") continue;
    try { if (await fulfilEmailObligation(String(row._id))) processed++; }
    catch { failed++; logger.warn({ mailEventId: row._id }, "Email event is retained for recovery"); }
  }
  return { processed, failed };
}
