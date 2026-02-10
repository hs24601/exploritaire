import { memo } from 'react';
import type { Element } from '../engine/types';
import { ELEMENT_TO_SUIT, SUIT_COLORS } from '../engine/constants';

interface FoundationTokenGridProps {
  tokens: Record<Element, number>;
  comboCount: number;
}

const ALL_ELEMENTS: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

export const FoundationTokenGrid = memo(function FoundationTokenGrid({
  tokens,
  comboCount,
}: FoundationTokenGridProps) {
  const collected = ALL_ELEMENTS.filter(e => (tokens[e] || 0) > 0);

  return (
    <div className="flex flex-col items-center gap-1 mt-1">
      {comboCount > 0 && (
        <div
          className="text-[12px] tracking-[3px] font-bold px-2 py-1 rounded border"
          style={{
            color: '#0a0a0a',
            backgroundColor: 'rgba(230, 179, 30, 0.95)',
            borderColor: 'rgba(255, 229, 120, 0.9)',
            boxShadow: '0 0 12px rgba(230, 179, 30, 0.65)',
          }}
        >
          COMBO {comboCount}
        </div>
      )}
      {collected.length > 0 && null}
    </div>
  );
});
