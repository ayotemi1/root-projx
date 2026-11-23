import { useEffect, useRef } from "react";
import { availableTextWidth } from "./fit-metrics";

/**
 * Scoped port of the reference rpxFitTitle. Attach the returned ref to
 * `.rc-hero-top`. The visible title (the aria-hidden span inside the h1, never
 * the screen-reader duplicate) grows or shrinks so the copy block fills the
 * hero image height when side by side; no word may be wider than the copy
 * column. All comparisons use getBoundingClientRect on both sides, so a
 * scaled preview measures in the same units.
 */
export function useFitTitle<T extends HTMLElement>(copyKey: string) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const top = ref.current;
    if (!top) return;
    let raf = 0;
    let alive = true;
    let last = { w: -1, ih: -1 };

    const fit = () => {
      const h = top.querySelector<HTMLElement>(".rc-hero-copy > h1");
      const visual = h?.querySelector<HTMLElement>(':scope > [aria-hidden="true"]');
      const copy = top.querySelector<HTMLElement>(":scope > .rc-hero-copy");
      const img = top.querySelector<HTMLElement>(":scope > .rc-hero-img");
      if (!h || !visual || !copy) return;
      h.style.fontSize = "";
      const two = !!img && getComputedStyle(top).gridTemplateColumns.trim().split(/\s+/).length > 1;
      // Logical (unscaled CSS px) widths for the upper bound only.
      const copyW = copy.offsetWidth;
      const logicalW = top.offsetWidth;
      const hi0 = two ? Math.min(copyW * 0.5, 320) : Math.min(logicalW * 0.3, 150);
      const words = (visual.textContent ?? "").trim().split(/\s+/).filter(Boolean);
      const probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;left:0;top:0";

      const ok = (s: number) => {
        h.style.fontSize = `${s}px`;
        const colW = availableTextWidth(h);
        visual.appendChild(probe);
        let fits = true;
        for (const w of words) {
          probe.textContent = w;
          if (probe.getBoundingClientRect().width > colW) { fits = false; break; }
        }
        probe.remove();
        if (fits && two && img) fits = copy.getBoundingClientRect().height <= img.getBoundingClientRect().height + 0.5;
        return fits;
      };

      let lo = 1;
      let hi = Math.max(hi0, lo);
      let best = lo;
      for (let i = 0; i < 20; i++) {
        const m = (lo + hi) / 2;
        if (ok(m)) { best = m; lo = m; } else hi = m;
      }
      h.style.fontSize = `${Math.floor(best * 10) / 10}px`;
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { if (alive) fit(); });
    };

    schedule();
    document.fonts?.ready.then(() => { if (alive) schedule(); }).catch(() => undefined);
    const imgEl = top.querySelector<HTMLImageElement>(".rc-hero-img img");
    imgEl?.addEventListener("load", schedule);
    window.addEventListener("load", schedule);
    window.addEventListener("resize", schedule);

    // Only the hero width and the image box drive refits; the title's own
    // font-size changes the copy height, which is not observed, so no loop.
    const imgBox = top.querySelector<HTMLElement>(":scope > .rc-hero-img");
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          const w = top.getBoundingClientRect().width;
          const ih = imgBox ? imgBox.getBoundingClientRect().height : 0;
          if (Math.abs(w - last.w) < 0.5 && Math.abs(ih - last.ih) < 0.5) return;
          last = { w, ih };
          schedule();
        })
      : null;
    ro?.observe(top);
    if (imgBox) ro?.observe(imgBox);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      imgEl?.removeEventListener("load", schedule);
      window.removeEventListener("load", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [copyKey]);

  return ref;
}
