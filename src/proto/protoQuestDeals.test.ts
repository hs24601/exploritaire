import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPEDITION_ENERGY } from './protoData';
import { createQuestBiomeDeal, isQuestPlacement, nextQuestCard, QUEST_ROUTE_BUDGET } from './protoQuestDeals';

describe('opening quest deals', () => {
  for (const biome of ['small', 'deep'] as const) {
    it(`${biome}: fills all seven columns and clears every ordinary legal branch`, () => {
      const deal = createQuestBiomeDeal(biome);
      expect(deal.tableau).toHaveLength(7);
      expect(deal.tableau.every((column) => column.length > 0)).toBe(true);
      expect(deal.stock).toEqual([]);
      expect(deal.tableau.flat().filter((card) => !card.encounter).every((card) => Boolean(card.resource))).toBe(true);
      expect(new Set(deal.tableau.flat().map((card) => card.id)).size).toBe(deal.tableau.flat().length);
      const columns = deal.tableau.map((column) => column.filter((card) => !card.encounter));
      const visited = new Set<string>();
      let completions = 0;
      const explore = (rank: number, counts: number[]) => {
        const key = `${rank}:${counts.join(',')}`;
        if (visited.has(key)) return;
        visited.add(key);
        if (counts.every((count) => count === 0)) { completions += 1; return; }
        const legal = columns.flatMap((column, index) => {
          const card = column[counts[index] - 1];
          return card && [1, 12].includes(Math.abs(card.rank - rank)) ? [index] : [];
        });
        expect(legal, `Dead end at rank ${rank}, columns ${counts}`).toHaveLength(1);
        for (const index of legal) {
          const remaining = [...counts];
          remaining[index] -= 1;
          explore(columns[index][counts[index] - 1].rank, remaining);
        }
      };
      explore(2, columns.map((column) => column.length));
      expect(completions).toBe(1);
      expect(visited.size).toBe((biome === 'small' ? 13 : 18) + 1);
    });

    it(`${biome}: tutorial guards expose exactly the next move, including combat first`, () => {
      const { tableau } = createQuestBiomeDeal(biome);
      const size = tableau.flat().length;
      for (let step = 0; step < size; step += 1) {
        const next = nextQuestCard(tableau)!;
        const exposed = tableau.flatMap((column) => column.length ? [column[column.length - 1]] : []);
        expect(exposed).toContain(next);
        const allowed = exposed.filter((card) => isQuestPlacement(tableau, card));
        expect(allowed).toEqual(next.encounter ? [] : [next]);
        const column = tableau.find((cards) => cards[cards.length - 1]?.id === next.id)!;
        column.pop();
      }
      expect(nextQuestCard(tableau)).toBeUndefined();
    });
  }

  it('keeps Camp, food, energy and round-trip travel achievable without random rewards', () => {
    const small = createQuestBiomeDeal('small').tableau.flat();
    expect(small.filter((card) => card.resource === 'wood').length).toBeGreaterThanOrEqual(3);
    expect(small.filter((card) => card.resource === 'berries').length).toBeGreaterThanOrEqual(1);
    expect(small.filter((card) => ['berries', 'herbs'].includes(card.resource ?? '')).length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_EXPEDITION_ENERGY).toBeGreaterThanOrEqual(small.length);
    expect(QUEST_ROUTE_BUDGET.startingStamina).toBeGreaterThanOrEqual(2 * QUEST_ROUTE_BUDGET.smallTravelCost);
    const deep = createQuestBiomeDeal('deep').tableau.flat();
    expect(deep.filter((card) => card.encounter).length).toBe(1);
    expect(DEFAULT_EXPEDITION_ENERGY + QUEST_ROUTE_BUDGET.rationEnergy).toBeGreaterThanOrEqual(deep.filter((card) => !card.encounter).length);
    expect(QUEST_ROUTE_BUDGET.maxStamina + QUEST_ROUTE_BUDGET.rationStamina).toBeGreaterThanOrEqual(2 * QUEST_ROUTE_BUDGET.deepTravelCost);
  });
});
