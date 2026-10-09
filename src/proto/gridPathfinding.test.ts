import { describe, expect, it } from 'vitest';
import { findGridPath, pathTime, pointAlongTimedPath, remainingPath, type CellCost } from './gridPathfinding';

const CELL = 48;
const at = (column: number, row: number) => ({ x: column * CELL, y: row * CELL });
/** A 15x15 table around (0,0) with some cells costed. */
const table = (cells: Record<string, number> = {}): CellCost => (column, row) =>
  Math.abs(column) > 7 || Math.abs(row) > 7 ? Infinity : cells[`${column},${row}`] ?? 1;
const cellsOf = (path: { x: number; y: number }[]) => {
  // Every cell the route passes through, sampled finely.
  const seen = new Set<string>();
  for (let i = 1; i < path.length; i += 1) for (let t = 0; t <= 1; t += 0.02) {
    const x = path[i - 1].x + (path[i].x - path[i - 1].x) * t, y = path[i - 1].y + (path[i].y - path[i - 1].y) * t;
    // A diagonal through the point where four cells meet only grazes them.
    const nearEdge = (v: number) => Math.abs(((v / CELL + 0.5) % 1 + 1) % 1) < 0.02 || Math.abs(((v / CELL + 0.5) % 1 + 1) % 1) > 0.98;
    if (nearEdge(x) && nearEdge(y)) continue;
    seen.add(`${Math.floor(x / CELL + 0.5)},${Math.floor(y / CELL + 0.5)}`);
  }
  return seen;
};

describe('grid pathfinding', () => {
  it('goes straight and diagonally on open table', () => {
    expect(findGridPath(at(0, 0), at(3, 0), table(), CELL)!.map(({ x, y }) => ({ x, y }))).toEqual([at(0, 0), at(3, 0)]);
    expect(findGridPath(at(0, 0), at(2, 2), table(), CELL)!.map(({ x, y }) => ({ x, y }))).toEqual([at(0, 0), at(2, 2)]);
  });

  it('crosses an explored biome to save time and goes around an unexplored one', () => {
    // A wall of biome cells across row 0 from column -3 to 3.
    const wall = (cost: number) => Object.fromEntries([-3, -2, -1, 0, 1, 2, 3].map((column) => [`${column},0`, cost]));
    const through = findGridPath(at(0, 2), at(0, -2), table(wall(1)), CELL)!;
    expect(cellsOf(through).has('0,0')).toBe(true);
    const around = findGridPath(at(0, 2), at(0, -2), table(wall(Infinity)), CELL)!;
    for (const cell of cellsOf(around)) expect(cell.endsWith(',0') && Math.abs(Number(cell.split(',')[0])) <= 3, cell).toBe(false);
    expect(pathTime(around)).toBeGreaterThan(pathTime(through));
  });

  it('takes rough ground only when it is still faster', () => {
    // A short rough strip is worth crossing; a rough wall with a short way round is not.
    const shortStrip = Object.fromEntries([-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7].map((column) => [`${column},0`, 3]));
    const strip = findGridPath(at(0, 2), at(0, -2), table(shortStrip), CELL)!;
    expect(cellsOf(strip).has('0,0')).toBe(true);
    const block = { '0,0': 3, '0,-1': 3, '0,1': 3 };
    const avoid = findGridPath(at(0, 2), at(0, -2), table(block), CELL)!;
    expect([...cellsOf(avoid)].some((cell) => cell in block)).toBe(false);
  });

  it('may end on an unexplored target and start from inside one', () => {
    const fog = { '2,0': Infinity, '0,0': Infinity };
    const into = findGridPath(at(0, 2), at(2, 0), table(fog), CELL)!;
    expect(into[into.length - 1]).toMatchObject(at(2, 0));
    const out = findGridPath(at(0, 0), at(0, 3), table(fog), CELL)!;
    expect(out[0]).toMatchObject(at(0, 0));
  });

  it('never cuts a corner past a blocked cell', () => {
    const corner = { '1,0': Infinity, '0,1': Infinity };
    // (0,0) to (1,1) only diagonally between two blocked cells: not allowed.
    const path = findGridPath(at(0, 0), at(1, 1), table({ ...corner, '-1,0': Infinity, '0,-1': Infinity, '-1,1': Infinity, '1,-1': Infinity, '-1,-1': Infinity }), CELL);
    expect(path).toBeNull();
  });

  it('says so when there is no route', () => {
    const sealed = Object.fromEntries([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([c, r]) => [`${c},${r}`, Infinity]));
    expect(findGridPath(at(0, 0), at(4, 4), table(sealed), CELL)).toBeNull();
    expect(findGridPath(at(0, 0), at(20, 0), table(), CELL)).toBeNull();
  });

  it('walks back to the Hero\'s starting square beside the pond and woods', () => {
    // The starting layout: Hero at (0,1), pond at (-1,-1), woods at (0,-1) and (1,-1).
    const layout = table({ '-1,-1': Infinity, '0,-1': Infinity, '1,-1': Infinity });
    const away = findGridPath(at(0, 1), at(1, 1), layout, CELL)!;
    const back = findGridPath(at(1, 1), at(0, 1), layout, CELL)!;
    expect(away[away.length - 1]).toMatchObject(at(1, 1));
    expect(back[back.length - 1]).toMatchObject(at(0, 1));
  });

  it('keeps fractional ends and paces travel by the ground', () => {
    const path = findGridPath({ x: 5, y: 3 }, { x: 101, y: 2 }, table({ '1,0': 3 }), CELL)!;
    expect(path[0]).toMatchObject({ x: 5, y: 3 });
    expect(path[path.length - 1]).toMatchObject({ x: 101, y: 2 });
    const even = [{ x: 0, y: 0, pace: 0 }, { x: 48, y: 0, pace: 1 }, { x: 96, y: 0, pace: 3 }];
    expect(pathTime(even)).toBe(48 + 144);
    // Half the travel time is spent a third of the way into the slow stretch.
    expect(pointAlongTimedPath(even, 0.5).x).toBeCloseTo(48 + 48 * ((96 - 48) / 144));
  });
});

describe('route consumption', () => {
  it('keeps only the route still ahead of the actor', () => {
    const path = [{ x: 0, y: 0, pace: 0 }, { x: 48, y: 0, pace: 1 }, { x: 48, y: 48, pace: 1 }];
    expect(remainingPath(path, 0)).toEqual([{ x: 0, y: 0, pace: 0 }, { x: 48, y: 0, pace: 1 }, { x: 48, y: 48, pace: 1 }]);
    const half = remainingPath(path, 0.75);
    expect(half[0]).toMatchObject({ x: 48, y: 24 });
    expect(half.slice(1)).toEqual([{ x: 48, y: 48, pace: 1 }]);
    expect(pathTime(remainingPath(path, 0.5))).toBeCloseTo(48);
  });
});
