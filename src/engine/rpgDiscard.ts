import type { Card } from './types';

export function appendCardToActorRpgDiscard(
  piles: Record<string, Card[]> | undefined,
  actorId: string | null | undefined,
  card: Card
): Record<string, Card[]> | undefined {
  if (!actorId) return piles;
  const nextPiles = { ...(piles ?? {}) };
  const actorPile = nextPiles[actorId] ?? [];
  nextPiles[actorId] = [...actorPile, card];
  return nextPiles;
}

export function removeOneCardFromActorRpgDiscardByDeckCardId(
  piles: Record<string, Card[]> | undefined,
  actorId: string | null | undefined,
  deckCardId: string
): Record<string, Card[]> | undefined {
  if (!actorId || !piles) return piles;
  const actorPile = piles[actorId];
  if (!actorPile || actorPile.length === 0) return piles;
  const index = actorPile.findIndex((card) => card.sourceDeckCardId === deckCardId);
  if (index === -1) return piles;
  const nextActorPile = [...actorPile.slice(0, index), ...actorPile.slice(index + 1)];
  return {
    ...piles,
    [actorId]: nextActorPile,
  };
}
