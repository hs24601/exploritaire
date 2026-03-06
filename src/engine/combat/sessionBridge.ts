import type { GameState, RandomBiomeWorldEvent } from '../types';
import { DEFAULT_RANDOM_BIOME_TURN_DURATION_MS } from './flowConstants';

export type CombatSide = 'player' | 'enemy';
export type CombatTimerPatch = Pick<GameState, 'randomBiomeTurnTimerActive' | 'randomBiomeTurnLastTickAt'>;
type CombatRuntimePatch = Pick<
  GameState,
  | 'randomBiomeActiveSide'
  | 'randomBiomeTurnDurationMs'
  | 'randomBiomeTurnRemainingMs'
  | 'randomBiomeTurnLastTickAt'
  | 'randomBiomeTurnTimerActive'
>;
type CombatTurnNumberPatch = Pick<GameState, 'randomBiomeTurnNumber'>;
type CombatWorldEventPatch = Pick<GameState, 'randomBiomeLastWorldEvent'>;
type CombatTurnRemainingPatch = Pick<GameState, 'randomBiomeTurnRemainingMs'>;

export function getCombatActiveSide(state: GameState): CombatSide {
  return state.randomBiomeActiveSide ?? 'player';
}

export function hasCombatActiveSide(state: GameState): boolean {
  return !!state.randomBiomeActiveSide;
}

export function getCombatTurnDurationMs(
  state: GameState,
  fallbackMs: number = DEFAULT_RANDOM_BIOME_TURN_DURATION_MS
): number {
  return Math.max(1000, Math.round(state.randomBiomeTurnDurationMs ?? fallbackMs));
}

export function getCombatTurnNumber(state: GameState): number {
  return Math.max(1, Number(state.randomBiomeTurnNumber ?? state.turnCount ?? 1));
}

export function getCombatTurnCounter(state: GameState): number {
  return Math.max(0, Number(state.lifecycleTurnCounter ?? state.randomBiomeTurnNumber ?? state.turnCount ?? 0));
}

export function getNextCombatTurnCounter(state: GameState): number {
  return getCombatTurnCounter(state) + 1;
}

export function isCombatTurnTimerActive(state: GameState): boolean {
  return state.randomBiomeTurnTimerActive ?? false;
}

export function getCombatTurnTimerActiveValue(state: GameState): boolean | undefined {
  return state.randomBiomeTurnTimerActive;
}

export function getCombatTurnLastTickAt(state: GameState): number | undefined {
  return state.randomBiomeTurnLastTickAt;
}

export function getCombatTurnRemainingMs(state: GameState): number | undefined {
  return state.randomBiomeTurnRemainingMs;
}

export function getCombatLastWorldEvent(state: GameState): RandomBiomeWorldEvent | undefined {
  return state.randomBiomeLastWorldEvent;
}

export function setCombatTurnTimer(timerActive: boolean, lastTickAt: number | undefined): CombatTimerPatch {
  return {
    randomBiomeTurnTimerActive: timerActive,
    randomBiomeTurnLastTickAt: lastTickAt,
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
    randomBiomeActiveSide: options.side,
    randomBiomeTurnDurationMs: options.durationMs,
    randomBiomeTurnRemainingMs: options.remainingMs,
    randomBiomeTurnLastTickAt: options.lastTickAt,
    randomBiomeTurnTimerActive: options.timerActive,
  };
}

export function setCombatTurnNumber(turnNumber: number): CombatTurnNumberPatch {
  return { randomBiomeTurnNumber: turnNumber };
}

export function setCombatWorldEvent(event: RandomBiomeWorldEvent | undefined): CombatWorldEventPatch {
  return { randomBiomeLastWorldEvent: event };
}

export function setCombatTurnRemainingMs(remainingMs: number | undefined): CombatTurnRemainingPatch {
  return { randomBiomeTurnRemainingMs: remainingMs };
}

