/** Seven-column golf for gathering: exposed column cards play ±1 (A/K wrap) onto the foundation; stock draws set a new foundation. */

export type Rng = { seed: number };
export function nextRandom(rng: Rng) {
  let t = (rng.seed = (rng.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randomRank = (rng: Rng) => 1 + Math.floor(nextRandom(rng) * 13);
export const adjacent = (a: number, b: number) => Math.abs(a - b) === 1 || (a === 1 && b === 13) || (a === 13 && b === 1);
export const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export type GolfCard = { id: number; rank: number };
export type Golf = { columns: GolfCard[][]; stock: GolfCard[]; foundation: GolfCard | null; streak: number; receipts: number };

export const GOLF_COLUMNS = 7;
export const GOLF_DEPTH = 5;

export function dealGolf(seed: number, foundationRank?: number): Golf {
  const rng = { seed };
  const deck: GolfCard[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ id: s * 13 + r, rank: r });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(nextRandom(rng) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const columns: GolfCard[][] = Array.from({ length: GOLF_COLUMNS }, () => []);
  for (let row = 0; row < GOLF_DEPTH; row++) for (let c = 0; c < GOLF_COLUMNS; c++) columns[c].push(deck.pop()!);
  return { columns, stock: deck, foundation: foundationRank ? { id: 1000, rank: foundationRank } : null, streak: 0, receipts: 0 };
}

export const exposed = (g: Golf, col: number) => g.columns[col][g.columns[col].length - 1];
export const canPlay = (g: Golf, col: number) => !!g.foundation && !!exposed(g, col) && adjacent(exposed(g, col).rank, g.foundation.rank);
export const hasMove = (g: Golf) => g.columns.some((_, c) => canPlay(g, c));

export function playColumn(g: Golf, col: number): Golf | null {
  if (!canPlay(g, col)) return null;
  const columns = g.columns.map((cards, i) => i === col ? cards.slice(0, -1) : cards);
  return { ...g, columns, foundation: exposed(g, col), streak: g.streak + 1, receipts: g.receipts + 1 };
}

export function drawStock(g: Golf): Golf | null {
  if (!g.stock.length) return null;
  return { ...g, stock: g.stock.slice(0, -1), foundation: g.stock[g.stock.length - 1], streak: 0 };
}

export const cleared = (g: Golf) => g.columns.every(c => !c.length);
