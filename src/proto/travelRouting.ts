import { TABLE_GRID } from './gridCoordinates';
import { findGridPath, type CellCost, type TimedPoint } from './gridPathfinding';
type Point = { x: number; y: number };
/** Insert a clicked route cell before the next existing control along the path. */
export function addTravelWaypoint(path: readonly TimedPoint[], controls: readonly Point[], point: Point): Point[] | null {
  const cell = TABLE_GRID.snap(point);
  if (!path.length || sameTravelCell(cell, path[0]) || controls.some(control => sameTravelCell(control, cell))) return null;
  const cells = travelRouteControls(path);
  const index = cells.findIndex(value => sameTravelCell(value, cell));
  if (index < 0) return null;
  const next = controls.findIndex(control => cells.slice(index + 1).some(value => sameTravelCell(value, control)));
  if (next < 0) return null;
  return [...controls.slice(0, next), cell, ...controls.slice(next)];
}
export const sameTravelCell = (a: Point, b: Point) => TABLE_GRID.reference(TABLE_GRID.atWorld(a)) === TABLE_GRID.reference(TABLE_GRID.atWorld(b));

/** Cell-centred handles include the final destination as the last editable node. */
export function travelRouteControls(path: readonly TimedPoint[]): Point[] {
  const points: Point[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const steps = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / TABLE_GRID.cellSize));
    for (let step = 1; step <= steps; step++) {
      const point = TABLE_GRID.snap({ x: a.x + (b.x - a.x) * step / steps, y: a.y + (b.y - a.y) * step / steps });
      if (!sameTravelCell(point, path[0]) && (!points.length || !sameTravelCell(point, points[points.length - 1]))) points.push(point);
    }
  }
  return points;
}

/** Every explicit intermediate cell must be legal; A*'s destination exemption
 * must never allow a waypoint through mountains, locks or active encounters. */
export function routeThroughTravelCells(start: Point, target: Point, controls: readonly Point[], cost: CellCost): TimedPoint[] | null {
  let current = start;
  const path: TimedPoint[] = [{ ...start, pace: 0 }];
  for (const point of [...controls, target]) {
    if (sameTravelCell(current, point)) continue;
    const cell = TABLE_GRID.atWorld(point);
    if (!Number.isFinite(cost(cell.column, cell.row))) return null;
    const leg = findGridPath(current, point, cost, TABLE_GRID.cellSize);
    if (!leg) return null;
    path.push(...leg.slice(1)); current = point;
  }
  return path;
}
