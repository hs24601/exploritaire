import type { ActorDeckState, DeckCardInstance, OrimDefinition, OrimInstance } from './types';
import { randomIdSuffix } from './constants';

const createOrimInstance = (definition: OrimDefinition): OrimInstance => ({
  id: `orim-${definition.id}-${Date.now()}-${randomIdSuffix()}`,
  definitionId: definition.id,
});

const buildSlots = (
  count: number,
  cardId: string,
  lockedMap: Map<number, boolean>
): DeckCardInstance['slots'] => {
  return Array.from({ length: count }).map((_, index) => ({
    id: `${cardId}-slot-${index + 1}`,
    orimId: null,
    locked: lockedMap.get(index) ?? false,
  }));
};

const createDeckCard = (
  cardOwnerId: string,
  cardIndex: number,
  value: number,
  slotCount: number,
  lockedMap: Map<number, boolean>
): DeckCardInstance => {
  const cardId = `${cardOwnerId}-card-${cardIndex}`;
  return {
    id: cardId,
    value,
    slots: buildSlots(slotCount, cardId, lockedMap),
    cooldown: 0,
    maxCooldown: 5,
  };
};

// ACTOR_DECK_TEMPLATES_START
export const ACTOR_DECK_TEMPLATES: Record<string, { values: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }> = {
  keru: {
    values: [1, 3],
    slotsPerCard: [1, 1],
    starterOrim: [],
  },
  fox: {
    values: [1, 3],
    slotsPerCard: [1, 1],
    starterOrim: [],
  },
  lupus: {
    values: [8, 9],
    slotsPerCard: [1, 1],
    starterOrim: [],
  },
};
// ACTOR_DECK_TEMPLATES_END

const normalizeTemplate = (
  template?: {
    values: number[];
    slotsPerCard?: number[];
    starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[];
    slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[];
  }
) => ({
  values: template?.values ?? [],
  slotsPerCard: template?.slotsPerCard ?? [],
  starterOrim: template?.starterOrim ?? [],
  slotLocks: template?.slotLocks ?? [],
});

export function createActorDeckStateWithOrim(
  actorId: string,
  definitionId: string,
  orimDefinitions: OrimDefinition[]
): { deck: ActorDeckState; orimInstances: OrimInstance[] } {
  const template = normalizeTemplate(ACTOR_DECK_TEMPLATES[definitionId]);
  const orimInstances: OrimInstance[] = [];

  const cards = template.values.map((value, index) => {
    const starterSlots = template.starterOrim.filter((entry) => entry.cardIndex === index);
    const lockedSlots = template.slotLocks.filter((entry) => entry.cardIndex === index);
    const baseSlotCount = template.slotsPerCard[index] ?? 1;
    const maxSlotIndex = Math.max(
      0,
      ...starterSlots.map((entry) => entry.slotIndex ?? 0),
      ...lockedSlots.map((entry) => entry.slotIndex ?? 0)
    );
    const slotCount = Math.max(baseSlotCount, maxSlotIndex + 1);
    const lockedMap = new Map<number, boolean>();
    lockedSlots.forEach((entry) => {
      lockedMap.set(entry.slotIndex ?? 0, entry.locked);
    });
    return createDeckCard(actorId, index, value, slotCount, lockedMap);
  });

  template.starterOrim.forEach((entry) => {
    const card = cards[entry.cardIndex];
    if (!card) return;
    const slotIndex = entry.slotIndex ?? 0;
    const slot = card.slots[slotIndex];
    if (!slot) return;
    const definition = orimDefinitions.find((item) => item.id === entry.orimId);
    if (!definition) return;
    const instance = createOrimInstance(definition);
    slot.orimId = instance.id;
    orimInstances.push(instance);
  });

  return {
    deck: {
      actorId,
      cards,
    },
    orimInstances,
  };
}
