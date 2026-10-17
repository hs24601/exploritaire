import type { CSSProperties } from 'react';
import { BANKS_EMOJI_ATLAS, BANKS_EMOJI_SHEET, type BanksEmojiEmotion } from '../banksEmojis';

/** Static watercolor expression; callers decide dialogue timing and placement. */
export function BanksEmoji({ emotion, size = 64, label, className, style }: {
  emotion: BanksEmojiEmotion; size?: number; label?: string; className?: string; style?: CSSProperties;
}) {
  const { frame } = BANKS_EMOJI_ATLAS.frames[emotion];
  return <svg viewBox={`0 0 ${frame.w} ${frame.h}`} width={size} height={size}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    className={className} data-banks-emoji={emotion}
    style={{ ...style, overflow: 'hidden', flexShrink: 0, pointerEvents: 'none' }}>
    <image href={BANKS_EMOJI_SHEET} x={-frame.x} y={-frame.y}
      width={BANKS_EMOJI_ATLAS.meta.size.w} height={BANKS_EMOJI_ATLAS.meta.size.h} />
  </svg>;
}


