import { memo, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Card as CardType, Element, InteractionMode, OrimDefinition } from '../engine/types';
import { CARD_SIZE, ELEMENT_TO_SUIT, HAND_SOURCE_INDEX } from '../engine/constants';
import { Card } from './Card';

interface HandProps {
  cards: CardType[];
  cardScale: number;
  onDragStart: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  onCardClick?: (card: CardType) => void;
  stockCount?: number;
  onStockClick?: () => void;
  draggingCardId?: string | null;
  showGraphics: boolean;
  interactionMode: InteractionMode;
  orimDefinitions?: OrimDefinition[];
}

const DEG_TO_RAD = Math.PI / 180;

const FAN = {
  maxArcDegrees: 50,
  minArcDegrees: 10,
  arcRadius: 600,
  hoverLiftY: -30,
  hoverScale: 1.1,
} as const;

function computeFanPositions(n: number, minCenterDistance: number, maxCenterDistance: number) {
  if (n === 0) return [];
  const totalArc = Math.min(FAN.maxArcDegrees, Math.max(FAN.minArcDegrees, n * 8));
  const startAngle = -totalArc / 2;
  const step = n > 1 ? totalArc / (n - 1) : 0;
  const minStep = Math.max(0, (minCenterDistance / FAN.arcRadius) * (180 / Math.PI));
  const maxStep = Math.max(minStep, (maxCenterDistance / FAN.arcRadius) * (180 / Math.PI));
  const cappedStep = n > 1 ? Math.min(Math.max(step, minStep), maxStep) : 0;
  const cappedTotalArc = n > 1 ? cappedStep * (n - 1) : 0;
  const cappedStartAngle = -cappedTotalArc / 2;

  return Array.from({ length: n }, (_, i) => {
    const angleDeg = cappedStartAngle + i * cappedStep;
    const angleRad = angleDeg * DEG_TO_RAD;
    const x = Math.sin(angleRad) * FAN.arcRadius;
    const y = (1 - Math.cos(angleRad)) * FAN.arcRadius;
    return { x, y, rotation: angleDeg };
  });
}

export const Hand = memo(function Hand({
  cards,
  cardScale,
  onDragStart,
  onCardClick,
  stockCount = 0,
  onStockClick,
  draggingCardId,
  showGraphics,
  interactionMode,
  orimDefinitions,
}: HandProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const cardWidth = CARD_SIZE.width * cardScale;
  const cardHeight = CARD_SIZE.height * cardScale;
  const minCenterDistance = cardWidth;
  const maxCenterDistance = cardWidth * 1.5;
  const positions = useMemo(
    () => computeFanPositions(cards.length, minCenterDistance, maxCenterDistance),
    [cards.length, minCenterDistance, maxCenterDistance],
  );
  const maxRightEdge = useMemo(() => {
    const halfW = cardWidth / 2;
    const halfH = cardHeight / 2;
    return positions.reduce((max, pos) => {
      const theta = (pos.rotation ?? 0) * DEG_TO_RAD;
      const extentX = Math.abs(Math.cos(theta)) * halfW + Math.abs(Math.sin(theta)) * halfH;
      return Math.max(max, pos.x + extentX);
    }, 0);
  }, [positions, cardWidth, cardHeight]);
  const stockX = maxRightEdge + cardWidth * 1.5;
  const stockTop = useMemo(() => {
    if (positions.length === 0) return 0;
    const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
    return avgY;
  }, [positions]);
  const stockCard = useMemo<CardType>(() => ({
    id: 'stock-card',
    rank: 0,
    element: 'N' as Element,
    suit: ELEMENT_TO_SUIT.N,
  }), []);

  const handleDragStart = useCallback(
    (card: CardType, clientX: number, clientY: number, rect: DOMRect) => {
      onDragStart(card, HAND_SOURCE_INDEX, clientX, clientY, rect);
    },
    [onDragStart],
  );

  if (cards.length === 0 && stockCount === 0) return null;

  return (
    <div
      className="relative flex justify-center"
      style={{ height: cardHeight + 40, minWidth: cardWidth * 2 }}
    >
        <AnimatePresence>
          {cards.map((card, i) => {
            const pos = positions[i];
            if (!pos) return null;
            const isHovered = hoveredId === card.id;
            const isDragging = card.id === draggingCardId;
            const isOnCooldown = (card.cooldown ?? 0) > 0;
            const cooldownScale = isOnCooldown ? 0.67 : 1;
            const baseScale = isHovered ? FAN.hoverScale : 1;
            const finalScale = isHovered ? baseScale : baseScale * cooldownScale;

            return (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{
                  opacity: isDragging ? 0 : 1,
                  x: pos.x,
                  y: isHovered ? pos.y + FAN.hoverLiftY : pos.y,
                  rotate: isHovered ? 0 : pos.rotation,
                  scale: finalScale,
                }}
                exit={{ opacity: 0, y: -60, scale: 0.5, transition: { duration: 0.3 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                style={{
                  position: 'absolute',
                  transformOrigin: 'bottom center',
                  zIndex: isHovered ? 100 : i,
                }}
                onHoverStart={() => setHoveredId(card.id)}
                onHoverEnd={() => setHoveredId(null)}
              >
                <Card
                  card={card}
                  size={{ width: cardWidth, height: cardHeight }}
                  canPlay={!isOnCooldown}
                  isDragging={isDragging}
                  onClick={
                    interactionMode === 'click' && !isOnCooldown && onCardClick
                      ? () => onCardClick(card)
                      : undefined
                  }
                  onDragStart={!isOnCooldown ? handleDragStart : undefined}
                  showGraphics={showGraphics}
                  isDimmed={isOnCooldown}
                  orimDefinitions={orimDefinitions}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      {stockCount > 0 && (
        <div
          className="absolute"
          style={{
            left: 0,
            top: stockTop,
            transform: `translateX(${stockX}px)`,
            width: cardWidth,
            height: cardHeight,
          }}
        >
          <Card
            card={stockCard}
            size={{ width: cardWidth, height: cardHeight }}
            faceDown
            canPlay={false}
            onClick={
              interactionMode === 'click' && onStockClick
                ? onStockClick
                : undefined
            }
            showGraphics={showGraphics}
          />
          <div
            className="absolute left-1/2 top-1/2 rounded-full flex items-center justify-center font-bold"
            style={{
              width: Math.max(20, Math.round(cardWidth * 0.26)),
              height: Math.max(20, Math.round(cardWidth * 0.26)),
              fontSize: Math.max(12, Math.round(cardWidth * 0.16)),
              color: '#f4e9ff',
              backgroundColor: 'rgba(165, 110, 255, 0.9)',
              boxShadow: '0 0 12px rgba(165, 110, 255, 0.55)',
              border: '1px solid rgba(220, 190, 255, 0.85)',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            {stockCount}
          </div>
        </div>
      )}
    </div>
  );
});
