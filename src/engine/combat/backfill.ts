import type { Card, Element } from '../types';
import { ALL_ELEMENTS, ELEMENT_TO_SUIT, randomIdSuffix } from '../constants';

export function generateRandomCombatCard(): Card {
  const rank = 1 + Math.floor(Math.random() * 13);
  const elementalElements = ALL_ELEMENTS.filter((entry): entry is Exclude<Element, 'N'> => entry !== 'N');
  const hasOrim = Math.random() < 0.75;
  const element: Element = hasOrim
    ? elementalElements[Math.floor(Math.random() * elementalElements.length)]
    : 'N';
  const suit = ELEMENT_TO_SUIT[element];
  return {
    rank,
    suit,
    element,
    tokenReward: element !== 'N' ? element : undefined,
    orimSlots: [
      {
        id: `orim-slot-${element}-${rank}-${Date.now()}-${randomIdSuffix()}`,
        orimId: element !== 'N' ? `element-${element}` : null,
      },
    ],
    id: `rbiome-${Date.now()}-${randomIdSuffix()}`,
  };
}

export function backfillTableau(tableau: Card[]): Card[] {
  return [generateRandomCombatCard(), ...tableau];
}

export function backfillTableauFromQueue(
  tableau: Card[],
  queue: Card[] | undefined
): { tableau: Card[]; queue: Card[] } {
  if (!queue || queue.length === 0) {
    return { tableau: backfillTableau(tableau), queue: [] };
  }
  const [next, ...rest] = queue;
  return { tableau: [next, ...tableau], queue: rest };
}

export function createEnemyBackfillQueues(tableaus: Card[][], sizePerTableau: number): Card[][] {
  return tableaus.map(() => Array.from({ length: sizePerTableau }, () => generateRandomCombatCard()));
}
