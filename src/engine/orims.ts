import type { OrimDefinition } from './types';

// ORIM_DEFINITIONS_START
export const ORIM_DEFINITIONS: OrimDefinition[] = [
  {
    id: 'bite',
    name: 'Bite',
    description: 'Deal 1 damage to an enemy.',
    category: 'ability',
    domain: 'combat',
    rarity: 'common',
    powerCost: 0,
    damage: 1,
  },
  {
    id: 'claw',
    name: 'Claw',
    description: 'Deal 1 damage to an enemy.',
    category: 'ability',
    domain: 'combat',
    rarity: 'common',
    powerCost: 0,
    damage: 1,
  },
  {
    id: 'bide',
    name: 'Bide',
    description: 'Reduces cooldowns on end turn. Actor slot: -1 to all. Card slot: -2 to that card.',
    category: 'utility',
    domain: 'puzzle',
    rarity: 'common',
    powerCost: 0,
    activationTiming: ['turn-end'],
  },
  {
    id: 'no-regret',
    name: 'No Regret',
    description: 'Actor-only. Rewind the last card action. Cooldown: 5.',
    category: 'utility',
    domain: 'puzzle',
    rarity: 'rare',
    powerCost: 1,
  },
  {
    id: 'teamwork',
    name: 'Teamwork',
    description: 'Party-wide. Bench swaps that are +/-1 from the current foundation are free.',
    category: 'utility',
    domain: 'puzzle',
    rarity: 'uncommon',
    powerCost: 0,
  },
];
// ORIM_DEFINITIONS_END
