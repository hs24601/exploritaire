import { memo } from 'react';
import { createPortal } from 'react-dom';
import type { Card as CardType } from '../engine/types';
import { getRankDisplay } from '../engine/rules';
import { SUIT_COLORS, CARD_SIZE } from '../engine/constants';

interface DragPreviewProps {
  card: CardType;
  position: { x: number; y: number };
}

export const DragPreview = memo(function DragPreview({ card, position }: DragPreviewProps) {
  const suitColor = SUIT_COLORS[card.suit];

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: CARD_SIZE.width,
        height: CARD_SIZE.height,
        zIndex: 9999,
        pointerEvents: 'none',
        transform: 'rotate(5deg) scale(1.05)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0a0a0a',
          border: `2px solid ${suitColor}`,
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          fontSize: '2rem',
          fontWeight: 'bold',
          color: suitColor,
          boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${suitColor}66`,
        }}
      >
        <div style={{ textShadow: `0 0 10px ${suitColor}` }}>
          {getRankDisplay(card.rank)}
        </div>
        <div style={{ fontSize: '1.2rem' }}>{card.suit}</div>
      </div>
    </div>,
    document.body
  );
});
