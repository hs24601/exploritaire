export type QuestResource = 'wood' | 'berries' | 'herbs';
export const QUEST_ROUTE_BUDGET = {
  startingStamina: 2, maxStamina: 6, smallTravelCost: 1, deepTravelCost: 4,
  rationEnergy: 6, rationStamina: 6,
} as const;
export type QuestCard = {
  id: string;
  rank: number;
  questStep?: number;
  resource?: QuestResource;
  encounter?: 'shadow_wolf_cub';
};

/** Deal successive moves across all seven columns. Reverse each column because
 * the last array entry is exposed. Neither quest biome draws hidden stock. */
export const createQuestBiomeDeal = (biome: 'small' | 'deep') => {
  const size = biome === 'small' ? 13 : 18;
  const resources: Array<QuestResource | undefined> = biome === 'small'
    ? ['wood', 'berries', 'wood', 'herbs', 'wood', 'berries', 'wood']
    : ['wood', 'berries', 'herbs', 'wood', 'berries', 'herbs', 'wood', 'berries', 'wood', 'herbs'];
  const tableau: QuestCard[][] = Array.from({ length: 7 }, () => []);
  for (let step = 0; step < size; step += 1) {
    const resource = resources[step % resources.length];
    tableau[step % 7].unshift({
      id: `proto-${biome}-woods-quest-${step}`,
      rank: ((step + 2) % 13) + 1,
      questStep: step,
      ...(resource ? { resource } : {}),
    });
  }
  if (biome === 'deep') {
    // The encounter is removed by combat, not played onto the exploration
    // foundation. Keep it separate so returning from combat cannot skip rank 3.
    tableau[0].push({ id: 'proto-deep-woods-encounter', rank: 3, questStep: -1, encounter: 'shadow_wolf_cub' });
  }
  return { tableau, stock: [] as QuestCard[] };
};

export const nextQuestCard = (tableau: readonly (readonly QuestCard[])[]) =>
  tableau.flat().filter((card) => card.questStep !== undefined)
    .reduce<QuestCard | undefined>((next, card) => !next || card.questStep! < next.questStep! ? card : next, undefined);

export const isQuestPlacement = (tableau: readonly (readonly QuestCard[])[], card: QuestCard) => {
  const next = nextQuestCard(tableau);
  return !next || (!next.encounter && next.id === card.id);
};
