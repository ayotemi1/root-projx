import { SaveCampaignDraftBody } from "@workspace/api-zod";

const FIELDS_ERROR = "Check the Story character limits and box counts, and the Look choices, then try saving again.";

/** Do not silently discard unknown fields such as totals or team permissions. */
function sameKeys(raw: unknown, parsed: unknown) {
  if (Array.isArray(raw)) {
    raw.forEach((v, i) => sameKeys(v, (parsed as unknown[])[i]));
  } else if (raw && typeof raw === "object") {
    if (!parsed || typeof parsed !== "object") throw new Error(FIELDS_ERROR);
    for (const [key, value] of Object.entries(raw)) {
      if (!Object.hasOwn(parsed, key)) throw new Error(FIELDS_ERROR);
      sameKeys(value, (parsed as Record<string, unknown>)[key]);
    }
  } else if (typeof raw === "string" && /<\/?[a-z][^>]*>/i.test(raw)) {
    throw new Error("Use plain text, without HTML, in your campaign Story.");
  }
}

/** Campaign-specific editorial copy is never an organisation membership list. */
export function campaignPageDesign(raw: unknown) {
  if (raw === undefined) throw new Error(FIELDS_ERROR);
  const result = SaveCampaignDraftBody.shape.pageDesign.safeParse(raw);
  if (!result.success) throw new Error(FIELDS_ERROR);
  sameKeys(raw, result.data);
  const design = result.data;
  if (!design) return null;
  if (design.order && new Set(design.order).size !== 6) throw new Error("Include each movable section once in Look.");
  for (const rows of [design.programme?.boxes, design.outcomes?.boxes, design.team?.people]) {
    if (rows && new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("Each box or person needs its own entry. Please reload and try again.");
  }
  for (const person of design.team?.people ?? []) {
    if (!person.photoUrl) continue;
    let url: URL;
    try { url = new URL(person.photoUrl, "https://rootprojx.invalid"); }
    catch { throw new Error("Use an uploaded or valid photo for each person."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      (url.origin === "https://rootprojx.invalid" && !person.photoUrl.startsWith("/api/"))) {
      throw new Error("Use an uploaded or valid photo for each person.");
    }
  }
  return design;
}

/** Count actual narrative, including new structured sections, not placeholder copy. */
export function campaignStoryLength(c: Record<string, any>): number {
  const d = c.pageDesign;
  const legacy = typeof c.description === "string" ? c.description : "";
  if (!(d && (d.need || d.programme || d.outcomes || d.team || d.money || d.wall))) return legacy.trim().length;
  const paras = legacy.trim().split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  let length = (d.need ? paras.slice(1) : paras).join("\n\n").length;
  for (const key of ["need", "programme", "outcomes"] as const) {
    const section = d?.[key];
    if (section) length += (section.intro ?? "").trim().length +
      (section.boxes ?? []).reduce((sum: number, b: any) => sum + (b.text ?? "").trim().length, 0);
  }
  return length;
}
