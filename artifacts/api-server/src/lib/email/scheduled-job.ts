import { randomBytes, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { fsGet, fsMutateEmailState, getServerToken } from "../firebase-rest.ts";
import { emailRecordId } from "./crypto.ts";
import { EMAIL_SITE_URL } from "./templates.ts";
import { runEmailWork } from "./worker.ts";

export async function emailJobStatus() {
  const row = await fsGet("email_settings", "scheduled-job", await getServerToken());
  return {
    configured: typeof row?.keyHash === "string",
    endpoint: `${EMAIL_SITE_URL}/api/email/jobs/run`,
    lastRunAt: typeof row?.lastRunAt === "string" ? row.lastRunAt : null,
    lastRunFailed: row?.lastRunFailed === true,
  };
}
export async function createEmailJobKey() {
  const key = randomBytes(32).toString("base64url");
  await fsMutateEmailState("email_settings", "scheduled-job", await getServerToken(), () =>
    ({ patch: { keyHash: emailRecordId("scheduled-job-key", key), rotatedAt: new Date().toISOString() }, result: undefined }));
  return { key };
}
export const requireEmailJobKey: RequestHandler = async (req, res, next) => {
  try {
    const value = req.headers["x-email-job-key"];
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) { res.status(401).json({ error: "Scheduled-job authentication required." }); return; }
    const row = await fsGet("email_settings", "scheduled-job", await getServerToken());
    const stored = typeof row?.keyHash === "string" ? row.keyHash : "";
    const supplied = emailRecordId("scheduled-job-key", value);
    if (stored.length !== supplied.length || !timingSafeEqual(Buffer.from(stored), Buffer.from(supplied))) {
      res.status(401).json({ error: "Scheduled-job authentication required." }); return;
    }
    next();
  } catch {
    req.log?.warn("Scheduled email authentication could not be checked");
    res.status(503).json({ error: "Scheduled email work is temporarily unavailable." });
  }
};
export async function runScheduledEmailWork() {
  const startedAt = new Date().toISOString();
  try {
    const result = await runEmailWork();
    await fsMutateEmailState("email_settings", "scheduled-job", await getServerToken(), () =>
      ({ patch: { lastRunAt: startedAt, lastRunFailed: result.failed > 0 }, result: undefined }));
    return result;
  } catch {
    await fsMutateEmailState("email_settings", "scheduled-job", await getServerToken(), () =>
      ({ patch: { lastRunAt: startedAt, lastRunFailed: true }, result: undefined }));
    throw new Error("Scheduled email work remains pending.");
  }
}
