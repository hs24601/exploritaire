import { BATTLE_SPRITE_ASSETS } from './battleSpriteAssets';

const sheets = {
  heroLow: 'directions-low', heroHigh: 'directions-high',
  heroSittingLow: 'sitting-low', heroSittingHigh: 'sitting-high',
  heroWalkingLow: 'walking-low', heroWalkingHigh: 'walking-high',
};
/** Map story artwork shares the existing registration and four-phase gait.
 * The preserved open-mouth bodies remain selectable as Joyful. Combat reaction
 * sheets and the battle scene keep their independently authored assets. */
export const OPENING_HERO_ASSETS: Readonly<Record<string, string>> = {
  heroCuriousHeads: 'runtime/characters/hero/poses/watercolor/v1-opening/hero-curious-heads-v1.png',
  heroSadHeads: 'runtime/characters/hero/poses/watercolor/v1-opening/hero-sad-heads-v1.png',
  ...Object.fromEntries(Object.entries(sheets).map(([key, name]) => [key, `runtime/characters/hero/poses/watercolor/v1-opening/hero-${name}-v1.png`])),
  ...Object.fromEntries(Object.keys(sheets).map(key => [key + 'Joyful', BATTLE_SPRITE_ASSETS[key]])),
};
