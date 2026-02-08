import { memo } from 'react';
import { useGraphics } from '../contexts/GraphicsContext';
import type { GameState, Card as CardType, Element, Move, SelectedCard, Actor } from '../engine/types';
import type { DragState } from '../hooks/useDragDrop';
import { GameButton } from './GameButton';
import { Tableau } from './Tableau';
import { FoundationActor } from './FoundationActor';
import { NodeEdgeBiomeScreen } from './NodeEdgeBiomeScreen';
import { FoundationTokenGrid } from './FoundationTokenGrid';
import { CARD_SIZE, WILD_SENTINEL_RANK } from '../engine/constants';
import { Hand } from './Hand';
import { canPlayCard, canPlayCardWithWild } from '../engine/rules';
import { getActorDefinition } from '../engine/actors';
import { getBiomeDefinition } from '../engine/biomes';
import { NO_MOVES_BADGE_STYLE } from '../utils/styles';

interface BiomeScreenProps {
  gameState: GameState;
  selectedCard: SelectedCard | null;
  validFoundationsForSelected: boolean[];
  tableauCanPlay: boolean[];
  noValidMoves: boolean;
  isWon: boolean;
  guidanceMoves: Move[];
  activeParty: Actor[];
  hasCollectedLoot: boolean;
  dragState: DragState;
  handleDragStart: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  setFoundationRef: (index: number, el: HTMLDivElement | null) => void;
  handCards: CardType[];
  tooltipSuppressed: boolean;
  handleExitBiome: (mode: 'return' | 'abandon') => void;
  useGhostBackground: boolean;
  lightingEnabled: boolean;
  noRegretStatus: { canRewind: boolean; cooldown: number; actorId: string | null };
  actions: {
    selectCard: (card: CardType, tableauIndex: number) => void;
    playToFoundation: (foundationIndex: number) => boolean;
    playCardDirect: (tableauIndex: number, foundationIndex: number) => boolean;
    playCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => boolean;
    playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
    playFromStock: (foundationIndex: number, useWild?: boolean, force?: boolean) => boolean;
    completeBiome: () => void;
    autoSolveBiome: () => void;
    playCardInNodeBiome: (nodeId: string, foundationIndex: number) => void;
    endRandomBiomeTurn: () => void;
    rewindLastCard: () => boolean;
  };
}

export const BiomeScreen = memo(function BiomeScreen({
  gameState,
  selectedCard,
  validFoundationsForSelected,
  tableauCanPlay,
  noValidMoves,
  isWon,
  guidanceMoves,
  activeParty,
  hasCollectedLoot,
  dragState,
  handleDragStart,
  setFoundationRef,
  handCards,
  tooltipSuppressed,
  handleExitBiome,
  useGhostBackground,
  lightingEnabled,
  noRegretStatus,
  actions,
}: BiomeScreenProps) {
  const showGraphics = useGraphics();
  const biomeDef = gameState.currentBiome
    ? getBiomeDefinition(gameState.currentBiome)
    : null;
  const overlayOpacity = lightingEnabled ? 0.68 : 0.85;
  const foundationOffset = CARD_SIZE.height * 1.25;
  const handOffset = Math.max(12, Math.round(CARD_SIZE.height * 0.35));

  // Random biome rendering
  if (biomeDef?.randomlyGenerated) {
    const emptyTokens = { W: 0, E: 0, A: 0, F: 0, L: 0, D: 0, N: 0 } as Record<Element, number>;
    const handleTableauClick = (card: CardType, tableauIndex: number) => {
      if (gameState.interactionMode !== 'click') {
        actions.selectCard(card, tableauIndex);
        return;
      }
      if (!tableauCanPlay[tableauIndex] || noValidMoves) return;

      const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
        const actor = activeParty[idx];
        const hasStamina = (actor?.stamina ?? 0) > 0;
        return hasStamina && canPlayCardWithWild(
          card,
          foundation[foundation.length - 1],
          gameState.activeEffects
        );
      });

      if (foundationIndex === -1) return;
      actions.playCardInRandomBiome(tableauIndex, foundationIndex);
    };
    const handleHandClick = (card: CardType) => {
      if (gameState.interactionMode !== 'click') return;
      if (noValidMoves) return;

      const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
        const actor = activeParty[idx];
        const hasStamina = (actor?.stamina ?? 0) > 0;
        return hasStamina && canPlayCardWithWild(
          card,
          foundation[foundation.length - 1],
          gameState.activeEffects
        );
      });

      if (foundationIndex === -1) return;
      actions.playFromHand(card, foundationIndex, true);
    };
    const handleStockClick = () => {
      if (gameState.interactionMode !== 'click') return;
      if (gameState.stock.length === 0) return;
      const stockCard = gameState.stock[gameState.stock.length - 1];

      const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
        const actor = activeParty[idx];
        const hasStamina = (actor?.stamina ?? 0) > 0;
        return hasStamina && canPlayCardWithWild(
          stockCard,
          foundation[foundation.length - 1],
          gameState.activeEffects
        );
      });

      const fallbackIndex = foundationIndex !== -1
        ? foundationIndex
        : Math.max(0, activeParty.findIndex((actor) => (actor?.stamina ?? 0) > 0));
      actions.playFromStock(fallbackIndex, true, true);
    };
    return (
      <div className="relative w-full h-full flex flex-col gap-10 items-center pointer-events-none">
        <div className="relative w-full h-full flex flex-col gap-10 items-center justify-center pointer-events-none">
        <div className="flex flex-col gap-10 items-center pointer-events-auto" data-biome-ui>
        <div className="flex items-center gap-3">
          <div className="text-sm text-game-teal tracking-[4px]" data-card-face>
            {biomeDef.name?.toUpperCase() ?? 'RANDOM BIOME'}
          </div>
          <div className="text-xs opacity-50" style={{ color: '#f0f0f0' }}>
            TURN {gameState.randomBiomeTurnNumber || 1}
          </div>
        </div>

        {/* Tableaus */}
        <div className="relative z-30 flex gap-3">
          {gameState.tableaus.map((tableau, idx) => (
            <Tableau
              key={idx}
              cards={tableau}
              tableauIndex={idx}
              canPlay={tableauCanPlay[idx]}
              noValidMoves={noValidMoves}
              selectedCard={selectedCard}
              onCardSelect={handleTableauClick}
              guidanceMoves={[]}
              interactionMode={gameState.interactionMode}
              onDragStart={handleDragStart}
              draggingCardId={dragState.isDragging ? dragState.card?.id : null}
              showGraphics={showGraphics}
              cardScale={1.25}

            />
          ))}
        </div>

        {/* Foundations + End Turn button */}
        <div className="relative z-20 flex flex-col items-center gap-4" style={{ marginTop: -foundationOffset }}>
          <div className="flex justify-center">
            <div className="flex items-start" style={{ gap: '20px' }}>
              <div className="w-20" aria-hidden="true" />
              {gameState.foundations.map((foundation, idx) => {
                const isWild = foundation.length === 1 && foundation[0].rank === WILD_SENTINEL_RANK;
                const showGoldHighlight = !!(selectedCard && validFoundationsForSelected[idx]);
                const actor = activeParty[idx];
                const hasStamina = (actor?.stamina ?? 0) > 0;
                const canReceiveDrag =
                  dragState.isDragging &&
                  dragState.card &&
                  canPlayCardWithWild(
                    dragState.card,
                    foundation[foundation.length - 1],
                    gameState.activeEffects
                  ) &&
                  hasStamina;

                return (
                  <div
                    key={idx}
                    className="flex flex-col items-center"
                    ref={(el) => setFoundationRef(idx, el)}
                  >
                    <FoundationActor
                      cards={foundation}
                      index={idx}
                      onFoundationClick={(foundationIndex) => {
                        if (selectedCard) {
                          actions.playCardInRandomBiome(
                            selectedCard.tableauIndex,
                            foundationIndex
                          );
                        }
                      }}
                      canReceive={showGoldHighlight && hasStamina}
                      isGuidanceTarget={false}
                      isDimmed={!hasStamina}
                      interactionMode={gameState.interactionMode}
                      isDragTarget={!!canReceiveDrag}
                      actor={actor}
                      showGraphics={showGraphics}
                      actorDeck={actor ? gameState.actorDecks[actor.id] : undefined}
                      orimInstances={gameState.orimInstances}
                      orimDefinitions={gameState.orimDefinitions}
                      isPartied
                      showCompleteSticker={false}
                      cardScale={1.25}
                      tooltipDisabled={tooltipSuppressed}
                      comboCount={(gameState.foundationCombos || [])[idx] || 0}
                    />
                    {isWild && (
                      <div
                        className="text-[10px] tracking-wider font-bold mt-1"
                        style={{ color: '#e6b31e' }}
                      >
                        WILD
                      </div>
                    )}
                    <FoundationTokenGrid
                      tokens={(gameState.foundationTokens || [])[idx] || emptyTokens}
                      comboCount={(gameState.foundationCombos || [])[idx] || 0}
                    />
                  </div>
                );
              })}

              {/* End Turn button - affixed to foundations */}
              <div className="w-20 flex flex-col items-center gap-2">
                <GameButton
                  onClick={actions.rewindLastCard}
                  color="purple"
                  size="sm"
                  disabled={!noRegretStatus.canRewind}
                  title={noRegretStatus.cooldown > 0 ? `Cooldown: ${noRegretStatus.cooldown}` : 'Rewind last card'}
                >
                  {noRegretStatus.cooldown > 0 ? `REW ${noRegretStatus.cooldown}` : 'REWIND'}
                </GameButton>
                <GameButton
                  onClick={actions.endRandomBiomeTurn}
                  color="gold"
                  size="sm"
                  disabled={false}
                >
                  END TURN
                </GameButton>
                <GameButton
                  onClick={() => handleExitBiome('return')}
                  color="teal"
                  size="sm"
                >
                  EXIT
                </GameButton>
              </div>
            </div>
          </div>
        </div>

        {/* Hand */}
        {handCards.length > 0 && (
          <div className="relative z-40" style={{ marginTop: handOffset }}>
            <Hand
              cards={handCards}
              cardScale={1.25}
              onDragStart={handleDragStart}
              onCardClick={handleHandClick}
              stockCount={gameState.stock.length}
              onStockClick={handleStockClick}
              draggingCardId={dragState.isDragging ? dragState.card?.id : null}
              showGraphics={showGraphics}
              interactionMode={gameState.interactionMode}
              orimDefinitions={gameState.orimDefinitions}
            />
          </div>
        )}
        </div>
        </div>
      </div>
    );
  }

  if (biomeDef?.mode === 'node-edge') {
    return (
      <div className="relative w-full h-full pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: useGhostBackground
              ? `rgba(248, 248, 255, ${overlayOpacity})`
              : `rgba(0, 0, 0, ${overlayOpacity})`,
          }}
        />
      <div className="relative w-full h-full flex items-center justify-center pointer-events-auto" data-biome-ui>
        <NodeEdgeBiomeScreen
          gameState={gameState}
          activeParty={activeParty}
          onPlayCard={actions.playCardInNodeBiome}
          onComplete={actions.completeBiome}
          onExit={handleExitBiome}
          onAutoSolve={actions.autoSolveBiome}
          hasCollectedLoot={hasCollectedLoot}
          noValidMoves={noValidMoves}
          showGraphics={showGraphics}
        />
        </div>
      </div>
    );
  }

  const isGardenGrove = biomeDef?.id === 'garden_grove';

  // Traditional biome rendering
  const handleTableauClick = (card: CardType, tableauIndex: number) => {
    if (gameState.interactionMode !== 'click') {
      actions.selectCard(card, tableauIndex);
      return;
    }
    if (!tableauCanPlay[tableauIndex] || noValidMoves) return;

    const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
      const actor = activeParty[idx];
      const hasStamina = (actor?.stamina ?? 0) > 0;
      return hasStamina && canPlayCard(
        card,
        foundation[foundation.length - 1],
        gameState.activeEffects
      );
    });

    if (foundationIndex === -1) return;
    actions.playCardDirect(tableauIndex, foundationIndex);
  };
  const handleHandClick = (card: CardType) => {
    if (gameState.interactionMode !== 'click') return;
    if (noValidMoves) return;

    const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
      const actor = activeParty[idx];
      const hasStamina = (actor?.stamina ?? 0) > 0;
      return hasStamina && canPlayCard(
        card,
        foundation[foundation.length - 1],
        gameState.activeEffects
      );
    });

    if (foundationIndex === -1) return;
    actions.playFromHand(card, foundationIndex, false);
  };
    const handleStockClick = () => {
      if (gameState.interactionMode !== 'click') return;
      if (gameState.stock.length === 0) return;
      const stockCard = gameState.stock[gameState.stock.length - 1];

    const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
      const actor = activeParty[idx];
      const hasStamina = (actor?.stamina ?? 0) > 0;
      return hasStamina && canPlayCard(
        stockCard,
        foundation[foundation.length - 1],
        gameState.activeEffects
      );
    });

    const fallbackIndex = foundationIndex !== -1
      ? foundationIndex
      : Math.max(0, activeParty.findIndex((actor) => (actor?.stamina ?? 0) > 0));
    actions.playFromStock(fallbackIndex, false, true);
  };
  // Track container size for watercolor canvas
  return (
    <div className="relative w-full h-full flex flex-col gap-10 items-center pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: useGhostBackground
            ? `rgba(248, 248, 255, ${overlayOpacity})`
            : `rgba(0, 0, 0, ${overlayOpacity})`,
        }}
      />
      <div className="relative w-full h-full flex flex-col gap-10 items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
      <div className="flex flex-col gap-10 items-center pointer-events-auto" data-biome-ui>
      <div className="flex items-center gap-3">
        <div className="text-sm text-game-teal tracking-[4px]" data-card-face>
          {biomeDef?.name?.toUpperCase() ?? 'BIOME'}
        </div>
      </div>
      {/* Tableaus */}
      {isGardenGrove ? (
        <div className="grid grid-cols-6 gap-x-3" style={{ rowGap: '15px' }}>
          {gameState.tableaus.map((tableau, idx) => (
            <Tableau
              key={idx}
              cards={tableau}
              tableauIndex={idx}
              canPlay={tableauCanPlay[idx]}
              noValidMoves={noValidMoves}
              selectedCard={selectedCard}
              onCardSelect={handleTableauClick}
              guidanceMoves={guidanceMoves}
              interactionMode={gameState.interactionMode}
              onDragStart={handleDragStart}
              draggingCardId={dragState.isDragging ? dragState.card?.id : null}
              showGraphics={showGraphics}
              cardScale={1.25}

            />
          ))}
        </div>
      ) : (
        <div className="flex gap-3">
          {gameState.tableaus.map((tableau, idx) => (
            <Tableau
              key={idx}
              cards={tableau}
              tableauIndex={idx}
              canPlay={tableauCanPlay[idx]}
              noValidMoves={noValidMoves}
              selectedCard={selectedCard}
              onCardSelect={handleTableauClick}
              guidanceMoves={guidanceMoves}
              interactionMode={gameState.interactionMode}
              onDragStart={handleDragStart}
              draggingCardId={dragState.isDragging ? dragState.card?.id : null}
              showGraphics={showGraphics}
              cardScale={1.25}

            />
          ))}
        </div>
      )}

      {/* Foundations */}
      <div className="flex flex-col items-center gap-4" style={{ marginTop: -foundationOffset }}>
        <div className="flex" style={{ gap: '10px' }}>
          {gameState.foundations.map((foundation, idx) => {
            const showGoldHighlight =
              !!(selectedCard && validFoundationsForSelected[idx]);
            const actor = activeParty[idx];
            const hasStamina = (actor?.stamina ?? 0) > 0;

            const canReceiveDrag =
              dragState.isDragging &&
              dragState.card &&
              canPlayCard(
                dragState.card,
                foundation[foundation.length - 1],
                gameState.activeEffects
              ) &&
              hasStamina;

            const actorName = actor ? getActorDefinition(actor.definitionId)?.name : undefined;

            return (
              <div key={idx} ref={(el) => setFoundationRef(idx, el)}>
                <FoundationActor
                  cards={foundation}
                  index={idx}
                  onFoundationClick={(foundationIndex) => {
                    actions.playToFoundation(foundationIndex);
                  }}
                  canReceive={showGoldHighlight && hasStamina}
                  isGuidanceTarget={false}
                  isDimmed={!hasStamina}
                  interactionMode={gameState.interactionMode}
                  isDragTarget={!!canReceiveDrag}
                  actorName={actorName}
                  actor={actor}
                  showGraphics={showGraphics}
                  actorDeck={actor ? gameState.actorDecks[actor.id] : undefined}
                  orimInstances={gameState.orimInstances}
                  orimDefinitions={gameState.orimDefinitions}
                  isPartied
                  showCompleteSticker={isWon}
                  cardScale={1.25}
                  comboCount={(gameState.foundationCombos || [])[idx] || 0}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-2">
          <div className="flex items-center gap-2">
            <GameButton
              onClick={() => handleExitBiome(hasCollectedLoot ? 'return' : 'abandon')}
              color={hasCollectedLoot ? 'teal' : 'red'}
              size="sm"
              className="w-16 text-center"
            >
              {hasCollectedLoot ? '<-' : 'ABANDON'}
            </GameButton>
            <GameButton
              onClick={actions.rewindLastCard}
              color="purple"
              size="sm"
              className="w-16 text-center"
              disabled={!noRegretStatus.canRewind}
              title={noRegretStatus.cooldown > 0 ? `Cooldown: ${noRegretStatus.cooldown}` : 'Rewind last card'}
            >
              {noRegretStatus.cooldown > 0 ? `R${noRegretStatus.cooldown}` : 'REW'}
            </GameButton>
            <GameButton onClick={actions.autoSolveBiome} color="gold" size="sm" className="w-16 text-center">
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

        {/* Complete biome button */}
        {isWon && (
          <GameButton onClick={actions.completeBiome} color="gold">
            Complete Adventure
          </GameButton>
        )}
      </div>

      {/* Hand */}
      {handCards.length > 0 && (
        <div style={{ marginTop: handOffset }}>
          <Hand
            cards={handCards}
            cardScale={1.25}
            onDragStart={handleDragStart}
            onCardClick={handleHandClick}
            stockCount={gameState.stock.length}
            onStockClick={handleStockClick}
            draggingCardId={dragState.isDragging ? dragState.card?.id : null}
            showGraphics={showGraphics}
            interactionMode={gameState.interactionMode}
            orimDefinitions={gameState.orimDefinitions}
          />
        </div>
      )}
      </div>
      </div>
    </div>
  );
});
