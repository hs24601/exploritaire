import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGraphics } from '../contexts/GraphicsContext';
import type { Card as CardType } from '../engine/types';
import { getRankDisplay } from '../engine/rules';
import { SUIT_COLORS, CARD_SIZE, getSuitDisplay, ELEMENT_TO_SUIT } from '../engine/constants';
import { useCardScale } from '../contexts/CardScaleContext';
import { CardFrame } from './card/CardFrame';

interface DragPreviewProps {
  card: CardType;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  showText: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const DragPreview = memo(function DragPreview({ card, position, offset, showText }: DragPreviewProps) {
  const showGraphics = useGraphics();
  const globalScale = useCardScale();
  const cardWidth = CARD_SIZE.width * globalScale;
  const cardHeight = CARD_SIZE.height * globalScale;
  const suitColor = SUIT_COLORS[card.suit];
  const suitDisplay = getSuitDisplay(card.suit, showGraphics);
  const hasOrimSlots = !!card.orimSlots?.length;
  const orimSlots = card.orimSlots ?? [];
  const orimSlotSize = Math.max(6, Math.round(cardWidth * 0.16));
  const [rotation, setRotation] = useState(0);
  const lastRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const now = performance.now();
    const pointerX = position.x + offset.x;
    const pointerY = position.y + offset.y;
    const grabTilt = ((offset.x - cardWidth / 2) / cardWidth) * -10;
    const last = lastRef.current;
    if (last) {
      const dt = Math.max(16, now - last.t);
      const vx = (pointerX - last.x) / dt;
      const vy = (pointerY - last.y) / dt;
      const momentumTilt = clamp(vx * 120, -6, 6) + clamp(vy * -40, -3, 3);
      const target = clamp(grabTilt + momentumTilt, -10, 10);
      setRotation((prev) => prev + (target - prev) * 0.35);
    } else {
      setRotation(grabTilt);
    }
    lastRef.current = { x: pointerX, y: pointerY, t: now };
  }, [position.x, position.y, offset.x, offset.y]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: cardWidth,
        height: cardHeight,
        zIndex: 9999,
        pointerEvents: 'none',
        transform: `rotate(${rotation}deg)`,
        transformOrigin: `${offset.x}px ${offset.y}px`,
      }}
      className={showText ? '' : 'textless-mode'}
    >
      <CardFrame
        size={{ width: cardWidth, height: cardHeight }}
        borderColor={suitColor}
        boxShadow={`0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${suitColor}66`}
        className="flex flex-col items-center justify-center gap-1 text-2xl font-bold"
        style={{
          color: suitColor,
        }}
      >
        <div style={{ textShadow: `0 0 10px ${suitColor}` }}>
          {getRankDisplay(card.rank)}
        </div>
        {hasOrimSlots ? (
          <div className="flex items-center justify-center gap-1">
            {orimSlots.map((slot, index) => {
              const element = index === 0
                ? (card.tokenReward ?? (card.element !== 'N' ? card.element : undefined))
                : undefined;
              const suit = element ? ELEMENT_TO_SUIT[element] : null;
              const slotColor = suit ? SUIT_COLORS[suit] : '#7fdbca';
              const slotDisplay = suit ? getSuitDisplay(suit, showGraphics) : (showGraphics ? '◌' : '-');
              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: orimSlotSize,
                    height: orimSlotSize,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: slotColor,
                    color: slotColor,
                    fontSize: Math.max(6, Math.round(orimSlotSize * 0.7)),
                    opacity: suit ? 1 : 0.5,
                  }}
                >
                  {slotDisplay}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '1.2rem' }}>{suitDisplay}</div>
        )}
      </CardFrame>
    </div>,
    document.body
  );
});
