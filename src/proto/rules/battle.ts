import { ACTOR_INSPIRATION_MAX, type Card } from '../protoState';
import { redrawFoundation, redrawOptions, type RedrawSource } from './redraw';
import { isAdjacentRank } from './setup';
import { stockCard } from './skirmish';
import { applyHitEffects, bleedChance, BLEED } from './battleEffects';
import { MAX_CHARGE, combatMovesFor, gripDuration, SPIRITS, attackFor, type AbilityEffect, type Attack, type PlayRule } from './battleAbilities';

// The Dark Woods battle: party actors build charge by playing tableau cards
// onto their foundations (golf adjacency), then spend it by dragging their
// ability onto an enemy. Enemies attack on their own timers (ATB bars).
// Pure: no React or DOM; the view steps `tickBattle` on animation frames.
//
// Abilities never consume foundation cards: an attack spends the actor's
// AP cost only. The foundation run and remaining AP survive both attacks
// and enemy hits. Ability drag keys include actor, move and optional hold AP.
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
  banks: { name: 'Banks', maxHp: 80, rank: 9 },
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
  gripSource?: string;
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
  /** Banked action points; no cap. The field name is retained for existing integrations. */
  charge: number;
  /** Foundation redraws left: each costs 1 (rules/redraw.ts). */
  inspiration: number;
  spirits: string[];
};

export type BattleEvent = {
  id: number;
  kind: 'hit' | 'dot' | 'stagger' | 'ko' | 'enemy-hit' | 'down' | 'take' | 'trap' | 'snatch';
  targetId: string;
  /** Who acted: the attacker for hits, the slime for enemy hits, the trap's setter for traps. */
  sourceId?: string;
  amount?: number;
  label?: string;
};

export type BattleState = {
  /** Temporary debug override: abilities are available and do not debit banked AP. */
  maxAP: boolean;
  seed: number;
  effectSeed: number;
  columns: Card[][];
  /** The opening deal's own stock, used before the endless seeded stock. */
  stock: Card[];
  dealt: number;
  party: BattleActor[];
  foes: BattleFoe[];
  /** Enemy timers wait for the party's first play. */
  started: boolean;
  /** Opening player ambush: charge freely, then gain ten seconds after the first hit. */
  ambush: { awaitingAttack: boolean; remaining: number } | null;
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
export type BattleRules = { hungry: boolean; traps: boolean; finiteTableau?: boolean };
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
  maxAP?: boolean;
  playerAmbush?: boolean;
  mochi?: boolean; slimes?: number; spirits?: Partial<Record<PartyId, string[]>>;
  /** Each actor's inspiration coming in; defaults to full. */
  inspiration?: Partial<Record<PartyId, number>>;
  seed?: number;
  rules?: Partial<BattleRules>;
};

const newActor = (id: PartyId, spirits: string[] = [], inspiration = ACTOR_INSPIRATION_MAX): BattleActor => {
  const base = PARTY_ROSTER[id];
  return { id, name: base.name, hp: base.maxHp, maxHp: base.maxHp, rank: base.rank, count: 0, charge: 0, inspiration, spirits: [...spirits] };
};

/** Each later slime's timer starts this far behind (a negative timer is a delay), so they don't strike in unison. */
export const FOE_TIMER_OFFSET = 0.35;
export const PLAYER_AMBUSH_SECONDS = 10;

const newFoe = (index: number): BattleFoe => ({
  ...SLIME_ROSTER[index], profile: SLIME, hp: SLIME.maxHp, timer: -index * FOE_TIMER_OFFSET, stagger: 0, staggered: 0, effects: [],
  rank: FOE_RANKS[index], fed: 0, eye: null, rest: 1 + index * 0.9,
});

export const createBattle = (deal: { tableau: Card[][]; stock?: Card[] }, setup: BattleSetup = {}): BattleState => {
  const slimes = Math.max(1, Math.min(MAX_FOES, setup.slimes ?? 2));
  return {
    maxAP: setup.maxAP ?? false,
    seed: setup.seed ?? 7,
    effectSeed: setup.seed ?? 7,
    columns: deal.tableau.map((column) => [...column]),
    stock: [...(deal.stock ?? [])],
    dealt: 0,
    party: [
      newActor('hero', setup.spirits?.hero, setup.inspiration?.hero),
      ...(setup.mochi === false ? [] : [newActor('mochi', setup.spirits?.mochi, setup.inspiration?.mochi)]),
    ],
    foes: Array.from({ length: slimes }, (_, i) => newFoe(i)),
    started: false,
    ambush: setup.playerAmbush ? { awaitingAttack: true, remaining: PLAYER_AMBUSH_SECONDS } : null,
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
  if (columns[column].length === 0 && !state.rules.finiteTableau) {
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
      ? { ...actor, rank: card.rank, count: actor.count + 1, charge: actor.charge + gain } : actor),
    foes:state.foes.map(foe=>({...foe,...(foe===snatchedFrom?{eye:null,rest:1}:{}),effects:foe.effects.map(e=>e.kind==='grip' && foe.gripSource===actorId?{...e,gripBudget:(e.gripBudget ?? e.seconds)+3,left:e.left+gripDuration((e.gripBudget ?? e.seconds)+3)-gripDuration(e.gripBudget ?? e.seconds)}:e)})),
    ...(snatchedFrom ? withEvents(state, [{ kind: 'snatch', targetId: actorId, label: snatchedFrom.name }]) : {}),
  };
};

/** The redraws an actor can choose from: a random draw, plus a fixed value from each spirit that offers one. */
export const actorRedrawOptions = (actor: BattleActor) => redrawOptions(actor.spirits.flatMap((id) => (SPIRITS[id] ? [SPIRITS[id]] : [])));

/**
 * Stuck: the actor abandons their foundation value for a new one at 1
 * inspiration. Charge and collected cards are untouched. Refused at 0 inspiration.
 */
export const redrawActor = (state: BattleState, actorId: string, source: RedrawSource = { kind: 'draw' }, random?: number): BattleState => {
  const actor = state.party.find((a) => a.id === actorId);
  if (!actor || !actorAlive(actor) || state.result) return state;
  if (source.kind === 'spirit' && !actor.spirits.includes(source.spiritId)) return state;
  const next = redrawFoundation(actor, source, random);
  if (!next) return state;
  return { ...state, party: state.party.map((a) => (a.id === actorId ? { ...a, rank: next.rank, inspiration: next.inspiration } : a)) };
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
  const [id, choice, points] = actorId.split(':');
  const actor = state.party.find(a => a.id === id);
  const requested = points ? Math.max(3, Math.floor(Number(points))) : undefined;
  const available = state.maxAP ? Math.max(actor?.charge ?? 0, MAX_CHARGE, requested ?? 0) : actor?.charge ?? 0;
  const committed = requested === undefined ? available : Math.min(available, requested);
  return actor && actorAlive(actor) && Number.isFinite(committed) ? attackFor(actor.id, committed, actor.spirits, choice) : null;
};

const scaled = (foe: BattleFoe, amount: number) => (foe.staggered > 0 ? Math.round(amount * foe.profile.vulnerability) : amount);

/** Inspection describes an authored ability even when the actor cannot afford it.
 * This never changes eligibility: actorAttack remains the gate for real plays.
 */
export const inspectActorAbility = (state: BattleState, key: string): Attack | null => {
  const [id, choice, points] = key.split(':');
  const actor = state.party.find(actor => actor.id === id);
  const move = combatMovesFor(id).find(move => move.name === choice);
  if (!actor || !move) return null;
  const requested = points ? Math.max(move.cost, Math.floor(Number(points))) : move.cost;
  return Number.isFinite(requested) ? attackFor(id, requested, actor.spirits, choice) : null;
};

/** Spends the selected AP cost on a foe. The drop and preview share this rule. */
export const applyAttack = (state: BattleState, actorId: string, foeId: string): BattleState => {
  const attack = actorAttack(state, actorId);
  actorId=actorId.split(':')[0];
  const friendly = state.party.find(actor => actor.id === foeId);
  if (friendly) {
    if (!attack || !actorAlive(friendly) || state.result) return state;
    const hp = Math.max(0, friendly.hp - attack.damage);
    const party = spendActorAP(state, actorId, attack.charge).map(actor => actor.id === foeId ? { ...actor, hp } : actor);
    const events: Omit<BattleEvent, 'id'>[] = [{ kind: 'hit', targetId: foeId, sourceId: actorId, amount: attack.damage, label: attack.name }];
    if (hp <= 0) events.push({ kind: 'down', targetId: foeId, sourceId: actorId });
    return { ...state, party, started: true, ambush: state.ambush?.awaitingAttack ? { awaitingAttack: false, remaining: PLAYER_AMBUSH_SECONDS } : state.ambush,
      result: resultOf(party, state.foes), ...withEvents(state, events) };
  }
  const target = state.foes.find((foe) => foe.id === foeId);
  if (!attack || !target || !foeAlive(target) || state.result) return state;
  const events: Omit<BattleEvent, 'id'>[] = [];
  const damage = scaled(target, attack.damage+(attack.form==='Nip' && target.effects.some(e=>e.kind==='bleed' && e.left>0)?1:0));
  const hp = Math.max(0, target.hp - damage);
  events.push({ kind: 'hit', targetId: foeId, sourceId: actorId, amount: damage, label: attack.name });
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
  const resolved = applyHitEffects(target.effects, attack.effects, state.effectSeed);
  const effects = hp > 0 ? resolved.effects : [];
  if (attack.form === 'Takedown') timer = Math.min(0, timer);
  if (hp <= 0) events.push({ kind: 'ko', targetId: foeId });
  const foes = state.foes.map((foe) => (foe.id === foeId ? { ...foe, gripSource:attack.form==='Vice Grip'?actorId:target.gripSource, ...(attack.form==='Takedown'?{eye:null,rest:FORAGE_REST}:{}), hp, stagger: hp > 0 ? stagger : 0, staggered: hp > 0 ? staggered : 0, timer: hp > 0 ? timer : 0, effects:effects.filter(e=>e.kind!=='grip'||attack.form==='Vice Grip'||target.gripSource!==actorId) } : {...foe,effects:foe.effects.filter(e=>e.kind!=='grip'||foe.gripSource!==actorId)}));
  const party = spendActorAP(state, actorId, attack.charge);
  return { ...state, effectSeed: resolved.seed, started: true, ambush: state.ambush?.awaitingAttack ? { awaitingAttack: false, remaining: PLAYER_AMBUSH_SECONDS } : state.ambush, party, foes, result: resultOf(party, foes), ...withEvents(state, events) };
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
  const friendly = state.party.find(actor => actor.id === foeId);
  if (friendly) {
    if (!attack || !actorAlive(friendly) || state.result) return null;
    const after = applyAttack(state, actorId, foeId).party.find(actor => actor.id === foeId)!;
    return { attack, foeId, damage: friendly.hp - after.hp, hp: { before: friendly.hp, after: after.hp, max: friendly.maxHp },
      stagger: { before: 0, after: 0, max: 0 }, timer: { before: 0, after: 0 }, staggers: false, vulnerable: false, ko: after.hp <= 0, effects: [] };
  }
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
    effects: ko ? [] : [...attack.effects.filter(e=>e.kind!=='bleed'), ...(bleedChance(before.effects,attack.effects)>0 ? [{...BLEED,chance:bleedChance(before.effects,attack.effects)}] : [])],
  };
};

/** Who the foes go for: the living actor holding the most charge (ties: party order). */
export const enemyTarget = (state: BattleState) =>
  state.party.filter(actorAlive).reduce<BattleActor | null>((best, actor) => (!best || actor.charge > best.charge ? actor : best), null);

/** Advances every foe's clock by `dt` seconds. */
export const tickBattle = (state: BattleState, dt: number): BattleState => {
  if (!state.started || state.result || dt <= 0) return state;
  const heldSeconds = state.ambush ? (state.ambush.awaitingAttack ? dt : Math.min(dt, state.ambush.remaining)) : 0;
  const enemyDt = dt - heldSeconds;
  const ambush = state.ambush && !state.ambush.awaitingAttack
    ? (state.ambush.remaining - dt > 0.001 ? { awaitingAttack: false, remaining: state.ambush.remaining - dt } : null)
    : state.ambush;
  const events: Omit<BattleEvent, 'id'>[] = [];
  let party = state.party;
  const foes = state.foes.map((foe) => {
    if (!foeAlive(foe)) return foe;
    let { hp, timer, stagger, staggered } = foe;
    const effects: ActiveEffect[] = [];
    for (const effect of foe.effects) {
      if(effect.kind === "grip" && !party.some(a=>a.id===foe.gripSource && a.hp>0)) continue;
      let { left, tickIn } = effect;
      const elapsed = Math.min(dt, left);
      left -= dt; tickIn -= elapsed;
      while (tickIn <= 0.000001 && hp > 0 && effect.dps > 0) {
        const amount = scaled(foe, effect.dps);
        hp = Math.max(0, hp - amount);
        events.push({ kind: 'dot', targetId: foe.id, amount, label: effect.kind });
        tickIn += 1;
      }
      if (left > 0.001) effects.push({ ...effect, left, tickIn });
    }
    if (hp <= 0) { events.push({ kind: 'ko', targetId: foe.id }); return { ...foe, hp: 0, timer: 0, stagger: 0, staggered: 0, effects: [] }; }
    const held=foe.effects.filter(e=>e.kind==='stun'||(e.kind==='grip' && party.some(a=>a.id===foe.gripSource && a.hp>0)));
    const freeDt=Math.max(0,enemyDt-Math.max(0,...held.map(e=>Math.max(0,e.left-heldSeconds))));
    if (staggered > 0) {
      staggered = Math.max(0, staggered - dt);
      if (staggered === 0) stagger = 0;
      return { ...foe, hp, stagger, staggered, effects };
    }
    stagger = Math.max(0, stagger - foe.profile.staggerDecay * dt);
    if (enemyDt > 0) timer += freeDt / foe.profile.attackSeconds;
    if (freeDt > 0 && timer >= 1) {
      timer = 0;
      const target = enemyTarget({ ...state, party });
      if (target) {
        const damage = foe.profile.damage + foe.fed;
        const hpLeft = Math.max(0, target.hp - damage);
        party = party.map((actor) => (actor.id === target.id ? { ...actor, hp: hpLeft } : actor));
        events.push({ kind: 'enemy-hit', targetId: target.id, sourceId: foe.id, amount: damage, label: foe.name });
        if (hpLeft <= 0) events.push({ kind: 'down', targetId: target.id, sourceId: foe.id });
        return { ...foe, hp, timer, stagger, staggered, effects, fed: 0 };
      }
    }
    return { ...foe, hp, timer, stagger, staggered, effects };
  });
  let next: BattleState = { ...state, ambush, time: state.time + dt, party, foes, result: resultOf(party, foes), ...(events.length ? withEvents(state, events) : {}) };
  if (enemyDt > 0 && next.rules.hungry && !next.result) next.foes.forEach((foe) => { next = forage(next, foe.id, enemyDt); });
  return next;
};

/** One hungry slime's turn at the shared table. */
const forage = (state: BattleState, foeId: string, dt: number): BattleState => {
  const foe = state.foes.find((f) => f.id === foeId)!;
  const update = (patch: Partial<BattleFoe>, base: BattleState = state) => ({ ...base, foes: base.foes.map((f) => (f.id === foeId ? { ...f, ...patch } : f)) });
  if (!foeAlive(foe) || foe.staggered > 0 || foe.effects.some(e=>e.kind==='stun'||e.kind==='grip')) return foe.eye ? update({ eye: null, rest: FORAGE_REST }) : state;
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
  let effectSeed = state.effectSeed;
  const foes = state.foes.map((foe) => {
    if (foe.id !== foeId) return foe;
    let next: BattleFoe = { ...foe, rank: taken.card.rank, fed: Math.min(FED_MAX, foe.fed + 1), eye: null, rest: FORAGE_REST };
    if (trap) {
      const damage = Math.round(scaled(foe, trap.damage) * TRAP_BONUS);
      const hp = Math.max(0, foe.hp - damage);
      events.push({ kind: 'trap', targetId: foeId, sourceId: trap.actorId, amount: damage, label: trap.name });
      let { stagger, staggered } = foe;
      if (staggered <= 0) {
        stagger = Math.min(foe.profile.staggerMax, stagger + trap.stagger);
        if (stagger >= foe.profile.staggerMax && hp > 0) { staggered = foe.profile.staggerSeconds; events.push({ kind: 'stagger', targetId: foeId }); }
      }
      // A trap spoils the meal: the card doesn't feed the slime.
      const resolved = applyHitEffects(foe.effects, trap.effects, effectSeed); effectSeed = resolved.seed;
      next = { ...next, hp, stagger, staggered, fed: foe.fed, effects: hp > 0 ? resolved.effects : [] };
      if (hp <= 0) { events.push({ kind: 'ko', targetId: foeId }); next = { ...next, stagger: 0, staggered: 0, timer: 0, eye: null }; }
    }
    return next;
  });
  return { ...state, effectSeed, columns: taken.columns, stock: taken.stock, dealt: taken.dealt, traps, foes, result: resultOf(state.party, foes), ...withEvents(state, events) };
};

/** Spends an actor's charge arming a trap in a column's top card (rules.traps). */
export const applyTrap = (state: BattleState, actorId: string, column: number): BattleState => {
  const attack = actorAttack(state, actorId);
  actorId = actorId.split(':')[0];
  const cards = state.columns[column];
  const card = cards?.[cards.length - 1];
  if (!state.rules.traps || attack?.form==='Vice Grip' || !attack || !card || state.traps[card.id] || state.result) return state;
  state = releaseGrip(state, actorId);
  return {
    ...state, started: true,
    traps: { ...state.traps, [card.id]: { actorId, name: attack.name, damage: attack.damage, stagger: attack.stagger, effects: attack.effects } },
    party: spendActorAP(state, actorId, attack.charge),
  };
};

/** What a trap set now would deal to an unstaggered slime that eats it. */
export const previewTrap = (state: BattleState, actorId: string, column: number) => {
  const attack = actorAttack(state, actorId);
  const cards = state.columns[column];
  const card = cards?.[cards.length - 1];
  if (!state.rules.traps || attack?.form==='Vice Grip' || !attack || !card || state.traps[card.id] || state.result) return null;
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

export const releaseGrip=(state:BattleState,actorId:string):BattleState=>({...state,foes:state.foes.map(f=>f.gripSource===actorId?{...f,effects:f.effects.filter(e=>e.kind!=='grip'),gripSource:undefined}:f)});

/** One cost path for direct abilities and traps; maxAP never replaces finite bank values. */
const spendActorAP = (state: BattleState, actorId: string, cost: number) => state.maxAP ? state.party
  : state.party.map(actor => actor.id === actorId ? {...actor, charge:Math.max(0,actor.charge-cost)} : actor);
export const setMaxAP = (state: BattleState, enabled: boolean): BattleState => state.maxAP === enabled ? state : {...state,maxAP:enabled};

/** Depth is measured from the exposed top card, starting at one. */
export function retrievalCost(state:BattleState,key:string,column:number,index:number):number|null {
 const [id,move]=key.split(':');
 const actor=state.party.find(a=>a.id===id),cards=state.columns[column];
 if(id!=='hero'||!actor||actor.hp<=0||state.result||!cards||!Number.isInteger(index)||index<0||index>=cards.length)return null;
 const depth=cards.length-index;
 const cost=move==='Fetch'?(depth===1?2:null):move==='Dig'?depth:null;
 return cost!==null&&(state.maxAP||actor.charge>=cost)?cost:null;
}
export function retrieveCard(state:BattleState,key:string,column:number,index:number):BattleState {
 const cost=retrievalCost(state,key,column,index);if(cost===null)return state;
 const [id,move]=key.split(':'),card=state.columns[column][index];
 let columns=state.columns.map((c,i)=>i===column?c.filter((_,j)=>j!==index):c),stock=state.stock,dealt=state.dealt;
 if(!columns[column].length){const top=takeTop(state,column)!;columns=top.columns;stock=top.stock;dealt=top.dealt;}
 state=releaseGrip(state,id);
 return {...state,columns,stock,dealt,started:true,
 party:spendActorAP(state,id,cost).map(a=>a.id===id?{...a,rank:card.rank,count:a.count+1}:a),
 foes:state.foes.map(f=>f.eye?.cardId===card.id?{...f,eye:null,rest:1}:f),
 traps:Object.fromEntries(Object.entries(state.traps).filter(([cardId])=>cardId!==card.id)),
 ...withEvents(state,[{kind:'take',sourceId:id,targetId:id,label:move,amount:cost}])};
}
