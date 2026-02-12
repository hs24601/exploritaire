import type { Card } from '../../engine/types';
import { ELEMENT_TO_SUIT } from '../../engine/constants';

export function buildUnlockedBattleHandCards(unlockCount: number): Card[] {
  const safeUnlockCount = Math.max(0, Math.floor(unlockCount));
  return Array.from({ length: safeUnlockCount }, (_, index) => ({
    id: `battle-hand-unlock-${index + 1}`,
    rank: 2,
    element: 'N',
    suit: ELEMENT_TO_SUIT.N,
  }));
}