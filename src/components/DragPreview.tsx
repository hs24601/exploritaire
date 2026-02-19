import { memo } from 'react';
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
  size?: { width: number; height: number };
  showText: boolean;
}

export const DragPreview = memo(function DragPreview({ card, position, offset, size, showText }: DragPreviewProps) {
  const showGraphics = useGraphics();
  const globalScale = useCardScale();
  const defaultWidth = CARD_SIZE.width * globalScale;
  const defaultHeight = CARD_SIZE.height * globalScale;
  const isKeruRewardCard = card.id.startsWith('keru-archetype-');
  const rawWidth = size?.width ?? defaultWidth;
  const rawHeight = size?.height ?? defaultHeight;
  const cardWidth = isKeruRewardCard ? defaultWidth : Math.min(rawWidth, defaultWidth);
  const cardHeight = isKeruRewardCard ? defaultHeight : Math.min(rawHeight, defaultHeight);
  const scaleX = rawWidth > 0 ? cardWidth / rawWidth : 1;
  const scaleY = rawHeight > 0 ? cardHeight / rawHeight : 1;
  const adjustedOffset = isKeruRewardCard
    ? { x: offset.x * scaleX, y: offset.y * scaleY }
    : offset;
  const adjustedPosition = isKeruRewardCard
    ? {
        x: position.x + offset.x - adjustedOffset.x,
        y: position.y + offset.y - adjustedOffset.y,
      }
    : position;
  const suitColor = SUIT_COLORS[card.suit];
  const suitDisplay = getSuitDisplay(card.suit, showGraphics);
  const hasOrimSlots = !!card.orimSlots?.length;
  const orimSlots = card.orimSlots ?? [];
  const orimSlotSize = Math.max(6, Math.round(cardWidth * 0.16));
  const grabTilt = ((adjustedOffset.x - cardWidth / 2) / cardWidth) * -10;
  const rotation = Math.max(-10, Math.min(10, grabTilt));
  const frameClassName = isKeruRewardCard
    ? 'flex flex-col items-start justify-start p-2 gap-1 text-2xl font-bold'
    : 'flex flex-col items-center justify-center gap-1 text-2xl font-bold';
  const keruMeta = (() => {
    if (card.id === 'keru-archetype-lupus') {
      return { title: 'LUPUS', subtitle: 'Ranger Archetype', accent: '#f7d24b' };
    }
    if (card.id === 'keru-archetype-ursus') {
      return { title: 'URSUS', subtitle: 'Tank Archetype', accent: '#ffb075' };
    }
    if (card.id === 'keru-archetype-felis') {
      return { title: 'FELIS', subtitle: 'Rogue Archetype', accent: '#9de3ff' };
    }
    return null;
  })();

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        width: cardWidth,
        height: cardHeight,
        zIndex: 9999,
        pointerEvents: 'none',
        transform: `rotate(${rotation}deg)`,
        transformOrigin: `${adjustedOffset.x}px ${adjustedOffset.y}px`,
      }}
      className={showText ? '' : 'textless-mode'}
    >
      <CardFrame
        size={{ width: cardWidth, height: cardHeight }}
        borderColor={suitColor}
        boxShadow={`0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${suitColor}66`}
        className={frameClassName}
        style={{
          color: suitColor,
        }}
      >
        {isKeruRewardCard && keruMeta ? (
          <div className="absolute top-2 left-2 right-2 flex flex-col items-start justify-start gap-1">
            <div
              style={{
                fontSize: Math.max(8, Math.round(cardWidth * 0.09)),
                letterSpacing: '0.12em',
                color: '#7fdbca',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {keruMeta.subtitle}
            </div>
            <div
              style={{
                fontSize: Math.max(12, Math.round(cardWidth * 0.18)),
                letterSpacing: '0.1em',
                color: '#f8f8f8',
                fontWeight: 700,
                lineHeight: 1.05,
              }}
            >
              {keruMeta.title}
            </div>


          </div>
        ) : (
          <div style={{ textShadow: `0 0 10px ${suitColor}` }}>
            {getRankDisplay(card.rank)}
          </div>
        )}
        {!isKeruRewardCard && hasOrimSlots ? (
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
        ) : !isKeruRewardCard ? (
          <div style={{ fontSize: '1.2rem' }}>{suitDisplay}</div>
        ) : null}
      </CardFrame>
    </div>,
    document.body
  );
});







