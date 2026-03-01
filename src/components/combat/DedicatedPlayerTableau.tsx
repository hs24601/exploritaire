import { memo, useMemo } from 'react';
import type { Card as CardType, InteractionMode, SelectedCard } from '../../engine/types';
import { CARD_SIZE } from '../../engine/constants';
import { Card } from '../Card';
import { useCardScalePreset } from '../../contexts/CardScaleContext';
import { FORCE_NEON_CARD_STYLE } from '../../config/ui';

interface DedicatedPlayerTableauProps {
  tableaus: CardType[][];
  showGraphics: boolean;
  cardScale?: number;
  className?: string;
  interactionMode: InteractionMode;
  noValidMoves: boolean;
  tableauCanPlay: boolean[];
  selectedCard: SelectedCard | null;
  draggingCardId?: string | null;
  isAnyCardDragging?: boolean;
  onTopCardSelect: (card: CardType, tableauIndex: number) => void;
  onTopCardDragStart?: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  setTableauRef?: (tableauIndex: number, el: HTMLDivElement | null) => void;
  startIndex?: number;
}

const STACK_PEEK_PX = 7;

export const DedicatedPlayerTableau = memo(function DedicatedPlayerTableau({
  tableaus,
  showGraphics: _showGraphics,
  cardScale = 0.75,
  className,
  interactionMode,
  noValidMoves,
  tableauCanPlay,
  selectedCard,
  draggingCardId = null,
  isAnyCardDragging = false,
  onTopCardSelect,
  onTopCardDragStart,
  setTableauRef,
  startIndex = 0,
}: DedicatedPlayerTableauProps) {
  const neonMode = FORCE_NEON_CARD_STYLE;
  const tableGlobalScale = useCardScalePreset('table');
  const cardSize = useMemo(() => ({
    width: Math.round(CARD_SIZE.width * cardScale * tableGlobalScale),
    height: Math.round(CARD_SIZE.height * cardScale * tableGlobalScale),
  }), [cardScale, tableGlobalScale]);

  return (
    <div className={className}>
      <div className="flex w-full items-start justify-center gap-3 overflow-visible px-1 py-2">
        {tableaus.length === 0 ? (
          <div className="h-[1px] w-[1px]" />
        ) : (
          tableaus.map((stack, idx) => {
            const tableauIndex = startIndex + idx;
            const renderStack = draggingCardId
              ? stack.filter((card) => card.id !== draggingCardId)
              : stack;
            const topCard = renderStack[renderStack.length - 1] ?? null;
            const stackHeight = cardSize.height + Math.max(0, renderStack.length - 1) * STACK_PEEK_PX;
            return (
              <div
                key={`player-tableau-stack-${tableauIndex}`}
                className="relative rounded-md bg-[#080d12] px-1.5 pt-1.5 pb-1"
                style={{
                  minWidth: cardSize.width + 12,
                  boxShadow: 'none',
                  border: 'none',
                }}
              >
                <div
                  ref={(el) => setTableauRef?.(tableauIndex, el)}
                  className="relative select-none"
                  style={{ width: cardSize.width, height: stackHeight, overflow: 'visible' }}
                  aria-label={`Player stack ${tableauIndex + 1}`}
                >
                  {renderStack.length === 0 ? (
                    <div
                      className="rounded border border-dashed border-game-white/20"
                      style={{ width: cardSize.width, height: cardSize.height }}
                    />
                  ) : (
                    renderStack.map((card, cardIndex) => {
                      const isTop = card.id === topCard?.id;
                      return (
                        <div
                          key={card.id}
                          className="absolute left-0"
                          style={{ top: cardIndex * STACK_PEEK_PX, zIndex: cardIndex + 1 }}
                        >
                          <Card
                            card={card}
                            showGraphics={false}
                            size={cardSize}
                            borderColorOverride={!neonMode ? 'rgba(6, 10, 14, 0.9)' : undefined}
                            boxShadowOverride={!neonMode ? 'none' : undefined}
                            canPlay={isTop && (tableauCanPlay[tableauIndex] ?? false)}
                            isSelected={isTop && selectedCard?.tableauIndex === tableauIndex}
                            onClick={
                              isTop && interactionMode === 'click' && !noValidMoves
                                ? () => onTopCardSelect(card, tableauIndex)
                                : undefined
                            }
                            onDragStart={
                              isTop && interactionMode === 'dnd' && !noValidMoves && onTopCardDragStart
                                ? (dragCard, clientX, clientY, rect) => onTopCardDragStart(dragCard, tableauIndex, clientX, clientY, rect)
                                : undefined
                            }
                            isAnyCardDragging={isAnyCardDragging}
                            disableTilt={true}
                            disableLegacyShine={true}
                            watercolorOnly={!neonMode}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
