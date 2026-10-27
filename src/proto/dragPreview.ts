/** Shared timing for passive hand-and-card demonstrations. */
export function dragPreviewFrame(time: number) {
  const elapsed = Math.max(0, time) % 5200;
  const travel = Math.max(0, Math.min(1, (elapsed - 900) / 2100));
  return { t: travel * travel * (3 - 2 * travel), opacity: elapsed > 3700 ? Math.max(0, 1 - (elapsed - 3700) / 500) : Math.min(1, elapsed / 300), grabbing: elapsed > 700 && elapsed < 3200 };
}
export function farthestPreviewCard<T extends { x: number; y: number }>(cards: readonly T[], target: { x: number; y: number }): T | undefined {
  return cards.reduce<T | undefined>((best, card) => !best || Math.hypot(card.x - target.x, card.y - target.y) > Math.hypot(best.x - target.x, best.y - target.y) ? card : best, undefined);
}
