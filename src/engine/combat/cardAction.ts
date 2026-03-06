import type { GameState } from '../types';
import { isCombatSessionActive } from '../combatSession';
import { shouldEnforceSideTurns } from './shared';
import {
  getCombatTurnLastTickAt,
  getCombatTurnTimerActiveValue,
  hasCombatActiveSide,
  isCombatTurnTimerActive,
  setCombatTurnTimer,
} from './sessionBridge';

function tickNoRegretCooldown(cooldown: number | undefined): number {
  return Math.max(0, (cooldown ?? 0) - 1);
}

function stripLastCardSnapshot(state: GameState): Omit<GameState, 'lastCardActionSnapshot'> {
  return { ...state, lastCardActionSnapshot: undefined } as Omit<GameState, 'lastCardActionSnapshot'>;
}

export function recordCardAction(prev: GameState, next: GameState): GameState {
  const snapshot = stripLastCardSnapshot(prev);
  const baseCooldown = next.noRegretCooldown ?? prev.noRegretCooldown;
  const shouldAutoStartTurnTimer = (() => {
    if (!shouldEnforceSideTurns(prev)) return false;
    if (isCombatTurnTimerActive(prev)) return false;
    if (!isCombatSessionActive(prev)) return false;
    return hasCombatActiveSide(prev);
  })();
  const nextTimerPatch = shouldAutoStartTurnTimer
    ? setCombatTurnTimer(true, Date.now())
    : setCombatTurnTimer(
      getCombatTurnTimerActiveValue(next) ?? getCombatTurnTimerActiveValue(prev) ?? false,
      getCombatTurnLastTickAt(next) ?? getCombatTurnLastTickAt(prev)
    );
  return {
    ...next,
    lastCardActionSnapshot: snapshot,
    noRegretCooldown: tickNoRegretCooldown(baseCooldown),
    ...nextTimerPatch,
  };
}
