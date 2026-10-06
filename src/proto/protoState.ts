import type { PlacedQuestCard } from './components/TableQuestCard';
import type { CraftStack, WorldItemId } from './protoCrafting';
import type { ProtoHeroClass } from './protoTypes';
import { PROTO_ACTORS, PROTO_ENEMY_SLOT_IDS, type ProtoEnemyData } from './protoData';
import type { CardTransportPoint } from './protoTransport';
import type { PondState } from './rules/fishing';

// Shared Proto state shapes and view-facing constants, moved verbatim from ProtoVariant.

export type Card = {
  id: string;
  rank: number;
  questStep?: number;
  resource?: ForestResource;
  encounter?: 'shadow_wolf_cub';
};

export type ForestResource = 'wood' | 'berries' | 'herbs';
/** Caught at the pond rather than foraged from a tableau. */
export type PondResource = 'fish' | 'glowfish';
export type HaulResource = ForestResource | PondResource;
export type WorldResourceKind = WorldItemId;
export type ForestHaul = Record<HaulResource, number>;
export type SceneKind = 'exploration' | 'combat';

export type BiomeRunState = {
  seed: number;
  cacheClaimed: boolean;
  cacheReward: ForestHaul;
};

export type BiomeTileState = {
  id: string;
  title: string;
  sizeLabel: 'Small' | 'Medium' | 'Large';
  gridSize: { columns: number; rows: number };
  resourceDensity: number;
  tableauSize: number;
  seed: number;
  position: { x: number; y: number };
  tableau: Card[][];
  stock: Card[];
  unlocked: boolean;
  travelCost: number;
  threat: 'none' | 'low';
  /** Water tiles are fished, not dealt as a tableau. Defaults to woods. */
  terrain?: 'woods' | 'water';
};

export type CityState = {
  campBuilt: boolean;
  campUsedToday: boolean;
  restedOnce: boolean;
};

export type WorldActorState = {
  id: 'hero';
  label: string;
  location: 'table' | 'foundation';
  biomeId?: string;
  position: { x: number; y: number };
  foundationIndex?: number;
  hutId?: string;
  /** Light the actor carries, 0–1; defaults to candlelight (DEFAULT_ACTOR_LUMINOSITY). */
  luminosity?: number;
  /** CSS color of the actor's light; defaults to warm candlelight. */
  lightColor?: string;
};

export type WorldResourceStack = CraftStack;

export type SuspendedExplorationScene = {
  tableau: Card[][];
  stock: Card[];
};

export type FoundationPile = {
  card: Card;
  count: number;
  cards: Card[];
  wildcardBridgeFromRank?: number;
};

export type FoundationSlot = FoundationPile | null;

export type ProtoState = {
  tableau: Card[][];
  stock: Card[];
  foundations: FoundationSlot[];
  party: Card[];
  wildCards: number;
  actorStamina: number[];
  actorWorkCompleted: number[];
  totalWorkCompleted: number;
  heroHp: number[];
  heroBuffs: HeroBuff[][];
  abilityProgress: Record<string, number>;
  mobilityUsed: boolean;
  mobilityCooldown: number;
  energy: number;
  energyMax: number;
  scene: SceneKind;
  biome: BiomeRunState;
  suspendedExploration: SuspendedExplorationScene | null;
  biomeTiles: BiomeTileState[];
  selectedBiomeId: string | null;
  worldActors: WorldActorState[];
  worldResourceStacks: WorldResourceStack[];
  trailRations: number;
  haul: ForestHaul;
  settledHaul: ForestHaul;
  enemyTeam: EnemyRuntimeState[];
  ambushCardsRemaining: number;
  day: number;
  stamina: number;
  maxStamina: number;
  city: CityState;
  deepEncounterResolved: boolean;
  battleRecovered: boolean;
  questClaims: number;
  questTableCards: PlacedQuestCard[];
  questAccomplished: boolean[];
  pond: PondState;
  /** Eating a glowfish: extra max stamina and a brighter, cooler light until the day ends. */
  glowfishGlow: boolean;
};

export type PendingTargetSelection = {
  columnIndex: number;
  cardId: string;
  targetIndexes: number[];
  hallowedPath?: boolean;
  divine?: boolean;
};

export type PendingMobility = {
  sourceIndex: number;
  emergency: boolean;
  kind: 'blink' | 'dig' | 'hallowed_path';
};

export type AbilityTargetKind = 'hero' | 'enemy' | 'self';
export type TargetHighlightTone = 'attack' | 'heal' | 'misc';
export type AbilityEffectType = 'chip' | 'damage' | 'heal' | 'guard' | 'taunt' | 'frostbolt' | 'phase_shift' | 'holy_nova' | 'mobility';

export type HeroBuff = {
  id: 'def' | 'taunt' | 'phase_shift' | 'blink_strain' | 'muddy_paws' | 'hallowed_strain' | 'well_fed';
  value: number;
  turnsRemaining: number;
};

export type PendingAbilityTarget = {
  sourceIndex: number;
  sourceClass: ProtoHeroClass;
  effectLabel: string;
  power: number;
  targetKind: AbilityTargetKind;
  effectType: AbilityEffectType;
};

export type TargetAnnouncement = {
  targetKind: AbilityTargetKind;
  targetIndex: number;
  abilityName: string;
  impact: string;
};

export type CardTransport = {
  cardId: string;
  sourceColumnIndex: number;
  targetSide: 'player' | 'enemy';
  targetIndex: number;
  hallowedPath: boolean;
  divine?: boolean;
  solver?: boolean;
  from: CardTransportPoint;
  to: CardTransportPoint;
  size: { width: number; height: number };
  durationMs: number;
};

export type AbilityDetail = {
  heroName: string;
  abilityName: string;
  comboCount: number;
  power: number;
  targetKind: AbilityTargetKind;
  note: string;
};

export type AdvisorAbilityOption = {
  id: string;
  heading: string;
  label: string;
  power: number;
  tone: string;
  suffix?: string;
  usable: boolean;
  targetKind: AbilityTargetKind;
  effectType: AbilityEffectType;
};

export type EnemyRuntimeState = ProtoEnemyData;

export const FOUNDATION_SLOTS = 3;
// DEV ONLY: Vite statically replaces this with false in production builds.
export const DEV_ACTOR_DEFEAT_OVERRIDE = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
export const FOUNDATION_MOCKUPS = PROTO_ACTORS;
export const ENEMY_TEAM_SLOT_IDS = PROTO_ENEMY_SLOT_IDS;
export const ACTOR_STAMINA_MAX = 4;

export const targetToneForAbility = (ability: PendingAbilityTarget | null): TargetHighlightTone =>
  ability?.targetKind === 'enemy'
    ? 'attack'
    : ability?.targetKind === 'hero'
      ? 'heal'
      : 'misc';

export const rankLabel = (rank: number) => {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
};

export const AUTO_PLAY_SPEED_OPTIONS = [
  { label: 'Slow', ms: 1400 },
  { label: 'Med', ms: 800 },
  { label: 'Fast', ms: 420 },
  { label: 'Max', ms: 180 },
];

export const heroIndexForTargetId = (targetId: string | null): number => {
  const index = FOUNDATION_MOCKUPS.findIndex((hero) => hero.id === targetId);
  return index >= 0 && index < FOUNDATION_SLOTS ? index : 0;
};

export const heroLabelForTargetId = (targetId: string | null) =>
  FOUNDATION_MOCKUPS[heroIndexForTargetId(targetId)]?.label ?? 'Party';
