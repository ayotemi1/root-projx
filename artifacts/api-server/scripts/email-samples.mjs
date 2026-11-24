// Explicitly authorised visual proofs only. Supply {to,testConsent,values,
// dailyGifts} on stdin; recipient/contact data is never written to this file.
// Without --send this validates the entire pack without contacting Brevo.
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
try {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw);
  const compiled = await build({
    stdin: { contents: `
      export * from "./src/lib/email/templates.ts";
      export {emailPreferencesLink} from "./src/lib/email/preferences.ts";
      export {firestoreEmailStore} from "./src/lib/email/firestore-store.ts";
      export {brevoEmailTransport} from "./src/lib/email/brevo-transport.ts";
      export {enqueueEmail,deliverEmail,normaliseEmailAddress} from "./src/lib/email/delivery.ts";`,
      resolveDir: root, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", packages: "external",
    loader: { ".html": "text" }, write: false, logLevel: "silent",
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", "__dirname", compiled.outputFiles[0].text)(require, mod, mod.exports, root);
  const mail = mod.exports, to = mail.normaliseEmailAddress(input.to);
  const site = mail.EMAIL_SITE_URL;
  const campaign = `${site}/campaigns/humanity-ova-vanity-eurlc2/out-of-many-hands-_hands`;
  const links = {
    confirm_url: `${site}/login`, discover_url: `${site}/discover`,
    campaign_url: campaign, share_url: `${site}/giving-history`,
    giving_history_url: `${site}/giving-history`, signup_url: `${site}/register`,
    reset_url: `${site}/forgot-password`, signin_url: `${site}/login`,
    dashboard_url: `${site}/dashboard`, application_url: `${site}/application`,
    invite_url: `${site}/team-invitation`, create_post_url: `${site}/dashboard?tab=posts`,
    payouts_url: `${site}/dashboard?tab=profile`, admin_application_url: `${site}/admin`,
  };
  // Password resets are sent exclusively by Firebase Auth's configured SMTP.
  const messages = mail.emailManifest.filter(entry => entry.id !== "06-password-reset").map(entry => {
    const values = { ...input.values, ...links, preferences_url: mail.emailPreferencesLink(to, entry.id.startsWith("12-")) };
    const required = Object.fromEntries(entry.variables.filter(key => !["logo_url", "site_url"].includes(key)).map(key => {
      if (typeof values[key] !== "string") throw new Error(`Missing sample variable: ${key}`);
      return [key, values[key]];
    }));
    return mail.renderEmail(entry.id, required);
  });
  const minor = value => {
    if (typeof value !== "string" || !/^£[0-9,]+\.[0-9]{2}$/.test(value)) throw new Error("Use the supplied GBP sample amounts.");
    return Math.round(Number(value.replace(/[£,]/g, "")) * 100);
  };
  const daily = mail.renderDailySummary({
    firstName: input.values.first_name, orgName: input.values.org_name,
    campaignName: input.values.campaign_name, currency: "gbp",
    raisedMinor: minor(input.values.campaign_raised), goalMinor: minor(input.values.goal_amount),
    dashboardUrl: links.dashboard_url, preferencesUrl: mail.emailPreferencesLink(to, true),
    gifts: input.dailyGifts,
  });
  if (!daily) throw new Error("The sample summary needs at least one gift.");
  messages.push(daily);
  const states = [];
  const send = process.argv.includes("--send");
  if (send && input.testConsent !== true) throw new Error("Explicit sample-email consent is required.");
  for (const message of messages) {
    let state = "preview";
    if (send) {
      const job = await mail.enqueueEmail(mail.firestoreEmailStore, {
        eventKey: `template-proof-2026-11-23:${message.templateId}`, to, message,
      });
      // The recipient explicitly requested this sample batch. This exception
      // never changes saved preferences and is not exposed by an app endpoint.
      state = await mail.deliverEmail(mail.firestoreEmailStore, mail.brevoEmailTransport, job.id, async () => true);
    }
    states.push({ template: message.templateId, state });
  }
  console.log(JSON.stringify({ count: states.length, states }));
} catch {
  console.error("Email sample run failed. Check template validation and private delivery history; no recipient data was logged.");
  process.exitCode = 1;
}
