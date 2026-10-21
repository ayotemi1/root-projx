// "Preview as a donor" must never show stale data: save first, open only on success.

type Flush = () => Promise<boolean>;
const registry = new Map<string, Set<Flush>>();

/** Profile sections register their flush so any preview link can save everything first. */
export function registerProfileFlush(orgId: string, fn: Flush): () => void {
  let set = registry.get(orgId);
  if (!set) { set = new Set(); registry.set(orgId, set); }
  set.add(fn);
  return () => { set!.delete(fn); };
}

/** Saves every mounted profile section. True only if all of them are persisted. */
export async function flushProfile(orgId: string): Promise<boolean> {
  const fns = [...(registry.get(orgId) ?? [])];
  const results = await Promise.all(fns.map((f) => f().catch(() => false)));
  return results.every(Boolean);
}

export const appUrl = (path: string) => `${(import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "")}${path}`;

/**
 * Opens a new tab immediately (so popup blockers allow it), saves, then points the
 * tab at the preview. On a failed save the tab is closed and nothing is shown.
 */
export async function openPreviewAfterSave(save: Flush, path: string): Promise<boolean> {
  const tab = typeof window !== "undefined" ? window.open("", "_blank") : null;
  let ok = false;
  try { ok = await save(); } catch { ok = false; }
  if (!ok) { tab?.close(); return false; }
  if (tab) { tab.opener = null; tab.location.href = appUrl(path); }
  else window.location.href = appUrl(path);
  return true;
}
