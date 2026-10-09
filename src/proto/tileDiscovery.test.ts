import { describe, expect, it } from 'vitest';
import { createRoadTile } from './roadTiles';
import { discoverActorTiles, discoverTiles } from './tileDiscovery';
import { createInitialState } from './rules/setup';
import { arriveActorAtBiome } from './biomeArrival';

describe('actor tile discovery', () => {
  it('reveals only the entered path without consuming a deal or revealing neighbours', () => {
    const tiles = Array.from({ length: 25 }, (_, i) => createRoadTile(`cell-${i}`, i % 5 - 2, Math.floor(i / 5) - 2));
    const next = discoverTiles(tiles, { x: 0, y: 0 });
    expect(next.filter(tile => !tile.flags?.includes('unexplored'))).toHaveLength(1);
    next.forEach((tile, index) => {
      expect(tile.tableau).toBe(tiles[index].tableau);
      expect(tile.stock).toBe(tiles[index].stock);
      expect(tile.tileType).toBe(tile.position.x === 0 && tile.position.y === 0 ? 'path' : 'unexplored');
    });
  });

  it('keeps woods, ponds and mountains discoverable by proximity while roads require entry', () => {
    const state = createInitialState();
    const tiles = state.biomeTiles.map(tile => ({ ...tile, flags: [...new Set([...(tile.flags ?? []), 'unexplored' as const])] }));
    for (const id of ['woods-alpha', 'pond', 'road-east', 'mountain-1-2']) {
      const tile = tiles.find(tile => tile.id === id)!;
      const nearby = discoverTiles(tiles, { x: tile.position.x - 48, y: tile.position.y - 48 }).find(t => t.id === id)!;
      if (tile.road) expect(nearby).toBe(tile);
      const result = tile.road ? discoverTiles(tiles, tile.position).find(t => t.id === id)! : nearby;
      expect(result.flags).toEqual(tile.flags.filter(flag => flag !== 'unexplored'));
      expect(result.tableau).toBe(tile.tableau);
      expect(result.tileType).toBe(tile.tileType === 'unexplored' ? 'path' : tile.tileType);
    }
  });

  it('keeps distant southern rows hidden and retains initial nearby discoveries', () => {
    const state = createInitialState();
    const southern = state.biomeTiles.filter(tile => tile.position.y >= 4 * 48);
    expect(southern).toHaveLength(60);
    expect(southern.every(tile => tile.flags?.includes('unexplored'))).toBe(true);
    for (const id of ['unexplored--1-1', 'unexplored-0-1', 'road-east']) {
      expect(state.biomeTiles.find(tile => tile.id === id)!.flags).toContain('unexplored');
    }
    const next = discoverTiles(state.biomeTiles, { x: 0, y: -48 });
    expect(next.find(tile => tile.id === 'mountain-1-2')!.flags).toEqual(['impassable']);
    expect(next.find(tile => tile.id === 'woods-alpha')!.flags).toEqual(['rough']);
    expect(next.find(tile => tile.id === 'mountain-0-7')!.flags).toContain('unexplored');
    expect(discoverTiles(next, { x: 0, y: -48 })).toBe(next);
  });

  it('discovers along actual travel segments, including skipped cells', () => {
    const tiles = Array.from({ length: 9 }, (_, column) => createRoadTile(`path-${column}`, column, 0));
    const next = discoverTiles(tiles, { x: 0, y: 0 }, { x: 6 * 48, y: 0 });
    expect(next.slice(0, 7).every(tile => !tile.flags?.includes('unexplored'))).toBe(true);
    expect(next[7]).toBe(tiles[7]);
    expect(next[8]).toBe(tiles[8]);
    expect(discoverTiles(tiles, { x: NaN, y: 0 })).toBe(tiles);
  });

  it('uses the shared right/bottom boundary tie and handles larger footprints', () => {
    const tile = createRoadTile('origin', 0, 0);
    expect(discoverTiles([tile], { x: 24, y: 0 })[0]).toBe(tile);
    expect(discoverTiles([tile], { x: 24, y: 0 }, { x: 96, y: 0 })[0]).toBe(tile);
    expect(discoverTiles([tile], { x: 23.99, y: 0 })[0].flags).toEqual([]);
    expect(discoverTiles([tile], { x: -24, y: 0 })[0].flags).toEqual([]);
    const wide = { ...tile, gridSize: { columns: 2, rows: 2 } };
    expect(discoverTiles([wide], { x: -48, y: -48 })[0].flags).toEqual([]);
    expect(discoverTiles([wide], { x: 96, y: 96 })[0]).toBe(wide);
  });

  it('handles arrivals and multiple actors without activating neighbouring deals', () => {
    let state = createInitialState();
    const target = state.biomeTiles.find(tile => tile.id === 'woods-alpha')!;
    state = arriveActorAtBiome(state, 'hero', target.id, target.position);
    expect(state.selectedBiomeId).toBe(target.id);
    expect(state.biomeTiles.find(tile => tile.id === 'pond')!.flags).toEqual([]);
    expect(state.biomeTiles.find(tile => tile.id === 'woods-east')!.flags).toEqual([]);
    expect(state.worldActors[0].location).toBe('foundation');
    state = { ...state, worldActors: [...state.worldActors, { ...state.worldActors[0], position: { x: -6 * 48, y: 48 }, location: 'table' }] };
    const next = discoverActorTiles(state);
    expect(next.biomeTiles.find(tile => tile.id === 'mountain--6-2')!.flags).toEqual(['impassable']);
    expect(next.biomeTiles.find(tile => tile.id === 'mountain--6-3')!.flags).toContain('unexplored');
    expect(next.selectedBiomeId).toBe(target.id);
    expect(discoverActorTiles(next)).toBe(next);
  });

  it('discovers from the physical first cell when an actor staffs a larger biome', () => {
    const base = createInitialState();
    const biome = { ...createRoadTile('large', 0, 0), gridSize: { columns: 3, rows: 3 }, flags: [] };
    const nearby = createRoadTile('first-cell', -1, -1);
    const distant = createRoadTile('near-anchor', 2, 2);
    const state = { ...base, biomeTiles: [biome, nearby, distant],
      worldActors: [{ ...base.worldActors[0], location: 'foundation' as const, biomeId: biome.id, position: biome.position }] };
    const next = discoverActorTiles(state);
    expect(next.biomeTiles[1].flags).toEqual([]);
    expect(next.biomeTiles[2]).toBe(distant);
  });
});
