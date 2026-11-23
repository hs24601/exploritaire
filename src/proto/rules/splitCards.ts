import type { Card } from '../protoState';

export const cardRanks = (card: Card): number[] => card.alternateRank === undefined ? [card.rank] : [...new Set([card.rank, card.alternateRank])];
export const validSplitPair = (a: number, b: number) => Number.isInteger(a) && Number.isInteger(b) && a >= 1 && a <= 13 && b >= 1 && b <= 13 && ![0,1,12].includes(Math.abs(a-b));

/** Derive the alternate from card identity without consuming the deal/effect RNG. */
export function splitCard(card: Card): Card {
  if (card.alternateRank !== undefined && validSplitPair(card.rank,card.alternateRank)) return card;
  let hash=2166136261;
  for (const char of card.id) hash=Math.imul(hash ^ char.charCodeAt(0),16777619) >>> 0;
  return {...card,alternateRank:((card.rank-1+2+hash%10)%13)+1};
}

/** A receipt is one card and one chosen rank, never two sequential plays. */
export const resolveCardRank = (card: Card, rank: number): Card => card.alternateRank === undefined && card.rank === rank ? card : ({...card,rank,alternateRank:undefined});
