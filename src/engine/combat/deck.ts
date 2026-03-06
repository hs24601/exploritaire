import type { Card, CombatDeckState, Element, GameState } from '../types';
import { ELEMENT_TO_SUIT, randomIdSuffix } from '../constants';
import { shuffleDeck } from '../deck';

function createCardFromElement(element: Element, rank: number): Card {
  const suit = ELEMENT_TO_SUIT[element];
  return {
    rank,
    suit,
    element,
    orimSlots: [
      {
        id: `orim-slot-${element}-${rank}-${Date.now()}-${randomIdSuffix()}`,
        orimId: element !== 'N' ? `element-${element}` : null,
      },
    ],
    id: `biome-${element}-${rank}-${Date.now()}-${randomIdSuffix()}`,
  };
}

export function createStarterCombatDeckCards(): Card[] {
  const starterElements: Element[] = ['A', 'E', 'W', 'F', 'D', 'L'];
  const starterRanks = [3, 4, 5, 6, 7];
  const cards: Card[] = [];
  starterElements.forEach((element) => {
    starterRanks.forEach((rank) => {
      cards.push(createCardFromElement(element, rank));
    });
  });
  return cards;
}

function createCombatDeckFromOwned(ownedCards: Card[]): CombatDeckState {
  return {
    ownedCards: [...ownedCards],
    drawPile: shuffleDeck([...ownedCards]),
    discardPile: [],
  };
}

export function ensureCombatDeck(state: GameState): CombatDeckState {
  if (state.combatDeck && state.combatDeck.ownedCards.length > 0) {
    return {
      ownedCards: [...state.combatDeck.ownedCards],
      drawPile: [...state.combatDeck.drawPile],
      discardPile: [...state.combatDeck.discardPile],
    };
  }
  return createCombatDeckFromOwned(createStarterCombatDeckCards());
}
