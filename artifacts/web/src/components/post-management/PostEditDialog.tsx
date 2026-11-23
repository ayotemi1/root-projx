import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Loader2 } from "lucide-react";
import type { ManageOwnPostInput, OwnerPostDetails } from "@workspace/api-client-react";
import { SECTORS } from "@/lib/sectors";
import { InlineVideoPlayer } from "@/components/inline-video-player";
import "./PostEditDialog.css";

export interface PostEditDialogProps {
  post: OwnerPostDetails;
  hidden?: boolean;
  onSave: (input: ManageOwnPostInput) => Promise<void>;
  onClose: () => void;
  onChangeCover: () => void;
}

const MAX = 2200;
const fmt = (n: number) => n.toLocaleString("en-GB");
const stop = (e: SyntheticEvent) => e.stopPropagation();
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");

type Draft = { caption: string; communityTag: string | null; campaignId: string | null; commentsDisabled: boolean; hideLikeCount: boolean };

export function PostEditDialog({ post, hidden = false, onSave, onClose, onChangeCover }: PostEditDialogProps) {
  // Draft is initialised once per post id; later prop updates (e.g. coverUrl after a cover save) don't reset it.
  const initialFor = useRef<string | null>(null);
  const base = useRef<Draft>({ caption: "", communityTag: null, campaignId: null, commentsDisabled: false, hideLikeCount: false });
  const [draft, setDraft] = useState<Draft>(() => {
    const d = { caption: post.caption ?? "", communityTag: post.communityTag ?? null, campaignId: post.campaignId ?? null, commentsDisabled: post.commentsDisabled, hideLikeCount: post.hideLikeCount };
    base.current = d; initialFor.current = post.id; return d;
  });
  useEffect(() => {
    if (initialFor.current === post.id) return;
    initialFor.current = post.id;
    const d = { caption: post.caption ?? "", communityTag: post.communityTag ?? null, campaignId: post.campaignId ?? null, commentsDisabled: post.commentsDisabled, hideLikeCount: post.hideLikeCount };
    base.current = d; setDraft(d);
  }, [post]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const dlgRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const changes = useMemo(() => {
    const b = base.current, c: ManageOwnPostInput = {};
    if (draft.caption !== b.caption) c.caption = draft.caption;
    if (draft.communityTag !== b.communityTag) c.communityTag = draft.communityTag;
    if (post.kind === "update" && draft.campaignId !== b.campaignId) c.campaignId = draft.campaignId;
    if (draft.commentsDisabled !== b.commentsDisabled) c.commentsDisabled = draft.commentsDisabled;
    if (draft.hideLikeCount !== b.hideLikeCount) c.hideLikeCount = draft.hideLikeCount;
    return c;
  }, [draft, post.kind]);
  const dirty = Object.keys(changes).length > 0;
  const over = draft.caption.length > MAX;

  const media = post.media[0];
  const isVideo = media?.type === "video";
  const cover = post.coverUrl || media?.thumbnailUrl || null;
  const communities = useMemo(() => {
    const list: string[] = [...SECTORS];
    if (draft.communityTag && !list.includes(draft.communityTag)) list.unshift(draft.communityTag);
    return list;
  }, [draft.communityTag]);
  const campaignName = post.campaigns.find(c => c.id === draft.campaignId)?.name;

  const state = useRef({ dirty, saving, confirm, hidden, onClose });
  state.current = { dirty, saving, confirm, hidden, onClose };

  const requestClose = () => {
    if (state.current.saving) return;
    if (state.current.dirty) setConfirm(true); else state.current.onClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    return () => { const el = restoreRef.current; if (el && document.contains(el)) requestAnimationFrame(() => el.focus({ preventScroll: true })); };
  }, []);

  useEffect(() => { if (!hidden && !confirm) cancelRef.current?.focus({ preventScroll: true }); }, [hidden, confirm]);
  useEffect(() => { if (confirm) keepRef.current?.focus({ preventScroll: true }); }, [confirm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = state.current;
      if (s.hidden || e.key !== "Escape") return;
      e.preventDefault(); e.stopPropagation();
      if (s.confirm) { setConfirm(false); return; }
      requestCloseRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key !== "Tab") return;
    const root = confirm ? e.currentTarget.querySelector<HTMLElement>(".ped-confirm") : dlgRef.current;
    if (!root) return;
    const f = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0]!, last = f[f.length - 1]!;
    if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const save = async () => {
    if (saving || over) return;
    if (!dirty) { onClose(); return; }
    setSaving(true); setError(null);
    try {
      await onSave(changes);
      setSaving(false);
      onClose();
    } catch {
      setSaving(false);
      setError("Your changes weren't saved.");
    }
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }));

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="ped-layer" hidden={hidden} onClick={stop} onPointerDown={stop} onTouchStart={stop} onTouchEnd={stop} onKeyDown={trap}>
      <div className="ped-scrim" aria-hidden onClick={requestClose} data-testid="overlay-edit-post" />
      <div ref={dlgRef} className="ped-dlg" role="dialog" aria-modal="true" aria-labelledby="ped-title" aria-hidden={confirm || undefined} data-testid="dialog-edit-post">
        <div className="ped-dh">
          <button ref={cancelRef} type="button" className="ped-lnk" onClick={requestClose} disabled={saving} data-testid="button-cancel-edit">Cancel</button>
          <h2 id="ped-title" className="ped-h">Edit post</h2>
          <button type="button" className="ped-done" onClick={save} disabled={saving || over} aria-busy={saving} data-testid="button-done-edit">
            {saving && <Loader2 className="ped-spin" size={16} aria-hidden />}Done
          </button>
        </div>
        <div className="ped-db">
          <div className="ped-med" data-testid="preview-edit-post">
            {!media ? (
              <p className="ped-textonly">{draft.caption || "Text post"}</p>
            ) : isVideo ? (
              <>
                <span className="ped-chip">Video</span>
                <InlineVideoPlayer src={media.url} poster={cover} label={`${post.author.name} video`} />
              </>
            ) : (
              <>
                {post.media.length > 1 && <span className="ped-chip">{post.media.length} photos</span>}
                <img src={media.url} alt={`${post.author.name} photo`} draggable={false} />
              </>
            )}
          </div>
          <div className="ped-side">
            <div className="ped-who">
              <span className="ped-av">{post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" /> : initials(post.author.name)}</span>
              <span data-testid="text-edit-author">{post.author.name}</span>
            </div>
            <label>
              <span className="ped-lbl">Caption <span className={`ped-cnt${over ? " over" : ""}`} aria-live="polite" data-testid="text-caption-count">{fmt(draft.caption.length)} / {fmt(MAX)}</span></span>
              <textarea className="ped-ta" value={draft.caption} onChange={e => set("caption", e.target.value)} aria-invalid={over || undefined} disabled={saving} data-testid="input-edit-caption" />
            </label>
            <div className="ped-rows">
              {isVideo && (
                <button type="button" className="ped-row" onClick={onChangeCover} disabled={saving} data-testid="button-edit-change-cover">
                  Cover<span className="ped-r"><span className="ped-thumb" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} aria-hidden />Change<ChevronRight size={16} aria-hidden /></span>
                </button>
              )}
              <label className="ped-row">
                Tag a community
                <span className="ped-r"><span>{draft.communityTag || "None"}</span><ChevronRight size={16} aria-hidden /></span>
                <select className="ped-sel" value={draft.communityTag ?? ""} onChange={e => set("communityTag", e.target.value || null)} disabled={saving} aria-label="Tag a community" data-testid="select-edit-community">
                  <option value="">None</option>
                  {communities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              {post.kind === "update" && (
                <label className="ped-row">
                  Linked campaign
                  <span className="ped-r"><span>{campaignName || "None"}</span><ChevronRight size={16} aria-hidden /></span>
                  <select className="ped-sel" value={draft.campaignId ?? ""} onChange={e => set("campaignId", e.target.value || null)} disabled={saving} aria-label="Linked campaign" data-testid="select-edit-campaign">
                    <option value="">None</option>
                    {post.campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              <div className="ped-row">
                <span id="ped-cm">Turn off commenting</span>
                <button type="button" role="switch" aria-checked={draft.commentsDisabled} aria-labelledby="ped-cm" className="ped-sw" disabled={saving}
                  onClick={() => set("commentsDisabled", !draft.commentsDisabled)} data-testid="switch-edit-comments">{draft.commentsDisabled ? "On" : "Off"}</button>
              </div>
              <div className="ped-row">
                <span id="ped-lk">Hide like count</span>
                <button type="button" role="switch" aria-checked={draft.hideLikeCount} aria-labelledby="ped-lk" className="ped-sw" disabled={saving}
                  onClick={() => set("hideLikeCount", !draft.hideLikeCount)} data-testid="switch-edit-likes">{draft.hideLikeCount ? "On" : "Off"}</button>
              </div>
            </div>
            {error && (
              <p className="ped-err" role="alert" data-testid="text-edit-error">
                {error}
                <button type="button" className="ped-retry" onClick={save} data-testid="button-retry-edit">Try again</button>
              </p>
            )}
            <p className="ped-note">Photos and videos can’t be swapped after posting. To change them, delete the post and post it again.</p>
          </div>
        </div>
      </div>
      {confirm && (
        <div className="ped-confirm-layer" onClick={e => { if (e.target === e.currentTarget) setConfirm(false); }}>
          <div className="ped-confirm" role="alertdialog" aria-modal="true" aria-labelledby="ped-discard-title" data-testid="dialog-discard-edit">
            <h2 id="ped-discard-title">Discard changes?</h2>
            <p>Your edits to this post will be lost.</p>
            <div className="ped-actions">
              <button ref={keepRef} type="button" className="ped-keep" onClick={() => setConfirm(false)} data-testid="button-keep-editing">Keep editing</button>
              <button type="button" className="ped-discard" onClick={() => { setConfirm(false); onClose(); }} data-testid="button-discard-edit">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
