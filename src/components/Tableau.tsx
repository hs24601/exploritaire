import { memo, useMemo, useCallback, useId, useState } from 'react';
import type { Card as CardType, Move, SelectedCard, InteractionMode } from '../engine/types';
import { Card } from './Card';
import { CARD_SIZE } from '../engine/constants';
import { getElementCardWatercolor } from '../watercolor/elementCardWatercolor';

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
  const [hoveredTopCardId, setHoveredTopCardId] = useState<string | null>(null);
  const isSelected = selectedCard?.tableauIndex === tableauIndex;
  const rawId = useId();
  const tableauFilterId = useMemo(
    () => `tableau-watercolor-${tableauIndex}-${rawId.replace(/[:]/g, '')}`,
    [rawId, tableauIndex]
  );
  const guidanceActive = guidanceMoves.length > 0;
  const useTutorialWatercolorTopBand = useMemo(
    () => cards.length > 0 && cards.every((card) => card.id.startsWith('initial_actions_')),
    [cards]
  );
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
    switch (element) {
      case 'W': return 'rgba(147, 197, 253, 0.46)';
      case 'F': return 'rgba(252, 165, 165, 0.44)';
      case 'A': return 'rgba(191, 219, 254, 0.45)';
      case 'E': return 'rgba(253, 230, 138, 0.42)';
      case 'L': return 'rgba(254, 240, 138, 0.48)';
      case 'D': return 'rgba(221, 214, 254, 0.44)';
      case 'N':
      default:
        return 'rgba(186, 200, 220, 0.4)';
    }
  }, []);

  const getElementTopBandFill = useCallback((element: string) => {
    switch (element) {
      case 'W':
        return 'linear-gradient(165deg, rgba(182, 193, 225, 0.96) 0%, rgba(168, 180, 215, 0.95) 100%)';
      case 'E':
        return 'linear-gradient(165deg, rgba(227, 200, 71, 0.97) 0%, rgba(214, 182, 52, 0.95) 100%)';
      case 'A':
        return 'linear-gradient(165deg, rgba(244, 244, 248, 0.98) 0%, rgba(229, 229, 235, 0.96) 100%)';
      case 'F':
        return 'linear-gradient(165deg, rgba(255, 232, 121, 0.98) 0%, rgba(255, 133, 46, 0.97) 52%, rgba(221, 52, 34, 0.96) 100%)';
      case 'L':
        return 'linear-gradient(165deg, rgba(255, 248, 198, 0.98) 0%, rgba(246, 226, 146, 0.97) 55%, rgba(224, 194, 96, 0.95) 100%)';
      case 'D':
        return 'linear-gradient(165deg, rgba(154, 146, 133, 0.96) 0%, rgba(137, 130, 118, 0.95) 100%)';
      case 'N':
      default:
        return 'linear-gradient(165deg, rgba(194, 190, 171, 0.96) 0%, rgba(177, 173, 156, 0.95) 100%)';
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
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id={`${tableauFilterId}-paint`}>
            <feTurbulence result="noise-lg" type="fractalNoise" baseFrequency=".0125" numOctaves="2" seed="1222" />
            <feTurbulence result="noise-md" type="fractalNoise" baseFrequency=".12" numOctaves="3" seed="11413" />
            <feComposite result="BaseGraphic" in="SourceGraphic" in2="noise-lg" operator="arithmetic" k1="0.3" k2="0.45" k4="-.07" />
            <feMorphology result="layer-1" in="BaseGraphic" operator="dilate" radius="0.5" />
            <feDisplacementMap result="layer-1" in="layer-1" in2="noise-lg" xChannelSelector="R" yChannelSelector="B" scale="2" />
            <feDisplacementMap result="layer-1" in="layer-1" in2="noise-md" xChannelSelector="R" yChannelSelector="B" scale="3" />
            <feDisplacementMap result="mask" in="layer-1" in2="noise-lg" xChannelSelector="A" yChannelSelector="A" scale="4" />
            <feGaussianBlur result="mask" in="mask" stdDeviation="6" />
            <feComposite result="layer-1" in="layer-1" in2="mask" operator="arithmetic" k1="1" k2=".25" k3="-.25" k4="0" />
            <feDisplacementMap result="layer-2" in="BaseGraphic" in2="noise-lg" xChannelSelector="G" yChannelSelector="R" scale="2" />
            <feDisplacementMap result="layer-2" in="layer-2" in2="noise-md" xChannelSelector="A" yChannelSelector="G" scale="3" />
            <feDisplacementMap result="glow" in="BaseGraphic" in2="noise-lg" xChannelSelector="R" yChannelSelector="A" scale="5" />
            <feMorphology result="glow-diff" in="glow" operator="erode" radius="2" />
            <feComposite result="glow" in="glow" in2="glow-diff" operator="out" />
            <feGaussianBlur result="glow" in="glow" stdDeviation=".5" />
            <feComposite result="layer-2" in="layer-2" in2="glow" operator="arithmetic" k1="1.2" k2="0.55" k3=".3" k4="-0.2" />
            <feComposite result="watercolor" in="layer-1" in2="layer-2" operator="over" />
          </filter>
          <filter id={tableauFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency={useTutorialWatercolorTopBand ? '0.012' : '0.018'} numOctaves={useTutorialWatercolorTopBand ? 2 : 3} seed="37" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={useTutorialWatercolorTopBand ? 3 : 9} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      {cards.map((card, index) => {
        const isTopCard = index === topVisibleIndex;
        const isSecondCard = index === secondVisibleIndex;
        const depthFromTop = Math.max(0, topVisibleIndex - index);
        const compactPeekTop = Math.max(0, peekStackHeight - (depthFromTop * peekStep));
        const isDragging = card.id === draggingCardId;
        if (isDragging) return null;
        const isFaceDown = hiddenTopCard && isTopCard ? true : (!revealAllCards && layout !== 'vertical' && !isTopCard && !isSecondCard);
        const tableauElementWatercolor = !isFaceDown ? getElementCardWatercolor(card.element) : null;
        const baseFilter = dimTopCard && isTopCard ? 'brightness(0.38) saturate(0.55)' : '';
        const watercolorFilter = !isFaceDown && !useTutorialWatercolorTopBand ? `url(#${tableauFilterId})` : '';
        const composedFilter = [baseFilter, watercolorFilter].filter(Boolean).join(' ');
        const usePeekStrip = layout === 'vertical' && !isTopCard;
        const tutorialHoverLift =
          useTutorialWatercolorTopBand &&
          isTopCard &&
          !isAnyCardDragging &&
          hoveredTopCardId === card.id;

        return (
          <div
            key={card.id}
            className="absolute relative"
            onMouseEnter={useTutorialWatercolorTopBand && isTopCard ? () => setHoveredTopCardId(card.id) : undefined}
            onMouseLeave={useTutorialWatercolorTopBand && isTopCard ? () => setHoveredTopCardId((prev) => (prev === card.id ? null : prev)) : undefined}
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
              showGraphics={useTutorialWatercolorTopBand ? false : showGraphics}
              suitDisplayOverride={useTutorialWatercolorTopBand ? ({
                A: 'AIR',
                W: 'WATER',
                E: 'EARTH',
                F: 'FIRE',
                L: 'LIGHT',
                D: 'DARK',
                N: 'NEUTRAL',
              }[card.element] ?? 'NEUTRAL') : undefined}
              cardWatercolor={useTutorialWatercolorTopBand ? null : tableauElementWatercolor}
              borderColorOverride={!isFaceDown ? getElementFrameBorder(card.element) : undefined}
              boxShadowOverride={!isFaceDown ? 'none' : undefined}
              maskValue={maskTopValue && (isTopCard || isSecondCard)}
              disableTilt={true}
              disableHoverLift={useTutorialWatercolorTopBand}
              ripTrigger={ripTriggerByCardId?.[card.id] ?? 0}
            />
            {!isFaceDown && !useTutorialWatercolorTopBand && (
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
            {useTutorialWatercolorTopBand && !isFaceDown && (
              <div
                className="absolute inset-0 pointer-events-none rounded-lg"
                style={{ zIndex: 100, isolation: 'isolate', mixBlendMode: 'normal' }}
              >
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: getElementTopBandFill(card.element),
                    filter: `url(#${tableauFilterId}-paint)`,
                    opacity: 0.92,
                    transform: 'translate(-1px, -1px)',
                  }}
                />
              </div>
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
