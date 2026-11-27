// The village map: one square grid holding the land features, the gate and
// every building. Tiles are fixed coordinates (x across, y down); a portrait
// screen only rotates the view, never these.
import type { SurfaceId } from './surfaces';

export const MAP_COLS = 9;
export const MAP_ROWS = 7;
export const MAP_TILES = MAP_COLS * MAP_ROWS;
// The painted starting patch keeps its save IDs. Outer land uses a wider grid.
export const OUTER_PAD = 48;
const OUTER_COLS = MAP_COLS + 2 * OUTER_PAD;
export const WORLD_TILES = MAP_TILES + OUTER_COLS * (MAP_ROWS + 2 * OUTER_PAD);

export interface Tile { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export const onVillageGrid = (x: number, y: number) =>
  x >= -OUTER_PAD && x < MAP_COLS + OUTER_PAD && y >= -OUTER_PAD && y < MAP_ROWS + OUTER_PAD;
const inStartingPatch = (x: number, y: number) => x >= 0 && x < MAP_COLS && y >= 0 && y < MAP_ROWS;
export const tileIndex = (x: number, y: number) => inStartingPatch(x, y) ? y * MAP_COLS + x
  : onVillageGrid(x, y) ? MAP_TILES + (y + OUTER_PAD) * OUTER_COLS + x + OUTER_PAD : -1;
export const tileAt = (i: number): Tile => i < MAP_TILES ? { x: i % MAP_COLS, y: Math.floor(i / MAP_COLS) }
  : { x: (i - MAP_TILES) % OUTER_COLS - OUTER_PAD, y: Math.floor((i - MAP_TILES) / OUTER_COLS) - OUTER_PAD };
export const validTileIndex = (i: number) => {
  if (!Number.isInteger(i) || i < 0 || i >= WORLD_TILES) return false;
  const { x, y } = tileAt(i);
  return tileIndex(x, y) === i;
};
export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

export type MapSurfaceId = Exclude<SurfaceId, 'quarry'>;

// Position within the starting patch. Keep the origin fixed when extending the world.
export const SAPLING: Tile = { x: 4, y: 3 };
export const HERO_START: Tile = { x: SAPLING.x, y: SAPLING.y + 5 };
export const isSapling = (x: number, y: number) => x === SAPLING.x && y === SAPLING.y;

/** World coordinates are signed offsets from the sapling, east and north positive. */
export const worldCoordinate = (x: number, y: number): Tile => ({ x: x - SAPLING.x, y: SAPLING.y - y });
export const gridReference = ({ x, y }: Tile) => `(${x}, ${y})`;

export function parseGridReference(reference: string): Tile | null {
  const match = /^\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*\)$/.exec(reference.trim());
  if (!match) return null;
  const x = Number(match[1]), y = Number(match[2]);
  return Number.isSafeInteger(x) && Number.isSafeInteger(y) ? { x: x || 0, y: y || 0 } : null;
}

export interface FeatureDef {
  id: MapSurfaceId;
  /** Fixed footprint on the grid. */
  rect: Rect;
  /** The marker tile inside the footprint, where the eye goes. */
  node: Tile;
}

/** Fixed land features (Eric, 2026-11-23: features don't move; buildings do). */
export const FEATURES: Record<MapSurfaceId, FeatureDef> = {
  forest: { id: 'forest', rect: { x: 2, y: 1, w: 1, h: 1 }, node: { x: 2, y: 1 } },
  berries: { id: 'berries', rect: { x: 6, y: 1, w: 1, h: 1 }, node: { x: 6, y: 1 } },
};

/** Wanderers wait here, on the left edge. Nothing can be built on it. */
export const GATE: Tile = { x: 0, y: 4 };

/** Land under fog until the village reaches Village rank (the southeast corner). */
export const FOG: Rect = { x: 6, y: 3, w: 3, h: 3 };
export const FOG_LIFTS_AT_RANK = 2;

export function featureAt(x: number, y: number): MapSurfaceId | null {
  for (const f of Object.values(FEATURES)) if (inRect(f.rect, x, y)) return f.id;
  return null;
}

export function fogged(x: number, y: number, rankReached: number): boolean {
  return rankReached < FOG_LIFTS_AT_RANK && inRect(FOG, x, y);
}

export const isGate = (x: number, y: number) => x === GATE.x && y === GATE.y;

/** Orthogonal neighbours only: diagonals never count. */
export function neighboursOf(i: number): number[] {
  const { x, y } = tileAt(i);
  return [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]]
    .filter(([col, row]) => onVillageGrid(col, row)).map(([col, row]) => tileIndex(col, row));
}

/** A tile touches a feature when it shares an edge with any tile of its footprint. */
export function touchesFeature(i: number, feature: MapSurfaceId): boolean {
  const r = FEATURES[feature].rect;
  return neighboursOf(i).some(n => { const t = tileAt(n); return inRect(r, t.x, t.y); });
}
