import type { EnemyData } from '../types';

export const ENEMY_DATA: EnemyData[] = [
  {
    id: 'slime',
    name: 'Slime',
    maxHp: 6,
    attack: 2,
    intent: 'Lunge for 2',
  },
  {
    id: 'goblin',
    name: 'Goblin',
    maxHp: 9,
    attack: 3,
    intent: 'Stab for 3',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    maxHp: 12,
    attack: 4,
    intent: 'Hack for 4',
  },
  {
    id: 'large_skeleton',
    name: 'Large Skeleton',
    maxHp: 22,
    attack: 5,
    intent: 'Crushing swing for 5',
  },
];
