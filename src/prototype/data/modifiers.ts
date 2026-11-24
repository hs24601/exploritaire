import type { CardModifierData } from '../types';

export const CARD_MODIFIER_DATA: CardModifierData[] = [
  {
    id: 'fire',
    name: 'Fire',
    color: '#e4572e',
    description: '+1 damage when consumed by an offensive ability.',
    damageBonus: 1,
  },
  {
    id: 'ice',
    name: 'Ice',
    color: '#4da8d8',
    description: '+1 block when consumed by a defensive support ability.',
    blockBonus: 1,
  },
  {
    id: 'holy',
    name: 'Holy',
    color: '#e0c15a',
    description: '+1 damage or healing when consumed.',
    damageBonus: 1,
    healingBonus: 1,
  },
  {
    id: 'poison',
    name: 'Poison',
    color: '#56a05d',
    description: '+1 damage when consumed by an offensive ability.',
    damageBonus: 1,
  },
];
