import type { HeroData } from '../types';

export const HERO_DATA: HeroData[] = [
  {
    id: 'knight',
    name: 'Knight',
    color: '#b64f38',
    abilityIds: ['slash', 'shield_wall'],
  },
  {
    id: 'mage',
    name: 'Mage',
    color: '#4f6fb6',
    abilityIds: ['arcane_blast', 'arcane_insight'],
  },
  {
    id: 'cleric',
    name: 'Cleric',
    color: '#c6a348',
    abilityIds: ['smite', 'heal'],
  },
];
