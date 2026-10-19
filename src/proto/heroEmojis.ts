import atlas from '../../public/assets/runtime/characters/hero/expressions/emojis/watercolor/v1/hero-emojis-v1.json';

export type HeroEmojiEmotion = keyof typeof atlas.frames | 'curious' | 'joyful';
export const HERO_EMOJI_SHEET = '/assets/runtime/characters/hero/expressions/emojis/watercolor/v1/hero-emojis-v1.png';
/** Still-expression frames, usable by Canvas, Three texture UVs, or UI sprites. */
export const HERO_EMOJI_ATLAS = { ...atlas, frames: { ...atlas.frames, joyful: atlas.frames.happy } };
export const HERO_EMOJI_EMOTIONS = [...Object.keys(atlas.frames), 'joyful', 'curious'] as HeroEmojiEmotion[];
export const heroEmojiImage = (emotion: HeroEmojiEmotion) =>
  ['happy', 'curious', 'sad'].includes(emotion)
    ? `/assets/runtime/characters/hero/poses/watercolor/v1-opening/hero-${emotion}-emoji-v1.png`
    : `/assets/runtime/characters/hero/expressions/emojis/watercolor/v1/hero_emoji_${emotion === 'joyful' ? 'happy' : emotion}.png`;
