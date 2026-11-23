import { MAX_STAGGER_STAGE, apCap, actorAP, spendAP, staggerThreshold, type BattleActor, type BattleState } from './battle';
import { FAREWELL_TURNS, FEED_COSTS, INVOKE_KERU, KERU_CASTS, MAX_TIER, castAmount, castPreview, farewellText, fortressWard, keruUpkeep, harnessLoad, keruLoad, keruMods, type InvokeKeruId, type KeruKit, type RarityTier } from './keruInvokeData';
import { barkDamage, damageFoe, outcome, pushEvents, withStatus } from './battleStatuses';
import { STATUS_META } from './battleStatusData';
import { chokeIfBroken } from './battleDeadRun';
import type { Card } from '../protoState';

// Scenario 1005 Keru Invoke. Each Keru card stores a tableau value. Invoking one
// on Hero swaps it with her foundation's top value and puts its buff on her,
// replacing any earlier Keru. It is not a card play: no hit, AP or Momentum.
// The first invoke each party turn is free; later ones cost 1 Hero AP.
//
// Scenarios 1006–1010 add in-battle rarity: feeding Hero AP into a Keru raises
// its tier (Common → Rare → Epic → Legendary) for this battle only, and each
// tier strengthens its buff. Invokes cost a flat AP there. 1010's Vault Warden's
// seal takes poured AP.
//
// Keru stacking (1010 and 1011): Hero carries several Keru within a load budget
// (each uses load equal to its rarity, capacity 6), their buffs stack, and pairs
// form synergies. Invoking costs one more AP for each Keru already on her;
// dropping a Keru onto an occupied badge replaces that Keru instead.
//
// 1012 Keru Upkeep: no load cap; instead every Keru on Hero costs its tier
// number in AP at the end of each party turn, and Banks and Riv grow her AP pool.
// Any Keru she can't pay is dismissed, and every dismissal (on purpose or
// starved) fires that Keru's farewell.
//
// Immediate casts (1006 and 1012): each Keru card has one cast aimed at a
// target (Riv's Surge and Dem's Mend at an ally, Cir's Flare, Mochi's Pounce
// and Banks' Hex at an enemy). It costs no AP; the Keru is exhausted (tapped)
// for the rest of the battle instead, and can't be invoked, fed or cast again.

export type SealState = {
  /** AP poured this party turn; lost if the turn ends short. */
  poured: number; threshold: number;
  /** Enemy turns left stunned after a break; the core takes double chip damage meanwhile. */
  stunned: number; breaks: number;
  /** AP refunded this turn by a Legendary Cir (1 per 4 poured). */
  refunded: number;
};

export type Farewell = { serial: number; keru: InvokeKeruId; tier: RarityTier; starved: boolean; text: string; foeId?: string };

export type KeruInvokeState = {
  values: Record<InvokeKeruId, number>; used: number;
  /** Rarity scenarios: the buff kit, tiers and AP fed toward each Keru's next tier. */
  kit?: KeruKit;
  tiers?: Record<InvokeKeruId, RarityTier>;
  fed?: Record<InvokeKeruId, number>;
  /** Flat AP per invoke; without it the first invoke each turn is free (1005). */
  cost?: number;
  /** 1006: Hero's AP refills as each party turn opens. */
  refill?: boolean;
  /** Keru Hero can hold at once without a load budget (1006–1009: 1), oldest first in `order`. */
  slots?: number;
  order?: InvokeKeruId[];
  /** Stacking (1010–1011): Hero's load capacity; invokes then cost Keru on Hero + 1 AP. */
  load?: number;
  /** 1012 Keru Upkeep: each Keru on Hero costs its tier number in AP at the end of each party turn. */
  upkeep?: boolean;
  /** 1012: the latest farewells, newest last, for the farewell flourish. */
  farewells?: Farewell[];
  /** 1012: party-turn openings left before a dismissed Keru can be invoked again (ticks down as each party turn opens). */
  cooldown?: Partial<Record<InvokeKeruId, number>>;
  /** Feedback synergy: chip damage queued for Hero's next hit. */
  feedback?: number;
  rivHits?: number;
  wardGranted?: boolean;
  seal?: SealState;
  /** 1006, 1012: Keru have an immediate cast; `exhausted` holds the ones already cast (Restart clears it). */
  casts?: boolean;
  exhausted?: Partial<Record<InvokeKeruId, true>>;
};

export const isInvokeKeru = (id: string): id is InvokeKeruId => (INVOKE_KERU as readonly string[]).includes(id);
/** Stacking scenarios carry a load budget (1010–1011). */
export const isStacking = (state: BattleState) => state.keruInvoke?.load !== undefined;
/**
 * AP to invoke. Stacking: Keru already on Hero + 1, while replacing (or
 * re-invoking a Keru already on her) doesn't count the outgoing Keru.
 * Otherwise a flat cost, or 1005's free first invoke each turn.
 */
export function invokeCost(state: BattleState, keru?: InvokeKeruId, replace?: InvokeKeruId): number {
  const kit = state.keruInvoke;
  if (kit?.load !== undefined) { const count = harnessOrder(state).length, mounted = keru && harnessOrder(state).includes(keru); return replace || mounted ? count : count + 1; }
  return kit?.cost ?? ((kit?.used ?? 0) > 0 ? 1 : 0);
}
/** Load Hero's Keru use now (stacking). */
export const heroLoad = (state: BattleState) => harnessLoad(heroOf(state)?.harness);
export const loadCap = (state: BattleState) => state.keruInvoke?.load ?? 0;
export const invokedKeru = (state: BattleState) => heroOf(state)?.invokedKeru;
export const hasRarity = (state: BattleState) => Boolean(state.keruInvoke?.tiers);
export const keruTier = (state: BattleState, keru: InvokeKeruId): RarityTier => state.keruInvoke?.tiers?.[keru] ?? 0;
export const keruFed = (state: BattleState, keru: InvokeKeruId) => state.keruInvoke?.fed?.[keru] ?? 0;
/** AP still needed for the next tier, or 0 at Legendary. */
export const feedNeeded = (state: BattleState, keru: InvokeKeruId) => { const tier = keruTier(state, keru); return tier >= MAX_TIER ? 0 : FEED_COSTS[tier]; };
/** Keru on Hero, oldest first. */
export const harnessOrder = (state: BattleState): InvokeKeruId[] => state.keruInvoke?.order ?? (invokedKeru(state) ? [invokedKeru(state)!] : []);
const heroOf = (state: BattleState) => state.party.find(actor => actor.id === 'hero');
/** 1012: full party turns a dismissed Keru sits out after the turn it left. Provisional; tune here. */
export const KERU_DISMISS_COOLDOWN = 2;
/** 1012: party turns until this Keru can be invoked again (the next turn counts as 1), or 0 when it is ready. */
/** A cast Keru stays tapped for the rest of the battle. */
export const isExhausted = (state: BattleState, keru: InvokeKeruId) => Boolean(state.keruInvoke?.exhausted?.[keru]);
export const hasCasts = (state: BattleState) => Boolean(state.keruInvoke?.casts);
export const keruCooldown = (state: BattleState, keru: InvokeKeruId) => state.keruInvoke?.cooldown?.[keru] ?? 0;
/** Ticks 1012's dismissal cooldowns as a party turn opens. */
export function tickKeruCooldown(kit: KeruInvokeState): KeruInvokeState {
  if (!kit.cooldown) return kit;
  return { ...kit, cooldown: Object.fromEntries(Object.entries(kit.cooldown).filter(([, turns]) => (turns ?? 0) > 1).map(([keru, turns]) => [keru, turns! - 1])) };
}

/** Initial invoke state for a scenario. */
export function keruInvokeSetup(values: Record<InvokeKeruId, number>, options: { rarity?: KeruKit; cost?: number; refill?: boolean; slots?: number; seal?: number; load?: number; upkeep?: boolean; cast?: boolean } = {}): KeruInvokeState {
  const zero = () => Object.fromEntries(INVOKE_KERU.map(keru => [keru, 0]));
  return { values, used: 0, ...(options.rarity ? { kit: options.rarity, tiers: zero() as Record<InvokeKeruId, RarityTier>, fed: zero() as Record<InvokeKeruId, number>, order: [], rivHits: 0,
    ...(options.load !== undefined ? { load: options.load, feedback: 0 } : { slots: options.upkeep ? INVOKE_KERU.length : options.slots ?? 1 }),
    ...(options.upkeep ? { upkeep: true, farewells: [] } : {}) } : {}),
    ...(options.cost !== undefined ? { cost: options.cost } : {}), ...(options.refill ? { refill: true } : {}),
    ...(options.cast ? { casts: true, exhausted: {} } : {}),
    ...(options.seal ? { seal: { poured: 0, threshold: options.seal, stunned: 0, breaks: 0, refunded: 0 } } : {}) };
}

/** Why a party-turn Keru action is blocked, or null. */
function turnReason(state: BattleState): string | null {
  const hero = heroOf(state);
  if (!state.keruInvoke) return 'Not in this scenario';
  if (state.result) return 'Combat is over';
  if (state.turn !== 'party') return 'Player turn required';
  if (!hero || hero.hp <= 0) return 'Hero is down';
  return null;
}

/** Why an invoke is blocked, or null when it is allowed. */
export function invokeReason(state: BattleState, keru?: InvokeKeruId, replace?: InvokeKeruId): string | null {
  if (keru && state.expeditionKeru && !state.expeditionKeru.includes(keru)) return 'Not equipped for this expedition';
  const turn = turnReason(state);
  if (turn) return turn;
  if (keru && isExhausted(state, keru)) return 'Exhausted';
  const wait = keru ? keruCooldown(state, keru) : 0;
  if (wait > 0) return `Back in ${wait} turn${wait === 1 ? '' : 's'}`;
  if (isStacking(state) && keru) {
    const order = harnessOrder(state), mounted = order.includes(keru);
    if (replace && !order.includes(replace)) return 'That Keru is not on Hero';
    if (replace && mounted && replace !== keru) return 'Already on Hero';
    const outgoing = replace && !mounted ? keruLoad(keruTier(state, replace)) : 0;
    const over = heroLoad(state) - outgoing + (mounted ? 0 : keruLoad(keruTier(state, keru))) - loadCap(state);
    if (over > 0) return `Needs ${over} more load`;
  }
  const cost = invokeCost(state, keru, replace);
  return actorAP(state, 'hero') < cost ? `Needs ${cost} Hero AP` : null;
}

/** Why feeding this Keru is blocked, or null. Stacking: a Keru on Hero can't feed toward a tier her load can't carry. */
export function feedReason(state: BattleState, keru: InvokeKeruId): string | null {
  if (state.expeditionKeru && !state.expeditionKeru.includes(keru)) return 'Not equipped for this expedition';
  if (!hasRarity(state)) return 'Not in this scenario';
  const turn = turnReason(state);
  if (turn) return turn;
  if (isExhausted(state, keru)) return 'Exhausted';
  if (keruTier(state, keru) >= MAX_TIER) return 'Already Legendary';
  if (isStacking(state) && harnessOrder(state).includes(keru) && heroLoad(state) + 1 > loadCap(state)) return 'Load full · the next tier needs 1 more load';
  return actorAP(state, 'hero') < 1 ? 'Needs 1 Hero AP' : null;
}

/**
 * Puts Hero's Keru buffs in line with a new harness: max HP moves by the change
 * in bonus (healing when it grows, clamping when it shrinks), AP clamps to the
 * new cap, and a Legendary Dem grants the Ward once per battle.
 */
function reharness(state: BattleState, hero: BattleActor, harness: BattleActor['harness'], invoked: InvokeKeruId | undefined): { hero: BattleActor; wardGranted?: boolean } {
  const before = keruMods(hero).maxHp;
  let next: BattleActor = { ...hero, invokedKeru: invoked, harness, keruKit: harness ? state.keruInvoke?.kit : hero.keruKit };
  const delta = keruMods(next).maxHp - before;
  next = { ...next, maxHp: next.maxHp + delta, hp: delta > 0 ? next.hp + delta : Math.min(next.hp, next.maxHp + delta) };
  next = { ...next, charge: Math.min(next.charge, apCap(next)) };
  const legendaryDem = harness?.dem === MAX_TIER, fortress = fortressWard(harness, next.keruKit);
  if (fortress) {
    // Fortress grants its Ward as the pair forms (then as each party turn opens); an unspent Ward follows Dem's tier.
    const ward = fortressWard(hero.harness, hero.keruKit) ? next.keruWard : true;
    return { hero: { ...next, keruWard: ward, keruWardCap: ward ? fortress.cap : undefined }, ...(legendaryDem ? { wardGranted: true } : {}) };
  }
  if (next.keruWardCap !== undefined) next = { ...next, keruWardCap: undefined };
  if (!legendaryDem && next.keruWard) next = { ...next, keruWard: false };
  if (legendaryDem && !state.keruInvoke?.wardGranted) return { hero: { ...next, keruWard: true }, wardGranted: true };
  return { hero: next };
}

/** Invokes a Keru on Hero; stacking scenarios can name a Keru on her for it to replace. */
export function invokeKeru(state: BattleState, keru: InvokeKeruId, replace?: InvokeKeruId): BattleState {
  const kit = state.keruInvoke, hero = heroOf(state);
  if (!kit || !hero || invokeReason(state, keru, replace) || (replace && !isStacking(state))) return state;
  const paid = spendAP(state, 'hero', invokeCost(state, keru, replace));
  const paidHero = heroOf(paid)!;
  const cards = hero.foundationCards ?? [];
  const top: Card = { id: `invoke-${keru}-${state.dealt}-${kit.used}`, rank: kit.values[keru] };
  let swapped: BattleActor = { ...paidHero, rank: top.rank, foundationCards: [...cards.slice(0, -1), top] };
  let order = kit.order, wardGranted = kit.wardGranted;
  if (kit.tiers) {
    // Rarity: the harness holds `slots` Keru and a new one replaces the oldest; stacking keeps every Keru within the load budget.
    const current = kit.order ?? [];
    order = current.includes(keru) ? current : kit.load !== undefined ? [...current.filter(id => id !== replace), keru] : [...current, keru].slice(-(kit.slots ?? 1));
    const harness = Object.fromEntries(order.map(id => [id, kit.tiers![id]])) as BattleActor['harness'];
    const result = reharness(paid, swapped, harness, keru);
    swapped = result.hero; wardGranted = wardGranted || result.wardGranted;
  } else if (hero.invokedKeru !== keru) {
    swapped = reharness(paid, swapped, undefined, keru).hero;
  }
  return { ...paid, party: paid.party.map(actor => actor.id === 'hero' ? swapped : actor),
    keruInvoke: { ...kit, values: { ...kit.values, [keru]: hero.rank }, used: kit.used + 1, ...(order ? { order } : {}), ...(wardGranted ? { wardGranted } : {}) } };
}

/** Feeds 1 Hero AP into a Keru. Enough AP raises its tier; a Keru on Hero upgrades her buff at once. */
export function feedKeru(state: BattleState, keru: InvokeKeruId): BattleState {
  const kit = state.keruInvoke;
  if (!kit?.tiers || feedReason(state, keru)) return state;
  const paid = spendAP(state, 'hero', 1);
  const tier = kit.tiers[keru], fed = (kit.fed?.[keru] ?? 0) + 1, up = fed >= FEED_COSTS[tier];
  const tiers = up ? { ...kit.tiers, [keru]: (tier + 1) as RarityTier } : kit.tiers;
  let next: BattleState = { ...paid, keruInvoke: { ...kit, tiers, fed: { ...kit.fed!, [keru]: up ? 0 : fed } } };
  const hero = heroOf(next)!;
  if (up && hero.harness && keru in hero.harness) {
    const result = reharness(next, hero, { ...hero.harness, [keru]: tiers[keru] }, hero.invokedKeru);
    next = { ...next, party: next.party.map(actor => actor.id === 'hero' ? result.hero : actor), keruInvoke: { ...next.keruInvoke!, ...(result.wardGranted ? { wardGranted: true } : {}) } };
  }
  return next;
}

/** Feeds 1 AP at a time until this Keru reaches its next tier or a feed is blocked (the jumbo's "Feed to next tier"). */
export function feedToNextTier(state: BattleState, keru: InvokeKeruId): BattleState {
  const tier = keruTier(state, keru);
  let next = state;
  while (keruTier(next, keru) === tier && !feedReason(next, keru)) next = feedKeru(next, keru);
  return next;
}

/** Why Hero can't pour AP into the Warden's seal now, or null. */
export function pourReason(state: BattleState): string | null {
  const seal = state.keruInvoke?.seal;
  if (!seal) return 'Not in this scenario';
  return turnReason(state) ?? (seal.stunned > 0 ? 'The seal is already broken' : actorAP(state, 'hero') < 1 ? 'Needs 1 Hero AP' : null);
}

/** Warden turns the broken seal stuns it. */
export const SEAL_STUN_TURNS = 2;
/** Each reseal raises the threshold by this much. */
export const SEAL_STEP = 4;

/**
 * Pours 1 Hero AP into the Vault Warden's seal. Reaching the threshold in one
 * party turn breaks it: the Warden is stunned and takes double chip damage.
 * A Legendary Cir refunds 1 AP for every 4 poured.
 */
export function pourIntoSeal(state: BattleState): BattleState {
  const kit = state.keruInvoke, seal = kit?.seal;
  if (!kit || !seal || pourReason(state)) return state;
  let next = spendAP(state, 'hero', 1);
  const poured = seal.poured + 1, refund = keruMods(heroOf(next)!).pourRefund && poured % 4 === 0;
  if (refund) next = { ...next, party: next.party.map(actor => actor.id === 'hero' ? { ...actor, charge: Math.min(apCap(actor), actor.charge + 1) } : actor) };
  const broken = poured >= seal.threshold;
  const nextSeal: SealState = broken ? { ...seal, poured: 0, stunned: SEAL_STUN_TURNS, breaks: seal.breaks + 1, refunded: seal.refunded + (refund ? 1 : 0) } : { ...seal, poured, refunded: seal.refunded + (refund ? 1 : 0) };
  next = { ...next, keruInvoke: { ...kit, seal: nextSeal } };
  if (broken) next = { ...next, foes: next.foes.map((foe, slot) => slot === 0 ? { ...foe, statuses: [...(foe.statuses ?? []).filter(status => status.id !== 'stun'), { id: 'stun' as const, turns: SEAL_STUN_TURNS }] } : foe) };
  return next;
}

/** Tithe: the Vault Warden drains this much Hero AP at the end of each enemy turn it acts. */
export const WARDEN_TITHE = 2;

/**
 * After the Vault Warden's own turn (scenario 1010): a broken seal counts its
 * stun down and reseals 4 higher when it ends; otherwise its attack grows by 1
 * (soft enrage) and its Tithe drains Hero's AP.
 */
export function wardenAfterTurn(state: BattleState, foeId: string): BattleState {
  const kit = state.keruInvoke, seal = kit?.seal, warden = state.foes[0];
  if (!kit || !seal || !warden || warden.id !== foeId || warden.hp <= 0 || state.result) return state;
  if (seal.stunned > 0) {
    const stunned = seal.stunned - 1;
    return { ...state, keruInvoke: { ...kit, seal: { ...seal, stunned, ...(stunned === 0 ? { threshold: seal.threshold + SEAL_STEP } : {}) } } };
  }
  const hero = heroOf(state);
  const grown: BattleState = { ...state, foes: state.foes.map(foe => foe === warden ? { ...foe, profile: { ...foe.profile, damage: foe.profile.damage + 1 } } : foe) };
  if (!hero || hero.hp <= 0 || hero.charge <= 0) return grown;
  const drained = Math.min(WARDEN_TITHE, hero.charge);
  return pushEvents({ ...grown, party: grown.party.map(actor => actor === hero ? { ...actor, charge: actor.charge - drained } : actor) },
    [{ kind: 'enemy-hit', sourceId: warden.id, targetId: 'hero', amount: 0, label: `${warden.name} · Tithe −${drained} AP` }]);
}

/** The Vault Warden's intent badge: its strike and Tithe, or its stun after a broken seal. */
export function wardenIntent(state: BattleState): { summary: string; detail: string; skips: boolean; heavy: boolean; glyph?: string; damage?: number } | null {
  const seal = state.keruInvoke?.seal, warden = state.foes[0];
  if (!seal || !warden || warden.hp <= 0) return null;
  if (seal.stunned > 0) return { summary: `Seal broken · ${seal.stunned} turn${seal.stunned === 1 ? '' : 's'}`, skips: true, heavy: false, glyph: '💫',
    detail: `${warden.name}’s core is open: it is stunned for ${seal.stunned} more enemy turn${seal.stunned === 1 ? '' : 's'} and takes double chip damage. Afterwards it reseals at ${seal.threshold + SEAL_STEP} AP.` };
  const damage = warden.profile.damage;
  return { summary: `Strike ${damage} · Tithe ${WARDEN_TITHE}`, skips: false, heavy: false, glyph: '🔒', damage,
    detail: `${warden.name} strikes Hero for ${damage}, then its Tithe drains ${WARDEN_TITHE} of her AP. Its strike grows by 1 every turn. Sealed Core: no chip damage until Hero pours ${seal.threshold} AP into the seal in one turn (${seal.poured} so far this turn; a short pour is lost at the end of the turn).` };
}

/** 1012: the AP each Keru on Hero costs at the end of the party turn. */
export const upkeepOf = (state: BattleState, keru: InvokeKeruId) => keruUpkeep(keruTier(state, keru));

/**
 * 1012: what the end-of-turn upkeep will do with Hero's AP now. Keru are paid
 * oldest first, each while Hero can still afford it; the rest starve.
 */
export function upkeepPlan(state: BattleState): { total: number; cost: number; paid: InvokeKeruId[]; starved: InvokeKeruId[] } {
  if (!state.keruInvoke?.upkeep) return { total: 0, cost: 0, paid: [], starved: [] };
  let ap = actorAP(state, 'hero'), cost = 0;
  const paid: InvokeKeruId[] = [], starved: InvokeKeruId[] = [], order = harnessOrder(state);
  for (const keru of order) { const due = upkeepOf(state, keru); if (ap >= due) { ap -= due; cost += due; paid.push(keru); } else starved.push(keru); }
  return { total: order.reduce((sum, keru) => sum + upkeepOf(state, keru), 0), cost, paid, starved };
}

/** 1012: how Hero's AP pip row reads against upkeep. */
export type UpkeepPips = { ap: number; cap: number; total: number; free: number; reserved: number; short: number; overflow: number };
/**
 * 1012: the pip row's split. The AP upkeep will take appears at the left
 * end of the lit pips; AP still missing to pay
 * every Keru shows as empty "short" pips up to the cap, and any beyond as +N.
 */
export function upkeepPips(state: BattleState): UpkeepPips | null {
  const hero = heroOf(state);
  if (!state.keruInvoke?.upkeep || !hero) return null;
  const plan = upkeepPlan(state), cap = apCap(hero), ap = Math.min(actorAP(state, 'hero'), cap);
  const reserved = Math.min(plan.cost, ap), missing = Math.max(0, plan.total - ap), short = Math.min(missing, cap - ap);
  return { ap, cap, total: plan.total, free: ap - reserved, reserved, short, overflow: missing - short };
}

/** Why Hero can't dismiss this Keru now, or null. Dismissing is free. */
export function dismissReason(state: BattleState, keru: InvokeKeruId): string | null {
  if (!state.keruInvoke?.upkeep) return 'Not in this scenario';
  return turnReason(state) ?? (harnessOrder(state).includes(keru) ? null : 'Not on Hero');
}

/** 1012: sends a Keru back to the hand (keeping its tier and value); its farewell fires. */
export function dismissKeru(state: BattleState, keru: InvokeKeruId): BattleState {
  return dismissReason(state, keru) ? state : farewell(state, keru, false);
}

/** 1012: pays upkeep as the party turn ends; any Keru Hero can't pay is dismissed (starved), and its farewell still fires. */
export function payKeruUpkeep(state: BattleState): BattleState {
  const plan = upkeepPlan(state);
  if (!plan.paid.length && !plan.starved.length) return state;
  let next = spendAP(state, 'hero', plan.cost);
  for (const keru of plan.starved) next = farewell(next, keru, true);
  return next;
}

/**
 * The reverse of a warcry: what a Keru does as it leaves Hero, intentional or
 * starved, scaled by its tier number n. Dem heals 3n and leaves a Ward for the
 * next hit; Banks halves incoming damage; both last 2 enemy turns. Cir bolts the
 * enemy for 4n, Mochi adds 2n stagger (a Legendary through Duskscale Armor and
 * Deep Breath), and Riv refunds n + 1 AP.
 */
function farewell(state: BattleState, keru: InvokeKeruId, starved: boolean): BattleState {
  const kit = state.keruInvoke!, hero = heroOf(state)!, tier = kit.tiers![keru], n = tier + 1;
  const order = harnessOrder(state).filter(id => id !== keru);
  let left = unharnessed(state, hero, keru, order);
  if (keru === 'dem') left = { ...left, hp: Math.min(left.maxHp, left.hp + 3 * n), farewellWard: FAREWELL_TURNS };
  if (keru === 'banks') left = { ...left, farewellHalve: FAREWELL_TURNS };
  if (keru === 'riv') left = { ...left, charge: Math.min(apCap(left), left.charge + n + 1) };
  const foe = state.foes.find(unit => unit.id === hero.targetId && unit.hp > 0) ?? state.foes.find(unit => unit.hp > 0);
  const serial = (kit.farewells?.[kit.farewells.length - 1]?.serial ?? 0) + 1;
  const record: Farewell = { serial, keru, tier, starved, text: farewellText(keru, tier), ...(foe && (keru === 'cir' || keru === 'mochi') ? { foeId: foe.id } : {}) };
  let next: BattleState = { ...state, party: state.party.map(actor => actor.id === 'hero' ? left : actor), keruInvoke: { ...kit, order, farewells: [...(kit.farewells ?? []), record].slice(-4),
    // Out for the rest of this turn and the next KERU_DISMISS_COOLDOWN party turns; a starved Keru leaves as its turn ends, so the count is the same.
    cooldown: { ...kit.cooldown, [keru]: KERU_DISMISS_COOLDOWN + 1 } } };
  if (keru === 'cir' && foe) {
    const hp = Math.max(0, foe.hp - 4 * n);
    next = pushEvents({ ...next, foes: next.foes.map(unit => unit.id === foe.id ? { ...unit, hp, ...(hp === 0 ? { stagger: 0, staggered: 0, staggerStage: 0 } : {}) } : unit) },
      [{ kind: 'hit', sourceId: 'hero', targetId: foe.id, amount: 4 * n, label: 'Cir · Farewell bolt' }, ...(hp === 0 ? [{ kind: 'ko' as const, sourceId: 'hero', targetId: foe.id }] : [])]);
  }
  if (keru === 'mochi' && foe) next = keruStagger(next, foe.id, 2 * n, tier === MAX_TIER, 'Mochi · Farewell');
  next = chokeIfBroken(next);
  return { ...next, result: outcome(next) };
}

/** Hero without one Keru: its buff leaves and the harness keeps the rest, oldest first. */
function unharnessed(state: BattleState, hero: BattleActor, keru: InvokeKeruId, order: InvokeKeruId[]): BattleActor {
  const harness = Object.fromEntries(order.map(id => [id, state.keruInvoke!.tiers![id]])) as BattleActor['harness'];
  return reharness(state, hero, harness, hero.invokedKeru === keru ? order[order.length - 1] : hero.invokedKeru).hero;
}

/** Mochi's farewell and Pounce stagger: armor and Deep Breath block it unless it is Legendary; filling the gauge breaks it. */
function keruStagger(state: BattleState, foeId: string, amount: number, pierce: boolean, label: string): BattleState {
  const foe = state.foes.find(unit => unit.id === foeId);
  if (!foe || foe.hp <= 0) return state;
  const blocked = (foe.indominable ?? 0) > 0 || (!pierce && foe.statuses?.some(status => STATUS_META[status.id].blocksStagger));
  if (blocked) return pushEvents(state, [{ kind: 'hit', sourceId: 'hero', targetId: foeId, amount: 0, label: `${label} (blocked)` }]);
  const stage = foe.staggerStage ?? 0, gauge = Math.min(staggerThreshold(foe), foe.stagger + amount), broke = stage < MAX_STAGGER_STAGE && gauge >= staggerThreshold(foe);
  const next = { ...state, foes: state.foes.map(unit => unit.id === foeId ? { ...unit, stagger: broke ? 0 : gauge, ...(broke ? { staggerStage: stage + 1, staggered: unit.profile.staggerSeconds } : {}) } : unit) };
  return pushEvents(next, [{ kind: 'hit', sourceId: 'hero', targetId: foeId, amount: 0, label: `${label} +${amount} stagger` }, ...(broke ? [{ kind: 'stagger' as const, sourceId: 'hero', targetId: foeId, label: String(stage + 1) }] : [])]);
}

/** Who a Keru's cast can target: living allies for Surge and Mend, living enemies for the rest. */
export const castTargets = (state: BattleState, keru: InvokeKeruId): string[] =>
  (KERU_CASTS[keru].target === 'ally' ? state.party.filter(actor => actor.hp > 0) : state.foes.filter(foe => foe.hp > 0)).map(unit => unit.id);

/** Why this Keru can't cast now (or at this target), or null. */
export function castReason(state: BattleState, keru: InvokeKeruId, targetId?: string): string | null {
  if (state.expeditionKeru && !state.expeditionKeru.includes(keru)) return 'Not equipped for this expedition';
  if (!hasCasts(state)) return 'Not in this scenario';
  const turn = turnReason(state);
  if (turn) return turn;
  if (isExhausted(state, keru)) return 'Exhausted';
  if (targetId === undefined || castTargets(state, keru).includes(targetId)) return null;
  return KERU_CASTS[keru].target === 'ally' ? 'Choose an ally' : 'Choose an enemy';
}

/**
 * Casts a Keru at a target and exhausts it for the rest of the battle (no AP).
 * A Keru on Hero leaves her first, without its farewell or a cooldown, and its
 * buff goes. n is its tier number: Surge +2n AP (up to the cap), Mend heals 6n,
 * Flare 6n fire, Pounce 3n stagger (Legendary through Duskscale Armor and Deep
 * Breath), Hex Weakens for n enemy turns.
 */
export function castKeru(state: BattleState, keru: InvokeKeruId, targetId: string): BattleState {
  const kit = state.keruInvoke;
  if (!kit || castReason(state, keru, targetId)) return state;
  const tier = keruTier(state, keru), amount = castAmount(keru, tier), label = `${keru[0].toUpperCase() + keru.slice(1)} · ${KERU_CASTS[keru].name}`;
  let next: BattleState = { ...state, keruInvoke: { ...kit, exhausted: { ...kit.exhausted, [keru]: true } } };
  const order = harnessOrder(state);
  if (order.includes(keru)) {
    const rest = order.filter(id => id !== keru), left = unharnessed(next, heroOf(next)!, keru, rest);
    next = { ...next, party: next.party.map(actor => actor.id === 'hero' ? left : actor), keruInvoke: { ...next.keruInvoke!, order: rest } };
  }
  const patchAlly = (patch: (actor: BattleActor) => BattleActor) => { next = { ...next, party: next.party.map(actor => actor.id === targetId ? patch(actor) : actor) }; };
  const ally = () => next.party.find(actor => actor.id === targetId)!;
  switch (keru) {
    case 'riv': { const before = ally().charge; patchAlly(actor => ({ ...actor, charge: Math.min(apCap(actor), actor.charge + amount) }));
      next = pushEvents(next, [{ kind: 'heal', sourceId: 'hero', targetId, amount: ally().charge - before, label: `${label} AP` }]); break; }
    case 'dem': { const before = ally().hp; patchAlly(actor => ({ ...actor, hp: Math.min(actor.maxHp, actor.hp + amount) }));
      next = pushEvents(next, [{ kind: 'heal', sourceId: 'hero', targetId, amount: ally().hp - before, label }]); break; }
    case 'cir': { const foe = next.foes.find(unit => unit.id === targetId)!; next = damageFoe(next, targetId, barkDamage(foe, 0, amount), label, 'hit', 'hero'); break; }
    case 'mochi': next = keruStagger(next, targetId, amount, tier === MAX_TIER, label); break;
    case 'banks': next = pushEvents({ ...next, foes: next.foes.map(foe => foe.id === targetId ? withStatus(foe, { id: 'weakened', turns: amount }) : foe) },
      [{ kind: 'hit', sourceId: 'hero', targetId, amount: 0, label }]); break;
  }
  next = chokeIfBroken(next);
  return { ...next, result: outcome(next) };
}

/**
 * One pip of a held pour from Hero's AP meter (KeruPourCast, about one every
 * 300ms): feeds a Keru or 1010's seal 1 AP, committed at once, or names why the
 * pour stops (out of AP, Legendary, exhausted, not the party turn).
 */
export function pourStep(state: BattleState, target: InvokeKeruId | 'seal'): { state: BattleState; stopped: string | null; tierUp: boolean } {
  const stopped = target === 'seal' ? pourReason(state) : feedReason(state, target);
  if (stopped) return { state, stopped, tierUp: false };
  const next = target === 'seal' ? pourIntoSeal(state) : feedKeru(state, target);
  return { state: next, stopped: null, tierUp: target !== 'seal' && keruTier(next, target) > keruTier(state, target) };
}

/** A Keru jumbo's explicit actions: Feed to next tier (when more than 1 AP is due and Hero can pay it all), Feed 1 AP, and Cast. */
export function keruJumboActions(state: BattleState, keru: InvokeKeruId): { kind: 'tier' | 'one' | 'cast'; label: string }[] {
  const actions: { kind: 'tier' | 'one' | 'cast'; label: string }[] = [];
  if (hasRarity(state) && !feedReason(state, keru)) {
    const left = feedNeeded(state, keru) - keruFed(state, keru);
    if (left > 1 && actorAP(state, 'hero') >= left) actions.push({ kind: 'tier', label: `Feed to next tier (${left} AP)` });
    actions.push({ kind: 'one', label: 'Feed 1 AP' });
  }
  if (hasCasts(state) && !castReason(state, keru)) actions.push({ kind: 'cast', label: `Cast ${KERU_CASTS[keru].name} (${castPreview(keru, keruTier(state, keru))})` });
  return actions;
}
