import type { CampaignDraft } from "./model";

export type AssistOutcome =
  | { k: "suggestion"; text: string }
  | { k: "unsaved" }
  | { k: "invalid" }
  | { k: "failed"; error: unknown };

/** Save first (if given), then ask. Never calls the API when the save fails. Never edits the draft. */
export async function runAssistRequest(
  beforeRequest: (() => Promise<boolean>) | undefined,
  request: () => Promise<unknown>,
): Promise<AssistOutcome> {
  if (beforeRequest) {
    let saved = false;
    try { saved = await beforeRequest(); } catch { saved = false; }
    if (!saved) return { k: "unsaved" };
  }
  try {
    const text = (await request() as { suggestion?: unknown } | null)?.suggestion;
    return typeof text === "string" && text.trim() ? { k: "suggestion", text } : { k: "invalid" };
  } catch (error) {
    return { k: "failed", error };
  }
}

/** One atomic patch per accepted suggestion: the field and assistUsed together. */
export function acceptPatch(d: CampaignDraft, field: "tagline" | "description" | "breakdown.detail" | "locations.description", text: string, i = 0, taglineMax = Infinity): Partial<CampaignDraft> {
  switch (field) {
    case "tagline": return { tagline: text.slice(0, taglineMax), assistUsed: true };
    case "description": return { description: text, assistUsed: true };
    case "breakdown.detail": return { breakdown: d.breakdown.map((b, j) => (j === i ? { ...b, detail: text } : b)), assistUsed: true };
    case "locations.description": return { locations: d.locations.map((l, j) => (j === i ? { ...l, description: text } : l)), assistUsed: true };
  }
}
