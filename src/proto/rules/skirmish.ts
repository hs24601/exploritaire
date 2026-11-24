import type { Card } from '../protoState';
import { isAdjacentRank } from './setup';

// A real-time skirmish played as golf solitaire. Pure: no React or DOM; the
// view steps it on animation frames.
//
// The hero and the enemy share one tableau of face-up columns and each keeps
// a foundation. Either side takes the top card of a column onto its own
// foundation when it is one rank away (A and K wrap), as in golf.
//
// The hero strikes with every card played: each costs the enemy HP. Stuck, the
// hero draws from the stock (golf's draw) to turn up a new foundation card.
//
// The enemy plays on its own clock. Each beat it eyes one card it can take,
// telegraphed on the table, and takes it when the eye runs out. Every card it
// takes builds fury; full fury makes the next take a pounce that hits the hero.
// The skill is reacting in the moment: a hero who can play the eyed card first
// snaps it out of the enemy's jaws, which strikes harder, staggers the enemy
// and calms its fury. Nothing needs counting: the eyed card is marked.

export const SKIRMISH_COLUMNS = 7;
export const SKIRMISH_ROWS = 3;

export type SkirmishFoe = {
  id: string;
  label: string;
  glyph: string;
  maxHp: number;
  /** Takes needed to fill fury; the take that fills it is a pounce. */
  furyMax: number;
  pounceDamage: number;
  /** Seconds between a take and eyeing the next card. */
  rest: number;
  /** Seconds a card stays eyed before the enemy takes it. */
  eye: number;
  /** Seconds the pounce is telegraphed: a little longer, so it can be answered. */
  pounceEye: number;
  /** Extra rest after the hero snaps the eyed card. */
  stagger: number;
};

export const SHADOW_WOLF: SkirmishFoe = {
  id: 'shadow-wolf',
  label: 'Shadow Wolf',
  glyph: '🐺',
  maxHp: 12,
  furyMax: 3,
  pounceDamage: 3,
  rest: 0.7,
  eye: 1.6,
  pounceEye: 1.9,
  stagger: 1.2,
};

export const STRIKE_DAMAGE = 1;
export const SNAP_DAMAGE = 3;
/** Seconds before the enemy eyes its first card, so the hero can read the deal. */
export const SKIRMISH_OPENING = 1.5;

export type SkirmishEvent = {
  /** Increments with every event, so the view can replay an effect once. */
  id: number;
  kind: 'strike' | 'snap' | 'take' | 'pounce' | 'draw' | 'prowl';
  damage?: number;
};

export type SkirmishState = {
  seed: number;
  foe: SkirmishFoe;
  /** Cards dealt so far from the endless stock; the next one is card `dealt`. */
  dealt: number;
  /** Face-up columns; the last card of each is its top. */
  columns: Card[][];
  hero: { rank: number; hp: number; maxHp: number };
  enemy: { rank: number; hp: number; fury: number };
  /** The card the enemy is about to take, and seconds left before it does. */
  eye: { cardId: string; column: number; left: number; total: number; pounce: boolean } | null;
  /** Seconds before the enemy eyes its next card. */
  rest: number;
  time: number;
  result: 'won' | 'lost' | null;
  event: SkirmishEvent | null;
  /** Hero tallies for the outcome. */
  struck: number;
  snapped: number;
};

/** Deterministic hash of the seed and a counter, 0-1. */
const roll = (seed: number, n: number, salt = 0) => {
  let value = (seed ^ Math.imul(n + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
};

/** The endless stock: card `n` is always the same for a seed. */
export const stockCard = (seed: number, n: number): Card => ({ id: `skirmish-${seed}-${n}`, rank: 1 + Math.floor(roll(seed, n) * 13) });

const deal = (state: Pick<SkirmishState, 'seed' | 'dealt'>, count: number) => {
  const cards = Array.from({ length: count }, (_, index) => stockCard(state.seed, state.dealt + index));
  return { cards, dealt: state.dealt + count };
};

const tops = (columns: Card[][]) => columns.map((column) => column[column.length - 1] ?? null);

export const heroCanPlay = (state: SkirmishState, card: Card | null) => Boolean(card) && isAdjacentRank(card!.rank, state.hero.rank);
export const playableColumns = (state: SkirmishState) =>
  tops(state.columns).flatMap((card, column) => (heroCanPlay(state, card) ? [column] : []));

export const createSkirmish = (seed: number, hero: { hp: number; maxHp: number }, foe: SkirmishFoe = SHADOW_WOLF): SkirmishState => {
  const opening = deal({ seed, dealt: 0 }, SKIRMISH_COLUMNS * SKIRMISH_ROWS);
  const columns = Array.from({ length: SKIRMISH_COLUMNS }, (_, column) => opening.cards.slice(column * SKIRMISH_ROWS, (column + 1) * SKIRMISH_ROWS));
  // The hero opens one rank from a card on the table, so the first strike is there to find.
  const anchor = tops(columns)[Math.floor(roll(seed, 0, 1) * SKIRMISH_COLUMNS)]!;
  const heroRank = roll(seed, 1, 1) < 0.5 ? (anchor.rank === 13 ? 1 : anchor.rank + 1) : (anchor.rank === 1 ? 13 : anchor.rank - 1);
  return {
    seed,
    foe,
    dealt: opening.dealt,
    columns,
    hero: { rank: heroRank, hp: Math.max(1, hero.hp), maxHp: hero.maxHp },
    enemy: { rank: 1 + Math.floor(roll(seed, 2, 1) * 13), hp: foe.maxHp, fury: 0 },
    eye: null,
    rest: SKIRMISH_OPENING,
    time: 0,
    result: null,
    event: null,
    struck: 0,
    snapped: 0,
  };
};

const nextEvent = (state: SkirmishState, kind: SkirmishEvent['kind'], damage?: number): SkirmishEvent => ({ id: (state.event?.id ?? 0) + 1, kind, damage });

/** Takes the top card of a column; an emptied column is dealt a fresh one. */
const takeTop = (state: SkirmishState, column: number) => {
  const columns = state.columns.map((cards) => [...cards]);
  const card = columns[column].pop()!;
  let dealt = state.dealt;
  if (columns[column].length === 0) {
    const refill = deal(state, SKIRMISH_ROWS);
    columns[column] = refill.cards;
    dealt = refill.dealt;
  }
  return { card, columns, dealt };
};

/** The hero plays the top card of a column onto their foundation. Refused unless it is one rank away. */
export const heroPlay = (state: SkirmishState, column: number): SkirmishState => {
  if (state.result) return state;
  const top = tops(state.columns)[column];
  if (!top || !heroCanPlay(state, top)) return state;
  const snapped = state.eye?.cardId === top.id;
  const { card, columns, dealt } = takeTop(state, column);
  const damage = snapped ? SNAP_DAMAGE : STRIKE_DAMAGE;
  const hp = Math.max(0, state.enemy.hp - damage);
  // Taking a card the enemy did not eye can still uncover a new top, so its eye stays only if its card is still on top.
  return {
    ...state,
    columns,
    dealt,
    hero: { ...state.hero, rank: card.rank },
    enemy: { ...state.enemy, hp, fury: snapped ? Math.max(0, state.enemy.fury - 1) : state.enemy.fury },
    eye: snapped ? null : state.eye,
    rest: snapped ? state.foe.stagger : state.rest,
    result: hp <= 0 ? 'won' : null,
    event: nextEvent(state, snapped ? 'snap' : 'strike', damage),
    struck: state.struck + 1,
    snapped: state.snapped + (snapped ? 1 : 0),
  };
};

/** Golf's draw: the next stock card becomes the hero's foundation card. */
export const heroDraw = (state: SkirmishState): SkirmishState => {
  if (state.result) return state;
  const { cards: [card], dealt } = deal(state, 1);
  return { ...state, dealt, hero: { ...state.hero, rank: card.rank }, event: nextEvent(state, 'draw') };
};

/** The column the enemy eyes next: one of the cards it can take, picked by the seed. */
const pickEye = (state: SkirmishState) => {
  const options = tops(state.columns).flatMap((card, column) => (card && isAdjacentRank(card.rank, state.enemy.rank) ? [column] : []));
  if (options.length === 0) return null;
  return options[Math.floor(roll(state.seed, state.dealt + state.time * 1000, 3) * options.length)];
};

/** Advances the enemy's clock by `dt` seconds. */
export const stepSkirmish = (state: SkirmishState, dt: number): SkirmishState => {
  if (state.result) return state;
  let next: SkirmishState = { ...state, time: state.time + dt };
  // An eyed card that is no longer on top (the hero uncovered past it) is let go.
  if (next.eye && tops(next.columns)[next.eye.column]?.id !== next.eye.cardId) next = { ...next, eye: null, rest: Math.min(next.rest, 0.2) };
  if (next.eye) {
    const left = next.eye.left - dt;
    if (left > 0) return { ...next, eye: { ...next.eye, left } };
    const { card, columns, dealt } = takeTop(next, next.eye.column);
    const pounce = next.eye.pounce;
    const hp = pounce ? Math.max(0, next.hero.hp - next.foe.pounceDamage) : next.hero.hp;
    return {
      ...next,
      columns,
      dealt,
      eye: null,
      rest: next.foe.rest,
      hero: { ...next.hero, hp },
      enemy: { ...next.enemy, rank: card.rank, fury: pounce ? 0 : next.enemy.fury + 1 },
      result: hp <= 0 ? 'lost' : null,
      event: nextEvent(next, pounce ? 'pounce' : 'take', pounce ? next.foe.pounceDamage : undefined),
    };
  }
  const rest = next.rest - dt;
  if (rest > 0) return { ...next, rest };
  const column = pickEye(next);
  if (column === null) {
    // Nothing to take: the enemy prowls, turning up the next stock card as its own.
    const { cards: [card], dealt } = deal(next, 1);
    return { ...next, dealt, rest: next.foe.rest, enemy: { ...next.enemy, rank: card.rank }, event: nextEvent(next, 'prowl') };
  }
  const pounce = next.enemy.fury + 1 >= next.foe.furyMax;
  const total = pounce ? next.foe.pounceEye : next.foe.eye;
  return { ...next, rest: 0, eye: { cardId: tops(next.columns)[column]!.id, column, left: total, total, pounce } };
};

/** What a good player does: snap the eyed card if they can, else strike, else draw. Used by tests and a future auto-fight. */
export const bestSkirmishMove = (state: SkirmishState): { kind: 'play'; column: number } | { kind: 'draw' } => {
  const playable = playableColumns(state);
  if (state.eye && playable.includes(state.eye.column)) return { kind: 'play', column: state.eye.column };
  return playable.length ? { kind: 'play', column: playable[0] } : { kind: 'draw' };
};
