import type { Card, Effect } from './types';
import { EFFECT_IDS, KARMA_DEALING_MIN_CARDS, WILD_SENTINEL_RANK } from './constants';

export function getRankDisplay(rank: number): string {
  if (rank === 0) return '?'; // Wild sentinel
  const faceCards: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  return faceCards[rank] || rank.toString();
}

export function isSequential(rank1: number, rank2: number): boolean {
  const diff = Math.abs(rank1 - rank2);
  return diff === 1 || diff === 12; // Ace wraps (K-A or A-2)
}

export function hasElementMatchBuff(effects: Effect[]): boolean {
  return effects.some(
    (effect) => effect.id === EFFECT_IDS.ELEMENT_MATCHING && effect.duration !== 0
  );
}

function isActorFoundationCard(card?: Card): boolean {
  if (!card) return false;
  if (card.rpgCardKind === 'focus' && card.sourceActorId) return true;
  const cardId = card.id ?? '';
  return cardId.startsWith('actor-')
    || cardId.startsWith('combatlab-foundation-')
    || cardId.startsWith('lab-foundation-');
}

export function canPlayCardWithWild(card: Card, foundationTop?: Card, effects: Effect[] = []): boolean {
  if (!foundationTop) return false;
  if (foundationTop.rank === WILD_SENTINEL_RANK) return true;
  if (isActorFoundationCard(foundationTop)) return true;
  return canPlayCard(card, foundationTop, effects);
}

export function canPlayCard(card: Card, foundationTop?: Card, effects: Effect[] = []): boolean {
  if (!foundationTop) return false;
  // Standard rule: sequential ranks
  if (isSequential(card.rank, foundationTop.rank)) {
    return true;
  }

  // Element match buff: same suit
  if (hasElementMatchBuff(effects) && card.suit === foundationTop.suit) {
    return true;
  }

  return false;
}

/**
 * Counts how many tableau top cards can be played to any foundation.
 * Used for karma dealing to ensure a minimum number of playable moves.
 */
export function countPlayableTableauTops(
  tableaus: Card[][],
  foundations: Card[][],
  effects: Effect[] = []
): number {
  let count = 0;

  for (const tableau of tableaus) {
    if (tableau.length === 0) continue;

    const topCard = tableau[tableau.length - 1];
    const canPlay = foundations.some((foundation) => {
      if (foundation.length === 0) return false;
      return canPlayCard(topCard, foundation[foundation.length - 1], effects);
    });

    if (canPlay) {
      count++;
    }
  }

  return count;
}

/**
 * Checks if the current deal meets karma dealing requirements.
 * Returns true if at least KARMA_DEALING_MIN_CARDS tableau tops are playable.
 */
export function checkKarmaDealing(
  tableaus: Card[][],
  foundations: Card[][],
  effects: Effect[] = []
): boolean {
  return countPlayableTableauTops(tableaus, foundations, effects) >= KARMA_DEALING_MIN_CARDS;
}
