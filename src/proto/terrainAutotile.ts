/** Neighbour-aware terrain pieces (classic bitmask autotiling). Each cell of a
 * connected terrain group picks its art variant from which of its four sides
 * continue the same terrain, plus a stable per-cell tweak (flip, nudge, scale)
 * so neighbouring cells never read as copies. Pure and DOM-free, so any
 * terrain (mountains now; water or forest later) can supply its own style. */

export type AutotileShape = 'lone' | 'end' | 'corridor' | 'corner' | 'edge' | 'interior';
export type AutotileCell = { column: number; row: number };
export type AutotilePiece = {
  /** 4-bit side mask: north 1, east 2, south 4, west 8. */
  mask: number;
  shape: AutotileShape;
  /** Unit-ish vector (grid axes, y down) toward the joined sides; zero when balanced. */
  inward: { x: number; y: number };
  /** Stable 0–1 rolls for this cell, used for the per-cell tweaks. */
  rolls: readonly [number, number, number, number, number];
};
/** How a terrain draws each shape: art scale, how far (in cells) the art
 * leans toward its joined sides, and optional art variants (file names beside
 * the terrain's own sprite; one is picked per cell). `jitter` bounds the
 * per-cell randomness. */
export type AutotileStyle = Record<AutotileShape, { scale: number; lean: number; art?: readonly string[] }> & {
  jitter: { scale: number; offset: number; flip: boolean };
};
export type AutotilePlacement = { dx: number; dy: number; scale: number; flip: boolean; shape: AutotileShape; art?: string };

const SIDES = [
  { bit: 1, x: 0, y: -1 },
  { bit: 2, x: 1, y: 0 },
  { bit: 4, x: 0, y: 1 },
  { bit: 8, x: -1, y: 0 },
] as const;

export function autotileShape(mask: number): AutotileShape {
  const count = SIDES.filter(side => mask & side.bit).length;
  if (count === 0) return 'lone';
  if (count === 1) return 'end';
  if (count === 3) return 'edge';
  if (count === 4) return 'interior';
  return mask === 5 || mask === 10 ? 'corridor' : 'corner';
}

/** Small integer hash to [0,1); stable across sessions for the same cell. */
export function cellRoll(column: number, row: number, salt = 0) {
  let h = Math.imul(column | 0, 374761393) ^ Math.imul(row | 0, 668265263) ^ Math.imul(salt | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Pieces for every cell in one group. Only cells in the group join, so fog,
 * other terrain or a hole (such as the den) reads as an open side. */
export function autotileCells<T extends AutotileCell>(cells: readonly T[]) {
  const members = new Set(cells.map(cell => `${cell.column},${cell.row}`));
  return new Map(cells.map(cell => {
    let mask = 0, x = 0, y = 0;
    for (const side of SIDES) if (members.has(`${cell.column + side.x},${cell.row + side.y}`)) {
      mask |= side.bit; x += side.x; y += side.y;
    }
    const length = Math.hypot(x, y) || 1;
    const rolls = [0, 1, 2, 3, 4].map(salt => cellRoll(cell.column, cell.row, salt)) as unknown as AutotilePiece['rolls'];
    return [cell, { mask, shape: autotileShape(mask), inward: { x: x / length, y: y / length }, rolls }] as const;
  }));
}

/** Resolve a piece into draw offsets (in px for `cellSize`), scale and flip. */
export function autotilePlacement(piece: AutotilePiece, style: AutotileStyle, cellSize: number): AutotilePlacement {
  const variant = style[piece.shape], [scaleRoll, xRoll, yRoll, flipRoll, artRoll] = piece.rolls;
  const spread = (roll: number) => (roll * 2 - 1) * style.jitter.offset * cellSize;
  return {
    shape: piece.shape,
    dx: piece.inward.x * variant.lean * cellSize + spread(xRoll),
    dy: piece.inward.y * variant.lean * cellSize + spread(yRoll),
    scale: variant.scale * (1 + (scaleRoll * 2 - 1) * style.jitter.scale),
    flip: style.jitter.flip && flipRoll < .5,
    art: variant.art?.length ? variant.art[Math.floor(artRoll * variant.art.length)] : undefined,
  };
}

/** Impassable Mountains: interior and edge cells carry the full massif, a
 * corner stands one main peak, and range ends taper to a lower spur
 * (cut from the standee by tools/make-mountain-variants.mjs), each leaning
 * toward the range. The tilted view uses the art; the flat print, which has
 * its own overhead sprite, uses the lean, scale and flip. */
export const MOUNTAIN_AUTOTILE: AutotileStyle = {
  lone: { scale: 1, lean: 0 },
  end: { scale: .72, lean: .18, art: ['mountain_standee_spur.svg'] },
  corridor: { scale: 1.02, lean: 0 },
  corner: { scale: .84, lean: .14, art: ['mountain_standee_peak.svg'] },
  edge: { scale: 1.06, lean: .12 },
  interior: { scale: 1.18, lean: 0 },
  jitter: { scale: .08, offset: .06, flip: true },
};

/** Styles by tile type; terrain without one keeps its plain per-cell art. */
export const TERRAIN_AUTOTILE: Readonly<Record<string, AutotileStyle>> = { 'impassable-mountain': MOUNTAIN_AUTOTILE };

/** Placements by tile id for connected terrain regions (see tileLabels.ts). */
export function terrainAutotilePlacements(regions: readonly { tiles: readonly { id: string; tileType?: string; position: { x: number; y: number } }[] }[],
  cellOf: (position: { x: number; y: number }) => AutotileCell, cellSize: number) {
  const placements = new Map<string, AutotilePlacement>();
  for (const region of regions) {
    const style = TERRAIN_AUTOTILE[region.tiles[0]?.tileType ?? ''];
    if (!style) continue;
    const cells = region.tiles.map(tile => { const { column, row } = cellOf(tile.position); return { id: tile.id, column, row }; });
    for (const [cell, piece] of autotileCells(cells)) placements.set(cell.id, autotilePlacement(piece, style, cellSize));
  }
  return placements;
}
