import type { Card, CardSlot, CardSlotGroup, MetaCard, MetaCardDefinition, ActorHomeSlot } from './types';

// Meta-card definitions
export const META_CARD_DEFINITIONS: MetaCardDefinition[] = [
  {
    id: 'burrowing_den',
    name: 'Burrowing Den',
    description: 'Upgrade the den to house another adventuring creature',
    slotGroups: [
      { requirement: { suit: '💧' }, count: 2, label: 'Water' },
      { requirement: { suit: '⛰️' }, count: 2, label: 'Earth' },
    ],
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Assemble your adventure party and venture into the unknown',
    slotGroups: [], // No card slots, only actor slots
  },
];

/**
 * Gets a meta-card definition by ID
 */
export function getMetaCardDefinition(definitionId: string): MetaCardDefinition | null {
  return META_CARD_DEFINITIONS.find(d => d.id === definitionId) || null;
}

/**
 * Gets the display name for a meta-card, including upgrade level
 */
export function getMetaCardDisplayName(metaCard: MetaCard): string {
  const definition = getMetaCardDefinition(metaCard.definitionId);
  if (!definition) return 'Unknown';
  return metaCard.upgradeLevel > 0
    ? `${definition.name}+${metaCard.upgradeLevel}`
    : definition.name;
}

/**
 * Creates an actor home slot
 */
function createActorHomeSlot(metaCardDefId: string, index: number): ActorHomeSlot {
  return {
    id: `${metaCardDefId}-home-${index}-${Date.now()}`,
    actorId: null,
  };
}

/**
 * Creates a new meta-card instance from a definition
 */
export function createMetaCard(definitionId: string): MetaCard | null {
  const definition = getMetaCardDefinition(definitionId);
  if (!definition) return null;

  const slotGroups: CardSlotGroup[] = definition.slotGroups.map((groupDef, groupIdx) => ({
    slots: Array.from({ length: groupDef.count }, (_, slotIdx) => ({
      id: `${definitionId}-${groupIdx}-${slotIdx}`,
      requirement: groupDef.requirement,
      card: null,
    })),
    label: groupDef.label,
  }));

  return {
    definitionId,
    id: `${definitionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    slotGroups,
    isComplete: false,
    upgradeLevel: 0,
    actorHomeSlots: [], // Start with 0 slots, first upgrade adds slot
  };
}

/**
 * Creates initial meta-cards for a new game with default grid positions
 */
export function createInitialMetaCards(): MetaCard[] {
  const burrowingDen = createMetaCard('burrowing_den');
  if (burrowingDen) {
    // Default position: column 4, row 3
    burrowingDen.gridPosition = { col: 4, row: 3 };
  }

  const forest = createMetaCard('forest');
  if (forest) {
    // Default position: column 5, row 1
    forest.gridPosition = { col: 5, row: 1 };
    // Forest starts with 3 actor slots for adventure party
    forest.actorHomeSlots = [
      createActorHomeSlot('forest', 0),
      createActorHomeSlot('forest', 1),
      createActorHomeSlot('forest', 2),
    ];
  }

  return [burrowingDen, forest].filter(Boolean) as MetaCard[];
}

/**
 * Checks if an actor can be assigned to a home slot
 */
export function canAssignActorToHomeSlot(
  metaCard: MetaCard,
  slotId: string
): boolean {
  const slot = metaCard.actorHomeSlots.find(s => s.id === slotId);
  return slot !== null && slot !== undefined && slot.actorId === null;
}

/**
 * Finds a home slot by ID within a meta-card
 */
export function findHomeSlotById(
  metaCard: MetaCard,
  slotId: string
): ActorHomeSlot | null {
  return metaCard.actorHomeSlots.find(s => s.id === slotId) || null;
}

/**
 * Upgrades a meta-card: increments level, clears card slots, adds new home slot
 */
export function upgradeMetaCard(metaCard: MetaCard): MetaCard {
  const newLevel = metaCard.upgradeLevel + 1;

  // Clear all card slots (cards are consumed)
  const clearedSlotGroups = metaCard.slotGroups.map(group => ({
    ...group,
    slots: group.slots.map(s => ({ ...s, card: null })),
  }));

  // Add a new home slot
  const newHomeSlot = createActorHomeSlot(metaCard.definitionId, newLevel);

  return {
    ...metaCard,
    upgradeLevel: newLevel,
    slotGroups: clearedSlotGroups,
    isComplete: false,
    actorHomeSlots: [...metaCard.actorHomeSlots, newHomeSlot],
  };
}

/**
 * Checks if a card can be added to a specific slot
 */
export function canAddCardToSlot(card: Card, slot: CardSlot): boolean {
  // Slot already has a card
  if (slot.card !== null) return false;

  const req = slot.requirement;

  // Check suit requirement
  if (req.suit && card.suit !== req.suit) return false;

  // Check rank requirements
  if (req.minRank !== undefined && card.rank < req.minRank) return false;
  if (req.maxRank !== undefined && card.rank > req.maxRank) return false;

  return true;
}

/**
 * Finds a slot by ID within a meta-card
 */
export function findSlotById(metaCard: MetaCard, slotId: string): CardSlot | null {
  for (const group of metaCard.slotGroups) {
    const slot = group.slots.find(s => s.id === slotId);
    if (slot) return slot;
  }
  return null;
}

/**
 * Adds a card to a specific slot in a meta-card
 * Returns updated meta-card or null if invalid
 */
export function addCardToMetaCard(
  metaCard: MetaCard,
  slotId: string,
  card: Card
): MetaCard | null {
  const slot = findSlotById(metaCard, slotId);
  if (!slot || !canAddCardToSlot(card, slot)) return null;

  // Create updated slot groups with the card added
  const newSlotGroups = metaCard.slotGroups.map(group => ({
    ...group,
    slots: group.slots.map(s =>
      s.id === slotId ? { ...s, card } : s
    ),
  }));

  // Check if all slots are now filled
  const isComplete = newSlotGroups.every(group =>
    group.slots.every(s => s.card !== null)
  );

  return {
    ...metaCard,
    slotGroups: newSlotGroups,
    isComplete,
  };
}

/**
 * Gets the progress of a meta-card (filled slots / total slots)
 */
export function getMetaCardProgress(metaCard: MetaCard): { current: number; total: number } {
  let current = 0;
  let total = 0;

  for (const group of metaCard.slotGroups) {
    for (const slot of group.slots) {
      total++;
      if (slot.card !== null) current++;
    }
  }

  return { current, total };
}

/**
 * Clears all cards from a meta-card (resets progress)
 */
export function clearMetaCard(metaCard: MetaCard): MetaCard {
  const newSlotGroups = metaCard.slotGroups.map(group => ({
    ...group,
    slots: group.slots.map(s => ({ ...s, card: null })),
  }));

  return {
    ...metaCard,
    slotGroups: newSlotGroups,
    isComplete: false,
  };
}

/**
 * Clears a specific meta-card in the array by ID
 */
export function clearMetaCardProgress(
  metaCards: MetaCard[],
  metaCardId: string
): MetaCard[] {
  return metaCards.map(mc =>
    mc.id === metaCardId ? clearMetaCard(mc) : mc
  );
}
