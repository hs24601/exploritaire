import { useEffect, useMemo, useRef, useState } from 'react';

type AbilityApBarProps = {
  ap: number;
  maxAp?: number | null;
  className?: string;
  barClassName?: string;
};

const DEFAULT_MAX_AP = 2;
const SPEND_FLASH_MS = 320;

export function AbilityApBar({
  ap,
  maxAp,
  className = '',
  barClassName = 'h-3.5 rounded-[5px]',
}: AbilityApBarProps) {
  const effectiveMaxAp = Math.max(1, Math.floor(maxAp ?? DEFAULT_MAX_AP));
  const clampedAp = Math.max(0, Math.min(effectiveMaxAp, Math.floor(ap)));
  const prevApRef = useRef(clampedAp);
  const [spendingIndices, setSpendingIndices] = useState<number[]>([]);

  useEffect(() => {
    const previousAp = prevApRef.current;
    prevApRef.current = clampedAp;
    if (clampedAp >= previousAp) {
      setSpendingIndices([]);
      return;
    }
    const consumed = Array.from({ length: previousAp - clampedAp }, (_, offset) => clampedAp + offset);
    setSpendingIndices(consumed);
    const timeout = window.setTimeout(() => setSpendingIndices([]), SPEND_FLASH_MS);
    return () => window.clearTimeout(timeout);
  }, [clampedAp]);

  const segments = useMemo(
    () => Array.from({ length: effectiveMaxAp }, (_, index) => ({
      index,
      lit: index < clampedAp,
      spending: spendingIndices.includes(index),
    })),
    [clampedAp, effectiveMaxAp, spendingIndices]
  );

  return (
    <div className={className}>
      <div
        className={`flex overflow-hidden border border-white/14 bg-[#10141d]/88 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] ${barClassName}`}
        data-ap-meter="shared"
        aria-label={`AP ${clampedAp} of ${effectiveMaxAp}`}
      >
        {segments.map((segment, index) => {
          const litStyles = segment.lit
            ? {
                background: 'linear-gradient(180deg, rgba(122,214,255,0.98) 0%, rgba(42,128,214,0.96) 100%)',
                boxShadow: 'inset 0 0 0 1px rgba(211,244,255,0.3), 0 0 10px rgba(90,196,255,0.25)',
              }
            : {
                background: 'linear-gradient(180deg, rgba(74,81,92,0.56) 0%, rgba(34,40,50,0.82) 100%)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
              };
          return (
            <div
              key={`ap-segment-${index}`}
              data-ap-meter-segment={index + 1}
              className="h-full flex-1"
              style={{
                ...litStyles,
                borderLeft: index === 0 ? 'none' : '1px solid rgba(7,10,16,0.95)',
                animation: segment.spending ? 'ap-bar-spend-flash 120ms linear 2' : undefined,
                opacity: segment.spending && !segment.lit ? 0.9 : 1,
              }}
            />
          );
        })}
      </div>
      <style>{`
        @keyframes ap-bar-spend-flash {
          0% { filter: brightness(1); opacity: 1; }
          50% { filter: brightness(2.2); opacity: 0.35; }
          100% { filter: brightness(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
