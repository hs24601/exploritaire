import { ACTOR_STAMINA_MAX, type Card } from '../protoState';
import { redrawFoundation, redrawOptions, type RedrawSource } from './redraw';
import { isAdjacentRank } from './setup';
import { stockCard } from './skirmish';
import { MAX_CHARGE, SPIRITS, attackFor, type AbilityEffect, type Attack, type PlayRule } from './battleAbilities';

// The Dark Woods battle: party actors build charge by playing tableau cards
// onto their foundations (golf adjacency), then spend it by dragging their
// ability onto an enemy. Enemies attack on their own timers (ATB bars).
// Pure: no React or DOM; the view steps `tickBattle` on animation frames.
//
// Abilities never consume foundation cards: an attack spends the actor's
// charge only, so the run on the foundation carries on and the next cards
// build a fresh charge. A hit from an enemy resets the struck actor's charge.
//
// Stagger: every attack fills the target's stagger gauge and knocks its attack
// timer back. A full gauge staggers the foe: its timer stops and it takes
// more damage from every source until the stagger wears off.

export type FoeProfile = {
  maxHp: number;
  /** Seconds for the attack timer to fill. */
  attackSeconds: number;
  damage: number;
  staggerMax: number;
  staggerSeconds: number;
  /** Gauge lost per second while not staggered. */
  staggerDecay: number;
  /** Damage taken multiplier while staggered. */
  vulnerability: number;
};

export const SLIME: FoeProfile = { maxHp: 14, attackSeconds: 7, damage: 2, staggerMax: 10, staggerSeconds: 4, staggerDecay: 0.4, vulnerability: 1.5 };

export const SLIME_ROSTER = [
  { id: 'dark-slime', name: 'Dark Slime' },
  { id: 'rear-slime', name: 'Rear Slime' },
  { id: 'small-slime', name: 'Small Slime' },
] as const;
export const MAX_FOES = SLIME_ROSTER.length;

export const PARTY_ROSTER = {
  hero: { name: 'Hero', maxHp: 12, rank: 2 },
  mochi: { name: 'Mochi', maxHp: 10, rank: 5 },
} as const;
export type PartyId = keyof typeof PARTY_ROSTER;

/** Columns stop taking dealt cards at this height, so the rack stays readable. */
export const MAX_COLUMN = 6;
/** Cards an emptied column is refilled with. */
export const REFILL = 2;

export type ActiveEffect = AbilityEffect & { left: number; tickIn: number };

export type BattleFoe = {
  id: string;
  name: string;
  profile: FoeProfile;
  hp: number;
  /** Attack timer, 0-1; the foe attacks when it fills. Below 0 is an opening delay. */
  timer: number;
  stagger: number;
  /** Seconds of stagger left; 0 when not staggered. */
  staggered: number;
  effects: ActiveEffect[];
  /** Hungry slimes (rules.hungry): own foundation rank, cards eaten since the last attack (+1 damage each), the card being eyed and seconds before eyeing the next. */
  rank: number;
  fed: number;
  eye: { cardId: string; column: number; left: number; total: number } | null;
  rest: number;
};

export type BattleActor = {
  id: PartyId;
  name: string;
  hp: number;
  maxHp: number;
  /** Foundation top rank and cards collected; never spent by attacks. */
  rank: number;
  count: number;
  charge: number;
  /** Foundation redraws left: each costs 1 (rules/redraw.ts). */
  stamina: number;
  spirits: string[];
};

export type BattleEvent = {
  id: number;
  kind: 'hit' | 'dot' | 'stagger' | 'ko' | 'enemy-hit' | 'down' | 'take' | 'trap' | 'snatch';
  targetId: string;
  amount?: number;
  label?: string;
};

export type BattleState = {
  seed: number;
  columns: Card[][];
  /** The opening deal's own stock, used before the endless seeded stock. */
  stock: Card[];
  dealt: number;
  party: BattleActor[];
  foes: BattleFoe[];
  /** Enemy timers wait for the party's first play. */
  started: boolean;
  time: number;
  result: 'won' | 'lost' | null;
  events: BattleEvent[];
  nextEventId: number;
  rules: BattleRules;
  /** Booby-trapped tableau cards, by card id: the attack waiting inside. */
  traps: Record<string, Trap>;
};

/**
 * Advanced rules a scenario can switch on.
 * hungry: slimes also eat from the shared table, golf-style from their own
 *   foundation. Each eyes a card (telegraphed), eats it when the eye runs out,
 *   and every card eaten adds 1 to its next attack. Playing the eyed card
 *   first snatches it: +1 bonus charge and the slime has to look again.
 * traps: an ability can be dropped on a tableau top card instead of a slime.
 *   The slime that eats that card takes the attack at TRAP_BONUS, which also
 *   opens the card beneath for the party. The party can't play a trapped
 *   card; it waits for a slime.
 */
export type BattleRules = { hungry: boolean; traps: boolean };
export const BASIC_RULES: BattleRules = { hungry: false, traps: false };
export type Trap = { actorId: string; name: string; damage: number; stagger: number; effects: AbilityEffect[] };

export const TRAP_BONUS = 1.5;
/** Seconds a hungry slime eyes a card before eating it, and rests after eating. */
export const EYE_SECONDS = 2.2;
export const FORAGE_REST = 2.5;
export const FED_MAX = 3;
/** Opening foundation ranks for hungry slimes. */
const FOE_RANKS = [9, 6, 12];

export type BattleSetup = {
  mochi?: boolean; slimes?: number; spirits?: Partial<Record<PartyId, string[]>>;
  /** Each actor's stamina coming in; defaults to full. */
  stamina?: Partial<Record<PartyId, number>>;
  seed?: number;
  rules?: Partial<BattleRules>;
};

const newActor = (id: PartyId, spirits: string[] = [], stamina = ACTOR_STAMINA_MAX): BattleActor => {
  const base = PARTY_ROSTER[id];
  return { id, name: base.name, hp: base.maxHp, maxHp: base.maxHp, rank: base.rank, count: 0, charge: 0, stamina, spirits: [...spirits] };
};

/** Each later slime's timer starts this far behind (a negative timer is a delay), so they don't strike in unison. */
export const FOE_TIMER_OFFSET = 0.35;

const newFoe = (index: number): BattleFoe => ({
  ...SLIME_ROSTER[index], profile: SLIME, hp: SLIME.maxHp, timer: -index * FOE_TIMER_OFFSET, stagger: 0, staggered: 0, effects: [],
  rank: FOE_RANKS[index], fed: 0, eye: null, rest: 1 + index * 0.9,
});

export const createBattle = (deal: { tableau: Card[][]; stock?: Card[] }, setup: BattleSetup = {}): BattleState => {
  const slimes = Math.max(1, Math.min(MAX_FOES, setup.slimes ?? 2));
  return {
    seed: setup.seed ?? 7,
    columns: deal.tableau.map((column) => [...column]),
    stock: [...(deal.stock ?? [])],
    dealt: 0,
    party: [
      newActor('hero', setup.spirits?.hero, setup.stamina?.hero),
      ...(setup.mochi === false ? [] : [newActor('mochi', setup.spirits?.mochi, setup.stamina?.mochi)]),
    ],
    foes: Array.from({ length: slimes }, (_, i) => newFoe(i)),
    started: false,
    time: 0,
    result: null,
    events: [],
    nextEventId: 1,
    rules: { ...BASIC_RULES, ...setup.rules },
    traps: {},
  };
};

const withEvents = (state: BattleState, events: Omit<BattleEvent, 'id'>[]): Pick<BattleState, 'events' | 'nextEventId'> => ({
  events: [...state.events, ...events.map((event, i) => ({ ...event, id: state.nextEventId + i }))].slice(-12),
  nextEventId: state.nextEventId + events.length,
});

const resultOf = (party: BattleActor[], foes: BattleFoe[]): BattleState['result'] =>
  foes.length && foes.every((foe) => foe.hp <= 0) ? 'won' : party.length && party.every((actor) => actor.hp <= 0) ? 'lost' : null;

export const actorAlive = (actor: BattleActor) => actor.hp > 0;
export const foeAlive = (foe: BattleFoe) => foe.hp > 0;

/** Next card from the stock: the deal's own first, then the endless seeded stock. */
const draw = (state: BattleState) => {
  if (state.stock.length) return { card: state.stock[0], stock: state.stock.slice(1), dealt: state.dealt };
  return { card: stockCard(state.seed, state.dealt), stock: state.stock, dealt: state.dealt + 1 };
};

/** Golf adjacency (A and K wrap). Spirits may add their own rules on top. */
export const BASE_PLAY_RULE: PlayRule = isAdjacentRank;

/** The legal-play check for one actor: the base rule or any rule its spirits bring. */
export const legalPlay = (actor: BattleActor, card: Card) =>
  BASE_PLAY_RULE(card.rank, actor.rank) || actor.spirits.some((id) => SPIRITS[id]?.playRule?.(card.rank, actor.rank));

export const canPlay = (state: BattleState, actorId: string, card: Card | undefined | null) => {
  const actor = state.party.find((a) => a.id === actorId);
  return Boolean(card && actor && actorAlive(actor) && !state.result && !state.traps[card.id] && legalPlay(actor, card));
};

/** Living actors that can take this card, in party order. */
export const eligibleActors = (state: BattleState, card: Card | undefined | null) =>
  state.party.filter((actor) => canPlay(state, actor.id, card));

/**
 * Takes a column's top card off the shared table, refilling an emptied column
 * so the table never runs dry. Any taker (party now, sentient foes later) goes
 * through here.
 */
export const takeTop = (state: BattleState, column: number) => {
  const cards = state.columns[column];
  const card = cards?.[cards.length - 1];
  if (!card) return null;
  let { stock, dealt } = state;
  const columns = state.columns.map((c, i) => (i === column ? c.slice(0, -1) : c));
  if (columns[column].length === 0) {
    const refill: Card[] = [];
    for (let i = 0; i < REFILL; i += 1) { const next = draw({ ...state, stock, dealt }); refill.push(next.card); stock = next.stock; dealt = next.dealt; }
    columns[column] = refill;
  }
  return { card, columns, stock, dealt };
};

/** Plays a column's top card onto an actor's foundation, adding one charge. */
export const playCard = (state: BattleState, column: number, actorId: string): BattleState => {
  const cards = state.columns[column];
  if (!canPlay(state, actorId, cards?.[cards.length - 1])) return state;
  const { card, columns, stock, dealt } = takeTop(state, column)!;
  // Snatching a card a hungry slime is eyeing earns a bonus charge and sends it looking again.
  const snatchedFrom = state.foes.find((foe) => foe.eye?.cardId === card.id);
  const gain = snatchedFrom ? 2 : 1;
  return {
    ...state, columns, stock, dealt, started: true,
    party: state.party.map((actor) => actor.id === actorId
      ? { ...actor, rank: card.rank, count: actor.count + 1, charge: Math.min(MAX_CHARGE, actor.charge + gain) } : actor),
    foes: snatchedFrom ? state.foes.map((foe) => (foe === snatchedFrom ? { ...foe, eye: null, rest: 1 } : foe)) : state.foes,
    ...(snatchedFrom ? withEvents(state, [{ kind: 'snatch', targetId: actorId, label: snatchedFrom.name }]) : {}),
  };
};

/** The redraws an actor can choose from: a random draw, plus a fixed value from each spirit that offers one. */
export const actorRedrawOptions = (actor: BattleActor) => redrawOptions(actor.spirits.flatMap((id) => (SPIRITS[id] ? [SPIRITS[id]] : [])));

/**
 * Stuck: the actor abandons their foundation value for a new one at 1
 * stamina. Charge and collected cards are untouched. Refused at 0 stamina.
 */
export const redrawActor = (state: BattleState, actorId: string, source: RedrawSource = { kind: 'draw' }, random?: number): BattleState => {
  const actor = state.party.find((a) => a.id === actorId);
  if (!actor || !actorAlive(actor) || state.result) return state;
  if (source.kind === 'spirit' && !actor.spirits.includes(source.spiritId)) return state;
  const next = redrawFoundation(actor, source, random);
  if (!next) return state;
  return { ...state, party: state.party.map((a) => (a.id === actorId ? { ...a, rank: next.rank, stamina: next.stamina } : a)) };
};

/** Golf's draw for a shared table: one card onto every column with room. Foundations and charge are untouched. */
export const dealRow = (state: BattleState): BattleState => {
  if (state.result) return state;
  let { stock, dealt } = state;
  const columns = state.columns.map((column) => {
    if (column.length >= MAX_COLUMN) return column;
    const next = draw({ ...state, stock, dealt });
    stock = next.stock; dealt = next.dealt;
    return [...column, next.card];
  });
  return { ...state, columns, stock, dealt };
};

export const canDeal = (state: BattleState) => !state.result && state.columns.some((column) => column.length < MAX_COLUMN);

/** The attack an actor would make now, with its spirits. */
export const actorAttack = (state: BattleState, actorId: string): Attack | null => {
  const actor = state.party.find((a) => a.id === actorId);
  return actor && actorAlive(actor) ? attackFor(actor.id, actor.charge, actor.spirits) : null;
};

const scaled = (foe: BattleFoe, amount: number) => (foe.staggered > 0 ? Math.round(amount * foe.profile.vulnerability) : amount);

/** Spends an actor's charge on a foe. The drop and the drag preview both use this. */
export const applyAttack = (state: BattleState, actorId: string, foeId: string): BattleState => {
  const attack = actorAttack(state, actorId);
  const target = state.foes.find((foe) => foe.id === foeId);
  if (!attack || !target || !foeAlive(target) || state.result) return state;
  const events: Omit<BattleEvent, 'id'>[] = [];
  const damage = scaled(target, attack.damage);
  const hp = Math.max(0, target.hp - damage);
  events.push({ kind: 'hit', targetId: foeId, amount: damage, label: attack.name });
  let { stagger, staggered, timer } = target;
  if (staggered <= 0) {
    stagger = Math.min(target.profile.staggerMax, stagger + attack.stagger);
    // Knockback never pulls the timer below 0, but a timer still in its opening delay keeps it.
    timer = Math.max(Math.min(timer, 0), timer - attack.knockback);
    if (stagger >= target.profile.staggerMax && hp > 0) {
      staggered = target.profile.staggerSeconds;
      events.push({ kind: 'stagger', targetId: foeId });
    }
  }
  // A fresh effect of the same kind refreshes the old one rather than stacking.
  const effects = hp > 0 ? [
    ...target.effects.filter((effect) => !attack.effects.some((next) => next.kind === effect.kind)),
    ...attack.effects.map((effect) => ({ ...effect, left: effect.seconds, tickIn: 1 })),
  ] : [];
  if (hp <= 0) events.push({ kind: 'ko', targetId: foeId });
  const foes = state.foes.map((foe) => (foe.id === foeId ? { ...foe, hp, stagger: hp > 0 ? stagger : 0, staggered: hp > 0 ? staggered : 0, timer: hp > 0 ? timer : 0, effects } : foe));
  const party = state.party.map((actor) => (actor.id === actorId ? { ...actor, charge: 0 } : actor));
  return { ...state, started: true, party, foes, result: resultOf(party, foes), ...withEvents(state, events) };
};

export type AttackPreview = {
  attack: Attack;
  foeId: string;
  damage: number;
  hp: { before: number; after: number; max: number };
  stagger: { before: number; after: number; max: number };
  timer: { before: number; after: number };
  /** The attack fills the gauge and staggers the foe. */
  staggers: boolean;
  /** Already staggered: the bonus damage applies. */
  vulnerable: boolean;
  ko: boolean;
  effects: AbilityEffect[];
};

/** What dropping this actor's attack on a foe would do: the same rules as the drop. */
export const previewAttack = (state: BattleState, actorId: string, foeId: string): AttackPreview | null => {
  const attack = actorAttack(state, actorId);
  const before = state.foes.find((foe) => foe.id === foeId);
  if (!attack || !before || !foeAlive(before) || state.result) return null;
  const after = applyAttack(state, actorId, foeId).foes.find((foe) => foe.id === foeId)!;
  const ko = after.hp <= 0;
  return {
    attack, foeId,
    damage: before.hp - after.hp,
    hp: { before: before.hp, after: after.hp, max: before.profile.maxHp },
    stagger: { before: before.stagger, after: ko ? before.stagger : after.stagger, max: before.profile.staggerMax },
    timer: { before: before.timer, after: ko ? before.timer : after.timer },
    staggers: before.staggered <= 0 && after.staggered > 0,
    vulnerable: before.staggered > 0,
    ko,
    effects: ko ? [] : attack.effects,
  };
};

/** Who the foes go for: the living actor holding the most charge (ties: party order). */
export const enemyTarget = (state: BattleState) =>
  state.party.filter(actorAlive).reduce<BattleActor | null>((best, actor) => (!best || actor.charge > best.charge ? actor : best), null);

/** Advances every foe's clock by `dt` seconds. */
export const tickBattle = (state: BattleState, dt: number): BattleState => {
  if (!state.started || state.result || dt <= 0) return state;
  const events: Omit<BattleEvent, 'id'>[] = [];
  let party = state.party;
  const foes = state.foes.map((foe) => {
    if (!foeAlive(foe)) return foe;
    let { hp, timer, stagger, staggered } = foe;
    const effects: ActiveEffect[] = [];
    for (const effect of foe.effects) {
      let { left, tickIn } = effect;
      left -= dt; tickIn -= dt;
      if (tickIn <= 0 && hp > 0) {
        const amount = scaled(foe, effect.dps);
        hp = Math.max(0, hp - amount);
        events.push({ kind: 'dot', targetId: foe.id, amount, label: effect.kind });
        tickIn += 1;
      }
      if (left > 0.001) effects.push({ ...effect, left, tickIn });
    }
    if (hp <= 0) { events.push({ kind: 'ko', targetId: foe.id }); return { ...foe, hp: 0, timer: 0, stagger: 0, staggered: 0, effects: [] }; }
    if (staggered > 0) {
      staggered = Math.max(0, staggered - dt);
      if (staggered === 0) stagger = 0;
      return { ...foe, hp, stagger, staggered, effects };
    }
    stagger = Math.max(0, stagger - foe.profile.staggerDecay * dt);
    timer += dt / foe.profile.attackSeconds;
    if (timer >= 1) {
      timer = 0;
      const target = enemyTarget({ ...state, party });
      if (target) {
        const damage = foe.profile.damage + foe.fed;
        const hpLeft = Math.max(0, target.hp - damage);
        party = party.map((actor) => (actor.id === target.id ? { ...actor, hp: hpLeft, charge: 0 } : actor));
        events.push({ kind: 'enemy-hit', targetId: target.id, amount: damage, label: foe.name });
        if (hpLeft <= 0) events.push({ kind: 'down', targetId: target.id });
        return { ...foe, hp, timer, stagger, staggered, effects, fed: 0 };
      }
    }
    return { ...foe, hp, timer, stagger, staggered, effects };
  });
  let next: BattleState = { ...state, time: state.time + dt, party, foes, result: resultOf(party, foes), ...(events.length ? withEvents(state, events) : {}) };
  if (next.rules.hungry && !next.result) next.foes.forEach((foe) => { next = forage(next, foe.id, dt); });
  return next;
};

/** One hungry slime's turn at the shared table. */
const forage = (state: BattleState, foeId: string, dt: number): BattleState => {
  const foe = state.foes.find((f) => f.id === foeId)!;
  const update = (patch: Partial<BattleFoe>, base: BattleState = state) => ({ ...base, foes: base.foes.map((f) => (f.id === foeId ? { ...f, ...patch } : f)) });
  if (!foeAlive(foe) || foe.staggered > 0) return foe.eye ? update({ eye: null, rest: FORAGE_REST }) : state;
  const top = (column: number) => { const cards = state.columns[column]; return cards[cards.length - 1]; };
  if (foe.eye) {
    // The eyed card went (the party took it): look again soon.
    if (top(foe.eye.column)?.id !== foe.eye.cardId) return update({ eye: null, rest: 0.6 });
    const left = foe.eye.left - dt;
    if (left > 0) return update({ eye: { ...foe.eye, left } });
    return eat(state, foeId, foe.eye.column);
  }
  const rest = foe.rest - dt;
  if (rest > 0) return update({ rest });
  const eyed = new Set(state.foes.map((f) => f.eye?.cardId).filter(Boolean));
  const options = state.columns.flatMap((_, column) => {
    const card = top(column);
    return card && !eyed.has(card.id) && isAdjacentRank(card.rank, foe.rank) ? [column] : [];
  });
  if (!options.length) {
    // Nothing to eat: the slime turns up the next stock card as its own.
    const next = draw(state);
    return update({ rank: next.card.rank, rest: FORAGE_REST }, { ...state, stock: next.stock, dealt: next.dealt });
  }
  const column = options[(state.dealt + state.foes.indexOf(foe) + Math.floor(state.time)) % options.length];
  return update({ eye: { cardId: top(column).id, column, left: EYE_SECONDS, total: EYE_SECONDS } });
};

/** A slime eats a column's top card; a trap inside goes off. */
const eat = (state: BattleState, foeId: string, column: number): BattleState => {
  const taken = takeTop(state, column)!;
  const trap = state.traps[taken.card.id];
  const { [taken.card.id]: _sprung, ...traps } = state.traps;
  const events: Omit<BattleEvent, 'id'>[] = [{ kind: 'take', targetId: foeId, label: String(taken.card.rank) }];
  const foes = state.foes.map((foe) => {
    if (foe.id !== foeId) return foe;
    let next: BattleFoe = { ...foe, rank: taken.card.rank, fed: Math.min(FED_MAX, foe.fed + 1), eye: null, rest: FORAGE_REST };
    if (trap) {
      const damage = Math.round(scaled(foe, trap.damage) * TRAP_BONUS);
      const hp = Math.max(0, foe.hp - damage);
      events.push({ kind: 'trap', targetId: foeId, amount: damage, label: trap.name });
      let { stagger, staggered } = foe;
      if (staggered <= 0) {
        stagger = Math.min(foe.profile.staggerMax, stagger + trap.stagger);
        if (stagger >= foe.profile.staggerMax && hp > 0) { staggered = foe.profile.staggerSeconds; events.push({ kind: 'stagger', targetId: foeId }); }
      }
      // A trap spoils the meal: the card doesn't feed the slime.
      next = { ...next, hp, stagger, staggered, fed: foe.fed, effects: hp > 0 ? [...foe.effects.filter((e) => !trap.effects.some((t) => t.kind === e.kind)), ...trap.effects.map((e) => ({ ...e, left: e.seconds, tickIn: 1 }))] : [] };
      if (hp <= 0) { events.push({ kind: 'ko', targetId: foeId }); next = { ...next, stagger: 0, staggered: 0, timer: 0, eye: null }; }
    }
    return next;
  });
  return { ...state, columns: taken.columns, stock: taken.stock, dealt: taken.dealt, traps, foes, result: resultOf(state.party, foes), ...withEvents(state, events) };
};

/** Spends an actor's charge arming a trap in a column's top card (rules.traps). */
export const applyTrap = (state: BattleState, actorId: string, column: number): BattleState => {
  const attack = actorAttack(state, actorId);
  const cards = state.columns[column];
  const card = cards?.[cards.length - 1];
  if (!state.rules.traps || !attack || !card || state.traps[card.id] || state.result) return state;
  return {
    ...state, started: true,
    traps: { ...state.traps, [card.id]: { actorId, name: attack.name, damage: attack.damage, stagger: attack.stagger, effects: attack.effects } },
    party: state.party.map((actor) => (actor.id === actorId ? { ...actor, charge: 0 } : actor)),
  };
};

/** What a trap set now would deal to an unstaggered slime that eats it. */
export const previewTrap = (state: BattleState, actorId: string, column: number) => {
  const attack = actorAttack(state, actorId);
  const cards = state.columns[column];
  const card = cards?.[cards.length - 1];
  if (!state.rules.traps || !attack || !card || state.traps[card.id] || state.result) return null;
  return { attack, cardId: card.id, damage: Math.round(attack.damage * TRAP_BONUS), eyedBy: state.foes.find((foe) => foe.eye?.cardId === card.id)?.name ?? null };
};

// Roster controls for the battle panel.

export const setMochi = (state: BattleState, present: boolean): BattleState => {
  const has = state.party.some((actor) => actor.id === 'mochi');
  if (has === present) return state;
  const party = present ? [...state.party, newActor('mochi')] : state.party.filter((actor) => actor.id !== 'mochi');
  return { ...state, party, result: resultOf(party, state.foes) };
};

export const addSlime = (state: BattleState): BattleState => {
  const free = SLIME_ROSTER.findIndex((slot) => !state.foes.some((foe) => foe.id === slot.id));
  if (free < 0) return state;
  const foes = [...state.foes, newFoe(free)].sort((a, b) => SLIME_ROSTER.findIndex((s) => s.id === a.id) - SLIME_ROSTER.findIndex((s) => s.id === b.id));
  return { ...state, foes, result: resultOf(state.party, foes) };
};

export const removeSlime = (state: BattleState): BattleState => {
  if (state.foes.length <= 1) return state;
  const foes = state.foes.slice(0, -1);
  return { ...state, foes, result: resultOf(state.party, foes) };
};

export const setSpirit = (state: BattleState, actorId: string, spiritId: string, on: boolean): BattleState => ({
  ...state,
  party: state.party.map((actor) => actor.id !== actorId ? actor : {
    ...actor, spirits: on ? [...new Set([...actor.spirits, spiritId])] : actor.spirits.filter((id) => id !== spiritId),
  }),
});
