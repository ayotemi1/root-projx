import { fsMutateEmailState, fsQuery, getServerToken } from "../firebase-rest.ts";
import { ROOT_ADMIN_EMAIL } from "../email-identity.ts";
import { EmailAccessError } from "./preferences.ts";
import { logger } from "../logger.ts";
import { openEmail } from "./crypto.ts";
import { deliverEmail, enqueueEmail, type EmailJob, type PrivateEmailPayload } from "./delivery.ts";
import { firestoreEmailStore } from "./firestore-store.ts";
import { brevoEmailTransport } from "./brevo-transport.ts";
import { mailPreferencePermits } from "./preferences.ts";
import { renderEmail, type EmailTemplateId, type EmailVariables, type RenderedEmail } from "./templates.ts";

export async function submitRenderedEmail(eventKey: string, to: string, message: RenderedEmail, expiresAt?: Date) {
  const queued = await enqueueEmail(firestoreEmailStore, { eventKey, to, message, expiresAt });
  const state = await deliverEmail(firestoreEmailStore, brevoEmailTransport, queued.id, mailPreferencePermits);
  if (["rejected", "uncertain"].includes(state)) logger.warn({ mailId: queued.id, state }, "Email needs delivery review");
  return { ...queued, state };
}
export function submitTemplateEmail(eventKey: string, template: EmailTemplateId, to: string, variables: EmailVariables, expiresAt?: Date) {
  return submitRenderedEmail(eventKey, to, renderEmail(template, variables), expiresAt);
}
export async function emailConfiguration() {
  return { adminRecipient: ROOT_ADMIN_EMAIL };
}
export async function saveEmailConfiguration(adminRecipient: string) {
  if (adminRecipient.trim().toLowerCase() !== ROOT_ADMIN_EMAIL) {
    throw new EmailAccessError(400, "Admin emails must be sent to info@rootprojx.com.");
  }
  await fsMutateEmailState("email_settings", "config", await getServerToken(), () => ({
    patch: { adminRecipient: ROOT_ADMIN_EMAIL, updatedAt: new Date().toISOString() }, result: undefined,
  }));
  return emailConfiguration();
}
export async function emailHistory() {
  const rows = await fsQuery("email_outbox", [], await getServerToken(),
    { orderBy: { field: "createdAt", dir: "DESCENDING" }, limit: 100 });
  const attention = await fsQuery("email_events", [{ field: "state", op: "EQUAL", value: "needs_attention" }], await getServerToken(), { limit: 100 });
  const lateRows = attention.filter(row => row.kind === "late-daily-gift").map(row => {
    const value = openEmail<{ email: string }>(String(row.encryptedPayload), String(row._id));
    return {
      id: String(row._id), recipient: value.email, templateId: "12-org-daily-summary", state: "needs_attention",
      createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), providerStatus: null,
      detail: "A late gift arrived after this daily summary was prepared. It was retained for review; no duplicate summary was sent.",
    };
  });
  const history = rows.map(row => {
    let recipient = "Encrypted recipient unavailable";
    try { recipient = openEmail<PrivateEmailPayload>(String(row.encryptedPayload), String(row.id)).to; } catch { /* retain history after key rotation */ }
    return {
      id: String(row.id), recipient, templateId: String(row.templateId), state: String(row.state),
      createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
      providerStatus: typeof row.providerStatus === "number" ? row.providerStatus : null,
    };
  });
  return [...lateRows, ...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
}
export async function processEmailQueue(retryRejected = false) {
  const token = await getServerToken();
  const states = retryRejected ? ["queued", "retryable", "rejected"] : ["queued", "retryable"];
  let processed = 0, failed = 0;
  for (const state of states) {
    const rows = await fsQuery("email_outbox", [{ field: "state", op: "EQUAL", value: state }], token, { limit: 100 });
    for (const row of rows) {
      try {
        const id = String(row.id);
        // Only explicit rejection is retryable by an administrator. Ambiguous
        // "sending"/"uncertain" rows are never reset by this operation.
        if (state === "rejected") await firestoreEmailStore.mutate(id, current => current.state === "rejected"
          ? { patch: { state: "queued", nextAttemptAt: new Date().toISOString() }, result: undefined } : { result: undefined });
        const next = await deliverEmail(firestoreEmailStore, brevoEmailTransport, id, mailPreferencePermits);
        if (["accepted", "suppressed", "expired"].includes(next)) processed++; else failed++;
      } catch {
        failed++;
        logger.warn("An email queue record could not be processed");
      }
    }
  }
  return { processed, failed };
}

export function firstName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().split(/\s+/)[0]! : "there";
}
export const emailDate = (value: string | number | Date) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Email date is unavailable.");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
};
