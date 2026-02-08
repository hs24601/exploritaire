import type { OrimDefinition } from './types';

// ORIM_DEFINITIONS_START
export const ORIM_DEFINITIONS: OrimDefinition[] = [
  {
    id: 'bite',
    name: 'Bite',
    description: 'Deal 1 damage to an enemy.',
    category: 'ability',
    rarity: 'common',
    powerCost: 0,
    damage: 1,
  },
  {
    id: 'scratch',
    name: 'Scratch',
    description: 'Deal 1 damage to an enemy.',
    category: 'ability',
    rarity: 'common',
    powerCost: 0,
    damage: 1,
  },
  {
    id: 'bide',
    name: 'Bide',
    description: 'Reduces cooldowns on end turn. Actor slot: -1 to all. Card slot: -2 to that card.',
    category: 'utility',
    rarity: 'common',
    powerCost: 0,
  },
  {
    id: 'no-regret',
    name: 'No Regret',
    description: 'Actor-only. Rewind the last card action. Cooldown: 5.',
    category: 'utility',
    rarity: 'rare',
    powerCost: 1,
  },
];
// ORIM_DEFINITIONS_END
