/**
 * Change editorial content only. Never publish, reset donations or replace
 * banking/funding/identity data while importing copy from the supplied PDF.
 */
export function withHovContent(campaign, source) {
  const patch = Object.fromEntries(
    ["tagline", "description", "breakdown", "phases", "pageContent"].map(key => [key, structuredClone(source[key])]),
  );
  // A PDF's planned outcomes must not reset already-recorded completion.
  const old = new Map((campaign.phases ?? []).map(phase => [phase.id, phase]));
  patch.phases = patch.phases.map(phase => ({
    ...phase, completed: old.get(phase.id)?.completed === true,
  }));
  if (campaign.enabled !== false) {
    return { ...campaign, editorDraft: { ...(campaign.editorDraft ?? {}), ...patch } };
  }
  return { ...campaign, ...patch };
}
