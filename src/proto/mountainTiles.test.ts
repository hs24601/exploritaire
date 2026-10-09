import { expect, it } from 'vitest';
import { createInitialState } from './rules/setup';
import { activateBiome, arriveActorAtBiome } from './biomeArrival';
import { biomeTravelCost, biomeOpenState } from './biomeFlags';
import { discoverTiles } from './tileDiscovery';
it('mountains block crossing, arrivals and tableau activation and retain their type', () => {
 const state = createInitialState();
 const mountains = state.biomeTiles.filter(t => t.tileType === 'impassable-mountain');
 expect(mountains).toHaveLength(89);
 expect(new Set(mountains.map(t => `${t.position.x / 48},${t.position.y / 48}`))).toEqual(
   new Set(Array.from({ length: 6 }, (_, row) => Array.from({ length: 15 }, (_, column) => `${column - 7},${row + 2}`)).flat().filter(cell => cell !== '0,2')),
 );
 for (const tile of mountains) {
 expect(biomeTravelCost(tile.flags)).toBe(Infinity);
 expect(biomeOpenState(tile.flags).opens).toBe(false);
 expect(arriveActorAtBiome(state, 'hero', tile.id, tile.position)).toBe(state);
 expect(activateBiome(state, tile.id)).toBe(state);
 expect(discoverTiles([tile], tile.position)[0]).toMatchObject({ tileType: 'impassable-mountain', flags: ['impassable'] });
 }
 const den = state.biomeTiles.find(t => t.tileType === 'hero-den')!;
 expect(arriveActorAtBiome(state, 'hero', den.id, den.position).biomeTiles.find(t => t.id === den.id)?.tileType).toBe('hero-den');
});
