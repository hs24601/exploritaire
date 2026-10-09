import { describe, expect, it } from 'vitest';
import { connectedTileLabelRegions, fitTileTitle, immutableTerrainRegions, immutableTileRegions, titleBand } from './tileLabels';
import { createInitialState } from './rules/setup';

describe('immutable region labels', () => {
  it('keeps the notched range connected and its rectangular titles clear of the den', () => {
    const tiles = createInitialState().biomeTiles.map(tile => ({ ...tile, flags: tile.flags?.filter(flag => flag !== 'unexplored') }));
    const terrain = immutableTerrainRegions(tiles);
    expect(terrain).toHaveLength(1);
    expect(terrain[0].tiles).toHaveLength(89);
    const regions = immutableTileRegions(tiles);
    expect(regions).toHaveLength(3);
    expect(regions.map(region => region.tiles.length)).toEqual([7, 7, 75]);
    for (const region of regions) {
      expect(region.width * region.height / (48 * 48)).toBe(region.tiles.length);
      expect(Math.abs(region.x) < region.width / 2 && Math.abs(region.y - 96) < region.height / 2).toBe(false);
    }
  });
  it('does not bridge holes, corner contacts, or mismatched types and titles', () => {
    const base = { ...createInitialState().biomeTiles.find(tile => tile.tileType === 'impassable-mountain')!, flags: ['impassable'] as const };
    const tile = (id: string, x: number, y: number) => ({ ...base, id, position: { x, y } });
    expect(immutableTileRegions([tile('a', 0, 0), tile('b', 96, 0)])).toHaveLength(2);
    expect(immutableTileRegions([tile('a', 0, 0), tile('b', 48, 48)])).toHaveLength(2);
    expect(immutableTileRegions([tile('a', 0, 0), tile('b', 48, 0), tile('c', 0, 48)])).toHaveLength(2);
    expect(immutableTileRegions([tile('a', 0, 0), { ...tile('b', 48, 0), tileType: 'path' }])).toHaveLength(1);
    expect(immutableTileRegions([tile('a', 0, 0), { ...tile('b', 48, 0), title: 'Different' }])).toHaveLength(2);
  });
  it('groups only discovered mountains, leaving hidden neighbours out of art and labels', () => {
    const tiles = createInitialState().biomeTiles;
    const visible = tiles.filter(tile => tile.tileType === 'impassable-mountain' && !tile.flags?.includes('unexplored'));
    expect(visible).toHaveLength(5);
    expect(immutableTerrainRegions(tiles).flatMap(region => region.tiles)).toEqual(expect.arrayContaining(visible));
    expect(immutableTerrainRegions(tiles).flatMap(region => region.tiles)).toHaveLength(5);
    expect(immutableTileRegions(tiles).flatMap(region => region.tiles)).toHaveLength(5);
  });
});

describe('one label per connected named tile type', () => {
  const tile = (id: string, column: number, row: number) => ({
    id, title: 'Small Woods', terrain: 'woods', position: { x: column * 48, y: row * 48 },
    gridSize: { columns: 1, rows: 1 }, flags: [] as string[],
  });
  it('uses the large southern label for all five discovered mountains around the den', () => {
    const regions = connectedTileLabelRegions(createInitialState().biomeTiles);
    expect(regions).toHaveLength(1);
    expect(regions[0].tiles).toHaveLength(5);
    expect(regions[0]).toMatchObject({ title: 'Impassable Mountains', x: 0, y: 144, width: 144, height: 48 });
    expect(regions[0].tiles.some(tile => tile.tileType === 'hero-den')).toBe(false);
  });
  it('chooses one safe label for a fully discovered notched range', () => {
    const tiles = createInitialState().biomeTiles.filter(tile => tile.tileType === 'impassable-mountain')
      .map(tile => ({ ...tile, flags: ['impassable'] }));
    expect(connectedTileLabelRegions(tiles)).toHaveLength(1);
    expect(connectedTileLabelRegions(tiles)[0]).toMatchObject({ width: 720, height: 240, x: 0, y: 240 });
  });
  it('groups mutable biomes and finds a rectangle spanning uneven row widths', () => {
    const tiles = [tile('a', 0, 0), tile('b', 1, 0), tile('c', 0, 1), tile('d', 1, 1),
      tile('e', 2, 1), tile('f', 0, 2), tile('g', 1, 2)];
    const [region] = connectedTileLabelRegions(tiles);
    expect(region.tiles).toHaveLength(7);
    expect(region).toMatchObject({ x: 24, y: 48, width: 96, height: 144 });
    expect(connectedTileLabelRegions([...tiles].reverse())).toEqual([region]);
  });
  it('keeps gaps, fog, corner-only contacts, different types and distinct names separate', () => {
    const pair = [tile('a', 0, 0), tile('b', 1, 0)];
    const hidden = { ...tile('fog', 2, 0), flags: ['unexplored'] };
    const other = [tile('c', 3, 0), tile('d', 4, 0)];
    const regions = connectedTileLabelRegions([...pair, hidden, ...other,
      tile('diagonal', -1, -1), { ...tile('pond', 0, 1), terrain: 'water' },
      { ...tile('dark', 1, 1), title: 'Dark Woods' }]);
    expect(regions.map(region => region.tiles.map(tile => tile.id))).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('respects larger tile footprints without merging the underlying tile objects', () => {
    const large = { ...tile('large', 1, 1), gridSize: { columns: 2, rows: 2 } };
    const small = tile('small', 2, 0);
    const [region] = connectedTileLabelRegions([large, small]);
    expect(region.tiles).toEqual([large, small]);
    expect(region).toMatchObject({ width: 96, height: 96, x: 24, y: 24 });
  });
});

describe('complete titles within rotating footprints', () => {
  const measure = (text: string, size: number) => text.length * size * 0.6;
  for (const align of ['center', 'top'] as const) {
  for (const yaw of [0, 22.5, 45, 89, 90, 135, 180, 225, 270, 315, 359]) {
    for (const [title, width, height] of [['IMPASSABLE MOUNTAINS', 136, 40], ["HERO'S DEN", 40, 16], ['SMALL WOODS', 40, 40]] as const) {
      it(`retains ${title} aligned ${align} at ${yaw} degrees without crossing the footprint`, () => {
        const layout = fitTileTitle(title, width, height, yaw, measure, 18, 6, align);
        expect(layout.fits).toBe(true);
        expect(layout.lines.map(line => line.text).join('').replace(/ /g, '')).toBe(title.replace(/ /g, ''));
        if (align === 'top' && yaw === 0) expect(layout.lines[0].y).toBeCloseTo(-height / 2);
        for (const line of layout.lines) {
          const band = titleBand(width, height, yaw, line.y, line.y + layout.lineHeight)!;
          expect(line.x - measure(line.text, layout.fontSize) / 2).toBeGreaterThanOrEqual(band.left - 0.01);
          expect(line.x + measure(line.text, layout.fontSize) / 2).toBeLessThanOrEqual(band.right + 0.01);
        }
      });
    }
  }
  }
});
