// Public profile editing only. Financial fields and campaign arrays never pass
// through this whitelist, and saving a section never rewrites an org snapshot.
export const PROFILE_SECTORS = [
  "Education", "Health & Wellbeing", "Environment",
  "Community Development", "Arts & Culture", "Economic Empowerment", "Youth",
  "Sport & Recreation", "Housing & Homelessness", "Disaster Relief",
  "Faith & Spirituality", "Other",
];

export class ProfileValidationError extends Error {}

function fail(message: string): never { throw new ProfileValidationError(message); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`Enter valid ${label} details and try again.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") fail(`Enter ${label} as text and try again.`);
  const result = value.trim();
  if (result.length > max) fail(`Shorten ${label} to ${max} characters or fewer.`);
  return result;
}
function url(value: unknown, label: string, media = false): string {
  const result = text(value, label, 2048);
  if (!result) return result;
  if (media && result.startsWith("/api/") && !result.includes("\\")) return result;
  try {
    const parsed = new URL(result);
    if (["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password) return result;
  } catch { /* Return an actionable validation message below. */ }
  return fail(`Use a complete http:// or https:// link for ${label}.`);
}

export function profilePatch(
  input: unknown,
  existing: Record<string, unknown>,
  now = new Date().toISOString(),
): Record<string, unknown> {
  const body = object(input, "profile");
  const patch: Record<string, unknown> = {};
  const strings: Record<string, number> = {
    name: 200, country: 100, city: 120, shortDescription: 120,
    description: 20000, mission: 20000, category: 100,
  };
  for (const [key, max] of Object.entries(strings)) {
    if (!(key in body)) continue;
    if (body[key] === null && ["city", "mission"].includes(key)) { patch[key] = null; continue; }
    const value = text(body[key], key === "shortDescription" ? "your one-line description" : key, max);
    if ((key === "description" || key === "mission") && /<\/?[a-z][^>]*>/i.test(value)) {
      fail("Use plain text or Markdown for your story; remove HTML tags and try again.");
    }
    patch[key] = value;
  }
  for (const key of ["logo", "coverImage"]) {
    if (key in body) patch[key] = body[key] === null ? null : url(body[key], key, true);
  }
  if ("categories" in body) {
    if (!Array.isArray(body.categories) || body.categories.length === 0) fail("Select at least one sector and try again.");
    const values = [...new Set(body.categories)];
    if (values.some(v => typeof v !== "string" || !PROFILE_SECTORS.includes(v))) {
      fail("Choose sectors from the supplied list and try again.");
    }
    patch.categories = values;
    patch.category = values[0];
  }
  for (const [key, keys] of [
    ["contact", ["email", "phone", "website"]],
    ["socialLinks", ["instagram", "facebook", "twitter", "linkedin", "youtube", "tiktok"]],
  ] as const) {
    if (!(key in body)) continue;
    if (body[key] === null) { patch[key] = null; continue; }
    const values = object(body[key], key);
    const old = existing[key] && typeof existing[key] === "object" && !Array.isArray(existing[key])
      ? existing[key] as Record<string, unknown> : {};
    // Preserve old platform-specific link keys, but never accept new arbitrary
    // nested fields (in particular, this isn't a way to add banking details).
    if (Object.keys(values).some(k => !(keys as readonly string[]).includes(k) && values[k] !== old[k])) fail(`Use only the listed ${key} fields.`);
    const result: Record<string, unknown> = { ...old };
    for (const [k, value] of Object.entries(values)) {
      if (!(keys as readonly string[]).includes(k)) continue;
      result[k] = ["email", "phone"].includes(k) ? text(value, k, 254) : url(value, k);
      if (k === "email" && result[k] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(result[k]))) fail("Enter a valid contact email and try again.");
    }
    patch[key] = result;
  }
  if ("impactMetrics" in body) {
    if (body.impactMetrics === null) patch.impactMetrics = null;
    else {
      const metrics = object(body.impactMetrics, "impact metrics");
      const keys = ["peopleReached", "groundCovered", "resourcesDelivered"];
      if (Object.keys(metrics).some(key => !keys.includes(key))) fail("Use the three editable impact categories; campaign progress is calculated automatically.");
      const previous = (existing.impactMetrics ?? {}) as Record<string, Record<string, unknown>>;
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (!(key in metrics)) continue;
        const metric = object(metrics[key], key);
        const label = text(metric.label, "the metric label", 100);
        if (!label) fail("Give each impact number a label, or remove the empty metric.");
        if (typeof metric.value !== "number" || !Number.isFinite(metric.value) || metric.value < 0) fail("Enter an impact value of zero or greater and try again.");
        const old = previous[key];
        result[key] = {
          label, value: metric.value,
          updatedAt: old?.label === label && old?.value === metric.value && typeof old.updatedAt === "string" ? old.updatedAt : now,
        };
      }
      patch.impactMetrics = result;
    }
  }
  if ("team" in body) {
    if (!Array.isArray(body.team) || body.team.length > 6) fail("Add up to six team members and try again.");
    patch.team = body.team.map(value => {
      const person = object(value, "team member");
      const name = text(person.name, "the team member's name", 100);
      const role = text(person.role, "the team member's role", 120);
      const photoUrl = url(person.photoUrl, "the team member's photo", true);
      if (!name || !role || !photoUrl) fail("Add a name, role and photo for each team member, or remove the unfinished member.");
      return { name, role, photoUrl };
    });
  }
  if ("fundsUsage" in body) {
    if (body.fundsUsage === null) patch.fundsUsage = null;
    else {
      const values = object(body.fundsUsage, "funds usage");
      const result: Record<string, number> = {};
      for (const key of ["operations", "materials", "staff", "events", "other"]) {
        const value = values[key];
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) fail("Enter whole-number percentages between 0 and 100 for all five funds categories.");
        result[key] = value;
      }
      if (Object.values(result).reduce((a, b) => a + b, 0) !== 100) fail("Adjust your funds percentages so they add up to 100.");
      patch.fundsUsage = result;
    }
  }
  return patch;
}
