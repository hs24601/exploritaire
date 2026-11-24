import { createHeroDirectionalSprite } from './directionalSprites';
import { HERO_ORBIT_ATLAS } from './heroOrbitAtlas';
import { HERO_ORBIT_VIEWS } from './heroOrbitProxy';

/** Texture key for the orbit slice's sheet; it has no bobtail or face overlays, since Sol paints both in. */
export const HERO_ORBIT_SOURCE = 'heroOrbitLow';
export const HERO_ORBIT_ASSETS: Readonly<Record<string, string>> = { [HERO_ORBIT_SOURCE]: HERO_ORBIT_ATLAS.sheet };

/** Hero standing with the orbit v1 paintings (docs/art/hero-orbit-v1.md) at the low camera tier. */
export const HERO_ORBIT_DIRECTIONAL_SPRITE = createHeroDirectionalSprite(HERO_ORBIT_VIEWS.map(view => ({ source: HERO_ORBIT_SOURCE, rect: HERO_ORBIT_ATLAS.rects[view.id] })));
