import { memo } from 'react';
import type { CardSlot as CardSlotType } from '../engine/types';
import { SUIT_COLORS } from '../engine/constants';

interface CardSlotProps {
  slot: CardSlotType;
  metaCardId: string;
  isDropTarget: boolean;
  size?: 'sm' | 'md';
}

export const CardSlot = memo(function CardSlot({
  slot,
  metaCardId,
  isDropTarget,
  size = 'sm',
}: CardSlotProps) {
  const isFilled = slot.card !== null;
  const suitColor = slot.requirement.suit
    ? SUIT_COLORS[slot.requirement.suit]
    : '#7fdbca';

  const dimensions = size === 'sm'
    ? { width: 48, height: 64 }
    : { width: 80, height: 112 };

  return (
    <div
      data-meta-card-slot
      data-meta-card-id={metaCardId}
      data-slot-id={slot.id}
      data-slot-suit={slot.requirement.suit || ''}
      className="rounded-md border-2 flex flex-col items-center justify-center transition-all"
      style={{
        width: dimensions.width,
        height: dimensions.height,
        borderColor: isFilled ? suitColor : `${suitColor}66`,
        borderStyle: isFilled ? 'solid' : 'dashed',
        backgroundColor: isFilled ? `${suitColor}22` : 'transparent',
        boxShadow: isDropTarget
          ? `0 0 20px ${suitColor}, inset 0 0 10px ${suitColor}33`
          : isFilled
            ? `0 0 8px ${suitColor}44`
            : 'none',
        transform: isDropTarget ? 'scale(1.1)' : 'scale(1)',
      }}
    >
      {isFilled && slot.card ? (
        // Show filled card
        <>
          <span className="text-lg">{slot.card.suit}</span>
          <span
            className="text-xs font-bold"
            style={{ color: SUIT_COLORS[slot.card.suit] }}
          >
            {slot.card.rank === 1 ? 'A' : slot.card.rank === 11 ? 'J' : slot.card.rank === 12 ? 'Q' : slot.card.rank === 13 ? 'K' : slot.card.rank}
          </span>
        </>
      ) : (
        // Show empty slot with requirement hint
        <span
          className="text-2xl"
          style={{
            opacity: 0.4,
            filter: 'grayscale(50%)',
          }}
        >
          {slot.requirement.suit || '?'}
        </span>
      )}
    </div>
  );
});
