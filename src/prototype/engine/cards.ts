import type { DungeonData, PlayingCard } from '../types';

export const CARD_LABELS: Record<number, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export function labelForValue(value: number): string {
  return CARD_LABELS[value] ?? String(value);
}

export function buildTableau(dungeon: DungeonData): PlayingCard[][] {
  return dungeon.rows.map((row, rowIndex) =>
    row.map((spec, cardIndex) => ({
      id: `r${rowIndex}-c${cardIndex}`,
      value: spec.value,
      modifierId: spec.modifierId,
      enemyId: spec.enemyId,
    })),
  );
}

export function isAdjacentValue(a: number, b: number, wrapKingsToAces: boolean): boolean {
  if (Math.abs(a - b) === 1) {
    return true;
  }
  return wrapKingsToAces && ((a === 1 && b === 13) || (a === 13 && b === 1));
}
