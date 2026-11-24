import manifest from "./templates/index.json" with { type: "json" };
import html01 from "./templates/01-supporter-confirm-email.html";
import html02 from "./templates/02-supporter-welcome.html";
import html03 from "./templates/03-donation-receipt.html";
import html04 from "./templates/04-donation-receipt-guest.html";
import html05 from "./templates/05-supporter-campaign-goal-reached.html";
import html06 from "./templates/06-password-reset.html";
import html07 from "./templates/07-org-application-received.html";
import html08 from "./templates/08-org-application-approved.html";
import html09 from "./templates/09-org-application-declined.html";
import html10 from "./templates/10-org-application-more-info.html";
import html11 from "./templates/11-org-team-invite.html";
import html12 from "./templates/12-org-new-donation.html";
import html13 from "./templates/13-org-campaign-live.html";
import html14 from "./templates/14-org-campaign-goal-reached.html";
import html15 from "./templates/15-org-payout-sent.html";
import html16 from "./templates/16-admin-new-application.html";

export const EMAIL_SITE_URL = "https://rootprojx.com";
// Exact supplied PNG, verified on the existing production image proxy. Its
// immutable public object works before the next web build is published.
export const EMAIL_LOGO_URL = `${EMAIL_SITE_URL}/api/uploads/object/org-profiles/rootprojx/email/logo-df9e81dee4f1959bebd7a6b7b3917f806ebcae7ae5e4a1945a2d3ac78b876b1b.png`;
export const emailSources = {
  "01-supporter-confirm-email": html01,
  "02-supporter-welcome": html02,
  "03-donation-receipt": html03,
  "04-donation-receipt-guest": html04,
  "05-supporter-campaign-goal-reached": html05,
  "06-password-reset": html06,
  "07-org-application-received": html07,
  "08-org-application-approved": html08,
  "09-org-application-declined": html09,
  "10-org-application-more-info": html10,
  "11-org-team-invite": html11,
  "12-org-new-donation": html12,
  "13-org-campaign-live": html13,
  "14-org-campaign-goal-reached": html14,
  "15-org-payout-sent": html15,
  "16-admin-new-application": html16,
} as const;

export type EmailTemplateId = keyof typeof emailSources;
export type EmailVariables = Record<string, string>;
export interface RenderedEmail {
  templateId: EmailTemplateId | "12-org-daily-summary" | "operational-donation";
  subject: string;
  preheader: string;
  htmlContent: string;
  textContent: string;
}
export const emailManifest = manifest as readonly {
  id: EmailTemplateId; subject: string; preheader: string; variables: string[];
}[];

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function decodeEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === "#") {
      const n = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "→",
      middot: "·", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", pound: "£" } as Record<string, string>)[entity] ?? whole;
  });
}

export function emailPlainText(html: string): string {
  return decodeEntities(html
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<div\b[^>]*style="display:none[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => `${label} (${href})`)
    .replace(/<\/t[dh]>/gi, "\t").replace(/<\/tr>|<\/p>|<\/h[1-6]>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim());
}

function variablesFor(keys: readonly string[], input: EmailVariables): EmailVariables {
  const values: EmailVariables = { ...input, site_url: EMAIL_SITE_URL, logo_url: EMAIL_LOGO_URL };
  if (Object.keys(input).some(key => !keys.includes(key)) ||
      (input.site_url !== undefined && input.site_url !== EMAIL_SITE_URL) ||
      (input.logo_url !== undefined && input.logo_url !== EMAIL_LOGO_URL)) {
    throw new Error("Unsupported email variable or origin.");
  }
  for (const key of keys) {
    if (typeof values[key] !== "string" || values[key].length > 10_000 ||
        (!values[key].trim() && key !== "impact_line")) throw new Error(`Missing or invalid email variable: ${key}`);
    if (key.endsWith("_url")) {
      let url: URL;
      try { url = new URL(values[key]); } catch { throw new Error(`Invalid HTTPS email link: ${key}`); }
      if (url.protocol !== "https:" || url.username || url.password || /[\s\u0000-\u001f]/u.test(values[key])) {
        throw new Error(`Invalid HTTPS email link: ${key}`);
      }
    }
  }
  return values;
}

// Replacement is single-pass: donor-supplied {{tokens}} are text, not executable
// template syntax. No caller-controlled unescaped HTML interpolation is exposed.
function fill(source: string, values: EmailVariables, html: boolean): string {
  return source.replace(/\{\{([a-z][a-z0-9_]+)\}\}/g, (_all, key: string) => {
    if (values[key] === undefined) throw new Error(`Unknown email placeholder: ${key}`);
    return html ? escapeEmailHtml(values[key]) : values[key];
  });
}

export function renderEmail(templateId: EmailTemplateId, input: EmailVariables): RenderedEmail {
  const entry = emailManifest.find(row => row.id === templateId);
  if (!entry || !Object.hasOwn(emailSources, templateId)) throw new Error("Unknown email template.");
  const values = variablesFor(entry.variables, input);
  const htmlContent = fill(emailSources[templateId], values, true);
  return {
    templateId,
    subject: fill(entry.subject, values, false).replace(/[\r\n]+/g, " "),
    preheader: fill(entry.preheader, values, false).replace(/[\r\n]+/g, " "),
    htmlContent, textContent: emailPlainText(htmlContent),
  };
}

/** Approved exception: omit an inapplicable financial row, never replace the
 * supplied wording or edit the source HTML. Omission names are server-owned. */
export function renderFinancialEmail(
  templateId: "03-donation-receipt" | "04-donation-receipt-guest" | "12-org-new-donation" | "15-org-payout-sent",
  input: EmailVariables, omitRows: readonly string[] = [],
): RenderedEmail {
  const allowed: Record<typeof templateId, readonly string[]> = {
    "03-donation-receipt": ["card_fee", "card_last4"],
    "04-donation-receipt-guest": ["card_fee", "card_last4"],
    "12-org-new-donation": ["campaign_raised"],
    "15-org-payout-sent": ["account_last4", "arrival_date", "period_start"],
  };
  if (omitRows.some(key => !allowed[templateId].includes(key))) throw new Error("Unsupported financial email omission.");
  const entry = emailManifest.find(row => row.id === templateId)!;
  if (Object.keys(input).some(key => !entry.variables.includes(key))) throw new Error("Unsupported financial email variable.");
  let source = emailSources[templateId], preheader = entry.preheader;
  for (const key of new Set(omitRows)) {
    let removed = 0;
    source = source.replace(/<tr\b(?:(?!<tr\b)[\s\S])*?<\/tr>/g, row => {
      if (!row.includes(`{{${key}}}`)) return row;
      removed++; return "";
    });
    if (removed !== 1) throw new Error("Financial row changed; review the supplied template.");
    if (preheader.includes(`{{${key}}}`)) {
      source = source.replace(/<div\b[^>]*>[^<]*?<\/div>/, div => div.includes(`{{${key}}}`) ? "" : div);
      preheader = "";
    }
  }
  const required = [...new Set([...`${source} ${entry.subject} ${preheader}`.matchAll(/\{\{([a-z][a-z0-9_]+)\}\}/g)].map(match => match[1]!))];
  const values = variablesFor(required, Object.fromEntries(Object.entries(input).filter(([key]) => required.includes(key))));
  const htmlContent = fill(source, values, true);
  return {
    templateId, subject: fill(entry.subject, values, false).replace(/[\r\n]+/g, " "),
    preheader: fill(preheader, values, false).replace(/[\r\n]+/g, " "),
    htmlContent, textContent: emailPlainText(htmlContent),
  };
}

export function emailMoney(minorUnits: number, currency: "gbp" | "usd"): string {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0 || !["gbp", "usd"].includes(currency)) {
    throw new Error("Invalid email currency or amount.");
  }
  return `${currency === "usd" ? "US$" : "£"}${(minorUnits / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

export interface DailyGift {
  /** Only the saved, checkout-consented public display name, never contact data. */
  publicDonorName: string | null;
  giftMinor: number;
  orgReceivesMinor: number;
}
export interface DailySummary {
  firstName: string; orgName: string; campaignName: string;
  currency: "gbp" | "usd"; raisedMinor: number; goalMinor: number;
  hasCampaignTarget?: boolean;
  dashboardUrl: string; preferencesUrl: string; gifts: readonly DailyGift[];
}

export function renderDailySummary(input: DailySummary): RenderedEmail | null {
  if (!input.gifts.length) return null;
  const money = (n: number) => emailMoney(n, input.currency);
  let total = 0;
  const td = `padding:8px 18px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;`;
  const row = (label: string, amount: string, bold = false) =>
    `<tr><td style="${td}color:${bold ? "#17100F;font-weight:700" : "#5A4F4B"};">${escapeEmailHtml(label)}</td>` +
    `<td align="right" style="${td}color:#17100F;font-weight:${bold ? "700" : "600"}">${escapeEmailHtml(amount)}</td></tr>`;
  const giftRows = input.gifts.map(gift => {
    money(gift.orgReceivesMinor);
    total += gift.orgReceivesMinor;
    return row(gift.publicDonorName?.trim() || "Anonymous", money(gift.giftMinor));
  }).join("") + row("You'll receive", money(total), true) +
    (input.hasCampaignTarget === false ? "" : row("Campaign total", `${money(input.raisedMinor)} of ${money(input.goalMinor)}`));
  const original = emailSources["12-org-new-donation"];
  const headingEnd = original.indexOf("</tr>", original.indexOf(">Gift details</td>")) + 5;
  const rowsEnd = original.indexOf('<tr><td colspan="2" style="height:8px', headingEnd);
  if (headingEnd < 5 || rowsEnd < headingEnd) throw new Error("Daily-summary source changed; review template 12.");
  // A separate derivative. The original 16 HTML files are byte-for-byte intact.
  let source = (original.slice(0, headingEnd) + "{{gift_rows}}" + original.slice(rowsEnd))
    .replaceAll("New gift to {{campaign_name}}: {{gift_amount}}", "Today's gifts to {{campaign_name}}")
    .replace("{{donor_display_name}} just gave to {{campaign_name}}.", "Today's gifts to {{campaign_name}}.")
    .replace(">New gift</div>", ">Daily summary</div>")
    .replace("{{donor_display_name}} just gave {{gift_amount}}", "Today's gifts to {{campaign_name}}")
    .replace("A new gift has come in for", "Today's gifts for");
  const values = variablesFor([
    "first_name", "org_name", "campaign_name", "dashboard_url", "preferences_url", "site_url", "logo_url",
  ], {
    first_name: input.firstName, org_name: input.orgName, campaign_name: input.campaignName,
    dashboard_url: input.dashboardUrl, preferences_url: input.preferencesUrl,
  });
  // Replace the one private renderer-owned fragment after escaping every value;
  // interpolation of arbitrary raw HTML from caller data is never allowed.
  const parts = source.split("{{gift_rows}}");
  if (parts.length !== 2) throw new Error("Invalid daily-summary placeholder.");
  source = fill(parts[0]!, values, true) + giftRows + fill(parts[1]!, values, true);
  const subject = fill("Today's gifts to {{campaign_name}}", values, false).replace(/[\r\n]+/g, " ");
  return { templateId: "12-org-daily-summary", subject, preheader: subject, htmlContent: source, textContent: emailPlainText(source) };
}
