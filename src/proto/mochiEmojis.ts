import atlas from '../../public/assets/runtime/kin/mochi/expressions/watercolor-emojis/mochi-emojis-v1.json';

export type MochiEmojiEmotion = keyof typeof atlas.frames;
export const MOCHI_EMOJI_SHEET = '/assets/runtime/kin/mochi/expressions/watercolor-emojis/mochi-emojis-v1.png';
/** Still-expression frames, usable by Canvas, Three texture UVs, or UI sprites. */
export const MOCHI_EMOJI_ATLAS = atlas;
export const MOCHI_EMOJI_EMOTIONS = Object.keys(atlas.frames) as MochiEmojiEmotion[];
export const mochiEmojiImage = (emotion: MochiEmojiEmotion) =>
  `/assets/runtime/kin/mochi/expressions/watercolor-emojis/mochi_emoji_${emotion}.png`;

