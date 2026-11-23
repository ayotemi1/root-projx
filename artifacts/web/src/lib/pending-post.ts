/** Org-scoped local record of uploaded-but-unpublished update media. */
export interface PendingPost {
  urls: string[];
  title: string;
  content: string;
  type: "update" | "milestone" | "campaign";
  externalUrl?: string;
  coverMediaId?: string;
  clientId?: string;
  savedAt: string;
}

const key = (orgId: string) => `rootprojx:pending-update-media:${orgId}`;

export function loadPendingPost(orgId: string): PendingPost | null {
  if (!orgId) return null;
  try {
    const raw = localStorage.getItem(key(orgId));
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingPost;
    if (!Array.isArray(p.urls) || p.urls.length === 0 || !p.urls.every((u) => typeof u === "string")) return null;
    if (!["update", "milestone", "campaign"].includes(p.type)) p.type = "update";
    return { ...p, title: String(p.title ?? ""), content: String(p.content ?? "") };
  } catch {
    return null;
  }
}

export function savePendingPost(orgId: string, p: PendingPost) {
  if (!orgId) return;
  try { localStorage.setItem(key(orgId), JSON.stringify(p)); } catch { /* storage full or blocked */ }
}

export function clearPendingPost(orgId: string) {
  if (!orgId) return;
  try { localStorage.removeItem(key(orgId)); } catch { /* ignore */ }
}
