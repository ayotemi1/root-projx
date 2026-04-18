// Brevo (formerly Sendinblue) API v3 helper
// Uses BREVO_API_KEY secret — never hardcoded

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
  /** Sender name — defaults to "Root ProjX" */
  senderName?: string;
  /** Sender email — defaults to BREVO_SENDER_EMAIL or noreply@rootprojx.com */
  senderEmail?: string;
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

  const senderEmail =
    email.senderEmail ??
    process.env.BREVO_SENDER_EMAIL ??
    "noreply@rootprojx.com";

  const body = {
    sender: { name: email.senderName ?? "Root ProjX", email: senderEmail },
    to: email.to,
    subject: email.subject,
    htmlContent: email.htmlContent,
    ...(email.replyTo ? { replyTo: email.replyTo } : {}),
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
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Welcome, ${escapeHtml(name)}!</h2>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            You've joined a growing community of diaspora supporters connecting with verified grassroots organisations in Jamaica, the UK, and beyond.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Here's what you can do on Root ProjX:
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="padding:6px 0;color:#444;font-size:14px;">✅ &nbsp;Discover and follow verified organisations</td></tr>
            <tr><td style="padding:6px 0;color:#444;font-size:14px;">💸 &nbsp;Make one-time or monthly donations</td></tr>
            <tr><td style="padding:6px 0;color:#444;font-size:14px;">📰 &nbsp;See real-time impact updates in your feed</td></tr>
            <tr><td style="padding:6px 0;color:#444;font-size:14px;">🆘 &nbsp;Browse the Get Help directory</td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="https://rootprojx.com/discover" style="display:inline-block;background:#8B0000;color:#FFD700;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:6px;">
              Explore Organisations →
            </a>
          </td></tr></table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">
            You received this email because you registered on Root ProjX.<br>
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

export function donationConfirmationHtml(opts: {
  name: string;
  orgName: string;
  amountGbp: number;
  type: string;
  donationDate: string;
}): string {
  const { name, orgName, amountGbp, type, donationDate } = opts;
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
                  <td style="font-size:13px;color:#888;padding-bottom:8px;">Amount</td>
                  <td style="font-size:14px;color:#1a1a1a;font-weight:700;text-align:right;padding-bottom:8px;">£${amountGbp.toFixed(2)}${isRecurring ? " / month" : ""}</td>
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
