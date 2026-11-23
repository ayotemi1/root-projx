import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  MAX_POST_ITEMS, defaultEdit, previewFailureOutcome, isHeic, normaliseEdit, postContentType, postMediaKind, selectPostMedia, videoDurationError,
  type MediaEdit, type PostMediaKind,
} from "@/lib/supporter-post-media";
import {
  GENERIC_SHARE_ERROR, cachePublishedPost, completeUpload, newPostId, publishPost, putToSignedUrl, requestUpload,
  type SupporterPostMedia,
} from "@/lib/supporter-publishing";
import { clearDraft, loadDraft, saveDraft, type StoredDraft } from "@/lib/supporter-post-drafts";
import { SupporterPostDialog } from "./SupporterPostDialog";
import { uploadPostCover } from "@/lib/post-cover";
import { holdFeedPlayback } from "@/components/inline-video-player";

export type DraftItem = {
  id: string; file: File; url: string; kind: PostMediaKind; broken: boolean; brokenReason?: string; ready: boolean; previewUnsupported: boolean;
  natural: number | null; edit: MediaEdit; objectPath: string | null; media: SupporterPostMedia | null;
  coverFile?: File | null; coverMedia?: SupporterPostMedia | null;
};
export type DraftStage = "pick" | "crop" | "edit" | "cover" | "caption";
export const STAGES: DraftStage[] = ["pick", "crop", "edit", "cover", "caption"];

type Ctx = {
  open: boolean; stage: DraftStage; items: DraftItem[]; active: number; caption: string; errors: string[];
  communityTag: string | null; organisationId: string | null; campaignId: string | null;
  sharing: boolean; shareError: string | null; progress: Record<string, number>; processing: Record<string, boolean>; recovered: StoredDraft | null;
  openPicker: (returnFocus?: HTMLElement | null) => void;
  close: () => void;
  addFiles: (files: readonly File[]) => void;
  removeAt: (i: number) => void;
  move: (i: number, dir: -1 | 1) => void;
  setActive: (i: number) => void;
  setStage: (s: DraftStage) => void;
  setCover: (id: string, file: File) => void;
  setCaption: (c: string) => void;
  setCommunityTag: (t: string | null) => void;
  setOrganisation: (id: string | null) => void;
  setCampaign: (id: string | null) => void;
  updateEdit: (id: string, fn: (e: MediaEdit) => MediaEdit) => void;
  applyEditToAll: (id: string) => void;
  markBroken: (id: string, reason?: string) => void;
  markReady: (id: string, natural?: number | null, duration?: number) => void;
  share: () => Promise<void>;
  restoreDraft: () => void;
  discardRecovered: () => void;
  returnFocusRef: React.MutableRefObject<HTMLElement | null>;
};

const PostDraftContext = createContext<Ctx | null>(null);
export function useSupporterPostDraft() { return useContext(PostDraftContext); }

let seq = 0;

/**
 * Preview-only HEIC/HEIF decoding; the original file is what uploads.
 * 1. Native: browsers that decode HEIC themselves (Safari) get the original file, with EXIF orientation honoured.
 * 2. Otherwise heic-to (current libheif WASM) converts to lossless PNG so colours stay exact.
 */
async function nativeDecodes(file: File): Promise<boolean> {
  if (typeof createImageBitmap !== "function") return false;
  try { const bmp = await createImageBitmap(file); bmp.close(); return true; } catch { return false; }
}
async function heicPreview(file: File): Promise<string> {
  if (await nativeDecodes(file)) return URL.createObjectURL(file);
  const { heicTo } = await import("heic-to");
  const png = await heicTo({ blob: file, type: "image/png" });
  return URL.createObjectURL(png);
}

export function SupporterPostDraftProvider({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, token, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  useEffect(() => open ? holdFeedPlayback() : undefined, [open]);
  const [stage, setStageRaw] = useState<DraftStage>("pick");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [active, setActiveRaw] = useState(0);
  const [caption, setCaption] = useState("");
  const [communityTag, setCommunityTag] = useState<string | null>(null);
  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [campaignId, setCampaign] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [recovered, setRecovered] = useState<StoredDraft | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const itemsRef = useRef<DraftItem[]>([]);
  itemsRef.current = items;
  const postIdRef = useRef<string>(newPostId());
  const fieldsRef = useRef({ caption, communityTag, organisationId, campaignId });
  fieldsRef.current = { caption, communityTag, organisationId, campaignId };
  const userKey = user ? `${user.accountType}:${user.id}` : "none";
  const ownerKeyRef = useRef(userKey);
  const sharingRef = useRef(false);

  const commit = (next: DraftItem[]) => { itemsRef.current = next; setItems(next); };
  const patchItem = (id: string, patch: Partial<DraftItem>) =>
    commit(itemsRef.current.map(it => (it.id === id ? { ...it, ...patch } : it)));

  const snapshot = useCallback((key: string): StoredDraft => ({
    userKey: key, postId: postIdRef.current, ...fieldsRef.current, savedAt: Date.now(),
    items: itemsRef.current.map(i => ({ id: i.id, file: i.file, edit: i.edit, objectPath: i.objectPath, media: i.media, coverFile: i.coverFile, coverMedia: i.coverMedia })),
  }), []);

  const clear = useCallback(() => {
    itemsRef.current.forEach(i => i.url && URL.revokeObjectURL(i.url));
    commit([]);
    setActiveRaw(0); setCaption(""); setCommunityTag(null); setOrganisationId(null); setCampaign(null);
    setErrors([]); setStageRaw("pick"); setShareError(null); setProgress({}); setProcessing({}); setRecovered(null);
    postIdRef.current = newPostId();
  }, []);

  /** Close, keeping unfinished work recoverable for the same account. */
  const closeKeeping = useCallback((key: string) => {
    if (itemsRef.current.length && key !== "none") {
      void saveDraft(snapshot(key)).then(persisted => toast(persisted
        ? { title: "Draft kept on this device", description: "Open Create, then Post, to pick up where you left off." }
        : { title: "Draft kept in this tab", description: "Your browser couldn’t save it to this device. Keep this tab open and reopen Create → Post to recover it." }));
    }
    setOpen(false); clear();
  }, [clear, snapshot, toast]);

  const close = useCallback(() => { if (!sharingRef.current) closeKeeping(ownerKeyRef.current); }, [closeKeeping]);

  const hydrate = useCallback((files: Array<{ file: File; edit?: MediaEdit; objectPath?: string | null; media?: SupporterPostMedia | null; coverFile?: File | null; coverMedia?: SupporterPostMedia | null }>) => {
    const fresh: DraftItem[] = files.map(f => ({
      id: `pm-${++seq}`, file: f.file, url: isHeic(f.file) ? "" : URL.createObjectURL(f.file),
      kind: postMediaKind(f.file) ?? "image", broken: false, ready: false, previewUnsupported: false, natural: null,
      edit: normaliseEdit(f.edit ?? defaultEdit()), objectPath: f.objectPath ?? null, media: f.media ?? null,
      coverFile: f.coverFile, coverMedia: f.coverMedia,
    }));
    for (const it of fresh) {
      if (it.url) continue;
      heicPreview(it.file)
        .then(url => { if (itemsRef.current.some(x => x.id === it.id)) patchItem(it.id, { url }); else URL.revokeObjectURL(url); })
        .catch(() => patchItem(it.id, { broken: true, brokenReason: "This HEIC photo couldn’t be converted for preview. Export it as JPG, then select it again." }));
    }
    return fresh;
  }, []);

  const openPicker = useCallback((returnFocus?: HTMLElement | null) => {
    if (!isAuthenticated || user?.accountType !== "supporter") return;
    returnFocusRef.current = returnFocus ?? (document.activeElement as HTMLElement | null);
    clear();
    ownerKeyRef.current = userKey;
    setOpen(true);
    void loadDraft(userKey).then(d => { if (d && d.items?.length && ownerKeyRef.current === userKey) setRecovered(d); });
  }, [clear, isAuthenticated, user?.accountType, userKey]);

  // Route or account change: close; work is kept only for the account that made it.
  const firstRun = useRef(true);
  const closeRef = useRef(closeKeeping);
  closeRef.current = closeKeeping;
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (sharingRef.current) return;
    closeRef.current(ownerKeyRef.current);
  }, [location, userKey]);

  useEffect(() => () => { itemsRef.current.forEach(i => i.url && URL.revokeObjectURL(i.url)); }, []);

  const addFiles = useCallback((files: readonly File[]) => {
    if (sharingRef.current) return;
    const { accepted, errors: errs } = selectPostMedia(files, itemsRef.current.length);
    const fresh = hydrate(accepted.slice(0, MAX_POST_ITEMS - itemsRef.current.length).map(file => ({ file })));
    setErrors(errs);
    setRecovered(null);
    if (fresh.length) {
      const prevLen = itemsRef.current.length;
      commit([...itemsRef.current, ...fresh]);
      setActiveRaw(prevLen);
    }
  }, [hydrate]);

  const removeAt = useCallback((i: number) => {
    if (sharingRef.current) return;
    const prev = itemsRef.current;
    const target = prev[i];
    if (!target) return;
    if (target.url) URL.revokeObjectURL(target.url);
    const next = prev.filter((_, idx) => idx !== i);
    commit(next);
    setActiveRaw(a => Math.max(0, Math.min(a > i ? a - 1 : a, next.length - 1)));
    if (next.length === 0) setStageRaw("pick");
    setErrors([]);
  }, []);

  const move = useCallback((i: number, dir: -1 | 1) => {
    if (sharingRef.current) return;
    const prev = itemsRef.current;
    const j = i + dir;
    if (j < 0 || j >= prev.length) return;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
    setActiveRaw(j);
  }, []);

  const setActive = useCallback((i: number) => setActiveRaw(Math.max(0, Math.min(i, itemsRef.current.length - 1))), []);
  const setStage = useCallback((s: DraftStage) => { if (!sharingRef.current) { setStageRaw(s); setShareError(null); } }, []);

  const updateEdit = useCallback((id: string, fn: (e: MediaEdit) => MediaEdit) => {
    const it = itemsRef.current.find(x => x.id === id);
    if (it) patchItem(id, { edit: normaliseEdit(fn(it.edit)) });
  }, []);
  const applyEditToAll = useCallback((id: string) => {
    const src = itemsRef.current.find(x => x.id === id);
    if (!src) return;
    commit(itemsRef.current.map(it => ({ ...it, edit: { ...it.edit, filter: src.edit.filter, adjustments: { ...src.edit.adjustments } } })));
  }, []);

  const markBroken = useCallback((id: string, reason?: string) => {
    const it = itemsRef.current.find(x => x.id === id);
    if (!it || it.broken) return;
    if (previewFailureOutcome(it.file, reason) === "unsupported-preview") {
      // Valid video container the browser can't decode: the server transcodes it and validates duration.
      if (!it.previewUnsupported || !it.ready) patchItem(id, { previewUnsupported: true, ready: true });
      return;
    }
    patchItem(id, { broken: true, ready: false, brokenReason: reason });
  }, []);
  const markReady = useCallback((id: string, natural?: number | null, duration?: number) => {
    const it = itemsRef.current.find(x => x.id === id);
    if (!it || it.broken || it.previewUnsupported) return;
    if (it.kind === "video" && duration != null) {
      const err = videoDurationError(it.file.name, duration);
      if (err) { patchItem(id, { broken: true, ready: false, brokenReason: err }); return; }
    }
    if (it.ready && (natural == null || it.natural === natural)) return;
    patchItem(id, { ready: true, natural: natural ?? it.natural });
  }, []);

  const setOrganisation = useCallback((id: string | null) => { setOrganisationId(id); setCampaign(null); }, []);

  const restoreDraft = useCallback(() => {
    const d = recovered;
    if (!d) return;
    clear();
    postIdRef.current = d.postId;
    setCaption(d.caption ?? ""); setCommunityTag(d.communityTag ?? null);
    setOrganisationId(d.organisationId ?? null); setCampaign(d.campaignId ?? null);
    commit(hydrate(d.items.slice(0, MAX_POST_ITEMS)));
    setStageRaw("crop");
  }, [recovered, clear, hydrate]);

  const discardRecovered = useCallback(() => { void clearDraft(ownerKeyRef.current); setRecovered(null); }, []);

  const share = useCallback(async () => {
    if (!token || sharingRef.current || !itemsRef.current.length) return;
    sharingRef.current = true; setSharing(true); setShareError(null);
    const key = ownerKeyRef.current;
    try {
      for (const it of [...itemsRef.current]) {
        if (it.media) continue;
        let path = it.objectPath;
        if (!path) {
          const ct = postContentType(it.file);
          if (!ct) throw new Error("type");
          const target = await requestUpload(it.file, ct, token);
          await putToSignedUrl(target.uploadUrl, it.file, ct, f => setProgress(p => ({ ...p, [it.id]: f })));
          path = target.objectPath;
          patchItem(it.id, { objectPath: path }); // retained: retry skips the PUT
        }
        setProgress(p => ({ ...p, [it.id]: 1 }));
        const media = await completeUpload(path, token, () => setProcessing(p => ({ ...p, [it.id]: true })));
        setProcessing(p => ({ ...p, [it.id]: false }));
        patchItem(it.id, { media });
        setProgress(p => ({ ...p, [it.id]: 1 }));
      }
      const coverItem = itemsRef.current.find(i => i.kind === "video" && i.coverFile);
      if (coverItem?.coverFile && !coverItem.coverMedia) {
        const coverMedia = await uploadPostCover(coverItem.coverFile, token);
        patchItem(coverItem.id, { coverMedia });
      }
      const list = itemsRef.current;
      const f = fieldsRef.current;
      const saved = await publishPost({
        id: postIdRef.current,
        type: list[0].kind === "video" ? "video" : "photo",
        caption: f.caption.trim(),
        community_tag: f.communityTag,
        organisation_id: f.organisationId,
        campaign_id: f.organisationId ? f.campaignId : null,
        ...(list.find(i => i.coverMedia)?.coverMedia ? { coverMediaId: list.find(i => i.coverMedia)!.coverMedia!.id } : {}),
        media: list.map((it, order) => ({ id: it.media!.id, order, crop: it.edit.crop, filter: it.edit.filter, adjustments: it.edit.adjustments })),
      }, token);
      void clearDraft(key);
      itemsRef.current.forEach(i => i.url && URL.revokeObjectURL(i.url));
      commit([]);
      sharingRef.current = false; setSharing(false);
      setOpen(false); clear();
      await cachePublishedPost(qc, saved, token);
      navigate("/profile");
      toast({ title: "Posted" });
    } catch {
      setShareError(GENERIC_SHARE_ERROR);
      setProcessing({});
      void saveDraft(snapshot(key));
    } finally {
      sharingRef.current = false; setSharing(false);
    }
  }, [token, qc, navigate, toast, clear, snapshot]);

  const value: Ctx = {
    open, stage, items, active, caption, errors, communityTag, organisationId, campaignId, sharing, shareError, progress, processing, recovered,
    openPicker, close, addFiles, removeAt, move, setActive, setStage,
    setCover: (id, file) => patchItem(id, { coverFile: file, coverMedia: null }),
    setCaption, setCommunityTag, setOrganisation, setCampaign,
    updateEdit, applyEditToAll, markBroken, markReady, share, restoreDraft, discardRecovered, returnFocusRef,
  };

  return (
    <PostDraftContext.Provider value={value}>
      {children}
      <SupporterPostDialog />
    </PostDraftContext.Provider>
  );
}
