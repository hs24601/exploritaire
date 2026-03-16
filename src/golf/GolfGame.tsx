import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Card } from '../components/Card';
import { Callout } from '../components/Callout';
import { Tooltip } from '../components/Tooltip';
import { BurnEdgesEffect } from '../components/active/BurnEdgesEffect';
import { useImmersiveBattle } from '../contexts/ImmersiveBattleContext';
import type { Card as CardType, Element } from '../engine/types';

const ELEMENTAL_SUITS = [
  { suit: '💨', element: 'A' },
  { suit: '⛰️', element: 'E' },
  { suit: '🔥', element: 'F' },
  { suit: '💧', element: 'W' },
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
const BATTERY_TARGET_CHARGE = 10;
const JET_EFFICIENCY_TRIGGER = 3;
const JET_EFFICIENCY_DISCOUNT = 3;
const ASSIST_JET_MICRO_BATTERY_MAX = 5;
const JET_BATTERY_EFFECTS: JetBatteryAssignableEffect[] = ['sticky-paws', 'rigged-construct', 'rewire', 'scrap-plating', 'aegis-shunt'];
const GOLF_COMBAT_LOG_KEY = 'exploritaire.golf.combat-log.v1';
const GOLF_COMBAT_LOG_STATS_KEY = 'exploritaire.golf.combat-log-stats.v1';

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getGolfSegmentColor = (element: Element) => {
  if (element === 'A') return '#70e5f0';
  if (element === 'W') return '#78aff7';
  if (element === 'E') return '#b9ce46';
  if (element === 'F') return '#ff8a42';
  if (element === 'L') return '#efe58a';
  if (element === 'D') return '#9b7cff';
  return '#8a8f98';
};

type GolfGameState = {
  biomeId: string;
  tableau: CardType[][];
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
  combatants: Record<string, ActorCombatState>;
  tableClears: number;
  enemyDefeatedCount: number;
  enemyDefeatFx: {
    id: number;
    name: string;
    moveLabel: string | null;
  } | null;
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
  source: 'ancestors' | 'path-of-stars';
  visibleSteps: number | null;
};

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

type HandSlotId = 'left' | 'right' | 'jet-left-2' | 'jet-left-3' | 'jet-right-2' | 'jet-right-3' | 'jet-right-4';
type JetBatteryAssignableEffect = 'sticky-paws' | 'rigged-construct' | 'rewire' | 'scrap-plating' | 'aegis-shunt';

type JetAbilityBattery = {
  effect: JetBatteryAssignableEffect;
  charge: number;
};

type PlayerHandSlot = {
  slotId: HandSlotId | 'pan-left';
  kind: 'ability' | 'captured' | 'generated' | 'empty';
  name: string;
  card: CardType | null;
  effect: 'sticky-paws' | 'repurpose' | 'paw-sperity' | 'path-of-stars' | 'jikan' | 'ironfur' | 'tap-out' | 'slipstream' | 'battery' | 'siphon' | 'rigged-construct' | 'rewire' | 'scrap-plating' | 'aegis-shunt' | null;
  armed?: boolean;
  generatedEffect?: 'free-energy' | null;
  generatedValue?: number;
};

type AbilityTaxonomy = 'tableau-clear' | 'signature-active' | 'utility-active';

type ElementalShieldMap = Partial<Record<Element, number>>;

type SuperArmorKind = 'bulwark' | 'ward' | 'reactive';

type ActorCombatState = {
  hp: number;
  hpMax: number;
  armor: number;
  defense: number;
  defenseBuffAmount: number;
  evasion: number;
  evasionBuffAmount: number;
  superArmorBulwark: number;
  superArmorWard: number;
  superArmorReactive: number;
  elementalShields: ElementalShieldMap;
  defenseBuffTurns: number;
  evasionBuffTurns: number;
  burn: number;
  doomCounter: number | null;
  harmfulTickMeter: number;
  beneficialTickMeter: number;
  counterWindow: number;
  counterDamage: number;
  consecutiveHitsTaken: number;
  dodgeCounter: number;
  slow: number;
  haste: number;
  forecastIntent: boolean;
};

type DamagePacket = {
  physical: number;
  elemental: Partial<Record<Element, number>>;
  deliberate: boolean;
  threshold: number;
  source: 'player' | 'enemy';
  sourceActor: string;
  targetActor: string;
};

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

type StarterAbilityCategory = 'signature' | 'tableau-clear' | 'tool' | 'battle' | 'passive';

type StarterAbility = {
  name: string;
  fullName?: string;
  category: StarterAbilityCategory;
  combatDescription: string;
  exploreDescription: string;
  effect: PlayerHandSlot['effect'] | null;
  cost?: string;
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
};

const advancePlayerTagLock = (state: GolfGameState) => {
  const nextRemaining = Math.max(0, state.playerTagLockCapturesRemaining - 1);
  return {
    playerTagLockCapturesRemaining: nextRemaining,
    playerBlockedReturnStockId: nextRemaining === 0 ? null : state.playerBlockedReturnStockId,
  };
};

const PLAYER_STOCK_ACTOR: StockActorShell = {
  id: 'jet',
  name: 'Jet',
  title: 'Prime Stock',
  element: 'A',
  startingRank: 2,
  accentClassName: 'border-game-gold/45 bg-black/60 shadow-[0_0_24px_rgba(230,179,30,0.12)]',
  moveset: ['Sticky Paws', 'Repurpose'],
};

const GOLF_DEFAULT_BIOME_ID = 'florpus_forest';
const GOLF_DEFAULT_ENEMY_PROFILE_ID = 'thorn-matron';
let enemyInstanceSequence = 0;

const BIOME_ONE_ENEMIES: EnemyProfile[] = [
  {
    actor: {
      id: 'thorn-matron',
      name: 'Thorn Matron',
      title: 'Enemy Stock',
      element: 'A',
      startingRank: 10,
      accentClassName: 'border-game-pink/35 bg-black/55 shadow-[0_0_22px_rgba(175,223,134,0.12)]',
      moveset: ['Target Dummy'],
    },
    combatant: { hp: 102, hpMax: 102, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 0, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false },
    maxActionsPerTurn: 0,
    behavior: 'steady',
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
  const match = ELEMENTAL_SUITS.find((entry) => entry.element === element);
  return match?.suit ?? '💨';
};

const createActorStockCard = (actor: StockActorShell): CardType => ({
  id: `actor-stock-${actor.id}`,
  rank: actor.startingRank,
  suit: getSuitForElement(actor.element),
  element: actor.element,
  name: actor.name,
});

const createEnemyStockCard = (actor: StockActorShell, instanceLabel?: string): CardType => {
  enemyInstanceSequence += 1;
  return {
    id: `enemy-stock-${actor.id}-${enemyInstanceSequence}`,
    rank: actor.startingRank,
    suit: getSuitForElement(actor.element),
    element: actor.element,
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
  generatedEffect: 'free-energy',
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

const getAbilityCostLabel = (effect: PlayerHandSlot['effect']) => {
  if (effect === 'sticky-paws') return 'Q';
  if (effect === 'path-of-stars') return '10+';
  if (effect === 'jikan') return '2';
  if (effect === 'ironfur') return '4';
  if (effect === 'tap-out') return '3';
  if (effect === 'slipstream') return '4';
  if (effect === 'battery') return 'LINK';
  if (effect === 'rigged-construct') return 'Q';
  if (effect === 'rewire') return 'Q';
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
  if (effect === 'rewire') return 5;
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
  if (effect === 'sticky-paws' || effect === 'path-of-stars' || effect === 'jikan' || effect === 'ironfur' || effect === 'tap-out' || effect === 'slipstream' || effect === 'battery' || effect === 'siphon' || effect === 'rigged-construct' || effect === 'rewire') return 'signature-active';
  if (effect === 'paw-sperity') return 'utility-active';
  return null;
};

const getAbilityTaxonomyBadge = (effect: PlayerHandSlot['effect']) => {
  if (effect === 'repurpose') return 'TC';
  if (effect === 'sticky-paws' || effect === 'paw-sperity' || effect === 'path-of-stars' || effect === 'jikan') return 'SA';
  return null;
};

const getAbilityCooldown = (state: GolfGameState, effect: PlayerHandSlot['effect']) => {
  if (effect === 'sticky-paws') return state.stickyPawsCooldown;
  if (effect === 'paw-sperity') return state.panPawSperityCooldown;
  if (effect === 'rigged-construct') return state.riggedConstructCooldown;
  if (effect === 'rewire') return state.assistJetRewireCooldown;
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
  suit: getSuitForElement('E'),
  element: 'E',
  name: 'FREE ENERGY',
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
  if (name === 'Jet') return { hp: 18, hpMax: 18, armor: 1, defense: 0, defenseBuffAmount: 0, evasion: 7, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false };
  if (name === 'Hiro') return { hp: 20, hpMax: 20, armor: 2, defense: 1, defenseBuffAmount: 0, evasion: 4, evasionBuffAmount: 0, superArmorBulwark: 1, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false };
  if (name === 'Pan') return { hp: 16, hpMax: 16, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 10, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 1, superArmorReactive: 0, elementalShields: { F: 1 }, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false };
  if (name === 'Whis') return { hp: 14, hpMax: 14, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 22, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 1, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 1, forecastIntent: false };
  return { hp: 12, hpMax: 12, armor: 0, defense: 0, defenseBuffAmount: 0, evasion: 0, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false };
};

const createInitialCombatants = (enemyProfile: EnemyProfile) => ({
  jet: createCombatant('Jet'),
  hiro: createCombatant('Hiro'),
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

const normalizeApSegments = (segments: Element[], apCount: number, fallbackElement: Element): Element[] => {
  const targetCount = Math.max(0, Math.round(apCount));
  const next = segments.slice(0, targetCount);
  while (next.length < targetCount) next.push(fallbackElement);
  return next;
};

const getCombatVitals = (state: GolfGameState, card: CardType) => {
  const combatant = state.combatants[actorKeyFromName(card.name)] ?? createCombatant(card.name);
  const isPlayerPrime = card.id === state.playerStock.id;
  const isEnemyPrime = card.id === state.enemyStock.id;
  const apSegments = isPlayerPrime
    ? normalizeApSegments(state.playerPrimeApSegments, state.playerStockActionPoints, card.element)
    : isEnemyPrime
      ? normalizeApSegments([], state.enemyStockActionPoints, card.element)
      : undefined;
  const apCount = isPlayerPrime
    ? state.playerStockActionPoints
    : isEnemyPrime
      ? state.enemyStockActionPoints
      : undefined;
  return {
    hp: combatant.hp,
    hpMax: combatant.hpMax,
    armor: combatant.armor,
    superArmor: sumSuperArmor(combatant),
    minimalVitalsOnly: true,
    name: '',
    apSegments,
    apCount,
  };
};

type ActorStatusEntry = {
  key: string;
  label: string;
  tone: 'buff' | 'debuff' | 'tempo' | 'special';
  priority: number;
  stacks?: number;
  duration?: number | null;
  title: string;
};

const getActorStatusEntries = (combatant: ActorCombatState): ActorStatusEntry[] => {
  const entries: ActorStatusEntry[] = [];

  if (combatant.doomCounter !== null) {
    entries.push({
      key: 'doom',
      label: 'DM',
      tone: 'special',
      priority: 100,
      duration: combatant.doomCounter,
      title: `Doom: defeated in ${combatant.doomCounter} ticks.`,
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
      title: `Counter Window: next outgoing hit gains +${combatant.counterDamage} damage.`,
    });
  }
  if (combatant.slow > 0) {
    entries.push({
      key: 'slow',
      label: 'SL',
      tone: 'tempo',
      priority: 90,
      duration: combatant.slow,
      title: `Slow: reduced evasion and harmful effects tick faster for ${combatant.slow} more ticks.`,
    });
  }
  if (combatant.haste > 0) {
    entries.push({
      key: 'haste',
      label: 'HS',
      tone: 'tempo',
      priority: 85,
      duration: combatant.haste,
      title: `Haste: increased evasion and beneficial effects tick faster for ${combatant.haste} more ticks.`,
    });
  }
  if (combatant.burn > 0) {
    entries.push({
      key: 'burn',
      label: 'BR',
      tone: 'debuff',
      priority: 80,
      stacks: combatant.burn,
      title: `Burn: takes ${combatant.burn} damage each harmful tick.`,
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
      title: `${element} Shield: negates matching elemental damage ${amount} more time${amount === 1 ? '' : 's'}.`,
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
      title: `Defense Up: +${combatant.defenseBuffAmount} defense for ${combatant.defenseBuffTurns} more beneficial tick${combatant.defenseBuffTurns === 1 ? '' : 's'}.`,
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
  if (actorName === 'Hiro') {
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
  return {
    border: 'rgba(255,255,255,0.18)',
    bg: 'linear-gradient(180deg, rgba(36,36,36,0.18), rgba(10,10,10,0.08))',
    glow: '0 0 14px rgba(255,255,255,0.08)',
  };
};

const isNegativeStatusEntry = (status: ActorStatusEntry) =>
  status.key === 'doom' || status.key === 'slow' || status.key === 'burn' || status.tone === 'debuff';

const ActorStatusRail = ({
  actorName,
  combatant,
  maxVisible,
  iconSize,
  compact = false,
}: {
  actorName: string;
  combatant: ActorCombatState;
  maxVisible: number;
  iconSize: number;
  compact?: boolean;
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
        {status.key.replace(/^shield-/, '').replace(/-/g, ' ')}
      </div>
      <div className="mt-1 text-[11px] leading-[1.4] text-white/72">
        {status.title}
      </div>
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

  const renderStatusChip = (status: ActorStatusEntry) => {
    const style = STATUS_TONE_STYLES[status.tone];
    const chip = (
      <div
        key={status.key}
        className="relative flex items-center justify-center rounded-[6px] border font-black uppercase tracking-[0.04em]"
        style={{
          width: tileSize,
          height: tileSize,
          borderColor: style.border,
          background: style.bg,
          color: style.text,
          boxShadow: style.glow,
          fontSize: labelFontSize,
        }}
      >
        <span>{status.label}</span>
        {typeof status.duration === 'number' && status.duration > 0 ? (
          <div
            className="absolute flex items-center justify-center rounded-full border bg-black/92 tabular-nums"
            style={{
              top: -chipOffset * 0.42,
              left: -chipOffset * 0.38,
              minWidth: chipOffset,
              height: chipOffset,
              paddingInline: 2,
              borderColor: style.border,
              color: style.text,
              fontSize: badgeFontSize,
            }}
          >
            {Math.min(99, status.duration)}
          </div>
        ) : null}
        {typeof status.stacks === 'number' && status.stacks > 0 ? (
          <div
            className="absolute flex items-center justify-center rounded-full border bg-black/92 tabular-nums"
            style={{
              right: -chipOffset * 0.38,
              bottom: -chipOffset * 0.42,
              minWidth: chipOffset,
              height: chipOffset,
              paddingInline: 2,
              borderColor: style.border,
              color: style.text,
              fontSize: badgeFontSize,
            }}
          >
            {Math.min(99, status.stacks)}
          </div>
        ) : null}
      </div>
    );
    return (
      <Tooltip key={status.key} content={renderStatusTooltip(status)} pinnable>
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
    id: `golf-live-${suitEntry.element}-${rank}-${golfCardSequence}`,
    rank,
    suit: suitEntry.suit,
    element: suitEntry.element,
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
  const nextBenchActionPoints = [...prev.playerBenchActionPoints];
  const previousPrimeStock = prev.playerStock;
  const nextPlayerStock = nextBench[benchIndex];
  nextBench[benchIndex] = prev.playerStock;
  const nextPlayerStockSequence = nextBenchSequences[benchIndex];
  const nextPlayerStockActionPoints = nextBenchActionPoints[benchIndex];
  nextBenchSequences[benchIndex] = prev.playerStockSequence;
  nextBenchActionPoints[benchIndex] = prev.playerStockActionPoints;

  return {
    ...prev,
    playerStock: nextPlayerStock,
    playerBench: nextBench,
    playerStockSequence: nextPlayerStockSequence,
    playerStockActionPoints: nextPlayerStockActionPoints,
    playerBenchSequences: nextBenchSequences,
    playerBenchActionPoints: nextBenchActionPoints,
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
  if (card.name === 'Hiro') return 'ironfur';
  if (card.name === 'Pan') return 'paw-sperity';
  if (card.name === 'Whis') return 'slipstream';
  return null;
};

const getSupportAbilityCost = (card: CardType | null) => {
  if (!card) return 0;
  if (card.name === 'Hiro') return 3;
  if (card.name === 'Pan') return 4;
  if (card.name === 'Whis') return 3;
  return 0;
};

const getSupportPassiveSummary = (card: CardType | null) => {
  if (!card) return 'No support bonus';
  if (card.name === 'Hiro') return 'Reactive guard and sturdier prime.';
  if (card.name === 'Jet') return 'AP relay specialist. Lowers combo thresholds and pushes ally poke cadence or support throughput.';
  if (card.name === 'Pan') return 'Tableau smoothness and clear rewards.';
  if (card.name === 'Whis') return 'Counter windows and combat foresight.';
  return 'No support bonus';
};

const getAssistPassiveSummary = (card: CardType | null) => {
  if (!card) return 'No assist bonus';
  if (card.name === 'Hiro') return 'Enemy turns grant Jet a small armor brace.';
  if (card.name === 'Jet') return 'Micro-Battery support: stock captures charge overflow AP, add +2 max AP, and overcharge Prime attacks at full charge.';
  if (card.name === 'Pan') return 'Tableau clears grant Jet bonus AP.';
  if (card.name === 'Whis') return 'Dodges gain stronger counter windows.';
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
    'Rewire: legal tableau-to-tableau movement on a 5-turn cooldown.',
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
  if (card.name === 'Hiro') {
    return {
      title: 'HIRO DOCTRINE',
      summary: 'Reactive guard rails, sturdier frontline posture, and dependable mitigation sequencing.',
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
      summary: 'Counter windows, foresight, and elegant temporal control.',
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
  if (card.name === 'Hiro') return role === 'support' ? 3 : 2;
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
  if (gain <= 0) {
    return {
      playerStockActionPoints: prev.playerStockActionPoints,
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
      playerStockActionPoints: prev.playerStockActionPoints + gain,
      assistJetMicroBatteryAp: prev.assistJetMicroBatteryAp,
      jetState: prev,
    };
  }
  const primeMaxAp = 12 + 2;
  const stockGain = Math.min(gain, Math.max(0, primeMaxAp - prev.playerStockActionPoints));
  const overflow = gain - stockGain;
  return {
    playerStockActionPoints: prev.playerStockActionPoints + stockGain,
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
  if (targetStockId === prev.playerStock.id) {
    const nextSequence = prev.playerStockSequence + 1;
    const routedAp = routePrimeApWithAssistJet(prev, 1 + tableClearApBonus);
    return {
      nextState: {
        ...routedAp.jetState,
        playerStock: evolveIdentityCard(prev.playerStock, candidate),
        playerStockSequence: nextSequence,
        playerStockActionPoints: routedAp.playerStockActionPoints,
        playerPrimeApSegments: appendPrimeApSegment(prev, candidate.element),
        playerBenchActionPoints: nextBenchActionPoints,
        assistJetMicroBatteryAp: routedAp.assistJetMicroBatteryAp,
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
  nextBenchAp[benchIndex] = Math.min(12, (nextBenchAp[benchIndex] ?? 0) + 1 + tableClearApBonus);

  return {
    nextState: {
      ...prev,
      playerBench: nextBench,
      playerBenchSequences: nextBenchSequences,
      playerBenchActionPoints: nextBenchAp,
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
  const supportIndex = getSupportBenchIndex(prev);
  const supportAp = prev.playerBenchActionPoints[supportIndex] ?? 0;
  const cost = getSupportAbilityCost(supportCard);
  if (!supportCard || prev.playerSupportActionUsed || supportAp < cost) return prev;

  const nextBenchActionPoints = [...prev.playerBenchActionPoints];
  nextBenchActionPoints[supportIndex] = Math.max(0, supportAp - cost);
  const primeKey = actorKeyFromName(prev.playerStock.name);
  const primeCombatant = prev.combatants[primeKey];
  if (!primeCombatant) return prev;

  if (supportCard.name === 'Hiro') {
    return {
      ...prev,
      playerBenchActionPoints: nextBenchActionPoints,
      playerSupportActionUsed: true,
      combatants: {
        ...prev.combatants,
        [primeKey]: {
          ...primeCombatant,
          armor: primeCombatant.armor + 5,
          defense: primeCombatant.defense + 4,
          defenseBuffAmount: primeCombatant.defenseBuffAmount + 4,
          defenseBuffTurns: Math.max(primeCombatant.defenseBuffTurns, 2),
        },
      },
    };
  }

  if (supportCard.name === 'Pan') {
    const routedAp = routePrimeApWithAssistJet(prev, 1);
    return {
      ...routedAp.jetState,
      tableau: rerollTableau(prev.tableau),
      playerBenchActionPoints: nextBenchActionPoints,
      playerSupportActionUsed: true,
      playerStockActionPoints: routedAp.playerStockActionPoints,
    };
  }

  if (supportCard.name === 'Whis') {
    return {
      ...prev,
      playerBenchActionPoints: nextBenchActionPoints,
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
  const availableAp = prev.playerBenchActionPoints[benchIndex] ?? 0;
  if (availableAp < cost) return prev;

  const nextBenchActionPoints = [...prev.playerBenchActionPoints];
  nextBenchActionPoints[benchIndex] = Math.max(0, availableAp - cost);
  const primeKey = actorKeyFromName(prev.playerStock.name);
  const primeCombatant = prev.combatants[primeKey];
  if (!primeCombatant) return prev;

  if (benchCard.name === 'Hiro') {
    const armorGain = role === 'support' ? 5 : 3;
    const defenseGain = role === 'support' ? 4 : 2;
    return {
      ...prev,
      playerBenchActionPoints: nextBenchActionPoints,
      combatants: {
        ...prev.combatants,
        [primeKey]: {
          ...primeCombatant,
          armor: primeCombatant.armor + armorGain,
          defense: primeCombatant.defense + defenseGain,
          defenseBuffAmount: primeCombatant.defenseBuffAmount + defenseGain,
          defenseBuffTurns: Math.max(primeCombatant.defenseBuffTurns, role === 'support' ? 2 : 1),
        },
      },
    };
  }

  if (benchCard.name === 'Jet') {
    // Assist Jet: Rewire will probably require balancing to restrict total number of rewire actions.
    // The current hook is intentionally minimal until bench-variant Jet has a distinct actor identity.
    return {
      ...prev,
      playerBenchActionPoints: nextBenchActionPoints,
      assistJetRewireCooldown: 5,
    };
  }

  if (benchCard.name === 'Pan') {
    const routedAp = routePrimeApWithAssistJet(prev, 1);
    return {
      ...routedAp.jetState,
      tableau: rerollTableau(prev.tableau),
      playerBenchActionPoints: nextBenchActionPoints,
      playerStockActionPoints: routedAp.playerStockActionPoints,
      playerPrimeApSegments: appendPrimeApSegment(prev, benchCard.element),
    };
  }

  return {
    ...prev,
    playerBenchActionPoints: nextBenchActionPoints,
  };
};

const applyEnemyTurnFormationPassives = (prev: GolfGameState) => {
  const primeKey = actorKeyFromName(prev.playerStock.name);
  const primeCombatant = prev.combatants[primeKey];
  if (!primeCombatant) return prev;
  let nextPrime = { ...primeCombatant };
  let changed = false;

  const supportCard = getSupportBenchCard(prev);
  if (supportCard?.name === 'Hiro') {
    nextPrime.armor += 1;
    changed = true;
  }
  if (supportCard?.name === 'Whis') {
    nextPrime.forecastIntent = true;
    changed = true;
  }

  getAssistBenchIndices(prev).forEach((assistIndex) => {
    const assistCard = prev.playerBench[assistIndex];
    if (assistCard?.name === 'Hiro') {
      nextPrime.armor += 1;
      changed = true;
    }
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
  if (resolved.dodged || resolved.damageDealt <= 0 || prev.playerSupportReactiveUsed) return { state: prev, resolved };
  const supportCard = getSupportBenchCard(prev);
  if (supportCard?.name !== 'Hiro') return { state: prev, resolved };

  const primeKey = actorKeyFromName(prev.playerStock.name);
  const enemyKey = actorKeyFromName(prev.enemyStock.name);
  const primeCombatant = resolved.combatants[primeKey];
  const enemyCombatant = resolved.combatants[enemyKey];
  if (!primeCombatant) return { state: prev, resolved };

  const nextCombatants = {
    ...resolved.combatants,
    [primeKey]: {
      ...primeCombatant,
      armor: primeCombatant.armor + 4,
    },
    ...(enemyCombatant ? {
      [enemyKey]: {
        ...enemyCombatant,
        hp: Math.max(0, enemyCombatant.hp - 2),
      },
    } : {}),
  };

  return {
    state: {
      ...prev,
      playerSupportReactiveUsed: true,
    },
    resolved: {
      ...resolved,
      combatants: nextCombatants,
    },
  };
};

const simulateUseAbility = (prev: GolfGameState, effect: NonNullable<PlayerHandSlot['effect']>): GolfGameState => {
  if (effect === 'paw-sperity') {
    if (prev.playerStock.name !== 'Pan' || prev.panPawSperityCooldown > 0) return prev;
    return {
      ...prev,
      tableau: rerollTableau(prev.tableau),
      panPawSperityCooldown: 14,
      playerFreeTagAvailable: true,
    };
  }
  if (effect === 'ironfur') {
    const actorKey = actorKeyFromName(prev.playerStock.name);
    const combatant = prev.combatants[actorKey];
    if (!combatant || prev.playerStock.name !== 'Hiro' || prev.playerStockActionPoints < 4) return prev;
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

const getTotalPacketDamage = (packet: DamagePacket) =>
  packet.physical + Object.values(packet.elemental).reduce((sum, value) => sum + (value ?? 0), 0);

const applyCounterWindowToPacket = (state: GolfGameState, packet: DamagePacket) => {
  const source = state.combatants[packet.sourceActor];
  if (!source || source.counterWindow <= 0 || source.counterDamage <= 0) {
    return { state, packet };
  }
  return {
    state: {
      ...state,
      combatants: {
        ...state.combatants,
        [packet.sourceActor]: {
          ...source,
          counterWindow: 0,
          counterDamage: 0,
        },
      },
    },
    packet: {
      ...packet,
      physical: packet.physical + source.counterDamage,
    },
  };
};

const resolveDamagePacket = (
  combatants: Record<string, ActorCombatState>,
  packet: DamagePacket
): { combatants: Record<string, ActorCombatState>; damageDealt: number; dodged: boolean; superArmorTriggered: SuperArmorKind | null } => {
  const target = combatants[packet.targetActor];
  const source = combatants[packet.sourceActor];
  if (!target) return { combatants, damageDealt: 0, dodged: false, superArmorTriggered: null };

  const nextTarget: ActorCombatState = {
    ...target,
    elementalShields: { ...target.elementalShields },
    dodgeCounter: target.dodgeCounter,
  };
  const nextSource = source ? { ...source, elementalShields: { ...source.elementalShields } } : null;

  const evasionChance = clampNumber(nextTarget.evasion + (nextTarget.haste * 6) - (nextTarget.slow * 4), 0, 85);
  if (Math.random() * 100 < evasionChance) {
    nextTarget.dodgeCounter += 1;
    nextTarget.counterWindow = Math.max(nextTarget.counterWindow, nextTarget.haste > 0 ? 2 : 1);
    nextTarget.counterDamage = Math.max(nextTarget.counterDamage, 2 + Math.min(2, nextTarget.haste));
    const updated = { ...combatants, [packet.targetActor]: nextTarget };
    return { combatants: nextSource ? { ...updated, [packet.sourceActor]: nextSource } : updated, damageDealt: 0, dodged: true, superArmorTriggered: null };
  }

  let physical = packet.physical;
  const elemental: Partial<Record<Element, number>> = { ...packet.elemental };
  (Object.keys(elemental) as Element[]).forEach((element) => {
    if ((elemental[element] ?? 0) <= 0) return;
    if ((nextTarget.elementalShields[element] ?? 0) > 0) {
      nextTarget.elementalShields[element] = Math.max(0, (nextTarget.elementalShields[element] ?? 0) - 1);
      elemental[element] = 0;
    }
  });

  let total = physical + Object.values(elemental).reduce((sum, value) => sum + (value ?? 0), 0);
  let superArmorTriggered: SuperArmorKind | null = null;
  if (total >= packet.threshold) {
    if (nextTarget.superArmorBulwark > 0) {
      nextTarget.superArmorBulwark -= 1;
      superArmorTriggered = 'bulwark';
      total = 0;
    } else if (nextTarget.superArmorWard > 0) {
      nextTarget.superArmorWard -= 1;
      superArmorTriggered = 'ward';
      total = 0;
    } else if (nextTarget.superArmorReactive > 0) {
      nextTarget.superArmorReactive -= 1;
      superArmorTriggered = 'reactive';
      total = 0;
    }
  }

  if (superArmorTriggered === null) {
    total = Math.max(0, total - nextTarget.defense);
    const armorBlocked = Math.min(nextTarget.armor, total);
    nextTarget.armor -= armorBlocked;
    total -= armorBlocked;
    nextTarget.hp = Math.max(0, nextTarget.hp - total);
    nextTarget.consecutiveHitsTaken += 1;
  } else {
    nextTarget.consecutiveHitsTaken = 0;
  }

  const nextCombatants: Record<string, ActorCombatState> = {
    ...combatants,
    [packet.targetActor]: nextTarget,
  };
  if (superArmorTriggered === 'bulwark') {
    ['jet', 'hiro', 'pan', 'whis'].forEach((allyKey) => {
      const ally = nextCombatants[allyKey];
      if (!ally) return;
      nextCombatants[allyKey] = { ...ally, armor: ally.armor + 5 };
    });
  } else if (superArmorTriggered === 'ward') {
    ['jet', 'hiro', 'pan', 'whis'].forEach((allyKey) => {
      const ally = nextCombatants[allyKey];
      if (!ally) return;
      nextCombatants[allyKey] = { ...ally, evasion: ally.evasion + 6 };
    });
    if (nextSource) {
      nextCombatants[packet.sourceActor] = { ...nextSource, slow: nextSource.slow + 1 };
    }
  } else if (superArmorTriggered === 'reactive') {
    if (nextSource) {
      nextCombatants[packet.sourceActor] = { ...nextSource, hp: Math.max(0, nextSource.hp - 3) };
    }
  }

  return { combatants: nextCombatants, damageDealt: total, dodged: false, superArmorTriggered };
};

const STARTER_ABILITIES: Record<string, StarterAbility[]> = {
  Jet: [
    { name: 'Sticky Paws', category: 'signature', combatDescription: 'Fan out enemy cards and steal one into Jet\'s hand while preserving his salvage sequencing windows.', exploreDescription: 'After a legal tableau play, capture the next card down into hand.', effect: 'sticky-paws', cost: '5' },
    { name: 'Re-Purpose', category: 'tableau-clear', combatDescription: 'Jet recovers the final visible card and gains +2 AP when he clears a tableau.', exploreDescription: 'When Jet clears a tableau, recover the final visible card instead of losing it and gain +2 AP.', effect: 'repurpose', cost: '∞' },
    { name: 'Quarnyx Battery', category: 'tool', combatDescription: 'Prime a Quarnyx battery, then click a Jet ability card to dedicate that battery to it. Future Jet AP gains alternate between all connected batteries.', exploreDescription: 'Wire a dedicated battery into one Jet tool so future gains alternate across the active network.', effect: 'battery', cost: '0' },
    { name: 'Rigged Construct', category: 'battle', combatDescription: 'Discharge the linked battery to deploy the Elemental Construct with storage capacity equal to the battery\'s charge.', exploreDescription: 'Assemble a temporary side stock that banks an elemental sequence up to the linked battery\'s current charge.', effect: 'rigged-construct', cost: '8' },
    { name: 'Scrap Plating', category: 'tool', combatDescription: 'Discharge the linked battery and dismantle a tableau resource into immediate armor plating.', exploreDescription: 'Strip a route node for parts, trading future battery income for fast mitigation.', effect: 'scrap-plating', cost: '4' },
    { name: 'Aegis Shunt', category: 'tool', combatDescription: 'Discharge the linked battery to build elemental shielding around Jet.', exploreDescription: 'Convert stored charge into short-lived energy shielding instead of offense.', effect: 'aegis-shunt', cost: '4' },
    { name: 'Tap Out!', category: 'tool', combatDescription: 'Feed the whole bench and reopen support actions.', exploreDescription: 'Trigger a full-team relay so your support line can surge again.', effect: 'tap-out', cost: '3' },
    { name: 'Slink', category: 'passive', combatDescription: '+10% evasion and stealth bias for Prime Jet.', exploreDescription: 'Jet keeps a lighter profile, making safe sequencing lines easier to preserve.', effect: null },
    { name: 'Siphon', category: 'passive', combatDescription: 'On direct player damage, Jet has a 15% chance to steal 1 enemy AP, plus 5% for each AP the enemy currently holds.', exploreDescription: 'Every clean hit has a chance to bleed momentum out of the enemy and into Jet\'s load-balanced rig.', effect: null },
    { name: 'Efficiency', category: 'passive', combatDescription: 'Every 3 tableau plays, add +1 battery charge to the next connected battery in sequence.', exploreDescription: 'Jet’s sequencing cadence steadily tops off the wider battery network.', effect: null },
    { name: 'Free Energy', category: 'passive', combatDescription: 'If Efficiency discounts an ability below 0 AP, the underflow becomes a free electrical attack card in Jet’s hand.', exploreDescription: 'Excess sequencing economy condenses into a zero-cost shock card you can route immediately.', effect: null },
    { name: 'Rewire', category: 'tool', combatDescription: 'Discharge the linked battery to gain legal tableau-to-tableau rewires without touching the hand.', exploreDescription: 'Resort a tangled board by shifting cards directly between legal tableau tops for as many actions as the linked battery can support.', effect: 'rewire', cost: '5' },
  ],
  Hiro: [
    { name: 'Ironfur', category: 'signature', combatDescription: 'Raise defense by 5 for 2 turns.', exploreDescription: 'Fortify a tableau column so enemy meddling cannot displace or curse it.', effect: 'ironfur', cost: '4' },
    { name: 'Intervene', category: 'passive', combatDescription: 'Swap in to protect an ally after a streak of incoming hits.', exploreDescription: 'Step into a line before it collapses.', effect: 'intervene' as PlayerHandSlot['effect'] },
    { name: 'Adaptive Thorns', category: 'passive', combatDescription: 'After repeated hits, reflect damage to the attacker.', exploreDescription: 'Punish hostile tableau pressure when a column is harried repeatedly.', effect: null },
    { name: 'Tap Out!', category: 'tool', combatDescription: 'Feed the whole bench and reopen support actions.', exploreDescription: 'Trigger a full-team relay so your support line can surge again.', effect: 'tap-out', cost: '3' },
    { name: 'Bulwark Roar', category: 'battle', combatDescription: 'Grant armor to the full party.', exploreDescription: 'Brace the whole board against disruption.', effect: null, cost: '5' },
    { name: 'Stone Guard', category: 'battle', combatDescription: 'Apply defense to a single ally.', exploreDescription: 'Lock one chosen tableau line in place.', effect: null, cost: '4' },
    { name: 'Earthen Rebuke', category: 'battle', combatDescription: 'Deal deliberate earth damage and taunt.', exploreDescription: 'Slam a tableau column into a sturdier state.', effect: null, cost: '5' },
    { name: 'Last Bastion', category: 'passive', combatDescription: 'Gain super armor when dropping below half HP.', exploreDescription: 'When the board gets thin, Hiro becomes the anchor.', effect: null },
  ],
  Pan: [
    { name: 'Paw-Sperity', category: 'tool', combatDescription: 'Refresh fortune with a powerful long-cooldown momentum reset.', exploreDescription: 'Reroll the full tableau or dead columns to escape a bad deal.', effect: 'paw-sperity', cost: '∞' },
    { name: 'Path of Stars', category: 'signature', combatDescription: 'Spend AP to reveal the optimal future route.', exploreDescription: 'Reveal the optimal hidden tableau route for the next several steps.', effect: 'path-of-stars', cost: '10+' },
    { name: 'Solar Arc', category: 'battle', combatDescription: 'Deal deliberate light damage to a target.', exploreDescription: 'Illuminate a hidden line and reveal its best continuation.', effect: null, cost: '5' },
    { name: 'Fire Shield', category: 'battle', combatDescription: 'Grant a fire shield to the party.', exploreDescription: 'Insulate one rerolled line from immediate collapse.', effect: null, cost: '4' },
    { name: 'Wild Bloom', category: 'tool', combatDescription: 'Create armor and a fresh capture option.', exploreDescription: 'Grow a fresh opening in a stagnating tableau.', effect: null, cost: '4' },
    { name: 'Fortune Pounce', category: 'battle', combatDescription: 'Bonus damage after a reroll or swap.', exploreDescription: 'Gain bonus tempo after a reroll or tag.', effect: null, cost: '6' },
    { name: 'Kindle Trap', category: 'battle', combatDescription: 'Ignite a tableau top so the enemy burns on use.', exploreDescription: 'Mark a card so its line blooms when played.', effect: null, cost: '4' },
    { name: 'Lucky Reversal', category: 'passive', combatDescription: 'On dodge, gain AP and counter damage.', exploreDescription: 'Bad variance can flip into an unexpected opening.', effect: null },
  ],
  Whis: [
    { name: 'Jikan', fullName: 'Jikan Makimodoshi', category: 'signature', combatDescription: 'Spend AP to undo the last combat play.', exploreDescription: 'Perform a time heist: rewind the last tableau card back to its column while Whis keeps the gained rank.', effect: 'jikan', cost: '2' },
    { name: 'Slipstream', category: 'battle', combatDescription: 'Gain haste and evasion for the next enemy turn.', exploreDescription: 'Crosswind a tableau line sideways or allow a brief tempo skip.', effect: 'slipstream', cost: '4' },
    { name: 'Frozen Tableau', category: 'battle', combatDescription: 'Lock a tableau until it takes damage.', exploreDescription: 'Suspend a line in time until you choose to resume it.', effect: null, cost: '5' },
    { name: 'Hourglass Needle', category: 'battle', combatDescription: 'Deal deliberate chrono damage that ignores armor.', exploreDescription: 'Pierce directly into the exact card you need.', effect: null, cost: '5' },
    { name: 'Afterimage', category: 'passive', combatDescription: 'Successful dodges grant bonus counter damage.', exploreDescription: 'Past states leave echoes you can still exploit.', effect: null },
    { name: 'Forecast', category: 'passive', combatDescription: 'Reveal enemy combat intent.', exploreDescription: 'Preview the pressure the tableau is about to apply.', effect: null },
    { name: 'Borrowed Beat', category: 'tool', combatDescription: 'Convert haste into AP.', exploreDescription: 'Turn flow advantage into immediate tableau tempo.', effect: null, cost: '4' },
    { name: 'Chrono Shear', category: 'battle', combatDescription: 'Slow the enemy and expose them to burst.', exploreDescription: 'Trim away a bad branch before it fully forms.', effect: null, cost: '6' },
  ],
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

const getStarterAbilityByEffect = (effect: PlayerHandSlot['effect']) => (
  Object.values(STARTER_ABILITIES)
    .flat()
    .find((ability) => ability.effect === effect) ?? null
);

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
      enemyDefeatFx: {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: prev.enemyStock.name,
        moveLabel,
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
    enemyDefeatFx: {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: prev.enemyStock.name,
      moveLabel,
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
  const enemyProfile = getEnemyProfile(GOLF_DEFAULT_ENEMY_PROFILE_ID);
  const enemyPrime = createEnemyStockCard(enemyProfile.actor);
  const deck = createDeck();
  const tableau = Array.from({ length: TABLEAU_COLUMNS }, () =>
    Array.from({ length: TABLEAU_ROWS }, () => drawCard(deck))
  );
  const benchSeeds = [drawCard(deck), drawCard(deck), drawCard(deck)];

  return {
    biomeId: GOLF_DEFAULT_BIOME_ID,
    tableau,
    playerStock: createActorStockCard(PLAYER_STOCK_ACTOR),
    playerBench: [
      createBenchActorCard('Hiro', 5, benchSeeds[0]),
      createBenchActorCard('Pan', 7, benchSeeds[1]),
      createBenchActorCard('Whis', 8, benchSeeds[2]),
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
    playerStockActionPoints: 0,
    playerPrimeApSegments: [],
    playerBenchSequences: [0, 0, 0],
    playerBenchActionPoints: [0, 0, 0],
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
    combatants: {
      ...createInitialCombatants(enemyProfile),
      [actorKeyFromName(enemyPrime.name)]: cloneEnemyCombatant(enemyProfile),
    },
    tableClears: 0,
    enemyDefeatedCount: 0,
    enemyDefeatFx: null,
  };
};

const canPlayOnStock = (candidate: CardType, target: CardType) => {
  const diff = Math.abs(candidate.rank - target.rank);
  return diff === 1 || diff === 12;
};

const canPlayOnRank = (candidateRank: number, targetRank: number) => {
  const diff = Math.abs(candidateRank - targetRank);
  return diff === 1 || diff === 12;
};

const getOrderedPlayerTargetStocks = (state: GolfGameState): PlayerStockTarget[] => {
  const supportIndex = getSupportBenchIndex(state);
  const assistIndices = getAssistBenchIndices(state);
  const orderedBenchIndices = [supportIndex, ...assistIndices];
  return [
    {
      stockId: state.playerStock.id,
      card: state.playerStock,
      kind: 'prime',
      role: 'prime',
    },
    ...orderedBenchIndices
      .map((benchIndex) => state.playerBench[benchIndex] ? ({
        stockId: state.playerBench[benchIndex].id,
        card: state.playerBench[benchIndex],
        kind: 'bench' as const,
        role: getBenchRole(state, benchIndex),
        benchIndex,
      }) : null)
      .filter((entry): entry is PlayerStockTarget => entry !== null),
  ];
};

const getEligiblePlayerTargetsForCard = (state: GolfGameState, candidate: CardType) =>
  getOrderedPlayerTargetStocks(state).filter((target) => canPlayOnStock(candidate, target.card));

/*
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

const chooseBestSupportRotation = (state: GolfGameState) => {
  if (state.playerSupportRotateUsed) return null;
  const noMoves = getPlayableColumnIndices(state.tableau, state.playerStock).length === 0;
  if (isPrimeThreatened(state)) {
    const hiroIndex = findBenchIndexByName(state, 'Hiro');
    if (hiroIndex >= 0 && hiroIndex !== getSupportBenchIndex(state)) return hiroIndex;
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

const choosePlayerAutoAction = (state: GolfGameState, mode: AutoPlayMode): AutoAction | null => {
  if (mode === 'off') return null;
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
  const supportAp = state.playerBenchActionPoints[supportIndex] ?? 0;
  if (supportCard?.name === 'Hiro' && threatened && !state.playerSupportActionUsed && supportAp >= getSupportAbilityCost(supportCard)) {
    return { type: 'support-ability', benchIndex: supportIndex };
  }
  if (supportCard?.name === 'Whis' && threatened && !state.playerSupportActionUsed && supportAp >= getSupportAbilityCost(supportCard)) {
    return { type: 'support-ability', benchIndex: supportIndex };
  }
  if (supportCard?.name === 'Pan' && !state.playerSupportActionUsed && supportAp >= getSupportAbilityCost(supportCard) && moveOptions.length <= 1) {
    return { type: 'support-ability', benchIndex: supportIndex };
  }
  const move = pickBestVisibleMove();
  if (move !== null) return { type: 'move', columnIndex: move.columnIndex, stockId: move.stockId };
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
    className={`relative rounded-[16px] border p-0 overflow-hidden transition-colors ${
      canUse
        ? 'border-game-teal/25 bg-black/45 hover:border-game-gold/45 hover:bg-black/65'
        : 'cursor-not-allowed border-white/10 bg-black/25 opacity-55'
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
  apSegments,
  cardRef,
  roleLabel,
  roleDescription,
  activeRole = false,
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
  apSegments?: Element[];
  cardRef?: (node: HTMLButtonElement | null) => void;
  roleLabel?: string;
  roleDescription?: string;
  activeRole?: boolean;
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
      className="pointer-events-none absolute inset-y-[-8px] left-[-42px] right-[-42px] z-0 rounded-[22px] border"
      style={{
        borderColor: highlighted ? 'rgba(230,179,30,0.42)' : getActorBackdropStyle(card.name).border,
        background: getActorBackdropStyle(card.name).bg,
        boxShadow: highlighted
          ? '0 0 34px rgba(230,179,30,0.2), 0 0 12px rgba(230,179,30,0.22)'
          : getActorBackdropStyle(card.name).glow,
      }}
    />
    <div className="relative h-full w-full">
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
      <ActorStatusRail actorName={card.name} combatant={combatant} maxVisible={3} iconSize={18} compact />
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
      {apSegments && apSegments.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-6 z-20 rounded-md border border-white/14 bg-black/72 px-[3px] py-[3px] shadow-[0_0_14px_rgba(0,0,0,0.28)]">
          <div className="flex h-[10px] w-full overflow-hidden rounded-[3px]">
            {apSegments.map((element, segmentIndex) => (
              <div
                key={`bench-ap-${card.id}-${segmentIndex}-${element}`}
                className="h-full flex-1"
                style={{
                  background: `linear-gradient(180deg, ${getGolfSegmentColor(element)}dd 0%, ${getGolfSegmentColor(element)}99 100%)`,
                  boxShadow: `0 0 6px ${getGolfSegmentColor(element)}88`,
                  borderLeft: segmentIndex === 0 ? 'none' : '1px solid rgba(2,4,8,0.85)',
                }}
              />
            ))}
          </div>
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
  apSegments,
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
  apSegments?: Element[];
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
        {apSegments && apSegments.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-6 z-20 rounded-md border border-white/14 bg-black/72 px-[3px] py-[3px] shadow-[0_0_14px_rgba(0,0,0,0.28)]">
            <div className="flex h-[10px] w-full overflow-hidden rounded-[3px]">
              {apSegments.map((element, segmentIndex) => (
                <div
                  key={`prime-ap-${segmentIndex}-${element}`}
                  className="h-full flex-1"
                  style={{
                    background: `linear-gradient(180deg, ${getGolfSegmentColor(element)}dd 0%, ${getGolfSegmentColor(element)}99 100%)`,
                    boxShadow: `0 0 6px ${getGolfSegmentColor(element)}88`,
                    borderLeft: segmentIndex === 0 ? 'none' : '1px solid rgba(2,4,8,0.85)',
                  }}
                />
              ))}
            </div>
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
    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-[15px] leading-none backdrop-blur-sm transition-colors ${
      disabled
        ? 'cursor-not-allowed border-white/10 bg-black/45 text-white/25'
        : active
          ? 'border-game-gold/55 bg-game-gold/15 text-game-gold hover:bg-game-gold/22'
          : 'border-game-teal/40 bg-black/68 text-game-teal hover:bg-game-teal/14'
    }`}
  >
    <span aria-hidden="true">{icon}</span>
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
  const [currentTurn, setCurrentTurn] = useState<'player' | 'enemy'>('player');
  const [autoPlayMode, setAutoPlayMode] = useState<AutoPlayMode>('off');
  const [showAutoPlayMenu, setShowAutoPlayMenu] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [inspectMode, setInspectMode] = useState<'guidance' | 'ancestors' | null>(null);
  const [oracleMode, setOracleMode] = useState<'off' | 'guidance' | 'ancestors'>('off');
  const [paintMode, setPaintMode] = useState(false);
  const [showDiscardTray, setShowDiscardTray] = useState(false);
  const [fps, setFps] = useState(0);
  const [guidePlan, setGuidePlan] = useState<GuidePlan | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
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
  const [devAbilityHoldSlotId, setDevAbilityHoldSlotId] = useState<HandSlotId | 'pan-left' | null>(null);
  const [devAbilityHoldProgress, setDevAbilityHoldProgress] = useState(0);
  const [kinInspectIndex, setKinInspectIndex] = useState<number | null>(null);
  const [kinInspectHoldProgress, setKinInspectHoldProgress] = useState(0);
  const [dialogueCallouts, setDialogueCallouts] = useState<DialogueCalloutEntry[]>([]);
  const [enemyBurnProgress, setEnemyBurnProgress] = useState(0);
  const enemyTurnTimeoutRef = useRef<number | null>(null);
  const playerStockRef = useRef<HTMLDivElement | null>(null);
  const enemyStockRef = useRef<HTMLDivElement | null>(null);
  const enemyBenchRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const benchInspectorRef = useRef<HTMLDivElement | null>(null);
  const playerHandRefs = useRef<Record<HandSlotId, HTMLButtonElement | null>>({ left: null, right: null });
  const playerCaptureRefs = useRef<Record<HandSlotId, HTMLButtonElement | null>>({ left: null, right: null });
  const tableauTopRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const playerBenchRefs = useRef<Array<HTMLButtonElement | null>>([]);
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
  const playerHandAnimNodeRef = useRef<HTMLDivElement | null>(null);
  const stickyHoldTimeoutRef = useRef<number | null>(null);
  const stickyHoldRafRef = useRef(0);
  const stickyHoldStartRef = useRef(0);
  const devAbilityHoldTimeoutRef = useRef<number | null>(null);
  const devAbilityHoldRafRef = useRef(0);
  const devAbilityHoldStartRef = useRef(0);
  const suppressStickyClickRef = useRef(false);
  const suppressAbilityClickRef = useRef(false);
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

  useEffect(() => {
    setIsImmersive(false);
  }, [setIsImmersive]);

  useEffect(() => {
    latestGameRef.current = game;
  }, [game]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

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
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  const boardScale = useMemo(() => {
    const widthScale = clampNumber((viewport.width - 140) / 1120, 0.68, 1);
    const heightScale = clampNumber((viewport.height - 260) / 760, 0.66, 1);
    return Math.min(widthScale, heightScale);
  }, [viewport.height, viewport.width]);

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
      width: Math.max(58, Math.round(boardCardSize.width * 0.9)),
      height: Math.max(84, Math.round(boardCardSize.height * 0.9)),
    }),
    [boardCardSize.height, boardCardSize.width]
  );
  const indicatorSize = Math.max(14, Math.round(GOLF_ELEMENT_INDICATOR_SIZE * boardScale));
  const playerPeek = Math.max(4, Math.round(PLAYER_TURN_PEEK * boardScale));
  const enemyPeek = Math.max(4, Math.round(ENEMY_TURN_PEEK * boardScale));
  const enemyEdgePeek = Math.max(8, Math.round(ENEMY_TURN_PLAYER_EDGE_PEEK * boardScale));
  const columnGap = Math.max(4, Math.round(10 * boardScale));
  const benchGap = Math.max(4, Math.round(10 * boardScale));
  const benchKinGap = Math.max(18, Math.round(30 * boardScale));
  const boardCompact = boardScale < 0.82;

  const effectiveOracleMode = inspectMode ?? oracleMode;
  const topCards = useMemo(
    () => game.tableau.map((column) => column[column.length - 1] ?? null),
    [game.tableau]
  );
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

  useEffect(() => {
    if (currentTurn !== 'player') {
      setGuidePlan((prev) => (prev?.source === 'ancestors' ? null : prev));
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
  const isTargetDummyEncounter = game.enemyProfileId === GOLF_DEFAULT_ENEMY_PROFILE_ID;
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
  const showHeuristicValues = inspectMode !== null || oracleMode !== 'off';
  const guidanceNextColumn = nextGuideStep?.columnIndex ?? null;
  const leftHandSlots = useMemo(() => {
    if (isTargetDummyEncounter) return [];
    if (activeActorName === 'Jet') {
      return [
        leftCapturedSlot,
        leftHandSlot,
        createHandSlot('jet-left-2', 'ability', 'Quarnyx Battery', 'battery', null, game.jetBatteryPrimeArmed),
        createHandSlot('jet-left-3', 'ability', 'Rewire', 'rewire', null, game.jetRewireActionsRemaining > 0),
        createHandSlot('jet-right-4', 'ability', 'Aegis Shunt', 'aegis-shunt', null),
      ].filter(Boolean) as PlayerHandSlot[];
    }
    if (activeActorName === 'Hiro') return [createHandSlot('left', 'ability', 'Ironfur', 'ironfur', null)];
    if (activeActorName === 'Pan') return [createHandSlot('pan-left', 'ability', 'Paw-Sperity', 'paw-sperity', null)];
    if (activeActorName === 'Whis') return [createHandSlot('left', 'ability', 'Slipstream', 'slipstream', null)];
    return [];
  }, [activeActorName, game.jetBatteryPrimeArmed, game.jetRewireActionsRemaining, isTargetDummyEncounter, leftCapturedSlot, leftHandSlot]);
  const rightHandSlots = useMemo(
    () =>
      isTargetDummyEncounter
        ? []
        : activeActorName === 'Jet'
        ? ([
            rightHandSlot,
            createHandSlot('jet-right-2', 'ability', 'Scrap Plating', 'scrap-plating', null),
            createHandSlot('jet-right-3', 'ability', 'Rigged Construct', 'rigged-construct', null, game.riggedConstructArmed),
            rightCapturedSlot,
          ].filter(Boolean) as PlayerHandSlot[])
        : activeActorName === 'Hiro'
          ? [createHandSlot('right', 'ability', 'Tap Out!', 'tap-out', null)]
        : activeActorName === 'Pan'
          ? [createHandSlot('right', 'ability', 'Path of Stars', 'path-of-stars', null)]
        : activeActorName === 'Whis'
            ? [createHandSlot('right', 'ability', 'Jikan', 'jikan', null)]
            : [],
    [activeActorName, game.jetBatteryPrimeArmed, game.jetRewireActionsRemaining, game.riggedConstructArmed, isTargetDummyEncounter, leftCapturedSlot, leftHandSlot, rightCapturedSlot, rightHandSlot]
  );
  const supportBenchIndex = getSupportBenchIndex(game);
  const supportBenchCard = game.playerBench[supportBenchIndex] ?? null;
  const assistBenchIndices = getAssistBenchIndices(game);
  const showKinInspector = kinInspectIndex !== null && inspectedKinCard !== null && inspectedKinTaxonomy !== null;
  const partyDiscardCounts = useMemo(() => getDiscardCountsByActor(game.playerDiscardPile), [game.playerDiscardPile]);
  const canUseBenchAbilityUi = useCallback((benchIndex: number) => {
    const card = game.playerBench[benchIndex];
    if (!card) return false;
    const role = getBenchRole(game, benchIndex);
    const availableAp = game.playerBenchActionPoints[benchIndex] ?? 0;
    const cost = getBenchAbilityCost(card, role);
    if (availableAp < cost) return false;
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

  const canUseAbilitySlot = useCallback((slot: PlayerHandSlot) => {
    if (currentTurn !== 'player') return false;
    if (getAbilityCooldown(game, slot.effect) > 0) return false;
    if (slot.effect === 'ironfur') {
      return game.playerStock.name === 'Hiro' && game.playerStockActionPoints >= 4;
    }
    if (slot.effect === 'tap-out') {
      return game.playerStockActionPoints >= 3;
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
      return game.playerStock.name === 'Jet' && (game.jetRewireActionsRemaining > 0 || getJetBatteryCharge(game, slot.effect) > 0);
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
      suit: '✦',
      element: game.riggedConstructElement ?? game.playerStock.element,
      name: 'Construct',
    };
  }, [game.playerStock.element, game.riggedConstructCards, game.riggedConstructElement]);

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
    const candidate = topCards[columnIndex];
    if (!candidate) return;
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
        const consumed = consumeJetBattery(prev, 'rewire');
        if (consumed.consumedCharge <= 0) {
          return { ...prev, jetRewireActionsRemaining: 0, jetRewireSourceColumnIndex: null };
        }
        const sourceCard = prev.tableau[sourceIndex][prev.tableau[sourceIndex].length - 1];
        if (!sourceCard) return prev;
        const nextTableau = consumed.state.tableau.map((entry) => [...entry]);
        nextTableau[sourceIndex].pop();
        nextTableau[columnIndex].push(sourceCard);
        return {
          ...consumed.state,
          tableau: nextTableau,
          jetRewireActionsRemaining: Math.max(0, getJetBatteryCharge(consumed.state, 'rewire')),
          jetRewireSourceColumnIndex: null,
        };
      });
      queueDialogueCallout('Jet', 'Rewired.', 60, 'Rewire');
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
        const refillResult = refillClearedTableau(nextTableau, columnIndex);
        return {
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
        };
      });
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
      const refillResult = refillClearedTableau(nextTableau, columnIndex);
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
      const siphonedState = applyJetPassiveSiphon(efficiencyState, resolved);
      const postEnemyDefeat = (draft: GolfGameState) =>
        resolveEnemyDefeat(draft, resolved.combatants, stickyCapture ? 'Sticky Paws' : null);

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
        return postEnemyDefeat(resolvePrimeJetAbilityAftermath({
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
        }, 'sticky-paws'));
      } else if (repurposeSlot) {
        const repurposeAp = routePrimeApWithAssistJet(efficiencyState, 2);
        const nextCapturedLeft = prev.playerCapturedLeft ?? candidate;
        return postEnemyDefeat({
          ...applyJetPassiveSiphon(repurposeAp.jetState, resolved),
          tableau: refillResult.tableau,
          playerHand: nextHand,
          playerCapturedLeft: nextCapturedLeft,
          playerStockActionPoints: repurposeAp.playerStockActionPoints,
          assistJetMicroBatteryAp: repurposeAp.assistJetMicroBatteryAp,
          clearedCount: prev.clearedCount + 1,
          tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
        });
      }

      return postEnemyDefeat({
        ...siphonedState,
        tableau: refillResult.tableau,
        playerHand: nextHand,
        playerCapturedLeft: prev.playerCapturedLeft,
        playerCapturedRight: prev.playerCapturedRight,
        clearedCount: prev.clearedCount + 1,
        tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
      });
    });
    setGuidePlan((prev) => {
      if (!prev) return prev;
      const nextStep = prev.path[prev.progress];
      if (!nextStep) return prev;
      return nextStep.columnIndex === columnIndex && nextStep.stockId === resolvedTargetStockId
        ? { ...prev, progress: prev.progress + 1 }
        : prev;
    });
  };

  const useHandSlot = (slotId: HandSlotId, targetStockId?: string) => {
    if (currentTurn !== 'player') return;
    const slot = [...leftHandSlots, ...rightHandSlots, ...game.playerHand].find((entry) => entry.slotId === slotId);
    if (!slot) return;

    if (game.playerStock.name === 'Jet' && game.jetBatteryPrimeArmed && slot.kind === 'ability' && isJetBatteryAssignableEffect(slot.effect)) {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        const existingBattery = getJetBatteryForEffect(prev, slot.effect);
        if (!existingBattery) return createJetBatteryAssignment(prev, slot.effect);
        const nextState: GolfGameState = {
          ...prev,
          jetBatteryPrimeArmed: false,
          jetBatteries: prev.jetBatteries.filter((battery) => battery.effect !== slot.effect),
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
      queueDialogueCallout('Jet', getJetBatteryForEffect(game, slot.effect) ? `Ejected ${slot.name}.` : `Battery linked to ${slot.name}.`, 80, 'Quarnyx');
      return;
    }

    if (slot.kind === 'ability' && slot.effect === 'sticky-paws') {
      setPendingPlayerPlay(null);
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'ironfur') {
      setPendingPlayerPlay(null);
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        const actorKey = actorKeyFromName(prev.playerStock.name);
        const combatant = prev.combatants[actorKey];
        if (!combatant || prev.playerStock.name !== 'Hiro' || prev.playerStockActionPoints < 4) return prev;
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
      });
      queueDialogueCallout('Hiro', 'Ironfur up.', 100);
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'tap-out') {
      setPinnedTooltipSlotId(null);
      setPendingPlayerPlay(null);
      setGame((prev) => {
        if (prev.playerStockActionPoints < 3) return prev;
        const nextBenchActionPoints = prev.playerBenchActionPoints.map((value) => Math.min(12, (value ?? 0) + 2));
        return {
          ...prev,
          playerStockActionPoints: prev.playerStockActionPoints - 3,
          playerBenchActionPoints: nextBenchActionPoints,
          playerSupportActionUsed: false,
        };
      });
      queueDialogueCallout(game.playerStock.name, 'Team, take the relay!', 120);
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
        const charge = getJetBatteryCharge(prev, 'rewire');
        if (charge <= 0) return prev;
        return {
          ...prev,
          jetRewireActionsRemaining: charge,
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
      const siphonedState = applyJetPassiveSiphon(progressResult.nextState, resolved);
      return resolveEnemyDefeat({
        ...siphonedState,
        playerCapturedLeft: slotId === 'left' ? null : prev.playerCapturedLeft,
        playerCapturedRight: slotId === 'right' ? null : prev.playerCapturedRight,
        clearedCount: prev.clearedCount + 1,
        playerDiscardPile: [
          ...prev.playerDiscardPile,
          `${progressResult.sourceCard.name}::${slot.kind === 'generated' ? slot.name : 'Recovered'} ${rankLabel(slot.card!.rank)}`
        ],
      }, resolved.combatants);
    });
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
      const benchAp = game.playerBenchActionPoints[benchIndex] ?? 0;
      if (!snapshot || benchAp < getBenchAbilityCost(benchCard, getBenchRole(game, benchIndex))) return;
      if (snapshot.actor === 'enemy') {
        const restoredBenchActionPoints = [...snapshot.game.playerBenchActionPoints];
        restoredBenchActionPoints[benchIndex] = Math.max(0, restoredBenchActionPoints[benchIndex] - 2);
        setGuidePlan(snapshot.guidePlan ? { ...snapshot.guidePlan, path: [...snapshot.guidePlan.path] } : null);
        setEnemyTurnSummary([...snapshot.enemyTurnSummary]);
        setCurrentTurn('player');
        setGame({
          ...snapshot.game,
          playerBenchActionPoints: restoredBenchActionPoints,
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
          const nextBenchActionPoints = [...prev.playerBenchActionPoints];
          nextBenchActionPoints[benchIndex] = Math.max(0, nextBenchActionPoints[benchIndex] - 2);
          return {
            ...prev,
            tableau: restoredTableau,
            playerBenchActionPoints: nextBenchActionPoints,
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
    if (benchCard.name === 'Hiro') {
      queueDialogueCallout('Hiro', "I've got you.", 140);
    } else if (benchCard.name === 'Jet') {
      queueDialogueCallout('Jet', 'Rewire the lane.', 140);
    } else if (benchCard.name === 'Pan') {
      queueDialogueCallout('Pan', 'Let me reshape the route.', 140);
    }
  }, [appendCombatLog, currentTurn, enemyTurnSummary, game, guidePlan, queueDialogueCallout, recordUndoSnapshot]);

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
  ): GolfGameState => {
    const stock = actor === 'player'
      ? (targetStockId ? (getPlayerTargetByStockId(prev, targetStockId)?.card ?? prev.playerStock) : prev.playerStock)
      : prev.enemyStock;
    const candidate = prev.tableau[columnIndex][prev.tableau[columnIndex].length - 1];
    if (!candidate || !canPlayOnStock(candidate, stock)) return prev;

    const reducedTableau = prev.tableau.map((column, idx) =>
      idx === columnIndex ? column.slice(0, -1) : column
    );
    const refillResult = refillClearedTableau(reducedTableau, columnIndex);

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
      return resolveEnemyDefeat({
        ...siphonedState,
        tableau: refillResult.tableau,
        clearedCount: prev.clearedCount + 1,
        tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
      }, resolved.combatants);
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
    if (reactedEnemyResult.state.playerSupportReactiveUsed) {
      queueDialogueCallout('Hiro', "Don't you dare!", 150);
      queueDialogueCallout(nextState.playerStock.name, 'Thanks, Hiro!', 780);
    }

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

    return {
      ...postDodgeState,
      playerSupportReactiveUsed: reactedEnemyResult.state.playerSupportReactiveUsed,
      tableau: refillResult.tableau,
      enemyStock: evolveIdentityCard(nextState.enemyStock, candidate),
      clearedCount: nextState.clearedCount + 1,
      enemyStockSequence: nextEnemySequence,
      enemyStockActionPoints: nextState.enemyStockActionPoints + 1,
      combatants: normalizedCombatants,
      tableClears: nextState.tableClears + (refillResult.tableCleared ? 1 : 0),
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
      const move = pickBestGolfMove(nextState.tableau, nextState.enemyStock, enemyProfile.behavior);
      if (move === null) break;

      const movedCard = nextState.tableau[move][nextState.tableau[move].length - 1];
      if (!movedCard) break;

      const approachFromPoint = getPointerAnchorPoint(enemyStockRef.current);
      const approachToPoint = getPointerAnchorPoint(tableauTopRefs.current[move]);
      const dragFromPoint = getPointerAnchorPoint(tableauTopRefs.current[move]);
      const dragToPoint = getPointerAnchorPoint(enemyStockRef.current);
      if (approachFromPoint && approachToPoint && dragFromPoint && dragToPoint) {
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
        await playEnemyDragAnimation({
          id: enemyDragSequenceIdRef.current + 1,
          mode: 'drag',
          card: movedCard,
          sourceColumnIndex: move,
          from: dragFromPoint,
          to: dragToPoint,
          durationMs: ENEMY_ACTION_DURATION_MS,
        });
        enemyDragSequenceIdRef.current += 1;
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
      nextState = applyEnemyMovePostEffects(executeGolfMove(nextState, 'enemy', move));
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
    setGame((prev) => ({
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
    }));
    enemyTurnTimeoutRef.current = null;
  }, [ageCombatantsAtTurnBoundary, playEnemyDragAnimation, waitForUnpausedMs]);

  useEffect(() => {
    if (autoPlayMode === 'off' || currentTurn !== 'player' || isPaused || isPlayerTeamDefeated(game)) return;
    const timeoutId = window.setTimeout(() => {
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
            next = executeGolfMove(next, 'player', action.columnIndex, action.stockId);
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
          next = simulateUseAbility(next, action.effect);
        }
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
        runEnemyTurn();
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [appendCombatLog, autoPlayMode, currentTurn, enemyTurnSummary, game, guidePlan, isPaused, recordUndoSnapshot, runEnemyTurn]);

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

    const initialTransform = `translate3d(${playerHandAnim.from.x.toFixed(2)}px, ${playerHandAnim.from.y.toFixed(2)}px, 0)`;
    const targetTransform = `translate3d(${playerHandAnim.to.x.toFixed(2)}px, ${playerHandAnim.to.y.toFixed(2)}px, 0)`;
    node.style.transition = 'none';
    node.style.transform = initialTransform;

    const rafId = window.requestAnimationFrame(() => {
      const activeNode = playerHandAnimNodeRef.current;
      if (!activeNode) return;
      activeNode.style.transition = `transform ${playerHandAnim.durationMs}ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity ${playerHandAnim.durationMs}ms ease-out`;
      activeNode.style.transform = targetTransform;
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
      const charge = getJetBatteryCharge(game, 'rewire');
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Rewire</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Tool Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Discharge the linked battery to gain that many legal tableau-to-tableau rewires. Click one tableau top to mark the source, then a legal destination tableau top to move the card directly.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Battery charge: {charge} • Actions ready: {game.jetRewireActionsRemaining}
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
  }, [game.assistJetRewireCooldown, game.enemyStockActionPoints, game.jetAbilityCardsPlayed, game.jetBatteryPrimeArmed, game.jetBatteries, game.jetEfficiencyDiscountReady, game.jetRewireActionsRemaining, game.panPawSperityCooldown, game.playerStockActionPoints, game.riggedConstructCapacity, game.riggedConstructCards.length, game.riggedConstructCooldown, game.riggedConstructElement, game.stickyPawsCooldown]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020205] text-white" onContextMenu={(event) => event.preventDefault()}>
      <GolfPaintOverlay active={paintMode} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(127,219,202,0.08),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(230,179,30,0.05),_transparent_30%)]" />
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(127,219,202,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(127,219,202,0.08) 1px, transparent 1px)', backgroundSize: '120px 120px' }} />
      <GuidanceNaviOverlay target={nextGuideTarget} travelKey={nextGuideTarget?.key ?? null} />
      <div className="absolute left-3 top-3 z-40 pointer-events-auto rounded-xl border border-game-teal/25 bg-black/65 px-3 py-2 text-left backdrop-blur-sm md:left-4 md:top-4">
        <div className="text-[8px] font-black uppercase tracking-[0.2em] text-game-teal/70">FPS</div>
        <div className="mt-0.5 text-base font-black tabular-nums text-white">{fps}</div>
      </div>
      <div className="absolute right-3 top-3 z-40 pointer-events-auto md:right-4 md:top-4">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-game-teal/25 bg-black/65 px-3 py-2 text-right backdrop-blur-sm">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-game-gold">Cleared</div>
            <div className="mt-0.5 text-base font-black text-white">{game.clearedCount}/35</div>
          </div>
          {game.enemyDefeatedCount > 0 ? (
            <div className="rounded-xl border border-game-pink/25 bg-black/65 px-3 py-2 text-right backdrop-blur-sm">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-game-pink">Defeated</div>
              <div className="mt-0.5 text-base font-black text-white">{game.enemyDefeatedCount}</div>
            </div>
          ) : null}
          <div ref={autoPlayMenuRef} className="relative">
            <GolfHudIconButton
              label={
                autoPlayMode === 'off'
                  ? 'Autoplay'
                  : autoPlayMode === 'tableau-pause'
                    ? 'Tableau-Only, Pause'
                    : autoPlayMode === 'tactical-pause'
                      ? 'Tableau+Combat, Pause'
                      : 'Full Autoplay'
              }
              icon={autoPlayMode === 'off' ? 'A' : autoPlayMode === 'full' ? 'AF' : 'AP'}
              active={autoPlayMode !== 'off'}
              onClick={() => setShowAutoPlayMenu((prev) => !prev)}
            />
            {showAutoPlayMenu ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-game-teal/25 bg-black/90 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur-sm">
                {[
                  { mode: 'tableau-pause' as const, label: 'Tableau-Only, Pause', detail: 'Non-ancestral path, no auto end turn' },
                  { mode: 'tactical-pause' as const, label: 'Tableau+Combat, Pause', detail: 'Uses abilities when valuable, no auto end turn' },
                  { mode: 'full' as const, label: 'Full Autoplay', detail: 'AI vs AI until the player team falls' },
                ].map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => {
                      setAutoPlayMode(option.mode);
                      setShowAutoPlayMenu(false);
                      appendCombatLog({
                        timestamp: Date.now(),
                        biomeId: game.biomeId,
                        type: 'autoplay',
                        actor: 'system',
                        detail: { effect: option.mode, selected: true },
                      });
                    }}
                    className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left transition-colors ${
                      autoPlayMode === option.mode
                        ? 'border-game-gold/40 bg-game-gold/10'
                        : 'border-transparent hover:border-game-teal/20 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white">{option.label}</span>
                    <span className="mt-1 text-[9px] uppercase tracking-[0.08em] text-white/55">{option.detail}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setAutoPlayMode('off');
                    setShowAutoPlayMenu(false);
                  }}
                  className="mt-2 flex w-full items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/65 hover:bg-white/5"
                >
                  Autoplay Off
                </button>
              </div>
            ) : null}
          </div>
          <GolfHudIconButton label={paintMode ? 'Paint On' : 'Paint'} icon="P" active={paintMode} onClick={() => setPaintMode((prev) => !prev)} />
          <GolfHudIconButton label={isPaused ? 'Resume' : 'Pause'} icon={isPaused ? '▶' : '⏸'} active={isPaused} onClick={() => setIsPaused((prev) => !prev)} />
          <GolfHudIconButton label="Reset Game" icon="↺" onClick={resetGame} />
        </div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-3 px-3 py-3 md:px-4 md:py-4">
          <div className="flex w-full flex-col items-center gap-3">
          <div className="flex w-full justify-center">
            <div className="relative flex items-center justify-center" style={{ gap: benchGap }}>
              {game.enemyBench.map((card, benchIndex) => (
                <KinBenchCard
                  key={card.id}
                  card={card}
                  vitals={getCombatVitals(game, card)}
                  combatant={getCombatantForCard(game, card)}
                  actionPoints={0}
                  apSegments={normalizeApSegments([], 0, card.element)}
                  discardCount={0}
                  canInteract={false}
                  onClick={() => {}}
                  cardRef={(node) => {
                    enemyBenchRefs.current[benchIndex] = node;
                  }}
                  cardSize={handCardSize}
                />
              ))}
              <div className="relative">
                <StockActorShellView
                  actor={currentEnemyProfile.actor}
                  stock={game.enemyStock}
                  vitals={getCombatVitals(game, game.enemyStock)}
                  combatant={getCombatantForCard(game, game.enemyStock)}
                  stockRef={enemyStockRef}
                  cardSize={boardCardSize}
                  indicatorSize={indicatorSize}
                  compact={boardCompact}
                  apSegments={normalizeApSegments([], game.enemyStockActionPoints, game.enemyStock.element)}
                />
                {game.enemyDefeatFx ? (
                  <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[20px]">
                    <BurnEdgesEffect
                      className="!h-full !w-full !p-0"
                      fitContainer
                      hideLabel
                      config={{
                        progress: enemyBurnProgress,
                        burnColor: '#ff6b35',
                        burnWidth: 0.05,
                        noiseScale: 0.75,
                        aspectRatio: boardCardSize.width / boardCardSize.height,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {enemyStealSelectorOpen ? (
            <div className="flex w-full justify-center">
              <div className="rounded-2xl border border-game-gold/30 bg-black/80 px-4 py-3 shadow-[0_0_24px_rgba(230,179,30,0.14)] backdrop-blur-sm">
                <div className="text-center text-[10px] font-black uppercase tracking-[0.18em] text-game-gold">
                  Sticky Paws: Snatch One
                </div>
                <div className="mt-3 flex items-start justify-center" style={{ gap: benchGap }}>
                  {enemyStealOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => useStickyPawsCombat(option)}
                      className="rounded-[16px] border border-game-gold/25 bg-black/45 p-1 transition-colors hover:border-game-gold/50 hover:bg-black/65"
                    >
                      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/55">
                        {option.source === 'prime' ? 'Prime' : 'Reserve'}
                      </div>
                      <div className="mt-1">
                        <Card
                          card={option.card}
                          showGraphics={false}
                          size={handCardSize}
                          suitFontSizeOverride={indicatorSize}
                          disableAnimation
                          disableTilt
                          disableHoverLift
                        />
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setEnemyStealSelectorOpen(false)}
                    className="rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/65 hover:border-white/25 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex w-full justify-center">
            <div className="flex items-start" style={{ gap: columnGap }}>
              {game.tableau.map((column, columnIndex) => {
                const topCard = column[column.length - 1] ?? null;
                const eligibleTargets = topCard ? getEligiblePlayerTargetsForCard(game, topCard) : [];
                const stickyPreviewRank = column.length > 1 ? rankLabel(column[column.length - 2].rank) : null;
                const showStickyPreview =
                  !!topCard &&
                  !!stickyPreviewRank &&
                  stickyPawsPreviewActive &&
                  (eligibleTargets.length > 0 || canRouteCardIntoConstruct(game, topCard));
                const isPlayable =
                  !!topCard &&
                  currentTurn === 'player' &&
                  eligibleTargets.length > 0 &&
                  (!stickyPawsArmed || column.length > 1);
                const tableauSourcePrimed =
                  currentTurn === 'player' &&
                  pendingPlayerPlay?.source === 'tableau' &&
                  typeof pendingPlayerPlay.columnIndex === 'number';
                const peekAmount = playerPeek;
                const edgePeekAmount = playerPeek;
                const columnHeight = boardCardSize.height + Math.max(0, column.length - 2) * peekAmount + (column.length > 1 ? edgePeekAmount : 0);
                const orderedCards = column;

                return (
                  <div
                    key={`column-${columnIndex}`}
                    className="relative"
                    style={{ width: boardCardSize.width + 4, height: (columnHeight || boardCardSize.height) + 4 }}
                  >
                    {column.length === 0 ? (
                      (() => {
                        tableauTopRefs.current[columnIndex] = null;
                        return (
                      <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-game-teal/15 bg-black/20 text-[10px] font-black uppercase tracking-[0.32em] text-game-teal/25">
                        Cleared
                      </div>
                        );
                      })()
                    ) : (
                      orderedCards.map((card, displayIndex) => {
                        const actualIndex = displayIndex;
                        const isTopCard = actualIndex === column.length - 1;
                        const isEnemyDragSource =
                          enemyDragAnim?.mode === 'drag' &&
                          enemyDragAnim.sourceColumnIndex === columnIndex &&
                          isTopCard;
                        const visualTop =
                          actualIndex === column.length - 1
                            ? Math.max(0, actualIndex - 1) * peekAmount + edgePeekAmount
                            : actualIndex * peekAmount;
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

                        return (
                          <button
                            key={card.id}
                            ref={
                              isTopCard
                                ? (node) => {
                                    tableauTopRefs.current[columnIndex] = node;
                                  }
                                : undefined
                            }
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
                              filter: backgroundTableauCard ? 'grayscale(1) saturate(0.45) brightness(0.42)' : undefined,
                              opacity: backgroundTableauCard ? 0.7 : 1,
                            }}
                          >
                            <div
                              className={`rounded-[16px] border p-0.5 shadow-[0_0_18px_rgba(255,255,255,0.08)] ${
                                isTopCard ? 'border-white/15 bg-black/62' : 'border-white/10 bg-black/55'
                              }`}
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
                                  : guidanceGlow
                                    ? { boxShadow: effectiveOracleMode === 'ancestors' ? '0 0 24px rgba(230,179,30,0.28)' : '0 0 20px rgba(230,179,30,0.16)' }
                                    : undefined
                              }
                            >
                              {isEnemyDragSource ? (
                                <div
                                  className="rounded-[14px] border border-white/14 bg-black/94 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                                  style={{ width: boardCardSize.width, height: boardCardSize.height }}
                                />
                              ) : (
                                <div className="relative">
                                  <Card
                                    card={card}
                                    showGraphics={false}
                                    size={boardCardSize}
                                    canPlay={isTopCard && isPlayable}
                                    suitFontSizeOverride={indicatorSize}
                                    disableAnimation={!isTopCard}
                                    disableTilt
                                    disableHoverLift
                                  />
                                  {isTopCard && showStickyPreview ? (
                                    <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 -translate-y-[120%]">
                                      <div className="rounded-full border border-game-gold/45 bg-black/88 px-2 py-1 shadow-[0_0_18px_rgba(230,179,30,0.24)]">
                                        <div className="text-[8px] font-black uppercase tracking-[0.16em] text-game-gold/70">under</div>
                                        <div className="mt-[1px] text-center text-[12px] font-black leading-none text-white">{stickyPreviewRank}</div>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-3">
            <div className="grid w-full items-center gap-3 md:grid-cols-[minmax(0,1fr)_var(--prime-zone)_minmax(0,1fr)]" style={{ ['--prime-zone' as const]: `${primeVisualZoneWidth}px` }}>
              <div className="flex items-center justify-end" style={{ gap: benchGap }}>
                {leftHandSlots.map((slot) =>
                  slot.kind === 'ability' ? (
                    <Tooltip
                      key={String(slot.slotId)}
                      content={renderAbilityTooltip(slot)}
                      pinnable
                      isPinned={pinnedTooltipSlotId === (slot.slotId === 'pan-left' ? 'left' : slot.slotId)}
                      onPinnedChange={(pinned) => setPinnedTooltipSlotId(pinned ? 'left' : null)}
                    >
                      <HandSlotCard
                        slot={slot}
                        canUse={canUseAbilitySlot(slot)}
                        interactive={currentTurn === 'player'}
                        onClick={() => {
                          if (slot.effect === 'paw-sperity') {
                            usePanPawSperity();
                          } else if (slot.effect === 'ironfur') {
                            useHandSlot('left');
                          } else if (slot.effect === 'slipstream') {
                            useHandSlot('left');
                          } else if (slot.effect === 'battery') {
                            useHandSlot('jet-left-2');
                          } else if (slot.effect === 'rewire') {
                            useHandSlot('jet-left-3');
                          } else if (slot.effect === 'aegis-shunt') {
                            useHandSlot('jet-right-4');
                          }
                        }}
                        onPointerDown={(event) => handleAbilityDevPointerDown(event, slot)}
                        onPointerUp={handleAbilityDevPointerEnd}
                        onPointerCancel={handleAbilityDevPointerEnd}
                        onClickCapture={(event) => {
                          if (suppressAbilityClickRef.current) {
                            suppressAbilityClickRef.current = false;
                            event.stopPropagation();
                            event.preventDefault();
                          }
                        }}
                        breathing={slot.effect === 'paw-sperity' && pawSperityEligible}
                        holdProgress={devAbilityHoldSlotId === slot.slotId ? devAbilityHoldProgress : 0}
                        cooldownRemaining={getAbilityCooldown(game, slot.effect)}
                        taxonomyLabel={getAbilityTaxonomyBadge(slot.effect)}
                        cardSize={handCardSize}
                        slotRef={(node) => {
                          playerHandRefs.current.left = node;
                        }}
                      />
                    </Tooltip>
                  ) : (
                    <HandSlotCard
                      key={slot.slotId}
                      slot={slot}
                      canUse={
                        currentTurn === 'player' &&
                        (slot.kind === 'captured' || slot.kind === 'generated') &&
                        !!slot.card &&
                        getEligiblePlayerTargetsForCard(game, slot.card).length > 0
                      }
                      interactive={currentTurn === 'player'}
                      onClick={() => useHandSlot('left')}
                      cardSize={handCardSize}
                      slotRef={(node) => {
                        playerCaptureRefs.current.left = node;
                      }}
                    />
                  )
                )}
              </div>
              {kinInspectIndex === null ? (
                <div className="relative flex items-center justify-center">
                  {activeActorName === 'Jet' && (game.riggedConstructCards.length > 0 || game.riggedConstructCooldown > 0) ? (
                    <div className="absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2">
                      <RiggedConstructCard
                        topCard={game.riggedConstructCards[game.riggedConstructCards.length - 1] ?? null}
                        depth={game.riggedConstructCards.length}
                        armed={game.riggedConstructArmed}
                        cooldownRemaining={game.riggedConstructCooldown}
                        onClick={useRiggedConstructCard}
                        cardSize={handCardSize}
                      />
                    </div>
                  ) : null}
                  <StockActorShellView
                    actor={PLAYER_STOCK_ACTOR}
                    stock={game.playerStock}
                    vitals={getCombatVitals(game, game.playerStock)}
                    combatant={getCombatantForCard(game, game.playerStock)}
                    stockRef={playerStockRef}
                    onClick={() => {
                      if (confirmPendingPlayerPlay(game.playerStock.id)) {
                        return;
                      }
                    }}
                    onPointerDown={() => handleKinInspectPointerDown(-1)}
                    onPointerUp={handleKinInspectPointerEnd}
                    onPointerCancel={handleKinInspectPointerEnd}
                    holdProgress={kinInspectHoldIndexRef.current === -1 ? kinInspectHoldProgress : 0}
                    cardSize={boardCardSize}
                    indicatorSize={indicatorSize}
                  compact={boardCompact}
                  heuristicLabel={null}
                  highlighted={false}
                  apSegments={normalizeApSegments(game.playerPrimeApSegments, game.playerStockActionPoints, game.playerStock.element)}
                />
                </div>
              ) : null}
              <div className="flex items-center justify-start" style={{ gap: benchGap }}>
                {rightHandSlots.map((slot) =>
                  slot.kind === 'ability' ? (
                    <Tooltip
                      key={slot.slotId}
                      content={renderAbilityTooltip(slot)}
                      pinnable
                      isPinned={pinnedTooltipSlotId === 'right'}
                      onPinnedChange={(pinned) => setPinnedTooltipSlotId(pinned ? 'right' : null)}
                    >
                      <HandSlotCard
                        slot={slot}
                        canUse={canUseAbilitySlot(slot)}
                        interactive={currentTurn === 'player'}
                        onClick={() => {
                          if (slot.effect === 'sticky-paws') {
                            if (game.jetBatteryPrimeArmed) {
                              useHandSlot('right');
                              return;
                            }
                            if (canOpenStickyPawsSteal) {
                              setPinnedTooltipSlotId(null);
                              setEnemyStealSelectorOpen(true);
                            }
                          } else if (slot.effect === 'path-of-stars') {
                            usePathOfStars();
                          } else if (slot.effect === 'jikan') {
                            useJikan();
                          } else if (slot.effect === 'tap-out') {
                            useHandSlot('right');
                          } else if (slot.effect === 'scrap-plating') {
                            useHandSlot('jet-right-2');
                          } else if (slot.effect === 'rigged-construct') {
                            useHandSlot('jet-right-3');
                          }
                        }}
                        onPointerDown={(event) => {
                          handleAbilityDevPointerDown(event, slot);
                          if (slot.effect === 'sticky-paws') {
                            handleStickyPointerDown(event);
                          }
                        }}
                        onPointerUp={(event) => {
                          handleAbilityDevPointerEnd();
                          if (slot.effect === 'sticky-paws') {
                            handleStickyPointerEnd(event);
                          }
                        }}
                        onPointerCancel={(event) => {
                          handleAbilityDevPointerEnd();
                          if (slot.effect === 'sticky-paws') {
                            handleStickyPointerEnd(event);
                          }
                        }}
                        onClickCapture={(event) => {
                          if (suppressAbilityClickRef.current) {
                            suppressAbilityClickRef.current = false;
                            event.stopPropagation();
                            event.preventDefault();
                            return;
                          }
                          if (slot.effect === 'sticky-paws' && suppressStickyClickRef.current) {
                            suppressStickyClickRef.current = false;
                            event.stopPropagation();
                            event.preventDefault();
                          }
                        }}
                        holdProgress={
                          devAbilityHoldSlotId === slot.slotId
                            ? devAbilityHoldProgress
                            : slot.effect === 'sticky-paws'
                              ? stickyHoldProgress
                              : 0
                        }
                        cooldownRemaining={getAbilityCooldown(game, slot.effect)}
                        taxonomyLabel={getAbilityTaxonomyBadge(slot.effect)}
                        cardSize={handCardSize}
                        slotRef={(node) => {
                          playerHandRefs.current.right = node;
                        }}
                      />
                    </Tooltip>
                  ) : (
                    <HandSlotCard
                      key={slot.slotId}
                      slot={slot}
                      canUse={
                        currentTurn === 'player' &&
                        (slot.kind === 'captured' || slot.kind === 'generated') &&
                        !!slot.card &&
                        getEligiblePlayerTargetsForCard(game, slot.card).length > 0
                      }
                      interactive={currentTurn === 'player'}
                      onClick={() => useHandSlot('right')}
                      cardSize={handCardSize}
                      slotRef={(node) => {
                        playerCaptureRefs.current.right = node;
                      }}
                    />
                  )
                )}
              </div>
            </div>
            <div ref={benchInspectorRef} className="flex flex-col items-center gap-3">
              {effectiveOracleMode !== 'off' && nextGuideStep ? (
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-game-gold/80">
                  Follow Navi
                </div>
              ) : null}
              <div className="flex items-start justify-center" style={{ gap: benchKinGap }}>
                {assistBenchIndices.slice(0, 1).map((benchIndex) => {
                  const card = game.playerBench[benchIndex];
                  if (!card) return null;
                  return (
                    <div key={card.id} className="flex justify-center" style={{ width: benchActorZoneWidth }}>
                      <KinBenchCard
                        card={card}
                        vitals={getCombatVitals(game, card)}
                        combatant={getCombatantForCard(game, card)}
                        cardRef={(node) => {
                          playerBenchRefs.current[benchIndex] = node;
                        }}
                        actionPoints={game.playerBenchActionPoints[benchIndex] ?? 0}
                        apSegments={normalizeApSegments([], game.playerBenchActionPoints[benchIndex] ?? 0, card.element)}
                        cardSize={boardCardSize}
                        heuristicLabel={null}
                        highlighted={false}
                        breathing={highlightPanForBadLuck && card.name === 'Pan'}
                        discardCount={game.playerDiscardPile.length}
                        canInteract={currentTurn === 'player' && canUseBenchAbilityUi(benchIndex)}
                        roleDescription={getAssistPassiveSummary(card)}
                        onPointerDown={() => handleKinInspectPointerDown(benchIndex, true)}
                        onPointerUp={handleKinInspectPointerEnd}
                        onPointerCancel={handleKinInspectPointerEnd}
                        onClickCapture={(event) => {
                          if (suppressKinInspectClickRef.current) {
                            suppressKinInspectClickRef.current = false;
                            event.stopPropagation();
                            event.preventDefault();
                          }
                        }}
                        holdProgress={kinInspectHoldIndexRef.current === benchIndex ? kinInspectHoldProgress : 0}
                        onClick={() => {
                          if (confirmPendingPlayerPlay(card.id)) {
                            return;
                          }
                        }}
                      />
                    </div>
                  );
                })}
                {supportBenchCard ? (
                  <div className="flex justify-center" style={{ width: benchActorZoneWidth }}>
                    <KinBenchCard
                      key={supportBenchCard.id}
                      card={supportBenchCard}
                      vitals={getCombatVitals(game, supportBenchCard)}
                      combatant={getCombatantForCard(game, supportBenchCard)}
                      cardRef={(node) => {
                        playerBenchRefs.current[supportBenchIndex] = node;
                      }}
                      actionPoints={game.playerBenchActionPoints[supportBenchIndex] ?? 0}
                      apSegments={normalizeApSegments([], game.playerBenchActionPoints[supportBenchIndex] ?? 0, supportBenchCard.element)}
                      cardSize={boardCardSize}
                      heuristicLabel={null}
                      highlighted={false}
                      breathing={highlightPanForBadLuck && supportBenchCard.name === 'Pan'}
                      discardCount={game.playerDiscardPile.length}
                      canInteract={currentTurn === 'player' && canUseBenchAbilityUi(supportBenchIndex)}
                      roleDescription={getSupportPassiveSummary(supportBenchCard)}
                      onPointerDown={() => handleKinInspectPointerDown(supportBenchIndex, true)}
                      onPointerUp={handleKinInspectPointerEnd}
                      onPointerCancel={handleKinInspectPointerEnd}
                      onClickCapture={(event) => {
                        if (suppressKinInspectClickRef.current) {
                          suppressKinInspectClickRef.current = false;
                          event.stopPropagation();
                          event.preventDefault();
                        }
                      }}
                      holdProgress={kinInspectHoldIndexRef.current === supportBenchIndex ? kinInspectHoldProgress : 0}
                      onClick={() => {
                        if (confirmPendingPlayerPlay(supportBenchCard.id)) {
                          return;
                        }
                      }}
                    />
                  </div>
                ) : null}
                {assistBenchIndices.slice(1).map((benchIndex) => {
                  const card = game.playerBench[benchIndex];
                  if (!card) return null;
                  return (
                    <div key={card.id} className="flex justify-center" style={{ width: benchActorZoneWidth }}>
                      <KinBenchCard
                        card={card}
                        vitals={getCombatVitals(game, card)}
                        combatant={getCombatantForCard(game, card)}
                        cardRef={(node) => {
                          playerBenchRefs.current[benchIndex] = node;
                        }}
                        actionPoints={game.playerBenchActionPoints[benchIndex] ?? 0}
                        apSegments={normalizeApSegments([], game.playerBenchActionPoints[benchIndex] ?? 0, card.element)}
                        cardSize={boardCardSize}
                        heuristicLabel={null}
                        highlighted={false}
                        breathing={highlightPanForBadLuck && card.name === 'Pan'}
                        discardCount={game.playerDiscardPile.length}
                        canInteract={currentTurn === 'player' && canUseBenchAbilityUi(benchIndex)}
                        roleDescription={getAssistPassiveSummary(card)}
                        onPointerDown={() => handleKinInspectPointerDown(benchIndex, true)}
                        onPointerUp={handleKinInspectPointerEnd}
                        onPointerCancel={handleKinInspectPointerEnd}
                        onClickCapture={(event) => {
                          if (suppressKinInspectClickRef.current) {
                            suppressKinInspectClickRef.current = false;
                            event.stopPropagation();
                            event.preventDefault();
                          }
                        }}
                        holdProgress={kinInspectHoldIndexRef.current === benchIndex ? kinInspectHoldProgress : 0}
                        onClick={() => {
                          if (confirmPendingPlayerPlay(card.id)) {
                            return;
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {showHeuristicValues && currentTurn === 'player' && effectiveOracleMode !== 'ancestors' ? (
              <HeuristicPill label={effectiveOracleMode === 'ancestors' ? 'hidden best path' : 'visible best path'} />
            ) : null}
            <div className="fixed bottom-4 right-4 z-40 flex items-end gap-3 md:bottom-6 md:right-6">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDiscardTray((prev) => !prev)}
                  className="rounded-2xl border border-game-teal/35 bg-black/78 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-game-teal shadow-[0_12px_30px_rgba(0,0,0,0.32)] backdrop-blur-sm transition-colors hover:bg-game-teal/12"
                >
                  Discard {game.playerDiscardPile.length}
                </button>
                {showDiscardTray ? (
                  <div className="absolute bottom-[calc(100%+10px)] right-0 w-52 rounded-2xl border border-game-teal/25 bg-black/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur-sm">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-game-teal">Party Discards</div>
                    <div className="mt-3 flex flex-col gap-2">
                      {['Jet', 'Hiro', 'Pan', 'Whis'].map((actorName) => (
                        <div key={actorName} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-3 py-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/78">{actorName}</span>
                          <span className="text-sm font-black tabular-nums text-white">{partyDiscardCounts[actorName] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={runEnemyTurn}
                disabled={currentTurn !== 'player'}
                className={`rounded-2xl border px-5 py-4 text-[10px] font-black uppercase tracking-[0.22em] shadow-[0_12px_30px_rgba(0,0,0,0.38)] backdrop-blur-sm transition-colors ${
                  currentTurn === 'player'
                    ? 'border-game-pink/55 bg-black/78 text-game-pink hover:bg-game-pink/14'
                    : 'cursor-not-allowed border-white/10 bg-black/45 text-white/25'
                }`}
                style={{
                  minWidth: Math.round(handCardSize.width * 1.16),
                }}
              >
                End Turn
              </button>
            </div>
          </div>
        </div>

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
              <div
                className="absolute select-none text-[28px] leading-none text-game-gold drop-shadow-[0_0_10px_rgba(230,179,30,0.95)]"
                style={{
                  left: 0,
                  top: 0,
                  transform: enemyDragAnim.mode === 'cursor' ? 'translate(-50%, -50%)' : 'translate(-18%, -22%)',
                }}
              >
                ☝
              </div>
            </div>
          </div>
        </div>
      )}
      {playerHandAnim && (
        <div className="pointer-events-none absolute inset-0 z-30">
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
            }}
          >
            <div className="rounded-[18px] border border-game-gold/45 bg-black/80 p-1.5 shadow-[0_0_24px_rgba(230,179,30,0.22)]">
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
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-game-gold/40 bg-black/85 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-game-gold">
              {playerHandAnim.label}
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
      `}</style>
      </div>
    </div>
  );
};
