import type { CSSProperties } from 'react';
import { HERO_EMOJI_ATLAS, HERO_EMOJI_SHEET, type HeroEmojiEmotion } from '../heroEmojis';

/** Static watercolor expression; callers decide dialogue timing and placement. */
export function HeroEmoji({ emotion, size = 64, label, className, style }: {
  emotion: HeroEmojiEmotion; size?: number; label?: string; className?: string; style?: CSSProperties;
}) {
  const { frame } = HERO_EMOJI_ATLAS.frames[emotion];
  return <svg viewBox={`0 0 ${frame.w} ${frame.h}`} width={size} height={size}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    className={className} data-hero-emoji={emotion}
    style={{ ...style, overflow: 'hidden', flexShrink: 0, pointerEvents: 'none' }}>
    <image href={HERO_EMOJI_SHEET} x={-frame.x} y={-frame.y}
      width={HERO_EMOJI_ATLAS.meta.size.w} height={HERO_EMOJI_ATLAS.meta.size.h} />
  </svg>;
}
