import "./PostMediaCarousel.css";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InlineVideoPlayer } from "@/components/inline-video-player";
import { EditedMedia } from "@/components/supporter/EditedMedia";
import { aspectRatio, type MediaEdit } from "@/lib/supporter-post-media";

export type PostMediaCarouselItem = {
  id?: string; url: string; type: "image" | "video"; thumbnailUrl?: string | null; edit?: MediaEdit; natural?: number | null;
};

export type PostMediaCarouselProps = {
  items: PostMediaCarouselItem[]; label: string; className?: string; onOpen?: (trigger: HTMLElement) => void;
};

/** Feed media: one active slide, swipe/arrows/dots, steady frame. Videos run in feed mode. */
export function PostMediaCarousel({ items, label, className = "", onOpen }: PostMediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const count = items.length;
  const i = Math.min(index, Math.max(0, count - 1));
  if (!count) return null;
  const item = items[i];
  const cropped = items.find(m => m.edit && m.edit.crop.aspect !== "original");
  const ratio = cropped?.edit ? aspectRatio(cropped.edit.crop.aspect, cropped.natural ?? null) : 4 / 3;
  const go = (n: number) => setIndex(Math.max(0, Math.min(count - 1, n)));
  const slideLabel = count > 1 ? `${label}, ${i + 1} of ${count}` : label;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current; start.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) go(i + (dx < 0 ? 1 : -1));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  };

  const key = item.id ?? `${i}-${item.url}`;
  const media = item.edit ? (
    <EditedMedia key={key} src={item.url} kind={item.type} edit={item.edit} natural={item.natural ?? null} fit="contain"
      controls={item.type === "video"} feed={item.type === "video"} poster={item.thumbnailUrl} alt={slideLabel} />
  ) : item.type === "video" ? (
    <InlineVideoPlayer key={key} src={item.url} poster={item.thumbnailUrl} label={slideLabel} feed active />
  ) : (
    <img key={key} src={item.url} alt={slideLabel} loading="lazy" draggable={false} className="rp-pmc-img" />
  );

  return (
    <div className={`rp-pmc ${className}`} role="region" aria-roledescription="carousel" aria-label={label} data-testid="carousel-post-media">
      <div className="rp-pmc-stage" style={{ aspectRatio: String(ratio) }} tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { start.current = null; }}>
        <div className="rp-pmc-slide" key={key} role="group" aria-roledescription="slide" aria-label={slideLabel}>
          {item.type === "image" && onOpen ? (
            <button type="button" className="rp-pmc-img-btn" aria-label={`Open ${slideLabel}`} data-testid={`button-open-media-${i}`}
              onClick={e => onOpen(e.currentTarget)}
              style={item.edit ? { display: "grid", placeItems: "center", containerType: "size" } : undefined}>{media}</button>
          ) : media}
        </div>
        {count > 1 ? <span className="rp-pmc-count" data-testid="text-media-count">{i + 1}/{count}</span> : null}
        {count > 1 && i > 0 ? (
          <button type="button" className="rp-pmc-arrow rp-pmc-arrow--prev" onClick={() => go(i - 1)} aria-label="Previous item" data-testid="button-media-prev">
            <ChevronLeft size={18} aria-hidden />
          </button>
        ) : null}
        {count > 1 && i < count - 1 ? (
          <button type="button" className="rp-pmc-arrow rp-pmc-arrow--next" onClick={() => go(i + 1)} aria-label="Next item" data-testid="button-media-next">
            <ChevronRight size={18} aria-hidden />
          </button>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="rp-pmc-dots">
          {items.map((m, n) => (
            <button key={m.id ?? `${n}-${m.url}`} type="button" className="rp-pmc-dot" aria-label={`Show item ${n + 1} of ${count}`}
              aria-current={n === i ? "true" : undefined} onClick={() => go(n)} data-testid={`button-media-dot-${n}`}><span /></button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default PostMediaCarousel;
