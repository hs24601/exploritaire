import type { GameState, RandomBiomeWorldEvent } from '../types';
import { isCombatSessionActive } from '../combatSession';
import { createEnemyBackfillQueues } from './backfill';
import {
  DEFAULT_RANDOM_BIOME_TABLEAU_COUNT,
  DEFAULT_RANDOM_BIOME_TABLEAU_DEPTH,
  DEFAULT_RANDOM_BIOME_TURN_DURATION_MS,
  RANDOM_BIOME_DEADLOCK_SURGE_COOLDOWN_MS,
  RANDOM_BIOME_DEADLOCK_SURGE_DETAIL,
  RANDOM_BIOME_DEADLOCK_SURGE_LABEL,
} from './flowConstants';
import { resetRandomBiomeDealFromCombatDeck } from './deal';
import { getMoveAvailability } from './moveAvailability';
import { shouldEnforceSideTurns, updateCombatFlowTelemetry } from './shared';
import {
  getCombatActiveSide,
  getCombatLastWorldEvent,
  getCombatTurnDurationMs,
  getCombatTurnRemainingMs,
  hasCombatActiveSide,
  setCombatTurnRemainingMs,
  setCombatTurnTimer,
  setCombatWorldEvent,
} from './sessionBridge';

export function resolveRandomBiomeDeadlockSurge(
  state: GameState,
  nowMs: number = Date.now()
): GameState {
  if (!isCombatSessionActive(state)) return state;
  const hasEnemySide = (state.enemyFoundations?.length ?? 0) > 0;
  if (!hasEnemySide) return state;
  const tableaus = state.tableaus ?? [];
  if (tableaus.length === 0 || tableaus.every((tableau) => tableau.length === 0)) return state;
  const moveAvailability = getMoveAvailability(state);
  if (!moveAvailability.noValidMovesPlayer || !moveAvailability.noValidMovesEnemy) return state;
  const priorEvent = getCombatLastWorldEvent(state);
  if (
    priorEvent?.id === 'deadlock_surge'
    && Number.isFinite(priorEvent.at)
    && (nowMs - priorEvent.at) < RANDOM_BIOME_DEADLOCK_SURGE_COOLDOWN_MS
  ) {
    return state;
  }

  const tableauCount = Math.max(DEFAULT_RANDOM_BIOME_TABLEAU_COUNT, tableaus.length);
  const cardsPerTableau = Math.max(
    DEFAULT_RANDOM_BIOME_TABLEAU_DEPTH,
    ...tableaus.map((tableau) => tableau.length)
  );
  const nextDeal = resetRandomBiomeDealFromCombatDeck(state, tableauCount, cardsPerTableau);
  const durationMs = getCombatTurnDurationMs(state, DEFAULT_RANDOM_BIOME_TURN_DURATION_MS);
  const activeSide = getCombatActiveSide(state);
  const nextEvent: RandomBiomeWorldEvent = {
    id: 'deadlock_surge',
    label: RANDOM_BIOME_DEADLOCK_SURGE_LABEL,
    detail: RANDOM_BIOME_DEADLOCK_SURGE_DETAIL,
    at: nowMs,
  };
  return {
    ...state,
    tableaus: nextDeal.tableaus,
    combatDeck: nextDeal.combatDeck,
    stock: [],
    ...setCombatTurnTimer(false, nowMs),
    ...setCombatTurnRemainingMs(shouldEnforceSideTurns(state) && hasCombatActiveSide(state)
      ? durationMs
      : getCombatTurnRemainingMs(state)),
    enemyBackfillQueues: activeSide === 'enemy'
      ? createEnemyBackfillQueues(nextDeal.tableaus, 10)
      : state.enemyBackfillQueues,
    ...setCombatWorldEvent(nextEvent),
    combatFlowTelemetry: updateCombatFlowTelemetry(state, (current) => ({
      ...current,
      deadlockSurges: current.deadlockSurges + 1,
    })),
  };
}
