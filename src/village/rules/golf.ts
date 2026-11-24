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
  /** Birch Stand: a branch from a tree's crown. */
  branch?: boolean;
}

export interface Pile {
  /** Bottom first; the last card is the top (playable) one. */
  cards: Card[];
  /** Grid surfaces: orthogonal neighbours by pile index. */
  neighbours?: number[];
  /** Forest: the tree this column belongs to. Two adjacent columns make one tree. */
  tree?: number;
  /** Forest: lumber cut from this column but not yet paid (it pays when the column is finished). */
  held?: number;
  /** Birch Stand: the tree's crown, face up. When the column is cleared the tree falls left or right
   *  and the crown lands on top of the standing neighbour on that side (or on open ground, and is lost). */
  crown?: Card[];
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
  /** Piles emptied this run, or trees felled in the forest. */
  felled: number;
  /** Forest: felling a whole tree (both its columns) pays this many extra units. */
  fellBonus: number;
  /** Birch Stand: a cleared column waiting for the player to choose which way it falls. */
  pendingFall?: number | null;
}

export type Side = -1 | 1;

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
  if (!card || !base || card.unripe || card.hidden || run.pendingFall != null) return false;
  return adjacent(card.rank, base.rank, run.wrap);
}

export function legalPlays(run: Run): number[] {
  const out: number[] = [];
  for (let i = 0; i < run.piles.length; i++) if (canPlay(run, i)) out.push(i);
  return out;
}

/** Forest: lumber cut from unfinished columns, lost if the run ends before they're finished. */
export function heldLumber(run: Run): number {
  return run.piles.reduce((n, p) => n + (p.cards.length ? p.held ?? 0 : 0), 0);
}

export function tableauLeft(run: Run): number {
  return run.piles.reduce((n, p) => n + p.cards.length, 0);
}

export type RunEnd = 'cleared' | 'stuck' | null;

export function runEnd(run: Run): RunEnd {
  if (run.pendingFall != null) return null;
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
  let gain = card.yield;
  let bonus = 0;
  let felledNow = 0;
  if (pile.tree !== undefined) {
    // Forest: a column pays nothing until it's finished; finishing both columns of a tree fells it.
    const held = (pile.held ?? 0) + card.yield;
    gain = 0;
    if (pile.cards.length === 0) {
      gain = held;
      pile.held = 0;
      const standing = piles.some((p, i) => i !== pileIndex && p.tree === pile.tree && p.cards.length > 0);
      if (!standing) { felledNow = 1; bonus = run.fellBonus; }
    } else {
      pile.held = held;
    }
  } else if (pile.cards.length === 0 && pile.crown?.length && fallTargets(piles, pileIndex).some(t => t != null)) {
    // Birch Stand: the tree is down to its stump; the player chooses which way it falls.
    return {
      ...run, piles, foundation: [...run.foundation, card], receipts: run.receipts + 1, earned: run.earned + gain,
      chain: run.chain + 1, bestChain: Math.max(run.bestChain, run.chain + 1), pendingFall: pileIndex,
    };
  } else if (pile.cards.length === 0) {
    felledNow = 1;
    bonus = run.fellBonus;
    if (pile.crown?.length) pile.crown = [];
  }
  const chain = run.chain + 1;
  return {
    ...run,
    piles,
    foundation: [...run.foundation, card],
    receipts: run.receipts + 1,
    earned: run.earned + gain + bonus,
    bonus: run.bonus + bonus,
    chain,
    bestChain: Math.max(run.bestChain, chain),
    felled: run.felled + felledNow,
  };
}

/** Birch Stand: the standing neighbour a tree would land on, for each side [left, right]; null is open ground. */
export function fallTargets(piles: Pile[], i: number): [number | null, number | null] {
  const at = (j: number) => (piles[j] && piles[j].cards.length > 0 ? j : null);
  return [at(i - 1), at(i + 1)];
}

/** Birch Stand: fell the pending tree to one side. Its crown lands face up on that neighbour's column. */
export function fall(run: Run, side: Side): Run {
  const i = run.pendingFall;
  if (i == null) return run;
  const piles = run.piles.map(p => ({ ...p, cards: p.cards.slice() }));
  const target = fallTargets(piles, i)[side < 0 ? 0 : 1];
  const crown = piles[i].crown ?? [];
  if (target != null) piles[target].cards.push(...crown);
  piles[i].crown = [];
  return { ...run, piles, pendingFall: null, felled: run.felled + 1, earned: run.earned + run.fellBonus, bonus: run.bonus + run.fellBonus };
}

/** Turn the next stock card onto the foundation. */
export function draw(run: Run): Run {
  if (run.stock.length === 0 || run.pendingFall != null) return run;
  const stock = run.stock.slice();
  const card = stock.pop()!;
  return { ...run, stock, foundation: [...run.foundation, { ...card, unripe: false, hidden: false }], draws: run.draws + 1, chain: 0 };
}
