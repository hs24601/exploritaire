import type { BiomeDefinition } from './types';

/**
 * Biome Definitions - predefined adventure layouts with specific rewards
 */
export const BIOME_DEFINITIONS: BiomeDefinition[] = [
  {
    id: 'garden_grove',
    name: 'Garden Grove',
    description: 'A peaceful grove where resources grow',
    seed: 'GARDEN_GROVE_001',
    layout: {
      // Ranks for each tableau position
      tableaus: [
        [1],  // AN (Ace Non-elemental)
        [2],  // 2N
        [3],  // 3E
        [4],  // 4W
        [5],  // 5N
        [6],  // 6E
        [8],  // 8W
        [9],  // 9N
        [10], // 10N
        [11], // JN (Jack Non-elemental)
        [12], // QN (Queen Non-elemental)
        [13], // KN (King Non-elemental)
      ],
      // Elements for each tableau position
      elements: [
        ['A'], // Air (AN)
        ['N'], // Non-elemental (2N)
        ['E'], // Earth (3E)
        ['W'], // Water (4W)
        ['N'], // Non-elemental (5N)
        ['E'], // Earth (6E)
        ['W'], // Water (8W)
        ['N'], // Non-elemental (9N)
        ['N'], // Non-elemental (10N)
        ['N'], // Non-elemental (JN)
        ['N'], // Non-elemental (QN)
        ['N'], // Non-elemental (KN)
      ],
    },
    rewards: {
      cards: [
        { element: 'W', count: 2 }, // 2x Water
        { element: 'E', count: 2 }, // 2x Earth
      ],
      blueprints: ['lumber_mill'],
    },
    blueprintSpawn: {
      blueprintId: 'lumber_mill',
      afterMoves: 5,
    },
    requiredMoves: 11, // All 11 cards can be played
  },
];

/**
 * Gets a biome definition by ID
 */
export function getBiomeDefinition(biomeId: string): BiomeDefinition | null {
  return BIOME_DEFINITIONS.find(b => b.id === biomeId) || null;
}
