import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from './hooks/useGameEngine';
import { useDragDrop } from './hooks/useDragDrop';
import { GameButton } from './components/GameButton';
import { Tableau } from './components/Tableau';
import { Foundation } from './components/Foundation';
import { StatsPanel } from './components/StatsPanel';
import { GardenScreen } from './components/GardenScreen';
import { WinScreen } from './components/WinScreen';
import { DragPreview } from './components/DragPreview';
import { EFFECT_IDS } from './engine/constants';
import type { Card as CardType } from './engine/types';
import { canPlayCard } from './engine/rules';
import { getActorDefinition } from './engine/actors';

export default function App() {
  const {
    gameState,
    selectedCard,
    guidanceMoves,
    isWon,
    noValidMoves,
    tableauCanPlay,
    validFoundationsForSelected,
    canAdventure,
    actions,
  } = useGameEngine();

  // Handle drop from DND
  const handleDrop = useCallback(
    (tableauIndex: number, foundationIndex: number) => {
      if (!gameState) return;

      const tableau = gameState.tableaus[tableauIndex];
      if (tableau.length === 0) return;

      const card = tableau[tableau.length - 1];
      const foundationTop = gameState.foundations[foundationIndex][
        gameState.foundations[foundationIndex].length - 1
      ];

      if (canPlayCard(card, foundationTop, gameState.activeEffects)) {
        actions.selectCard(card, tableauIndex);
        setTimeout(() => {
          actions.playToFoundation(foundationIndex);
        }, 0);
      }
    },
    [gameState, actions]
  );

  const { dragState, startDrag, setFoundationRef } = useDragDrop(handleDrop);

  const handleDragStart = useCallback(
    (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => {
      startDrag(card, tableauIndex, clientX, clientY, rect);
    },
    [startDrag]
  );

  if (!gameState) return null;

  const guidanceActive = guidanceMoves.length > 0;
  const isDndMode = gameState.interactionMode === 'dnd';

  return (
    <div className="w-screen h-screen bg-game-bg-dark flex flex-col items-center justify-center font-mono text-game-gold p-5 box-border overflow-hidden relative">
      {/* Decorative SVG - only show during playing */}
      {gameState.phase === 'playing' && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M5 80 L5 95 L20 95" fill="none" stroke="#e6b31e" strokeWidth="0.3" />
          <path d="M95 80 L95 95 L80 95" fill="none" stroke="#e6b31e" strokeWidth="0.3" />
          <path d="M8 85 L10 75 L12 85 M10 75 L10 70 L8 78 M10 70 L12 78" fill="none" stroke="#8b5cf6" strokeWidth="0.2" />
          <path d="M88 90 L90 78 L92 90 M90 78 L90 72 L88 82 M90 72 L92 82" fill="none" stroke="#d946ef" strokeWidth="0.2" />
          <ellipse cx="15" cy="92" rx="10" ry="4" fill="none" stroke="#8b5cf6" strokeWidth="0.2" />
          <ellipse cx="85" cy="94" rx="8" ry="3" fill="none" stroke="#d946ef" strokeWidth="0.2" />
        </svg>
      )}

      {/* Control buttons - only during playing */}
      {gameState.phase === 'playing' && (
        <>
          <div className="absolute top-5 right-5 z-50 flex flex-col gap-2">
            <GameButton onClick={actions.autoPlay} color="teal">
              AUTO
            </GameButton>
            <GameButton
              onClick={actions.toggleInteractionMode}
              color={isDndMode ? 'gold' : 'purple'}
              size="sm"
            >
              {isDndMode ? 'DRAG' : 'CLICK'}
            </GameButton>
            <GameButton
              onClick={actions.returnToGarden}
              color="pink"
              size="sm"
            >
              🏡 GARDEN
            </GameButton>
          </div>

          <div className="absolute top-5 left-5 z-50 flex flex-col gap-2">
            <GameButton
              onClick={() => actions.addEffect(EFFECT_IDS.ELEMENT_MATCHING, 'Element Match', 'buff', 5)}
              color="pink"
              size="sm"
            >
              TEST: +5 ELEM MATCH
            </GameButton>
            <GameButton
              onClick={actions.activateGuidance}
              color={guidanceActive ? 'teal' : 'purple'}
              size="sm"
            >
              {guidanceActive ? `GUIDANCE (${guidanceMoves.length})` : 'GUIDANCE'}
            </GameButton>
          </div>
        </>
      )}

      {/* Stats panel */}
      {gameState.phase === 'playing' && <StatsPanel gameState={gameState} />}

      {/* Main game area - Biome */}
      {gameState.phase === 'playing' && (
        <div className="flex flex-col gap-10 items-center">
          {/* Tableaus */}
          <div className="flex gap-3">
            {gameState.tableaus.map((tableau, idx) => (
              <Tableau
                key={idx}
                cards={tableau}
                tableauIndex={idx}
                canPlay={tableauCanPlay[idx]}
                noValidMoves={noValidMoves}
                selectedCard={selectedCard}
                onCardSelect={actions.selectCard}
                guidanceMoves={guidanceMoves}
                interactionMode={gameState.interactionMode}
                onDragStart={handleDragStart}
                draggingCardId={dragState.isDragging ? dragState.card?.id : null}
              />
            ))}
          </div>

          {/* Foundations only - no stock */}
          <div className="flex flex-col items-center gap-4">
            <div
              className="text-xs opacity-80 text-center text-game-purple tracking-widest"
            >
              FOUNDATIONS
            </div>
            <div className="flex gap-2">
              {gameState.foundations.map((foundation, idx) => {
                const isGuidedFoundation =
                  guidanceMoves.length > 0 && guidanceMoves[0].foundationIndex === idx;
                const isFollowingGuidance =
                  guidanceMoves.length > 0 &&
                  selectedCard &&
                  guidanceMoves[0].tableauIndex === selectedCard.tableauIndex;

                const showGoldHighlight =
                  !!(selectedCard && validFoundationsForSelected[idx] && !isFollowingGuidance);
                const showTealHighlight =
                  isGuidedFoundation && (isFollowingGuidance || !selectedCard);
                const shouldDim = guidanceActive && !isGuidedFoundation;

                const canReceiveDrag =
                  dragState.isDragging &&
                  dragState.card &&
                  canPlayCard(
                    dragState.card,
                    foundation[foundation.length - 1],
                    gameState.activeEffects
                  );

                // Get actor name for this foundation
                const actor = gameState.adventureQueue[idx];
                const actorName = actor ? getActorDefinition(actor.definitionId)?.name : undefined;

                return (
                  <Foundation
                    key={idx}
                    cards={foundation}
                    index={idx}
                    onFoundationClick={actions.playToFoundation}
                    canReceive={showGoldHighlight}
                    isGuidanceTarget={showTealHighlight}
                    isDimmed={shouldDim}
                    interactionMode={gameState.interactionMode}
                    isDragTarget={!!canReceiveDrag}
                    setDropRef={setFoundationRef}
                    actorName={actorName}
                  />
                );
              })}
            </div>

            {/* No moves indicator */}
            {noValidMoves && !isWon && (
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-xs text-game-red text-center font-bold uppercase tracking-wider"
                  style={{ textShadow: '0 0 10px #ff6b6b' }}
                >
                  no moves
                </motion.div>
                <GameButton onClick={actions.returnToGarden} color="pink" size="sm">
                  Return to Garden
                </GameButton>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Garden screen */}
      {gameState.phase === 'garden' && (
        <GardenScreen
          collectedCards={gameState.collectedCards}
          pendingCards={gameState.pendingCards}
          buildPileProgress={gameState.buildPileProgress}
          metaCards={gameState.metaCards}
          availableActors={gameState.availableActors}
          adventureQueue={gameState.adventureQueue}
          canAdventure={canAdventure}
          onStartAdventure={actions.startAdventure}
          onStartBiome={actions.startBiome}
          onAssignCardToBuildPile={actions.assignCardToBuildPile}
          onAssignCardToMetaCardSlot={actions.assignCardToMetaCardSlot}
          onAssignActorToQueue={actions.assignActorToQueue}
          onAssignActorToMetaCardHome={actions.assignActorToMetaCardHome}
          onRemoveActorFromQueue={actions.removeActorFromQueue}
          onClearBuildPileProgress={actions.clearBuildPileProgress}
          onClearMetaCardProgress={actions.clearMetaCardProgress}
          onClearAllProgress={actions.clearAllProgress}
          onResetGame={() => actions.newGame(false)}
          onUpdateMetaCardPosition={actions.updateMetaCardGridPosition}
          onUpdateActorPosition={actions.updateActorGridPosition}
          onRemoveActorFromMetaCardHome={actions.removeActorFromMetaCardHome}
        />
      )}

      {/* Win screen */}
      {isWon && gameState.phase === 'playing' && (
        <WinScreen onNewGame={actions.returnToGarden} />
      )}

      {/* Drag preview */}
      {dragState.isDragging && dragState.card && (
        <DragPreview card={dragState.card} position={dragState.position} />
      )}
    </div>
  );
}
