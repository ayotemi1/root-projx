import type { SupporterPostMedia } from "@workspace/api-client-react";
import type { MediaEdit } from "./supporter-post-media";

/** Local, per-account draft recovery. Holds the original files plus finished upload references. */
export type StoredDraftItem = {
  id: string; file: File; edit: MediaEdit; objectPath: string | null; media: SupporterPostMedia | null;
};
export type StoredDraft = {
  userKey: string; postId: string; caption: string; communityTag: string | null;
  organisationId: string | null; campaignId: string | null; items: StoredDraftItem[]; savedAt: number;
};

const DB = "rootprojx-supporter-drafts";
const STORE = "drafts";
// Also keep the original File objects in this tab. Quota/privacy-mode failures
// must not silently discard a caption or finished upload when closing a dialog.
const tabDrafts = new Map<string, StoredDraft>();

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: "userKey" }); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest | void): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => { resolve(req ? (req.result as T) : null); db.close(); };
      t.onerror = () => { resolve(null); db.close(); };
      t.onabort = () => { resolve(null); db.close(); };
    } catch { resolve(null); }
  });
}

export async function saveDraft(d: StoredDraft): Promise<boolean> {
  tabDrafts.set(d.userKey, d);
  return await tx<unknown>("readwrite", s => s.put(d)) != null;
}
export async function loadDraft(userKey: string) {
  const disk = await tx<StoredDraft | undefined>("readonly", s => s.get(userKey));
  const tab = tabDrafts.get(userKey);
  return tab && (!disk || tab.savedAt >= disk.savedAt) ? tab : disk ?? null;
}
export async function clearDraft(userKey: string) {
  tabDrafts.delete(userKey);
  await tx<unknown>("readwrite", s => s.delete(userKey));
}
