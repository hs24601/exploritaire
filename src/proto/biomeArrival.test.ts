import { describe, expect, it } from 'vitest';
import { activateBiome, arriveActorAtBiome } from './biomeArrival';
import { createInitialState, materializeDeepWoods } from './rules/setup';

describe('biome arrival wiring', () => {
  const ids = ['pond', 'woods-alpha', 'woods-east', 'woods-danger', 'woods-beta'];
  for (const from of ids) for (const to of ids) {
    it(`${from} to ${to} loads the destination for table and foundation actors`, () => {
      for (const location of ['table', 'foundation'] as const) {
        let state = activateBiome({ ...createInitialState(), biomeTiles: [...createInitialState().biomeTiles, materializeDeepWoods(42)] }, from);
        state = { ...state, biomeTiles: state.biomeTiles.map(tile => ({ ...tile, unlocked: true })),
          worldActors: state.worldActors.map((actor, index) => index === 0 ? { ...actor, location, biomeId: from, foundationIndex: 0 } : actor) };
        const target = state.biomeTiles.find(tile => tile.id === to)!;
        const next = arriveActorAtBiome(state, state.worldActors[0].id, to, target.position);
        expect(next.selectedBiomeId).toBe(to);
        expect(next.tableau).toEqual(target.tableau);
        expect(next.stock).toEqual(target.stock);
        expect(next.biome.seed).toBe(target.seed);
        expect(next.worldActors[0]).toMatchObject({ location: 'foundation', biomeId: to, foundationIndex: 0 });
        expect(next.biomeTiles.find(tile => tile.id === to)?.flags).not.toContain('unexplored');
      }
    });
  }
  it('persists current progress before switching and restores it on return', () => {
    let state = activateBiome(createInitialState(), 'woods-alpha');
    state = { ...state, tableau: state.tableau.map(column => column.slice(1)), stock: state.stock.slice(1) };
    const returned = activateBiome(activateBiome(state, 'pond'), 'woods-alpha');
    expect(returned.tableau).toEqual(state.tableau);
    expect(returned.stock).toEqual(state.stock);
  });
  it('ignores occupants of the same slot in other biomes', () => {
    let state = activateBiome(createInitialState(), 'pond');
    state.worldActors.push({ ...state.worldActors[0], id: 'other' as 'hero', location: 'foundation', biomeId: 'pond', foundationIndex: 0 });
    const next = arriveActorAtBiome(state, state.worldActors[0].id, 'woods-east', { x: 48, y: -48 });
    expect(next.worldActors[0]).toMatchObject({ location: 'foundation', foundationIndex: 0 });
  });
  it('does not clear a different selected biome foundation when an actor leaves', () => {
    let state = activateBiome(createInitialState(), 'woods-east');
    state.worldActors[0] = { ...state.worldActors[0], location: 'foundation', biomeId: 'pond', foundationIndex: 0 };
    state.foundations[0]!.count = 3;
    const next = arriveActorAtBiome(state, state.worldActors[0].id, 'woods-east', { x: 48, y: -48 });
    expect(next.foundations[0]!.count).toBe(3);
    expect(next.worldActors[0].location).toBe('table');
  });
});

