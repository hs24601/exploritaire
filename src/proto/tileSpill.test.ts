import { describe, expect, it } from 'vitest';
import { tileSpills, TILE_SPILLS, TILE_SPILL_PROFILES, type TileSpillProfile } from './tileSpill';
import { TABLE_GRID } from './gridCoordinates';

const cellOf = (position: { x: number; y: number }) => TABLE_GRID.atWorld(position);
const tile = (id: string, kind: string, column: number, row: number) => ({ id, kind, position: TABLE_GRID.center(TABLE_GRID.cell(column, row)) });
// The Day 1 corner: berry patch (-1,1), dirt (0,1), den (0,2), mountains beside the den.
const tiles = [tile('berries', 'berry-patch', -1, 1), tile('dirt', 'dirt', 0, 1), tile('den', 'hero-den', 0, 2), tile('rock', 'impassable-mountain', -1, 2)];

describe('tile spill', () => {
  const decals = tileSpills(tiles, cellOf, 48);

  it('retains authored exceptions and adds automatic berry/mountain transitions', () => {
    expect(new Set(decals.map(d => `${d.from}>${d.onto}`))).toEqual(new Set(['hero-den>dirt', 'berry-patch>dirt',
      'berry-patch>impassable-mountain', 'impassable-mountain>berry-patch']));
    expect(decals.filter(d => d.from === 'hero-den')).toHaveLength(TILE_SPILLS[0].count);
  });

  it.each([[0, -1], [1, 0], [0, 1], [-1, 0]])('detects the shared edge at (%i,%i) without placement-specific rules', (x, y) => {
    const pair = [tile('rock', 'impassable-mountain', 5, -3), tile('berry', 'berry-patch', 5 + x, -3 + y)];
    const spill = tileSpills(pair, cellOf, 48);
    expect(spill.filter(d => d.from === 'impassable-mountain')).toHaveLength(6);
    expect(spill.filter(d => d.from === 'berry-patch')).toHaveLength(4);
    for (const d of spill) {
      const edge = { x: pair[0].position.x + x * 24, y: pair[0].position.y + y * 24 };
      expect(Math.abs((d.x - edge.x) * x + (d.y - edge.y) * y)).toBeLessThan(48 * .32 + 1);
    }
  });

  it('updates after adding, changing, moving, hiding, revealing and removing a live map tile', () => {
    const source = { ...tile('rock', 'unused', 0, 0), kind: undefined, tileType: 'impassable-mountain' };
    const target = { ...tile('berry', 'unused', 1, 0), kind: undefined, tileType: 'berry-patch', flags: [] as string[] };
    const map = [source];
    expect(tileSpills(map, cellOf, 48)).toEqual([]);
    map.push(target);
    expect(tileSpills(map, cellOf, 48)).toHaveLength(10);
    target.tileType = 'dirt';
    expect(new Set(tileSpills(map, cellOf, 48).map(d => d.onto))).toEqual(new Set(['dirt', 'impassable-mountain']));
    target.flags.push('unexplored');
    expect(tileSpills(map, cellOf, 48)).toEqual([]);
    target.flags.pop();
    expect(tileSpills(map, cellOf, 48)).toHaveLength(12);
    target.position = TABLE_GRID.center(TABLE_GRID.cell(1, 1));
    expect(tileSpills(map, cellOf, 48)).toEqual([]);
    map.pop();
    expect(tileSpills(map, cellOf, 48)).toEqual([]);
  });

  it('omits same surfaces, empty cells, diagonals, water, unregistered and locked tiles', () => {
    for (const kind of ['impassable-mountain', 'hero-den', 'water', 'future-tile']) {
      expect(tileSpills([tile('rock', 'impassable-mountain', 0, 0), tile('other', kind, 1, 0)], cellOf, 48)).toEqual([]);
    }
    expect(tileSpills([tile('a', 'woods', 0, 0), tile('b', 'berry-patch', 1, 0)], cellOf, 48)).toEqual([]);
    expect(tileSpills([tile('rock', 'impassable-mountain', 0, 0), { ...tile('berry', 'berry-patch', 1, 0), unlocked: false }], cellOf, 48)).toEqual([]);
  });

  it('falls back to terrain and treats discovered road/path tiles as soil', () => {
    for (const road of [undefined, { shape: 'straight' }]) {
      const map = [{ id: 'forest', terrain: 'woods', position: { x: 0, y: 0 } },
        { id: 'path', tileType: 'unexplored', road, flags: [], position: { x: 48, y: 0 } }];
      const spill = tileSpills(map, cellOf, 48);
      expect(spill).toHaveLength(4);
      expect(spill.some(d => d.onto === (road ? 'road' : 'path'))).toBe(true);
    }
  });

  it('registers a new type once and automatically matches neighboring surfaces', () => {
    const profiles: Record<string, TileSpillProfile> = { ...TILE_SPILL_PROFILES, meadow: TILE_SPILL_PROFILES['berry-patch'] };
    const spill = tileSpills([tile('a', 'meadow', 0, 0), tile('b', 'impassable-mountain', 1, 0)], cellOf, 48, { profiles });
    expect(spill).toHaveLength(10);
    expect(new Set(spill.map(d => d.from))).toEqual(new Set(['meadow', 'impassable-mountain']));
  });

  it('preserves existing seams when tile or rule ordering changes and unrelated tiles are added', () => {
    const baseline = tileSpills(tiles, cellOf, 48);
    const changed = tileSpills([tile('distant', 'dirt', 9, 9), ...tiles].reverse(), cellOf, 48, {
      rules: [...TILE_SPILLS].reverse(), profiles: TILE_SPILL_PROFILES,
    });
    const sorted = (spill: typeof baseline) => spill.sort((a, b) => a.id.localeCompare(b.id));
    expect(sorted(changed)).toEqual(sorted(baseline));
    expect(new Set(baseline.map(d => d.id)).size).toBe(baseline.length);
  });

  it('keeps explicit custom rules exclusive and gives multiple effects unique IDs', () => {
    const rule = TILE_SPILLS[1];
    expect(tileSpills(tiles, cellOf, 48, { rules: [] })).toEqual([]);
    const spill = tileSpills(tiles, cellOf, 48, { rules: [rule, { ...rule, art: ['clod-a.svg'] }] });
    expect(spill).toHaveLength(12);
    expect(new Set(spill.map(d => d.id)).size).toBe(spill.length);
    expect(new Set(spill.map(d => d.from))).toEqual(new Set(['berry-patch']));
  });

  it('keeps the den mouth exception and protects its authored artwork from incoming debris', () => {
    for (const [x, y] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const spill = tileSpills([tile('den', 'hero-den', 0, 0), tile('dirt', 'dirt', x, y)], cellOf, 48);
      expect(spill).toHaveLength(y === -1 ? 12 : 0);
      expect(spill.every(d => d.from === 'hero-den')).toBe(true);
    }
  });

  it('keeps den stones near the cave mouth edge, mostly inside the dirt', () => {
    const stones = decals.filter(d => d.from === 'hero-den');
    for (const stone of stones) {
      expect(stone.y).toBeLessThan(72 + 48 * .08 + 1); // den's north edge is y = 72
      expect(stone.y).toBeGreaterThan(72 - 48 * TILE_SPILLS[0].reach - 1);
      expect(Math.abs(stone.x)).toBeLessThan(24 * (TILE_SPILLS[0].spread ?? 1));
    }
    expect(stones.filter(s => s.y < 72).length).toBeGreaterThan(stones.length / 2);
  });

  it('straddles the shared edge both ways between berries and dirt', () => {
    const sprigs = decals.filter(d => d.from === 'berry-patch' && d.onto === 'dirt'), clods = decals.filter(d => d.from === 'dirt' && d.onto === 'berry-patch');
    expect(sprigs.every(d => d.x > -24 - 48 * TILE_SPILLS[1].overlap - 1 && d.x < -24 + 48 * TILE_SPILLS[1].reach + 1)).toBe(true);
    expect(clods).toHaveLength(0);
  });

  it('concentrates the largest pieces on the dividing line in every direction', () => {
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const pair=[tile('berry','berry-patch',0,0),tile('dirt','dirt',dx,dy)];
      const spill=tileSpills(pair,cellOf,48);
      for(const from of ['berry-patch','dirt']) {
        const effects=spill.filter(d=>d.from===from);
        const near=effects.filter(d=>Math.abs((d.x-dx*24)*dx+(d.y-dy*24)*dy)<=d.size*.2);
        expect(near.length).toBeGreaterThanOrEqual(Math.ceil(effects.length*.75));
        const outer=effects.filter(d=>!near.includes(d));
        if(outer.length)expect(near.reduce((sum,d)=>sum+d.size,0)/near.length).toBeGreaterThanOrEqual(outer.reduce((sum,d)=>sum+d.size,0)/outer.length);
      }
    }
  });
  it('intermingles berry and rock edges with varied minimum-one relief', () => {
    const spill=tileSpills([tile('berry','berry-patch',0,0),tile('rock','impassable-mountain',0,1)],cellOf,48);
    for(const from of ['berry-patch','impassable-mountain']) {
      const pieces=spill.filter(d=>d.from===from);
      expect(pieces.some(d=>d.y-d.size/2<24&&d.y+d.size/2>24)).toBe(true);
      expect(pieces.every(d=>d.relief>=1)).toBe(true);
      expect(new Set(pieces.map(d=>d.relief)).size).toBeGreaterThan(1);
    }
    expect(spill.filter(d=>Math.abs(d.y-24)<d.size/2).length).toBeGreaterThanOrEqual(7);
  });
  it('keeps shared earth below berry foliage and leaves room for stone groups', () => {
    const earthPair=tileSpills([tile('dirt','dirt',0,0),tile('berry','berry-patch',1,0)],cellOf,48);
    expect(earthPair.every(d=>d.from==='berry-patch')).toBe(true);
    const mixed=tileSpills([tile('rock','impassable-mountain',0,0),tile('berry','berry-patch',1,0)],cellOf,48);
    const foliage=mixed.filter(d=>d.from==='berry-patch'), stones=mixed.filter(d=>d.from==='impassable-mountain');
    expect(foliage).toHaveLength(4);expect(stones).toHaveLength(6);
    expect(foliage.every(d=>d.size<=10&&d.relief<=2)).toBe(true);
    expect(stones.every(d=>d.art.startsWith('pebble-')&&d.size>=7)).toBe(true);
  });
  it('is stable and keeps clear of labels', () => {
    const before = structuredClone(tiles);
    expect(tileSpills(tiles, cellOf, 48)).toEqual(decals);
    expect(tiles).toEqual(before);
    const label = { left: -12, top: 40, right: 12, bottom: 60 };
    for (const d of tileSpills(tiles, cellOf, 48, { avoid: [label] })) {
      const clear = d.x + d.size / 2 <= label.left || d.x - d.size / 2 >= label.right || d.y + d.size / 2 <= label.top || d.y - d.size / 2 >= label.bottom;
      expect(clear).toBe(true);
    }
  });
});
