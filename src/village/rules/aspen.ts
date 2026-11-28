import { adjacent, rng, shuffledDeck, type Rank } from './golf';
import { HERO_START, tileIndex } from './map';
import { KIN } from './village';

export const KIN_TOKENS = {
  mochi: KIN.mochi,
  hero: { name: 'Hero', portrait: '/assets/runtime/kin/hero/expressions/emojis/open-eyed/hero_emoji_happy.png' },
  banks: KIN.banks,
  demi: { name: 'Demi' },
};
export type TokenKin = keyof typeof KIN_TOKENS;
export const KIN_STAMINA_MAX = 6;
export type KinStamina = Record<TokenKin, number>;
export const freshStamina = (): KinStamina => ({ mochi: KIN_STAMINA_MAX, hero: KIN_STAMINA_MAX,
  banks: KIN_STAMINA_MAX, demi: KIN_STAMINA_MAX });
export interface Party { tile: number; members: TokenKin[] }
export interface AspenRun {
  piles: Rank[][];
  foundations: { kin: TokenKin; rank: Rank }[];
  stock: Rank[];
  hp: number;
  maxHp: number;
  spill?: Rank;
  // Felled is the spent state, including trees already paid out by older saves.
  phase: 'standing' | 'falling' | 'fallen' | 'felled';
}
export const ASPEN_FALL_MS = 900;
export const ASPEN_TREE_COUNT = 18;
export interface AspenGrove {
  seed: number;
  members: TokenKin[];
  target: number | null;
  trees: (AspenRun | null)[];
}

export const activeAspen = (grove: AspenGrove | null) =>
  grove && grove.target !== null ? grove.trees[grove.target] ?? null : null;

export const aspenSeed = (seed: number, tree: number) => (seed + Math.imul(tree + 1, 0x9e3779b9)) >>> 0;
export const aspenMaxHp = (seed: number) => 9 + Math.floor(rng(seed ^ 0x51eeda5e)() * 6);
export function aspenSpill(seed: number): Rank | undefined {
  const random = rng(seed ^ 0x4c9ae231);
  return random() < 1 / 3 ? (1 + Math.floor(random() * 13)) as Rank : undefined;
}

export function startingParties(): Party[] {
  return [{ tile: tileIndex(HERO_START.x, HERO_START.y), members: ['hero'] }];
}

export function dealAspen(seed: number, members: TokenKin[]): AspenRun {
  const random = rng(seed);
  const deck = shuffledDeck(random);
  const foundations = members.map(kin => ({ kin, rank: deck.pop()! }));
  const piles = Array.from({ length: 7 }, () => Array.from({ length: 4 }, () => deck.pop()!));
  // Seed a reachable felling route while keeping the remaining cards shuffled.
  const maxHp = aspenMaxHp(seed);
  const columns = piles.map((_, i) => i).sort((a, b) => piles[a][0] - piles[b][0]);
  let rank = foundations[0].rank;
  for (let i = 0; i < maxHp; i++) {
    rank = ((rank - 1 + (random() < .5 ? 1 : 12)) % 13 + 1) as Rank;
    piles[columns[i % 7]][3 - Math.floor(i / 7)] = rank;
  }
  return { piles, foundations, stock: deck, hp: maxHp, maxHp, phase: 'standing' };
}

export function aspenAccepts(run: AspenRun, pile: number, foundation: number): boolean {
  return aspenAcceptsRank(run, aspenTop(run, pile), foundation);
}

export function aspenTop(run: AspenRun, pile: number): Rank | undefined {
  const cards = run.piles[pile];
  return cards && cards[cards.length - 1];
}

export function aspenAcceptsRank(run: AspenRun, rank: Rank | undefined, foundation: number): boolean {
  const base = run.foundations[foundation];
  return run.phase === 'standing' && !!base && rank !== undefined && adjacent(rank, base.rank, true);
}

export function aspenReceive(run: AspenRun, rank: Rank, foundation: number): AspenRun {
  const hp = run.hp - 1;
  return { ...run, hp, phase: hp ? 'standing' : 'falling',
    foundations: run.foundations.map((base, i) => i === foundation ? { ...base, rank } : base) };
}

export function aspenPlay(run: AspenRun, pile: number, foundation: number): AspenRun {
  if (!aspenAccepts(run, pile, foundation)) return run;
  const cards = run.piles[pile];
  return { ...aspenReceive(run, cards[cards.length - 1], foundation),
    piles: run.piles.map((col, i) => i === pile ? col.slice(0, -1) : col) };
}

export function aspenDraw(run: AspenRun, foundation: number): AspenRun {
  if (run.phase !== 'standing' || !run.foundations[foundation]) return run;
  // Cycle through all ranks when the initial stock runs out, so a bad branch can recover.
  const stock = run.stock.length ? run.stock : Array.from({ length: 13 }, (_, i) => (i + 1) as Rank);
  return { ...run, stock: stock.slice(0, -1), foundations: run.foundations.map((base, i) =>
    i === foundation ? { ...base, rank: stock[stock.length - 1] } : base) };
}
