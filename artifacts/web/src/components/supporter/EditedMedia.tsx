import { useEffect, useRef, useState, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { Pause, Play, Volume2, VolumeX, Maximize } from "lucide-react";
import { aspectRatio, editMediaStyle, type MediaEdit } from "@/lib/supporter-post-media";

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60), x = Math.floor(s % 60);
  return `${m}:${String(x).padStart(2, "0")}`;
};

/**
 * Accessible play/pause, seek, mute and fullscreen controls. They sit in the frame but outside the
 * transformed <video>, so crop and zoom can never clip or scale them.
 */
function VideoControls({ video, frameRef, label }: { video: HTMLVideoElement | null; frameRef: RefObject<HTMLDivElement | null>; label: string }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  useEffect(() => {
    if (!video) return;
    const sync = () => {
      setPlaying(!video.paused && !video.ended); setMuted(video.muted);
      setT(video.currentTime); setDur(Number.isFinite(video.duration) ? video.duration : 0);
    };
    const evs = ["play", "pause", "ended", "timeupdate", "durationchange", "loadedmetadata", "volumechange", "seeked"];
    evs.forEach(e => video.addEventListener(e, sync));
    sync();
    return () => evs.forEach(e => video.removeEventListener(e, sync));
  }, [video]);
  if (!video) return null;
  const toggle = () => { if (video.paused || video.ended) void video.play().catch(() => undefined); else video.pause(); };
  const frame = frameRef.current;
  const pct = dur ? (t / dur) * 100 : 0;
  const canFs = typeof document !== "undefined" && !!(frame?.requestFullscreen || (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen);
  const fullscreen = () => {
    const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else if (frame?.requestFullscreen) void frame.requestFullscreen().catch(() => undefined);
    else v.webkitEnterFullscreen?.();
  };
  return (
    <div className="rpp-vc" onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
      <button type="button" className="rpp-vc-b" onClick={toggle} aria-label={playing ? `Pause ${label}` : `Play ${label}`} data-testid="button-video-play">
        {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
      </button>
      <span className="rpp-vc-t" aria-hidden>{fmt(t)}</span>
      <input type="range" className="rpp-vc-seek" min={0} max={dur || 0} step={0.1} value={Math.min(t, dur || 0)} disabled={!dur}
        style={{ ["--p" as string]: `${pct}%` }} aria-label={`Seek ${label}`} aria-valuetext={`${fmt(t)} of ${fmt(dur)}`}
        onChange={e => { video.currentTime = Number(e.target.value); setT(Number(e.target.value)); }} data-testid="input-video-seek" />
      <span className="rpp-vc-t" aria-hidden>{fmt(dur)}</span>
      <button type="button" className="rpp-vc-b" onClick={() => { video.muted = !video.muted; }} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} data-testid="button-video-mute">
        {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
      </button>
      {canFs && (
        <button type="button" className="rpp-vc-b" onClick={fullscreen} aria-label="Full screen" data-testid="button-video-fullscreen"><Maximize size={15} aria-hidden /></button>
      )}
    </div>
  );
}

/**
 * Renders a photo or video through its saved non-destructive edit (crop frame, zoom/pan, filter, adjustments).
 * The original binary is untouched; the same renderer is used in the editor and in feeds.
 * fit="contain" sizes the frame to fit inside a container with container-type: size.
 * Videos never use native controls (they would be transformed and clipped with the media); custom controls
 * are rendered as an untransformed sibling instead.
 */
export function EditedMedia({
  src, kind, edit, natural, fit = "width", controls = false, poster, alt = "", muted, className = "",
  onReady, onBroken, children, testId,
}: {
  src: string; kind: "image" | "video" | "photo"; edit: MediaEdit; natural: number | null;
  fit?: "width" | "contain"; controls?: boolean; poster?: string | null; alt?: string; muted?: boolean; className?: string;
  onReady?: (natural: number | null, duration?: number) => void; onBroken?: () => void; children?: ReactNode; testId?: string;
}) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const r = aspectRatio(edit.crop.aspect, natural);
  const frame = fit === "contain"
    ? { aspectRatio: String(r), width: `min(100cqw, calc(100cqh * ${r}))` }
    : { aspectRatio: String(r), width: "100%" };
  const style = editMediaStyle(edit);
  const onImg = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget; onReady?.(el.naturalWidth && el.naturalHeight ? el.naturalWidth / el.naturalHeight : null);
  };
  const onVid = (e: SyntheticEvent<HTMLVideoElement>) => {
    const el = e.currentTarget; onReady?.(el.videoWidth && el.videoHeight ? el.videoWidth / el.videoHeight : null, el.duration);
  };
  const label = alt || "video";
  return (
    <div ref={frameRef} className={`rpp-frame ${className}`} style={frame} data-testid={testId}>
      {kind === "video" ? (
        <>
          <video key={src} ref={setVideo} src={src} poster={poster ?? undefined} playsInline muted={muted} preload="metadata"
            className="rpp-frame-media" style={style} onLoadedMetadata={onVid} onError={onBroken} aria-label={alt || "Video"}
            onClick={controls ? e => { const v = e.currentTarget; if (v.paused) void v.play().catch(() => undefined); else v.pause(); } : undefined} />
          {controls && <VideoControls video={video} frameRef={frameRef} label={label} />}
        </>
      ) : (
        <img key={src} src={src} alt={alt} className="rpp-frame-media" style={style} onLoad={onImg} onError={onBroken} draggable={false} />
      )}
      {children}
    </div>
  );
}
