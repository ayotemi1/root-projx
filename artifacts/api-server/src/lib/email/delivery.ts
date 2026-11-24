import { emailRecordId, openEmail, sealEmail } from "./crypto.ts";
import type { RenderedEmail } from "./templates.ts";
import { DAILY_GIFT_SUMMARIES_ENABLED } from "./policy.ts";

export type EmailState = "queued" | "sending" | "accepted" | "retryable" | "rejected" | "uncertain" | "suppressed" | "expired";
export interface EmailJob {
  id: string; version: 1; templateId: RenderedEmail["templateId"];
  state: EmailState; createdAt: string; updatedAt: string;
  nextAttemptAt: string; attempts: number; expiresAt: string | null;
  providerMessageId: string | null; providerStatus: number | null;
  recipientDigest: string; encryptedPayload: string;
}
export interface PrivateEmailPayload { to: string; message: RenderedEmail }
export interface EmailStore {
  create(job: EmailJob): Promise<boolean>;
  get(id: string): Promise<EmailJob | null>;
  mutate<T>(id: string, decide: (job: EmailJob) => { patch?: Partial<EmailJob>; result: T }): Promise<T>;
}
export class EmailTransportError extends Error {
  constructor(
    public disposition: "retryable" | "rejected" | "uncertain",
    public status: number | null = null,
  ) { super("Email provider did not confirm acceptance."); }
}
export interface EmailTransport {
  send(payload: PrivateEmailPayload): Promise<{ messageId: string }>;
}

export function optionalEmail(templateId: RenderedEmail["templateId"]): boolean {
  return ["02-supporter-welcome", "05-supporter-campaign-goal-reached",
    "12-org-new-donation", "12-org-daily-summary"].includes(templateId);
}

export function normaliseEmailAddress(value: string): string {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(value) ||
      /[\u0000-\u001f\u007f]/u.test(value)) throw new Error("Invalid email recipient.");
  return value.trim().toLowerCase();
}

/** A single identity for signed-in/guest receipts prevents a second send if an
 * account classification changes after payment. Other templates keep their ID. */
function dedupeKind(templateId: RenderedEmail["templateId"]): string {
  return templateId === "03-donation-receipt" || templateId === "04-donation-receipt-guest"
    ? "donation-receipt" : templateId;
}
export async function enqueueEmail(store: EmailStore, input: {
  eventKey: string; to: string; message: RenderedEmail; expiresAt?: Date;
}, now = new Date()): Promise<{ id: string; created: boolean }> {
  if (!input.eventKey || input.eventKey.length > 512 || !Number.isFinite(now.getTime()) ||
      input.expiresAt && (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt <= now)) {
    throw new Error("Invalid email event or expiry.");
  }
  if (!input.message.subject.trim() || !input.message.textContent.trim() || !input.message.htmlContent.trim()) {
    throw new Error("Incomplete email content.");
  }
  const to = normaliseEmailAddress(input.to);
  const id = emailRecordId("event-recipient", JSON.stringify([dedupeKind(input.message.templateId), input.eventKey, to]));
  const payload = { to, message: input.message } satisfies PrivateEmailPayload;
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 600_000) throw new Error("Email exceeds the private queue size limit.");
  const timestamp = now.toISOString();
  const job: EmailJob = {
    id, version: 1, templateId: input.message.templateId, state: "queued",
    createdAt: timestamp, updatedAt: timestamp, nextAttemptAt: timestamp, attempts: 0,
    expiresAt: input.expiresAt?.toISOString() ?? null, providerMessageId: null, providerStatus: null,
    recipientDigest: emailRecordId("recipient", to),
    encryptedPayload: sealEmail(payload, id),
  };
  return { id, created: await store.create(job) };
}

export async function deliverEmail(
  store: EmailStore, transport: EmailTransport, id: string,
  canSend: (job: EmailJob, payload: PrivateEmailPayload) => Promise<boolean>,
  now = new Date(),
): Promise<EmailState> {
  const snapshot = await store.get(id);
  if (!snapshot) throw new Error("Email record not found.");
  if (!["queued", "retryable"].includes(snapshot.state) || snapshot.nextAttemptAt > now.toISOString()) return snapshot.state;
  const payload = openEmail<PrivateEmailPayload>(snapshot.encryptedPayload, id);
  // Preference service outages must propagate without claiming/suppressing the
  // job; policy absence is not consent and is not the same as an opt-out.
  // Template 06 is retained as a design reference only. Firebase Auth delivers
  // resets through its own SMTP configuration, including for old queued work.
  const permitted = snapshot.templateId !== "06-password-reset" &&
    (snapshot.templateId !== "12-org-daily-summary" || DAILY_GIFT_SUMMARIES_ENABLED) &&
    (!optionalEmail(snapshot.templateId) || await canSend(snapshot, payload));
  const claimed = await store.mutate(id, job => {
    if (!["queued", "retryable"].includes(job.state) || job.nextAttemptAt > now.toISOString()) {
      return { result: false };
    }
    const state: EmailState = job.expiresAt && job.expiresAt <= now.toISOString()
      ? "expired" : !permitted ? "suppressed" : "sending";
    return { patch: { state, attempts: job.attempts + (state === "sending" ? 1 : 0), updatedAt: now.toISOString() },
      result: state === "sending" };
  });
  if (!claimed) return (await store.get(id))!.state;
  // "sending" is intentionally NOT a lease that expires back to "queued".
  // A crashed or timed-out HTTP request might already have been accepted.
  let outcome: { state: EmailState; messageId: string | null; status: number | null };
  try {
    const result = await transport.send(payload);
    if (!result.messageId) throw new EmailTransportError("uncertain");
    outcome = { state: "accepted", messageId: result.messageId, status: null };
  } catch (error) {
    outcome = error instanceof EmailTransportError
      ? { state: error.disposition, messageId: null, status: error.status }
      : { state: "uncertain", messageId: null, status: null };
  }
  // If persistence fails after sending, let it fail. The row remains "sending"
  // and cannot be sent again automatically, even after a process restart.
  await store.mutate(id, job => job.state !== "sending" ? { result: undefined } : {
    patch: { state: outcome.state, providerMessageId: outcome.messageId, providerStatus: outcome.status,
      updatedAt: new Date().toISOString(), nextAttemptAt: new Date(now.getTime() + 15 * 60_000).toISOString() },
    result: undefined,
  });
  return outcome.state;
}
