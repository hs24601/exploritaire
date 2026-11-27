import { DEM_SPRITE_ASSETS } from './demSprite';
import { DEM_COMBAT_ASSETS } from './demCombatSprites';
import type { ArtStyle } from './artStyle';
/** Shared by map rendering and its startup preload; expressions are required
 * before the sectional Hero can draw its first frame. */
export const HERO_EXPRESSION_ASSETS = {
  heroHappyHeads: 'runtime/kin/hero/sprites/world/opening-poses/hero-happy-heads-v1.png',
  heroSadHeads: 'runtime/kin/hero/expressions/heads/layered-directional-heads/hero-sad-heads-v2.png',
  heroNeutralHeads: 'runtime/kin/hero/expressions/heads/layered-directional-heads/hero-neutral-heads-v2.png',
  heroCuriousHeads: 'runtime/kin/hero/expressions/heads/layered-directional-heads/hero-curious-heads-v1.png',
  heroSittingLowSadFace: 'runtime/kin/hero/expressions/faces/face-overlays/hero-sitting-sad-low-face-v1.png',
  heroSittingHighSadFace: 'runtime/kin/hero/expressions/faces/face-overlays/hero-sitting-sad-high-face-v1.png',
} as const;
/** Archived effect asset; excluded from active engine loading. */
export const RETIRED_HERO_EFFECT_ASSETS = { heroFlameTail: 'runtime/kin/hero/sprites/combat/painted-bobtail/hero-flame-pieces-v2.png' } as const;
/** Source keys are data: new actors add sheets without changing the renderer. */
export const BATTLE_SPRITE_ASSETS: Readonly<Record<string,string>> = {
  ...DEM_SPRITE_ASSETS, ...DEM_COMBAT_ASSETS,
  heroLow:'runtime/kin/hero/sprites/combat/separate-bobtail-layers/hero-directions-low-body-v3.png',
  heroHigh:'runtime/kin/hero/sprites/combat/high-angle-standing/hero-directions-high-body-v4.png',
  heroSittingLow:'runtime/kin/hero/sprites/combat/separate-bobtail-layers/hero-sitting-low-body-v3.png',
  heroSittingHigh:'runtime/kin/hero/sprites/combat/separate-bobtail-layers/hero-sitting-high-body-v3.png',
  heroWalkingLow:'runtime/kin/hero/sprites/combat/separate-bobtail-layers/hero-walking-low-body-v3.png',
  heroWalkingHigh:'runtime/kin/hero/sprites/combat/separate-bobtail-layers/hero-walking-high-body-v3.png',
  heroFlinch:'runtime/kin/hero/sprites/combat/separate-bobtail-layers/hero-flinch-atlas-body-v3.png',
  heroDown:'runtime/kin/hero/sprites/combat/separate-bobtail-layers/hero-down-atlas-body-v3.png',

  ...Object.fromEntries(Object.entries({heroLow:'hero-directions-low',heroHigh:'hero-directions-high',heroSittingLow:'hero-sitting-low',heroSittingHigh:'hero-sitting-high',heroWalkingLow:'hero-walking-low',heroWalkingHigh:'hero-walking-high',heroFlinch:'hero-flinch-atlas',heroDown:'hero-down-atlas'}).map(([key,name])=>[key+'Bobtail', 'runtime/kin/hero/sprites/combat/separate-bobtail-layers/'+name+'-bobtail-layer-v3.png'])),
  mochiLow:'runtime/kin/mochi/sprites/combat/directional-watercolor/mochi-directions-low-watercolor-v1.png',
  mochiHigh:'runtime/kin/mochi/sprites/combat/directional-watercolor/mochi-directions-high-watercolor-v1.png',
  slime:'runtime/creatures/dark-slime/sprites/combat/watercolor-directions/dark-slime-directions-watercolor-v1.png',
};

export const PIXEL_BATTLE_SPRITE_ASSETS: Record<string, string> = Object.fromEntries(
  Object.entries({heroLow:'hero-directions-low',heroHigh:'hero-directions-high',heroSittingLow:'hero-sitting-low',heroSittingHigh:'hero-sitting-high',heroWalkingLow:'hero-walking-low',heroWalkingHigh:'hero-walking-high',heroFlinch:'hero-flinch-atlas',heroDown:'hero-down-atlas',slime:'dark-slime-directions'})
    .map(([key, name]) => [key, `deprecated/pixel/characters/battle/${name}-v1.png`]),
);
// Mochi's preserved Pixel sheets use v2 registration, unlike Hero's v1 sources.
PIXEL_BATTLE_SPRITE_ASSETS.mochiLow = 'deprecated/pixel/characters/battle/mochi-directions-low-v2.png';
PIXEL_BATTLE_SPRITE_ASSETS.mochiHigh = 'deprecated/pixel/characters/battle/mochi-directions-high-v2.png';
// Dem has no pixel variant; keep their approved painted rig in either presentation.
Object.assign(PIXEL_BATTLE_SPRITE_ASSETS, DEM_SPRITE_ASSETS, DEM_COMBAT_ASSETS);
export const battleSpriteAssets = (style: ArtStyle) => style === 'paint' ? BATTLE_SPRITE_ASSETS : PIXEL_BATTLE_SPRITE_ASSETS;
