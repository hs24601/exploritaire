import type { Card } from '../../engine/types';
import { ELEMENT_TO_SUIT } from '../../engine/constants';

// Reward thresholds: 3, 5, 8, 13, 21, ... (Fibonacci-style growth).
export function getBattleHandRewardThreshold(rewardIndex: number): number {
  const safeIndex = Math.max(0, Math.floor(rewardIndex));
  if (safeIndex === 0) return 3;
  let threshold = 3;
  let prevGap = 1;
  let currentGap = 2;
  for (let i = 1; i <= safeIndex; i += 1) {
    threshold += currentGap;
    const nextGap = prevGap + currentGap;
    prevGap = currentGap;
    currentGap = nextGap;
  }
  return threshold;
}

export function createRandomBattleHandRewardCard(sequenceNumber: number, uniqueToken: number): Card {
  const rank = Math.floor(Math.random() * 13) + 1;
  return {
    id: `battle-hand-reward-${sequenceNumber}-${uniqueToken}`,
    rank,
    element: 'N',
    suit: ELEMENT_TO_SUIT.N,
  };
}
