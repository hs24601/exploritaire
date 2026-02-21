import { memo, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Card as CardType, Element, InteractionMode, OrimDefinition } from '../engine/types';
import { CARD_SIZE, ELEMENT_TO_SUIT, HAND_SOURCE_INDEX } from '../engine/constants';
import { Card } from './Card';
import { useCardScale } from '../contexts/CardScaleContext';
import { Tooltip } from './Tooltip';
import { useLongPressStateMachine } from '../hooks/useLongPressStateMachine';

interface HandProps {
  cards: CardType[];
  cardScale: number;
  onDragStart: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  onCardClick?: (card: CardType) => void;
  onCardLongPress?: (card: CardType) => void;
  stockCount?: number;
  onStockClick?: () => void;
  infiniteStockEnabled?: boolean;
  onToggleInfiniteStock?: () => void;
  draggingCardId?: string | null;
  isAnyCardDragging?: boolean;
  showGraphics: boolean;
  interactionMode: InteractionMode;
  orimDefinitions?: OrimDefinition[];
  tooltipEnabled?: boolean;
  upgradedCardIds?: string[];
}

const DEG_TO_RAD = Math.PI / 180;

const FAN = {
  maxArcDegrees: 50,
  minArcDegrees: 10,
  arcRadius: 600,
  hoverLiftY: -30,
  hoverScale: 1.1,
} as const;
const INSPECT_HOLD_MS = 1000;
const DRAG_START_THRESHOLD_PX = 10;

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
  onCardLongPress,
  stockCount = 0,
  onStockClick,
  infiniteStockEnabled = false,
  onToggleInfiniteStock,
  draggingCardId,
  isAnyCardDragging = false,
  showGraphics,
  interactionMode,
  orimDefinitions,
  tooltipEnabled = false,
  upgradedCardIds = [],
}: HandProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pendingDragRef = useRef<{
    id: string;
    card: CardType;
    startX: number;
    startY: number;
    rect: DOMRect;
  } | null>(null);
  const globalScale = useCardScale();
  const effectiveScale = cardScale * globalScale;
  const cardWidth = CARD_SIZE.width * effectiveScale;
  const cardHeight = CARD_SIZE.height * effectiveScale;
  const cardSize = useMemo(() => ({ width: cardWidth, height: cardHeight }), [cardWidth, cardHeight]);
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
  const renderTooltipContent = useCallback((card: CardType) => {
    const levelMatch = card.id.match(/-lvl-(\d+)-/);
    const level = levelMatch ? Number(levelMatch[1]) : 0;
    if (card.id.startsWith('rpg-scratch-')) {
      return (
        <div className="text-xs text-game-white">
          <div className="text-game-gold font-bold mb-1 tracking-[2px]">SCRATCH</div>
          <div className="text-game-pink font-bold">Power {card.rank}</div>
          <div className="text-[10px] text-game-white/60 mt-1">
            Deal damage to target actor.{level > 0 ? ` Level ${level}.` : ''} Scales automatically while held.
          </div>
        </div>
      );
    }
    if (card.id.startsWith('rpg-peck-')) {
      return (
        <div className="text-xs text-game-white">
          <div className="text-game-teal font-bold mb-1 tracking-[2px]">PECK</div>
          <div className="text-game-pink font-bold">Power {card.rank}</div>
          <div className="text-[10px] text-game-white/60 mt-1">
            Scales automatically while held.{level > 0 ? ` Level ${level}.` : ''}
          </div>
        </div>
      );
    }
    if (card.id.startsWith('rpg-bite-')) {
      const hasViceGrip = level >= 3 || card.id.startsWith('rpg-vice-bite-');
      const hasBleed = level >= 5;
      return (
        <div className="text-xs text-game-white">
          <div className="text-game-teal font-bold mb-1 tracking-[2px]">BITE</div>
          <div className="text-game-pink font-bold">Power {card.rank}</div>
          <div className="text-[10px] text-game-white/60 mt-1">
            {hasBleed
              ? 'Vice Grip active. 20% bleed chance.'
              : (hasViceGrip ? 'Vice Grip active.' : 'Scales automatically while held.')}
          </div>
        </div>
      );
    }
    if (card.id.startsWith('rpg-vice-bite-')) {
      return (
        <div className="text-xs text-game-white">
          <div className="text-game-teal font-bold mb-1 tracking-[2px]">BITE</div>
          <div className="text-game-pink font-bold">1 damage/sec for 3s</div>
          <div className="text-[10px] text-game-white/60 mt-1">Vice Grip legacy card. Applies heavy slow.</div>
        </div>
      );
    }
    return (
      <div className="text-xs text-game-white">
        <div className="text-game-teal font-bold mb-1 tracking-[2px]">HAND CARD</div>
        <div>Value {card.rank}</div>
      </div>
    );
  }, []);

  const handleLongPressInspect = useCallback((card: CardType) => {
    onCardLongPress?.(card);
  }, [onCardLongPress]);
  const longPressInspect = useLongPressStateMachine<CardType>({
    holdMs: INSPECT_HOLD_MS,
    onLongPress: handleLongPressInspect,
  });

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
            const isUpgraded = upgradedCardIds.includes(card.id);
            let cardHash = 0;
            for (let h = 0; h < card.id.length; h += 1) {
              cardHash = ((cardHash << 5) - cardHash + card.id.charCodeAt(h)) | 0;
            }
            const flashOffsetSec = (Math.abs(cardHash) % 120) / 100;
            const isOnCooldown = (card.cooldown ?? 0) > 0;
            const cooldownScale = isOnCooldown ? 0.67 : 1;
            const baseScale = isHovered ? FAN.hoverScale : 1;
            const finalScale = isHovered ? baseScale : baseScale * cooldownScale;
            const canDrag = interactionMode === 'dnd' && !isOnCooldown;
            const inspectProgress = longPressInspect.getProgressForId(card.id);
            const isInspecting = longPressInspect.isPressingId(card.id);
            const handlePressStart = (event: React.PointerEvent) => {
              if (!onCardLongPress) return;
              if (isOnCooldown) return;
              if (canDrag) {
                pendingDragRef.current = {
                  id: card.id,
                  card,
                  startX: event.clientX,
                  startY: event.clientY,
                  rect: event.currentTarget.getBoundingClientRect(),
                };
              }
              longPressInspect.startLongPress({
                id: card.id,
                payload: card,
                event,
              });
            };
            const handlePressMove = (event: React.PointerEvent) => {
              const pendingDrag = pendingDragRef.current;
              if (canDrag && pendingDrag && pendingDrag.id === card.id) {
                const dx = event.clientX - pendingDrag.startX;
                const dy = event.clientY - pendingDrag.startY;
                if ((dx * dx) + (dy * dy) >= (DRAG_START_THRESHOLD_PX * DRAG_START_THRESHOLD_PX)) {
                  longPressInspect.handlePointerEnd();
                  pendingDragRef.current = null;
                  handleDragStart(card, event.clientX, event.clientY, pendingDrag.rect);
                  return;
                }
              }
              longPressInspect.handlePointerMove(event);
            };
            const handlePressEnd = () => {
              if (pendingDragRef.current?.id === card.id) {
                pendingDragRef.current = null;
              }
              longPressInspect.handlePointerEnd();
            };
            const handleCardClick = () => {
              if (longPressInspect.shouldSuppressClick(card.id)) {
                return;
              }
              onCardClick?.(card);
            };

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
                  touchAction: 'none',
                }}
                onHoverStart={() => setHoveredId(card.id)}
                onHoverEnd={() => setHoveredId(null)}
                onPointerDown={handlePressStart}
                onPointerMove={handlePressMove}
                onPointerUp={handlePressEnd}
                onPointerCancel={handlePressEnd}
              >
                {isUpgraded && (
                  <div
                    className="absolute inset-[-8px] rounded-xl pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, rgba(127, 219, 202, 0.5) 0%, rgba(127, 219, 202, 0.18) 45%, rgba(127, 219, 202, 0) 75%)',
                      filter: 'blur(1px)',
                      animation: 'hand-upgrade-flash 1.6s ease-in-out infinite',
                      animationDelay: `${-flashOffsetSec}s`,
                    }}
                  />
                )}
                <Tooltip
                  content={renderTooltipContent(card)}
                  pinnable
                  disabled={!tooltipEnabled}
                >
                  <Card
                    card={card}
                    size={cardSize}
                    canPlay={!isOnCooldown}
                    isDragging={isDragging}
                    isAnyCardDragging={isAnyCardDragging}
                    onClick={
                      interactionMode === 'click' && !isOnCooldown && onCardClick
                        ? handleCardClick
                        : undefined
                    }
                    onDragStart={canDrag && !onCardLongPress ? handleDragStart : undefined}
                    showGraphics={showGraphics}
                    isDimmed={isOnCooldown}
                    orimDefinitions={orimDefinitions}
                  />
                </Tooltip>
                {isInspecting && (
                  <svg
                    className="absolute -inset-1 pointer-events-none z-[100]"
                    viewBox="0 0 100 140"
                    preserveAspectRatio="none"
                  >
                    <rect
                      x="1"
                      y="1"
                      width="98"
                      height="138"
                      rx="9"
                      ry="9"
                      fill="none"
                      stroke="rgba(127, 219, 202, 0.95)"
                      strokeWidth="4"
                      strokeDasharray="472"
                      strokeDashoffset={472 * (1 - inspectProgress)}
                    />
                  </svg>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      <style>{`
        @keyframes hand-upgrade-flash {
          0% { opacity: 0.15; transform: scale(0.96); }
          50% { opacity: 0.95; transform: scale(1.04); }
          100% { opacity: 0.15; transform: scale(0.96); }
        }
      `}</style>
      {cards.length > 0 && stockCount > 0 && (
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
            size={cardSize}
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
          {onToggleInfiniteStock && (
            <button
              type="button"
              className={`absolute left-1/2 top-full mt-2 px-2 py-1 rounded text-[10px] font-bold tracking-wider border ${
                infiniteStockEnabled
                  ? 'text-game-gold border-game-gold'
                  : 'text-game-teal border-game-teal/60'
              }`}
              style={{
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(10, 10, 10, 0.75)',
                boxShadow: infiniteStockEnabled
                  ? '0 0 10px rgba(230, 179, 30, 0.5)'
                  : '0 0 8px rgba(127, 219, 202, 0.4)',
              }}
              onClick={onToggleInfiniteStock}
              title="Toggle infinite stock"
            >
              ∞
            </button>
          )}
        </div>
      )}
    </div>
  );
});
