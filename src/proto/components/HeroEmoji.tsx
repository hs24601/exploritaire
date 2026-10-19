import type { CSSProperties } from 'react';
import curiousHeads from '../art/heroOpeningCuriousHeadLayout.json';
import sadHeads from '../art/heroOpeningSadHeadLayout.json';
import happyHeads from '../art/heroHappyHeadLayout.json';
import { HERO_EMOJI_ATLAS, HERO_EMOJI_SHEET, type HeroEmojiEmotion } from '../heroEmojis';

/** Static watercolor expression; callers decide dialogue timing and placement. */
export function HeroEmoji({ emotion, size = 64, label, className, style }: {
  emotion: HeroEmojiEmotion; size?: number; label?: string; className?: string; style?: CSSProperties;
}) {
  const directional = emotion === 'curious' || emotion === 'happy' || emotion === 'sad';
  const [x,y,w,h] = (emotion === 'happy' ? happyHeads : emotion === 'sad' ? sadHeads : curiousHeads)[0];
  const frame = directional ? {x,y,w,h} : HERO_EMOJI_ATLAS.frames[emotion].frame;
  const sheet = `/assets/runtime/characters/hero/poses/watercolor/v1-opening/hero-${emotion}-heads-v1.png`;
  return <svg viewBox={`0 0 ${frame.w} ${frame.h}`} width={size} height={size}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    className={className} data-hero-emoji={emotion}
    style={{ ...style, overflow: 'hidden', flexShrink: 0, pointerEvents: 'none' }}>
    <image href={directional ? sheet : HERO_EMOJI_SHEET} x={-frame.x} y={-frame.y}
      width={directional ? 1024 : HERO_EMOJI_ATLAS.meta.size.w} height={directional ? 512 : HERO_EMOJI_ATLAS.meta.size.h} />
  </svg>;
}
