import { memo, useMemo, useCallback } from 'react';
import type { Card as CardType, Move, SelectedCard, InteractionMode } from '../engine/types';
import { Card } from './Card';
import { CARD_SIZE } from '../engine/constants';

interface TableauProps {
  cards: CardType[];
  tableauIndex: number;
  canPlay: boolean;
  noValidMoves: boolean;
  selectedCard: SelectedCard | null;
  onCardSelect: (card: CardType, tableauIndex: number) => void;
  guidanceMoves: Move[];
  interactionMode: InteractionMode;
  onDragStart?: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  draggingCardId?: string | null;
  showGraphics: boolean;
  cardScale?: number;
  revealNextRow?: boolean;
}

export const Tableau = memo(function Tableau({
  cards,
  tableauIndex,
  canPlay,
  noValidMoves,
  selectedCard,
  onCardSelect,
  guidanceMoves,
  interactionMode,
  onDragStart,
  draggingCardId,
  showGraphics,
  cardScale = 1,
  revealNextRow = false,
}: TableauProps) {
  const isSelected = selectedCard?.tableauIndex === tableauIndex;
  const guidanceActive = guidanceMoves.length > 0;
  const effectiveScale = cardScale;
  const cardWidth = CARD_SIZE.width * effectiveScale;
  const cardHeight = CARD_SIZE.height * effectiveScale;
  const revealOffset = revealNextRow ? Math.round(cardHeight * 0.18) + 5 : 0;
  const stackStep = (revealNextRow ? 8 : 3) * effectiveScale;
  const stackCap = (revealNextRow ? 80 : 20) * effectiveScale;
  const maxStackOffset = Math.min(Math.max(0, cards.length - 1) * stackStep, stackCap);
  const topVisibleIndex = (() => {
    if (!draggingCardId) return cards.length - 1;
    for (let i = cards.length - 1; i >= 0; i -= 1) {
      if (cards[i].id !== draggingCardId) return i;
    }
    return -1;
  })();
  const secondVisibleIndex = revealNextRow ? Math.max(-1, topVisibleIndex - 1) : -1;

  const isNextGuidanceMove = useMemo(() => {
    if (cards.length === 0 || guidanceMoves.length === 0) return false;
    const topCard = cards[cards.length - 1];
    const firstMove = guidanceMoves[0];
    return firstMove.tableauIndex === tableauIndex && firstMove.card.id === topCard.id;
  }, [cards, tableauIndex, guidanceMoves]);

  const handleDragStart = useCallback(
    (card: CardType, clientX: number, clientY: number, rect: DOMRect) => {
      if (onDragStart) {
        onDragStart(card, tableauIndex, clientX, clientY, rect);
      }
    },
    [onDragStart, tableauIndex]
  );

  return (
    <div
      style={{ width: cardWidth, minHeight: cardHeight + maxStackOffset + revealOffset + 60 * effectiveScale }}
      className="relative"
    >
      {cards.map((card, index) => {
        const isTopCard = index === topVisibleIndex;
        const isSecondCard = index === secondVisibleIndex;
        const stackOffset = Math.min(index * stackStep, stackCap);
        const isDragging = card.id === draggingCardId;

        return (
          <div
            key={card.id}
            className="absolute left-0"
            style={{ top: stackOffset + (isTopCard ? revealOffset : 0) }}
          >
            <Card
              card={card}
              size={{ width: cardWidth, height: cardHeight }}
              faceDown={!isTopCard && !isSecondCard}
              canPlay={isTopCard && canPlay}
              isSelected={isTopCard && isSelected}
              onClick={
                interactionMode === 'click' && isTopCard && !noValidMoves
                  ? () => onCardSelect(card, tableauIndex)
                  : undefined
              }
              onDragStart={
                interactionMode === 'dnd' && isTopCard && !noValidMoves
                  ? handleDragStart
                  : undefined
              }
              isDragging={isDragging}
              isGuidanceTarget={isTopCard && isNextGuidanceMove}
              isDimmed={guidanceActive && isTopCard && !isNextGuidanceMove}
              showGraphics={showGraphics}
            />
          </div>
        );
      })}

      {cards.length === 0 && (
        <div style={{ width: cardWidth, height: cardHeight }} />
      )}
    </div>
  );
});
