import { SupporterAvatar } from "./SupporterAvatar";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent, type TouchEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Camera, Film, Check, ChevronLeft, ChevronRight, Copy, Crop, ImagePlus, Lock, Globe, Move, Plus, RotateCcw, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { SECTORS } from "@/lib/sectors";
import {
  CROP_ASPECTS, FILTERS, VIDEO_PREVIEW_UNSUPPORTED_COPY, MAX_CAPTION, MAX_POST_ITEMS, POST_MEDIA_ACCEPT, POST_MEDIA_LIMITS_COPY, defaultEdit, editFilterCss, profileIsPublic,
  type CropAspect, type MediaEdit,
} from "@/lib/supporter-post-media";
import { STAGES, useSupporterPostDraft, type DraftItem, type DraftStage } from "./SupporterPostDraftProvider";
import { EditedMedia } from "./EditedMedia";
import "./supporter-post.css";
import { ChangeCoverDialog } from "@/components/post-management/ChangeCoverDialog";

const STAGE_LABEL: Record<DraftStage, string> = { pick: "Select", crop: "Crop", edit: "Edit", cover: "Cover", caption: "Details" };
const ASPECT_LABEL: Record<CropAspect, string> = { original: "Original", "1:1": "Square", "4:5": "Portrait", "16:9": "Wide" };

function Broken({ item }: { item: DraftItem }) {
  return (
    <div className="rpp-broken" role="alert" data-testid={`status-media-broken-${item.id}`}>
      <p><strong>{item.file.name}</strong> {item.brokenReason ? "can’t be used." : "can’t be shown in this browser."}</p>
      <p>{item.brokenReason ?? `It may use a codec your browser doesn’t support. Export it again as ${item.kind === "video" ? "MP4 (H.264 video, AAC audio)" : "JPEG or PNG"}, then remove this item and select the new file.`}</p>
    </div>
  );
}

function NoPreview({ item }: { item: DraftItem }) {
  return (
    <div className="rpp-nopreview" role="status" data-testid={`status-video-preview-unsupported-${item.id}`}>
      <Film size={36} strokeWidth={1.25} aria-hidden />
      <p><strong>{item.file.name}</strong></p>
      <p>{VIDEO_PREVIEW_UNSUPPORTED_COPY}</p>
    </div>
  );
}

function Range({ label, value, min, max, step, onChange, format, testId, onReset }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
  format: (v: number) => string; testId: string; onReset: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="rpp-range">
      <div className="rpp-range-h">
        <label htmlFor={testId}>{label}</label>
        <span className="rpp-range-v" data-testid={`text-${testId}`}>{format(value)}</span>
        <button type="button" className="rpp-mini" onClick={onReset} aria-label={`Reset ${label}`} data-testid={`button-reset-${testId}`}><RotateCcw size={13} aria-hidden /></button>
      </div>
      <input id={testId} type="range" min={min} max={max} step={step} value={value} style={{ ["--p" as string]: `${pct}%` }}
        onChange={e => onChange(Number(e.target.value))} data-testid={`input-${testId}`} />
    </div>
  );
}

const signed = (v: number) => { const n = Math.round((v - 1) * 100); return n > 0 ? `+${n}` : `${n}`; };

export function SupporterPostDialog() {
  const d = useSupporterPostDraft();
  const { user, token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const coverSaved = useRef(false);
  useEffect(() => { if (d?.stage === "cover") coverSaved.current = false; }, [d?.stage]);
  const [dragging, setDragging] = useState(false);
  const [editTab, setEditTab] = useState<"filters" | "adjust">("filters");
  const [tagOpen, setTagOpen] = useState(false);
  const touchX = useRef<number | null>(null);
  const pan = useRef<{ x: number; y: number; px: number; py: number; w: number; h: number } | null>(null);
  const open = d?.open ?? false;
  const orgId = d?.organisationId ?? null;

  const orgsQ = useQuery({ queryKey: ["organisations", "post-link"], queryFn: () => api.getOrganisations(), enabled: open && d?.stage === "caption", staleTime: 5 * 60_000 });
  const campsQ = useQuery({ queryKey: ["campaigns", "post-link", orgId], queryFn: () => api.getCampaigns(orgId!), enabled: open && !!orgId, staleTime: 5 * 60_000 });

  useEffect(() => {
    if (!open) return;
    const stop = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => { window.removeEventListener("dragover", stop); window.removeEventListener("drop", stop); };
  }, [open]);

  const profileQ = useQuery({ queryKey: ["profile", user?.id, token], queryFn: () => api.getProfile(token!), enabled: open && !!token, staleTime: 0 });
  if (!d) return null;
  const { stage, items, active, caption, errors, sharing } = d;
  const current = items[active];
  const full = items.length >= MAX_POST_ITEMS;
  const anyBroken = items.some(i => i.broken);
  const anyLoading = items.some(i => !i.ready && !i.broken);
  const nextBlocked = anyBroken || anyLoading;
  const nextTitle = anyBroken ? "Remove media that can’t be used first" : anyLoading ? "Checking your media…" : undefined;
  const stages = items.some(i => i.kind === "video") ? STAGES : STAGES.filter(s => s !== "cover");
  const stageIdx = stages.indexOf(stage);
  if (stage === "cover") {
    const v = items.find(i => i.kind === "video");
    if (!v) return null;
    return <ChangeCoverDialog post={{ id: v.id, kind: "post", caption, communityTag: d.communityTag,
      campaignId: null, status: "published", pinned: false, commentsDisabled: false, hideLikeCount: false,
      coverUrl: null, editedAt: null, campaigns: [],
      author: { id: user?.id || "", name: user?.name || "Supporter", avatarUrl: user?.avatarUrl || null, verified: false, href: null },
      media: [{ url: v.url, type: "video" }] }}
      onSave={async file => { d.setCover(v.id, file); coverSaved.current = true; }}
      onClose={() => d.setStage(coverSaved.current ? "caption" : "edit")} />;
  }
  const prof = profileQ.data as (api.ApiUser & { publicProfile?: { enabled?: boolean } }) | undefined;
  const isPublic: boolean | null = prof ? profileIsPublic(prof) : null;
  const edit = current?.edit ?? defaultEdit();
  const setEdit = (fn: (e: MediaEdit) => MediaEdit) => current && d.updateEdit(current.id, fn);

  const pick = () => inputRef.current?.click();
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); d.addFiles(Array.from(e.dataTransfer?.files ?? [])); };
  const prev = () => d.setActive(active - 1);
  const next = () => d.setActive(active + 1);
  const onTouchStart = (e: TouchEvent) => { if (stage !== "crop") touchX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (dx < -40) next(); else if (dx > 40) prev();
  };
  const goNext = () => { if (!nextBlocked && stageIdx < stages.length - 1) d.setStage(stages[stageIdx + 1]); };
  const goBack = () => { if (stageIdx > 0) d.setStage(stages[stageIdx - 1]); };

  // Crop panning: drag the media inside the frame; arrows nudge.
  const onPanDown = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pan.current = { x: edit.crop.x, y: edit.crop.y, px: e.clientX, py: e.clientY, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPanMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    const k = 100 / edit.crop.zoom;
    setEdit(x => ({ ...x, crop: { ...x.crop, x: p.x - ((e.clientX - p.px) / p.w) * k, y: p.y - ((e.clientY - p.py) / p.h) * k } }));
  };
  const onPanUp = () => { pan.current = null; };
  const onPanKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = map[e.key];
    if (!v) return;
    e.preventDefault();
    setEdit(x => ({ ...x, crop: { ...x.crop, x: x.crop.x + v[0], y: x.crop.y + v[1] } }));
  };

  const stageView = (
    <div className={`rpp-stage is-${stage}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {current && (current.broken ? <Broken item={current} /> : current.previewUnsupported ? <NoPreview item={current} /> : !current.url ? (
        <div className="rpp-preparing" role="status" data-testid="status-media-converting"><span className="rpp-spin" aria-hidden />Preparing HEIC preview…</div>
      ) : (
        <div className="rpp-fit" key={`${current.id}-${stage}`}>
          <EditedMedia src={current.url} kind={current.kind} edit={stage === "pick" ? defaultEdit() : stage === "crop" ? { ...edit, filter: "original", adjustments: defaultEdit().adjustments } : edit}
            natural={current.natural} fit="contain" controls={current.kind === "video" && stage !== "crop"} alt={`Selected: ${current.file.name}`}
            onReady={(n, dur) => d.markReady(current.id, n, dur)} onBroken={() => d.markBroken(current.id)}
            testId={current.kind === "video" ? "video-post-preview" : "img-post-preview"}>
            {stage === "crop" && (
              <div className="rpp-pan" role="application" tabIndex={0} aria-label="Reposition. Drag, or use arrow keys."
                onPointerDown={onPanDown} onPointerMove={onPanMove} onPointerUp={onPanUp} onPointerCancel={onPanUp} onKeyDown={onPanKey} data-testid="area-crop-pan">
                <span className="rpp-grid" aria-hidden />
              </div>
            )}
          </EditedMedia>
        </div>
      ))}
      {items.length > 1 && (
        <>
          <button type="button" className="rpp-nav is-prev" onClick={prev} disabled={active === 0} aria-label="Previous item" data-testid="button-media-prev"><ChevronLeft size={20} aria-hidden /></button>
          <button type="button" className="rpp-nav is-next" onClick={next} disabled={active === items.length - 1} aria-label="Next item" data-testid="button-media-next"><ChevronRight size={20} aria-hidden /></button>
        </>
      )}
      <span className="rpp-count" data-testid="text-media-position">{active + 1} / {items.length}</span>
    </div>
  );

  const thumbs = (
    <ol className="rpp-thumbs" aria-label="Selected media, in post order">
      {items.map((it, i) => (
        <li key={it.id} className="rpp-thumb-li">
          <button type="button" className="rpp-thumb" aria-current={i === active ? "true" : undefined}
            aria-label={`Item ${i + 1}: ${it.file.name}`} onClick={() => d.setActive(i)} data-testid={`button-thumb-${i}`}>
            {it.broken ? <span className="rpp-thumb-x">?</span>
              : it.previewUnsupported ? <span className="rpp-thumb-x"><Film size={18} aria-hidden /></span>
              : !it.url ? null
              : it.kind === "video" ? <video src={it.url} muted preload="metadata" aria-hidden style={{ filter: editFilterCss(it.edit) }}
                  onLoadedMetadata={e => d.markReady(it.id, e.currentTarget.videoWidth / (e.currentTarget.videoHeight || 1), e.currentTarget.duration)} onError={() => d.markBroken(it.id)} />
              : <img src={it.url} alt="" style={{ filter: editFilterCss(it.edit) }} onLoad={e => d.markReady(it.id, e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1))} onError={() => d.markBroken(it.id)} />}
            {!it.broken && !it.ready && <span className="rpp-thumb-load" aria-hidden />}
            <span className="rpp-order" data-testid={`text-thumb-order-${i}`}>{i + 1}</span>
            {it.media && <span className="rpp-thumb-done" aria-label="Uploaded"><Check size={10} aria-hidden /></span>}
          </button>
          {!sharing && i === active && (
            <span className="rpp-reorder">
              {items.length > 1 && <button type="button" onClick={() => d.move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} earlier`} data-testid={`button-move-left-${i}`}><ChevronLeft size={14} aria-hidden /></button>}
              <button type="button" onClick={() => d.removeAt(i)} aria-label={`Remove item ${i + 1}`} className="is-del" data-testid={`button-remove-${i}`}><Trash2 size={13} aria-hidden /></button>
              {items.length > 1 && <button type="button" onClick={() => d.move(i, 1)} disabled={i === items.length - 1} aria-label={`Move item ${i + 1} later`} data-testid={`button-move-right-${i}`}><ChevronRight size={14} aria-hidden /></button>}
            </span>
          )}
        </li>
      ))}
      {!full && !sharing && (
        <li><button type="button" className="rpp-thumb rpp-add" onClick={pick} aria-label="Add more media" data-testid="button-add-more"><Plus size={20} aria-hidden /></button></li>
      )}
    </ol>
  );

  const cropPanel = current && (
    <div className="rpp-panel" data-testid="panel-crop">
      <p className="rpp-ph"><Crop size={14} aria-hidden /> Frame</p>
      <div className="rpp-seg" role="radiogroup" aria-label="Aspect ratio">
        {CROP_ASPECTS.map(a => (
          <button key={a} type="button" role="radio" aria-checked={edit.crop.aspect === a} onClick={() => setEdit(x => ({ ...x, crop: { ...x.crop, aspect: a } }))} data-testid={`button-aspect-${a}`}>
            <span className={`rpp-ar ar-${a.replace(":", "x")}`} aria-hidden />{ASPECT_LABEL[a]}<small>{a === "original" ? "" : a}</small>
          </button>
        ))}
      </div>
      <Range label="Zoom" value={edit.crop.zoom} min={1} max={3} step={0.01} format={v => `${v.toFixed(2)}x`} testId="crop-zoom"
        onChange={v => setEdit(x => ({ ...x, crop: { ...x.crop, zoom: v } }))} onReset={() => setEdit(x => ({ ...x, crop: { ...x.crop, zoom: 1 } }))} />
      <p className="rpp-hint"><Move size={13} aria-hidden /> Drag the picture to reposition it. Position {Math.round(edit.crop.x)}, {Math.round(edit.crop.y)}.</p>
      <button type="button" className="rpp-link" onClick={() => setEdit(x => ({ ...x, crop: defaultEdit().crop }))} data-testid="button-reset-crop"><RotateCcw size={13} aria-hidden /> Reset crop</button>
    </div>
  );

  const editPanel = current && (
    <div className="rpp-panel" data-testid="panel-edit">
      <div className="rpp-subtabs" role="tablist">
        <button type="button" role="tab" aria-selected={editTab === "filters"} onClick={() => setEditTab("filters")} data-testid="tab-edit-filters">Filters</button>
        <button type="button" role="tab" aria-selected={editTab === "adjust"} onClick={() => setEditTab("adjust")} data-testid="tab-edit-adjust"><SlidersHorizontal size={14} aria-hidden /> Adjust</button>
      </div>
      {editTab === "filters" ? (
        <div className="rpp-filters" role="radiogroup" aria-label="Filter">
          {FILTERS.map(f => (
            <button key={f.id} type="button" role="radio" aria-checked={edit.filter === f.id} className="rpp-filter"
              onClick={() => setEdit(x => ({ ...x, filter: f.id }))} data-testid={`button-filter-${f.id}`}>
              <span className="rpp-filter-img">
                {current.url && current.kind === "image" && <img src={current.url} alt="" style={{ filter: editFilterCss({ filter: f.id, adjustments: edit.adjustments }) }} />}
                {current.url && current.kind === "video" && !current.previewUnsupported && <video src={current.url} muted preload="metadata" aria-hidden style={{ filter: editFilterCss({ filter: f.id, adjustments: edit.adjustments }) }} />}
              </span>
              {f.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="rpp-adjust">
          <Range label="Brightness" value={edit.adjustments.brightness} min={0.5} max={1.5} step={0.01} format={signed} testId="adjust-brightness"
            onChange={v => setEdit(x => ({ ...x, adjustments: { ...x.adjustments, brightness: v } }))} onReset={() => setEdit(x => ({ ...x, adjustments: { ...x.adjustments, brightness: 1 } }))} />
          <Range label="Contrast" value={edit.adjustments.contrast} min={0.5} max={1.5} step={0.01} format={signed} testId="adjust-contrast"
            onChange={v => setEdit(x => ({ ...x, adjustments: { ...x.adjustments, contrast: v } }))} onReset={() => setEdit(x => ({ ...x, adjustments: { ...x.adjustments, contrast: 1 } }))} />
          <Range label="Saturation" value={edit.adjustments.saturation} min={0} max={2} step={0.01} format={signed} testId="adjust-saturation"
            onChange={v => setEdit(x => ({ ...x, adjustments: { ...x.adjustments, saturation: v } }))} onReset={() => setEdit(x => ({ ...x, adjustments: { ...x.adjustments, saturation: 1 } }))} />
        </div>
      )}
      {items.length > 1 && (
        <button type="button" className="rpp-link" onClick={() => d.applyEditToAll(current.id)} data-testid="button-apply-all">Use this look on all {items.length} items</button>
      )}
    </div>
  );

  const orgs = orgsQ.data ?? [];
  const camps = (campsQ.data ?? []).filter(c => c.status === "active" && c.enabled !== false);
  const totalProgress = items.length ? items.reduce((s, it) => s + (it.media ? 1 : d.progress[it.id] ?? (it.objectPath ? 1 : 0)), 0) / items.length : 0;
  const processingAny = items.some(it => d.processing[it.id]);

  const captionPanel = (
    <div className="rpp-panel rpp-cap" data-testid="panel-caption">
      <div className="rpp-author">
        {user?.avatarUrl ? <SupporterAvatar avatarUrl={user.avatarUrl} initials={user.avatarInitials} size={32} /> : <span className="rpp-av" aria-hidden>{user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase()}</span>}
        <span className="rpp-author-n" data-testid="text-post-author">{prof?.publicProfileSettings?.displayName || prof?.name || user?.name}</span>
        <span className="rpp-sep" aria-hidden>›</span>
        <button type="button" className={`rpp-tagbtn${d.communityTag ? " is-set" : ""}`} aria-expanded={tagOpen} onClick={() => setTagOpen(o => !o)} disabled={sharing} data-testid="button-tag-community">
          {d.communityTag ?? "Tag a community"}
        </button>
      </div>
      {tagOpen && (
        <div className="rpp-chips" role="radiogroup" aria-label="Community" data-testid="list-community-tags">
          {SECTORS.map(s => (
            <button key={s} type="button" role="radio" aria-checked={d.communityTag === s} disabled={sharing}
              onClick={() => { d.setCommunityTag(d.communityTag === s ? null : s); setTagOpen(false); }} data-testid={`button-tag-${s}`}>{s}</button>
          ))}
          {d.communityTag && <button type="button" className="is-clear" onClick={() => { d.setCommunityTag(null); setTagOpen(false); }} data-testid="button-tag-clear">No tag</button>}
        </div>
      )}
      <label htmlFor="rpp-caption" className="rpp-sr">Caption</label>
      <textarea id="rpp-caption" className="rpp-caption" value={caption} maxLength={MAX_CAPTION} rows={6} disabled={sharing}
        onChange={e => d.setCaption(e.target.value)} placeholder="Say something about this…" data-testid="input-post-caption" />
      <span className="rpp-counter" data-testid="text-caption-count">{caption.length.toLocaleString()} / {MAX_CAPTION.toLocaleString()}</span>

      <div className="rpp-link-grid">
        <label className="rpp-field-l">Organisation <span>(optional)</span>
          <select value={orgId ?? ""} disabled={sharing || orgsQ.isLoading} onChange={e => d.setOrganisation(e.target.value || null)} data-testid="select-post-organisation">
            <option value="">{orgsQ.isLoading ? "Loading organisations…" : orgsQ.isError ? "Organisations unavailable" : "None"}</option>
            {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
          </select>
        </label>
        {orgId && (
          <label className="rpp-field-l">Campaign <span>(optional)</span>
            <select value={d.campaignId ?? ""} disabled={sharing || campsQ.isLoading} onChange={e => d.setCampaign(e.target.value || null)} data-testid="select-post-campaign">
              <option value="">{campsQ.isLoading ? "Loading campaigns…" : camps.length ? "None" : "No live campaigns"}</option>
              {camps.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <p className="rpp-vis" data-testid="status-post-visibility">
        {isPublic === null ? (profileQ.isError ? <>Your profile visibility couldn’t be checked. Posts follow your Public Profile setting.</> : <>Checking who can see this…</>) : isPublic ? <><Globe size={14} aria-hidden /> Shown on your public profile and in supporter feeds.</> : <><Lock size={14} aria-hidden /> Private: your profile is hidden, so only you will see this post. Change this in Public Profile settings.</>}
      </p>

      {(sharing || d.shareError) && (
        <div className={`rpp-progress${d.shareError ? " is-err" : ""}`} role="status" aria-live="polite" data-testid="status-share-progress">
          <div className="rpp-progress-h">
            <strong>{d.shareError ? d.shareError : processingAny ? (items.some(it => d.processing[it.id] && it.kind === "video") ? "Processing video…" : "Preparing media…") : totalProgress >= 1 ? "Publishing…" : "Uploading…"}</strong>
            <span>{Math.round(totalProgress * 100)}%</span>
          </div>
          <span className="rpp-bar-track"><span className="rpp-bar-fill" style={{ transform: `scaleX(${totalProgress})` }} /></span>
          <ol className="rpp-progress-list">
            {items.map((it, i) => {
              const p = it.media ? 1 : d.progress[it.id] ?? (it.objectPath ? 1 : 0);
              const label = it.media ? "Ready" : d.processing[it.id] ? (it.kind === "video" ? "Processing video…" : "Preparing media…") : it.objectPath ? "Uploaded" : p > 0 ? `${Math.round(p * 100)}%` : "Waiting";
              return <li key={it.id} data-testid={`status-item-progress-${i}`}><span>{i + 1}</span>{it.file.name}<em>{label}</em></li>;
            })}
          </ol>
          {d.shareError && <button type="button" className="rpp-yellow" onClick={() => void d.share()} data-testid="button-share-retry">Try again</button>}
        </div>
      )}
    </div>
  );

  const title = stage === "pick" ? <><span className="rpp-t-d">Create new post</span><span className="rpp-t-m">New post</span></>
    : stage === "crop" ? "Crop" : stage === "edit" ? "Edit" : "Create new post";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) d.close(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="rpp-overlay" />
        <DialogPrimitive.Content className={`rpp-modal is-${stage}${items.length ? " has-items" : ""}`} data-testid="dialog-create-post"
          onEscapeKeyDown={e => { if (sharing) e.preventDefault(); }} onPointerDownOutside={e => { if (sharing) e.preventDefault(); }}
          onCloseAutoFocus={e => { const el = d.returnFocusRef.current; if (el && document.contains(el)) { e.preventDefault(); el.focus(); } }}>
          <header className="rpp-head">
            {stage !== "pick" ? (
              <button type="button" className="rpp-icon" onClick={goBack} disabled={sharing} aria-label={`Back to ${STAGE_LABEL[stages[stageIdx - 1]]}`} data-testid="button-post-back"><ArrowLeft size={20} aria-hidden /></button>
            ) : (
              <DialogPrimitive.Close className="rpp-icon rpp-close-m" aria-label="Close" data-testid="button-close-post-mobile"><X size={22} aria-hidden /></DialogPrimitive.Close>
            )}
            <DialogPrimitive.Title className="rpp-title" data-testid="text-post-title">{title}</DialogPrimitive.Title>
            <span className="rpp-head-r">
              {items.length > 0 && stage !== "caption" && (
                <button type="button" className="rpp-next" onClick={goNext} disabled={nextBlocked} title={nextTitle}
                  aria-describedby={nextBlocked ? "rpp-next-why" : undefined} data-testid="button-post-next">Next</button>
              )}
              {stage === "caption" && (
                <button type="button" className="rpp-next is-share" onClick={() => void d.share()} disabled={sharing || nextBlocked} data-testid="button-post-share">
                  {sharing ? "Sharing…" : d.shareError ? "Retry" : "Share"}
                </button>
              )}
              <DialogPrimitive.Close className="rpp-icon rpp-close-d" aria-label="Close" disabled={sharing} data-testid="button-close-post"><X size={20} aria-hidden /></DialogPrimitive.Close>
            </span>
          </header>

          {items.length > 0 && (
            <ol className="rpp-steps" aria-label="Steps">
              {stages.map((s, i) => (
                <li key={s} className={i < stageIdx ? "is-done" : i === stageIdx ? "is-on" : ""} aria-current={i === stageIdx ? "step" : undefined}>
                  <span>{i + 1}</span>{STAGE_LABEL[s]}
                </li>
              ))}
            </ol>
          )}

          <DialogPrimitive.Description className="rpp-sr">Choose up to {MAX_POST_ITEMS} photos or videos, crop and edit them, add a caption, then share.</DialogPrimitive.Description>
          <input ref={inputRef} type="file" multiple accept={POST_MEDIA_ACCEPT} className="rpp-sr" tabIndex={-1} aria-hidden
            onChange={e => { d.addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} data-testid="input-post-media" />

          {errors.length > 0 && (
            <ul className="rpp-errors" role="alert" data-testid="status-post-errors">{errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
          )}

          {stage === "pick" && items.length === 0 && (
            <div className={`rpp-drop${dragging ? " is-over" : ""}`} data-testid="dropzone-post-media"
              onDragEnter={e => { e.preventDefault(); setDragging(true); }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false); }}
              onDrop={onDrop}>
              {d.recovered && (
                <div className="rpp-recover" role="status" data-testid="status-draft-recovered">
                  <p><strong>Unfinished post</strong> {d.recovered.items.length} {d.recovered.items.length === 1 ? "item" : "items"}{d.recovered.caption ? `, “${d.recovered.caption.slice(0, 48)}${d.recovered.caption.length > 48 ? "…" : ""}”` : ""}</p>
                  <span>
                    <button type="button" className="rpp-yellow" onClick={d.restoreDraft} data-testid="button-restore-draft">Continue</button>
                    <button type="button" className="rpp-link" onClick={d.discardRecovered} data-testid="button-discard-draft">Discard</button>
                  </span>
                </div>
              )}
              <ImagePlus size={56} strokeWidth={1.25} aria-hidden />
              <p className="rpp-drop-h">Drag photos and videos here</p>
              <p className="rpp-drop-h-m">Choose photos and videos</p>
              <button type="button" className="rpp-yellow" onClick={pick} data-testid="button-select-media">
                <span className="rpp-t-d">Select from computer</span><span className="rpp-t-m">Choose from device</span>
              </button>
              <p className="rpp-limits" data-testid="text-media-limits">{POST_MEDIA_LIMITS_COPY}</p>
            </div>
          )}

          {items.length > 0 && current && (
            <div className={`rpp-work is-${stage}`} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
              <div className="rpp-work-media">
                {stageView}
                <div className="rpp-bar">
                  {thumbs}
                  <div className="rpp-bar-row">
                    <span className="rpp-meta" data-testid="text-media-count">{items.length} of {MAX_POST_ITEMS} selected</span>
                    {nextBlocked && <span id="rpp-next-why" className="rpp-why" role="status" data-testid="status-next-blocked">{nextTitle}</span>}
                    {stage === "pick" && (
                      <button type="button" className="rpp-remove" onClick={() => d.removeAt(active)} data-testid="button-remove-active"><Trash2 size={15} aria-hidden /> Remove item {active + 1}</button>
                    )}
                  </div>
                </div>
              </div>
              {stage !== "pick" && (
                <aside className="rpp-side" key={stage}>
                  {stage === "crop" && cropPanel}
                  {stage === "edit" && editPanel}
                  {stage === "caption" && captionPanel}
                </aside>
              )}
            </div>
          )}

          {stage === "pick" && (
            <nav className="rpp-tabs" aria-label="Create type">
              <button type="button" className="rpp-tab" aria-pressed="true" data-testid="tab-picker-post"><Copy size={18} aria-hidden /> Post</button>
              <button type="button" className="rpp-tab" disabled aria-disabled="true" data-testid="tab-picker-story">
                <Camera size={18} aria-hidden /> Story <span className="rpp-tab-badge" data-testid="status-picker-story-unavailable">Unavailable</span>
              </button>
            </nav>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
