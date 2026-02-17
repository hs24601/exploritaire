import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

export interface NarrativeOverlayProps {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export function NarrativeOverlay({ open, onClose, children }: NarrativeOverlayProps) {
  const defaultContent = (
    <div className="space-y-4 text-center">
      <p className="text-3xl md:text-4xl font-bold uppercase tracking-[0.35em]">Awaken your</p>
      <div className="relative inline-flex">
        <motion.span
          className="text-5xl md:text-6xl font-black uppercase tracking-[0.5em]"
          animate={{
            scale: [1, 1.09, 1],
            textShadow: [
              '0 0 0 rgba(255,255,255,0)',
              '0 0 30px rgba(126, 255, 199, 0.8)',
              '0 0 0 rgba(255,255,255,0)',
            ],
          }}
          transition={{ duration: 1.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
        >
          aspect
        </motion.span>
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-full border border-game-teal/30"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1.1 }}
          transition={{ duration: 1.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
        />
      </div>
      <p className="text-sm md:text-base text-game-white/80 max-w-xl mx-auto">
        The map dims, the tableau listens, and a shimmering word calls you back to the forge of Keru.
      </p>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10100] flex items-center justify-center pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-3xl bg-gradient-to-br from-game-bg-dark/90 via-game-bg-dark/80 to-game-bg-dark border border-game-teal/60 rounded-3xl p-10 md:p-12 shadow-[0_0_60px_rgba(127,219,202,0.55)] text-game-white"
            initial={{ scale: 0.94 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full border border-game-purple text-game-white text-xl"
              aria-label="Close narrative"
            >
              ×
            </button>
            <div className="pointer-events-auto">
              {children ?? defaultContent}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
