import type { GameState } from './types';

const BLINDED_TABLEAU_INDEXES: Record<number, number[]> = {
  1: [0, 6],
  2: [0, 1, 5, 6],
  3: [0, 1, 2, 4, 5, 6],
};

export function getBlindedHiddenTableauIndexes(level: number): number[] {
  if (level >= 4) return [];
  return BLINDED_TABLEAU_INDEXES[level] ?? [];
}

export function getBlindedLabel(level: number): string {
  const clamped = Math.max(1, Math.min(4, Math.floor(level || 1)));
  return `BLINDED ${clamped}`;
}

export function getBlindedDetail(level: number): string {
  if (level >= 4) return 'All tableau values hidden';
  const indexes = getBlindedHiddenTableauIndexes(level).map((index) => index + 1);
  if (indexes.length === 0) return 'Vision impaired';
  return `Hidden tableaus: ${indexes.join(', ')}`;
}

export function getActiveBlindLevel(
  state: GameState,
  side: 'player' | 'enemy',
  now: number = Date.now()
): number {
  if (side === 'enemy') {
    if ((state.rpgBlindedEnemyUntil ?? 0) <= now) return 0;
    return Math.max(0, state.rpgBlindedEnemyLevel ?? 0);
  }
  if ((state.rpgBlindedPlayerUntil ?? 0) <= now) return 0;
  return Math.max(0, state.rpgBlindedPlayerLevel ?? 0);
}
