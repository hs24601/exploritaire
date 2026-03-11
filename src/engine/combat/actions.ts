import type { Actor, Card, GameState } from '../types';
import { randomIdSuffix } from '../constants';
import { isCombatSessionActive, isRpgCore } from '../combatSession';
import { createActor } from '../actors';
import { canPlayCardWithWild } from '../rules';
import { applyOrimTiming } from '../orimEffects';
import { grantApToActorById } from './ap';
import { awardActorComboCards } from './actorRewards';
import { findActorById } from './actorLookup';
import { recordCardAction } from './cardAction';
import { resolveRandomBiomeDeadlockSurge } from './deadlock';
import { ensureCombatDeck } from './deck';
import { processEffects } from './effects';
import { createActorFoundationCard } from './foundationCard';
import { getMoveAvailability } from './moveAvailability';
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
  isActorCombatEnabled,
  isRpgCombatActive,
  resolveFoundationActorId,
  shouldEnforceSideTurns,
  startTurnTimerIfNeeded,
  updateCombatFlowTelemetry,
  warnOnUnexpectedHpIncrease,
} from './shared';
import { clearActiveCombatParty, setPartyAssignments } from './stateAliases';

function deriveFoundationActors(state: GameState): Actor[] {
  const actors = state.foundations
    .map((stack) => {
      const actorId = stack[0]?.sourceActorId ?? stack[0]?.rpgActorId;
      if (!actorId) return null;
      return findActorById(state, actorId);
    })
    .filter((actor): actor is Actor => !!actor);
  const fallbackPool = actors.length > 0 ? actors : (state.availableActors ?? []);
  if (fallbackPool.length > 0) return clampPartyForFoundations(fallbackPool);
  const seeds: Array<'felis' | 'ursus' | 'lupus'> = ['felis', 'ursus', 'lupus'];
  const generated = state.foundations
    .map((_, index) => createActor(seeds[index] ?? 'felis'))
    .filter((actor): actor is Actor => !!actor);
  return clampPartyForFoundations(generated);
}

export function playTableauCard(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  if (!isCombatSessionActive(state)) return null;
  if ((state.combatFlowMode ?? 'turn_based_pressure') === 'turn_based_pressure' && getCombatActiveSide(state) === 'enemy') return null;
  const tableau = state.tableaus[tableauIndex];
  if (!tableau || tableau.length === 0) return null;

  const foundationActorId = resolveFoundationActorId(state, foundationIndex);
  const foundationActor = foundationActorId ? findActorById(state, foundationActorId) : null;
  if (foundationActor && !isActorCombatEnabled(foundationActor)) return null;

  const card = tableau[tableau.length - 1];
  const foundation = state.foundations[foundationIndex];
  const foundationTop = foundation[foundation.length - 1];
  if (!canPlayCardWithWild(card, foundationTop, state.activeEffects)) return null;

  const playerTurnTimerState = startTurnTimerIfNeeded(state, 'player');
  const shouldBackfill = false;
  const newTableaus = state.tableaus.map((stack, i) => {
    if (i !== tableauIndex) return stack;
    const remaining = stack.slice(0, -1);
    return shouldBackfill ? backfillTableau(remaining) : remaining;
  });

  const nextCombatDeck = (() => {
    const deck = ensureCombatDeck(state);
    return { ...deck, discardPile: [...deck.discardPile, card] };
  })();
  const newFoundations = state.foundations.map((stack, i) => (i === foundationIndex ? [...stack, card] : stack));
  const foundationCount = state.foundations.length;
  const comboSeed = state.foundationCombos && state.foundationCombos.length === foundationCount
    ? state.foundationCombos
    : Array.from({ length: foundationCount }, () => 0);
  const newCombos = [...comboSeed];
  newCombos[foundationIndex] = (newCombos[foundationIndex] || 0) + 1;
  const newActorCombos = foundationActorId
    ? { ...(state.actorCombos ?? {}), [foundationActorId]: (state.actorCombos?.[foundationActorId] ?? 0) + 1 }
    : (state.actorCombos ?? {});
  const stateWithApGain = foundationActorId ? grantApToActorById(state, foundationActorId, 1) : state;

  const tokensSeed = state.foundationTokens && state.foundationTokens.length === foundationCount
    ? state.foundationTokens
    : Array.from({ length: foundationCount }, () => createEmptyTokenCounts());
  const newFoundationTokens = tokensSeed.map((tokens, i) => (
    i !== foundationIndex || !card.tokenReward
      ? { ...tokens }
      : { ...tokens, [card.tokenReward]: (tokens[card.tokenReward] || 0) + 1 }
  ));
  const newCollectedTokens = applyTokenReward(state.collectedTokens || createEmptyTokenCounts(), card);
  const awarded = isRpgCombatActive(stateWithApGain)
    ? awardActorComboCards(
      { ...stateWithApGain, foundations: newFoundations, actorCombos: newActorCombos },
      foundationIndex,
      newActorCombos,
      getMoveAvailability,
      { sourceSide: 'player' }
    )
    : null;

  return recordCardAction(state, {
    ...stateWithApGain,
    tableaus: newTableaus,
    foundations: newFoundations,
    activeEffects: processEffects(stateWithApGain.activeEffects),
    turnCount: stateWithApGain.turnCount + 1,
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
  });
}

export function playEnemyTableauCard(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  if (!isCombatSessionActive(state)) return null;
  if ((state.combatFlowMode ?? 'turn_based_pressure') === 'turn_based_pressure' && getCombatActiveSide(state) !== 'enemy') return null;
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
  if (!foundationTop || !canPlayCardWithWild(card, foundationTop, workingState.activeEffects)) return null;

  const enemyTurnTimerState = startTurnTimerIfNeeded(workingState, 'enemy');
  const useQueue = getCombatActiveSide(workingState) === 'enemy';
  let nextQueues = workingState.enemyBackfillQueues ? workingState.enemyBackfillQueues.map((q) => [...q]) : undefined;
  const newTableaus = workingState.tableaus.map((stack, i) => {
    if (i !== tableauIndex) return stack;
    const remaining = stack.slice(0, -1);
    if (useQueue) {
      const queue = nextQueues?.[i] ?? [];
      const result = backfillTableauFromQueue(remaining, queue);
      if (nextQueues) nextQueues[i] = result.queue;
      return result.tableau;
    }
    return backfillTableau(remaining);
  });

  const newEnemyFoundations = enemyFoundations.map((stack, i) => (i === foundationIndex ? [...stack, card] : stack));
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
  const newEnemyTokens = tokensSeed.map((tokens, i) => (
    i !== foundationIndex || !card.tokenReward
      ? { ...tokens }
      : { ...tokens, [card.tokenReward]: (tokens[card.tokenReward] || 0) + 1 }
  ));

  const nextCombatDeck = (() => {
    const deck = ensureCombatDeck(stateWithApGain);
    return { ...deck, discardPile: [...deck.discardPile, card] };
  })();

  return {
    ...stateWithApGain,
    tableaus: newTableaus,
    enemyFoundations: newEnemyFoundations,
    enemyFoundationCombos: newCombos,
    enemyFoundationTokens: newEnemyTokens,
    rpgEnemyHandCards: awardEnemyActorComboCards(stateWithApGain, foundationIndex, newCombos),
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
  const useEnemyFoundations = (state.enemyFoundations?.length ?? 0) > 0;
  if (!useEnemyFoundations) return endTurn(state);

  if (getCombatActiveSide(state) === 'player') {
    const turnDurationMs = getCombatTurnDurationMs(state, 10000);
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
      rpgEnemyHandCards: ensuredEnemyFoundations.map((_, idx) => [...(state.rpgEnemyHandCards?.[idx] ?? [])]),
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
  const turnDurationMs = getCombatTurnDurationMs(state, 10000);
  const tableaus = state.tableaus;
  const combatDeck = state.combatDeck;
  const foundationActors = deriveFoundationActors(state);
  if (foundationActors.length === 0) return state;
  const foundations: Card[][] = foundationActors.map((actor) => [createActorFoundationCard(actor)]);
  const foundationCombos = foundations.map(() => 0);
  const foundationTokens = foundations.map(() => createEmptyTokenCounts());
  const enemyFoundations = createEmptyEnemyFoundations();
  const enemyActors: Actor[] = [];
  let nextState: GameState = {
    ...state,
    tableaus,
    combatDeck,
    foundations,
    stock: [],
    foundationCombos,
    foundationTokens,
    actorCombos: {
      ...(state.actorCombos ?? {}),
      ...Object.fromEntries(foundationActors.map((actor) => [actor.id, 0])),
    },
    enemyFoundations,
    enemyActors,
    enemyFoundationCombos: enemyFoundations.map(() => 0),
    enemyFoundationTokens: enemyFoundations.map(() => createEmptyTokenCounts()),
    rpgEnemyHandCards: enemyFoundations.map(() => []),
    enemyBackfillQueues: undefined,
    ...setCombatTurnNumber(getCombatTurnNumber(state) + 1),
    ...setCombatTurnRuntime({
      side: 'player',
      durationMs: turnDurationMs,
      remainingMs: shouldEnforceSideTurns(state) ? turnDurationMs : 0,
      lastTickAt: Date.now(),
      timerActive: false,
    }),
    ...setCombatWorldEvent(undefined),
    rpgHandCards: state.rpgHandCards ?? [],
    rpgDots: state.rpgDots ?? [],
    rpgEnemyDragSlowUntil: state.rpgEnemyDragSlowUntil ?? 0,
    rpgEnemyDragSlowActorId: state.rpgEnemyDragSlowActorId,
    rpgCloudSightUntil: state.rpgCloudSightUntil ?? 0,
    rpgCloudSightActorId: state.rpgCloudSightActorId,
    rpgComboTimerBonusMs: 0,
    rpgComboTimerBonusToken: undefined,
    lifecycleTurnCounter: getNextCombatTurnCounter(state),
    combatFlowTelemetry: updateCombatFlowTelemetry(state, (current) => ({
      ...current,
      playerTurnsStarted: current.playerTurnsStarted + 1,
    })),
  };
  foundationActors.forEach((actor) => {
    nextState = applyOrimTiming(nextState, 'turn-end', actor.id);
  });
  warnOnUnexpectedHpIncrease(state, nextState, 'endTurn');
  return nextState;
}

export function endExplorationTurn(state: GameState): GameState {
  if (!isCombatSessionActive(state)) return state;
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
  if (!isCombatSessionActive(state) || !isRpgCore(state)) return state;
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
    enemyFoundationCombos: nextEnemyFoundations.map((_, index) => (index === spawnIndex ? 0 : (state.enemyFoundationCombos?.[index] ?? 0))),
    enemyFoundationTokens: nextEnemyFoundations.map((_, index) => (
      index === spawnIndex ? createEmptyTokenCounts() : { ...(state.enemyFoundationTokens?.[index] ?? createEmptyTokenCounts()) }
    )),
    rpgEnemyHandCards: nextEnemyHands,
  };
}

export function spawnEnemyActor(
  state: GameState,
  definitionId: string,
  foundationIndex: number
): GameState {
  if (!isCombatSessionActive(state) || !isRpgCore(state) || foundationIndex < 0) return state;
  const actor = createActor(definitionId);
  if (!actor) return state;
  const card = createActorFoundationCard(actor);

  const existingFoundations = (state.enemyFoundations ?? []).map((foundation) => [...foundation]);
  if (existingFoundations.length === 0) {
    const seededTarget = resolveCombatLabTargetActor(state.enemyActors ?? []);
    existingFoundations.push(seededTarget ? [createActorFoundationCard(seededTarget)] : []);
  }
  const requiredFoundationCount = Math.max(foundationIndex + 1, 3, existingFoundations.length);
  while (existingFoundations.length < requiredFoundationCount) existingFoundations.push([]);

  const nextEnemyFoundations = existingFoundations.map((foundation, index) => (
    index === foundationIndex ? [card] : [...foundation]
  ));
  const nextEnemyActors = [...(state.enemyActors ?? [])];
  nextEnemyActors[foundationIndex] = actor;
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
    enemyFoundationCombos: nextEnemyFoundations.map((_, index) => (index === foundationIndex ? 0 : (state.enemyFoundationCombos?.[index] ?? 0))),
    enemyFoundationTokens: nextEnemyFoundations.map((_, index) => (
      index === foundationIndex ? createEmptyTokenCounts() : { ...(state.enemyFoundationTokens?.[index] ?? createEmptyTokenCounts()) }
    )),
    rpgEnemyHandCards: nextEnemyHands,
  };
}

export function completeEncounter(state: GameState): GameState {
  return {
    ...state,
    currentEncounterId: undefined,
    ...clearActiveCombatParty(),
    turnCount: 0,
    ...setCombatTurnNumber(1),
    ...setCombatTurnRuntime({
      side: 'player',
      durationMs: getCombatTurnDurationMs(state, 10000),
      remainingMs: getCombatTurnDurationMs(state, 10000),
      lastTickAt: Date.now(),
      timerActive: false,
    }),
    ...setCombatWorldEvent(undefined),
    tableaus: state.tableaus.map(() => []),
    foundations: state.foundations.map((stack) => [stack[0]].filter(Boolean) as Card[]),
    enemyFoundations: createEmptyEnemyFoundations(),
    enemyActors: [],
    enemyFoundationCombos: [0, 0, 0],
    enemyFoundationTokens: [createEmptyTokenCounts(), createEmptyTokenCounts(), createEmptyTokenCounts()],
    rpgEnemyHandCards: [[], [], []],
    ...setPartyAssignments(state, state.partyAssignments ?? {}),
  };
}

