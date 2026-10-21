import { resolvePayoutMethod } from "./payout-setup.js";
import { PROFILE_SECTORS } from "./organisation-profile.js";

export class CampaignInputError extends Error {}
export type PublishGate = { id: string; message: string; step: number };
function invalid(message: string): never { throw new CampaignInputError(message); }
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`Enter valid ${label} details and try saving again.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string") invalid(`Enter ${label} as text.`);
  if (value.length > max) invalid(`Shorten ${label} to ${max} characters or fewer.`);
  return value;
}
function number(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e9) invalid(`Enter a valid ${label} of zero or greater.`);
  return value;
}
function url(value: unknown, label: string) {
  const result = text(value, label, 2048).trim();
  if (!result) return result;
  if (/^\/(?:api\/|campaign-units\/)/.test(result) && !result.includes("\\")) return result;
  try {
    const parsed = new URL(result);
    if (["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password) return result;
  } catch { /* actionable validation below */ }
  return invalid(`Use a complete https:// link for ${label}, or upload the file.`);
}

/** Structured content only. Financial totals, IDs and provider metadata are never editable. */
export function campaignPatch(input: unknown, previous: Record<string, unknown> = {}) {
  const body = record(input, "campaign");
  const patch: Record<string, unknown> = {};
  for (const [key, max] of Object.entries({ name: 200, tagline: 140, description: 20000 })) {
    if (!(key in body)) continue;
    const result = text(body[key], key === "description" ? "your campaign story" : key, max);
    if (/<\/?[a-z][^>]*>/i.test(result)) invalid("Remove HTML tags and use plain text or Markdown, then save again.");
    patch[key] = result;
  }
  if ("type" in body) {
    if (!["fundraising", "volunteer"].includes(String(body.type))) invalid("Choose fundraising or volunteer.");
    patch.type = body.type;
  }
  for (const key of ["goal", "volunteersNeeded"]) if (key in body) patch[key] = number(body[key], key);
  if ("deadline" in body) {
    if (body.deadline === null || body.deadline === "") patch.deadline = null;
    else {
      const value = text(body.deadline, "deadline", 40);
      if (!Number.isFinite(Date.parse(value))) invalid("Choose a valid deadline, or leave it blank.");
      patch.deadline = value;
    }
  }
  if ("imageUrl" in body) patch.imageUrl = body.imageUrl === null ? null : url(body.imageUrl, "hero image");
  if ("matchFunding" in body) {
    if (body.matchFunding === null) patch.matchFunding = null;
    else {
      const match = record(body.matchFunding, "committed funding");
      patch.matchFunding = { amount: number(match.amount, "committed amount"), funderName: text(match.funderName, "funder name", 200) };
    }
  }
  for (const key of ["breakdown", "locations"] as const) {
    if (!(key in body)) continue;
    const rows = body[key];
    if (!Array.isArray(rows) || rows.length > (key === "locations" ? 3 : 50)) invalid(`Add no more than ${key === "locations" ? 3 : 50} ${key} entries.`);
    patch[key] = rows.map(value => {
      const row = record(value, key);
      return key === "breakdown"
        ? { label: text(row.label, "item label", 200), detail: text(row.detail, "item detail", 2000) }
        : { name: text(row.name, "location name", 200), description: text(row.description, "location description", 2000),
          photoUrl: row.photoUrl == null ? "" : url(row.photoUrl, "location photo") };
    });
  }
  if ("video" in body) {
    if (body.video === null) patch.video = null;
    else {
      const video = record(body.video, "video");
      const videoUrl = url(video.url, "video");
      if (videoUrl) {
        const parsed = new URL(videoUrl, "https://rootprojx.invalid");
        if (!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com)$/.test(parsed.hostname) &&
          !parsed.pathname.startsWith("/api/uploads/object/")) invalid("Use a YouTube or Vimeo link, or upload your video.");
      }
      patch.video = { url: videoUrl, posterUrl: url(video.posterUrl ?? "", "video poster"), captionsUrl: url(video.captionsUrl ?? "", "captions") };
    }
  }
  if ("theme" in body) {
    const theme = record(body.theme, "theme");
    const old = previous.theme && typeof previous.theme === "object" ? previous.theme as Record<string, unknown> : {};
    const result = { ...old };
    for (const key of ["primaryColor", "accentColor", "backgroundColor", "textColor"]) {
      if (!(key in theme)) continue;
      if (typeof theme[key] !== "string" || !/^#[a-f0-9]{6}$/i.test(theme[key])) invalid("Choose a valid six-digit theme colour.");
      result[key] = theme[key];
    }
    if ("unit" in theme) {
      const unit = record(theme.unit, "campaign unit");
      result.unit = { singular: text(unit.singular, "singular unit label", 60), plural: text(unit.plural, "plural unit label", 60), imageUrl: url(unit.imageUrl, "unit image") };
    }
    patch.theme = result;
  }
  if ("editorStep" in body) {
    if (typeof body.editorStep !== "number" || !Number.isInteger(body.editorStep) || body.editorStep < 1 || body.editorStep > 5) invalid("Choose a campaign step from one to five.");
    patch.editorStep = body.editorStep;
  }
  if ("assistUsed" in body && body.assistUsed === true) patch.assistUsed = true;
  return patch;
}

export function campaignPublishGates(org: Record<string, unknown>, campaign: Record<string, unknown>): PublishGate[] {
  const gates: PublishGate[] = [];
  const content = (v: unknown) => typeof v === "string" ? v.trim() : "";
  if (!content(campaign.name) || !content(campaign.tagline)) gates.push({ id: "name", message: "Add a campaign name and one-line ask.", step: 1 });
  if (typeof campaign.goal !== "number" || campaign.goal <= 0) gates.push({ id: "goal", message: "Set a goal above zero.", step: 2 });
  if (content(campaign.description).length < 200) gates.push({ id: "story", message: "Write a campaign story of at least 200 characters.", step: 3 });
  if (!content(campaign.imageUrl)) gates.push({ id: "hero", message: "Upload a hero image.", step: 4 });
  const sectors = Array.isArray(org.categories) ? org.categories : [org.category];
  const short = content(org.shortDescription).length;
  if (!content(org.name) || !content(org.country) || !content(org.logo) || !content(org.coverImage) ||
      short < 20 || short > 120 || content(org.description).length < 200 ||
      !sectors.some(s => PROFILE_SECTORS.includes(String(s)))) {
    gates.push({ id: "profile", message: "Complete your organisation's identity, story and sectors in Build profile.", step: 0 });
  }
  if (resolvePayoutMethod(org) === "none") gates.push({ id: "payout", message: "Finish payout setup. Bank transfer must be approved before publishing.", step: 0 });
  const match = campaign.matchFunding as Record<string, unknown> | null;
  if (match && (!(typeof match.amount === "number" && match.amount > 0) || !content(match.funderName))) {
    gates.push({ id: "match", message: "Add the committed amount and funder, or turn committed funding off.", step: 2 });
  }
  return gates;
}

/** Private owner view: overlay unpublished edits without changing the public version. */
export function campaignForEditor(campaign: Record<string, unknown>): Record<string, unknown> {
  const { editorDraft, ...base } = campaign;
  return { ...base, ...(editorDraft && typeof editorDraft === "object" ? editorDraft : {}),
    enabled: campaign.enabled, hasUnpublishedChanges: !!editorDraft };
}
