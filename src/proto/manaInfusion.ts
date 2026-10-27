import type { Card } from './protoState';
import { WORLD_ITEMS, stackIngredients, type CraftStack, type WorldItemId } from './protoCrafting';

/** Explicit item identity: edible items do not become infused until converted to mana. */
export const itemIsManaInfused = (item?: WorldItemId) => Boolean(item && 'manaInfused' in WORLD_ITEMS[item] && WORLD_ITEMS[item].manaInfused);
export const cardIsManaInfused = (card: Card) => !card.inspirationResource && (card.foodSource === 'berries' || itemIsManaInfused(card.resource));
export const stackIsManaInfused = (stack: CraftStack) => Object.entries(stackIngredients(stack)).some(([item, count]) => (count ?? 0) > 0 && itemIsManaInfused(item as WorldItemId));
