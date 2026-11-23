import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import "./inline-video-player.css";

let currentVideo: HTMLVideoElement | null = null;
let openViewers = 0;
/** A modal viewer owns playback even when its background feed is still mounted. */
export function holdFeedPlayback() {
  openViewers++;
  currentVideo?.pause();
  window.dispatchEvent(new Event("rp-viewer-playback"));
  return () => {
    openViewers = Math.max(0, openViewers - 1);
    window.dispatchEvent(new Event("rp-viewer-playback"));
  };
}
const SOUND_KEY = "rp-feed-sound";
/** Session-wide feed sound preference; null until the person explicitly changes it. */
let feedSoundPref: boolean | null = (() => { try { const v = sessionStorage.getItem(SOUND_KEY); return v === null ? null : v === "1"; } catch { return null; } })();
const feedSoundOn = () => feedSoundPref === true;
function setFeedSound(on: boolean) { feedSoundPref = on; try { sessionStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch { /* private mode */ } }
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
export function InlineVideoPlayer({ src, poster, label = "video", className = "", style, mediaStyle, frameRef, muted = false, autoPlay = false, feed = false, active = true, onLoadedMetadata, onError }: {
  src: string; poster?: string | null; label?: string; className?: string; style?: CSSProperties; mediaStyle?: CSSProperties;
  frameRef?: RefObject<HTMLDivElement | null>; muted?: boolean;
  /** Optional: start eagerly (with sound). A browser autoplay block leaves the Play button usable. */
  autoPlay?: boolean;
  /** Feed mode: muted visibility-driven autoplay, loop, tap to pause, small sound toggle only. */
  feed?: boolean;
  /** Feed mode: false pauses (e.g. an inactive carousel slide). */
  active?: boolean;
  onLoadedMetadata?: (video: HTMLVideoElement) => void; onError?: () => void;
}) {
  const ownFrame = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [silenced, setSilenced] = useState(feed ? !feedSoundOn() : muted);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const frame = frameRef ?? ownFrame;
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [feedSuspended, setFeedSuspended] = useState(openViewers > 0);
  const [userPaused, setUserPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [flash, setFlash] = useState<{ kind: "pause" | "play"; n: number } | null>(null);
  const mounted = useRef(true);
  const wantPlay = useRef(false);
  wantPlay.current = feed && visible && active && pageVisible && !feedSuspended && !userPaused;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
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
    if (!el || !started || feed) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.25) videoRef.current?.pause();
    }, { threshold: [0, 0.25] });
    observer.observe(el);
    return () => observer.disconnect();
  }, [started, frame, feed]);
  useEffect(() => {
    const el = frame.current;
    if (!feed || !el) return;
    const observer = new IntersectionObserver(([entry]) => {
      const on = entry.isIntersecting && entry.intersectionRatio >= 0.6;
      setVisible(on);
      if (!on) setUserPaused(false);
    }, { threshold: [0, 0.6, 1] });
    observer.observe(el);
    return () => observer.disconnect();
  }, [feed, frame]);
  useEffect(() => {
    if (!feed) return;
    const sync = () => setFeedSuspended(openViewers > 0);
    sync();
    window.addEventListener("rp-viewer-playback", sync);
    return () => window.removeEventListener("rp-viewer-playback", sync);
  }, [feed]);
  useEffect(() => {
    if (!feed) return;
    const on = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [feed]);
  const play = async (auto = false) => {
    if (failed) return;
    const video = videoRef.current;
    if (!video) return;
    if (!started) { video.src = playbackUrl(src); setStarted(true); }
    if (currentVideo && currentVideo !== video) currentVideo.pause();
    currentVideo = video;
    if (feed) video.muted = !feedSoundOn();
    try {
      await video.play();
      if (!mounted.current || (feed && !wantPlay.current)) video.pause();
      else if (feed) setBlocked(false);
    } catch (e) {
      if (feed && (e as { name?: string } | null)?.name === "NotAllowedError") { if (mounted.current) setBlocked(true); return; }
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
  useEffect(() => {
    if (!feed) return;
    const video = videoRef.current;
    if (!video) return;
    if (visible && active && pageVisible && !feedSuspended && !userPaused && !failed) void playRef.current(true);
    else video.pause();
    return () => { if (!wantPlay.current) video.pause(); };
  }, [feed, visible, active, pageVisible, feedSuspended, userPaused, failed, src]);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 650);
    return () => window.clearTimeout(t);
  }, [flash]);
  const feedToggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) { setUserPaused(true); video.pause(); setFlash(f => ({ kind: "pause", n: (f?.n ?? 0) + 1 })); }
    else { setUserPaused(false); setFlash(f => ({ kind: "play", n: (f?.n ?? 0) + 1 })); void play(); }
  };
  const feedSound = () => {
    const video = videoRef.current;
    const on = silenced;
    setFeedSound(on);
    setSilenced(!on);
    if (video) video.muted = !on;
  };
  const toggle = () => { if (videoRef.current && !videoRef.current.paused) videoRef.current.pause(); else void play(); };
  const fullScreen = () => {
    const element = frame.current;
    const video = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (element?.requestFullscreen) void element.requestFullscreen();
    else video?.webkitEnterFullscreen?.();
  };
  if (feed) return (
    <div ref={frameRef ? undefined : ownFrame} className={`rp-inline-video rp-inline-video--feed ${className}`} style={style} data-testid="inline-video-player">
      <video ref={videoRef} poster={poster ?? undefined} preload="none" playsInline loop muted
          className="rp-inline-video-media" style={{ ...mediaStyle, visibility: started && !failed ? "visible" : "hidden" }}
          onClick={e => { e.stopPropagation(); feedToggle(); }}
          onPlay={() => { setPlaying(true); setSilenced(videoRef.current?.muted ?? true); }}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={e => onLoadedMetadata?.(e.currentTarget)}
          onError={() => { setFailed(true); onError?.(); }} aria-label={label} />
      {!started && poster && !failed ? <img src={poster} alt="" loading="lazy" className="rp-inline-video-poster" style={mediaStyle} /> : null}
      {failed ? <p className="rp-inline-video-error" role="alert">This video can't play right now</p> : null}
      {!failed && flash ? <span key={flash.n} className="rp-feed-flash" aria-hidden>{flash.kind === "pause" ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</span> : null}
      {!failed && blocked && !playing ? (
        <button type="button" className="rp-feed-fallback" data-testid="button-feed-video-play"
          onClick={e => { e.stopPropagation(); setUserPaused(false); setBlocked(false); void play(); }} aria-label={`Play ${label}`}>
          <Play size={14} fill="currentColor" aria-hidden /><span>Play</span>
        </button>
      ) : null}
      {!failed && started ? (
        <button type="button" className="rp-feed-sound" data-testid="button-feed-video-sound"
          onClick={e => { e.stopPropagation(); feedSound(); }} aria-pressed={!silenced} aria-label={silenced ? `Turn sound on for ${label}` : `Mute ${label}`}>
          {silenced ? <VolumeX size={15} aria-hidden /> : <Volume2 size={15} aria-hidden />}
        </button>
      ) : null}
      <span className="sr-only" aria-live="polite">{playing ? "" : started ? "Paused" : ""}</span>
    </div>
  );
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
