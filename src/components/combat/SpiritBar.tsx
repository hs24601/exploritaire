import { useEffect, useMemo, useRef, useState } from 'react';

type SpiritBarProps = {
  spirit: number;
  maxSpirit?: number | null;
  className?: string;
  barClassName?: string;
  tone?: 'blue' | 'red';
};

const DEFAULT_MAX_SPIRIT = 5;
const SPEND_FLASH_MS = 320;

export function SpiritBar({
  spirit,
  maxSpirit,
  className = '',
  barClassName = 'h-3.5 rounded-[5px]',
  tone = 'blue',
}: SpiritBarProps) {
  const effectiveMaxSpirit = Math.max(1, Math.floor(maxSpirit ?? DEFAULT_MAX_SPIRIT));
  const clampedSpirit = Math.max(0, Math.min(effectiveMaxSpirit, Math.floor(spirit)));
  const prevSpiritRef = useRef(clampedSpirit);
  const [spendingIndices, setSpendingIndices] = useState<number[]>([]);

  useEffect(() => {
    const previousSpirit = prevSpiritRef.current;
    prevSpiritRef.current = clampedSpirit;
    if (clampedSpirit >= previousSpirit) {
      setSpendingIndices([]);
      return;
    }
    const consumed = Array.from({ length: previousSpirit - clampedSpirit }, (_, offset) => clampedSpirit + offset);
    setSpendingIndices(consumed);
    const timeout = window.setTimeout(() => setSpendingIndices([]), SPEND_FLASH_MS);
    return () => window.clearTimeout(timeout);
  }, [clampedSpirit]);

  const segments = useMemo(
    () => Array.from({ length: effectiveMaxSpirit }, (_, index) => ({
      index,
      lit: index < clampedSpirit,
      spending: spendingIndices.includes(index),
    })),
    [clampedSpirit, effectiveMaxSpirit, spendingIndices],
  );

  return (
    <div className={className}>
      <div
        className={`flex overflow-hidden border border-white/14 bg-[#10141d]/88 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] ${barClassName}`}
        aria-label={`Spirit ${clampedSpirit} of ${effectiveMaxSpirit}`}
      >
        {segments.map((segment, index) => {
          const litStyles = segment.lit
            ? {
                background: tone === 'red'
                  ? 'linear-gradient(180deg, rgba(255,166,166,0.98) 0%, rgba(214,62,92,0.96) 100%)'
                  : 'linear-gradient(180deg, rgba(142,232,255,0.98) 0%, rgba(58,146,255,0.96) 100%)',
                boxShadow: tone === 'red'
                  ? 'inset 0 0 0 1px rgba(255,225,225,0.28), 0 0 10px rgba(255,102,136,0.28)'
                  : 'inset 0 0 0 1px rgba(222,247,255,0.28), 0 0 10px rgba(108,198,255,0.26)',
              }
            : {
                background: 'linear-gradient(180deg, rgba(74,81,92,0.56) 0%, rgba(34,40,50,0.82) 100%)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
              };
          return (
            <div
              key={`spirit-segment-${index}`}
              className="h-full flex-1"
              style={{
                ...litStyles,
                borderLeft: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.72)',
                animation: segment.spending ? 'spirit-bar-spend-flash 120ms linear 2' : undefined,
                opacity: segment.spending && !segment.lit ? 0.9 : 1,
              }}
            />
          );
        })}
      </div>
      <style>{`
        @keyframes spirit-bar-spend-flash {
          0% { filter: brightness(1); opacity: 1; }
          50% { filter: brightness(2.2); opacity: 0.35; }
          100% { filter: brightness(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
