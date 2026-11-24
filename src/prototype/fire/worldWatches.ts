import type { FireCard, ResourceType } from './rules';

export type WorldWatchId = 'carrot-stockpile';
export type WorldWatchEvent = { id: WorldWatchId; kind: 'spawn-foil-pack' };

export type WorldWatchState = {
  cards: FireCard[];
  stacks: string[][];
  fired: Partial<Record<WorldWatchId, true>>;
};

/** A declarative first pass: add watches here without coupling them to UI. */
export function evaluateWorldWatches(state: WorldWatchState): WorldWatchEvent[] {
  const cardsById = new Map(state.cards.map((card) => [card.id, card]));
  const hasSequentialStockpile = state.stacks.some((stack) => {
    if (stack.length < 3) return false;
    const cards = stack.map((id) => cardsById.get(id)).filter((card): card is FireCard => !!card);
    return cards.length >= 3 && cards.every((card) => card.resourceType === ('carrot' as ResourceType));
  });
  return hasSequentialStockpile && !state.fired['carrot-stockpile'] ? [{ id: 'carrot-stockpile', kind: 'spawn-foil-pack' }] : [];
}
