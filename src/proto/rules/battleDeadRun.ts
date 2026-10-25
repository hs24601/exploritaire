import { canPlay, clearDownedAP, drawCard, earnMomentum, foundationCardsOf, actorAlive, foeAlive, receiveCard, takeTop, tableauWidth, type BattleState } from './battle';
import { isAdjacentRank } from './setup';
import { tutorialById, type IntentCardDef } from './battleTutorialScenarios';
import { outcome, pushEvents } from './battleStatuses';
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
export const hasHoldSlot = (state: BattleState) => Boolean(scenario(state)?.holdSlot);
export const hasPityDraw = (state: BattleState) => Boolean(scenario(state)?.pityDraw);
const partyTurn = (state: BattleState) => state.turn === 'party' && !state.result;

/** A fresh intent card ranked from the stock. */
export function dealIntent(state: BattleState, fired = 0): BattleState {
  if (!intentDef(state) || !state.tutorial) return state;
  const { card, stock, dealt } = drawCard(state);
  return { ...state, stock, dealt, tutorial: { ...state.tutorial, intent: { id: `intent-${card.id}`, rank: card.rank, pips: 0, fired, cards: [] } } };
}

export const canPlayOnIntent = (state: BattleState, card: Card | undefined | null) => {
  const intent = state.tutorial?.intent;
  return Boolean(card && intent && intentDef(state) && partyTurn(state) && !state.traps[card.id] && isAdjacentRank(card.rank, intent.rank));
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
  Boolean(card && hasHoldSlot(state) && state.tutorial && !heldCard(state, actorId) && canPlay(state, actorId, card));

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

/**
 * The intent's enemy turn, after its owner acts. A skipping owner (staggered,
 * dormant, frozen, stunned or held) leaves the intent as it is. Otherwise it
 * plays up to `enemyPlays` exposed cards one rank from the intent (+1 pip
 * each), adds its passive pips, and fires at full pips on every living Kin.
 */
export function advanceIntent(state: BattleState, ownerSkips: boolean): BattleState {
  const def = intentDef(state), owner = state.foes[0];
  if (!def || !state.tutorial?.intent || state.result || !owner || !foeAlive(owner) || ownerSkips) return state;
  let next = state, intent = state.tutorial.intent;
  for (let play = 0; play < def.enemyPlays && intent.pips < def.pips; play += 1) {
    const column = next.columns.slice(0, tableauWidth(next)).findIndex(cards => cards.length > 0 && isAdjacentRank(cards[cards.length - 1].rank, intent.rank));
    if (column < 0) break;
    const { card, columns, stock, dealt } = takeTop(next, column)!;
    intent = { ...intent, pips: intent.pips + 1, rank: def.fixedRank ? intent.rank : card.rank, cards: [...intent.cards, card] };
    next = { ...next, columns, stock, dealt };
  }
  intent = { ...intent, pips: Math.min(def.pips, intent.pips + def.passive) };
  next = { ...next, tutorial: { ...next.tutorial!, intent } };
  if (intent.pips < def.pips) return next;
  const targets = next.party.filter(actorAlive);
  next = { ...next, party: next.party.map(actor => actorAlive(actor) ? { ...actor, hp: Math.max(0, actor.hp - def.damage) } : actor) };
  next = pushEvents(next, targets.flatMap(target => [
    { kind: 'enemy-hit' as const, sourceId: owner.id, targetId: target.id, amount: def.damage, label: `${owner.name} · ${def.name}` },
    ...(target.hp <= def.damage ? [{ kind: 'down' as const, sourceId: owner.id, targetId: target.id }] : []),
  ]));
  next = clearDownedAP({ ...next, result: outcome(next) });
  return dealIntent(next, intent.fired + 1);
}

/** Inspection copy for the intent card. */
export function intentSummary(state: BattleState): string | null {
  const def = intentDef(state), intent = state.tutorial?.intent;
  if (!def || !intent) return null;
  const rank = (value: number) => ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][value];
  const below = rank(intent.rank === 1 ? 13 : intent.rank - 1), above = rank(intent.rank === 13 ? 1 : intent.rank + 1);
  return `${def.name} · ${intent.pips} of ${def.pips} pips. Each enemy turn ${state.foes[0]?.name ?? 'the enemy'} plays up to ${def.enemyPlays} cards here (+1 pip each) and adds ${def.passive}. At ${def.pips} it fires for ${def.damage} damage on every Kin, then returns as a new card. Play a ${below} or ${above} here to remove a pip and earn 1 Momentum (no AP, no hit).${def.fixedRank ? ' It keeps its rank when played on.' : ' It takes the rank of each card played on it.'}`;
}
