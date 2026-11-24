import type { MegaHandAbilityDefinition } from '../megahandAbilityData';
import { MEGAHAND_ABILITY_CATALOG } from './megahandAbilityCatalog';

export const HERO_MEGAHAND_ABILITY_CATALOG: MegaHandAbilityDefinition[] = (
  MEGAHAND_ABILITY_CATALOG.filter((ability) => ability.ownerName === 'Hero')
);

export const HERO_MEGAHAND_DECK: MegaHandAbilityDefinition[] = (
  HERO_MEGAHAND_ABILITY_CATALOG.filter((ability) => ability.in_deck !== false)
);
