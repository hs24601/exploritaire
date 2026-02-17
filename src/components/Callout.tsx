import { AnimatePresence, motion } from 'framer-motion';
import type { CSSProperties } from 'react';

type CalloutTone = 'gold' | 'teal';

interface CalloutProps {
  visible: boolean;
  text: string;
  subtitle?: string;
  instanceKey?: string | number;
  className?: string;
  tone?: CalloutTone;
  autoFadeMs?: number;
  lines?: string[];
}

const TONE_STYLES: Record<CalloutTone, {
  text: string;
  border: string;
  bgFrom: string;
  bgTo: string;
  glow: string;
  accent: string;
}> = {
  gold: {
    text: '#fff7c8',
    border: 'rgba(247, 210, 75, 0.9)',
    bgFrom: 'rgba(36, 28, 8, 0.95)',
    bgTo: 'rgba(18, 12, 3, 0.94)',
    glow: '0 0 18px rgba(247, 210, 75, 0.55), inset 0 0 12px rgba(247, 210, 75, 0.22)',
    accent: 'rgba(247, 210, 75, 0.9)',
  },
  teal: {
    text: '#d9fff8',
    border: 'rgba(127, 219, 202, 0.92)',
    bgFrom: 'rgba(9, 26, 23, 0.95)',
    bgTo: 'rgba(5, 14, 14, 0.94)',
    glow: '0 0 18px rgba(127, 219, 202, 0.5), inset 0 0 12px rgba(127, 219, 202, 0.2)',
    accent: 'rgba(127, 219, 202, 0.9)',
  },
};

export function Callout({
  visible,
  text,
  subtitle,
  instanceKey,
  className = '',
  tone = 'gold',
  autoFadeMs,
  lines,
}: CalloutProps) {
  const palette = TONE_STYLES[tone];
  const EXTRA_DURATION_MS = 4000;
  const useAutoFade = !!autoFadeMs && autoFadeMs > 0;
  const effectiveAutoFadeMs = useAutoFade ? (autoFadeMs ?? 0) + EXTRA_DURATION_MS : 0;
  const autoFadeSeconds = Math.max(0.6, effectiveAutoFadeMs / 1000);
  const hasLines = (lines?.length ?? 0) > 0;
  const containerStyle: CSSProperties = {
    color: palette.text,
    borderColor: palette.border,
    background: `linear-gradient(180deg, ${palette.bgFrom} 0%, ${palette.bgTo} 100%)`,
    boxShadow: palette.glow,
    ...(hasLines ? { minHeight: '120px' } : {}),
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={instanceKey ?? text}
          initial={{ opacity: 0, y: 16, scale: 0.92 }}
          animate={
            useAutoFade
              ? { opacity: [0, 1, 0], y: [16, 0, -28], scale: [0.92, 1, 1.03] }
              : { opacity: 1, y: 0, scale: 1 }
          }
          exit={{ opacity: 0, y: -28, scale: 1.03 }}
          transition={{
            duration: useAutoFade ? autoFadeSeconds : (1.35 + EXTRA_DURATION_MS / 1000),
            ease: useAutoFade ? 'easeOut' : [0.22, 0.68, 0.2, 1],
            ...(useAutoFade ? { times: [0, 0.05, 0.85, 1] as const } : {}),
          }}
          className={`pointer-events-none select-none ${className}`.trim()}
        >
          <div
            className="relative overflow-hidden rounded-lg border px-4 py-3"
            style={containerStyle}
          >
            <motion.div
              className="absolute inset-0"
              aria-hidden
              initial={{ opacity: 0.25, x: '-48%' }}
              animate={{ opacity: [0.2, 0.34, 0.2], x: ['-48%', '52%', '104%'] }}
              transition={{ duration: 1.15, ease: 'linear' }}
              style={{
                background: `linear-gradient(100deg, rgba(255,255,255,0) 0%, ${palette.accent} 48%, rgba(255,255,255,0) 100%)`,
                mixBlendMode: 'screen',
              }}
            />
            <div className="relative text-[11px] font-bold tracking-[1.4px] uppercase text-center whitespace-nowrap">
              {text}
            </div>
            {subtitle && (
              <div className="relative text-[9px] tracking-[1px] uppercase text-center opacity-85 mt-0.5 whitespace-nowrap">
                {subtitle}
              </div>
            )}
            {hasLines && (
              <div className="relative mt-3 flex flex-col gap-1 text-[10px] tracking-[0.6px] uppercase text-center">
                {lines?.map((line, index) => (
                  <span key={index} className="font-semibold">
                    {line}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
