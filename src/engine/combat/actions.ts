import type { Actor, Card, GameState } from '../types';
import { createFullWildSentinel, randomIdSuffix } from '../constants';
import { getBiomeDefinition } from '../biomes';
import { isCombatSessionActive, isRandomGeneratedBiomeSession, isRpgCombatSession, isRpgCore } from '../combatSession';
import { createActor } from '../actors';
import { grantApToActorById } from './ap';
import { awardActorComboCards } from './actorRewards';
import { findActorById } from './actorLookup';
import { recordCardAction } from './cardAction';
import { resolveRandomBiomeDeadlockSurge } from './deadlock';
import { ensureCombatDeck } from './deck';
import { processEffects } from './effects';
import { createActorFoundationCard } from './foundationCard';
import { getMoveAvailability } from './moveAvailability';
import { completeEncounterFromBiomeRewards } from './encounterCompletion';
import {
  applyTokenReward,
  awardEnemyActorComboCards,
} from './rewards';
import {
  backfillTableau,
  backfillTableauFromQueue,
  createEnemyBackfillQueues,
} from './backfill';
import {
  createEmptyEnemyFoundations,
  ensureEnemyFoundationsForPlay,
} from './enemyFoundations';
import {
  createEnemyFoundationCard,
  createRandomEnemyActor,
  DEFAULT_ENEMY_FOUNDATION_SEEDS,
  resolveCombatLabTargetActor,
} from './enemyFactory';
import {
  getCombatActiveSide,
  getCombatTurnDurationMs,
  getCombatTurnNumber,
  getNextCombatTurnCounter,
  setCombatTurnNumber,
  setCombatTurnRuntime,
  setCombatWorldEvent,
} from './sessionBridge';
import {
  clampPartyForFoundations,
  createEmptyTokenCounts,
  getPartyForTile,
  isActorCombatEnabled,
  isRpgCombatActive,
  resolveFoundationActorId,
  shouldEnforceSideTurns,
  startTurnTimerIfNeeded,
  updateCombatFlowTelemetry,
  warnOnUnexpectedHpIncrease,
} from './shared';
import { canPlayCardWithWild } from '../rules';
import { applyOrimTiming } from '../orimEffects';

export function playTableauCard(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  if (!isCombatSessionActive(state)) return null;
  const enforceTurnOwnership = (state.combatFlowMode ?? 'turn_based_pressure') === 'turn_based_pressure';
  if (enforceTurnOwnership && getCombatActiveSide(state) === 'enemy') return null;
  const tableau = state.tableaus[tableauIndex];
  if (!tableau || tableau.length === 0) return null;

  const foundationActorId = resolveFoundationActorId(state, foundationIndex);
  const foundationActor = foundationActorId ? findActorById(state, foundationActorId) : null;
  if (foundationActor && !isActorCombatEnabled(foundationActor)) return null;

  const card = tableau[tableau.length - 1];
  const foundation = state.foundations[foundationIndex];
  const foundationTop = foundation[foundation.length - 1];
  if (!canPlayCardWithWild(card, foundationTop, state.activeEffects)) return null;

  const biomeDef = state.currentBiome ? getBiomeDefinition(state.currentBiome) : null;
  const isInfinite = !!biomeDef?.infinite;
  const playerTurnTimerState = startTurnTimerIfNeeded(state, 'player');
  const isRpgExplorationOnly = isRpgCore(state)
    && !(state.enemyFoundations ?? []).some((stack) => stack.length > 0);
  const shouldBackfill = isInfinite && !isRpgExplorationOnly;

  const newTableaus = state.tableaus.map((t, i) => {
    if (i !== tableauIndex) return t;
    const remaining = t.slice(0, -1);
    return shouldBackfill ? backfillTableau(remaining) : remaining;
  });
  const priorCombatDeck = ensureCombatDeck(state);
  const nextCombatDeck = {
    ...priorCombatDeck,
    discardPile: [...priorCombatDeck.discardPile, card],
  };

  const newFoundations = state.foundations.map((f, i) =>
    i === foundationIndex ? [...f, card] : f
  );

  const foundationCount = state.foundations.length;
  const comboSeed = state.foundationCombos && state.foundationCombos.length === foundationCount
    ? state.foundationCombos
    : Array.from({ length: foundationCount }, () => 0);
  const newCombos = [...comboSeed];
  newCombos[foundationIndex] = (newCombos[foundationIndex] || 0) + 1;
  const newActorCombos = foundationActorId
    ? {
      ...(state.actorCombos ?? {}),
      [foundationActorId]: (state.actorCombos?.[foundationActorId] ?? 0) + 1,
    }
    : (state.actorCombos ?? {});
  const stateWithApGain = foundationActorId
    ? grantApToActorById(state, foundationActorId, 1)
    : state;

  const tokensSeed = state.foundationTokens && state.foundationTokens.length === foundationCount
    ? state.foundationTokens
    : Array.from({ length: foundationCount }, () => createEmptyTokenCounts());
  const newFoundationTokens = tokensSeed.map((tokens, i) => {
    if (i !== foundationIndex || !card.tokenReward) return { ...tokens };
    return {
      ...tokens,
      [card.tokenReward]: (tokens[card.tokenReward] || 0) + 1,
    };
  });

  const newCollectedTokens = applyTokenReward(
    state.collectedTokens || createEmptyTokenCounts(),
    card
  );
  const awarded = isRpgCombatActive(stateWithApGain)
    ? awardActorComboCards({
      ...stateWithApGain,
      foundations: newFoundations,
      actorCombos: newActorCombos,
    }, foundationIndex, newActorCombos, getMoveAvailability, { sourceSide: 'player' })
    : null;

  const nextState = {
    ...stateWithApGain,
    tableaus: newTableaus,
    foundations: newFoundations,
    activeEffects: processEffects(stateWithApGain.activeEffects),
    turnCount: stateWithApGain.turnCount + 1,
    biomeMovesCompleted: (stateWithApGain.biomeMovesCompleted || 0) + 1,
    collectedTokens: newCollectedTokens,
    foundationCombos: newCombos,
    actorCombos: newActorCombos,
    foundationTokens: newFoundationTokens,
    rpgHandCards: awarded?.hand ?? (stateWithApGain.rpgHandCards ?? []),
    combatDeck: nextCombatDeck,
    actorDecks: awarded?.actorDecks ?? stateWithApGain.actorDecks,
    rpgDiscardPilesByActor: awarded?.rpgDiscardPilesByActor ?? stateWithApGain.rpgDiscardPilesByActor,
    ...playerTurnTimerState,
    combatFlowTelemetry: updateCombatFlowTelemetry(stateWithApGain, (current) => ({
      ...current,
      playerCardsPlayed: current.playerCardsPlayed + 1,
    })),
  };
  return recordCardAction(state, nextState);
}

export function playEnemyTableauCard(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  if (!isCombatSessionActive(state)) return null;
  const enforceTurnOwnership = (state.combatFlowMode ?? 'turn_based_pressure') === 'turn_based_pressure';
  if (enforceTurnOwnership && getCombatActiveSide(state) !== 'enemy') return null;
  const ensured = ensureEnemyFoundationsForPlay(state, createActorFoundationCard);
  const workingState = ensured.state;
  const enemyFoundations = ensured.enemyFoundations;
  const enemyActors = ensured.enemyActors;
  if (!enemyFoundations || enemyFoundations.length === 0) return null;
  const tableau = workingState.tableaus[tableauIndex];
  if (!tableau || tableau.length === 0) return null;
  const enemyFoundation = enemyFoundations[foundationIndex];
  if (!enemyFoundation) return null;
  if (enemyActors[foundationIndex] && !isActorCombatEnabled(enemyActors[foundationIndex])) return null;

  const card = tableau[tableau.length - 1];
  const foundationTop = enemyFoundation[enemyFoundation.length - 1];
  if (!foundationTop) return null;
  if (!canPlayCardWithWild(card, foundationTop, workingState.activeEffects)) return null;

  const biomeDef = workingState.currentBiome ? getBiomeDefinition(workingState.currentBiome) : null;
  const isInfinite = !!biomeDef?.infinite;
  const enemyTurnTimerState = startTurnTimerIfNeeded(workingState, 'enemy');
  const useQueue = getCombatActiveSide(workingState) === 'enemy';
  let nextQueues = workingState.enemyBackfillQueues ? workingState.enemyBackfillQueues.map((q) => [...q]) : undefined;
  const newTableaus = workingState.tableaus.map((t, i) => {
    if (i !== tableauIndex) return t;
    const remaining = t.slice(0, -1);
    if (!isInfinite) return remaining;
    if (useQueue) {
      const queue = nextQueues?.[i] ?? [];
      const result = backfillTableauFromQueue(remaining, queue);
      if (nextQueues) nextQueues[i] = result.queue;
      return result.tableau;
    }
    return backfillTableau(remaining);
  });

  const newEnemyFoundations = enemyFoundations.map((f, i) =>
    i === foundationIndex ? [...f, card] : f
  );
  const foundationCount = newEnemyFoundations.length;
  const comboSeed = workingState.enemyFoundationCombos && workingState.enemyFoundationCombos.length === foundationCount
    ? workingState.enemyFoundationCombos
    : Array.from({ length: foundationCount }, () => 0);
  const newCombos = [...comboSeed];
  newCombos[foundationIndex] = (newCombos[foundationIndex] || 0) + 1;
  const stateWithApGain = enemyActors[foundationIndex]
    ? grantApToActorById(workingState, enemyActors[foundationIndex].id, 1)
    : workingState;

  const tokensSeed = workingState.enemyFoundationTokens && workingState.enemyFoundationTokens.length === foundationCount
    ? workingState.enemyFoundationTokens
    : Array.from({ length: foundationCount }, () => createEmptyTokenCounts());
  const newEnemyTokens = tokensSeed.map((tokens, i) => {
    if (i !== foundationIndex || !card.tokenReward) return { ...tokens };
    return {
      ...tokens,
      [card.tokenReward]: (tokens[card.tokenReward] || 0) + 1,
    };
  });

  const nextRpgEnemyHandCards = awardEnemyActorComboCards(stateWithApGain, foundationIndex, newCombos);
  const nextCombatDeck = (() => {
    const combatDeck = ensureCombatDeck(stateWithApGain);
    return {
      ...combatDeck,
      discardPile: [...combatDeck.discardPile, card],
    };
  })();

  return {
    ...stateWithApGain,
    tableaus: newTableaus,
    enemyFoundations: newEnemyFoundations,
    enemyFoundationCombos: newCombos,
    enemyFoundationTokens: newEnemyTokens,
    rpgEnemyHandCards: nextRpgEnemyHandCards,
    combatDeck: nextCombatDeck,
    enemyBackfillQueues: nextQueues,
    turnCount: stateWithApGain.turnCount + 1,
    ...enemyTurnTimerState,
    combatFlowTelemetry: updateCombatFlowTelemetry(stateWithApGain, (current) => ({
      ...current,
      enemyCardsPlayed: current.enemyCardsPlayed + 1,
    })),
  };
}

export function advanceTurn(state: GameState): GameState {
  if (!isCombatSessionActive(state)) return state;
  const deadlockResolved = resolveRandomBiomeDeadlockSurge(state);
  if (deadlockResolved !== state) return deadlockResolved;
  if (!state.currentBiome) return state;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef?.randomlyGenerated) return state;
  const useEnemyFoundations = (state.enemyFoundations?.length ?? 0) > 0;
  if (!useEnemyFoundations) {
    return endTurn(state);
  }
  const activeSide = getCombatActiveSide(state);
  const turnDurationMs = getCombatTurnDurationMs(state, 10000);
  if (activeSide === 'player') {
    const ensuredEnemyFoundations: Card[][] = state.enemyFoundations ?? createEmptyEnemyFoundations();
    const ensuredEnemyActors = state.enemyActors ?? [];
    const nextState: GameState = {
      ...state,
      ...setCombatTurnRuntime({
        side: 'enemy',
        durationMs: turnDurationMs,
        remainingMs: shouldEnforceSideTurns(state) ? turnDurationMs : 0,
        lastTickAt: Date.now(),
        timerActive: false,
      }),
      enemyBackfillQueues: createEnemyBackfillQueues(state.tableaus, 10),
      enemyFoundations: ensuredEnemyFoundations,
      enemyActors: ensuredEnemyActors,
      enemyFoundationCombos: ensuredEnemyFoundations.map(() => 0),
      enemyFoundationTokens: ensuredEnemyFoundations.map(() => createEmptyTokenCounts()),
      rpgEnemyHandCards: (() => {
        const existing = state.rpgEnemyHandCards ?? [];
        return ensuredEnemyFoundations.map((_, idx) => [...(existing[idx] ?? [])]);
      })(),
      lifecycleTurnCounter: getNextCombatTurnCounter(state),
      combatFlowTelemetry: updateCombatFlowTelemetry(state, (current) => ({
        ...current,
        enemyTurnsStarted: current.enemyTurnsStarted + 1,
      })),
    };
    warnOnUnexpectedHpIncrease(state, nextState, 'advanceTurn:player->enemy');
    return nextState;
  }
  return endTurn(state);
}

export function endTurn(state: GameState): GameState {
  if (!isCombatSessionActive(state)) return state;
  if (!state.currentBiome) return state;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef?.randomlyGenerated) return state;
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  if (partyActors.length === 0) return state;

  const turnDurationMs = getCombatTurnDurationMs(state, 10000);
  const tableaus = state.tableaus;
  const combatDeck = state.combatDeck;
  const useEnemyFoundations = true;
  const foundationActors = clampPartyForFoundations(partyActors);
  const useSingleWildFoundation = biomeDef.id === 'random_wilds';
  const foundations: Card[][] = useSingleWildFoundation
    ? [[createFullWildSentinel(0)]]
    : foundationActors.map((actor) => [createActorFoundationCard(actor)]);
  const foundationCombos = foundations.map(() => 0);
  const foundationTokens = foundations.map(() => createEmptyTokenCounts());
  const enemyFoundations = createEmptyEnemyFoundations();
  const enemyActors: Actor[] = [];
  const enemyFoundationCombos = enemyFoundations ? enemyFoundations.map(() => 0) : undefined;
  const enemyFoundationTokens = enemyFoundations ? enemyFoundations.map(() => createEmptyTokenCounts()) : undefined;
  const nextRpgEnemyHandCards = useEnemyFoundations
    ? (() => {
      const existing = state.rpgEnemyHandCards ?? [];
      return (enemyFoundations ?? []).map((_, idx) => [...(existing[idx] ?? [])]);
    })()
    : undefined;
  const updatedParty = partyActors.map((actor) => ({
    ...actor,
    stamina: Math.max(0, (actor.stamina ?? 0) - 1),
  }));
  const resetActorCombos = {
    ...(state.actorCombos ?? {}),
    ...Object.fromEntries(updatedParty.map((actor) => [actor.id, 0])),
  };

  let nextState: GameState = {
    ...state,
    tableaus,
    combatDeck,
    foundations,
    stock: [],
    foundationCombos,
    actorCombos: resetActorCombos,
    foundationTokens,
    enemyFoundations,
    enemyActors,
    enemyFoundationCombos,
    enemyFoundationTokens,
    rpgEnemyHandCards: nextRpgEnemyHandCards,
    enemyBackfillQueues: undefined,
    tileParties: state.activeSessionTileId
      ? { ...state.tileParties, [state.activeSessionTileId]: updatedParty }
      : state.tileParties,
    ...setCombatTurnNumber(getCombatTurnNumber(state) + 1),
    ...setCombatTurnRuntime({
      side: useEnemyFoundations ? 'player' : undefined,
      durationMs: turnDurationMs,
      remainingMs: shouldEnforceSideTurns(state) && useEnemyFoundations ? turnDurationMs : 0,
      lastTickAt: Date.now(),
      timerActive: false,
    }),
    ...setCombatWorldEvent(undefined),
    enemyDifficulty: useEnemyFoundations ? (state.enemyDifficulty ?? biomeDef.enemyDifficulty ?? 'normal') : undefined,
    rpgHandCards: state.rpgHandCards ?? [],
    rpgDots: state.rpgDots ?? [],
    rpgEnemyDragSlowUntil: state.rpgEnemyDragSlowUntil ?? 0,
    rpgEnemyDragSlowActorId: state.rpgEnemyDragSlowActorId,
    rpgCloudSightUntil: state.rpgCloudSightUntil ?? 0,
    rpgCloudSightActorId: state.rpgCloudSightActorId,
    rpgComboTimerBonusMs: 0,
    rpgComboTimerBonusToken: undefined,
    rpgBlindedPlayerLevel: state.rpgBlindedPlayerLevel ?? 0,
    rpgBlindedPlayerUntil: state.rpgBlindedPlayerUntil ?? 0,
    rpgBlindedEnemyLevel: state.rpgBlindedEnemyLevel ?? 0,
    rpgBlindedEnemyUntil: state.rpgBlindedEnemyUntil ?? 0,
    lifecycleTurnCounter: getNextCombatTurnCounter(state),
    combatFlowTelemetry: updateCombatFlowTelemetry(state, (current) => ({
      ...current,
      playerTurnsStarted: current.playerTurnsStarted + (useEnemyFoundations ? 1 : 0),
    })),
  };
  partyActors.forEach((actor) => {
    nextState = applyOrimTiming(nextState, 'turn-end', actor.id);
  });
  warnOnUnexpectedHpIncrease(state, nextState, 'endTurn');
  return nextState;
}

export function endExplorationTurn(state: GameState): GameState {
  if (!isCombatSessionActive(state)) return state;
  if (!state.currentBiome) return state;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef?.randomlyGenerated) return state;
  if (!isRpgCore(state)) return state;
  const hasEnemies = (state.enemyFoundations ?? []).some((foundation) => foundation.length > 0);
  if (hasEnemies) return state;
  return {
    ...state,
    globalRestCount: (state.globalRestCount ?? 0) + 1,
    lifecycleRestCounter: (state.lifecycleRestCounter ?? state.globalRestCount ?? 0) + 1,
    turnCount: state.turnCount + 1,
    ...setCombatTurnNumber(getCombatTurnNumber(state) + 1),
    lifecycleTurnCounter: getNextCombatTurnCounter(state),
  };
}

export function spawnEnemy(state: GameState): GameState {
  if (!isCombatSessionActive(state)) return state;
  if (!isRpgCore(state)) return state;
  const foundations = state.enemyFoundations;
  if (!foundations || foundations.length === 0) return state;
  const emptyIndexes = foundations
    .map((foundation, index) => ({ foundation, index }))
    .filter(({ foundation }) => foundation.length === 0)
    .map(({ index }) => index);
  if (emptyIndexes.length === 0) return state;
  const spawnIndex = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
  const seed = DEFAULT_ENEMY_FOUNDATION_SEEDS[spawnIndex] ?? DEFAULT_ENEMY_FOUNDATION_SEEDS[0];
  const nextEnemyFoundations = foundations.map((foundation, index) => (
    index === spawnIndex ? [createEnemyFoundationCard(seed)] : foundation
  ));
  const spawnedActor = createRandomEnemyActor();
  const nextEnemyActors = [...(state.enemyActors ?? [])];
  if (spawnedActor) {
    nextEnemyActors[spawnIndex] = { ...spawnedActor, id: `${spawnedActor.id}-${randomIdSuffix()}` };
  }
  const nextEnemyCombos = state.enemyFoundationCombos
    ? state.enemyFoundationCombos.map((value, index) => (index === spawnIndex ? 0 : value))
    : nextEnemyFoundations.map(() => 0);
  const nextEnemyTokens = state.enemyFoundationTokens
    ? state.enemyFoundationTokens.map((value, index) => (index === spawnIndex ? createEmptyTokenCounts() : value))
    : nextEnemyFoundations.map(() => createEmptyTokenCounts());
  const nextEnemyHands = (() => {
    const current = state.rpgEnemyHandCards ?? [];
    const next = nextEnemyFoundations.map((_, index) => [...(current[index] ?? [])]);
    next[spawnIndex] = [];
    return next;
  })();
  return {
    ...state,
    enemyFoundations: nextEnemyFoundations,
    enemyActors: nextEnemyActors,
    enemyFoundationCombos: nextEnemyCombos,
    enemyFoundationTokens: nextEnemyTokens,
    rpgEnemyHandCards: nextEnemyHands,
  };
}

export function spawnEnemyActor(
  state: GameState,
  definitionId: string,
  foundationIndex: number
): GameState {
  if (!isCombatSessionActive(state)) return state;
  if (!isRpgCore(state)) return state;
  if (foundationIndex < 0) return state;

  const inRandomBiome = isRandomGeneratedBiomeSession(state);
  const inCombatLabRpg = isRpgCombatSession(state) && !inRandomBiome;
  if (!inRandomBiome && !inCombatLabRpg) return state;

  const actor = createActor(definitionId);
  if (!actor) return state;
  const card = createActorFoundationCard(actor);

  const existingFoundations = (state.enemyFoundations ?? []).map((foundation) => [...foundation]);
  if (existingFoundations.length === 0) {
    const seededTarget = resolveCombatLabTargetActor(state.enemyActors ?? []);
    if (seededTarget) {
      existingFoundations.push([createActorFoundationCard(seededTarget)]);
    } else {
      existingFoundations.push([]);
    }
  }
  const requiredFoundationCount = Math.max(
    foundationIndex + 1,
    inCombatLabRpg ? 3 : 1,
    existingFoundations.length
  );
  while (existingFoundations.length < requiredFoundationCount) {
    existingFoundations.push([]);
  }

  const nextEnemyFoundations = existingFoundations.map((foundation, index) => (
    index === foundationIndex ? [card] : [...foundation]
  ));
  const nextEnemyActors = [...(state.enemyActors ?? [])];
  nextEnemyActors[foundationIndex] = actor;

  const nextEnemyCombos = nextEnemyFoundations.map((_, index) => (
    index === foundationIndex ? 0 : (state.enemyFoundationCombos?.[index] ?? 0)
  ));
  const nextEnemyTokens = nextEnemyFoundations.map((_, index) => (
    index === foundationIndex
      ? createEmptyTokenCounts()
      : { ...(state.enemyFoundationTokens?.[index] ?? createEmptyTokenCounts()) }
  ));
  const nextEnemyHands = (() => {
    const current = state.rpgEnemyHandCards ?? [];
    const next = nextEnemyFoundations.map((_, index) => [...(current[index] ?? [])]);
    next[foundationIndex] = [];
    return next;
  })();

  return {
    ...state,
    enemyFoundations: nextEnemyFoundations,
    enemyActors: nextEnemyActors,
    enemyFoundationCombos: nextEnemyCombos,
    enemyFoundationTokens: nextEnemyTokens,
    rpgEnemyHandCards: nextEnemyHands,
  };
}

export function completeEncounter(state: GameState): GameState {
  return completeEncounterFromBiomeRewards(state);
}
