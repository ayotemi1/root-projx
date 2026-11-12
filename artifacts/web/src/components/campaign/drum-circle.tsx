import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Volume2, VolumeX, Play, BookOpen, ImageOff } from "lucide-react";
import type { Campaign } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DRUM_COST_USD, DRUM_RIMS, DRUM_SPOTS, DRUM_TARGET_USD, DRUM_TOTAL, fundedDrums } from "@/lib/drum-experience";
import { useDrumSound } from "./drum-sound";

const INK = "#5A3A22";
const CREAM = "#FCF1DE";

function SmallDrum({ funded, rim, n }: { funded: boolean; rim: string; n: number }) {
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + n;
    return <circle key={i} cx={50 + Math.cos(a) * 41} cy={50 + Math.sin(a) * 41} r="3.2" fill={funded ? "#FFF6E4" : "#B9A487"} />;
  });
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" aria-hidden="true">
      {funded ? (
        <>
          <circle cx="50" cy="50" r="46" fill={rim} />
          {dots}
          <circle cx="50" cy="50" r="33" fill="#FBE6C4" stroke="#FFF6E4" strokeWidth="3" />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="45" fill="none" stroke="#A88E6D" strokeWidth="4" strokeDasharray="7 6" />
          <circle cx="50" cy="50" r="33" fill="#FDF6EA" stroke="#D7C4A6" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}

function CentreDrum({ funded }: { funded: boolean }) {
  const studs = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return <circle key={i} cx={50 + Math.cos(a) * 45} cy={50 + Math.sin(a) * 45} r="1.9" fill={funded ? "#E8B730" : "#B39B78"} />;
  });
  const rings = [36, 29, 22, 15, 8];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill={funded ? "#6B3E1E" : "none"} stroke={funded ? "none" : "#8C6A45"} strokeWidth="2.5" strokeDasharray={funded ? undefined : "5 4"} />
      {studs}
      <circle cx="50" cy="50" r="41" fill={funded ? "#B97A45" : "#FBF2E2"} stroke={funded ? "#8A5228" : "#A9845C"} strokeWidth="1.6" />
      {rings.map((r, i) => (
        <ellipse key={r} cx={51 + i * 0.6} cy={50 - i * 0.4} rx={r} ry={r * 0.94} fill="none"
          stroke={funded ? "#8A5228" : "#C2A27C"} strokeWidth="1.1" opacity={funded ? 0.8 : 0.9} />
      ))}
      <ellipse cx="55" cy="49" rx="3.4" ry="2.4" fill={funded ? "#7A4520" : "#C2A27C"} />
      <path d="M44 36 L51 46" stroke={funded ? "#5A3016" : "#B39B78"} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function fmtDate(s: string) {
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : s;
}

/** Drum Life build: 50 real drums at US$150, filled from verified amount raised. */
export function DrumCircle({ campaign, orgName, compact = false }: { campaign: Campaign; orgName: string; compact?: boolean }) {
  const funded = fundedDrums(campaign.amountRaised);
  const centreFunded = funded >= 1;
  const updates = [...(campaign.drumExperience?.updates ?? [])]
    .filter((u) => u.date && (u.text?.trim() || u.photoUrl))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const { play, muted, setMuted, unavailable } = useDrumSound();
  const [focusIdx, setFocusIdx] = useState(0);
  const [hit, setHit] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState("1");
  const btns = useRef<Array<HTMLButtonElement | null>>([]);
  const hitTimer = useRef<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const selectId = useId();
  useEffect(() => () => { if (hitTimer.current) window.clearTimeout(hitTimer.current); }, []);

  const strike = (n: number) => {
    play(n, n === 1);
    setHit(n);
    if (hitTimer.current) window.clearTimeout(hitTimer.current);
    hitTimer.current = window.setTimeout(() => setHit(null), 260);
    if (n === 1) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    }
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % DRUM_TOTAL;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + DRUM_TOTAL) % DRUM_TOTAL;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = DRUM_TOTAL - 1;
    else return;
    e.preventDefault();
    setFocusIdx(next);
    btns.current[next]?.focus();
  };

  const label = (n: number) => {
    const f = n <= funded;
    if (n === 1) return `Drum 1, the reclaimed-wood centre drum, ${f ? "funded" : "waiting for funding"}. Plays a sound and opens build updates.`;
    return `Drum ${n}, ${f ? "funded" : "waiting for funding"}. Plays a sound.`;
  };

  return (
    <div className="rounded-2xl p-4 sm:p-6 text-[#3B2614]" style={{ backgroundColor: CREAM }} data-testid="block-drum-circle">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <p className="leading-none" data-testid="text-drum-count" aria-live="polite">
          <span className="text-[3rem] sm:text-[3.6rem] font-extrabold tabular-nums tracking-[-0.04em]" style={{ color: "#C9481E" }}>{funded}</span>
          <span className="text-xl font-extrabold"> of {DRUM_TOTAL}</span>
          <span className="block mt-1.5 text-sm font-semibold text-[#6B4F36]">drums funded, US${DRUM_COST_USD} each</span>
        </p>
        <button type="button" onClick={() => setMuted(!muted)} aria-pressed={muted}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full border-2 text-sm font-bold hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5A3A22]"
          style={{ borderColor: INK }} data-testid="button-drum-mute">
          {muted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>

      <div className={`relative mx-auto mt-4 aspect-square w-full ${compact ? "max-w-[300px]" : "max-w-[560px]"}`} role="group" aria-label={`Drum build: ${funded} of ${DRUM_TOTAL} drums funded`}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
          {[19, 31, 43.5].map((r) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#D9C6A6" strokeWidth="0.25" strokeDasharray="1 1.2" />)}
        </svg>
        {DRUM_SPOTS.map((s, i) => {
          const f = s.n <= funded;
          const size = s.r * 2;
          return (
            <button key={s.n} ref={(el) => { btns.current[i] = el; }} type="button"
              tabIndex={focusIdx === i ? 0 : -1} onFocus={() => setFocusIdx(i)}
              onClick={() => strike(s.n)} onKeyDown={(e) => onKey(e, i)} aria-label={label(s.n)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1F6F8B] motion-safe:transition-transform motion-safe:duration-150 motion-safe:hover:scale-[1.07] ${hit === s.n ? "motion-safe:scale-90" : ""}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${size}%`, height: `${size}%` }}
              data-testid={`button-drum-${s.n}`}>
              {s.n === 1 ? <CentreDrum funded={f} /> : <SmallDrum funded={f} rim={DRUM_RIMS[(s.n - 2) % DRUM_RIMS.length]} n={s.n} />}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center">
        <span className="inline-flex items-center gap-2.5 rounded-full border-2 bg-[#FFF9EF] px-4 py-1.5" style={{ borderColor: INK }}>
          <span className="w-7 h-7 shrink-0"><CentreDrum funded /></span>
          <span className="leading-tight">
            <span className="block text-[11px] font-semibold text-[#6B4F36]">Centre drum · Drum #1</span>
            <span className="block text-sm font-extrabold">From Humanity Ova Vanity</span>
          </span>
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-[#5A4330] text-center max-w-md mx-auto" data-testid="text-drum-explainer">
        The centre drum is carved from reclaimed wood. It is drawn as an outline until it is paid for, and is the first drum
        funded. Then the circle fills outward. {centreFunded ? "It is funded." : "It is still waiting."} Every US${DRUM_COST_USD} raised here completes one drum for a child, up to US${DRUM_TARGET_USD.toLocaleString("en-US")} for all {DRUM_TOTAL}.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-[#5A4330]">
        <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-[3px] border-[#C9481E]" aria-hidden="true" />Funded</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-[#A88E6D]" aria-hidden="true" />Waiting for funding</span>
        <span className="font-bold">{unavailable ? "Sound is not available on this device" : "Tap any drum to hear it"}</span>
      </div>

      {/* Larger, non-spatial alternative for small screens and assistive tech */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <label htmlFor={selectId} className="sr-only">Choose a drum</label>
        <select id={selectId} value={picked} onChange={(e) => setPicked(e.target.value)}
          className="h-12 flex-1 min-w-0 rounded-xl border-2 bg-[#FFF9EF] px-3 text-sm font-semibold" style={{ borderColor: INK }} data-testid="select-drum">
          {DRUM_SPOTS.map((s) => (
            <option key={s.n} value={s.n}>{s.n === 1 ? "Drum 1, centre" : `Drum ${s.n}`} ({s.n <= funded ? "funded" : "waiting"})</option>
          ))}
        </select>
        <button type="button" onClick={() => strike(Number(picked))}
          className="h-12 px-5 rounded-xl inline-flex items-center justify-center gap-2 font-extrabold text-[#FFF6E4] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5A3A22]"
          style={{ backgroundColor: "#7A3A1C" }} data-testid="button-drum-play">
          {picked === "1" ? <BookOpen className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
          {picked === "1" ? "Play and open build" : "Play drum"}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus(); }}
          className="max-h-[85dvh] overflow-y-auto bg-[#FCF1DE] text-[#3B2614] border-[#5A3A22] motion-reduce:animate-none" data-testid="dialog-drum-updates">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">The centre drum build</DialogTitle>
            <DialogDescription className="text-[#5A4330]">
              Drum #1, reclaimed wood. {centreFunded ? "Funded." : "Waiting for funding."} Updates from {orgName}.
            </DialogDescription>
          </DialogHeader>
          {updates.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[#B9A487] p-5 text-center" data-testid="empty-drum-updates">
              <ImageOff className="w-6 h-6 mx-auto text-[#8C6A45]" aria-hidden="true" />
              <p className="mt-2 font-bold">No build updates yet</p>
              <p className="text-sm text-[#5A4330]">{orgName} will post dated photos here as the wood is cut, shaped and skinned.</p>
            </div>
          ) : (
            <ol className="space-y-5">
              {updates.map((u) => (
                <li key={u.id} className="border-l-4 pl-4" style={{ borderColor: "#D9A21B" }} data-testid={`item-drum-update-${u.id}`}>
                  {u.date && <time dateTime={u.date} className="text-xs font-bold uppercase tracking-wider text-[#8C6A45]">{fmtDate(u.date)}</time>}
                  {u.text?.trim() && <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{u.text}</p>}
                  {u.photoUrl && (
                    <figure className="mt-2">
                      <img src={u.photoUrl} alt={u.caption?.trim() || "Drum build photo"} loading="lazy" className="w-full rounded-lg object-cover aspect-[4/3]" />
                      {u.caption?.trim() && <figcaption className="mt-1 text-xs text-[#5A4330]">{u.caption}</figcaption>}
                    </figure>
                  )}
                  {!u.photoUrl && u.caption?.trim() && <p className="mt-1 text-xs text-[#5A4330]">{u.caption}</p>}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
