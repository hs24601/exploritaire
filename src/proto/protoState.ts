import type { RoadTile } from './roadTiles';
import type { TableLight } from './protoLighting';
import type { BiomeFlag } from './biomeFlags';
import type { PlacedQuestCard } from './components/TableQuestCard';
import type { CraftStack, WorldItemId } from './protoCrafting';
import type { ProtoHeroClass } from './protoTypes';
import { PROTO_ACTORS, PROTO_ENEMY_SLOT_IDS, type ProtoEnemyData } from './protoData';
import type { CardTransportPoint } from './protoTransport';
import type { PondCatch, PondState } from './rules/fishing';
import type { TableauCardBackground } from './biomeCardArt';
import type { TravelJourney } from './travelJourney';

// Shared Proto state shapes and view-facing constants, moved verbatim from ProtoVariant.

export type Card = {
  event?: import('./eventCards').TableauEvent;
  id: string;
  rank: number;
  questStep?: number;
  resource?: ForestResource;
  /** Temporary INSP pickup, separate from carried food/materials. */
  inspirationResource?: boolean;
  /** Tableau artwork only; collected food is stored as mana. */
  foodSource?: 'berries';
  encounter?: 'shadow_wolf_cub';
  sleep?: 'rest' | 'noise' | 'itch';
};

export type ForestResource = 'wood' | 'mana' | 'herbs';
/** Caught at the pond rather than foraged from a tableau. */
export type PondResource = PondCatch;
export type HaulResource = 'wood' | 'mana';
export type WorldResourceKind = WorldItemId;
export type ForestHaul = Record<HaulResource, number>;
export type SceneKind = 'exploration' | 'combat';

export type BiomeRunState = {
  seed: number;
  cacheClaimed: boolean;
  cacheReward: ForestHaul;
};

export type BiomeTileState = {
  poiRankInitialized?: boolean;
  passage?: import('./terrainPassages').TerrainPassage;
  /** Session-only breach; never serialized into the authored tile document. */
  passageOpen?: boolean;
  traversalDifficulty?: number;
  travelCards?: number;
  traversalProgress?: number;
  /** Authored scenery emission; follows the tile and remains hidden in fog. */
  light?: Omit<TableLight, 'id' | 'position' | 'fromPiece'>;
  /** Passive destinations leave actors on the map instead of staffing a deal. */
  opensTableauOnArrival?: boolean;
  id: string;
  title: string;
  sizeLabel: 'Small' | 'Medium' | 'Large';
  gridSize: { columns: number; rows: number };
  resourceDensity: number;
  populationDensity?: number;
  berryPatchVariant?: 'sparse';
  /** Live finite harvest; never serialized into the authored map. */
  berryHarvested?: boolean;
  tableauSize: number;
  seed: number;
  position: { x: number; y: number };
  tableau: Card[][];
  stock: Card[];
  unlocked: boolean;
  threat: 'none' | 'low' | 'high';
  /** Water tiles are fished, not dealt as a tableau. Defaults to woods. */
  terrain?: 'woods' | 'water';
  tileType?: 'unexplored' | 'path' | 'dirt' | 'hero-den' | 'impassable-mountain' | 'berry-patch';
  road?: RoadTile;
  /** What the tile does to travel and to opening its tableau (biomeFlags.ts). */
  flags?: BiomeFlag[];
  /** Cards dealt to its tableau and stock, for how much of it is explored. */
  dealt?: number;
  /** Dangerous tiles start a skirmish instead of a tableau, and give off dark red embers and mist. */
  danger?: boolean;
  /** The day a dangerous tile's foe was beaten; it stays quiet until the next day. */
  clearedDay?: number;
};

export type CityState = {
  campBuilt: boolean;
  campUsedToday: boolean;
  restedOnce: boolean;
};

export type WorldActorState = {
  /** World-facing direction, independent of camera orientation. */
  heading?: number;
  characteristics?: string[];
  traversalAffinity?: Partial<Record<string, number>>;
  id: string;
  partyId?: string;
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
  /** Per-day finite travel opportunities, keyed by absolute grid cell. */
  travelVisits?: Record<string, { day: number; crossed: boolean; searchOffered?: boolean }>;
  terrainCrossings?: Record<string, number>;
  eventDiscard?: Card[];
  resolvedEventIds?: string[];
  journey?: TravelJourney;
  travelRanks?: Record<string,number>;
  travelStamina?: number;
  utilityAP?: Record<string, number>;
  /** Finite sleep round; stock draws establish a rank without earning inspiration. */
  denRest?: { restfulCards: number; disruptions: number; started?: boolean; receivingCard?: Card };
  denQuestDiscovered?: boolean;
  discoveredTutorialQuests?: string[];
  dayScenario?: 'day01' | 'day02' | 'day03';
  /** Live story bindings and actor budget; never authored tile fields. */
  dayScenarioTiles?: { sparsePatchId?: string; patchId?: string; woodsId?: string };
  scenarioStaminaMax?: number;
  scenarioStartingMana?: number;
  dayTwoAmbush?: boolean;
  ordinaryDay?: { questCardSpawned?: boolean; supper: boolean; bedtime: boolean; complete: boolean; visitedTree: boolean };
  tableau: Card[][];
  stock: Card[];
  foundations: FoundationSlot[];
  party: Card[];
  wildCards: number;
  /** Per-foundation redraw resource; distinct from the existing reserve below. */
  actorInspiration: number[];
  actorWorkCompleted: number[];
  totalWorkCompleted: number;
  heroHp: number[];
  heroMaxHp?: number[];
  /** Session-only actor card copy; restarting restores authored descriptions. */
  actorDescriptions?: Record<string, string>;
  actorMaxInspiration?: number[];
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
  /** Existing shared recovery/food reserve; travel does not spend Inspiration. */
  inspiration: number;
  maxInspiration: number;
  city: CityState;
  deepEncounterResolved: boolean;
  battleRecovered: boolean;
  questClaims: number;
  questTableCards: PlacedQuestCard[];
  questAccomplished: boolean[];
  pond: PondState;
  /** Eating a glowfish: extra max inspiration and a brighter, cooler light until the day ends. */
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
  /** Presentation captured at pickup, independent of later biome selection. */
  background?: TableauCardBackground;
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
export const ACTOR_INSPIRATION_MAX = 4;
/** Cards an actor plays onto their foundation per work cycle (the "TABLEAU COMPLETE" reward). */
export const WORK_CYCLE_CARDS = 4;

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
