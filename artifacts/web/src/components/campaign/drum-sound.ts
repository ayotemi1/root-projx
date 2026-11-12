import { useCallback, useEffect, useRef, useState } from "react";

type Ctx = AudioContext;

/** Synthetic hand-drum voice. Context is created only on a user action and closed on unmount. */
export function useDrumSound() {
  const ctxRef = useRef<Ctx | null>(null);
  const [muted, setMuted] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => () => {
    const c = ctxRef.current;
    ctxRef.current = null;
    if (c && c.state !== "closed") c.close().catch(() => undefined);
  }, []);

  const play = useCallback(async (n: number, centre = false) => {
    if (muted || unavailable) return;
    try {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) { setUnavailable(true); return; }
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      if (ctxRef.current !== ctx || ctx.state === "closed") return;
      const t = ctx.currentTime;
      const base = centre ? 70 : 110 + ((n * 37) % 160);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(centre ? 0.9 : 0.6, t + 0.005);
      out.gain.exponentialRampToValueAtTime(0.0001, t + (centre ? 0.9 : 0.45));
      out.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(base * 1.9, t);
      osc.frequency.exponentialRampToValueAtTime(base, t + 0.08);
      osc.connect(out);
      osc.onended = () => { osc.disconnect(); out.disconnect(); };
      osc.start(t); osc.stop(t + 1);
      // Short noise slap for the skin.
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "bandpass"; hp.frequency.value = 1800;
      const ng = ctx.createGain(); ng.gain.value = 0.25;
      src.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
      src.onended = () => { src.disconnect(); hp.disconnect(); ng.disconnect(); };
      src.start(t);
    } catch {
      setUnavailable(true);
    }
  }, [muted, unavailable]);

  return { play, muted, setMuted, unavailable };
}
