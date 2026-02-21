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
  isAnyCardDragging?: boolean;
  showGraphics: boolean;
  cardScale?: number;
  revealNextRow?: boolean;
  revealAllCards?: boolean;
  dimTopCard?: boolean;
  hiddenTopCard?: boolean;
  maskTopValue?: boolean;
  layout?: 'vertical' | 'horizontal';
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
  isAnyCardDragging = false,
  showGraphics,
  cardScale = 1,
  revealNextRow = false,
  revealAllCards = false,
  dimTopCard = false,
  hiddenTopCard = false,
  maskTopValue = false,
  layout = 'vertical',
}: TableauProps) {
  const isSelected = selectedCard?.tableauIndex === tableauIndex;
  const guidanceActive = guidanceMoves.length > 0;
  const effectiveScale = cardScale;
  const cardWidth = CARD_SIZE.width * effectiveScale;
  const cardHeight = CARD_SIZE.height * effectiveScale;
  const cardSize = useMemo(() => ({ width: cardWidth, height: cardHeight }), [cardWidth, cardHeight]);
  const revealOffset = revealNextRow ? Math.round(cardHeight * 0.18) + 5 : 0;
  const stackStep = (revealNextRow ? 8 : 3) * effectiveScale;
  const stackCap = (revealNextRow ? 80 : 20) * effectiveScale;
  const horizontalStep = cardWidth + (8 * effectiveScale); // Small fixed gap scaled with the cards
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
      style={{ 
        width: layout === 'horizontal' ? Math.max(cardWidth, cards.length * horizontalStep) : cardWidth, 
        minHeight: layout === 'horizontal' ? cardHeight : cardHeight + maxStackOffset + revealOffset + 60 * effectiveScale 
      }}
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
            className="absolute"
            style={{
              left: layout === 'horizontal' ? index * horizontalStep : 0,
              top: layout === 'vertical' ? stackOffset + (isTopCard ? revealOffset : 0) : 0,
              filter: dimTopCard && isTopCard ? 'brightness(0.38) saturate(0.55)' : undefined,
            }}
          >
            <Card
              card={card}
              size={cardSize}
              faceDown={hiddenTopCard && isTopCard ? true : (!revealAllCards && !isTopCard && !isSecondCard)}
              canPlay={isTopCard && canPlay && !hiddenTopCard}
              isSelected={isTopCard && isSelected}
              onClick={
                interactionMode === 'click' && isTopCard && !noValidMoves && !hiddenTopCard
                  ? () => onCardSelect(card, tableauIndex)
                  : undefined
              }
              onDragStart={
                interactionMode === 'dnd' && isTopCard && !noValidMoves && !hiddenTopCard
                  ? handleDragStart
                  : undefined
              }
              isDragging={isDragging}
              isAnyCardDragging={isAnyCardDragging}
              isGuidanceTarget={isTopCard && isNextGuidanceMove}
              isDimmed={(guidanceActive && isTopCard && !isNextGuidanceMove) || (dimTopCard && isTopCard)}
              showGraphics={showGraphics}
              maskValue={maskTopValue && (isTopCard || isSecondCard)}
              disableTilt={true}
            />
            {dimTopCard && isTopCard && (
              <div
                className="absolute inset-0 rounded-lg pointer-events-none"
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  boxShadow: 'inset 0 0 18px rgba(0, 0, 0, 0.55)',
                }}
              />
            )}
          </div>
        );
      })}

      {cards.length === 0 && (
        <div style={{ width: cardWidth, height: cardHeight }} />
      )}
    </div>
  );
});
