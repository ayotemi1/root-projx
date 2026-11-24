import { fsCreateIfAbsent, fsGet, fsMutateEmailState, getServerToken } from "../firebase-rest.ts";
import type { EmailJob, EmailStore } from "./delivery.ts";

function privateJob(row: Record<string, unknown> | null, id: string): EmailJob | null {
  if (!row) return null;
  if (row.version !== 1 || row.id !== id || typeof row.encryptedPayload !== "string" ||
      !["queued", "sending", "accepted", "retryable", "rejected", "uncertain", "suppressed", "expired"].includes(String(row.state)) ||
      typeof row.nextAttemptAt !== "string" || !Number.isFinite(Date.parse(row.nextAttemptAt)) ||
      typeof row.attempts !== "number" || !Number.isSafeInteger(row.attempts) || row.attempts < 0) {
    throw new Error("Invalid private email job.");
  }
  return row as unknown as EmailJob;
}

export const firestoreEmailStore: EmailStore = {
  async create(job) {
    return fsCreateIfAbsent("email_outbox", job.id, { ...job }, await getServerToken());
  },
  async get(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid private email identifier.");
    return privateJob(await fsGet("email_outbox", id, await getServerToken()), id);
  },
  async mutate(id, decide) {
    return fsMutateEmailState("email_outbox", id, await getServerToken(), current => {
      const job = privateJob(current, id);
      if (!job) throw new Error("Email record not found.");
      const decision = decide(job);
      return { patch: decision.patch ? { ...decision.patch } : undefined, result: decision.result };
    });
  },
};
