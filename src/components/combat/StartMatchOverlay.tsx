import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CombatOverlayBaseProps } from './CombatOverlayFrame';
import { CombatOverlayFrame } from './CombatOverlayFrame';

export type StartOverlayPhase = 'ready' | 'countdown' | 'go' | 'done';

interface StartMatchOverlayProps extends Omit<CombatOverlayBaseProps, 'visible' | 'children' | 'interactive'> {
  phase: StartOverlayPhase;
  countdown: number;
  onPlay: () => void;
  onSkip: () => void;
}

export const StartMatchOverlay = memo(function StartMatchOverlay({
  phase,
  countdown,
  onPlay,
  onSkip,
  zIndex,
}: StartMatchOverlayProps) {
  return (
    <CombatOverlayFrame
      visible={phase !== 'done'}
      interactive
      dimOpacity={0.56}
      blurPx={2}
      zIndex={zIndex}
    >
      {phase === 'ready' && (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onPlay}
            className="px-8 py-4 rounded border text-[20px] tracking-[6px] font-bold"
            style={{
              color: '#f7d24b',
              borderColor: 'rgba(255, 229, 120, 0.95)',
              backgroundColor: 'rgba(10, 8, 6, 0.92)',
              boxShadow: '0 0 24px rgba(230, 179, 30, 0.6)',
              textShadow: '0 0 10px rgba(230, 179, 30, 0.7)',
            }}
          >
            PLAY
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-1 rounded border text-[12px] tracking-[3px] font-bold"
            style={{
              color: 'rgba(247, 210, 75, 0.85)',
              borderColor: 'rgba(255, 229, 120, 0.5)',
              backgroundColor: 'rgba(10, 8, 6, 0.65)',
            }}
          >
            SKIP
          </button>
        </div>
      )}

      {phase === 'countdown' && (
        <div
          className="flex items-center justify-center rounded-full border-2"
          style={{
            width: 132,
            height: 132,
            borderColor: 'rgba(255, 229, 120, 0.95)',
            backgroundColor: 'rgba(10, 8, 6, 0.84)',
            boxShadow: '0 0 24px rgba(230, 179, 30, 0.55)',
          }}
        >
          <span
            className="font-bold"
            style={{
              color: '#f7d24b',
              fontSize: '58px',
              textShadow: '0 0 14px rgba(230, 179, 30, 0.7)',
              lineHeight: 1,
            }}
          >
            {countdown}
          </span>
        </div>
      )}

      <AnimatePresence>
        {phase === 'go' && (
          <>
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle, rgba(255,245,210,0.95) 0%, rgba(255,220,120,0.55) 22%, rgba(255,220,120,0) 70%)',
              }}
              initial={{ opacity: 0.95 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 14 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.12, 1.08, 1], y: [14, 0, 0, -10] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
              className="font-bold tracking-[8px]"
              style={{
                color: '#f7d24b',
                fontSize: '72px',
                textShadow: '0 0 20px rgba(230, 179, 30, 0.85)',
              }}
            >
              GO!
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </CombatOverlayFrame>
  );
});
