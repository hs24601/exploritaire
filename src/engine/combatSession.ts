import type { GameState } from './types';

export function isRpgCore(_source?: unknown): boolean {
  return true;
}

export function isRandomGeneratedBiomeSession(state: GameState): boolean {
  return false;
}

export function isRpgCombatSession(state: GameState): boolean {
  if (state.phase === 'playing' || state.phase === 'garden') return false;
  return state.tableaus.length > 0 && state.foundations.length > 0;
}

export function isCombatSessionActive(state: GameState): boolean {
  return isRandomGeneratedBiomeSession(state) || isRpgCombatSession(state);
}
