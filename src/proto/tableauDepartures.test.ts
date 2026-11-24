import { expect, it } from 'vitest';
import { tableauDepartures } from './tableauDepartures';
import { createInitialState } from './rules/setup';

it('exits only the requested actor and preserves world positions for everyone', () => {
  const state = createInitialState();
  const biome = state.biomeTiles[0];
  state.selectedBiomeId = biome.id;
  const scenario = { ...state, worldActors: [
    { ...state.worldActors[0], id: 'one', position: biome.position, location: 'foundation' as const, biomeId: biome.id, foundationIndex: 0 },
    { ...state.worldActors[0], id: 'two', position: biome.position, location: 'foundation' as const, biomeId: biome.id, foundationIndex: 1 },
    { ...state.worldActors[0], id: 'other-biome', location: 'foundation' as const, biomeId: 'elsewhere' },
  ] };
  const single = tableauDepartures(scenario, 'two');
  expect(single.map(exit => exit.actorId)).toEqual(['two']);
  expect(single[0].position).toEqual(biome.position);
  const all = tableauDepartures(scenario);
  expect(all.map(exit => exit.actorId)).toEqual(['one', 'two']);
  expect(all.map(exit => exit.position)).toEqual([biome.position, biome.position]);
  expect(scenario.worldActors.every(actor => actor.location === 'foundation')).toBe(true);
});
