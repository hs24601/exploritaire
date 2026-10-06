import type { ProtoHeroClass } from './protoTypes';

export type ProtoMobilityKind = 'dig' | 'blink' | 'hallowed_path';

export type ProtoActorData = {
  id: string;
  label: string;
  animalType: string;
  heroClass: ProtoHeroClass;
  hp: number;
  maxHp: number;
  cardTransportSpeed: number;
  mobility?: {
    kind: ProtoMobilityKind;
    label: string;
  };
};

export type ProtoEnemyData = {
  id: string;
  label: string;
  valueLabel: string;
  currentRank: number;
  ability: string;
  intent: {
    symbol: string;
    targetId: string | null;
    tone: 'attack' | 'support';
  };
  next: string;
  threshold: number;
  hp: number;
  maxHp: number;
  comboCount: number;
  cardTransportSpeed: number;
};

export type ProtoAbilityTrigger = {
  id: string;
  kind: 'spent_combo';
  threshold: number;
};

export type ProtoChipAbilityData = {
  id: string;
  label: string;
  damage: number;
};

export type ProtoBiomeData = {
  id: string;
  label: string;
  objectiveLabel: string;
  resources: readonly string[];
};

export const DEFAULT_BIOME: ProtoBiomeData = {
  id: 'forest',
  label: 'Forest',
  objectiveLabel: 'Forage',
  resources: ['Wood', 'Berries', 'Herbs'],
};

// 13 authored Small Woods placements plus two energy for optional Day 1 work.
export const DEFAULT_EXPEDITION_ENERGY = 15;

/** Portrait sprites for world actors, by actor id; actors without one use the drawn placeholder. */
export const WORLD_ACTOR_SPRITES: Record<string, string> = {
  hero: `${import.meta.env.BASE_URL}assets/actors/hero.png`,
};

/** Pop-up scenery for biome tiles, by tile id (drawn by tools/make-pine-sprite.py). */
export const BIOME_TILE_SPRITES: Record<string, string> = {
  'woods-alpha': `${import.meta.env.BASE_URL}assets/biomes/small_woods_pines.png`,
};

export const DEFAULT_CHIP_ABILITY: ProtoChipAbilityData = {
  id: 'chip-strike',
  label: 'Chip',
  damage: 1,
};

export const HOLY_NOVA_SCALING = {
  threshold: 5,
  basePower: 3,
  powerStep: 2,
} as const;

export const getHolyNovaPower = (comboCount: number) =>
  HOLY_NOVA_SCALING.basePower + Math.max(0, Math.floor((comboCount - HOLY_NOVA_SCALING.threshold) / HOLY_NOVA_SCALING.powerStep));

export const PROTO_ACTORS: ProtoActorData[] = [
  {
    id: 'hero',
    label: 'Hero',
    animalType: 'Australian Shepherd',
    heroClass: 'Knight',
    hp: 11,
    maxHp: 14,
    cardTransportSpeed: 0.9,
    mobility: { kind: 'dig', label: 'Dig' },
  },
  {
    id: 'glacia',
    label: 'Glacia',
    animalType: 'Arctic Fox',
    heroClass: 'Mage',
    hp: 8,
    maxHp: 10,
    cardTransportSpeed: 1.15,
    mobility: { kind: 'blink', label: 'Blink' },
  },
  {
    id: 'jarnathan',
    label: 'Jimothy',
    animalType: 'White Stag',
    heroClass: 'Cleric',
    hp: 10,
    maxHp: 12,
    cardTransportSpeed: 0.8,
    mobility: { kind: 'hallowed_path', label: 'Hallowed Path' },
  },
  {
    id: 'reserve',
    label: 'Reserve',
    animalType: 'Reserve',
    heroClass: 'Reserve',
    hp: 9,
    maxHp: 11,
    cardTransportSpeed: 1,
  },
];

export const PROTO_ENEMIES: ProtoEnemyData[] = [
  {
    id: 'shadow-wolf-cub-left',
    label: 'Shadow Wolf cub',
    valueLabel: '3',
    currentRank: 3,
    ability: 'Pounce',
    intent: { symbol: '⚔', targetId: 'hero', tone: 'attack' },
    next: 'Bite',
    threshold: 4,
    hp: 6,
    maxHp: 6,
    comboCount: 0,
    cardTransportSpeed: 0.95,
  },
];

export const PROTO_ENEMY_SLOT_IDS = [
  'shadow-wolf-cub-left',
] as const;

export const MAGE_PHASE_SHIFT_TRIGGER: ProtoAbilityTrigger = {
  id: 'mage-phase-shift',
  kind: 'spent_combo',
  threshold: 5,
};
