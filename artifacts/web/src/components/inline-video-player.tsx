import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import "./inline-video-player.css";

let currentVideo: HTMLVideoElement | null = null;
const clock = (seconds: number) => Number.isFinite(seconds) && seconds >= 0
  ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}` : "0:00";

function playbackUrl(src: string): string {
  try {
    const url = new URL(src, window.location.href);
    // Older organisation uploads saved absolute public-site URLs. Serve the same
    // object through this app's range-capable proxy while reviewing in Preview.
    if (["rootprojx.com", "www.rootprojx.com"].includes(url.hostname)
      && url.pathname.startsWith("/api/uploads/object/org-media/")) return url.pathname;
  } catch { /* The video element will report an unsupported URL. */ }
  return src;
}

/** Uploaded footage stays in its card; the source is not requested until Play. */
export function InlineVideoPlayer({ src, poster, label = "video", className = "", style, mediaStyle, frameRef, muted = false, autoPlay = false, onLoadedMetadata, onError }: {
  src: string; poster?: string | null; label?: string; className?: string; style?: CSSProperties; mediaStyle?: CSSProperties;
  frameRef?: RefObject<HTMLDivElement | null>; muted?: boolean;
  /** Optional: start eagerly (with sound). A browser autoplay block leaves the Play button usable. */
  autoPlay?: boolean;
  onLoadedMetadata?: (video: HTMLVideoElement) => void; onError?: () => void;
}) {
  const ownFrame = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [silenced, setSilenced] = useState(muted);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const frame = frameRef ?? ownFrame;
  useEffect(() => {
    const video = videoRef.current;
    video?.pause();
    video?.removeAttribute("src");
    video?.load();
    setStarted(false); setPlaying(false); setFailed(false); setPosition(0); setDuration(0);
    // React may clear the DOM ref before passive unmount cleanup runs.
    return () => { if (currentVideo === video) currentVideo = null; video?.pause(); };
  }, [src]);
  useEffect(() => {
    const el = frame.current;
    if (!el || !started) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.25) videoRef.current?.pause();
    }, { threshold: [0, 0.25] });
    observer.observe(el);
    return () => observer.disconnect();
  }, [started, frame]);
  const play = async (auto = false) => {
    if (failed) return;
    const video = videoRef.current;
    if (!video) return;
    if (!started) { video.src = playbackUrl(src); setStarted(true); }
    if (currentVideo && currentVideo !== video) currentVideo.pause();
    currentVideo = video;
    try { await video.play(); } catch (e) {
      // Autoplay with sound may be refused by the browser; that is not a media failure.
      if ((e as { name?: string } | null)?.name === "NotAllowedError" || (auto && (e as { name?: string } | null)?.name === "AbortError")) return;
      setFailed(true); onError?.();
    }
  };
  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    if (!autoPlay) return;
    const t = window.setTimeout(() => { void playRef.current(true); }, 0);
    return () => window.clearTimeout(t);
  }, [autoPlay, src]);
  const toggle = () => { if (videoRef.current && !videoRef.current.paused) videoRef.current.pause(); else void play(); };
  const fullScreen = () => {
    const element = frame.current;
    const video = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (element?.requestFullscreen) void element.requestFullscreen();
    else video?.webkitEnterFullscreen?.();
  };
  return (
    <div ref={frameRef ? undefined : ownFrame} className={`rp-inline-video ${className}`} style={style} data-testid="inline-video-player">
      <video ref={videoRef} poster={poster ?? undefined} preload="none" playsInline
          muted={muted} className="rp-inline-video-media" style={{ ...mediaStyle, visibility: started && !failed ? "visible" : "hidden" }}
          onClick={toggle} onPlay={() => { setPlaying(true); setSilenced(videoRef.current?.muted ?? false); }}
          onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onTimeUpdate={e => setPosition(e.currentTarget.currentTime)}
          onDurationChange={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
          onLoadedMetadata={e => onLoadedMetadata?.(e.currentTarget)}
          onError={() => { setFailed(true); onError?.(); }} aria-label={label} />
      {!started && poster && !failed ? <img src={poster} alt="" loading="lazy" className="rp-inline-video-poster" style={mediaStyle} /> : null}
      {failed ? <p className="rp-inline-video-error" role="alert">This video can't play right now</p> : !playing ? (
        <button type="button" className="rp-inline-video-start" onClick={toggle} aria-label={`Play ${label}`}>
          <span><Play size={23} fill="currentColor" aria-hidden /></span>
        </button>
      ) : null}
      {started && !failed && <div className="rp-inline-video-controls" onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
        <button type="button" onClick={toggle} aria-label={playing ? `Pause ${label}` : `Play ${label}`}><span aria-hidden>{playing ? <Pause size={17} /> : <Play size={17} />}</span></button>
        <span>{clock(position)}</span>
        <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(position, duration || 0)} disabled={!duration}
          aria-label={`Seek ${label}`} onChange={e => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }} />
        <span>{clock(duration)}</span>
        <button type="button" onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setSilenced(videoRef.current.muted); } }}
          aria-label={silenced ? "Unmute" : "Mute"}>{silenced ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
        <button type="button" onClick={fullScreen} aria-label="Full screen"><Maximize size={17} /></button>
      </div>}
    </div>
  );
}
