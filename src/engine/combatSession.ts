import type { GameState } from './types';
import { getBiomeDefinition } from './biomes';

export function isRpgCore(_source?: unknown): boolean {
  return true;
}

export function isRandomGeneratedBiomeSession(state: GameState): boolean {
  if (state.phase !== 'biome') return false;
  if (!state.currentBiome) return false;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  return !!biomeDef?.randomlyGenerated;
}

export function isRpgCombatSession(state: GameState): boolean {
  if (state.phase === 'playing') return false;
  return state.tableaus.length > 0 && state.foundations.length > 0;
}

export function isCombatSessionActive(state: GameState): boolean {
  return isRandomGeneratedBiomeSession(state) || isRpgCombatSession(state);
}
