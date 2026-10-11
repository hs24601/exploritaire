import { describe, expect, it } from 'vitest';
import { tileSpills, TILE_SPILLS } from './tileSpill';
import { TABLE_GRID } from './gridCoordinates';

const cellOf = (position: { x: number; y: number }) => TABLE_GRID.atWorld(position);
const tile = (id: string, kind: string, column: number, row: number) => ({ id, kind, position: TABLE_GRID.center(TABLE_GRID.cell(column, row)) });
// The Day 1 corner: berry patch (-1,1), dirt (0,1), den (0,2), mountains beside the den.
const tiles = [tile('berries', 'berry-patch', -1, 1), tile('dirt', 'dirt', 0, 1), tile('den', 'hero-den', 0, 2), tile('rock', 'impassable-mountain', -1, 2)];

describe('tile spill', () => {
  const decals = tileSpills(tiles, cellOf, 48);

  it('spills only across the edges a rule names', () => {
    expect(new Set(decals.map(d => `${d.from}>${d.onto}`))).toEqual(new Set(['hero-den>dirt', 'berry-patch>dirt', 'dirt>berry-patch']));
    expect(decals.filter(d => d.from === 'hero-den')).toHaveLength(TILE_SPILLS[0].count);
  });

  it('keeps den stones near the cave mouth edge, mostly inside the dirt', () => {
    const stones = decals.filter(d => d.from === 'hero-den');
    for (const stone of stones) {
      expect(stone.y).toBeLessThan(72 + 48 * .08 + 1); // den's north edge is y = 72
      expect(stone.y).toBeGreaterThan(72 - 48 * .42 - 1);
      expect(Math.abs(stone.x)).toBeLessThan(24);
    }
    expect(stones.filter(s => s.y < 72).length).toBeGreaterThan(stones.length / 2);
  });

  it('straddles the shared edge both ways between berries and dirt', () => {
    const sprigs = decals.filter(d => d.from === 'berry-patch'), clods = decals.filter(d => d.from === 'dirt');
    expect(sprigs.every(d => d.x > -24 - 48 * .14 - 1 && d.x < -24 + 48 * .3 + 1)).toBe(true);
    expect(clods.every(d => d.x < -24 + 48 * .14 + 1 && d.x > -24 - 48 * .3 - 1)).toBe(true);
  });

  it('is stable and keeps clear of labels', () => {
    expect(tileSpills(tiles, cellOf, 48)).toEqual(decals);
    const label = { left: -12, top: 40, right: 12, bottom: 60 };
    for (const d of tileSpills(tiles, cellOf, 48, { avoid: [label] })) {
      const clear = d.x + d.size / 2 <= label.left || d.x - d.size / 2 >= label.right || d.y + d.size / 2 <= label.top || d.y - d.size / 2 >= label.bottom;
      expect(clear).toBe(true);
    }
  });
});
