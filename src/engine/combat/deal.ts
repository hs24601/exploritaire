import type { Card, CombatDeckState, GameState } from '../types';
import { shuffleDeck } from '../deck';
import { generateRandomCombatCard } from './backfill';
import { createStarterCombatDeckCards, ensureCombatDeck } from './deck';
import { DEFAULT_RANDOM_BIOME_TABLEAU_COUNT, DEFAULT_RANDOM_BIOME_TABLEAU_DEPTH } from './flowConstants';

function drawCardsFromCombatDeck(
  deck: CombatDeckState,
  count: number
): { cards: Card[]; deck: CombatDeckState } {
  const cards: Card[] = [];
  let drawPile = [...deck.drawPile];
  let discardPile = [...deck.discardPile];

  for (let index = 0; index < count; index += 1) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      drawPile = shuffleDeck(discardPile);
      discardPile = [];
    }
    const nextCard = drawPile.pop();
    if (!nextCard) break;
    cards.push(nextCard);
  }

  return {
    cards,
    deck: {
      ...deck,
      drawPile,
      discardPile,
    },
  };
}

function dealTableausFromCombatDeck(
  deck: CombatDeckState,
  tableauCount: number = DEFAULT_RANDOM_BIOME_TABLEAU_COUNT,
  cardsPerTableau: number = DEFAULT_RANDOM_BIOME_TABLEAU_DEPTH
): { tableaus: Card[][]; deck: CombatDeckState } {
  const tableaus: Card[][] = Array.from({ length: tableauCount }, () => []);
  let nextDeck = deck;
  for (let row = 0; row < cardsPerTableau; row += 1) {
    for (let t = 0; t < tableauCount; t += 1) {
      const drawn = drawCardsFromCombatDeck(nextDeck, 1);
      nextDeck = drawn.deck;
      const card = drawn.cards[0] ?? generateRandomCombatCard();
      tableaus[t].push(card);
    }
  }
  return { tableaus, deck: nextDeck };
}

function collectAllCombatCardsForRedeal(state: GameState): Card[] {
  const tableauCards = state.tableaus.flat();
  const deck = ensureCombatDeck(state);
  const stockCards = state.stock ?? [];
  return [...deck.drawPile, ...deck.discardPile, ...tableauCards, ...stockCards];
}

function shuffleAllCombatCardsIntoDeck(state: GameState): CombatDeckState {
  const deck = ensureCombatDeck(state);
  const reshufflePool = collectAllCombatCardsForRedeal(state);
  const fallbackOwned = deck.ownedCards.length > 0 ? deck.ownedCards : createStarterCombatDeckCards();
  const ownedCards = reshufflePool.length > 0 ? reshufflePool : fallbackOwned;
  return {
    ownedCards: [...ownedCards],
    drawPile: shuffleDeck([...ownedCards]),
    discardPile: [],
  };
}

export function resetRandomBiomeDealFromCombatDeck(
  state: GameState,
  tableauCount: number = DEFAULT_RANDOM_BIOME_TABLEAU_COUNT,
  cardsPerTableau: number = DEFAULT_RANDOM_BIOME_TABLEAU_DEPTH
): { tableaus: Card[][]; combatDeck: CombatDeckState } {
  const refreshedDeck = shuffleAllCombatCardsIntoDeck(state);
  const dealt = dealTableausFromCombatDeck(refreshedDeck, tableauCount, cardsPerTableau);
  return {
    tableaus: dealt.tableaus,
    combatDeck: dealt.deck,
  };
}

