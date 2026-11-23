import { useRef, type ReactNode, type SyntheticEvent } from "react";
import { aspectRatio, editMediaStyle, type MediaEdit } from "@/lib/supporter-post-media";
import { InlineVideoPlayer } from "@/components/inline-video-player";

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
      {kind === "video" && controls ? (
        <InlineVideoPlayer src={src} poster={poster} frameRef={frameRef} label={label}
          className="rpp-frame-media" mediaStyle={style} muted={muted} onError={onBroken}
          onLoadedMetadata={el => onReady?.(el.videoWidth && el.videoHeight ? el.videoWidth / el.videoHeight : null, el.duration)} />
      ) : kind === "video" ? (
        <>
          <video key={src} src={src} poster={poster ?? undefined} playsInline muted={muted} preload="metadata"
            className="rpp-frame-media" style={style} onLoadedMetadata={onVid} onError={onBroken} aria-label={alt || "Video"}
          />
        </>
      ) : (
        <img key={src} src={src} alt={alt} className="rpp-frame-media" style={style} onLoad={onImg} onError={onBroken} draggable={false} />
      )}
      {children}
    </div>
  );
}
