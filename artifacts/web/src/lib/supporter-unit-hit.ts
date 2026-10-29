export interface SupporterUnitPosition { x: number; y: number; s: number; r: number; index: number }

/** RAF timestamps can precede a start sampled during the same browser frame. */
export function accumulationProgress(now: number, start: number, duration: number): number {
  return Math.max(0, Math.min(1, (now - start) / duration));
}

/** Reverse paint order means overlapping icons select the one actually on top. */
export function hitSupporterUnit(items: SupporterUnitPosition[], x: number, y: number): SupporterUnitPosition | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const p = items[i];
    const dx = x - p.x, dy = y - p.y;
    const localX = dx * Math.cos(p.r) + dy * Math.sin(p.r);
    const localY = -dx * Math.sin(p.r) + dy * Math.cos(p.r);
    if (Math.abs(localX) <= p.s / 2 && Math.abs(localY) <= p.s / 2) return p;
  }
  return null;
}

/** Units are painted oldest-to-newest; the public supporter list is newest-first. */
export function supporterUnitName(supporters: { displayName: string }[], drawn: number, index: number): string {
  return supporters[drawn - 1 - index]?.displayName?.trim() || "Anonymous";
}
