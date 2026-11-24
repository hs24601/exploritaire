export type HeroId = 'knight' | 'mage' | 'cleric';
export type AbilityKind = 'primary' | 'support';
export type AbilityEffect = 'damage' | 'block' | 'draw_hint' | 'heal';
export type ModifierId = 'fire' | 'ice' | 'holy' | 'poison';
export type EnemyId = 'slime' | 'goblin' | 'skeleton' | 'large_skeleton';
export type GameMode = 'exploration' | 'combat' | 'reward' | 'victory' | 'defeat';

export interface AbilityData {
  id: string;
  heroId: HeroId;
  kind: AbilityKind;
  name: string;
  effect: AbilityEffect;
  description: string;
}

export interface HeroData {
  id: HeroId;
  name: string;
  color: string;
  abilityIds: string[];
}

export interface CardModifierData {
  id: ModifierId;
  name: string;
  color: string;
  description: string;
  damageBonus?: number;
  healingBonus?: number;
  blockBonus?: number;
}

export interface EnemyData {
  id: EnemyId;
  name: string;
  maxHp: number;
  attack: number;
  intent: string;
}

export interface DungeonCardSpec {
  value: number;
  modifierId?: ModifierId;
  enemyId?: EnemyId;
}

export interface DungeonData {
  id: string;
  name: string;
  wrapKingsToAces: boolean;
  startingResolve: number;
  rows: DungeonCardSpec[][];
  bossId: EnemyId;
}

export interface PlayingCard {
  id: string;
  value: number;
  modifierId?: ModifierId;
  enemyId?: EnemyId;
}

export interface ComboCard {
  id: string;
  value: number | null;
  label: string;
  modifierId?: ModifierId;
  isWild?: boolean;
}

export interface HeroState {
  id: HeroId;
  combo: ComboCard[];
  block: number;
  hp: number;
  maxHp: number;
}

export interface EnemyState {
  id: EnemyId;
  hp: number;
  maxHp: number;
}

export interface RewardState {
  availableModifierIds: ModifierId[];
}

export interface GameLogEntry {
  id: number;
  text: string;
}

export interface PrototypeGameState {
  mode: GameMode;
  tableau: PlayingCard[][];
  clearedCardIds: string[];
  heroes: Record<HeroId, HeroState>;
  activeEnemy: EnemyState | null;
  resolve: number;
  wildCards: number;
  reward: RewardState | null;
  bossDefeated: boolean;
  message: string;
  log: GameLogEntry[];
}
