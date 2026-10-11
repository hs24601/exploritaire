import { describe, expect, it } from 'vitest';
import { createDirtTile } from './dirtTiles';
import { createInitialState } from './rules/setup';
import { arriveActorAtBiome } from './biomeArrival';
import { discoverTiles } from './tileDiscovery';
import { biomeTravelCost } from './biomeFlags';

describe('dirt ground', () => {
  it('places unique, discovered dirt north of home and loads its resource-free deal on arrival', () => {
    const state = createInitialState();
    const dirt = state.biomeTiles.find(tile => tile.tileType === 'dirt')!;
    expect(dirt.position).toEqual({ x: 0, y: 48 });
    expect(state.biomeTiles.filter(tile => tile.position.x === 0 && tile.position.y === 48)).toHaveLength(1);
    expect(dirt.flags).toEqual([]);
    expect(biomeTravelCost(dirt.flags)).toBe(1);
    expect(dirt.tableau.flat()).toHaveLength(13);
    expect(dirt.tableau.flat().every(card => !card.resource)).toBe(true);
    const arrived = arriveActorAtBiome(state, 'hero', dirt.id, dirt.position);
    expect(arrived.selectedBiomeId).toBe(dirt.id);
    expect(arrived.worldActors[0].biomeId).toBe(dirt.id);
    expect(arrived.tableau).toEqual(dirt.tableau);
  });

  it('authors other dirt cells with permanent proximity discovery', () => {
    const dirt = createDirtTile('another-dirt', 3, -2);
    expect(dirt.position).toEqual({ x: 144, y: -96 });
    expect(discoverTiles([dirt], { x: 0, y: 0 })[0]).toBe(dirt);
    const revealed = discoverTiles([dirt], { x: 96, y: -96 });
    expect(revealed[0].tileType).toBe('dirt');
    expect(revealed[0].flags).toEqual([]);
    expect(discoverTiles(revealed, { x: 0, y: 0 })).toBe(revealed);
  });
});
