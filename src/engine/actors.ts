import type { Actor, ActorDefinition } from './types';
import { randomIdSuffix } from './constants';

// Actor definitions - templates for creating actor instances
// ACTOR_DEFINITIONS_START
export const ACTOR_DEFINITIONS: ActorDefinition[] = [
  {
    id: 'fox',
    name: 'Fox',
    titles: ['Fennec', 'Fox'],
    description: 'A curious fennec fox with keen senses',
    type: 'adventurer',
    value: 2,
    suit: undefined,
    element: 'N',
    sprite: '🦊',
    orimSlots: [
      { orimId: 'claw', locked: true },
      { orimId: 'bide' },
    ],
  },
  {
    id: 'wolf',
    name: 'Wolf',
    titles: ["Ze'ev", 'Wolf'],
    description: 'A fierce wolf with unwavering loyalty',
    type: 'adventurer',
    value: 3,
    suit: undefined,
    element: 'N',
    sprite: '🐺',
    orimSlots: [
      { orimId: 'bite', locked: true },
      { orimId: 'teamwork' },
    ],
  },
  {
    id: 'owl',
    name: 'Owl',
    titles: ['Strix', 'Owl'],
    description: 'A calm owl with patient insight',
    type: 'adventurer',
    value: 10,
    suit: undefined,
    element: 'N',
    sprite: '🦉',
    orimSlots: [
      { orimId: 'cloud_sight', locked: true },
    ],
  },
  {
    id: 'shadowcub',
    name: 'Shadowcub',
    titles: ['Shadow', 'Cub'],
    description: 'A quick shadow cub that strikes from the fringe',
    type: 'npc',
    value: 6,
    suit: undefined,
    element: 'D',
    sprite: '🐾',
    orimSlots: [],
  },
  {
    id: 'shadowkit',
    name: 'Shadowkit',
    titles: ['Shadow', 'Kit'],
    description: 'A nimble shadow kit with lunar instincts',
    type: 'npc',
    value: 6,
    suit: undefined,
    element: 'D',
    sprite: '🌘',
    orimSlots: [],
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
  return showGraphics ? definition.sprite : getActorLetter(definition);
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
    orimId: null,
    locked: slot.locked ?? false,
  }));
  return {
    definitionId,
    id: actorId,
    currentValue: definition.value,
    level: 1,
    stamina: 3,
    staminaMax: 3,
    energy: 3,
    energyMax: 3,
    hp: 10,
    hpMax: 10,
    armor: 0,
    evasion: 0,
    accuracy: 100,
    damageTaken: 0,
    power: 0,
    powerMax: 3,
    orimSlots,
  };
}

/**
 * Creates the initial set of available actors for a new game with default grid positions
 */
export function createInitialActors(): Actor[] {
  const actors: Actor[] = [];

  const fox = createActor('fox');
  if (fox) {
    fox.gridPosition = { col: 3, row: 2 };
    actors.push(fox);
  }

  const wolf = createActor('wolf');
  if (wolf) {
    wolf.gridPosition = { col: 4, row: 2 };
    actors.push(wolf);
  }

  const owl = createActor('owl');
  if (owl) {
    owl.gridPosition = { col: 4, row: 3 };
    actors.push(owl);
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
