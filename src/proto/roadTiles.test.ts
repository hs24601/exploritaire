import { describe, expect, it } from 'vitest';
import { createRoadTile, ROAD_PATHS } from './roadTiles';
import { discoverTiles } from './tileDiscovery';
import { arriveActorAtBiome, activateBiome } from './biomeArrival';
import { biomeExploration, dealClearedShare } from './biomeFlags';
import { applyFoundationPlay } from './rules/play';
import { nextQuestCard } from './protoQuestDeals';
import { createInitialState } from './rules/setup';

describe('road exploration', () => {
  it('places the requested orientations and explores the occupied Hero’s Den', () => {
    // The starting world has no roads; roads keep their authored orientation when created.
    expect(createInitialState().biomeTiles.filter(tile => tile.road)).toEqual([]);
    const roads = [createRoadTile('road-center', 0, 0, { shape: 'straight', rotation: 0 }), createRoadTile('road-east', 1, 1, { shape: 'straight', rotation: 90 })];
    expect(roads.map(tile => [tile.position, tile.road?.shape, tile.road?.rotation])).toEqual([
      [{ x: 0, y: 0 }, 'straight', 0], [{ x: 48, y: 48 }, 'straight', 90],
    ]);
    const den = createInitialState().biomeTiles.find(tile => tile.tileType === 'hero-den')!;
    expect(den.title).toBe("Hero's Den");
    expect(den.position).toEqual({ x: 0, y: 96 });
    const state = createInitialState();
    expect(state.worldActors[0].position).toEqual(den.position);
    expect(state.biomeTiles.filter(tile => tile.position.x === 0 && tile.position.y === 96)).toHaveLength(1);
    expect(den.flags).toEqual([]);
    expect(den.tableau.flat().length).toBeGreaterThan(0);
    // Den, five mountains, Berry Patch, Old Tree, Dark Woods and dirt.
    expect(createInitialState().biomeTiles).toHaveLength(10);
    expect(roads[0].flags).toEqual(['unexplored']);
    expect(roads[1].flags).toEqual(['unexplored']);
    expect(Object.keys(ROAD_PATHS)).toHaveLength(4);
  });
  it('reveals a road crossed between animation samples, and preserves unrelated tiles', () => {
    const road = createRoadTile('road', 0, 0, { shape: 'curve', rotation: 270 });
    const far = createRoadTile('far', 3, 3, { shape: 'fork', rotation: 90 });
    const tiles = [road, far];
    expect(discoverTiles(tiles, { x: -48, y: 0 }, { x: 48, y: 0 })[0].flags).toEqual([]);
    expect(discoverTiles(tiles, { x: -48, y: 96 }, { x: 48, y: 96 })).toBe(tiles);
    expect(discoverTiles(tiles, { x: 0, y: 0 })[1]).toBe(far);
  });
});

describe('path exploration deals', () => {
  it('opens a neutral path deal on arrival and reaches full exploration only after all cards clear', () => {
    const base = createInitialState();
    let state = { ...base, biomeTiles: [...base.biomeTiles, createRoadTile('unexplored--1-0', -1, 0)] };
    const tile = state.biomeTiles.find(tile => tile.id === 'unexplored--1-0')!;
    expect(tile.tileType).toBe('unexplored');
    expect(biomeExploration(tile.flags, 0)).toBe(0);
    expect(tile.tableau.flat().every(card => !card.resource && !card.encounter)).toBe(true);
    state = arriveActorAtBiome(state, 'hero', tile.id, tile.position);
    expect(state.selectedBiomeId).toBe(tile.id);
    expect(state.worldActors[0].location).toBe('foundation');
    expect(biomeExploration(state.biomeTiles.find(t => t.id === tile.id)!.flags, 0)).toBe(0.1);
    state = { ...state, energy: 100 };
    for (let step = 0; step < 13; step++) {
      const next = nextQuestCard(state.tableau)!;
      const columnIndex = state.tableau.findIndex(column => column[column.length - 1]?.id === next.id);
      const result = applyFoundationPlay(state, { columnIndex, foundationIndex: 0 });
      expect(result).not.toBeNull();
      state = result!.state;
      const remaining = state.tableau.flat().length + state.stock.length;
      expect(biomeExploration([], dealClearedShare(tile.dealt!, remaining))).toBeLessThanOrEqual(1);
      if (step < 12) expect(biomeExploration([], dealClearedShare(tile.dealt!, remaining))).toBeLessThan(1);
    }
    expect(biomeExploration([], dealClearedShare(tile.dealt!, 0))).toBe(1);
    expect(state.biome.cacheClaimed).toBe(true);
    // Loading another tile must preserve this path's completed deal.
    state = activateBiome(activateBiome(state, 'day-one-berries'), tile.id);
    expect(state.tableau.flat()).toHaveLength(0);
  });
  it('creates unique deals without overlapping table cells', () => {
    const state = createInitialState();
    expect(new Set(state.biomeTiles.map(tile => `${tile.position.x},${tile.position.y}`)).size).toBe(state.biomeTiles.length);
    const cards = state.biomeTiles.flatMap(tile => tile.tableau.flat());
    expect(cards.length).toBeGreaterThan(0);
    expect(new Set(cards.map(card => card.id)).size).toBe(cards.length);
  });
});
