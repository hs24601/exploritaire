import type { GameState } from './types';

export function isRpgCore(_source?: unknown): boolean {
  return true;
}

export function isRpgCombatSession(state: GameState): boolean {
  return state.tableaus.length > 0 && state.foundations.length > 0;
}

export function isCombatSessionActive(state: GameState): boolean {
  return isRpgCombatSession(state);
}
