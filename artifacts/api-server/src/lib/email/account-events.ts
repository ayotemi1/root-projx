import { fsPatch, getServerToken } from "../firebase-rest.ts";
import { emailPreferencesLink } from "./preferences.ts";
import { recordAndFulfilEmail } from "./obligations.ts";
import { firstName, submitTemplateEmail } from "./service.ts";
import { EMAIL_SITE_URL } from "./templates.ts";

export async function deliverWelcomeEmail(input: Record<string, unknown>) {
  if (typeof input.email !== "string" || typeof input.uid !== "string") throw new Error("Welcome email identity is unavailable.");
  await submitTemplateEmail(`signup:${input.uid}`, "02-supporter-welcome", input.email, {
    first_name: firstName(input.name), discover_url: `${EMAIL_SITE_URL}/discover`,
    preferences_url: emailPreferencesLink(input.email),
  });
}
export async function welcomeEmailEvent(uid: string, email: string, name: string, defer = true) {
  await recordAndFulfilEmail(uid, "welcome", { uid, email, name }, defer);
  await fsPatch("users", uid, { emailWelcomePending: false }, await getServerToken());
}
