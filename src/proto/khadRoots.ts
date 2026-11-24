/** Khad Roots play on the Hebrew word kadrut: gloom, misery, bleakness.
 * Bindings live on individual cards; a shared groupId joins their vines visually.
 * Ability callers own costs/permissions. The first sparse scene grants no removal.
 */
export type KhadRootBinding = { groupId: string; cornerstone?: boolean; /** Explicit opt-in: roots may cross the printed value. */ obscureValue?: boolean };
export type RootedCard = { id: string; khadRoot?: KhadRootBinding };

/** Free one card, or its whole grouping when its authored cornerstone is removed. */
export function removeKhadRoot<T extends RootedCard>(cards: readonly T[], cardId: string): T[] {
  const binding = cards.find(card => card.id === cardId)?.khadRoot;
  return cards.map(card => binding && (card.id === cardId || binding.cornerstone && card.khadRoot?.groupId === binding.groupId)
    ? { ...card, khadRoot: undefined } : card);
}
