import { memo, useMemo, useCallback } from 'react';
import { useGraphics } from '../contexts/GraphicsContext';
import type { GameState, Card as CardType, Move, SelectedCard, Actor } from '../engine/types';
import { GameButton } from './GameButton';
import { Tableau } from './Tableau';
import { FoundationActor } from './FoundationActor';
import { StatsPanel } from './StatsPanel';
import { canPlayCard } from '../engine/rules';
import { actorHasOrimDefinition } from '../engine/orimEffects';
import { CARD_SIZE } from '../engine/constants';
import { PerspectiveTableauGroup } from './PerspectiveTableauGroup';

interface PlayingScreenProps {
  gameState: GameState;
  selectedCard: SelectedCard | null;
  validFoundationsForSelected: boolean[];
  tableauCanPlay: boolean[];
  noValidMoves: boolean;
  isWon: boolean;
  guidanceMoves: Move[];
  guidanceActive: boolean;
  activeParty: Actor[];
  activeTileName: string;
  isDragging: boolean;
  draggingCard: CardType | null;
  noRegretStatus: { canRewind: boolean; cooldown: number; actorId: string | null };
  handleDragStart: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  setFoundationRef: (index: number, el: HTMLDivElement | null) => void;
  actions: {
    selectCard: (card: CardType, tableauIndex: number) => void;
    playToFoundation: (foundationIndex: number) => boolean;
    returnToGarden: () => void;
    autoPlay: () => void;
    rewindLastCard: () => boolean;
  };
  forcedPerspectiveEnabled?: boolean;
}

export const PlayingScreen = memo(function PlayingScreen({
  gameState,
  selectedCard,
  validFoundationsForSelected,
  tableauCanPlay,
  noValidMoves,
  isWon,
  guidanceMoves,
  guidanceActive,
  activeParty,
  activeTileName,
  isDragging,
  draggingCard,
  noRegretStatus,
  handleDragStart,
  setFoundationRef,
  actions,
  forcedPerspectiveEnabled = true,
}: PlayingScreenProps) {
  const showGraphics = useGraphics();
  const globalCardScale = useCardScale();
  const handleFoundationClick = useCallback((foundationIndex: number) => {
    actions.playToFoundation(foundationIndex);
  }, [actions.playToFoundation]);
  const foundationCardScale = globalCardScale;
  const foundationOffset = CARD_SIZE.height * foundationCardScale;
  const foundationHasActor = (gameState.foundations[0]?.length ?? 0) > 0;
  const cloudSightActive = useMemo(() => {
    if (!foundationHasActor) return false;
    const foundationActor = activeParty[0];
    if (!foundationActor) return false;
    return actorHasOrimDefinition(gameState, foundationActor.id, 'cloud_sight');
  }, [activeParty, gameState, foundationHasActor]);
  const foundationOffsetAdjusted = cloudSightActive ? foundationOffset * 0.6 : foundationOffset;
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Decorative SVG */}
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

      {/* Control buttons */}
      <div className="absolute top-5 left-5 z-50 flex flex-col gap-2">
        {/* Reserved for future puzzle UI controls */}
      </div>

      {/* Stats panel */}
      <StatsPanel gameState={gameState} showGraphics={showGraphics} />

      {/* Main game area */}
      <div className="flex flex-col gap-10 items-center translate-y-[4vh]">
        <div className="text-sm text-game-teal tracking-[4px]" data-card-face>
          {activeTileName.toUpperCase()}
        </div>
        {/* Tableaus */}
        {forcedPerspectiveEnabled ? (
          <PerspectiveTableauGroup
            gameState={gameState}
            selectedCard={selectedCard}
            onCardSelect={actions.selectCard}
            guidanceMoves={guidanceMoves}
            showGraphics={showGraphics}
            cardScale={foundationCardScale}
            interactionMode={gameState.interactionMode}
            handleDragStart={handleDragStart}
            isDragging={isDragging}
            draggingCardId={isDragging ? draggingCard?.id : null}
            revealNextRow={cloudSightActive}
            tableauCanPlay={tableauCanPlay}
            noValidMoves={noValidMoves}
          />
        ) : (
          <div className="relative flex gap-3">
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
                draggingCardId={isDragging ? draggingCard?.id : null}
                isAnyCardDragging={isDragging}
                showGraphics={showGraphics}
                cardScale={foundationCardScale}
                revealNextRow={cloudSightActive}
              />
            ))}
          </div>
        )}

        {/* Foundations */}
        <div className="flex flex-col items-center gap-4" style={{ marginTop: -foundationOffsetAdjusted }}>
          <div className="text-xs opacity-80 text-center text-game-purple tracking-widest">
            FOUNDATIONS
          </div>
          <div className="flex" style={{ gap: '10px' }}>
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

              const actor = (idx === 0 && !foundationHasActor) ? null : activeParty[idx];
              const actorName = actor ? getActorDefinition(actor.definitionId)?.name : undefined;
              const hasStamina = (actor?.stamina ?? 0) > 0;
              const canReceiveDrag =
                isDragging &&
                draggingCard &&
                canPlayCard(
                  draggingCard,
                  foundation[foundation.length - 1],
                  gameState.activeEffects
                ) &&
                hasStamina;

              return (
                <FoundationActor
                  key={idx}
                  cards={foundation}
                  index={idx}
                  onFoundationClick={handleFoundationClick}
                  canReceive={showGoldHighlight && hasStamina}
                  isGuidanceTarget={showTealHighlight}
                  isDimmed={shouldDim || !hasStamina}
                  interactionMode={gameState.interactionMode}
                  isDragTarget={!!canReceiveDrag}
                  setDropRef={setFoundationRef}
                  actorName={actorName}
                  actor={actor}
                  showGraphics={showGraphics}
                  actorDeck={actor ? gameState.actorDecks[actor.id] : undefined}
                  orimInstances={gameState.orimInstances}
                  orimDefinitions={gameState.orimDefinitions}
                  isPartied
                  showCompleteSticker={isWon}
                  cardScale={foundationCardScale}
                  comboCount={gameState.foundationCombos?.[idx] ?? 0}
                />
              );
            })}
          </div>
          <div className="mt-2 pointer-events-auto relative z-[100]">
            <div className="relative inline-flex items-center gap-2 z-[100] pointer-events-auto">
              <GameButton onClick={actions.returnToGarden} color="teal" size="sm" className="w-16 text-center">
                {'<-'}
              </GameButton>
              {noRegretStatus.actorId && (
                <GameButton
                  onClick={actions.rewindLastCard}
                  color="purple"
                  size="sm"
                  className="w-16 text-center pointer-events-auto"
                  disabled={!noRegretStatus.canRewind}
                  title={noRegretStatus.cooldown > 0 ? `Cooldown: ${noRegretStatus.cooldown}` : 'Rewind last card'}
                >
                  {noRegretStatus.cooldown > 0 ? `R${noRegretStatus.cooldown}` : 'REW'}
                </GameButton>
              )}
              <GameButton onClick={actions.autoPlay} color="gold" size="sm" className="w-16 text-center">
                ?
              </GameButton>
              {noValidMoves && (
                <div
                  className="px-2 py-1 rounded border text-xs font-bold"
                  style={NO_MOVES_BADGE_STYLE}
                >
                  !
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
