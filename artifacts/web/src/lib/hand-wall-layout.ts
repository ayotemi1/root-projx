/** Shared logical-pixel geometry for the public wall and the editor preview. */
export interface WallHand {
  x: number;
  y: number;
  s: number;
  /** Radians, as expected by canvas and the donor hit-testing helper. */
  r: number;
  o: number;
}

export interface WallGhost extends WallHand {
  /** Reserved empty region, including room for the invitation label. */
  width: number;
  height: number;
}

export function safeHandCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/** Integer hashing gives the same jitter in every browser, without Math.random. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

function noise(key: string, salt: string): number {
  return hash(`${key}:${salt}`) / 4294967296;
}

export function layoutHandWall(
  count: number, width: number, height: number,
  { compact = false, keys = [], reserveGhost = true }: {
    compact?: boolean; keys?: readonly string[]; reserveGhost?: boolean;
  } = {},
): {
  items: WallHand[]; ghost: WallGhost | null;
  columns: number; rows: number; cell: number; cellWidth: number; cellHeight: number;
} {
  const n = safeHandCount(count);
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) {
    return { items: [], ghost: null, columns: 0, rows: 0, cell: 0, cellWidth: 0, cellHeight: 0 };
  }

  const baseColumns = compact ? 4 : 9;
  const baseRows = Math.max(compact ? 4 : 6, Math.ceil(height / (width / baseColumns)));
  // Gradually add columns as the crowd grows, rather than stacking fixed-size
  // artwork until it falls outside the canvas. The same count always reflows
  // identically; the first rows are always the oldest donations at the bottom.
  const density = Math.max(1, Math.sqrt(n / (baseColumns * baseRows)));
  const columns = Math.max(baseColumns, Math.ceil(baseColumns * density));
  const cellWidth = width / columns;

  // At high density the invitation needs several empty slots to remain readable.
  // It starts immediately after the last donor, wrapping only if it cannot fit.
  const ghostSpan = cellWidth >= 72 ? 1 : Math.min(columns, Math.ceil(108 / cellWidth));
  const nextColumn = n % columns;
  const ghostColumn = nextColumn + ghostSpan <= columns ? nextColumn : 0;
  const ghostRow = Math.floor(n / columns) + (ghostColumn < nextColumn ? 1 : 0);
  const occupiedRows = Math.ceil(n / columns);
  const rows = Math.max(compact ? 4 : 3, occupiedRows, reserveGhost ? ghostRow + 1 : 0);
  const cellHeight = height / rows;
  const cell = Math.min(cellWidth, cellHeight);

  const items: WallHand[] = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / columns);
    const column = i % columns;
    // Use the donation timestamp where supplied, not a person's display name.
    // An ordinal is deterministic for historical units without public metadata.
    const key = keys[i] || `ordinal:${i}`;
    return {
      x: (column + .5) * cellWidth + (noise(key, "x") - .5) * cellWidth * .05,
      y: height - (row + .5) * cellHeight + (noise(key, "y") - .5) * cellHeight * .05,
      s: cell * .78 * (.96 + noise(key, "size") * .04),
      r: (noise(key, "rotation") - .5) * .2,
      o: .86 + noise(key, "opacity") * .14,
    };
  });
  // Max rotated extent is .78*(cos(.1)+sin(.1))/2 + .025 < .453
  // of either cell dimension. Thus every donor stays wholly inside its own
  // cell, even after jitter and rotation: neighbouring hands cannot pile up.
  const ghost = reserveGhost ? {
    x: (ghostColumn + ghostSpan / 2) * cellWidth,
    y: height - (ghostRow + .5) * cellHeight,
    s: cell * .72,
    r: .07,
    o: 1,
    width: ghostSpan * cellWidth,
    height: cellHeight,
  } : null;
  return { items, ghost, columns, rows, cell, cellWidth, cellHeight };
}
