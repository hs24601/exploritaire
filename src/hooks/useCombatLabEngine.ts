import { useCallback, useMemo, useState } from 'react';
import type { Actor, Card, GameState, SelectedCard } from '../engine/types';
import { createActor } from '../engine/actors';
import { canPlayCardWithWild } from '../engine/rules';
import {
  advanceTurn,
  completeEncounter,
  endExplorationTurn,
  endTurn,
  playEnemyTableauCard,
  playTableauCard,
  spawnEnemy,
  spawnEnemyActor,
} from '../engine/combat';
import { createActorFoundationCard } from '../engine/combat/foundationCard';
import { createEmptyEnemyFoundations } from '../engine/combat/enemyFoundations';
import { generateRandomCombatCard } from '../engine/combat/backfill';
import { getMoveAvailability, getValidFoundationsForCard } from '../engine/combat/moveAvailability';
import type { CombatSandboxActionsContract } from '../components/combat/contracts';

const PLAYER_ACTOR_IDS: Array<'felis' | 'ursus' | 'lupus'> = ['felis', 'ursus', 'lupus'];
const TABLEAU_COUNT = 7;
const TABLEAU_DEPTH = 4;

function createCombatTableaus(): Card[][] {
  return Array.from({ length: TABLEAU_COUNT }, () => (
    Array.from({ length: TABLEAU_DEPTH }, () => generateRandomCombatCard())
  ));
}

function createCombatLabState(): GameState {
  const playerActors: Actor[] = PLAYER_ACTOR_IDS
    .map((id) => createActor(id))
    .filter((actor): actor is Actor => !!actor);
  const foundations: Card[][] = playerActors.map((actor) => [createActorFoundationCard(actor)]);
  return {
    phase: 'biome',
    currentBiome: undefined,
    tableaus: createCombatTableaus(),
    foundations,
    enemyFoundations: createEmptyEnemyFoundations(),
    enemyActors: [],
    rpgEnemyHandCards: [[], [], []],
    rpgHandCards: [],
    stock: [],
    activeEffects: [],
    turnCount: 0,
    pendingCards: [],
    interactionMode: 'dnd',
    challengeProgress: { challengeId: 0, collected: { '💧': 0, '⛰️': 0, '💨': 0, '🔥': 0, '⭐': 0, '🌙': 0, '☀️': 0 } },
    buildPileProgress: [],
    availableActors: playerActors,
    tileParties: {},
    tokens: [],
    collectedTokens: { A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 },
    resourceStash: { A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 },
    orimDefinitions: [],
    orimStash: [],
    orimInstances: {},
    actorDecks: {},
    relicDefinitions: [],
    equippedRelics: [],
    relicRuntimeState: {},
    tiles: [],
    blueprints: [],
    pendingBlueprintCards: [],
    foundationCombos: foundations.map(() => 0),
    actorCombos: {},
    foundationTokens: foundations.map(() => ({ A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 })),
    enemyFoundationCombos: [0, 0, 0],
    enemyFoundationTokens: [
      { A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 },
      { A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 },
      { A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 },
    ],
    randomBiomeActiveSide: 'player',
    randomBiomeTurnNumber: 1,
    randomBiomeTurnDurationMs: 10000,
    randomBiomeTurnRemainingMs: 10000,
    randomBiomeTurnLastTickAt: 0,
    randomBiomeTurnTimerActive: false,
    combatFlowMode: 'turn_based_pressure',
    combatFlowTelemetry: {
      playerTurnsStarted: 0,
      enemyTurnsStarted: 0,
      playerTimeouts: 0,
      enemyTimeouts: 0,
      playerCardsPlayed: 0,
      enemyCardsPlayed: 0,
      deadlockSurges: 0,
    },
    globalRestCount: 0,
    lifecycleTurnCounter: 0,
    lifecycleBattleCounter: 0,
    lifecycleRunCounter: 1,
    lifecycleRestCounter: 0,
    rewardQueue: [],
    rewardHistory: [],
  };
}

export function useCombatLabEngine() {
  const [gameState, setGameState] = useState<GameState>(() => createCombatLabState());
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [timeScale, setTimeScale] = useState(1);
  const [isGamePaused, setIsGamePaused] = useState(false);
  const [highPerformanceTimer, setHighPerformanceTimer] = useState(false);

  const applyStateResult = useCallback((next: GameState | null | undefined): boolean => {
    if (!next) return false;
    setGameState(next);
    return true;
  }, []);

  const moveAvailability = useMemo(() => getMoveAvailability(gameState), [gameState]);
  const validFoundationsForSelected = useMemo(() => {
    if (!selectedCard) return [];
    return getValidFoundationsForCard(gameState, selectedCard.card);
  }, [gameState, selectedCard]);

  const actions: CombatSandboxActionsContract = useMemo(() => ({
    newGame: () => {
      setGameState(createCombatLabState());
      setSelectedCard(null);
    },
    startBiome: () => {},
    spawnRandomEnemyInRandomBiome: () => setGameState((prev) => spawnEnemy(prev)),
    spawnEnemyActorInRandomBiome: (definitionId: string, foundationIndex: number) => (
      setGameState((prev) => spawnEnemyActor(prev, definitionId, foundationIndex))
    ),
    rerollRandomBiomeDeal: () => setGameState((prev) => ({ ...prev, tableaus: createCombatTableaus() })),
    endRandomBiomeTurn: () => setGameState((prev) => endTurn(prev)),
    advanceRandomBiomeTurn: () => setGameState((prev) => advanceTurn(prev)),
    cleanupDefeatedEnemies: () => setGameState((prev) => {
      const nextActors = (prev.enemyActors ?? []).map((actor) => ({ ...actor }));
      const nextFoundations = (prev.enemyFoundations ?? []).map((foundation) => [...foundation]);
      for (let i = 0; i < nextActors.length; i += 1) {
        const actor = nextActors[i];
        if (!actor || (actor.hp ?? 1) > 0) continue;
        nextActors[i] = undefined as unknown as Actor;
        nextFoundations[i] = [];
      }
      return {
        ...prev,
        enemyActors: nextActors.filter((actor) => !!actor),
        enemyFoundations: nextFoundations,
      };
    }),
    setEnemyDifficulty: (difficulty) => setGameState((prev) => ({ ...prev, enemyDifficulty: difficulty })),
    setCombatFlowMode: (mode) => setGameState((prev) => ({ ...prev, combatFlowMode: mode })),
    setRandomBiomeActiveSide: (side: 'player' | 'enemy') => (
      setGameState((prev) => ({ ...prev, randomBiomeActiveSide: side }))
    ),
    selectCard: (card, tableauIndex) => setSelectedCard({ card, tableauIndex }),
    playToFoundation: (foundationIndex) => {
      if (!selectedCard) return false;
      const ok = applyStateResult(playTableauCard(gameState, selectedCard.tableauIndex, foundationIndex));
      if (ok) setSelectedCard(null);
      return ok;
    },
    playFromTableau: (tableauIndex: number, foundationIndex: number) => (
      applyStateResult(playTableauCard(gameState, tableauIndex, foundationIndex))
    ),
    playFromHand: (card, foundationIndex, useWild) => {
      const foundation = gameState.foundations[foundationIndex] ?? [];
      const top = foundation[foundation.length - 1];
      if (!useWild && !canPlayCardWithWild(card, top, gameState.activeEffects)) return false;
      const hand = gameState.rpgHandCards ?? [];
      const idx = hand.findIndex((entry) => entry.id === card.id);
      if (idx < 0) return false;
      const nextHand = [...hand];
      nextHand.splice(idx, 1);
      const nextFoundations = gameState.foundations.map((stack, i) => (
        i === foundationIndex ? [...stack, card] : stack
      ));
      setGameState((prev) => ({
        ...prev,
        foundations: nextFoundations,
        rpgHandCards: nextHand,
      }));
      return true;
    },
    playFromHandToEnemyFoundation: () => false,
    playCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => (
      applyStateResult(playTableauCard(gameState, tableauIndex, foundationIndex))
    ),
    playEnemyCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => (
      applyStateResult(playEnemyTableauCard(gameState, tableauIndex, foundationIndex))
    ),
    setBiomeTableaus: (tableaus: Card[][]) => setGameState((prev) => ({ ...prev, tableaus })),
    setBiomeFoundations: (foundations: Card[][]) => setGameState((prev) => ({ ...prev, foundations })),
    restoreCombatLabSnapshot: (snapshot) => {
      setGameState((prev) => ({ ...prev, ...snapshot }));
      return true;
    },
    completeBiome: () => setGameState((prev) => completeEncounter(prev)),
    endExplorationTurnInRandomBiome: () => setGameState((prev) => endExplorationTurn(prev)),
    autoPlayNextMove: () => {},
    playRpgHandCardOnActor: () => false,
    playEnemyRpgHandCardOnActor: () => false,
    spendActorAp: () => false,
    tickRpgCombat: () => {},
    updateEquippedRelics: (equippedRelics) => setGameState((prev) => ({ ...prev, equippedRelics: equippedRelics as GameState['equippedRelics'] })),
    devInjectOrimToActor: () => {},
  }), [applyStateResult, gameState, selectedCard]);

  const cycleTimeScale = useCallback(() => {
    const options = [0.25, 0.5, 1, 1.5, 2, 3, 4];
    setTimeScale((prev) => {
      const idx = options.findIndex((value) => value === prev);
      return options[(idx + 1) % options.length];
    });
  }, []);

  const setFixedTimeScale = useCallback((next: number) => {
    setTimeScale(next);
  }, []);

  const togglePause = useCallback(() => {
    setIsGamePaused((prev) => !prev);
  }, []);

  return {
    gameState,
    actions,
    selectedCard,
    validFoundationsForSelected,
    noValidMoves: moveAvailability.noValidMoves,
    noValidMovesPlayer: moveAvailability.noValidMovesPlayer,
    noValidMovesEnemy: moveAvailability.noValidMovesEnemy,
    tableauCanPlay: moveAvailability.playerTableauCanPlay,
    timeScale,
    cycleTimeScale,
    setFixedTimeScale,
    isGamePaused,
    togglePause,
    highPerformanceTimer,
    setHighPerformanceTimer,
  };
}
