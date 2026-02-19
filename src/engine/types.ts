import type { WatercolorConfig } from '../watercolor/types';

export type Suit = '💨' | '⛰️' | '🔥' | '💧' | '⭐' | '🌙' | '☀️';

export type Element = 'W' | 'E' | 'A' | 'F' | 'L' | 'D' | 'N';

export type OrimCategory = 'ability' | 'utility' | 'trait';

export type OrimRarity =
  | 'common'
  | 'uncommon' // holo layer expects this tier explicitly
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export type OrimDomain = 'puzzle' | 'combat';

export interface OrimDefinition {
  id: string;
  name: string;
  description?: string;
  artSrc?: string;
  category: OrimCategory;
  domain: OrimDomain;
  rarity: OrimRarity;
  powerCost: number;
  grantsWild?: boolean; // Wild placement effect
  damage?: number; // Basic effect placeholder
  affinity?: Partial<Record<Element, number>>;
  activationCondition?: TriggerGroup;
  activationTiming?: TriggerTiming[];
}

export interface OrimInstance {
  id: string;
  definitionId: string;
}

export interface OrimSlot {
  id: string;
  linkedGroupId?: string;
  orimId?: string | null;
  locked?: boolean;
}

export interface DeckCardInstance {
  id: string;
  value: number;
  slots: OrimSlot[];
  cooldown: number;
  maxCooldown: number;
}

export interface ActorDeckState {
  actorId: string;
  cards: DeckCardInstance[];
}

export interface Card {
  rank: number;
  suit: Suit;
  element: Element;
  id: string;
  tokenReward?: Element;
  orimSlots?: OrimSlot[];
  orimDisplay?: {
    id: string;
    glyph: string;
    color?: string;
    dim?: boolean;
    definitionId?: string;
    title?: string;
    meta?: string[];
    description?: string;
  }[];
  actorGlyph?: string;
  sourceActorId?: string;
  sourceDeckCardId?: string;
  cooldown?: number;
  maxCooldown?: number;
}

export type GamePhase = 'playing' | 'garden' | 'biome';

export type InteractionMode = 'click' | 'dnd';

export type EffectType = 'buff' | 'debuff';

export interface Effect {
  id: string;
  name: string;
  type: EffectType;
  duration: number; // -1 for permanent
  config?: Record<string, unknown>;
}

// Actor types - entities that can be NPCs or player-controlled adventurers
export type ActorType = 'adventurer' | 'npc';

export interface ActorDefinition {
  id: string;
  name: string;
  titles: string[]; // Multi-line title (e.g., ["Fennec", "Fox"])
  description: string;
  type: ActorType;
  value: number; // Base card value (1-13, or special values)
  suit?: Suit; // Optional elemental affinity
  element?: Element; // Optional element encoding
  sprite: string; // Emoji or sprite identifier
  artSrc?: string;
  aliases?: string[]; // Legacy ids or alternate identifiers
}

export interface GridPosition {
  col: number;
  row: number;
}

export interface Actor {
  definitionId: string;
  id: string; // Unique instance ID
  currentValue: number; // Can be modified by effects
  level: number; // Actor level (1+)
  stamina: number; // Current stamina pips
  staminaMax: number; // Max stamina pips
  energy: number; // Current energy pips
  energyMax: number; // Max energy pips
  hp: number; // Current health
  hpMax: number; // Max health
  armor?: number; // Flat incoming damage reduction
  evasion?: number; // Chance to avoid incoming hits
  accuracy?: number; // Chance to land outgoing hits
  damageTaken?: number; // Damage taken this bout
  power: number; // Current power usage
  powerMax: number; // Max power capacity
  orimSlots: OrimSlot[]; // Actor-level ORIM slots
  gridPosition?: GridPosition; // Position in garden grid (available actors only)
  homeTileId?: string; // ID of tile where this actor is homed
  stackId?: string; // Stack identifier for grouped actors
  stackIndex?: number; // Order within stack (0 = top)
  // Future: stats, traits, equipment, etc.
}

export interface Token {
  id: string;
  element: Element;
  quantity: number; // 1 or 5
  gridPosition?: GridPosition;
  stackId?: string;
  stackIndex?: number;
}

export interface RpgDotEffect {
  id: string;
  sourceActorId?: string;
  targetSide: 'player' | 'enemy';
  targetActorId: string;
  damagePerTick: number;
  initialTicks: number;
  remainingTicks: number;
  nextTickAt: number;
  intervalMs: number;
  effectKind?: 'vice_grip' | 'bleed';
}

export type ActorKeruArchetype = 'blank' | 'wolf' | 'bear' | 'cat';

export interface ActorKeru {
  id: string;
  archetype: ActorKeruArchetype;
  label: string;
  hp: number;
  hpMax: number;
  armor: number;
  stamina: number;
  staminaMax: number;
  energy: number;
  energyMax: number;
  evasion: number;
  sight: number;
  mobility: number;
  leadership: number;
  tags: string[];
  selectedAspectIds: string[];
  mutationCount: number;
  lastMutationAt?: number;
}

export interface GameState {
  tableaus: Card[][];
  foundations: Card[][];
  enemyFoundations?: Card[][];
  enemyActors?: Actor[];
  rpgHandCards?: Card[];
  stock: Card[];
  activeEffects: Effect[];
  turnCount: number;
  pendingCards: Card[]; // Cards available to assign to challenges/build piles
  phase: GamePhase;
  challengeProgress: ChallengeProgress;
  buildPileProgress: BuildPileProgress[]; // Persistent build pile progress
  interactionMode: InteractionMode;
  // Actor system
  availableActors: Actor[]; // Actors in the garden
  tileParties: Record<string, Actor[]>; // Party per adventure tile
  activeSessionTileId?: string; // Tile currently running a puzzle session
  tokens: Token[]; // Resource tokens in the garden
  collectedTokens: Record<Element, number>; // Tokens collected during a run
  resourceStash: Record<Element, number>; // Banked tokens in garden
  orimDefinitions: OrimDefinition[];
  orimStash: OrimInstance[]; // Shared stash for ORIM
  orimInstances: Record<string, OrimInstance>; // All ORIM instances by id
  actorDecks: Record<string, ActorDeckState>; // Actor decks with ORIM slots
  noRegretCooldowns?: Record<string, number>; // ActorId -> cooldown turns remaining (legacy)
  noRegretCooldown?: number; // Global cooldown turns remaining
  lastCardActionSnapshot?: Omit<GameState, 'lastCardActionSnapshot'>;
  // Tile system
  tiles: Tile[]; // Active tiles in the garden
  // Blueprint system
  blueprints: Blueprint[]; // Unlocked blueprints in player's library
  pendingBlueprintCards: BlueprintCard[]; // Blueprints in chaos state to collect
  // Biome system
  currentBiome?: string; // Active biome ID (during biome phase)
  biomeMovesCompleted?: number; // Track progress in biome
  // Node-edge tableau system
  nodeTableau?: TableauNode[]; // Only populated when biome mode === 'node-edge'
  // Random biome state
  foundationCombos?: number[]; // Combo count per foundation this turn
  actorCombos?: Record<string, number>; // Combo count per actor this turn
  foundationTokens?: Record<Element, number>[]; // Tokens collected per foundation this turn
  enemyFoundationCombos?: number[]; // Combo count per enemy foundation this turn
  enemyFoundationTokens?: Record<Element, number>[]; // Tokens collected per enemy foundation this turn
  randomBiomeTurnNumber?: number; // Current turn number in random biome
  randomBiomeActiveSide?: 'player' | 'enemy';
  enemyDifficulty?: EnemyDifficulty;
  enemyBackfillQueues?: Card[][]; // Pre-seeded backfill queues used on enemy turns
  rpgDots?: RpgDotEffect[];
  rpgEnemyDragSlowUntil?: number;
  rpgEnemyDragSlowActorId?: string;
  rpgCloudSightUntil?: number;
  rpgCloudSightActorId?: string;
  rpgBlindedPlayerLevel?: number;
  rpgBlindedPlayerUntil?: number;
  rpgBlindedEnemyLevel?: number;
  rpgBlindedEnemyUntil?: number;
  playtestVariant?: 'single-foundation' | 'party-foundations' | 'party-battle' | 'rpg';
  actorKeru?: ActorKeru;
}

export interface Move {
  tableauIndex: number;
  foundationIndex: number;
  card: Card;
}

export interface SelectedCard {
  card: Card;
  tableauIndex: number;
}

export interface GameConfig {
  tableauCount: number;
  cardsPerTableau: number;
  foundationCount: number;
}

export type EnemyDifficulty = 'easy' | 'normal' | 'hard' | 'divine';

export type TriggerTiming = 'equip' | 'play' | 'turn-start' | 'turn-end';

export type TriggerOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export type TriggerField =
  | `actor.affinity.${Element}`
  | 'actor.combo'
  | 'actor.hp'
  | 'actor.hpMax'
  | 'actor.energy'
  | 'actor.energyMax'
  | 'actor.stamina'
  | 'actor.staminaMax'
  | 'actor.damageTaken'
  | 'bout.turn';

export type TriggerOperand =
  | { type: 'field'; field: TriggerField }
  | { type: 'number'; value: number };

export interface TriggerCondition {
  type: 'condition';
  left: TriggerOperand;
  operator: TriggerOperator;
  right: TriggerOperand;
}

export interface TriggerGroup {
  type: 'group';
  op: 'and' | 'or';
  not?: boolean;
  clauses: TriggerNode[];
}

export type TriggerNode = TriggerCondition | TriggerGroup;

export interface ChallengeRequirement {
  suit: Suit;
  count: number;
}

export interface Challenge {
  id: number;
  name: string;
  description: string;
  requirements: ChallengeRequirement[];
}

export interface ChallengeProgress {
  challengeId: number;
  collected: Record<Suit, number>;
}

// Build Pile types - sequential card collection goals
export type BuildDirection = 'ascending' | 'descending';

export type BuildPileMode = 'sequential' | 'element-cycle';

export interface BuildPileDefinition {
  id: string;
  name: string;
  description: string;
  startingRank: number; // 1 for Ace, 13 for King
  direction: BuildDirection;
  suit?: Suit; // Optional suit restriction, undefined = any suit
  mode: BuildPileMode; // 'sequential' = just ranks, 'element-cycle' = element + rank cycle
}

export interface BuildPileProgress {
  definitionId: string;
  cards: Card[]; // Cards added to this pile in order
  currentRank: number; // Next rank needed (starts at startingRank)
  currentElementIndex: number; // 0-3 for element cycle mode (💧=0, 💨=1, ⛰️=2, 🔥=3)
  cyclesCompleted: number; // Number of full cycles (52 cards each) completed
  isComplete: boolean; // For perpetual piles, this stays false
}

// === TILE (CARDCEPTION) SYSTEM ===

// Actor home slot within a tile
export interface ActorHomeSlot {
  id: string;
  actorId: string | null; // ID of homed actor, or null if empty
}

// Requirement for a card slot
export interface CardSlotRequirement {
  suit?: Suit;      // Optional suit restriction
  minRank?: number; // Optional minimum rank
  maxRank?: number; // Optional maximum rank
}

// A slot that can hold a card within a tile
export interface CardSlot {
  id: string;
  requirement: CardSlotRequirement;
  card: Card | null;
}

// A group of slots (e.g., "2 water slots")
export interface CardSlotGroup {
  slots: CardSlot[];
  label?: string;
}

// Template definition for a tile type
export interface TileDefinition {
  id: string;
  name: string;
  description: string;
  isBiome?: boolean;
  isProp?: boolean; // Non-interactive scenery tile
  lockable?: boolean; // Whether lock toggle is available
  blocksLight?: boolean; // Fully blocks light rays
  lightFilter?: 'grove'; // Partial light filter (tree trunks with gaps)
  lightBlockerShape?: 'card' | 'tile'; // Shape footprint for light blockers
  buildPileId?: string; // Build pile linkage (e.g., sapling)
  slotGroups: {
    requirement: CardSlotRequirement;
    count: number;
    label?: string;
  }[];
}

// Instance of a tile with current progress
export interface Tile {
  definitionId: string;
  id: string;
  createdAt?: number;
  slotGroups: CardSlotGroup[];
  isComplete: boolean;
  isLocked: boolean;
  gridPosition?: GridPosition; // Position in garden grid
  upgradeLevel: number; // 0, 1, 2, etc.
  actorHomeSlots: ActorHomeSlot[]; // Creature housing slots
  watercolorConfig?: WatercolorConfig | null;
}

// === BLUEPRINT SYSTEM ===

// Blueprint definition - template for unlockable schematics
export interface BlueprintDefinition {
  id: string;
  name: string;
  description: string;
  category: 'building' | 'upgrade' | 'special';
  unlockCondition?: string; // Description of how to unlock
}

// Blueprint instance - unlocked by player
export interface Blueprint {
  definitionId: string;
  id: string;
  unlockedAt: number; // Timestamp
  isNew: boolean; // UI indicator for newly unlocked
}

// Blueprint card in "chaos state" during gameplay
export interface BlueprintCard {
  blueprintId: string;
  position: { x: number; y: number }; // Non-grid position
  rotation: number; // Rotation in degrees (5-15°)
  id: string;
}

// === BIOME SYSTEM ===

// Predefined layout for a biome
export interface BiomeLayout {
  tableaus: number[][]; // Ranks for each tableau
  elements: Element[][]; // Elements for each tableau (using element encoding)
}

// Rewards for completing a biome
export interface BiomeReward {
  cards: { element: Element; count: number }[];
  blueprints?: string[]; // Blueprint IDs to unlock
}

// Blueprint spawn configuration
export interface BiomeBlueprintSpawn {
  blueprintId: string;
  afterMoves: number; // Spawn after N moves
}

// Biome definition
export interface BiomeDefinition {
  id: string;
  name: string;
  description: string;
  seed: string; // Deterministic seed for RNG
  mode?: 'traditional' | 'node-edge'; // Defaults to 'traditional'
  randomlyGenerated?: boolean; // Random tableau generation each turn
  infinite?: boolean; // Tableaus backfill with new random cards when cards are removed
  nodePattern?: string; // NodeEdgePattern ID (for node-edge biomes)
  enemyDifficulty?: EnemyDifficulty;
  layout: BiomeLayout;
  rewards: BiomeReward;
  blueprintSpawn?: BiomeBlueprintSpawn;
  requiredMoves: number; // Total moves to complete
}

// === NODE-EDGE TABLEAU SYSTEM ===

// Node in a node-edge tableau with spatial positioning and blocking relationships
export interface TableauNode {
  id: string;
  position: { x: number; y: number; z: number }; // x,y spatial coords, z for visual layering
  cards: Card[]; // Stack of cards at this node (top = last element)
  blockedBy: string[]; // IDs of nodes that block this node
  revealed: boolean; // Whether top card is face-up and playable
}

// Definition of a single node within a pattern template
export interface NodePatternDefinition {
  id: string;
  position: { x: number; y: number; z: number };
  cardCount: number; // Number of cards to stack at this node
  blockedBy: string[]; // IDs of other nodes in pattern that block this one
}

// Pattern template for node-edge tableaus
export interface NodeEdgePattern {
  id: string;
  name: string;
  description: string;
  nodes: NodePatternDefinition[];
  totalCards: number; // Total cards to deal across all nodes
}

// === DICE SYSTEM ===

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface Die {
  id: string; // Unique instance ID
  value: DieValue; // Current face value (1-6)
  locked: boolean; // Whether this die is locked from rerolling
  rolling: boolean; // Animation state - whether currently rolling
}

export interface DicePool {
  dice: Die[]; // Collection of dice in this pool
  rollCount: number; // Number of times the pool has been rolled
}
