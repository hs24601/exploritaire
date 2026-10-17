import atlas from '../../public/assets/actors/hero/emojis-watercolor-v1/hero-emojis-v1.json';

export type HeroEmojiEmotion = keyof typeof atlas.frames;
export const HERO_EMOJI_SHEET = '/assets/actors/hero/emojis-watercolor-v1/hero-emojis-v1.png';
/** Still-expression frames, usable by Canvas, Three texture UVs, or UI sprites. */
export const HERO_EMOJI_ATLAS = atlas;
export const HERO_EMOJI_EMOTIONS = Object.keys(atlas.frames) as HeroEmojiEmotion[];
export const heroEmojiImage = (emotion: HeroEmojiEmotion) =>
  `/assets/actors/hero/emojis-watercolor-v1/hero_emoji_${emotion}.png`;
