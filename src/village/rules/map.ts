// The village map: one square grid holding the land features, the gate and
// every building. Tiles are fixed coordinates (x across, y down); a portrait
// screen only rotates the view, never these.
import type { SurfaceId } from './surfaces';

export const MAP_COLS = 9;
export const MAP_ROWS = 6;
export const MAP_TILES = MAP_COLS * MAP_ROWS;

export interface Tile { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export const tileIndex = (x: number, y: number) => y * MAP_COLS + x;
export const tileAt = (i: number): Tile => ({ x: i % MAP_COLS, y: Math.floor(i / MAP_COLS) });
export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

export interface FeatureDef {
  id: SurfaceId;
  /** Fixed footprint on the grid. */
  rect: Rect;
  /** The marker tile inside the footprint, where the eye goes. */
  node: Tile;
}

/** Fixed land features (Eric, 2026-11-23: features don't move; buildings do). */
export const FEATURES: Record<SurfaceId, FeatureDef> = {
  forest: { id: 'forest', rect: { x: 0, y: 0, w: 3, h: 2 }, node: { x: 2, y: 1 } },
  berries: { id: 'berries', rect: { x: 6, y: 0, w: 2, h: 2 }, node: { x: 6, y: 1 } },
  quarry: { id: 'quarry', rect: { x: 6, y: 4, w: 2, h: 2 }, node: { x: 6, y: 4 } },
};

/** Wanderers wait here, on the left edge. Nothing can be built on it. */
export const GATE: Tile = { x: 0, y: 4 };

/** Land under fog until the village reaches Village rank (the quarry and its corner). */
export const FOG: Rect = { x: 6, y: 3, w: 3, h: 3 };
export const FOG_LIFTS_AT_RANK = 2;

export function featureAt(x: number, y: number): SurfaceId | null {
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
  const out: number[] = [];
  if (y > 0) out.push(i - MAP_COLS);
  if (y < MAP_ROWS - 1) out.push(i + MAP_COLS);
  if (x > 0) out.push(i - 1);
  if (x < MAP_COLS - 1) out.push(i + 1);
  return out;
}

/** A tile touches a feature when it shares an edge with any tile of its footprint. */
export function touchesFeature(i: number, feature: SurfaceId): boolean {
  const r = FEATURES[feature].rect;
  return neighboursOf(i).some(n => { const t = tileAt(n); return inRect(r, t.x, t.y); });
}
