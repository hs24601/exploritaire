import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Card } from '../components/Card';
import { Callout } from '../components/Callout';
import { Tooltip } from '../components/Tooltip';
import { AbilityApBar } from '../components/combat/AbilityApBar';
import { BurnEdgesEffect } from '../components/active/BurnEdgesEffect';
import { useImmersiveBattle } from '../contexts/ImmersiveBattleContext';
import type { Card as CardType, Element } from '../engine/types';
import {
  getKinEffectDefinition,
  getActorApCap,
  getKinProfile,
  getStarterAbilityByEffect,
  getStarterPackAbilityName,
  STARTER_ABILITIES,
  STARTER_KIN_METADATA,
} from './data/starterKinData';
import type { GolfStarterAbility as StarterAbility, GolfKinFamily as KinFamily } from './data/starterKinData';
import {
  TUTORIAL_ROUTE_SEEDS,
  TUTORIAL_SCENE_SEEDS,
  getTutorialSceneSeed,
  getTutorialRouteSeedsForSlice,
} from './tutorialSeeds';
import type { TutorialActionSpec, TutorialSceneId } from './tutorialSeeds';
import {
  formatTutorialActionSpec,
  runTutorialRouteValidation,
  tutorialActionSpecEquals,
  validateTutorialSceneSeed,
} from './tutorialRailValidation';
import {
  applyCounterWindowToPacket,
  getTotalPacketDamage,
  resolveDamagePacket,
} from './combatResolver';
import type {
  ActorCombatState,
  DamagePacket,
  ElementalShieldMap,
  SuperArmorKind,
} from './combatResolver';

const ELEMENTAL_SUITS = [
  { suit: '♠', element: 'N' },
  { suit: '♥', element: 'N' },
  { suit: '♣', element: 'N' },
  { suit: '♦', element: 'N' },
] as const;

const GOLF_ELEMENT_INDICATOR_SIZE = 22;
const TABLEAU_COLUMNS = 7;
const TABLEAU_ROWS = 5;
const CARD_SIZE = { width: 146, height: 206 };
const PLAYER_TURN_PEEK = 7;
const ENEMY_TURN_PEEK = 6;
const ENEMY_TURN_PLAYER_EDGE_PEEK = 14;
const ENEMY_ACTION_DURATION_MS = 1500;
const ENEMY_TURN_MIN_MS = 3000;
const ENEMY_WAIT_TICK_MS = 50;
const ENEMY_POINTER_APPROACH_MS = 450;
const ENEMY_POINTER_CLICK_MS = 140;
const STICKY_PAWS_HOLD_MS = 700;
const DEV_ABILITY_HOLD_MS = 450;
const KIN_INSPECT_HOLD_MS = 700;
const STARTER_PACK_SIZE = 4;
const ACTIVE_PARTY_SIZE = 4;
const ACTIVE_BENCH_SIZE = ACTIVE_PARTY_SIZE - 1;
const ENCOUNTER_POWER_LEVEL = 4;
const BATTERY_TARGET_CHARGE = 10;
const JET_EFFICIENCY_TRIGGER = 3;
const JET_EFFICIENCY_DISCOUNT = 3;
const ASSIST_JET_MICRO_BATTERY_MAX = 5;
const JET_BATTERY_EFFECTS: JetBatteryAssignableEffect[] = ['sticky-paws', 'rigged-construct', 'rewire', 'scrap-plating', 'aegis-shunt'];
const GOLF_COMBAT_LOG_KEY = 'exploritaire.golf.combat-log.v1';
const GOLF_COMBAT_LOG_STATS_KEY = 'exploritaire.golf.combat-log-stats.v1';

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type GolfGameState = {
  biomeId: string;
  scenarioId: 'tutorial' | 'freeplay' | 'rng';
  tutorialSliceId: 'slice-01' | 'slice-02' | 'slice-03' | 'slice-04' | null;
  tutorialEnemyDefeated: boolean;
  tutorialActionCount: number;
  longRestCount: number;
  tableau: CardType[][];
  starterPackBase: CardType[];
  starterPackUsed: boolean[];
  starterPackLocked: boolean[];
  starterPackStoredAp: number[];
  starterPackAbilityRarities: Array<1 | 2 | 3>;
  starterPackModes: StarterKinMode[];
  starterPackCashoutStats: Array<{ cardsStored: number; uniqueElements: number; actionPoints: number; apSegments: Element[] } | null>;
  activeStarterPackIndex: number;
  playerStock: CardType;
  playerBench: CardType[];
  playerSupportIndex: number;
  playerHand: PlayerHandSlot[];
  playerCapturedLeft: CardType | null;
  playerCapturedRight: CardType | null;
  enemyStock: CardType;
  enemyProfileId: string;
  enemyBench: CardType[];
  enemyBenchProfileIds: string[];
  enemyStockActionPoints: number;
  clearedCount: number;
  playerStockSequence: number;
  playerStockActionPoints: number;
  playerPrimeApSegments: Element[];
  playerBenchSequences: number[];
  playerBenchActionPoints: number[];
  enemyStockSequence: number;
  playerFreeTagAvailable: boolean;
  enemyFreeTagAvailable: boolean;
  playerTagLockCapturesRemaining: number;
  playerBlockedReturnStockId: string | null;
  playerSupportActionUsed: boolean;
  playerSupportRotateUsed: boolean;
  playerSupportReactiveUsed: boolean;
  playerDiscardPile: string[];
  stickyPawsCooldown: number;
  panPawSperityCooldown: number;
  batteryStoredActionPoints: number;
  batteryMode: 'store' | 'release' | null;
  jetBatteries: JetAbilityBattery[];
  jetBatteryPrimeArmed: boolean;
  jetBatteryAlternatorIndex: number;
  jetDetonateBatteryUnlocked: boolean;
  jetAbilityCardsPlayed: number;
  jetEfficiencyDiscountReady: boolean;
  riggedConstructCooldown: number;
  riggedConstructCards: CardType[];
  riggedConstructArmed: boolean;
  riggedConstructElement: Element | null;
  riggedConstructCapacity: number;
  jetRewireActionsRemaining: number;
  jetRewireSourceColumnIndex: number | null;
  assistJetMicroBatteryAp: number;
  assistJetRewireCooldown: number;
  heroHeartsHeld: number;
  heroEnduranceMax: number;
  heroSuccessfulPlays: number;
  heroTurnsElapsed: number;
  heroSecondWindCooldown: number;
  heroStockAddsThisTurn: number;
  heroLeaderTriggeredThisTurn: boolean;
  heroTrailSenseActive: boolean;
  heroGuardTauntTurns: number;
  jetChargedCardIds: string[];
  kinStickers: KinSticker[];
  hiddenStarterPackIndices: number[];
  enemyPrimeViceGripTurns: number;
  enemySupportStunnedTurns: number;
  combatants: Record<string, ActorCombatState>;
  tableClears: number;
  enemyDefeatedCount: number;
  enemyDefeatFx: {
    id: number;
    name: string;
    moveLabel: string | null;
    lootRecovered: number;
  } | null;
  bankedPoints: number;
  enemyRetaliationBonus: number;
  enemyLootCards: CardType[];
  enemyBiteMarks: Record<string, number>;
};

type AutoPlayMode = 'off' | 'tableau-pause' | 'tactical-pause' | 'full';

type GolfTurnAction = {
  columnIndex: number;
  card: CardType;
};

type StockHeuristic = {
  stockId: string;
  visibleBest: number;
  hiddenBest: number;
  hiddenPath: GuideStep[];
};

type GuideStep = {
  columnIndex: number;
  stockId: string;
};

type GuidePlan = {
  path: GuideStep[];
  progress: number;
  source: 'ancestors' | 'path-of-stars' | 'prophecy' | 'tutorial';
  visibleSteps: number | null;
};

type StarterKinMode = 'default' | 'banks-prowl' | 'banks-exposed';

type PlayerStockTarget = {
  stockId: string;
  card: CardType;
  kind: 'prime' | 'bench';
  role: 'prime' | 'support' | 'assist';
  benchIndex?: number;
};

type PlayerMoveOption = GuideStep & {
  candidate: CardType;
  target: PlayerStockTarget;
};

type UndoSnapshot = {
  game: GolfGameState;
  enemyTurnSummary: GolfTurnAction[];
  guidePlan: GuidePlan | null;
  actor: 'player' | 'enemy';
};

type HandSlotId =
  | 'left'
  | 'right'
  | 'jet-left-2'
  | 'jet-left-3'
  | 'jet-right-2'
  | 'jet-right-3'
  | 'jet-right-4'
  | 'hero-heart-1'
  | 'hero-heart-2'
  | 'hero-heart-3'
  | 'hero-heart-4'
  | 'hero-heart-5'
  | 'hero-heart-6'
  | 'hero-heart-7'
  | 'hero-heart-8';
type JetBatteryAssignableEffect = 'sticky-paws' | 'rigged-construct' | 'rewire' | 'scrap-plating' | 'aegis-shunt';

type JetAbilityBattery = {
  effect: JetBatteryAssignableEffect;
  charge: number;
};

type KinSpeciesId = 'jet' | 'whis' | 'pan';

type StatusEffectEvent = {
  actorName: string;
  statusKey: string;
  label: string;
  tone: 'buff' | 'debuff';
  nextValue: number;
  removed: boolean;
};

type KinSticker = {
  id: string;
  speciesId: KinSpeciesId;
  name: string;
  glyph: string;
  rank: number;
  baseElement: Element;
  augmentElement: Element | null;
  rarity: 1 | 2 | 3;
  state: 'available' | 'buried';
  buriedCardId: string | null;
  buriedColumnIndex: number | null;
};

type PlayerHandSlot = {
  slotId: HandSlotId | 'pan-left';
  kind: 'ability' | 'captured' | 'generated' | 'empty';
  name: string;
  card: CardType | null;
  effect: 'sticky-paws' | 'repurpose' | 'paw-sperity' | 'path-of-stars' | 'jikan' | 'ironfur' | 'tap-out' | 'slipstream' | 'battery' | 'siphon' | 'rigged-construct' | 'rewire' | 'scrap-plating' | 'aegis-shunt' | 'fetch' | 'vice-grip' | 'banks-strike' | 'hero-guard' | null;
  armed?: boolean;
  generatedEffect?: 'free-energy' | 'heart-of-the-wild' | 'wildcard' | null;
  generatedValue?: number;
};

type AbilityTaxonomy = 'tableau-clear' | 'signature-active' | 'utility-active';

type DialogueCalloutEntry = {
  id: number;
  text: string;
  subtitle?: string;
  anchor: { x: number; y: number };
};

type EnemyStealOption = {
  id: string;
  card: CardType;
  source: 'prime' | 'bench';
  benchIndex?: number;
  profileId: string;
  label: string;
};

type CombatLogEntry = {
  timestamp: number;
  biomeId: string;
  type: 'move' | 'ability' | 'damage' | 'defeat' | 'autoplay';
  actor: string;
  target?: string;
  detail: Record<string, string | number | boolean | null>;
};

type StockActorShell = {
  id: string;
  name: string;
  title: string;
  element: Element;
  startingRank: number;
  accentClassName: string;
  moveset: string[];
};

type EnemyProfile = {
  actor: StockActorShell;
  combatant: ActorCombatState;
  maxActionsPerTurn: number;
  behavior: 'steady' | 'evasive' | 'armored' | 'nagging';
  chipDebuff?: 'slow' | 'armor-break' | 'burn';
};

type GolfDragAnim = {
  id: number;
  mode: 'cursor' | 'drag';
  card: CardType;
  sourceColumnIndex?: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  durationMs: number;
};

type PlayerHandAnim = {
  id: number;
  card: CardType;
  from: { x: number; y: number };
  to: { x: number; y: number };
  durationMs: number;
  label: string;
  variant?: 'default' | 'reward-flip';
};

type RescueCardFlash = {
  id: number;
  x: number;
  y: number;
  tone?: 'white' | 'red';
};

const TUTORIAL_SLICE_STARTING_AP: Record<'slice-01' | 'slice-02' | 'slice-03' | 'slice-04', number[]> = {
  'slice-01': [0],
  'slice-02': [2, 2],
  'slice-03': [2, 2],
  'slice-04': [2, 2, 2, 2],
};

const advancePlayerTagLock = (state: GolfGameState) => {
  const nextRemaining = Math.max(0, state.playerTagLockCapturesRemaining - 1);
  return {
    playerTagLockCapturesRemaining: nextRemaining,
    playerBlockedReturnStockId: nextRemaining === 0 ? null : state.playerBlockedReturnStockId,
  };
};

const PLAYER_STOCK_ACTOR: StockActorShell = {
  id: 'hero',
  name: 'Hero',
  title: 'Prime Stock',
  element: 'E',
  startingRank: 5,
  accentClassName: 'border-[#cdd3dc]/40 bg-black/60 shadow-[0_0_24px_rgba(205,211,220,0.12)]',
  moveset: ['Fetch', 'Guard Dog'],
};

const GOLF_DEFAULT_BIOME_ID = 'florpus_forest';
const GOLF_DEFAULT_ENEMY_PROFILE_ID = 'thorn-matron';
const GOLF_DEFAULT_SCENARIO_ID = 'tutorial';
const RNG_MOCHI_TARGET_COLUMN = 1;
const RNG_MOCHI_DEPTH_INDEX = 1;
let enemyInstanceSequence = 0;

const getGolfScenarioId = () => {
  if (typeof window === 'undefined') return GOLF_DEFAULT_SCENARIO_ID;
  const queryValue = new URLSearchParams(window.location.search).get('scenario')?.trim().toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  if (pathname.endsWith('/rng.html') || pathname.endsWith('rng.html')) return 'rng';
  if (queryValue === 'freeplay') return 'freeplay';
  if (queryValue === 'tutorial') return 'tutorial';
  if (queryValue === 'rng') return 'rng';
  return GOLF_DEFAULT_SCENARIO_ID;
};

const BIOME_ONE_ENEMIES: EnemyProfile[] = [
  {
    actor: {
      id: 'thorn-matron',
      name: 'Thorn Matron',
      title: 'Enemy Stock',
      element: 'A',
      startingRank: 10,
      accentClassName: 'border-game-pink/35 bg-black/55 shadow-[0_0_22px_rgba(175,223,134,0.12)]',
      moveset: ['Bite', 'Chew', 'Loot Hoard'],
    },
    combatant: { hp: 102, hpMax: 102, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 0, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false },
    maxActionsPerTurn: 0,
    behavior: 'steady',
  },
  {
    actor: {
      id: 'mawling-raider',
      name: 'Mawling Raider',
      title: 'Enemy Stock',
      element: 'F',
      startingRank: 9,
      accentClassName: 'border-game-pink/35 bg-black/55 shadow-[0_0_22px_rgba(255,120,76,0.14)]',
      moveset: ['Bite', 'Chew', 'Loot Hoard'],
    },
    combatant: { hp: 14, hpMax: 14, armor: 1, defense: 0, defenseBuffAmount: 0, evasion: 0, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false },
    maxActionsPerTurn: 2,
    behavior: 'steady',
  },
  {
    actor: {
      id: 'shade-wisp',
      name: 'Shade Wisp',
      title: 'Enemy Stock',
      element: 'D',
      startingRank: 5,
      accentClassName: 'border-game-pink/35 bg-black/55 shadow-[0_0_22px_rgba(155,124,255,0.16)]',
      moveset: ['Bite', 'Maul'],
    },
    combatant: { hp: 8, hpMax: 8, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 6, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false },
    maxActionsPerTurn: 1,
    behavior: 'nagging',
  },
  {
    actor: {
      id: 'ember-mite',
      name: 'Ember Mite',
      title: 'Enemy Stock',
      element: 'F',
      startingRank: 6,
      accentClassName: 'border-game-pink/35 bg-black/55 shadow-[0_0_22px_rgba(255,120,76,0.12)]',
      moveset: ['Singe', 'Nibble', 'Scorch Dust'],
    },
    combatant: { hp: 8, hpMax: 8, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 4, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false },
    maxActionsPerTurn: 4,
    behavior: 'steady',
    chipDebuff: 'burn',
  },
  {
    actor: {
      id: 'dust-skipper',
      name: 'Dust Skipper',
      title: 'Enemy Stock',
      element: 'E',
      startingRank: 8,
      accentClassName: 'border-game-pink/35 bg-black/55 shadow-[0_0_22px_rgba(204,173,110,0.12)]',
      moveset: ['Pebble Flick', 'Scrape', 'Brace'],
    },
    combatant: { hp: 10, hpMax: 10, armor: 1, defense: 0, defenseBuffAmount: 0, evasion: 2, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false },
    maxActionsPerTurn: 3,
    behavior: 'armored',
  },
  {
    actor: {
      id: 'mist-wisp',
      name: 'Mist Wisp',
      title: 'Enemy Stock',
      element: 'W',
      startingRank: 4,
      accentClassName: 'border-game-pink/35 bg-black/55 shadow-[0_0_22px_rgba(127,219,202,0.12)]',
      moveset: ['Drift', 'Mist Prick', 'Fade'],
    },
    combatant: { hp: 7, hpMax: 7, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 14, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false },
    chipDebuff: 'slow',
    maxActionsPerTurn: 4,
    behavior: 'evasive',
  },
  {
    actor: {
      id: 'thorn-drone',
      name: 'Thorn Drone',
      title: 'Enemy Stock',
      element: 'A',
      startingRank: 10,
      accentClassName: 'border-game-pink/35 bg-black/55 shadow-[0_0_22px_rgba(175,223,134,0.12)]',
      moveset: ['Prick', 'Harry', 'Gust Needle'],
    },
    combatant: { hp: 9, hpMax: 9, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 8, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false },
    maxActionsPerTurn: 4,
    behavior: 'nagging',
    chipDebuff: 'armor-break',
  },
];

const rankLabel = (rank: number) => {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const createDeck = (): CardType[] =>
  shuffle(
    ELEMENTAL_SUITS.flatMap(({ suit, element }) =>
      Array.from({ length: 13 }, (_, index) => ({
        id: `golf-${element}-${index + 1}`,
        rank: index + 1,
        suit,
        element,
        name: '',
      }))
    )
  ).map((card, index) => ({
    ...card,
    id: `${card.id}-${index}`,
  }));

const drawCard = (deck: CardType[]) => {
  const card = deck.pop();
  if (!card) throw new Error('Golf setup exhausted the deck unexpectedly.');
  return card;
};

const getSuitForElement = (element: Element) => {
  if (element === 'A') return '♠';
  if (element === 'F') return '♥';
  if (element === 'E') return '♣';
  if (element === 'W') return '♦';
  return '♠';
};

const createActorStockCard = (actor: StockActorShell): CardType => ({
  id: `actor-stock-${actor.id}`,
  rank: actor.startingRank,
  suit: getSuitForElement(actor.element),
  element: 'N',
  name: actor.name,
});

const createStarterPackStockCard = (seed: CardType, index: number): CardType => ({
  ...seed,
  id: `starter-pack-${index}`,
});

const createStarterPackCards = (): CardType[] => ([
  { id: 'starter-pack-mochi', rank: 9, suit: '♦', element: 'N', name: 'Mochi' },
  { id: 'starter-pack-banks', rank: 6, suit: '♥', element: 'N', name: 'Banks' },
  { id: 'starter-pack-hero', rank: 1, suit: '♣', element: 'N', name: 'Hero' },
  { id: 'starter-pack-jet', rank: 1, suit: '♠', element: 'N', name: 'Jet' },
  { id: 'starter-pack-whis', rank: 8, suit: '♦', element: 'N', name: 'Whis' },
]);

const createScenarioTableauCard = (columnIndex: number, depthIndex: number, rank: number, suit: CardType['suit']): CardType => ({
  id: `scenario-${columnIndex}-${depthIndex}-${rank}-${suit}`,
  rank,
  suit,
  element: 'N',
  name: '',
});

const createTutorialFillerCard = (columnIndex: number, depthIndex: number): CardType => ({
  id: `tutorial-filler-${columnIndex}-${depthIndex}`,
  rank: 0,
  suit: '♠',
  element: 'N',
  name: 'Tutorial Filler',
});

const isTutorialFillerCard = (card: CardType | null | undefined) =>
  !!card && card.id.startsWith('tutorial-filler-');

const createTutorialMochiRescueCard = (): CardType => ({
  id: 'tutorial-mochi-rescue',
  rank: 9,
  suit: '♦',
  element: 'N',
  name: 'Mochi',
});

export const buildRngRescueTableau = (includeMochi = true): CardType[][] => {
  const deck = createDeck();
  const tableau = Array.from({ length: TABLEAU_COLUMNS }, () =>
    Array.from({ length: TABLEAU_ROWS }, () => drawCard(deck))
  );
  if (includeMochi) {
    tableau[RNG_MOCHI_TARGET_COLUMN][TABLEAU_ROWS - 1 - RNG_MOCHI_DEPTH_INDEX] = createTutorialMochiRescueCard();
  }
  return tableau;
};

const createThinSliceTableau = (): CardType[][] => {
  const layout: Array<Array<{ rank: number; suit: CardType['suit'] }>> = [
    [{ rank: 5, suit: '♠' }, { rank: 7, suit: '♦' }, { rank: 9, suit: '♥' }, { rank: 1, suit: '♣' }, { rank: 12, suit: '♠' }],
    [{ rank: 4, suit: '♦' }, { rank: 6, suit: '♥' }, { rank: 8, suit: '♣' }, { rank: 10, suit: '♠' }, { rank: 6, suit: '♥' }],
    [{ rank: 2, suit: '♣' }, { rank: 4, suit: '♠' }, { rank: 6, suit: '♦' }, { rank: 7, suit: '♥' }, { rank: 2, suit: '♠' }],
    [{ rank: 3, suit: '♥' }, { rank: 5, suit: '♣' }, { rank: 7, suit: '♠' }, { rank: 8, suit: '♦' }, { rank: 9, suit: '♣' }],
    [{ rank: 4, suit: '♠' }, { rank: 6, suit: '♦' }, { rank: 8, suit: '♥' }, { rank: 10, suit: '♣' }, { rank: 8, suit: '♠' }],
    [{ rank: 1, suit: '♦' }, { rank: 3, suit: '♠' }, { rank: 5, suit: '♥' }, { rank: 7, suit: '♣' }, { rank: 11, suit: '♦' }],
    [{ rank: 2, suit: '♥' }, { rank: 4, suit: '♣' }, { rank: 6, suit: '♠' }, { rank: 8, suit: '♥' }, { rank: 10, suit: '♣' }],
  ];
  return layout.map((column, columnIndex) =>
    column.map((entry, depthIndex) => createScenarioTableauCard(columnIndex, depthIndex, entry.rank, entry.suit))
  );
};

const createTutorialSlice01Tableau = (): CardType[][] => ([
  [
    createScenarioTableauCard(0, 0, 13, '♣'),
    createScenarioTableauCard(0, 1, 13, '♠'),
    createScenarioTableauCard(0, 2, 2, '♥'),
  ],
  [
    createScenarioTableauCard(1, 0, 2, '♣'),
    createScenarioTableauCard(1, 1, 8, '♦'),
  ],
  [
    createScenarioTableauCard(2, 0, 3, '♦'),
    createTutorialFillerCard(2, 1),
    createScenarioTableauCard(2, 2, 3, '♣'),
  ],
  [
    createScenarioTableauCard(3, 0, 7, '♦'),
    createTutorialFillerCard(3, 1),
    createScenarioTableauCard(3, 2, 7, '♠'),
  ],
  [
    createScenarioTableauCard(4, 0, 4, '♣'),
    createTutorialFillerCard(4, 1),
    createScenarioTableauCard(4, 2, 4, '♠'),
  ],
  [
    createScenarioTableauCard(5, 0, 6, '♣'),
    createTutorialFillerCard(5, 1),
    createScenarioTableauCard(5, 2, 6, '♥'),
  ],
  [
    createScenarioTableauCard(6, 0, 5, '♥'),
    createTutorialFillerCard(6, 1),
    createScenarioTableauCard(6, 2, 5, '♠'),
  ],
]);

const createTutorialSlice02Tableau = (): CardType[][] => ([
  [
    createTutorialFillerCard(0, 0),
    createTutorialFillerCard(0, 1),
    createScenarioTableauCard(0, 2, 2, '♥'),
  ],
  [
    createScenarioTableauCard(1, 0, 4, '♣'),
    createScenarioTableauCard(1, 1, 10, '♣'),
    createScenarioTableauCard(1, 2, 8, '♦'),
  ],
  [
    createScenarioTableauCard(2, 0, 5, '♠'),
    createScenarioTableauCard(2, 1, 7, '♠'),
    createScenarioTableauCard(2, 2, 3, '♦'),
  ],
  [
    createScenarioTableauCard(3, 0, 5, '♣'),
    createScenarioTableauCard(3, 1, 12, '♥'),
    createScenarioTableauCard(3, 3, 11, '♠'),
  ],
  [
    createScenarioTableauCard(4, 0, 4, '♠'),
    createScenarioTableauCard(4, 1, 13, '♥'),
    createScenarioTableauCard(4, 2, 4, '♠'),
  ],
  [
    createScenarioTableauCard(5, 0, 2, '♣'),
    createScenarioTableauCard(5, 1, 2, '♦'),
    createScenarioTableauCard(5, 2, 6, '♣'),
  ],
  [
    createScenarioTableauCard(6, 0, 3, '♠'),
    createScenarioTableauCard(6, 1, 3, '♣'),
    createScenarioTableauCard(6, 2, 5, '♥'),
  ],
]);

const createTutorialSlice03Tableau = (): CardType[][] => ([
  [
    createScenarioTableauCard(0, 0, 12, '♣'),
    createScenarioTableauCard(0, 1, 5, '♦'),
    createScenarioTableauCard(0, 2, 2, '♠'),
  ],
  [
    createScenarioTableauCard(1, 0, 5, '♣'),
    createScenarioTableauCard(1, 1, 13, '♥'),
    createScenarioTableauCard(1, 2, 7, '♦'),
  ],
  [
    createScenarioTableauCard(2, 0, 6, '♠'),
    createScenarioTableauCard(2, 1, 4, '♣'),
    createScenarioTableauCard(2, 2, 7, '♥'),
  ],
  [
    createScenarioTableauCard(3, 0, 3, '♣'),
    createScenarioTableauCard(3, 1, 9, '♠'),
    createScenarioTableauCard(3, 2, 4, '♦'),
  ],
  [
    createScenarioTableauCard(4, 0, 12, '♠'),
    createScenarioTableauCard(4, 1, 6, '♥'),
    createScenarioTableauCard(4, 2, 7, '♣'),
  ],
  [
    createScenarioTableauCard(5, 0, 1, '♣'),
    createScenarioTableauCard(5, 1, 5, '♦'),
    createScenarioTableauCard(5, 2, 10, '♣'),
  ],
  [
    createScenarioTableauCard(6, 0, 3, '♥'),
    createScenarioTableauCard(6, 1, 6, '♠'),
    createScenarioTableauCard(6, 2, 11, '♦'),
  ],
]);

const TUTORIAL_SLICE_02_HERO_ROUTE = [0, 2, 4, 6, 5, 2, 1] as const;
const TUTORIAL_SLICE_02_MOCHI_ROUTE = [1, 3, 3, 4] as const;
const TUTORIAL_SLICE_03_ROUTE = [
  { kind: 'tableau', columnIndex: 0 },
  { kind: 'swap', starterPackIndex: 0 },
  { kind: 'tableau', columnIndex: 5 },
  { kind: 'tableau', columnIndex: 6 },
  { kind: 'swap', starterPackIndex: 1 },
] as const;

const popTutorialTableauPath = (tableau: CardType[][], route: readonly number[]) => (
  route.reduce<CardType[][]>(
    (current, columnIndex) => current.map((column, index) => (index === columnIndex ? column.slice(0, -1) : [...column])),
    tableau.map((column) => [...column])
  )
);

const createTutorialSlice04Tableau = (): CardType[][] => ([
  [createScenarioTableauCard(0, 0, 6, '♠')],
  [
    createScenarioTableauCard(1, 0, 4, '♥'),
    createScenarioTableauCard(1, 1, 3, '♦'),
    createScenarioTableauCard(1, 2, 2, '♣'),
    createScenarioTableauCard(1, 3, 5, '♠'),
  ],
  [createScenarioTableauCard(2, 0, 8, '♦')],
  [createScenarioTableauCard(3, 0, 9, '♣')],
  [createScenarioTableauCard(4, 0, 10, '♠')],
  [createScenarioTableauCard(5, 0, 11, '♥')],
  [createScenarioTableauCard(6, 0, 12, '♣')],
]);

const createTutorialStarterPack = (names: Array<'Hero' | 'Mochi' | 'Banks' | 'Jet' | 'Whis'>): CardType[] =>
  createStarterPackCards().filter((card): card is CardType & { name: 'Hero' | 'Mochi' | 'Banks' | 'Jet' | 'Whis' } => names.includes(card.name as 'Hero' | 'Mochi' | 'Banks' | 'Jet' | 'Whis'));

const getKinFamilyLabel = (family: KinFamily) => {
  if (family === 'felis') return 'FELIS';
  if (family === 'canid') return 'CANID';
  if (family === 'mustelid') return 'MUSTELID';
  if (family === 'corvid') return 'CORVID';
  return 'KIN';
};

const getBanksAbilityTierName = (tier: 1 | 2 | 3) => (
  tier >= 3 ? 'Hit and Run' : 'Swipe'
);

const getBanksApCap = (tier: 1 | 2 | 3) => tier;

const clampStarterPackApToCap = (
  actorName: string,
  actionPoints: number,
  rarity: 1 | 2 | 3
) => {
  if (actorName === 'Banks') return Math.min(getBanksApCap(rarity), Math.max(0, actionPoints));
  if (actorName === 'Jet') return Math.min(JET_MAX_AP, Math.max(0, actionPoints));
  return Math.min(14, Math.max(0, actionPoints));
};

const evaluatePerfectStop = (actorName: string, actionPoints: number, mode: StarterKinMode = 'default', rarity: 1 | 2 | 3 = 1) => {
  if (actorName === 'Mochi') {
    if (actionPoints <= 2) return { label: 'Clean Pop', subtitle: 'Perfect Stop', positive: true };
    if (actionPoints <= 5) return { label: 'Rolling Flow', subtitle: 'Good Stop', positive: true };
    return { label: 'Oversteeped', subtitle: 'Missed Window', positive: false };
  }
  if (actorName === 'Banks') {
    const cap = getBanksApCap(rarity);
    if (actionPoints <= 0) return { label: 'Empty Clip', subtitle: 'No Strike', positive: false, nextMode: mode };
    if (rarity === 1) {
      return actionPoints >= 1
        ? { label: 'Swipe', subtitle: 'Unlock Uncommon', positive: true, nextMode: mode }
        : { label: 'Lurk', subtitle: 'Needs 1 AP', positive: false, nextMode: mode };
    }
    if (rarity === 2) {
      return actionPoints >= cap
        ? { label: 'Swipe II', subtitle: 'Unlock Rare', positive: true, nextMode: mode }
        : { label: 'Swipe I', subtitle: 'Fallback Line', positive: true, nextMode: mode };
    }
    return actionPoints >= 3
      ? { label: 'Hit and Run', subtitle: mode === 'banks-prowl' ? 'Prowl Active' : 'Rare Sweet Spot', positive: true, nextMode: 'banks-prowl' as StarterKinMode }
      : actionPoints === 2
        ? { label: 'Swipe II', subtitle: 'Rare Floor', positive: true, nextMode: mode }
        : { label: 'Swipe I', subtitle: 'Rare Floor', positive: true, nextMode: mode };
  }
  if (actorName === 'Hero') {
    if (actionPoints < HERO_GUARD_COST) return { label: 'Brace', subtitle: 'Build Guard', positive: true, nextMode: 'default' as StarterKinMode };
    return { label: 'Guard Ready', subtitle: 'No Sweet Spot', positive: true, nextMode: 'default' as StarterKinMode };
  }
  if (actorName === 'Jet') {
    if (actionPoints < JET_REWIRE_COST) return { label: 'Build Route', subtitle: 'Needs 2 AP', positive: true, nextMode: 'default' as StarterKinMode };
    if (actionPoints < JET_MAX_AP) return { label: 'Rewire Ready', subtitle: 'Charged Tableau', positive: true, nextMode: 'default' as StarterKinMode };
    return { label: 'Full Surge', subtitle: 'Max AP', positive: true, nextMode: 'default' as StarterKinMode };
  }
  return actionPoints <= 3
    ? { label: 'Steady Close', subtitle: 'Good Stop', positive: true, nextMode: 'default' as StarterKinMode }
    : { label: 'Overextended', subtitle: 'Missed Window', positive: false, nextMode: 'default' as StarterKinMode };
};

const createEnemyStockCard = (actor: StockActorShell, instanceLabel?: string): CardType => {
  enemyInstanceSequence += 1;
  return {
    id: `enemy-stock-${actor.id}-${enemyInstanceSequence}`,
    rank: actor.startingRank,
    suit: getSuitForElement(actor.element),
    element: 'N',
    name: instanceLabel ? `${actor.name} ${instanceLabel}` : actor.name,
  };
};

const createHandSlot = (
  slotId: HandSlotId,
  kind: PlayerHandSlot['kind'],
  name: string,
  effect: PlayerHandSlot['effect'],
  card: CardType | null,
  armed = false
): PlayerHandSlot => ({
  slotId,
  kind,
  name,
  effect,
  card,
  armed,
  generatedEffect: null,
  generatedValue: 0,
});

const createCapturedHandSlot = (slotId: HandSlotId, card: CardType): PlayerHandSlot =>
  createHandSlot(slotId, 'captured', 'Recovered', null, { ...card, name: '' });

const createGeneratedHandSlot = (
  slotId: HandSlotId,
  name: string,
  card: CardType,
  generatedEffect: 'free-energy' | 'heart-of-the-wild' | 'wildcard',
  generatedValue: number
): PlayerHandSlot => ({
  slotId,
  kind: 'generated',
  name,
  effect: null,
  card,
  armed: false,
  generatedEffect,
  generatedValue,
});

const createEmptyHandSlot = (slotId: HandSlotId): PlayerHandSlot =>
  createHandSlot(slotId, 'empty', '', null, null);

const HERO_HEART_TRIGGER = 4;
const HERO_ENDURANCE_TURN_INTERVAL = 4;
const HERO_SECOND_WIND_COOLDOWN_TURNS = 2;
const HERO_BASE_ENDURANCE_MAX = 1;
const HERO_MAX_HEART_SLOTS = 8;
const HERO_WILD_RESILIENCE_THRESHOLD = 3;
const HERO_GUARD_COST = 2;
const HERO_GUARD_ARMOR = 4;
const HERO_GUARD_TAUNT_TURNS = 1;
const JET_REWIRE_COST = 2;
const JET_MAX_AP = 8;
const ENEMY_BITE_AP_GAIN = 1;
const ENEMY_BITE_DESTROY_THRESHOLD = 3;
const KIN_ZOOLOGY_SEEDS: KinSpeciesId[] = ['jet', 'jet', 'whis', 'pan', 'pan', 'pan'];
const KIN_BURIAL_COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];
const KIN_SPECIES_DEFS: Record<KinSpeciesId, { name: string; glyph: string; rank: number; baseElement: Element }> = {
  jet: { name: 'Jet', glyph: 'J', rank: 2, baseElement: 'A' },
  whis: { name: 'Whis', glyph: 'W', rank: 8, baseElement: 'W' },
  pan: { name: 'Pan', glyph: 'P', rank: 7, baseElement: 'F' },
};

const titleCasePronoun = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const SLICE_01_FILLER_REVEAL_SCHEDULE: Record<number, number[]> = {
  7: [3],
  8: [5],
  9: [6],
  10: [4],
  11: [2],
};

const applyTutorialSliceRevealRules = (state: GolfGameState): GolfGameState => {
  if (state.tutorialSliceId !== 'slice-01') return state;
  const columnsToReveal = SLICE_01_FILLER_REVEAL_SCHEDULE[state.tutorialActionCount] ?? [];
  if (columnsToReveal.length === 0) return state;

  const nextTableau = state.tableau.map((column, columnIndex) => {
    if (!columnsToReveal.includes(columnIndex)) return column;
    const topCard = column[column.length - 1] ?? null;
    if (!isTutorialFillerCard(topCard)) return column;
    return column.slice(0, -1);
  });

  return { ...state, tableau: nextTableau };
};

const applyPlayerActionStatusUpdate = (prev: GolfGameState): { state: GolfGameState; statusEvent: StatusEffectEvent | null } => {
  const mochiCombatant = prev.combatants.mochi;
  const nextActionCount = prev.tutorialActionCount + 1;
  if (!mochiCombatant || (mochiCombatant.skittish ?? 0) <= 0) {
    return {
      state: applyTutorialSliceRevealRules({
        ...prev,
        tutorialActionCount: nextActionCount,
      }),
      statusEvent: null,
    };
  }
  const nextSkittish = Math.max(0, (mochiCombatant.skittish ?? 0) - 1);
  return {
    state: applyTutorialSliceRevealRules({
      ...prev,
      tutorialActionCount: nextActionCount,
      combatants: {
        ...prev.combatants,
        mochi: {
          ...mochiCombatant,
          skittish: nextSkittish,
        },
      },
    }),
    statusEvent: {
      actorName: 'Mochi',
      statusKey: 'skittish',
      label: 'SK',
      tone: 'debuff',
      nextValue: nextSkittish,
      removed: nextSkittish <= 0,
    },
  };
};

const renderEffectDefinitionTooltip = (definition: KinEffectDefinition) => (
  <div className="min-w-[180px] max-w-[240px] rounded-2xl border border-white/12 bg-[#05070d] px-3 py-2 text-left shadow-[0_12px_40px_rgba(0,0,0,0.42)]">
    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-game-pink">
      {definition.name}
    </div>
    <div className="mt-1 text-[11px] leading-[1.4] text-white/72">
      {renderGameText(definition.flavorText)}
    </div>
    <div className="mt-1 text-[11px] leading-[1.4] text-white/84">
      {renderGameText(definition.effectText)}
    </div>
  </div>
);

const renderGameText = (text: string, options?: { enableEffectTooltips?: boolean }) => {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const enableEffectTooltips = options?.enableEffectTooltips ?? false;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const effectName = token.slice(2, -2);
      const effectDefinition = enableEffectTooltips ? getKinEffectDefinition(effectName) : null;
      if (effectDefinition) {
        nodes.push(
          <Tooltip key={`bold-${match.index}`} content={renderEffectDefinitionTooltip(effectDefinition)} pinnable={false} clickToPin={false} inlineTrigger>
            <span className="inline-flex cursor-help text-game-pink">
              <strong>{effectName}</strong>
            </span>
          </Tooltip>
        );
      } else {
        nodes.push(<strong key={`bold-${match.index}`} className="text-game-pink">{effectName}</strong>);
      }
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={`italic-${match.index}`}>{token.slice(1, -1)}</em>);
    } else {
      nodes.push(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
};

const wrapGolfRank = (rank: number) => {
  if (rank < 1) return 13;
  if (rank > 13) return 1;
  return rank;
};

const createHeartOfTheWildCard = (stock: CardType, preferredRank = wrapGolfRank(stock.rank + 1)): CardType => ({
  id: `hero-heart-${stock.id}-${preferredRank}`,
  rank: preferredRank,
  suit: stock.suit,
  element: 'N',
  name: '',
});

const getMostPromisingHeroHeartCard = (state: GolfGameState) => {
  const upCard = createHeartOfTheWildCard(state.playerStock, wrapGolfRank(state.playerStock.rank + 1));
  const downCard = createHeartOfTheWildCard(state.playerStock, wrapGolfRank(state.playerStock.rank - 1));
  const upFollowUps = state.tableau.reduce((count, column) => {
    const top = column[column.length - 1] ?? null;
    return count + (top && canPlayOnStock(top, upCard) ? 1 : 0);
  }, 0);
  const downFollowUps = state.tableau.reduce((count, column) => {
    const top = column[column.length - 1] ?? null;
    return count + (top && canPlayOnStock(top, downCard) ? 1 : 0);
  }, 0);
  return downFollowUps > upFollowUps ? downCard : upCard;
};

const addHeroHearts = (state: GolfGameState, amount: number) => ({
  ...state,
  heroHeartsHeld: clampNumber(state.heroHeartsHeld + amount, 0, state.heroEnduranceMax),
});

const addHeroWildcards = (state: GolfGameState, amount: number) => ({
  ...state,
  heroHeartsHeld: clampNumber(state.heroHeartsHeld + amount, 0, HERO_MAX_HEART_SLOTS),
});

const applyHeroWildSpiritGain = (state: GolfGameState, gain = 1): GolfGameState => {
  if (gain <= 0) return state;
  const heroCombatant = state.combatants.hero;
  const currentWildSpirit = heroCombatant?.wildSpirit ?? 0;
  const nextRaw = currentWildSpirit + gain;
  const thresholdsEarned = Math.floor(nextRaw / HERO_WILD_RESILIENCE_THRESHOLD);
  const remainder = nextRaw % HERO_WILD_RESILIENCE_THRESHOLD;
  if (!heroCombatant) {
    return {
      ...state,
      combatants: state.combatants,
    };
  }
  if (thresholdsEarned <= 0) {
    return {
      ...state,
      combatants: {
        ...state.combatants,
        hero: {
          ...heroCombatant,
          wildSpirit: nextRaw,
        },
      },
    };
  }
  return addHeroWildcards({
    ...state,
    combatants: {
      ...state.combatants,
      hero: {
        ...heroCombatant,
        armor: heroCombatant.armor + thresholdsEarned,
        wildSpirit: remainder,
      },
    },
  }, thresholdsEarned);
};

const getHeroHeartSlotIds = (): HandSlotId[] => ([
  'hero-heart-1',
  'hero-heart-2',
  'hero-heart-3',
  'hero-heart-4',
  'hero-heart-5',
  'hero-heart-6',
  'hero-heart-7',
  'hero-heart-8',
]);

const PRIME_ABILITY_SLOT_IDS: Array<PlayerHandSlot['slotId']> = [
  'left',
  'right',
  'jet-left-2',
  'jet-left-3',
  'jet-right-2',
  'jet-right-3',
  'jet-right-4',
  'pan-left',
];

const createStarterKinStickers = (): KinSticker[] => {
  const counts = new Map<KinSpeciesId, number>();
  KIN_ZOOLOGY_SEEDS.forEach((speciesId) => {
    counts.set(speciesId, (counts.get(speciesId) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([speciesId, rawCount]) => {
    const def = KIN_SPECIES_DEFS[speciesId];
    const rarity = clampNumber(rawCount, 1, 3) as 1 | 2 | 3;
    return {
      id: `sticker-${speciesId}`,
      speciesId,
      name: def.name,
      glyph: def.glyph,
      rank: def.rank,
      baseElement: def.baseElement,
      augmentElement: null,
      rarity,
      state: 'available',
      buriedCardId: null,
      buriedColumnIndex: null,
    };
  });
};

const getMochiStarterPackIndex = (state: GolfGameState) =>
  state.starterPackBase.findIndex((card) => card.name === 'Mochi');

const getZoomiesClaimCap = (rarity: 1 | 2 | 3) => {
  if (rarity >= 3) return 7;
  if (rarity === 2) return 5;
  return 3;
};

const getKinStickerElement = (sticker: KinSticker) => sticker.augmentElement ?? sticker.baseElement;

const resetStarterPackCycle = (state: GolfGameState): GolfGameState => ({
  ...state,
  starterPackUsed: state.starterPackBase.map((_, index) => index === 0),
  starterPackLocked: state.starterPackBase.map(() => false),
  starterPackCashoutStats: state.starterPackBase.map(() => null),
  activeStarterPackIndex: 0,
  playerStock: createStarterPackStockCard(state.starterPackBase[0], 0),
  playerStockSequence: 0,
  playerStockActionPoints: clampStarterPackApToCap(
    state.starterPackBase[0]?.name ?? '',
    state.starterPackStoredAp[0] ?? 0,
    state.starterPackAbilityRarities[0] ?? 1
  ),
  playerPrimeApSegments: [],
  playerCapturedLeft: null,
  playerCapturedRight: null,
  playerSupportActionUsed: false,
  playerSupportRotateUsed: false,
  playerSupportReactiveUsed: false,
  heroStockAddsThisTurn: 0,
  heroLeaderTriggeredThisTurn: false,
  heroTrailSenseActive: false,
  heroGuardTauntTurns: state.heroGuardTauntTurns,
  jetChargedCardIds: state.jetChargedCardIds,
});

const ApBadge = ({ actionPoints }: { actionPoints: number }) => (
  <div className="pointer-events-none absolute -bottom-2 -right-2 z-20 h-8 w-8 [perspective:120px]">
    <div
      className="absolute right-0 top-[2px] h-6 w-5 rounded-[4px] border border-game-gold/30 bg-[linear-gradient(180deg,rgba(255,232,148,0.96),rgba(226,170,58,0.9))] shadow-[0_3px_10px_rgba(230,179,30,0.24)]"
      style={{ transform: 'rotate(10deg) skewY(-4deg)' }}
    >
      <div className="absolute inset-[2px] rounded-[3px] border border-white/30 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.24),transparent_55%),linear-gradient(180deg,rgba(74,48,8,0.14),rgba(31,21,5,0.2))]" />
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-[#6a4302]/85">
        ⚡
      </div>
      <div className="absolute bottom-[-7px] left-[-10px] flex h-5 min-w-5 items-center justify-center rounded-full border border-[#d38a34]/80 bg-transparent px-1 shadow-[0_2px_8px_rgba(211,138,52,0.2)]">
        <div
          className="text-[10px] font-black leading-none text-[#ffd48a] tabular-nums"
          style={{ WebkitTextStroke: '0.8px rgba(0,0,0,0.98)', textShadow: '0 0 3px rgba(0,0,0,0.95)' }}
        >
          {Math.min(99, Math.max(0, actionPoints))}
        </div>
      </div>
    </div>
  </div>
);

const createKinStickerCard = (sticker: KinSticker): CardType => ({
  id: `kin-${sticker.id}-${Date.now()}`,
  rank: sticker.rank,
  suit: getSuitForElement(getKinStickerElement(sticker)),
  element: 'N',
  name: '',
});

const pickKinBurialTarget = (tableau: CardType[][]) => {
  for (const columnIndex of KIN_BURIAL_COLUMN_ORDER) {
    const column = tableau[columnIndex] ?? [];
    if (column.length > 1) {
      const host = column[column.length - 2] ?? null;
      if (host) {
        return { buriedCardId: host.id, buriedColumnIndex: columnIndex };
      }
    }
  }
  return { buriedCardId: null, buriedColumnIndex: null };
};

const buryKinSticker = (state: GolfGameState, stickerId: string): GolfGameState => {
  const target = pickKinBurialTarget(state.tableau);
  return {
    ...state,
    kinStickers: state.kinStickers.map((sticker) =>
      sticker.id !== stickerId
        ? sticker
        : {
            ...sticker,
            state: 'buried',
            buriedCardId: target.buriedCardId,
            buriedColumnIndex: target.buriedColumnIndex,
          }
    ),
  };
};

const reclaimBuriedKinStickers = (state: GolfGameState): GolfGameState => {
  let changed = false;
  const kinStickers = state.kinStickers.map((sticker) => {
    if (sticker.state !== 'buried' || !sticker.buriedCardId) return sticker;
    const columnIndex = state.tableau.findIndex((column) => column.some((card) => card.id === sticker.buriedCardId));
    if (columnIndex < 0) {
      changed = true;
      return {
        ...sticker,
        state: 'available',
        buriedCardId: null,
        buriedColumnIndex: null,
      };
    }
    const column = state.tableau[columnIndex];
    const top = column[column.length - 1] ?? null;
    if (top?.id === sticker.buriedCardId) {
      changed = true;
      return {
        ...sticker,
        state: 'available',
        buriedCardId: null,
        buriedColumnIndex: null,
      };
    }
    return sticker;
  });
  return changed ? { ...state, kinStickers } : state;
};

const getActorElementByName = (name: string): Element => {
  return 'N';
};

const parseDiscardRank = (entry: string) => {
  const match = entry.match(/([AJQK]|\d+)$/);
  if (!match) return null;
  const token = match[1];
  if (token === 'A') return 1;
  if (token === 'J') return 11;
  if (token === 'Q') return 12;
  if (token === 'K') return 13;
  const parsed = Number(token);
  return Number.isFinite(parsed) ? parsed : null;
};

const getMostRecentFetchCandidate = (state: GolfGameState) => {
  for (let index = state.playerDiscardPile.length - 1; index >= 0; index -= 1) {
    const entry = state.playerDiscardPile[index];
    const separator = entry.indexOf('::');
    const actorName = separator > 0 ? entry.slice(0, separator) : '';
    if (!actorName || actorName === 'Hero') continue;
    const rank = parseDiscardRank(entry);
    if (rank === null) continue;
    const element = getActorElementByName(actorName);
    return {
      actorName,
      rank,
      card: {
        id: `fetch-${actorName.toLowerCase()}-${index}-${rank}`,
        rank,
        suit: getSuitForElement(element),
        element: 'N',
        name: '',
      } satisfies CardType,
    };
  }
  return null;
};

const getTopTableauFetchCandidate = (state: GolfGameState) => {
  const candidates = state.tableau
    .map((column, columnIndex) => {
      const card = column[column.length - 1] ?? null;
      if (!card) return null;
      const followUps = state.tableau.reduce((count, otherColumn, otherColumnIndex) => {
        if (otherColumnIndex === columnIndex) return count;
        const top = otherColumn[otherColumn.length - 1] ?? null;
        return count + (top && canPlayOnStock(top, card) ? 1 : 0);
      }, 0);
      return {
        source: 'tableau' as const,
        columnIndex,
        card,
        score: followUps + (column.length > 1 ? 1 : 0),
      };
    })
    .filter((entry): entry is { source: 'tableau'; columnIndex: number; card: CardType; score: number } => !!entry);
  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
};

const getBestFetchCandidate = (state: GolfGameState) => {
  const tableauCandidate = getTopTableauFetchCandidate(state);
  if (tableauCandidate) return tableauCandidate;
  const discardCandidate = getMostRecentFetchCandidate(state);
  return discardCandidate ? { source: 'discard' as const, card: discardCandidate.card, actorName: discardCandidate.actorName } : null;
};

type ExclusionNode = {
  cardId: string;
  card: CardType;
  columnIndex: number;
  actualIndex: number;
};

const getVisibleExclusionNodes = (tableau: CardType[][], visiblePeekCount: number): ExclusionNode[] => (
  tableau.flatMap((column, columnIndex) => {
    const firstVisibleIndex = Math.max(0, column.length - 1 - visiblePeekCount);
    return column
      .map((card, actualIndex) => ({ card, actualIndex }))
      .filter(({ actualIndex }) => actualIndex >= firstVisibleIndex)
      .map(({ card, actualIndex }) => ({
        cardId: card.id,
        card,
        columnIndex,
        actualIndex,
      }));
  })
);

const scoreExclusionPath = (path: ExclusionNode[]) => (
  path.reduce((sum, node) => sum + node.card.rank, 0)
);

const compareExclusionPaths = (left: ExclusionNode[], right: ExclusionNode[]) => {
  if (left.length !== right.length) return left.length - right.length;
  const leftScore = scoreExclusionPath(left);
  const rightScore = scoreExclusionPath(right);
  if (leftScore !== rightScore) return leftScore - rightScore;
  const leftStart = left[0]?.columnIndex ?? Number.MAX_SAFE_INTEGER;
  const rightStart = right[0]?.columnIndex ?? Number.MAX_SAFE_INTEGER;
  if (leftStart !== rightStart) return rightStart - leftStart;
  const leftKey = left.map((node) => `${String(node.columnIndex).padStart(2, '0')}-${String(node.actualIndex).padStart(2, '0')}`).join('|');
  const rightKey = right.map((node) => `${String(node.columnIndex).padStart(2, '0')}-${String(node.actualIndex).padStart(2, '0')}`).join('|');
  if (leftKey === rightKey) return 0;
  return leftKey < rightKey ? 1 : -1;
};

const findBestExclusionPath = (
  tableau: CardType[][],
  visiblePeekCount: number,
  maxClaims: number
) => {
  if (maxClaims <= 0) return [] as ExclusionNode[];
  const nodes = getVisibleExclusionNodes(tableau, visiblePeekCount);
  const byColumn = new Map<number, ExclusionNode[]>();
  nodes.forEach((node) => {
    const bucket = byColumn.get(node.columnIndex) ?? [];
    bucket.push(node);
    byColumn.set(node.columnIndex, bucket);
  });

  let bestPath: ExclusionNode[] = [];
  const visit = (current: ExclusionNode, used: Set<string>, path: ExclusionNode[]) => {
    if (compareExclusionPaths(path, bestPath) > 0) {
      bestPath = [...path];
    }
    if (path.length >= maxClaims) return;
    for (const neighborColumn of [current.columnIndex - 1, current.columnIndex + 1]) {
      const neighbors = byColumn.get(neighborColumn) ?? [];
      for (const neighbor of neighbors) {
        if (used.has(neighbor.cardId)) continue;
        if (!canPlayOnRank(neighbor.card.rank, current.card.rank)) continue;
        used.add(neighbor.cardId);
        path.push(neighbor);
        visit(neighbor, used, path);
        path.pop();
        used.delete(neighbor.cardId);
      }
    }
  };

  nodes.forEach((node) => {
    const used = new Set<string>([node.cardId]);
    visit(node, used, [node]);
  });

  return bestPath.slice(0, maxClaims);
};

const resolveExclusionPathTableau = (tableau: CardType[][], path: ExclusionNode[]) => {
  const usedIds = new Set(path.map((node) => node.cardId));
  let tableClears = 0;
  const nextTableau = tableau.map((column, columnIndex) => {
    const filtered = column.filter((card) => !usedIds.has(card.id));
    if (filtered.length > 0) return filtered;
    tableClears += 1;
    return Array.from({ length: TABLEAU_ROWS }, () => createRandomGolfCard());
  });
  return { tableau: nextTableau, tableClears };
};

const getViceGripColumns = (tableau: CardType[][]) => {
  const center = Math.floor(tableau.length / 2);
  return [center - 1, center, center + 1].filter((index) => index >= 0 && index < tableau.length);
};

const getAbilityCostLabel = (effect: PlayerHandSlot['effect']) => {
  if (effect === 'banks-strike') return '1-3';
  if (effect === 'hero-guard') return String(HERO_GUARD_COST);
  if (effect === 'sticky-paws') return 'Q';
  if (effect === 'path-of-stars') return '10+';
  if (effect === 'jikan') return '2';
  if (effect === 'ironfur') return '4';
  if (effect === 'tap-out') return '3';
  if (effect === 'fetch') return '2';
  if (effect === 'vice-grip') return '3';
  if (effect === 'slipstream') return '4';
  if (effect === 'battery') return 'LINK';
  if (effect === 'rigged-construct') return 'Q';
  if (effect === 'rewire') return String(JET_REWIRE_COST);
  if (effect === 'scrap-plating') return 'Q';
  if (effect === 'aegis-shunt') return 'Q';
  if (effect === 'repurpose' || effect === 'paw-sperity') return '∞';
  return null;
};

const getAbilityBaseCost = (effect: PlayerHandSlot['effect']) => {
  if (effect === 'sticky-paws') return 5;
  if (effect === 'battery') return 0;
  if (effect === 'siphon') return 2;
  if (effect === 'rigged-construct') return 8;
  if (effect === 'rewire') return JET_REWIRE_COST;
  if (effect === 'scrap-plating') return 4;
  if (effect === 'aegis-shunt') return 4;
  const label = getAbilityCostLabel(effect);
  if (!label || label === '∞' || label.endsWith('+')) return null;
  const parsed = Number(label);
  return Number.isFinite(parsed) ? parsed : null;
};

const isJetBatteryAssignableEffect = (effect: PlayerHandSlot['effect']): effect is JetBatteryAssignableEffect =>
  effect === 'sticky-paws' || effect === 'rigged-construct' || effect === 'rewire' || effect === 'scrap-plating' || effect === 'aegis-shunt';

const getAbilityTaxonomy = (effect: PlayerHandSlot['effect']): AbilityTaxonomy | null => {
  if (effect === 'repurpose') return 'tableau-clear';
  if (effect === 'sticky-paws' || effect === 'path-of-stars' || effect === 'jikan' || effect === 'ironfur' || effect === 'tap-out' || effect === 'slipstream' || effect === 'battery' || effect === 'siphon' || effect === 'rigged-construct' || effect === 'rewire' || effect === 'vice-grip' || effect === 'banks-strike' || effect === 'hero-guard') return 'signature-active';
  if (effect === 'fetch') return 'utility-active';
  if (effect === 'paw-sperity') return 'utility-active';
  return null;
};

const getAbilityTaxonomyBadge = (effect: PlayerHandSlot['effect']) => {
  if (effect === 'repurpose') return 'TC';
  if (effect === 'sticky-paws' || effect === 'paw-sperity' || effect === 'path-of-stars' || effect === 'jikan' || effect === 'vice-grip' || effect === 'banks-strike' || effect === 'hero-guard') return 'SA';
  if (effect === 'fetch') return 'UA';
  return null;
};

const getAbilityCooldown = (state: GolfGameState, effect: PlayerHandSlot['effect']) => {
  if (effect === 'sticky-paws') return state.stickyPawsCooldown;
  if (effect === 'paw-sperity') return state.panPawSperityCooldown;
  if (effect === 'rigged-construct') return state.riggedConstructCooldown;
  if (effect === 'rewire') return state.playerStock.name === 'Jet' ? 0 : state.assistJetRewireCooldown;
  return 0;
};

const getPrimeJetAbilityCost = (state: GolfGameState, effect: PlayerHandSlot['effect']) => {
  const baseCost = getAbilityBaseCost(effect);
  if (baseCost === null) return 0;
  if (state.playerStock.name !== 'Jet' || !state.jetEfficiencyDiscountReady) return baseCost;
  return Math.max(0, baseCost - JET_EFFICIENCY_DISCOUNT);
};

const getJetBatteryForEffect = (state: GolfGameState, effect: JetBatteryAssignableEffect) =>
  state.jetBatteries.find((battery) => battery.effect === effect) ?? null;

const getJetBatteryCharge = (state: GolfGameState, effect: PlayerHandSlot['effect']) => (
  isJetBatteryAssignableEffect(effect) ? (getJetBatteryForEffect(state, effect)?.charge ?? 0) : 0
);

const createJetBatteryAssignment = (state: GolfGameState, effect: JetBatteryAssignableEffect) => {
  if (state.jetBatteries.some((battery) => battery.effect === effect)) {
    return { ...state, jetBatteryPrimeArmed: false };
  }
  return {
    ...state,
    jetBatteries: [...state.jetBatteries, { effect, charge: 0 }],
    jetBatteryPrimeArmed: false,
  };
};

const routeJetChargeToBatteries = (state: GolfGameState, gain: number) => {
  if (gain <= 0 || state.jetBatteries.length === 0) return state;
  const nextBatteries = state.jetBatteries.map((battery) => ({ ...battery }));
  let cursor = state.jetBatteryAlternatorIndex;
  for (let index = 0; index < gain; index += 1) {
    const target = nextBatteries[cursor % nextBatteries.length];
    target.charge += 1;
    cursor += 1;
  }
  return {
    ...state,
    jetBatteries: nextBatteries,
    jetBatteryAlternatorIndex: cursor % nextBatteries.length,
  };
};

const consumeJetBattery = (state: GolfGameState, effect: JetBatteryAssignableEffect) => {
  const battery = getJetBatteryForEffect(state, effect);
  const consumedCharge = battery?.charge ?? 0;
  if (consumedCharge <= 0) return { state, consumedCharge: 0 };
  return {
    state: {
      ...state,
      jetBatteries: state.jetBatteries.map((entry) =>
        entry.effect === effect ? { ...entry, charge: 0 } : entry
      ),
    },
    consumedCharge,
  };
};

const getPrimeJetEfficiencyUnderflow = (state: GolfGameState, effect: PlayerHandSlot['effect']) => {
  const baseCost = getAbilityBaseCost(effect);
  if (baseCost === null) return 0;
  if (state.playerStock.name !== 'Jet' || !state.jetEfficiencyDiscountReady) return 0;
  return Math.max(0, JET_EFFICIENCY_DISCOUNT - baseCost);
};

const createFreeEnergyCard = (value: number): CardType => ({
  id: `free-energy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  rank: Math.min(13, Math.max(1, value)),
  suit: '♣',
  element: 'N',
  name: 'FREE ENERGY',
});

const createRngWildcardCard = () => ({
  id: `rng-wildcard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  rank: 1,
  suit: '♠' as const,
  element: 'N' as const,
  name: 'LONG REST WILD',
});

const storeFreeEnergyInHand = (state: GolfGameState, value: number) => {
  if (value <= 0) return state;
  const freeEnergyCard = createFreeEnergyCard(value);
  if (state.playerCapturedRight === null) {
    return {
      ...state,
      playerCapturedRight: freeEnergyCard,
    };
  }
  if (state.playerCapturedLeft === null) {
    return {
      ...state,
      playerCapturedLeft: freeEnergyCard,
    };
  }
  return {
    ...state,
    playerCapturedRight: freeEnergyCard,
  };
};

const advancePrimeJetEfficiency = (state: GolfGameState, effect: PlayerHandSlot['effect']) => {
  if (state.playerStock.name !== 'Jet' || effect === null || getAbilityBaseCost(effect) === null) return state;
  if (state.jetEfficiencyDiscountReady) {
    return {
      ...state,
      jetAbilityCardsPlayed: 1,
      jetEfficiencyDiscountReady: false,
    };
  }
  const nextCount = state.jetAbilityCardsPlayed + 1;
  if (nextCount >= JET_EFFICIENCY_TRIGGER) {
    return {
      ...state,
      jetAbilityCardsPlayed: 0,
      jetEfficiencyDiscountReady: true,
    };
  }
  return {
    ...state,
    jetAbilityCardsPlayed: nextCount,
  };
};

const resolvePrimeJetAbilityAftermath = (state: GolfGameState, effect: PlayerHandSlot['effect']) => {
  const underflow = getPrimeJetEfficiencyUnderflow(state, effect);
  const advanced = advancePrimeJetEfficiency(state, effect);
  return underflow > 0 ? storeFreeEnergyInHand(advanced, underflow) : advanced;
};

const advanceJetEfficiencyFromTableauPlay = (state: GolfGameState) => {
  if (state.playerStock.name !== 'Jet') return state;
  const nextCount = state.jetAbilityCardsPlayed + 1;
  if (nextCount < 3) {
    return {
      ...state,
      jetAbilityCardsPlayed: nextCount,
    };
  }
  return {
    ...routeJetChargeToBatteries(state, 1),
    jetAbilityCardsPlayed: 0,
  };
};

const actorKeyFromName = (name: string) => name.trim().toLowerCase();

const getEnemyProfile = (enemyProfileId: string) =>
  BIOME_ONE_ENEMIES.find((profile) => profile.actor.id === enemyProfileId) ?? BIOME_ONE_ENEMIES[0];

const pickEnemyProfile = () => BIOME_ONE_ENEMIES[Math.floor(Math.random() * BIOME_ONE_ENEMIES.length)];

const getBiomeEnemyPool = (biomeId: string) => {
  if (biomeId === GOLF_DEFAULT_BIOME_ID) return BIOME_ONE_ENEMIES;
  return BIOME_ONE_ENEMIES;
};

const pickEnemyProfileForBiome = (biomeId: string) => {
  const pool = getBiomeEnemyPool(biomeId);
  return pool[Math.floor(Math.random() * pool.length)] ?? BIOME_ONE_ENEMIES[0];
};

const createCombatant = (name: string): ActorCombatState => {
  if (name === 'Jet') return { hp: 18, hpMax: 18, armor: 1, defense: 0, defenseBuffAmount: 0, evasion: 7, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, staggerPressure: 0, forecastIntent: false };
  if (name === 'Banks') return { hp: 16, hpMax: 16, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 12, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, staggerPressure: 0, forecastIntent: false };
  if (name === 'Hero') return { hp: 20, hpMax: 20, armor: 2, defense: 1, defenseBuffAmount: 0, evasion: 4, evasionBuffAmount: 0, superArmorBulwark: 1, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, staggerPressure: 0, forecastIntent: false };
  if (name === 'Mochi') return { hp: 10, hpMax: 10, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 14, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, staggerPressure: 0, whiskersense: 0, momentum: 0, narrowEscape: 0, skittish: 0, forecastIntent: false };
  if (name === 'Pan') return { hp: 16, hpMax: 16, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 10, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 1, superArmorReactive: 0, elementalShields: { F: 1 }, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, staggerPressure: 0, forecastIntent: false };
  if (name === 'Whis') return { hp: 14, hpMax: 14, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 22, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 1, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 1, staggerPressure: 0, forecastIntent: false };
  return { hp: 12, hpMax: 12, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 0, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, staggerPressure: 0, forecastIntent: false };
};

const createInitialCombatants = (enemyProfile: EnemyProfile) => ({
  jet: createCombatant('Jet'),
  banks: createCombatant('Banks'),
  hero: createCombatant('Hero'),
  mochi: createCombatant('Mochi'),
  pan: createCombatant('Pan'),
  whis: createCombatant('Whis'),
  [actorKeyFromName(enemyProfile.actor.name)]: { ...enemyProfile.combatant, elementalShields: { ...enemyProfile.combatant.elementalShields } },
});

const cloneEnemyCombatant = (profile: EnemyProfile): ActorCombatState => ({
  ...profile.combatant,
  elementalShields: { ...profile.combatant.elementalShields },
});

const sumSuperArmor = (combatant: ActorCombatState) =>
  combatant.superArmorBulwark + combatant.superArmorWard + combatant.superArmorReactive;

const applyFlatDamageToCombatant = (combatant: ActorCombatState, damage: number): ActorCombatState => {
  if (damage <= 0) return combatant;
  const nextArmor = Math.max(0, combatant.armor - damage);
  const overflowDamage = Math.max(0, damage - combatant.armor);
  return {
    ...combatant,
    armor: nextArmor,
    hp: Math.max(0, combatant.hp - overflowDamage),
    consecutiveHitsTaken: combatant.consecutiveHitsTaken + (overflowDamage > 0 ? 1 : 0),
  };
};

const addStaggerPressure = (
  combatants: Record<string, ActorCombatState>,
  actorKey: string,
  amount: number
) => {
  if (amount <= 0 || !combatants[actorKey]) return combatants;
  return {
    ...combatants,
    [actorKey]: {
      ...combatants[actorKey],
      staggerPressure: Math.min(99, (combatants[actorKey].staggerPressure ?? 0) + amount),
    },
  };
};

const distributeArmorByNeed = (
  state: GolfGameState,
  totalArmor: number
) => {
  if (totalArmor <= 0) return state.combatants;
  const partyNames = state.starterPackBase.map((card) => card.name);
  const nextCombatants = { ...state.combatants };
  const allocations = new Map<string, number>();
  const sorted = partyNames
    .map((name) => {
      const key = actorKeyFromName(name);
      const combatant = nextCombatants[key];
      return {
        key,
        combatant,
        hpRatio: combatant ? combatant.hp / Math.max(1, combatant.hpMax) : 1,
        hpMax: combatant?.hpMax ?? 99,
      };
    })
    .filter((entry) => !!entry.combatant)
    .sort((a, b) => {
      if (a.hpRatio !== b.hpRatio) return a.hpRatio - b.hpRatio;
      if (a.hpMax !== b.hpMax) return a.hpMax - b.hpMax;
      return a.key.localeCompare(b.key);
    });
  if (sorted.length === 0) return state.combatants;
  const base = Math.floor(totalArmor / sorted.length);
  let remainder = totalArmor % sorted.length;
  sorted.forEach((entry, index) => {
    allocations.set(entry.key, base + (index < remainder ? 1 : 0));
  });
  allocations.forEach((amount, key) => {
    const combatant = nextCombatants[key];
    if (!combatant || amount <= 0) return;
    nextCombatants[key] = { ...combatant, armor: combatant.armor + amount };
  });
  return nextCombatants;
};

const getEnemyBiteCount = (state: GolfGameState, cardId: string) =>
  state.enemyBiteMarks[cardId] ?? 0;

// Open hook: future abilities may temporarily make buried tableau cards legal to grab.
const canAccessBuriedTableauCard = (
  _state: GolfGameState,
  _columnIndex: number,
  _card: CardType,
  _depthFromTop: number
) => false;

const getCombatVitals = (state: GolfGameState, card: CardType) => {
  const combatant = state.combatants[actorKeyFromName(card.name)] ?? createCombatant(card.name);
  const isPlayerPrime = card.id === state.playerStock.id;
  const isEnemyPrime = card.id === state.enemyStock.id;
  const lowHpAccent = combatant.hpMax > 0 && combatant.hp / combatant.hpMax <= 0.2 ? '#ff5a5a' : undefined;
  const actorAccent =
    card.name === 'Shade Wisp'
      ? '#b9bcc4'
      : lowHpAccent;
  const apCount = isPlayerPrime
    ? state.playerStockActionPoints
    : isEnemyPrime
      ? state.enemyStockActionPoints
      : undefined;
  const apMax = isPlayerPrime || isEnemyPrime
    ? getActorApCap(card.name)
    : undefined;
  return {
    hp: combatant.hp,
    hpMax: combatant.hpMax,
    armor: combatant.armor,
    superArmor: sumSuperArmor(combatant),
    minimalVitalsOnly: true,
    name: '',
    accentColor: actorAccent,
    apCount,
    apMax,
  };
};

const isJetChargedCard = (state: GolfGameState, cardId: string) =>
  state.jetChargedCardIds.includes(cardId);

type ActorStatusEntry = {
  key: string;
  label: string;
  tone: 'buff' | 'debuff' | 'tempo' | 'special';
  priority: number;
  stacks?: number;
  duration?: number | null;
  title: string;
  flavorText?: string;
  effectText?: string;
};

const getActorStatusEntries = (combatant: ActorCombatState): ActorStatusEntry[] => {
  const entries: ActorStatusEntry[] = [];
  const narrowEscapeEffect = getKinEffectDefinition('Narrow Escape');
  const skittishEffect = getKinEffectDefinition('Skittish');
  const whiskersenseEffect = getKinEffectDefinition('Whiskersense');
  const momentumEffect = getKinEffectDefinition('Momentum');

  if (combatant.doomCounter !== null) {
    entries.push({
      key: 'doom',
      label: 'DM',
      tone: 'special',
      priority: 100,
      duration: combatant.doomCounter,
      title: `Defeated in ${combatant.doomCounter} ticks.`,
    });
  }
  if (combatant.counterWindow > 0) {
    entries.push({
      key: 'counter',
      label: 'CT',
      tone: 'special',
      priority: 95,
      duration: combatant.counterWindow,
      stacks: combatant.counterDamage,
      title: `Next outgoing hit gains +${combatant.counterDamage} damage.`,
    });
  }
  if (combatant.slow > 0) {
    entries.push({
      key: 'slow',
      label: 'SL',
      tone: 'tempo',
      priority: 90,
      duration: combatant.slow,
      title: `Reduced evasion and harmful effects tick faster for ${combatant.slow} more ticks.`,
    });
  }
  if ((combatant.narrowEscape ?? 0) > 0 && narrowEscapeEffect) {
    entries.push({
      key: 'narrow-escape',
      label: narrowEscapeEffect.label,
      tone: narrowEscapeEffect.tone,
      priority: 88,
      title: 'Narrow Escape',
      flavorText: narrowEscapeEffect.flavorText,
      effectText: narrowEscapeEffect.effectText,
    });
  }
  if ((combatant.skittish ?? 0) > 0 && skittishEffect) {
    entries.push({
      key: 'skittish',
      label: skittishEffect.label,
      tone: skittishEffect.tone,
      priority: 87,
      duration: combatant.skittish,
      title: 'Skittish',
      flavorText: skittishEffect.flavorText,
      effectText: `Cannot swap to prime for ${combatant.skittish} more actions.`,
    });
  }
  if ((combatant.whiskersense ?? 0) > 0 && whiskersenseEffect) {
    entries.push({
      key: 'whiskersense',
      label: whiskersenseEffect.label,
      tone: whiskersenseEffect.tone,
      priority: 86,
      stacks: combatant.whiskersense,
      title: 'Whiskersense',
      flavorText: whiskersenseEffect.flavorText,
      effectText: whiskersenseEffect.effectText,
    });
  }
  if ((combatant.momentum ?? 0) > 0 && momentumEffect) {
    entries.push({
      key: 'momentum',
      label: momentumEffect.label,
      tone: momentumEffect.tone,
      priority: 85,
      stacks: combatant.momentum,
      title: 'Momentum',
      flavorText: momentumEffect.flavorText,
      effectText: `Momentum adds ${combatant.momentum} bonus poke pressure. It loses 1 stack per turn.`,
    });
  }
  if (combatant.haste > 0) {
    entries.push({
      key: 'haste',
      label: 'HS',
      tone: 'tempo',
      priority: 85,
      duration: combatant.haste,
      title: `Increased evasion and beneficial effects tick faster for ${combatant.haste} more ticks.`,
    });
  }
  if (combatant.burn > 0) {
    entries.push({
      key: 'burn',
      label: 'BR',
      tone: 'debuff',
      priority: 80,
      stacks: combatant.burn,
      title: `Takes ${combatant.burn} damage each harmful tick.`,
    });
  }
  (Object.entries(combatant.elementalShields) as Array<[Element, number | undefined]>).forEach(([element, amount]) => {
    if (!amount || amount <= 0) return;
    entries.push({
      key: `shield-${element}`,
      label: `${element}S`,
      tone: 'buff',
      priority: 72,
      stacks: amount,
      title: `Negates matching elemental damage ${amount} more time${amount === 1 ? '' : 's'}.`,
    });
  });
  if (combatant.defenseBuffTurns > 0 && combatant.defenseBuffAmount > 0) {
    entries.push({
      key: 'defense-up',
      label: 'DF',
      tone: 'buff',
      priority: 60,
      stacks: combatant.defenseBuffAmount,
      duration: combatant.defenseBuffTurns,
      title: `+${combatant.defenseBuffAmount} defense for ${combatant.defenseBuffTurns} more beneficial tick${combatant.defenseBuffTurns === 1 ? '' : 's'}.`,
    });
  }

  return entries.sort((a, b) => b.priority - a.priority);
};

const STATUS_TONE_STYLES: Record<ActorStatusEntry['tone'], { border: string; bg: string; text: string; glow: string }> = {
  buff: {
    border: 'rgba(127,219,202,0.8)',
    bg: 'linear-gradient(180deg, rgba(8,24,22,0.96), rgba(4,10,10,0.94))',
    text: '#d9fff8',
    glow: '0 0 12px rgba(127,219,202,0.18)',
  },
  debuff: {
    border: 'rgba(255,124,90,0.82)',
    bg: 'linear-gradient(180deg, rgba(30,10,6,0.96), rgba(14,6,4,0.94))',
    text: '#ffe3d8',
    glow: '0 0 12px rgba(255,124,90,0.18)',
  },
  tempo: {
    border: 'rgba(141,196,255,0.82)',
    bg: 'linear-gradient(180deg, rgba(8,14,28,0.96), rgba(4,7,14,0.94))',
    text: '#e4f1ff',
    glow: '0 0 12px rgba(141,196,255,0.18)',
  },
  special: {
    border: 'rgba(247,210,75,0.82)',
    bg: 'linear-gradient(180deg, rgba(26,18,6,0.96), rgba(12,8,4,0.94))',
    text: '#fff3c0',
    glow: '0 0 12px rgba(247,210,75,0.2)',
  },
};

const getActorBackdropStyle = (actorName: string) => {
  if (actorName === 'Jet') {
    return {
      border: 'rgba(230,179,30,0.34)',
      bg: 'linear-gradient(180deg, rgba(84,60,12,0.22), rgba(14,10,3,0.1))',
      glow: '0 0 18px rgba(230,179,30,0.16)',
    };
  }
  if (actorName === 'Hero') {
    return {
      border: 'rgba(205,211,220,0.30)',
      bg: 'linear-gradient(180deg, rgba(74,82,92,0.22), rgba(12,14,18,0.1))',
      glow: '0 0 18px rgba(205,211,220,0.12)',
    };
  }
  if (actorName === 'Pan') {
    return {
      border: 'rgba(214,84,255,0.30)',
      bg: 'linear-gradient(180deg, rgba(96,26,98,0.22), rgba(22,6,22,0.1))',
      glow: '0 0 18px rgba(214,84,255,0.14)',
    };
  }
  if (actorName === 'Whis') {
    return {
      border: 'rgba(127,219,202,0.30)',
      bg: 'linear-gradient(180deg, rgba(20,84,90,0.22), rgba(5,20,20,0.1))',
      glow: '0 0 18px rgba(127,219,202,0.14)',
    };
  }
  if (actorName === 'Ember Mite') {
    return {
      border: 'rgba(255,124,90,0.30)',
      bg: 'linear-gradient(180deg, rgba(98,28,14,0.22), rgba(20,6,4,0.1))',
      glow: '0 0 18px rgba(255,124,90,0.14)',
    };
  }
  if (actorName === 'Dust Skipper') {
    return {
      border: 'rgba(204,173,110,0.30)',
      bg: 'linear-gradient(180deg, rgba(92,70,26,0.22), rgba(20,14,6,0.1))',
      glow: '0 0 18px rgba(204,173,110,0.14)',
    };
  }
  if (actorName === 'Mist Wisp') {
    return {
      border: 'rgba(141,196,255,0.30)',
      bg: 'linear-gradient(180deg, rgba(36,60,112,0.24), rgba(8,14,28,0.1))',
      glow: '0 0 18px rgba(141,196,255,0.15)',
    };
  }
  if (actorName === 'Thorn Drone') {
    return {
      border: 'rgba(175,223,134,0.30)',
      bg: 'linear-gradient(180deg, rgba(52,88,18,0.24), rgba(10,18,4,0.1))',
      glow: '0 0 18px rgba(175,223,134,0.14)',
    };
  }
  if (actorName === 'Thorn Matron') {
    return {
      border: 'rgba(175,223,134,0.34)',
      bg: 'linear-gradient(180deg, rgba(52,88,18,0.28), rgba(10,18,4,0.12))',
      glow: '0 0 18px rgba(175,223,134,0.16)',
    };
  }
  if (actorName === 'Shade Wisp') {
    return {
      border: 'rgba(196,198,205,0.34)',
      bg: 'linear-gradient(180deg, rgba(72,76,84,0.26), rgba(10,11,14,0.12))',
      glow: '0 0 18px rgba(214,218,228,0.12)',
    };
  }
  return {
    border: 'rgba(255,255,255,0.18)',
    bg: 'linear-gradient(180deg, rgba(36,36,36,0.18), rgba(10,10,10,0.08))',
    glow: '0 0 14px rgba(255,255,255,0.08)',
  };
};

const isNegativeStatusEntry = (status: ActorStatusEntry) =>
  status.key === 'doom' || status.key === 'slow' || status.key === 'burn' || status.tone === 'debuff';

function EnemyActionPreviewCard({
  title,
  detail,
  targetLabel,
  hostile = false,
}: {
  title: string;
  detail: string;
  targetLabel: string;
  hostile?: boolean;
}) {
  return (
    <div
      className="flex flex-col rounded-[18px] border px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
      style={{
        minHeight: 132,
        width: 126,
        borderColor: hostile ? 'rgba(255,82,82,0.34)' : 'rgba(255,255,255,0.14)',
        background: hostile ? 'rgba(19,6,8,0.94)' : 'rgba(8,9,12,0.92)',
        boxShadow: hostile
          ? '0 0 22px rgba(255,72,72,0.14), 0 12px 30px rgba(0,0,0,0.28)'
          : '0 12px 30px rgba(0,0,0,0.28)',
      }}
    >
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${hostile ? 'text-[#ffc7c7]' : 'text-white/84'}`}>
        {title}
      </div>
      <div className="mt-3 text-[12px] font-semibold leading-4 text-white/90">
        {detail}
      </div>
      <div className="mt-auto self-start rounded-full border border-white/12 bg-black/55 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/78">
        {targetLabel}
      </div>
    </div>
  );
}

function LayoutPlaceholder({
  title,
  width,
  height,
  subtitle,
}: {
  title: string;
  width: number;
  height: number;
  subtitle?: string;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-black/20"
      style={{ width, height }}
    >
      <div className="px-4 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/34">{title}</div>
        {subtitle ? (
          <div className="mt-2 text-[10px] leading-4 text-white/20">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

const ActorStatusRail = ({
  actorName,
  combatant,
  maxVisible,
  iconSize,
  compact = false,
  highlightedKeys = [],
  flashVersions = {},
  transientStatuses = [],
}: {
  actorName: string;
  combatant: ActorCombatState;
  maxVisible: number;
  iconSize: number;
  compact?: boolean;
  highlightedKeys?: string[];
  flashVersions?: Record<string, number>;
  transientStatuses?: Array<{ key: string; label: string; tone: 'buff' | 'debuff' }>;
}) => {
  const statuses = getActorStatusEntries(combatant);
  if (statuses.length === 0) return null;

  const backdrop = getActorBackdropStyle(actorName);
  const negativeStatuses = statuses.filter((status) => isNegativeStatusEntry(status));
  const positiveStatuses = statuses.filter((status) => !isNegativeStatusEntry(status));
  const visibleNegative = negativeStatuses.slice(0, maxVisible);
  const visiblePositive = positiveStatuses.slice(0, maxVisible);
  const negativeOverflow = Math.max(0, negativeStatuses.length - visibleNegative.length);
  const positiveOverflow = Math.max(0, positiveStatuses.length - visiblePositive.length);
  const badgeFontSize = Math.max(8, Math.round(iconSize * 0.38));
  const labelFontSize = Math.max(8, Math.round(iconSize * 0.46));
  const chipOffset = Math.max(9, Math.round(iconSize * 0.34));
  const drawerWidth = iconSize + 10;
  const tileSize = drawerWidth;
  const renderStatusTooltip = (status: ActorStatusEntry) => (
    <div className="min-w-[180px] max-w-[240px] rounded-2xl border border-white/12 bg-black/92 px-3 py-2 text-left shadow-[0_12px_40px_rgba(0,0,0,0.42)]">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/90">
        {status.title || status.key.replace(/^shield-/, '').replace(/-/g, ' ')}
      </div>
      {status.flavorText ? (
        <div className="mt-1 text-[11px] leading-[1.4] text-white/72">
          {renderGameText(status.flavorText)}
        </div>
      ) : null}
      {status.effectText ? (
        <div className="mt-1 text-[11px] leading-[1.4] text-white/84">
          {renderGameText(status.effectText)}
        </div>
      ) : !status.flavorText ? (
        <div className="mt-1 text-[11px] leading-[1.4] text-white/72">
          {status.title}
        </div>
      ) : null}
      {typeof status.duration === 'number' && status.duration > 0 ? (
        <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.08em] text-white/55">
          Duration: {status.duration}
        </div>
      ) : null}
      {typeof status.stacks === 'number' && status.stacks > 0 ? (
        <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-white/55">
          Stacks: {status.stacks}
        </div>
      ) : null}
    </div>
  );

  const renderStatusChip = (
    status: Pick<ActorStatusEntry, 'key' | 'label' | 'tone' | 'duration' | 'stacks'>,
    options?: { transient?: boolean }
  ) => {
    const style = STATUS_TONE_STYLES[status.tone];
    const highlighted = highlightedKeys.includes(status.key);
    const flashVersion = flashVersions[`${actorName}:${status.key}`] ?? 0;
    const chip = (
      <div
        key={`${status.key}-${options?.transient ? 'transient' : flashVersion}`}
        className="relative flex items-center justify-center rounded-[6px] border font-black uppercase tracking-[0.04em]"
        style={{
          width: tileSize,
          height: tileSize,
          borderColor: style.border,
          background: style.bg,
          color: style.text,
          boxShadow: highlighted ? `0 0 18px ${style.border}, ${style.glow}` : style.glow,
          fontSize: labelFontSize,
          animation: options?.transient
            ? 'golf-status-falloff 0.72s ease-out forwards'
            : flashVersion > 0
              ? 'golf-status-trigger-flash 0.52s ease-out'
              : (highlighted ? 'golf-status-blink 0.78s ease-in-out 2' : undefined),
        }}
      >
        <span>{status.label}</span>
        {typeof status.duration === 'number' && status.duration > 0 ? (
          <div
            className="absolute flex items-center justify-center rounded-md border bg-black tabular-nums font-black"
            style={{
              top: -chipOffset * 0.48,
              left: -chipOffset * 0.44,
              minWidth: chipOffset + 6,
              height: chipOffset + 4,
              paddingInline: 4,
              borderColor: style.border,
              color: '#ffffff',
              boxShadow: `0 0 14px ${style.border}`,
              fontSize: badgeFontSize + 1,
            }}
          >
            {Math.min(99, status.duration)}
          </div>
        ) : null}
      {typeof status.stacks === 'number' && status.stacks >= 0 ? (
        <div
          className="absolute flex items-center justify-center rounded-md border bg-black tabular-nums font-black"
          style={{
              right: -chipOffset * 0.44,
              bottom: -chipOffset * 0.48,
              minWidth: chipOffset + 6,
              height: chipOffset + 4,
              paddingInline: 4,
              borderColor: style.border,
              color: '#ffffff',
              boxShadow: `0 0 14px ${style.border}`,
              fontSize: badgeFontSize + 1,
            }}
          >
            {Math.min(99, status.stacks)}
          </div>
        ) : null}
      </div>
    );
    return (
      <Tooltip key={`${status.key}-${options?.transient ? 'transient' : flashVersion}`} content={renderStatusTooltip(status)} pinnable>
        {chip}
      </Tooltip>
    );
  };

  return (
    <div className="absolute inset-y-0 left-0 right-0 z-30">
      {(visibleNegative.length > 0 || negativeOverflow > 0) ? (
        <div
          className="absolute top-1 flex flex-col items-center gap-2"
          style={{
            width: drawerWidth,
            left: `${compact ? -38 : -46}px`,
          }}
        >
          {visibleNegative.map(renderStatusChip)}
          {transientStatuses.filter((status) => status.tone === 'debuff').map((status) => renderStatusChip(status, { transient: true }))}
          {negativeOverflow > 0 ? (
            <div
              className="flex items-center justify-center rounded-full border border-white/24 bg-black/86 font-black text-white/90"
              style={{ width: tileSize, height: tileSize, fontSize: compact ? badgeFontSize : labelFontSize }}
              title={`${negativeOverflow} more harmful effect${negativeOverflow === 1 ? '' : 's'}.`}
            >
              +{negativeOverflow}
            </div>
          ) : null}
        </div>
      ) : null}
      {(visiblePositive.length > 0 || positiveOverflow > 0) ? (
        <div
          className="absolute top-1 flex flex-col items-center gap-2"
          style={{
            width: drawerWidth,
            right: `${compact ? -38 : -46}px`,
          }}
        >
          {visiblePositive.map(renderStatusChip)}
          {transientStatuses.filter((status) => status.tone === 'buff').map((status) => renderStatusChip(status, { transient: true }))}
          {positiveOverflow > 0 ? (
            <div
              className="flex items-center justify-center rounded-full border border-white/24 bg-black/86 font-black text-white/90"
              style={{ width: tileSize, height: tileSize, fontSize: compact ? badgeFontSize : labelFontSize }}
              title={`${positiveOverflow} more beneficial effect${positiveOverflow === 1 ? '' : 's'}.`}
            >
              +{positiveOverflow}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

let golfCardSequence = 100000;

const createRandomGolfCard = (): CardType => {
  const suitEntry = ELEMENTAL_SUITS[Math.floor(Math.random() * ELEMENTAL_SUITS.length)];
  const rank = Math.floor(Math.random() * 13) + 1;
  golfCardSequence += 1;
  return {
    id: `golf-live-${rank}-${golfCardSequence}`,
    rank,
    suit: suitEntry.suit,
    element: 'N',
    name: '',
  };
};

const refillClearedTableau = (tableau: CardType[][], columnIndex: number) => {
  if (tableau[columnIndex]?.length) {
    return { tableau, tableCleared: false };
  }
  return {
    tableau: tableau.map((column, idx) =>
      idx === columnIndex ? Array.from({ length: TABLEAU_ROWS }, () => createRandomGolfCard()) : column
    ),
    tableCleared: true,
  };
};

export const refillClearedTableauForState = (
  state: Pick<GolfGameState, 'tutorialSliceId' | 'scenarioId'>,
  tableau: CardType[][],
  columnIndex: number
) => {
  if (state.tutorialSliceId || state.scenarioId === 'rng') {
    return { tableau, tableCleared: false };
  }
  return refillClearedTableau(tableau, columnIndex);
};

const simulateTableauAfterTopPlay = (tableau: CardType[][], columnIndex: number) => {
  const nextTableau = tableau.map((column, idx) =>
    idx === columnIndex ? column.slice(0, -1) : column
  );
  return refillClearedTableau(nextTableau, columnIndex).tableau;
};

const simulateSwapBenchCard = (prev: GolfGameState, benchIndex: number) => {
  const benchCard = prev.playerBench[benchIndex];
  const isStandardTag = !!benchCard && canPlayOnStock(benchCard, prev.playerStock);
  if (
    !benchCard ||
    prev.playerTagLockCapturesRemaining > 0 ||
    benchCard.id === prev.playerBlockedReturnStockId ||
    (!isStandardTag && !prev.playerFreeTagAvailable)
  ) return prev;

  const nextBench = [...prev.playerBench];
  const nextBenchSequences = [...prev.playerBenchSequences];
  const previousPrimeStock = prev.playerStock;
  const nextPlayerStock = nextBench[benchIndex];
  nextBench[benchIndex] = prev.playerStock;
  const nextPlayerStockSequence = nextBenchSequences[benchIndex];
  nextBenchSequences[benchIndex] = prev.playerStockSequence;

  return {
    ...prev,
    playerStock: nextPlayerStock,
    playerBench: nextBench,
    playerStockSequence: nextPlayerStockSequence,
    // Team AP is shared across the whole active party, so swapping does not move AP.
    playerStockActionPoints: prev.playerStockActionPoints,
    playerBenchSequences: nextBenchSequences,
    playerFreeTagAvailable: isStandardTag ? prev.playerFreeTagAvailable : false,
    playerTagLockCapturesRemaining: 2,
    playerBlockedReturnStockId: previousPrimeStock.id,
  };
};

const getSupportBenchIndex = (state: GolfGameState) =>
  clampNumber(state.playerSupportIndex, 0, Math.max(0, state.playerBench.length - 1));

const getSupportBenchCard = (state: GolfGameState) =>
  state.playerBench[getSupportBenchIndex(state)] ?? null;

const getAssistBenchIndices = (state: GolfGameState) =>
  state.playerBench
    .map((_, index) => index)
    .filter((index) => index !== getSupportBenchIndex(state));

const getBenchRole = (state: GolfGameState, benchIndex: number): 'support' | 'assist' =>
  benchIndex === getSupportBenchIndex(state) ? 'support' : 'assist';

const getSupportAbilityEffect = (card: CardType | null): PlayerHandSlot['effect'] => {
  if (!card) return null;
  if (card.name === 'Pan') return 'paw-sperity';
  if (card.name === 'Whis') return 'slipstream';
  return null;
};

const getSupportAbilityCost = (card: CardType | null) => {
  if (!card) return 0;
  if (card.name === 'Pan') return 4;
  if (card.name === 'Whis') return 3;
  return 0;
};

const getSupportPassiveSummary = (card: CardType | null) => {
  if (!card) return 'No support bonus';
  if (card.name === 'Hero') return 'Guard Dog: Hero is being repositioned toward a pack-guardian role where he intercepts lethal pressure that would otherwise take down an ally.';
  if (card.name === 'Jet') return 'AP relay specialist. Lowers combo thresholds and pushes ally poke cadence or support throughput.';
  if (card.name === 'Pan') return 'Tableau smoothness and clear rewards.';
  if (card.name === 'Whis') return 'Prophecy support square: activates after Hero collects all four elements, then reveals the best 5-step route.';
  return 'No support bonus';
};

const getAssistPassiveSummary = (card: CardType | null) => {
  if (!card) return 'No assist bonus';
  if (card.name === 'Hero') return 'Pack relay: Hero is being reworked around Fetch as his signature and Guard Dog as his passive, so support Hero should still feel active even before he rotates in.';
  if (card.name === 'Jet') return 'Micro-Battery support: stock captures charge overflow AP, add +2 max AP, and overcharge Prime attacks at full charge.';
  if (card.name === 'Pan') return 'Tableau clears grant Jet bonus AP.';
  if (card.name === 'Whis') return 'Whis no longer acts as a stock; the square sits beside Hero and becomes a dedicated Navi trigger.';
  return 'No assist bonus';
};

const getJetInspectorSections = () => ({
  prime: [
    'Full combo and salvage engineer.',
    'Owns the most cognitively rich sequencing tools.',
    'Higher skill ceiling than the other variants.',
    'Free Energy turns Efficiency underflow into a zero-cost electric attack card in hand.',
  ],
  support: [
    'AP relay specialist.',
    'Lowers combo thresholds.',
    'Boosts ally poke cadence or support throughput.',
    'Less about stealing board cards directly, more about enabling the prime.',
  ],
  assist: [
    'Quarnyix Micro-Battery: stores up to 5 overflow AP; gains 1 AP whenever a card is added to Jet stock.',
    'Quarnyx Capacitor: Prime Kin gains +2 max AP.',
    'Overcharge: at max Micro-Battery AP, Prime attacks gain +1 electricity damage.',
    'Rewire: spend AP to shift legal tableau tops; rewired cards stay Charged until an ally cashes +1 AP or an enemy gets Zapped.',
  ],
});

const getKinInspectorNarrative = (card: CardType | null) => {
  if (!card) {
    return { title: 'KIN DOSSIER', summary: 'Inspector unavailable.', detail: null as string | null };
  }
  if (card.name === 'Jet') {
    return {
      title: 'JET VARIANTS',
      summary: 'Rogue, scoundrel, and engineer expression split across Prime, Support, and Assist roles.',
      detail: `${getJetInspectorSections().prime.join(' ')} ${getJetInspectorSections().support.join(' ')} ${getJetInspectorSections().assist.join(' ')}`,
    };
  }
  if (card.name === 'Hero') {
    return {
      title: 'HERO DOCTRINE',
      summary: 'Starter husky prime built around endurance, loyalty, and simple sequence extension, now paired with support-square allies.',
      detail: `${getSupportPassiveSummary(card)} ${getAssistPassiveSummary(card)}`,
    };
  }
  if (card.name === 'Pan') {
    return {
      title: 'PAN DOCTRINE',
      summary: 'Tableau smoothing, fortune pivots, and explosive clear rewards.',
      detail: `${getSupportPassiveSummary(card)} ${getAssistPassiveSummary(card)}`,
    };
  }
  if (card.name === 'Whis') {
    return {
      title: 'WHIS DOCTRINE',
      summary: 'Temporal support square that unlocks Prophecy once all four elements have been collected.',
      detail: `${getSupportPassiveSummary(card)} ${getAssistPassiveSummary(card)}`,
    };
  }
  return {
    title: `${card.name.toUpperCase()} DOSSIER`,
    summary: 'Inspector record available.',
    detail: null,
  };
};

const getDiscardCountsByActor = (entries: string[]) => {
  const counts: Record<string, number> = {};
  entries.forEach((entry) => {
    const separatorIndex = entry.indexOf('::');
    const actor = separatorIndex > 0 ? entry.slice(0, separatorIndex) : 'Shared';
    counts[actor] = (counts[actor] ?? 0) + 1;
  });
  return counts;
};

const getBenchAbilityCost = (card: CardType | null, role: 'support' | 'assist') => {
  if (!card) return 0;
  if (card.name === 'Hero') return role === 'support' ? 3 : 2;
  if (card.name === 'Mochi') return 3;
  if (card.name === 'Jet') return 5;
  if (card.name === 'Pan') return role === 'support' ? 4 : 3;
  if (card.name === 'Whis') return 2;
  return 0;
};

const awardBenchTempo = (prev: GolfGameState, tableCleared: boolean, targetStockId: string) => {
  const nextBenchActionPoints = [...prev.playerBenchActionPoints];
  if (targetStockId !== prev.playerStock.id) {
    return nextBenchActionPoints;
  }
  const supportIndex = getSupportBenchIndex(prev);
  nextBenchActionPoints[supportIndex] = Math.min(12, (nextBenchActionPoints[supportIndex] ?? 0) + 1);
  if (tableCleared) {
    getAssistBenchIndices(prev).forEach((assistIndex) => {
      nextBenchActionPoints[assistIndex] = Math.min(12, (nextBenchActionPoints[assistIndex] ?? 0) + 1);
    });
  }
  return nextBenchActionPoints;
};

const appendPrimeApSegment = (prev: GolfGameState, element: Element) =>
  [...prev.playerPrimeApSegments, element];

const hasAssistJet = (state: GolfGameState) =>
  getAssistBenchIndices(state).some((assistIndex) => state.playerBench[assistIndex]?.name === 'Jet');

const routePrimeApWithAssistJet = (prev: GolfGameState, gain: number) => {
  const activeRarity = prev.starterPackAbilityRarities[prev.activeStarterPackIndex] ?? 1;
  const clampPrimeAp = (value: number) => clampStarterPackApToCap(prev.playerStock.name, value, activeRarity);
  if (gain <= 0) {
    return {
      playerStockActionPoints: clampPrimeAp(prev.playerStockActionPoints),
      assistJetMicroBatteryAp: prev.assistJetMicroBatteryAp,
      jetState: prev,
    };
  }
  if (prev.playerStock.name === 'Jet') {
    const charged = routeJetChargeToBatteries(prev, gain);
    return {
      playerStockActionPoints: 0,
      assistJetMicroBatteryAp: charged.assistJetMicroBatteryAp,
      jetState: { ...charged, playerStockActionPoints: 0 },
    };
  }
  if (!hasAssistJet(prev)) {
    return {
      playerStockActionPoints: clampPrimeAp(prev.playerStockActionPoints + gain),
      assistJetMicroBatteryAp: prev.assistJetMicroBatteryAp,
      jetState: prev,
    };
  }
  const primeMaxAp = 12 + 2;
  const stockGain = Math.min(gain, Math.max(0, primeMaxAp - prev.playerStockActionPoints));
  const overflow = gain - stockGain;
  return {
    playerStockActionPoints: clampPrimeAp(prev.playerStockActionPoints + stockGain),
    assistJetMicroBatteryAp: Math.min(
      ASSIST_JET_MICRO_BATTERY_MAX,
      prev.assistJetMicroBatteryAp + overflow
    ),
    jetState: prev,
  };
};

const getPlayerTableClearApBonus = (prev: GolfGameState, tableCleared: boolean) => {
  if (!tableCleared) return 0;
  let bonus = 0;
  const supportCard = getSupportBenchCard(prev);
  if (supportCard?.name === 'Pan') bonus += 1;
  getAssistBenchIndices(prev).forEach((assistIndex) => {
    if (prev.playerBench[assistIndex]?.name === 'Pan') bonus += 1;
  });
  return bonus;
};

const applyPlayerProgressToTarget = (
  prev: GolfGameState,
  targetStockId: string,
  candidate: CardType,
  tableClearApBonus: number,
  nextBenchActionPoints: number[]
) => {
  const chargedBonus = isJetChargedCard(prev, candidate.id) ? 1 : 0;
  const nextJetChargedCardIds = chargedBonus > 0
    ? prev.jetChargedCardIds.filter((cardId) => cardId !== candidate.id)
    : prev.jetChargedCardIds;
  const nextEnemyBiteMarks = prev.enemyBiteMarks[candidate.id]
    ? Object.fromEntries(Object.entries(prev.enemyBiteMarks).filter(([cardId]) => cardId !== candidate.id))
    : prev.enemyBiteMarks;
  if (targetStockId === prev.playerStock.id) {
    const nextSequence = prev.playerStockSequence + 1;
    const routedAp = routePrimeApWithAssistJet(prev, 1 + tableClearApBonus + chargedBonus);
    return {
      nextState: {
        ...routedAp.jetState,
        playerStock: evolveIdentityCard(prev.playerStock, candidate),
        playerStockSequence: nextSequence,
        playerStockActionPoints: routedAp.playerStockActionPoints,
        playerPrimeApSegments: appendPrimeApSegment(prev, candidate.element),
        playerBenchActionPoints: nextBenchActionPoints,
        assistJetMicroBatteryAp: routedAp.assistJetMicroBatteryAp,
        jetChargedCardIds: nextJetChargedCardIds,
        enemyBiteMarks: nextEnemyBiteMarks,
        playerFreeTagAvailable: false,
        ...advancePlayerTagLock(prev),
      },
      sourceCard: prev.playerStock,
      sequence: nextSequence,
    };
  }

  const benchIndex = prev.playerBench.findIndex((card) => card.id === targetStockId);
  if (benchIndex < 0) {
    return {
      nextState: prev,
      sourceCard: prev.playerStock,
      sequence: prev.playerStockSequence,
    };
  }

  const nextBench = [...prev.playerBench];
  nextBench[benchIndex] = evolveIdentityCard(prev.playerBench[benchIndex], candidate);
  const nextBenchSequences = [...prev.playerBenchSequences];
  const nextSequence = (nextBenchSequences[benchIndex] ?? 0) + 1;
  nextBenchSequences[benchIndex] = nextSequence;
  const nextBenchAp = [...nextBenchActionPoints];
  nextBenchAp[benchIndex] = Math.min(12, (nextBenchAp[benchIndex] ?? 0) + 1 + tableClearApBonus + chargedBonus);

  return {
    nextState: {
      ...prev,
      playerBench: nextBench,
      playerBenchSequences: nextBenchSequences,
      playerBenchActionPoints: nextBenchAp,
      jetChargedCardIds: nextJetChargedCardIds,
      enemyBiteMarks: nextEnemyBiteMarks,
      playerFreeTagAvailable: false,
      ...advancePlayerTagLock(prev),
    },
    sourceCard: prev.playerBench[benchIndex],
    sequence: nextSequence,
  };
};

const simulateRotateSupport = (prev: GolfGameState, benchIndex: number) => {
  if (
    benchIndex < 0 ||
    benchIndex >= prev.playerBench.length ||
    benchIndex === getSupportBenchIndex(prev) ||
    prev.playerSupportRotateUsed
  ) return prev;
  return {
    ...prev,
    playerSupportIndex: benchIndex,
    playerSupportRotateUsed: true,
  };
};

const simulateUseSupportAbility = (prev: GolfGameState) => {
  const supportCard = getSupportBenchCard(prev);
  const supportAp = prev.playerStockActionPoints;
  const cost = getSupportAbilityCost(supportCard);
  if (!supportCard || prev.playerSupportActionUsed || supportAp < cost) return prev;
  const primeKey = actorKeyFromName(prev.playerStock.name);
  const primeCombatant = prev.combatants[primeKey];
  if (!primeCombatant) return prev;

  if (supportCard.name === 'Pan') {
    const routedAp = routePrimeApWithAssistJet(prev, 1);
    return {
      ...routedAp.jetState,
      tableau: rerollTableau(prev.tableau),
      playerSupportActionUsed: true,
      playerStockActionPoints: Math.max(0, routedAp.playerStockActionPoints - cost),
    };
  }

  if (supportCard.name === 'Whis') {
    return {
      ...prev,
      playerStockActionPoints: Math.max(0, prev.playerStockActionPoints - cost),
      playerSupportActionUsed: true,
      combatants: {
        ...prev.combatants,
        [primeKey]: {
          ...primeCombatant,
          haste: primeCombatant.haste + 1,
          evasion: primeCombatant.evasion + 16,
          evasionBuffAmount: primeCombatant.evasionBuffAmount + 16,
          evasionBuffTurns: Math.max(primeCombatant.evasionBuffTurns, 1),
          counterWindow: Math.max(primeCombatant.counterWindow, 2),
          forecastIntent: true,
        },
      },
    };
  }

  return prev;
};

const simulateUseBenchAbility = (prev: GolfGameState, benchIndex: number) => {
  const benchCard = prev.playerBench[benchIndex];
  if (!benchCard) return prev;
  const role = getBenchRole(prev, benchIndex);
  const cost = getBenchAbilityCost(benchCard, role);
  const availableAp = prev.playerStockActionPoints;
  if (availableAp < cost) return prev;
  const primeKey = actorKeyFromName(prev.playerStock.name);
  const primeCombatant = prev.combatants[primeKey];
  if (!primeCombatant) return prev;

  if (benchCard.name === 'Hero') {
    return prev;
  }

  if (benchCard.name === 'Jet') {
    // Assist Jet: Rewire will probably require balancing to restrict total number of rewire actions.
    // The current hook is intentionally minimal until bench-variant Jet has a distinct actor identity.
    return {
      ...prev,
      playerStockActionPoints: Math.max(0, prev.playerStockActionPoints - cost),
      assistJetRewireCooldown: 5,
    };
  }

  if (benchCard.name === 'Pan') {
    const routedAp = routePrimeApWithAssistJet(prev, 1);
    return {
      ...routedAp.jetState,
      tableau: rerollTableau(prev.tableau),
      playerStockActionPoints: Math.max(0, routedAp.playerStockActionPoints - cost),
      playerPrimeApSegments: appendPrimeApSegment(prev, benchCard.element),
    };
  }

  return {
    ...prev,
    playerStockActionPoints: Math.max(0, prev.playerStockActionPoints - cost),
  };
};

const applyEnemyTurnFormationPassives = (prev: GolfGameState) => {
  const primeKey = actorKeyFromName(prev.playerStock.name);
  const primeCombatant = prev.combatants[primeKey];
  if (!primeCombatant) return prev;
  let nextPrime = { ...primeCombatant };
  let changed = false;

  const supportCard = getSupportBenchCard(prev);
  if (supportCard?.name === 'Whis') {
    nextPrime.forecastIntent = true;
    changed = true;
  }

  getAssistBenchIndices(prev).forEach((assistIndex) => {
    const assistCard = prev.playerBench[assistIndex];
    if (assistCard?.name === 'Whis') {
      nextPrime.forecastIntent = true;
      changed = true;
    }
  });

  if (!changed) return prev;
  return {
    ...prev,
    combatants: {
      ...prev.combatants,
      [primeKey]: nextPrime,
    },
  };
};

const applyPostPlayerDodgeFormationEffects = (
  prev: GolfGameState,
  resolved: { combatants: Record<string, ActorCombatState>; damageDealt: number; dodged: boolean; superArmorTriggered: SuperArmorKind | null }
) => {
  if (!resolved.dodged) return resolved;
  const primeKey = actorKeyFromName(prev.playerStock.name);
  const primeCombatant = resolved.combatants[primeKey];
  if (!primeCombatant) return resolved;
  let nextPrime = { ...primeCombatant };
  let changed = false;

  if (prev.playerStock.name === 'Jet') {
    nextPrime.dodgeCounter = primeCombatant.dodgeCounter + 1;
    changed = true;
  }

  const supportCard = getSupportBenchCard(prev);
  if (supportCard?.name === 'Whis') {
    nextPrime.counterWindow = Math.max(nextPrime.counterWindow, 2);
    nextPrime.counterDamage = Math.max(nextPrime.counterDamage, primeCombatant.counterDamage + 1);
    changed = true;
  }
  getAssistBenchIndices(prev).forEach((assistIndex) => {
    if (prev.playerBench[assistIndex]?.name === 'Whis') {
      nextPrime.counterWindow = Math.max(nextPrime.counterWindow, 2);
      nextPrime.counterDamage = Math.max(nextPrime.counterDamage, primeCombatant.counterDamage + 1);
      changed = true;
    }
  });

  if (!changed) return resolved;
  return {
    ...resolved,
    combatants: {
      ...resolved.combatants,
      [primeKey]: nextPrime,
    },
  };
};

const applyJetPassiveSiphon = (
  prev: GolfGameState,
  resolved: { combatants: Record<string, ActorCombatState>; damageDealt: number; dodged: boolean; superArmorTriggered: SuperArmorKind | null }
) => {
  if (prev.playerStock.name !== 'Jet' || resolved.damageDealt <= 0 || prev.enemyStockActionPoints <= 0) return prev;
  const stealChance = Math.min(100, 15 + (prev.enemyStockActionPoints * 5));
  if (Math.random() * 100 >= stealChance) return prev;
  return routeJetChargeToBatteries({
    ...prev,
    enemyStockActionPoints: Math.max(0, prev.enemyStockActionPoints - 1),
  }, 1);
};

const applyPostEnemyHitFormationReactions = (
  prev: GolfGameState,
  resolved: { combatants: Record<string, ActorCombatState>; damageDealt: number; dodged: boolean; superArmorTriggered: SuperArmorKind | null }
) => {
  if (resolved.dodged || resolved.damageDealt <= 0) return { state: prev, resolved, guardDogTriggered: false, whiskersenseTriggered: false };
  if (prev.playerStock.name === 'Mochi' && (prev.combatants.mochi?.whiskersense ?? 0) > 0) {
    return {
      state: {
        ...prev,
        playerSupportReactiveUsed: false,
      },
      resolved: {
        ...resolved,
        dodged: true,
        damageDealt: 0,
        combatants: {
          ...resolved.combatants,
          mochi: {
            ...(prev.combatants.mochi ?? createCombatant('Mochi')),
            whiskersense: Math.max(0, (prev.combatants.mochi?.whiskersense ?? 0) - 1),
          },
        },
      },
      guardDogTriggered: false,
      whiskersenseTriggered: true,
    };
  }
  const supportCard = getSupportBenchCard(prev);
  if (supportCard?.name !== 'Hero') return { state: prev, resolved, guardDogTriggered: false, whiskersenseTriggered: false };

  const primeKey = actorKeyFromName(prev.playerStock.name);
  const primeCombatant = resolved.combatants[primeKey];
  const heroCombatant = resolved.combatants.hero ?? prev.combatants.hero;
  if (!primeCombatant || !heroCombatant || primeCombatant.hp > 0 || heroCombatant.hp <= 0) {
    return { state: prev, resolved, guardDogTriggered: false, whiskersenseTriggered: false };
  }

  const redirectedDamage = Math.max(1, resolved.damageDealt);
  const nextCombatants = {
    ...resolved.combatants,
    [primeKey]: {
      ...primeCombatant,
      hp: 1,
    },
    hero: applyFlatDamageToCombatant(heroCombatant, redirectedDamage),
  };

  return {
    state: {
      ...prev,
      playerSupportReactiveUsed: false,
    },
    resolved: {
      ...resolved,
      combatants: nextCombatants,
    },
    guardDogTriggered: true,
    whiskersenseTriggered: false,
  };
};

const simulateUseAbility = (prev: GolfGameState, effect: NonNullable<PlayerHandSlot['effect']>): GolfGameState => {
  if (effect === 'banks-strike') {
    if (prev.playerStock.name !== 'Banks') return prev;
    const tier = prev.starterPackAbilityRarities[prev.activeStarterPackIndex] ?? 1;
    const spentAp = Math.min(getBanksApCap(tier), prev.playerStockActionPoints);
    if (spentAp <= 0) return prev;
    const primeKey = actorKeyFromName(prev.playerStock.name);
    const enemyKey = actorKeyFromName(prev.enemyStock.name);
    const primeCombatant = prev.combatants[primeKey];
    if (!primeCombatant) return prev;
    const packet: DamagePacket = {
      physical: spentAp,
      elemental: {},
      deliberate: true,
      threshold: 1,
      source: 'player',
      sourceActor: primeKey,
      targetActor: enemyKey,
    };
    const prepared = applyCounterWindowToPacket(prev, packet);
    const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
    const resolvedPrimeCombatant = resolved.combatants[primeKey] ?? primeCombatant;
    const nextCombatants = spentAp >= 3
      ? {
          ...resolved.combatants,
          [primeKey]: {
            ...resolvedPrimeCombatant,
            evasion: resolvedPrimeCombatant.evasion + 100,
            evasionBuffAmount: resolvedPrimeCombatant.evasionBuffAmount + 100,
            evasionBuffTurns: Math.max(resolvedPrimeCombatant.evasionBuffTurns, 1),
          },
        }
      : resolved.combatants;
    const pressuredCombatants = addStaggerPressure(nextCombatants, enemyKey, resolved.damageDealt);
    const nextTier = spentAp === tier && tier < 3 ? ((tier + 1) as 1 | 2 | 3) : tier;
    return resolveEnemyDefeat({
      ...prev,
      combatants: pressuredCombatants,
      playerStockActionPoints: 0,
      playerPrimeApSegments: [],
      starterPackAbilityRarities: prev.starterPackAbilityRarities.map((value, index) => (
        index === prev.activeStarterPackIndex ? nextTier : value
      )),
      starterPackStoredAp: prev.starterPackStoredAp.map((value, index) => (
        index === prev.activeStarterPackIndex ? 0 : value
      )),
      starterPackModes: prev.starterPackModes.map((value, index) => (
        index === prev.activeStarterPackIndex
          ? (spentAp >= 3 ? 'banks-prowl' as StarterKinMode : 'default' as StarterKinMode)
          : value
      )),
    }, nextCombatants);
  }
  if (effect === 'paw-sperity') {
    if (prev.playerStock.name !== 'Pan' || prev.panPawSperityCooldown > 0) return prev;
    return {
      ...prev,
      tableau: rerollTableau(prev.tableau),
      panPawSperityCooldown: 14,
      playerFreeTagAvailable: true,
    };
  }
  if (effect === 'hero-guard') {
    const actorKey = actorKeyFromName(prev.playerStock.name);
    const combatant = prev.combatants[actorKey];
    if (!combatant || prev.playerStock.name !== 'Hero' || prev.playerStockActionPoints < HERO_GUARD_COST) return prev;
    return {
      ...prev,
      playerStockActionPoints: prev.playerStockActionPoints - HERO_GUARD_COST,
      heroGuardTauntTurns: Math.max(prev.heroGuardTauntTurns, HERO_GUARD_TAUNT_TURNS),
      combatants: {
        ...prev.combatants,
        [actorKey]: {
          ...combatant,
          armor: combatant.armor + HERO_GUARD_ARMOR,
        },
      },
    };
  }
  if (effect === 'ironfur') {
    const actorKey = actorKeyFromName(prev.playerStock.name);
    const combatant = prev.combatants[actorKey];
    if (!combatant || prev.playerStock.name !== 'Hero' || prev.playerStockActionPoints < 4) return prev;
    return {
      ...prev,
      playerStockActionPoints: prev.playerStockActionPoints - 4,
      combatants: {
        ...prev.combatants,
        [actorKey]: {
          ...combatant,
          defense: combatant.defense + 5,
          defenseBuffAmount: combatant.defenseBuffAmount + 5,
          defenseBuffTurns: 2,
        },
      },
    };
  }
  if (effect === 'tap-out') {
    if (prev.playerStockActionPoints < 3) return prev;
    const nextBenchActionPoints = prev.playerBenchActionPoints.map((value) => Math.min(12, (value ?? 0) + 2));
    return {
      ...prev,
      playerStockActionPoints: prev.playerStockActionPoints - 3,
      playerBenchActionPoints: nextBenchActionPoints,
      playerSupportActionUsed: false,
    };
  }
  if (effect === 'slipstream') {
    const actorKey = actorKeyFromName(prev.playerStock.name);
    const combatant = prev.combatants[actorKey];
    if (!combatant || prev.playerStock.name !== 'Whis' || prev.playerStockActionPoints < 4) return prev;
    return {
      ...prev,
      playerStockActionPoints: prev.playerStockActionPoints - 4,
      combatants: {
        ...prev.combatants,
        [actorKey]: {
          ...combatant,
          haste: combatant.haste + 1,
          evasion: combatant.evasion + 18,
          evasionBuffAmount: combatant.evasionBuffAmount + 18,
          evasionBuffTurns: 1,
        },
      },
    };
  }
  return prev;
};

const simulateUseAbilityWithStatus = (prev: GolfGameState, effect: NonNullable<PlayerHandSlot['effect']>) => {
  const nextState = simulateUseAbility(prev, effect);
  if (nextState === prev) {
    return { state: prev, statusEvent: null as StatusEffectEvent | null };
  }
  return applyPlayerActionStatusUpdate(nextState);
};

const createAbilitySlot = (
  slotId: PlayerHandSlot['slotId'],
  ability: StarterAbility
): PlayerHandSlot => ({
  slotId,
  kind: 'ability',
  name: ability.name,
  effect: ability.effect,
  card: null,
});

const addPrimeAttackBonuses = (state: GolfGameState, packet: DamagePacket) => {
  if (packet.source !== 'player' || packet.sourceActor !== actorKeyFromName(state.playerStock.name)) return packet;
  if (hasAssistJet(state) && state.assistJetMicroBatteryAp >= ASSIST_JET_MICRO_BATTERY_MAX) {
    return {
      ...packet,
      elemental: {
        ...packet.elemental,
        E: (packet.elemental.E ?? 0) + 1,
      },
    };
  }
  return packet;
};

const applyPrimeCompanionTriggers = (
  prev: GolfGameState,
  nextState: GolfGameState,
  sourceCard: CardType,
  options?: { tableCleared?: boolean }
) => {
  if (prev.playerStock.name !== 'Hero' || sourceCard.name !== 'Hero') return nextState;
  let updated: GolfGameState = {
    ...nextState,
    heroSuccessfulPlays: nextState.heroSuccessfulPlays + 1,
    heroStockAddsThisTurn: nextState.heroStockAddsThisTurn + 1,
  };
  if (!nextState.heroLeaderTriggeredThisTurn) {
    updated = {
      ...updated,
      heroLeaderTriggeredThisTurn: true,
      playerBenchActionPoints: updated.playerBenchActionPoints.map((value) => Math.min(12, (value ?? 0) + 1)),
    };
  }
  return updated;
};

const buildPokePacket = (sourceCard: CardType, targetCard: CardType, sequence: number, source: 'player' | 'enemy'): DamagePacket => {
  const poke = 1 + Math.floor(sequence / 4);
  return {
    physical: 0,
    elemental: { [sourceCard.element]: poke },
    deliberate: false,
    threshold: 5,
    source,
    sourceActor: actorKeyFromName(sourceCard.name),
    targetActor: actorKeyFromName(targetCard.name),
  };
};

const getKinInspectorSlots = (kinName: string, baseSlots: { left: PlayerHandSlot; right: PlayerHandSlot }) => {
  const signature: PlayerHandSlot[] = [];
  const tableauClear: PlayerHandSlot[] = [];
  const tools: PlayerHandSlot[] = [];
  const battle: PlayerHandSlot[] = [];
  const abilities = STARTER_ABILITIES[kinName] ?? [];
  abilities.forEach((ability, index) => {
    const slotId: PlayerHandSlot['slotId'] = index === 0 ? 'left' : index === 1 ? 'right' : 'pan-left';
    const slot =
      kinName === 'Jet' && ability.effect === 'repurpose'
        ? baseSlots.left
        : kinName === 'Jet' && ability.effect === 'sticky-paws'
          ? baseSlots.right
          : createAbilitySlot(slotId, ability);
    if (ability.category === 'signature') signature.push(slot);
    if (ability.category === 'tableau-clear') tableauClear.push(slot);
    if (ability.category === 'tool') tools.push(slot);
    if (ability.category === 'battle' || ability.category === 'passive') battle.push(slot);
  });

  return { signature, tableauClear, tools, battle };
};

const getPathOfStarsStepCount = (ap: number) => {
  if (ap < 10) return 0;
  if (ap < 13) return 5;
  if (ap < 16) return 6;
  if (ap < 19) return 7;
  if (ap < 23) return 8;
  if (ap < 28) return 9;
  return 10;
};

const rerollTableau = (tableau: CardType[][]) => {
  const counts = tableau.map((column) => column.length);
  const pool = shuffle(tableau.flat());
  let cursor = 0;
  return counts.map((count) => {
    const next = pool.slice(cursor, cursor + count);
    cursor += count;
    return next;
  });
};

const createBenchActorCard = (name: string, rank: number, seed: CardType): CardType => ({
  ...seed,
  id: `bench-actor-${name.toLowerCase()}`,
  name,
  rank,
});

const evolveIdentityCard = (identity: CardType, candidate: CardType): CardType => ({
  ...candidate,
  id: identity.id,
  name: identity.name,
});

const createEnemyWave = (
  biomeId: string,
  profile?: EnemyProfile,
  pairCount = 1
) => {
  const resolvedProfile = profile ?? pickEnemyProfileForBiome(biomeId);
  const prime = createEnemyStockCard(resolvedProfile.actor, pairCount > 1 ? 'A' : undefined);
  const bench = pairCount > 1 ? [createEnemyStockCard(resolvedProfile.actor, 'B')] : [];
  return {
    profile: resolvedProfile,
    prime,
    bench,
    benchProfileIds: bench.map(() => resolvedProfile.actor.id),
    combatants: {
      [actorKeyFromName(prime.name)]: cloneEnemyCombatant(resolvedProfile),
      ...Object.fromEntries(
        bench.map((card) => [actorKeyFromName(card.name), cloneEnemyCombatant(resolvedProfile)])
      ),
    } as Record<string, ActorCombatState>,
  };
};

const resolveEnemyDefeat = (
  prev: GolfGameState,
  combatants: Record<string, ActorCombatState>,
  moveLabel: string | null = null
): GolfGameState => {
  const enemyKey = actorKeyFromName(prev.enemyStock.name);
  const currentEnemyCombatant = combatants[enemyKey];
  if (!currentEnemyCombatant || currentEnemyCombatant.hp > 0) {
    return {
      ...prev,
      combatants,
    };
  }

  const nextDefeatedCount = prev.enemyDefeatedCount + 1;
  const nextCombatants = { ...combatants };
  delete nextCombatants[enemyKey];
  const lootRecovered = prev.enemyLootCards.length;
  const nextBankedPoints = prev.bankedPoints + lootRecovered;
  const nextPlayerDiscardPile = lootRecovered > 0
    ? [
        ...prev.playerDiscardPile,
        ...prev.enemyLootCards.map((card) => `Loot::Recovered ${rankLabel(card.rank)} from ${prev.enemyStock.name}`),
      ]
    : prev.playerDiscardPile;

  if (prev.tutorialSliceId) {
    return {
      ...prev,
      combatants: nextCombatants,
      enemyStockActionPoints: 0,
      enemyDefeatedCount: nextDefeatedCount,
      playerDiscardPile: nextPlayerDiscardPile,
      bankedPoints: nextBankedPoints,
      enemyLootCards: [],
      enemyBiteMarks: {},
      tutorialEnemyDefeated: true,
      enemyDefeatFx: {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: prev.enemyStock.name,
        moveLabel,
        lootRecovered,
      },
    };
  }

  if (prev.enemyBench.length > 0) {
    const promoted = prev.enemyBench[0];
    const promotedProfileId = prev.enemyBenchProfileIds[0] ?? prev.enemyProfileId;
    const remainingBench = prev.enemyBench.slice(1);
    const remainingBenchProfileIds = prev.enemyBenchProfileIds.slice(1);
    if (remainingBench.length === 0) {
      const replenishmentProfile = getEnemyProfile(promotedProfileId);
      const replenishment = createEnemyStockCard(replenishmentProfile.actor, String(nextDefeatedCount + 1));
      remainingBench.push(replenishment);
      remainingBenchProfileIds.push(promotedProfileId);
      nextCombatants[actorKeyFromName(replenishment.name)] = cloneEnemyCombatant(replenishmentProfile);
    }
    return {
      ...prev,
      enemyStock: promoted,
      enemyProfileId: promotedProfileId,
      enemyBench: remainingBench,
      enemyBenchProfileIds: remainingBenchProfileIds,
      enemyStockSequence: 0,
      enemyStockActionPoints: 0,
      combatants: nextCombatants,
      enemyDefeatedCount: nextDefeatedCount,
      playerDiscardPile: nextPlayerDiscardPile,
      bankedPoints: nextBankedPoints,
      enemyLootCards: [],
      enemyBiteMarks: {},
      enemyDefeatFx: {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: prev.enemyStock.name,
        moveLabel,
        lootRecovered,
      },
    };
  }

  const nextWave = createEnemyWave(prev.biomeId, undefined, nextDefeatedCount >= 1 ? 2 : 1);
  return {
    ...prev,
    enemyStock: nextWave.prime,
    enemyProfileId: nextWave.profile.actor.id,
    enemyBench: nextWave.bench,
    enemyBenchProfileIds: nextWave.benchProfileIds,
    enemyStockSequence: 0,
    enemyStockActionPoints: 0,
    combatants: {
      ...nextCombatants,
      ...nextWave.combatants,
    },
    enemyDefeatedCount: nextDefeatedCount,
    playerDiscardPile: nextPlayerDiscardPile,
    bankedPoints: nextBankedPoints,
    enemyLootCards: [],
    enemyBiteMarks: {},
    enemyDefeatFx: {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: prev.enemyStock.name,
      moveLabel,
      lootRecovered,
    },
  };
};

const NamedCardOverlay = ({
  card,
  sequenceCount,
  fallbackName = 'Bench',
  compact = false,
}: {
  card: CardType;
  sequenceCount?: number;
  fallbackName?: string;
  compact?: boolean;
}) => (
  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-between px-4 py-5">
    <div className={`absolute inset-x-0 flex justify-center ${compact ? 'top-2' : 'top-2'}`}>
      <div
        className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-black uppercase text-white/85`}
        style={{
          letterSpacing: compact ? '0.08em' : '0.14em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'clip',
          maxWidth: '100%',
        }}
      >
        {card.name || fallbackName}
      </div>
    </div>
    <div className={`absolute inset-x-0 flex justify-center ${compact ? 'top-[34px]' : 'top-[26px]'}`}>
      <div className={`${compact ? 'text-[16px]' : 'text-[20px]'} font-black leading-none text-white`}>
        {rankLabel(card.rank)}
      </div>
    </div>
    {typeof sequenceCount === 'number' ? (
      <div className="rounded-full border border-game-teal/30 bg-black/75 px-3 py-1 shadow-[0_0_18px_rgba(127,219,202,0.08)]">
        <div className="text-sm font-black leading-none text-white">{sequenceCount}</div>
      </div>
    ) : (
      <div />
    )}
  </div>
);

const StockCardNameplate = ({
  card,
  heuristicLabel,
  highlighted = false,
  withVitals = false,
}: {
  card: CardType;
  heuristicLabel?: string | null;
  highlighted?: boolean;
  withVitals?: boolean;
}) => {
  const label = card.name || '';
  const compact = label.length > 7;
  const nameTopClass = withVitals ? 'top-[58px]' : 'top-[46px]';
  const valueTopClass = withVitals ? 'top-[104px]' : 'top-[88px]';

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className={`absolute inset-x-0 ${nameTopClass} flex justify-center px-2`}>
        <div
          className={`font-black uppercase text-white/90 ${compact ? 'text-[10px]' : 'text-[12px]'}`}
          style={{
            letterSpacing: compact ? '0.08em' : '0.14em',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '84%',
            lineHeight: 1.05,
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          }}
        >
          {label}
        </div>
      </div>
      <div className={`absolute inset-x-0 flex justify-center ${valueTopClass}`}>
        <div className={`rounded-full border px-3 py-1 ${heuristicLabel ? 'text-[13px]' : 'text-[22px]'} font-black leading-none shadow-[0_0_14px_rgba(0,0,0,0.24)] ${
          highlighted
            ? 'border-game-gold/35 bg-black/76 text-game-gold'
            : 'border-white/12 bg-black/70 text-white'
        }`}>
          {heuristicLabel ?? rankLabel(card.rank)}
        </div>
      </div>
      {highlighted && (
        <div className="absolute right-2 bottom-3 text-[10px] font-black uppercase tracking-[0.12em] text-game-gold">
          Star
        </div>
      )}
    </div>
  );
};

const setupGame = (): GolfGameState => {
  const scenarioId = getGolfScenarioId();
  const isTutorialScenario = scenarioId === 'tutorial';
  const isRngScenario = scenarioId === 'rng';
  const starterPackBase = (isTutorialScenario || isRngScenario) ? createTutorialStarterPack(['Hero']) : createStarterPackCards();
  const enemyProfile = getEnemyProfile(isTutorialScenario ? GOLF_DEFAULT_ENEMY_PROFILE_ID : GOLF_DEFAULT_ENEMY_PROFILE_ID);
  const enemyPrime = createEnemyStockCard(enemyProfile.actor);
  const deck = createDeck();
  const tableau = isTutorialScenario
    ? createTutorialSlice01Tableau()
    : isRngScenario
      ? buildRngRescueTableau(true)
      : Array.from({ length: TABLEAU_COLUMNS }, () =>
          Array.from({ length: TABLEAU_ROWS }, () => drawCard(deck))
        );
  const benchSeed = drawCard(deck);
  const activeStarterPackIndex = 0;
  const starterPackStoredAp = isTutorialScenario ? [0] : starterPackBase.map(() => 0);
  const starterPackUsed = starterPackBase.map((_, index) => index === activeStarterPackIndex);
  const playerStockCard = createStarterPackStockCard(starterPackBase[activeStarterPackIndex], activeStarterPackIndex);

  return {
    biomeId: GOLF_DEFAULT_BIOME_ID,
    scenarioId,
    tutorialSliceId: isTutorialScenario ? 'slice-01' : null,
    tutorialEnemyDefeated: false,
    tutorialActionCount: 0,
    longRestCount: 0,
    tableau,
    starterPackBase,
    starterPackUsed,
    starterPackLocked: starterPackBase.map(() => false),
    starterPackStoredAp,
    starterPackAbilityRarities: starterPackBase.map(() => 1 as 1 | 2 | 3),
    starterPackModes: starterPackBase.map(() => 'default' as StarterKinMode),
    starterPackCashoutStats: starterPackBase.map(() => null),
    activeStarterPackIndex,
    playerStock: playerStockCard,
    playerBench: [
      createBenchActorCard('Whis', 8, benchSeed),
    ],
    playerSupportIndex: 0,
    playerHand: [],
    playerCapturedLeft: null,
    playerCapturedRight: null,
    enemyStock: enemyPrime,
    enemyProfileId: enemyProfile.actor.id,
    enemyBench: [],
    enemyBenchProfileIds: [],
    enemyStockActionPoints: 0,
    clearedCount: 0,
    playerStockSequence: 0,
    playerStockActionPoints: starterPackStoredAp[activeStarterPackIndex] ?? 0,
    playerPrimeApSegments: [],
    playerBenchSequences: [0],
    playerBenchActionPoints: [0],
    enemyStockSequence: 0,
    playerFreeTagAvailable: true,
    enemyFreeTagAvailable: true,
    playerTagLockCapturesRemaining: 0,
    playerBlockedReturnStockId: null,
    playerSupportActionUsed: false,
    playerSupportRotateUsed: false,
    playerSupportReactiveUsed: false,
    playerDiscardPile: [],
    stickyPawsCooldown: 0,
    panPawSperityCooldown: 0,
    batteryStoredActionPoints: 0,
    batteryMode: null,
    jetBatteries: [],
    jetBatteryPrimeArmed: false,
    jetBatteryAlternatorIndex: 0,
    jetDetonateBatteryUnlocked: false,
    jetAbilityCardsPlayed: 0,
    jetEfficiencyDiscountReady: false,
    riggedConstructCooldown: 0,
    riggedConstructCards: [],
    riggedConstructArmed: false,
    riggedConstructElement: null,
    riggedConstructCapacity: 0,
    jetRewireActionsRemaining: 0,
    jetRewireSourceColumnIndex: null,
    assistJetMicroBatteryAp: 0,
    assistJetRewireCooldown: 0,
    heroHeartsHeld: 0,
    heroEnduranceMax: HERO_BASE_ENDURANCE_MAX,
    heroSuccessfulPlays: 0,
    heroTurnsElapsed: 0,
    heroSecondWindCooldown: 0,
    heroStockAddsThisTurn: 0,
    heroLeaderTriggeredThisTurn: false,
    heroTrailSenseActive: false,
    heroGuardTauntTurns: 0,
    jetChargedCardIds: [],
    kinStickers: createStarterKinStickers(),
    hiddenStarterPackIndices: [],
    enemyPrimeViceGripTurns: 0,
    enemySupportStunnedTurns: 0,
    combatants: {
      ...createInitialCombatants(enemyProfile),
      [actorKeyFromName(enemyPrime.name)]: cloneEnemyCombatant(enemyProfile),
    },
    tableClears: 0,
    enemyDefeatedCount: 0,
    enemyDefeatFx: null,
    bankedPoints: 0,
    enemyRetaliationBonus: 0,
    enemyLootCards: [],
    enemyBiteMarks: {},
  };
};

const buildTutorialSliceState = (
  sliceId: 'slice-01' | 'slice-02' | 'slice-03' | 'slice-04',
  prev?: GolfGameState
): GolfGameState => {
  const baseState = setupGame();
  const enemyProfileId =
    sliceId === 'slice-03'
      ? 'shade-wisp'
      : sliceId === 'slice-04'
        ? 'mawling-raider'
        : GOLF_DEFAULT_ENEMY_PROFILE_ID;
  const enemyProfile = getEnemyProfile(enemyProfileId);
  const enemyPrime = createEnemyStockCard(enemyProfile.actor);

  const starterPackBase =
    sliceId === 'slice-01'
      ? createTutorialStarterPack(['Hero'])
      : sliceId === 'slice-02'
        ? createTutorialStarterPack(['Mochi', 'Hero'])
        : sliceId === 'slice-03'
        ? createTutorialStarterPack(['Mochi', 'Hero'])
          : createTutorialStarterPack(['Mochi', 'Banks', 'Hero', 'Jet', 'Whis']);
  const activeStarterPackIndex =
    sliceId === 'slice-01' ? 0
      : sliceId === 'slice-02' ? 1
        : sliceId === 'slice-03' ? 1
          : 3;
  const starterPackStoredAp = [...TUTORIAL_SLICE_STARTING_AP[sliceId]];
  const tableau =
    sliceId === 'slice-01'
      ? createTutorialSlice01Tableau()
      : sliceId === 'slice-02'
        ? createTutorialSlice02Tableau()
        : sliceId === 'slice-03'
          ? createTutorialSlice03Tableau()
          : createTutorialSlice04Tableau();
  const combatants = {
    ...createInitialCombatants(enemyProfile),
    [actorKeyFromName(enemyPrime.name)]: cloneEnemyCombatant(enemyProfile),
  };
  const playerStock = createStarterPackStockCard(starterPackBase[activeStarterPackIndex], activeStarterPackIndex);
  const slice04ThreatenedCard = sliceId === 'slice-04'
    ? tableau[0]?.[tableau[0].length - 1] ?? null
    : null;
  const currentMochi = combatants.mochi;
  const currentBanks = combatants.banks;
  const currentJet = combatants.jet;
  const enemyKey = actorKeyFromName(enemyPrime.name);
  const tutorialLootCards = sliceId === 'slice-04'
    ? [createScenarioTableauCard(9, 0, 10, '♥')]
    : [];

  return {
    ...baseState,
    scenarioId: 'tutorial',
    tutorialSliceId: sliceId,
    tutorialEnemyDefeated: false,
    tutorialActionCount: 0,
    longRestCount: prev?.longRestCount ?? 0,
    tableau,
    starterPackBase,
    starterPackUsed: starterPackBase.map((_, index) => index === activeStarterPackIndex),
    starterPackLocked: starterPackBase.map(() => false),
    starterPackStoredAp,
    starterPackAbilityRarities: starterPackBase.map(() => 1 as 1 | 2 | 3),
    starterPackModes: starterPackBase.map(() => 'default' as StarterKinMode),
    starterPackCashoutStats: starterPackBase.map(() => null),
    activeStarterPackIndex,
    playerStock,
    playerStockActionPoints: starterPackStoredAp[activeStarterPackIndex] ?? 0,
    playerStockSequence: 0,
    playerPrimeApSegments: [],
    enemyStock: enemyPrime,
    enemyProfileId,
    enemyBench: [],
    enemyBenchProfileIds: [],
    enemyStockActionPoints: sliceId === 'slice-03' ? 2 : 0,
    enemyLootCards: tutorialLootCards,
    enemyBiteMarks: slice04ThreatenedCard ? { [slice04ThreatenedCard.id]: 2 } : {},
    combatants: {
      ...combatants,
      mochi: currentMochi
        ? {
            ...currentMochi,
            hp: sliceId === 'slice-01' ? currentMochi.hpMax : 1,
            hpMax: 10,
            haste: 0,
            narrowEscape: (sliceId === 'slice-02' || sliceId === 'slice-03') ? 1 : 0,
            skittish: sliceId === 'slice-02' ? 5 : 0,
          }
        : combatants.mochi,
      banks: currentBanks ? { ...currentBanks, hp: currentBanks.hpMax } : combatants.banks,
      jet: currentJet ? { ...currentJet, hp: currentJet.hpMax } : combatants.jet,
      hero: sliceId === 'slice-03'
        ? { ...combatants.hero, hp: combatants.hero.hpMax, armor: 0 }
        : combatants.hero,
      [enemyKey]: sliceId === 'slice-03'
        ? { ...combatants[enemyKey], hp: 2, hpMax: 2, armor: 0 }
        : sliceId === 'slice-04'
          ? { ...combatants[enemyKey], hp: 2, hpMax: 2, armor: 0 }
          : combatants[enemyKey],
    },
  };
};

export const buildTutorialSceneState = (sceneId: TutorialSceneId): GolfGameState => {
  if (sceneId === 'post-mochi') {
    const state = buildTutorialSliceState('slice-02');
    return {
      ...state,
      clearedCount: 13,
      playerStockActionPoints: TUTORIAL_SLICE_STARTING_AP['slice-02'][state.activeStarterPackIndex] ?? 2,
      playerStockSequence: 5,
      starterPackStoredAp: [...TUTORIAL_SLICE_STARTING_AP['slice-02']],
      hiddenStarterPackIndices: [0],
    };
  }
  if (sceneId === 'slice-02-ready') {
    const state = buildTutorialSliceState('slice-02');
    const heroEight = createScenarioTableauCard(8, 0, 8, '♠');
    return {
      ...state,
      tableau: createTutorialSlice02ReadyTableau(),
      clearedCount: 7,
      tutorialActionCount: 7,
      playerStock: evolveIdentityCard(createStarterPackStockCard(state.starterPackBase[1], 1), heroEight),
      playerStockActionPoints: 6,
      playerStockSequence: 7,
      starterPackStoredAp: [2, 6],
      activeStarterPackIndex: 1,
      starterPackUsed: state.starterPackBase.map((_, index) => index === 1),
      combatants: {
        ...state.combatants,
        mochi: state.combatants.mochi
          ? {
              ...state.combatants.mochi,
              hp: 1,
              hpMax: 10,
              narrowEscape: 1,
              skittish: 0,
            }
          : state.combatants.mochi,
      },
    };
  }
  if (sceneId === 'slice-02-deadlock') {
    const state = buildTutorialSliceState('slice-02');
    const heroEight = createScenarioTableauCard(10, 0, 8, '♠');
    const mochiKing = createScenarioTableauCard(11, 0, 13, '♦');
    return {
      ...state,
      tableau: createTutorialSlice02DeadlockTableau(),
      clearedCount: 11,
      tutorialActionCount: 11,
      starterPackBase: state.starterPackBase.map((card, index) =>
        index === 1 ? evolveIdentityCard(card, heroEight) : card
      ),
      playerStock: evolveIdentityCard(createStarterPackStockCard(state.starterPackBase[0], 0), mochiKing),
      playerStockActionPoints: getActorApCap('Mochi'),
      playerStockSequence: 4,
      playerPrimeApSegments: Array.from({ length: getActorApCap('Mochi') }, () => 'N' as Element),
      starterPackStoredAp: [getActorApCap('Mochi'), 6],
      activeStarterPackIndex: 0,
      starterPackUsed: state.starterPackBase.map((_, index) => index === 0),
      combatants: {
        ...state.combatants,
        mochi: state.combatants.mochi
          ? {
              ...state.combatants.mochi,
              hp: 1,
              hpMax: 10,
              narrowEscape: 1,
              skittish: 0,
            }
          : state.combatants.mochi,
      },
    };
  }
  if (sceneId === 'slice-03-combat') {
    const state = buildTutorialSliceState('slice-03');
    return {
      ...state,
      playerStock: evolveIdentityCard(createStarterPackStockCard(state.starterPackBase[1], 1), createScenarioTableauCard(10, 0, 8, '♠')),
      playerStockActionPoints: 2,
      playerStockSequence: 0,
      starterPackStoredAp: [2, 2],
      clearedCount: 11,
    };
  }
  return buildTutorialSliceState(sceneId);
};

const getTutorialSliceLabel = (sliceId: GolfGameState['tutorialSliceId']) => {
  if (sliceId === 'slice-01') return 'Slice 01 • Mochi Rescue';
  if (sliceId === 'slice-02') return 'Slice 02 • Pursuit Setup';
  if (sliceId === 'slice-03') return 'Slice 03 • First Guard';
  if (sliceId === 'slice-04') return 'Slice 04 • Rewire And Reclaim';
  return null;
};

const getTutorialForecastLabel = (state: GolfGameState) => {
  if (state.tutorialSliceId !== 'slice-03' || state.tutorialEnemyDefeated) return null;
  const mochiAvailable = state.starterPackBase.some((card) => card.name === 'Mochi');
  const mochiCombatant = state.combatants.mochi;
  if (!mochiAvailable || !mochiCombatant || mochiCombatant.hp > 1 || state.enemyStockActionPoints < 2) return null;
  return state.heroGuardTauntTurns > 0 ? 'Maul Forecast: Hero intercepts Mochi' : 'Maul Forecast: Mochi is in danger';
};

const isTutorialSlice02DeadlockState = (state: GolfGameState) =>
  state.tutorialSliceId === 'slice-02'
  && state.playerStock.name === 'Mochi'
  && state.playerStockActionPoints >= getActorApCap('Mochi')
  && getPlayableTableauColumnsForStock(state, state.playerStock).length === 0
  && getTutorialSelectableStarterPackIndices(state).size === 0;

const isTutorialSliceSolved = (state: GolfGameState) => {
  const hasPlayableTop = state.tableau.some((column) => {
    const topCard = column[column.length - 1] ?? null;
    return topCard ? isTutorialMochiRescuePlayable(state, topCard) || canPlayOnStock(topCard, state.playerStock) : false;
  });
  if (state.tutorialSliceId === 'slice-01') {
    return state.playerStock.name === 'Mochi';
  }
  if (state.tutorialSliceId === 'slice-02') {
    return false;
  }
  if (state.tutorialSliceId === 'slice-03') {
    return state.playerStock.name === 'Hero'
      && state.enemyStockActionPoints <= 0
      && (state.combatants.mochi?.hp ?? 0) > 0;
  }
  if (state.tutorialSliceId === 'slice-04') {
    const routeFinished = !hasPlayableTop && state.playerStock.name === 'Jet' && state.playerStock.rank >= 6;
    return routeFinished && state.tutorialEnemyDefeated;
  }
  return false;
};

const getTutorialSelectableStarterPackIndices = (state: GolfGameState) => {
  if (!state.tutorialSliceId) return new Set<number>();
  if (state.tutorialSliceId === 'slice-01') return new Set<number>();
  if (state.tutorialSliceId === 'slice-02') {
    const swapRailUnlocked = state.playerStock.name !== 'Hero' || state.playerStockSequence >= 5;
    if (!swapRailUnlocked) return new Set<number>();
    if (state.playerStock.name === 'Mochi') return new Set<number>();
    return new Set<number>(
      state.starterPackBase.flatMap((card, index) => {
        if (index === state.activeStarterPackIndex) return [];
        if (state.starterPackLocked[index]) return [];
        if (card.name === 'Mochi' && (state.combatants.mochi?.skittish ?? 0) > 0) return [];
        return canPlayOnStock(card, state.playerStock) ? [index] : [];
      })
    );
  }
  if (state.tutorialSliceId === 'slice-03') {
    if (state.playerStock.name === 'Hero') {
      const mochiIndex = state.starterPackBase.findIndex((card) => card.name === 'Mochi');
      const mochiStats = mochiIndex >= 0 ? state.starterPackCashoutStats[mochiIndex] : null;
      const canSwapToMochi = state.playerStockActionPoints >= 3
        && state.playerStockSequence >= 1
        && (mochiStats?.cardsStored ?? 0) < 2;
      return new Set(mochiIndex >= 0 && canSwapToMochi ? [mochiIndex] : []);
    }
    if (state.playerStock.name === 'Mochi') {
      const heroIndex = state.starterPackBase.findIndex((card) => card.name === 'Hero');
      const canSwapBackToHero = state.playerStockSequence >= 2;
      return new Set(heroIndex >= 0 && canSwapBackToHero ? [heroIndex] : []);
    }
    return new Set<number>();
  }
  if (state.tutorialSliceId === 'slice-04') {
    return new Set<number>();
  }
  return new Set<number>();
};

const canPlayOnStock = (candidate: CardType, target: CardType) => {
  if (isTutorialFillerCard(candidate)) return false;
  const diff = Math.abs(candidate.rank - target.rank);
  return diff === 1 || diff === 12;
};

const canPlayOnRank = (candidateRank: number, targetRank: number) => {
  if (candidateRank <= 0 || targetRank <= 0) return false;
  const diff = Math.abs(candidateRank - targetRank);
  return diff === 1 || diff === 12;
};

const isTutorialMochiRescuePlayable = (state: GolfGameState, candidate: CardType) =>
  state.tutorialSliceId === 'slice-01' &&
  candidate.name === 'Mochi' &&
  state.playerStock.rank === 1;

const isTutorialMochiRescueTokenCollectible = (state: GolfGameState, columnIndex: number, candidate: CardType | null) =>
  (
    state.tutorialSliceId === 'slice-01' &&
    state.tutorialActionCount >= 12 &&
    columnIndex === 1 &&
    candidate?.rank === 2
  ) || (
    state.scenarioId === 'rng' &&
    columnIndex === RNG_MOCHI_TARGET_COLUMN &&
    candidate?.name === 'Mochi'
  );

const isTutorialPursuitMarkerCard = (state: GolfGameState, columnIndex: number, buriedDepth: number) =>
  state.tutorialSliceId === 'slice-02' && columnIndex === 3 && buriedDepth >= 2;

const getShadeWispIntentCards = (state: GolfGameState, count: number) => (
  state.tableau
    .map((column, columnIndex) => ({
      columnIndex,
      card: column[column.length - 1] ?? null,
      centerBias: Math.abs(columnIndex - ((state.tableau.length - 1) / 2)),
    }))
    .filter((entry): entry is { columnIndex: number; card: CardType; centerBias: number } => !!entry.card)
    .sort((left, right) => {
      if (right.card.rank !== left.card.rank) return right.card.rank - left.card.rank;
      if (left.centerBias !== right.centerBias) return left.centerBias - right.centerBias;
      return left.columnIndex - right.columnIndex;
    })
    .slice(0, Math.max(0, count))
);

const getPlayableTableauColumnsForStock = (state: GolfGameState, stock: CardType) => (
  state.tableau.flatMap((column, columnIndex) => {
    const topCard = column[column.length - 1] ?? null;
    return topCard && canPlayOnStock(topCard, stock) ? [columnIndex] : [];
  })
);

const pickRngWildcardRank = (state: GolfGameState) => {
  const visibleRanks = state.tableau
    .map((column) => column[column.length - 1]?.rank ?? null)
    .filter((rank): rank is number => typeof rank === 'number' && rank > 0);
  const candidateRanks = new Set<number>();
  visibleRanks.forEach((rank) => {
    candidateRanks.add(rank === 13 ? 1 : rank + 1);
    candidateRanks.add(rank === 1 ? 13 : rank - 1);
  });
  if (candidateRanks.size === 0) {
    return state.playerStock.rank === 13 ? 1 : state.playerStock.rank + 1;
  }
  let bestRank = state.playerStock.rank === 13 ? 1 : state.playerStock.rank + 1;
  let bestScore = -1;
  for (const rank of candidateRanks) {
    const score = visibleRanks.filter((visibleRank) => canPlayOnRank(visibleRank, rank)).length;
    if (score > bestScore || (score === bestScore && rank < bestRank)) {
      bestRank = rank;
      bestScore = score;
    }
  }
  return bestRank;
};

const createTutorialSlice02ReadyTableau = (): CardType[][] =>
  popTutorialTableauPath(createTutorialSlice02Tableau(), TUTORIAL_SLICE_02_HERO_ROUTE);

const createTutorialSlice02DeadlockTableau = (): CardType[][] =>
  popTutorialTableauPath(createTutorialSlice02ReadyTableau(), TUTORIAL_SLICE_02_MOCHI_ROUTE);

const isTutorialSlice02PrimeLockActive = (state: GolfGameState) =>
  state.tutorialSliceId === 'slice-02' &&
  state.playerStock.name === 'Hero' &&
  state.playerStockSequence >= 5 &&
  !!state.starterPackBase.find((card) => card.name === 'Mochi') &&
  canPlayOnRank(9, state.playerStock.rank);

const getTutorialRailColumns = (state: GolfGameState): Set<number> | null => {
  if (state.tutorialSliceId === 'slice-01') {
    const rail = [0, 2, 4, 6, 5, 3, 1, 3, 5, 6, 4, 2];
    if (state.tutorialActionCount < rail.length) return new Set<number>([rail[state.tutorialActionCount]]);
    if (state.tutorialActionCount === rail.length) return new Set<number>([1]);
    return null;
  }
  if (state.tutorialSliceId === 'slice-02') {
    const rail = [...TUTORIAL_SLICE_02_HERO_ROUTE, ...TUTORIAL_SLICE_02_MOCHI_ROUTE];
    if (state.playerStock.name === 'Hero' && state.tutorialActionCount < TUTORIAL_SLICE_02_HERO_ROUTE.length) {
      return new Set<number>([rail[state.tutorialActionCount]]);
    }
    if (
      state.playerStock.name === 'Mochi'
      && state.tutorialActionCount >= TUTORIAL_SLICE_02_HERO_ROUTE.length
      && state.tutorialActionCount < rail.length
    ) {
      return new Set<number>([rail[state.tutorialActionCount]]);
    }
    return null;
  }
  if (state.tutorialSliceId === 'slice-03') {
    if (state.playerStock.name === 'Hero' && state.playerStockSequence === 0) return new Set<number>([0]);
    if (state.playerStock.name === 'Mochi' && state.playerStockSequence === 0) return new Set<number>([5]);
    if (state.playerStock.name === 'Mochi' && state.playerStockSequence === 1) return new Set<number>([6]);
    return null;
  }
  return null;
};

const isTutorialAbilityVisible = (
  state: Pick<GolfGameState, 'tutorialSliceId' | 'playerStock' | 'tutorialActionCount'>,
  effect: NonNullable<PlayerHandSlot['effect']>
) => {
  if (!state.tutorialSliceId) return true;
  if (state.tutorialSliceId === 'slice-01') return false;
  if (state.tutorialSliceId === 'slice-02') return false;
  if (state.tutorialSliceId === 'slice-03') {
    return effect === 'hero-guard'
      && state.playerStock.name === 'Hero'
      && state.tutorialActionCount >= 3;
  }
  return true;
};

const getTutorialVisibleAbilityEffects = (state: GolfGameState): Array<NonNullable<PlayerHandSlot['effect']>> => {
  const effects: Array<NonNullable<PlayerHandSlot['effect']>> = [];
  const maybePush = (effect: NonNullable<PlayerHandSlot['effect']>) => {
    if (isTutorialAbilityVisible(state, effect)) effects.push(effect);
  };
  if (state.playerStock.name === 'Hero' && state.playerStockActionPoints >= 2 && !!getBestFetchCandidate(state) && (state.playerCapturedLeft === null || state.playerCapturedRight === null)) {
    maybePush('fetch');
  }
  if (state.playerStock.name === 'Hero' && state.playerStockActionPoints >= HERO_GUARD_COST) {
    maybePush('hero-guard');
  }
  if (state.playerStock.name === 'Mochi') {
    if (state.tutorialSliceId !== 'slice-02') {
      const mochiCombatant = state.combatants.mochi;
      const rarity = state.starterPackAbilityRarities[state.activeStarterPackIndex] ?? 1;
      if (
        state.playerStockActionPoints >= 3
        && (mochiCombatant?.whiskersense ?? 0) > 0
        && findBestExclusionPath(state.tableau, nonCombatGlobalPeekCount, getZoomiesClaimCap(rarity)).length > 0
      ) {
        maybePush('tap-out');
      }
    }
  } else {
    const mochiIndex = getMochiStarterPackIndex(state);
    if (
      state.playerStockActionPoints >= 3
      && mochiIndex >= 0
      && mochiIndex !== state.activeStarterPackIndex
      && (state.combatants.mochi?.skittish ?? 0) <= 0
    ) {
      maybePush('tap-out');
    }
  }
  return effects;
};

export const getTutorialVisibleTopRanks = (state: GolfGameState) => (
  state.tableau.map((column) => {
    const topCard = column[column.length - 1] ?? null;
    return !topCard || isTutorialFillerCard(topCard) ? null : topCard.rank;
  })
);

export const getTutorialVisibleLegalActions = (state: GolfGameState): TutorialActionSpec[] => {
  const tableauActions = state.tableau.flatMap((column, columnIndex) => {
    const topCard = column[column.length - 1] ?? null;
    if (!topCard) return [];
    if (isTutorialMochiRescueTokenCollectible(state, columnIndex, topCard)) {
      return [{ kind: 'rescue' as const, columnIndex }];
    }
    return canPlayOnStock(topCard, state.playerStock)
      ? [{ kind: 'tableau' as const, columnIndex }]
      : [];
  });
  const swapActions = [...getTutorialSelectableStarterPackIndices(state)].map((starterPackIndex) => ({
    kind: 'swap' as const,
    starterPackIndex,
  }));
  const abilityActions = getTutorialVisibleAbilityEffects(state).map((effect) => ({
    kind: 'ability' as const,
    effect,
  }));
  return [...tableauActions, ...swapActions, ...abilityActions];
};

const simulateTutorialAuditTableauPlay = (state: GolfGameState, columnIndex: number): GolfGameState => {
  const candidate = state.tableau[columnIndex]?.[state.tableau[columnIndex].length - 1] ?? null;
  if (!candidate || !canPlayOnStock(candidate, state.playerStock)) return state;
  const nextTableau = state.tableau.map((column, index) => (index === columnIndex ? column.slice(0, -1) : [...column]));
  const nextState = {
    ...state,
    tableau: nextTableau,
    playerStock: evolveIdentityCard(state.playerStock, candidate),
    playerStockActionPoints: Math.min(getActorApCap(state.playerStock.name), state.playerStockActionPoints + 1),
    playerStockSequence: state.playerStockSequence + 1,
    clearedCount: state.clearedCount + 1,
  };
  return applyPlayerActionStatusUpdate(nextState).state;
};

const simulateTutorialAuditSwap = (state: GolfGameState, starterPackIndex: number): GolfGameState => {
  if (!getTutorialSelectableStarterPackIndices(state).has(starterPackIndex)) return state;
  return simulateStarterPackSwap(state, starterPackIndex, false);
};

const simulateStarterPackSwap = (state: GolfGameState, nextIndex: number, legalSwap: boolean): GolfGameState => {
  if (nextIndex < 0 || nextIndex >= state.starterPackBase.length) return state;
  if (nextIndex === state.activeStarterPackIndex || state.starterPackLocked[nextIndex]) return state;
  if (state.playerStock.name === 'Hero' && state.heroGuardTauntTurns > 0) return state;
  if (state.starterPackBase[nextIndex]?.name === 'Mochi' && (state.combatants.mochi?.skittish ?? 0) > 0) return state;
  const isLegalSwap = legalSwap && canPlayOnStock(state.starterPackBase[nextIndex], state.playerStock);
  if (legalSwap && !isLegalSwap) return state;
  const nextStoredAp = [...state.starterPackStoredAp];
  nextStoredAp[state.activeStarterPackIndex] = state.playerStockActionPoints;
  const currentPrimeStats = {
    cardsStored: state.playerStockSequence,
    uniqueElements: new Set(state.playerPrimeApSegments).size,
    actionPoints: state.playerStockActionPoints,
    apSegments: [...state.playerPrimeApSegments],
  };
  const nextPrimeStats = state.starterPackCashoutStats[nextIndex];
  const nextStarterPackBase = state.starterPackBase.map((card, index) =>
    index === state.activeStarterPackIndex ? evolveIdentityCard(card, state.playerStock) : card
  );
  return {
    ...state,
    starterPackBase: nextStarterPackBase,
    activeStarterPackIndex: nextIndex,
    starterPackStoredAp: nextStoredAp,
    starterPackCashoutStats: state.starterPackCashoutStats.map((entry, index) =>
      index === state.activeStarterPackIndex ? currentPrimeStats : entry
    ),
    playerStock: createStarterPackStockCard(nextStarterPackBase[nextIndex], nextIndex),
    playerStockSequence: nextPrimeStats?.cardsStored ?? 0,
    playerStockActionPoints: nextStoredAp[nextIndex] ?? nextPrimeStats?.actionPoints ?? 0,
    playerPrimeApSegments: nextPrimeStats?.apSegments ? [...nextPrimeStats.apSegments] : [],
    playerCapturedLeft: null,
    playerCapturedRight: null,
    playerSupportActionUsed: false,
    playerSupportRotateUsed: false,
    playerSupportReactiveUsed: false,
    heroStockAddsThisTurn: 0,
    heroLeaderTriggeredThisTurn: false,
    heroTrailSenseActive: false,
  };
};

export const simulateTutorialAuditAction = (state: GolfGameState, action: TutorialActionSpec): GolfGameState => {
  if (action.kind === 'tableau' || action.kind === 'rescue') {
    return simulateTutorialAuditTableauPlay(state, action.columnIndex);
  }
  if (action.kind === 'swap') {
    return simulateTutorialAuditSwap(state, action.starterPackIndex);
  }
  if (action.kind === 'end-turn') {
    return state;
  }
  return state;
};

const getTutorialStateSignature = (state: GolfGameState) => ({
  sliceId: state.tutorialSliceId,
  tutorialActionCount: state.tutorialActionCount,
  activeStarterPackIndex: state.activeStarterPackIndex,
  playerStockName: state.playerStock.name,
  playerStockRank: state.playerStock.rank,
  topRanks: getTutorialVisibleTopRanks(state),
  legalActions: getTutorialVisibleLegalActions(state).map(formatTutorialActionSpec),
});

const tutorialStateSignaturesEqual = (left: ReturnType<typeof getTutorialStateSignature>, right: ReturnType<typeof getTutorialStateSignature>) => (
  left.sliceId === right.sliceId
  && left.tutorialActionCount === right.tutorialActionCount
  && left.activeStarterPackIndex === right.activeStarterPackIndex
  && left.playerStockName === right.playerStockName
  && left.playerStockRank === right.playerStockRank
  && left.topRanks.length === right.topRanks.length
  && left.topRanks.every((value, index) => value === right.topRanks[index])
  && left.legalActions.length === right.legalActions.length
  && left.legalActions.every((value, index) => value === right.legalActions[index])
);

const inferTutorialRouteCursor = (state: GolfGameState) => {
  if (!state.tutorialSliceId) return null;
  const targetSignature = getTutorialStateSignature(state);
  const candidateRoutes = getTutorialRouteSeedsForSlice(state.tutorialSliceId);
  for (const route of candidateRoutes) {
    let currentState = buildTutorialSceneState(getTutorialSceneSeed(route.seedId).sceneId);
    if (tutorialStateSignaturesEqual(getTutorialStateSignature(currentState), targetSignature)) {
      return { route, nextIndex: 0 };
    }
    for (let stepIndex = 0; stepIndex < route.expectedActions.length; stepIndex += 1) {
      currentState = simulateTutorialAuditAction(currentState, route.expectedActions[stepIndex]);
      if (tutorialStateSignaturesEqual(getTutorialStateSignature(currentState), targetSignature)) {
        return { route, nextIndex: stepIndex + 1 };
      }
    }
  }
  return null;
};

const runTutorialAuditRoute = (
  label: string,
  initialState: GolfGameState,
  expectedActions: readonly TutorialActionSpec[]
): string[] => {
  const issues: string[] = [];
  let currentState = initialState;
  expectedActions.forEach((expectedAction, stepIndex) => {
    const actualActions = getTutorialVisibleLegalActions(currentState);
    const exactMatch = actualActions.length === 1 && tutorialActionSpecEquals(actualActions[0], expectedAction);
    if (!exactMatch) {
      issues.push(
        `${label} step ${stepIndex + 1}: expected ${formatTutorialActionSpec(expectedAction)}, got [${actualActions.map(formatTutorialActionSpec).join(', ')}]`
      );
    }
    currentState = simulateTutorialAuditAction(currentState, expectedAction);
  });
  return issues;
};

export const getTutorialRailAuditIssues = (): string[] => {
  const adapter = {
    loadScene: (sceneId: string) => buildTutorialSceneState(sceneId as TutorialSceneId),
    getLegalActions: getTutorialVisibleLegalActions,
    applyAction: simulateTutorialAuditAction,
    getTopRanks: getTutorialVisibleTopRanks,
  };
  const issues: string[] = [];
  TUTORIAL_SCENE_SEEDS.forEach((seed) => {
    issues.push(...validateTutorialSceneSeed(seed, adapter));
  });
  TUTORIAL_ROUTE_SEEDS.forEach((route) => {
    issues.push(...runTutorialRouteValidation(route, (seedId) => getTutorialSceneSeed(seedId as never).sceneId, adapter));
  });
  return issues;
};

const getOrderedPlayerTargetStocks = (state: GolfGameState): PlayerStockTarget[] => {
  return [{
    stockId: state.playerStock.id,
    card: state.playerStock,
    kind: 'prime',
    role: 'prime',
  }];
};

const getEligiblePlayerTargetsForCard = (state: GolfGameState, candidate: CardType) => {
  if (isTutorialSlice02PrimeLockActive(state)) return [];
  return getOrderedPlayerTargetStocks(state).filter((target) => isTutorialMochiRescuePlayable(state, candidate) || canPlayOnStock(candidate, target.card));
};

/*
JET LEGACY:
Rigged Construct is currently represented as an individual Jet ability/tool.
For future iteration, treat this implementation as legacy. The target direction is for
construct-building to become a core Jet gameplay layer rather than a single ability.

Rigged Construct reward/shop permutations:
- On a given run, only one construct variant should be offered. Choosing one closes out the others for later rewards/shops.
- Phase Construct: slots for set, run, or color/element group. More structured and puzzle-like. Best if Jet should feel like a combo architect.
- Elemental Construct: choose an element, then only matching-element cards can move in/out. Cleanest fit with current elemental language and the best next prototype.
- Sequence Construct: cards must stay in ordered adjacency and can be released from any legal end. Strong secondary mini-stock with less chaos.
- Open Array Construct: multiple visible stored cards, any one can be pulled at will. Highest flexibility and complexity; better for a later iteration.
*/
const canRouteCardIntoConstruct = (state: GolfGameState, candidate: CardType) => {
  if (!state.riggedConstructArmed) return false;
  if (state.riggedConstructCapacity > 0 && state.riggedConstructCards.length >= state.riggedConstructCapacity) return false;
  if (state.riggedConstructElement && candidate.element !== state.riggedConstructElement) return false;
  const constructTop = state.riggedConstructCards[state.riggedConstructCards.length - 1] ?? null;
  return !constructTop || canPlayOnStock(candidate, constructTop);
};

const getPlayerTargetByStockId = (state: GolfGameState, stockId: string) =>
  getOrderedPlayerTargetStocks(state).find((target) => target.stockId === stockId) ?? null;

const getEligiblePlayerMoveOptions = (state: GolfGameState): PlayerMoveOption[] =>
  state.tableau.flatMap((column, columnIndex) => {
    const candidate = column[column.length - 1] ?? null;
    if (!candidate) return [];
    return getEligiblePlayerTargetsForCard(state, candidate).map((target) => ({
      columnIndex,
      stockId: target.stockId,
      candidate,
      target,
    }));
  });

const getPlayableColumnIndices = (tableau: CardType[][], stock: CardType) =>
  tableau
    .map((column, columnIndex) => {
      const topCard = column[column.length - 1] ?? null;
      if (!topCard || !canPlayOnStock(topCard, stock)) return null;
      return columnIndex;
    })
    .filter((value): value is number => value !== null);

const canRewireMove = (tableau: CardType[][], sourceColumnIndex: number, targetColumnIndex: number) => {
  if (sourceColumnIndex === targetColumnIndex) return false;
  const sourceCard = tableau[sourceColumnIndex]?.[tableau[sourceColumnIndex].length - 1] ?? null;
  const targetCard = tableau[targetColumnIndex]?.[tableau[targetColumnIndex].length - 1] ?? null;
  if (!sourceCard || !targetCard) return false;
  return canPlayOnStock(sourceCard, targetCard);
};

const scoreGolfMove = (candidate: CardType, stock: CardType) => {
  const diff = Math.abs(candidate.rank - stock.rank);
  const wrappedDiff = diff === 12 ? 1 : diff;
  return 10 - wrappedDiff;
};

type SolverStockState = {
  stockId: string;
  rank: number;
};

type SolverResult = {
  length: number;
  path: GuideStep[];
};

const compareGuideSteps = (
  left: GuideStep,
  right: GuideStep,
  stockOrder: Map<string, number>
) => {
  if (left.columnIndex !== right.columnIndex) return left.columnIndex - right.columnIndex;
  return (stockOrder.get(left.stockId) ?? 999) - (stockOrder.get(right.stockId) ?? 999);
};

const isBetterSolverResult = (
  candidate: SolverResult,
  current: SolverResult,
  stockOrder: Map<string, number>
) => {
  if (candidate.length !== current.length) return candidate.length > current.length;
  for (let index = 0; index < Math.min(candidate.path.length, current.path.length); index += 1) {
    const comparison = compareGuideSteps(candidate.path[index], current.path[index], stockOrder);
    if (comparison !== 0) return comparison < 0;
  }
  return candidate.path.length < current.path.length;
};

const serializeVisibleState = (visibleCards: Array<CardType | null>, stocks: SolverStockState[]) =>
  `${visibleCards.map((card) => card?.rank ?? 'x').join(',')}|${stocks.map((stock) => `${stock.stockId}:${stock.rank}`).join(',')}`;

const serializeHiddenState = (tableau: CardType[][], stocks: SolverStockState[]) =>
  `${tableau.map((column) => column.map((card) => card.rank).join('')).join('|')}|${stocks.map((stock) => `${stock.stockId}:${stock.rank}`).join(',')}`;

const solveVisibleBestPlan = (
  visibleCards: Array<CardType | null>,
  stocks: SolverStockState[],
  stockOrder: Map<string, number>,
  cache = new Map<string, SolverResult>()
): SolverResult => {
  const key = serializeVisibleState(visibleCards, stocks);
  const cached = cache.get(key);
  if (cached) return cached;

  let best: SolverResult = { length: 0, path: [] };
  for (let columnIndex = 0; columnIndex < visibleCards.length; columnIndex += 1) {
    const candidate = visibleCards[columnIndex];
    if (!candidate) continue;
    for (let stockIndex = 0; stockIndex < stocks.length; stockIndex += 1) {
      const stock = stocks[stockIndex];
      if (!canPlayOnRank(candidate.rank, stock.rank)) continue;
      const nextVisible = [...visibleCards];
      nextVisible[columnIndex] = null;
      const nextStocks = stocks.map((entry, index) =>
        index === stockIndex ? { ...entry, rank: candidate.rank } : entry
      );
      const child = solveVisibleBestPlan(nextVisible, nextStocks, stockOrder, cache);
      const next: SolverResult = {
        length: child.length + 1,
        path: [{ columnIndex, stockId: stock.stockId }, ...child.path],
      };
      if (isBetterSolverResult(next, best, stockOrder)) {
        best = next;
      }
    }
  }

  cache.set(key, best);
  return best;
};

const solveHiddenBestPlan = (
  tableau: CardType[][],
  stocks: SolverStockState[],
  stockOrder: Map<string, number>,
  cache = new Map<string, SolverResult>(),
  maxDepth = Number.POSITIVE_INFINITY
): SolverResult => {
  if (maxDepth <= 0) return { length: 0, path: [] };
  const key = serializeHiddenState(tableau, stocks);
  const cached = cache.get(key);
  if (cached) return cached;

  let best: SolverResult = { length: 0, path: [] };
  for (let columnIndex = 0; columnIndex < tableau.length; columnIndex += 1) {
    const column = tableau[columnIndex];
    const candidate = column[column.length - 1] ?? null;
    if (!candidate) continue;
    for (let stockIndex = 0; stockIndex < stocks.length; stockIndex += 1) {
      const stock = stocks[stockIndex];
      if (!canPlayOnRank(candidate.rank, stock.rank)) continue;
      const nextTableau = tableau.map((entry, index) => (index === columnIndex ? entry.slice(0, -1) : entry));
      const nextStocks = stocks.map((entry, index) =>
        index === stockIndex ? { ...entry, rank: candidate.rank } : entry
      );
      const child = solveHiddenBestPlan(nextTableau, nextStocks, stockOrder, cache, maxDepth - 1);
      const next: SolverResult = {
        length: child.length + 1,
        path: [{ columnIndex, stockId: stock.stockId }, ...child.path],
      };
      if (isBetterSolverResult(next, best, stockOrder)) {
        best = next;
      }
    }
  }

  cache.set(key, best);
  return best;
};

const pickBestGolfMove = (tableau: CardType[][], stock: CardType, behavior: EnemyProfile['behavior'] | 'player' = 'player') => {
  const playable = getPlayableColumnIndices(tableau, stock);
  if (playable.length === 0) return null;

  let bestIndex = playable[0];
  let bestScore = -Infinity;
  for (const columnIndex of playable) {
    const candidate = tableau[columnIndex][tableau[columnIndex].length - 1];
    const depthBonus = tableau[columnIndex].length <= 1 ? 1.5 : 0;
    const behaviorBonus =
      behavior === 'armored'
        ? tableau[columnIndex].length * 0.35
        : behavior === 'evasive'
          ? (candidate.element === stock.element ? 0.2 : 0.9)
          : behavior === 'nagging'
            ? (candidate.rank % 2 === 0 ? 0.8 : 0.1)
            : 0;
    const score = scoreGolfMove(candidate, stock) + depthBonus + behaviorBonus;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = columnIndex;
    }
  }
  return bestIndex;
};

type AutoAction =
  | { type: 'move'; columnIndex: number; stockId: string }
  | { type: 'swap'; starterPackIndex: number }
  | { type: 'rotate-support'; benchIndex: number }
  | { type: 'support-ability'; benchIndex: number }
  | { type: 'ability'; slotId: HandSlotId; effect: NonNullable<PlayerHandSlot['effect']> };

const getCombatantForCard = (state: GolfGameState, card: CardType) =>
  state.combatants[actorKeyFromName(card.name)] ?? createCombatant(card.name);

const isPrimeThreatened = (state: GolfGameState) => {
  const combatant = getCombatantForCard(state, state.playerStock);
  const effectiveHealth = combatant.hp + combatant.armor;
  return effectiveHealth <= 8 || combatant.consecutiveHitsTaken >= 1;
};

const findBenchIndexByName = (state: GolfGameState, name: string) =>
  state.playerBench.findIndex((card) => card.name === name);

const getVisibleCards = (tableau: CardType[][]) =>
  tableau.map((column) => column[column.length - 1] ?? null);

const pickHighestVisibleBiteColumn = (state: GolfGameState) => {
  let bestColumnIndex: number | null = null;
  let bestRank = -Infinity;
  let bestBites = -Infinity;

  state.tableau.forEach((column, columnIndex) => {
    const candidate = column[column.length - 1] ?? null;
    if (!candidate) return;
    const biteCount = getEnemyBiteCount(state, candidate.id);
    if (
      candidate.rank > bestRank
      || (candidate.rank === bestRank && biteCount > bestBites)
      || (candidate.rank === bestRank && biteCount === bestBites && (bestColumnIndex === null || columnIndex < bestColumnIndex))
    ) {
      bestColumnIndex = columnIndex;
      bestRank = candidate.rank;
      bestBites = biteCount;
    }
  });

  return bestColumnIndex;
};

const chooseBestSupportRotation = (state: GolfGameState) => {
  if (state.playerSupportRotateUsed) return null;
  const noMoves = getPlayableColumnIndices(state.tableau, state.playerStock).length === 0;
  if (isPrimeThreatened(state)) {
    const heroIndex = findBenchIndexByName(state, 'Hero');
    if (heroIndex >= 0 && heroIndex !== getSupportBenchIndex(state)) return heroIndex;
  }
  if (noMoves) {
    const panIndex = findBenchIndexByName(state, 'Pan');
    if (panIndex >= 0 && panIndex !== getSupportBenchIndex(state)) return panIndex;
  }
  const whisIndex = findBenchIndexByName(state, 'Whis');
  if (whisIndex >= 0 && whisIndex !== getSupportBenchIndex(state)) {
    const primeCombatant = getCombatantForCard(state, state.playerStock);
    if (primeCombatant.counterWindow > 0 || primeCombatant.evasion <= 12) return whisIndex;
  }
  return null;
};

const isPlayerTeamDefeated = (state: GolfGameState) =>
  getCombatantForCard(state, state.playerStock).hp <= 0;

export const choosePlayerAutoAction = (state: GolfGameState, mode: AutoPlayMode): AutoAction | null => {
  if (mode === 'off') return null;
  const tutorialRouteCursor = inferTutorialRouteCursor(state);
  if (tutorialRouteCursor) {
    const nextAction = tutorialRouteCursor.route.expectedActions[tutorialRouteCursor.nextIndex] ?? null;
    if (nextAction) {
      if (nextAction.kind === 'tableau' || nextAction.kind === 'rescue') {
        return { type: 'move', columnIndex: nextAction.columnIndex, stockId: state.playerStock.id };
      }
      if (nextAction.kind === 'swap') {
        return { type: 'swap', starterPackIndex: nextAction.starterPackIndex };
      }
      if (nextAction.kind === 'ability') {
        return { type: 'ability', slotId: 'left', effect: nextAction.effect as NonNullable<PlayerHandSlot['effect']> };
      }
      return null;
    }
  }
  if (state.tutorialSliceId) return null;
  const targetStocks = getOrderedPlayerTargetStocks(state);
  const solverStocks: SolverStockState[] = targetStocks.map((target) => ({ stockId: target.stockId, rank: target.card.rank }));
  const stockOrder = new Map(targetStocks.map((target, index) => [target.stockId, index]));
  const visibleCards = state.tableau.map((column) => column[column.length - 1] ?? null);
  const moveOptions = getEligiblePlayerMoveOptions(state);
  const pickBestVisibleMove = () => {
    if (moveOptions.length === 0) return null;
    let bestOption = moveOptions[0];
    let bestResult: SolverResult | null = null;
    for (const option of moveOptions) {
      const nextVisible = [...visibleCards];
      nextVisible[option.columnIndex] = null;
      const nextStocks = solverStocks.map((stock) =>
        stock.stockId === option.stockId ? { ...stock, rank: option.candidate.rank } : stock
      );
      const continuation = solveVisibleBestPlan(nextVisible, nextStocks, stockOrder);
      const total: SolverResult = {
        length: continuation.length + 1,
        path: [{ columnIndex: option.columnIndex, stockId: option.stockId }, ...continuation.path],
      };
      if (!bestResult || isBetterSolverResult(total, bestResult, stockOrder)) {
        bestResult = total;
        bestOption = option;
      }
    }
    return bestOption;
  };

  if (mode === 'tableau-pause') {
    const move = pickBestVisibleMove();
    return move === null ? null : { type: 'move', columnIndex: move.columnIndex, stockId: move.stockId };
  }

  const threatened = isPrimeThreatened(state);
  const supportCard = getSupportBenchCard(state);
  const supportIndex = getSupportBenchIndex(state);
  const supportAp = state.playerStockActionPoints;
  if (supportCard?.name === 'Whis' && threatened && !state.playerSupportActionUsed && supportAp >= getSupportAbilityCost(supportCard)) {
    return { type: 'support-ability', benchIndex: supportIndex };
  }
  if (supportCard?.name === 'Pan' && !state.playerSupportActionUsed && supportAp >= getSupportAbilityCost(supportCard) && moveOptions.length <= 1) {
    return { type: 'support-ability', benchIndex: supportIndex };
  }
  const move = pickBestVisibleMove();
  if (move !== null) return { type: 'move', columnIndex: move.columnIndex, stockId: move.stockId };
  if (state.playerStock.name === 'Banks' && state.playerStockActionPoints > 0) {
    return { type: 'ability', slotId: 'left', effect: 'banks-strike' };
  }
  return null;
};

const applyEnemyTurnStartEffects = (state: GolfGameState): GolfGameState => {
  const primedState = applyEnemyTurnFormationPassives(state);
  const enemyProfile = getEnemyProfile(primedState.enemyProfileId);
  const enemyKey = actorKeyFromName(primedState.enemyStock.name);
  const enemyCombatant = primedState.combatants[enemyKey];
  if (!enemyCombatant) return primedState;
  if (enemyProfile.behavior === 'armored') {
    return {
      ...primedState,
      combatants: {
        ...primedState.combatants,
        [enemyKey]: { ...enemyCombatant, armor: Math.min(enemyCombatant.armor + 1, 3) },
      },
    };
  }
  if (enemyProfile.behavior === 'evasive') {
    return {
      ...primedState,
      combatants: {
        ...primedState.combatants,
        [enemyKey]: { ...enemyCombatant, evasion: enemyCombatant.evasion + 4, evasionBuffAmount: enemyCombatant.evasionBuffAmount + 4, evasionBuffTurns: 1 },
      },
    };
  }
  return primedState;
};

const applyEnemyMovePostEffects = (state: GolfGameState): GolfGameState => {
  const enemyProfile = getEnemyProfile(state.enemyProfileId);
  if (!enemyProfile.chipDebuff) return state;
  const playerKey = actorKeyFromName(state.playerStock.name);
  const playerCombatant = state.combatants[playerKey];
  if (!playerCombatant) return state;
  if (enemyProfile.chipDebuff === 'slow') {
    return {
      ...state,
      combatants: {
        ...state.combatants,
        [playerKey]: { ...playerCombatant, slow: playerCombatant.slow + 1 },
      },
    };
  }
  if (enemyProfile.chipDebuff === 'burn') {
    return {
      ...state,
      combatants: {
        ...state.combatants,
        [playerKey]: { ...playerCombatant, burn: Math.min(3, playerCombatant.burn + 1) },
      },
    };
  }
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [playerKey]: { ...playerCombatant, armor: Math.max(0, playerCombatant.armor - 1) },
    },
  };
};

const buildPlayerHeuristic = (state: GolfGameState): StockHeuristic => {
  const targets = getOrderedPlayerTargetStocks(state);
  const stocks: SolverStockState[] = targets.map((target) => ({ stockId: target.stockId, rank: target.card.rank }));
  const stockOrder = new Map(targets.map((target, index) => [target.stockId, index]));
  const visibleCards = state.tableau.map((column) => column[column.length - 1] ?? null);
  const visible = solveVisibleBestPlan(visibleCards, stocks, stockOrder);
  const hidden = solveHiddenBestPlan(state.tableau, stocks, stockOrder);
  return {
    stockId: hidden.path[0]?.stockId ?? state.playerStock.id,
    visibleBest: visible.length,
    hiddenBest: hidden.length,
    hiddenPath: hidden.path,
  };
};

const HandSlotCard = ({
  slot,
  canUse,
  interactive = true,
  onClick,
  cardSize,
  slotRef,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onClickCapture,
  holdProgress = 0,
  breathing = false,
  cooldownRemaining = 0,
  taxonomyLabel = null,
}: {
  slot: PlayerHandSlot;
  canUse: boolean;
  interactive?: boolean;
  onClick: () => void;
  cardSize: { width: number; height: number };
  slotRef?: (node: HTMLButtonElement | null) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onClickCapture?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  holdProgress?: number;
  breathing?: boolean;
  cooldownRemaining?: number;
  taxonomyLabel?: string | null;
}) => (
  <button
    ref={slotRef}
    type="button"
    onClick={onClick}
    onPointerDown={onPointerDown}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    onPointerLeave={onPointerCancel}
    onClickCapture={onClickCapture}
    disabled={!interactive}
    className={`relative rounded-[16px] border p-0 overflow-hidden transition-[transform,colors] duration-150 ease-out origin-bottom ${
      canUse
        ? 'border-game-teal/25 bg-black/45 hover:z-20 hover:scale-[1.5] hover:border-game-gold/45 hover:bg-black/65'
        : 'cursor-not-allowed border-white/10 bg-black/45 hover:z-20 hover:scale-[1.5]'
    }`}
    style={{
      width: cardSize.width,
      height: cardSize.height,
      animation: breathing ? 'golf-breathe 1.85s ease-in-out infinite' : undefined,
      boxShadow: breathing ? '0 0 18px rgba(230,179,30,0.22)' : undefined,
    }}
  >
    <div className="absolute inset-0 rounded-[14px] border border-white/18 bg-black/86 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />
    <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-2">
      <div
        className="font-black uppercase text-white/85"
        style={{
          fontSize: '10px',
          letterSpacing: '0.08em',
          lineHeight: 1.1,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: `calc(100% - 12px)`,
          textAlign: 'center',
          minHeight: '22px',
        }}
      >
        {slot.kind === 'captured' ? 'Recovered' : slot.name}
      </div>
    </div>
    {slot.kind === 'captured' || slot.kind === 'generated' ? (
      <div className="pointer-events-none absolute inset-x-0 top-[44px] z-10 flex justify-center">
        <div className="text-[16px] font-black leading-none text-white">
          {slot.card ? rankLabel(slot.card.rank) : ''}
        </div>
      </div>
    ) : slot.kind === 'empty' ? (
      <div className="pointer-events-none absolute inset-x-0 top-[46px] z-10 flex justify-center">
        <div className="text-[10px] font-black uppercase tracking-[0.08em] text-white/28">Empty</div>
      </div>
    ) : null}
    {slot.kind === 'captured' || slot.kind === 'generated' ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
        <div className="rounded-full border border-game-teal/30 bg-black/75 px-3 py-1 shadow-[0_0_18px_rgba(127,219,202,0.08)]">
          <div className="text-sm font-black leading-none text-white">
            {slot.card ? slot.card.element : '·'}
          </div>
        </div>
      </div>
    ) : null}
    {slot.kind === 'ability' ? (
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div className="relative h-14 w-14 [perspective:180px]">
        <div
          className="absolute left-[8px] top-[6px] h-10 w-8 rounded-[6px] border border-game-gold/35 bg-[linear-gradient(180deg,rgba(255,232,148,0.98),rgba(226,170,58,0.92))] shadow-[0_6px_18px_rgba(230,179,30,0.28)]"
          style={{ transform: 'rotate(-10deg) skewY(4deg)' }}
        >
          <div className="absolute inset-[3px] rounded-[4px] border border-white/30 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.24),transparent_55%),linear-gradient(180deg,rgba(74,48,8,0.14),rgba(31,21,5,0.2))]" />
          <div className="absolute inset-0 flex items-center justify-center text-[16px] font-black text-[#6a4302]/85">
            ⚡
          </div>
          <div className="absolute bottom-[-8px] right-[-10px] flex h-7 min-w-7 items-center justify-center rounded-full border border-[#d38a34]/85 bg-[rgba(16,10,2,0.78)] px-1.5 shadow-[0_4px_12px_rgba(211,138,52,0.28)]">
            <div
              className="text-[13px] font-black leading-none text-[#ffd48a] tabular-nums"
              style={{ WebkitTextStroke: '1px rgba(0,0,0,0.98)', textShadow: '0 0 4px rgba(0,0,0,0.95)' }}
            >
              {getAbilityCostLabel(slot.effect)}
            </div>
          </div>
        </div>
        </div>
      </div>
    ) : null}
    {slot.card && (slot.kind === 'captured' || slot.kind === 'generated') ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center">
        <div className="text-[10px] font-black text-white/80">
          {slot.kind === 'generated' && slot.generatedEffect === 'free-energy'
            ? `Shock ${slot.generatedValue ?? slot.card.rank}`
            : slot.kind === 'generated' && slot.generatedEffect === 'wildcard'
              ? 'Wildcard'
            : slot.card.element}
        </div>
      </div>
    ) : null}
    {slot.armed ? (
      <div className="pointer-events-none absolute right-2 top-2 z-10 text-[9px] font-black uppercase tracking-[0.12em] text-game-gold">
        Armed
      </div>
    ) : null}
    {slot.kind === 'ability' && cooldownRemaining > 0 ? (
      <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-full border border-game-pink/30 bg-black/80 px-1.5 py-0.5 text-[9px] font-black leading-none text-game-pink">
        CD {cooldownRemaining}
      </div>
    ) : null}
    {holdProgress > 0 ? (
      <div className="pointer-events-none absolute inset-x-2 bottom-10 z-10 h-1.5 overflow-hidden rounded-full border border-game-gold/35 bg-black/70">
        <div
          className="h-full rounded-full bg-game-gold shadow-[0_0_10px_rgba(230,179,30,0.45)]"
          style={{ width: `${Math.min(100, Math.max(0, holdProgress * 100))}%` }}
        />
      </div>
    ) : null}
  </button>
);

const SupportSquare = ({
  glyph,
  label,
  detail,
  active,
  dimmed = false,
  onClick,
  size,
}: {
  glyph: string;
  label: string;
  detail: string;
  active: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  size: number;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!active || !onClick}
    className={`relative flex shrink-0 flex-col items-center justify-center rounded-[18px] border text-center transition-colors ${
      active
        ? 'border-game-gold/45 bg-[rgba(17,14,8,0.92)] shadow-[0_0_24px_rgba(230,179,30,0.18)] hover:border-game-gold/70'
        : dimmed
          ? 'border-white/10 bg-black/40 text-white/30'
          : 'border-game-teal/20 bg-black/50 text-white/50'
    }`}
    style={{
      width: size,
      height: size,
      minWidth: size,
    }}
  >
    <div className={`text-[28px] font-black leading-none ${active ? 'text-game-gold' : 'text-white/35'}`}>[{glyph}]</div>
    <div className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/78">{label}</div>
    <div className="mt-1 px-2 text-[8px] uppercase tracking-[0.08em] text-white/40">{detail}</div>
  </button>
);

const KinStickerSquare = ({
  sticker,
  size,
  playable,
  onCommit,
  prophecyReady = false,
}: {
  sticker: KinSticker;
  size: number;
  playable: boolean;
  onCommit: () => void;
  prophecyReady?: boolean;
}) => {
  const rarityClass =
    sticker.rarity >= 3
      ? 'border-game-gold/75 bg-[linear-gradient(160deg,rgba(18,18,24,0.95),rgba(58,43,8,0.9))] shadow-[0_0_28px_rgba(230,179,30,0.28)]'
      : sticker.rarity === 2
        ? 'border-game-teal/55 bg-[linear-gradient(160deg,rgba(10,16,18,0.94),rgba(9,34,42,0.88))] shadow-[0_0_20px_rgba(64,206,208,0.18)]'
        : 'border-white/15 bg-black/55';
  const unavailable = sticker.state !== 'available';
  return (
    <button
      type="button"
      onClick={onCommit}
      disabled={!playable}
      className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-[18px] border text-center transition-all ${
        unavailable
          ? 'border-white/10 bg-black/35 text-white/30'
          : playable
            ? `${rarityClass} hover:-translate-y-0.5 hover:border-white/70`
            : `${rarityClass} text-white/75`
      }`}
      style={{ width: size, height: size, minWidth: size }}
    >
      {sticker.rarity >= 2 && !unavailable ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_38%),linear-gradient(135deg,transparent_20%,rgba(255,255,255,0.08)_50%,transparent_80%)]" />
      ) : null}
      <div className={`relative text-[28px] font-black leading-none ${unavailable ? 'text-white/30' : 'text-white'}`}>[{sticker.glyph}]</div>
      <div className="relative mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/80">{sticker.name}</div>
      <div className="relative mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/55">
        <span>{rankLabel(sticker.rank)}</span>
        <span>R{sticker.rarity}</span>
      </div>
      <div className="relative mt-1 px-2 text-[7px] uppercase tracking-[0.08em] text-white/45">
        {sticker.state === 'buried'
          ? `Buried C${(sticker.buriedColumnIndex ?? 0) + 1}`
          : prophecyReady
            ? 'Prophecy Ready'
            : playable
              ? 'Commit To Streak'
              : 'Reserve Sticker'}
      </div>
    </button>
  );
};

const RiggedConstructCard = ({
  topCard,
  depth,
  armed,
  cooldownRemaining,
  onClick,
  cardSize,
}: {
  topCard: CardType | null;
  depth: number;
  armed: boolean;
  cooldownRemaining: number;
  onClick: () => void;
  cardSize: { width: number; height: number };
}) => {
  const displayCard: CardType = topCard ?? {
    id: 'rigged-construct-wild',
    rank: 1,
    suit: '✦',
    element: 'A',
    name: 'Construct',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-[16px] border p-0.5 transition-colors ${
        armed ? 'border-game-gold/50 bg-black/72' : 'border-game-teal/25 bg-black/45 hover:border-game-gold/45 hover:bg-black/65'
      }`}
      style={{ width: cardSize.width, height: cardSize.height }}
    >
      <div className="relative h-full w-full">
        <Card
          card={displayCard}
          showGraphics={false}
          size={cardSize}
          suitFontSizeOverride={Math.max(14, Math.round(GOLF_ELEMENT_INDICATOR_SIZE * (cardSize.width / CARD_SIZE.width)))}
          maskValue
          disableAnimation
          disableTilt
          disableHoverLift
        />
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-x-0 top-[26px] flex justify-center px-2">
            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-white/85">Construct</div>
          </div>
          <div className="absolute inset-x-0 top-[52px] flex justify-center">
            <div className="text-[18px] font-black leading-none text-white">{topCard ? rankLabel(topCard.rank) : '*'}</div>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-game-teal/25 bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-game-teal">
            Depth {depth}
          </div>
        </div>
      </div>
      {cooldownRemaining > 0 ? (
        <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-full border border-game-pink/30 bg-black/80 px-1.5 py-0.5 text-[9px] font-black leading-none text-game-pink">
          CD {cooldownRemaining}
        </div>
      ) : null}
      {armed ? (
        <div className="pointer-events-none absolute left-2 top-2 z-10 text-[9px] font-black uppercase tracking-[0.12em] text-game-gold">
          Armed
        </div>
      ) : null}
    </button>
  );
};

type ActorFrameEmojiRigConfig = {
  src: string;
  emotionType: 'happy';
  speaking?: {
    text: string;
    subtitle?: string;
  };
};

const ActorFrameEmojiRig = ({
  emojiRig,
}: {
  emojiRig?: ActorFrameEmojiRigConfig;
}) => {
  if (!emojiRig) return null;
  const speaking = !!emojiRig.speaking;
  return (
    <div className="pointer-events-none absolute right-[-6px] top-[-34px] z-50 h-[64px] w-[64px] overflow-visible">
      {speaking ? (
        <div
          className="absolute left-[-16px] top-[-34px] z-50 min-w-[124px] rounded-[24px] border-2 border-[#98eaff]/90 bg-[linear-gradient(180deg,rgba(8,16,26,0.96)_0%,rgba(4,8,14,0.95)_100%)] px-3 py-2 shadow-[0_12px_24px_rgba(0,0,0,0.34),0_0_18px_rgba(72,190,232,0.18)]"
          style={{ animation: 'golf-mochi-ready-float 1.9s ease-in-out infinite' }}
        >
          <div
            aria-hidden
            className="absolute inset-[2px] rounded-[20px]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
              opacity: 0.9,
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-[10px] left-[82%] h-[18px] w-[18px] -translate-x-1/2 rotate-45 rounded-br-[6px] border-b-2 border-r-2 border-[#98eaff]/90 bg-[linear-gradient(180deg,rgba(8,16,26,0.96)_0%,rgba(4,8,14,0.95)_100%)]"
          />
          <div className="relative whitespace-nowrap text-center">
            <div className="text-[9px] font-black uppercase tracking-[0.08em] text-[#eefaff]">
              {emojiRig.speaking?.text}
            </div>
            {emojiRig.speaking?.subtitle ? (
              <div className="mt-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#eefaff]/85">
                {emojiRig.speaking.subtitle}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <img
        src={emojiRig.src}
        alt=""
        aria-hidden
        className="absolute left-0 top-0 z-40 select-none"
        style={{
          width: speaking ? 56 : 40,
          transform: speaking ? 'translate(4px, 0)' : 'translate(16px, 6px)',
          filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.3))',
          animation: speaking ? 'golf-emoji-speaker-pop 0.36s cubic-bezier(0.22,0.68,0.2,1)' : undefined,
        }}
      />
    </div>
  );
};

const StaggerPressureBadge = ({
  pressure,
  compact = false,
}: {
  pressure: number;
  compact?: boolean;
}) => (
  <div className={`pointer-events-none absolute z-20 ${compact ? 'right-2 bottom-2' : 'right-2 bottom-[34px]'}`}>
    <div className={`rounded-full border bg-black/82 text-white/88 shadow-[0_0_14px_rgba(255,96,96,0.14)] ${
      compact ? 'border-[#ff8f8f]/35 px-2 py-1 text-[8px]' : 'border-[#ff8f8f]/40 px-2.5 py-1 text-[9px]'
    } font-black uppercase tracking-[0.16em]`}>
      STG {Math.max(0, Math.round(pressure))}
    </div>
  </div>
);

const KinBenchCard = ({
  card,
  vitals,
  combatant,
  actionPoints = 0,
  canInteract,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onClickCapture,
  cardSize,
  heuristicLabel,
  highlighted = false,
  breathing = false,
  discardCount = 0,
  holdProgress = 0,
  cardRef,
  roleLabel,
  roleDescription,
  activeRole = false,
  constrainBackdrop = false,
  emojiRig,
  flashVersions,
}: {
  card: CardType;
  vitals: ReturnType<typeof getCombatVitals>;
  combatant: ActorCombatState;
  actionPoints?: number;
  canInteract: boolean;
  onClick: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onClickCapture?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  cardSize: { width: number; height: number };
  heuristicLabel?: string | null;
  highlighted?: boolean;
  breathing?: boolean;
  discardCount?: number;
  holdProgress?: number;
  cardRef?: (node: HTMLButtonElement | null) => void;
  roleLabel?: string;
  roleDescription?: string;
  activeRole?: boolean;
  constrainBackdrop?: boolean;
  emojiRig?: ActorFrameEmojiRigConfig;
  flashVersions?: Record<string, number>;
}) => (
  <button
    ref={cardRef}
    type="button"
    onClick={onClick}
    onPointerDown={onPointerDown}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    onPointerLeave={onPointerCancel}
    onClickCapture={onClickCapture}
    className={`relative rounded-[16px] border p-0 overflow-visible transition-colors ${
      canInteract
        ? activeRole
          ? 'border-game-gold/35 bg-black/52 hover:border-game-gold/55 hover:bg-black/68'
          : 'border-game-teal/25 bg-black/45 hover:border-game-teal/55 hover:bg-black/65'
        : 'border-white/14 bg-black/42'
    }`}
    style={{
      width: cardSize.width,
      height: cardSize.height,
      animation: breathing ? 'golf-breathe 1.85s ease-in-out infinite' : undefined,
      boxShadow: highlighted
        ? '0 0 28px rgba(230,179,30,0.28), 0 0 10px rgba(230,179,30,0.24)'
        : breathing
          ? '0 0 18px rgba(230,179,30,0.22)'
          : undefined,
    }}
  >
    <div
      className={`pointer-events-none absolute z-0 rounded-[22px] border ${constrainBackdrop ? 'inset-0' : 'inset-y-[-8px] left-[-42px] right-[-42px]'}`}
      style={{
        borderColor: highlighted ? 'rgba(230,179,30,0.42)' : getActorBackdropStyle(card.name).border,
        background: getActorBackdropStyle(card.name).bg,
        boxShadow: highlighted
          ? '0 0 34px rgba(230,179,30,0.2), 0 0 12px rgba(230,179,30,0.22)'
          : getActorBackdropStyle(card.name).glow,
      }}
    />
    <div className="relative h-full w-full">
      <ActorFrameEmojiRig emojiRig={emojiRig} />
      {roleLabel ? (
        <div className="pointer-events-none absolute left-2 top-2 z-20 flex justify-start">
          <div className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] ${
            activeRole
              ? 'border-game-gold/40 bg-black/82 text-game-gold'
              : 'border-game-teal/30 bg-black/78 text-game-teal/85'
          }`}>
            {roleLabel}
          </div>
        </div>
      ) : null}
      <ActorStatusRail actorName={card.name} combatant={combatant} maxVisible={3} iconSize={18} compact flashVersions={flashVersions} />
      <Card
        card={card}
        showGraphics={false}
        size={cardSize}
        foundationOverlay={vitals}
        suitFontSizeOverride={Math.max(14, Math.round(GOLF_ELEMENT_INDICATOR_SIZE * (cardSize.width / CARD_SIZE.width)))}
        maskValue
        disableAnimation
        disableTilt
        disableHoverLift
      />
      <StockCardNameplate card={card} heuristicLabel={heuristicLabel} highlighted={highlighted} withVitals />
      {typeof actionPoints === 'number' ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-6 z-20">
          <AbilityApBar ap={actionPoints} maxAp={vitals.apMax ?? getActorApCap(card.name)} barClassName="h-[10px] rounded-[3px]" />
        </div>
      ) : null}
    </div>
    {holdProgress > 0 ? (
      <>
        <div className="pointer-events-none absolute inset-3 z-20 rounded-[18px] border border-game-gold/25 bg-black/28 shadow-[inset_0_0_24px_rgba(230,179,30,0.12)]" />
        <div className="pointer-events-none absolute inset-x-3 top-[42%] z-20 flex flex-col items-center gap-2">
          <div className="relative h-8 w-8 rounded-full border border-game-gold/40 bg-black/62">
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-game-gold border-r-game-gold/70"
              style={{ transform: `rotate(${Math.round(holdProgress * 320)}deg)` }}
            />
            <div className="absolute inset-[6px] rounded-full border border-game-gold/20" />
          </div>
          <div className="text-[8px] font-black uppercase tracking-[0.18em] text-game-gold/90">
            Inspecting
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-6 z-20 h-1.5 overflow-hidden rounded-full border border-game-gold/35 bg-black/70">
          <div
            className="h-full rounded-full bg-game-gold shadow-[0_0_10px_rgba(230,179,30,0.45)]"
            style={{ width: `${Math.min(100, Math.max(0, holdProgress * 100))}%` }}
          />
        </div>
      </>
    ) : null}
    {roleDescription ? (
      <div className="pointer-events-none absolute inset-x-1 -bottom-8 z-10 flex justify-center">
        <div className="max-w-[94%] text-center text-[8px] font-mono uppercase tracking-[0.08em] text-white/40">
          {roleDescription}
        </div>
      </div>
    ) : null}
  </button>
);

const StockActorShellView = ({
  actor,
  stock,
  vitals,
  combatant,
  stockRef,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  holdProgress = 0,
  cardSize,
  indicatorSize,
  compact,
  heuristicLabel,
  highlighted = false,
  actionPoints,
  discardCount,
}: {
  actor: StockActorShell;
  stock: CardType;
  vitals: ReturnType<typeof getCombatVitals>;
  combatant: ActorCombatState;
  stockRef?: { current: HTMLDivElement | null };
  onClick?: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<HTMLDivElement>) => void;
  holdProgress?: number;
  cardSize: { width: number; height: number };
  indicatorSize: number;
  compact: boolean;
  heuristicLabel?: string | null;
  highlighted?: boolean;
  actionPoints?: number;
  discardCount?: number;
}) => (
  <div className={`flex flex-col items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
    <div
      ref={stockRef}
      className={`relative rounded-[18px] border p-1.5 overflow-visible ${actor.accentClassName}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      style={highlighted ? { boxShadow: '0 0 28px rgba(230,179,30,0.28), 0 0 10px rgba(230,179,30,0.24)' } : undefined}
    >
      <div
        className="pointer-events-none absolute inset-y-[-8px] left-[-50px] right-[-50px] z-0 rounded-[24px] border"
        style={{
          borderColor: getActorBackdropStyle(stock.name).border,
          background: getActorBackdropStyle(stock.name).bg,
          boxShadow: getActorBackdropStyle(stock.name).glow,
        }}
      />
      <ActorStatusRail actorName={stock.name} combatant={combatant} maxVisible={4} iconSize={20} />
      <div className="relative">
        <Card
          card={stock}
          showGraphics={false}
          size={cardSize}
          suitFontSizeOverride={indicatorSize}
          foundationOverlay={vitals}
          maskValue
          disableAnimation
          disableTilt
          disableHoverLift
        />
        <StockCardNameplate card={stock} heuristicLabel={heuristicLabel} highlighted={highlighted} withVitals />
        {typeof actionPoints === 'number' ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-6 z-20">
            <AbilityApBar ap={actionPoints} maxAp={vitals.apMax ?? getActorApCap(stock.name)} barClassName="h-[10px] rounded-[3px]" />
          </div>
        ) : null}
      </div>
      {typeof actionPoints === 'number' ? (
        <div className="pointer-events-none absolute -bottom-3 left-1 z-10 h-8 w-8 [perspective:120px]">
          <div
            className="absolute left-0 top-[2px] h-6 w-5 rounded-[4px] border border-game-gold/30 bg-[linear-gradient(180deg,rgba(255,232,148,0.96),rgba(226,170,58,0.9))] shadow-[0_3px_10px_rgba(230,179,30,0.24)]"
            style={{ transform: 'rotate(-10deg) skewY(4deg)' }}
          >
            <div className="absolute inset-[2px] rounded-[3px] border border-white/30 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.24),transparent_55%),linear-gradient(180deg,rgba(74,48,8,0.14),rgba(31,21,5,0.2))]" />
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-[#6a4302]/85">
              ⚡
            </div>
            <div className="absolute bottom-[-7px] right-[-10px] flex h-5 min-w-5 items-center justify-center rounded-full border border-[#d38a34]/80 bg-transparent px-1 shadow-[0_2px_8px_rgba(211,138,52,0.2)]">
              <div
                className="text-[10px] font-black leading-none text-[#ffd48a] tabular-nums"
                style={{ WebkitTextStroke: '0.8px rgba(0,0,0,0.98)', textShadow: '0 0 3px rgba(0,0,0,0.95)' }}
              >
                {Math.min(99, Math.max(0, actionPoints))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {typeof discardCount === 'number' ? (
        <div className="pointer-events-none absolute -bottom-3 right-1 z-10 h-8 w-8 [perspective:120px]">
          <div
            className="absolute right-0 top-[2px] h-6 w-5 rounded-[4px] border border-game-teal/30 bg-[linear-gradient(180deg,rgba(166,232,244,0.95),rgba(92,184,205,0.88))] shadow-[0_3px_10px_rgba(80,200,220,0.24)]"
            style={{ transform: 'rotate(10deg) skewY(-4deg)' }}
          >
            <div className="absolute inset-[2px] rounded-[3px] border border-white/30 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.22),transparent_55%),linear-gradient(180deg,rgba(21,53,66,0.18),rgba(6,19,25,0.22))]" />
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-[#0f4f63]/80">
              ↺
            </div>
            <div className="absolute bottom-[-7px] left-[-10px] flex h-5 min-w-5 items-center justify-center rounded-full border border-[#5cb8cd]/80 bg-transparent px-1 shadow-[0_2px_8px_rgba(80,200,220,0.2)]">
              <div
                className="text-[10px] font-black leading-none text-[#a6e8f4] tabular-nums"
                style={{ WebkitTextStroke: '0.8px rgba(0,0,0,0.98)', textShadow: '0 0 3px rgba(0,0,0,0.95)' }}
              >
                {Math.min(99, Math.max(0, discardCount))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    {holdProgress > 0 ? (
      <>
        <div className="pointer-events-none absolute inset-3 z-20 rounded-[18px] border border-game-gold/25 bg-black/28 shadow-[inset_0_0_24px_rgba(230,179,30,0.12)]" />
        <div className="pointer-events-none absolute inset-x-3 top-[42%] z-20 flex flex-col items-center gap-2">
          <div className="relative h-8 w-8 rounded-full border border-game-gold/40 bg-black/62">
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-game-gold border-r-game-gold/70"
              style={{ transform: `rotate(${Math.round(holdProgress * 320)}deg)` }}
            />
            <div className="absolute inset-[6px] rounded-full border border-game-gold/20" />
          </div>
          <div className="text-[8px] font-black uppercase tracking-[0.18em] text-game-gold/90">
            Inspecting
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-6 z-20 h-1.5 overflow-hidden rounded-full border border-game-gold/35 bg-black/70">
          <div
            className="h-full rounded-full bg-game-gold shadow-[0_0_10px_rgba(230,179,30,0.45)]"
            style={{ width: `${Math.min(100, Math.max(0, holdProgress * 100))}%` }}
          />
        </div>
      </>
    ) : null}
    </div>
  </div>
);

const HeuristicPill = ({ label }: { label: string }) => (
  <div className="rounded-full border border-game-gold/35 bg-black/80 px-2 py-1 text-[9px] font-mono text-game-gold shadow-[0_0_14px_rgba(230,179,30,0.12)]">
    {label}
  </div>
);

const RewardModalShell = ({
  title,
  subtitle,
  onClose,
  reward_sticker,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  reward_sticker?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.42)] px-4">
    <button type="button" aria-label="Close reward modal" className="absolute inset-0 pointer-events-auto" onClick={onClose} />
    <div className="pointer-events-auto relative w-full max-w-[780px] rounded-[28px] border border-game-gold/22 bg-[linear-gradient(180deg,rgba(9,10,14,0.97),rgba(4,5,8,0.94))] px-5 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.55)] animate-[golf-reward-modal-in_620ms_cubic-bezier(0.18,0.9,0.22,1)_both]">
      {reward_sticker ? (
        <div className="pointer-events-none absolute right-3 top-[-20px] z-10 md:right-4 md:top-[-28px]">
          {reward_sticker}
        </div>
      ) : null}
      <div className={reward_sticker ? 'pr-[148px] md:pr-[196px]' : ''}>
        <div className="text-[18px] font-black uppercase tracking-[0.18em] text-game-gold [text-shadow:0_0_18px_rgba(230,179,30,0.28)] md:text-[24px]">
          {title}
        </div>
        {subtitle ? <div className="mt-2 text-[13px] leading-5 text-white/70">{subtitle}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  </div>
);

const TutorialScenePicker = ({
  scenes,
  onSelect,
  onClose,
}: {
  scenes: Array<{ id: TutorialSceneId; label: string; detail: string }>;
  onSelect: (sceneId: TutorialSceneId) => void;
  onClose: () => void;
}) => (
  <div className="pointer-events-none absolute inset-0 z-50 bg-[rgba(0,0,0,0.26)]">
    <button type="button" aria-label="Close scene picker" className="absolute inset-0 pointer-events-auto" onClick={onClose} />
    <div className="pointer-events-auto absolute left-4 top-[calc(env(safe-area-inset-top)+108px)] w-[min(360px,calc(100vw-32px))] rounded-[24px] border border-game-gold/20 bg-[linear-gradient(180deg,rgba(8,10,12,0.97),rgba(4,6,8,0.94))] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.4)] md:left-5 md:top-[112px]">
      <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-game-gold/78">Scene Select</div>
      <div className="flex flex-col gap-2">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => onSelect(scene.id)}
            className="rounded-[18px] border border-white/10 bg-black/42 px-3 py-3 text-left transition-colors hover:border-game-gold/35 hover:bg-black/62"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/86">{scene.label}</div>
            <div className="mt-1 text-[11px] leading-4 text-white/58">{scene.detail}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const RewardEffectTile = ({
  label,
  tone,
}: {
  label: string;
  tone: 'buff' | 'debuff';
}) => {
  const style = STATUS_TONE_STYLES[tone];
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border text-[11px] font-black uppercase tracking-[0.04em]"
      style={{
        borderColor: style.border,
        background: style.bg,
        color: style.text,
        boxShadow: style.glow,
      }}
    >
      {label}
    </div>
  );
};

const GolfHudIconButton = ({
  label,
  icon,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    className={`flex h-10 w-10 items-center justify-center rounded-full border text-[16px] leading-none backdrop-blur-md transition-all duration-200 ease-out active:scale-95 ${
      disabled
        ? 'cursor-not-allowed border-white/5 bg-white/5 text-white/20'
        : active
          ? 'border-game-gold/60 bg-game-gold/20 text-game-gold shadow-[0_0_15px_rgba(230,179,30,0.25)] hover:bg-game-gold/30 hover:scale-105'
          : 'border-white/10 bg-black/40 text-game-teal hover:border-game-teal/50 hover:bg-game-teal/10 hover:text-game-teal hover:shadow-[0_0_15px_rgba(127,219,202,0.15)] hover:scale-105'
    }`}
  >
    <span aria-hidden="true" className="font-display font-bold">{icon}</span>
  </button>
);

const GuidanceNaviOverlay = ({
  target,
  travelKey,
}: {
  target: { x: number; y: number; width: number; height: number } | null;
  travelKey: string | null;
}) => {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [travelFx, setTravelFx] = useState<{
    key: number;
    arcX: number;
    arcY: number;
    loopX: number;
    loopY: number;
    wobbleX: number;
    wobbleY: number;
    bank: number;
    duration: number;
  } | null>(null);
  const prevTargetRef = useRef<{ x: number; y: number } | null>(null);
  const arrivalTimeoutRef = useRef<number | null>(null);
  const zipAudioRef = useRef<HTMLAudioElement | null>(null);
  const arrivalAudioRefs = useRef<HTMLAudioElement[] | null>(null);

  const playAudio = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    zipAudioRef.current = new Audio('/assets/sfx/navi/navi_zip.mp3');
    arrivalAudioRefs.current = [
      new Audio('/assets/sfx/navi/navi_hey.mp3'),
      new Audio('/assets/sfx/navi/navi_look.mp3'),
    ];

    return () => {
      if (arrivalTimeoutRef.current !== null) {
        window.clearTimeout(arrivalTimeoutRef.current);
      }
      zipAudioRef.current = null;
      arrivalAudioRefs.current = null;
    };
  }, []);

  useEffect(() => {
    if (!target) {
      setAnchor(null);
      prevTargetRef.current = null;
      setTravelFx(null);
      return;
    }
    if (arrivalTimeoutRef.current !== null) {
      window.clearTimeout(arrivalTimeoutRef.current);
      arrivalTimeoutRef.current = null;
    }
    const previous = prevTargetRef.current;
    if (previous) {
      const dx = target.x - previous.x;
      const dy = target.y - previous.y;
      const distance = Math.hypot(dx, dy);
      const dirX = distance > 0 ? dx / distance : 0;
      const dirY = distance > 0 ? dy / distance : 0;
      const lateralX = -dirY;
      const lateralY = dirX;
      const arcMag = Math.max(22, Math.min(58, distance * 0.24));
      const arcSign = dx >= 0 ? 1 : -1;
      const isShortHop = distance < 130;
      const retreat = isShortHop ? Math.max(18, 52 - distance * 0.18) : 0;
      const verticalLift = Math.max(18, Math.min(54, distance * 0.14));
      const wobbleMag = Math.max(8, Math.min(24, distance * 0.08));
      setTravelFx({
        key: Date.now(),
        arcX: lateralX * arcMag * arcSign,
        arcY: lateralY * arcMag * arcSign - verticalLift,
        loopX: isShortHop ? -dirX * retreat + lateralX * retreat * 0.65 * arcSign : 0,
        loopY: isShortHop ? -dirY * retreat - Math.max(18, retreat * 0.75) : -Math.max(10, verticalLift * 0.35),
        wobbleX: lateralX * wobbleMag * (arcSign === 0 ? 1 : arcSign),
        wobbleY: -Math.max(10, wobbleMag * 1.1),
        bank: Math.max(-24, Math.min(24, dx * 0.1)),
        duration: Math.max(520, Math.min(980, 420 + distance * 1.35)),
      });
      playAudio(zipAudioRef.current);
      const arrivalOptions = arrivalAudioRefs.current ?? [];
      if (arrivalOptions.length > 0) {
        const chosen = arrivalOptions[Math.floor(Math.random() * arrivalOptions.length)];
        const duration = Math.max(520, Math.min(980, 420 + distance * 1.35));
        arrivalTimeoutRef.current = window.setTimeout(() => {
          playAudio(chosen);
          arrivalTimeoutRef.current = null;
        }, duration);
      }
    }
    setAnchor({ x: target.x, y: target.y });
    prevTargetRef.current = { x: target.x, y: target.y };
  }, [playAudio, target?.x, target?.y, travelKey]);

  if (!target || !anchor) return null;

  const wanderX = Math.max(8, Math.min(18, target.width * 0.18));
  const wanderY = Math.max(8, Math.min(18, target.height * 0.18));

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[180]"
      style={{
        transform: `translate3d(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0)`,
        transition: 'transform 420ms cubic-bezier(0.18, 0.84, 0.2, 1)',
      }}
    >
      <style>{`
        .golf-navi-wander {
          animation: golf-navi-wander 3.8s ease-in-out infinite;
        }
        .golf-navi-travel {
          animation: golf-navi-travel var(--navi-travel-duration, 760ms) cubic-bezier(0.18, 0.84, 0.2, 1) 1;
        }
        .golf-navi-heart {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          border: solid 1px #f6edd1;
          background: radial-gradient(circle, #ffffff 35%, #f6edd1 100%);
          box-shadow: 0 0 10px 4px #e8c8a1, 0 0 24px 10px rgba(255, 105, 180, 0.7);
          animation: golf-navi-bounce 1.5s ease-in-out infinite;
        }
        .golf-navi-wing-wrap {
          position: absolute;
          inset: 50% auto auto 50%;
          width: 88px;
          height: 88px;
          transform: translate(-50%, -50%);
          animation: golf-navi-bounce 1.5s ease-in-out infinite;
        }
        .golf-navi-wing-side {
          position: absolute;
          inset: 0;
        }
        .golf-navi-wing-side-left {
          animation: golf-navi-rotation-left 9s ease-in-out infinite;
        }
        .golf-navi-wing-side-right {
          animation: golf-navi-rotation-right 9s ease-in-out infinite;
        }
        .golf-navi-wing-container-top,
        .golf-navi-wing-container-bottom {
          position: absolute;
          inset: 0;
          animation: golf-navi-flap 0.55s ease-in-out infinite;
          transform-style: preserve-3d;
        }
        .golf-navi-wing {
          position: absolute;
          opacity: 0.7;
        }
        .golf-navi-wing-top {
          border-radius: 40%;
          bottom: 50%;
          width: 28px;
          height: 38px;
          background: radial-gradient(ellipse at bottom, #ffffff 25%, #3d966e 100%);
        }
        .golf-navi-wing-bottom {
          border-radius: 45%;
          top: 50%;
          width: 24px;
          height: 28px;
          background: radial-gradient(ellipse at top, #ffffff 25%, #3d966e 100%);
        }
        .golf-navi-wing-side-left .golf-navi-wing {
          right: calc(50% + 5px);
          transform-origin: right;
        }
        .golf-navi-wing-side-right .golf-navi-wing {
          left: calc(50% + 5px);
          transform-origin: left;
        }
        .golf-navi-wing-side-left .golf-navi-wing-top {
          transform: skew(20deg, 30deg);
        }
        .golf-navi-wing-side-left .golf-navi-wing-bottom {
          transform: skew(-25deg, -10deg);
        }
        .golf-navi-wing-side-right .golf-navi-wing-top {
          transform: skew(-20deg, -30deg);
        }
        .golf-navi-wing-side-right .golf-navi-wing-bottom {
          transform: skew(25deg, 10deg);
        }
        .golf-navi-spark {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 50%;
          background: #f6edd1;
          opacity: 0;
          box-shadow: 0 0 8px rgba(246, 237, 209, 0.6);
        }
        .golf-navi-spark-1 {
          width: 7px;
          height: 7px;
          animation: golf-navi-spark-1 1.8s linear infinite;
        }
        .golf-navi-spark-2 {
          width: 6px;
          height: 6px;
          animation: golf-navi-spark-2 2.1s linear infinite;
          animation-delay: -0.7s;
        }
        .golf-navi-spark-3 {
          width: 5px;
          height: 5px;
          animation: golf-navi-spark-3 1.9s linear infinite;
          animation-delay: -1.1s;
        }
        @keyframes golf-navi-wander {
          0%, 100% { transform: translate(${wanderX}px, ${wanderY}px); }
          50% { transform: translate(${-wanderX}px, ${-wanderY}px); }
        }
        @keyframes golf-navi-travel {
          0% {
            transform: translate(0px, 0px) rotate(0deg) scale(0.94);
          }
          18% {
            transform: translate(var(--navi-loop-x, 0px), var(--navi-loop-y, 0px)) rotate(calc(var(--navi-bank, 0deg) * -0.55)) scale(0.92);
          }
          42% {
            transform: translate(var(--navi-arc-x, 0px), var(--navi-arc-y, 0px)) rotate(var(--navi-bank, 0deg)) scale(1.08);
          }
          62% {
            transform: translate(var(--navi-wobble-x, 0px), var(--navi-wobble-y, 0px)) rotate(calc(var(--navi-bank, 0deg) * -0.6)) scale(1.02);
          }
          82% {
            transform: translate(calc(var(--navi-wobble-x, 0px) * -0.35), calc(var(--navi-wobble-y, 0px) * 0.2)) rotate(calc(var(--navi-bank, 0deg) * 0.2)) scale(0.99);
          }
          100% {
            transform: translate(0px, 0px) rotate(0deg) scale(1);
          }
        }
        @keyframes golf-navi-bounce {
          0%, 100% { transform: translate(-50%, calc(-50% + 6px)); }
          50% { transform: translate(-50%, calc(-50% - 6px)); }
        }
        @keyframes golf-navi-rotation-left {
          0%, 100% { transform: perspective(180px) translateX(-6px) rotateY(12deg); }
          50% { transform: perspective(180px) translateX(0) rotateY(-78deg); }
        }
        @keyframes golf-navi-rotation-right {
          0%, 100% { transform: perspective(180px) translateX(0) rotateY(78deg); }
          50% { transform: perspective(180px) translateX(6px) rotateY(-12deg); }
        }
        @keyframes golf-navi-flap {
          0%, 100% { transform: rotateX(-5deg) rotateY(-35deg); }
          50% { transform: rotateX(5deg) rotateY(35deg); }
        }
        @keyframes golf-navi-spark-1 {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.9; }
          100% { opacity: 0; transform: translate(calc(-50% + 18px), calc(-50% - 12px)) scale(0); background: hotpink; }
        }
        @keyframes golf-navi-spark-2 {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.9; }
          100% { opacity: 0; transform: translate(calc(-50% - 20px), calc(-50% + 10px)) scale(0); background: hotpink; }
        }
        @keyframes golf-navi-spark-3 {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.9; }
          100% { opacity: 0; transform: translate(calc(-50% + 8px), calc(-50% + 20px)) scale(0); background: hotpink; }
        }
      `}</style>
      <div
        key={travelFx?.key ?? 'idle'}
        className={`${travelFx ? 'golf-navi-travel' : ''} golf-navi-wander relative h-0 w-0`}
        style={
          travelFx
            ? ({
                ['--navi-arc-x' as string]: `${travelFx.arcX.toFixed(1)}px`,
                ['--navi-arc-y' as string]: `${travelFx.arcY.toFixed(1)}px`,
                ['--navi-loop-x' as string]: `${travelFx.loopX.toFixed(1)}px`,
                ['--navi-loop-y' as string]: `${travelFx.loopY.toFixed(1)}px`,
                ['--navi-wobble-x' as string]: `${travelFx.wobbleX.toFixed(1)}px`,
                ['--navi-wobble-y' as string]: `${travelFx.wobbleY.toFixed(1)}px`,
                ['--navi-bank' as string]: `${travelFx.bank.toFixed(1)}deg`,
                ['--navi-travel-duration' as string]: `${travelFx.duration.toFixed(0)}ms`,
              } as CSSProperties)
            : undefined
        }
      >
        <div className="golf-navi-wing-wrap">
          <div className="golf-navi-wing-side golf-navi-wing-side-left">
            <div className="golf-navi-wing-container-top">
              <div className="golf-navi-wing golf-navi-wing-top" />
            </div>
            <div className="golf-navi-wing-container-bottom">
              <div className="golf-navi-wing golf-navi-wing-bottom" />
            </div>
          </div>
          <div className="golf-navi-wing-side golf-navi-wing-side-right">
            <div className="golf-navi-wing-container-top">
              <div className="golf-navi-wing golf-navi-wing-top" />
            </div>
            <div className="golf-navi-wing-container-bottom">
              <div className="golf-navi-wing golf-navi-wing-bottom" />
            </div>
          </div>
        </div>
        <div className="golf-navi-spark golf-navi-spark-1" />
        <div className="golf-navi-spark golf-navi-spark-2" />
        <div className="golf-navi-spark golf-navi-spark-3" />
        <div className="golf-navi-heart absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
};

const GolfPaintOverlay = ({
  active,
}: {
  active: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let mounted = true;
    let width = canvas.width = container.clientWidth;
    let height = canvas.height = container.clientHeight;
    const twoPI = Math.PI * 2;
    let colorHue = -25;

    const randomWiggle = (wiggle: number) =>
      (Math.random() * wiggle) * (Math.random() < 0.5 ? -1 : 1);

    const randomColor = () => {
      colorHue = Math.floor((colorHue % 360) + 25 + 15 * Math.random());
      return `hsla(${colorHue}, 60%, 55%, 0.34)`;
    };

    class WaterColor {
      x: number;
      y: number;
      size: number;
      fill: string;
      speed = 0.3;
      maxPoints = 3000;
      maxRender = 5;
      scale = true;
      c = 0;
      points: [number, number][] | null = null;
      originalPoints: [number, number][] | null = null;

      constructor(x: number, y: number, size: number, fill: string) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.fill = fill;
        this.render();
      }

      buildPoints() {
        const wiggle = this.size * 0.15;
        let rotation = 0;
        let x = -this.size;
        let y = 0;
        const horizontal = Math.random() > 0.5;
        const start: [number, number] = [x, y];
        this.points = [start];

        for (; rotation < twoPI; rotation += this.speed) {
          x += this.size * this.speed * Math.sin(rotation) * (horizontal ? 1 : 0.7) + randomWiggle(wiggle);
          y += this.size * this.speed * Math.cos(rotation) * (horizontal ? 0.7 : 1) + randomWiggle(wiggle);
          this.points.push([x, y]);
        }

        this.points.push(start);
        this.originalPoints = this.points;
        return this.points;
      }

      expandPoints() {
        if (!this.points) return this.buildPoints();
        if (this.points.length > this.maxPoints) return false;

        const wiggle = this.size * 0.05;
        const next: [number, number][] = [];
        const len = this.points.length - 1;

        for (let i = 0; i < len; i += 1) {
          const [x, y] = this.points[i];
          const [x2, y2] = this.points[i + 1];
          next.push(
            [x, y],
            [((x2 + x) / 2) + randomWiggle(wiggle), ((y2 + y) / 2) + randomWiggle(wiggle)],
            [x2, y2]
          );
        }

        this.points = next;
        return true;
      }

      render() {
        if (!mounted) return;
        this.c += 1;
        if (this.c < this.maxRender * 3) {
          requestAnimationFrame(() => this.render());
        }
        if (this.c % 3 === 0) {
          this.draw(this.c / 3);
        }
      }

      draw(iteration: number) {
        while (this.expandPoints()) {
          // expand until stabilized
        }

        const itr = iteration / this.maxRender;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'hard-light';
        ctx.globalAlpha = 0.25 - (itr * 0.1);
        ctx.translate(this.x, this.y);
        if (this.scale) {
          ctx.scale(1 + itr * 0.2, 1 + itr * 0.2);
        }

        ctx.beginPath();
        if (this.points?.length) {
          ctx.moveTo(this.points[0][0], this.points[0][1]);
          for (let i = 0; i < this.points.length; i += 1) {
            ctx.lineTo(this.points[i][0], this.points[i][1]);
          }
        }
        ctx.closePath();
        ctx.fillStyle = this.fill;
        ctx.fill();
        this.points = this.originalPoints;
      }
    }

    const handleResize = () => {
      width = canvas.width = container.clientWidth;
      height = canvas.height = container.clientHeight;
    };

    const paintSwatch = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      new WaterColor(
        clientX - rect.left,
        clientY - rect.top,
        Math.min(width, height) * (0.11 + Math.random() * 0.045),
        randomColor()
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!active) return;
      paintSwatch(event.clientX, event.clientY);
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('pointerdown', handlePointerDown);

    return () => {
      mounted = false;
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [active]);

  return (
    <div className={`absolute inset-0 z-30 ${active ? 'pointer-events-auto' : 'pointer-events-none'}`} ref={containerRef}>
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={{ display: 'none' }}>
        <defs>
          <filter id="golf-paint-squiggly">
            <feTurbulence baseFrequency="0.22" numOctaves="3" result="noise" seed="0" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" />
          </filter>
        </defs>
      </svg>
      <canvas
        ref={canvasRef}
        className={`block h-full w-full ${active ? 'cursor-crosshair' : ''}`}
        style={{ filter: 'url(#golf-paint-squiggly)' }}
      />
    </div>
  );
};

export const GolfGame = () => {
  const { setIsImmersive } = useImmersiveBattle();
  const [game, setGame] = useState<GolfGameState>(() => setupGame());
  const scenarioId = getGolfScenarioId();
  const isTutorialScenario = scenarioId === 'tutorial';
  const isRngScenario = scenarioId === 'rng';
  const [currentTurn, setCurrentTurn] = useState<'player' | 'enemy'>('player');
  const [autoPlayMode, setAutoPlayMode] = useState<AutoPlayMode>('off');
  const [showAutoPlayMenu, setShowAutoPlayMenu] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [inspectMode, setInspectMode] = useState<'guidance' | 'ancestors' | null>(null);
  const [oracleMode, setOracleMode] = useState<'off' | 'guidance' | 'ancestors'>('off');
  const [paintMode, setPaintMode] = useState(false);
  const [showDiscardTray, setShowDiscardTray] = useState(false);
  const [showTutorialRescueDepth, setShowTutorialRescueDepth] = useState(false);
  const [showTutorialRewardModal, setShowTutorialRewardModal] = useState(false);
  const [showTutorialScenePicker, setShowTutorialScenePicker] = useState(false);
  const [tutorialRewardSourcePoint, setTutorialRewardSourcePoint] = useState<{ x: number; y: number } | null>(null);
  const [tutorialMochiMarkerAnchor, setTutorialMochiMarkerAnchor] = useState<{ x: number; y: number } | null>(null);
  const [rescueCardFlash, setRescueCardFlash] = useState<RescueCardFlash | null>(null);
  const [enemyTurnQueued, setEnemyTurnQueued] = useState(false);
  const [fps, setFps] = useState(0);
  const [guidePlan, setGuidePlan] = useState<GuidePlan | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : (window.visualViewport?.width ?? window.innerWidth),
    height: typeof window === 'undefined' ? 900 : (window.visualViewport?.height ?? window.innerHeight),
  }));
  const [enemyTurnSummary, setEnemyTurnSummary] = useState<GolfTurnAction[]>([]);
  const [enemyDragAnim, setEnemyDragAnim] = useState<GolfDragAnim | null>(null);
  const [playerHandAnim, setPlayerHandAnim] = useState<PlayerHandAnim | null>(null);
  const [pinnedTooltipSlotId, setPinnedTooltipSlotId] = useState<HandSlotId | null>(null);
  const [enemyStealSelectorOpen, setEnemyStealSelectorOpen] = useState(false);
  const [pendingPlayerPlay, setPendingPlayerPlay] = useState<{
    source: 'tableau' | 'captured-left' | 'captured-right' | 'construct';
    columnIndex?: number;
    stockIds: string[];
  } | null>(null);
  const [stickyHoldProgress, setStickyHoldProgress] = useState(0);
  const [abilityTooltipHoldSlotId, setAbilityTooltipHoldSlotId] = useState<HandSlotId | null>(null);
  const [abilityTooltipHoldProgress, setAbilityTooltipHoldProgress] = useState(0);
  const [devAbilityHoldSlotId, setDevAbilityHoldSlotId] = useState<HandSlotId | 'pan-left' | null>(null);
  const [devAbilityHoldProgress, setDevAbilityHoldProgress] = useState(0);
  const [kinInspectIndex, setKinInspectIndex] = useState<number | null>(null);
  const [kinInspectHoldProgress, setKinInspectHoldProgress] = useState(0);
  const [dialogueCallouts, setDialogueCallouts] = useState<DialogueCalloutEntry[]>([]);
  const [enemyBurnProgress, setEnemyBurnProgress] = useState(0);
  const [primeTapped, setPrimeTapped] = useState(false);
  const [starterBenchLockProgress, setStarterBenchLockProgress] = useState(0);
  const [highlightedActorNames, setHighlightedActorNames] = useState<string[]>([]);
  const [highlightedStatusKeys, setHighlightedStatusKeys] = useState<string[]>([]);
  const [statusFlashVersions, setStatusFlashVersions] = useState<Record<string, number>>({});
  const [transientStatusEvents, setTransientStatusEvents] = useState<Array<{ id: number; actorName: string; key: string; label: string; tone: 'buff' | 'debuff' }>>([]);
  const [maulTelegraphPath, setMaulTelegraphPath] = useState<string | null>(null);
  const enemyTurnTimeoutRef = useRef<number | null>(null);
  const gameRootRef = useRef<HTMLDivElement | null>(null);
  const playerStockRef = useRef<HTMLDivElement | null>(null);
  const enemyStockRef = useRef<HTMLDivElement | null>(null);
  const maulReadyRef = useRef<HTMLDivElement | null>(null);
  const enemyBenchRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const benchInspectorRef = useRef<HTMLDivElement | null>(null);
  const playerHandRefs = useRef<Record<HandSlotId, HTMLButtonElement | null>>({ left: null, right: null });
  const playerCaptureRefs = useRef<Record<HandSlotId, HTMLButtonElement | null>>({ left: null, right: null });
  const tableauTopRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tableauCardRefs = useRef<Record<string, HTMLDivElement | HTMLButtonElement | null>>({});
  const tutorialRescueModalRef = useRef<HTMLDivElement | null>(null);
  const tutorialRewardCardRef = useRef<HTMLButtonElement | null>(null);
  const playerBenchRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const starterPackBenchRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tutorialAdvanceKeyRef = useRef<string | null>(null);
  const tutorialSliceIntroRef = useRef<string | null>(null);
  const latestGameRef = useRef(game);
  const lastUndoRef = useRef<UndoSnapshot | null>(null);
  const isPausedRef = useRef(isPaused);
  const enemyTurnRunIdRef = useRef(0);
  const enemyDragNodeRef = useRef<HTMLDivElement | null>(null);
  const enemyDragRafRef = useRef(0);
  const enemyDragAnimIdRef = useRef<number | null>(null);
  const enemyDragStartedAtRef = useRef(0);
  const enemyDragRemainingMsRef = useRef(0);
  const enemyDragPausedTransformRef = useRef<string | null>(null);
  const enemyDragTimeoutRef = useRef(0);
  const enemyDragCompletionRef = useRef<(() => void) | null>(null);
  const enemyDragSequenceIdRef = useRef(0);
  const playerHandAnimTimeoutRef = useRef<number | null>(null);
  const rescueCardFlashTimeoutRef = useRef<number | null>(null);
  const rescueRewardModalTimeoutRef = useRef<number | null>(null);
  const playerHandAnimNodeRef = useRef<HTMLDivElement | null>(null);
  const stickyHoldTimeoutRef = useRef<number | null>(null);
  const stickyHoldRafRef = useRef(0);
  const stickyHoldStartRef = useRef(0);
  const abilityTooltipHoldTimeoutRef = useRef<number | null>(null);
  const abilityTooltipHoldRafRef = useRef(0);
  const abilityTooltipHoldStartRef = useRef(0);
  const devAbilityHoldTimeoutRef = useRef<number | null>(null);
  const devAbilityHoldRafRef = useRef(0);
  const devAbilityHoldStartRef = useRef(0);
  const suppressStickyClickRef = useRef(false);
  const suppressAbilityClickRef = useRef(false);
  const abilityFeedbackTimeoutRef = useRef<number | null>(null);
  const kinInspectHoldTimeoutRef = useRef<number | null>(null);
  const kinInspectHoldRafRef = useRef(0);
  const kinInspectHoldStartRef = useRef(0);
  const kinInspectHoldIndexRef = useRef<number | null>(null);
  const suppressKinInspectClickRef = useRef(false);
  const fpsRafRef = useRef(0);
  const fpsLastSampleTimeRef = useRef(0);
  const fpsFrameCountRef = useRef(0);
  const dialogueCalloutTimeoutsRef = useRef<number[]>([]);
  const autoPlayMenuRef = useRef<HTMLDivElement | null>(null);
  const primeTapTimeoutRef = useRef<number | null>(null);
  const starterBenchLockTimeoutRef = useRef<number | null>(null);
  const starterBenchLockRafRef = useRef(0);
  const mochiTokenVisibleRef = useRef(false);
  const starterBenchLockStartRef = useRef(0);
  const starterBenchLockIndexRef = useRef<number | null>(null);
  const suppressStarterBenchClickRef = useRef(false);

  useEffect(() => {
    setIsImmersive(false);
  }, [setIsImmersive]);

  useEffect(() => {
    latestGameRef.current = game;
  }, [game]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => () => {
    if (primeTapTimeoutRef.current) {
      window.clearTimeout(primeTapTimeoutRef.current);
    }
    if (rescueCardFlashTimeoutRef.current) {
      window.clearTimeout(rescueCardFlashTimeoutRef.current);
    }
    if (rescueRewardModalTimeoutRef.current) {
      window.clearTimeout(rescueRewardModalTimeoutRef.current);
    }
    if (starterBenchLockTimeoutRef.current) {
      window.clearTimeout(starterBenchLockTimeoutRef.current);
    }
    if (starterBenchLockRafRef.current) {
      window.cancelAnimationFrame(starterBenchLockRafRef.current);
    }
  }, []);

  useEffect(() => {
    if (currentTurn !== 'player') {
      setPendingPlayerPlay(null);
    }
  }, [currentTurn]);

  useEffect(() => {
    if (!showAutoPlayMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const node = autoPlayMenuRef.current;
      if (!node || !(event.target instanceof Node)) return;
      if (!node.contains(event.target)) {
        setShowAutoPlayMenu(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [showAutoPlayMenu]);

  useEffect(() => {
    if (!showTutorialRescueDepth) return;
    const handlePointerDown = (event: PointerEvent) => {
      const node = tutorialRescueModalRef.current;
      if (!node || !(event.target instanceof Node)) return;
      if (!node.contains(event.target)) {
        setShowTutorialRescueDepth(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [showTutorialRescueDepth]);

  useEffect(() => () => {
    if (enemyTurnTimeoutRef.current !== null) {
      window.clearTimeout(enemyTurnTimeoutRef.current);
    }
    if (enemyDragRafRef.current) {
      window.cancelAnimationFrame(enemyDragRafRef.current);
    }
    if (enemyDragTimeoutRef.current) {
      window.clearTimeout(enemyDragTimeoutRef.current);
    }
    if (playerHandAnimTimeoutRef.current !== null) {
      window.clearTimeout(playerHandAnimTimeoutRef.current);
    }
    if (stickyHoldTimeoutRef.current !== null) {
      window.clearTimeout(stickyHoldTimeoutRef.current);
    }
    if (stickyHoldRafRef.current) {
      window.cancelAnimationFrame(stickyHoldRafRef.current);
    }
    if (abilityTooltipHoldTimeoutRef.current !== null) {
      window.clearTimeout(abilityTooltipHoldTimeoutRef.current);
    }
    if (abilityTooltipHoldRafRef.current) {
      window.cancelAnimationFrame(abilityTooltipHoldRafRef.current);
    }
    if (devAbilityHoldTimeoutRef.current !== null) {
      window.clearTimeout(devAbilityHoldTimeoutRef.current);
    }
    if (devAbilityHoldRafRef.current) {
      window.cancelAnimationFrame(devAbilityHoldRafRef.current);
    }
    if (kinInspectHoldTimeoutRef.current !== null) {
      window.clearTimeout(kinInspectHoldTimeoutRef.current);
    }
    if (kinInspectHoldRafRef.current) {
      window.cancelAnimationFrame(kinInspectHoldRafRef.current);
    }
    if (fpsRafRef.current) {
      window.cancelAnimationFrame(fpsRafRef.current);
    }
    if (abilityFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(abilityFeedbackTimeoutRef.current);
    }
    dialogueCalloutTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    enemyDragCompletionRef.current?.();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? '';
      const isTypingTarget = tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.code === 'ControlLeft') {
        if (event.repeat) return;
        setInspectMode((prev) => (prev === 'guidance' ? null : 'guidance'));
        return;
      }
      if (event.code === 'ControlRight') {
        if (event.repeat) return;
        setInspectMode((prev) => (prev === 'ancestors' ? null : 'ancestors'));
        return;
      }
      if (event.code === 'KeyP') {
        if (event.repeat || isTypingTarget) return;
        event.preventDefault();
        setPaintMode((prev) => !prev);
        return;
      }
      if (event.code !== 'Space' || event.repeat) return;
      if (isTypingTarget) return;
      event.preventDefault();
      setIsPaused((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.visualViewport?.width ?? window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (fpsLastSampleTimeRef.current === 0) {
        fpsLastSampleTimeRef.current = timestamp;
      }
      fpsFrameCountRef.current += 1;
      const elapsed = timestamp - fpsLastSampleTimeRef.current;
      if (elapsed >= 500) {
        setFps(Math.round((fpsFrameCountRef.current * 1000) / elapsed));
        fpsFrameCountRef.current = 0;
        fpsLastSampleTimeRef.current = timestamp;
      }
      fpsRafRef.current = window.requestAnimationFrame(tick);
    };

    fpsRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (fpsRafRef.current) {
        window.cancelAnimationFrame(fpsRafRef.current);
        fpsRafRef.current = 0;
      }
      fpsLastSampleTimeRef.current = 0;
      fpsFrameCountRef.current = 0;
    };
  }, []);

  const showThreatRail = game.tutorialSliceId === 'slice-03' || game.tutorialSliceId === 'slice-04' || !isTutorialScenario;
  const combatLaneActive = showThreatRail && !game.tutorialEnemyDefeated;
  const narrowViewport = viewport.width < 900;
  const shortViewport = viewport.height < 820;
  const ultraShortViewport = viewport.height < 720;

  const boardScale = useMemo(() => {
    const widthReserve = narrowViewport ? 56 : 140;
    const threatRailReserve = combatLaneActive ? (shortViewport ? 120 : 96) : 0;
    const baseHeightReserve = combatLaneActive
      ? (ultraShortViewport ? 470 : shortViewport ? 420 : 310)
      : (ultraShortViewport ? 350 : shortViewport ? 300 : 220);
    const heightReserve = baseHeightReserve + threatRailReserve;
    const widthScale = clampNumber((viewport.width - widthReserve) / 1120, narrowViewport ? 0.5 : 0.68, 1);
    const heightScale = clampNumber((viewport.height - heightReserve) / 760, ultraShortViewport ? 0.32 : shortViewport ? 0.4 : 0.66, 1);
    // Keep the full 7-column tableau inside the live viewport instead of relying on overflow scrolling.
    const tableauWidthScale = clampNumber((viewport.width - 52) / 900, 0.34, 1);
    return Math.min(widthScale, heightScale, tableauWidthScale);
  }, [combatLaneActive, narrowViewport, shortViewport, ultraShortViewport, viewport.height, viewport.width]);

  const boardCardSize = useMemo(
    () => ({
      width: Math.round(CARD_SIZE.width * boardScale),
      height: Math.round(CARD_SIZE.height * boardScale),
    }),
    [boardScale]
  );
  const primeVisualZoneWidth = Math.round(boardCardSize.width + Math.max(132, boardCardSize.width * 1.02));
  const benchActorZoneWidth = Math.round(boardCardSize.width + Math.max(72, boardCardSize.width * 0.5));
  const handCardSize = useMemo(
    () => ({
      width: Math.max(44, Math.round(boardCardSize.width * 0.6)),
      height: Math.max(64, Math.round(boardCardSize.height * 0.6)),
    }),
    [boardCardSize.height, boardCardSize.width]
  );
  const indicatorSize = Math.max(14, Math.round(GOLF_ELEMENT_INDICATOR_SIZE * boardScale));
  const playerPeek = Math.max(4, Math.round(PLAYER_TURN_PEEK * boardScale));
  const enemyPeek = Math.max(4, Math.round(ENEMY_TURN_PEEK * boardScale));
  const enemyEdgePeek = Math.max(8, Math.round(ENEMY_TURN_PLAYER_EDGE_PEEK * boardScale));
  const columnGap = Math.max(4, Math.round(10 * boardScale));
  const nonCombatTableauPeek = Math.max(30, Math.round(boardCardSize.height * 0.2));
  const nonCombatRankReveal = Math.max(58, Math.round(boardCardSize.height * 0.38));
  const benchGap = Math.max(4, Math.round(10 * boardScale));
  const benchKinGap = Math.max(18, Math.round(30 * boardScale));
  const boardCompact = boardScale < 0.82;

  const effectiveOracleMode = inspectMode ?? oracleMode;
  const tutorialRailColumns = useMemo(() => getTutorialRailColumns(game), [game]);
  const topCards = useMemo(
    () => game.tableau.map((column) => column[column.length - 1] ?? null),
    [game.tableau]
  );
  const nonCombatGlobalPeekCount = useMemo(() => {
    if (combatLaneActive) return 0;
    return Math.min(
      3,
      Math.max(
        0,
        ...game.tableau.map((column) => Math.max(0, column.length - 1))
      )
    );
  }, [combatLaneActive, game.tableau]);
  const tutorialMinimumTableauRows = game.tutorialSliceId ? 3 : 1;
  const displayNonCombatPeekCount = combatLaneActive
    ? 0
    : Math.max(nonCombatGlobalPeekCount, tutorialMinimumTableauRows - 1);
  const playerTargetStocks = useMemo(() => getOrderedPlayerTargetStocks(game), [game.playerStock, game.playerBench]);
  const playerStockOrder = useMemo(
    () => new Map(playerTargetStocks.map((target, index) => [target.stockId, index])),
    [playerTargetStocks]
  );
  const playerSolverStocks = useMemo(
    () => playerTargetStocks.map((target) => ({ stockId: target.stockId, rank: target.card.rank })),
    [playerTargetStocks]
  );
  const playerVisiblePlan = useMemo(
    () => solveVisibleBestPlan(topCards, playerSolverStocks, playerStockOrder),
    [topCards, playerSolverStocks, playerStockOrder]
  );
  const playerHiddenPlan = useMemo(() => {
    if (effectiveOracleMode !== 'ancestors') return null;
    return solveHiddenBestPlan(game.tableau, playerSolverStocks, playerStockOrder, new Map<string, SolverResult>(), 5);
  }, [effectiveOracleMode, game.tableau, playerSolverStocks, playerStockOrder]);
  const playerPlanHeuristic = useMemo(() => ({
    stockId: playerHiddenPlan?.path[0]?.stockId ?? game.playerStock.id,
    visibleBest: playerVisiblePlan.length,
    hiddenBest: playerHiddenPlan?.length ?? 0,
    hiddenPath: playerHiddenPlan?.path ?? [],
  }), [game.playerStock.id, playerHiddenPlan, playerVisiblePlan.length]);
  const collectedPrimeElements = useMemo(
    () => new Set(game.playerPrimeApSegments),
    [game.playerPrimeApSegments]
  );
  const whisSticker = useMemo(
    () => game.kinStickers.find((sticker) => sticker.speciesId === 'whis') ?? null,
    [game.kinStickers]
  );
  const whisProphecyReady = useMemo(
    () =>
      !!whisSticker
      && whisSticker.state === 'available'
      && ['A', 'E', 'F', 'W'].every((element) => collectedPrimeElements.has(element as Element)),
    [collectedPrimeElements, whisSticker]
  );
  const whisProphecyCharged = whisProphecyReady && currentTurn === 'player' && game.playerStockSequence > 0 && game.playerStockSequence % 4 === 0;
  const whisProphecyPath = useMemo(() => {
    if (!whisProphecyReady) return [];
    return solveHiddenBestPlan(game.tableau, playerSolverStocks, playerStockOrder, new Map<string, SolverResult>(), 5)?.path ?? [];
  }, [game.tableau, playerSolverStocks, playerStockOrder, whisProphecyReady]);

  useEffect(() => {
    if (currentTurn !== 'player') {
      setGuidePlan((prev) => (prev?.source === 'ancestors' || prev?.source === 'prophecy' ? null : prev));
      return;
    }
    if (effectiveOracleMode !== 'ancestors' || playerPlanHeuristic.hiddenBest <= 0) {
      setGuidePlan((prev) => (prev?.source === 'ancestors' ? null : prev));
      return;
    }
    setGuidePlan((prev) => {
      if (prev && prev.source === 'ancestors') {
        return prev;
      }
      return {
        path: playerPlanHeuristic.hiddenPath,
        progress: 0,
        source: 'ancestors',
        visibleSteps: null,
      };
    });
  }, [currentTurn, effectiveOracleMode, playerPlanHeuristic]);
  const nextGuideStep = useMemo(() => {
    if (currentTurn !== 'player' || !guidePlan) return null;
    const visibleSteps = guidePlan.visibleSteps ?? Number.POSITIVE_INFINITY;
    const nextIndex = guidePlan.progress;
    if (nextIndex >= guidePlan.path.length || nextIndex >= visibleSteps) return null;
    return guidePlan.path[nextIndex] ?? null;
  }, [currentTurn, guidePlan]);

  const nextGuideTarget = useMemo(() => {
    if (!nextGuideStep) return null;
    if (pendingPlayerPlay?.source === 'tableau' && pendingPlayerPlay.columnIndex === nextGuideStep.columnIndex && pendingPlayerPlay.stockIds.includes(nextGuideStep.stockId)) {
      const target = getPlayerTargetByStockId(game, nextGuideStep.stockId);
      const node = target?.kind === 'prime'
        ? playerStockRef.current
        : (typeof target?.benchIndex === 'number' ? playerBenchRefs.current[target.benchIndex] : null);
      const rect = node?.getBoundingClientRect();
      if (!rect) return null;
      return {
        key: `stock-${nextGuideStep.stockId}-${guidePlan?.progress ?? 0}`,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
      };
    }
    const node = tableauTopRefs.current[nextGuideStep.columnIndex];
    const rect = node?.getBoundingClientRect();
    if (!rect) return null;
    return {
      key: `tableau-${nextGuideStep.columnIndex}-${guidePlan?.progress ?? 0}`,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
  }, [currentTurn, game, guidePlan, nextGuideStep, pendingPlayerPlay, viewport.height, viewport.width]);

  const getHeuristicLabel = useCallback((_stockId: string) => null, []);
  const bestOpeningVisibleRun = playerPlanHeuristic.visibleBest;
  const highlightPanForBadLuck =
    currentTurn === 'player' &&
    game.clearedCount === 0 &&
    game.playerStockSequence === 0 &&
    game.enemyStockSequence === 0 &&
    game.playerStock.name !== 'Pan' &&
    bestOpeningVisibleRun < 3;
  const pawSperityEligible = game.playerStock.name === 'Pan' && game.panPawSperityCooldown === 0;
  const leftHandSlot = game.playerHand.find((slot) => slot.slotId === 'left') ?? createEmptyHandSlot('left');
  const rightHandSlot = game.playerHand.find((slot) => slot.slotId === 'right') ?? createEmptyHandSlot('right');
  const leftCapturedSlot = game.playerCapturedLeft
    ? (game.playerCapturedLeft.name === 'FREE ENERGY'
      ? createGeneratedHandSlot('left', 'FREE ENERGY', game.playerCapturedLeft, 'free-energy', game.playerCapturedLeft.rank)
      : createCapturedHandSlot('left', game.playerCapturedLeft))
    : null;
  const rightCapturedSlot = game.playerCapturedRight
    ? (game.playerCapturedRight.name === 'FREE ENERGY'
      ? createGeneratedHandSlot('right', 'FREE ENERGY', game.playerCapturedRight, 'free-energy', game.playerCapturedRight.rank)
      : createCapturedHandSlot('right', game.playerCapturedRight))
    : null;
  const stickyPawsArmed = game.playerHand.some((slot) => slot.effect === 'sticky-paws' && slot.armed) && game.stickyPawsCooldown === 0;
  const activeActorName = game.playerStock.name;
  const currentEnemyProfile = useMemo(() => getEnemyProfile(game.enemyProfileId), [game.enemyProfileId]);
  const isTargetDummyEncounter = false;
  const enemyBenchProfiles = useMemo(
    () => game.enemyBenchProfileIds.map((profileId) => getEnemyProfile(profileId)),
    [game.enemyBenchProfileIds]
  );
  const enemyStealOptions = useMemo<EnemyStealOption[]>(() => {
    const prime: EnemyStealOption[] = [{
      id: `prime-${game.enemyStock.id}`,
      card: game.enemyStock,
      source: 'prime',
      profileId: game.enemyProfileId,
      label: currentEnemyProfile.actor.name,
    }];
    const bench = game.enemyBench.map((card, benchIndex) => ({
      id: `bench-${card.id}`,
      card,
      source: 'bench' as const,
      benchIndex,
      profileId: game.enemyBenchProfileIds[benchIndex] ?? game.enemyProfileId,
      label: enemyBenchProfiles[benchIndex]?.actor.name ?? card.name,
    }));
    return [...prime, ...bench];
  }, [currentEnemyProfile.actor.name, enemyBenchProfiles, game.enemyBench, game.enemyBenchProfileIds, game.enemyProfileId, game.enemyStock]);
  const showHeuristicValues = inspectMode !== null || oracleMode !== 'off' || guidePlan?.source === 'prophecy';
  const guidanceNextColumn = nextGuideStep?.columnIndex ?? null;
  const primeAbilitySlots = useMemo(() => {
    if (isTargetDummyEncounter) return [];
    if (activeActorName === 'Jet') {
      return [
        createHandSlot('jet-left-3', 'ability', 'Rewire', 'rewire', null, game.jetRewireActionsRemaining > 0),
      ] as PlayerHandSlot[];
    }
    const actorAbilities = (STARTER_ABILITIES[activeActorName] ?? []).filter(
      (ability) => ability.effect !== null && isTutorialAbilityVisible(game, ability.effect)
    );
    return actorAbilities
      .slice(0, PRIME_ABILITY_SLOT_IDS.length)
      .map((ability, index) => createAbilitySlot(
        PRIME_ABILITY_SLOT_IDS[index],
        ability.effect === 'banks-strike'
          ? { ...ability, name: getStarterPackAbilityName('Banks', game.starterPackAbilityRarities[game.activeStarterPackIndex] ?? 1) ?? ability.name }
          : ability
      ));
  }, [activeActorName, game.activeStarterPackIndex, game.jetRewireActionsRemaining, game.starterPackAbilityRarities, isTargetDummyEncounter]);
  const primeDynamicHandSlots = useMemo(
    () =>
      isTargetDummyEncounter
        ? []
        : activeActorName === 'Jet'
          ? ([
              leftCapturedSlot,
              leftHandSlot.kind === 'empty' ? null : leftHandSlot,
              rightCapturedSlot,
              rightHandSlot.kind === 'empty' ? null : rightHandSlot,
            ].filter(Boolean) as PlayerHandSlot[])
          : [],
    [activeActorName, isTargetDummyEncounter, leftCapturedSlot, leftHandSlot, rightCapturedSlot, rightHandSlot]
  );
  const rngDynamicHandSlots = useMemo(
    () => game.scenarioId === 'rng'
      ? game.playerHand.filter((slot) => slot.kind !== 'empty')
      : [],
    [game.playerHand, game.scenarioId]
  );
  const heroHandSlots = useMemo(() => {
    return [];
  }, []);
  const activePrimeHandSlots = useMemo(
    () => [...primeAbilitySlots, ...primeDynamicHandSlots, ...rngDynamicHandSlots, ...heroHandSlots],
    [heroHandSlots, primeAbilitySlots, primeDynamicHandSlots, rngDynamicHandSlots]
  );
  const threatenedActorName = useMemo(
    () => (game.heroGuardTauntTurns > 0 ? 'Hero' : 'Mochi'),
    [game.heroGuardTauntTurns]
  );
  const enemyActionPreview = useMemo(() => {
    if (game.enemyProfileId === 'shade-wisp' && game.enemyStockActionPoints >= 2) {
      return {
        title: 'Maul',
        detail: '2 shadow damage. The wisp lashes the exposed line.',
        targetLabel: threatenedActorName,
        hostile: true,
      };
    }
    return {
      title: 'Bite',
      detail: 'Chew the highest visible tableau card to gain AP.',
      targetLabel: 'Tableau',
      hostile: false,
    };
  }, [game.enemyProfileId, game.enemyStockActionPoints, threatenedActorName]);

  useEffect(() => {
    const showMaulTelegraph =
      showThreatRail
      && !game.tutorialEnemyDefeated
      && game.enemyProfileId === 'shade-wisp'
      && game.enemyStockActionPoints >= 2;
    if (!showMaulTelegraph) {
      setMaulTelegraphPath(null);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const fromRect = maulReadyRef.current?.getBoundingClientRect();
      const threatenedIndex = game.starterPackBase.findIndex((card) => card.name === threatenedActorName);
      const threatenedNode = threatenedActorName === game.playerStock.name
        ? playerStockRef.current
        : threatenedIndex >= 0
          ? starterPackBenchRefs.current[threatenedIndex]
          : null;
      const toRect = threatenedNode?.getBoundingClientRect();
      if (!fromRect || !toRect) {
        setMaulTelegraphPath(null);
        return;
      }
      const startX = fromRect.left + fromRect.width * 0.5;
      const startY = fromRect.bottom - 1;
      const endX = toRect.left + toRect.width * 0.3;
      const endY = toRect.top + toRect.height * 0.28;
      const midX = startX + ((endX - startX) * 0.46);
      const controlOneX = startX;
      const controlOneY = startY + 44;
      const controlTwoX = midX;
      const controlTwoY = endY - 14;
      setMaulTelegraphPath(`M ${startX} ${startY} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${endX} ${endY}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    game.enemyProfileId,
    game.heroGuardTauntTurns,
    game.enemyStockActionPoints,
    game.playerStock.name,
    game.starterPackBase,
    game.tutorialEnemyDefeated,
    showThreatRail,
    viewport.height,
    viewport.width,
  ]);
  const starterPackSlots = useMemo(
    () => {
      const tutorialSelectableIndices = getTutorialSelectableStarterPackIndices(game);
      return game.starterPackBase.map((card, index) => ({
        card,
        index,
        active: index === game.activeStarterPackIndex,
        used: game.starterPackUsed[index] ?? false,
        locked: game.starterPackLocked[index] ?? false,
        selectable: index !== game.activeStarterPackIndex
          && (isTutorialScenario
            ? tutorialSelectableIndices.has(index)
            : true)
          && !(game.starterPackLocked[index] ?? false),
        cashout: game.starterPackCashoutStats[index] ?? null,
        storedAp: index === game.activeStarterPackIndex ? game.playerStockActionPoints : (game.starterPackStoredAp[index] ?? 0),
        mode: game.starterPackModes[index] ?? 'default',
        meta: {
          ...(STARTER_KIN_METADATA[card.name] ?? { benchWeight: 1, abilityName: null }),
          abilityName: getStarterPackAbilityName(card.name, game.starterPackAbilityRarities[index] ?? 1),
        },
      }));
    },
    [game.activeStarterPackIndex, game.playerStockActionPoints, game.starterPackAbilityRarities, game.starterPackBase, game.starterPackCashoutStats, game.starterPackLocked, game.starterPackModes, game.starterPackStoredAp, isTutorialScenario]
  );
  const visibleBenchSlots = useMemo(
    () => starterPackSlots.filter((slot) => !slot.active),
    [starterPackSlots]
  );
  const mirroredPlayerBenchSlots = useMemo(
    () => Array.from({ length: 4 }, (_, index) => visibleBenchSlots[index] ?? null),
    [visibleBenchSlots]
  );
  const playerBenchLeftSlots = useMemo(() => mirroredPlayerBenchSlots.slice(0, 2), [mirroredPlayerBenchSlots]);
  const playerBenchRightSlots = useMemo(() => mirroredPlayerBenchSlots.slice(2, 4), [mirroredPlayerBenchSlots]);
  const mirroredEnemyBenchSlots = useMemo(
    () => Array.from({ length: 4 }, (_, index) => {
      const card = game.enemyBench[index] ?? null;
      if (!card) return null;
      return {
        card,
        benchIndex: index,
        profile: enemyBenchProfiles[index] ?? currentEnemyProfile,
      };
    }),
    [currentEnemyProfile, enemyBenchProfiles, game.enemyBench]
  );
  const enemyBenchLeftSlots = useMemo(() => mirroredEnemyBenchSlots.slice(0, 2), [mirroredEnemyBenchSlots]);
  const enemyBenchRightSlots = useMemo(() => mirroredEnemyBenchSlots.slice(2, 4), [mirroredEnemyBenchSlots]);
  const tutorialSlice01RemainingCards = useMemo(
    () => game.tutorialSliceId === 'slice-01'
      ? game.tableau.reduce((sum, column) => sum + column.length, 0)
      : 0,
    [game.tableau, game.tutorialSliceId]
  );
  const tutorialMochiRescueStage = useMemo(() => {
    if (game.tutorialSliceId !== 'slice-01') return null;
    if (tutorialSlice01RemainingCards > 14) {
      return {
        label: 'Top row to clear',
        detail: 'Rise from A to 8 to expose the second layer.',
        coverHeight: '72%',
      };
    }
    if (tutorialSlice01RemainingCards > 7) {
      return {
        label: 'Second row to clear',
        detail: 'Sweep back from 8 to 2 to reach the wrap line.',
        coverHeight: '44%',
      };
    }
    return {
      label: 'Final wrap line',
      detail: 'Wrap through K, Q, J, then back to A to free Mochi.',
      coverHeight: '14%',
    };
  }, [game.tutorialSliceId, tutorialSlice01RemainingCards]);
  const tutorialMochiRescueCard = useMemo<CardType>(
    () => ({ id: 'tutorial-rescue-mochi', rank: 9, suit: '♦', element: 'N', name: 'Mochi' }),
    []
  );
  const tutorialMochiRescueVitals = useMemo(
    () => ({ ...getCombatVitals(game, tutorialMochiRescueCard), hp: 1, hpMax: 10 }),
    [game, tutorialMochiRescueCard]
  );
  const tutorialMochiRewardCombatant = useMemo(
    () => {
      const base = game.combatants.mochi ?? createCombatant('Mochi');
      return { ...base, hp: 1, hpMax: 10, haste: 0, narrowEscape: 1, skittish: 5 };
    },
    [game.combatants.mochi]
  );
  const tutorialMochiProfile = useMemo(() => getKinProfile('Mochi'), []);
  const isMochiRescueScenario = game.tutorialSliceId === 'slice-01' || game.scenarioId === 'rng';
  const tutorialMochiRewardEffects = useMemo(
    () => {
      const nineLives = getKinEffectDefinition(tutorialMochiProfile.passiveName ?? 'Nine Lives');
      const narrowEscape = getKinEffectDefinition('Narrow Escape');
      const skittish = getKinEffectDefinition('Skittish');
      return [nineLives, narrowEscape, skittish]
        .filter((effect): effect is KinEffectDefinition => !!effect)
        .map((effect) => ({
          key: effect.key,
          label: effect.label,
          tone: effect.tone,
          name: effect.name,
          flavor: effect.flavorText,
          effect: effect.name === 'SKITTISH'
            ? 'Cannot swap to prime for 5 actions.'
            : effect.effectText,
        }));
    },
    [tutorialMochiProfile.passiveName]
  );
  const tutorialClearedGoal = game.tutorialSliceId === 'slice-01' ? 13 : 35;
  const tutorialClearedDisplay = game.tutorialSliceId === 'slice-01'
    ? Math.min(game.clearedCount, tutorialClearedGoal)
    : game.clearedCount;
  const tutorialMochiTargetColumn = useMemo(() => {
    if (!isMochiRescueScenario) return null;
    return RNG_MOCHI_TARGET_COLUMN;
  }, [isMochiRescueScenario]);
  const tutorialMochiTargetCardId = useMemo(() => {
    if (!isMochiRescueScenario || tutorialMochiTargetColumn === null) return null;
    const column = game.tableau[tutorialMochiTargetColumn] ?? [];
    return game.scenarioId === 'rng'
      ? (column.find((card) => card.name === 'Mochi')?.id ?? null)
      : (column.find((card) => card.rank === 2)?.id ?? null);
  }, [game.scenarioId, game.tableau, isMochiRescueScenario, tutorialMochiTargetColumn]);
  const tutorialSceneOptions = useMemo<Array<{ id: TutorialSceneId; label: string; detail: string }>>(
    () => TUTORIAL_SCENE_SEEDS.map((seed) => ({
      id: seed.sceneId,
      label: seed.label,
      detail: seed.detail,
    })),
    []
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const issues = getTutorialRailAuditIssues();
    if (issues.length > 0) {
      console.error('Tutorial rail audit failed:\n' + issues.join('\n'));
    }
  }, []);

  useEffect(() => {
    if (!isMochiRescueScenario || tutorialMochiTargetColumn === null || !tutorialMochiTargetCardId || showTutorialRewardModal) {
      setTutorialMochiMarkerAnchor(null);
      return;
    }

    let frameId = 0;
    const updateAnchor = () => {
      const rootRect = gameRootRef.current?.getBoundingClientRect();
      const targetRect = tableauCardRefs.current[tutorialMochiTargetCardId]?.getBoundingClientRect();
      if (!rootRect || !targetRect) {
        setTutorialMochiMarkerAnchor(null);
        return;
      }
      setTutorialMochiMarkerAnchor({
        x: targetRect.left - rootRect.left + targetRect.width * 0.5,
        y: targetRect.top - rootRect.top,
      });
    };

    const scheduleUpdate = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateAnchor);
    };

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [boardCardSize.height, game.tableau, isMochiRescueScenario, showTutorialRewardModal, tutorialMochiTargetCardId, tutorialMochiTargetColumn, viewport.height, viewport.width]);
  useEffect(() => {
    if (!isMochiRescueScenario || tutorialMochiTargetColumn === null || !tutorialMochiTargetCardId) {
      mochiTokenVisibleRef.current = false;
      return;
    }

    const column = game.tableau[tutorialMochiTargetColumn];
    const targetCard = column?.find((card) => card.id === tutorialMochiTargetCardId) ?? null;
    const isTokenVisible = !!targetCard;

    if (isTokenVisible && !mochiTokenVisibleRef.current) {
      const node = tableauCardRefs.current[tutorialMochiTargetCardId];
      const sourcePoint = getCardCenterPoint(node);
      if (sourcePoint) {
        const flashId = Date.now();
        setRescueCardFlash({ id: flashId, x: sourcePoint.x, y: sourcePoint.y, tone: 'red' });
        if (rescueCardFlashTimeoutRef.current !== null) {
          window.clearTimeout(rescueCardFlashTimeoutRef.current);
        }
        rescueCardFlashTimeoutRef.current = window.setTimeout(() => {
          setRescueCardFlash((current) => (current?.id === flashId ? null : current));
          rescueCardFlashTimeoutRef.current = null;
        }, 1800);
      }
    }
    mochiTokenVisibleRef.current = isTokenVisible;
  }, [game.tableau, isMochiRescueScenario, tutorialMochiTargetCardId, tutorialMochiTargetColumn]);

  const remainingStarterPackChoices = useMemo(
    () => starterPackSlots.filter((slot) => slot.selectable),
    [starterPackSlots]
  );
  const sequentialTagStarterPackSlots = useMemo(
    () => remainingStarterPackChoices.filter((slot) => canPlayOnStock(slot.card, game.playerStock)),
    [game.playerStock, remainingStarterPackChoices]
  );
  const hasDirectTableauPlay = useMemo(
    () => game.tableau.some((column) => {
      const topCard = column[column.length - 1];
      return !!topCard && getEligiblePlayerTargetsForCard(game, topCard).length > 0;
    }),
    [game.playerStock, game.tableau]
  );
  const warnDeadlock = useMemo(() => {
    const playableColumns = game.tableau
      .map((column, columnIndex) => ({
        topCard: column[column.length - 1] ?? null,
        columnIndex,
      }))
      .filter((entry) => !!entry.topCard && getEligiblePlayerTargetsForCard(game, entry.topCard!).length > 0);
    if (playableColumns.length !== 1) return false;
    const nextPlay = playableColumns[0];
    const nextTableau = simulateTableauAfterTopPlay(game.tableau, nextPlay.columnIndex);
    return !nextTableau.some((column) => {
      const topCard = column[column.length - 1];
      return !!topCard && canPlayOnStock(topCard, nextPlay.topCard!);
    });
  }, [game.playerStock, game.tableau]);
  const supportBenchIndex = getSupportBenchIndex(game);
  const supportBenchCard = game.playerBench[supportBenchIndex] ?? null;
  const assistBenchIndices = getAssistBenchIndices(game);
  const heroSupportPrototype = activeActorName === 'Hero';
  const supportSquareSize = Math.max(56, Math.round(handCardSize.width * 1.02));
  const starterPackCardSize = useMemo(() => {
    const cardRatio = boardCardSize.width / boardCardSize.height;
    const height = Math.round(boardCardSize.height * 0.9);
    return {
      width: Math.round(height * cardRatio),
      height,
    };
  }, [boardCardSize.height, boardCardSize.width]);
  const activePartyPowerLevel = useMemo(
    () => game.starterPackBase.reduce((sum, card) => sum + (STARTER_KIN_METADATA[card.name]?.benchWeight ?? 1), 0),
    [game.starterPackBase]
  );
  const renderKinMeter = useCallback((actorName: string, actionPoints: number, mode: StarterKinMode, rarity: 1 | 2 | 3, meterId: string, compact = true) => {
    void mode;
    void rarity;
    void meterId;

    return (
      <div className={`pointer-events-auto absolute inset-x-2 z-20 ${compact ? 'bottom-2' : 'bottom-3'}`}>
        <AbilityApBar
          ap={actionPoints}
          maxAp={getActorApCap(actorName)}
          className="px-2 py-2"
          barClassName="h-3.5 rounded-[5px]"
        />
      </div>
    );
  }, []);
  const renderFormationPlaceholder = (title: string, key: string) => (
    <div
      key={key}
      className="flex items-center justify-center rounded-full border border-dashed border-white/10 bg-black/18 px-3 py-2"
      style={{ width: Math.max(44, Math.round(starterPackCardSize.width * 0.58)), minHeight: 34 }}
    >
      <div className="text-center">
        <div className="text-[8px] font-black uppercase tracking-[0.16em] text-white/42">{title}</div>
      </div>
    </div>
  );
  const renderPlayerBenchSlot = (slot: (typeof visibleBenchSlots)[number] | null, key: string) => {
    if (!slot) return null;
    const sequentialTagActive = sequentialTagStarterPackSlots.some((entry) => entry.index === slot.index);
    const tutorialSwapReady = isTutorialScenario && slot.selectable;
    const showFaceDown = false;
    const benchCombatant = game.combatants[actorKeyFromName(slot.card.name)] ?? createCombatant(slot.card.name);
    const isHidden = game.hiddenStarterPackIndices.includes(slot.index);
    const showMochiReadyDialog =
      slot.card.name === 'Mochi' &&
      game.tutorialSliceId === 'slice-02' &&
      game.playerStock.name !== 'Mochi' &&
      (game.combatants.mochi?.skittish ?? 0) <= 0;
    return (
      <div key={key} className="flex flex-col items-center gap-1">
        <button
          ref={(node) => {
            starterPackBenchRefs.current[slot.index] = node;
          }}
          type="button"
          onPointerDown={() => handleStarterBenchPointerDown(slot.index)}
          onPointerUp={handleStarterBenchPointerEnd}
          onPointerCancel={handleStarterBenchPointerEnd}
          onClick={() => {
            if (isHidden) return;
            if (suppressStarterBenchClickRef.current) {
              suppressStarterBenchClickRef.current = false;
              return;
            }
            if (!slot.selectable) return;
            if (isTutorialScenario) {
              switchStarterPackStock(slot.index, false);
              return;
            }
            if (sequentialTagActive) {
              switchStarterPackStock(slot.index, true);
            } else {
              switchStarterPackStock(slot.index, false);
            }
          }}
          disabled={!slot.selectable || isHidden}
          className={`relative transition-all ${
            (tutorialSwapReady || sequentialTagActive) && !isHidden
              ? 'hover:-translate-y-0.5'
              : ''
          }`}
          style={
            isHidden ? { opacity: 0, pointerEvents: 'none' } : (
            tutorialSwapReady
              ? {
                  filter: 'drop-shadow(0 0 20px rgba(112,229,240,0.28))',
                  opacity: 1,
                  zIndex: showMochiReadyDialog ? 40 : undefined,
                  animation: highlightedActorNames.includes(slot.card.name) ? 'golf-actor-blink 0.72s ease-in-out 2' : undefined,
                }
              : sequentialTagActive
                ? {
                    filter: 'drop-shadow(0 0 16px rgba(230,179,30,0.28))',
                    animation: highlightedActorNames.includes(slot.card.name) ? 'golf-actor-blink 0.72s ease-in-out 2' : undefined,
                  }
                : slot.locked
                  ? {
                      filter: 'saturate(0.88) brightness(0.9)',
                      opacity: 0.94,
                      animation: highlightedActorNames.includes(slot.card.name) ? 'golf-actor-blink 0.72s ease-in-out 2' : undefined,
                    }
                  : {
                      filter: 'none',
                      opacity: 1,
                      animation: highlightedActorNames.includes(slot.card.name) ? 'golf-actor-blink 0.72s ease-in-out 2' : undefined,
                    }
            )
          }
        >
          {!showFaceDown && slot.card.name === 'Mochi' ? (
            <ActorFrameEmojiRig
              emojiRig={{
                src: '/assets/actors/mochikin/mochi_emoji_blush.png',
                emotionType: 'happy',
                speaking: showMochiReadyDialog
                  ? {
                      text: "I'm ready, Hero!",
                      subtitle: 'Swap Me In',
                    }
                  : undefined,
              }}
            />
          ) : null}
          {!showFaceDown ? (
            <ActorStatusRail
              actorName={slot.card.name}
              combatant={benchCombatant}
              maxVisible={3}
              iconSize={18}
              compact
              highlightedKeys={highlightedStatusKeys}
              flashVersions={statusFlashVersions}
              transientStatuses={transientStatusEvents.filter((entry) => entry.actorName === slot.card.name)}
            />
          ) : null}
          <Card
            card={slot.card}
            faceDown={showFaceDown}
            showGraphics={false}
            size={starterPackCardSize}
            foundationOverlay={!showFaceDown ? getCombatVitals(game, slot.card) : undefined}
            suitFontSizeOverride={0}
            maskValue={!showFaceDown}
            disableAnimation
            disableTilt
            disableHoverLift
          />
          {!showFaceDown ? (
            <>
              <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2">
                <div className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/88 [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_6px_rgba(255,255,255,0.12)]">
                  {slot.card.name}
                </div>
                <div />
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-[52px] z-20 flex justify-center">
                <div
                  className="text-[26px] font-black leading-none [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_6px_rgba(255,255,255,0.18)]"
                  style={{
                    color: slot.selectable ? '#ffffff' : 'rgba(255,255,255,0.42)',
                    opacity: slot.selectable ? 1 : 0.68,
                  }}
                >
                  {rankLabel(slot.card.rank)}
                </div>
              </div>
            </>
          ) : (
            <div className="pointer-events-none absolute inset-x-0 top-1.5 z-20 flex justify-center">
              <div className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/78 [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_6px_rgba(255,255,255,0.1)]">
                {slot.card.name}
              </div>
            </div>
          )}
          {!showFaceDown ? renderKinMeter(
            slot.card.name,
            slot.storedAp,
            slot.mode,
            game.starterPackAbilityRarities[slot.index] ?? 1,
            `bench-${slot.index}`,
            true
          ) : null}
          {slot.locked && !showFaceDown ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 rounded-full border border-game-gold/30 bg-black/72 px-2 py-1 text-center text-[8px] font-black uppercase tracking-[0.14em] text-game-gold/75">
              Locked In
            </div>
          ) : null}
          {starterBenchLockIndexRef.current === slot.index ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 h-1.5 overflow-hidden rounded-full border border-game-gold/30 bg-black/72">
              <div className="h-full rounded-full bg-game-gold" style={{ width: `${Math.min(100, Math.max(0, starterBenchLockProgress * 100))}%` }} />
            </div>
          ) : null}
          {showFaceDown && slot.cashout ? <ApBadge actionPoints={slot.cashout.actionPoints} /> : null}
        </button>
      </div>
    );
  };
  const renderEnemyBenchSlot = (slot: (typeof mirroredEnemyBenchSlots)[number], key: string) => {
    if (!slot) return renderFormationPlaceholder('Support', key);
    return (
      <button
        key={key}
        ref={(node) => {
          enemyBenchRefs.current[slot.benchIndex] = node;
        }}
        type="button"
        className="relative rounded-[18px] border border-white/10 bg-black/30 p-1"
        style={{
          animation: highlightedActorNames.includes(slot.card.name) ? 'golf-actor-blink 0.72s ease-in-out 2' : undefined,
        }}
      >
        <Card
          card={slot.card}
          showGraphics={false}
          size={starterPackCardSize}
          foundationOverlay={getCombatVitals(game, slot.card)}
          suitFontSizeOverride={0}
          hideElements
          maskValue
          disableAnimation
          disableTilt
          disableHoverLift
        />
        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-center">
          <div className="w-full px-1 py-0.5 text-center text-[8px] font-black uppercase tracking-[0.12em] text-white/82 [text-shadow:0_1px_0_rgba(0,0,0,0.9)]">
            {slot.profile.actor.name}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-[52px] z-20 flex justify-center">
          <div className="text-[24px] font-black leading-none text-white [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_8px_rgba(255,255,255,0.14)]">
            {rankLabel(slot.card.rank)}
          </div>
        </div>
        <StaggerPressureBadge
          pressure={(game.combatants[actorKeyFromName(slot.card.name)]?.staggerPressure ?? 0)}
          compact
        />
      </button>
    );
  };
  const starterKinStickers = useMemo(
    () => ({
      left: game.kinStickers.filter((sticker) => sticker.speciesId === 'jet' || sticker.speciesId === 'whis'),
      right: game.kinStickers.filter((sticker) => sticker.speciesId === 'pan'),
    }),
    [game.kinStickers]
  );
  const partyDiscardCounts = useMemo(() => getDiscardCountsByActor(game.playerDiscardPile), [game.playerDiscardPile]);
  const canUseBenchAbilityUi = useCallback((benchIndex: number) => {
    const card = game.playerBench[benchIndex];
    if (!card) return false;
    const role = getBenchRole(game, benchIndex);
    const availableAp = game.playerStockActionPoints;
    const cost = getBenchAbilityCost(card, role);
    if (availableAp < cost) return false;
    if (card.name === 'Mochi') {
      const mochiIndex = getMochiStarterPackIndex(game);
      return mochiIndex >= 0
        && mochiIndex !== game.activeStarterPackIndex
        && (game.combatants.mochi?.skittish ?? 0) <= 0;
    }
    if (card.name === 'Whis') return !!lastUndoRef.current;
    return true;
  }, [game]);
  const inspectedKinCard = useMemo(() => {
    if (kinInspectIndex === null) return null;
    if (kinInspectIndex === -1) return game.playerStock;
    return game.playerBench[kinInspectIndex] ?? null;
  }, [game.playerBench, game.playerStock, kinInspectIndex]);
  const inspectedKinTaxonomy = useMemo(() => {
    if (!inspectedKinCard) return null;
    return getKinInspectorSlots(inspectedKinCard.name, { left: leftHandSlot, right: rightHandSlot });
  }, [inspectedKinCard, leftHandSlot, rightHandSlot]);
  const inspectorNarrative = useMemo(
    () => getKinInspectorNarrative(inspectedKinCard),
    [inspectedKinCard]
  );
  const inspectedKinSections = useMemo(() => {
    if (!inspectedKinTaxonomy) return [];
    return [
      { key: 'signature', title: 'Signature', slots: inspectedKinTaxonomy.signature },
      { key: 'tableau-clear', title: 'Tableau Clear', slots: inspectedKinTaxonomy.tableauClear },
      { key: 'tool', title: 'Tool Abilities', slots: inspectedKinTaxonomy.tools },
      { key: 'battle', title: 'Battle And Passive', slots: inspectedKinTaxonomy.battle },
    ].filter((section) => section.slots.length > 0);
  }, [inspectedKinTaxonomy]);
  const showKinInspector = kinInspectIndex !== null && inspectedKinCard !== null && inspectedKinTaxonomy !== null;
  const clearStickyHold = useCallback(() => {
    if (stickyHoldTimeoutRef.current !== null) {
      window.clearTimeout(stickyHoldTimeoutRef.current);
      stickyHoldTimeoutRef.current = null;
    }
    if (stickyHoldRafRef.current) {
      window.cancelAnimationFrame(stickyHoldRafRef.current);
      stickyHoldRafRef.current = 0;
    }
    stickyHoldStartRef.current = 0;
    setStickyHoldProgress(0);
  }, []);

  const clearAbilityTooltipHold = useCallback(() => {
    if (abilityTooltipHoldTimeoutRef.current !== null) {
      window.clearTimeout(abilityTooltipHoldTimeoutRef.current);
      abilityTooltipHoldTimeoutRef.current = null;
    }
    if (abilityTooltipHoldRafRef.current) {
      window.cancelAnimationFrame(abilityTooltipHoldRafRef.current);
      abilityTooltipHoldRafRef.current = 0;
    }
    abilityTooltipHoldStartRef.current = 0;
    setAbilityTooltipHoldSlotId(null);
    setAbilityTooltipHoldProgress(0);
  }, []);

  const clearDevAbilityHold = useCallback(() => {
    if (devAbilityHoldTimeoutRef.current !== null) {
      window.clearTimeout(devAbilityHoldTimeoutRef.current);
      devAbilityHoldTimeoutRef.current = null;
    }
    if (devAbilityHoldRafRef.current) {
      window.cancelAnimationFrame(devAbilityHoldRafRef.current);
      devAbilityHoldRafRef.current = 0;
    }
    devAbilityHoldStartRef.current = 0;
    setDevAbilityHoldSlotId(null);
    setDevAbilityHoldProgress(0);
  }, []);

  const handleAbilityTooltipPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>, slot: PlayerHandSlot) => {
    if (event.button !== 0 || slot.kind !== 'ability') return;
    clearAbilityTooltipHold();
    setAbilityTooltipHoldSlotId(slot.slotId as HandSlotId);
    abilityTooltipHoldStartRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - abilityTooltipHoldStartRef.current;
      setAbilityTooltipHoldProgress(clampNumber(elapsed / DEV_ABILITY_HOLD_MS, 0, 1));
      if (elapsed < DEV_ABILITY_HOLD_MS) {
        abilityTooltipHoldRafRef.current = window.requestAnimationFrame(tick);
      }
    };
    abilityTooltipHoldRafRef.current = window.requestAnimationFrame(tick);
    abilityTooltipHoldTimeoutRef.current = window.setTimeout(() => {
      suppressAbilityClickRef.current = true;
      setPinnedTooltipSlotId(slot.slotId as HandSlotId);
      clearAbilityTooltipHold();
    }, DEV_ABILITY_HOLD_MS);
  }, [clearAbilityTooltipHold]);

  const handleAbilityTooltipPointerEnd = useCallback(() => {
    clearAbilityTooltipHold();
  }, [clearAbilityTooltipHold]);

  const handleAbilityTooltipClickCapture = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!suppressAbilityClickRef.current) return;
    suppressAbilityClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const canUseAbilitySlot = useCallback((slot: PlayerHandSlot) => {
    if (currentTurn !== 'player') return false;
    if (slot.effect && !isTutorialAbilityVisible(game, slot.effect)) return false;
    if (!(slot.effect === 'rewire' && game.playerStock.name === 'Jet') && getAbilityCooldown(game, slot.effect) > 0) return false;
    if (slot.effect === 'fetch') {
      return game.playerStock.name === 'Hero'
        && game.playerStockActionPoints >= 2
        && !!getBestFetchCandidate(game)
        && (game.playerCapturedLeft === null || game.playerCapturedRight === null);
    }
    if (slot.effect === 'vice-grip') return false;
    if (slot.effect === 'hero-guard') return false;
    if (slot.effect === 'ironfur') {
      return game.playerStock.name === 'Hero' && game.playerStockActionPoints >= 4;
    }
    if (slot.effect === 'tap-out') {
      const mochiIndex = getMochiStarterPackIndex(game);
      const mochiCombatant = game.combatants.mochi;
      if (game.playerStock.name === 'Mochi') {
        if (game.tutorialSliceId === 'slice-02') return false;
        const rarity = game.starterPackAbilityRarities[game.activeStarterPackIndex] ?? 1;
        return game.playerStockActionPoints >= 3
          && (mochiCombatant?.whiskersense ?? 0) > 0
          && findBestExclusionPath(game.tableau, nonCombatGlobalPeekCount, getZoomiesClaimCap(rarity)).length > 0;
      }
      return game.playerStockActionPoints >= 3
        && mochiIndex >= 0
        && mochiIndex !== game.activeStarterPackIndex
        && (game.combatants.mochi?.skittish ?? 0) <= 0;
    }
    if (slot.effect === 'banks-strike') {
      return game.playerStock.name === 'Banks' && game.playerStockActionPoints >= 1;
    }
    if (slot.effect === 'battery') {
      return game.playerStock.name === 'Jet';
    }
    if (slot.effect === 'path-of-stars') {
      return game.playerStock.name === 'Pan' && game.playerStockActionPoints >= 10;
    }
    if (slot.effect === 'paw-sperity') {
      return game.playerStock.name === 'Pan';
    }
    if (slot.effect === 'jikan') {
      return game.playerStock.name === 'Whis' && game.playerStockActionPoints >= 2 && !!lastUndoRef.current;
    }
    if (slot.effect === 'slipstream') {
      return game.playerStock.name === 'Whis' && game.playerStockActionPoints >= 4;
    }
    if (slot.effect === 'rigged-construct') {
      return game.playerStock.name === 'Jet' && (game.riggedConstructCards.length > 0 || (getJetBatteryCharge(game, slot.effect) > 0 && game.riggedConstructCooldown === 0));
    }
    if (slot.effect === 'rewire') {
      return game.playerStock.name === 'Jet' && (game.jetRewireActionsRemaining > 0 || game.playerStockActionPoints >= JET_REWIRE_COST);
    }
    if (slot.effect === 'scrap-plating' || slot.effect === 'aegis-shunt') {
      return game.playerStock.name === 'Jet' && getJetBatteryCharge(game, slot.effect) > 0;
    }
    if (slot.effect === 'sticky-paws') {
      return game.playerStock.name === 'Jet' && getJetBatteryCharge(game, slot.effect) > 0;
    }
    return true;
  }, [currentTurn, game]);
  const canOpenStickyPawsSteal = currentTurn === 'player'
    && game.playerStock.name === 'Jet'
    && getJetBatteryCharge(game, 'sticky-paws') > 0
    && game.stickyPawsCooldown <= 0
    && enemyStealOptions.length > 0;
  const stickyPawsPreviewActive = currentTurn === 'player'
    && game.playerStock.name === 'Jet'
    && getJetBatteryCharge(game, 'sticky-paws') > 0
    && game.stickyPawsCooldown <= 0;

  const getConstructTopCard = useCallback(() => {
    const topCard = game.riggedConstructCards[game.riggedConstructCards.length - 1] ?? null;
    return topCard ?? {
      id: 'rigged-construct-wild',
      rank: 1,
      suit: '♠',
      element: 'N',
      name: 'Construct',
    };
  }, [game.riggedConstructCards]);

  const getActorAnchor = useCallback((actorName: string) => {
    if (actorName === game.playerStock.name) return getCardCenterPoint(playerStockRef.current);
    if (actorName === game.enemyStock.name) return getCardCenterPoint(enemyStockRef.current);
    const enemyBenchIndex = game.enemyBench.findIndex((card) => card.name === actorName);
    if (enemyBenchIndex >= 0) return getCardCenterPoint(enemyBenchRefs.current[enemyBenchIndex]);
    const benchIndex = game.playerBench.findIndex((card) => card.name === actorName);
    return benchIndex >= 0 ? getCardCenterPoint(playerBenchRefs.current[benchIndex]) : null;
  }, [game.enemyBench, game.enemyStock.name, game.playerBench, game.playerStock.name]);

  const queueDialogueCallout = useCallback((actorName: string, text: string, delayMs = 0, subtitle = 'Dialogue') => {
    const timeoutId = window.setTimeout(() => {
      const anchor = getActorAnchor(actorName);
      if (!anchor) return;
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setDialogueCallouts((prev) => [...prev, { id, text, subtitle, anchor }]);
      const removeTimeoutId = window.setTimeout(() => {
        setDialogueCallouts((prev) => prev.filter((entry) => entry.id !== id));
      }, 5200);
      dialogueCalloutTimeoutsRef.current.push(removeTimeoutId);
    }, delayMs);
    dialogueCalloutTimeoutsRef.current.push(timeoutId);
  }, [getActorAnchor]);

  const triggerWhisProphecy = useCallback(() => {
    if (!whisProphecyCharged || game.playerSupportActionUsed || whisProphecyPath.length === 0) return;
    setGuidePlan({
      path: whisProphecyPath,
      progress: 0,
      source: 'prophecy',
      visibleSteps: 5,
    });
    setGame((prev) => ({
      ...prev,
      playerSupportActionUsed: true,
    }));
    queueDialogueCallout('Whis', 'Prophecy engaged.', 110, 'Time Peek');
  }, [game.playerSupportActionUsed, queueDialogueCallout, whisProphecyCharged, whisProphecyPath]);
  useEffect(() => {
    triggerWhisProphecy();
  }, [triggerWhisProphecy]);

  const queueAnchoredCallout = useCallback((anchor: { x: number; y: number } | null, text: string, subtitle = 'Combat') => {
    if (!anchor) return;
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setDialogueCallouts((prev) => [...prev, { id, text, subtitle, anchor }]);
    const removeTimeoutId = window.setTimeout(() => {
      setDialogueCallouts((prev) => prev.filter((entry) => entry.id !== id));
    }, 5200);
    dialogueCalloutTimeoutsRef.current.push(removeTimeoutId);
  }, []);

  const appendCombatLog = useCallback((entry: CombatLogEntry) => {
    if (typeof window === 'undefined') return;
    try {
      const existing = JSON.parse(window.localStorage.getItem(GOLF_COMBAT_LOG_KEY) ?? '[]') as CombatLogEntry[];
      const nextEntries = [...existing.slice(-1999), entry];
      window.localStorage.setItem(GOLF_COMBAT_LOG_KEY, JSON.stringify(nextEntries));

      const stats = JSON.parse(window.localStorage.getItem(GOLF_COMBAT_LOG_STATS_KEY) ?? '{}') as Record<string, number>;
      const actorKey = `actor:${entry.actor}`;
      const typeKey = `type:${entry.type}`;
      stats[actorKey] = (stats[actorKey] ?? 0) + 1;
      stats[typeKey] = (stats[typeKey] ?? 0) + 1;
      if (typeof entry.detail.effect === 'string') {
        const effectKey = `effect:${entry.detail.effect}`;
        stats[effectKey] = (stats[effectKey] ?? 0) + 1;
      }
      if (typeof entry.detail.damage === 'number') {
        const damageKey = `damage:${entry.actor}`;
        stats[damageKey] = (stats[damageKey] ?? 0) + Number(entry.detail.damage);
      }
      window.localStorage.setItem(GOLF_COMBAT_LOG_STATS_KEY, JSON.stringify(stats));
    } catch {
      // Ignore local storage failures; logging is auxiliary.
    }
  }, []);

  const handleBatteryTransfer = useCallback((target: 'prime' | number) => {
    if (game.playerStock.name !== 'Jet' || game.batteryMode === null) return false;
    let changed = false;
    setGame((prev) => {
      if (prev.batteryMode === null) return prev;
      let next = { ...prev };
      if (prev.batteryMode === 'store') {
        if (target === 'prime') {
          if (prev.playerStockActionPoints <= 0) return prev;
          next = {
            ...next,
            batteryStoredActionPoints: prev.batteryStoredActionPoints + prev.playerStockActionPoints,
            playerStockActionPoints: 0,
            batteryMode: null,
          };
          changed = true;
        } else {
          const actorAp = prev.playerBenchActionPoints[target] ?? 0;
          if (actorAp <= 0) return prev;
          const nextBenchActionPoints = [...prev.playerBenchActionPoints];
          nextBenchActionPoints[target] = 0;
          next = {
            ...next,
            batteryStoredActionPoints: prev.batteryStoredActionPoints + actorAp,
            playerBenchActionPoints: nextBenchActionPoints,
            batteryMode: null,
          };
          changed = true;
        }
      } else {
        if (prev.batteryStoredActionPoints <= 0) return { ...prev, batteryMode: null };
        if (target === 'prime') {
          const primeCap = hasAssistJet(prev) ? BATTERY_TARGET_CHARGE + 2 : BATTERY_TARGET_CHARGE;
          const releaseAmount = prev.playerStockActionPoints >= primeCap
            ? prev.batteryStoredActionPoints
            : Math.min(prev.batteryStoredActionPoints, primeCap - prev.playerStockActionPoints);
          const routedAp = routePrimeApWithAssistJet(prev, releaseAmount);
          next = {
            ...next,
            playerStockActionPoints: routedAp.playerStockActionPoints,
            assistJetMicroBatteryAp: routedAp.assistJetMicroBatteryAp,
            batteryStoredActionPoints: prev.batteryStoredActionPoints - releaseAmount,
            batteryMode: prev.batteryStoredActionPoints - releaseAmount > 0 ? 'release' : null,
          };
          changed = true;
        } else {
          const currentAp = prev.playerBenchActionPoints[target] ?? 0;
          const releaseAmount = currentAp >= BATTERY_TARGET_CHARGE
            ? prev.batteryStoredActionPoints
            : Math.min(prev.batteryStoredActionPoints, BATTERY_TARGET_CHARGE - currentAp);
          const nextBenchActionPoints = [...prev.playerBenchActionPoints];
          nextBenchActionPoints[target] = currentAp + releaseAmount;
          next = {
            ...next,
            playerBenchActionPoints: nextBenchActionPoints,
            batteryStoredActionPoints: prev.batteryStoredActionPoints - releaseAmount,
            batteryMode: prev.batteryStoredActionPoints - releaseAmount > 0 ? 'release' : null,
          };
          changed = true;
        }
      }
      return next;
    });
    if (changed) {
      appendCombatLog({
        timestamp: Date.now(),
        biomeId: game.biomeId,
        type: 'ability',
        actor: 'Jet',
        detail: { effect: 'battery', mode: game.batteryMode, stored: game.batteryStoredActionPoints },
      });
      queueDialogueCallout('Jet', game.batteryMode === 'store' ? 'Charged and ready.' : 'Power rerouted.', 80);
    }
    return changed;
  }, [appendCombatLog, game.batteryMode, game.biomeId, game.batteryStoredActionPoints, game.playerStock.name, queueDialogueCallout]);

  const ageCombatantsAtTurnBoundary = useCallback((combatants: Record<string, ActorCombatState>) => {
    const nextCombatants = { ...combatants };
    Object.entries(nextCombatants).forEach(([key, combatant]) => {
      let nextCombatant = { ...combatant, elementalShields: { ...combatant.elementalShields } };
      nextCombatant.harmfulTickMeter += nextCombatant.slow > 0 ? 2 : nextCombatant.haste > 0 ? 0.5 : 1;
      nextCombatant.beneficialTickMeter += nextCombatant.haste > 0 ? 2 : nextCombatant.slow > 0 ? 0.5 : 1;

      while (nextCombatant.harmfulTickMeter >= 1) {
        nextCombatant.harmfulTickMeter -= 1;
        if (nextCombatant.burn > 0) {
          nextCombatant.hp = Math.max(0, nextCombatant.hp - nextCombatant.burn);
        }
        if (nextCombatant.doomCounter !== null) {
          nextCombatant.doomCounter = Math.max(0, nextCombatant.doomCounter - 1);
          if (nextCombatant.doomCounter === 0) {
            nextCombatant.hp = 0;
            nextCombatant.doomCounter = null;
          }
        }
        nextCombatant.slow = Math.max(0, nextCombatant.slow - 1);
        if (nextCombatant.counterWindow > 0) {
          nextCombatant.counterWindow -= 1;
          if (nextCombatant.counterWindow === 0) {
            nextCombatant.counterDamage = 0;
          }
        }
      }

      while (nextCombatant.beneficialTickMeter >= 1) {
        nextCombatant.beneficialTickMeter -= 1;
        if (nextCombatant.defenseBuffTurns > 0) {
          nextCombatant.defenseBuffTurns -= 1;
          if (nextCombatant.defenseBuffTurns === 0 && nextCombatant.defenseBuffAmount > 0) {
            nextCombatant.defense = Math.max(0, nextCombatant.defense - nextCombatant.defenseBuffAmount);
            nextCombatant.defenseBuffAmount = 0;
          }
        }
        if (nextCombatant.evasionBuffTurns > 0) {
          nextCombatant.evasionBuffTurns -= 1;
          if (nextCombatant.evasionBuffTurns === 0 && nextCombatant.evasionBuffAmount > 0) {
            nextCombatant.evasion = Math.max(0, nextCombatant.evasion - nextCombatant.evasionBuffAmount);
            nextCombatant.evasionBuffAmount = 0;
          }
        }
        nextCombatant.haste = Math.max(0, nextCombatant.haste - 1);
      }
      nextCombatants[key] = nextCombatant;
    });
    return nextCombatants;
  }, []);
  const clearKinInspectHold = useCallback(() => {
    if (kinInspectHoldTimeoutRef.current !== null) {
      window.clearTimeout(kinInspectHoldTimeoutRef.current);
      kinInspectHoldTimeoutRef.current = null;
    }
    if (kinInspectHoldRafRef.current) {
      window.cancelAnimationFrame(kinInspectHoldRafRef.current);
      kinInspectHoldRafRef.current = 0;
    }
    kinInspectHoldStartRef.current = 0;
    kinInspectHoldIndexRef.current = null;
    setKinInspectHoldProgress(0);
  }, []);

  useEffect(() => {
    if (kinInspectIndex === null) return;
    const handlePointerDownOutsideBench = (event: PointerEvent) => {
      const benchNode = benchInspectorRef.current;
      const target = event.target;
      if (!benchNode || !(target instanceof Node)) return;
      if (!benchNode.contains(target)) {
        setKinInspectIndex(null);
      }
    };
    window.addEventListener('pointerdown', handlePointerDownOutsideBench, true);
    return () => window.removeEventListener('pointerdown', handlePointerDownOutsideBench, true);
  }, [kinInspectIndex]);

  useEffect(() => {
    if (!enemyStealSelectorOpen) return;
    if (currentTurn !== 'player' || game.playerStock.name !== 'Jet') {
      setEnemyStealSelectorOpen(false);
    }
  }, [currentTurn, enemyStealSelectorOpen, game.playerStock.name]);

  useEffect(() => {
    if (!game.enemyDefeatFx) {
      setEnemyBurnProgress(0);
      return;
    }
    const startedAt = performance.now();
    let rafId = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const progress = Math.min(1.2, (elapsed / 900) * 1.2);
      setEnemyBurnProgress(progress);
      if (progress < 1.2) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    const anchor = getCardCenterPoint(enemyStockRef.current);
    queueAnchoredCallout(
      anchor,
      game.enemyDefeatFx.moveLabel
        ? `${game.enemyDefeatFx.name} defeated by ${game.enemyDefeatFx.moveLabel}!`
        : `${game.enemyDefeatFx.name} defeated!`,
      game.enemyDefeatFx.moveLabel ? 'Finisher' : 'Enemy Defeated'
    );
    if (game.enemyDefeatFx.lootRecovered > 0) {
      window.setTimeout(() => {
        queueAnchoredCallout(anchor, `Recovered ${game.enemyDefeatFx.lootRecovered} loot`, 'Reclaimed');
      }, 120);
    }
    rafId = window.requestAnimationFrame(tick);
    const timeoutId = window.setTimeout(() => {
      setGame((prev) => (prev.enemyDefeatFx?.id === game.enemyDefeatFx?.id ? { ...prev, enemyDefeatFx: null } : prev));
      setEnemyBurnProgress(0);
    }, 1000);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.clearTimeout(timeoutId);
    };
  }, [game.enemyDefeatFx, queueAnchoredCallout]);

  useEffect(() => {
    if (!isTutorialScenario || !game.tutorialSliceId) return;
    if (tutorialSliceIntroRef.current === game.tutorialSliceId) return;
    tutorialSliceIntroRef.current = game.tutorialSliceId;

    if (game.tutorialSliceId === 'slice-01') {
      queueDialogueCallout('System', 'Dig down to Mochi. Clear the rising row, sweep back down, then use the buried wrap line to reach him.', 170, 'Slice 01');
      return;
    }
    if (game.tutorialSliceId === 'slice-02') {
      queueDialogueCallout('System', 'Mochi is still Skittish. Give Hero a 5-card calming line, then rotate her in before the pursuer surfaces.', 150, 'Slice 02');
      return;
    }
    if (game.tutorialSliceId === 'slice-03') {
      queueDialogueCallout('System', 'The Shade Wisp is on top of you now. Feed Mochi two quick pokes, rotate back to Hero, then Guard before the first Maul lands.', 160, 'Slice 03');
      return;
    }
    if (game.tutorialSliceId === 'slice-04') {
      queueDialogueCallout('System', 'Jet is live. Move the 5 onto the bitten 6, reveal the 2-line, then reclaim the charged card and finish the raider.', 170, 'Slice 04');
    }
  }, [game.tutorialSliceId, isTutorialScenario, queueDialogueCallout]);

  useEffect(() => {
    if (!isTutorialScenario || !game.tutorialSliceId) return;
    const sliceSolved = isTutorialSliceSolved(game);
    const completionKey = `${game.tutorialSliceId}:${sliceSolved}:${game.tutorialEnemyDefeated}`;
    if (tutorialAdvanceKeyRef.current === completionKey) return;

    if (game.tutorialSliceId === 'slice-01' && sliceSolved) {
      tutorialAdvanceKeyRef.current = completionKey;
      queueDialogueCallout('System', 'Mochi exposed. He rejoins the pack and opens the next route.', 140, 'Slice 02');
      setCurrentTurn('player');
      setEnemyTurnSummary([]);
      setPendingPlayerPlay(null);
      
      // When moving to slice-02 automatically, start with Mochi hidden 
      // so she doesn't "teleport" before the reward modal is even interacted with.
      const nextState = buildTutorialSliceState('slice-02', game);
      setGame({
        ...nextState,
        hiddenStarterPackIndices: [0],
      });
      return;
    }
    if (game.tutorialSliceId === 'slice-02' && sliceSolved) {
      tutorialAdvanceKeyRef.current = completionKey;
      queueDialogueCallout('System', 'The pursuer tears through the buried row and reaches the pack.', 120, 'Slice 03');
      setCurrentTurn('player');
      setEnemyTurnSummary([]);
      setPendingPlayerPlay(null);
      setGame(buildTutorialSliceState('slice-03', game));
      return;
    }
    if (game.tutorialSliceId === 'slice-03' && sliceSolved) {
      tutorialAdvanceKeyRef.current = completionKey;
      queueDialogueCallout('System', 'Hero buys the team one safe beat. Jet is up next.', 120, 'Slice 04');
      setCurrentTurn('player');
      setEnemyTurnSummary([]);
      setPendingPlayerPlay(null);
      setGame(buildTutorialSliceState('slice-04', game));
      return;
    }
    if (game.tutorialSliceId === 'slice-04' && sliceSolved) {
      tutorialAdvanceKeyRef.current = completionKey;
      queueDialogueCallout('System', 'Tutorial ladder complete.', 120, 'All Kin Online');
    }
  }, [game, isTutorialScenario, queueDialogueCallout]);

  const resetGame = () => {
    enemyTurnRunIdRef.current += 1;
    if (enemyTurnTimeoutRef.current !== null) {
      window.clearTimeout(enemyTurnTimeoutRef.current);
      enemyTurnTimeoutRef.current = null;
    }
    if (enemyDragRafRef.current) {
      window.cancelAnimationFrame(enemyDragRafRef.current);
      enemyDragRafRef.current = 0;
    }
    if (enemyDragTimeoutRef.current) {
      window.clearTimeout(enemyDragTimeoutRef.current);
      enemyDragTimeoutRef.current = 0;
    }
    enemyDragAnimIdRef.current = null;
    enemyDragStartedAtRef.current = 0;
    enemyDragRemainingMsRef.current = 0;
    tutorialAdvanceKeyRef.current = null;
    tutorialSliceIntroRef.current = null;
    enemyDragPausedTransformRef.current = null;
    enemyDragCompletionRef.current?.();
    enemyDragCompletionRef.current = null;
    if (playerHandAnimTimeoutRef.current !== null) {
      window.clearTimeout(playerHandAnimTimeoutRef.current);
      playerHandAnimTimeoutRef.current = null;
    }
    clearStickyHold();
    clearKinInspectHold();
    setEnemyDragAnim(null);
    setPlayerHandAnim(null);
    setShowTutorialRewardModal(false);
    setShowTutorialScenePicker(false);
    setShowTutorialRescueDepth(false);
    setTutorialRewardSourcePoint(null);
    setPinnedTooltipSlotId(null);
    setEnemyStealSelectorOpen(false);
    setKinInspectIndex(null);
    setGuidePlan(null);
    dialogueCalloutTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    dialogueCalloutTimeoutsRef.current = [];
    setDialogueCallouts([]);
    lastUndoRef.current = null;
    setGame(setupGame());
    setCurrentTurn('player');
    setEnemyTurnSummary([]);
    setIsPaused(false);
  };

  const startPlayerHandAnimation = useCallback(
    (card: CardType, sourceElement: HTMLElement | null, slotId: HandSlotId, label: string) => {
      const from = getCardCenterPoint(sourceElement);
      const to = getCardCenterPoint(playerCaptureRefs.current[slotId]);
      if (!from || !to) return;
      if (playerHandAnimTimeoutRef.current !== null) {
        window.clearTimeout(playerHandAnimTimeoutRef.current);
      }
      setPlayerHandAnim({
        id: Date.now(),
        card,
        from,
        to,
        durationMs: 820,
        label,
      });
      playerHandAnimTimeoutRef.current = window.setTimeout(() => {
        setPlayerHandAnim(null);
        playerHandAnimTimeoutRef.current = null;
      }, 820);
    },
    []
  );

  const startPlayerStockAnimation = useCallback(
    (card: CardType, sourceElement: HTMLElement | null, targetElement: HTMLElement | null, label = '') => {
      const from = getCardCenterPoint(sourceElement);
      const to = getCardCenterPoint(targetElement);
      if (!from || !to) return;
      if (playerHandAnimTimeoutRef.current !== null) {
        window.clearTimeout(playerHandAnimTimeoutRef.current);
      }
      setPlayerHandAnim({
        id: Date.now(),
        card,
        from,
        to,
        durationMs: 240,
        label,
      });
      playerHandAnimTimeoutRef.current = window.setTimeout(() => {
        setPlayerHandAnim(null);
        playerHandAnimTimeoutRef.current = null;
      }, 240);
    },
    []
  );

  const startPlayerCardFlightFromPoint = useCallback(
    (
      card: CardType,
      from: { x: number; y: number } | null,
      targetElement: HTMLElement | null,
      label = '',
      durationMs = 620,
      variant: PlayerHandAnim['variant'] = 'default',
      onComplete?: () => void,
      targetPointOverride?: { x: number; y: number } | null
    ) => {
      const to = targetPointOverride ?? getCardCenterPoint(targetElement);
      if (!from || !to) {
        onComplete?.();
        return;
      }
      if (playerHandAnimTimeoutRef.current !== null) {
        window.clearTimeout(playerHandAnimTimeoutRef.current);
      }
      setPlayerHandAnim({
        id: Date.now(),
        card,
        from,
        to,
        durationMs,
        label,
        variant,
      });
      playerHandAnimTimeoutRef.current = window.setTimeout(() => {
        setPlayerHandAnim(null);
        playerHandAnimTimeoutRef.current = null;
        onComplete?.();
      }, durationMs);
    },
    []
  );

  const createAbilityAnimCard = useCallback((slot: PlayerHandSlot, owner: CardType): CardType => ({
    rank: Math.max(1, Math.min(13, getAbilityBaseCost(slot.effect) ?? 1)),
    suit: getSuitForElement(owner.element),
    element: owner.element,
    id: `ability-anim-${slot.effect ?? 'unknown'}-${Date.now()}`,
    name: '',
  }), []);

  const jumpToTutorialScene = useCallback((sceneId: TutorialSceneId) => {
    if (!isTutorialScenario) return;
    tutorialAdvanceKeyRef.current = null;
    tutorialSliceIntroRef.current = null;
    if (rescueCardFlashTimeoutRef.current !== null) {
      window.clearTimeout(rescueCardFlashTimeoutRef.current);
      rescueCardFlashTimeoutRef.current = null;
    }
    if (rescueRewardModalTimeoutRef.current !== null) {
      window.clearTimeout(rescueRewardModalTimeoutRef.current);
      rescueRewardModalTimeoutRef.current = null;
    }
    setShowTutorialScenePicker(false);
    setShowTutorialRewardModal(false);
    setShowTutorialRescueDepth(false);
    setTutorialRewardSourcePoint(null);
    setRescueCardFlash(null);
    setPendingPlayerPlay(null);
    setCurrentTurn('player');
    setEnemyTurnSummary([]);
    setGame(buildTutorialSceneState(sceneId));
    if (sceneId === 'post-mochi') {
      setShowTutorialRewardModal(true);
    }
  }, [isTutorialScenario]);

  const claimTutorialMochiReward = useCallback(() => {
    if (game.scenarioId === 'rng') {
      const rewardSourcePoint = tutorialRewardSourcePoint ?? getCardCenterPoint(tutorialRewardCardRef.current);
      const mochiSeed = createTutorialStarterPack(['Mochi'])[0];
      const heroSeed = createTutorialStarterPack(['Hero'])[0];
      const currentPrimeStats = {
        cardsStored: game.playerStockSequence,
        uniqueElements: new Set(game.playerPrimeApSegments).size,
        actionPoints: game.playerStockActionPoints,
        apSegments: [...game.playerPrimeApSegments],
      };
      const claimedTableau = game.tableau.map((column, columnIndex) => (
        columnIndex === RNG_MOCHI_TARGET_COLUMN && column[column.length - 1]?.name === 'Mochi'
          ? column.slice(0, -1)
          : column
      ));
      const finalState: GolfGameState = {
        ...game,
        tableau: claimedTableau,
        starterPackBase: [mochiSeed, heroSeed],
        starterPackUsed: [false, true],
        starterPackLocked: [false, false],
        starterPackStoredAp: [0, game.playerStockActionPoints],
        starterPackAbilityRarities: [1, 1],
        starterPackModes: ['default', 'default'],
        starterPackCashoutStats: [null, currentPrimeStats],
        activeStarterPackIndex: 1,
        playerStock: evolveIdentityCard(createStarterPackStockCard(heroSeed, 1), game.playerStock),
        hiddenStarterPackIndices: [],
        clearedCount: game.clearedCount + 1,
      };
      const midFlightState: GolfGameState = {
        ...finalState,
        hiddenStarterPackIndices: [0],
      };
      const currentBenchNode = starterPackBenchRefs.current[0] ?? playerBenchRefs.current[0];
      const preCalculatedTarget = getCardCenterPoint(currentBenchNode);

      setShowTutorialRescueDepth(false);
      setTutorialRewardSourcePoint(null);
      setRescueCardFlash(null);
      setPendingPlayerPlay(null);
      setCurrentTurn('player');
      setEnemyTurnSummary([]);
      setGame(midFlightState);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const benchNode = starterPackBenchRefs.current[0];
          const benchTarget = getCardCenterPoint(benchNode) ?? preCalculatedTarget;
          if (!benchTarget || !rewardSourcePoint) {
            setShowTutorialRewardModal(false);
            setGame(finalState);
            return;
          }
          startPlayerCardFlightFromPoint(
            mochiSeed,
            rewardSourcePoint,
            null,
            '',
            3000,
            'reward-flip',
            () => {
              setGame(finalState);
            },
            benchTarget
          );
        });
      });

      window.setTimeout(() => {
        setShowTutorialRewardModal(false);
      }, 260);
      return;
    }
    const rewardSourcePoint = tutorialRewardSourcePoint ?? getCardCenterPoint(tutorialRewardCardRef.current);
    const finalState = buildTutorialSliceState('slice-02', game);
    
    // Mid-flight state: Slice 02 layout, Mochi is in the pack (index 0) but hidden
    const midFlightState: GolfGameState = {
      ...finalState,
      hiddenStarterPackIndices: [0], // Hide Mochi at index 0
    };

    // Capture the target point before we switch states if possible, or use a fallback
    const currentBenchNode = starterPackBenchRefs.current[0] ?? playerBenchRefs.current[0];
    const preCalculatedTarget = getCardCenterPoint(currentBenchNode);
    
    if (rescueCardFlashTimeoutRef.current !== null) {
      window.clearTimeout(rescueCardFlashTimeoutRef.current);
      rescueCardFlashTimeoutRef.current = null;
    }
    if (rescueRewardModalTimeoutRef.current !== null) {
      window.clearTimeout(rescueRewardModalTimeoutRef.current);
      rescueRewardModalTimeoutRef.current = null;
    }
    
    setShowTutorialRescueDepth(false);
    setTutorialRewardSourcePoint(null);
    setRescueCardFlash(null);
    setPendingPlayerPlay(null);
    setCurrentTurn('player');
    setEnemyTurnSummary([]);
    tutorialAdvanceKeyRef.current = 'slice-01:reward-claimed';
    tutorialSliceIntroRef.current = null;

    // Switch to the layout where the bench slot for Mochi exists
    setGame(midFlightState);

    // Give the layout a moment to breathe
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        // Re-check for the node in the new state, but use pre-calculated as rock-solid fallback
        const benchNode = starterPackBenchRefs.current[0];
        const benchTarget = getCardCenterPoint(benchNode) ?? preCalculatedTarget;
        
        if (!benchTarget || !rewardSourcePoint) {
          queueDialogueCallout('System', 'Mochi recovered. Something is already moving in behind her.', 140, 'Slice 02');
          setShowTutorialRewardModal(false);
          setGame(finalState);
          return;
        }

        startPlayerCardFlightFromPoint(
          finalState.starterPackBase[0], // The Mochi card
          rewardSourcePoint,
          null, // No element needed since we pass targetPointOverride
          '', // No label
          3000,
          'reward-flip',
          () => {
            queueDialogueCallout('System', 'Mochi recovered. Something is already moving in behind her.', 140, 'Slice 02');
            setGame(finalState); // Reveal Mochi on the bench by clearing hidden indices
          },
          benchTarget
        );
      });
    });

    window.setTimeout(() => {
      setShowTutorialRewardModal(false);
    }, 260);
  }, [game, queueDialogueCallout, startPlayerCardFlightFromPoint, tutorialRewardSourcePoint]);

  const triggerAbilityResolutionFeedback = useCallback((actorNames: string[], statusKeys: string[]) => {
    if (abilityFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(abilityFeedbackTimeoutRef.current);
    }
    setHighlightedActorNames(actorNames);
    setHighlightedStatusKeys(statusKeys);
    abilityFeedbackTimeoutRef.current = window.setTimeout(() => {
      setHighlightedActorNames([]);
      setHighlightedStatusKeys([]);
      abilityFeedbackTimeoutRef.current = null;
    }, 820);
  }, []);

  useEffect(() => {
    const handleStatusEvent = (rawEvent: Event) => {
      const detail = (rawEvent as CustomEvent<StatusEffectEvent>).detail;
      if (!detail) return;
      triggerAbilityResolutionFeedback([detail.actorName], [detail.statusKey]);
      setStatusFlashVersions((prev) => ({
        ...prev,
        [`${detail.actorName}:${detail.statusKey}`]: (prev[`${detail.actorName}:${detail.statusKey}`] ?? 0) + 1,
      }));
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setTransientStatusEvents((prev) => [...prev, {
        id,
        actorName: detail.actorName,
        key: `${detail.statusKey}-${detail.removed ? 'removed' : 'triggered'}-${id}`,
        label: detail.label,
        tone: detail.tone,
      }]);
      window.setTimeout(() => {
        setTransientStatusEvents((prev) => prev.filter((entry) => entry.id !== id));
      }, 760);
    };
    window.addEventListener('golf-status-effect-event', handleStatusEvent as EventListener);
    return () => {
      window.removeEventListener('golf-status-effect-event', handleStatusEvent as EventListener);
    };
  }, [triggerAbilityResolutionFeedback]);

  const emitStatusEffectEvent = useCallback((event: StatusEffectEvent | null) => {
    if (!event) return;
    window.dispatchEvent(new CustomEvent<StatusEffectEvent>('golf-status-effect-event', { detail: event }));
  }, []);

  const recordUndoSnapshot = useCallback((snapshot: UndoSnapshot) => {
    lastUndoRef.current = {
      game: snapshot.game,
      enemyTurnSummary: [...snapshot.enemyTurnSummary],
      guidePlan: snapshot.guidePlan
        ? { ...snapshot.guidePlan, path: [...snapshot.guidePlan.path] }
        : null,
      actor: snapshot.actor,
    };
  }, []);

  const playToPlayerStock = (columnIndex: number, targetStockId?: string) => {
    if (currentTurn !== 'player') return;
    if (tutorialRailColumns && !tutorialRailColumns.has(columnIndex)) return;
    let actionStatusEvent: StatusEffectEvent | null = null;
    const candidate = topCards[columnIndex];
    if (!candidate) return;
    if (isTutorialMochiRescueTokenCollectible(game, columnIndex, candidate)) {
      const sourcePoint = getCardCenterPoint(tableauTopRefs.current[columnIndex]);
      setTutorialRewardSourcePoint(sourcePoint);
      if (rescueCardFlashTimeoutRef.current !== null) {
        window.clearTimeout(rescueCardFlashTimeoutRef.current);
        rescueCardFlashTimeoutRef.current = null;
      }
      if (rescueRewardModalTimeoutRef.current !== null) {
        window.clearTimeout(rescueRewardModalTimeoutRef.current);
        rescueRewardModalTimeoutRef.current = null;
      }
      if (sourcePoint) {
        const flashId = Date.now();
        setRescueCardFlash({ id: flashId, x: sourcePoint.x, y: sourcePoint.y });
        rescueCardFlashTimeoutRef.current = window.setTimeout(() => {
          setRescueCardFlash((current) => (current?.id === flashId ? null : current));
          rescueCardFlashTimeoutRef.current = null;
        }, 900);
      } else {
        setRescueCardFlash(null);
      }
      rescueRewardModalTimeoutRef.current = window.setTimeout(() => {
        setShowTutorialRewardModal(true);
        rescueRewardModalTimeoutRef.current = null;
      }, 520);
      setShowTutorialRescueDepth(false);
      setPendingPlayerPlay(null);
      return;
    }
    if (game.playerStock.name === 'Jet' && game.jetRewireActionsRemaining > 0) {
      if (game.jetRewireSourceColumnIndex === null) {
        setGame((prev) => ({ ...prev, jetRewireSourceColumnIndex: columnIndex }));
        queueDialogueCallout('Jet', 'Source locked.', 60, 'Rewire');
        return;
      }
      if (game.jetRewireSourceColumnIndex === columnIndex) {
        setGame((prev) => ({ ...prev, jetRewireSourceColumnIndex: null }));
        return;
      }
      if (!canRewireMove(game.tableau, game.jetRewireSourceColumnIndex, columnIndex)) return;
      setPendingPlayerPlay(null);
      setGame((prev) => {
        const sourceIndex = prev.jetRewireSourceColumnIndex;
        if (sourceIndex === null || !canRewireMove(prev.tableau, sourceIndex, columnIndex)) return prev;
        if (prev.playerStockActionPoints < JET_REWIRE_COST) {
          return { ...prev, jetRewireActionsRemaining: 0, jetRewireSourceColumnIndex: null };
        }
        const sourceCard = prev.tableau[sourceIndex][prev.tableau[sourceIndex].length - 1];
        if (!sourceCard) return prev;
        const nextTableau = prev.tableau.map((entry) => [...entry]);
        nextTableau[sourceIndex].pop();
        nextTableau[columnIndex].push(sourceCard);
        const nextChargedCardIds = prev.jetChargedCardIds.includes(sourceCard.id)
          ? prev.jetChargedCardIds
          : [...prev.jetChargedCardIds, sourceCard.id];
        const actionResult = applyPlayerActionStatusUpdate({
          ...prev,
          tableau: nextTableau,
          playerStockActionPoints: Math.max(0, prev.playerStockActionPoints - JET_REWIRE_COST),
          jetChargedCardIds: nextChargedCardIds,
          jetRewireActionsRemaining: 0,
          jetRewireSourceColumnIndex: null,
        });
        actionStatusEvent = actionResult.statusEvent;
        return actionResult.state;
      });
      emitStatusEffectEvent(actionStatusEvent);
      queueDialogueCallout('Jet', 'Route electrified.', 60, 'Rewire');
      return;
    }
    if (game.riggedConstructArmed) {
      if (!canRouteCardIntoConstruct(game, candidate)) return;
      setPendingPlayerPlay(null);
      recordUndoSnapshot({
        game: latestGameRef.current,
        enemyTurnSummary,
        guidePlan,
        actor: 'player',
      });
      setGame((prev) => {
        const nextTableau = prev.tableau.map((entry, idx) => (idx !== columnIndex ? entry : entry.slice(0, -1)));
        const refillResult = refillClearedTableauForState(prev, nextTableau, columnIndex);
        const actionResult = applyPlayerActionStatusUpdate({
          ...prev,
          tableau: refillResult.tableau,
          riggedConstructCards: [...prev.riggedConstructCards, candidate],
          clearedCount: prev.clearedCount + 1,
          tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
          riggedConstructElement: prev.riggedConstructElement ?? candidate.element,
          assistJetMicroBatteryAp: hasAssistJet(prev)
            ? Math.min(ASSIST_JET_MICRO_BATTERY_MAX, prev.assistJetMicroBatteryAp + 1)
            : prev.assistJetMicroBatteryAp,
          riggedConstructArmed: false,
        });
        actionStatusEvent = actionResult.statusEvent;
        return actionResult.state;
      });
      emitStatusEffectEvent(actionStatusEvent);
      queueDialogueCallout('Jet', 'Loaded in.', 100);
      return;
    }

    const eligibleTargets = getEligiblePlayerTargetsForCard(game, candidate);
    if (eligibleTargets.length === 0) {
      setPendingPlayerPlay(null);
      return;
    }

    const resolvedTargetStockId = targetStockId ?? (eligibleTargets.length === 1 ? eligibleTargets[0].stockId : null);
    if (!resolvedTargetStockId) {
      setPendingPlayerPlay((prev) => (
        prev?.source === 'tableau' && prev.columnIndex === columnIndex
          ? null
          : { source: 'tableau', columnIndex, stockIds: eligibleTargets.map((target) => target.stockId) }
      ));
      return;
    }

    const resolvedTarget = eligibleTargets.find((target) => target.stockId === resolvedTargetStockId);
    if (!resolvedTarget) {
      setPendingPlayerPlay({ source: 'tableau', columnIndex, stockIds: eligibleTargets.map((target) => target.stockId) });
      return;
    }

    const targetElement = resolvedTarget.kind === 'prime'
      ? playerStockRef.current
      : (typeof resolvedTarget.benchIndex === 'number' ? playerBenchRefs.current[resolvedTarget.benchIndex] : null);
    startPlayerStockAnimation(candidate, tableauTopRefs.current[columnIndex], targetElement);

    setPendingPlayerPlay(null);
    const column = game.tableau[columnIndex];
    const stickySlot = game.playerHand.find((slot) => slot.effect === 'sticky-paws' && slot.armed) ?? null;
    const stickyCharge = stickySlot ? getJetBatteryCharge(game, 'sticky-paws') : 0;
    const freeCaptureSlots = [game.playerCapturedRight, game.playerCapturedLeft].filter((entry) => entry === null).length;
    const stickyCaptureCount = stickySlot ? Math.min(stickyCharge, freeCaptureSlots, Math.max(0, column.length - 1)) : 0;
    const stickyCaptures = stickyCaptureCount > 0 ? column.slice(column.length - 1 - stickyCaptureCount, column.length - 1) : [];
    const stickyCapture = stickyCaptures[stickyCaptures.length - 1] ?? null;
    if (stickySlot && stickyCaptureCount <= 0) return;
    const repurposeSlot = !stickyCapture && column.length === 1 && resolvedTarget.kind === 'prime'
      ? game.playerHand.find((slot) => slot.effect === 'repurpose') ?? null
      : null;
    const sourceElement = tableauTopRefs.current[columnIndex];

    if (stickyCapture && stickySlot) {
      startPlayerHandAnimation(stickyCapture, sourceElement, stickySlot.slotId, 'Sticky Paws!');
    } else if (repurposeSlot) {
      startPlayerHandAnimation(candidate, sourceElement, repurposeSlot.slotId, 'Repurposed!');
    }
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });

    setGame((prev) => {
      const nextTableau = prev.tableau.map((entry, idx) => {
        if (idx !== columnIndex) return entry;
        return stickyCaptureCount > 0 ? entry.slice(0, -(1 + stickyCaptureCount)) : entry.slice(0, -1);
      });
      const refillResult = refillClearedTableauForState(prev, nextTableau, columnIndex);
      const nextHand = prev.playerHand.map((slot) => ({ ...slot, armed: false }));
      const nextBenchActionPoints = awardBenchTempo(prev, refillResult.tableCleared, resolvedTargetStockId);
      const tableClearApBonus = getPlayerTableClearApBonus(prev, refillResult.tableCleared);
      const progressResult = applyPlayerProgressToTarget(prev, resolvedTargetStockId, candidate, tableClearApBonus, nextBenchActionPoints);
      const efficiencyState = advanceJetEfficiencyFromTableauPlay(progressResult.nextState);
      const prepared = applyCounterWindowToPacket(
        prev,
        addPrimeAttackBonuses(prev, buildPokePacket(progressResult.sourceCard, prev.enemyStock, progressResult.sequence, 'player'))
      );
      const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
      const pressuredCombatants = addStaggerPressure(resolved.combatants, actorKeyFromName(prev.enemyStock.name), resolved.damageDealt);
      const pressuredResolved = {
        ...resolved,
        combatants: pressuredCombatants,
      };
      const siphonedState = applyJetPassiveSiphon(efficiencyState, pressuredResolved);
      const postEnemyDefeat = (draft: GolfGameState) =>
        resolveEnemyDefeat(draft, pressuredResolved.combatants, stickyCapture ? 'Sticky Paws' : null);

      if (stickyCapture && stickySlot) {
        const consumed = consumeJetBattery(prev, 'sticky-paws');
        const preferredSide = stickySlot.slotId === 'right' ? 'playerCapturedRight' : 'playerCapturedLeft';
        const fallbackSide = preferredSide === 'playerCapturedRight' ? 'playerCapturedLeft' : 'playerCapturedRight';
        const nextState = {
          [preferredSide]: consumed.state[preferredSide],
          [fallbackSide]: consumed.state[fallbackSide],
        } as Pick<GolfGameState, 'playerCapturedLeft' | 'playerCapturedRight'>;
        const captureQueue = [...stickyCaptures].reverse();
        captureQueue.forEach((capturedCard) => {
          if (nextState[preferredSide] === null) {
            nextState[preferredSide] = capturedCard;
          } else if (nextState[fallbackSide] === null) {
            nextState[fallbackSide] = capturedCard;
          }
        });
        const actionResult = applyPlayerActionStatusUpdate(postEnemyDefeat(resolvePrimeJetAbilityAftermath({
          ...siphonedState,
          jetBatteries: consumed.state.jetBatteries,
          jetBatteryAlternatorIndex: consumed.state.jetBatteryAlternatorIndex,
          tableau: refillResult.tableau,
          playerHand: nextHand,
          playerCapturedLeft: nextState.playerCapturedLeft,
          playerCapturedRight: nextState.playerCapturedRight,
          clearedCount: prev.clearedCount + 1,
          stickyPawsCooldown: 7,
          tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
        }, 'sticky-paws')));
        actionStatusEvent = actionResult.statusEvent;
        return actionResult.state;
      } else if (repurposeSlot) {
        const repurposeAp = routePrimeApWithAssistJet(efficiencyState, 2);
        const nextCapturedLeft = prev.playerCapturedLeft ?? candidate;
        const actionResult = applyPlayerActionStatusUpdate(postEnemyDefeat({
          ...applyJetPassiveSiphon(repurposeAp.jetState, resolved),
          tableau: refillResult.tableau,
          playerHand: nextHand,
          playerCapturedLeft: nextCapturedLeft,
          playerStockActionPoints: repurposeAp.playerStockActionPoints,
          assistJetMicroBatteryAp: repurposeAp.assistJetMicroBatteryAp,
          clearedCount: prev.clearedCount + 1,
          tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
        }));
        actionStatusEvent = actionResult.statusEvent;
        return actionResult.state;
      }

      const actionResult = applyPlayerActionStatusUpdate(postEnemyDefeat({
        ...siphonedState,
        tableau: refillResult.tableau,
        playerHand: nextHand,
        playerCapturedLeft: prev.playerCapturedLeft,
        playerCapturedRight: prev.playerCapturedRight,
        clearedCount: prev.clearedCount + 1,
        tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
      }));
      actionStatusEvent = actionResult.statusEvent;
      return actionResult.state;
    });
    emitStatusEffectEvent(actionStatusEvent);
    setGuidePlan((prev) => {
      if (!prev) return prev;
      const nextStep = prev.path[prev.progress];
      if (!nextStep) return prev;
      return nextStep.columnIndex === columnIndex && nextStep.stockId === resolvedTargetStockId
        ? { ...prev, progress: prev.progress + 1 }
        : prev;
    });
  };

  const useKinSticker = useCallback((stickerId: string) => {
    if (currentTurn !== 'player' || game.playerStock.name !== 'Hero') return;
    const sticker = game.kinStickers.find((entry) => entry.id === stickerId);
    if (!sticker || sticker.state !== 'available' || !canPlayOnRank(sticker.rank, game.playerStock.rank)) return;
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });
    setPendingPlayerPlay(null);
    setGame((prev) => {
      const liveSticker = prev.kinStickers.find((entry) => entry.id === stickerId);
      if (!liveSticker || liveSticker.state !== 'available' || !canPlayOnRank(liveSticker.rank, prev.playerStock.rank)) return prev;
      const kinCard = createKinStickerCard(liveSticker);
      const nextBenchActionPoints = awardBenchTempo(prev, false, prev.playerStock.id);
      const progressResult = applyPlayerProgressToTarget(prev, prev.playerStock.id, kinCard, 0, nextBenchActionPoints);
      const prepared = applyCounterWindowToPacket(
        prev,
        addPrimeAttackBonuses(prev, buildPokePacket(progressResult.sourceCard, prev.enemyStock, progressResult.sequence, 'player'))
      );
      const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
      const siphonedState = applyJetPassiveSiphon(progressResult.nextState, resolved);
      const withHeroHooks = applyPrimeCompanionTriggers(prev, {
        ...siphonedState,
        playerDiscardPile: [
          ...prev.playerDiscardPile,
          `${progressResult.sourceCard.name}::${liveSticker.name} Sticker ${rankLabel(liveSticker.rank)}`,
        ],
        clearedCount: prev.clearedCount + 1,
      }, progressResult.sourceCard);
      return resolveEnemyDefeat(buryKinSticker(withHeroHooks, liveSticker.id), resolved.combatants);
    });
    queueDialogueCallout('Hero', `${sticker.name} joins the line.`, 80, 'Sticker');
  }, [currentTurn, enemyTurnSummary, game.kinStickers, game.playerStock.name, game.playerStock.rank, guidePlan, queueDialogueCallout, recordUndoSnapshot]);

  const queueBenchTapoutCallout = useCallback((benchIndex: number) => {
    window.setTimeout(() => {
      queueAnchoredCallout(getCardCenterPoint(starterPackBenchRefs.current[benchIndex]), 'Tapping out!', 'Prime');
    }, 0);
  }, [queueAnchoredCallout]);

  const clearStarterBenchLockHold = useCallback(() => {
    if (starterBenchLockTimeoutRef.current) {
      window.clearTimeout(starterBenchLockTimeoutRef.current);
      starterBenchLockTimeoutRef.current = null;
    }
    if (starterBenchLockRafRef.current) {
      window.cancelAnimationFrame(starterBenchLockRafRef.current);
      starterBenchLockRafRef.current = 0;
    }
    starterBenchLockIndexRef.current = null;
    setStarterBenchLockProgress(0);
  }, []);

  const queueStarterPackCallout = useCallback((packIndex: number, text: string, subtitle: string, delayMs = 0) => {
    window.setTimeout(() => {
      const anchor = packIndex === latestGameRef.current.activeStarterPackIndex
        ? getCardCenterPoint(playerStockRef.current)
        : getCardCenterPoint(starterPackBenchRefs.current[packIndex]);
      window.setTimeout(() => {
        queueAnchoredCallout(anchor, text, subtitle);
      }, delayMs);
    }, 0);
  }, [queueAnchoredCallout]);

  const lockStarterBenchKin = useCallback((packIndex: number) => {
    setGame((prev) => {
      if (packIndex < 0 || packIndex >= prev.starterPackBase.length) return prev;
      if (packIndex === prev.activeStarterPackIndex || prev.starterPackLocked[packIndex]) return prev;
      return {
        ...prev,
        starterPackLocked: prev.starterPackLocked.map((locked, index) => (index === packIndex ? true : locked)),
      };
    });
    const kinName = latestGameRef.current.starterPackBase[packIndex]?.name ?? 'Kin';
    queueStarterPackCallout(packIndex, kinName === 'Mochi' ? 'Tap Out!' : 'Locked In', kinName === 'Mochi' ? 'Ability' : 'Lock');
  }, [isTutorialScenario, queueStarterPackCallout]);

  const handleStarterBenchPointerDown = useCallback((packIndex: number) => {
    if (currentTurn !== 'player') return;
    const slot = latestGameRef.current.starterPackBase[packIndex];
    if (!slot) return;
    if (packIndex === latestGameRef.current.activeStarterPackIndex || latestGameRef.current.starterPackLocked[packIndex]) return;
    clearStarterBenchLockHold();
    starterBenchLockIndexRef.current = packIndex;
    starterBenchLockStartRef.current = performance.now();
    suppressStarterBenchClickRef.current = false;

    const tick = () => {
      const elapsed = performance.now() - starterBenchLockStartRef.current;
      setStarterBenchLockProgress(clampNumber(elapsed / KIN_INSPECT_HOLD_MS, 0, 1));
      if (starterBenchLockIndexRef.current !== null) {
        starterBenchLockRafRef.current = window.requestAnimationFrame(tick);
      }
    };
    starterBenchLockRafRef.current = window.requestAnimationFrame(tick);
    starterBenchLockTimeoutRef.current = window.setTimeout(() => {
      const targetIndex = starterBenchLockIndexRef.current;
      if (targetIndex === null) return;
      suppressStarterBenchClickRef.current = true;
      clearStarterBenchLockHold();
      lockStarterBenchKin(targetIndex);
    }, KIN_INSPECT_HOLD_MS);
  }, [clearStarterBenchLockHold, currentTurn, isTutorialScenario, lockStarterBenchKin]);

  const handleStarterBenchPointerEnd = useCallback(() => {
    clearStarterBenchLockHold();
  }, [clearStarterBenchLockHold]);

  const switchStarterPackStock = useCallback((nextIndex: number, legalSwap: boolean) => {
    if (currentTurn !== 'player') return;
    setPendingPlayerPlay(null);
    let tappedOutBenchIndex: number | null = null;
    setGame((prev) => {
      if (nextIndex < 0 || nextIndex >= prev.starterPackBase.length) return prev;
      if (nextIndex === prev.activeStarterPackIndex || prev.starterPackLocked[nextIndex]) return prev;
      if (prev.playerStock.name === 'Hero' && prev.heroGuardTauntTurns > 0) return prev;
      if (prev.starterPackBase[nextIndex]?.name === 'Mochi' && (prev.combatants.mochi?.skittish ?? 0) > 0) return prev;
      const isLegalSwap = legalSwap && canPlayOnStock(prev.starterPackBase[nextIndex], prev.playerStock);
      if (legalSwap && !isLegalSwap) return prev;
      tappedOutBenchIndex = isLegalSwap ? null : prev.activeStarterPackIndex;
      const nextStoredAp = [...prev.starterPackStoredAp];
      nextStoredAp[prev.activeStarterPackIndex] = prev.playerStockActionPoints;
      const currentPrimeStats = {
        cardsStored: prev.playerStockSequence,
        uniqueElements: new Set(prev.playerPrimeApSegments).size,
        actionPoints: prev.playerStockActionPoints,
        apSegments: [...prev.playerPrimeApSegments],
      };
      const nextPrimeStats = prev.starterPackCashoutStats[nextIndex];
      const incomingAp = nextStoredAp[nextIndex] ?? nextPrimeStats?.actionPoints ?? 0;
      const nextStarterPackBase = prev.starterPackBase.map((card, index) =>
        index === prev.activeStarterPackIndex
          ? evolveIdentityCard(card, prev.playerStock)
          : card
      );
      const nextState = {
        ...prev,
        starterPackBase: nextStarterPackBase,
        activeStarterPackIndex: nextIndex,
        starterPackUsed: prev.starterPackUsed,
        starterPackLocked: prev.starterPackLocked.map((locked, index) =>
          index === nextIndex ? false : locked
        ),
        starterPackStoredAp: nextStoredAp,
        starterPackCashoutStats: prev.starterPackCashoutStats.map((entry, index) =>
          index === prev.activeStarterPackIndex ? currentPrimeStats : entry
        ),
        playerStock: createStarterPackStockCard(nextStarterPackBase[nextIndex], nextIndex),
        playerStockSequence: nextPrimeStats?.cardsStored ?? 0,
        playerStockActionPoints: incomingAp,
        playerPrimeApSegments: nextPrimeStats?.apSegments ? [...nextPrimeStats.apSegments] : [],
        playerCapturedLeft: null,
        playerCapturedRight: null,
        playerSupportActionUsed: false,
        playerSupportRotateUsed: false,
        playerSupportReactiveUsed: false,
        heroStockAddsThisTurn: 0,
        heroLeaderTriggeredThisTurn: false,
        heroTrailSenseActive: false,
      };
      return nextState;
    });
    if (tappedOutBenchIndex !== null) {
      queueBenchTapoutCallout(tappedOutBenchIndex);
    }
  }, [currentTurn, isTutorialScenario, queueBenchTapoutCallout]);

  const triggerPrimeTap = useCallback(() => {
    setPrimeTapped(true);
    queueDialogueCallout(game.playerStock.name, 'Tapping out!', 0, 'Prime');
    if (primeTapTimeoutRef.current) {
      window.clearTimeout(primeTapTimeoutRef.current);
    }
    primeTapTimeoutRef.current = window.setTimeout(() => {
      setPrimeTapped(false);
      primeTapTimeoutRef.current = null;
    }, 180);
  }, [game.playerStock.name, queueDialogueCallout]);

  const triggerPrimeCollapse = useCallback(() => {
    if (currentTurn !== 'player') return;
    const enemyKey = actorKeyFromName(game.enemyStock.name);
    const enemyCombatant = game.combatants[enemyKey];
    const mochiMomentum = game.combatants.mochi?.momentum ?? 0;
    if (!enemyCombatant) return;
    if ((enemyCombatant.staggerPressure ?? 0) <= 0 && !(game.playerStock.name === 'Mochi' && mochiMomentum > 0)) return;
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });
    triggerPrimeTap();
    setPinnedTooltipSlotId(null);
    setPendingPlayerPlay(null);
    setGame((prev) => {
      const targetKey = actorKeyFromName(prev.enemyStock.name);
      const targetCombatant = prev.combatants[targetKey];
      if (!targetCombatant) return prev;
      if (prev.playerStock.name === 'Hero') {
        const currentAp = Math.max(0, prev.playerStockActionPoints);
        const pressure = Math.max(0, targetCombatant.staggerPressure ?? 0);
        if (pressure <= 0) return prev;
        return resolveEnemyDefeat({
          ...prev,
          playerStockActionPoints: 0,
          combatants: {
            ...distributeArmorByNeed(prev, currentAp),
            [targetKey]: {
              ...targetCombatant,
              hp: Math.max(0, targetCombatant.hp - pressure),
              staggerPressure: 0,
            },
          },
        }, {
          ...distributeArmorByNeed(prev, currentAp),
          [targetKey]: {
            ...targetCombatant,
            hp: Math.max(0, targetCombatant.hp - pressure),
            staggerPressure: 0,
          },
        });
      }
      if (prev.playerStock.name === 'Mochi') {
        const mochiCombatant = prev.combatants.mochi;
        if (!mochiCombatant) return prev;
        const momentum = Math.max(0, mochiCombatant.momentum ?? 0);
        const pressure = Math.max(0, targetCombatant.staggerPressure ?? 0);
        if (pressure <= 0 && momentum <= 0) return prev;
        const hpDamage = Math.max(1, Math.floor((pressure + momentum) / 3));
        return resolveEnemyDefeat({
          ...prev,
          combatants: {
            ...prev.combatants,
            mochi: {
              ...mochiCombatant,
              momentum: 0,
            },
            [targetKey]: {
              ...targetCombatant,
              hp: Math.max(0, targetCombatant.hp - hpDamage),
              staggerPressure: Math.min(99, pressure + momentum * 2),
            },
          },
        }, {
          ...prev.combatants,
          mochi: {
            ...mochiCombatant,
            momentum: 0,
          },
          [targetKey]: {
            ...targetCombatant,
            hp: Math.max(0, targetCombatant.hp - hpDamage),
            staggerPressure: Math.min(99, pressure + momentum * 2),
          },
        });
      }
      return prev;
    });
    if (game.playerStock.name === 'Hero') {
      queueDialogueCallout('Hero', 'Tackle!', 80, 'Collapse');
    } else if (game.playerStock.name === 'Mochi') {
      queueDialogueCallout('Mochi', 'Pounce!', 80, 'Collapse');
    }
  }, [currentTurn, enemyTurnSummary, game.combatants, game.enemyStock.name, game.playerStock.name, guidePlan, queueDialogueCallout, recordUndoSnapshot, triggerPrimeTap]);

  const useHandSlot = (slotId: HandSlotId, targetStockId?: string) => {
    if (currentTurn !== 'player') return;
    const slot = [...activePrimeHandSlots, ...game.playerHand].find((entry) => entry.slotId === slotId);
    if (!slot) return;

    if (game.playerStock.name === 'Jet' && game.jetBatteryPrimeArmed && slot.kind === 'ability' && isJetBatteryAssignableEffect(slot.effect)) {
      const linkedJetEffect = slot.effect;
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        const existingBattery = getJetBatteryForEffect(prev, linkedJetEffect);
        if (!existingBattery) return createJetBatteryAssignment(prev, linkedJetEffect);
        const nextState: GolfGameState = {
          ...prev,
          jetBatteryPrimeArmed: false,
          jetBatteries: prev.jetBatteries.filter((battery) => battery.effect !== linkedJetEffect),
        };
        if (!prev.jetDetonateBatteryUnlocked || existingBattery.charge <= 0) return nextState;
        const nextCombatants = { ...prev.combatants };
        [prev.enemyStock.name, ...prev.enemyBench.map((card) => card.name)].forEach((enemyName) => {
          const enemyKey = actorKeyFromName(enemyName);
          const combatant = nextCombatants[enemyKey];
          if (!combatant) return;
          nextCombatants[enemyKey] = {
            ...combatant,
            hp: Math.max(0, combatant.hp - existingBattery.charge),
            burn: Math.min(6, combatant.burn + existingBattery.charge),
          };
        });
        return {
          ...nextState,
          combatants: nextCombatants,
        };
      });
      queueDialogueCallout('Jet', getJetBatteryForEffect(game, linkedJetEffect) ? `Ejected ${slot.name}.` : `Battery linked to ${slot.name}.`, 80, 'Quarnyx');
      return;
    }

    if (slot.kind === 'ability' && slot.effect === 'banks-strike') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      recordUndoSnapshot({
        game: latestGameRef.current,
        enemyTurnSummary,
        guidePlan,
        actor: 'player',
      });
      let strikeSummary: { name: string; damage: number; upgraded: boolean } | null = null;
      setGame((prev) => {
        if (prev.playerStock.name !== 'Banks') return prev;
        const tier = prev.starterPackAbilityRarities[prev.activeStarterPackIndex] ?? 1;
        const apCap = getBanksApCap(tier);
        const spentAp = Math.min(apCap, prev.playerStockActionPoints);
        if (spentAp <= 0) return prev;

        const primeKey = actorKeyFromName(prev.playerStock.name);
        const enemyKey = actorKeyFromName(prev.enemyStock.name);
        const primeCombatant = prev.combatants[primeKey];
        if (!primeCombatant) return prev;

        const packet: DamagePacket = {
          physical: spentAp,
          elemental: {},
          deliberate: true,
          threshold: 1,
          source: 'player',
          sourceActor: primeKey,
          targetActor: enemyKey,
        };
        const prepared = applyCounterWindowToPacket(prev, packet);
        const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
        const resolvedPrimeCombatant = resolved.combatants[primeKey] ?? primeCombatant;
        const upgraded = spentAp === tier && tier < 3;
        const nextTier = upgraded ? ((tier + 1) as 1 | 2 | 3) : tier;
        const nextModes = prev.starterPackModes.map((value, index) => (
          index === prev.activeStarterPackIndex
            ? (spentAp >= 3 ? 'banks-prowl' as StarterKinMode : 'default' as StarterKinMode)
            : value
        ));
        const nextCombatants = spentAp >= 3
          ? {
              ...resolved.combatants,
              [primeKey]: {
                ...resolvedPrimeCombatant,
                evasion: resolvedPrimeCombatant.evasion + 100,
                evasionBuffAmount: resolvedPrimeCombatant.evasionBuffAmount + 100,
                evasionBuffTurns: Math.max(resolvedPrimeCombatant.evasionBuffTurns, 1),
              },
            }
          : resolved.combatants;

        strikeSummary = {
          name: spentAp >= 3 ? 'Hit and Run' : 'Swipe',
          damage: spentAp,
          upgraded,
        };

        return resolveEnemyDefeat({
          ...prev,
          combatants: nextCombatants,
          playerStockActionPoints: 0,
          playerPrimeApSegments: [],
          starterPackAbilityRarities: prev.starterPackAbilityRarities.map((value, index) => (
            index === prev.activeStarterPackIndex ? nextTier : value
          )),
          starterPackStoredAp: prev.starterPackStoredAp.map((value, index) => (
            index === prev.activeStarterPackIndex ? 0 : value
          )),
          starterPackModes: nextModes,
        }, nextCombatants);
      });
      if (strikeSummary) {
        queueDialogueCallout(
          'Banks',
          strikeSummary.upgraded
            ? `${strikeSummary.name} hit for ${strikeSummary.damage}. Rarity up.`
            : `${strikeSummary.name} hit for ${strikeSummary.damage}.`,
          100,
          strikeSummary.name === 'Hit and Run' ? 'Prowl' : 'Strike'
        );
      }
      return;
    }

    if (slot.kind === 'ability' && slot.effect === 'sticky-paws') {
      setPendingPlayerPlay(null);
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'tap-out') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      if (game.playerStock.name === 'Mochi') {
        if (game.tutorialSliceId === 'slice-02') {
          return;
        }
        setGame((prev) => {
          const mochiCombatant = prev.combatants.mochi;
          const rarity = prev.starterPackAbilityRarities[prev.activeStarterPackIndex] ?? 1;
          const path = findBestExclusionPath(prev.tableau, nonCombatGlobalPeekCount, getZoomiesClaimCap(rarity));
          if (prev.playerStockActionPoints < 3 || !mochiCombatant || (mochiCombatant.whiskersense ?? 0) <= 0 || path.length === 0) return prev;
          const resolved = resolveExclusionPathTableau(prev.tableau, path);
          const lastCard = path[path.length - 1]?.card ?? prev.playerStock;
          return {
            ...prev,
            tableau: resolved.tableau,
            playerStock: evolveIdentityCard(prev.playerStock, lastCard),
            playerStockSequence: prev.playerStockSequence + path.length,
            playerStockActionPoints: prev.playerStockActionPoints - 3,
            clearedCount: prev.clearedCount + path.length,
            tableClears: prev.tableClears + resolved.tableClears,
            combatants: {
              ...prev.combatants,
              mochi: {
                ...mochiCombatant,
                whiskersense: Math.max(0, (mochiCombatant.whiskersense ?? 0) - 1),
                momentum: Math.min(99, (mochiCombatant.momentum ?? 0) + path.length),
              },
              [actorKeyFromName(prev.enemyStock.name)]: {
                ...prev.combatants[actorKeyFromName(prev.enemyStock.name)],
                staggerPressure: Math.min(99, (prev.combatants[actorKeyFromName(prev.enemyStock.name)]?.staggerPressure ?? 0) + path.length),
              },
            },
          };
        });
        queueDialogueCallout('Mochi', 'Zoomies!', 80, 'Whiskersense');
        return;
      }
      const mochiIndex = getMochiStarterPackIndex(game);
      if (mochiIndex >= 0) {
        switchStarterPackStock(mochiIndex, false);
        setGame((prev) => ({
          ...prev,
          playerStockActionPoints: Math.max(0, prev.playerStockActionPoints - 3),
          combatants: {
            ...prev.combatants,
            mochi: {
              ...(prev.combatants.mochi ?? createCombatant('Mochi')),
              whiskersense: 1,
            },
          },
        }));
        queueDialogueCallout('Mochi', 'Tap Out!', 80, 'Whiskersense');
      }
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'fetch') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        const candidate = getBestFetchCandidate(prev);
        if (prev.playerStock.name !== 'Hero' || prev.playerStockActionPoints < 2 || !candidate) return prev;
        const preferredSlot = prev.playerCapturedLeft === null ? 'left' : prev.playerCapturedRight === null ? 'right' : 'left';
        const nextTableau = candidate.source === 'tableau'
          ? refillClearedTableauForState(
            prev,
            prev.tableau.map((column, columnIndex) => (
              columnIndex === candidate.columnIndex ? column.slice(0, -1) : column
            )),
            candidate.columnIndex
          ).tableau
          : prev.tableau;
        const fetchedCard = candidate.card;
        if (preferredSlot === 'left' && prev.playerCapturedLeft === null) {
          return {
            ...prev,
            playerStockActionPoints: prev.playerStockActionPoints - 2,
            tableau: nextTableau,
            playerCapturedLeft: fetchedCard,
          };
        }
        if (preferredSlot === 'right' && prev.playerCapturedRight === null) {
          return {
            ...prev,
            playerStockActionPoints: prev.playerStockActionPoints - 2,
            tableau: nextTableau,
            playerCapturedRight: fetchedCard,
          };
        }
        return prev;
      });
      queueDialogueCallout('Hero', 'Fetch!', 100, 'Signature');
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'battery') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => ({
        ...prev,
        jetBatteryPrimeArmed: !prev.jetBatteryPrimeArmed,
        jetRewireSourceColumnIndex: null,
      }));
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'rigged-construct') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        if (prev.playerStock.name !== 'Jet') return prev;
        if (prev.riggedConstructCards.length === 0) {
          const consumed = consumeJetBattery(prev, 'rigged-construct');
          if (consumed.consumedCharge <= 0 || prev.riggedConstructCooldown > 0) return prev;
          return resolvePrimeJetAbilityAftermath({
            ...consumed.state,
            riggedConstructCooldown: 20,
            riggedConstructCards: [],
            riggedConstructArmed: true,
            riggedConstructElement: null,
            riggedConstructCapacity: consumed.consumedCharge,
          }, slot.effect);
        }
        return {
          ...prev,
          riggedConstructArmed: !prev.riggedConstructArmed,
        };
      });
      appendCombatLog({
        timestamp: Date.now(),
        biomeId: game.biomeId,
        type: 'ability',
        actor: 'Jet',
        detail: { effect: 'rigged-construct', depth: game.riggedConstructCards.length, cooldown: game.riggedConstructCooldown },
      });
      queueDialogueCallout('Jet', 'Build the shortcut.', 100);
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'rewire') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        if (prev.playerStock.name !== 'Jet') return prev;
        if (prev.jetRewireActionsRemaining > 0) {
          return { ...prev, jetRewireActionsRemaining: 0, jetRewireSourceColumnIndex: null };
        }
        if (prev.playerStockActionPoints < JET_REWIRE_COST) return prev;
        return {
          ...prev,
          jetRewireActionsRemaining: 1,
          jetRewireSourceColumnIndex: null,
        };
      });
      queueDialogueCallout('Jet', 'Open the reroute.', 100, 'Rewire');
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'scrap-plating') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        if (prev.playerStock.name !== 'Jet') return prev;
        const consumed = consumeJetBattery(prev, 'scrap-plating');
        if (consumed.consumedCharge <= 0) return prev;
        const actorKey = actorKeyFromName(prev.playerStock.name);
        const combatant = prev.combatants[actorKey];
        if (!combatant) return prev;
        const sourceColumnIndex = prev.tableau.findIndex((column) => column.length > 1);
        const nextTableau = sourceColumnIndex >= 0
          ? prev.tableau.map((column, index) => index === sourceColumnIndex ? column.slice(0, -1) : column)
          : prev.tableau;
        return resolvePrimeJetAbilityAftermath({
          ...consumed.state,
          tableau: nextTableau,
          combatants: {
            ...consumed.state.combatants,
            [actorKey]: {
              ...combatant,
              armor: combatant.armor + (consumed.consumedCharge * 2),
            },
          },
        }, slot.effect);
      });
      queueDialogueCallout('Jet', 'Scrap up.', 100, 'Scrap');
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'aegis-shunt') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        if (prev.playerStock.name !== 'Jet') return prev;
        const consumed = consumeJetBattery(prev, 'aegis-shunt');
        if (consumed.consumedCharge <= 0) return prev;
        const actorKey = actorKeyFromName(prev.playerStock.name);
        const combatant = prev.combatants[actorKey];
        if (!combatant) return prev;
        const shieldCount = Math.max(1, Math.ceil(consumed.consumedCharge / 2));
        return resolvePrimeJetAbilityAftermath({
          ...consumed.state,
          combatants: {
            ...consumed.state.combatants,
            [actorKey]: {
              ...combatant,
              elementalShields: {
                ...combatant.elementalShields,
                A: (combatant.elementalShields.A ?? 0) + shieldCount,
                E: (combatant.elementalShields.E ?? 0) + shieldCount,
                F: (combatant.elementalShields.F ?? 0) + shieldCount,
                W: (combatant.elementalShields.W ?? 0) + shieldCount,
              },
            },
          },
        }, slot.effect);
      });
      queueDialogueCallout('Jet', 'Aegis online.', 100, 'Shield');
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'slipstream') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        const actorKey = actorKeyFromName(prev.playerStock.name);
        const combatant = prev.combatants[actorKey];
        if (!combatant || prev.playerStock.name !== 'Whis' || prev.playerStockActionPoints < 4) return prev;
        return {
          ...prev,
          playerStockActionPoints: prev.playerStockActionPoints - 4,
          combatants: {
            ...prev.combatants,
            [actorKey]: {
              ...combatant,
              haste: combatant.haste + 1,
              evasion: combatant.evasion + 18,
              evasionBuffAmount: combatant.evasionBuffAmount + 18,
              evasionBuffTurns: 1,
            },
          },
        };
      });
      queueDialogueCallout('Whis', 'Flow with the opening.', 100);
      return;
    }

    if (slot.kind === 'generated' && (slot.generatedEffect === 'heart-of-the-wild' || slot.generatedEffect === 'wildcard')) {
      if (slot.generatedEffect === 'wildcard' && game.scenarioId === 'rng') {
        setPendingPlayerPlay(null);
        recordUndoSnapshot({
          game: latestGameRef.current,
          enemyTurnSummary,
          guidePlan,
          actor: 'player',
        });
        let actionStatusEvent: StatusEffectEvent | null = null;
        setGame((prev) => {
          const wildcardCard: CardType = {
            ...slot.card!,
            name: '',
            rank: pickRngWildcardRank(prev),
          };
          const nextBenchActionPoints = awardBenchTempo(prev, false, prev.playerStock.id);
          const progressResult = applyPlayerProgressToTarget(prev, prev.playerStock.id, wildcardCard, 0, nextBenchActionPoints);
          const prepared = applyCounterWindowToPacket(
            prev,
            addPrimeAttackBonuses(prev, buildPokePacket(progressResult.sourceCard, prev.enemyStock, progressResult.sequence, 'player'))
          );
          const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
          const pressuredResolved = {
            ...resolved,
            combatants: addStaggerPressure(resolved.combatants, actorKeyFromName(prev.enemyStock.name), resolved.damageDealt),
          };
          const siphonedState = applyJetPassiveSiphon(progressResult.nextState, pressuredResolved);
          const actionResult = applyPlayerActionStatusUpdate(resolveEnemyDefeat(applyPrimeCompanionTriggers(prev, {
            ...siphonedState,
            playerHand: prev.playerHand.map((entry) =>
              entry.slotId === slotId ? createEmptyHandSlot(slotId) : entry
            ),
            clearedCount: prev.clearedCount + 1,
            playerDiscardPile: [
              ...prev.playerDiscardPile,
              `${progressResult.sourceCard.name}::Long Rest Wild ${rankLabel(wildcardCard.rank)}`,
            ],
          }, progressResult.sourceCard), pressuredResolved.combatants));
          actionStatusEvent = actionResult.statusEvent;
          return actionResult.state;
        });
        emitStatusEffectEvent(actionStatusEvent);
        queueDialogueCallout('System', 'Long rest wildcard spent.', 100, 'Wildcard');
        return;
      }
      setPendingPlayerPlay(null);
      recordUndoSnapshot({
        game: latestGameRef.current,
        enemyTurnSummary,
        guidePlan,
        actor: 'player',
      });
    let actionStatusEvent: StatusEffectEvent | null = null;
    setGame((prev) => {
      if (prev.playerStock.name !== 'Hero' || prev.heroHeartsHeld <= 0) return prev;
        const heartCard = getMostPromisingHeroHeartCard(prev);
        const nextBenchActionPoints = awardBenchTempo(prev, false, prev.playerStock.id);
        const progressResult = applyPlayerProgressToTarget(prev, prev.playerStock.id, heartCard, 0, nextBenchActionPoints);
        const prepared = applyCounterWindowToPacket(
          prev,
          addPrimeAttackBonuses(prev, buildPokePacket(progressResult.sourceCard, prev.enemyStock, progressResult.sequence, 'player'))
        );
        const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
        const siphonedState = applyJetPassiveSiphon(progressResult.nextState, resolved);
        const withHeroHooks = applyPrimeCompanionTriggers(
          prev,
          {
            ...siphonedState,
            heroHeartsHeld: Math.max(0, prev.heroHeartsHeld - 1),
            heroTrailSenseActive: false,
            playerCapturedLeft: prev.playerCapturedLeft,
            playerCapturedRight: prev.playerCapturedRight,
            clearedCount: prev.clearedCount + 1,
            playerDiscardPile: [
              ...prev.playerDiscardPile,
              `${progressResult.sourceCard.name}::Wildcard ${rankLabel(heartCard.rank)}`,
            ],
          },
          progressResult.sourceCard
        );
      const actionResult = applyPlayerActionStatusUpdate(resolveEnemyDefeat(withHeroHooks, resolved.combatants));
      actionStatusEvent = actionResult.statusEvent;
      return actionResult.state;
    });
    emitStatusEffectEvent(actionStatusEvent);
    queueDialogueCallout('Hero', 'Wildcard ready.', 100, 'Resilience');
    return;
    }
    if ((slot.kind !== 'captured' && slot.kind !== 'generated') || !slot.card) return;
    const eligibleTargets = getEligiblePlayerTargetsForCard(game, slot.card);
    if (eligibleTargets.length === 0) {
      setPendingPlayerPlay(null);
      return;
    }
    const resolvedTargetStockId = targetStockId ?? (eligibleTargets.length === 1 ? eligibleTargets[0].stockId : null);
    if (!resolvedTargetStockId) {
      setPendingPlayerPlay({
        source: slotId === 'left' ? 'captured-left' : 'captured-right',
        stockIds: eligibleTargets.map((target) => target.stockId),
      });
      return;
    }
    const resolvedTarget = eligibleTargets.find((target) => target.stockId === resolvedTargetStockId);
    if (!resolvedTarget) {
      setPendingPlayerPlay({
        source: slotId === 'left' ? 'captured-left' : 'captured-right',
        stockIds: eligibleTargets.map((target) => target.stockId),
      });
      return;
    }
    setPendingPlayerPlay(null);
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });

    let actionStatusEvent: StatusEffectEvent | null = null;
    setGame((prev) => {
      const nextBenchActionPoints = awardBenchTempo(prev, false, resolvedTargetStockId);
      const progressResult = applyPlayerProgressToTarget(prev, resolvedTargetStockId, slot.card!, 0, nextBenchActionPoints);
      const generatedPacketBonus =
        slot.kind === 'generated' && slot.generatedEffect === 'free-energy'
          ? { E: slot.generatedValue ?? slot.card!.rank }
          : null;
      const prepared = applyCounterWindowToPacket(
        prev,
        (() => {
          const basePacket = addPrimeAttackBonuses(prev, buildPokePacket(progressResult.sourceCard, prev.enemyStock, progressResult.sequence, 'player'));
          if (!generatedPacketBonus) return basePacket;
          return {
            ...basePacket,
            elemental: {
              ...basePacket.elemental,
              E: (basePacket.elemental.E ?? 0) + (generatedPacketBonus.E ?? 0),
            },
          };
        })()
      );
      const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
      const pressuredResolved = {
        ...resolved,
        combatants: addStaggerPressure(resolved.combatants, actorKeyFromName(prev.enemyStock.name), resolved.damageDealt),
      };
      const siphonedState = applyJetPassiveSiphon(progressResult.nextState, pressuredResolved);
      const actionResult = applyPlayerActionStatusUpdate(resolveEnemyDefeat(applyPrimeCompanionTriggers(prev, {
        ...siphonedState,
        playerCapturedLeft: slotId === 'left' ? null : prev.playerCapturedLeft,
        playerCapturedRight: slotId === 'right' ? null : prev.playerCapturedRight,
        clearedCount: prev.clearedCount + 1,
        playerDiscardPile: [
          ...prev.playerDiscardPile,
          `${progressResult.sourceCard.name}::${slot.kind === 'generated' ? slot.name : 'Recovered'} ${rankLabel(slot.card!.rank)}`
        ],
      }, progressResult.sourceCard), pressuredResolved.combatants));
      actionStatusEvent = actionResult.statusEvent;
      return actionResult.state;
    });
    emitStatusEffectEvent(actionStatusEvent);
  };

  const usePanPawSperity = useCallback(() => {
    if (currentTurn !== 'player' || game.playerStock.name !== 'Pan' || game.panPawSperityCooldown > 0) return;
    setPinnedTooltipSlotId(null);
    setGame((prev) => ({
      ...prev,
      tableau: rerollTableau(prev.tableau),
      panPawSperityCooldown: 14,
      playerFreeTagAvailable: true,
    }));
  }, [currentTurn, game.panPawSperityCooldown, game.playerStock.name]);

  const usePanPawSperityDev = useCallback(() => {
    setPinnedTooltipSlotId(null);
    setGame((prev) => ({
      ...prev,
      tableau: rerollTableau(prev.tableau),
      playerFreeTagAvailable: true,
    }));
  }, []);

  const useStickyPawsCombat = useCallback((option: EnemyStealOption, devOverride = false) => {
    if (!devOverride && !canOpenStickyPawsSteal) return;
    const sourceElement = option.source === 'prime'
      ? enemyStockRef.current
      : enemyBenchRefs.current[option.benchIndex ?? 0];
    const preferredSlot: HandSlotId =
      game.playerCapturedRight === null ? 'right' : game.playerCapturedLeft === null ? 'left' : 'right';
    startPlayerHandAnimation({ ...option.card, name: '' }, sourceElement, preferredSlot, 'Sticky Paws!');
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });
    setPinnedTooltipSlotId(null);
    setEnemyStealSelectorOpen(false);
    setGame((prev) => {
      const stickyCharge = devOverride ? Math.max(1, getJetBatteryCharge(prev, 'sticky-paws')) : getJetBatteryCharge(prev, 'sticky-paws');
      const consumed = devOverride ? { state: prev, consumedCharge: stickyCharge } : consumeJetBattery(prev, 'sticky-paws');
      if (consumed.consumedCharge <= 0) return prev;
      const stolenCard = { ...option.card, name: '' };
      const nextCapturedLeft =
        preferredSlot === 'left'
          ? stolenCard
          : consumed.state.playerCapturedLeft;
      const nextCapturedRight =
        preferredSlot === 'right'
          ? stolenCard
          : consumed.state.playerCapturedRight;
      const stolenAp = Math.min(consumed.consumedCharge, consumed.state.enemyStockActionPoints);
      const rerouted = routeJetChargeToBatteries({
        ...consumed.state,
        enemyStockActionPoints: consumed.state.enemyStockActionPoints - stolenAp,
        playerHand: consumed.state.playerHand.map((entry) =>
          entry.effect === 'sticky-paws' ? { ...entry, armed: false } : entry
        ),
        playerCapturedLeft: nextCapturedLeft,
        playerCapturedRight: nextCapturedRight,
        stickyPawsCooldown: devOverride ? prev.stickyPawsCooldown : 7,
      }, stolenAp);
      return resolvePrimeJetAbilityAftermath(rerouted, devOverride ? null : 'sticky-paws');
    });
    queueDialogueCallout('Jet', 'Mine now.', 80, 'Sticky Paws');
  }, [canOpenStickyPawsSteal, enemyTurnSummary, game.playerCapturedLeft, game.playerCapturedRight, guidePlan, recordUndoSnapshot, startPlayerHandAnimation, startPlayerStockAnimation]);

  const usePathOfStars = useCallback(() => {
    if (currentTurn !== 'player' || game.playerStock.name !== 'Pan') return;
    const stepCount = getPathOfStarsStepCount(game.playerStockActionPoints);
    if (stepCount <= 0) return;
    setPinnedTooltipSlotId(null);
    setPendingPlayerPlay(null);
    setGame((prev) => ({
      ...prev,
      playerStockActionPoints: 0,
    }));
    setGuidePlan({
      path: playerPlanHeuristic.hiddenPath,
      progress: 0,
      source: 'path-of-stars',
      visibleSteps: stepCount,
    });
  }, [currentTurn, game.playerStock.name, game.playerStockActionPoints, playerPlanHeuristic.hiddenPath]);

  const usePathOfStarsDev = useCallback(() => {
    setPinnedTooltipSlotId(null);
    setPendingPlayerPlay(null);
    setGuidePlan({
      path: playerPlanHeuristic.hiddenPath,
      progress: 0,
      source: 'path-of-stars',
      visibleSteps: Math.max(5, playerPlanHeuristic.hiddenPath.length),
    });
  }, [playerPlanHeuristic.hiddenPath]);

  const useJikan = useCallback(() => {
    if (currentTurn !== 'player' || game.playerStock.name !== 'Whis' || game.playerStockActionPoints < 2) return;
    const snapshot = lastUndoRef.current;
    if (!snapshot) return;

    if (snapshot.actor === 'enemy') {
      const restoredBenchActionPoints = [...snapshot.game.playerBenchActionPoints];
      let restoredPlayerStockActionPoints = snapshot.game.playerStockActionPoints;
      if (snapshot.game.playerStock.name === 'Whis') {
        restoredPlayerStockActionPoints = Math.max(0, restoredPlayerStockActionPoints - 2);
      } else {
        const whisBenchIndex = snapshot.game.playerBench.findIndex((card) => card.name === 'Whis');
        if (whisBenchIndex >= 0) {
          restoredBenchActionPoints[whisBenchIndex] = Math.max(0, restoredBenchActionPoints[whisBenchIndex] - 2);
        }
      }

      // TODO: extend this rollback to combat-side status/effects when battle mechanics are wired in.
      setPinnedTooltipSlotId(null);
      setGuidePlan(snapshot.guidePlan ? { ...snapshot.guidePlan, path: [...snapshot.guidePlan.path] } : null);
      setEnemyTurnSummary([...snapshot.enemyTurnSummary]);
      setCurrentTurn('player');
      setGame({
        ...snapshot.game,
        playerStockActionPoints: restoredPlayerStockActionPoints,
        playerBenchActionPoints: restoredBenchActionPoints,
      });
      lastUndoRef.current = null;
      return;
    }

    const current = latestGameRef.current;
    const priorTableau = snapshot.game.tableau;
    const currentTableau = current.tableau;
    let restoredColumnIndex = -1;
    let restoredCard: CardType | null = null;

    for (let columnIndex = 0; columnIndex < Math.max(priorTableau.length, currentTableau.length); columnIndex += 1) {
      const before = priorTableau[columnIndex] ?? [];
      const after = currentTableau[columnIndex] ?? [];
      if (before.length > after.length) {
        restoredColumnIndex = columnIndex;
        restoredCard = before[before.length - 1] ?? null;
        break;
      }
    }

    if (restoredColumnIndex < 0 || !restoredCard) return;

    const restoredTableau = currentTableau.map((column, columnIndex) =>
      columnIndex === restoredColumnIndex ? [...column, restoredCard!] : column
    );

    setPinnedTooltipSlotId(null);
    setGame((prev) => ({
      ...prev,
      tableau: restoredTableau,
      playerStockActionPoints: Math.max(0, prev.playerStockActionPoints - 2),
    }));
    lastUndoRef.current = null;
  }, [currentTurn, game.playerStock.name, game.playerStockActionPoints]);

  const useJikanDev = useCallback(() => {
    const snapshot = lastUndoRef.current;
    if (!snapshot) return;
    // TODO: extend this rollback to combat-side status/effects when battle mechanics are wired in.
    setPinnedTooltipSlotId(null);
    setGuidePlan(snapshot.guidePlan ? { ...snapshot.guidePlan, path: [...snapshot.guidePlan.path] } : null);
    setEnemyTurnSummary([...snapshot.enemyTurnSummary]);
    setCurrentTurn('player');
    setGame(snapshot.game);
    lastUndoRef.current = null;
  }, []);

  const useRiggedConstructCard = useCallback((targetStockId?: string) => {
    if (currentTurn !== 'player' || game.riggedConstructCards.length === 0) return;
    if (game.riggedConstructArmed) {
      setPendingPlayerPlay(null);
      setGame((prev) => ({ ...prev, riggedConstructArmed: false }));
      return;
    }
    const topCard = game.riggedConstructCards[game.riggedConstructCards.length - 1];
    if (!topCard) return;
    const eligibleTargets = getEligiblePlayerTargetsForCard(game, topCard);
    if (eligibleTargets.length === 0) {
      setPendingPlayerPlay(null);
      setGame((prev) => ({ ...prev, riggedConstructArmed: true }));
      return;
    }
    const resolvedTargetStockId = targetStockId ?? (eligibleTargets.length === 1 ? eligibleTargets[0].stockId : null);
    if (!resolvedTargetStockId) {
      setPendingPlayerPlay({
        source: 'construct',
        stockIds: eligibleTargets.map((target) => target.stockId),
      });
      return;
    }
    if (!eligibleTargets.some((target) => target.stockId === resolvedTargetStockId)) {
      setPendingPlayerPlay({
        source: 'construct',
        stockIds: eligibleTargets.map((target) => target.stockId),
      });
      return;
    }
    setPendingPlayerPlay(null);
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });
    setGame((prev) => {
      const constructTop = prev.riggedConstructCards[prev.riggedConstructCards.length - 1];
      const target = getPlayerTargetByStockId(prev, resolvedTargetStockId);
      if (!constructTop || !target || !canPlayOnStock(constructTop, target.card)) return { ...prev, riggedConstructArmed: true };
      const nextBenchActionPoints = awardBenchTempo(prev, false, resolvedTargetStockId);
      const progressResult = applyPlayerProgressToTarget(prev, resolvedTargetStockId, constructTop, 0, nextBenchActionPoints);
      const prepared = applyCounterWindowToPacket(
        prev,
        addPrimeAttackBonuses(prev, buildPokePacket(progressResult.sourceCard, prev.enemyStock, progressResult.sequence, 'player'))
      );
      const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
      const siphonedState = applyJetPassiveSiphon(progressResult.nextState, resolved);
      return resolveEnemyDefeat({
        ...siphonedState,
        riggedConstructCards: prev.riggedConstructCards.slice(0, -1),
        riggedConstructElement: prev.riggedConstructCards.length > 1 ? prev.riggedConstructElement : null,
        riggedConstructCapacity: prev.riggedConstructCards.length > 1 ? prev.riggedConstructCapacity : 0,
        riggedConstructArmed: false,
      }, resolved.combatants, 'Rigged Construct');
    });
    queueDialogueCallout('Jet', 'Back into the line.', 100);
  }, [currentTurn, enemyTurnSummary, game, guidePlan, queueDialogueCallout, recordUndoSnapshot]);

  const handleBenchCardClick = useCallback((benchIndex: number) => {
    if (currentTurn !== 'player') return;
    const benchCard = game.playerBench[benchIndex];
    if (!benchCard) return;

    setPinnedTooltipSlotId(null);
    setPendingPlayerPlay(null);
    clearStickyHold();
    clearKinInspectHold();
    setKinInspectIndex(null);
    if (benchCard.name === 'Whis') {
      const snapshot = lastUndoRef.current;
      const benchAp = game.playerStockActionPoints;
      if (!snapshot || benchAp < getBenchAbilityCost(benchCard, getBenchRole(game, benchIndex))) return;
      if (snapshot.actor === 'enemy') {
        setGuidePlan(snapshot.guidePlan ? { ...snapshot.guidePlan, path: [...snapshot.guidePlan.path] } : null);
        setEnemyTurnSummary([...snapshot.enemyTurnSummary]);
        setCurrentTurn('player');
        setGame({
          ...snapshot.game,
          playerStockActionPoints: Math.max(0, snapshot.game.playerStockActionPoints - 2),
        });
        lastUndoRef.current = null;
      } else {
        const current = latestGameRef.current;
        const priorTableau = snapshot.game.tableau;
        const currentTableau = current.tableau;
        let restoredColumnIndex = -1;
        let restoredCard: CardType | null = null;
        for (let columnIndex = 0; columnIndex < Math.max(priorTableau.length, currentTableau.length); columnIndex += 1) {
          const before = priorTableau[columnIndex] ?? [];
          const after = currentTableau[columnIndex] ?? [];
          if (before.length > after.length) {
            restoredColumnIndex = columnIndex;
            restoredCard = before[before.length - 1] ?? null;
            break;
          }
        }
        if (restoredColumnIndex < 0 || !restoredCard) return;
        const restoredTableau = currentTableau.map((column, columnIndex) =>
          columnIndex === restoredColumnIndex ? [...column, restoredCard!] : column
        );
        setGame((prev) => {
          return {
            ...prev,
            tableau: restoredTableau,
            playerStockActionPoints: Math.max(0, prev.playerStockActionPoints - 2),
          };
        });
        lastUndoRef.current = null;
      }
      appendCombatLog({
        timestamp: Date.now(),
        biomeId: game.biomeId,
        type: 'ability',
        actor: benchCard.name,
        detail: { effect: 'bench-jikan', role: getBenchRole(game, benchIndex) },
      });
      queueDialogueCallout('Whis', 'Return to the earlier beat.', 120);
      return;
    }

    if (benchCard.name === 'Mochi') {
      const mochiIndex = getMochiStarterPackIndex(game);
      const cost = getBenchAbilityCost(benchCard, getBenchRole(game, benchIndex));
      if (
        mochiIndex < 0
        || mochiIndex === game.activeStarterPackIndex
        || game.playerStockActionPoints < cost
        || (game.combatants.mochi?.skittish ?? 0) > 0
      ) {
        return;
      }
      recordUndoSnapshot({
        game: latestGameRef.current,
        enemyTurnSummary,
        guidePlan,
        actor: 'player',
      });
      switchStarterPackStock(mochiIndex, false);
      setGame((prev) => ({
        ...prev,
        playerStockActionPoints: Math.max(0, prev.playerStockActionPoints - cost),
        combatants: {
          ...prev.combatants,
          mochi: {
            ...(prev.combatants.mochi ?? createCombatant('Mochi')),
            whiskersense: 1,
          },
        },
      }));
      appendCombatLog({
        timestamp: Date.now(),
        biomeId: game.biomeId,
        type: 'ability',
        actor: benchCard.name,
        target: game.playerStock.name,
        detail: { effect: 'bench-mochi', role: getBenchRole(game, benchIndex) },
      });
      queueDialogueCallout('Mochi', 'Tap Out!', 120, 'Whiskersense');
      return;
    }

    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });
    setGame((prev) => simulateUseBenchAbility(prev, benchIndex));
    appendCombatLog({
      timestamp: Date.now(),
      biomeId: game.biomeId,
      type: 'ability',
      actor: benchCard.name,
      target: game.playerStock.name,
      detail: { effect: `bench-${benchCard.name.toLowerCase()}`, role: getBenchRole(game, benchIndex) },
    });
    if (benchCard.name === 'Hero') {
      queueDialogueCallout('Hero', "I've got you.", 140);
    } else if (benchCard.name === 'Jet') {
      queueDialogueCallout('Jet', 'Rewire the lane.', 140);
    } else if (benchCard.name === 'Pan') {
      queueDialogueCallout('Pan', 'Let me reshape the route.', 140);
    }
  }, [appendCombatLog, clearKinInspectHold, clearStickyHold, currentTurn, enemyTurnSummary, game, guidePlan, queueDialogueCallout, recordUndoSnapshot, switchStarterPackStock]);

  const confirmPendingPlayerPlay = useCallback((stockId: string) => {
    if (!pendingPlayerPlay || !pendingPlayerPlay.stockIds.includes(stockId)) return false;
    if (pendingPlayerPlay.source === 'tableau' && typeof pendingPlayerPlay.columnIndex === 'number') {
      playToPlayerStock(pendingPlayerPlay.columnIndex, stockId);
      return true;
    }
    if (pendingPlayerPlay.source === 'captured-left') {
      useHandSlot('left', stockId);
      return true;
    }
    if (pendingPlayerPlay.source === 'captured-right') {
      useHandSlot('right', stockId);
      return true;
    }
    if (pendingPlayerPlay.source === 'construct') {
      useRiggedConstructCard(stockId);
      return true;
    }
    return false;
  }, [pendingPlayerPlay, playToPlayerStock, useRiggedConstructCard, useHandSlot]);

  const armStickyPaws = useCallback(() => {
    if (game.stickyPawsCooldown > 0) return;
    clearStickyHold();
    suppressStickyClickRef.current = true;
    setPinnedTooltipSlotId(null);
    setGame((prev) => ({
      ...prev,
      playerHand: prev.playerHand.map((entry) =>
        entry.effect === 'sticky-paws'
          ? { ...entry, armed: true }
          : entry
      ),
    }));
  }, [clearStickyHold, game.stickyPawsCooldown]);

  const armStickyPawsDev = useCallback(() => {
    clearStickyHold();
    suppressStickyClickRef.current = true;
    setPinnedTooltipSlotId(null);
    setGame((prev) => ({
      ...prev,
      playerHand: prev.playerHand.map((entry) =>
        entry.effect === 'sticky-paws'
          ? { ...entry, armed: true }
          : entry
      ),
    }));
  }, [clearStickyHold]);

  const triggerDevAbilityPrime = useCallback((slot: PlayerHandSlot) => {
    suppressAbilityClickRef.current = true;
    clearDevAbilityHold();
    if (slot.effect === 'sticky-paws') {
      armStickyPawsDev();
      return;
    }
    if (slot.effect === 'paw-sperity') {
      usePanPawSperityDev();
      return;
    }
    if (slot.effect === 'path-of-stars') {
      usePathOfStarsDev();
      return;
    }
    if (slot.effect === 'jikan') {
      useJikanDev();
    }
  }, [armStickyPawsDev, clearDevAbilityHold, useJikanDev, usePanPawSperityDev, usePathOfStarsDev]);

  const handleAbilityDevPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>, slot: PlayerHandSlot) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    clearDevAbilityHold();
    devAbilityHoldStartRef.current = performance.now();
    setDevAbilityHoldSlotId(slot.slotId);
    const tick = () => {
      const elapsed = performance.now() - devAbilityHoldStartRef.current;
      setDevAbilityHoldProgress(clampNumber(elapsed / DEV_ABILITY_HOLD_MS, 0, 1));
      if (elapsed < DEV_ABILITY_HOLD_MS) {
        devAbilityHoldRafRef.current = window.requestAnimationFrame(tick);
      }
    };
    devAbilityHoldRafRef.current = window.requestAnimationFrame(tick);
    devAbilityHoldTimeoutRef.current = window.setTimeout(() => {
      triggerDevAbilityPrime(slot);
    }, DEV_ABILITY_HOLD_MS);
  }, [clearDevAbilityHold, triggerDevAbilityPrime]);

  const handleAbilityDevPointerEnd = useCallback((event?: React.PointerEvent<HTMLButtonElement>) => {
    if (event) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    clearDevAbilityHold();
  }, [clearDevAbilityHold]);

  const handleKinInspectPointerDown = useCallback((benchIndex: number, activateBenchAbility = false) => {
    clearKinInspectHold();
    suppressKinInspectClickRef.current = false;
    kinInspectHoldIndexRef.current = benchIndex;
    kinInspectHoldStartRef.current = performance.now();

    const tick = () => {
      if (kinInspectHoldIndexRef.current !== benchIndex || kinInspectHoldStartRef.current === 0) return;
      const elapsed = performance.now() - kinInspectHoldStartRef.current;
      setKinInspectHoldProgress(clampNumber(elapsed / KIN_INSPECT_HOLD_MS, 0, 1));
      kinInspectHoldRafRef.current = window.requestAnimationFrame(tick);
    };

    kinInspectHoldRafRef.current = window.requestAnimationFrame(tick);
    kinInspectHoldTimeoutRef.current = window.setTimeout(() => {
      clearKinInspectHold();
      suppressKinInspectClickRef.current = true;
      if (
        activateBenchAbility &&
        benchIndex >= 0 &&
        currentTurn === 'player' &&
        canUseBenchAbilityUi(benchIndex)
      ) {
        handleBenchCardClick(benchIndex);
        return;
      }
      setKinInspectIndex(benchIndex);
    }, KIN_INSPECT_HOLD_MS);
  }, [canUseBenchAbilityUi, clearKinInspectHold, currentTurn, handleBenchCardClick]);

  const handleKinInspectPointerEnd = useCallback(() => {
    clearKinInspectHold();
  }, [clearKinInspectHold]);

  const handleStickyPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (currentTurn !== 'player') return;
    if (game.stickyPawsCooldown > 0) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    clearStickyHold();
    stickyHoldStartRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - stickyHoldStartRef.current;
      setStickyHoldProgress(Math.min(1, elapsed / STICKY_PAWS_HOLD_MS));
      if (elapsed < STICKY_PAWS_HOLD_MS) {
        stickyHoldRafRef.current = window.requestAnimationFrame(tick);
      }
    };
    stickyHoldRafRef.current = window.requestAnimationFrame(tick);
    stickyHoldTimeoutRef.current = window.setTimeout(() => {
      armStickyPaws();
    }, STICKY_PAWS_HOLD_MS);
  }, [armStickyPaws, clearStickyHold, currentTurn, game.stickyPawsCooldown]);

  const handleStickyPointerEnd = useCallback((event?: React.PointerEvent<HTMLButtonElement>) => {
    if (event) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    clearStickyHold();
  }, [clearStickyHold]);

const executeGolfMove = (
  prev: GolfGameState,
  actor: 'player' | 'enemy',
  columnIndex: number,
  targetStockId?: string
  ): { state: GolfGameState; statusEvent: StatusEffectEvent | null } => {
    const stock = actor === 'player'
      ? (targetStockId ? (getPlayerTargetByStockId(prev, targetStockId)?.card ?? prev.playerStock) : prev.playerStock)
      : prev.enemyStock;
    const candidate = prev.tableau[columnIndex][prev.tableau[columnIndex].length - 1];
    if (!candidate || !canPlayOnStock(candidate, stock)) return { state: prev, statusEvent: null };

    const reducedTableau = prev.tableau.map((column, idx) =>
      idx === columnIndex ? column.slice(0, -1) : column
    );
    const refillResult = refillClearedTableauForState(prev, reducedTableau, columnIndex);

    if (actor === 'player') {
      const resolvedTargetStockId = targetStockId ?? prev.playerStock.id;
      const nextBenchActionPoints = awardBenchTempo(prev, refillResult.tableCleared, resolvedTargetStockId);
      const tableClearApBonus = getPlayerTableClearApBonus(prev, refillResult.tableCleared);
      const progressResult = applyPlayerProgressToTarget(prev, resolvedTargetStockId, candidate, tableClearApBonus, nextBenchActionPoints);
      const efficiencyState = advanceJetEfficiencyFromTableauPlay(progressResult.nextState);
      const prepared = applyCounterWindowToPacket(
        prev,
        addPrimeAttackBonuses(prev, buildPokePacket(progressResult.sourceCard, prev.enemyStock, progressResult.sequence, 'player'))
      );
      const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
      const siphonedState = applyJetPassiveSiphon(efficiencyState, resolved);
      appendCombatLog({
        timestamp: Date.now(),
        biomeId: prev.biomeId,
        type: 'move',
        actor: progressResult.sourceCard.name,
        target: prev.enemyStock.name,
        detail: { card: candidate.id, columnIndex, damage: resolved.damageDealt, dodged: resolved.dodged, stockId: resolvedTargetStockId },
      });
      const resolvedState = resolveEnemyDefeat(reclaimBuriedKinStickers(applyPrimeCompanionTriggers(prev, {
        ...siphonedState,
        tableau: refillResult.tableau,
        clearedCount: prev.clearedCount + 1,
        tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
        heroTrailSenseActive: false,
      }, progressResult.sourceCard, { tableCleared: refillResult.tableCleared })), resolved.combatants);
      return applyPlayerActionStatusUpdate(resolvedState);
    }

    const nextState = prev;
    const nextEnemySequence = nextState.enemyStockSequence + 1;
    const preparedEnemy = applyCounterWindowToPacket(
      nextState,
      buildPokePacket(nextState.enemyStock, nextState.playerStock, nextEnemySequence, 'enemy')
    );
    const baseEnemyResolved = resolveDamagePacket(preparedEnemy.state.combatants, preparedEnemy.packet);
    const dodgedEnemyResolved = applyPostPlayerDodgeFormationEffects(nextState, baseEnemyResolved);
    const reactedEnemyResult = applyPostEnemyHitFormationReactions(nextState, dodgedEnemyResolved);
    const enemyResolved = reactedEnemyResult.resolved;
    appendCombatLog({
      timestamp: Date.now(),
      biomeId: nextState.biomeId,
      type: 'move',
      actor: nextState.enemyStock.name,
      target: nextState.playerStock.name,
      detail: { card: candidate.id, columnIndex, damage: enemyResolved.damageDealt, dodged: enemyResolved.dodged },
    });
    if (reactedEnemyResult.whiskersenseTriggered) {
      queueDialogueCallout('Mochi', 'Whiskersense!', 150, 'Dodge');
    }
    if (reactedEnemyResult.guardDogTriggered) {
      queueDialogueCallout('Hero', "I've got you!", 150, 'Guard Dog');
      queueDialogueCallout(nextState.playerStock.name, 'Hero took the hit!', 780);
    }

    const chargedEnemyClaim = isJetChargedCard(nextState, candidate.id);
    const dodgeStreak = enemyResolved.dodged && nextState.playerStock.name === 'Jet'
      ? (enemyResolved.combatants[actorKeyFromName(nextState.playerStock.name)]?.dodgeCounter ?? 0)
      : 0;
    const postDodgeState = enemyResolved.dodged && dodgeStreak > 0
      ? routeJetChargeToBatteries(nextState, dodgeStreak)
      : nextState;
    const jetCombatant = enemyResolved.combatants[actorKeyFromName(nextState.playerStock.name)];
    const normalizedCombatants =
      nextState.playerStock.name === 'Jet' && jetCombatant
        ? {
            ...enemyResolved.combatants,
            [actorKeyFromName(nextState.playerStock.name)]: {
              ...jetCombatant,
              dodgeCounter: enemyResolved.dodged ? dodgeStreak : 0,
            },
          }
        : enemyResolved.combatants;

    const nextEnemyCombatants = chargedEnemyClaim
      ? {
          ...normalizedCombatants,
          [actorKeyFromName(nextState.enemyStock.name)]: {
            ...normalizedCombatants[actorKeyFromName(nextState.enemyStock.name)],
            hp: Math.max(0, (normalizedCombatants[actorKeyFromName(nextState.enemyStock.name)]?.hp ?? 0) - 1),
          },
        }
      : normalizedCombatants;
    const nextChargedCardIds = chargedEnemyClaim
      ? nextState.jetChargedCardIds.filter((cardId) => cardId !== candidate.id)
      : nextState.jetChargedCardIds;
    if (chargedEnemyClaim) {
      appendCombatLog({
        timestamp: Date.now(),
        biomeId: nextState.biomeId,
        type: 'damage',
        actor: 'Jet',
        target: nextState.enemyStock.name,
        detail: { source: 'zapped', card: candidate.id, damage: 1, element: 'A' },
      });
    }

    return {
      state: resolveEnemyDefeat(reclaimBuriedKinStickers({
      ...postDodgeState,
      playerSupportReactiveUsed: false,
      tableau: refillResult.tableau,
      enemyStock: evolveIdentityCard(nextState.enemyStock, candidate),
      clearedCount: nextState.clearedCount + 1,
      enemyStockSequence: nextEnemySequence,
      enemyStockActionPoints: nextState.enemyStockActionPoints + 1,
      combatants: nextEnemyCombatants,
      jetChargedCardIds: nextChargedCardIds,
      tableClears: nextState.tableClears + (refillResult.tableCleared ? 1 : 0),
    }), nextEnemyCombatants),
      statusEvent: null,
    };
  };

  const executeEnemyBite = (prev: GolfGameState, columnIndex: number): GolfGameState => {
    const candidate = prev.tableau[columnIndex]?.[prev.tableau[columnIndex].length - 1] ?? null;
    if (!candidate) return prev;

    const nextBiteCount = getEnemyBiteCount(prev, candidate.id) + 1;
    const destroyed = nextBiteCount >= ENEMY_BITE_DESTROY_THRESHOLD;
    const nextBiteMarks = destroyed
      ? Object.fromEntries(Object.entries(prev.enemyBiteMarks).filter(([cardId]) => cardId !== candidate.id))
      : {
          ...prev.enemyBiteMarks,
          [candidate.id]: nextBiteCount,
        };

    const reducedTableau = destroyed
      ? prev.tableau.map((column, idx) => (idx === columnIndex ? column.slice(0, -1) : column))
      : prev.tableau;
    const refillResult = destroyed
      ? refillClearedTableauForState(prev, reducedTableau, columnIndex)
      : { tableau: reducedTableau, tableCleared: false };

    const nextEnemySequence = prev.enemyStockSequence + 1;
    const preparedEnemy = applyCounterWindowToPacket(
      prev,
      buildPokePacket(prev.enemyStock, prev.playerStock, nextEnemySequence, 'enemy')
    );
    const baseEnemyResolved = resolveDamagePacket(preparedEnemy.state.combatants, preparedEnemy.packet);
    const dodgedEnemyResolved = applyPostPlayerDodgeFormationEffects(prev, baseEnemyResolved);
    const reactedEnemyResult = applyPostEnemyHitFormationReactions(prev, dodgedEnemyResolved);
    const enemyResolved = reactedEnemyResult.resolved;
    if (reactedEnemyResult.whiskersenseTriggered) {
      queueDialogueCallout('Mochi', 'Whiskersense!', 150, 'Dodge');
    }

    const dodgeStreak = enemyResolved.dodged && prev.playerStock.name === 'Jet'
      ? (enemyResolved.combatants[actorKeyFromName(prev.playerStock.name)]?.dodgeCounter ?? 0)
      : 0;
    const postDodgeState = enemyResolved.dodged && dodgeStreak > 0
      ? routeJetChargeToBatteries(prev, dodgeStreak)
      : prev;
    const jetCombatant = enemyResolved.combatants[actorKeyFromName(prev.playerStock.name)];
    const normalizedCombatants =
      prev.playerStock.name === 'Jet' && jetCombatant
        ? {
            ...enemyResolved.combatants,
            [actorKeyFromName(prev.playerStock.name)]: {
              ...jetCombatant,
              dodgeCounter: enemyResolved.dodged ? dodgeStreak : 0,
            },
          }
        : enemyResolved.combatants;
    appendCombatLog({
      timestamp: Date.now(),
      biomeId: prev.biomeId,
      type: 'move',
      actor: prev.enemyStock.name,
      target: prev.playerStock.name,
      detail: {
        effect: destroyed ? 'enemy-bite-destroy' : 'enemy-bite',
        card: candidate.id,
        columnIndex,
        bites: nextBiteCount,
        damage: enemyResolved.damageDealt,
        dodged: enemyResolved.dodged,
      },
    });

    const lootCards = destroyed ? [...prev.enemyLootCards, candidate] : prev.enemyLootCards;
    return reclaimBuriedKinStickers({
      ...postDodgeState,
      playerSupportReactiveUsed: false,
      tableau: refillResult.tableau,
      clearedCount: destroyed ? prev.clearedCount + 1 : prev.clearedCount,
      enemyStockSequence: nextEnemySequence,
      enemyStockActionPoints: prev.enemyStockActionPoints + ENEMY_BITE_AP_GAIN,
      combatants: normalizedCombatants,
      tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
      enemyBiteMarks: nextBiteMarks,
      enemyLootCards: lootCards,
    });
  };

  const executeShadeMaul = (prev: GolfGameState): GolfGameState => {
    const mochiCombatant = prev.combatants.mochi;
    const heroCombatant = prev.combatants.hero;
    if (!mochiCombatant || prev.enemyStockActionPoints < 2) return prev;
    const supportCard = getSupportBenchCard(prev);
    const guardDogIntercept = supportCard?.name === 'Hero' && !!heroCombatant && heroCombatant.hp > 0;
    const redirectToHero = prev.playerStock.name === 'Hero' && prev.heroGuardTauntTurns > 0 && !!heroCombatant;
    const targetKey = redirectToHero ? 'hero' : 'mochi';
    const targetCardName = redirectToHero ? 'Hero' : 'Mochi';
    const damage = 3;
    const targetCombatant = prev.combatants[targetKey];
    if (!targetCombatant) return prev;

    const nextArmor = Math.max(0, targetCombatant.armor - damage);
    const overflowDamage = Math.max(0, damage - targetCombatant.armor);
    const nextHp = Math.max(0, targetCombatant.hp - overflowDamage);
    const nextCombatants = {
      ...prev.combatants,
      [targetKey]: {
        ...targetCombatant,
        armor: nextArmor,
        hp: nextHp,
        consecutiveHitsTaken: targetCombatant.consecutiveHitsTaken + 1,
      },
    };
    const lethalForMochi = !redirectToHero && nextHp <= 0 && guardDogIntercept;
    const postGuardDogCombatants = lethalForMochi && heroCombatant
      ? {
          ...nextCombatants,
          mochi: {
            ...nextCombatants.mochi,
            hp: 1,
          },
          hero: applyFlatDamageToCombatant(heroCombatant, damage),
        }
      : nextCombatants;
    const nextState = {
      ...prev,
      combatants: postGuardDogCombatants,
      enemyStockActionPoints: Math.max(0, prev.enemyStockActionPoints - 2),
    };

    appendCombatLog({
      timestamp: Date.now(),
      biomeId: prev.biomeId,
      type: 'ability',
      actor: prev.enemyStock.name,
      target: lethalForMochi ? 'Hero' : targetCardName,
      detail: { effect: 'maul', damage, redirected: redirectToHero || lethalForMochi },
    });
    queueDialogueCallout(
      prev.enemyStock.name,
      lethalForMochi ? 'Guard Dog intercepts the maul.' : redirectToHero ? 'Maul intercepted.' : 'Mochi is mauled!',
      80,
      lethalForMochi ? 'Guard Dog' : 'Maul'
    );

    return {
      ...nextState,
      playerSupportReactiveUsed: false,
    };
  };

  const getCardCenterPoint = (element: HTMLElement | null) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const getPointerAnchorPoint = (element: HTMLElement | null) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.right - 10,
      y: rect.bottom - 10,
    };
  };

  const waitForUnpausedMs = useCallback((durationMs: number, runId: number) => {
    if (durationMs <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let remainingMs = durationMs;
      let lastTick = performance.now();

      const tick = () => {
        if (enemyTurnRunIdRef.current !== runId) {
          resolve();
          return;
        }

        const now = performance.now();
        if (!isPausedRef.current) {
          remainingMs -= now - lastTick;
        }
        lastTick = now;

        if (remainingMs <= 0) {
          resolve();
          return;
        }

        enemyTurnTimeoutRef.current = window.setTimeout(tick, ENEMY_WAIT_TICK_MS);
      };

      tick();
    });
  }, []);

  const playEnemyDragAnimation = useCallback((anim: GolfDragAnim) => {
    return new Promise<void>((resolve) => {
      enemyDragCompletionRef.current = resolve;
      setEnemyDragAnim(anim);
    });
  }, []);

  const runTutorialPursuitTurn = useCallback(async () => {
    enemyTurnRunIdRef.current += 1;
    const runId = enemyTurnRunIdRef.current;
    setCurrentTurn('enemy');
    setEnemyTurnSummary([]);
    queueDialogueCallout('System', 'Something tears through the buried row.', 80, 'Pursuit');

    let nextState = latestGameRef.current;
    const pursuitColumnIndex = 3;
    for (let step = 0; step < 2; step += 1) {
      const topCard = nextState.tableau[pursuitColumnIndex]?.[nextState.tableau[pursuitColumnIndex].length - 1] ?? null;
      const sourcePoint = getCardCenterPoint(tableauTopRefs.current[pursuitColumnIndex]);
      if (!topCard || !sourcePoint) break;
      const targetPoint = { x: sourcePoint.x, y: Math.max(72, sourcePoint.y - 132) };
      await playEnemyDragAnimation({
        id: enemyDragSequenceIdRef.current + 1,
        mode: 'drag',
        card: topCard,
        sourceColumnIndex: pursuitColumnIndex,
        from: sourcePoint,
        to: targetPoint,
        durationMs: 380,
      });
      enemyDragSequenceIdRef.current += 1;
      if (enemyTurnRunIdRef.current !== runId) return;
      nextState = {
        ...nextState,
        tableau: nextState.tableau.map((column, columnIndex) => (
          columnIndex === pursuitColumnIndex ? column.slice(0, -1) : column
        )),
        clearedCount: nextState.clearedCount + 1,
        tutorialActionCount: nextState.tutorialActionCount + 1,
      };
      latestGameRef.current = nextState;
      setGame(nextState);
      await waitForUnpausedMs(150, runId);
      if (enemyTurnRunIdRef.current !== runId) return;
    }

    await waitForUnpausedMs(220, runId);
    if (enemyTurnRunIdRef.current !== runId) return;
    queueDialogueCallout('System', 'The Shade Wisp breaks into the front row.', 80, 'Combat');
    const combatState = buildTutorialSceneState('slice-03-combat');
    latestGameRef.current = combatState;
    setGame(combatState);
    setCurrentTurn('player');
  }, [playEnemyDragAnimation, queueDialogueCallout, waitForUnpausedMs]);

  const handleEndTurn = useCallback(() => {
    if (currentTurn !== 'player') return;
    if (game.scenarioId === 'rng') {
      setPendingPlayerPlay(null);
      const longRestWildcards = [
        createGeneratedHandSlot('jet-left-2', 'LONG REST WILD', createRngWildcardCard(), 'wildcard', 0),
        createGeneratedHandSlot('jet-right-2', 'LONG REST WILD', createRngWildcardCard(), 'wildcard', 0),
      ];
      setGame((prev) => ({
        ...prev,
        tableau: buildRngRescueTableau(!prev.starterPackBase.some((card) => card.name === 'Mochi')),
        playerHand: longRestWildcards,
        longRestCount: prev.longRestCount + 1,
      }));
      return;
    }
    if (isTutorialSlice02DeadlockState(game)) {
      setPendingPlayerPlay(null);
      void runTutorialPursuitTurn();
      return;
    }
    const apByPackIndex = game.starterPackBase.map((card, index) => ({
      actorName: card.name,
      index,
      actionPoints: index === game.activeStarterPackIndex
        ? game.playerStockActionPoints
        : 0,
    }));
    const totalActionPoints = apByPackIndex.reduce((sum, entry) => sum + entry.actionPoints, 0);
    const bankedThisTurn = totalActionPoints;

    apByPackIndex.forEach((entry, index) => {
      const outcome = evaluatePerfectStop(
        entry.actorName,
        entry.actionPoints,
        game.starterPackModes[entry.index] ?? 'default',
        game.starterPackAbilityRarities[entry.index] ?? 1
      );
      queueStarterPackCallout(
        entry.index,
        outcome.label,
        outcome.subtitle,
        index * 120
      );
    });
    queueAnchoredCallout(getCardCenterPoint(playerStockRef.current), `Banked +${bankedThisTurn} pts`, 'Cash Out');
    setPendingPlayerPlay(null);
    setGame((prev) => {
      const nextStoredAp = prev.starterPackBase.map(() => 0);
      const nextModes = prev.starterPackBase.map((card, index) => {
        const result = evaluatePerfectStop(card.name, nextStoredAp[index] ?? 0, prev.starterPackModes[index] ?? 'default', prev.starterPackAbilityRarities[index] ?? 1);
        return result.nextMode ?? 'default';
      });
      const nextState = resetStarterPackCycle(prev);
      const nextCombatants = {
        ...nextState.combatants,
        mochi: nextState.combatants.mochi
          ? {
              ...nextState.combatants.mochi,
              momentum: Math.max(0, (nextState.combatants.mochi.momentum ?? 0) - 1),
            }
          : nextState.combatants.mochi,
      };
      const finalState = {
        ...nextState,
        starterPackStoredAp: nextStoredAp,
        starterPackModes: nextModes,
        combatants: nextCombatants,
        bankedPoints: prev.bankedPoints + bankedThisTurn,
      };
      latestGameRef.current = finalState;
      return finalState;
    });
    setEnemyTurnQueued(true);
  }, [currentTurn, game, game.activeStarterPackIndex, game.playerStockActionPoints, game.starterPackAbilityRarities, game.starterPackBase, game.starterPackModes, queueAnchoredCallout, queueStarterPackCallout, runTutorialPursuitTurn]);

  const runEnemyTurn = useCallback(async () => {
    enemyTurnRunIdRef.current += 1;
    const runId = enemyTurnRunIdRef.current;
    if (enemyTurnTimeoutRef.current !== null) {
      window.clearTimeout(enemyTurnTimeoutRef.current);
      enemyTurnTimeoutRef.current = null;
    }
    setCurrentTurn('enemy');
    setGame((prev) => {
      const started = applyEnemyTurnStartEffects(prev);
      latestGameRef.current = started;
      return { ...started, enemyFreeTagAvailable: true };
    });
    setEnemyTurnSummary([]);

    const turnStart = performance.now();
    let nextState = latestGameRef.current;
    const actions: GolfTurnAction[] = [];
    let actionCount = 0;
    const enemyProfile = getEnemyProfile(nextState.enemyProfileId);

    while (enemyTurnRunIdRef.current === runId) {
      if (actionCount >= enemyProfile.maxActionsPerTurn) break;
      if (nextState.tutorialSliceId === 'slice-03' && nextState.enemyProfileId === 'shade-wisp' && nextState.enemyStockActionPoints >= 2) {
        const enemyPrimePoint = getCardCenterPoint(enemyStockRef.current);
        const intentCards = getShadeWispIntentCards(nextState, 2);
        if (enemyPrimePoint) {
          for (const intentCard of intentCards) {
            const sourcePoint = getCardCenterPoint(tableauTopRefs.current[intentCard.columnIndex]);
            if (!sourcePoint) continue;
            await playEnemyDragAnimation({
              id: enemyDragSequenceIdRef.current + 1,
              mode: 'drag',
              card: intentCard.card,
              sourceColumnIndex: intentCard.columnIndex,
              from: sourcePoint,
              to: enemyPrimePoint,
              durationMs: Math.max(320, ENEMY_POINTER_APPROACH_MS - 80),
            });
            enemyDragSequenceIdRef.current += 1;
            if (enemyTurnRunIdRef.current !== runId) return;
            await waitForUnpausedMs(110, runId);
            if (enemyTurnRunIdRef.current !== runId) return;
          }
        } else {
          await waitForUnpausedMs(ENEMY_POINTER_APPROACH_MS, runId);
          if (enemyTurnRunIdRef.current !== runId) return;
        }
        recordUndoSnapshot({
          game: nextState,
          enemyTurnSummary: actions,
          guidePlan,
          actor: 'enemy',
        });
        nextState = executeShadeMaul(nextState);
        latestGameRef.current = nextState;
        setGame(nextState);
        actions.push({ columnIndex: -1, card: nextState.enemyStock });
        setEnemyTurnSummary([...actions]);
        actionCount += 1;
        continue;
      }
      const move = (() => {
        if (nextState.enemyPrimeViceGripTurns <= 0) return pickHighestVisibleBiteColumn(nextState);
        const restrictedColumns = new Set(getViceGripColumns(nextState.tableau));
        let bestColumnIndex: number | null = null;
        let bestRank = -Infinity;
        let bestBites = -Infinity;
        nextState.tableau.forEach((column, columnIndex) => {
          if (!restrictedColumns.has(columnIndex)) return;
          const candidate = column[column.length - 1] ?? null;
          if (!candidate) return;
          const biteCount = getEnemyBiteCount(nextState, candidate.id);
          if (
            candidate.rank > bestRank
            || (candidate.rank === bestRank && biteCount > bestBites)
            || (candidate.rank === bestRank && biteCount === bestBites && (bestColumnIndex === null || columnIndex < bestColumnIndex))
          ) {
            bestColumnIndex = columnIndex;
            bestRank = candidate.rank;
            bestBites = biteCount;
          }
        });
        return bestColumnIndex;
      })();
      if (move === null) break;

      const movedCard = nextState.tableau[move][nextState.tableau[move].length - 1];
      if (!movedCard) break;

      const approachFromPoint = getPointerAnchorPoint(enemyStockRef.current);
      const approachToPoint = getPointerAnchorPoint(tableauTopRefs.current[move]);
      if (approachFromPoint && approachToPoint) {
        await playEnemyDragAnimation({
          id: enemyDragSequenceIdRef.current + 1,
          mode: 'cursor',
          card: movedCard,
          from: approachFromPoint,
          to: approachToPoint,
          durationMs: ENEMY_POINTER_APPROACH_MS,
        });
        enemyDragSequenceIdRef.current += 1;
        if (enemyTurnRunIdRef.current !== runId) return;
        await waitForUnpausedMs(ENEMY_POINTER_CLICK_MS, runId);
        if (enemyTurnRunIdRef.current !== runId) return;
        await waitForUnpausedMs(ENEMY_ACTION_DURATION_MS, runId);
        if (enemyTurnRunIdRef.current !== runId) return;
      } else {
        await waitForUnpausedMs(ENEMY_POINTER_APPROACH_MS + ENEMY_POINTER_CLICK_MS + ENEMY_ACTION_DURATION_MS, runId);
        if (enemyTurnRunIdRef.current !== runId) return;
      }

      recordUndoSnapshot({
        game: nextState,
        enemyTurnSummary: actions,
        guidePlan,
        actor: 'enemy',
      });
      nextState = applyEnemyMovePostEffects(executeEnemyBite(nextState, move));
      latestGameRef.current = nextState;
      setGame(nextState);
      actions.push({ columnIndex: move, card: movedCard });
      setEnemyTurnSummary([...actions]);
      actionCount += 1;
    }

    const elapsedMs = performance.now() - turnStart;
    await waitForUnpausedMs(Math.max(0, ENEMY_TURN_MIN_MS - elapsedMs), runId);
    if (enemyTurnRunIdRef.current !== runId) return;

    setCurrentTurn('player');
    setGame((prev) => {
      let next: GolfGameState = {
        ...prev,
        playerFreeTagAvailable: true,
        playerTagLockCapturesRemaining: 0,
        playerBlockedReturnStockId: null,
        playerSupportActionUsed: false,
        playerSupportRotateUsed: false,
        playerSupportReactiveUsed: false,
        stickyPawsCooldown: Math.max(0, prev.stickyPawsCooldown - 1),
        panPawSperityCooldown: Math.max(0, prev.panPawSperityCooldown - 1),
        riggedConstructCooldown: Math.max(0, prev.riggedConstructCooldown - 1),
        assistJetRewireCooldown: Math.max(0, prev.assistJetRewireCooldown - 1),
        combatants: ageCombatantsAtTurnBoundary(prev.combatants),
        enemyPrimeViceGripTurns: Math.max(0, prev.enemyPrimeViceGripTurns - 1),
        enemySupportStunnedTurns: Math.max(0, prev.enemySupportStunnedTurns - 1),
        heroGuardTauntTurns: Math.max(0, prev.heroGuardTauntTurns - 1),
      };
      if (prev.playerStock.name === 'Hero') {
        next = {
          ...next,
          heroTurnsElapsed: prev.heroTurnsElapsed + 1,
          heroSecondWindCooldown: Math.max(0, prev.heroSecondWindCooldown - 1),
          heroLeaderTriggeredThisTurn: false,
          heroStockAddsThisTurn: 0,
        };
      }
      return next;
    });
    enemyTurnTimeoutRef.current = null;
  }, [ageCombatantsAtTurnBoundary, playEnemyDragAnimation, waitForUnpausedMs]);

  useEffect(() => {
    if (!enemyTurnQueued || currentTurn !== 'player') return;
    setEnemyTurnQueued(false);
    runEnemyTurn();
  }, [currentTurn, enemyTurnQueued, runEnemyTurn]);

  useEffect(() => {
    if (autoPlayMode === 'off' || currentTurn !== 'player' || isPaused || isPlayerTeamDefeated(game)) return;
    const timeoutId = window.setTimeout(() => {
      let resolvedState: GolfGameState | null = null;
      setGame((prev) => {
        let next = prev;
        while (true) {
          const action = choosePlayerAutoAction(next, autoPlayMode);
          if (action === null) break;
          recordUndoSnapshot({
            game: next,
            enemyTurnSummary,
            guidePlan,
            actor: 'player',
          });
          if (action.type === 'move') {
            next = executeGolfMove(next, 'player', action.columnIndex, action.stockId).state;
            continue;
          }
          if (action.type === 'swap') {
            next = simulateStarterPackSwap(next, action.starterPackIndex, !next.tutorialSliceId);
            continue;
          }
          if (action.type === 'rotate-support') {
            next = simulateRotateSupport(next, action.benchIndex);
            continue;
          }
          if (action.type === 'support-ability') {
            next = simulateUseSupportAbility(next);
            continue;
          }
          next = simulateUseAbilityWithStatus(next, action.effect).state;
        }
        resolvedState = next;
        return next;
      });
      if (autoPlayMode === 'full') {
        appendCombatLog({
          timestamp: Date.now(),
          biomeId: game.biomeId,
          type: 'autoplay',
          actor: game.playerStock.name,
          detail: { mode: autoPlayMode, turn: currentTurn },
        });
        const nextState = resolvedState ?? latestGameRef.current;
        if (isTutorialSlice02DeadlockState(nextState)) {
          void runTutorialPursuitTurn();
        } else {
          runEnemyTurn();
        }
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [appendCombatLog, autoPlayMode, currentTurn, enemyTurnSummary, game, guidePlan, isPaused, recordUndoSnapshot, runEnemyTurn, runTutorialPursuitTurn]);

  useEffect(() => {
    if (!enemyDragAnim) {
      enemyDragAnimIdRef.current = null;
      enemyDragStartedAtRef.current = 0;
      enemyDragRemainingMsRef.current = 0;
      enemyDragPausedTransformRef.current = null;
      if (enemyDragRafRef.current) {
        window.cancelAnimationFrame(enemyDragRafRef.current);
        enemyDragRafRef.current = 0;
      }
      if (enemyDragTimeoutRef.current) {
        window.clearTimeout(enemyDragTimeoutRef.current);
        enemyDragTimeoutRef.current = 0;
      }
      return;
    }

    const node = enemyDragNodeRef.current;
    if (!node) return;

    if (enemyDragAnimIdRef.current !== enemyDragAnim.id) {
      enemyDragAnimIdRef.current = enemyDragAnim.id;
      enemyDragStartedAtRef.current = 0;
      enemyDragRemainingMsRef.current = enemyDragAnim.durationMs;
      enemyDragPausedTransformRef.current = null;
    }

    if (enemyDragRafRef.current) {
      window.cancelAnimationFrame(enemyDragRafRef.current);
      enemyDragRafRef.current = 0;
    }
    if (enemyDragTimeoutRef.current) {
      window.clearTimeout(enemyDragTimeoutRef.current);
      enemyDragTimeoutRef.current = 0;
    }

    const dx = enemyDragAnim.to.x - enemyDragAnim.from.x;
    const dy = enemyDragAnim.to.y - enemyDragAnim.from.y;
    const headingDegrees = Math.atan2(dy, dx) * (180 / Math.PI);
    const initialTransform = `translate3d(${enemyDragAnim.from.x.toFixed(2)}px, ${enemyDragAnim.from.y.toFixed(2)}px, 0) rotate(0deg)`;
    const targetRotation = enemyDragAnim.mode === 'drag' ? headingDegrees * 0.08 : 0;
    const targetTransform = `translate3d(${enemyDragAnim.to.x.toFixed(2)}px, ${enemyDragAnim.to.y.toFixed(2)}px, 0) rotate(${targetRotation.toFixed(2)}deg)`;

    if (isPaused) {
      if (enemyDragStartedAtRef.current > 0) {
        const elapsed = Math.max(0, performance.now() - enemyDragStartedAtRef.current);
        enemyDragRemainingMsRef.current = Math.max(0, enemyDragRemainingMsRef.current - elapsed);
        enemyDragStartedAtRef.current = 0;
      }
      const computedTransform = window.getComputedStyle(node).transform;
      node.style.transition = 'none';
      if (computedTransform && computedTransform !== 'none') {
        node.style.transform = computedTransform;
        enemyDragPausedTransformRef.current = computedTransform;
      } else {
        node.style.transform = enemyDragPausedTransformRef.current ?? initialTransform;
        enemyDragPausedTransformRef.current = node.style.transform;
      }
      return;
    }

    const remainingMs = Math.max(1, enemyDragRemainingMsRef.current || enemyDragAnim.durationMs);
    const resumeTransform = enemyDragPausedTransformRef.current ?? initialTransform;
    node.style.transition = 'none';
    node.style.transform = resumeTransform;

    enemyDragRafRef.current = window.requestAnimationFrame(() => {
      const activeNode = enemyDragNodeRef.current;
      if (!activeNode) return;
      activeNode.style.transition = `transform ${remainingMs}ms cubic-bezier(0.33, 1, 0.68, 1)`;
      activeNode.style.transform = targetTransform;
      enemyDragStartedAtRef.current = performance.now();
      enemyDragRemainingMsRef.current = remainingMs;
      enemyDragPausedTransformRef.current = null;
      enemyDragTimeoutRef.current = window.setTimeout(() => {
        const complete = enemyDragCompletionRef.current;
        enemyDragAnimIdRef.current = null;
        enemyDragStartedAtRef.current = 0;
        enemyDragRemainingMsRef.current = 0;
        enemyDragPausedTransformRef.current = null;
        enemyDragCompletionRef.current = null;
        setEnemyDragAnim(null);
        complete?.();
      }, remainingMs);
    });
  }, [enemyDragAnim, isPaused]);

  useEffect(() => {
    if (!playerHandAnim) return;
    const node = playerHandAnimNodeRef.current;
    if (!node) return;

    const spinStart = '';
    const spinEnd = '';
    const initialTransform = `translate3d(${playerHandAnim.from.x.toFixed(2)}px, ${playerHandAnim.from.y.toFixed(2)}px, 0)${spinStart}`;
    const targetTransform = `translate3d(${playerHandAnim.to.x.toFixed(2)}px, ${playerHandAnim.to.y.toFixed(2)}px, 0)${spinEnd}`;
    node.style.transition = 'none';
    node.style.transform = initialTransform;

    const rafId = window.requestAnimationFrame(() => {
      const activeNode = playerHandAnimNodeRef.current;
      if (!activeNode) return;
      activeNode.style.transition = `transform ${playerHandAnim.durationMs}ms cubic-bezier(0.18, 0.88, 0.22, 1), opacity ${playerHandAnim.durationMs}ms ease-out, filter ${playerHandAnim.durationMs}ms ease-out`;
      activeNode.style.transform = targetTransform;
      if (playerHandAnim.variant === 'reward-flip') {
        activeNode.style.filter = 'brightness(1.15) drop-shadow(0 0 22px rgba(255,255,255,0.35))';
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [playerHandAnim]);

  useEffect(() => {
    if (!stickyPawsArmed) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const stickyNode = playerHandRefs.current.right;
      const insideSticky = !!(stickyNode && target && stickyNode.contains(target));
      const insideTooltip = !!((target as HTMLElement | null)?.closest('.tooltip-surface'));
      const validTableauTarget = game.tableau.some((column, columnIndex) => {
        const topNode = tableauTopRefs.current[columnIndex];
        const topCard = column[column.length - 1] ?? null;
        return !!(
          topNode &&
          target &&
          topNode.contains(target) &&
          topCard &&
          column.length > 1 &&
          getEligiblePlayerTargetsForCard(game, topCard).length > 0
        );
      });

      if (!insideSticky && !insideTooltip && !validTableauTarget) {
        setGame((prev) => ({
          ...prev,
          playerHand: prev.playerHand.map((entry) =>
            entry.effect === 'sticky-paws' ? { ...entry, armed: false } : entry
          ),
        }));
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [game, stickyPawsArmed]);

  const renderAbilityTooltip = useCallback((slot: PlayerHandSlot) => {
    if (slot.effect === 'battery') {
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Quarnyx Battery</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Tool Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Prime the card, then click a Jet ability card with a charge profile to dedicate a Quarnyx battery to it. Future Jet AP gains are load-balanced across all connected batteries instead of entering Jet directly. Priming and clicking an already-powered ability ejects that battery.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Network: {game.jetBatteries.length} batteries • Prime mode: {game.jetBatteryPrimeArmed ? 'armed' : 'idle'}
          </div>
        </div>
      );
    }
    if (slot.effect === 'siphon') {
      const charge = getJetBatteryCharge(game, 'siphon');
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Siphon</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Battle Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Discharge the linked battery to steal AP equal to its charge from the enemy stock, then reroute that stolen charge back into Jet's battery network.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Battery charge: {charge} • Enemy AP: {game.enemyStockActionPoints}
          </div>
        </div>
      );
    }
    if (slot.effect === 'rigged-construct') {
      const charge = getJetBatteryCharge(game, 'rigged-construct');
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Rigged Construct</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Battle Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Discharge the linked battery to deploy the Elemental Construct prototype with storage capacity equal to the battery's charge. The first stored card locks the element, and only matching cards can move through it.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Battery charge: {charge} • Depth: {game.riggedConstructCards.length}/{game.riggedConstructCapacity || charge || 0} • Element: {game.riggedConstructElement ?? 'unset'} • Cooldown: {game.riggedConstructCooldown > 0 ? game.riggedConstructCooldown : 'ready'}
          </div>
        </div>
      );
    }
    if (slot.effect === 'rewire') {
      const chargedCount = game.jetChargedCardIds.length;
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Rewire</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Signature Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Spend {JET_REWIRE_COST} AP to move one tableau top laterally into another tableau if the move would be stock-legal. Rewired cards become Charged.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Charged cards: {chargedCount} • AP loaded: {game.playerStockActionPoints}/{JET_MAX_AP} • Rewire mode: {game.jetRewireActionsRemaining > 0 ? 'armed' : 'idle'}
          </div>
          <div className="mt-3 space-y-1 text-[11px] leading-4 text-white/72">
            <div>Allied claim: +1 AP and consume the charge.</div>
            <div>Enemy claim: Zapped for 1 electric damage, then consume the charge.</div>
            <div>Charges persist on tableau cards and do not stack.</div>
          </div>
        </div>
      );
    }
    if (slot.effect === 'scrap-plating') {
      const charge = getJetBatteryCharge(game, 'scrap-plating');
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Scrap Plating</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Tool Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Discharge the linked battery to dismantle a tableau resource into armor. The current prototype automatically strips one deeper tableau card when available.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Battery charge: {charge} • Armor gain: {charge * 2}
          </div>
        </div>
      );
    }
    if (slot.effect === 'aegis-shunt') {
      const charge = getJetBatteryCharge(game, 'aegis-shunt');
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Aegis Shunt</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Tool Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Discharge the linked battery to convert offensive charge into elemental shielding across Jet's defenses.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Battery charge: {charge} • Shields per element: {Math.max(1, Math.ceil(charge / 2))}
          </div>
        </div>
      );
    }
    if (slot.effect === 'banks-strike') {
      const tier = game.starterPackAbilityRarities[game.activeStarterPackIndex] ?? 1;
      const apCap = getBanksApCap(tier);
      const currentAp = Math.min(game.playerStockActionPoints, apCap);
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Swipe / Hit and Run</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Signature Active • Banks Only</div>
          <div className="mt-3 text-sm text-white/80">
            Spend all current Banks AP. The current AP stop determines which line fires, and exact sweet spots unlock the next rarity tier.
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Current rarity: R{tier} • AP cap: {apCap} • Loaded AP: {currentAp}
          </div>
          <div className="mt-3 space-y-1 text-[11px] leading-4 text-white/72">
            <div>1 AP: Swipe I, deal 1 physical.</div>
            <div>2 AP: Swipe II, deal 2 physical.</div>
            <div>3 AP: Hit and Run, deal 3 physical then Prowl for 100% evasion.</div>
          </div>
        </div>
      );
    }
    if (slot.effect === 'fetch') {
      const source = getBestFetchCandidate(game);
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Fetch</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Signature Active • Hero Only</div>
          <div className="mt-3 text-sm text-white/80">
            Tableau: retrieve a top visible tableau card into Hero&apos;s hand. Combat: retrieve the top card from a creature discard into Hero&apos;s hand.
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Best current source: {source?.source === 'tableau' ? 'top tableau' : source?.source === 'discard' ? 'discard pile' : 'none available'}
          </div>
        </div>
      );
    }
    const definition = getStarterAbilityByEffect(slot.effect);
    const title = definition?.fullName ?? definition?.name ?? slot.name;
    const taxonomy =
      slot.effect === 'repurpose'
        ? 'Tableau Clear • Permanent'
        : slot.effect === 'paw-sperity'
          ? 'Utility Active • Permanent'
          : 'Signature Active';
    const cooldown = getAbilityCooldown(game, slot.effect);
    const pathSteps = getPathOfStarsStepCount(game.playerStockActionPoints);
    const extra =
      slot.effect === 'path-of-stars'
        ? `Current payout: ${pathSteps > 0 ? `${pathSteps} steps` : 'needs 10 AP'}`
        : slot.effect === 'sticky-paws'
          ? `Linked battery: ${getJetBatteryCharge(game, 'sticky-paws')} charge • Click to steal from enemy cards. Long press to arm the exploration grab. Cooldown: ${cooldown > 0 ? cooldown : 'ready'} • Efficiency: ${game.jetAbilityCardsPlayed}/3 tableau plays`
          : slot.effect === 'paw-sperity'
            ? `Permanent kit card. Cooldown: ${game.panPawSperityCooldown > 0 ? game.panPawSperityCooldown : 'ready'}`
            : slot.effect === 'jikan'
              ? 'Undo target: last combat play or last tableau play.'
              : slot.effect === 'repurpose'
                ? 'Clearing a tableau recovers the final visible card and grants +2 AP.'
                : cooldown > 0
                  ? `Cooldown: ${cooldown}`
                  : null;

    return (
      <div>
        <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">{title}</div>
        <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">{taxonomy}</div>
        {definition?.combatDescription ? (
          <div className="mt-3">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Combat</div>
            <div className="mt-1 text-sm text-white/80">{definition.combatDescription}</div>
          </div>
        ) : null}
        {definition?.exploreDescription ? (
          <div className="mt-3">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Explore</div>
            <div className="mt-1 text-sm text-white/80">{definition.exploreDescription}</div>
          </div>
        ) : null}
        {extra ? (
          <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-white/45">{extra}</div>
        ) : null}
      </div>
    );
  }, [game.activeStarterPackIndex, game.assistJetRewireCooldown, game.enemyStockActionPoints, game.jetAbilityCardsPlayed, game.jetBatteryPrimeArmed, game.jetBatteries, game.jetChargedCardIds, game.jetEfficiencyDiscountReady, game.jetRewireActionsRemaining, game.panPawSperityCooldown, game.playerDiscardPile, game.playerStockActionPoints, game.riggedConstructCapacity, game.riggedConstructCards.length, game.riggedConstructCooldown, game.riggedConstructElement, game.starterPackAbilityRarities, game.stickyPawsCooldown, game.tableau]);

  return (
    <div ref={gameRootRef} className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto bg-[#020205] text-white" onContextMenu={(event) => event.preventDefault()}>
      <GolfPaintOverlay active={paintMode} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="bg-nebula-layer" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: 'linear-gradient(rgba(127,219,202,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(127,219,202,0.1) 1px, transparent 1px)', backgroundSize: '160px 160px' }} />
      </div>
      <GuidanceNaviOverlay target={nextGuideTarget} travelKey={nextGuideTarget?.key ?? null} />
      {tutorialMochiMarkerAnchor ? (
        <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
          <div
            className="absolute"
            style={{
              left: tutorialMochiMarkerAnchor.x,
              top: tutorialMochiMarkerAnchor.y,
              transform: 'translate(-50%, calc(-100% - 18px))',
            }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                setShowTutorialRescueDepth(true);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                setShowTutorialRescueDepth(true);
              }}
              className="pointer-events-auto flex cursor-pointer flex-col items-center px-4 pt-4"
              aria-label="Show Mochi rescue depth"
              style={{ animation: 'golf-mochi-target-bob 2.2s ease-in-out infinite' }}
            >
              <img
                src="/assets/actors/mochikin/mochi_emoji_sad.png"
                alt="Mochi target"
                className="h-auto w-[72px]"
                style={{ filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.55)) drop-shadow(0 0 10px rgba(255,72,72,0.32))' }}
              />
              <div
                className="mt-1 h-0 w-0 border-l-[13px] border-r-[13px] border-t-[20px] border-l-transparent border-r-transparent"
                style={{ borderTopColor: '#ff4d4d', filter: 'drop-shadow(0 0 10px rgba(255,72,72,0.58))', animation: 'golf-mochi-danger-breathe 1.7s ease-in-out infinite' }}
              />
            </div>
          </div>
        </div>
      ) : null}
      <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+12px)] z-40 pointer-events-auto glass-pill px-4 py-2 text-left md:left-5 md:top-5 flex items-center gap-3 rounded-full">
        <div className="text-[10px] font-display font-bold uppercase tracking-[0.1em] text-game-teal/60">System</div>
        <div className="h-3 w-[1px] bg-white/10" />
        <div className="text-sm font-display font-bold tabular-nums text-white/90">{fps} <span className="text-[10px] text-white/40">FPS</span></div>
      </div>
      {(isTutorialScenario || isRngScenario) ? (
        <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+64px)] z-40 flex flex-col gap-2 pointer-events-none md:left-5 md:top-[68px]">
          {isTutorialScenario ? (
            <button
              type="button"
              onClick={() => setShowTutorialScenePicker(true)}
              className="pointer-events-auto rounded-full border border-game-gold/25 bg-black/72 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-game-gold/80 shadow-[0_0_18px_rgba(230,179,30,0.14)] transition-colors hover:border-game-gold/45 hover:bg-black/82"
            >
              {getTutorialSliceLabel(game.tutorialSliceId)}
            </button>
          ) : (
            <div className="pointer-events-auto rounded-full border border-game-gold/25 bg-black/72 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-game-gold/80 shadow-[0_0_18px_rgba(230,179,30,0.14)]">
              RNG • Mochi Rescue
            </div>
          )}
          {getTutorialForecastLabel(game) ? (
            <div className="rounded-full border border-game-pink/30 bg-black/78 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-game-pink shadow-[0_0_16px_rgba(217,70,239,0.18)]">
              {getTutorialForecastLabel(game)}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+64px)] z-40 pointer-events-auto md:left-auto md:right-5 md:top-5">
        <div className="flex flex-wrap items-center justify-end gap-3 glass-panel rounded-full px-2 py-2 md:pl-6 md:pr-2">
          <div className="flex flex-col items-end justify-center mr-2 pr-2 border-r border-white/10">
            <div className="text-[9px] font-display font-bold uppercase tracking-[0.15em] text-game-gold/80">Cleared</div>
            <div className="text-sm font-display font-bold text-white tracking-widest leading-none mt-0.5">{tutorialClearedDisplay}<span className="text-white/30 mx-0.5">/</span>{tutorialClearedGoal}</div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDiscardTray((prev) => !prev)}
              className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/5 px-3 py-2 min-w-[70px] hover:bg-white/10 hover:border-white/20 transition-all duration-200"
            >
              <div className="text-[9px] font-display font-bold uppercase tracking-[0.12em] text-game-teal/60">Discard</div>
              <div className="text-lg font-display font-bold text-game-teal leading-none mt-0.5">{game.playerDiscardPile.length}</div>
            </button>
            {showDiscardTray ? (
              <div className="absolute right-0 top-[calc(100%+12px)] w-52 glass-panel rounded-xl p-3 shadow-2xl">
                <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-game-teal mb-3 px-1">Party Discards</div>
                <div className="flex flex-col gap-1.5">
                  {['Jet', 'Hero', 'Pan', 'Whis'].map((actorName) => (
                    <div key={actorName} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 border border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">{actorName}</span>
                      <span className="text-xs font-display font-bold tabular-nums text-white">{partyDiscardCounts[actorName] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-transparent px-3 py-2 min-w-[70px]">
            <div className="text-[9px] font-display font-bold uppercase tracking-[0.12em] text-white/40">Points</div>
            <div className="text-lg font-display font-bold text-white/80 leading-none mt-0.5">{game.bankedPoints}</div>
          </div>
          <div className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2 min-w-[80px] transition-colors duration-300 ${
            game.enemyLootCards.length > 0
              ? 'border-game-gold/30 bg-game-gold/10 shadow-[0_0_15px_rgba(230,179,30,0.15)]'
              : 'border-white/5 bg-transparent'
          }`}>
            <div className={`text-[9px] font-display font-bold uppercase tracking-[0.12em] ${game.enemyLootCards.length > 0 ? 'text-game-gold/80' : 'text-white/40'}`}>Enemy Loot</div>
            <div className={`text-lg font-display font-bold leading-none mt-0.5 ${game.enemyLootCards.length > 0 ? 'text-game-gold' : 'text-white/60'}`}>{game.enemyLootCards.length}</div>
          </div>
          <div ref={autoPlayMenuRef} className="relative">
            <GolfHudIconButton
              label={autoPlayMode === 'off' ? 'Autoplay' : `Autoplay ${autoPlayMode}`}
              icon="A"
              active={autoPlayMode !== 'off'}
              onClick={() => setShowAutoPlayMenu((prev) => !prev)}
            />
            {showAutoPlayMenu ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[168px] rounded-2xl border border-white/10 bg-[rgba(6,8,12,0.96)] p-2 shadow-[0_20px_48px_rgba(0,0,0,0.45)]">
                {[
                  { id: 'off', label: 'Off' },
                  { id: 'tableau-pause', label: 'Tableau' },
                  { id: 'tactical-pause', label: 'Tactical' },
                  { id: 'full', label: 'Full' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setAutoPlayMode(option.id as AutoPlayMode);
                      setShowAutoPlayMenu(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                      autoPlayMode === option.id
                        ? 'bg-game-teal/18 text-white'
                        : 'text-white/72 hover:bg-white/8'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.16em]">{option.label}</span>
                    <span className="text-[10px] text-white/40">{autoPlayMode === option.id ? 'ON' : ''}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <GolfHudIconButton label={paintMode ? 'Paint On' : 'Paint'} icon="P" active={paintMode} onClick={() => setPaintMode((prev) => !prev)} />
          <GolfHudIconButton label={isPaused ? 'Resume' : 'Pause'} icon={isPaused ? '▶' : '⏸'} active={isPaused} onClick={() => setIsPaused((prev) => !prev)} />
          <GolfHudIconButton label="Reset Game" icon="↺" onClick={resetGame} />
        </div>
      </div>

      <div className={`relative z-10 flex min-h-[100dvh] flex-col items-center justify-start px-3 md:px-4 ${
        ultraShortViewport
          ? 'gap-1.5 pb-[calc(env(safe-area-inset-bottom)+88px)] pt-[calc(env(safe-area-inset-top)+96px)] md:pb-20 md:pt-14'
          : shortViewport
            ? 'gap-2 pb-[calc(env(safe-area-inset-bottom)+92px)] pt-[calc(env(safe-area-inset-top)+108px)] md:pb-22 md:pt-16'
            : 'gap-3 pb-[calc(env(safe-area-inset-bottom)+104px)] pt-[calc(env(safe-area-inset-top)+124px)] md:pb-24 md:pt-20'
      }`}>
        {showKinInspector ? (
          <div ref={benchInspectorRef} className={`flex w-full max-w-[1560px] flex-1 flex-col items-center justify-start pt-4 ${shortViewport ? 'gap-4' : 'gap-6'}`}>
            <div className={`flex w-full flex-col items-center justify-center ${shortViewport ? 'gap-4' : 'gap-6'} xl:flex-row xl:items-start`}>
              <div className="shrink-0">
                <KinBenchCard
                  card={inspectedKinCard}
                  vitals={getCombatVitals(game, inspectedKinCard)}
                  combatant={getCombatantForCard(game, inspectedKinCard)}
                  actionPoints={game.playerStockActionPoints}
                  cardSize={boardCardSize}
                  heuristicLabel={null}
                  highlighted={false}
                  breathing={highlightPanForBadLuck && inspectedKinCard.name === 'Pan'}
                  discardCount={game.playerDiscardPile.length}
                  flashVersions={statusFlashVersions}
                  canInteract={false}
                  onClick={() => {}}
                />
              </div>
              <div className="w-full max-w-[760px] rounded-[28px] border border-game-gold/18 bg-[linear-gradient(180deg,rgba(8,10,16,0.92),rgba(4,6,10,0.86))] px-5 py-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-game-gold">
                  {inspectorNarrative.title}
                </div>
                <div className="mt-3 text-[14px] font-semibold leading-[1.5] text-white/88">
                  {inspectorNarrative.summary}
                </div>
                {inspectorNarrative.detail ? (
                  <div className="mt-3 text-[12px] leading-[1.6] text-white/66">
                    {inspectorNarrative.detail}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid w-full gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {inspectedKinSections.map((section) => (
                <div
                  key={section.key}
                  className="rounded-[24px] border border-white/10 bg-black/46 px-4 py-4 shadow-[0_12px_36px_rgba(0,0,0,0.24)]"
                >
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-game-teal/88">
                    {section.title}
                  </div>
                  <div className="mt-4 flex flex-wrap items-start gap-3">
                    {section.slots.map((slot, index) => (
                      <Tooltip
                        key={`${inspectedKinCard.id}-${section.key}-${slot.effect ?? slot.name ?? slot.slotId}-${index}`}
                        content={renderAbilityTooltip(slot)}
                        pinnable={false}
                      >
                        <HandSlotCard
                          slot={slot}
                          canUse={false}
                          onClick={() => {}}
                          cooldownRemaining={getAbilityCooldown(game, slot.effect)}
                          taxonomyLabel={getAbilityTaxonomyBadge(slot.effect)}
                          cardSize={handCardSize}
                        />
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`flex w-full flex-col items-center ${shortViewport ? 'gap-0.5' : 'gap-1'}`}>
            <div className={`flex w-full flex-col items-center ${shortViewport ? 'gap-0.5' : 'gap-1'}`}>
            <div className={`flex w-full max-w-[1280px] flex-col items-center ${shortViewport ? 'gap-0.5' : 'gap-1'}`}>
              {combatLaneActive ? (
                <div className="relative flex w-full flex-col items-center justify-center gap-2">
                  <div className="flex w-full items-end justify-center gap-2 md:gap-3">
                    {enemyBenchLeftSlots.map((slot, index) => renderEnemyBenchSlot(slot, `enemy-left-${index}`))}
                    <div className="flex flex-col items-center gap-2">
                      <div
                        ref={enemyStockRef}
                        className="relative rounded-[20px] border border-white/12 bg-black/40 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                        style={{
                          animation: highlightedActorNames.includes(game.enemyStock.name) ? 'golf-actor-blink 0.72s ease-in-out 2' : undefined,
                        }}
                      >
                        <ActorStatusRail
                          actorName={game.enemyStock.name}
                          combatant={game.combatants[actorKeyFromName(game.enemyStock.name)] ?? createCombatant(game.enemyStock.name)}
                          maxVisible={4}
                          iconSize={20}
                          highlightedKeys={highlightedStatusKeys}
                          flashVersions={statusFlashVersions}
                          transientStatuses={transientStatusEvents.filter((entry) => entry.actorName === game.enemyStock.name)}
                        />
                        <Card
                          card={game.enemyStock}
                          showGraphics={false}
                          size={boardCardSize}
                          foundationOverlay={getCombatVitals(game, game.enemyStock)}
                          suitFontSizeOverride={0}
                          hideElements
                          maskValue
                          disableAnimation
                          disableTilt
                          disableHoverLift
                        />
                        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-center">
                          <div className="w-full px-2 py-0.5 text-center text-[9px] font-black uppercase tracking-[0.14em] text-white/88 [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_6px_rgba(255,255,255,0.12)]">
                            {game.enemyStock.name}
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 top-[58px] z-20 flex justify-center">
                          <div className="text-[34px] font-black leading-none text-white [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_10px_rgba(255,255,255,0.16)]">
                            {rankLabel(game.enemyStock.rank)}
                          </div>
                        </div>
                        <StaggerPressureBadge
                          pressure={(game.combatants[actorKeyFromName(game.enemyStock.name)]?.staggerPressure ?? 0)}
                        />
                        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 rounded-full border border-white/12 bg-black/70 px-3 py-1 text-center text-[8px] font-black uppercase tracking-[0.14em] text-white/65">
                          {currentEnemyProfile.actor.moveset.join(' • ')}
                        </div>
                        <ApBadge actionPoints={game.enemyStockActionPoints} />
                      </div>
                      <div className="w-full max-w-[220px] rounded-[16px] border border-white/10 bg-black/32 px-3 py-2 text-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/48">Intent</div>
                        <div
                          ref={maulReadyRef}
                          className="mt-1"
                          style={{
                            animation: enemyActionPreview.hostile ? 'golf-maul-alert 1.25s ease-in-out infinite' : undefined,
                          }}
                        >
                          <div className="text-[12px] font-black uppercase tracking-[0.12em] text-white/84">{enemyActionPreview.title}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-game-gold/72">{enemyActionPreview.targetLabel}</div>
                          <div className="mt-1 text-[11px] leading-4 text-white/62">{enemyActionPreview.detail}</div>
                        </div>
                      </div>
                    </div>
                    {enemyBenchRightSlots.map((slot, index) => renderEnemyBenchSlot(slot, `enemy-right-${index}`))}
                  </div>
                </div>
              ) : null}
              <div
                className="flex w-full justify-center overflow-x-auto overflow-y-visible pb-2"
                style={{
                  paddingTop: !combatLaneActive ? Math.max(132, Math.round(boardCardSize.height * 0.9)) : undefined,
                  paddingBottom: !combatLaneActive ? Math.max(16, Math.round(boardCardSize.height * 0.08)) : undefined,
                }}
              >
                <div className="flex min-w-max items-start px-1" style={{ gap: columnGap }}>
                  {game.tableau.map((column, columnIndex) => {
                    const topCard = column[column.length - 1] ?? null;
                    const eligibleTargets = topCard ? getEligiblePlayerTargetsForCard(game, topCard) : [];
                    const stickyPreviewRank = column.length > 1 ? rankLabel(column[column.length - 2].rank) : null;
                    const showStickyPreview =
                      !!topCard &&
                      !!stickyPreviewRank &&
                      stickyPawsPreviewActive &&
                      (eligibleTargets.length > 0 || canRouteCardIntoConstruct(game, topCard));
                    const rewirePlayable =
                      !!topCard &&
                      currentTurn === 'player' &&
                      game.playerStock.name === 'Jet' &&
                      game.jetRewireActionsRemaining > 0;
                    const isMochiTokenCollectible = isTutorialMochiRescueTokenCollectible(game, columnIndex, topCard);
                    const isPlayable =
                      !!topCard &&
                      currentTurn === 'player' &&
                      (rewirePlayable || eligibleTargets.length > 0 || isMochiTokenCollectible) &&
                      (!tutorialRailColumns || tutorialRailColumns.has(columnIndex)) &&
                      (!stickyPawsArmed || column.length > 1);
                    const tableauSourcePrimed =
                      currentTurn === 'player' &&
                      pendingPlayerPlay?.source === 'tableau' &&
                      typeof pendingPlayerPlay.columnIndex === 'number';
                    const actualHiddenCount = Math.max(0, column.length - 1);
                    const layeredTableauActive = !combatLaneActive && displayNonCombatPeekCount > 0;
                    const columnHeight = boardCardSize.height + displayNonCombatPeekCount * nonCombatTableauPeek;
                    const orderedCards = column;
                    const placeholderDepths = layeredTableauActive
                      ? Array.from(
                          { length: Math.max(0, displayNonCombatPeekCount - actualHiddenCount) },
                          (_, index) => displayNonCombatPeekCount - index
                        ).filter((depth) => depth > actualHiddenCount)
                      : [];

                    return (
                      <div
                        key={`column-${columnIndex}`}
                        className={`relative ${layeredTableauActive ? 'overflow-visible' : 'overflow-hidden'}`}
                        style={{ width: boardCardSize.width + 4, height: (columnHeight || boardCardSize.height) + 4 }}
                      >
                        {column.length === 0 ? (
                          (() => {
                            tableauTopRefs.current[columnIndex] = null;
                            if (game.tutorialSliceId || game.scenarioId === 'rng') {
                              return (
                                <div
                                  className="h-full rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,20,26,0.56),rgba(7,8,11,0.46))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"
                                  style={{
                                    clipPath: `inset(0 0 calc(100% - ${Math.max(nonCombatRankReveal, 34)}px) 0 round 22px)`,
                                  }}
                                />
                              );
                            }
                            return (
                              <div className="flex h-full items-center justify-center rounded-[22px] holo-slot-border text-[12px] font-display font-bold uppercase tracking-[0.35em] text-game-teal/40 holo-text-glow">
                                Cleared
                              </div>
                            );
                          })()
                        ) : (
                          <>
                            {placeholderDepths.map((depth) => {
                              const placeholderTop = displayNonCombatPeekCount * nonCombatTableauPeek - (depth * nonCombatTableauPeek);
                              return (
                                <div
                                  key={`column-${columnIndex}-placeholder-${depth}`}
                                  className="pointer-events-none absolute left-0 overflow-hidden rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,26,0.74),rgba(7,8,11,0.68))]"
                                  style={{
                                    top: placeholderTop,
                                    width: boardCardSize.width + 4,
                                    height: boardCardSize.height + 4,
                                    zIndex: 0,
                                    opacity: 0.55,
                                    clipPath: `inset(0 0 calc(100% - ${nonCombatRankReveal}px) 0 round 16px)`,
                                    boxShadow: '0 0 12px rgba(255,255,255,0.04)',
                                  }}
                                />
                              );
                            })}
                          {orderedCards.map((card, displayIndex) => {
                            const actualIndex = displayIndex;
                            const isTopCard = actualIndex === column.length - 1;
                            const buriedDepth = column.length - 1 - actualIndex;
                            const isChargedTopCard = isTopCard && isJetChargedCard(game, card.id);
                            const biteCount = isTopCard ? getEnemyBiteCount(game, card.id) : 0;
                            const visiblePeekDepth = layeredTableauActive
                              ? Math.min(displayNonCombatPeekCount, buriedDepth)
                              : 0;
                            const tableauFrontTop = !combatLaneActive
                              ? displayNonCombatPeekCount * nonCombatTableauPeek
                              : 0;
                            const visualTop = !combatLaneActive
                              ? Math.max(0, tableauFrontTop - (visiblePeekDepth * nonCombatTableauPeek))
                              : 0;
                            const guidanceGlow =
                              currentTurn === 'player' &&
                              effectiveOracleMode !== 'off' &&
                              isTopCard &&
                              guidanceNextColumn === columnIndex;
                            const isSelectedSource =
                              currentTurn === 'player' &&
                              pendingPlayerPlay?.source === 'tableau' &&
                              pendingPlayerPlay.columnIndex === columnIndex &&
                              isTopCard;
                            const backgroundTableauCard = tableauSourcePrimed && !isSelectedSource;
                            const isTutorialMochiTargetCard =
                              game.tutorialSliceId === 'slice-01' &&
                              columnIndex === tutorialMochiTargetColumn &&
                              card.id === tutorialMochiTargetCardId;
                            const showMochiRescueToken = isTutorialMochiTargetCard;
                            const buriedCardAccessible = !isTopCard && canAccessBuriedTableauCard(game, columnIndex, card, buriedDepth);
                            const hideTutorialBuriedCardFace = game.tutorialSliceId === 'slice-01' && !isTopCard;
                            const showTutorialPursuitMarker = isTutorialPursuitMarkerCard(game, columnIndex, buriedDepth);

                            if (layeredTableauActive && !isTopCard) {
                              if (isTutorialFillerCard(card) || hideTutorialBuriedCardFace) {
                                return (
                                  <div key={card.id} className="contents">
                                    <div
                                      ref={(node) => {
                                        tableauCardRefs.current[card.id] = node;
                                      }}
                                      className="pointer-events-none absolute left-0 overflow-hidden rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,26,0.74),rgba(7,8,11,0.68))]"
                                      style={{
                                        top: visualTop,
                                        width: boardCardSize.width + 4,
                                        height: boardCardSize.height + 4,
                                        zIndex: displayIndex + 1,
                                        opacity: isTutorialFillerCard(card) ? 0.52 : 0.58,
                                        clipPath: `inset(0 0 calc(100% - ${nonCombatRankReveal}px) 0 round 16px)`,
                                        boxShadow: '0 0 12px rgba(255,255,255,0.04)',
                                      }}
                                    />
                                    {isTutorialMochiTargetCard ? (
                                      <div
                                        className="pointer-events-none absolute left-0 rounded-[16px] border-2 border-[#ff5c5c]/90 shadow-[0_0_34px_rgba(255,72,72,0.28),0_0_12px_rgba(255,72,72,0.2)]"
                                        style={{
                                          top: visualTop,
                                          width: boardCardSize.width + 4,
                                          height: boardCardSize.height + 4,
                                          zIndex: displayIndex + 1,
                                          animation: 'golf-mochi-danger-breathe 1.7s ease-in-out infinite',
                                        }}
                                      >
                                        <div
                                          className="pointer-events-none absolute inset-x-0 flex justify-center"
                                          style={{ top: Math.max(18, Math.round(nonCombatRankReveal * 0.46)) }}
                                        >
                                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ff7f7f]/85 bg-[rgba(20,6,6,0.92)] text-[16px] shadow-[0_0_14px_rgba(255,72,72,0.28)]">
                                            🐾
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                    {showTutorialPursuitMarker ? (
                                      <div
                                        className="pointer-events-none absolute left-0 rounded-[16px]"
                                        style={{
                                          top: visualTop,
                                          width: boardCardSize.width + 4,
                                          height: boardCardSize.height + 4,
                                          zIndex: displayIndex + 2,
                                        }}
                                      >
                                        <div className="absolute inset-x-0 top-[8px] flex justify-center">
                                          <div className="rounded-full border border-[#8fe6ff]/45 bg-[rgba(5,14,22,0.92)] px-2 py-0.5 text-[14px] font-black leading-none text-[#8fe6ff] shadow-[0_0_14px_rgba(143,230,255,0.2)]">
                                            ?
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              }
                              return (
                                <div key={card.id} className="contents">
                                  <div
                                    ref={(node) => {
                                      tableauCardRefs.current[card.id] = node;
                                    }}
                                    className="pointer-events-none absolute left-0 overflow-hidden rounded-[16px] border border-white/15 bg-[linear-gradient(180deg,rgba(18,20,26,0.96),rgba(7,8,11,0.92))] shadow-[0_0_18px_rgba(255,255,255,0.08)]"
                                    style={{
                                      top: visualTop,
                                      width: boardCardSize.width + 4,
                                      height: boardCardSize.height + 4,
                                      zIndex: displayIndex + 1,
                                      opacity: buriedCardAccessible ? 0.98 : 0.88,
                                      clipPath: `inset(0 0 calc(100% - ${nonCombatRankReveal}px) 0 round 16px)`,
                                    }}
                                  >
                                    <div className="pointer-events-none absolute inset-x-0 top-[8px] z-20 flex justify-center">
                                      <div
                                        className="text-[28px] font-black leading-none [text-shadow:0_1px_0_rgba(0,0,0,0.92),0_0_8px_rgba(255,255,255,0.08)]"
                                        style={{
                                          color: buriedCardAccessible ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.42)',
                                        }}
                                      >
                                        {rankLabel(card.rank)}
                                      </div>
                                    </div>
                                  </div>
                                  {isTutorialMochiTargetCard ? (
                                    <div
                                      className="pointer-events-none absolute left-0 rounded-[16px] border-2 border-[#ff5c5c]/90 shadow-[0_0_34px_rgba(255,72,72,0.28),0_0_12px_rgba(255,72,72,0.2)]"
                                      style={{
                                        top: visualTop,
                                        width: boardCardSize.width + 4,
                                        height: boardCardSize.height + 4,
                                        zIndex: displayIndex + 1,
                                        animation: 'golf-mochi-danger-breathe 1.7s ease-in-out infinite',
                                      }}
                                    >
                                      <div
                                        className="pointer-events-none absolute inset-x-0 flex justify-center"
                                        style={{ top: Math.max(18, Math.round(nonCombatRankReveal * 0.46)) }}
                                      >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ff7f7f]/85 bg-[rgba(20,6,6,0.92)] text-[16px] shadow-[0_0_14px_rgba(255,72,72,0.28)]">
                                          🐾
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            }

                            return (
                              <button
                                key={card.id}
                                ref={(node) => {
                                  tableauCardRefs.current[card.id] = node;
                                  if (isTopCard) {
                                    tableauTopRefs.current[columnIndex] = node;
                                  }
                                }}
                                type="button"
                                onClick={isTopCard ? () => playToPlayerStock(columnIndex) : undefined}
                                disabled={!isTopCard || !isPlayable}
                                className={`absolute left-0 overflow-hidden rounded-[16px] p-0.5 text-left transition-transform ${
                                  isTopCard && isPlayable
                                    ? 'cursor-pointer hover:-translate-y-1'
                                    : isTopCard
                                      ? 'cursor-default'
                                      : 'pointer-events-none'
                                }`}
                                style={{
                                  top: visualTop,
                                  width: boardCardSize.width + 4,
                                  height: boardCardSize.height + 4,
                                  zIndex: displayIndex + 1,
                                  transform: isSelectedSource
                                    ? 'translateY(-10px) scale(1.06)'
                                    : backgroundTableauCard
                                      ? 'scale(0.985)'
                                      : undefined,
                                  animation: isSelectedSource ? 'golf-selected-card-float 1.4s ease-in-out infinite' : undefined,
                                  filter: backgroundTableauCard
                                    ? 'grayscale(1) saturate(0.45) brightness(0.42)'
                                    : undefined,
                                  opacity: backgroundTableauCard ? 0.7 : 1,
                                }}
                              >
                                <div
                                  className="rounded-[16px] border border-white/15 bg-[linear-gradient(180deg,rgba(18,20,26,0.96),rgba(7,8,11,0.92))] p-0.5 shadow-[0_0_18px_rgba(255,255,255,0.08)]"
                                  style={
                                    isSelectedSource
                                      ? {
                                          borderColor: 'rgba(230,179,30,0.7)',
                                          boxShadow: '0 0 28px rgba(230,179,30,0.32), 0 0 10px rgba(230,179,30,0.2)',
                                          background: 'rgba(14, 10, 3, 0.82)',
                                        }
                                      : backgroundTableauCard
                                        ? {
                                            borderColor: 'rgba(255,255,255,0.08)',
                                            boxShadow: 'none',
                                            background: 'rgba(0, 0, 0, 0.82)',
                                          }
                                        : isChargedTopCard
                                          ? {
                                              borderColor: 'rgba(112,229,240,0.62)',
                                              boxShadow: '0 0 26px rgba(112,229,240,0.22), inset 0 0 18px rgba(112,229,240,0.08)',
                                              background: 'rgba(3, 12, 18, 0.82)',
                                            }
                                          : isTutorialMochiTargetCard
                                            ? {
                                                borderColor: 'rgba(255,92,92,0.78)',
                                                boxShadow: '0 0 34px rgba(255,72,72,0.28), 0 0 12px rgba(255,72,72,0.2)',
                                                background: 'rgba(20, 6, 6, 0.82)',
                                                animation: 'golf-mochi-danger-breathe 1.7s ease-in-out infinite',
                                              }
                                          : guidanceGlow
                                            ? { boxShadow: effectiveOracleMode === 'ancestors' ? '0 0 24px rgba(230,179,30,0.28)' : '0 0 20px rgba(230,179,30,0.16)' }
                                            : undefined
                                  }
                                >
                                  <div className="relative">
                                    {isTutorialFillerCard(card) ? (
                                      <div
                                        className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,26,0.74),rgba(7,8,11,0.68))]"
                                        style={{
                                          width: boardCardSize.width,
                                          height: boardCardSize.height,
                                          boxShadow: 'inset 0 0 18px rgba(255,255,255,0.03)',
                                        }}
                                      />
                                    ) : null}
                                    {isTutorialMochiTargetCard ? (
                                      <div
                                        className="pointer-events-none absolute inset-0 z-30 rounded-[16px] border-2 border-[#ff5c5c]/90 shadow-[0_0_34px_rgba(255,72,72,0.28),0_0_12px_rgba(255,72,72,0.2)]"
                                        style={{ animation: 'golf-mochi-danger-breathe 1.7s ease-in-out infinite' }}
                                      />
                                    ) : null}
                                    {!isTutorialFillerCard(card) ? (
                                      <Card
                                        card={card}
                                        showGraphics={false}
                                        size={boardCardSize}
                                        canPlay={isTopCard && isPlayable}
                                        borderColorOverride="transparent"
                                        boxShadowOverride="none"
                                        suitDisplayOverride={card.suit}
                                        suitFontSizeOverride={indicatorSize}
                                        disableAnimation={!isTopCard}
                                        disableTilt
                                        disableHoverLift
                                        cardTokens={
                                          showMochiRescueToken
                                            ? [{
                                                id: 'mochi-rescue-paw',
                                                label: 'Mochi Rescue',
                                                emoji: '🐾',
                                                tone: 'alert',
                                                anchor: 'mid-center',
                                                prominent: true,
                                                revealEffect: 'rescue-flash',
                                              }]
                                            : []
                                        }
                                      />
                                    ) : null}
                                    {biteCount > 0 ? (
                                      <>
                                        <div
                                          className="pointer-events-none absolute -right-4 top-4 z-10 h-10 w-10 rounded-full border border-[#2f0d07] bg-[#060303] shadow-[0_0_0_2px_rgba(0,0,0,0.78)]"
                                          style={{ opacity: 0.95 }}
                                        />
                                        <div
                                          className="pointer-events-none absolute -right-3 top-[calc(50%-18px)] z-10 h-9 w-9 rounded-full border border-[#2f0d07] bg-[#060303] shadow-[0_0_0_2px_rgba(0,0,0,0.78)]"
                                          style={{ opacity: biteCount >= 2 ? 0.95 : 0 }}
                                        />
                                        <div
                                          className="pointer-events-none absolute -right-4 bottom-4 z-10 h-10 w-10 rounded-full border border-[#2f0d07] bg-[#060303] shadow-[0_0_0_2px_rgba(0,0,0,0.78)]"
                                          style={{ opacity: biteCount >= 3 ? 0.95 : 0 }}
                                        />
                                        <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-full border border-[#ff8a62]/45 bg-[rgba(29,8,5,0.88)] px-2 py-1 shadow-[0_0_14px_rgba(255,138,98,0.2)]">
                                          <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ffb497]">
                                            Bite {biteCount}/{ENEMY_BITE_DESTROY_THRESHOLD}
                                          </div>
                                        </div>
                                      </>
                                    ) : null}
                                    {isChargedTopCard ? (
                                      <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-full border border-[#70e5f0]/60 bg-[rgba(6,16,24,0.92)] px-2 py-1 shadow-[0_0_18px_rgba(112,229,240,0.24)]">
                                        <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[#70e5f0]">Charged</div>
                                      </div>
                                    ) : null}
                                {isTopCard && showStickyPreview ? (
                                  <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 -translate-y-[120%]">
                                    <div className="rounded-full border border-game-gold/45 bg-black/88 px-2 py-1 shadow-[0_0_18px_rgba(230,179,30,0.24)]">
                                          <div className="text-[8px] font-black uppercase tracking-[0.16em] text-game-gold/70">under</div>
                                      <div className="mt-[1px] text-center text-[12px] font-black leading-none text-white">{stickyPreviewRank}</div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </button>
                            );
                          })}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={`flex w-full flex-col items-center ${shortViewport ? 'gap-2' : 'gap-3'}`}>
                <div className="flex w-full items-start justify-center gap-2 md:gap-3">
                  {playerBenchLeftSlots.map((slot, index) => renderPlayerBenchSlot(slot, `player-left-${index}`))}
                  {kinInspectIndex === null ? (
                    <div className={`relative flex flex-col items-center justify-center ${shortViewport ? 'gap-2' : 'gap-3'}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirmPendingPlayerPlay(game.playerStock.id)) {
                            return;
                          }
                          triggerPrimeCollapse();
                        }}
                        onPointerDown={() => handleKinInspectPointerDown(-1)}
                        onPointerUp={handleKinInspectPointerEnd}
                        onPointerCancel={handleKinInspectPointerEnd}
                        className="relative rounded-[20px] border border-white/12 bg-black/40 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                        style={primeTapped ? {
                          transform: 'rotate(7deg) translateY(3px)',
                          transition: 'transform 120ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out',
                          borderColor: warnDeadlock ? 'rgba(255,72,72,0.82)' : undefined,
                          boxShadow: warnDeadlock
                            ? '0 0 0 2px rgba(255,72,72,0.65), 0 0 28px rgba(255,72,72,0.42), 0 18px 40px rgba(0,0,0,0.22)'
                            : undefined,
                          animation: highlightedActorNames.includes(game.playerStock.name) ? 'golf-actor-blink 0.72s ease-in-out 2' : undefined,
                        } : {
                          transition: 'transform 120ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out',
                          borderColor: warnDeadlock ? 'rgba(255,72,72,0.82)' : undefined,
                          boxShadow: warnDeadlock
                            ? '0 0 0 2px rgba(255,72,72,0.65), 0 0 28px rgba(255,72,72,0.42), 0 18px 40px rgba(0,0,0,0.22)'
                            : undefined,
                          animation: highlightedActorNames.includes(game.playerStock.name) ? 'golf-actor-blink 0.72s ease-in-out 2' : undefined,
                        }}
                      >
                        <ActorStatusRail
                          actorName={game.playerStock.name}
                          combatant={game.combatants[actorKeyFromName(game.playerStock.name)] ?? createCombatant(game.playerStock.name)}
                          maxVisible={4}
                          iconSize={20}
                          highlightedKeys={highlightedStatusKeys}
                          flashVersions={statusFlashVersions}
                          transientStatuses={transientStatusEvents.filter((entry) => entry.actorName === game.playerStock.name)}
                        />
                        <div ref={playerStockRef}>
                          <Card
                            card={game.playerStock}
                            showGraphics={false}
                            size={boardCardSize}
                            foundationOverlay={getCombatVitals(game, game.playerStock)}
                            suitFontSizeOverride={0}
                            hideElements
                            maskValue
                            disableAnimation
                            disableTilt
                            disableHoverLift
                          />
                        </div>
                        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2">
                          <div className="px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/88 [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_6px_rgba(255,255,255,0.12)]">
                            {game.playerStock.name}
                          </div>
                          <div />
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 top-[58px] z-20 flex justify-center">
                          <div className="text-[34px] font-black leading-none text-white [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_10px_rgba(255,255,255,0.16)]">
                            {rankLabel(game.playerStock.rank)}
                          </div>
                        </div>
                        {kinInspectHoldIndexRef.current === -1 ? (
                          <div className="pointer-events-none absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full border border-game-gold/30 bg-black/70">
                            <div className="h-full rounded-full bg-game-gold" style={{ width: `${Math.min(100, Math.max(0, kinInspectHoldProgress * 100))}%` }} />
                          </div>
                        ) : null}
                        {renderKinMeter(
                          game.playerStock.name,
                          game.playerStockActionPoints,
                          game.starterPackModes[game.activeStarterPackIndex] ?? 'default',
                          game.starterPackAbilityRarities[game.activeStarterPackIndex] ?? 1,
                          'prime',
                          false
                        )}
                      </button>
                      {activePrimeHandSlots.length > 0 ? (
                        <div className="flex max-w-full flex-nowrap items-end justify-center gap-2 overflow-visible">
                          {activePrimeHandSlots.map((slot) => (
                            <Tooltip
                              key={slot.slotId}
                              content={renderAbilityTooltip(slot)}
                              pinnable
                              isPinned={pinnedTooltipSlotId === slot.slotId}
                              onPinnedChange={(pinned) => setPinnedTooltipSlotId(pinned ? slot.slotId as HandSlotId : null)}
                              hoverEnabled
                              clickToPin={false}
                            >
                              <HandSlotCard
                                slot={slot}
                                canUse={canUseAbilitySlot(slot)}
                                interactive={currentTurn === 'player'}
                                onClick={() => useHandSlot(slot.slotId as HandSlotId)}
                                onPointerDown={(event) => handleAbilityTooltipPointerDown(event, slot)}
                                onPointerUp={handleAbilityTooltipPointerEnd}
                                onPointerCancel={handleAbilityTooltipPointerEnd}
                                onClickCapture={handleAbilityTooltipClickCapture}
                                holdProgress={abilityTooltipHoldSlotId === slot.slotId ? abilityTooltipHoldProgress : 0}
                                cooldownRemaining={getAbilityCooldown(game, slot.effect)}
                                taxonomyLabel={getAbilityTaxonomyBadge(slot.effect)}
                                cardSize={handCardSize}
                                slotRef={(node) => {
                                  if (slot.slotId in playerHandRefs.current) {
                                    playerHandRefs.current[slot.slotId as HandSlotId] = node;
                                  }
                                }}
                              />
                            </Tooltip>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-full border border-dashed border-white/10 bg-black/18 px-3 py-2">
                          <div className="text-[8px] font-black uppercase tracking-[0.16em] text-white/42">Prime Hand</div>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {playerBenchRightSlots.map((slot, index) => renderPlayerBenchSlot(slot, `player-right-${index}`))}
                </div>
              </div>
            </div>
            <div ref={benchInspectorRef} className="flex flex-col items-center gap-3">
              {nextGuideStep ? (
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-game-gold/80">
                  {guidePlan?.source === 'prophecy' ? 'Prophecy Navi' : 'Follow Navi'}
                </div>
              ) : null}
            </div>
            {showHeuristicValues && currentTurn === 'player' && effectiveOracleMode !== 'ancestors' ? (
              <HeuristicPill label={guidePlan?.source === 'prophecy' ? 'prophecy path' : effectiveOracleMode === 'ancestors' ? 'hidden best path' : 'visible best path'} />
            ) : null}
            <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3 right-3 z-40 flex items-end justify-end gap-3 md:bottom-6 md:left-auto md:right-6 pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-2 glass-panel rounded-2xl p-2">
                {game.scenarioId === 'rng' ? (
                  <div className="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-white/8 bg-black/32 px-3 py-2">
                    <div className="text-[9px] font-display font-bold uppercase tracking-[0.14em] text-white/46">Long Rests</div>
                    <div className="mt-0.5 text-lg font-display font-bold leading-none text-white/86">{game.longRestCount}</div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleEndTurn}
                  className="group relative flex items-center justify-center rounded-xl border border-game-pink/40 bg-game-pink/10 px-5 py-3 transition-all duration-300 hover:bg-game-pink/20 hover:border-game-pink/60 hover:shadow-[0_0_20px_rgba(217,70,239,0.25)] active:scale-95"
                  style={{ minWidth: 100 }}
                >
                  <span className="text-xs font-display font-bold uppercase tracking-[0.2em] text-game-pink group-hover:text-white transition-colors">End Turn</span>
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showTutorialRescueDepth && tutorialMochiRescueStage ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.28)]">
          <div
            ref={tutorialRescueModalRef}
            className="pointer-events-auto flex items-center gap-4 rounded-[24px] border border-game-gold/20 bg-[linear-gradient(180deg,rgba(12,10,8,0.96),rgba(6,5,4,0.92))] px-4 py-3 shadow-[0_22px_60px_rgba(0,0,0,0.42)]"
          >
            <div className="relative">
              <div className="rounded-[18px] border border-game-gold/24 bg-black/48 p-1">
                <Card
                  card={tutorialMochiRescueCard}
                  showGraphics={false}
                  size={starterPackCardSize}
                  foundationOverlay={tutorialMochiRescueVitals}
                  suitFontSizeOverride={0}
                  hideElements
                  maskValue
                  disableAnimation
                  disableTilt
                  disableHoverLift
                />
                <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
                  <div className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/88">Mochi</div>
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-30 rounded-b-[18px] border-t border-[#3a2a13]/70 bg-[linear-gradient(180deg,rgba(27,18,10,0.25),rgba(8,5,2,0.96))]"
                  style={{ height: tutorialMochiRescueStage.coverHeight }}
                />
                <div className="pointer-events-none absolute inset-x-2 bottom-2 z-40 rounded-full border border-game-gold/28 bg-black/78 px-2 py-1 text-center text-[7px] font-black uppercase tracking-[0.14em] text-game-gold/76">
                  buried target
                </div>
              </div>
            </div>
            <div className="max-w-[280px]">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-game-gold">Rescue Depth</div>
              <div className="mt-1 text-[13px] font-semibold text-white/88">{tutorialMochiRescueStage.label}</div>
              <div className="mt-1 text-[11px] leading-4 text-white/62">{tutorialMochiRescueStage.detail}</div>
            </div>
          </div>
        </div>
      ) : null}

      {showTutorialRewardModal ? (
        <RewardModalShell
          title="Kin Rescued!"
          reward_sticker={(
            <img
              src="/assets/actors/mochikin/mochi_emoji_stars.png"
              alt=""
              aria-hidden="true"
              className="h-auto w-[132px] drop-shadow-[0_10px_18px_rgba(0,0,0,0.42)] md:w-[148px]"
              style={{
                transform: 'rotate(8deg)',
                transformOrigin: '50% 80%',
                animation: 'golf-reward-sticker-float 2.8s ease-in-out infinite',
              }}
            />
          )}
          onClose={() => setShowTutorialRewardModal(false)}
        >
          <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
            <div className="text-center md:col-span-2 md:pr-[196px] md:text-left">
              <div className="text-[15px] font-semibold italic leading-6 text-white/88">
                {titleCasePronoun(tutorialMochiProfile.pronouns.subject)} will need Hero to carry the next five actions before {tutorialMochiProfile.pronouns.subject} feels safe enough to act.
              </div>
            </div>
            <div className="flex flex-col items-center rounded-[22px] border border-white/8 bg-black/28 p-4">
              <KinBenchCard
                card={tutorialMochiRescueCard}
                vitals={tutorialMochiRescueVitals}
                combatant={tutorialMochiRewardCombatant}
                actionPoints={0}
                canInteract
                onClick={claimTutorialMochiReward}
                cardSize={starterPackCardSize}
                flashVersions={statusFlashVersions}
                discardCount={0}
                cardRef={(node) => {
                  tutorialRewardCardRef.current = node;
                }}
                constrainBackdrop
              />
              <div className="mt-4 flex flex-col items-center">
                <div
                  className="h-0 w-0 border-l-[12px] border-r-[12px] border-b-[16px] border-l-transparent border-r-transparent border-b-game-gold/85 drop-shadow-[0_0_10px_rgba(230,179,30,0.35)]"
                  style={{ animation: 'golf-breathe 1.85s ease-in-out infinite' }}
                  aria-hidden="true"
                />
                <div
                  className="mt-2 rounded-full border border-game-gold/40 bg-[rgba(18,12,4,0.92)] px-4 py-2 text-center shadow-[0_0_18px_rgba(230,179,30,0.16)]"
                  style={{
                    animation: 'golf-breathe 1.85s ease-in-out infinite',
                    boxShadow: '0 0 24px rgba(230,179,30,0.24), 0 0 8px rgba(230,179,30,0.18)',
                  }}
                >
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-game-gold">
                    Tap To Collect Mochi
                  </div>
                </div>
              </div>
            </div>
            <div className="max-w-[380px] text-center md:max-w-none md:text-left">
              <div className="mt-3 rounded-[16px] border border-white/10 bg-black/34 px-3 py-3">
                <div className="space-y-3 text-left">
                  {tutorialMochiRewardEffects.map((effect) => (
                    <div key={effect.key} className="flex items-start gap-3">
                      <RewardEffectTile label={effect.label} tone={effect.tone} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-game-pink">
                          {effect.name}
                        </div>
                        <div className="mt-1 text-[11px] leading-[1.3] text-white/62">
                          {renderGameText(effect.flavor)}
                        </div>
                        <div className="mt-1 text-[11px] leading-[1.3] text-white/84">
                          {renderGameText(effect.effect, { enableEffectTooltips: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </RewardModalShell>
      ) : null}

      {showTutorialScenePicker ? (
        <TutorialScenePicker
          scenes={tutorialSceneOptions}
          onSelect={jumpToTutorialScene}
          onClose={() => setShowTutorialScenePicker(false)}
        />
      ) : null}

      {enemyDragAnim && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <div
            ref={enemyDragNodeRef}
            className="pointer-events-none absolute left-0 top-0"
            style={{
              willChange: 'transform',
              transform: `translate3d(${enemyDragAnim.from.x.toFixed(2)}px, ${enemyDragAnim.from.y.toFixed(2)}px, 0) rotate(0deg)`,
              transition: 'none',
            }}
          >
            <div className="relative h-0 w-0">
              {enemyDragAnim.mode === 'drag' && (
                <div
                  className="absolute"
                  style={{
                    width: CARD_SIZE.width,
                    height: CARD_SIZE.height,
                    transform: 'translate(calc(-100% + 10px), calc(-100% + 10px))',
                    transformOrigin: '100% 100%',
                  }}
                >
                  <div className="rounded-[18px] border border-game-pink/45 bg-black/80 p-1.5 shadow-[0_0_24px_rgba(217,70,239,0.18)]">
                    <Card
                      card={enemyDragAnim.card}
                      showGraphics={false}
                      size={CARD_SIZE}
                      suitFontSizeOverride={GOLF_ELEMENT_INDICATOR_SIZE}
                      disableAnimation
                      disableTilt
                      disableHoverLift
                    />
                  </div>
                </div>
              )}
              {enemyDragAnim.mode === 'cursor' ? (
                <div
                  className="absolute select-none text-[28px] leading-none text-game-gold drop-shadow-[0_0_10px_rgba(230,179,30,0.95)]"
                  style={{
                    left: 0,
                    top: 0,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  ☝
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {maulTelegraphPath ? (
        <div className="pointer-events-none absolute inset-0 z-20">
          <svg width="100%" height="100%" viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none">
            <defs>
              <filter id="golf-maul-telegraph-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker id="golf-maul-telegraph-head" markerWidth="14" markerHeight="14" refX="11" refY="7" orient="auto">
                <path d="M 0 0 L 14 7 L 0 14 z" fill="rgba(255,82,82,0.92)" />
              </marker>
            </defs>
            <path
              d={maulTelegraphPath}
              fill="none"
              stroke="rgba(255,82,82,0.22)"
              strokeWidth="8"
              strokeLinecap="round"
              filter="url(#golf-maul-telegraph-glow)"
              style={{ animation: 'golf-maul-telegraph 1.25s ease-in-out infinite' }}
            />
            <path
              d={maulTelegraphPath}
              fill="none"
              stroke="rgba(255,98,98,0.94)"
              strokeWidth="3.25"
              strokeLinecap="round"
              markerEnd="url(#golf-maul-telegraph-head)"
              style={{ animation: 'golf-maul-telegraph 1.25s ease-in-out infinite' }}
            />
          </svg>
        </div>
      ) : null}
      {rescueCardFlash ? (
        <div className="pointer-events-none absolute inset-0 z-40">
          <div
            key={rescueCardFlash.id}
            className="absolute left-0 top-0 h-8 w-8"
            style={{
              transform: `translate3d(${rescueCardFlash.x.toFixed(2)}px, ${rescueCardFlash.y.toFixed(2)}px, 0)`,
              marginLeft: -16,
              marginTop: -16,
            }}
          >
            <div 
              className={`h-full w-full rounded-full ${
                rescueCardFlash.tone === 'red' 
                  ? 'token-reveal-flash' 
                  : 'rescue-card-click-flash'
              }`} 
            />
          </div>
        </div>
      ) : null}
      {playerHandAnim && (
        <div className="pointer-events-none absolute inset-0 z-[70]">
          <div
            ref={playerHandAnimNodeRef}
            className="absolute left-0 top-0"
            style={{
              width: CARD_SIZE.width,
              height: CARD_SIZE.height,
              transform: `translate3d(${playerHandAnim.from.x.toFixed(2)}px, ${playerHandAnim.from.y.toFixed(2)}px, 0)`,
              marginLeft: -(CARD_SIZE.width / 2),
              marginTop: -(CARD_SIZE.height / 2),
              transition: 'none',
              transformStyle: 'preserve-3d',
              perspective: '1200px',
              willChange: 'transform, opacity, filter',
            }}
          >
            <div
              className={playerHandAnim.variant === 'reward-flip' ? 'h-full w-full animate-[golf-reward-flight-flip_var(--reward-flight-duration)_linear_both]' : 'h-full w-full'}
              style={{
                transformStyle: 'preserve-3d',
                ...(playerHandAnim.variant === 'reward-flip'
                  ? ({ ['--reward-flight-duration' as string]: `${playerHandAnim.durationMs}ms` } as CSSProperties)
                  : {})
              }}
            >
              {/* Front Face */}
              <div 
                className="h-full w-full absolute inset-0"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <ActorFrameEmojiRig
                  emojiRig={{
                    src: '/assets/actors/mochikin/mochi_emoji_blush.png',
                    emotionType: 'happy',
                  }}
                />
                <div className="h-full w-full rounded-[18px] border border-game-gold/45 bg-black/80 p-1.5 shadow-[0_0_24px_rgba(230,179,30,0.22)]">
                  <Card
                    card={playerHandAnim.card}
                    showGraphics={false}
                    size={CARD_SIZE}
                    suitFontSizeOverride={GOLF_ELEMENT_INDICATOR_SIZE}
                    disableAnimation
                    disableTilt
                    disableHoverLift
                  />
                </div>
                <div className="absolute -right-1 -top-1 text-[28px] leading-none text-game-gold drop-shadow-[0_0_10px_rgba(230,179,30,0.95)]">
                  🐾
                </div>
              </div>

              {/* Back Face (Higher contrast for rotation read) */}
              <div 
                className="h-full w-full absolute inset-0 rounded-[18px] border-2 border-game-gold flex items-center justify-center overflow-hidden shadow-[0_0_40px_rgba(230,179,30,0.6)]"
                style={{ 
                  backfaceVisibility: 'hidden', 
                  transform: 'rotateY(180deg)',
                  background: 'linear-gradient(135deg, #1a1c2e 0%, #2a2c4e 50%, #1a1c2e 100%)'
                }}
              >
                <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                {/* Decorative pulse glow */}
                <div className="absolute inset-0 bg-game-gold/10 animate-pulse"></div>
                <div className="relative flex flex-col items-center h-full w-full">
                  <ActorFrameEmojiRig
                    emojiRig={{
                      src: '/assets/actors/mochikin/mochi_emoji_blush.png',
                      emotionType: 'happy',
                    }}
                  />
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-5xl drop-shadow-[0_0_20px_rgba(230,179,30,1)] scale-110 mb-2">🐾</div>
                    <div className="text-[14px] font-black text-white tracking-[0.4em] uppercase drop-shadow-md">REWARD</div>
                    <div className="mt-1 text-[10px] font-bold text-game-gold/80 tracking-[0.2em] uppercase">Mochi Recovered</div>
                  </div>
                </div>
              </div>

              {playerHandAnim.label && (
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-game-gold/40 bg-black/85 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-game-gold">
                  {playerHandAnim.label}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {dialogueCallouts.map((entry) => (
        <Callout
          key={entry.id}
          visible
          instanceKey={entry.id}
          text={entry.text}
          subtitle={entry.subtitle}
          tone="dialogue"
          compact
          autoFadeMs={900}
          anchor={entry.anchor}
        />
      ))}
      <style>{`
        @keyframes golf-breathe {
          0% {
            transform: translateY(0);
            filter: brightness(1);
          }
          50% {
            transform: translateY(-1px);
            filter: brightness(1.12);
          }
          100% {
            transform: translateY(0);
            filter: brightness(1);
          }
        }
        @keyframes golf-reward-modal-in {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.94);
            filter: blur(6px) brightness(0.88);
          }
          62% {
            opacity: 1;
            transform: translateY(-4px) scale(1.015);
            filter: blur(0) brightness(1.06);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0) brightness(1);
          }
        }
        @keyframes golf-reward-flight-flip {
          0% {
            transform: perspective(1200px) rotateX(0deg) rotateY(0deg) rotateZ(-10deg) scale(1);
            filter: brightness(1.1) drop-shadow(0 0 15px rgba(255,255,255,0.2));
          }
          25% {
            transform: perspective(1200px) rotateX(45deg) rotateY(540deg) rotateZ(-15deg) scale(1.5);
            filter: brightness(1.4) drop-shadow(0 0 35px rgba(255,255,255,0.5));
          }
          50% {
            transform: perspective(1200px) rotateX(0deg) rotateY(1080deg) rotateZ(0deg) scale(1.3);
            filter: brightness(1.2) drop-shadow(0 0 25px rgba(255,255,255,0.4));
          }
          75% {
            transform: perspective(1200px) rotateX(-45deg) rotateY(1620deg) rotateZ(10deg) scale(1);
            filter: brightness(1.1) drop-shadow(0 0 15px rgba(255,255,255,0.2));
          }
          100% {
            transform: perspective(1200px) rotateX(0deg) rotateY(2160deg) rotateZ(0deg) scale(0.86);
            filter: brightness(1) drop-shadow(0 0 0 rgba(255,255,255,0));
          }
        }
        @keyframes golf-maul-alert {
          0% {
            transform: scale(1);
            filter: brightness(0.9);
          }
          50% {
            transform: scale(1.035);
            filter: brightness(1.18);
          }
          100% {
            transform: scale(1);
            filter: brightness(0.9);
          }
        }
        @keyframes golf-actor-blink {
          0% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.24);
          }
          100% {
            filter: brightness(1);
          }
        }
        @keyframes golf-maul-telegraph {
          0% {
            opacity: 0.76;
            filter: brightness(0.92);
          }
          50% {
            opacity: 1;
            filter: brightness(1.18);
          }
          100% {
            opacity: 0.76;
            filter: brightness(0.92);
          }
        }
        @keyframes golf-status-blink {
          0% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.06);
            filter: brightness(1.28);
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
        }
        @keyframes golf-status-trigger-flash {
          0% {
            transform: scale(1);
            filter: brightness(1);
          }
          35% {
            transform: scale(1.16);
            filter: brightness(1.45);
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
        }
        @keyframes golf-status-falloff {
          0% {
            opacity: 1;
            transform: scale(1);
            filter: brightness(1.15);
          }
          45% {
            opacity: 1;
            transform: scale(1.08);
            filter: brightness(1.35);
          }
          100% {
            opacity: 0;
            transform: translateY(-12px) scale(0.92);
            filter: brightness(0.9);
          }
        }
        @keyframes golf-mochi-target-bob {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
          100% {
            transform: translateY(0);
          }
        }
        @keyframes golf-mochi-danger-breathe {
          0% {
            filter: brightness(0.92);
            box-shadow: 0 0 0 rgba(255, 72, 72, 0.14);
          }
          50% {
            filter: brightness(1.18);
            box-shadow: 0 0 24px rgba(255, 72, 72, 0.22);
          }
          100% {
            filter: brightness(0.92);
            box-shadow: 0 0 0 rgba(255, 72, 72, 0.14);
          }
        }
        @keyframes golf-reward-sticker-float {
          0% {
            transform: rotate(8deg) translateY(0) scale(1);
            filter: drop-shadow(0 10px 18px rgba(0,0,0,0.42)) drop-shadow(0 0 0 rgba(255,212,102,0.18));
          }
          50% {
            transform: rotate(10deg) translateY(-6px) scale(1.04);
            filter: drop-shadow(0 14px 24px rgba(0,0,0,0.46)) drop-shadow(0 0 18px rgba(255,212,102,0.26));
          }
          100% {
            transform: rotate(8deg) translateY(0) scale(1);
            filter: drop-shadow(0 10px 18px rgba(0,0,0,0.42)) drop-shadow(0 0 0 rgba(255,212,102,0.18));
          }
        }
        @keyframes golf-mochi-ready-float {
          0% {
            transform: translate(-50%, -100%) translateY(0);
            filter: brightness(1);
          }
          50% {
            transform: translate(-50%, -100%) translateY(-6px);
            filter: brightness(1.08);
          }
          100% {
            transform: translate(-50%, -100%) translateY(0);
            filter: brightness(1);
          }
        }
      `}</style>
      </div>
  );
};
