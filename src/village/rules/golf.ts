// Golf engine shared by every village surface. Pure: no React, no storage.
// A run is a set of piles (top card playable), one foundation and a stock.
// Surfaces differ only in how they deal and in the small twist each one adds
// (felling in the forest, ripeness in the berry patch, depth in the quarry).

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  id: number;
  rank: Rank;
  /** Resource units this card pays when it lands on the foundation. */
  yield: number;
  /** Berry patch: unripe cards can't be picked until a neighbour is picked. */
  unripe?: boolean;
  /** Quarry: face-down until the card above it is mined. */
  hidden?: boolean;
}

export interface Pile {
  /** Bottom first; the last card is the top (playable) one. */
  cards: Card[];
  /** Grid surfaces: orthogonal neighbours by pile index. */
  neighbours?: number[];
}

export interface Run {
  piles: Pile[];
  foundation: Card[];
  stock: Card[];
  /** Wrap King <-> Ace. */
  wrap: boolean;
  receipts: number;
  /** Resource units earned this run, bonuses included. */
  earned: number;
  bonus: number;
  draws: number;
  /** Current streak of tableau plays since the last stock draw. */
  chain: number;
  bestChain: number;
  /** Piles emptied this run (forest felling). */
  felled: number;
  /** Forest: emptying a pile pays this many extra units. */
  fellBonus: number;
}

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function shuffledDeck(rand: () => number, decks = 1): Rank[] {
  const ranks: Rank[] = [];
  for (let d = 0; d < decks; d++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) ranks.push(r as Rank);
  for (let i = ranks.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
  }
  return ranks;
}

export function adjacent(a: Rank, b: Rank, wrap: boolean): boolean {
  const d = Math.abs(a - b);
  return d === 1 || (wrap && d === 12);
}

export function top(pile: Pile): Card | undefined {
  return pile.cards[pile.cards.length - 1];
}

export function foundationTop(run: Run): Card | undefined {
  return run.foundation[run.foundation.length - 1];
}

export function canPlay(run: Run, pileIndex: number): boolean {
  const pile = run.piles[pileIndex];
  const card = pile && top(pile);
  const base = foundationTop(run);
  if (!card || !base || card.unripe || card.hidden) return false;
  return adjacent(card.rank, base.rank, run.wrap);
}

export function legalPlays(run: Run): number[] {
  const out: number[] = [];
  for (let i = 0; i < run.piles.length; i++) if (canPlay(run, i)) out.push(i);
  return out;
}

export function tableauLeft(run: Run): number {
  return run.piles.reduce((n, p) => n + p.cards.length, 0);
}

export type RunEnd = 'cleared' | 'stuck' | null;

export function runEnd(run: Run): RunEnd {
  if (tableauLeft(run) === 0) return 'cleared';
  if (run.stock.length === 0 && legalPlays(run).length === 0) return 'stuck';
  return null;
}

/** Play the top card of a pile onto the foundation. Returns a new run. */
export function play(run: Run, pileIndex: number): Run {
  if (!canPlay(run, pileIndex)) return run;
  const piles = run.piles.map(p => ({ ...p, cards: p.cards.slice() }));
  const pile = piles[pileIndex];
  const card = pile.cards.pop()!;
  // Uncover: the next card in a shaft turns face up.
  const under = top(pile);
  if (under?.hidden) pile.cards[pile.cards.length - 1] = { ...under, hidden: false };
  // Ripen: picking a berry ripens the top card of each orthogonal neighbour.
  for (const n of pile.neighbours ?? []) {
    const t = top(piles[n]);
    if (t?.unripe) piles[n].cards[piles[n].cards.length - 1] = { ...t, unripe: false };
  }
  const felledNow = pile.cards.length === 0 ? 1 : 0;
  const bonus = felledNow * run.fellBonus;
  const chain = run.chain + 1;
  return {
    ...run,
    piles,
    foundation: [...run.foundation, card],
    receipts: run.receipts + 1,
    earned: run.earned + card.yield + bonus,
    bonus: run.bonus + bonus,
    chain,
    bestChain: Math.max(run.bestChain, chain),
    felled: run.felled + felledNow,
  };
}

/** Turn the next stock card onto the foundation. */
export function draw(run: Run): Run {
  if (run.stock.length === 0) return run;
  const stock = run.stock.slice();
  const card = stock.pop()!;
  return { ...run, stock, foundation: [...run.foundation, { ...card, unripe: false, hidden: false }], draws: run.draws + 1, chain: 0 };
}
