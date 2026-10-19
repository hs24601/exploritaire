import type { ArtStyle } from './artStyle';
/** Shared by map rendering and its startup preload; expressions are required
 * before the sectional Hero can draw its first frame. */
export const HERO_EXPRESSION_ASSETS = {
  heroHappyHeads: 'runtime/characters/hero/poses/watercolor/v1-opening/hero-happy-heads-v1.png',
  heroSadHeads: 'runtime/characters/hero/expressions/heads/watercolor/v2/hero-sad-heads-v2.png',
  heroNeutralHeads: 'runtime/characters/hero/expressions/heads/watercolor/v2/hero-neutral-heads-v2.png',
  heroCuriousHeads: 'runtime/characters/hero/expressions/heads/watercolor/v2/hero-curious-heads-v1.png',
  heroSittingLowSadFace: 'runtime/characters/hero/expressions/faces/watercolor/v1/hero-sitting-sad-low-face-v1.png',
  heroSittingHighSadFace: 'runtime/characters/hero/expressions/faces/watercolor/v1/hero-sitting-sad-high-face-v1.png',
} as const;
/** Archived effect asset; excluded from active engine loading. */
export const RETIRED_HERO_EFFECT_ASSETS = { heroFlameTail: 'runtime/characters/hero/rig/watercolor/v2/hero-flame-pieces-v2.png' } as const;
/** Source keys are data: new actors add sheets without changing the renderer. */
export const BATTLE_SPRITE_ASSETS: Readonly<Record<string,string>> = {
  heroLow:'runtime/characters/hero/rig/watercolor/v3/hero-directions-low-body-v3.png',
  heroHigh:'runtime/characters/hero/rig/watercolor/v3/hero-directions-high-body-v3.png',
  heroSittingLow:'runtime/characters/hero/rig/watercolor/v3/hero-sitting-low-body-v3.png',
  heroSittingHigh:'runtime/characters/hero/rig/watercolor/v3/hero-sitting-high-body-v3.png',
  heroWalkingLow:'runtime/characters/hero/rig/watercolor/v3/hero-walking-low-body-v3.png',
  heroWalkingHigh:'runtime/characters/hero/rig/watercolor/v3/hero-walking-high-body-v3.png',
  heroFlinch:'runtime/characters/hero/rig/watercolor/v3/hero-flinch-atlas-body-v3.png',
  heroDown:'runtime/characters/hero/rig/watercolor/v3/hero-down-atlas-body-v3.png',

  ...Object.fromEntries(Object.entries({heroLow:'hero-directions-low',heroHigh:'hero-directions-high',heroSittingLow:'hero-sitting-low',heroSittingHigh:'hero-sitting-high',heroWalkingLow:'hero-walking-low',heroWalkingHigh:'hero-walking-high',heroFlinch:'hero-flinch-atlas',heroDown:'hero-down-atlas'}).map(([key,name])=>[key+'Bobtail', 'runtime/characters/hero/rig/watercolor/v3/'+name+'-bobtail-layer-v3.png'])),
  mochiLow:'runtime/characters/mochi/rig/watercolor/v1/mochi-directions-low-watercolor-v1.png',
  mochiHigh:'runtime/characters/mochi/rig/watercolor/v1/mochi-directions-high-watercolor-v1.png',
  slime:'runtime/characters/dark-slime/rig/watercolor/v1/dark-slime-directions-watercolor-v1.png',
};

export const PIXEL_BATTLE_SPRITE_ASSETS: Record<string, string> = Object.fromEntries(
  Object.entries({heroLow:'hero-directions-low',heroHigh:'hero-directions-high',heroSittingLow:'hero-sitting-low',heroSittingHigh:'hero-sitting-high',heroWalkingLow:'hero-walking-low',heroWalkingHigh:'hero-walking-high',heroFlinch:'hero-flinch-atlas',heroDown:'hero-down-atlas',slime:'dark-slime-directions'})
    .map(([key, name]) => [key, `deprecated/pixel/characters/battle/${name}-v1.png`]),
);
// Mochi's preserved Pixel sheets use v2 registration, unlike Hero's v1 sources.
PIXEL_BATTLE_SPRITE_ASSETS.mochiLow = 'deprecated/pixel/characters/battle/mochi-directions-low-v2.png';
PIXEL_BATTLE_SPRITE_ASSETS.mochiHigh = 'deprecated/pixel/characters/battle/mochi-directions-high-v2.png';
export const battleSpriteAssets = (style: ArtStyle) => style === 'paint' ? BATTLE_SPRITE_ASSETS : PIXEL_BATTLE_SPRITE_ASSETS;
