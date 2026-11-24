import { createHmac, timingSafeEqual } from "node:crypto";
import { fsGet, fsMutateEmailState, fsQuery, getServerToken } from "../firebase-rest.ts";
import { emailRecordId } from "./crypto.ts";
import { normaliseEmailAddress, type EmailJob, type PrivateEmailPayload } from "./delivery.ts";
import { EMAIL_SITE_URL } from "./templates.ts";
import { DAILY_GIFT_SUMMARIES_ENABLED } from "./policy.ts";

export type GiftFrequency = "every_gift" | "daily_summary";
export interface MailPreferences {
  welcome: boolean; campaignGoals: boolean; orgGifts: boolean;
  giftFrequency: GiftFrequency; isOrganisation: boolean;
}
const defaults = { welcome: true, campaignGoals: true, orgGifts: true, giftFrequency: "every_gift" as const };
export class EmailAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function sign(value: string): string {
  if (!process.env.SESSION_SECRET) throw new Error("Email preference security is unavailable.");
  return createHmac("sha256", process.env.SESSION_SECRET).update(`email-preferences-v1:${value}`).digest("base64url");
}
export function preferenceIdentity(email: string) {
  return emailRecordId("recipient", normaliseEmailAddress(email));
}
export function emailPreferencesLink(email: string, isOrganisation = false, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ id: preferenceIdentity(email), org: isOrganisation, exp: now + 180 * 86_400_000 })).toString("base64url");
  return `${EMAIL_SITE_URL}/email-preferences#key=${payload}.${sign(payload)}`;
}
export function parsePreferenceKey(value: unknown, now = Date.now()): { id: string; isOrganisation: boolean } {
  try {
    if (typeof value !== "string" || value.length > 2048) throw new Error();
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra) throw new Error();
    const expected = sign(payload);
    if (Buffer.byteLength(expected) !== Buffer.byteLength(signature) ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error();
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!/^[a-f0-9]{64}$/.test(parsed.id) || typeof parsed.org !== "boolean" ||
        !Number.isFinite(parsed.exp) || parsed.exp <= now) throw new Error();
    return { id: parsed.id, isOrganisation: parsed.org };
  } catch {
    throw new EmailAccessError(403, "This email-preferences link is invalid or expired. Open a newer email or sign in.");
  }
}
export async function readMailPreferences(id: string, isOrganisation: boolean): Promise<MailPreferences> {
  const row = await fsGet("email_preferences", id, await getServerToken());
  return {
    welcome: typeof row?.welcome === "boolean" ? row.welcome : defaults.welcome,
    campaignGoals: typeof row?.campaignGoals === "boolean" ? row.campaignGoals : defaults.campaignGoals,
    orgGifts: typeof row?.orgGifts === "boolean" ? row.orgGifts : defaults.orgGifts,
    giftFrequency: DAILY_GIFT_SUMMARIES_ENABLED && row?.giftFrequency === "daily_summary" ? "daily_summary" : "every_gift",
    isOrganisation,
  };
}
export async function saveMailPreferences(
  id: string, isOrganisation: boolean, input: Partial<Omit<MailPreferences, "isOrganisation">>,
) {
  if (!isOrganisation && (input.orgGifts !== undefined || input.giftFrequency !== undefined)) {
    throw new EmailAccessError(403, "Organisation gift settings belong to the organisation owner.");
  }
  if (!DAILY_GIFT_SUMMARIES_ENABLED && input.giftFrequency === "daily_summary") {
    throw new EmailAccessError(400, "Daily summaries are not available yet. New gifts are emailed individually.");
  }
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (isOrganisation && !DAILY_GIFT_SUMMARIES_ENABLED) patch.giftFrequency = "every_gift";
  await fsMutateEmailState("email_preferences", id, await getServerToken(), () =>
    ({ patch: { ...patch, updatedAt: new Date().toISOString() }, result: undefined }));
  return readMailPreferences(id, isOrganisation);
}
export async function mailPreferencePermits(job: EmailJob, payload: PrivateEmailPayload): Promise<boolean> {
  const preferences = await readMailPreferences(preferenceIdentity(payload.to), false);
  switch (job.templateId) {
    case "02-supporter-welcome": return preferences.welcome;
    case "05-supporter-campaign-goal-reached": {
      if (!preferences.campaignGoals) return false;
      const users = await fsQuery("users", [{ field: "email", op: "EQUAL", value: normaliseEmailAddress(payload.to) }], await getServerToken(), { limit: 2 });
      // Preserve an existing campaign-email opt-out as well as the new scoped
      // preference. A public profile's displayed contact is never queried.
      return !users.some(user => {
        const profile = user.profileShowcase as { settings?: { notifications?: { campaigns?: { email?: unknown } } } } | undefined;
        return profile?.settings?.notifications?.campaigns?.email === false;
      });
    }
    case "12-org-new-donation": return preferences.orgGifts && preferences.giftFrequency === "every_gift";
    case "12-org-daily-summary": return DAILY_GIFT_SUMMARIES_ENABLED && preferences.orgGifts && preferences.giftFrequency === "daily_summary";
    default: return true;
  }
}
