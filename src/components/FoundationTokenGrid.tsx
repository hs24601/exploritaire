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
          className="text-[12px] tracking-wider font-bold"
          style={{ color: '#e6b31e' }}
        >
          COMBO {comboCount}
        </div>
      )}
      {collected.length > 0 && null}
    </div>
  );
});
