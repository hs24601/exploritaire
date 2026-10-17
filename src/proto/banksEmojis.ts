import atlas from '../../public/assets/actors/banks/emojis-watercolor-v2/banks-emojis-v2.json';

export type BanksEmojiEmotion = keyof typeof atlas.frames;
export const BANKS_EMOJI_SHEET = `${import.meta.env.BASE_URL}assets/actors/banks/emojis-watercolor-v2/banks-emojis-v2.png`;
/** Still-expression frames, usable by Canvas, Three texture UVs, or UI sprites. */
export const BANKS_EMOJI_ATLAS = atlas;
export const BANKS_EMOJI_EMOTIONS = Object.keys(atlas.frames) as BanksEmojiEmotion[];
export const banksEmojiImage = (emotion: BanksEmojiEmotion) =>
  `${import.meta.env.BASE_URL}assets/actors/banks/emojis-watercolor-v2/banks_emoji_${emotion}.png`;


