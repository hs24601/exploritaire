import { memo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Element } from '../engine/types';
import { ELEMENT_TO_SUIT, SUIT_COLORS, getSuitDisplay, Z_INDEX } from '../engine/constants';
import { GAME_BORDER_WIDTH } from '../utils/styles';

interface ResourceStashProps {
  resourceStash: Record<Element, number>;
  collectedTokens: Record<Element, number>;
  showGraphics: boolean;
  showTokenNotice: boolean;
  tokenNoticeCount: number;
  onTokenGrab: (element: Element, clientX: number, clientY: number) => void;
  position?: 'fixed' | 'relative' | 'absolute';
  style?: CSSProperties;
  className?: string;
  interactive?: boolean;
}

const STASH_ORDER: Element[] = ['W', 'E', 'A', 'F', 'D', 'L'];

const TRAY_COLORS: Record<Element, { border: string; text: string; glow?: string }> = {
  W: { border: '#3b82f6', text: '#3b82f6' },
  E: { border: '#8b5e3c', text: '#8b5e3c' },
  A: { border: '#ffffff', text: SUIT_COLORS['💨'] },
  F: { border: '#f97316', text: '#f97316', glow: 'rgba(249, 115, 22, 0.7)' },
  D: { border: SUIT_COLORS['🌙'], text: SUIT_COLORS['🌙'] },
  L: { border: '#fbbf24', text: '#fbbf24', glow: 'rgba(251, 191, 36, 0.75)' },
  N: { border: SUIT_COLORS['⭐'], text: SUIT_COLORS['⭐'] },
};

export const ResourceStash = memo(function ResourceStash({
  resourceStash,
  collectedTokens,
  showGraphics,
  showTokenNotice,
  tokenNoticeCount,
  onTokenGrab,
  position = 'fixed',
  style,
  className,
  interactive = true,
}: ResourceStashProps) {
  const tokenTextColor = '#0a0a0a';
  const positionClass = position === 'fixed' ? 'fixed' : position === 'absolute' ? 'absolute' : 'relative';
  const baseStyle: CSSProperties = position === 'fixed'
    ? {
        left: '50%',
        bottom: 'calc(var(--cli-offset, 32px) + 96px)',
        transform: 'translateX(-50%)',
        zIndex: Z_INDEX.FLYOUT,
      }
    : { zIndex: Z_INDEX.FLYOUT };
  const mergedStyle: CSSProperties = { ...baseStyle, ...style };
  return (
    <div
      data-token-stash
      className={`${positionClass} bg-game-bg-dark/90 border border-game-teal/30 px-3 py-1 rounded flex gap-3 items-center relative w-max select-none${showTokenNotice ? ' token-pop-shake' : ''}${className ? ` ${className}` : ''}`}
      style={mergedStyle}
    >
      <span className="text-[9px] text-game-teal opacity-70 tracking-widest">RES</span>
      {STASH_ORDER.map((element) => {
        const suit = ELEMENT_TO_SUIT[element];
        const trayColor = TRAY_COLORS[element] || { border: SUIT_COLORS[suit], text: SUIT_COLORS[suit] };
        const display = getSuitDisplay(suit, showGraphics);
        const count = (resourceStash[element] || 0) + (collectedTokens[element] || 0);
        return (
          <div key={element} className="flex items-center gap-1">
            <div
              className="rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{
                width: 26,
                height: 26,
                borderWidth: GAME_BORDER_WIDTH,
                borderStyle: 'solid',
                borderColor: trayColor.border,
                color: trayColor.text,
                cursor: interactive && count > 0 ? 'grab' : 'default',
                boxShadow: `0 0 0 1px #ffffff, inset 0 0 0 1px #ffffff${trayColor.glow ? `, 0 0 8px ${trayColor.glow}` : ''}`,
              }}
              onMouseDown={(e) => {
                if (!interactive || e.button !== 0 || count <= 0) return;
                onTokenGrab(element, e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                if (!interactive || e.touches.length !== 1 || count <= 0) return;
                const touch = e.touches[0];
                onTokenGrab(element, touch.clientX, touch.clientY);
              }}
              title={`Withdraw ${display}`}
            >
              <span
                data-token-face
                style={{
                  color: tokenTextColor,
                  WebkitTextStroke: '0.3px #ffffff',
                  textShadow: '0 0 1px rgba(255, 255, 255, 0.5)',
                }}
              >
                {display}
              </span>
            </div>
            <span className="text-[13px] text-game-white/80">{count}</span>
          </div>
        );
      })}
      {showTokenNotice && (
        <motion.div
          key={`token-return-${tokenNoticeCount}`}
          initial={{ opacity: 0, scale: 0.4, rotate: -12, x: -6 }}
          animate={{ opacity: [0, 1, 1, 0], scale: 1.2, rotate: 8, x: 6 }}
          exit={{ opacity: 0, scale: 1.5, rotate: 0, x: 18 }}
          transition={{
            opacity: { duration: 4, times: [0, 0.1, 0.85, 1] },
            duration: 0.55,
            ease: 'backOut',
          }}
          className="absolute left-full ml-4 top-1/2 -translate-y-1/2"
        >
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.6, rotate: -18, y: -10 }}
              animate={{ opacity: 0.9, scale: 1.1, rotate: -8, y: -22 }}
              exit={{ opacity: 0, scale: 1.4, y: -30 }}
              transition={{ duration: 0.4, ease: 'backOut' }}
              className="absolute -left-10 -top-6 text-xs font-bold tracking-[3px]"
              style={{ color: '#f97316', textShadow: '0 0 12px rgba(249, 115, 22, 0.9)' }}
            >
              POW!
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: 12, y: 8 }}
              animate={{ opacity: 0.85, scale: 1, rotate: 6, y: 18 }}
              exit={{ opacity: 0, scale: 1.3, y: 24 }}
              transition={{ duration: 0.45, ease: 'backOut' }}
              className="absolute -right-12 -bottom-6 text-xs font-bold tracking-[3px]"
              style={{ color: '#38bdf8', textShadow: '0 0 12px rgba(56, 189, 248, 0.9)' }}
            >
              BAM!
            </motion.div>
            <div
              className="absolute -inset-3 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(251, 191, 36, 0.35) 0%, rgba(251, 191, 36, 0) 70%)',
                boxShadow: '0 0 40px rgba(251, 191, 36, 0.65)',
              }}
            />
            <div
              className="absolute -inset-2 rotate-6"
              style={{
                background:
                  'repeating-conic-gradient(from 0deg, rgba(251,191,36,0.18) 0deg 12deg, rgba(10,10,10,0) 12deg 24deg)',
                maskImage: 'radial-gradient(circle, black 55%, transparent 70%)',
              }}
            />
            <div
              className="relative px-4 py-2 rounded text-sm font-bold tracking-[3px]"
              style={{
                borderWidth: GAME_BORDER_WIDTH,
                borderStyle: 'solid',
                color: '#fbbf24',
                borderColor: '#fbbf24',
                background: 'linear-gradient(135deg, rgba(10,10,10,0.95) 0%, rgba(30,20,5,0.95) 100%)',
                boxShadow: '0 0 24px rgba(251, 191, 36, 0.9)',
                textShadow: '0 0 10px rgba(251, 191, 36, 0.9)',
              }}
            >
              +{tokenNoticeCount} TOKENS
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
});
