/** Structured editorial content only: progress comes from verified native USD totals. */
export interface DrumBuildUpdate {
  id: string;
  date: string;
  text: string;
  photoUrl: string | null;
  caption: string;
}
export interface DrumExperience {
  enabled: boolean;
  updates: DrumBuildUpdate[];
}

export const DRUM_COUNT = 50;
export const DRUM_COST_USD_CENTS = 15000;

export function drumsFunded(amountRaised: number, currency: string): number {
  if (currency !== "usd" || !Number.isFinite(amountRaised)) return 0;
  return Math.min(DRUM_COUNT, Math.max(0, Math.floor(Math.round(amountRaised * 100) / DRUM_COST_USD_CENTS)));
}

function plain(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max || /<\/?[a-z][^>]*>/i.test(value)) {
    throw new Error(`Drum build updates must use plain text within the displayed limits.`);
  }
  return value;
}
function photo(value: unknown): string | null {
  if (value === null || value === "") return null;
  const raw = plain(value, 2048).trim();
  // Uploaded images use the existing proxy. External images must be HTTPS.
  if (/^\/api\/uploads\/object\/[^\s\\?#]+$/.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password) return parsed.href;
  } catch { /* actionable validation below */ }
  throw new Error("Upload a build photo or use a complete https:// image link.");
}

export function parseDrumExperience(value: unknown): DrumExperience | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a valid drum display.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(k => !["enabled", "updates"].includes(k)) ||
      typeof input.enabled !== "boolean" || !Array.isArray(input.updates) || input.updates.length > 20) {
    throw new Error("Use the drum display switch and add up to 20 build updates. Drum progress cannot be edited.");
  }
  const ids = new Set<string>();
  const updates = input.updates.map((raw): DrumBuildUpdate => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Enter a valid drum build update.");
    const row = raw as Record<string, unknown>;
    if (Object.keys(row).some(k => !["id", "date", "text", "photoUrl", "caption"].includes(k))) {
      throw new Error("Drum build updates contain an unsupported field.");
    }
    const id = plain(row.id, 80);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw new Error("Each drum build update needs a unique identifier.");
    ids.add(id);
    const date = plain(row.date, 10);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) {
      throw new Error("Choose a valid calendar date for the drum build update.");
    }
    return { id, date, text: plain(row.text, 5000), photoUrl: photo(row.photoUrl), caption: plain(row.caption, 500) };
  });
  return { enabled: input.enabled, updates };
}

/** Only complete editorial rows become public. Drafts retain unfinished rows. */
export function publicDrumExperience(value: unknown, currency: unknown, type: unknown): DrumExperience | null {
  try {
    const parsed = parseDrumExperience(value);
    if (!parsed?.enabled || currency !== "usd" || type === "volunteer") return null;
    return { ...parsed, updates: parsed.updates.filter(row => row.date && (row.text.trim() || row.photoUrl)) };
  } catch {
    // Historical/malformed content never enables a misleading public counter.
    return null;
  }
}
