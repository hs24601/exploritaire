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
    enemyDifficulty: 'normal',
    layout: { tableaus: [], elements: [] },
    rewards: { cards: [] },
    requiredMoves: 0,
  },

  // === EVENT ENCOUNTERS ===

  {
    id: 'event_peaceful_glade',
    name: 'Peaceful Glade',
    description: 'A sun-dappled clearing where the forest offers its gifts freely. The air hums with quiet possibility.',
    seed: 'EVENT_PEACEFUL_GLADE_001',
    biomeType: 'event',
    layout: {
      tableaus: [
        [3, 6, 9],
        [2, 5, 8],
        [1, 4, 7],
      ],
      elements: [
        ['E', 'W', 'A'],
        ['W', 'E', 'N'],
        ['A', 'N', 'E'],
      ],
    },
    rewards: { cards: [] },
    requiredMoves: 0,
    eventChoices: [
      {
        id: 'aspect',
        label: 'Attune',
        description: 'The glade resonates with your spirit. Choose an aspect to absorb.',
        rewards: [{ type: 'aspect-choice', amount: 1, chooseCount: 1, options: ['lupus', 'ursus', 'felis'] }],
      },
      {
        id: 'rest',
        label: 'Rest',
        description: 'You settle into stillness. A calm washes over you — no reward, but no cost.',
        rewards: [],
      },
    ],
  },

  {
    id: 'event_hidden_cache',
    name: 'Hidden Cache',
    description: 'Tucked beneath gnarled roots, a weathered bundle. Someone left this here — or something did.',
    seed: 'EVENT_HIDDEN_CACHE_001',
    biomeType: 'event',
    layout: {
      tableaus: [
        [5, 10],
        [3, 8],
        [1, 6],
        [4, 9],
      ],
      elements: [
        ['N', 'F'],
        ['E', 'N'],
        ['W', 'A'],
        ['N', 'L'],
      ],
    },
    rewards: { cards: [] },
    requiredMoves: 0,
    eventChoices: [
      {
        id: 'take_orim',
        label: 'Take the Bundle',
        description: 'You claim the cache and gain a card modification.',
        rewards: [{ type: 'orim-choice', amount: 1 }],
      },
      {
        id: 'take_aspect',
        label: 'Read the Markings',
        description: 'Strange glyphs on the wrapping contain knowledge. Gain an aspect choice.',
        rewards: [{ type: 'aspect-choice', amount: 1, chooseCount: 1, options: ['lupus', 'ursus', 'felis'] }],
      },
      {
        id: 'leave',
        label: 'Leave It',
        description: 'You decide not to disturb what was hidden.',
        rewards: [],
      },
    ],
  },
];

/**
 * Gets a biome definition by ID
 */
export function getBiomeDefinition(biomeId: string): BiomeDefinition | null {
  return BIOME_DEFINITIONS.find(b => b.id === biomeId) || null;
}
