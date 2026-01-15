import type { Card, BuildPileDefinition, BuildPileProgress, Suit } from './types';
import { ELEMENT_CYCLE } from './lighting';

// Build pile definitions - these define the goals
export const BUILD_PILE_DEFINITIONS: BuildPileDefinition[] = [
  {
    id: 'sapling',
    name: 'Sapling',
    description: 'Feed the sapling with elemental essence',
    startingRank: 1,
    direction: 'ascending',
    mode: 'element-cycle', // Requires Water → Air → Earth → Fire cycle
  },
];

/**
 * Creates initial progress for all build piles
 */
export function createInitialBuildPileProgress(): BuildPileProgress[] {
  return BUILD_PILE_DEFINITIONS.map((def) => ({
    definitionId: def.id,
    cards: [],
    currentRank: def.startingRank,
    currentElementIndex: 0, // Start with Water (💧)
    cyclesCompleted: 0,
    isComplete: false, // Sapling never completes - it grows forever
  }));
}

/**
 * Gets the definition for a build pile progress
 */
export function getBuildPileDefinition(progress: BuildPileProgress): BuildPileDefinition | null {
  return BUILD_PILE_DEFINITIONS.find((d) => d.id === progress.definitionId) || null;
}

/**
 * Gets the current element needed for element-cycle mode
 */
export function getCurrentElement(progress: BuildPileProgress): Suit {
  return ELEMENT_CYCLE[progress.currentElementIndex] as Suit;
}

/**
 * Checks if a card can be added to a build pile
 */
export function canAddToBuildPile(
  card: Card,
  progress: BuildPileProgress,
  definition: BuildPileDefinition
): boolean {
  // Note: Sapling never truly completes, so no isComplete check

  if (definition.mode === 'element-cycle') {
    // Must match both current element AND current rank
    const neededElement = getCurrentElement(progress);
    return card.suit === neededElement && card.rank === progress.currentRank;
  }

  // Sequential mode (legacy)
  if (definition.suit && card.suit !== definition.suit) return false;
  return card.rank === progress.currentRank;
}

/**
 * Adds a card to a build pile
 * Returns new progress or null if card cannot be added
 */
export function addCardToBuildPile(
  card: Card,
  progress: BuildPileProgress,
  definition: BuildPileDefinition
): BuildPileProgress | null {
  if (!canAddToBuildPile(card, progress, definition)) return null;

  const newCards = [...progress.cards, card];

  if (definition.mode === 'element-cycle') {
    // Element cycle mode: cycle through elements, then increment rank
    const nextElementIndex = (progress.currentElementIndex + 1) % 4;
    const elementWrapped = nextElementIndex === 0;

    let nextRank = progress.currentRank;
    let cyclesCompleted = progress.cyclesCompleted;

    if (elementWrapped) {
      // Completed all 4 elements, move to next rank
      nextRank = progress.currentRank === 13 ? 1 : progress.currentRank + 1;

      // If rank also wrapped (back to Ace), we completed a full cycle (52 cards)
      if (progress.currentRank === 13) {
        cyclesCompleted += 1;
      }
    }

    return {
      ...progress,
      cards: newCards,
      currentRank: nextRank,
      currentElementIndex: nextElementIndex,
      cyclesCompleted,
      isComplete: false, // Sapling never completes
    };
  }

  // Sequential mode (legacy)
  const nextRank = definition.direction === 'ascending'
    ? progress.currentRank + 1
    : progress.currentRank - 1;

  const isComplete = definition.direction === 'ascending'
    ? progress.currentRank === 13
    : progress.currentRank === 1;

  return {
    ...progress,
    cards: newCards,
    currentRank: isComplete ? progress.currentRank : nextRank,
    currentElementIndex: 0,
    cyclesCompleted: isComplete ? progress.cyclesCompleted + 1 : progress.cyclesCompleted,
    isComplete,
  };
}

/**
 * Auto-adds as many sequential cards as possible from pending cards to build piles.
 * Returns updated build pile progress array and the IDs of cards that were added.
 */
export function autoAddCardsToBuildPiles(
  pendingCards: Card[],
  buildPiles: BuildPileProgress[]
): { updatedPiles: BuildPileProgress[]; addedCardIds: Set<string> } {
  const addedCardIds = new Set<string>();
  let updatedPiles = [...buildPiles];
  let changed = true;

  while (changed) {
    changed = false;

    for (let pileIdx = 0; pileIdx < updatedPiles.length; pileIdx++) {
      const pile = updatedPiles[pileIdx];
      const definition = getBuildPileDefinition(pile);
      if (!definition) continue;

      for (const card of pendingCards) {
        if (addedCardIds.has(card.id)) continue;

        const newPile = addCardToBuildPile(card, pile, definition);
        if (newPile) {
          updatedPiles = [
            ...updatedPiles.slice(0, pileIdx),
            newPile,
            ...updatedPiles.slice(pileIdx + 1),
          ];
          addedCardIds.add(card.id);
          changed = true;
          break;
        }
      }
    }
  }

  return { updatedPiles, addedCardIds };
}

/**
 * Gets the next card needed for a build pile (for display purposes)
 */
export function getNextNeededRank(progress: BuildPileProgress): number | null {
  return progress.currentRank;
}

/**
 * Gets display string for a rank
 */
export function getRankDisplay(rank: number): string {
  switch (rank) {
    case 1: return 'A';
    case 11: return 'J';
    case 12: return 'Q';
    case 13: return 'K';
    default: return String(rank);
  }
}

/**
 * Gets the next needed card display (element + rank) for element-cycle mode
 */
export function getNextNeededDisplay(progress: BuildPileProgress, definition: BuildPileDefinition): string {
  if (definition.mode === 'element-cycle') {
    const element = getCurrentElement(progress);
    const rank = getRankDisplay(progress.currentRank);
    return `${element} ${rank}`;
  }
  return getRankDisplay(progress.currentRank);
}

/**
 * Clears progress for a specific build pile
 */
export function clearBuildPileProgress(
  buildPiles: BuildPileProgress[],
  definitionId: string
): BuildPileProgress[] {
  const definition = BUILD_PILE_DEFINITIONS.find((d) => d.id === definitionId);
  if (!definition) return buildPiles;

  return buildPiles.map((pile) => {
    if (pile.definitionId !== definitionId) return pile;
    return {
      definitionId,
      cards: [],
      currentRank: definition.startingRank,
      currentElementIndex: 0,
      cyclesCompleted: 0,
      isComplete: false,
    };
  });
}

/**
 * Clears all build pile progress
 */
export function clearAllBuildPileProgress(): BuildPileProgress[] {
  return createInitialBuildPileProgress();
}

/**
 * Gets the sapling's growth level based on cycles and cards
 */
export function getSaplingGrowthLevel(progress: BuildPileProgress): number {
  // Each full cycle (52 cards) increases growth level
  // Also give partial credit for cards within current cycle
  const cycleBonus = progress.cyclesCompleted;
  const cardBonus = Math.floor(progress.cards.length / 13); // Bonus every 13 cards
  return cycleBonus + cardBonus;
}
