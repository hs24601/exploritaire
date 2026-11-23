import atlas from '../../public/assets/runtime/characters/hero/expressions/emojis/watercolor/v2/hero-emojis-v2.json';

const closedEyes = ['happyClosed', 'blushClosed', 'sadClosed', 'upsetClosed', 'upsetWithSymbolClosed'] as const;
export type HeroEmojiEmotion = keyof typeof atlas.frames | typeof closedEyes[number] | 'curious' | 'joyful';
export const HERO_EMOJI_SHEET = '/assets/runtime/characters/hero/expressions/emojis/watercolor/v2/hero-emojis-v2.png';
export const HERO_EMOJI_CLOSED_SHEET = '/assets/runtime/characters/hero/expressions/emojis/watercolor/v1/hero-emojis-v1.png';
export const HERO_EMOJI_ATLAS = { ...atlas, frames: { ...atlas.frames, joyful: atlas.frames.happy } };
export const HERO_EMOJI_EMOTIONS = [...Object.keys(atlas.frames), ...closedEyes, 'joyful', 'curious'] as HeroEmojiEmotion[];
export const heroEmojiImage = (emotion: HeroEmojiEmotion) => {
  if (emotion === 'curious') return '/assets/runtime/characters/hero/poses/watercolor/v1-opening/hero-curious-emoji-v1.png';
  const closed = emotion.endsWith('Closed');
  const name = closed ? emotion.slice(0, -6) : emotion === 'joyful' ? 'happy' : emotion;
  return `/assets/runtime/characters/hero/expressions/emojis/watercolor/${closed ? 'v1' : 'v2'}/hero_emoji_${name}.png`;
};
