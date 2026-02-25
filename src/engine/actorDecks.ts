import type { ActorDeckState, DeckCardInstance, OrimDefinition, OrimInstance, Element, OrimEffectDef } from './types';
import { randomIdSuffix } from './constants';
import abilitiesJson from '../data/abilities.json';

const createOrimInstance = (definition: OrimDefinition): OrimInstance => ({
  id: `orim-${definition.id}-${Date.now()}-${randomIdSuffix()}`,
  definitionId: definition.id,
});

type AbilityLike = {
  id?: string;
  label?: string;
  description?: string;
  damage?: number;
  abilityType?: string;
  element?: Element;
  power?: number;
  tags?: string[];
  effects?: OrimEffectDef[];
};

const abilityDefs: AbilityLike[] = (abilitiesJson as { abilities?: AbilityLike[] }).abilities ?? [];

const abilityToOrimDefinition = (ability: AbilityLike): OrimDefinition => ({
  id: ability.id ?? 'ability-unknown',
  name: ability.label ?? ability.id ?? 'Ability',
  description: ability.description ?? '',
  elements: ability.element ? [ability.element] : ['N'],
  category: 'ability',
  domain: 'combat',
  rarity: 'common',
  powerCost: ability.power ?? 0,
  damage: ability.damage,
  effects: ability.effects ?? [],
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
  cost: number,
  cooldownSeconds: number,
  slotCount: number,
  lockedMap: Map<number, boolean>
): DeckCardInstance => {
  const cardId = `${cardOwnerId}-card-${cardIndex}`;
  return {
    id: cardId,
    value,
    cost,
    slots: buildSlots(slotCount, cardId, lockedMap),
    cooldown: 0,
    maxCooldown: Math.max(0, cooldownSeconds),
  };
};

// ACTOR_DECK_TEMPLATES_START
export const ACTOR_DECK_TEMPLATES: Record<string, { values: number[]; costs?: number[]; cooldowns?: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }> = {
  keru: {
    values: [1, 3],
    costs: [0, 0],
    cooldowns: [0, 0],
    slotsPerCard: [1, 1],
    starterOrim: [],
  },
  fox: {
    values: [1, 3],
    costs: [0, 0],
    cooldowns: [0, 0],
    slotsPerCard: [1, 1],
    starterOrim: [],
  },
  felis: {
    values: [5],
    costs: [1],
    cooldowns: [0],
    slotsPerCard: [1],
    starterOrim: [
      { cardIndex: 0, slotIndex: 0, orimId: 'claw' },
    ],
    slotLocks: [
      { cardIndex: 0, slotIndex: 0, locked: true },
    ],
  },
  ursus: {
    values: [1],
    costs: [1],
    cooldowns: [0],
    slotsPerCard: [1],
    starterOrim: [
      { cardIndex: 0, slotIndex: 0, orimId: 'ironfur' },
    ],
    slotLocks: [
      { cardIndex: 0, slotIndex: 0, locked: true },
    ],
  },
  lupus: {
    values: [1, 1],
    costs: [5, 0],
    cooldowns: [0, 0],
    slotsPerCard: [1, 1],
    starterOrim: [
      { cardIndex: 0, slotIndex: 0, orimId: 'wild_adaptation' },
      { cardIndex: 1, slotIndex: 0, orimId: 'bite' },
    ],
    slotLocks: [
      { cardIndex: 0, slotIndex: 0, locked: true },
      { cardIndex: 1, slotIndex: 0, locked: true },
    ],
  },
};
// ACTOR_DECK_TEMPLATES_END

const normalizeTemplate = (
  template?: {
    values: number[];
    costs?: number[];
    cooldowns?: number[];
    slotsPerCard?: number[];
    starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[];
    slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[];
  }
) => ({
  values: template?.values ?? [],
  costs: template?.costs ?? [],
  cooldowns: template?.cooldowns ?? [],
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
    return createDeckCard(actorId, index, value, template.costs[index] ?? 0, template.cooldowns[index] ?? 0, slotCount, lockedMap);
  });

  template.starterOrim.forEach((entry) => {
    const card = cards[entry.cardIndex];
    if (!card) return;
    const slotIndex = entry.slotIndex ?? 0;
    const slot = card.slots[slotIndex];
    if (!slot) return;
    let definition = orimDefinitions.find((item) => item.id === entry.orimId);
    if (!definition) {
      const ability = abilityDefs.find((item) => item.id === entry.orimId);
      if (ability) {
        definition = abilityToOrimDefinition(ability);
      }
    }
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
