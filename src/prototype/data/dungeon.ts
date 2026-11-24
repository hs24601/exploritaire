import type { DungeonData } from '../types';

export const DUNGEON_DATA: DungeonData = {
  id: 'july26_v0_1',
  name: 'July 26 Prototype Dungeon',
  wrapKingsToAces: true,
  startingResolve: 3,
  bossId: 'large_skeleton',
  rows: [
    [{ value: 4 }, { value: 5, modifierId: 'fire' }, { value: 9 }, { value: 10 }],
    [{ value: 6 }, { value: 8, enemyId: 'slime' }, { value: 11 }, { value: 12, modifierId: 'ice' }],
    [{ value: 7, modifierId: 'holy' }, { value: 3 }, { value: 2, enemyId: 'goblin' }, { value: 13 }],
    [{ value: 1 }, { value: 2, modifierId: 'poison' }, { value: 3 }, { value: 4, enemyId: 'skeleton' }],
    [{ value: 5 }, { value: 6 }, { value: 7 }, { value: 8, modifierId: 'fire' }],
    [{ value: 9 }, { value: 10, modifierId: 'holy' }, { value: 11 }, { value: 12 }],
  ],
};
