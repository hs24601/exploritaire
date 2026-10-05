import type { GameState, RandomBiomeWorldEvent } from '../types';
import { DEFAULT_RANDOM_BIOME_TURN_DURATION_MS } from './flowConstants';

export type CombatSide = 'player' | 'enemy';
export type CombatTimerPatch = Pick<GameState, 'combatTurnTimerActive' | 'combatTurnLastTickAt'>;
type CombatRuntimePatch = Pick<
  GameState,
  | 'activeCombatSide'
  | 'combatTurnDurationMs'
  | 'combatTurnRemainingMs'
  | 'combatTurnLastTickAt'
  | 'combatTurnTimerActive'
>;
type CombatTurnNumberPatch = Pick<GameState, 'combatTurnNumber'>;
type CombatWorldEventPatch = Pick<GameState, 'combatLastWorldEvent'>;
type CombatTurnRemainingPatch = Pick<GameState, 'combatTurnRemainingMs'>;

export function getCombatActiveSide(state: GameState): CombatSide {
  return state.activeCombatSide ?? 'player';
}

export function hasCombatActiveSide(state: GameState): boolean {
  return !!state.activeCombatSide;
}

export function getCombatTurnDurationMs(
  state: GameState,
  fallbackMs: number = DEFAULT_RANDOM_BIOME_TURN_DURATION_MS
): number {
  return Math.max(1000, Math.round(state.combatTurnDurationMs ?? fallbackMs));
}

export function getCombatTurnNumber(state: GameState): number {
  return Math.max(1, Number(state.combatTurnNumber ?? state.turnCount ?? 1));
}

export function getCombatTurnCounter(state: GameState): number {
  return Math.max(0, Number(state.lifecycleTurnCounter ?? state.combatTurnNumber ?? state.turnCount ?? 0));
}

export function getNextCombatTurnCounter(state: GameState): number {
  return getCombatTurnCounter(state) + 1;
}

export function isCombatTurnTimerActive(state: GameState): boolean {
  return state.combatTurnTimerActive ?? false;
}

export function getCombatTurnTimerActiveValue(state: GameState): boolean | undefined {
  return state.combatTurnTimerActive;
}

export function getCombatTurnLastTickAt(state: GameState): number | undefined {
  return state.combatTurnLastTickAt;
}

export function getCombatTurnRemainingMs(state: GameState): number | undefined {
  return state.combatTurnRemainingMs;
}

export function getCombatLastWorldEvent(state: GameState): RandomBiomeWorldEvent | undefined {
  return state.combatLastWorldEvent;
}

export function setCombatTurnTimer(timerActive: boolean, lastTickAt: number | undefined): CombatTimerPatch {
  return {
    combatTurnTimerActive: timerActive,
    combatTurnLastTickAt: lastTickAt,
  };
}

export function setCombatTurnRuntime(options: {
  side: CombatSide | undefined;
  durationMs: number;
  remainingMs: number;
  lastTickAt: number;
  timerActive: boolean;
}): CombatRuntimePatch {
  return {
    activeCombatSide: options.side,
    combatTurnDurationMs: options.durationMs,
    combatTurnRemainingMs: options.remainingMs,
    combatTurnLastTickAt: options.lastTickAt,
    combatTurnTimerActive: options.timerActive,
  };
}

export function setCombatTurnNumber(turnNumber: number): CombatTurnNumberPatch {
  return {
    combatTurnNumber: turnNumber,
  };
}

export function setCombatWorldEvent(event: RandomBiomeWorldEvent | undefined): CombatWorldEventPatch {
  return {
    combatLastWorldEvent: event,
  };
}

export function setCombatTurnRemainingMs(remainingMs: number | undefined): CombatTurnRemainingPatch {
  return {
    combatTurnRemainingMs: remainingMs,
  };
}

