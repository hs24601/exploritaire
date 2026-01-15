import type { Actor, Card, ChallengeProgress, BuildPileProgress, Effect, EffectType, GameState, InteractionMode, MetaCard, Move, Suit, Element } from './types';
import { GAME_CONFIG, ELEMENT_TO_SUIT, SUIT_TO_ELEMENT } from './constants';
import { createDeck, shuffleDeck } from './deck';
import { canPlayCard, checkKarmaDealing } from './rules';
import { createInitialProgress, clearAllProgress as clearAllProgressFn, clearPhaseProgress as clearPhaseProgressFn } from './challenges';
import {
  createInitialBuildPileProgress,
  clearAllBuildPileProgress,
  clearBuildPileProgress as clearBuildPileProgressFn,
  addCardToBuildPile,
  getBuildPileDefinition,
} from './buildPiles';
import {
  createInitialActors,
  createEmptyAdventureQueue,
  addActorToQueue,
  removeActorFromQueue,
  getActorDefinition,
  getQueuedActors,
} from './actors';
import {
  createInitialMetaCards,
  addCardToMetaCard,
  findSlotById,
  canAddCardToSlot,
  clearMetaCardProgress as clearMetaCardProgressFn,
  canAssignActorToHomeSlot,
  upgradeMetaCard,
} from './metaCards';
import { getBiomeDefinition } from './biomes';

export interface PersistedState {
  challengeProgress: ChallengeProgress;
  buildPileProgress: BuildPileProgress[];
  pendingCards: Card[];
  interactionMode: InteractionMode;
  availableActors: Actor[];
  adventureQueue: (Actor | null)[];
  metaCards: MetaCard[];
}

/**
 * Creates a foundation card for an actor based on their definition.
 * Uses the actor's value as the rank and their suit (or neutral star if no suit).
 */
function createActorFoundationCard(actor: Actor): Card {
  const definition = getActorDefinition(actor.definitionId);
  if (!definition) {
    throw new Error(`Actor definition not found for ${actor.definitionId}`);
  }

  // Use actor's suit, or neutral star if no elemental affinity
  const suit: Suit = definition.suit || '⭐';
  const element: Element = definition.element || SUIT_TO_ELEMENT[suit];
  const rank = actor.currentValue;

  return {
    rank,
    suit,
    element,
    id: `actor-${actor.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
}

/**
 * Initializes a fresh game state, starting in the garden phase
 */
export function initializeGame(persisted?: Partial<PersistedState>): GameState {
  // Don't deal cards yet - we start in the garden
  return {
    tableaus: [],
    foundations: [],
    stock: [],
    activeEffects: [],
    turnCount: 0,
    collectedCards: [],
    pendingCards: persisted?.pendingCards || [],
    phase: 'garden', // Start in garden
    challengeProgress: persisted?.challengeProgress || createInitialProgress(),
    buildPileProgress: persisted?.buildPileProgress || createInitialBuildPileProgress(),
    interactionMode: persisted?.interactionMode || 'click',
    availableActors: persisted?.availableActors || createInitialActors(),
    adventureQueue: persisted?.adventureQueue || createEmptyAdventureQueue(),
    metaCards: persisted?.metaCards || createInitialMetaCards(),
    blueprints: [], // Player's blueprint library
    pendingBlueprintCards: [], // Blueprints in chaos state
  };
}

/**
 * Starts an adventure - deals cards and transitions to playing phase
 * Foundations are created based on the actors in the adventure party
 * Uses karma dealing to ensure a minimum number of playable moves
 */
export function startAdventure(state: GameState): GameState {
  // Create foundations based on the adventure party (these don't change between redeals)
  const queuedActors = getQueuedActors(state.adventureQueue);
  const foundations: Card[][] = queuedActors.map(actor => [
    createActorFoundationCard(actor),
  ]);

  // Keep dealing until karma requirements are met
  let tableaus: Card[][];
  let stock: Card[];
  let attempts = 0;
  const maxAttempts = 100; // Safety limit to prevent infinite loops

  do {
    const deck = shuffleDeck(createDeck());
    tableaus = Array.from({ length: GAME_CONFIG.tableauCount }, () =>
      deck.splice(0, GAME_CONFIG.cardsPerTableau)
    );
    stock = deck;
    attempts++;
  } while (!checkKarmaDealing(tableaus, foundations, state.activeEffects) && attempts < maxAttempts);

  return {
    ...state,
    tableaus,
    foundations,
    stock,
    phase: 'playing',
    turnCount: 0,
    collectedCards: [],
  };
}

export function processEffects(effects: Effect[]): Effect[] {
  return effects
    .map((effect) => ({
      ...effect,
      duration: effect.duration > 0 ? effect.duration - 1 : effect.duration,
    }))
    .filter((effect) => effect.duration !== 0);
}

export function playCard(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  const tableau = state.tableaus[tableauIndex];
  if (tableau.length === 0) return null;

  const card = tableau[tableau.length - 1];
  const foundationTop = state.foundations[foundationIndex][state.foundations[foundationIndex].length - 1];

  if (!canPlayCard(card, foundationTop, state.activeEffects)) {
    return null;
  }

  const newTableaus = state.tableaus.map((t, i) =>
    i === tableauIndex ? t.slice(0, -1) : t
  );

  const newFoundations = state.foundations.map((f, i) =>
    i === foundationIndex ? [...f, card] : f
  );

  return {
    ...state,
    tableaus: newTableaus,
    foundations: newFoundations,
    activeEffects: processEffects(state.activeEffects),
    turnCount: state.turnCount + 1,
  };
}

export function addEffect(
  state: GameState,
  effectId: string,
  name: string,
  type: EffectType,
  duration: number,
  config: Record<string, unknown> = {}
): GameState {
  return {
    ...state,
    activeEffects: [
      ...state.activeEffects,
      { id: effectId, name, type, duration, config },
    ],
  };
}

export function checkWin(state: GameState): boolean {
  return state.tableaus.every((t) => t.length === 0);
}

export function checkNoValidMoves(state: GameState): boolean {
  return !state.tableaus.some((tableau) => {
    if (tableau.length === 0) return false;
    const topCard = tableau[tableau.length - 1];
    return state.foundations.some((foundation) =>
      canPlayCard(topCard, foundation[foundation.length - 1], state.activeEffects)
    );
  });
}

export function getTableauCanPlay(state: GameState): boolean[] {
  return state.tableaus.map((tableau) => {
    if (tableau.length === 0) return false;
    const topCard = tableau[tableau.length - 1];
    return state.foundations.some((foundation) =>
      canPlayCard(topCard, foundation[foundation.length - 1], state.activeEffects)
    );
  });
}

export function getValidFoundationsForCard(
  state: GameState,
  card: Card
): boolean[] {
  return state.foundations.map((foundation) =>
    canPlayCard(card, foundation[foundation.length - 1], state.activeEffects)
  );
}

export function returnToGarden(state: GameState): GameState {
  // Collect ALL cards from foundations, including initial actor cards
  // This preserves elemental cards when actors have suit affinities
  const allCards = state.foundations.flatMap((f) => f);

  // Return actors from adventure queue back to available
  const returningActors = state.adventureQueue.filter((a): a is Actor => a !== null);
  const newAvailableActors = [...state.availableActors, ...returningActors];

  return {
    ...state,
    tableaus: [],
    foundations: [],
    stock: [],
    collectedCards: allCards,
    // Cards from this run go to pending - player must manually assign them
    pendingCards: allCards,
    phase: 'garden',
    availableActors: newAvailableActors,
    adventureQueue: createEmptyAdventureQueue(),
  };
}

/**
 * Moves an actor from available to a specific adventure queue slot
 */
export function assignActorToQueue(
  state: GameState,
  actorId: string,
  slotIndex: number
): GameState | null {
  const actorIndex = state.availableActors.findIndex(a => a.id === actorId);
  if (actorIndex === -1) return null;

  const actor = state.availableActors[actorIndex];
  const newQueue = addActorToQueue(state.adventureQueue, actor, slotIndex);
  if (!newQueue) return null;

  // Remove from available
  const newAvailable = [
    ...state.availableActors.slice(0, actorIndex),
    ...state.availableActors.slice(actorIndex + 1),
  ];

  return {
    ...state,
    availableActors: newAvailable,
    adventureQueue: newQueue,
  };
}

/**
 * Removes an actor from adventure queue back to available
 */
export function removeActorFromQueueState(
  state: GameState,
  slotIndex: number
): GameState {
  const { actor, newQueue } = removeActorFromQueue(state.adventureQueue, slotIndex);
  if (!actor) return state;

  return {
    ...state,
    availableActors: [...state.availableActors, actor],
    adventureQueue: newQueue,
  };
}

/**
 * Assigns a pending card to the current challenge.
 * Returns null if card is not in pending or doesn't match challenge requirements.
 */
export function assignCardToChallenge(
  state: GameState,
  cardId: string
): GameState | null {
  const cardIndex = state.pendingCards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return null;

  const card = state.pendingCards[cardIndex];

  // Update challenge progress
  const newCollected = { ...state.challengeProgress.collected };
  newCollected[card.suit]++;

  // Remove card from pending
  const newPendingCards = [
    ...state.pendingCards.slice(0, cardIndex),
    ...state.pendingCards.slice(cardIndex + 1),
  ];

  return {
    ...state,
    pendingCards: newPendingCards,
    challengeProgress: {
      ...state.challengeProgress,
      collected: newCollected,
    },
  };
}

/**
 * Assigns a pending card to a build pile.
 * Returns null if card cannot be added to the pile.
 */
export function assignCardToBuildPile(
  state: GameState,
  cardId: string,
  buildPileId: string
): GameState | null {
  const cardIndex = state.pendingCards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return null;

  const card = state.pendingCards[cardIndex];
  const pileIndex = state.buildPileProgress.findIndex((p) => p.definitionId === buildPileId);
  if (pileIndex === -1) return null;

  const pile = state.buildPileProgress[pileIndex];
  const definition = getBuildPileDefinition(pile);
  if (!definition) return null;

  const updatedPile = addCardToBuildPile(card, pile, definition);
  if (!updatedPile) return null;

  // Remove card from pending
  const newPendingCards = [
    ...state.pendingCards.slice(0, cardIndex),
    ...state.pendingCards.slice(cardIndex + 1),
  ];

  // Update build pile progress
  const newBuildPileProgress = [
    ...state.buildPileProgress.slice(0, pileIndex),
    updatedPile,
    ...state.buildPileProgress.slice(pileIndex + 1),
  ];

  return {
    ...state,
    pendingCards: newPendingCards,
    buildPileProgress: newBuildPileProgress,
  };
}

/**
 * Toggles between click and drag-and-drop interaction modes.
 */
export function toggleInteractionMode(state: GameState): GameState {
  return {
    ...state,
    interactionMode: state.interactionMode === 'click' ? 'dnd' : 'click',
  };
}

/**
 * Applies a sequence of moves to the game state.
 * Used by the auto-solve feature to execute all optimal moves at once.
 */
export function applyMoves(state: GameState, moves: Move[]): GameState {
  let currentState = state;

  for (const move of moves) {
    const newTableaus = currentState.tableaus.map((t, i) =>
      i === move.tableauIndex ? t.slice(0, -1) : t
    );

    const newFoundations = currentState.foundations.map((f, i) =>
      i === move.foundationIndex ? [...f, move.card] : f
    );

    currentState = {
      ...currentState,
      tableaus: newTableaus,
      foundations: newFoundations,
      turnCount: currentState.turnCount + 1,
    };
  }

  // Process effects once at the end (or we could process per move)
  return {
    ...currentState,
    activeEffects: processEffects(currentState.activeEffects),
  };
}

/**
 * Clears all progress (phases and build piles), resetting to initial state.
 * Also clears pending cards since they're no longer relevant.
 */
export function clearAllGameProgress(state: GameState): GameState {
  return {
    ...state,
    challengeProgress: clearAllProgressFn(),
    buildPileProgress: clearAllBuildPileProgress(),
    pendingCards: [],
  };
}

/**
 * Clears progress for a specific phase.
 * Does not clear pending cards as they may be used for other phases.
 */
export function clearPhaseGameProgress(state: GameState, phaseId: number): GameState {
  return {
    ...state,
    challengeProgress: clearPhaseProgressFn(state.challengeProgress, phaseId),
  };
}

/**
 * Clears progress for a specific build pile.
 */
export function clearBuildPileGameProgress(state: GameState, buildPileId: string): GameState {
  return {
    ...state,
    buildPileProgress: clearBuildPileProgressFn(state.buildPileProgress, buildPileId),
  };
}

/**
 * Assigns a pending card to a meta-card slot.
 * Returns null if card cannot be added to the slot.
 */
export function assignCardToMetaCardSlot(
  state: GameState,
  cardId: string,
  metaCardId: string,
  slotId: string
): GameState | null {
  const cardIndex = state.pendingCards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return null;

  const card = state.pendingCards[cardIndex];
  const metaCardIndex = state.metaCards.findIndex((mc) => mc.id === metaCardId);
  if (metaCardIndex === -1) return null;

  const metaCard = state.metaCards[metaCardIndex];

  // Validate slot exists and card can be added
  const slot = findSlotById(metaCard, slotId);
  if (!slot || !canAddCardToSlot(card, slot)) return null;

  const updatedMetaCard = addCardToMetaCard(metaCard, slotId, card);
  if (!updatedMetaCard) return null;

  // Remove card from pending
  const newPendingCards = [
    ...state.pendingCards.slice(0, cardIndex),
    ...state.pendingCards.slice(cardIndex + 1),
  ];

  // Check if metacard was just completed - trigger upgrade
  const finalMetaCard = updatedMetaCard.isComplete
    ? upgradeMetaCard(updatedMetaCard)
    : updatedMetaCard;

  // Update meta-cards array
  const newMetaCards = [
    ...state.metaCards.slice(0, metaCardIndex),
    finalMetaCard,
    ...state.metaCards.slice(metaCardIndex + 1),
  ];

  return {
    ...state,
    pendingCards: newPendingCards,
    metaCards: newMetaCards,
  };
}

/**
 * Clears progress for a specific meta-card.
 */
export function clearMetaCardGameProgress(state: GameState, metaCardId: string): GameState {
  return {
    ...state,
    metaCards: clearMetaCardProgressFn(state.metaCards, metaCardId),
  };
}

/**
 * Assigns an actor to a meta-card home slot
 */
export function assignActorToMetaCardHome(
  state: GameState,
  actorId: string,
  metaCardId: string,
  slotId: string
): GameState | null {
  const actorIndex = state.availableActors.findIndex(a => a.id === actorId);
  if (actorIndex === -1) return null;

  const metaCardIndex = state.metaCards.findIndex(mc => mc.id === metaCardId);
  if (metaCardIndex === -1) return null;

  const metaCard = state.metaCards[metaCardIndex];
  if (!canAssignActorToHomeSlot(metaCard, slotId)) return null;

  const actor = state.availableActors[actorIndex];
  const isForest = metaCard.definitionId === 'forest';

  // Update actor to track home (only for non-Forest metacards)
  const updatedActors = [...state.availableActors];
  if (!isForest) {
    updatedActors[actorIndex] = {
      ...updatedActors[actorIndex],
      homeMetaCardId: metaCardId,
    };
  }

  // Update metacard home slot
  const updatedHomeSlots = metaCard.actorHomeSlots.map(slot =>
    slot.id === slotId ? { ...slot, actorId } : slot
  );

  const updatedMetaCards = [...state.metaCards];
  updatedMetaCards[metaCardIndex] = {
    ...metaCard,
    actorHomeSlots: updatedHomeSlots,
  };

  // If this is the Forest metacard, also sync to adventureQueue
  let updatedAdventureQueue = state.adventureQueue;
  if (isForest) {
    // Find the slot index in the Forest's actorHomeSlots
    const slotIndex = metaCard.actorHomeSlots.findIndex(s => s.id === slotId);
    if (slotIndex >= 0 && slotIndex < state.adventureQueue.length) {
      updatedAdventureQueue = [...state.adventureQueue];
      updatedAdventureQueue[slotIndex] = actor;
    }
  }

  return {
    ...state,
    availableActors: updatedActors,
    metaCards: updatedMetaCards,
    adventureQueue: updatedAdventureQueue,
  };
}

/**
 * Removes an actor from all metacard home slots (particularly Forest)
 */
export function removeActorFromMetaCardHome(
  state: GameState,
  actorId: string
): GameState {
  const updatedMetaCards = state.metaCards.map(metaCard => {
    // Check if this metacard has the actor in any of its home slots
    const hasActor = metaCard.actorHomeSlots.some(slot => slot.actorId === actorId);
    if (!hasActor) return metaCard;

    // Remove actor from home slots
    const updatedHomeSlots = metaCard.actorHomeSlots.map(slot =>
      slot.actorId === actorId ? { ...slot, actorId: null } : slot
    );

    return {
      ...metaCard,
      actorHomeSlots: updatedHomeSlots,
    };
  });

  // Also sync with adventureQueue for Forest metacard
  const forestMetaCard = updatedMetaCards.find(mc => mc.definitionId === 'forest');
  let updatedAdventureQueue = state.adventureQueue;
  if (forestMetaCard) {
    updatedAdventureQueue = state.adventureQueue.map((queuedActor) =>
      queuedActor?.id === actorId ? null : queuedActor
    );
  }

  return {
    ...state,
    metaCards: updatedMetaCards,
    adventureQueue: updatedAdventureQueue,
  };
}

/**
 * Updates the grid position of a meta-card
 */
export function updateMetaCardPosition(
  state: GameState,
  metaCardId: string,
  col: number,
  row: number
): GameState {
  const metaCardIndex = state.metaCards.findIndex(mc => mc.id === metaCardId);
  if (metaCardIndex === -1) return state;

  const updatedMetaCard = {
    ...state.metaCards[metaCardIndex],
    gridPosition: { col, row },
  };

  const newMetaCards = [
    ...state.metaCards.slice(0, metaCardIndex),
    updatedMetaCard,
    ...state.metaCards.slice(metaCardIndex + 1),
  ];

  return {
    ...state,
    metaCards: newMetaCards,
  };
}

/**
 * Updates the grid position of an available actor
 */
export function updateActorPosition(
  state: GameState,
  actorId: string,
  col: number,
  row: number
): GameState {
  const actorIndex = state.availableActors.findIndex(a => a.id === actorId);
  if (actorIndex === -1) return state;

  const updatedActor = {
    ...state.availableActors[actorIndex],
    gridPosition: { col, row },
  };

  const newAvailableActors = [
    ...state.availableActors.slice(0, actorIndex),
    updatedActor,
    ...state.availableActors.slice(actorIndex + 1),
  ];

  return {
    ...state,
    availableActors: newAvailableActors,
  };
}

/**
 * Collects a blueprint card from chaos state and adds it to the player's library
 */
export function collectBlueprint(
  state: GameState,
  blueprintCardId: string
): GameState {
  const blueprintCard = state.pendingBlueprintCards.find(bc => bc.id === blueprintCardId);
  if (!blueprintCard) return state;

  // Remove from pending
  const updatedPendingCards = state.pendingBlueprintCards.filter(bc => bc.id !== blueprintCardId);

  // Add to library (check if already exists)
  const alreadyUnlocked = state.blueprints.some(b => b.definitionId === blueprintCard.blueprintId);
  const updatedBlueprints = alreadyUnlocked
    ? state.blueprints
    : [
        ...state.blueprints,
        {
          definitionId: blueprintCard.blueprintId,
          id: `blueprint-${blueprintCard.blueprintId}-${Date.now()}`,
          unlockedAt: Date.now(),
          isNew: true,
        },
      ];

  return {
    ...state,
    pendingBlueprintCards: updatedPendingCards,
    blueprints: updatedBlueprints,
  };
}

// === BIOME SYSTEM ===

/**
 * Helper: Creates a card from element and rank
 */
function createCardFromElement(element: Element, rank: number): Card {
  const suit = ELEMENT_TO_SUIT[element];
  return {
    rank,
    suit,
    element,
    id: `biome-${element}-${rank}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
}

/**
 * Helper: Get random chaos position
 */
function getChaosPosition(): { x: number; y: number } {
  return {
    x: 200 + Math.random() * 400,
    y: 150 + Math.random() * 300,
  };
}

/**
 * Helper: Get random chaos rotation (5-15 degrees)
 */
function getChaosRotation(): number {
  return 5 + Math.random() * 10;
}

/**
 * Starts a biome adventure with predefined layout
 */
export function startBiome(
  state: GameState,
  biomeId: string
): GameState {
  const biomeDef = getBiomeDefinition(biomeId);
  if (!biomeDef) return state;

  // Create tableaus from biome layout
  const tableaus: Card[][] = biomeDef.layout.tableaus.map((ranks, idx) => {
    const elements = biomeDef.layout.elements[idx];
    return ranks.map((rank, cardIdx) => {
      const element = elements[cardIdx];
      return createCardFromElement(element, rank);
    });
  });

  // Create foundations based on queued actors (or empty if none)
  const queuedActors = getQueuedActors(state.adventureQueue);
  const foundations: Card[][] = queuedActors.map(actor => [
    createActorFoundationCard(actor),
  ]);

  return {
    ...state,
    phase: 'biome',
    currentBiome: biomeId,
    biomeMovesCompleted: 0,
    tableaus,
    foundations,
    stock: [],
    activeEffects: [],
    turnCount: 0,
    collectedCards: [],
    pendingBlueprintCards: [],
  };
}

/**
 * Plays a card in biome mode - tracks moves and spawns blueprints
 */
export function playCardInBiome(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  // Use regular playCard logic
  const newState = playCard(state, tableauIndex, foundationIndex);
  if (!newState || !state.currentBiome) return newState;

  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef) return newState;

  const movesCompleted = (newState.biomeMovesCompleted || 0) + 1;

  // Check for blueprint spawn
  let pendingBlueprintCards = newState.pendingBlueprintCards || [];
  if (
    biomeDef.blueprintSpawn &&
    movesCompleted === biomeDef.blueprintSpawn.afterMoves
  ) {
    // Spawn blueprint in chaos state
    const blueprintCard = {
      blueprintId: biomeDef.blueprintSpawn.blueprintId,
      position: getChaosPosition(),
      rotation: getChaosRotation(),
      id: `bp-card-${Date.now()}`,
    };
    pendingBlueprintCards = [...pendingBlueprintCards, blueprintCard];
  }

  return {
    ...newState,
    biomeMovesCompleted: movesCompleted,
    pendingBlueprintCards,
  };
}

/**
 * Completes a biome and returns to garden with rewards
 */
export function completeBiome(state: GameState): GameState {
  if (!state.currentBiome) return state;

  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef) return state;

  // Create reward cards
  const rewardCards: Card[] = [];
  biomeDef.rewards.cards.forEach(({ element, count }) => {
    for (let i = 0; i < count; i++) {
      // Create cards with varied ranks
      const rank = 1 + (i % 13);
      rewardCards.push(createCardFromElement(element, rank));
    }
  });

  // Add blueprint rewards to library
  let updatedBlueprints = state.blueprints;
  if (biomeDef.rewards.blueprints) {
    biomeDef.rewards.blueprints.forEach(blueprintId => {
      const alreadyUnlocked = updatedBlueprints.some(b => b.definitionId === blueprintId);
      if (!alreadyUnlocked) {
        updatedBlueprints = [
          ...updatedBlueprints,
          {
            definitionId: blueprintId,
            id: `blueprint-${blueprintId}-${Date.now()}`,
            unlockedAt: Date.now(),
            isNew: true,
          },
        ];
      }
    });
  }

  return {
    ...state,
    phase: 'garden',
    currentBiome: undefined,
    biomeMovesCompleted: undefined,
    pendingCards: [...state.pendingCards, ...rewardCards],
    collectedCards: [...state.collectedCards, ...rewardCards],
    blueprints: updatedBlueprints,
    pendingBlueprintCards: [],
    tableaus: [],
    foundations: [],
    stock: [],
  };
}
