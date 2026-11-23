/** Physical pixels, allowing for both CSS rounding and a scaled preview's pixel grid. */
export function availableTextWidth(el: Pick<HTMLElement, "clientWidth" | "offsetWidth" | "getBoundingClientRect">): number {
  const width = el.getBoundingClientRect().width;
  const scale = el.offsetWidth > 0 ? width / el.offsetWidth : 1;
  return Math.max(0, Math.min(width, el.clientWidth * scale) - (1 + scale));
}
