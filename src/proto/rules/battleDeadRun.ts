import { golemFarewell } from './iceAbilities';
import { verticalEntries, isVerticalScenario } from './verticalColumns';
import { partyDamageTargets } from './partyDamage';
import { canUseKeruAbilities } from './keruLeadership';
import { absorbTempHp } from './cirCompanion';
import { guardedDamage, keruMods } from './keruInvokeData';
import { cardRanks, resolveCardRank } from './splitCards';
import { STATUS_META } from './battleStatusData';
import { MAX_STAGGER_STAGE, canPlay, clearDownedAP, digReceiptReceiver, drawCard, earnMomentum, foundationCardsOf, actorAlive, foeAlive, receiveCard, takeTop, takeLaneCard, tableauWidth, type BattleFoe, type BattleState } from './battle';
import { isAdjacentRank } from './setup';
import { tutorialById, type IntentCardDef } from './battleTutorialScenarios';
import { hasStatus, outcome, pushEvents, weakenedHit, withStatus, withoutStatus } from './battleStatuses';
import type { Card } from '../protoState';
import { enemyLaneDepths } from './layoutExperiment';

// Dead-run fixes for the combat sandbox (scenarios 019–024), from the
// tableau Monte Carlo: an enemy intent card that is also a golf target, one
// charged stock flip from Hero’s 4 Leaf Clover buff, and a hold slot
// where a Kin parks one playable card for later. Pure: no React or DOM.

/** The intent card on the table: its rank, filled pips and the cards played onto it. */
export type IntentCard = { id: string; rank: number; pips: number; fired: number; cards: Card[] };

/** Receiver ids beside Kin foundations: the intent card and each Kin's hold slot. */
export const INTENT_RECEIVER = 'intent';
export const holdReceiver = (actorId: string) => `hold:${actorId}`;
export const holdOwner = (receiverId: string) => receiverId.startsWith('hold:') ? receiverId.slice(5) : null;

const scenario = (state: BattleState) => tutorialById(state.tutorial?.id);
export const intentDef = (state: BattleState): IntentCardDef | undefined => scenario(state)?.intentCard;
export const intentCapacity = (state: BattleState) => state.tutorial?.intentCap ?? intentDef(state)?.pips ?? 0;
const progressRemaining = (state: BattleState) => Math.max(0, (intentDef(state)?.maxProgressPerTurn ?? Infinity) - (state.tutorial?.intentProgressThisTurn ?? 0));
export const intentDamage = (state: BattleState) => { const def = intentDef(state); return def ? Math.round(def.damage * intentCapacity(state) / def.pips) : 0; };
/** A Kin has a hold slot when the scenario grants one, or once its Hold ability opened it; with no Kin named, whether any slot exists. */
export const hasHoldSlot = (state: BattleState, actorId?: string) => Boolean(scenario(state)?.holdSlot ||
  (actorId ? state.tutorial?.holdsOpen?.includes(actorId) : state.tutorial?.holdsOpen?.length));
export const hasPityDraw = (state: BattleState) => Boolean(state.party.find(actor => actor.id === 'hero')?.statuses?.some(status => status.id === 'every-dog-has-her-day'));
const partyTurn = (state: BattleState) => state.turn === 'party' && !state.result;

/**
 * Lifecycle of a readying, armored intent such as the Dusk Dragon's Deep Breath:
 * armored (stagger-proof, nothing on the table) → charging (cast: the card is
 * out, the armor is off and the owner plays cards onto it) → readied (full:
 * it is a card in the owner's hand and the owner skips a turn) → inhaled
 * (next turn it unleashes) → armored again. Breaking the owner's stagger while
 * the armor is off chokes it: the card is lost and the owner re-armors after
 * recovering.
 */
export type BreathPhase = 'armored' | 'charging' | 'readied' | 'inhaled' | 'choked' | 'disabled';
const VULNERABLE: readonly BreathPhase[] = ['charging', 'readied', 'inhaled'];
const patchOwner = (state: BattleState, patch: (foe: BattleFoe) => BattleFoe): BattleState => ({ ...state, foes: state.foes.map((foe, slot) => slot === 0 ? patch(foe) : foe) });
/** Sets the phase; passing null takes the ability card off the table. */
const setBreath = (state: BattleState, breath: BreathPhase, intent?: null): BattleState =>
  ({ ...state, tutorial: { ...state.tutorial!, breath, intent: intent === null ? undefined : state.tutorial?.intent } });

/** The owner (re)armors: no ability on the table, stagger can't build. */
export const armorOwner = (state: BattleState): BattleState =>
  setBreath(patchOwner(state, foe => withStatus(withoutStatus(foe, 'deep-breath'), { id: 'duskscale' })), 'armored', null);

/** A scenario that opens mid-fight: the owner has already cast the ability, which is charging with `pips` filled. */
export function startCharging(state: BattleState, pips: number): BattleState {
  const cast = patchOwner(dealIntent(state), foe => withStatus(withoutStatus(foe, 'duskscale'), { id: 'deep-breath' }));
  const intent = cast.tutorial?.intent;
  return setBreath(intent ? { ...cast, tutorial: { ...cast.tutorial!, intent: { ...intent, pips: Math.min(pips, intentCapacity(cast)) } } } : cast, 'charging');
}

/** Turns a backfired ability keeps its owner stunned. */
export const BACKFIRE_STUN_TURNS = 2;

/**
 * Breaking the owner's stagger while its armor is off makes the ability backfire
 * (Eric, 2026-10-25): its damage, unmultiplied, hits the owner instead of the party;
 * the stagger jumps to stage III and the owner is stunned for two enemy turns,
 * a full run to finish it. The card and its pips are lost.
 */
export function chokeIfBroken(state: BattleState): BattleState {
  const owner = state.foes[0], phase = state.tutorial?.breath, def = intentDef(state);
  if (!def || !phase || !VULNERABLE.includes(phase) || !owner || owner.staggered <= 0) return state;
  const damage = intentDamage(state), hp = Math.max(0, owner.hp - damage);
  let next = patchOwner(state, foe => withStatus(withoutStatus(foe, 'deep-breath'), { id: 'stun', turns: BACKFIRE_STUN_TURNS }));
  next = patchOwner(next, foe => ({ ...foe, hp, staggerStage: hp > 0 ? MAX_STAGGER_STAGE : 0, stagger: 0, staggered: hp > 0 ? Math.max(foe.staggered, 1) : 0 }));
  next = pushEvents(next, [{ kind: 'hit', targetId: owner.id, amount: damage, label: `${def.name} · Backfire` },
    ...(hp === 0 ? [{ kind: 'ko' as const, targetId: owner.id }] : [])]);
  return setBreath({ ...next, result: outcome(next) }, 'choked', null);
}

/**
 * The owner's ability step on its turn, before any plays: cast from behind the
 * armor, wind up (skip), unleash, or re-armor after a choke. `plays`: it goes on
 * to play cards onto the intent; `acted`: something visible happened.
 */
export function breathTurn(state: BattleState): { state: BattleState; plays: boolean; acted: boolean } {
  const def = intentDef(state), owner = state.foes[0], phase = state.tutorial?.breath;
  if (!def?.readies || !phase || !owner || !foeAlive(owner) || state.result) return { state, plays: true, acted: false };
  switch (phase) {
    case 'disabled': return { state, plays: false, acted: false };
    case 'armored': {
      if (intentOwnerSkips(owner)) return { state, plays: false, acted: false };
      const cast = patchOwner(dealIntent(state), foe => withStatus(withoutStatus(foe, 'duskscale'), { id: 'deep-breath' }));
      return { state: setBreath(cast, 'charging'), plays: true, acted: true };
    }
    case 'charging': return { state, plays: true, acted: false };
    case 'readied': return { state: setBreath(state, 'inhaled'), plays: false, acted: true };
    case 'inhaled': {
      const damage = weakenedHit(owner, intentDamage(state)), targets = partyDamageTargets(state);
      let next: BattleState = { ...state, party: state.party.map(actor => targets.some(t=>t.id===actor.id) ? absorbTempHp(actor,damage) : actor) };
      next = pushEvents(next, targets.flatMap(target => [
        { kind: 'enemy-hit' as const, sourceId: owner.id, targetId: target.id, amount: damage, label: `${owner.name} · ${def.name}` },
        ...((next.party.find(a=>a.id===target.id)?.hp ?? 1)<=0 ? [{ kind: 'down' as const, sourceId: owner.id, targetId: target.id }] : []),
      ]));
      // A Legendary Banks on Hero sends back a share of the damage it prevented.
      const reflected = targets.reduce((sum, target) => { const mods = keruMods(target); return sum + (mods.reflect && !(target.keruWard && target.keruWardCap === undefined) ? Math.round((damage - guardedDamage(target, damage)) * mods.reflect) : 0); }, 0);
      if (reflected > 0) {
        next = patchOwner(next, foe => ({ ...foe, hp: Math.max(0, foe.hp - reflected) }));
        next = pushEvents(next, [{ kind: 'hit', sourceId: 'hero', targetId: owner.id, amount: reflected, label: 'Banks · Reflect' }]);
      }
      next = golemFarewell(clearDownedAP({ ...next, result: outcome(next) }));
      return { state: armorOwner({ ...next, tutorial: { ...next.tutorial!, intent: next.tutorial!.intent && { ...next.tutorial!.intent, fired: next.tutorial!.intent.fired + 1 } } }), plays: false, acted: true };
    }
    // Backfired: it waits out its stun and recovery, then re-arms (and casts on the turn after).
    case 'choked': return owner.staggered > 0 || hasStatus(owner, 'stun') ? { state, plays: false, acted: false } : { state: armorOwner(state), plays: false, acted: true };
  }
}

/** The owner's intent badge while it runs a readying ability. */
export function breathIntent(state: BattleState): { summary: string; detail: string; skips: boolean; heavy: boolean; glyph?: string; damage?: number } | null {
  const def = intentDef(state), owner = state.foes[0], phase = state.tutorial?.breath;
  if (!def?.readies || !phase || !owner || !foeAlive(owner)) return null;
  const name = def.name, glyph = '🌬️';
  switch (phase) {
    case 'armored': return { summary: `Casts ${name}`, detail: `${owner.name} is behind Duskscale Armor (no stagger). On its next turn it casts ${name} and starts charging while remaining immune to stagger.`, skips: true, heavy: false, glyph };
    case 'disabled': return { summary: `${name} · broken`, detail: `${name} is broken and cannot charge or fire. Play adjacent cards onto it to gain Momentum and change its value.`, skips: true, heavy: false, glyph };
    case 'charging': return { summary: `${name} · ${state.tutorial!.intent?.pips ?? 0}/${intentCapacity(state)}`, detail: breathStatusText(state, 'deep-breath'), skips: true, heavy: false, glyph };
    case 'readied': return { summary: 'Inhaling · skips', detail: breathStatusText(state, 'deep-breath'), skips: true, heavy: false, glyph };
    case 'inhaled': return { summary: `${name} · all Kin`, detail: breathStatusText(state, 'deep-breath'), skips: false, heavy: false, glyph, damage: weakenedHit(owner, intentDamage(state)) };
    case 'choked': {
      const turns = owner.statuses?.find(status => status.id === 'stun')?.turns ?? 0;
      return turns ? { summary: `Stunned · ${turns} turn${turns === 1 ? '' : 's'}`, detail: `${name} backfired. ${owner.name} is stunned for ${turns} more enemy turn${turns === 1 ? '' : 's'} at stagger stage III (×4 damage): finish it. Afterwards it recovers, re-arms with Duskscale Armor and casts again.`, skips: true, heavy: false, glyph: '💫' }
        : { summary: 'Recovering · re-arms', detail: `${owner.name} recovers from the backfire, re-arms with Duskscale Armor, then casts ${name} again.`, skips: true, heavy: false, glyph: '☾' };
    }
  }
}

/** Buff copy for the owner's Duskscale Armor and Deep Breath, by phase. */
export function breathStatusText(state: BattleState, id: 'duskscale' | 'deep-breath'): string {
  const def = intentDef(state), owner = state.foes[0]?.name ?? 'The enemy', name = def?.name ?? 'Deep Breath', damage = intentDamage(state);
  if (id === 'duskscale') return `${STATUS_META.duskscale.name}: ${STATUS_META.duskscale.blocksStagger ? "hits can’t build" : "hits can build"} ${owner}’s stagger gauge. The owner remains immune to stagger while [[deep-breath|${name}]] has any capacity. Removing its final pip breaks the ability and staggers the owner.`;
  const pips = state.tutorial?.intent?.pips ?? 0, full = intentCapacity(state);
  if (full === 0) return `${name} is broken and cannot charge or fire. Play adjacent cards onto it to change its value and gain one Momentum.`;
  const tail = `The owner cannot be staggered until all ability pips are removed.`;
  switch (state.tutorial?.breath) {
    case 'readied': return `${name}: fully charged and readied. ${owner} skips its next turn to inhale, then breathes ${damage} damage on every Kin the turn after. ${tail}`;
    case 'inhaled': return `${name}: inhaling. On its next turn ${owner} breathes ${damage} damage on every Kin. ${tail}`;
    default: return `${name}: charging, ${pips} of ${full} pips. ${owner} charges it: each turn it plays up to ${Math.min(def?.enemyPlays ?? 0, def?.maxProgressPerTurn ?? Infinity)} exposed cards one rank from ${name}, at random. Its progress is capped at ${def?.maxProgressPerTurn ?? "unlimited"} pip per enemy turn. When it is full, it skips a turn to inhale, then breathes ${damage} damage on every Kin. Its owner remains immune to stagger while the ability has any capacity. ${def?.partyPlays ? 'On your turn, play an adjacent exposed card here to remove one filled pip, or permanently remove one empty pip when none are filled; change its value and gain one Momentum. The remaining capacity scales its damage. Removing its last pip breaks it and staggers its owner; the broken card remains playable. ' : ''}${tail}`;
  }
}

/** A fresh intent card ranked from the stock. */
export function dealIntent(state: BattleState, fired = 0): BattleState {
  if (!intentDef(state) || !state.tutorial || intentCapacity(state) <= 0) return state;
  const { card, stock, dealt } = drawCard(state);
  return { ...state, stock, dealt, tutorial: { ...state.tutorial, intent: { id: `intent-${card.id}`, rank: card.rank, pips: 0, fired, cards: [] } } };
}

export const canPlayOnIntent = (state: BattleState, card: Card | undefined | null) => {
  const intent = state.tutorial?.intent;
  const def=intentDef(state);
  return Boolean(card && intent && def && (!def.casterOnly || def.partyPlays && (state.tutorial?.breath==='charging' || state.tutorial?.breath==='disabled')) && partyTurn(state) && !state.traps[card.id] && isAdjacentRank(card.rank, intent.rank));
};

/** A card lands on the intent: one pip off, one Momentum, no AP or hit. Golf intents take the card's rank. */
function strikeIntent(state: BattleState, card: Card, take: Pick<BattleState, 'columns' | 'stock' | 'dealt'>): BattleState {
  const def = intentDef(state)!, intent = state.tutorial!.intent!;
  const cap = intent.pips === 0 ? Math.max(0, intentCapacity(state) - 1) : intentCapacity(state);
  let next: BattleState = { ...state, ...take, started: true,
    tutorial: { ...state.tutorial!, intentCap: cap, intent: { ...intent, pips: Math.max(0, intent.pips - 1), rank: def.fixedRank ? intent.rank : card.rank, cards: [...intent.cards, card] } } };
  if (cap === 0 && intentCapacity(state) > 0) {
    next = patchOwner(next, foe => ({ ...withoutStatus(foe, 'deep-breath', 'duskscale'), stagger: 0, staggerStage: Math.min(MAX_STAGGER_STAGE, (foe.staggerStage ?? 0) + 1), staggered: Math.max(foe.staggered, foe.profile.staggerSeconds || 1) }));
    next = { ...next, tutorial: { ...next.tutorial!, ...(def.readies ? { breath: 'disabled' as const } : {}) } };
  }
  return earnMomentum(next, INTENT_RECEIVER);
}

export function playOnIntent(state: BattleState, column: number, depth?: number): BattleState {
  const cards = state.columns[column], card = cards?.[depth ?? cards.length - 1];
  if (!canPlayOnIntent(state, card)) return state;
  const take = state.rules.spatialLanes && depth !== undefined ? takeLaneCard(state, column, depth, 'party') : takeTop(state, column);
  if (!take) return state;
  const { columns, stock, dealt } = take;
  return strikeIntent(state, card!, { columns, stock, dealt });
}

export const heldCard = (state: BattleState, actorId: string) => state.tutorial?.holds?.[actorId];

/** Only a card the Kin could play right now may be parked, and only into an empty slot. */
export const canHold = (state: BattleState, actorId: string, card: Card | undefined | null) =>
  Boolean(card && hasHoldSlot(state, actorId) && state.tutorial && !heldCard(state, actorId) && canPlay(state, actorId, card));

export function holdCard(state: BattleState, column: number, actorId: string): BattleState {
  const cards = state.columns[column], card = cards?.[cards.length - 1];
  if (!canHold(state, actorId, card)) return state;
  const { columns, stock, dealt } = takeTop(state, column)!;
  return { ...state, columns, stock, dealt, tutorial: { ...state.tutorial!, holds: { ...state.tutorial!.holds, [actorId]: card! } } };
}

/** Where a parked card can go now: any Kin foundation it fits, or the intent. */
export function heldReceivers(state: BattleState, actorId: string): string[] {
  const card = heldCard(state, actorId);
  if (!card || !partyTurn(state)) return [];
  return [...state.party.filter(actor => canPlay(state, actor.id, card)).map(actor => actor.id), ...(canPlayOnIntent(state, card) ? [INTENT_RECEIVER] : [])];
}

export function playHeld(state: BattleState, actorId: string, receiverId: string): BattleState {
  const card = heldCard(state, actorId);
  if (!card || !heldReceivers(state, actorId).includes(receiverId)) return state;
  const cleared: BattleState = { ...state, tutorial: { ...state.tutorial!, holds: { ...state.tutorial!.holds, [actorId]: undefined } } };
  const take = { card, columns: state.columns, stock: state.stock, dealt: state.dealt };
  return receiverId === INTENT_RECEIVER ? strikeIntent(cleared, card, take) : receiveCard(cleared, receiverId, take);
}

/** Every receiver a tableau card can reach: Kin foundations, the intent, then hold slots. */
export function tableauReceivers(state: BattleState, card: Card | undefined | null, holds = true): string[] {
  if (!card) return [];
  return [...state.party.filter(actor => canPlay(state, actor.id, card)).map(actor => actor.id),
    ...(canPlayOnIntent(state, card) ? [INTENT_RECEIVER] : []),
    ...(holds ? state.party.filter(actor => canHold(state, actor.id, card)).map(actor => holdReceiver(actor.id)) : [])];
}

/** Any legal play this turn, counting the intent and parked cards. */
export const anyLegalPlay = (state: BattleState) =>
  Boolean(isVerticalScenario(state) && verticalEntries(state,'party').some(({card})=>tableauReceivers(state,card,false).length>0)) ||
  Boolean(state.digReserve?.some(card => digReceiptReceiver(state, card))) ||
  Boolean(state.experiment?.reserve.some(card=>canPlay(state,'hero',card))) ||
  state.columns.some((column,index) => (state.rules.spatialLanes && index < tableauWidth(state) ? column.slice(1) : column.slice(-1)).some(card => tableauReceivers(state, card, false).length > 0)) ||
  state.party.some(actor => heldReceivers(state, actor.id).length > 0);

/** Kept as the shared party-turn hook; charges never recharge at handoff. */
export function openPartyTurn(state: BattleState): BattleState { return state; }

export const canPityFlip = (state: BattleState) => partyTurn(state) && canUseKeruAbilities(state,'hero') && Boolean(state.party.some(actor => actor.id === 'hero' && actorAlive(actor) && !actor.disarmed && actor.statuses?.some(status => status.id === 'every-dog-has-her-day' && (status.stacks ?? 0) > 0)));

/** 4 Leaf Clover: spend one charge for a stock card on Hero. Not a receipt. */
export function pityFlip(state: BattleState): BattleState {
  if (!canPityFlip(state)) return state;
  const { card, stock, dealt } = drawCard(state);
  return { ...state, stock, dealt,
    party: state.party.map(unit => unit.id === 'hero' ? { ...unit, rank: card.rank, foundationCards: [...foundationCardsOf(unit), card], statuses: unit.statuses?.flatMap(status => status.id !== 'every-dog-has-her-day' ? [status] : (status.stacks ?? 0) > 1 ? [{ ...status, stacks: status.stacks! - 1 }] : []) } : unit) };
}

/** mulberry32 over the effect seed: a reproducible roll that leaves card deals untouched. */
function seededRoll(previous: number) {
  const seed = (previous + 0x6D2B79F5) >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { seed, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/** The intent's owner skips it on the same turns it skips its strike. */
export const intentOwnerSkips = (foe: BattleFoe | undefined) => Boolean(foe && (foe.staggered > 0 || hasStatus(foe, 'dormant') || hasStatus(foe, 'frozen') || hasStatus(foe, 'stun') || hasStatus(foe, 'grip')));

/** One owner play onto the intent: the first exposed card one rank from it, +1 pip. Null when the intent is full or nothing fits. */
export function intentEnemyPlayOne(state: BattleState): BattleState | null {
  const def = intentDef(state), intent = state.tutorial?.intent;
  if (!def || !intent || intent.pips >= Math.max(0,intentCapacity(state)-(state.foes[0]?.iceFrost?.length ?? 0)) || progressRemaining(state) < 1) return null;
  const matches = state.columns.slice(0, tableauWidth(state)).flatMap((cards, column) => (state.rules.spatialLanes ? enemyLaneDepths(state.experiment) : [cards.length - 1]).map(depth=>({column,depth,ranks:cards[depth]?cardRanks(cards[depth]).filter(rank=>isAdjacentRank(rank,intent.rank)):[]})).filter(match=>match.ranks.length));
  if (!matches.length) return null;
  // Caster-built foundations pick among matching cards at random (from the effect stream), so the player reads risk, not a fixed order.
  let effectSeed = state.effectSeed, match = matches[0];
  if (def.casterOnly && matches.length > 1) { const flip = seededRoll(effectSeed); effectSeed = flip.seed; match = matches[Math.floor(flip.value * matches.length)]; }
  let rank=match.ranks[0];
  if(match.ranks.length>1){const flip=seededRoll(effectSeed);effectSeed=flip.seed;rank=match.ranks[Math.floor(flip.value*match.ranks.length)];}
  const { card:sourceCard, columns, stock, dealt } = (state.rules.spatialLanes ? takeLaneCard(state, match.column, match.depth, 'enemy') : takeTop(state, match.column))!;
  const card=resolveCardRank(sourceCard,rank);
  return { ...state, effectSeed, columns, stock, dealt, tutorial: { ...state.tutorial!, intentProgressThisTurn: (state.tutorial!.intentProgressThisTurn ?? 0) + 1, intent: { ...intent, pips: intent.pips + 1, rank: def.fixedRank ? intent.rank : card.rank, cards: [...intent.cards, card] } } };
}

/** The owner's plays onto the intent this enemy turn: up to `enemyPlays` exposed cards one rank from it, +1 pip each. */
export function intentEnemyPlays(state: BattleState): { state: BattleState; intent: IntentCard | undefined } {
  const def = intentDef(state);
  let next = state;
  for (let play = 0; def && play < def.enemyPlays; play += 1) {
    const played = intentEnemyPlayOne(next);
    if (!played) break;
    next = played;
  }
  return { state: next, intent: next.tutorial?.intent };
}

/** After its plays the intent adds its passive pips, and at full pips fires on every living Kin and returns as a new card. */
export function intentPassiveAndFire(state: BattleState): BattleState {
  const def = intentDef(state), owner = state.foes[0];
  if (!def || !state.tutorial?.intent || intentCapacity(state) <= 0 || state.result || !owner || !foeAlive(owner)) return state;
  const gain = Math.max(0, Math.min(def.passive, progressRemaining(state), Math.max(0,intentCapacity(state) - (owner.iceFrost?.length ?? 0) - state.tutorial.intent.pips)));
  const intent = { ...state.tutorial.intent, pips: state.tutorial.intent.pips + gain };
  let next: BattleState = { ...state, tutorial: { ...state.tutorial, intentProgressThisTurn: (state.tutorial.intentProgressThisTurn ?? 0) + gain, intent } };
  if (intent.pips < intentCapacity(state)) return next;
  // A readying ability doesn't fire at full: it becomes a readied card and the owner winds up next turn.
  if (def.readies) return setBreath(next, 'readied');
  const damage = weakenedHit(owner, intentDamage(next)), targets = partyDamageTargets(next);
  next = { ...next, party: next.party.map(actor => targets.some(t=>t.id===actor.id) ? absorbTempHp(actor,damage) : actor) };
  next = pushEvents(next, targets.flatMap(target => [
    { kind: 'enemy-hit' as const, sourceId: owner.id, targetId: target.id, amount: damage, label: `${owner.name} · ${def.name}` },
    ...(target.hp <= damage ? [{ kind: 'down' as const, sourceId: owner.id, targetId: target.id }] : []),
  ]));
  next = clearDownedAP({ ...next, result: outcome(next) });
  return dealIntent(next, intent.fired + 1);
}

/**
 * The intent's whole enemy turn, after its owner acts. A skipping owner (staggered,
 * dormant, frozen, stunned or held) leaves the intent as it is. Otherwise it
 * plays up to `enemyPlays` exposed cards one rank from the intent (+1 pip
 * each), adds its passive pips, and fires at full pips on every living Kin.
 */
export function advanceIntent(state: BattleState, ownerSkips: boolean): BattleState {
  const owner = state.foes[0];
  if (!intentDef(state) || !state.tutorial?.intent || state.result || !owner || !foeAlive(owner) || ownerSkips) return state;
  return intentPassiveAndFire(intentEnemyPlays({ ...state, tutorial: { ...state.tutorial!, intentProgressThisTurn: 0 } }).state);
}

/** Inspection copy for the intent card. */
export function intentSummary(state: BattleState): string | null {
  const def = intentDef(state), intent = state.tutorial?.intent;
  if (!def || !intent) return null;
  const rank = (value: number) => ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][value];
  const below = rank(intent.rank === 1 ? 13 : intent.rank - 1), above = rank(intent.rank === 13 ? 1 : intent.rank + 1);
  const owner = state.foes[0]?.name ?? 'the enemy', cap = intentCapacity(state), damage = intentDamage(state);
  if (def.readies) return breathStatusText(state, 'deep-breath');
  if (def.casterOnly) return `${def.name} · ${intent.pips} of ${cap} pips. Only ${owner} adds cards here: each enemy turn it plays up to ${def.enemyPlays} exposed ${below}s or ${above}s onto it, picked at random${def.fixedRank ? '' : ', and takes the rank of each'}, +1 pip each${def.passive ? ` and ${def.passive} more on its own` : ''}. At ${cap} it fires for ${damage} damage on every Kin, then returns as a new card. Take the matching cards first to deny it.`;
  return `${def.name} · ${intent.pips} of ${cap} pips. Each enemy turn ${owner} plays up to ${def.enemyPlays} cards here (+1 pip each) and adds ${def.passive}. At ${cap} it fires for ${damage} damage on every Kin, then returns as a new card. Play a ${below} or ${above} here to remove a filled pip, or permanently remove an empty pip when none are filled, and earn 1 Momentum. Capacity scales damage; removing the last pip breaks the ability and staggers its owner.${def.fixedRank ? ' It keeps its rank when played on.' : ' It takes the rank of each card played on it.'}`;
}
