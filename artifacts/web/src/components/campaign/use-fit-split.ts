import { useEffect, useRef } from "react";
import { availableTextWidth } from "./fit-metrics";

/**
 * Scoped port of the reference rpxFitHeads: inside one `.rc-fit-split` the h2
 * grows or shrinks so it ends level with the intro beside it, and no single
 * word is wider than its column. Everything is measured with
 * getBoundingClientRect on both sides, so a scaled/transformed preview
 * compares like with like. No document queries, no global side channel.
 */
export function useFitSplit<T extends HTMLElement>(copyKey: string) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const split = ref.current;
    if (!split) return;
    let raf = 0;
    let lastWidth = -1;

    const fit = () => {
      const h = split.querySelector<HTMLElement>(":scope > h2");
      const side = split.querySelector<HTMLElement>(":scope > .rc-fit-intro");
      if (!h) return;
      h.style.fontSize = "";
      const two = !!side && getComputedStyle(split).gridTemplateColumns.trim().split(/\s+/).length > 1;
      const base = parseFloat(getComputedStyle(h).fontSize) || 48;
      // Scale factor between CSS px and on-screen px (preview transforms).
      const scale = h.offsetWidth > 0 ? h.getBoundingClientRect().width / h.offsetWidth : 1;
      const words = (h.textContent ?? "").trim().split(/\s+/).filter(Boolean);
      const probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;left:0;top:0";

      const fits = (s: number) => {
        h.style.fontSize = `${s}px`;
        const colW = availableTextWidth(h);
        h.appendChild(probe);
        let ok = true;
        for (const w of words) {
          probe.textContent = w;
          if (probe.getBoundingClientRect().width > colW) { ok = false; break; }
        }
        probe.remove();
        // Height rule only applies at or above the reference floor of 40px.
        if (ok && two && side && s > 40) {
          ok = h.getBoundingClientRect().height <= side.getBoundingClientRect().height + 2 * scale;
        }
        return ok;
      };

      let lo = 1;
      let hi = two ? 130 : base;
      let best = lo;
      if (fits(hi)) best = hi;
      else {
        for (let i = 0; i < 18; i++) {
          const m = (lo + hi) / 2;
          if (fits(m)) { best = m; lo = m; } else hi = m;
        }
      }
      // Single column: keep the CSS size unless a long word forced it down.
      if (!two && best >= base) h.style.fontSize = "";
      else h.style.fontSize = `${Math.floor(best * 10) / 10}px`;
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    };

    schedule();
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) schedule(); }).catch(() => undefined);

    // Only react to width changes of the split itself: our own font-size
    // writes change height, never width, so this cannot loop.
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver((entries) => {
          const w = entries[0]?.contentRect.width ?? 0;
          if (Math.abs(w - lastWidth) < 0.5) return;
          lastWidth = w;
          schedule();
        })
      : null;
    ro?.observe(split);
    window.addEventListener("resize", schedule);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [copyKey]);

  return ref;
}
