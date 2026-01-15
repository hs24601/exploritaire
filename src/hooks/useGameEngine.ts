import { useState, useCallback, useMemo, useEffect } from 'react';
import type { GameState, SelectedCard, Move, EffectType } from '../engine/types';
import {
  initializeGame,
  playCard,
  addEffect as addEffectToState,
  checkWin,
  checkNoValidMoves,
  getTableauCanPlay,
  getValidFoundationsForCard,
  returnToGarden as returnToGardenState,
  startAdventure as startAdventureState,
  applyMoves,
  assignCardToChallenge as assignCardToChallengeFn,
  assignCardToBuildPile as assignCardToBuildPileFn,
  assignActorToQueue as assignActorToQueueFn,
  removeActorFromQueueState,
  toggleInteractionMode as toggleInteractionModeFn,
  clearAllGameProgress,
  clearPhaseGameProgress,
  clearBuildPileGameProgress,
  assignCardToMetaCardSlot as assignCardToMetaCardSlotFn,
  clearMetaCardGameProgress,
  updateMetaCardPosition,
  updateActorPosition,
  assignActorToMetaCardHome as assignActorToMetaCardHomeFn,
  removeActorFromMetaCardHome as removeActorFromMetaCardHomeFn,
  startBiome as startBiomeFn,
  playCardInBiome as playCardInBiomeFn,
  completeBiome as completeBiomeFn,
  collectBlueprint as collectBlueprintFn,
} from '../engine/game';
import { findBestMoveSequence, solveOptimally } from '../engine/guidance';
import { canStartAdventure } from '../engine/actors';

export function useGameEngine() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [guidanceMoves, setGuidanceMoves] = useState<Move[]>([]);

  // Initialize game on mount
  useEffect(() => {
    setGameState(initializeGame());
  }, []);

  // Derived state
  const derivedState = useMemo(() => {
    if (!gameState) {
      return {
        isWon: false,
        noValidMoves: false,
        tableauCanPlay: [] as boolean[],
        validFoundationsForSelected: [] as boolean[],
        canAdventure: false,
      };
    }

    const isWon = gameState.phase === 'playing' ? checkWin(gameState) : false;
    const noValidMoves = gameState.phase === 'playing' ? checkNoValidMoves(gameState) : false;
    const tableauCanPlay = gameState.phase === 'playing' ? getTableauCanPlay(gameState) : [];
    const validFoundationsForSelected = selectedCard
      ? getValidFoundationsForCard(gameState, selectedCard.card)
      : [];
    const canAdventure = canStartAdventure(gameState.adventureQueue);

    return {
      isWon,
      noValidMoves,
      tableauCanPlay,
      validFoundationsForSelected,
      canAdventure,
    };
  }, [gameState, selectedCard]);

  // Actions
  const newGame = useCallback((preserveProgress = true) => {
    const persisted = preserveProgress && gameState
      ? {
          challengeProgress: gameState.challengeProgress,
          buildPileProgress: gameState.buildPileProgress,
          pendingCards: [],
          interactionMode: gameState.interactionMode,
          availableActors: gameState.availableActors,
          adventureQueue: gameState.adventureQueue,
          metaCards: gameState.metaCards,
        }
      : undefined;
    setGameState(initializeGame(persisted));
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

  const startAdventure = useCallback(() => {
    if (!gameState || !canStartAdventure(gameState.adventureQueue)) return;
    setGameState(startAdventureState(gameState));
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

  const assignActorToQueue = useCallback((actorId: string, slotIndex: number) => {
    if (!gameState) return;
    const newState = assignActorToQueueFn(gameState, actorId, slotIndex);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const removeActorFromQueue = useCallback((slotIndex: number) => {
    if (!gameState) return;
    setGameState(removeActorFromQueueState(gameState, slotIndex));
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

  const assignCardToMetaCardSlot = useCallback((cardId: string, metaCardId: string, slotId: string) => {
    if (!gameState) return;
    const newState = assignCardToMetaCardSlotFn(gameState, cardId, metaCardId, slotId);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const assignActorToMetaCardHome = useCallback((actorId: string, metaCardId: string, slotId: string) => {
    if (!gameState) return;
    const newState = assignActorToMetaCardHomeFn(gameState, actorId, metaCardId, slotId);
    if (newState) {
      setGameState(newState);
    }
  }, [gameState]);

  const clearMetaCardProgress = useCallback((metaCardId: string) => {
    if (!gameState) return;
    setGameState(clearMetaCardGameProgress(gameState, metaCardId));
  }, [gameState]);

  const updateMetaCardGridPosition = useCallback((metaCardId: string, col: number, row: number) => {
    if (!gameState) return;
    setGameState(updateMetaCardPosition(gameState, metaCardId, col, row));
  }, [gameState]);

  const updateActorGridPosition = useCallback((actorId: string, col: number, row: number) => {
    if (!gameState) return;
    setGameState(updateActorPosition(gameState, actorId, col, row));
  }, [gameState]);

  const removeActorFromMetaCardHome = useCallback((actorId: string) => {
    if (!gameState) return;
    setGameState(removeActorFromMetaCardHomeFn(gameState, actorId));
  }, [gameState]);

  const startBiome = useCallback((biomeId: string) => {
    if (!gameState) return;
    setGameState(startBiomeFn(gameState, biomeId));
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

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

  const completeBiome = useCallback(() => {
    if (!gameState) return;
    setGameState(completeBiomeFn(gameState));
    setSelectedCard(null);
    setGuidanceMoves([]);
  }, [gameState]);

  const collectBlueprint = useCallback((blueprintCardId: string) => {
    if (!gameState) return;
    setGameState(collectBlueprintFn(gameState, blueprintCardId));
  }, [gameState]);

  return {
    gameState,
    selectedCard,
    guidanceMoves,
    ...derivedState,
    actions: {
      newGame,
      selectCard,
      playToFoundation,
      addEffect,
      activateGuidance,
      clearGuidance,
      returnToGarden,
      startAdventure,
      autoPlay,
      assignCardToChallenge,
      assignCardToBuildPile,
      assignActorToQueue,
      removeActorFromQueue,
      toggleInteractionMode,
      clearAllProgress,
      clearPhaseProgress,
      clearBuildPileProgress,
      assignCardToMetaCardSlot,
      assignActorToMetaCardHome,
      clearMetaCardProgress,
      updateMetaCardGridPosition,
      updateActorGridPosition,
      removeActorFromMetaCardHome,
      startBiome,
      playToBiomeFoundation,
      completeBiome,
      collectBlueprint,
    },
  };
}
