import type { Card } from './types';
import { SUITS, SUIT_TO_ELEMENT } from './constants';
import { SeededRandom } from './seededRandom';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  const timestamp = Date.now();

  for (let suitIndex = 0; suitIndex < SUITS.length; suitIndex++) {
    const suit = SUITS[suitIndex];
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        rank,
        suit,
        element: SUIT_TO_ELEMENT[suit],
        id: `${suitIndex}-${rank}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      });
    }
  }

  return deck;
}

/**
 * Shuffles a deck of cards using Fisher-Yates algorithm
 * @param deck - The deck to shuffle
 * @param seed - Optional seed string for deterministic shuffling
 * @returns A new shuffled deck
 */
export function shuffleDeck(deck: Card[], seed?: string): Card[] {
  const shuffled = [...deck];
  const rng = seed ? new SeededRandom(seed) : null;

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng ? rng.nextInt(i + 1) : Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
