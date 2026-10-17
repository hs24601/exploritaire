import type { ArtStyle } from './artStyle';
/** Shared by map rendering and its startup preload; expressions are required
 * before the sectional Hero can draw its first frame. */
export const HERO_EXPRESSION_ASSETS = {
  heroHappyHeads: 'actors/hero/opening-watercolor-v1/hero-happy-heads-v1.png',
  heroSadHeads: 'actors/hero/heads-watercolor-v2/hero-sad-heads-v2.png',
  heroNeutralHeads: 'actors/hero/heads-watercolor-v2/hero-neutral-heads-v2.png',
  heroCuriousHeads: 'actors/hero/heads-watercolor-v2/hero-curious-heads-v1.png',
  heroSittingLowSadFace: 'actors/hero/faces-watercolor-v1/hero-sitting-sad-low-face-v1.png',
  heroSittingHighSadFace: 'actors/hero/faces-watercolor-v1/hero-sitting-sad-high-face-v1.png',
} as const;
/** Archived effect asset; excluded from active engine loading. */
export const RETIRED_HERO_EFFECT_ASSETS = { heroFlameTail: 'actors/battle/bobtail-v2/hero-flame-pieces-v2.png' } as const;
/** Source keys are data: new actors add sheets without changing the renderer. */
export const BATTLE_SPRITE_ASSETS: Readonly<Record<string,string>> = {
  heroLow:'actors/battle/bobtail-v3/hero-directions-low-body-v3.png',
  heroHigh:'actors/battle/bobtail-v3/hero-directions-high-body-v3.png',
  heroSittingLow:'actors/battle/bobtail-v3/hero-sitting-low-body-v3.png',
  heroSittingHigh:'actors/battle/bobtail-v3/hero-sitting-high-body-v3.png',
  heroWalkingLow:'actors/battle/bobtail-v3/hero-walking-low-body-v3.png',
  heroWalkingHigh:'actors/battle/bobtail-v3/hero-walking-high-body-v3.png',
  heroFlinch:'actors/battle/bobtail-v3/hero-flinch-atlas-body-v3.png',
  heroDown:'actors/battle/bobtail-v3/hero-down-atlas-body-v3.png',

  ...Object.fromEntries(Object.entries({heroLow:'hero-directions-low',heroHigh:'hero-directions-high',heroSittingLow:'hero-sitting-low',heroSittingHigh:'hero-sitting-high',heroWalkingLow:'hero-walking-low',heroWalkingHigh:'hero-walking-high',heroFlinch:'hero-flinch-atlas',heroDown:'hero-down-atlas'}).map(([key,name])=>[key+'Bobtail', 'actors/battle/bobtail-v3/'+name+'-bobtail-layer-v3.png'])),
  mochiLow:'actors/battle/watercolor-v1/mochi-directions-low-watercolor-v1.png',
  mochiHigh:'actors/battle/watercolor-v1/mochi-directions-high-watercolor-v1.png',
  slime:'actors/battle/watercolor-v1/dark-slime-directions-watercolor-v1.png',
};

export const PIXEL_BATTLE_SPRITE_ASSETS = Object.fromEntries(Object.entries(BATTLE_SPRITE_ASSETS).filter(([key]) => key !== 'heroFlameTail' && !key.endsWith('Bobtail')).map(([key, path]) => [key, path.replace('/bobtail-v3/', '/').replace('-body-v3.png', '-v1.png').replace('/bobtail-v2/', '/').replace('-bobtail-v2.png', '-v1.png').replace('/watercolor-v1/', '/').replace('-watercolor-v1.png', '-v1.png')]));
// Mochi's preserved Pixel sheets use v2 registration, unlike Hero's v1 sources.
PIXEL_BATTLE_SPRITE_ASSETS.mochiLow = 'actors/battle/mochi-directions-low-v2.png';
PIXEL_BATTLE_SPRITE_ASSETS.mochiHigh = 'actors/battle/mochi-directions-high-v2.png';
export const battleSpriteAssets = (style: ArtStyle) => style === 'paint' ? BATTLE_SPRITE_ASSETS : PIXEL_BATTLE_SPRITE_ASSETS;
