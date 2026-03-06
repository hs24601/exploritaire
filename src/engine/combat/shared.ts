import type { Actor, CombatFlowTelemetry, Element, GameState } from '../types';
import { isRpgCore } from '../combatSession';
import {
  type CombatTimerPatch,
  getCombatActiveSide,
  getCombatTurnLastTickAt,
  isCombatTurnTimerActive,
  setCombatTurnTimer,
} from './sessionBridge';

const PARTY_FOUNDATION_LIMIT = 3;

export function createEmptyCombatFlowTelemetry(): CombatFlowTelemetry {
  return {
    playerTurnsStarted: 0,
    enemyTurnsStarted: 0,
    playerTimeouts: 0,
    enemyTimeouts: 0,
    playerCardsPlayed: 0,
    enemyCardsPlayed: 0,
    deadlockSurges: 0,
  };
}

export function clampPartyForFoundations(partyActors: Actor[], limit = PARTY_FOUNDATION_LIMIT): Actor[] {
  return partyActors.slice(0, Math.max(1, limit));
}

export function shouldEnforceSideTurns(state: GameState): boolean {
  return (state.combatFlowMode ?? 'turn_based_pressure') === 'turn_based_pressure';
}

export function updateCombatFlowTelemetry(
  state: GameState,
  updater: (current: CombatFlowTelemetry) => CombatFlowTelemetry
): CombatFlowTelemetry {
  const current = {
    ...createEmptyCombatFlowTelemetry(),
    ...(state.combatFlowTelemetry ?? {}),
  };
  return updater(current);
}

export function startTurnTimerIfNeeded(
  state: GameState,
  side: 'player' | 'enemy'
): CombatTimerPatch {
  if (!shouldEnforceSideTurns(state)) {
    return setCombatTurnTimer(false, getCombatTurnLastTickAt(state));
  }
  const activeSide = getCombatActiveSide(state);
  if (activeSide !== side) {
    return setCombatTurnTimer(isCombatTurnTimerActive(state), getCombatTurnLastTickAt(state));
  }
  if (isCombatTurnTimerActive(state)) {
    return setCombatTurnTimer(true, getCombatTurnLastTickAt(state));
  }
  return setCombatTurnTimer(true, Date.now());
}

export function isActorCombatEnabled(actor: Actor | null | undefined): boolean {
  if (!actor) return false;
  return (actor.stamina ?? 0) > 0 && (actor.hp ?? 0) > 0;
}

export function createEmptyTokenCounts(): Record<Element, number> {
  return {
    W: 0,
    E: 0,
    A: 0,
    F: 0,
    D: 0,
    L: 0,
    N: 0,
  };
}

export function getPartyForTile(state: GameState, tileId?: string): Actor[] {
  if (!tileId) return [];
  return state.tileParties[tileId] ?? [];
}

export function resolveFoundationActorId(state: GameState, foundationIndex: number): string | null {
  const top = state.foundations[foundationIndex]?.[0];
  const foundationActorId = top?.sourceActorId ?? top?.rpgActorId;
  if (foundationActorId) return foundationActorId;
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  return partyActors[foundationIndex]?.id ?? null;
}

export function isRpgCombatActive(state: GameState): boolean {
  if (!isRpgCore(state)) return true;
  return (state.enemyFoundations ?? []).some((foundation) => foundation.length > 0);
}

export function warnOnUnexpectedHpIncrease(prev: GameState, next: GameState, context: string): void {
  const collectById = (state: GameState): Map<string, number> => {
    const map = new Map<string, number>();
    const playerParty = getPartyForTile(state, state.activeSessionTileId);
    playerParty.forEach((actor) => {
      map.set(actor.id, actor.hp ?? 0);
    });
    (state.enemyActors ?? []).forEach((actor) => {
      map.set(actor.id, actor.hp ?? 0);
    });
    return map;
  };

  const prevHpById = collectById(prev);
  const nextHpById = collectById(next);
  const increases: Array<{ actorId: string; from: number; to: number }> = [];

  prevHpById.forEach((from, actorId) => {
    const to = nextHpById.get(actorId);
    if (to === undefined) return;
    if (to > from) {
      increases.push({ actorId, from, to });
    }
  });

  if (increases.length === 0) return;
  console.warn('[Invariant][HP Increase]', context, increases);
}
