import { memo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType } from '../engine/types';
import { getRankDisplay } from '../engine/rules';
import { SUIT_COLORS, CARD_SIZE } from '../engine/constants';

interface CardProps {
  card: CardType | null;
  faceDown?: boolean;
  isFoundation?: boolean;
  canPlay?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  isGuidanceTarget?: boolean;
  isDimmed?: boolean;
  isDragging?: boolean;
  onDragStart?: (card: CardType, clientX: number, clientY: number, rect: DOMRect) => void;
}

export const Card = memo(function Card({
  card,
  faceDown = false,
  isFoundation = false,
  canPlay = false,
  onClick,
  isSelected = false,
  isGuidanceTarget = false,
  isDimmed = false,
  isDragging = false,
  onDragStart,
}: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onDragStart || !card || faceDown) return;
    if (!cardRef.current) return;
    e.preventDefault();
    const rect = cardRef.current.getBoundingClientRect();
    onDragStart(card, e.clientX, e.clientY, rect);
  }, [onDragStart, card, faceDown]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onDragStart || !card || faceDown) return;
    if (!cardRef.current) return;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    onDragStart(card, touch.clientX, touch.clientY, rect);
  }, [onDragStart, card, faceDown]);
  const suitColor = card ? SUIT_COLORS[card.suit] : '#f0f0f0';

  const getBorderColor = () => {
    if (isSelected) return '#e6b31e'; // gold
    if (faceDown) return 'rgba(139, 92, 246, 0.3)'; // purple faded
    return isDimmed ? `${suitColor}44` : suitColor;
  };

  const getBoxShadow = () => {
    if (isDimmed) return 'none';
    if (isSelected) return `0 0 20px #e6b31e, inset 0 0 20px rgba(230, 179, 30, 0.13)`;
    if (isFoundation) return `0 0 15px ${suitColor}66, inset 0 0 15px ${suitColor}11`;
    return `0 0 10px ${suitColor}33`;
  };

  return (
    <motion.div
      ref={cardRef}
      onClick={onClick}
      onMouseDown={onDragStart ? handleMouseDown : undefined}
      onTouchStart={onDragStart ? handleTouchStart : undefined}
      whileHover={!faceDown && !onDragStart && (canPlay || onClick) ? { scale: 1.05, y: -5 } : {}}
      whileTap={!faceDown && !onDragStart && onClick ? { scale: 0.98 } : {}}
      style={{
        width: CARD_SIZE.width,
        height: CARD_SIZE.height,
        borderColor: getBorderColor(),
        boxShadow: getBoxShadow(),
        color: faceDown ? 'transparent' : (isDimmed ? `${suitColor}44` : suitColor),
        visibility: isDragging ? 'hidden' : 'visible',
      }}
      className={`
        bg-game-bg-dark border-2 rounded-lg
        flex flex-col items-center justify-center gap-1
        text-3xl font-bold select-none relative
        transition-all duration-200
        ${onClick && !faceDown ? 'cursor-pointer' : ''}
        ${onDragStart && !faceDown ? 'cursor-grab' : ''}
        ${!onClick && !onDragStart ? 'cursor-default' : ''}
        ${isDimmed ? 'opacity-50' : 'opacity-100'}
      `}
    >
      {!faceDown && card && (
        <>
          <div style={{ textShadow: isDimmed ? 'none' : `0 0 10px ${suitColor}` }}>
            {getRankDisplay(card.rank)}
          </div>
          <div className="text-xl">{card.suit}</div>
        </>
      )}

      {faceDown && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-10 h-10 border-2 border-game-purple rounded-full"
            style={{ boxShadow: '0 0 10px rgba(139, 92, 246, 0.4)' }}
          />
        </div>
      )}

      {/* Playable indicator */}
      {canPlay && !faceDown && !isGuidanceTarget && !isDimmed && (
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -inset-1 border-2 border-game-gold rounded-[10px] pointer-events-none"
          style={{ boxShadow: '0 0 15px #e6b31e' }}
        />
      )}

      {/* Guidance target indicator */}
      {isGuidanceTarget && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.02, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -inset-1 border-[3px] border-game-teal rounded-[10px] pointer-events-none"
          style={{ boxShadow: '0 0 15px #7fdbca' }}
        />
      )}
    </motion.div>
  );
});
