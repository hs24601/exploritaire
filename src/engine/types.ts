export type Suit = '💨' | '⛰️' | '🔥' | '💧' | '⭐' | '🌙' | '☀️';

export type Element = 'W' | 'E' | 'A' | 'F' | 'L' | 'D' | 'N';

export interface Card {
  rank: number;
  suit: Suit;
  element: Element;
  id: string;
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
}

export interface GridPosition {
  col: number;
  row: number;
}

export interface Actor {
  definitionId: string;
  id: string; // Unique instance ID
  currentValue: number; // Can be modified by effects
  gridPosition?: GridPosition; // Position in garden grid (available actors only)
  homeMetaCardId?: string; // ID of metacard where this actor is homed
  // Future: stats, traits, equipment, etc.
}

export interface GameState {
  tableaus: Card[][];
  foundations: Card[][];
  stock: Card[];
  activeEffects: Effect[];
  turnCount: number;
  collectedCards: Card[]; // Cards collected this round
  pendingCards: Card[]; // Cards available to assign to challenges/build piles
  phase: GamePhase;
  challengeProgress: ChallengeProgress;
  buildPileProgress: BuildPileProgress[]; // Persistent build pile progress
  interactionMode: InteractionMode;
  // Actor system
  availableActors: Actor[]; // Actors in the garden
  adventureQueue: (Actor | null)[]; // 3 slots for adventure party
  // Meta-card system
  metaCards: MetaCard[]; // Active meta-cards in the garden
  // Blueprint system
  blueprints: Blueprint[]; // Unlocked blueprints in player's library
  pendingBlueprintCards: BlueprintCard[]; // Blueprints in chaos state to collect
  // Biome system
  currentBiome?: string; // Active biome ID (during biome phase)
  biomeMovesCompleted?: number; // Track progress in biome
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

// === META-CARD (CARDCEPTION) SYSTEM ===

// Actor home slot within a meta-card
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

// A slot that can hold a card within a meta-card
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

// Template definition for a meta-card type
export interface MetaCardDefinition {
  id: string;
  name: string;
  description: string;
  slotGroups: {
    requirement: CardSlotRequirement;
    count: number;
    label?: string;
  }[];
}

// Instance of a meta-card with current progress
export interface MetaCard {
  definitionId: string;
  id: string;
  slotGroups: CardSlotGroup[];
  isComplete: boolean;
  gridPosition?: GridPosition; // Position in garden grid
  upgradeLevel: number; // 0, 1, 2, etc.
  actorHomeSlots: ActorHomeSlot[]; // Creature housing slots
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
  layout: BiomeLayout;
  rewards: BiomeReward;
  blueprintSpawn?: BiomeBlueprintSpawn;
  requiredMoves: number; // Total moves to complete
}
