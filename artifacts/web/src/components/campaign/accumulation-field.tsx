import { useEffect, useId, useMemo, useRef, useState } from "react";
import { accumulationProgress, hitSupporterUnit, supporterUnitName, type SupporterUnitPosition } from "@/lib/supporter-unit-hit";
import { DonationHand } from "@/components/donation-hand";
import { layoutHandWall, safeHandCount } from "@/lib/hand-wall-layout";

const NO_SUPPORTERS: { displayName: string; createdAt?: string }[] = [];

/** Generic campaigns: draw at most this many units individually; the rest become "mass". Handprint walls draw every hand. */
export const MAX_DRAWN = 300;

export interface AccumulationFieldProps {
  count: number;
  unitSingular: string;
  unitPlural: string;
  imageUrl: string | null;
  /** Out of Many Hands: tint the shared SVG without changing its geometry. */
  handprint?: boolean;
  colour: string;
  accent: string;
  background: string;
  /** Emphasise the newest unit with full opacity, without a surrounding ring. */
  highlightNewest?: boolean;
  /** Turn off all motion (editor previews re-render constantly). */
  still?: boolean;
  className?: string;
  height?: number;
  testId?: string;
  /** Already consent-filtered by the server; never pass raw donor identities. */
  supporters?: { displayName: string; createdAt?: string }[];
  /** Handprint wall only: phone-sized 4:3 wall (height = width * 3/4). */
  compact?: boolean;
  /** Handprint wall only: show a small "Your hand" label at the highlighted newest hand. */
  ownLabel?: boolean;
}

// Deterministic per-index noise so a unit never jumps between renders.
function rand(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Placed { x: number; y: number; s: number; r: number; o: number }

function layout(n: number, w: number, h: number, massH: number): { items: Placed[]; cell: number } {
  const usableH = Math.max(40, h - massH);
  const target = Math.max(n, 48);
  const cell = Math.max(12, Math.min(56, Math.sqrt((w * usableH) / target)));
  const cols = Math.max(1, Math.floor(w / cell));
  const items: Placed[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const colRaw = i % cols;
    // Fill each row from a shuffled column order so the pile grows unevenly.
    const col = (colRaw * 7 + row * 3) % cols;
    const jx = (rand(i, 1) - 0.5) * cell * 0.55;
    const jy = (rand(i, 2) - 0.5) * cell * 0.45;
    const x = (col + 0.5) * (w / cols) + jx;
    const y = usableH - (row + 0.5) * cell * 0.86 + jy;
    items.push({
      x, y,
      s: cell * (0.62 + rand(i, 3) * 0.42),
      r: (rand(i, 4) - 0.5) * 0.9,
      o: 0.55 + rand(i, 5) * 0.45,
    });
  }
  return { items, cell };
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The accumulation hero. One <canvas>, never a DOM node per donor.
 * Load: one orchestrated fill. New unit while mounted: one drop. Nothing else moves.
 */
export function AccumulationField({
  count, unitSingular, unitPlural, imageUrl, colour, accent, background, handprint = false,
  highlightNewest = false, still = false, className = "", height = 240, testId = "canvas-accumulation",
  supporters = NO_SUPPORTERS, compact = false, ownLabel = false,
}: AccumulationFieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const shownRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const paintedRef = useRef<SupporterUnitPosition[]>([]);
  const [active, setActive] = useState<SupporterUnitPosition | null>(null);
  const tooltipId = useId();

  const safeCount = handprint ? safeHandCount(count) : Math.max(0, Math.floor(count || 0));
  // Handprint walls draw every hand: the wall count must match the page count.
  const drawn = handprint ? safeCount : Math.min(safeCount, MAX_DRAWN);
  const remainder = safeCount - drawn;
  const wallH = handprint && compact && width > 0 ? Math.round((width * 3) / 4) : height;
  const massH = remainder > 0 ? Math.min(wallH * 0.32, 14 + Math.log10(remainder + 1) * 18) : 0;
  const showGhost = handprint;
  // Oldest-to-newest seeds from consent-filtered timestamps (list is newest-first); missing older ones get ordinals.
  const handKeys = useMemo(() => {
    if (!handprint) return null;
    const keys: string[] = [];
    for (let i = 0; i < safeCount; i++) keys.push(supporters[safeCount - 1 - i]?.createdAt || `ordinal:${i}`);
    return keys;
  }, [handprint, safeCount, supporters]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!imageUrl) { setImg(null); return; }
    const im = new Image();
    let cancelled = false;
    im.decoding = "async";
    setImg(null);
    im.onload = () => { if (!cancelled) setImg(im); };
    im.onerror = () => { if (!cancelled) setImg(null); };
    im.src = imageUrl;
    return () => { cancelled = true; };
  }, [imageUrl]);

  const wall = useMemo(() => (handprint && width > 0
    ? layoutHandWall(drawn, width, wallH, { compact, keys: handKeys ?? undefined, reserveGhost: showGhost })
    : null), [handprint, drawn, width, wallH, compact, handKeys, showGhost]);
  const placed = useMemo(() => (width > 0
    ? (wall ? { items: wall.items, cell: wall.cell } : layout(drawn, width, wallH, massH))
    : null), [wall, drawn, width, wallH, massH]);


  useEffect(() => { setActive(null); }, [safeCount, width, supporters]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !placed || width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = wallH * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tint = (color: string) => {
      if (!handprint || !img) return img;
      const layer = document.createElement("canvas");
      layer.width = layer.height = 240;
      const paint = layer.getContext("2d");
      if (!paint) return null;
      paint.drawImage(img, 0, 0, 240, 240);
      paint.globalCompositeOperation = "source-in";
      paint.fillStyle = color;
      paint.fillRect(0, 0, 240, 240);
      return layer;
    };
    const wallImage = tint(colour), ownImage = tint(accent);
    const drawUnit = (p: Placed, alpha: number, lift: number, index: number) => {
      if (alpha > 0.1) paintedRef.current.push({ ...p, y: p.y - lift, index });
      ctx.save();
      ctx.globalAlpha = highlightNewest && p === placed.items[placed.items.length - 1] ? alpha : p.o * alpha;
      ctx.translate(p.x, p.y - lift);
      ctx.rotate(p.r);
      const artwork = highlightNewest && index === placed.items.length - 1 ? ownImage : wallImage;
      if (artwork) {
        ctx.drawImage(artwork, -p.s / 2, -p.s / 2, p.s, p.s);
      } else if (!handprint) {
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(0, 0, p.s * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const frame = (visible: number, dropProgress: number) => {
      paintedRef.current = [];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, wallH);
      if (massH > 0) {
        // The earlier crowd, carried as a dense band.
        ctx.fillStyle = colour;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(0, wallH - massH, width, massH);
        ctx.globalAlpha = 0.18;
        for (let i = 0; i < width; i += 9) {
          ctx.beginPath();
          ctx.arc(i + rand(i, 7) * 6, wallH - massH + 2 + rand(i, 8) * 4, 3 + rand(i, 9) * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      visible = Math.max(0, Math.min(visible, placed.items.length));
      const whole = Math.floor(visible);
      for (let i = 0; i < whole && i < placed.items.length; i++) drawUnit(placed.items[i], 1, 0, i);
      if (whole < placed.items.length && visible > whole) {
        const t = visible - whole;
        drawUnit(placed.items[whole], t, (1 - t) * 30, whole);
      }
      if (dropProgress >= 0 && placed.items.length > 0) {
        const last = placed.items[placed.items.length - 1];
        const t = 1 - Math.pow(1 - dropProgress, 3);
        drawUnit(last, t, (1 - t) * wallH * 0.5, placed.items.length - 1);
      }
    };

    cancelAnimationFrame(rafRef.current);
    // Paint a hand wall in full: its visible count must match the heading,
    // including immediately after a reload. Other accumulation art keeps motion.
    const reduced = handprint || still || prefersReducedMotion();
    // Artwork not ready: draw nothing and keep the load fill pending, so no invisible hands are "drawn".
    if (handprint && imageUrl && !img) { paintedRef.current = []; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, wallH); return; }
    const prev = shownRef.current;
    shownRef.current = safeCount;

    if (reduced || drawn === 0) { frame(drawn, -1); return; }

    if (prev === null) {
      // Orchestrated load fill: ~1.4s regardless of count.
      const dur = 1400;
      const start = performance.now();
      const tick = (now: number) => {
        const t = accumulationProgress(now, start, dur);
        const eased = 1 - Math.pow(1 - t, 2);
        frame(eased * drawn, -1);
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else if (safeCount > prev && drawn > 0) {
      // One new unit lands.
      const dur = 700;
      const start = performance.now();
      const tick = (now: number) => {
        const t = accumulationProgress(now, start, dur);
        if (t < 1) { frame(drawn - 1, t); rafRef.current = requestAnimationFrame(tick); }
        else frame(drawn, -1);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      frame(drawn, -1);
    }
    return () => { cancelAnimationFrame(rafRef.current); paintedRef.current = []; };
  }, [placed, width, height, img, colour, accent, handprint, massH, wallH, imageUrl, highlightNewest, still, drawn, safeCount]);

  const noun = safeCount === 1 ? unitSingular : unitPlural;
  const description = safeCount === 0
    ? `An empty field waiting for the first ${unitSingular}. No supporters yet.`
    : `A field of ${safeCount.toLocaleString("en-GB")} ${noun}, one for each supporter of this campaign.` +
      (!handprint && remainder > 0 ? ` The newest ${MAX_DRAWN} are drawn individually; ${remainder.toLocaleString("en-GB")} earlier ones form the band beneath.` : "") +
      (highlightNewest ? " The newest one is highlighted." : "");

  return (
    <div ref={wrapRef}
      {...(handprint ? { "data-hand-count": safeCount, "data-wall-columns": wall?.columns ?? 0, "data-wall-rows": wall?.rows ?? 0, "data-wall-height": wallH } : {})}
      className={`relative w-full overflow-hidden ${className}`} style={{ height: wallH, backgroundColor: background }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={description}
        aria-describedby={active ? tooltipId : undefined}
        data-testid={testId}
        tabIndex={drawn > 0 ? 0 : undefined}
        onPointerMove={(event) => {
          if (event.pointerType === "touch") return;
          const rect = event.currentTarget.getBoundingClientRect();
          setActive(hitSupporterUnit(paintedRef.current, event.clientX - rect.left, event.clientY - rect.top));
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "touch") return;
          const rect = event.currentTarget.getBoundingClientRect();
          setActive(hitSupporterUnit(paintedRef.current, event.clientX - rect.left, event.clientY - rect.top));
        }}
        onPointerLeave={(event) => { if (event.pointerType !== "touch") setActive(null); }}
        onBlur={() => setActive(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setActive(null); return; }
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const items = paintedRef.current;
          if (!items.length) return;
          const current = items.findIndex((item) => item.index === active?.index);
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
            : current < 0 ? (event.key === "ArrowLeft" ? items.length - 1 : 0)
            : (current + (event.key === "ArrowLeft" ? -1 : 1) + items.length) % items.length;
          setActive(items[next]);
        }}
        style={{ width: "100%", height: wallH }}
      />
      {drawn > 0 && <span className="sr-only">Hover or tap an icon to see its public donor name. Use the left and right arrow keys when focused; Escape closes the name.</span>}
      {active && <div id={tooltipId} role="tooltip" aria-live="polite"
        className="absolute z-10 pointer-events-none rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background shadow-lg break-words text-center"
        style={{ left: Math.max(8, Math.min(active.x - 80, width - 168)), top: Math.max(8, active.y - active.s / 2 - 42), width: 160, maxWidth: "calc(100% - 16px)" }}>
        {supporterUnitName(supporters, drawn, active.index)}
      </div>}
      {showGhost && wall?.ghost && (() => {
        const g = wall.ghost;
        const gw = Math.max(1, g.width), gh = Math.max(1, g.height);
        const row = gh < 48;
        // Glyph must fit the reserved region alongside its label.
        const label = row ? gw >= g.s + 60 || gw >= 72 : gh >= 44 && gw >= 52;
        const glyph = Math.max(6, row ? Math.min(g.s, gh - 4, label ? gw - 64 : gw - 4) : Math.min(g.s, gw - 4, label ? gh - 18 : gh - 4));
        return (
          <div className={`absolute pointer-events-none flex items-center justify-center overflow-hidden ${row ? "flex-row gap-1" : "flex-col gap-0.5"}`}
            data-testid="marker-ghost-hand" aria-hidden="true"
            style={{ left: g.x - gw / 2, top: g.y - gh / 2, width: gw, height: gh }}>
            <span style={{ color: "#C6C6C6", opacity: g.o, transform: `rotate(${g.r}rad)`, width: glyph, height: glyph, display: "block", flex: "none" }}>
              <DonationHand className="w-full h-full" />
            </span>
            {label && <span className="font-bold leading-none whitespace-nowrap" style={{ color: "#68605A", fontSize: 11 }}>Your hand here</span>}
          </div>
        );
      })()}
      {handprint && highlightNewest && ownLabel && placed && placed.items.length > 0 && (() => {
        const p = placed.items[placed.items.length - 1];
        const left = Math.max(4, Math.min(p.x - 36, width - 76));
        // A receipt tag must not obscure neighbouring donors on a dense wall.
        // The red hand and its accessible tooltip remain when no tag fits.
        const top = [p.y + p.s / 2 + 2, p.y - p.s / 2 - 18].find(y => {
          if (y < 0 || y + 16 > wallH) return false;
          if (wall?.ghost) {
            const g = wall.ghost;
            if (left < g.x + g.width / 2 && left + 72 > g.x - g.width / 2 &&
              y < g.y + g.height / 2 && y + 16 > g.y - g.height / 2) return false;
          }
          return placed.items.every((other, i) => {
            if (i === placed.items.length - 1) return true;
            const half = other.s * (Math.abs(Math.cos(other.r)) + Math.abs(Math.sin(other.r))) / 2;
            return left + 72 <= other.x - half || left >= other.x + half ||
              y + 16 <= other.y - half || y >= other.y + half;
          });
        });
        if (top === undefined) return null;
        return (
          <span className="absolute pointer-events-none rc-mono font-bold whitespace-nowrap" data-testid="marker-your-hand"
            style={{ left, top, fontSize: 10, lineHeight: "16px", padding: "0 6px", background: "#17100F", color: "#FFFDF9" }}>
            Your hand
          </span>
        );
      })()}
      {safeCount === 0 && !handprint && (
        <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none" aria-hidden="true">
          <div className="flex flex-col items-center gap-2 opacity-60">
            <div className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center" style={{ borderColor: colour }}>
              {imageUrl && <img src={imageUrl} alt="" className="w-8 h-8 opacity-40" />}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: colour }}>The first {unitSingular} goes here</span>
          </div>
        </div>
      )}
      {!handprint && remainder > 0 && (
        <span className="absolute left-3 bottom-1.5 text-[11px] font-bold text-white/95 tabular-nums pointer-events-none" aria-hidden="true" style={{ lineHeight: `${Math.max(14, massH - 6)}px` }}>
          + {remainder.toLocaleString("en-GB")} earlier {remainder === 1 ? unitSingular : unitPlural}
        </span>
      )}
    </div>
  );
}
