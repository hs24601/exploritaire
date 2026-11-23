import type { Card } from '../protoState';
import type { BattleState } from './battle';

// Elemental suits (combatsbx 1002, from docs/research/suited-cards-montecarlo.md):
// every tableau card carries one of six elements, and each Kin has a fixed
// element. Once per party turn, team-wide, a card of a Kin's element may play
// on that Kin's foundation at any rank. A card that is also ±1 legal is a normal
// play and keeps the charge.

export const ELEMENTS = ['earth', 'air', 'fire', 'water', 'chaos', 'nature'] as const;
export type Element = typeof ELEMENTS[number] | 'ice';

/** Opposed pairs; display and notes only for now (the opposed block is a curse idea, not a base rule). */
export const OPPOSED: Record<typeof ELEMENTS[number], typeof ELEMENTS[number]> = { earth: 'air', air: 'earth', fire: 'water', water: 'fire', chaos: 'nature', nature: 'chaos' };

export const ELEMENT_FACE: Record<Element, { name: string; glyph: string }> = {
  earth: { name: 'Earth', glyph: '⛰️' },
  air: { name: 'Air', glyph: '💨' },
  fire: { name: 'Fire', glyph: '🔥' },
  water: { name: 'Water', glyph: '💧' },
  chaos: { name: 'Chaos', glyph: '✦' },
  nature: { name: 'Nature', glyph: '🌿' },
  ice: { name: 'Ice', glyph: '❄' },
};

/** Each Kin's fixed element; different and not opposed. */
export const KIN_ELEMENTS: Partial<Record<string, Element>> = { mochi: 'earth', cir: 'air' };
export const kinElement = (actorId: string): Element | undefined => KIN_ELEMENTS[actorId.split(':')[0]];
export const actorElements = (state: Pick<BattleState, 'cirCompanion'>, actorId: string): Element[] => actorId === 'cir' ? ['fire', 'air'] : [...new Set([kinElement(actorId), ...(state.cirCompanion?.form === 'familiar' && state.cirCompanion.host === actorId && (state.cirCompanion.awakened || state.cirCompanion.pips >= 3) ? ['fire' as const, 'air' as const] : [])].filter((e): e is Element => !!e))];

/**
 * A card's element, uniform over the six and fixed by its identity. Stock card
 * ids name their seed and stock index, so the suit comes from the same seeded
 * stock as the rank without consuming the deal or effect streams.
 */
export function cardElement(card: Pick<Card, 'id' | 'element'>): Element {
  if (card.element) return card.element;
  let hash = 2166136261;
  for (const char of card.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x2c1b3c6d) >>> 0; hash ^= hash >>> 12;
  return ELEMENTS[(hash >>> 0) % ELEMENTS.length];
}

export const elementSuitsOn = (state: Pick<BattleState, 'rules'>) => Boolean(state.rules.elementSuits);
/** The team-wide element play is unspent this party turn. */
export const elementPlayReady = (state: Pick<BattleState, 'rules' | 'elementPlay'>) => elementSuitsOn(state) && state.elementPlay !== 'spent';

/** The element route alone: the charge is ready and the card's element is the Kin's. */
export const elementPlayLegal = (state: Pick<BattleState, 'rules' | 'elementPlay' | 'keruElementSpent' | 'cirCompanion'>, actorId: string, card: Pick<Card, 'id' | 'element'>) =>
  elementSuitsOn(state) && (actorId === 'cir' ? !state.keruElementSpent?.includes(actorId) : elementPlayReady(state)) && actorElements(state, actorId).includes(cardElement(card));

/** A receipt spends the charge only when it was off-sequence: legal by element and not by rank. */
export const spendsElementPlay = (state: Pick<BattleState, 'rules' | 'elementPlay' | 'keruElementSpent' | 'cirCompanion'>, actorId: string, card: Pick<Card, 'id' | 'element'>, sequenceLegal: boolean) =>
  !sequenceLegal && elementPlayLegal(state, actorId, card);

/** The charge resets as each party turn opens. */
export const openElementTurn = <S extends Pick<BattleState, 'rules' | 'elementPlay' | 'keruElementSpent'>>(state: S): S =>
  elementSuitsOn(state) ? { ...state, elementPlay: 'ready', keruElementSpent: [] } : state;
