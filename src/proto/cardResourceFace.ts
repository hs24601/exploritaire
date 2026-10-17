import type { Card } from './protoState';
import { WORLD_ITEMS } from './protoCrafting';

/** Source artwork belongs to the uncollected card, separate from inventory. */
export const cardResourceFace = (card: Card) => card.inspirationResource
  ? { label: 'Inspiration · 1 INSP', glyph: '💫' }
  : card.foodSource === 'berries'
  ? { label: 'Manaberries', glyph: '🫐' }
  : card.resource ? WORLD_ITEMS[card.resource] : undefined;
