// Brevo (formerly Sendinblue) API v3 helper
// Uses BREVO_API_KEY secret — never hardcoded
import { donationDisclosure, type DonationAccounting } from "./donation-accounting.ts";
import { ROOT_EMAIL_IDENTITY } from "./email-identity.ts";

const BREVO_BASE = "https://api.brevo.com/v3";

function headers(): Record<string, string> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY is not configured");
  return {
    "api-key": key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrevoContact {
  email: string;
  firstName?: string;
  lastName?: string;
  /** Brevo list IDs to add this contact to (optional) */
  listIds?: number[];
  /** Whether to update the contact if they already exist (default true) */
  updateEnabled?: boolean;
}

export interface BrevoEmailRecipient {
  email: string;
  name?: string;
}

export interface BrevoTransactionalEmail {
  to: BrevoEmailRecipient[];
  subject: string;
  htmlContent: string;
  /** @deprecated All mail uses the fixed Root ProjX identity. */
  senderName?: string;
  /** @deprecated All mail uses info@rootprojx.com. */
  senderEmail?: string;
  /** @deprecated Replies always go to info@rootprojx.com. */
  replyTo?: BrevoEmailRecipient;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Upsert a contact in Brevo.
 * Silently no-ops if BREVO_API_KEY is not set (dev without key).
 */
export async function brevoAddContact(contact: BrevoContact): Promise<void> {
  if (!process.env.BREVO_API_KEY) return;

  const body: Record<string, unknown> = {
    email: contact.email,
    updateEnabled: contact.updateEnabled ?? true,
    attributes: {
      ...(contact.firstName ? { FIRSTNAME: contact.firstName } : {}),
      ...(contact.lastName ? { LASTNAME: contact.lastName } : {}),
    },
  };

  if (contact.listIds?.length) {
    body.listIds = contact.listIds;
  }

  const res = await fetch(`${BREVO_BASE}/contacts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    // 400 with "Contact already exist" is acceptable when updateEnabled=false
    if (!text.includes("Contact already exist")) {
      throw new Error(`Brevo addContact failed ${res.status}: ${text}`);
    }
  }
}

/**
 * Send a transactional email via Brevo.
 * Silently no-ops if BREVO_API_KEY is not set.
 */
export async function brevoSendEmail(email: BrevoTransactionalEmail): Promise<void> {
  if (!process.env.BREVO_API_KEY) return;

  const body = {
    sender: ROOT_EMAIL_IDENTITY,
    replyTo: ROOT_EMAIL_IDENTITY,
    to: email.to,
    subject: email.subject,
    htmlContent: email.htmlContent,
  };

  const res = await fetch(`${BREVO_BASE}/smtp/email`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo sendEmail failed ${res.status}: ${text}`);
  }
}

// ── Pre-built email templates ─────────────────────────────────────────────────

/** Strict, privacy-safe transport for the event outbox. Legacy callers remain
 * unchanged until their corresponding event is migrated, avoiding double sends.
 * Acceptance is not delivery; no recipient or provider response is logged. */
export async function brevoSendRecordedEmail(email: {
  to: [BrevoEmailRecipient]; subject: string; htmlContent: string; textContent: string;
}): Promise<{ messageId: string }> {
  const response = await fetch(`${BREVO_BASE}/smtp/email`, {
    method: "POST", headers: headers(), signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      ...email,
      sender: ROOT_EMAIL_IDENTITY,
      replyTo: ROOT_EMAIL_IDENTITY,
    }),
  });
  if (!response.ok) {
    // Discard error payloads: they can contain recipients, credentials or IPs.
    await response.body?.cancel();
    throw Object.assign(new Error("Brevo rejected the email request."), { brevoStatus: response.status });
  }
  const result: unknown = await response.json();
  const messageId = result && typeof result === "object" && "messageId" in result ? result.messageId : null;
  if (typeof messageId !== "string" || !messageId) throw new Error("Brevo acceptance is uncertain.");
  return { messageId };
}

export function welcomeEmailHtml(name: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
        <!-- Header -->
        <tr><td style="background:#8B0000;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#FFD700;font-size:28px;font-weight:900;letter-spacing:-0.5px;">Root ProjX</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Community Giving Platform</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Welcome to Root ProjX, ${escapeHtml(name)}!</h2>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            You're now part of a community connecting directly with verified grassroots organisations doing real work on the ground — starting in Jamaica.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
            You can explore organisations, see exactly where support goes, and start giving directly and transparently.
          </p>
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="https://rootprojx.com/discover" style="display:inline-block;background:#8B0000;color:#FFD700;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:6px;">
              Explore Organisations →
            </a>
          </td></tr></table>
          <p style="color:#666;font-size:14px;line-height:1.6;margin:32px 0 0;">
            Thanks for being part of this,<br>
            <strong>The Root ProjX Team</strong>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">
            &copy; ${new Date().getFullYear()} Root ProjX · <a href="https://rootprojx.com" style="color:#8B0000;">rootprojx.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`.trim();
}

/** Organisation/team alert. Monetary values come only from recorded accounting. */
export function donationReceivedHtml(opts: {
  orgName: string;
  campaignName?: string;
  donorName?: string | null;
  accounting: DonationAccounting;
  currency: "gbp" | "usd";
  recurring: boolean;
  reference: string;
  donationDate: string;
  platformFeePercent: number;
}): string {
  const money = (value: number) => `${opts.currency === "usd" ? "US$" : "£"}${value.toFixed(2)}`;
  const rows = [
    ["Organisation", opts.orgName],
    ...(opts.campaignName ? [["Campaign", opts.campaignName]] : []),
    ["Donor", opts.donorName || "Anonymous supporter"],
    ["Donation", money(opts.accounting.intendedGbp)],
    ...(opts.accounting.feeCovered ? [["Card-fee cover", money(opts.accounting.feeCoverGbp)]] : []),
    ["Total charged", money(opts.accounting.chargedGbp)],
    ["Root ProjX platform fee", `${money(opts.accounting.platformFeeGbp)} (${opts.platformFeePercent}%)`],
    ...(!opts.accounting.feeCovered ? [["Estimated card processing", money(opts.accounting.estimatedStripeFeeGbp)]] : []),
    ["Estimated organisation proceeds", money(opts.accounting.toOrgGbp)],
    ["Payment", opts.recurring ? "Monthly donation payment" : "One-off donation"],
    ["Date", opts.donationDate],
    ["Payment reference", opts.reference],
  ];
  return `<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;">
    <h1>New donation received</h1>
    <p>A successful donation to ${escapeHtml(opts.orgName)} has been recorded.</p>
    <table>${rows.map(([label, value]) => `<tr><th style="text-align:left;padding:8px;">${escapeHtml(label!)}</th><td style="padding:8px;">${escapeHtml(value!)}</td></tr>`).join("")}</table>
    <p>Organisation proceeds are estimated after fees. This notification does not mean a bank payout has been sent.</p>
    </body></html>`;
}

export function donationConfirmationHtml(opts: {
  name: string;
  orgName: string;
  accounting: DonationAccounting;
  currency?: "gbp" | "usd";
  type: string;
  donationDate: string;
  platformFeePercent?: number;
}): string {
  const { name, orgName, accounting, type, donationDate, platformFeePercent = 5 } = opts;
  const disclosure = donationDisclosure(accounting, orgName, platformFeePercent, opts.currency);
  const isRecurring = type === "recurring";
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#8B0000;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#FFD700;font-size:28px;font-weight:900;">Root ProjX</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Donation Confirmation</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;width:64px;height:64px;background:#D1FAE5;border-radius:50%;line-height:64px;font-size:30px;text-align:center;">✓</div>
          </div>
          <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 12px;text-align:center;">Thank you, ${escapeHtml(name)}!</h2>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;text-align:center;">
            Your ${isRecurring ? "monthly " : ""}donation was successfully processed.
          </p>
          <!-- Receipt box -->
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;margin:0 0 24px;">
            <tr><td style="padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#888;padding-bottom:8px;">Organisation</td>
                  <td style="font-size:14px;color:#1a1a1a;font-weight:700;text-align:right;padding-bottom:8px;">${escapeHtml(orgName)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size:14px;color:#1a1a1a;font-weight:700;padding-bottom:8px;">${escapeHtml(disclosure.donationLine)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size:13px;color:#444;padding-bottom:8px;">${escapeHtml(disclosure.orgLine)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size:12px;color:#888;padding-bottom:8px;">Card processing fees are estimated; actual fees may vary by card type.</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#888;padding-bottom:8px;">Type</td>
                  <td style="font-size:14px;color:#1a1a1a;text-align:right;padding-bottom:8px;">${isRecurring ? "Monthly Recurring" : "One-time"}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#888;">Date</td>
                  <td style="font-size:14px;color:#1a1a1a;text-align:right;">${donationDate}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px;">
            You now follow <strong>${escapeHtml(orgName)}</strong> and will see their impact updates in your feed.
            ${isRecurring ? "You can manage your recurring donation from your account settings." : ""}
          </p>
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="https://rootprojx.com/account" style="display:inline-block;background:#8B0000;color:#FFD700;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:6px;">
              View My Donations →
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">
            &copy; ${new Date().getFullYear()} Root ProjX · <a href="https://rootprojx.com" style="color:#8B0000;">rootprojx.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`.trim();
}

// ── Org application emails ─────────────────────────────────────────────────────

export function orgApplicationReceivedHtml(opts: { orgName: string; contactName: string }): string {
  const { orgName, contactName } = opts;
  return `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#7A0000;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#F5B800;font-size:28px;font-weight:900;">Root ProjX</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Application Received</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Hi ${escapeHtml(contactName)},</h2>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Thank you for applying to join Root ProjX as a founding partner organisation.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            We've received your application for <strong>${escapeHtml(orgName)}</strong> and our team will now review it. This helps us make sure every organisation on the platform is verified and ready to receive support directly from our diaspora community.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Your login account has been created. You can sign in while you wait, but organisation tools will remain locked until your application is approved.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 32px;">
            We'll be in touch soon with an update. In the meantime, if you have any questions, just reply to this email.
          </p>
          <p style="color:#666;font-size:14px;line-height:1.6;margin:0;">
            Thank you for the work you do,<br>
            <strong>The Root ProjX Team</strong>
          </p>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} Root ProjX · <a href="https://rootprojx.com" style="color:#8B0000;">rootprojx.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

export function orgAcceptedHtml(opts: {
  orgName: string;
  contactName: string;
  email: string;
  passwordSetupRequired?: boolean;
}): string {
  const { orgName, contactName, email, passwordSetupRequired = false } = opts;
  return `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#7A0000;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#F5B800;font-size:28px;font-weight:900;">Root ProjX</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Welcome aboard</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Hi ${escapeHtml(contactName)},</h2>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Good news — <strong>${escapeHtml(orgName)}</strong> has been approved and your profile is now live on Root ProjX.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
            You now have access to your organisation's profile, where you can share updates on your work, receive donations directly from supporters, and give our diaspora community full visibility into the impact of their support. This is the start of a direct, transparent connection between your work and the people who want to support it.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
             ${passwordSetupRequired
               ? `We have sent a separate password setup email to <strong>${escapeHtml(email)}</strong>. Set your password there, then sign in.`
               : `Sign in with <strong>${escapeHtml(email)}</strong> and the password you created when applying.`}
          </p>
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="https://rootprojx.com/login" style="display:inline-block;background:#B50000;color:#F5B800;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:6px;">
              Sign In to Your Dashboard →
            </a>
          </td></tr></table>
          <p style="color:#666;font-size:14px;line-height:1.6;margin:32px 0 0;">
            If you need any help getting started, we're here.<br><br>
            Welcome aboard,<br>
            <strong>The Root ProjX Team</strong>
          </p>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} Root ProjX · <a href="https://rootprojx.com" style="color:#8B0000;">rootprojx.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

export function orgDeclinedHtml(opts: { orgName: string; contactName: string; reason?: string }): string {
  const { orgName, contactName, reason } = opts;
  return `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#7A0000;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#F5B800;font-size:28px;font-weight:900;">Root ProjX</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Application Update</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Hi ${escapeHtml(contactName)},</h2>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Thank you for taking the time to apply to Root ProjX and for sharing more about <strong>${escapeHtml(orgName)}</strong>'s work.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            After review, we're not able to move forward with onboarding your organisation as a founding partner at this time.${reason ? ` ${escapeHtml(reason)}` : ""}
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 32px;">
            We'd welcome the chance to revisit this in future as the platform grows, and we're grateful for the work you do.
          </p>
          <p style="color:#666;font-size:14px;line-height:1.6;margin:0;">
            Warmly,<br>
            <strong>The Root ProjX Team</strong>
          </p>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} Root ProjX · <a href="https://rootprojx.com" style="color:#8B0000;">rootprojx.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

export function internalNotificationHtml(opts: {
  type: "org_application" | "supporter_signup";
  name: string;
  email: string;
  orgName?: string;
  sectors?: string[];
  website?: string | null;
  socialLinks?: {
    instagram?: string | null;
    facebook?: string | null;
    twitter?: string | null;
    linkedin?: string | null;
  } | null;
}): string {
  const { type, name, email, orgName, sectors, website, socialLinks } = opts;
  const isOrg = type === "org_application";
  const entityType = isOrg ? "organisation" : "supporter";
  const displayName = isOrg ? (orgName ?? name) : name;

  // Build social links rows for org applications
  const socialRows: string[] = [];
  if (website) {
    socialRows.push(`<a href="${escapeHtml(website)}" style="color:#B50000;">${escapeHtml(website)}</a>`);
  }
  if (socialLinks?.instagram) socialRows.push(`Instagram: <a href="https://instagram.com/${escapeHtml(socialLinks.instagram)}" style="color:#B50000;">@${escapeHtml(socialLinks.instagram)}</a>`);
  if (socialLinks?.facebook) socialRows.push(`Facebook: <a href="https://facebook.com/${escapeHtml(socialLinks.facebook)}" style="color:#B50000;">facebook.com/${escapeHtml(socialLinks.facebook)}</a>`);
  if (socialLinks?.twitter) socialRows.push(`X/Twitter: <a href="https://x.com/${escapeHtml(socialLinks.twitter)}" style="color:#B50000;">@${escapeHtml(socialLinks.twitter)}</a>`);
  if (socialLinks?.linkedin) socialRows.push(`LinkedIn: <a href="https://linkedin.com/company/${escapeHtml(socialLinks.linkedin)}" style="color:#B50000;">linkedin.com/company/${escapeHtml(socialLinks.linkedin)}</a>`);

  return `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#1a1a1a;padding:20px 40px;">
          <p style="margin:0;color:#F5B800;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Root ProjX · Internal</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 8px;">New ${escapeHtml(entityType)} sign-up: ${escapeHtml(displayName)}</h2>
          <p style="color:#444;font-size:15px;margin:0 0 24px;">
            Hi team,<br><br>
            <strong>${escapeHtml(name)}</strong> has just signed up as a ${escapeHtml(entityType)}.
            ${isOrg ? "Their application is now pending review." : "They now have full access."}
          </p>
          <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E0D8CC;border-radius:6px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid #E0D8CC;">
              <p style="margin:0;font-size:13px;color:#888;">Contact name</p>
              <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:600;">${escapeHtml(name)}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #E0D8CC;">
              <p style="margin:0;font-size:13px;color:#888;">Email</p>
              <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;">${escapeHtml(email)}</p>
            </td></tr>
            ${isOrg ? `
            <tr><td style="padding:16px 20px;border-bottom:1px solid #E0D8CC;">
              <p style="margin:0;font-size:13px;color:#888;">Organisation</p>
              <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:600;">${escapeHtml(orgName ?? "")}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;${socialRows.length ? "border-bottom:1px solid #E0D8CC;" : ""}">
              <p style="margin:0;font-size:13px;color:#888;">Sectors</p>
              <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;">${(sectors ?? []).map(s => escapeHtml(s)).join(", ") || "—"}</p>
            </td></tr>
            ${socialRows.length ? `
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;font-size:13px;color:#888;">Online presence</p>
              <p style="margin:4px 0 0;font-size:14px;color:#1a1a1a;line-height:1.8;">${socialRows.join("<br>")}</p>
            </td></tr>` : ""}` : `
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;font-size:13px;color:#888;">Type</p>
              <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;">Supporter</p>
            </td></tr>`}
          </table>
          ${isOrg ? `<p style="margin:20px 0 0;font-size:14px;color:#444;">— Automated notification · <a href="https://rootprojx.com/admin" style="color:#B50000;">Review in admin dashboard</a></p>` : `<p style="margin:20px 0 0;font-size:14px;color:#888;">— Automated notification</p>`}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

export function shopOrderConfirmationHtml(opts: {
  name: string;
  items: Array<{ name: string; qty: number; size: string }>;
  totalGbp: number;
  orderDate: string;
}): string {
  const { name, items, totalGbp, orderDate } = opts;
  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#1a1a1a;">
        ${escapeHtml(item.name)}${item.size && item.size !== "One Size" ? ` <span style="color:#888;font-size:13px;">(${escapeHtml(item.size)})</span>` : ""}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#888;text-align:center;">×${item.qty}</td>
    </tr>`).join("");

  return `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#8B0000;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#FFD700;font-size:28px;font-weight:900;">Root ProjX</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Order Confirmed</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Hi ${escapeHtml(name)},</h2>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Your order is confirmed. Thank you for supporting Root ProjX — every purchase helps us grow the platform and support grassroots organisations.
          </p>
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;margin:0 0 24px;">
            <tr><td style="padding:16px 20px 8px;">
              <p style="margin:0 0 12px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Your order · ${escapeHtml(orderDate)}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                <tr>
                  <td style="font-size:14px;font-weight:700;color:#1a1a1a;padding-top:8px;">Total</td>
                  <td style="font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;padding-top:8px;">£${totalGbp.toFixed(2)}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 24px;">
            We'll be in touch with shipping details shortly. If you have any questions, reply to this email or contact us at <a href="mailto:info@rootprojx.com" style="color:#B50000;">info@rootprojx.com</a>.
          </p>
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="https://rootprojx.com/shop" style="display:inline-block;background:#8B0000;color:#FFD700;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:6px;">
              Back to Shop →
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} Root ProjX · <a href="https://rootprojx.com" style="color:#8B0000;">rootprojx.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
