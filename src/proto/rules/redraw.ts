// Inspiration pays for foundation redraws. When nothing on the tableau plays on an
// actor's foundation, the player abandons its value for a new one, and the
// actor spends 1 inspiration. The new value is drawn at random, or a spirit
// companion offers a fixed value the player can pick instead. Pure: no React.

export const REDRAW_INSPIRATION_COST = 1;

export type RedrawSource =
  | { kind: 'draw' }
  | { kind: 'spirit'; spiritId: string; rank: number };

/** The choices a redraw offers: a random draw, then the fixed value of each spirit companion that has one. */
export const redrawOptions = (spirits: readonly { id: string; redrawRank?: number }[] = []): RedrawSource[] => [
  { kind: 'draw' },
  ...spirits.flatMap((spirit): RedrawSource[] => spirit.redrawRank ? [{ kind: 'spirit', spiritId: spirit.id, rank: spirit.redrawRank }] : []),
];

export const canRedraw = (inspiration: number) => inspiration >= REDRAW_INSPIRATION_COST;

/** A random rank (1-13) other than the abandoned one. `random` is 0-1. */
export const drawRedrawRank = (current: number, random: number) => {
  const rank = 1 + Math.min(11, Math.floor(random * 12));
  return rank >= current ? rank + 1 : rank;
};

/**
 * Abandons a foundation's value for a new one, costing the actor 1 inspiration.
 * Returns null when the actor has no inspiration left.
 */
export const redrawFoundation = (
  foundation: { rank: number; inspiration: number },
  source: RedrawSource = { kind: 'draw' },
  random: number = Math.random(),
): { rank: number; inspiration: number } | null => {
  if (!canRedraw(foundation.inspiration)) return null;
  const rank = source.kind === 'spirit' ? source.rank : drawRedrawRank(foundation.rank, random);
  return { rank, inspiration: foundation.inspiration - REDRAW_INSPIRATION_COST };
};
