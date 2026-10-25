import { canPlay, clearDownedAP, drawCard, earnMomentum, foundationCardsOf, actorAlive, foeAlive, receiveCard, takeTop, tableauWidth, type BattleFoe, type BattleState } from './battle';
import { isAdjacentRank } from './setup';
import { tutorialById, type IntentCardDef } from './battleTutorialScenarios';
import { hasStatus, outcome, pushEvents, withStatus, withoutStatus } from './battleStatuses';
import type { Card } from '../protoState';

// Dead-run fixes for the combat sandbox (scenarios 019–024), from the
// tableau Monte Carlo: an enemy intent card that is also a golf target, one
// free pity flip when a party turn opens with nothing legal, and a hold slot
// where a Kin parks one playable card for later. Pure: no React or DOM.

/** The intent card on the table: its rank, filled pips and the cards played onto it. */
export type IntentCard = { id: string; rank: number; pips: number; fired: number; cards: Card[] };

/** Receiver ids beside Kin foundations: the intent card and each Kin's hold slot. */
export const INTENT_RECEIVER = 'intent';
export const holdReceiver = (actorId: string) => `hold:${actorId}`;
export const holdOwner = (receiverId: string) => receiverId.startsWith('hold:') ? receiverId.slice(5) : null;

const scenario = (state: BattleState) => tutorialById(state.tutorial?.id);
export const intentDef = (state: BattleState): IntentCardDef | undefined => scenario(state)?.intentCard;
/** A Kin has a hold slot when the scenario grants one, or once its Hold ability opened it; with no Kin named, whether any slot exists. */
export const hasHoldSlot = (state: BattleState, actorId?: string) => Boolean(scenario(state)?.holdSlot ||
  (actorId ? state.tutorial?.holdsOpen?.includes(actorId) : state.tutorial?.holdsOpen?.length));
export const hasPityDraw = (state: BattleState) => Boolean(scenario(state)?.pityDraw);
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
export type BreathPhase = 'armored' | 'charging' | 'readied' | 'inhaled' | 'choked';
const VULNERABLE: readonly BreathPhase[] = ['charging', 'readied', 'inhaled'];
const patchOwner = (state: BattleState, patch: (foe: BattleFoe) => BattleFoe): BattleState => ({ ...state, foes: state.foes.map((foe, slot) => slot === 0 ? patch(foe) : foe) });
/** Sets the phase; passing null takes the ability card off the table. */
const setBreath = (state: BattleState, breath: BreathPhase, intent?: null): BattleState =>
  ({ ...state, tutorial: { ...state.tutorial!, breath, intent: intent === null ? undefined : state.tutorial?.intent } });

/** The owner (re)armors: no ability on the table, stagger can't build. */
export const armorOwner = (state: BattleState): BattleState =>
  setBreath(patchOwner(state, foe => withStatus(withoutStatus(foe, 'deep-breath'), { id: 'duskscale' })), 'armored', null);

/** Breaking the owner's stagger while its armor is off chokes the ability: the card and its pips are lost. */
export function chokeIfBroken(state: BattleState): BattleState {
  const owner = state.foes[0], phase = state.tutorial?.breath;
  if (!phase || !VULNERABLE.includes(phase) || !owner || owner.staggered <= 0) return state;
  return setBreath(patchOwner(state, foe => withoutStatus(foe, 'deep-breath')), 'choked', null);
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
    case 'armored': {
      if (intentOwnerSkips(owner)) return { state, plays: false, acted: false };
      const cast = patchOwner(dealIntent(state), foe => withStatus(withoutStatus(foe, 'duskscale'), { id: 'deep-breath' }));
      return { state: setBreath(cast, 'charging'), plays: true, acted: true };
    }
    case 'charging': return { state, plays: true, acted: false };
    case 'readied': return { state: setBreath(state, 'inhaled'), plays: false, acted: true };
    case 'inhaled': {
      const targets = state.party.filter(actorAlive);
      let next: BattleState = { ...state, party: state.party.map(actor => actorAlive(actor) ? { ...actor, hp: Math.max(0, actor.hp - def.damage) } : actor) };
      next = pushEvents(next, targets.flatMap(target => [
        { kind: 'enemy-hit' as const, sourceId: owner.id, targetId: target.id, amount: def.damage, label: `${owner.name} · ${def.name}` },
        ...(target.hp <= def.damage ? [{ kind: 'down' as const, sourceId: owner.id, targetId: target.id }] : []),
      ]));
      next = clearDownedAP({ ...next, result: outcome(next) });
      return { state: armorOwner({ ...next, tutorial: { ...next.tutorial!, intent: next.tutorial!.intent && { ...next.tutorial!.intent, fired: next.tutorial!.intent.fired + 1 } } }), plays: false, acted: true };
    }
    case 'choked': return { state: armorOwner(state), plays: false, acted: true };
  }
}

/** The owner's intent badge while it runs a readying ability. */
export function breathIntent(state: BattleState): { summary: string; detail: string; skips: boolean; heavy: boolean; glyph?: string; damage?: number } | null {
  const def = intentDef(state), owner = state.foes[0], phase = state.tutorial?.breath;
  if (!def?.readies || !phase || !owner || !foeAlive(owner)) return null;
  const name = def.name, glyph = '🌬️';
  switch (phase) {
    case 'armored': return { summary: `Casts ${name}`, detail: `${owner.name} is behind Duskscale Armor (no stagger). On its next turn it casts ${name}, sheds the armor and starts charging.`, skips: true, heavy: false, glyph };
    case 'charging': return { summary: `${name} · ${state.tutorial!.intent?.pips ?? 0}/${def.pips}`, detail: breathStatusText(state, 'deep-breath'), skips: true, heavy: false, glyph };
    case 'readied': return { summary: 'Inhaling · skips', detail: breathStatusText(state, 'deep-breath'), skips: true, heavy: false, glyph };
    case 'inhaled': return { summary: `${name} · all Kin`, detail: breathStatusText(state, 'deep-breath'), skips: false, heavy: false, glyph, damage: def.damage };
    case 'choked': return { summary: 'Choked · re-arms', detail: `${name} was choked. ${owner.name} spends its next turn recovering and re-arms with Duskscale Armor, then casts again.`, skips: true, heavy: false, glyph: '☾' };
  }
}

/** Buff copy for the owner's Duskscale Armor and Deep Breath, by phase. */
export function breathStatusText(state: BattleState, id: 'duskscale' | 'deep-breath'): string {
  const def = intentDef(state), owner = state.foes[0]?.name ?? 'The enemy', name = def?.name ?? 'Deep Breath', damage = def?.damage ?? 0;
  if (id === 'duskscale') return `Duskscale Armor: hits can’t build ${owner}’s stagger gauge. It sheds the armor when it starts ${name}, and stays open to staggers until the breath lands or is choked.`;
  const pips = state.tutorial?.intent?.pips ?? 0, full = def?.pips ?? 0;
  const tail = `Break its stagger before then to choke the breath: the charge is lost and the ${owner} re-armors.`;
  switch (state.tutorial?.breath) {
    case 'readied': return `${name}: fully charged and readied. ${owner} skips its next turn to inhale, then breathes ${damage} damage on every Kin the turn after. ${tail}`;
    case 'inhaled': return `${name}: inhaling. On its next turn ${owner} breathes ${damage} damage on every Kin. ${tail}`;
    default: return `${name}: charging, ${pips} of ${full} pips. Only ${owner} adds cards: each turn it plays up to ${def?.enemyPlays ?? 0} exposed cards one rank from ${name}, at random. When it is full, it skips a turn to inhale, then breathes ${damage} damage on every Kin. Its armor is off: staggers build. ${tail}`;
  }
}

/** A fresh intent card ranked from the stock. */
export function dealIntent(state: BattleState, fired = 0): BattleState {
  if (!intentDef(state) || !state.tutorial) return state;
  const { card, stock, dealt } = drawCard(state);
  return { ...state, stock, dealt, tutorial: { ...state.tutorial, intent: { id: `intent-${card.id}`, rank: card.rank, pips: 0, fired, cards: [] } } };
}

export const canPlayOnIntent = (state: BattleState, card: Card | undefined | null) => {
  const intent = state.tutorial?.intent;
  return Boolean(card && intent && intentDef(state) && !intentDef(state)!.casterOnly && partyTurn(state) && !state.traps[card.id] && isAdjacentRank(card.rank, intent.rank));
};

/** A card lands on the intent: one pip off, one Momentum, no AP or hit. Golf intents take the card's rank. */
function strikeIntent(state: BattleState, card: Card, take: Pick<BattleState, 'columns' | 'stock' | 'dealt'>): BattleState {
  const def = intentDef(state)!, intent = state.tutorial!.intent!;
  const next: BattleState = { ...state, ...take, started: true,
    tutorial: { ...state.tutorial!, intent: { ...intent, pips: Math.max(0, intent.pips - 1), rank: def.fixedRank ? intent.rank : card.rank, cards: [...intent.cards, card] } } };
  return earnMomentum(next, INTENT_RECEIVER);
}

export function playOnIntent(state: BattleState, column: number): BattleState {
  const cards = state.columns[column], card = cards?.[cards.length - 1];
  if (!canPlayOnIntent(state, card)) return state;
  const { columns, stock, dealt } = takeTop(state, column)!;
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
  state.columns.some(column => tableauReceivers(state, column[column.length - 1], false).length > 0) ||
  state.party.some(actor => heldReceivers(state, actor.id).length > 0);

/** A party turn opens: with nothing legal, the pity flip is offered once. */
export function openPartyTurn(state: BattleState): BattleState {
  if (!state.tutorial || !hasPityDraw(state) || !partyTurn(state)) return state;
  return { ...state, tutorial: { ...state.tutorial, pity: anyLegalPlay(state) ? undefined : 'ready' } };
}

export const canPityFlip = (state: BattleState) => state.tutorial?.pity === 'ready' && partyTurn(state);

/** One free stock card onto the first living Kin's foundation. Not a receipt: no AP, Momentum or hit. */
export function pityFlip(state: BattleState): BattleState {
  const actor = state.party.find(unit => actorAlive(unit) && !unit.disarmed);
  if (!canPityFlip(state) || !actor) return state;
  const { card, stock, dealt } = drawCard(state);
  return { ...state, stock, dealt, tutorial: { ...state.tutorial!, pity: 'spent' },
    party: state.party.map(unit => unit.id === actor.id ? { ...unit, rank: card.rank, foundationCards: [...foundationCardsOf(unit), card] } : unit) };
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
  if (!def || !intent || intent.pips >= def.pips) return null;
  const matches = state.columns.slice(0, tableauWidth(state)).flatMap((cards, column) => cards.length > 0 && isAdjacentRank(cards[cards.length - 1].rank, intent.rank) ? [column] : []);
  if (!matches.length) return null;
  // Caster-built foundations pick among matching cards at random (from the effect stream), so the player reads risk, not a fixed order.
  let effectSeed = state.effectSeed, column = matches[0];
  if (def.casterOnly && matches.length > 1) { const flip = seededRoll(effectSeed); effectSeed = flip.seed; column = matches[Math.floor(flip.value * matches.length)]; }
  const { card, columns, stock, dealt } = takeTop(state, column)!;
  return { ...state, effectSeed, columns, stock, dealt, tutorial: { ...state.tutorial!, intent: { ...intent, pips: intent.pips + 1, rank: def.fixedRank ? intent.rank : card.rank, cards: [...intent.cards, card] } } };
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
  if (!def || !state.tutorial?.intent || state.result || !owner || !foeAlive(owner)) return state;
  const intent = { ...state.tutorial.intent, pips: Math.min(def.pips, state.tutorial.intent.pips + def.passive) };
  let next: BattleState = { ...state, tutorial: { ...state.tutorial, intent } };
  if (intent.pips < def.pips) return next;
  // A readying ability doesn't fire at full: it becomes a readied card and the owner winds up next turn.
  if (def.readies) return setBreath(next, 'readied');
  const targets = next.party.filter(actorAlive);
  next = { ...next, party: next.party.map(actor => actorAlive(actor) ? { ...actor, hp: Math.max(0, actor.hp - def.damage) } : actor) };
  next = pushEvents(next, targets.flatMap(target => [
    { kind: 'enemy-hit' as const, sourceId: owner.id, targetId: target.id, amount: def.damage, label: `${owner.name} · ${def.name}` },
    ...(target.hp <= def.damage ? [{ kind: 'down' as const, sourceId: owner.id, targetId: target.id }] : []),
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
  return intentPassiveAndFire(intentEnemyPlays(state).state);
}

/** Inspection copy for the intent card. */
export function intentSummary(state: BattleState): string | null {
  const def = intentDef(state), intent = state.tutorial?.intent;
  if (!def || !intent) return null;
  const rank = (value: number) => ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][value];
  const below = rank(intent.rank === 1 ? 13 : intent.rank - 1), above = rank(intent.rank === 13 ? 1 : intent.rank + 1);
  const owner = state.foes[0]?.name ?? 'the enemy';
  if (def.readies) return breathStatusText(state, 'deep-breath');
  if (def.casterOnly) return `${def.name} · ${intent.pips} of ${def.pips} pips. Only ${owner} adds cards here: each enemy turn it plays up to ${def.enemyPlays} exposed ${below}s or ${above}s onto it, picked at random${def.fixedRank ? '' : ', and takes the rank of each'}, +1 pip each${def.passive ? ` and ${def.passive} more on its own` : ''}. At ${def.pips} it fires for ${def.damage} damage on every Kin, then returns as a new card. Take the matching cards first to deny it.`;
  return `${def.name} · ${intent.pips} of ${def.pips} pips. Each enemy turn ${owner} plays up to ${def.enemyPlays} cards here (+1 pip each) and adds ${def.passive}. At ${def.pips} it fires for ${def.damage} damage on every Kin, then returns as a new card. Play a ${below} or ${above} here to remove a pip and earn 1 Momentum (no AP, no hit).${def.fixedRank ? ' It keeps its rank when played on.' : ' It takes the rank of each card played on it.'}`;
}
