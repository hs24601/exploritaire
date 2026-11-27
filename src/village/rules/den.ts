import { adjacent, rng, shuffledDeck, type Rank } from './golf';
import type { TokenKin } from './aspen';

export const IMPROVED_DEN_WOOD = 3;
export const DEN_REST_MINUTES = 8 * 60;
export const DIG_KIN: readonly TokenKin[] = ['hero'];
export const SIMPLE_DEN_SOIL = 24;

export interface DigRun {
  piles: Rank[][];
  foundation: Rank;
  stock: Rank[];
  simple?: { excavated: number; rested: boolean };
}
export interface DenSite {
  tile: number;
  level: 0 | 1 | 2;
  residents: TokenKin[];
  dig: DigRun | null;
  worker: TokenKin | null;
}
export type DenRest = Partial<Record<TokenKin, 1 | 2>>;

// Read each column from bedrock to surface. The two bands cannot connect
// without the deep-soil foundation ranks that become available after Rest.
const SIMPLE_DEN_COLUMNS: Rank[][] = [
  [10, 9, 3, 2], [9, 10, 2, 3], [10, 9, 3, 2], [10, 9, 2, 3],
  [9, 10, 3, 2], [10, 9, 2, 3], [9, 10, 3, 2],
];

export function dealSimpleDen(): DigRun {
  return { piles: SIMPLE_DEN_COLUMNS.map(pile => [...pile]), foundation: 1, stock: [4, 1],
    simple: { excavated: 0, rested: false } };
}

export function restSimpleDen(run: DigRun): DigRun {
  if (!run.simple || run.simple.rested) return run;
  return { ...run, simple: { ...run.simple, rested: true }, stock: [11, 4, 1, 8] };
}

export function dealDig(seed: number): DigRun {
  const random = rng(seed);
  const stock = shuffledDeck(random);
  const foundation = stock.pop()!;
  let rank = foundation;
  const piles: Rank[][] = [[], [], []];
  // A seeded legal route clears the surface before moving to the next layer.
  for (let step = 0; step < 9; step++) {
    rank = ((rank - 1 + (random() < .5 ? 1 : 12)) % 13 + 1) as Rank;
    piles[step % piles.length].unshift(rank);
  }
  return { piles, foundation, stock };
}

export function digAccepts(run: DigRun, column: number): boolean {
  const cards = run.piles[column];
  return !!cards?.length && adjacent(cards[cards.length - 1], run.foundation, true);
}

export function digPlay(run: DigRun, column: number): DigRun {
  if (!digAccepts(run, column)) return run;
  const cards = run.piles[column];
  const remaining = cards.slice(0, -1);
  if (run.simple) remaining.unshift(cards[0] === 9 ? 10 : 9);
  return { ...run, foundation: cards[cards.length - 1],
    simple: run.simple && { ...run.simple, excavated: run.simple.excavated + 1 },
    piles: run.piles.map((pile, index) => index === column ? remaining : pile) };
}

export const digRemaining = (run: DigRun): number => run.simple
  ? SIMPLE_DEN_SOIL - run.simple.excavated
  : run.piles.reduce((total, pile) => total + pile.length, 0);
