import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { OwnerPostDetails } from "@workspace/api-client-react";
import "./ChangeCoverDialog.css";

export interface ChangeCoverDialogProps {
  post: OwnerPostDetails;
  neighbours?: { url: string }[];
  onSave: (file: File) => Promise<void>;
  onClose: () => void;
}

export const COVER_W = 1080;
export const COVER_H = 1350;
const FRAMES = 7;
const SEEK_TIMEOUT = 8000;
const MIN_ZOOM = 1, MAX_ZOOM = 3;

export type Crop = { zoom: number; x: number; y: number };
export type SourceRect = { sx: number; sy: number; sw: number; sh: number };

/**
 * Pure crop math: object-fit "cover" of a srcW×srcH source into a 4:5 frame,
 * then zoomed (1–3) and positioned. x/y run -1 (left/top edge) to 1 (right/bottom edge).
 */
export function coverSourceRect(srcW: number, srcH: number, crop: Crop, aspect = COVER_W / COVER_H): SourceRect {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, crop.zoom || 1));
  let sw: number, sh: number;
  if (srcW / srcH > aspect) { sh = srcH; sw = srcH * aspect; } else { sw = srcW; sh = srcW / aspect; }
  sw /= zoom; sh /= zoom;
  const cx = Math.min(1, Math.max(-1, crop.x)), cy = Math.min(1, Math.max(-1, crop.y));
  const sx = (srcW - sw) / 2 + cx * (srcW - sw) / 2;
  const sy = (srcH - sh) / 2 + cy * (srcH - sh) / 2;
  return { sx, sy, sw, sh };
}

export function defaultCoverTime(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? Math.min(1, duration) : 0;
}

function playbackUrl(src: string): string {
  try {
    const url = new URL(src, window.location.href);
    if (["rootprojx.com", "www.rootprojx.com"].includes(url.hostname) && url.pathname.startsWith("/api/uploads/object/org-media/")) return url.pathname;
  } catch { /* leave as-is */ }
  return src;
}

type Drawable = { el: CanvasImageSource; w: number; h: number };

function draw(canvas: HTMLCanvasElement | null, src: Drawable | null, crop: Crop) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#17100F";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!src || !src.w || !src.h) return;
  const r = coverSourceRect(src.w, src.h, crop);
  ctx.drawImage(src.el, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height);
}

function makeVideo(url: string): HTMLVideoElement {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("playsinline", "");
  v.src = url;
  return v;
}
function disposeVideo(v: HTMLVideoElement | null) {
  if (!v) return;
  v.pause(); v.removeAttribute("src"); v.load();
}

function waitFor(v: HTMLVideoElement, event: "loadeddata" | "seeked", signal: { cancelled: boolean }): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => done(new Error("timeout")), SEEK_TIMEOUT);
    const ok = () => done();
    const bad = () => done(new Error("media"));
    function done(err?: Error) {
      window.clearTimeout(t);
      v.removeEventListener(event, ok); v.removeEventListener("error", bad);
      if (signal.cancelled) reject(new Error("cancelled")); else if (err) reject(err); else resolve();
    }
    v.addEventListener(event, ok, { once: true });
    v.addEventListener("error", bad, { once: true });
  });
}
async function seek(v: HTMLVideoElement, t: number, signal: { cancelled: boolean }) {
  if (Math.abs(v.currentTime - t) < 0.01 && v.readyState >= 2) return;
  const p = waitFor(v, "seeked", signal);
  v.currentTime = t;
  await p;
}
function isTainted(v: HTMLVideoElement): boolean {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const ctx = c.getContext("2d"); if (!ctx) return true;
    ctx.drawImage(v, 0, 0, 1, 1); ctx.getImageData(0, 0, 1, 1); return false;
  } catch { return true; }
}

type VideoState = "loading" | "ready" | "blocked" | "failed" | "none";
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function ChangeCoverDialog({ post, neighbours = [], onSave, onClose }: ChangeCoverDialogProps) {
  const videoMedia = post.media.find(m => m.type === "video") ?? null;
  const [tab, setTab] = useState<"video" | "upload">(videoMedia ? "video" : "upload");
  const [vState, setVState] = useState<VideoState>(videoMedia ? "loading" : "none");
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [frames, setFrames] = useState<(string | null)[]>(() => Array(FRAMES).fill(null));
  const [videoCrop, setVideoCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [imgCrop, setImgCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [image, setImage] = useState<{ el: HTMLImageElement; url: string; name: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);

  const mainVideo = useRef<HTMLVideoElement | null>(null);
  const bigRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const dlgRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const seekSeq = useRef(0);
  const signal = useRef({ cancelled: false });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const savingRef = useRef(saving);
  savingRef.current = saving;

  const crop = tab === "video" ? videoCrop : imgCrop;
  const setCrop = tab === "video" ? setVideoCrop : setImgCrop;

  const source = useCallback((): Drawable | null => {
    if (tab === "upload") return image ? { el: image.el, w: image.el.naturalWidth, h: image.el.naturalHeight } : null;
    const v = mainVideo.current;
    return v && vState === "ready" && frameReady ? { el: v, w: v.videoWidth, h: v.videoHeight } : null;
  }, [tab, image, vState, frameReady]);

  const redraw = useCallback(() => {
    const s = source();
    draw(bigRef.current, s, crop);
    draw(miniRef.current, s, crop);
    if (tab === "video") draw(selRef.current, s, { zoom: 1, x: 0, y: 0 });
  }, [source, crop, tab]);
  useEffect(() => { redraw(); }, [redraw]);

  // Load the main (selection) video and extract filmstrip frames from a second element.
  useEffect(() => {
    if (!videoMedia) return;
    const sig = { cancelled: false };
    signal.current = sig;
    const url = playbackUrl(videoMedia.url);
    const main = makeVideo(url);
    mainVideo.current = main;
    let strip: HTMLVideoElement | null = null;
    const made: string[] = [];
    (async () => {
      try {
        await waitFor(main, "loadeddata", sig);
        if (isTainted(main)) { setVState("blocked"); return; }
        const d = main.duration;
        if (!Number.isFinite(d) || d <= 0) { setVState("failed"); return; }
        setDuration(d);
        const t0 = defaultCoverTime(d);
        await seek(main, t0, sig);
        setTime(t0); setFrameReady(true); setVState("ready");

        strip = makeVideo(url);
        await waitFor(strip, "loadeddata", sig);
        const c = document.createElement("canvas");
        c.width = 96; c.height = 120;
        for (let i = 0; i < FRAMES; i++) {
          if (sig.cancelled) return;
          const t = Math.min(d - 0.05, (d * (i + 0.5)) / FRAMES);
          await seek(strip, Math.max(0, t), sig);
          draw(c, { el: strip, w: strip.videoWidth, h: strip.videoHeight }, { zoom: 1, x: 0, y: 0 });
          const blob = await new Promise<Blob | null>(r => c.toBlob(r, "image/jpeg", 0.7));
          if (sig.cancelled || !blob) return;
          const u = URL.createObjectURL(blob); made.push(u);
          setFrames(f => { const n = f.slice(); n[i] = u; return n; });
        }
      } catch (e) {
        if (sig.cancelled) return;
        setVState(s => (s === "ready" ? s : (e as Error).message === "timeout" ? "failed" : isTainted(main) ? "blocked" : "failed"));
      } finally {
        disposeVideo(strip);
      }
    })();
    return () => {
      sig.cancelled = true;
      disposeVideo(main); mainVideo.current = null;
      made.forEach(u => URL.revokeObjectURL(u));
    };
  }, [videoMedia?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke uploaded image object URL when replaced/unmounted.
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const selectTime = useCallback(async (t: number) => {
    const v = mainVideo.current;
    if (!v || vState !== "ready") return;
    const clamped = Math.max(0, Math.min(duration - 0.05, t));
    setTime(clamped);
    const seq = ++seekSeq.current;
    try {
      await seek(v, clamped, signal.current);
      if (seq === seekSeq.current) { setFrameReady(true); redrawRef.current(); }
    } catch { /* superseded or cancelled */ }
  }, [vState, duration]);
  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  const stripTimeFromX = (clientX: number) => {
    const r = stripRef.current?.getBoundingClientRect();
    if (!r || !duration) return 0;
    return ((clientX - r.left) / r.width) * duration;
  };
  const stripDrag = useRef(false);
  const onStripDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (vState !== "ready") return;
    stripDrag.current = true; e.currentTarget.setPointerCapture(e.pointerId);
    selectTime(stripTimeFromX(e.clientX));
  };
  const onStripMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (stripDrag.current) selectTime(stripTimeFromX(e.clientX)); };
  const onStripUp = () => { stripDrag.current = false; };
  const onStripKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = duration / 50 || 0.1;
    const map: Record<string, number> = { ArrowRight: time + step, ArrowUp: time + step, ArrowLeft: time - step, ArrowDown: time - step, Home: 0, End: duration, PageUp: time + duration / 10, PageDown: time - duration / 10 };
    if (e.key in map) { e.preventDefault(); selectTime(map[e.key]!); }
  };

  // Drag to pan on the big preview.
  const pan = useRef<{ x: number; y: number; c: Crop } | null>(null);
  const onBigDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!source()) return;
    pan.current = { x: e.clientX, y: e.clientY, c: crop };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBigMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pan.current; if (!p) return;
    const r = e.currentTarget.getBoundingClientRect();
    const k = 2; // dragging the full preview width sweeps the full position range
    setCrop({ ...p.c, x: Math.max(-1, Math.min(1, p.c.x - ((e.clientX - p.x) / r.width) * k)), y: Math.max(-1, Math.min(1, p.c.y - ((e.clientY - p.y) / r.height) * k)) });
  };
  const onBigUp = () => { pan.current = null; };

  const pickFile = (file: File | undefined) => {
    setUploadError(null); setSaveError(null);
    if (!file) return;
    if (file.type !== "image/jpeg" && file.type !== "image/png") { setUploadError("Choose a JPG or PNG image."); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < COVER_W || img.naturalHeight < COVER_H) {
        URL.revokeObjectURL(url);
        setUploadError(`This image is ${img.naturalWidth} × ${img.naturalHeight}. Covers need to be at least 1080 × 1350.`);
        return;
      }
      setImage({ el: img, url, name: file.name });
      setImgCrop({ zoom: 1, x: 0, y: 0 });
      setTab("upload");
    };
    img.onerror = () => { URL.revokeObjectURL(url); setUploadError("That image couldn't be opened. Try another JPG or PNG."); };
    img.src = url;
  };

  const canSave = !saving && !!source();
  const save = async () => {
    const s = source();
    if (!s || saving) return;
    setSaving(true); setSaveError(null);
    let file: File;
    try {
      const c = document.createElement("canvas"); c.width = COVER_W; c.height = COVER_H;
      draw(c, s, crop);
      const blob = await new Promise<Blob | null>((res, rej) => { try { c.toBlob(res, "image/jpeg", 0.9); } catch (e) { rej(e); } });
      if (!blob || blob.size === 0) throw new Error("empty");
      file = new File([blob], `cover-${post.id}.jpg`, { type: "image/jpeg" });
    } catch {
      setSaving(false);
      if (tab === "video") setVState("blocked");
      setSaveError("We couldn't create a cover from this video. Upload an image instead.");
      return;
    }
    try {
      await onSave(file);
      setSaving(false);
      onClose();
    } catch {
      setSaving(false);
      setSaveError("Your cover wasn't saved.");
    }
  };

  // Focus management + capture Escape so the viewer below stays open.
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    backRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault(); e.stopPropagation();
      if (!savingRef.current) closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      const el = restoreRef.current;
      if (el && document.contains(el)) requestAnimationFrame(() => el.focus({ preventScroll: true }));
    };
  }, []);

  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key !== "Tab" || !dlgRef.current) return;
    const f = Array.from(dlgRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!f.length) return;
    const first = f[0]!, last = f[f.length - 1]!;
    if (!dlgRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const slots = Array.from({ length: 5 }, (_, i) => neighbours[i] ?? null);
  const hasSource = !!source();
  const videoUnavailable = tab === "video" && (vState === "blocked" || vState === "failed" || vState === "none");

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="ccd-layer" onClick={stop} onPointerDown={stop} onTouchStart={stop} onTouchEnd={stop} onKeyDown={trap}>
      <div className="ccd-scrim" aria-hidden onClick={() => { if (!saving) onClose(); }} data-testid="overlay-change-cover" />
      <div ref={dlgRef} className="ccd-dlg" role="dialog" aria-modal="true" aria-labelledby="ccd-title" data-testid="dialog-change-cover">
        <div className="ccd-dh">
          <button ref={backRef} type="button" className="ccd-lnk" onClick={onClose} disabled={saving} data-testid="button-cover-back"><ChevronLeft size={18} aria-hidden />Back</button>
          <h2 id="ccd-title" className="ccd-h">Change cover</h2>
          <button type="button" className="ccd-done" onClick={save} disabled={!canSave} aria-busy={saving} data-testid="button-save-cover">
            {saving && <Loader2 className="ccd-spin" size={16} aria-hidden />}Save cover
          </button>
        </div>
        <div className="ccd-cv">
          <div className="ccd-cvm">
            <div className={`ccd-big${hasSource ? "" : " empty"}`} onPointerDown={onBigDown} onPointerMove={onBigMove} onPointerUp={onBigUp} onPointerCancel={onBigUp}
              role="img" aria-label={hasSource ? "Cover preview. Drag to reposition." : "Cover preview"} data-testid="preview-cover">
              <canvas ref={bigRef} width={432} height={540} />
              {tab === "video" && vState === "loading" && <div className="ccd-skel" aria-hidden />}
              {videoUnavailable && (
                <div className="ccd-msg" role="status" data-testid="status-video-unavailable">
                  <span>{vState === "none" ? "This post has no video." : vState === "blocked" ? "Frames can't be read from this video." : "This video couldn't be loaded for frame picking."}</span>
                  <button type="button" className="ccd-alt" onClick={() => setTab("upload")} data-testid="button-switch-upload">Upload image</button>
                </div>
              )}
              {tab === "upload" && !image && <div className="ccd-msg"><span>Choose a JPG or PNG to use as the cover.</span></div>}
              <span className="ccd-chip">Cover</span>
            </div>

            {tab === "video" && vState !== "none" && vState !== "blocked" && vState !== "failed" && (
              <>
                <div ref={stripRef} className="ccd-strip" role="slider" tabIndex={vState === "ready" ? 0 : -1}
                  aria-label="Pick a frame" aria-valuemin={0} aria-valuemax={Math.round(duration * 10) / 10} aria-valuenow={Math.round(time * 10) / 10}
                  aria-valuetext={fmtTime(time)} aria-disabled={vState !== "ready"}
                  onPointerDown={onStripDown} onPointerMove={onStripMove} onPointerUp={onStripUp} onPointerCancel={onStripUp} onKeyDown={onStripKey} data-testid="slider-cover-frame">
                  {frames.map((u, i) => <i key={i} className={u ? "" : "wait"} style={u ? { backgroundImage: `url("${u}")` } : undefined} aria-hidden />)}
                  {vState === "ready" && <span className="ccd-sel" style={{ left: `${duration ? (time / duration) * 100 : 0}%` }}><canvas ref={selRef} width={58} height={72} /></span>}
                </div>
                <p className="ccd-note">Drag along the video to choose a frame. <span className="ccd-time" data-testid="text-cover-time">{fmtTime(time)}</span></p>
              </>
            )}
          </div>

          <div className="ccd-side">
            <div className="ccd-tabs" role="tablist" aria-label="Cover source">
              <button type="button" role="tab" aria-selected={tab === "video"} disabled={!videoMedia} onClick={() => setTab("video")} data-testid="tab-cover-video">From video</button>
              <button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")} data-testid="tab-cover-upload">Upload image</button>
            </div>

            <div>
              <div className="ccd-lbl">How it looks on your profile</div>
              <div className="ccd-grid" data-testid="grid-cover-preview">
                <canvas ref={miniRef} className="me" width={120} height={150} aria-label="Your new cover" role="img" />
                {slots.map((n, i) => n ? <img key={i} src={n.url} alt="" loading="lazy" /> : <span key={i} aria-hidden />)}
              </div>
            </div>

            <p className="ccd-note">Covers show on your profile grid (4:5) and in the feed before the video plays.</p>

            {hasSource && (
              <div className="ccd-crop" data-testid="controls-cover-crop">
                <label>Zoom<input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={crop.zoom} onChange={e => setCrop({ ...crop, zoom: Number(e.target.value) })} data-testid="input-cover-zoom" /></label>
                <label>Left / right<input type="range" min={-1} max={1} step={0.01} value={crop.x} onChange={e => setCrop({ ...crop, x: Number(e.target.value) })} data-testid="input-cover-x" /></label>
                <label>Up / down<input type="range" min={-1} max={1} step={0.01} value={crop.y} onChange={e => setCrop({ ...crop, y: Number(e.target.value) })} data-testid="input-cover-y" /></label>
              </div>
            )}

            <label className="ccd-up" data-testid="dropzone-cover-upload">
              {tab === "video" ? "Or upload an image instead" : image ? "Choose a different image" : "Upload an image"}
              <small>{image && tab === "upload" ? image.name : "JPG or PNG, at least 1080 × 1350"}</small>
              <input type="file" accept="image/jpeg,image/png" onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-cover-file" />
            </label>
            {uploadError && <p className="ccd-err" role="alert" data-testid="text-cover-upload-error">{uploadError}</p>}
            {saveError && (
              <p className="ccd-err" role="alert" data-testid="text-cover-save-error">
                {saveError}
                {hasSource && <button type="button" onClick={save} data-testid="button-retry-cover">Retry</button>}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
