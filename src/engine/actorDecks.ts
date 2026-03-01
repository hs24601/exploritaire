import type {
  AbilityLifecycleDef,
  AbilityTriggerDef,
  ActorDeckState,
  DeckCardInstance,
  OrimDefinition,
  OrimInstance,
  Element,
  OrimEffectDef,
  OrimRarity,
  TurnPlayability,
} from './types';
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
  abilityType?: string;
  element?: Element;
  rarity?: OrimDefinition['rarity'];
  tags?: string[];
  effects?: OrimEffectDef[];
  effectsByRarity?: Partial<Record<OrimRarity, OrimEffectDef[]>>;
  triggers?: AbilityTriggerDef[];
  lifecycle?: AbilityLifecycleDef;
};

const abilityDefs: AbilityLike[] = (abilitiesJson as { abilities?: AbilityLike[] }).abilities ?? [];
const abilityDefsById = new Map(abilityDefs.map((entry) => [entry.id ?? '', entry]));

const abilityToOrimDefinition = (ability: AbilityLike): OrimDefinition => {
  const rarity = (ability.rarity ?? 'common') as OrimRarity;
  const effectsByRarity = ability.effectsByRarity;
  const effects = (
    effectsByRarity?.[rarity]
    ?? effectsByRarity?.common
    ?? ability.effects
    ?? []
  );
  return {
    id: ability.id ?? 'ability-unknown',
    name: ability.label ?? ability.id ?? 'Ability',
    description: ability.description ?? '',
    elements: ability.element ? [ability.element] : ['N'],
    category: 'ability',
    domain: 'combat',
    rarity,
    powerCost: 0,
    effects,
    effectsByRarity,
    triggers: ability.triggers ?? [],
    lifecycle: ability.lifecycle,
  };
};

type RarityCostMap = Partial<Record<OrimRarity, number>>;
type DeckTemplate = {
  values: number[];
  costByRarity?: Partial<Record<OrimRarity, number>>[];
  costs?: number[];
  enabledRarities?: OrimRarity[];
  activeCards?: boolean[];
  notDiscardedCards?: boolean[];
  playableTurns?: TurnPlayability[];
  cooldowns?: number[];
  slotsPerCard?: number[];
  starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[];
  slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[];
};

const ORIM_RARITY_OPTIONS: OrimRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

const normalizeRarityCostMap = (
  map: RarityCostMap | undefined,
  fallbackCost: number
): Record<OrimRarity, number> => {
  const normalizedFallback = Number.isFinite(fallbackCost) ? Math.max(0, fallbackCost) : 0;
  const result = {} as Record<OrimRarity, number>;
  let anchor = normalizedFallback;
  ORIM_RARITY_OPTIONS.forEach((rarity) => {
    const rawValue = map?.[rarity];
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      anchor = Math.max(0, rawValue);
    }
    result[rarity] = anchor;
  });
  return result;
};

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

function normalizeAbilityLifecycle(
  lifecycle?: AbilityLifecycleDef
): Required<Pick<AbilityLifecycleDef, 'discardPolicy' | 'exhaustScope' | 'cooldownMode' | 'cooldownValue'>> {
  const discardPolicy = lifecycle?.discardPolicy === 'retain'
    || lifecycle?.discardPolicy === 'reshuffle'
    || lifecycle?.discardPolicy === 'banish'
    ? lifecycle.discardPolicy
    : 'discard';
  const exhaustScope = lifecycle?.exhaustScope === 'turn'
    || lifecycle?.exhaustScope === 'battle'
    || lifecycle?.exhaustScope === 'rest'
    || lifecycle?.exhaustScope === 'run'
    ? lifecycle.exhaustScope
    : 'none';
  const cooldownMode = lifecycle?.cooldownMode === 'seconds'
    || lifecycle?.cooldownMode === 'turns'
    || lifecycle?.cooldownMode === 'combo'
    ? lifecycle.cooldownMode
    : 'none';
  const cooldownValueRaw = Number(lifecycle?.cooldownValue ?? 0);
  const cooldownValue = Number.isFinite(cooldownValueRaw) ? Math.max(0, cooldownValueRaw) : 0;
  return {
    discardPolicy,
    exhaustScope,
    cooldownMode,
    cooldownValue,
  };
}

function resolveDeckRuntimeFromLifecycle(
  lifecycle: AbilityLifecycleDef | undefined,
  fallback: { notDiscarded: boolean; cooldownSeconds: number }
): { notDiscarded: boolean; cooldownSeconds: number } {
  if (!lifecycle) return fallback;
  const normalized = normalizeAbilityLifecycle(lifecycle);
  const isHardExhaust = normalized.exhaustScope === 'battle' || normalized.exhaustScope === 'rest' || normalized.exhaustScope === 'run';
  const reusableByPolicy = normalized.discardPolicy !== 'discard' && normalized.discardPolicy !== 'banish';
  const notDiscarded = isHardExhaust ? false : reusableByPolicy;
  const cooldownSeconds = normalized.cooldownMode === 'seconds'
    ? Math.max(0, normalized.cooldownValue)
    : 0;
  return {
    notDiscarded,
    cooldownSeconds,
  };
}

const createDeckCard = (
  cardOwnerId: string,
  cardIndex: number,
  value: number,
  costByRarity: RarityCostMap,
  enabledRarity: OrimRarity,
  active: boolean,
  notDiscarded: boolean,
  turnPlayability: TurnPlayability,
  cooldownSeconds: number,
  slotCount: number,
  lockedMap: Map<number, boolean>,
  lifecycle?: AbilityLifecycleDef
): DeckCardInstance => {
  const cardId = `${cardOwnerId}-card-${cardIndex}`;
  const runtime = resolveDeckRuntimeFromLifecycle(lifecycle, { notDiscarded, cooldownSeconds });
  return {
    id: cardId,
    value,
    cost: costByRarity.common ?? 0,
    costByRarity,
    enabledRarity,
    active,
    notDiscarded: runtime.notDiscarded,
    discarded: false,
    turnPlayability,
    slots: buildSlots(slotCount, cardId, lockedMap),
    cooldown: 0,
    maxCooldown: Math.max(0, runtime.cooldownSeconds),
  };
};

// ACTOR_DECK_TEMPLATES_START
export const ACTOR_DECK_TEMPLATES: Record<string, { values: number[]; costByRarity?: Partial<Record<OrimRarity, number>>[]; enabledRarities?: OrimRarity[]; costs?: number[]; activeCards?: boolean[]; notDiscardedCards?: boolean[]; playableTurns?: TurnPlayability[]; cooldowns?: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }> = {
  keru: {
    values: [1, 3],
    costByRarity: [
      { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
      { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
    ],
    enabledRarities: ['common', 'common'],
    activeCards: [true, true],
    playableTurns: ['player', 'player'],
    slotsPerCard: [1, 1],
    starterOrim: [],
  },
  fox: {
    values: [1, 3],
    costByRarity: [
      { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
      { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
    ],
    enabledRarities: ['common', 'common'],
    activeCards: [true, true],
    playableTurns: ['player', 'player'],
    slotsPerCard: [1, 1],
    starterOrim: [],
  },
  felis: {
    values: [5, 1, 1],
    costByRarity: [
      { common: 2, uncommon: 2, rare: 2, epic: 2, legendary: 2, mythic: 2 },
      { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
      { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
    ],
    enabledRarities: ['uncommon', 'common', 'common'],
    activeCards: [true, true, true],
    playableTurns: ['player', 'player', 'player'],
    cooldowns: [1, 1, 0],
    slotsPerCard: [1, 1, 1],
    starterOrim: [
      { cardIndex: 0, slotIndex: 0, orimId: 'claw' },
      { cardIndex: 1, slotIndex: 0, orimId: 'skittish_scurry' },
      { cardIndex: 2, slotIndex: 0, orimId: 'cheap_shot' },
    ],
    slotLocks: [
      { cardIndex: 0, slotIndex: 0, locked: true },
      { cardIndex: 1, slotIndex: 0, locked: true },
    ],
  },
  ursus: {
    values: [1, 1],
    costByRarity: [
      { common: 2, uncommon: 2, rare: 2, epic: 2, legendary: 2, mythic: 2 },
      { common: 5, uncommon: 5, rare: 5, epic: 5, legendary: 5, mythic: 5 },
    ],
    enabledRarities: ['common', 'common'],
    activeCards: [true, true],
    playableTurns: ['anytime', 'anytime'],
    cooldowns: [1, 1],
    slotsPerCard: [1, 1],
    starterOrim: [
      { cardIndex: 0, slotIndex: 0, orimId: 'ironfur' },
      { cardIndex: 1, slotIndex: 0, orimId: 'aurora_bearealis' },
    ],
    slotLocks: [
      { cardIndex: 0, slotIndex: 0, locked: true },
      { cardIndex: 1, slotIndex: 0, locked: true },
    ],
  },
  lupus: {
    values: [1],
    costByRarity: [
      { common: 2, uncommon: 2, rare: 2, epic: 2, legendary: 2, mythic: 2 },
    ],
    enabledRarities: ['common'],
    activeCards: [true],
    playableTurns: ['player'],
    cooldowns: [1],
    slotsPerCard: [1],
    starterOrim: [
      { cardIndex: 0, slotIndex: 0, orimId: 'bite' },
    ],
    slotLocks: [
      { cardIndex: 0, slotIndex: 0, locked: true },
    ],
  },
  shade_of_resentment: {
    values: [1, 1],
    costByRarity: [
      { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
      { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
    ],
    enabledRarities: ['common', 'common'],
    activeCards: [true, true],
    playableTurns: ['enemy', 'enemy'],
    slotsPerCard: [1, 1],
    starterOrim: [
      { cardIndex: 0, slotIndex: 0, orimId: 'spite' },
      { cardIndex: 1, slotIndex: 0, orimId: 'resentment' },
    ],
  },
};
// ACTOR_DECK_TEMPLATES_END

const normalizeTemplate = (
  template?: DeckTemplate
) => ({
  values: template?.values ?? [],
  costByRarity: (template?.values ?? []).map((_, index) => (
    normalizeRarityCostMap(template?.costByRarity?.[index], template?.costs?.[index] ?? 0)
  )),
  enabledRarities: (template?.values ?? []).map((_, index) => {
    const value = template?.enabledRarities?.[index];
    if (value === 'uncommon' || value === 'rare' || value === 'epic' || value === 'legendary' || value === 'mythic') {
      return value;
    }
    return 'common';
  }),
  costs: template?.costs ?? [],
  activeCards: template?.activeCards ?? [],
  notDiscardedCards: template?.notDiscardedCards ?? [],
  playableTurns: template?.playableTurns ?? [],
  cooldowns: template?.cooldowns ?? [],
  slotsPerCard: template?.slotsPerCard ?? [],
  starterOrim: template?.starterOrim ?? [],
  slotLocks: template?.slotLocks ?? [],
});

export function createActorDeckStateWithOrim(
  actorId: string,
  definitionId: string,
  orimDefinitions: OrimDefinition[],
  templateOverrides?: Record<string, DeckTemplate>
): { deck: ActorDeckState; orimInstances: OrimInstance[] } {
  const templateSource = templateOverrides ?? ACTOR_DECK_TEMPLATES;
  const template = normalizeTemplate(templateSource[definitionId] ?? ACTOR_DECK_TEMPLATES[definitionId]);
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
    const primaryStarter = starterSlots.find((entry) => (entry.slotIndex ?? 0) === 0) ?? starterSlots[0];
    const primaryLifecycle = primaryStarter?.orimId ? abilityDefsById.get(primaryStarter.orimId)?.lifecycle : undefined;
    return createDeckCard(
      actorId,
      index,
      value,
      normalizeRarityCostMap(template.costByRarity[index], template.costs[index] ?? 0),
      template.enabledRarities[index] ?? 'common',
      template.activeCards[index] ?? true,
      template.notDiscardedCards[index] ?? false,
      template.playableTurns[index] ?? 'player',
      template.cooldowns[index] ?? 0,
      slotCount,
      lockedMap,
      primaryLifecycle
    );
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
