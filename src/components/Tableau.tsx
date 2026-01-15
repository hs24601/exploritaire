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
}: TableauProps) {
  const isSelected = selectedCard?.tableauIndex === tableauIndex;
  const guidanceActive = guidanceMoves.length > 0;

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
      style={{ width: CARD_SIZE.width, minHeight: 180 }}
      className="relative"
    >
      {cards.map((card, index) => {
        const isTopCard = index === cards.length - 1;
        const stackOffset = Math.min(index * 3, 20);
        const isDragging = card.id === draggingCardId;

        return (
          <div
            key={card.id}
            className="absolute left-0"
            style={{ top: stackOffset }}
          >
            <Card
              card={card}
              faceDown={!isTopCard}
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
            />
          </div>
        );
      })}

      {cards.length === 0 && (
        <div
          style={{ width: CARD_SIZE.width, height: CARD_SIZE.height }}
          className="border-2 border-dashed border-game-purple-faded rounded-lg flex items-center justify-center text-3xl text-game-purple"
        >
          <span style={{ textShadow: '0 0 10px #8b5cf6' }}>&#10003;</span>
        </div>
      )}
    </div>
  );
});
