import { memo, useMemo, useCallback, type CSSProperties, type MutableRefObject } from 'react';
import type { Card as CardType, Move, SelectedCard, InteractionMode } from '../engine/types';
import { Card } from './Card';
import { CARD_SIZE } from '../engine/constants';
import { FORCE_NEON_CARD_STYLE } from '../config/ui';

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
  onTopCardRightClick?: (card: CardType, tableauIndex: number) => void;
  ripTriggerByCardId?: Record<string, number>;
  hideElements?: boolean;
  topCardStepIndexOverride?: number | null;
  debugStepLabel?: string | null;
}

interface TableauGroupProps {
  tableaus: CardType[][];
  selectedCard: SelectedCard | null;
  onCardSelect: (card: CardType, tableauIndex: number) => void;
  guidanceMoves: Move[];
  interactionMode: InteractionMode;
  showGraphics: boolean;
  cardScale: number;
  onDragStart?: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  draggingCardId?: string | null;
  isAnyCardDragging?: boolean;
  revealNextRow?: boolean;
  revealAllCards?: boolean;
  tableauCanPlay?: boolean[];
  noValidMoves?: boolean;
  onTopCardRightClick?: (card: CardType, tableauIndex: number) => void;
  ripTriggerByCardId?: Record<string, number>;
  hideElements?: boolean;
  dimTopCardIndexes?: Set<number>;
  hiddenTopCardIndexes?: Set<number>;
  maskTopValue?: boolean;
  topCardStepIndexOverrideByColumn?: (columnIndex: number) => number | null;
  debugStepLabelByColumn?: (columnIndex: number) => string | undefined;
  tableauRefs?: MutableRefObject<Array<HTMLDivElement | null>>;
  tableauItemStyle?: (cards: CardType[], idx: number) => CSSProperties | undefined;
  mode?: 'flat' | 'perspective';
  className?: string;
  style?: CSSProperties;
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
  onTopCardRightClick,
  ripTriggerByCardId,
}: TableauProps) {
  const isSelected = selectedCard?.tableauIndex === tableauIndex;
  const guidanceActive = guidanceMoves.length > 0;
  const useTutorialWatercolorTopBand = false;
  const effectiveScale = cardScale;
  const cardWidth = CARD_SIZE.width * effectiveScale;
  const cardHeight = CARD_SIZE.height * effectiveScale;
  const cardSize = useMemo(() => ({ width: cardWidth, height: cardHeight }), [cardWidth, cardHeight]);
  const horizontalStep = cardWidth + (8 * effectiveScale); // Small fixed gap scaled with the cards
  const peekHeight = Math.max(5, Math.round(6 * effectiveScale));
  const topVisibleIndex = (() => {
    if (!draggingCardId) return cards.length - 1;
    for (let i = cards.length - 1; i >= 0; i -= 1) {
      if (cards[i].id !== draggingCardId) return i;
    }
    return -1;
  })();
  const secondVisibleIndex = revealNextRow ? Math.max(-1, topVisibleIndex - 1) : -1;
  const hiddenCardCount = Math.max(0, topVisibleIndex);
  const maxPeekSpread = revealNextRow
    ? Math.max(14, Math.round(18 * effectiveScale))
    : Math.max(10, Math.round(12 * effectiveScale));
  const peekStep = hiddenCardCount > 0 ? Math.max(2, Math.floor(maxPeekSpread / hiddenCardCount)) : 0;
  const peekStackHeight = Math.min(maxPeekSpread, hiddenCardCount * peekStep);
  const hoverHeadroom = Math.max(6, Math.round(8 * effectiveScale));

  const isNextGuidanceMove = useMemo(() => {
    if (cards.length === 0 || guidanceMoves.length === 0) return false;
    const topCard = cards[cards.length - 1];
    const firstMove = guidanceMoves[0];
    return firstMove.tableauIndex === tableauIndex && firstMove.card.id === topCard.id;
  }, [cards, tableauIndex, guidanceMoves]);
  const neonMode = FORCE_NEON_CARD_STYLE;

  const handleDragStart = useCallback(
    (card: CardType, clientX: number, clientY: number, rect: DOMRect) => {
      if (onDragStart) {
        onDragStart(card, tableauIndex, clientX, clientY, rect);
      }
    },
    [onDragStart, tableauIndex]
  );

  const getElementWatercolorTint = useCallback((element: string) => {
    switch (element) {
      case 'W':
        return 'radial-gradient(circle at 25% 20%, rgba(186, 230, 253, 0.36) 0%, rgba(14, 116, 144, 0.24) 55%, rgba(2, 6, 23, 0.2) 100%)';
      case 'F':
        return 'radial-gradient(circle at 22% 18%, rgba(254, 202, 202, 0.34) 0%, rgba(220, 38, 38, 0.24) 52%, rgba(2, 6, 23, 0.22) 100%)';
      case 'A':
        return 'radial-gradient(circle at 25% 20%, rgba(219, 234, 254, 0.34) 0%, rgba(96, 165, 250, 0.23) 55%, rgba(2, 6, 23, 0.2) 100%)';
      case 'E':
        return 'radial-gradient(circle at 20% 20%, rgba(254, 240, 138, 0.32) 0%, rgba(217, 119, 6, 0.22) 58%, rgba(2, 6, 23, 0.2) 100%)';
      case 'L':
        return 'radial-gradient(circle at 24% 18%, rgba(254, 249, 195, 0.36) 0%, rgba(250, 204, 21, 0.24) 54%, rgba(2, 6, 23, 0.2) 100%)';
      case 'D':
        return 'radial-gradient(circle at 22% 18%, rgba(233, 213, 255, 0.34) 0%, rgba(126, 34, 206, 0.24) 56%, rgba(2, 6, 23, 0.22) 100%)';
      case 'N':
      default:
        return 'radial-gradient(circle at 24% 20%, rgba(226, 232, 240, 0.24) 0%, rgba(100, 116, 139, 0.18) 58%, rgba(2, 6, 23, 0.18) 100%)';
    }
  }, []);

  const getElementFrameBorder = useCallback((element: string) => {
    if (element) return 'rgba(166, 184, 196, 0.36)';
    return 'rgba(166, 184, 196, 0.36)';
  }, []);

  const getTableauWatercolorPostFilter = useCallback((element: string) => {
    switch (element) {
      case 'W': return 'sepia(1) brightness(0.98) contrast(1.05) saturate(0.68) hue-rotate(-14deg)';
      case 'F': return 'sepia(1) brightness(0.95) contrast(1.08) saturate(0.7) hue-rotate(-34deg)';
      case 'A': return 'sepia(1) brightness(1.02) contrast(1.04) saturate(0.62) hue-rotate(4deg)';
      case 'E': return 'sepia(1) brightness(0.97) contrast(1.06) saturate(0.7) hue-rotate(18deg)';
      case 'L': return 'sepia(1) brightness(1.03) contrast(1.03) saturate(0.6) hue-rotate(30deg)';
      case 'D': return 'sepia(1) brightness(0.92) contrast(1.09) saturate(0.66) hue-rotate(66deg)';
      case 'N':
      default:
        return 'sepia(1) brightness(0.97) contrast(1.05) saturate(0.52) hue-rotate(0deg)';
    }
  }, []);

  return (
    <div
      style={{ 
        width: layout === 'horizontal' ? Math.max(cardWidth, ((Math.max(cards.length, 1) - 1) * horizontalStep) + cardWidth) : cardWidth, 
        minHeight: layout === 'horizontal' ? cardHeight : cardHeight + peekStackHeight + hoverHeadroom + 2
      }}
      className="relative"
    >
      {cards.map((card, index) => {
        const isTopCard = index === topVisibleIndex;
        const isSecondCard = index === secondVisibleIndex;
        const depthFromTop = Math.max(0, topVisibleIndex - index);
        const compactPeekTop = Math.max(0, peekStackHeight - (depthFromTop * peekStep));
        const isDragging = card.id === draggingCardId;
        if (isDragging) return null;
        const isFaceDown = hiddenTopCard && isTopCard ? true : (!revealAllCards && layout !== 'vertical' && !isTopCard && !isSecondCard);
        const baseFilter = dimTopCard && isTopCard ? 'brightness(0.38) saturate(0.55)' : '';
        const watercolorFilter = !neonMode && !isFaceDown ? getTableauWatercolorPostFilter(card.element) : '';
        const composedFilter = [baseFilter, watercolorFilter].filter(Boolean).join(' ');
        const usePeekStrip = layout === 'vertical' && !isTopCard;
        const renderLightweightPeek = usePeekStrip && !revealNextRow;
        const tutorialHoverLift = false;

        if (renderLightweightPeek && !neonMode) {
          return (
            <div
              key={card.id}
              className="absolute rounded-md pointer-events-none"
              style={{
                left: 0,
                top: compactPeekTop + hoverHeadroom,
                width: cardWidth,
                height: peekHeight,
                zIndex: index,
                opacity: 0.8,
                border: `1px solid ${getElementFrameBorder(card.element)}`,
                background: getElementWatercolorTint(card.element),
              }}
            />
          );
        }

        return (
          <div
            key={card.id}
            className="absolute relative"
            style={{
              left: layout === 'horizontal' ? index * horizontalStep : 0,
              top: layout === 'vertical'
                ? (isTopCard ? peekStackHeight + hoverHeadroom : compactPeekTop + hoverHeadroom)
                : 0,
              width: cardWidth,
              height: usePeekStrip ? peekHeight : cardHeight,
              overflow: usePeekStrip ? 'hidden' : 'visible',
              filter: composedFilter || undefined,
              zIndex: isTopCard ? cards.length + 2 : index,
              opacity: isTopCard ? 1 : 0.86,
              pointerEvents: isTopCard ? 'auto' : 'none',
              transform: tutorialHoverLift ? 'translateY(-5px) scale(1.05)' : undefined,
              transition: useTutorialWatercolorTopBand ? 'transform 180ms ease-out' : undefined,
            }}
            onPointerDown={
              isTopCard && !hiddenTopCard && onTopCardRightClick
                ? (event) => {
                  if (event.button !== 2) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onTopCardRightClick(card, tableauIndex);
                }
                : undefined
            }
          >
            <Card
              card={card}
              size={cardSize}
              faceDown={isFaceDown}
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
              isDragging={useTutorialWatercolorTopBand ? false : isDragging}
              isAnyCardDragging={isAnyCardDragging}
              isGuidanceTarget={isTopCard && isNextGuidanceMove}
              isDimmed={(guidanceActive && isTopCard && !isNextGuidanceMove) || (dimTopCard && isTopCard)}
              showGraphics={false}
              suitDisplayOverride={useTutorialWatercolorTopBand ? ({
                A: 'AIR',
                W: 'WATER',
                E: 'EARTH',
                F: 'FIRE',
                L: 'LIGHT',
                D: 'DARK',
                N: 'NEUTRAL',
              }[card.element] ?? 'NEUTRAL') : undefined}
              borderColorOverride={!isFaceDown ? getElementFrameBorder(card.element) : undefined}
              boxShadowOverride={!isFaceDown ? 'none' : undefined}
              maskValue={maskTopValue && (isTopCard || isSecondCard)}
              disableTilt={true}
              disableHoverLift={useTutorialWatercolorTopBand}
              disableLegacyShine={true}
              watercolorOnly={true}
              ripTrigger={ripTriggerByCardId?.[card.id] ?? 0}
            />
            {false && !isFaceDown && !useTutorialWatercolorTopBand && (
              <div
                className="absolute inset-0 pointer-events-none rounded-lg"
                style={{
                  zIndex: 100,
                  background: getElementWatercolorTint(card.element),
                  opacity: 0.72,
                  mixBlendMode: 'overlay',
                }}
              />
            )}
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

export const TableauGroup = memo(function TableauGroup({
  tableaus,
  selectedCard,
  onCardSelect,
  guidanceMoves,
  interactionMode,
  showGraphics,
  cardScale,
  onDragStart,
  draggingCardId,
  isAnyCardDragging = false,
  revealNextRow = false,
  revealAllCards = false,
  tableauCanPlay = [],
  noValidMoves = false,
  onTopCardRightClick,
  ripTriggerByCardId,
  hideElements = false,
  dimTopCardIndexes,
  hiddenTopCardIndexes,
  maskTopValue = false,
  topCardStepIndexOverrideByColumn,
  debugStepLabelByColumn,
  tableauRefs,
  tableauItemStyle,
  mode = 'flat',
  className,
  style,
}: TableauGroupProps) {
  if (mode === 'perspective') {
    return (
      <div className="tableau-group-perspective-container">
        <div className="tableau-group-perspective-content flex items-start" style={{ gap: '0px' }}>
          {tableaus.map((cards, idx) => (
            <Tableau
              key={idx}
              cards={cards}
              tableauIndex={idx}
              canPlay={tableauCanPlay[idx] ?? true}
              noValidMoves={noValidMoves}
              selectedCard={selectedCard}
              onCardSelect={onCardSelect}
              guidanceMoves={guidanceMoves}
              interactionMode={interactionMode}
              onDragStart={onDragStart}
              draggingCardId={draggingCardId}
              isAnyCardDragging={isAnyCardDragging}
              showGraphics={showGraphics}
              cardScale={cardScale}
              revealAllCards={true}
              layout="horizontal"
              revealNextRow={revealNextRow}
              onTopCardRightClick={onTopCardRightClick}
              ripTriggerByCardId={ripTriggerByCardId}
              hideElements={hideElements}
              dimTopCard={!!dimTopCardIndexes?.has(idx)}
              hiddenTopCard={!!hiddenTopCardIndexes?.has(idx)}
              maskTopValue={maskTopValue}
              topCardStepIndexOverride={topCardStepIndexOverrideByColumn?.(idx) ?? null}
              debugStepLabel={debugStepLabelByColumn?.(idx)}
            />
          ))}
        </div>
        <style>{`
          .tableau-group-perspective-container {
            padding: 0;
            perspective: 2000px;
            display: flex;
            justify-content: center;
            overflow: visible;
            width: 100%;
          }
          .tableau-group-perspective-content {
            transform: perspective(80em) rotateY(-42deg) rotateX(2.4deg);
            box-shadow:
              -20px 60px 123px -25px rgba(22, 31, 39, 0.6),
              -10px 35px 75px -35px rgba(19, 26, 32, 0.2);
            border-radius: 10px;
            border: 1px solid rgba(213, 220, 226, 0.4);
            border-bottom-color: rgba(184, 194, 204, 0.5);
            transition: box-shadow 1.2s ease;
            padding: 10px;
            background: rgba(10, 15, 20, 0.4);
            backdrop-filter: blur(4px);
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            transform-style: preserve-3d;
          }
          .tableau-group-perspective-content:hover {
            box-shadow:
              -30px 80px 140px -20px rgba(22, 31, 39, 0.7),
              -15px 45px 90px -30px rgba(19, 26, 32, 0.3);
            background: rgba(20, 25, 35, 0.5);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      {tableaus.map((cards, idx) => (
        <div
          key={idx}
          ref={(el) => {
            if (tableauRefs) tableauRefs.current[idx] = el;
          }}
          style={tableauItemStyle?.(cards, idx)}
        >
          <Tableau
            cards={cards}
            tableauIndex={idx}
            canPlay={tableauCanPlay[idx] ?? true}
            noValidMoves={noValidMoves}
            selectedCard={selectedCard}
            onCardSelect={onCardSelect}
            guidanceMoves={guidanceMoves}
            interactionMode={interactionMode}
            onDragStart={onDragStart}
            draggingCardId={draggingCardId}
            isAnyCardDragging={isAnyCardDragging}
            showGraphics={showGraphics}
            cardScale={cardScale}
            revealNextRow={revealNextRow}
            revealAllCards={revealAllCards}
            onTopCardRightClick={onTopCardRightClick}
            ripTriggerByCardId={ripTriggerByCardId}
            hideElements={hideElements}
            dimTopCard={!!dimTopCardIndexes?.has(idx)}
            hiddenTopCard={!!hiddenTopCardIndexes?.has(idx)}
            maskTopValue={maskTopValue}
            topCardStepIndexOverride={topCardStepIndexOverrideByColumn?.(idx) ?? null}
            debugStepLabel={debugStepLabelByColumn?.(idx)}
          />
        </div>
      ))}
    </div>
  );
});
