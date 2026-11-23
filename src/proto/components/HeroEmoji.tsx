import { useId, type CSSProperties } from 'react';
import curiousHeads from '../art/heroOpeningCuriousHeadLayout.json';
import { HERO_EMOJI_ATLAS, HERO_EMOJI_SHEET, HERO_EMOJI_CLOSED_SHEET, type HeroEmojiEmotion } from '../heroEmojis';

/** Static watercolor expression; callers decide dialogue timing and placement. */
export function HeroEmoji({ emotion, size = 64, label, className, style }: {
  emotion: HeroEmojiEmotion; size?: number; label?: string; className?: string; style?: CSSProperties;
}) {
  const clip = useId();
  const directional = emotion === 'curious';
  const closed = emotion.endsWith('Closed');
  const key = (closed ? emotion.slice(0, -6) : emotion) as keyof typeof HERO_EMOJI_ATLAS.frames;
  const [x, y, w, h] = curiousHeads[0];
  const frame = directional ? { x, y, w, h } : HERO_EMOJI_ATLAS.frames[key].frame;
  const sheet = directional ? '/assets/runtime/characters/hero/poses/watercolor/v1-opening/hero-curious-heads-v1.png' : closed ? HERO_EMOJI_CLOSED_SHEET : HERO_EMOJI_SHEET;
  return <svg viewBox={`0 0 ${frame.w} ${frame.h}`} width={size} height={size}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    className={className} data-hero-emoji={emotion}
    style={{ ...style, overflow: 'hidden', flexShrink: 0, pointerEvents: 'none' }}>
    <defs><clipPath id={clip}><rect width={frame.w} height={frame.h} /></clipPath></defs>
    <image clipPath={`url(#${clip})`} href={sheet} x={-frame.x} y={-frame.y}
      width={directional ? 1024 : HERO_EMOJI_ATLAS.meta.size.w} height={directional ? 512 : HERO_EMOJI_ATLAS.meta.size.h} />
  </svg>;
}
