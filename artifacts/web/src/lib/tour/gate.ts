// Pure gating for the walkthrough: may this step move on right now?
export type EditorSaveState = "idle" | "dirty" | "saving" | "saved" | "error" | null;

export interface GateInput {
  /** Saved-data check result (null = action step with no check). */
  checkPassed: boolean | null;
  /** Visible error text near the anchor (role=alert). */
  alert: string | null | undefined;
  /** Editor save state from data-save-state (null when none on screen). */
  saveState: EditorSaveState;
}

export type Gate = { ok: true } | { ok: false; reason: "not-done" | "error" | "unsaved" | "saving"; message: string };

export function gate({ checkPassed, alert, saveState }: GateInput): Gate {
  if (saveState === "error" || alert) {
    return { ok: false, reason: "error", message: `That didn't save${alert ? `: ${alert}` : "."} Fix it and try again — we'll wait here.` };
  }
  if (saveState === "saving") return { ok: false, reason: "saving", message: "Saving…" };
  if (saveState === "dirty") return { ok: false, reason: "unsaved", message: "You have edits that aren't saved yet. Tap outside the field or Save now, then continue." };
  if (checkPassed === false) return { ok: false, reason: "not-done", message: "Waiting for this to save…" };
  return { ok: true };
}

/** Optional means content may be absent, not that failed/unsaved edits may be ignored. */
export function skipGate(input: GateInput & { skippable: boolean }): Gate {
  if (!input.skippable) return { ok: false, reason: "not-done", message: "This step cannot be skipped." };
  return gate({ ...input, checkPassed: null });
}

/** Browse past any tour step without completing its saved-data requirement.
 * Publication/checklist checks stay unchanged; failed or pending edits still block.
 */
export function navigationSkipGate(input: GateInput): Gate {
  return gate({ ...input, checkPassed: null });
}

const STATES = new Set(["idle", "dirty", "saving", "saved", "error"]);
/** Worst save state among elements: error > saving > dirty > saved/idle. */
export function worstSaveState(states: (string | null | undefined)[]): EditorSaveState {
  const s = states.filter((x): x is Exclude<EditorSaveState, null> => !!x && STATES.has(x));
  for (const k of ["error", "saving", "dirty", "saved", "idle"] as const) if (s.includes(k)) return k;
  return null;
}
