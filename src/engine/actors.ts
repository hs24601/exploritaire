import type { Actor, ActorDefinition } from './types';

// Actor definitions - templates for creating actor instances
export const ACTOR_DEFINITIONS: ActorDefinition[] = [
  {
    id: 'fennec',
    name: 'Fennec',
    titles: ['Fennec', 'Fox'],
    description: 'A curious fennec fox with keen senses',
    type: 'adventurer',
    value: 9, // Base value for card matching
    element: 'N', // Non-elemental
    sprite: '🦊', // Fennec fox emoji
  },
  {
    id: 'zeev',
    name: "Ze'ev",
    titles: ["Ze'ev", 'Wolf'],
    description: 'A fierce wolf with unwavering loyalty',
    type: 'adventurer',
    value: 1, // Ace value
    element: 'N', // Non-elemental
    sprite: '🐺', // Wolf emoji
  },
];

/**
 * Gets an actor definition by ID
 */
export function getActorDefinition(definitionId: string): ActorDefinition | null {
  return ACTOR_DEFINITIONS.find(d => d.id === definitionId) || null;
}

/**
 * Creates an actor instance from a definition
 */
export function createActor(definitionId: string): Actor | null {
  const definition = getActorDefinition(definitionId);
  if (!definition) return null;

  return {
    definitionId,
    id: `${definitionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    currentValue: definition.value,
  };
}

/**
 * Creates the initial set of available actors for a new game with default grid positions
 */
export function createInitialActors(): Actor[] {
  const actors: Actor[] = [];

  // Fennec at default position
  const fennec = createActor('fennec');
  if (fennec) {
    fennec.gridPosition = { col: 3, row: 2 };
    actors.push(fennec);
  }

  // Ze'ev at nearby position
  const zeev = createActor('zeev');
  if (zeev) {
    zeev.gridPosition = { col: 4, row: 2 };
    actors.push(zeev);
  }

  return actors;
}

/**
 * Creates an empty adventure queue (3 slots)
 */
export function createEmptyAdventureQueue(): (Actor | null)[] {
  return [null, null, null];
}

/**
 * Adds an actor to the adventure queue
 * Returns the new queue or null if failed
 */
export function addActorToQueue(
  queue: (Actor | null)[],
  actor: Actor,
  slotIndex: number
): (Actor | null)[] | null {
  if (slotIndex < 0 || slotIndex >= queue.length) return null;
  if (queue[slotIndex] !== null) return null; // Slot occupied

  const newQueue = [...queue];
  newQueue[slotIndex] = actor;
  return newQueue;
}

/**
 * Removes an actor from the adventure queue
 * Returns the actor and new queue
 */
export function removeActorFromQueue(
  queue: (Actor | null)[],
  slotIndex: number
): { actor: Actor | null; newQueue: (Actor | null)[] } {
  if (slotIndex < 0 || slotIndex >= queue.length) {
    return { actor: null, newQueue: queue };
  }

  const actor = queue[slotIndex];
  const newQueue = [...queue];
  newQueue[slotIndex] = null;
  return { actor, newQueue };
}

/**
 * Checks if the adventure queue has at least one actor
 */
export function canStartAdventure(queue: (Actor | null)[]): boolean {
  return queue.some(slot => slot !== null);
}

/**
 * Gets all actors currently in the queue
 */
export function getQueuedActors(queue: (Actor | null)[]): Actor[] {
  return queue.filter((slot): slot is Actor => slot !== null);
}

/**
 * Gets display value for an actor (similar to card rank display)
 */
export function getActorValueDisplay(value: number): string {
  switch (value) {
    case 1: return 'A';
    case 11: return 'J';
    case 12: return 'Q';
    case 13: return 'K';
    default: return String(value);
  }
}
