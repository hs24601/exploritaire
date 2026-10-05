import type { AbilityData } from '../types';

export const ABILITY_DATA: AbilityData[] = [
  {
    id: 'slash',
    heroId: 'knight',
    kind: 'primary',
    name: 'Slash',
    effect: 'damage',
    description: 'Deal damage equal to combo length plus card modifiers.',
  },
  {
    id: 'shield_wall',
    heroId: 'knight',
    kind: 'support',
    name: 'Shield Wall',
    effect: 'block',
    description: 'Gain block equal to combo length plus defensive modifiers.',
  },
  {
    id: 'arcane_blast',
    heroId: 'mage',
    kind: 'primary',
    name: 'Arcane Blast',
    effect: 'damage',
    description: 'Deal damage equal to combo length plus card modifiers.',
  },
  {
    id: 'arcane_insight',
    heroId: 'mage',
    kind: 'support',
    name: 'Arcane Insight',
    effect: 'draw_hint',
    description: 'Convert combo power into an extra wild card.',
  },
  {
    id: 'smite',
    heroId: 'cleric',
    kind: 'primary',
    name: 'Smite',
    effect: 'damage',
    description: 'Deal damage equal to combo length plus holy card pressure.',
  },
  {
    id: 'heal',
    heroId: 'cleric',
    kind: 'support',
    name: 'Heal',
    effect: 'heal',
    description: 'Heal the party equal to combo length plus card modifiers.',
  },
];
