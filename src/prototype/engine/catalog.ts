import { ABILITY_DATA } from '../data/abilities';
import { CARD_MODIFIER_DATA } from '../data/modifiers';
import { ENEMY_DATA } from '../data/enemies';
import { HERO_DATA } from '../data/heroes';

export const abilitiesById = Object.fromEntries(ABILITY_DATA.map((ability) => [ability.id, ability]));
export const heroesById = Object.fromEntries(HERO_DATA.map((hero) => [hero.id, hero]));
export const modifiersById = Object.fromEntries(CARD_MODIFIER_DATA.map((modifier) => [modifier.id, modifier]));
export const enemiesById = Object.fromEntries(ENEMY_DATA.map((enemy) => [enemy.id, enemy]));
