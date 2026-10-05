import { AnimatePresence, motion } from 'framer-motion';
import type { CSSProperties } from 'react';

type CalloutTone = 'gold' | 'teal' | 'orange' | 'dialogue';

type SecondaryCallout = {
  text: string;
  subtitle?: string;
  tone?: CalloutTone;
  compact?: boolean;
  lines?: string[];
};

type CalloutVariant = 'panel' | 'dialog-bubble';
type CalloutEmojiEmotionType = 'happy';

interface CalloutProps {
  visible: boolean;
  text: string;
  subtitle?: string;
  instanceKey?: string | number;
  className?: string;
  tone?: CalloutTone;
  autoFadeMs?: number;
  lines?: string[];
  compact?: boolean;
  secondaryCallouts?: SecondaryCallout[];
  style?: CSSProperties;
  anchor?: { x: number; y: number };
  variant?: CalloutVariant;
  panelStyle?: CSSProperties;
  emojiEmotionType?: CalloutEmojiEmotionType;
  bubbleOffset?: { x: number; y: number };
  emojiOffset?: { x: number; y: number };
  tailOffsetX?: number;
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
  orange: {
    text: '#ffe7d3',
    border: 'rgba(255, 140, 26, 0.92)',
    bgFrom: 'rgba(28, 14, 6, 0.95)',
    bgTo: 'rgba(12, 9, 6, 0.94)',
    glow: '0 0 18px rgba(255, 140, 26, 0.5), inset 0 0 12px rgba(255, 140, 26, 0.2)',
    accent: 'rgba(255, 140, 26, 0.9)',
  },
  dialogue: {
    text: '#eefaff',
    border: 'rgba(152, 234, 255, 0.9)',
    bgFrom: 'rgba(8, 16, 26, 0.95)',
    bgTo: 'rgba(4, 8, 14, 0.94)',
    glow: '0 0 18px rgba(72, 190, 232, 0.42), inset 0 0 12px rgba(152, 234, 255, 0.14)',
    accent: 'rgba(152, 234, 255, 0.86)',
  },
};

const DIALOG_EMOJI_ASSETS: Record<CalloutEmojiEmotionType, string> = {
  happy: '/assets/actors/mochikin/mochi_emoji_blush.png',
};

function renderPanel({
  text = 'CALL OUT',
  subtitle,
  lines,
  palette,
  compact,
  style,
}: {
  text?: string;
  subtitle?: string;
  lines?: string[];
  palette: (typeof TONE_STYLES)[CalloutTone];
  compact?: boolean;
  style?: CSSProperties;
}) {
  const hasLines = (lines?.length ?? 0) > 0;
  const panelStyle: CSSProperties = {
    color: palette.text,
    borderColor: palette.border,
    background: `linear-gradient(180deg, ${palette.bgFrom} 0%, ${palette.bgTo} 100%)`,
    boxShadow: palette.glow,
    ...(hasLines ? { minHeight: '120px' } : {}),
    ...style,
  };

  return (
    <div
      className={`relative overflow-hidden border ${compact ? 'rounded-[12px] px-3 py-1.5' : 'rounded-[12px] px-4 py-3'}`}
      style={panelStyle}
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
      <div className={`relative font-bold uppercase text-center whitespace-nowrap ${compact ? 'text-[9px] tracking-[1px]' : 'text-[11px] tracking-[1.4px]'}`}>
        {text}
      </div>
      {subtitle && (
        <div className={`relative uppercase text-center opacity-85 whitespace-nowrap ${compact ? 'text-[8px] tracking-[0.8px] mt-0.5' : 'text-[9px] tracking-[1px] mt-0.5'}`}>
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
  );
}

function renderDialogBubble({
  text = 'CALL OUT',
  subtitle,
  lines,
  palette,
  compact,
  style,
  emojiEmotionType,
  bubbleOffset,
  emojiOffset,
  tailOffsetX,
}: {
  text?: string;
  subtitle?: string;
  lines?: string[];
  palette: (typeof TONE_STYLES)[CalloutTone];
  compact?: boolean;
  style?: CSSProperties;
  emojiEmotionType?: CalloutEmojiEmotionType;
  bubbleOffset?: { x: number; y: number };
  emojiOffset?: { x: number; y: number };
  tailOffsetX?: number;
}) {
  const hasLines = (lines?.length ?? 0) > 0;
  const emojiSrc = emojiEmotionType ? DIALOG_EMOJI_ASSETS[emojiEmotionType] : null;
  const bubbleStyle: CSSProperties = {
    color: palette.text,
    background: `linear-gradient(180deg, ${palette.bgFrom} 0%, ${palette.bgTo} 100%)`,
    border: `2px solid ${palette.border}`,
    borderRadius: compact ? '22px' : '26px',
    boxShadow: `0 12px 24px rgba(0,0,0,0.34), 0 0 18px rgba(72, 190, 232, 0.18)`,
    transform: 'rotate(-1.5deg)',
    ...(hasLines ? { minHeight: '120px' } : {}),
    ...style,
  };
  const resolvedBubbleOffset = bubbleOffset ?? { x: -18, y: -76 };
  const resolvedEmojiOffset = emojiOffset ?? { x: 0, y: 0 };
  const resolvedTailOffsetX = tailOffsetX ?? 0;

  return (
    <div className="relative h-0 w-0 overflow-visible">
      <div
        className={`relative overflow-visible ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
        style={{
          ...bubbleStyle,
          position: 'absolute',
          left: resolvedBubbleOffset.x,
          top: resolvedBubbleOffset.y,
          zIndex: 20,
        }}
      >
        <div
          aria-hidden
          className="absolute -bottom-[13px] h-[26px] w-[26px] -translate-x-1/2 rotate-45"
          style={{
            left: `calc(50% + ${resolvedTailOffsetX}px)`,
            background: `linear-gradient(180deg, ${palette.bgFrom} 0%, ${palette.bgTo} 100%)`,
            borderRight: `2px solid ${palette.border}`,
            borderBottom: `2px solid ${palette.border}`,
            borderRadius: '0 0 8px 0',
            boxShadow: '6px 8px 14px rgba(0,0,0,0.18)',
          }}
        />
        <div
          aria-hidden
          className="absolute -right-1 top-1 h-[12px] w-[18px] rounded-full border-r-2 border-t-2"
          style={{ borderColor: palette.border, opacity: 0.42, transform: 'rotate(14deg)' }}
        />
        <div
          aria-hidden
          className="absolute -left-1 top-2 h-[10px] w-[16px] rounded-full border-l-2 border-t-2"
          style={{ borderColor: palette.border, opacity: 0.34, transform: 'rotate(-16deg)' }}
        />
        <div
          aria-hidden
          className="absolute inset-[3px] rounded-[20px]"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
            opacity: 0.9,
          }}
        />
        <div style={{ transform: 'rotate(1.5deg)' }}>
          <div className={`relative font-bold uppercase text-center whitespace-nowrap ${compact ? 'text-[9px] tracking-[1px]' : 'text-[11px] tracking-[1.4px]'}`}>
            {text}
          </div>
          {subtitle && (
            <div className={`relative uppercase text-center opacity-85 whitespace-nowrap ${compact ? 'text-[8px] tracking-[0.8px] mt-0.5' : 'text-[9px] tracking-[1px] mt-0.5'}`}>
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
      </div>
      {emojiSrc ? (
        <motion.img
          src={emojiSrc}
          alt=""
          aria-hidden
          className="pointer-events-none absolute z-10 w-[86px] -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0, scale: 0.78, x: resolvedEmojiOffset.x, y: resolvedEmojiOffset.y - 10, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, x: resolvedEmojiOffset.x, y: resolvedEmojiOffset.y, rotate: 0 }}
          transition={{ duration: 0.34, ease: [0.22, 0.68, 0.2, 1] }}
          style={{
            left: 0,
            top: 0,
            filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.3))',
            transformOrigin: '50% 100%',
          }}
        />
      ) : null}
    </div>
  );
}

export function Callout({
  visible,
  text,
  subtitle,
  instanceKey,
  className = '',
  tone = 'gold',
  autoFadeMs,
  lines,
  compact = false,
  secondaryCallouts,
  style: styleProp,
  anchor,
  variant = 'panel',
  panelStyle,
  emojiEmotionType,
  bubbleOffset,
  emojiOffset,
  tailOffsetX,
}: CalloutProps) {
  const EXTRA_DURATION_MS = 4000;
  const useAutoFade = !!autoFadeMs && autoFadeMs > 0;
  const effectiveAutoFadeMs = useAutoFade ? (autoFadeMs ?? 0) + EXTRA_DURATION_MS : 0;
  const autoFadeSeconds = Math.max(0.6, effectiveAutoFadeMs / 1000);
  const primaryPalette = TONE_STYLES[tone];
  const safeSecondaries = (secondaryCallouts ?? []).filter(
    (entry): entry is SecondaryCallout => !!entry && typeof entry.text === 'string'
  );
  const hasSecondaries = safeSecondaries.length > 0;

  const renderSecondary = (entry: SecondaryCallout, index: number) => {
    const palette = TONE_STYLES[entry.tone ?? tone];
    return (
      <div key={`secondary-${instanceKey ?? text}-${index}`}>
        {renderPanel({
          text: entry.text,
          subtitle: entry.subtitle,
          lines: entry.lines,
          palette,
          compact: entry.compact ?? true,
          style: { minWidth: 110, alignSelf: 'flex-end' },
        })}
      </div>
    );
  };

  const renderPrimary = () =>
    variant === 'dialog-bubble'
      ? renderDialogBubble({
          text,
          subtitle,
          lines,
          palette: primaryPalette,
          compact,
          style: { ...(hasSecondaries ? { minWidth: 220 } : {}), ...(panelStyle ?? {}) },
          emojiEmotionType,
          bubbleOffset,
          emojiOffset,
          tailOffsetX,
        })
      : renderPanel({
          text,
          subtitle,
          lines,
          palette: primaryPalette,
          compact,
          style: { ...(hasSecondaries ? { minWidth: 220 } : {}), ...(panelStyle ?? {}) },
        });

  const anchorStyle: CSSProperties = anchor ? {
    position: 'fixed',
    left: anchor.x,
    top: anchor.y,
    transform: variant === 'dialog-bubble' ? 'translate(-50%, -50%)' : 'translate(-50%, -100%)',
    pointerEvents: 'none',
  } : {};

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
          style={{ zIndex: 120, ...anchorStyle, ...styleProp }}
          className={`pointer-events-none select-none ${className}`.trim()}
        >
          <div className={`flex gap-2 ${hasSecondaries ? 'items-end' : ''}`}>
            <div className="flex-1">
              {renderPrimary()}
            </div>
            {hasSecondaries && (
              <div className="flex flex-col gap-1 items-end">
                {safeSecondaries.map(renderSecondary)}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
