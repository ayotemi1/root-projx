import { useEffect, useRef, useState, type DragEvent, type TouchEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, Camera, ChevronLeft, Copy, ChevronRight, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { MAX_POST_ITEMS, POST_MEDIA_ACCEPT, POST_MEDIA_LIMITS_COPY } from "@/lib/supporter-post-media";
import { useSupporterPostDraft, type DraftItem } from "./SupporterPostDraftProvider";
import "./supporter-post.css";

function Media({ item, onBroken, onReady }: { item: DraftItem; onBroken: () => void; onReady: () => void }) {
  if (item.broken) {
    return (
      <div className="rpp-broken" role="alert" data-testid={`status-media-broken-${item.id}`}>
        <p><strong>{item.file.name}</strong> can't be shown in this browser.</p>
        <p>It may use a codec your browser doesn't support. Export it again as {item.kind === "video" ? "MP4 (H.264 video, AAC audio)" : "JPEG or PNG"}, then remove this item and select the new file.</p>
      </div>
    );
  }
  return item.kind === "video"
    ? <video key={item.url} src={item.url} controls playsInline preload="metadata" className="rpp-media" onError={onBroken} onLoadedMetadata={onReady}
        data-testid="video-post-preview" aria-label={item.file.name} />
    : <img key={item.url} src={item.url} alt={`Selected: ${item.file.name}`} className="rpp-media" onError={onBroken} onLoad={onReady}
        data-testid="img-post-preview" />;
}

export function SupporterPostDialog() {
  const d = useSupporterPostDraft();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const touchX = useRef<number | null>(null);
  const open = d?.open ?? false;

  // Never let a stray drop navigate the browser away while the picker is open.
  useEffect(() => {
    if (!open) return;
    const stop = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => { window.removeEventListener("dragover", stop); window.removeEventListener("drop", stop); };
  }, [open]);

  if (!d) return null;
  const { stage, items, active, caption, errors } = d;
  const current = items[active];
  const full = items.length >= MAX_POST_ITEMS;
  const anyBroken = items.some(i => i.broken);
  const anyLoading = items.some(i => !i.ready && !i.broken);
  const nextBlocked = anyBroken || anyLoading;
  const nextTitle = anyBroken ? "Remove media that can't be shown first" : anyLoading ? "Checking your media…" : undefined;

  const pick = () => inputRef.current?.click();
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    d.addFiles(Array.from(e.dataTransfer?.files ?? []));
  };
  const prev = () => d.setActive(active - 1);
  const next = () => d.setActive(active + 1);
  const onTouchStart = (e: TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (dx < -40) next(); else if (dx > 40) prev();
  };

  const stageView = (
    <div className="rpp-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {current && <Media item={current} onBroken={() => d.markBroken(current.id)} onReady={() => d.markReady(current.id)} />}
      {items.length > 1 && (
        <>
          <button type="button" className="rpp-nav is-prev" onClick={prev} disabled={active === 0} aria-label="Previous item" data-testid="button-media-prev"><ChevronLeft size={20} aria-hidden /></button>
          <button type="button" className="rpp-nav is-next" onClick={next} disabled={active === items.length - 1} aria-label="Next item" data-testid="button-media-next"><ChevronRight size={20} aria-hidden /></button>
        </>
      )}
      <span className="rpp-count" data-testid="text-media-position">{active + 1} / {items.length}</span>
    </div>
  );

  const thumbs = (editable: boolean) => (
    <ol className="rpp-thumbs" aria-label="Selected media, in post order">
      {items.map((it, i) => (
        <li key={it.id} className="rpp-thumb-li">
          <button type="button" className="rpp-thumb" aria-current={i === active ? "true" : undefined}
            aria-label={`Item ${i + 1}: ${it.file.name}`} onClick={() => d.setActive(i)} data-testid={`button-thumb-${i}`}>
            {it.broken ? <span className="rpp-thumb-x">?</span>
              : it.kind === "video" ? <video src={it.url} muted preload="metadata" aria-hidden
                  onLoadedMetadata={() => d.markReady(it.id)} onError={() => d.markBroken(it.id)} />
              : <img src={it.url} alt="" onLoad={() => d.markReady(it.id)} onError={() => d.markBroken(it.id)} />}
            {!it.broken && !it.ready && <span className="rpp-thumb-load" aria-hidden />}
            <span className="rpp-order" data-testid={`text-thumb-order-${i}`}>{i + 1}</span>
          </button>
          {editable && i === active && items.length > 1 && (
            <span className="rpp-reorder">
              <button type="button" onClick={() => d.move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} earlier`} data-testid={`button-move-left-${i}`}><ChevronLeft size={14} aria-hidden /></button>
              <button type="button" onClick={() => d.move(i, 1)} disabled={i === items.length - 1} aria-label={`Move item ${i + 1} later`} data-testid={`button-move-right-${i}`}><ChevronRight size={14} aria-hidden /></button>
            </span>
          )}
        </li>
      ))}
      {editable && !full && (
        <li><button type="button" className="rpp-thumb rpp-add" onClick={pick} aria-label="Add more media" data-testid="button-add-more"><Plus size={20} aria-hidden /></button></li>
      )}
    </ol>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) d.close(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="rpp-overlay" />
        <DialogPrimitive.Content className="rpp-modal" data-testid="dialog-create-post"
          onCloseAutoFocus={e => { const el = d.returnFocusRef.current; if (el && document.contains(el)) { e.preventDefault(); el.focus(); } }}>
          <header className="rpp-head">
            {stage === "review" ? (
              <button type="button" className="rpp-icon" onClick={() => d.setStage("pick")} aria-label="Back to media selection" data-testid="button-post-back"><ArrowLeft size={20} aria-hidden /></button>
            ) : (
              <DialogPrimitive.Close className="rpp-icon rpp-close-m" aria-label="Close and discard" data-testid="button-close-post-mobile"><X size={22} aria-hidden /></DialogPrimitive.Close>
            )}
            <DialogPrimitive.Title className="rpp-title" data-testid="text-post-title">
              {stage === "review" ? "Review post" : <><span className="rpp-t-d">Create new post</span><span className="rpp-t-m">New post</span></>}
            </DialogPrimitive.Title>
            <span className="rpp-head-r">
              {stage === "pick" && items.length > 0 && (
                <button type="button" className="rpp-next" onClick={() => d.setStage("review")}
                  disabled={nextBlocked} title={nextTitle} aria-describedby={nextBlocked ? "rpp-next-why" : undefined}
                  data-testid="button-post-next">Next</button>
              )}
              {stage === "review" && (
                <DialogPrimitive.Close className="rpp-icon rpp-close-m" aria-label="Close and discard" data-testid="button-close-post-review-mobile"><X size={22} aria-hidden /></DialogPrimitive.Close>
              )}
              <DialogPrimitive.Close className="rpp-icon rpp-close-d" aria-label="Close and discard" data-testid="button-close-post"><X size={20} aria-hidden /></DialogPrimitive.Close>
            </span>
          </header>

          <DialogPrimitive.Description className="rpp-sr">Choose up to {MAX_POST_ITEMS} photos or videos. Everything stays on this device; nothing is uploaded or published.</DialogPrimitive.Description>
          <input ref={inputRef} type="file" multiple accept={POST_MEDIA_ACCEPT} className="rpp-sr" tabIndex={-1} aria-hidden
            onChange={e => { d.addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} data-testid="input-post-media" />

          {errors.length > 0 && (
            <ul className="rpp-errors" role="alert" data-testid="status-post-errors">
              {errors.map((er, i) => <li key={i}>{er}</li>)}
            </ul>
          )}

          {stage === "pick" && items.length === 0 && (
            <div className={`rpp-drop${dragging ? " is-over" : ""}`} data-testid="dropzone-post-media"
              onDragEnter={e => { e.preventDefault(); setDragging(true); }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false); }}
              onDrop={onDrop}>
              <ImagePlus size={56} strokeWidth={1.25} aria-hidden />
              <p className="rpp-drop-h">Drag photos and videos here</p>
              <p className="rpp-drop-h-m">Choose photos and videos</p>
              <button type="button" className="rpp-yellow" onClick={pick} data-testid="button-select-media">
                <span className="rpp-t-d">Select from computer</span><span className="rpp-t-m">Choose from device</span>
              </button>
              <p className="rpp-limits" data-testid="text-media-limits">{POST_MEDIA_LIMITS_COPY}</p>
            </div>
          )}

          {stage === "pick" && items.length > 0 && current && (
            <div className="rpp-body" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
              {stageView}
              <div className="rpp-bar">
                {thumbs(true)}
                <div className="rpp-bar-row">
                  <span className="rpp-meta" data-testid="text-media-count">{items.length} of {MAX_POST_ITEMS} selected</span>
                  {nextBlocked && <span id="rpp-next-why" className="rpp-why" role="status" data-testid="status-next-blocked">{nextTitle}</span>}
                  <button type="button" className="rpp-remove" onClick={() => d.removeAt(active)} data-testid="button-remove-active">
                    <Trash2 size={15} aria-hidden /> Remove item {active + 1}
                  </button>
                </div>
              </div>
            </div>
          )}

          {stage === "review" && current && (
            <div className="rpp-review">
              <div className="rpp-review-media">{stageView}{thumbs(false)}</div>
              <div className="rpp-review-side">
                <label htmlFor="rpp-caption" className="rpp-label">Caption <span>(optional)</span></label>
                <textarea id="rpp-caption" className="rpp-caption" value={caption} maxLength={2200} rows={6}
                  onChange={e => d.setCaption(e.target.value)} placeholder="Say something about this…" data-testid="input-post-caption" />
                <div className="rpp-local" data-testid="status-post-local-only">
                  <strong>Draft only · not published</strong>
                  <p>Publishing supporter posts isn't available yet. Your {items.length} {items.length === 1 ? "item stays" : "items stay"} on this device only — nothing has been uploaded. Closing this window discards the draft.</p>
                </div>
              </div>
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
