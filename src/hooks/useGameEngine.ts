import { useState, useCallback, useMemo, useEffect } from 'react';
import type { GameState, SelectedCard, Move, EffectType, Element, Token, Card, Actor } from '../engine/types';
import {
  initializeGame,
  playCard,
  addEffect as addEffectToState,
  checkWin,
  getValidFoundationsForCard,
  returnToGarden as returnToGardenState,
  startAdventure as startAdventureState,
  abandonSession as abandonSessionState,
  applyMoves,
  playCardFromHand as playCardFromHandFn,
  playCardFromStock as playCardFromStockFn,
  assignCardToChallenge as assignCardToChallengeFn,
  assignCardToBuildPile as assignCardToBuildPileFn,
  assignActorToParty as assignActorToPartyFn,
  clearParty as clearPartyFn,
  toggleInteractionMode as toggleInteractionModeFn,
  clearAllGameProgress,
  clearPhaseGameProgress,
  clearBuildPileGameProgress,
  assignCardToTileSlot as assignCardToTileSlotFn,
  assignTokenToTileSlot as assignTokenToTileSlotFn,
  clearTileGameProgress,
  updateTilePosition,
  updateTileWatercolorConfig as updateTileWatercolorConfigFn,
  toggleTileLock as toggleTileLockFn,
  updateActorPosition,
  stackActorOnActor as stackActorOnActorFn,
  reorderActorStack as reorderActorStackFn,
  detachActorFromStack as detachActorFromStackFn,
  detachActorFromParty as detachActorFromPartyFn,
  swapPartyLead as swapPartyLeadFn,
  assignActorToTileHome as assignActorToTileHomeFn,
  removeActorFromTileHome as removeActorFromTileHomeFn,
  startBiome as startBiomeFn,
  playCardInBiome as playCardInBiomeFn,
  playCardInNodeBiome as playCardInNodeBiomeFn,
  playCardInRandomBiome as playCardInRandomBiomeFn,
  playEnemyCardInRandomBiome as playEnemyCardInRandomBiomeFn,
  rewindLastCardAction as rewindLastCardActionFn,
  endRandomBiomeTurn as endRandomBiomeTurnFn,
  advanceRandomBiomeTurn as advanceRandomBiomeTurnFn,
  playRpgHandCardOnActor as playRpgHandCardOnActorFn,
  tickRpgCombat as tickRpgCombatFn,
  completeBiome as completeBiomeFn,
  collectBlueprint as collectBlueprintFn,
  addTileToGarden as addTileToGardenFn,
  addTileToGardenAt as addTileToGardenAtFn,
  addActorToGarden as addActorToGardenFn,
  removeTileFromGarden as removeTileFromGardenFn,
  addTokenToGarden as addTokenToGardenFn,
  addTokenInstanceToGarden as addTokenInstanceToGardenFn,
  depositTokenToStash as depositTokenToStashFn,
  withdrawTokenFromStash as withdrawTokenFromStashFn,
  updateTokenPosition as updateTokenPositionFn,
  stackTokenOnToken as stackTokenOnTokenFn,
  equipOrimFromStash as equipOrimFromStashFn,
  moveOrimBetweenSlots as moveOrimBetweenSlotsFn,
  returnOrimToStash as returnOrimToStashFn,
  devInjectOrimToActor as devInjectOrimToActorFn,
} from '../engine/game';
import { actorHasOrimDefinition } from '../engine/orimEffects';
import { findBestMoveSequence, solveOptimally } from '../engine/guidance';
import { canPlayCard, canPlayCardWithWild } from '../engine/rules';
import { getBiomeDefinition } from '../engine/biomes';
import { analyzeOptimalSequence, computeAnalysisKey } from '../engine/analysis';

const ORIM_STORAGE_KEY = 'orimEditorDefinitions';

const normalizeOrimId = (value: string) => value
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const dedupeOrimDefinitions = (definitions: GameState['orimDefinitions']): GameState['orimDefinitions'] => {
  const seen = new Set<string>();
  const next: GameState['orimDefinitions'] = [];
  definitions.forEach((definition) => {
    const normalizedId = normalizeOrimId(definition.id || definition.name || '');
    if (!normalizedId || seen.has(normalizedId)) return;
    seen.add(normalizedId);
    if (definition.id === normalizedId) {
      next.push(definition);
      return;
    }
    next.push({ ...definition, id: normalizedId });
  });
  return next;
};

export function useGameEngine(
  initialState?: GameState | null,
  options?: { devNoRegretEnabled?: boolean }
) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [guidanceMoves, setGuidanceMoves] = useState<Move[]>([]);
  const [showGraphics, setShowGraphics] = useState(false);
  const [wildAnalysis, setWildAnalysis] = useState<{
    key: string;
    sequence: Move[];
    maxCount: number;
  } | null>(null);
  const devNoRegretEnabled = options?.devNoRegretEnabled ?? false;

  // Initialize game on mount or when initial state is provided
  useEffect(() => {
    if (gameState) return;
    if (initialState) {
      setGameState(initialState);
      return;
    }
    setGameState(initializeGame());
  }, [gameState, initialState]);

  useEffect(() => {
    if (!gameState) return;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ORIM_STORAGE_KEY, JSON.stringify(gameState.orimDefinitions, null, 2));
  }, [gameState?.orimDefinitions]);

  // Derived state
  const derivedState = useMemo(() => {
    if (!gameState) {
      return {
        isWon: false,
        noValidMoves: false,
        tableauCanPlay: [] as boolean[],
        validFoundationsForSelected: [] as boolean[],
      };
    }

    const isWon = gameState.phase === 'playing' ? checkWin(gameState) : false;
    const currentBiomeDef = gameState.currentBiome ? getBiomeDefinition(gameState.currentBiome) : null;
    const isRandomBiome = !!currentBiomeDef?.randomlyGenerated;
    const isEnemyTurn = gameState.randomBiomeActiveSide === 'enemy';
    const allowPlayerMoves = !isEnemyTurn;

    const partyActors = gameState.activeSessionTileId
      ? gameState.tileParties[gameState.activeSessionTileId] ?? []
      : [];
    const hasFoundationStamina = (index: number) =>
      (partyActors[index]?.stamina ?? 1) > 0 && (partyActors[index]?.hp ?? 1) > 0;

    const noValidMoves = (() => {
      if (gameState.phase === 'playing') {
        return !gameState.tableaus.some((tableau) => {
          if (tableau.length === 0) return false;
          const topCard = tableau[tableau.length - 1];
          return gameState.foundations.some((foundation, index) =>
            hasFoundationStamina(index) &&
            canPlayCard(topCard, foundation[foundation.length - 1], gameState.activeEffects)
          );
        });
      }
      if (gameState.phase === 'biome' && gameState.tableaus.length > 0) {
        if (isRandomBiome) {
          if (!allowPlayerMoves) return false;
          return !gameState.tableaus.some(tableau => {
            if (tableau.length === 0) return false;
            const topCard = tableau[tableau.length - 1];
            return gameState.foundations.some((foundation, index) =>
              hasFoundationStamina(index) &&
              canPlayCardWithWild(topCard, foundation[foundation.length - 1], gameState.activeEffects)
            );
          });
        }
        return !gameState.tableaus.some((tableau) => {
          if (tableau.length === 0) return false;
          const topCard = tableau[tableau.length - 1];
          return gameState.foundations.some((foundation, index) =>
            hasFoundationStamina(index) &&
            canPlayCard(topCard, foundation[foundation.length - 1], gameState.activeEffects)
          );
        });
      }
      return false;
    })();

    const tableauCanPlay = (() => {
      if (gameState.phase === 'playing') {
        return gameState.tableaus.map((tableau) => {
          if (tableau.length === 0) return false;
          const topCard = tableau[tableau.length - 1];
          return gameState.foundations.some((foundation, index) =>
            hasFoundationStamina(index) &&
            canPlayCard(topCard, foundation[foundation.length - 1], gameState.activeEffects)
          );
        });
      }
      if (gameState.phase === 'biome' && isRandomBiome) {
        if (!allowPlayerMoves) return gameState.tableaus.map(() => false);
        return gameState.tableaus.map(tableau => {
          if (tableau.length === 0) return false;
          const topCard = tableau[tableau.length - 1];
          return gameState.foundations.some((foundation, index) =>
            hasFoundationStamina(index) &&
            canPlayCardWithWild(topCard, foundation[foundation.length - 1], gameState.activeEffects)
          );
        });
      }
      return [];
    })();

    const validFoundationsForSelected = (() => {
      if (!selectedCard) return [];
      if (!allowPlayerMoves) return [];
      if (isRandomBiome) {
        return gameState.foundations.map((foundation, index) =>
          hasFoundationStamina(index) &&
          canPlayCardWithWild(selectedCard.card, foundation[foundation.length - 1], gameState.activeEffects)
        );
      }
      return getValidFoundationsForCard(gameState, selectedCard.card).map(
        (canPlay, index) => canPlay && hasFoundationStamina(index)
      );
    })();
    return {
      isWon,
      noValidMoves,
      tableauCanPlay,
      validFoundationsForSelected,
    };
  }, [gameState, selectedCard]);

  const noRegretStatus = useMemo(() => {
    if (!gameState || !gameState.lastCardActionSnapshot) {
      return { canRewind: false, cooldown: 0, actorId: null as string | null };
    }

    const partyActors: Actor[] = gameState.activeSessionTileId
      ? gameState.tileParties[gameState.activeSessionTileId] ?? []
      : [];
    const fallbackActors = partyActors.length > 0
      ? partyActors
      : Object.values(gameState.tileParties ?? {}).flat();
    const candidateActors = fallbackActors.length > 0 ? fallbackActors : gameState.availableActors;

    if (devNoRegretEnabled && candidateActors.length > 0) {
      return { canRewind: true, cooldown: 0, actorId: candidateActors[0].id };
    }

    const hasNoRegret = (actor: Actor): boolean =>
      actorHasOrimDefinition(gameState, actor.id, 'no-regret');
    const actor = candidateActors.find(hasNoRegret) ?? null;
    if (!actor) return { canRewind: false, cooldown: 0, actorId: null as string | null };
    const cooldown = gameState.noRegretCooldown ?? 0;
    return { canRewind: cooldown <= 0, cooldown, actorId: actor.id };
  }, [gameState, devNoRegretEnabled]);

  useEffect(() => {
    if (!gameState || gameState.phase !== 'biome') {
      if (wildAnalysis) setWildAnalysis(null);
      return;
    }
    const biomeDef = gameState.currentBiome ? getBiomeDefinition(gameState.currentBiome) : null;
    const isRandomWilds = biomeDef?.id === 'random_wilds' && !!biomeDef.randomlyGenerated;
    if (!isRandomWilds) {
      if (wildAnalysis) setWildAnalysis(null);
      return;
    }

    const key = computeAnalysisKey(
      gameState.tableaus,
      gameState.foundations,
      gameState.activeEffects,
      'wild'
    );
    if (wildAnalysis?.key === key) return;
    const result = analyzeOptimalSequence({
      tableaus: gameState.tableaus,
      foundations: gameState.foundations,
      activeEffects: gameState.activeEffects,
      mode: 'wild',
    });
    setWildAnalysis(result);
  }, [
    gameState?.phase,
    gameState?.currentBiome,
    gameState?.tableaus,
    gameState?.foundations,
    gameState?.activeEffects,
    wildAnalysis,
  ]);

  // Actions
  const newGame = useCallback((preserveProgress = true) => {
    const persisted = preserveProgress && gameState
      ? {
          challengeProgress: gameState.challengeProgress,
          buildPileProgress: gameState.buildPileProgress,
          pendingCards: [],
          interactionMode: gameState.interactionMode,
          availableActors: gameState.availableActors,
          tileParties: gameState.tileParties,
          activeSessionTileId: gameState.activeSessionTileId,
          tiles: gameState.tiles,
          tokens: gameState.tokens,
          resourceStash: gameState.resourceStash,
          orimDefinitions: gameState.orimDefinitions,
          orimStash: gameState.orimStash,
          orimInstances: gameState.orimInstances,
          actorDecks: gameState.actorDecks,
          noRegretCooldown: gameState.noRegretCooldown,
        }
      : undefined;
    const startPhase = gameState?.phase;
    setGameState(initializeGame(persisted, startPhase ? { startPhase } : undefined));
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

  const selectCard = useCallback(
    (card: SelectedCard['card'], tableauIndex: number) => {
      if (selectedCard?.tableauIndex === tableauIndex) {
        setSelectedCard(null);
        return;
      }
      setSelectedCard({ card, tableauIndex });
    },
    [selectedCard]
  );

  const playToFoundation = useCallback(
    (foundationIndex: number) => {
      if (!selectedCard || !gameState) return false;

      const newState = playCard(gameState, selectedCard.tableauIndex, foundationIndex);

      if (!newState) {
        setSelectedCard(null);
        return false;
      }

      setGameState(newState);

      if (guidanceMoves.length > 0) {
        const firstMove = guidanceMoves[0];
        if (
          firstMove.tableauIndex === selectedCard.tableauIndex &&
          firstMove.foundationIndex === foundationIndex
        ) {
          setGuidanceMoves(guidanceMoves.slice(1));
        } else {
          setGuidanceMoves([]);
        }
      }

      setSelectedCard(null);
      return true;
    },
    [selectedCard, gameState, guidanceMoves]
  );

  const playCardDirect = useCallback(
    (tableauIndex: number, foundationIndex: number) => {
      if (!gameState) return false;

      const newState = playCard(gameState, tableauIndex, foundationIndex);

      if (!newState) {
        return false;
      }

      setGameState(newState);

      if (guidanceMoves.length > 0) {
        const firstMove = guidanceMoves[0];
        if (
          firstMove.tableauIndex === tableauIndex &&
          firstMove.foundationIndex === foundationIndex
        ) {
          setGuidanceMoves(guidanceMoves.slice(1));
        } else {
          setGuidanceMoves([]);
        }
      }

      setSelectedCard(null);
      return true;
    },
    [gameState, guidanceMoves]
  );

  const playFromHand = useCallback(
    (card: Card, foundationIndex: number, useWild = false) => {
      if (!gameState) return false;
      const newState = playCardFromHandFn(gameState, card, foundationIndex, useWild);
      if (!newState) return false;
      setGameState(newState);
      return true;
    },
    [gameState]
  );

  const playFromStock = useCallback(
    (foundationIndex: number, useWild = false, force = false, consumeStock = true) => {
      if (!gameState) return false;
      const newState = playCardFromStockFn(gameState, foundationIndex, useWild, force, consumeStock);
      if (!newState) return false;
      setGameState(newState);
      return true;
    },
    [gameState]
  );

  const rewindLastCard = useCallback((force = false) => {
    if (!gameState) return false;
    if (!force && !noRegretStatus.canRewind) return false;
    const newState = rewindLastCardActionFn(gameState);
    if (newState === gameState) return false;
    setGameState(newState);
    setSelectedCard(null);
    setGuidanceMoves([]);
    return true;
  }, [gameState, noRegretStatus]);

  const addEffect = useCallback(
    (effectId: string, name: string, type: EffectType, duration: number) => {
      if (!gameState) return;
      setGameState(addEffectToState(gameState, effectId, name, type, duration));
    },
    [gameState]
  );

  const activateGuidance = useCallback(() => {
    if (!gameState || gameState.phase !== 'playing') return;

    const bestSequence = findBestMoveSequence(
      gameState.tableaus,
      gameState.foundations,
      gameState.activeEffects,
      5
    );

    setGuidanceMoves(bestSequence);
    setSelectedCard(null);
  }, [gameState]);

  const clearGuidance = useCallback(() => {
    setGuidanceMoves([]);
  }, []);

  const returnToGarden = useCallback(() => {
    if (!gameState) return;
    setGameState(returnToGardenState(gameState));
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

  const startAdventure = useCallback((tileId: string) => {
    if (!gameState) return;
    setGameState(startAdventureState(gameState, tileId));
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

  const autoPlay = useCallback(() => {
    if (!gameState || gameState.phase !== 'playing') return;

    const optimalMoves = solveOptimally(
      gameState.tableaus,
      gameState.foundations,
      gameState.activeEffects
    );

    if (optimalMoves.length === 0) return;

    const newState = applyMoves(gameState, optimalMoves);
    setGameState(newState);
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

  const assignCardToChallenge = useCallback((cardId: string) => {
    if (!gameState) return;
    const newState = assignCardToChallengeFn(gameState, cardId);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const assignCardToBuildPile = useCallback((cardId: string, buildPileId: string) => {
    if (!gameState) return;
    const newState = assignCardToBuildPileFn(gameState, cardId, buildPileId);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const assignActorToParty = useCallback((tileId: string, actorId: string) => {
    if (!gameState) return;
    const newState = assignActorToPartyFn(gameState, tileId, actorId);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const clearParty = useCallback((tileId: string) => {
    if (!gameState) return;
    setGameState(clearPartyFn(gameState, tileId));
  }, [gameState]);

  const toggleInteractionMode = useCallback(() => {
    if (!gameState) return;
    setGameState(toggleInteractionModeFn(gameState));
  }, [gameState]);

  const clearAllProgress = useCallback(() => {
    if (!gameState) return;
    setGameState(clearAllGameProgress(gameState));
  }, [gameState]);

  const clearPhaseProgress = useCallback((phaseId: number) => {
    if (!gameState) return;
    setGameState(clearPhaseGameProgress(gameState, phaseId));
  }, [gameState]);

  const clearBuildPileProgress = useCallback((buildPileId: string) => {
    if (!gameState) return;
    setGameState(clearBuildPileGameProgress(gameState, buildPileId));
  }, [gameState]);

  const assignCardToTileSlot = useCallback((cardId: string, tileId: string, slotId: string) => {
    if (!gameState) return;
    const newState = assignCardToTileSlotFn(gameState, cardId, tileId, slotId);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const assignTokenToTileSlot = useCallback((tokenId: string, tileId: string, slotId: string) => {
    if (!gameState) return;
    const newState = assignTokenToTileSlotFn(gameState, tokenId, tileId, slotId);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const assignActorToTileHome = useCallback((actorId: string, tileId: string, slotId: string) => {
    if (!gameState) return;
    const newState = assignActorToTileHomeFn(gameState, actorId, tileId, slotId);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const clearTileProgress = useCallback((tileId: string) => {
    if (!gameState) return;
    setGameState(clearTileGameProgress(gameState, tileId));
  }, [gameState]);

  const updateTileGridPosition = useCallback((tileId: string, col: number, row: number) => {
    if (!gameState) return;
    setGameState(updateTilePosition(gameState, tileId, col, row));
  }, [gameState]);

  const updateTileWatercolorConfig = useCallback((tileId: string, watercolorConfig: GameState['tiles'][number]['watercolorConfig']) => {
    if (!gameState) return;
    setGameState(updateTileWatercolorConfigFn(gameState, tileId, watercolorConfig));
  }, [gameState]);

  const toggleTileLock = useCallback((tileId: string) => {
    if (!gameState) return;
    setGameState(toggleTileLockFn(gameState, tileId));
  }, [gameState]);

  const updateActorGridPosition = useCallback((actorId: string, col: number, row: number) => {
    if (!gameState) return;
    setGameState(updateActorPosition(gameState, actorId, col, row));
  }, [gameState]);

  const updateTokenGridPosition = useCallback((tokenId: string, col: number, row: number) => {
    if (!gameState) return;
    setGameState(updateTokenPositionFn(gameState, tokenId, col, row));
  }, [gameState]);

  const stackTokenOnToken = useCallback((draggedTokenId: string, targetTokenId: string) => {
    if (!gameState) return;
    setGameState(stackTokenOnTokenFn(gameState, draggedTokenId, targetTokenId));
  }, [gameState]);

  const stackActorOnActor = useCallback((draggedActorId: string, targetActorId: string) => {
    if (!gameState) return;
    setGameState(stackActorOnActorFn(gameState, draggedActorId, targetActorId));
  }, [gameState]);

  const reorderActorStack = useCallback((stackId: string, orderedActorIds: string[]) => {
    if (!gameState) return;
    setGameState(reorderActorStackFn(gameState, stackId, orderedActorIds));
  }, [gameState]);

  const detachActorFromStack = useCallback((actorId: string, col: number, row: number) => {
    if (!gameState) return;
    setGameState(detachActorFromStackFn(gameState, actorId, col, row));
  }, [gameState]);

  const removeActorFromTileHome = useCallback((actorId: string) => {
    if (!gameState) return;
    setGameState(removeActorFromTileHomeFn(gameState, actorId));
  }, [gameState]);

  const detachActorFromParty = useCallback((tileId: string, actorId: string, col: number, row: number) => {
    if (!gameState) return;
    setGameState(detachActorFromPartyFn(gameState, tileId, actorId, col, row));
  }, [gameState]);

  const autoPlayNextMove = useCallback(() => {
    if (!gameState) return;

    if (gameState.phase === 'playing') {
      const sequence = findBestMoveSequence(
        gameState.tableaus,
        gameState.foundations,
        gameState.activeEffects,
        1
      );
      const move = sequence[0];
      if (!move) return;
      const newState = playCard(gameState, move.tableauIndex, move.foundationIndex);
      if (!newState) return;
      setGameState(newState);
      setSelectedCard(null);
      setGuidanceMoves([]);
      return;
    }

    if (gameState.phase !== 'biome') return;

    const biomeDef = gameState.currentBiome ? getBiomeDefinition(gameState.currentBiome) : null;
    const useWild = !!biomeDef?.randomlyGenerated;
    const partyActors = gameState.activeSessionTileId
      ? gameState.tileParties[gameState.activeSessionTileId] ?? []
      : [];

    for (let tIdx = 0; tIdx < gameState.tableaus.length; tIdx += 1) {
      const tableau = gameState.tableaus[tIdx];
      if (!tableau || tableau.length === 0) continue;
      const card = tableau[tableau.length - 1];

      for (let fIdx = 0; fIdx < gameState.foundations.length; fIdx += 1) {
        const actor = partyActors[fIdx];
        const hasStamina = (actor?.stamina ?? 0) > 0 && (actor?.hp ?? 0) > 0;
        if (!hasStamina) continue;
        const foundation = gameState.foundations[fIdx];
        const top = foundation[foundation.length - 1];
        const canPlay = useWild
          ? canPlayCardWithWild(card, top, gameState.activeEffects)
          : canPlayCard(card, top, gameState.activeEffects);
        if (!canPlay) continue;

        const newState = useWild
          ? playCardInRandomBiomeFn(gameState, tIdx, fIdx)
          : playCardInBiomeFn(gameState, tIdx, fIdx);
        if (!newState) return;
        setGameState(newState);
        setSelectedCard(null);
        setGuidanceMoves([]);
        return;
      }
    }
  }, [gameState]);

  const swapPartyLead = useCallback((actorId: string) => {
    if (!gameState) return;
    setGameState(swapPartyLeadFn(gameState, actorId));
  }, [gameState]);

  const startBiome = useCallback((tileId: string, biomeId: string) => {
    if (!gameState) return;
    setGameState(startBiomeFn(gameState, tileId, biomeId));
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

  const autoSolveBiome = useCallback(() => {
    if (!gameState || gameState.phase !== 'biome' || gameState.tableaus.length === 0) return;

    const optimalMoves = solveOptimally(
      gameState.tableaus,
      gameState.foundations,
      gameState.activeEffects
    );

    if (optimalMoves.length === 0) return;

    let nextState = gameState;
    for (const move of optimalMoves) {
      const updated = playCardInBiomeFn(nextState, move.tableauIndex, move.foundationIndex);
      if (!updated) break;
      nextState = updated;
    }

    setGameState(nextState);
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

  const playWildAnalysisSequence = useCallback(() => {
    if (!gameState || gameState.phase !== 'biome' || !wildAnalysis?.sequence.length) return;
    const biomeDef = gameState.currentBiome ? getBiomeDefinition(gameState.currentBiome) : null;
    if (!biomeDef?.randomlyGenerated || biomeDef.id !== 'random_wilds') return;

    let nextState = gameState;
    for (const move of wildAnalysis.sequence) {
      const updated = playCardInRandomBiomeFn(nextState, move.tableauIndex, move.foundationIndex);
      if (!updated) break;
      nextState = updated;
    }

    setGameState(nextState);
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState, wildAnalysis]);

  const playToBiomeFoundation = useCallback(
    (foundationIndex: number) => {
      if (!selectedCard || !gameState || gameState.phase !== 'biome') return false;

      const newState = playCardInBiomeFn(gameState, selectedCard.tableauIndex, foundationIndex);

      if (!newState) {
        setSelectedCard(null);
        return false;
      }

      setGameState(newState);
      setSelectedCard(null);
      return true;
    },
    [selectedCard, gameState]
  );

  const playFromTableau = useCallback(
    (tableauIndex: number, foundationIndex: number) => {
      if (!gameState) return false;
      const newState = playCard(gameState, tableauIndex, foundationIndex);
      if (!newState) return false;
      setGameState(newState);
      setSelectedCard(null);
      return true;
    },
    [gameState]
  );

  const playCardInNodeBiome = useCallback((nodeId: string, foundationIndex: number) => {
    if (!gameState || gameState.phase !== 'biome') return;
    const newState = playCardInNodeBiomeFn(gameState, nodeId, foundationIndex);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const playCardInRandomBiome = useCallback(
    (tableauIndex: number, foundationIndex: number) => {
      if (!gameState || gameState.phase !== 'biome') return false;
      if (gameState.randomBiomeActiveSide === 'enemy') return false;
      const newState = playCardInRandomBiomeFn(gameState, tableauIndex, foundationIndex);
      if (!newState) return false;
      setGameState(newState);
      setSelectedCard(null);
      return true;
    },
    [gameState]
  );

  const playEnemyCardInRandomBiome = useCallback(
    (tableauIndex: number, foundationIndex: number) => {
      if (!gameState || gameState.phase !== 'biome') return false;
      const newState = playEnemyCardInRandomBiomeFn(gameState, tableauIndex, foundationIndex);
      if (!newState) return false;
      setGameState(newState);
      setSelectedCard(null);
      return true;
    },
    [gameState]
  );

  const endRandomBiomeTurn = useCallback(() => {
    if (!gameState) return;
    setGameState(endRandomBiomeTurnFn(gameState));
    setSelectedCard(null);
  }, [gameState]);

  const advanceRandomBiomeTurn = useCallback(() => {
    if (!gameState) return;
    setGameState(advanceRandomBiomeTurnFn(gameState));
    setSelectedCard(null);
  }, [gameState]);

  const playRpgHandCardOnActor = useCallback((
    cardId: string,
    side: 'player' | 'enemy',
    actorIndex: number
  ) => {
    if (!gameState) return false;
    const newState = playRpgHandCardOnActorFn(gameState, cardId, side, actorIndex);
    if (newState === gameState) return false;
    setGameState(newState);
    return true;
  }, [gameState]);

  const tickRpgCombat = useCallback((nowMs: number) => {
    if (!gameState) return false;
    const newState = tickRpgCombatFn(gameState, nowMs);
    if (newState === gameState) return false;
    setGameState(newState);
    return true;
  }, [gameState]);

  const completeBiome = useCallback(() => {
    if (!gameState) return;
    setGameState(completeBiomeFn(gameState));
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

  const abandonSession = useCallback(() => {
    if (!gameState) return;
    setGameState(abandonSessionState(gameState));
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

  const collectBlueprint = useCallback((blueprintCardId: string) => {
    if (!gameState) return;
    setGameState(collectBlueprintFn(gameState, blueprintCardId));
  }, [gameState]);

  const addTileToGarden = useCallback((definitionId: string) => {
    if (!gameState) return;
    setGameState(addTileToGardenFn(gameState, definitionId));
  }, [gameState]);

  const addTileToGardenAt = useCallback((definitionId: string, col: number, row: number) => {
    if (!gameState) return;
    setGameState(addTileToGardenAtFn(gameState, definitionId, { col, row }));
  }, [gameState]);

  const removeTileFromGarden = useCallback((tileId: string) => {
    if (!gameState) return;
    setGameState(removeTileFromGardenFn(gameState, tileId));
  }, [gameState]);

  const addActorToGarden = useCallback((definitionId: string) => {
    if (!gameState) return;
    setGameState(addActorToGardenFn(gameState, definitionId));
  }, [gameState]);

  const addTokenToGarden = useCallback((element: Element, count = 1) => {
    if (!gameState) return;
    setGameState(addTokenToGardenFn(gameState, element, count));
  }, [gameState]);

  const addTokenInstanceToGarden = useCallback((token: Token) => {
    if (!gameState) return;
    setGameState(addTokenInstanceToGardenFn(gameState, token));
  }, [gameState]);

  const depositTokenToStash = useCallback((tokenId: string) => {
    if (!gameState) return;
    setGameState(depositTokenToStashFn(gameState, tokenId));
  }, [gameState]);

  const withdrawTokenFromStash = useCallback((element: Element, token: Token) => {
    if (!gameState) return;
    setGameState(withdrawTokenFromStashFn(gameState, element, token));
  }, [gameState]);

  const equipOrimFromStash = useCallback((actorId: string, cardId: string, slotId: string, orimId: string) => {
    if (!gameState) return;
    setGameState(equipOrimFromStashFn(gameState, actorId, cardId, slotId, orimId));
  }, [gameState]);

  const moveOrimBetweenSlots = useCallback((
    fromActorId: string,
    fromCardId: string,
    fromSlotId: string,
    toActorId: string,
    toCardId: string,
    toSlotId: string
  ) => {
    if (!gameState) return;
    setGameState(moveOrimBetweenSlotsFn(gameState, fromActorId, fromCardId, fromSlotId, toActorId, toCardId, toSlotId));
  }, [gameState]);

  const returnOrimToStash = useCallback((actorId: string, cardId: string, slotId: string) => {
    if (!gameState) return;
    setGameState(returnOrimToStashFn(gameState, actorId, cardId, slotId));
  }, [gameState]);

  const devInjectOrimToActor = useCallback((actorId: string, orimDefinitionId: string) => {
    if (!gameState) return;
    setGameState(devInjectOrimToActorFn(gameState, actorId, orimDefinitionId));
  }, [gameState]);

  const updateOrimDefinitions = useCallback((definitions: GameState['orimDefinitions']) => {
    const cleaned = dedupeOrimDefinitions(definitions);
    setGameState((prev) => (prev ? { ...prev, orimDefinitions: cleaned } : prev));
  }, []);

  const setEnemyDifficulty = useCallback((difficulty: GameState['enemyDifficulty']) => {
    setGameState((prev) => (prev ? { ...prev, enemyDifficulty: difficulty } : prev));
  }, []);

  const toggleGraphics = useCallback(() => {
    setShowGraphics((prev) => !prev);
  }, []);

  return {
    gameState,
    selectedCard,
    guidanceMoves,
    showGraphics,
    noRegretStatus,
    analysis: {
      wild: wildAnalysis,
    },
    ...derivedState,
    actions: {
      newGame,
      selectCard,
      playToFoundation,
      playCardDirect,
      playFromTableau,
      playFromHand,
      playFromStock,
    rewindLastCard,
      addEffect,
      activateGuidance,
      clearGuidance,
      returnToGarden,
      startAdventure,
    autoPlay,
    autoPlayNextMove,
      autoSolveBiome,
      playWildAnalysisSequence,
      assignCardToChallenge,
      assignCardToBuildPile,
      assignActorToParty,
      clearParty,
      toggleInteractionMode,
      clearAllProgress,
      clearPhaseProgress,
      clearBuildPileProgress,
      assignCardToTileSlot,
      assignTokenToTileSlot,
      assignActorToTileHome,
      clearTileProgress,
      updateTileGridPosition,
      updateTileWatercolorConfig,
      toggleTileLock,
      updateActorGridPosition,
      updateTokenGridPosition,
      stackActorOnActor,
      stackTokenOnToken,
      reorderActorStack,
      detachActorFromStack,
      detachActorFromParty,
      swapPartyLead,
      removeActorFromTileHome,
      startBiome,
      playToBiomeFoundation,
      playCardInNodeBiome,
      playCardInRandomBiome,
      playEnemyCardInRandomBiome,
      endRandomBiomeTurn,
      advanceRandomBiomeTurn,
      playRpgHandCardOnActor,
      tickRpgCombat,
      completeBiome,
      collectBlueprint,
      abandonSession,
      addTileToGarden,
      addTileToGardenAt,
      removeTileFromGarden,
      addActorToGarden,
      addTokenToGarden,
      addTokenInstanceToGarden,
      depositTokenToStash,
      withdrawTokenFromStash,
      equipOrimFromStash,
      moveOrimBetweenSlots,
      returnOrimToStash,
      devInjectOrimToActor,
      updateOrimDefinitions,
      setEnemyDifficulty,
      toggleGraphics,
    },
  };
}
