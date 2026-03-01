import type { Actor, ActorDefinition } from './types';
import { randomIdSuffix } from './constants';

// Actor definitions - templates for creating actor instances
// ACTOR_DEFINITIONS_START
export const ACTOR_DEFINITIONS: ActorDefinition[] = [
  {
    id: 'felis',
    name: 'Felis',
    titles: ["Night","Prowler"],
    description: 'A fast striker specializing in tempo and precision damage.',
    type: 'adventurer',
    value: 2,
    suit: undefined,
    element: 'N',
    sprite: '🐈',
    baseStamina: 1,
    baseHp: 8,
    baseEvasion: 1,
  },
  {
    id: 'ursus',
    name: 'Ursus',
    titles: ["Iron","Guardian"],
    description: 'A resilient frontliner that disrupts enemies and shields allies.',
    type: 'adventurer',
    value: 3,
    suit: undefined,
    element: 'N',
    sprite: '🐻',
    baseHp: 18,
    baseArmor: 1,
    baseSuperArmor: 0,
  },
  {
    id: 'lupus',
    name: 'Lupus',
    titles: ["Blank","Keru"],
    description: 'Leader of the pack',
    type: 'adventurer',
    value: 10,
    suit: undefined,
    element: 'N',
    sprite: '🦊',
    orimSlots: [
      { orimId: 'claw' },
      { orimId: 'bide' },
    ],
  },
  {
    id: 'target_dummy',
    name: 'Target Dummy',
    titles: ["New Actor 4"],
    description: '',
    type: 'npc',
    value: 1,
    suit: undefined,
    element: 'N',
    sprite: '✨',
    baseLevel: 1,
    baseStamina: 3,
    baseEnergy: 3,
    baseHp: 100,
    baseArmor: 1,
    baseSuperArmor: 0,
    baseDefense: 0,
    baseEvasion: 0,
    baseAccuracy: 0,
    basePower: 0,
    basePowerMax: 1,
    orimSlots: [
      {  },
    ],
  },
  {
    id: 'shade_of_resentment',
    name: 'Shade of Resentment',
    titles: ["New Actor 5"],
    description: '',
    type: 'npc',
    value: 6,
    suit: '🌙',
    element: 'N',
    sprite: '',
    baseLevel: 1,
    baseStamina: 1,
    baseEnergy: 1,
    baseHp: 5,
    baseArmor: 0,
    baseSuperArmor: 0,
    baseDefense: 0,
    baseEvasion: 0,
    baseAccuracy: 100,
    basePower: 0,
    basePowerMax: 3,
    orimSlots: [
      {  },
    ],
  },
];
// ACTOR_DEFINITIONS_END

/**
 * Gets an actor definition by ID
 */
export function getActorDefinition(definitionId: string): ActorDefinition | null {
  const direct = ACTOR_DEFINITIONS.find((definition) => definition.id === definitionId);
  if (direct) return direct;
  return ACTOR_DEFINITIONS.find((definition) => definition.aliases?.includes(definitionId)) || null;
}

function getActorLetter(definition: ActorDefinition): string {
  const titleSource = definition.titles[definition.titles.length - 1] || definition.name;
  const cleaned = titleSource.replace(/[^A-Za-z0-9]/g, '');
  const fallback = cleaned[0] || definition.name.replace(/[^A-Za-z0-9]/g, '')[0] || '?';
  return fallback.toUpperCase();
}

export function getActorDisplayGlyph(definitionId: string, showGraphics: boolean): string {
  const definition = getActorDefinition(definitionId);
  if (!definition) return '?';
  return showGraphics ? (definition.sprite ?? '?') : getActorLetter(definition);
}

/**
 * Creates an actor instance from a definition
 */
export function createActor(definitionId: string): Actor | null {
  const definition = getActorDefinition(definitionId);
  if (!definition) return null;

  const actorId = `${definitionId}-${Date.now()}-${randomIdSuffix()}`;
  const baseSlots = definition.orimSlots?.length ? definition.orimSlots : [{ locked: false }];
  const orimSlots = baseSlots.map((slot, index) => ({
    id: `${actorId}-orim-slot-${index + 1}`,
    orimId: slot.orimId ?? null,
    locked: slot.locked ?? false,
  }));

  const baseLevel = Math.max(1, definition.baseLevel ?? 1);
  const baseStamina = Math.max(0, definition.baseStamina ?? 3);
  const baseEnergy = Math.max(0, definition.baseEnergy ?? 3);
  const baseHp = Math.max(1, definition.baseHp ?? 10);
  const baseArmor = Math.max(0, definition.baseArmor ?? 0);
  const baseSuperArmor = Math.max(0, definition.baseSuperArmor ?? 0);
  const baseDefense = Math.max(0, definition.baseDefense ?? 0);
  const baseEvasion = Math.max(0, definition.baseEvasion ?? 0);
  const baseAccuracy = Math.max(0, definition.baseAccuracy ?? 100);
  const basePower = Math.max(0, definition.basePower ?? 0);
  const basePowerMax = Math.max(0, definition.basePowerMax ?? 3);

  return {
    definitionId,
    id: actorId,
    currentValue: definition.value,
    level: baseLevel,
    stamina: baseStamina,
    staminaMax: baseStamina,
    energy: baseEnergy,
    energyMax: baseEnergy,
    hp: baseHp,
    hpMax: baseHp,
    armor: baseArmor,
    superArmor: baseSuperArmor,
    defense: baseDefense,
    evasion: baseEvasion,
    accuracy: baseAccuracy,
    damageTaken: 0,
    power: basePower,
    powerMax: basePowerMax,
    orimSlots,
  };
}

/**
 * Creates the initial set of available actors for a new game with default grid positions
 */
export function createInitialActors(): Actor[] {
  const actors: Actor[] = [];

  const felis = createActor('felis');
  if (felis) {
    felis.gridPosition = { col: 2, row: 2 };
    actors.push(felis);
  }

  const ursus = createActor('ursus');
  if (ursus) {
    ursus.gridPosition = { col: 4, row: 2 };
    actors.push(ursus);
  }

  const lupus = createActor('lupus');
  if (lupus) {
    lupus.gridPosition = { col: 3, row: 2 };
    actors.push(lupus);
  }

  return actors;
}

/**
 * Checks if the party has at least one actor
 */
export function canStartAdventure(party: Actor[]): boolean {
  return party.length > 0;
}

/**
 * Gets display value for an actor (similar to card rank display)
 */
export function getActorValueDisplay(value: number): string {
  switch (value) {
    case 1:
      return 'A';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    default:
      return String(value);
  }
}
