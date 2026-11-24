import { cellKey, cellPoint, MOUNTAINS, type Point } from './roamRescue';

export const MAP_CELLS = Array.from({ length: 90 }, (_, i) => ({ column: i % 9 - 4, row: Math.floor(i / 9) - 7 }));
const inMap = (c: number, r: number) => c >= -4 && c <= 4 && r >= -7 && r <= 2;
/** Discovery grows only from cells actually walked, never from revealed neighbours. */
export function revealedCells(visited: string[]) {
  const result = new Set<string>();
  for (const key of visited) {
    const [c, r] = key.split(',').map(Number);
    for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (inMap(x, y)) result.add(`${x},${y}`);
  }
  return result;
}
/** Bounded cardinal paths cannot cut mountain corners or route through the fog. */
export function fogRoute(position: Point, target: string, revealed: Set<string>): Point[] {
  const start = cellKey(position), queue = [start], parent = new Map<string, string | null>([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i];
    if (key === target) {
      const route: Point[] = [];
      for (let k = key; k !== start; k = parent.get(k)!) { const [c, r] = k.split(',').map(Number); route.unshift(cellPoint(c, r)); }
      return route;
    }
    const [c, r] = key.split(',').map(Number);
    for (const [x, y] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
      const next = `${x},${y}`;
      if (inMap(x, y) && revealed.has(next) && !MOUNTAINS.has(next) && !parent.has(next)) { parent.set(next, key); queue.push(next); }
    }
  }
  return [];
}
