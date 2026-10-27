import type { CSSProperties } from 'react';
import { MOCHI_EMOJI_ATLAS, MOCHI_EMOJI_SHEET, type MochiEmojiEmotion } from '../mochiEmojis';

/** Static watercolor expression; callers decide dialogue timing and placement. */
export function MochiEmoji({ emotion, size = 64, label, className, style }: {
  emotion: MochiEmojiEmotion; size?: number; label?: string; className?: string; style?: CSSProperties;
}) {
  const { frame } = MOCHI_EMOJI_ATLAS.frames[emotion];
  return <svg viewBox={`0 0 ${frame.w} ${frame.h}`} width={size} height={size}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    className={className} data-mochi-emoji={emotion}
    style={{ ...style, overflow: 'hidden', flexShrink: 0, pointerEvents: 'none' }}>
    <image href={MOCHI_EMOJI_SHEET} x={-frame.x} y={-frame.y}
      width={MOCHI_EMOJI_ATLAS.meta.size.w} height={MOCHI_EMOJI_ATLAS.meta.size.h} />
  </svg>;
}

