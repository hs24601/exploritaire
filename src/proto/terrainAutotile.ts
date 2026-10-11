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
  /** Optional filler laid across each joined seam (and the middle of every
   * filled 2x2), so raised terrain reads as one mass with no ground between.
   * `across` joins east-west neighbours, `along` north-south ones. */
  seams?: { across: string; along: string; cross: string; scale: number };
};
/** Where two (or four) joined cells meet: a fractional grid point between them. */
export type AutotileSeam = { id: string; kind: 'across' | 'along' | 'cross'; column: number; row: number;
  cells: readonly AutotileCell[]; roll: number };
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

/** Every seam between joined cells of one group, plus each filled 2x2's middle. */
export function autotileSeams<T extends AutotileCell>(cells: readonly T[]): AutotileSeam[] {
  const at = new Map(cells.map(cell => [`${cell.column},${cell.row}`, cell]));
  const get = (column: number, row: number) => at.get(`${column},${row}`);
  const seams: AutotileSeam[] = [];
  for (const cell of cells) {
    const { column, row } = cell, east = get(column + 1, row), south = get(column, row + 1), corner = get(column + 1, row + 1);
    if (east) seams.push({ id: `${column},${row}>e`, kind: 'across', column: column + .5, row, cells: [cell, east], roll: cellRoll(column, row, 11) });
    if (south) seams.push({ id: `${column},${row}>s`, kind: 'along', column, row: row + .5, cells: [cell, south], roll: cellRoll(column, row, 12) });
    if (east && south && corner) seams.push({ id: `${column},${row}>x`, kind: 'cross', column: column + .5, row: row + .5, cells: [cell, east, south, corner], roll: cellRoll(column, row, 13) });
  }
  return seams;
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
  seams: { across: 'mountain_standee_ridge.svg', along: 'mountain_standee_ridge_ns.svg', cross: 'mountain_standee_ridge.svg', scale: 1 },
};

/** Styles by tile type; terrain without one keeps its plain per-cell art. */
export const TERRAIN_AUTOTILE: Readonly<Record<string, AutotileStyle>> = { 'impassable-mountain': MOUNTAIN_AUTOTILE };

/** Seam fillers for connected terrain regions whose style has them, with the
 * world point and the bounding box of the cells each one joins. */
export function terrainAutotileSeams(regions: readonly { id: string; tiles: readonly { id: string; tileType?: string; position: { x: number; y: number } }[] }[],
  cellOf: (position: { x: number; y: number }) => AutotileCell, cellSize: number) {
  return regions.flatMap(region => {
    const style = TERRAIN_AUTOTILE[region.tiles[0]?.tileType ?? ''];
    if (!style?.seams) return [];
    const origin = region.tiles[0].position, first = cellOf(origin);
    const world = (column: number, row: number) => ({ x: origin.x + (column - first.column) * cellSize, y: origin.y + (row - first.row) * cellSize });
    const seams = style.seams;
    return autotileSeams(region.tiles.map(tile => ({ ...cellOf(tile.position) }))).map(seam => {
      const columns = seam.cells.map(cell => cell.column), rows = seam.cells.map(cell => cell.row);
      const left = Math.min(...columns), right = Math.max(...columns), top = Math.min(...rows), bottom = Math.max(...rows);
      const centre = world((left + right) / 2, (top + bottom) / 2);
      return { id: `${region.id}:${seam.id}`, kind: seam.kind, src: seams[seam.kind], scale: seams.scale, flip: seam.roll < .5,
        position: world(seam.column, seam.row),
        owner: { ...centre, width: (right - left + 1) * cellSize, height: (bottom - top + 1) * cellSize } };
    });
  });
}

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
