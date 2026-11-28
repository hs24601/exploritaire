import { adjacent, rng, shuffledDeck, type Rank } from './golf';

export const INSPIRATION_COLUMN = 4;
export const SAPLING_DEPTH = 4;

export interface SaplingRun {
  piles: Rank[][];
  foundation: Rank;
  stock: Rank[];
  /** Number of cards left to play in the inspiration column, including the reward. */
  inspiration: number;
  collected?: boolean;
}

export function dealSapling(seed: number): SaplingRun {
  const deck = shuffledDeck(rng(seed));
  const piles = Array.from({ length: 7 }, (_, column) => column === INSPIRATION_COLUMN
    ? [5, 4, 3, 2] as Rank[] : Array.from({ length: SAPLING_DEPTH }, () => deck.pop()!));
  return { piles, foundation: 1, stock: [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], inspiration: SAPLING_DEPTH, collected: false };
}

export function saplingAccepts(run: SaplingRun, column: number): boolean {
  const pile = run.piles[column];
  const rank = pile?.[pile.length - 1];
  return run.inspiration > 0 && rank !== undefined && adjacent(rank, run.foundation, true);
}

export function playSapling(run: SaplingRun, column: number): SaplingRun {
  if (!saplingAccepts(run, column)) return run;
  const pile = run.piles[column];
  const fill = (pile[0] % 13 + 1) as Rank;
  return { ...run, foundation: pile[pile.length - 1], inspiration: run.inspiration - Number(column === INSPIRATION_COLUMN),
    piles: run.piles.map((cards, index) => index === column ? [fill, ...cards.slice(0, -1)] : cards) };
}
