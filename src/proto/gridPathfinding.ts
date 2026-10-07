/** Actor routing on the table grid: weighted A*, 8-way, never cutting a corner
 * past a blocked cell. Each cell has a travel cost (1 is open table, higher is
 * slower ground, Infinity can't be crossed); the route is the fastest one, and
 * its points carry the pace of the ground they cross so travel can slow down
 * through rough terrain. Pure: callers say what each cell costs. */
import type { WorldPoint } from './worldPathfinding';

/** Travel cost of standing in a cell, by column and row. */
export type CellCost = (column: number, row: number) => number;
/** A route point; `pace` is the cost per table px of the stretch ending here. */
export type TimedPoint = WorldPoint & { pace: number };

const SQRT2 = Math.SQRT2;
const key = (column: number, row: number) => `${column},${row}`;

/** A min-heap of open cells keyed by estimated total cost. */
class OpenSet {
  private items: { key: string; column: number; row: number; f: number }[] = [];
  get size() { return this.items.length; }
  push(item: { key: string; column: number; row: number; f: number }) {
    const items = this.items;
    items.push(item);
    for (let i = items.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length) {
      items[0] = last;
      for (let i = 0; ;) {
        const left = i * 2 + 1, right = left + 1;
        let smallest = i;
        if (left < items.length && items[left].f < items[smallest].f) smallest = left;
        if (right < items.length && items[right].f < items[smallest].f) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

/** The fastest route from `start` to `target` (world points) across a grid of
 * `cellSize` cells, or null when none exists. The start and target cells can
 * always be stood on, whatever they cost. The route begins at `start` exactly
 * and ends at `target` exactly, through cell centres in between, with straight
 * runs of even ground merged. `maxCells` bounds the search. */
export function findGridPath(start: WorldPoint, target: WorldPoint, cost: CellCost, cellSize: number, maxCells = 40000): TimedPoint[] | null {
  if (![start.x, start.y, target.x, target.y].every(Number.isFinite)) return null;
  const at = (point: WorldPoint) => ({ column: Math.floor(point.x / cellSize + 0.5), row: Math.floor(point.y / cellSize + 0.5) });
  const from = at(start), to = at(target);
  const startKey = key(from.column, from.row), goalKey = key(to.column, to.row);
  const cellCost = (column: number, row: number) => {
    const k = key(column, row);
    const value = cost(column, row);
    if (k === startKey || k === goalKey) return Number.isFinite(value) ? Math.max(value, 1e-6) : 1;
    return value > 0 ? value : 1e-6;
  };
  const passable = (column: number, row: number) => Number.isFinite(cellCost(column, row));
  // Octile distance at the cheapest possible pace never overestimates.
  const floor = Math.min(1, cellCost(from.column, from.row), cellCost(to.column, to.row));
  const heuristic = (column: number, row: number) => {
    const dx = Math.abs(column - to.column), dy = Math.abs(row - to.row);
    return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * floor;
  };
  const best = new Map<string, number>([[startKey, 0]]);
  const came = new Map<string, { column: number; row: number; pace: number }>();
  const open = new OpenSet();
  open.push({ key: startKey, column: from.column, row: from.row, f: heuristic(from.column, from.row) });
  const closed = new Set<string>();
  let found = startKey === goalKey;
  while (open.size && !found) {
    const current = open.pop();
    if (closed.has(current.key)) continue;
    if (current.key === goalKey) { found = true; break; }
    closed.add(current.key);
    if (closed.size > maxCells) return null;
    const here = cellCost(current.column, current.row);
    const g = best.get(current.key)!;
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      if (!dx && !dy) continue;
      const column = current.column + dx, row = current.row + dy;
      const k = key(column, row);
      if (closed.has(k) || !passable(column, row)) continue;
      // No squeezing diagonally between (or past) blocked cells.
      if (dx && dy && (!passable(current.column + dx, current.row) || !passable(current.column, current.row + dy))) continue;
      // Half of each cell's cost for the half of the step spent in it.
      const pace = (here + cellCost(column, row)) / 2;
      const next = g + (dx && dy ? SQRT2 : 1) * pace;
      if (next >= (best.get(k) ?? Infinity)) continue;
      best.set(k, next);
      came.set(k, { column: current.column, row: current.row, pace });
      open.push({ key: k, column, row, f: next + heuristic(column, row) });
    }
  }
  if (!found) return null;
  // Cell centres from the goal back to the start, each with the pace of the step into it.
  const cells: { column: number; row: number; pace: number }[] = [];
  for (let k = goalKey, cell = { ...to, pace: cellCost(to.column, to.row) }; ;) {
    const step = came.get(k);
    cells.unshift({ column: cell.column, row: cell.row, pace: step?.pace ?? cell.pace });
    if (!step) break;
    cell = { column: step.column, row: step.row, pace: 0 };
    k = key(step.column, step.row);
  }
  const centre = (cell: { column: number; row: number }) => ({ x: cell.column * cellSize, y: cell.row * cellSize });
  const points: TimedPoint[] = [{ x: start.x, y: start.y, pace: 0 }];
  cells.forEach((cell, index) => { if (index > 0) points.push({ ...centre(cell), pace: cell.pace }); });
  const startPace = cellCost(from.column, from.row), goalPace = cellCost(to.column, to.row);
  // Off-centre start and target points join the route at their own cells' pace.
  if (cells.length === 1) points.push({ x: target.x, y: target.y, pace: goalPace });
  else {
    const first = centre(cells[0]);
    if (Math.hypot(first.x - start.x, first.y - start.y) > 1e-6) points.splice(1, 0, { ...first, pace: startPace });
    const last = points[points.length - 1];
    if (Math.hypot(last.x - target.x, last.y - target.y) > 1e-6) points.push({ x: target.x, y: target.y, pace: goalPace });
  }
  return simplify(points);
}

/** Drops points in the middle of a straight run at an even pace. */
const simplify = (points: TimedPoint[]) => {
  const out: TimedPoint[] = [];
  for (const point of points) {
    if (out.length && Math.hypot(point.x - out[out.length - 1].x, point.y - out[out.length - 1].y) < 1e-6) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      const cross = (b.x - a.x) * (point.y - b.y) - (b.y - a.y) * (point.x - b.x);
      const forward = (b.x - a.x) * (point.x - b.x) + (b.y - a.y) * (point.y - b.y) > 0;
      if (Math.abs(cross) < 1e-6 && forward && Math.abs(b.pace - point.pace) < 1e-9) { out[out.length - 1] = point; continue; }
    }
    out.push(point);
  }
  return out;
};

/** Travel time of a route in table px at pace 1. */
export const pathTime = (path: readonly TimedPoint[]) =>
  path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - path[index].x, point.y - path[index].y) * point.pace, 0);

/** Where an actor is `progress` (0-1) of the way through a route's travel
 * time: slower ground takes longer to cross. */
export function pointAlongTimedPath(path: readonly TimedPoint[], progress: number): WorldPoint {
  if (!path.length) return { x: 0, y: 0 };
  let remaining = pathTime(path) * Math.max(0, Math.min(1, progress));
  for (let i = 1; i < path.length; i += 1) {
    const length = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    const time = length * path[i].pace;
    if (remaining <= time && time > 0) {
      const t = remaining / time;
      return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * t, y: path[i - 1].y + (path[i].y - path[i - 1].y) * t };
    }
    remaining -= time;
  }
  return { x: path[path.length - 1].x, y: path[path.length - 1].y };
}

/** The part of a route still ahead after `progress` (0-1) of its travel
 * time, starting where the actor is now. */
export function remainingPath(path: readonly TimedPoint[], progress: number): TimedPoint[] {
  if (path.length < 2) return [...path];
  let remaining = pathTime(path) * Math.max(0, Math.min(1, progress));
  for (let i = 1; i < path.length; i += 1) {
    const length = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    const time = length * path[i].pace;
    if (remaining < time || i === path.length - 1) {
      const t = time > 0 ? Math.min(1, remaining / time) : 1;
      const here = { x: path[i - 1].x + (path[i].x - path[i - 1].x) * t, y: path[i - 1].y + (path[i].y - path[i - 1].y) * t, pace: 0 };
      return [here, ...path.slice(i)];
    }
    remaining -= time;
  }
  return [path[path.length - 1]];
}
