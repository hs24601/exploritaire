import { describe, expect, it } from 'vitest';
import { createQuestBiomeDeal, nextQuestCard } from '../protoQuestDeals';
import { applyFoundationPlay } from './play';
import { createInitialState, createExplorationFoundations, FOREST_CACHE_REWARD, DANGER_WOODS_REWARD } from './setup';
import type { ProtoState } from '../protoState';

describe('woods without mana rewards', () => {
  for (const foundationIndex of [0, 1, 2, 3]) {
    it(`foundation ${foundationIndex}: pickups, work cycles and completion preserve existing mana`, () => {
      const deal = createQuestBiomeDeal('small');
      let state: ProtoState = { ...createInitialState(), ...deal, selectedBiomeId: 'woods-alpha',
        foundations: createExplorationFoundations(Array.from({ length: 4 }, (_, i) => ({ id: `f-${i}`, rank: 2 })), 4),
        biome: { seed: 1, cacheClaimed: false, cacheReward: FOREST_CACHE_REWARD },
        haul: { wood: 0, mana: 7 },
      };
      while (nextQuestCard(state.tableau)) {
        const next = nextQuestCard(state.tableau)!;
        const columnIndex = state.tableau.findIndex(column => column[column.length - 1]?.id === next.id);
        const result = applyFoundationPlay(state, { columnIndex, foundationIndex });
        expect(result).not.toBeNull();
        state = result!.state;
        expect(state.haul.mana).toBe(7);
      }
      expect(state.biome.cacheClaimed).toBe(true);
      expect(state.haul.wood).toBeGreaterThanOrEqual(4);
    });
  }
  it('Dark Woods combat reward contains wood only', () => {
    expect(DANGER_WOODS_REWARD).toEqual({ wood: 2 });
  });
});
