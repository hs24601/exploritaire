import type { ArtStyle } from './artStyle';
import { actorSprite } from './actorArt';
import { scenerySprite, woodsOverheadSprite } from './sceneryArt';
import { DEN_ORBIT_FILES } from './directionalScenery';
import { battleSpriteAssets, HERO_EXPRESSION_ASSETS } from './battleSpriteAssets';
import { OPENING_HERO_ASSETS } from './openingHeroAssets';
import { ACTOR_HOLO_LAYERS } from './art/actorCardArt';
import { ABILITY_CARD_ART, abilityCardArt } from './art/abilityCardArt';
import { restBobtailSprite } from './heroBobtail';
import { BANKS_SPRITE_ASSETS } from './banksSprite';
import { BANKS_EMOJI_SHEET } from './banksEmojis';
import { BANKS_NUZZLE_ART } from './banksCinemaArt';

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
const scenery = (name: string, style: ArtStyle) => scenerySprite(asset(`deprecated/pixel/environment/${name}`), style)!;

/** Only active runtime art: no source sheets, old versions or alternate style. */
export function protoMediaAssets(style: ArtStyle) {
  const opening = [
    // The first OK changes both the den's orbit view and Hero's body pose.
    // Warm these before play, ahead of combat/ability/card decoration.
    ...Object.entries(battleSpriteAssets(style)).filter(([key]) => key.startsWith('hero') && !key.startsWith('heroFlinch') && !key.startsWith('heroDown')).map(([, path]) => asset(path)),
    ...(style === 'paint' ? [...Object.values(HERO_EXPRESSION_ASSETS), ...Object.values(OPENING_HERO_ASSETS)].map(asset) : []),
    ...(style === 'paint' ? DEN_ORBIT_FILES.map(name => asset(`runtime/environment/watercolor/v1/${name}`)) : []),
    scenery('hero-den-standee-v3.png', style),
    actorSprite(asset('deprecated/pixel/characters/hero.png'), style)!,
    actorSprite(asset('deprecated/pixel/characters/hero-sleeping.png'), style)!,
    ...['manaberry-sparse-standee-v1.png','manaberry-sparse-overhead-v1.png'].map(name => asset('runtime/environment/watercolor/v1/'+name)),
    asset('runtime/ui/quests/hero-snuffling-berries-v1.png'),
    ...(style === 'paint' ? ['hero-leaving-cave-night-paint-v1.png', 'hero-snuffling-berries-night-paint-v5.png'].map(name => asset('runtime/ui/quests/'+name)) : []),
    ...['hero-den-topdown-v3.png', 'hero-den-ground-v3.png', 'impassable-mountain_topdown.svg',
      'berry-patch-topdown.svg', 'berry-patch-ground.svg', 'dirt-ground.png'].map(name => scenery(name, style)),
    actorSprite(asset('deprecated/pixel/characters/hero-sleeping-topdown.png'), style)!,
    ...(style === 'paint' ? [asset('runtime/environment/watercolor/v1/mountain-ground-v1.png'), ...['stone-spill-v1.png','berry-spill-v1.png','earth-spill-v1.png'].map(name=>asset('runtime/environment/watercolor/v1/'+name))] : []),
  ];
  const background = [
    ...Object.values(BANKS_SPRITE_ASSETS).map(asset), BANKS_EMOJI_SHEET, BANKS_NUZZLE_ART,
    ...['manaberry-sparse-standee-v1.png','manaberry-sparse-overhead-v1.png'].map(name => asset('runtime/environment/watercolor/v1/'+name)),
    ...(style === 'paint' ? Object.keys(ABILITY_CARD_ART).map(name => abilityCardArt(name)!) : []),
    ...(style === 'paint' ? ['','-topdown'].map(view=>restBobtailSprite(actorSprite(asset(`deprecated/pixel/characters/hero-sleeping${view}.png`),style)!)!) : []),
    ...Object.values(battleSpriteAssets(style)).map(asset),
    ...['hero-den-standee-v3.png', 'berry-bush.svg', 'berry-patch-topdown.svg', 'berry-patch-ground.svg',
      'small_woods_pines.png', 'woods_side.svg', 'mountain_standee.svg', 'mountain_standee_ridge.svg',
      'mountain_standee_ridge_ns.svg', 'dirt-ground.png'].map(name => scenery(name, style)),
    actorSprite(asset('deprecated/pixel/characters/hero-sleeping.png'), style)!,
    woodsOverheadSprite(style, false), woodsOverheadSprite(style, true),
    ...Object.values(ACTOR_HOLO_LAYERS).flatMap(layer => [layer.background, layer.subject]),
    ...(style === 'paint' ? DEN_ORBIT_FILES.map(name => asset(`runtime/environment/watercolor/v1/${name}`)) : []),
  ];
  return { opening: [...new Set(opening)], background: [...new Set(background)].filter(src => !opening.includes(src)) };
}
