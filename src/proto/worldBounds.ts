import { TABLE_GRID } from './gridCoordinates';

/** The explorable table: a square of open cells around True Center. Every cell
 * outside it is impassable terrain (black placeholders for now; a world map
 * will theme them, and golf will open some of them up later). */
export const CLEAR_AREA_CELLS = 15;
const HALF_CELLS = Math.floor(CLEAR_AREA_CELLS / 2);
/** How far the impassable terrain is drawn and routed beyond the clear area. */
export const BLOCKED_DEPTH_CELLS = 40;

const cell = TABLE_GRID.cellSize;
const inner = (HALF_CELLS + 0.5) * cell;
const outer = (HALF_CELLS + 0.5 + BLOCKED_DEPTH_CELLS) * cell;

export type WorldRect = { id: string; left: number; top: number; right: number; bottom: number };

/** The open square, in world units. */
export const CLEAR_AREA: WorldRect = { id: 'clear-area', left: -inner, top: -inner, right: inner, bottom: inner };

/** Impassable terrain as four bands framing the clear area. */
export const BLOCKED_REGIONS: readonly WorldRect[] = [
  { id: 'blocked-north', left: -outer, top: -outer, right: outer, bottom: -inner },
  { id: 'blocked-south', left: -outer, top: inner, right: outer, bottom: outer },
  { id: 'blocked-west', left: -outer, top: -inner, right: -inner, bottom: inner },
  { id: 'blocked-east', left: inner, top: -inner, right: outer, bottom: inner },
];

export const isBlockedPoint = (point: { x: number; y: number }) =>
  point.x < CLEAR_AREA.left || point.x > CLEAR_AREA.right || point.y < CLEAR_AREA.top || point.y > CLEAR_AREA.bottom;

/** Route obstacles for actors. Pathfinding inflates solids by the actor's
 * clearance, so these are pulled back by that much: an actor can still stand on
 * the outermost open cells but never step onto blocked ones. */
export const blockedPathObstacles = (clearance = 28) => {
  const pull = clearance - 4;
  return BLOCKED_REGIONS.map((region) => ({
    ...region,
    bottom: region.id === 'blocked-north' ? region.bottom - pull : region.bottom,
    top: region.id === 'blocked-south' ? region.top + pull : region.top,
    right: region.id === 'blocked-west' ? region.right - pull : region.right,
    left: region.id === 'blocked-east' ? region.left + pull : region.left,
  }));
};

/** Center-based boxes, for placement code that avoids solids. */
export const blockedSolids = () => BLOCKED_REGIONS.map((region) => ({
  x: (region.left + region.right) / 2, y: (region.top + region.bottom) / 2,
  width: region.right - region.left, height: region.bottom - region.top,
}));
