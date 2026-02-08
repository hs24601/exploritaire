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
  {
    id: 'pyramid_ruins',
    name: 'Pyramid Ruins',
    description: 'Ancient stones arranged in a mysterious pattern',
    seed: 'PYRAMID_RUINS_001',
    mode: 'node-edge',
    nodePattern: 'pyramid',
    layout: { tableaus: [], elements: [] },
    rewards: {
      cards: [
        { element: 'E', count: 3 },
        { element: 'L', count: 2 },
      ],
      blueprints: ['ancient_tablet'],
    },
    requiredMoves: 28,
  },
  {
    id: 'mystic_cross',
    name: 'Mystic Cross',
    description: 'A sacred arrangement of elemental cards',
    seed: 'MYSTIC_CROSS_001',
    mode: 'node-edge',
    nodePattern: 'cross',
    layout: { tableaus: [], elements: [] },
    rewards: {
      cards: [
        { element: 'A', count: 2 },
        { element: 'F', count: 2 },
      ],
    },
    requiredMoves: 21,
  },
  {
    id: 'overgrowth',
    name: 'Overgrowth',
    description: 'A climbing sequence tangled in verdant growth',
    seed: 'OVERGROWTH_001',
    layout: {
      tableaus: [
        [7],
        [8],
        [9],
        [10],
        [11],
      ],
      elements: [
        ['N'],
        ['N'],
        ['N'],
        ['N'],
        ['N'],
      ],
    },
    rewards: {
      cards: [
        { element: 'E', count: 1 },
      ],
    },
    requiredMoves: 5,
  },
  {
    id: 'thicket',
    name: 'The Thicket',
    description: 'A dense tangle of branching paths through wild growth',
    seed: 'THICKET_001',
    mode: 'node-edge',
    nodePattern: 'thicket',
    layout: { tableaus: [], elements: [] },
    rewards: {
      cards: [
        { element: 'E', count: 2 },
        { element: 'N', count: 2 },
      ],
    },
    requiredMoves: 12,
  },
  {
    id: 'verdant_thicket_a',
    name: 'Verdant Thicket A',
    description: 'A lush thicket teeming with verdant growth',
    seed: 'VERDANT_THICKET_A_001',
    layout: { tableaus: [], elements: [] },
    rewards: {
      cards: [
        { element: 'E', count: 2 },
        { element: 'N', count: 2 },
      ],
    },
    requiredMoves: 12,
  },
  {
    id: 'verdant_grove_a',
    name: 'Verdant Grove A',
    description: 'A layered grove where canopy, understory, and roots intertwine',
    seed: 'VERDANT_GROVE_A_001',
    layout: {
      // 3 groups, 12 cards total. Foundation rank 6.
      // Solve sequence: 6→7→8→9→8→7→6→5→4→5→6→7→8
      // Each step has exactly one valid move — no red herrings.
      tableaus: [
        [5, 9, 7],        // Canopy (3 cards) — plays steps 1, 3, 7
        [6, 7, 8, 8],     // Understory (4 cards) — plays steps 2, 4, 5, 6
        [8, 7, 6, 5, 4],  // Roots (5 cards) — plays steps 8–12
      ],
      elements: [
        ['E', 'A', 'W'],          // Canopy: Earth, Air, Water
        ['W', 'E', 'A', 'E'],     // Understory: Water, Earth, Air, Earth
        ['E', 'W', 'E', 'W', 'E'], // Roots: Earth, Water, Earth, Water, Earth
      ],
    },
    rewards: {
      cards: [
        { element: 'E', count: 2 },
        { element: 'W', count: 1 },
      ],
    },
    requiredMoves: 12,
  },
  {
    id: 'random_wilds',
    name: 'Random Wilds',
    description: 'An ever-shifting wilderness. Play cards freely and collect tokens.',
    seed: 'RANDOM_WILDS_001',
    randomlyGenerated: true,
    infinite: true,
    layout: { tableaus: [], elements: [] },
    rewards: { cards: [] },
    requiredMoves: 0,
  },
];

/**
 * Gets a biome definition by ID
 */
export function getBiomeDefinition(biomeId: string): BiomeDefinition | null {
  return BIOME_DEFINITIONS.find(b => b.id === biomeId) || null;
}
