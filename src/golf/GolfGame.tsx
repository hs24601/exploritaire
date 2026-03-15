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
const CARD_SIZE = { width: 158, height: 223 };
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
const KIN_INSPECT_HOLD_MS = 450;
const GOLF_COMBAT_LOG_KEY = 'exploritaire.golf.combat-log.v1';
const GOLF_COMBAT_LOG_STATS_KEY = 'exploritaire.golf.combat-log-stats.v1';

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  riggedConstructCooldown: number;
  riggedConstructCards: CardType[];
  riggedConstructArmed: boolean;
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
  hiddenPath: number[];
};

type GuidePlan = {
  starterStockId: string;
  starterRequiresSwap: boolean;
  path: number[];
  progress: number;
  source: 'ancestors' | 'path-of-stars';
  visibleSteps: number | null;
};

type UndoSnapshot = {
  game: GolfGameState;
  enemyTurnSummary: GolfTurnAction[];
  guidePlan: GuidePlan | null;
  actor: 'player' | 'enemy';
};

type HandSlotId = 'left' | 'right' | 'jet-left-2' | 'jet-right-2' | 'jet-right-3';

type PlayerHandSlot = {
  slotId: HandSlotId | 'pan-left';
  kind: 'ability' | 'captured' | 'empty';
  name: string;
  card: CardType | null;
  effect: 'sticky-paws' | 'repurpose' | 'paw-sperity' | 'path-of-stars' | 'jikan' | 'ironfur' | 'tap-out' | 'slipstream' | 'battery' | 'siphon' | 'rigged-construct' | null;
  armed?: boolean;
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
let enemyInstanceSequence = 0;

const BIOME_ONE_ENEMIES: EnemyProfile[] = [
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
});

const createCapturedHandSlot = (slotId: HandSlotId, card: CardType): PlayerHandSlot =>
  createHandSlot(slotId, 'captured', 'Recovered', null, { ...card, name: '' });

const createEmptyHandSlot = (slotId: HandSlotId): PlayerHandSlot =>
  createHandSlot(slotId, 'empty', '', null, null);

const getAbilityCostLabel = (effect: PlayerHandSlot['effect']) => {
  if (effect === 'sticky-paws') return '5';
  if (effect === 'path-of-stars') return '10+';
  if (effect === 'jikan') return '2';
  if (effect === 'ironfur') return '4';
  if (effect === 'tap-out') return '3';
  if (effect === 'slipstream') return '4';
  if (effect === 'battery') return '0';
  if (effect === 'siphon') return '2';
  if (effect === 'rigged-construct') return '8';
  if (effect === 'repurpose' || effect === 'paw-sperity') return '∞';
  return null;
};

const getAbilityTaxonomy = (effect: PlayerHandSlot['effect']): AbilityTaxonomy | null => {
  if (effect === 'repurpose') return 'tableau-clear';
  if (effect === 'sticky-paws' || effect === 'path-of-stars' || effect === 'jikan' || effect === 'ironfur' || effect === 'tap-out' || effect === 'slipstream' || effect === 'battery' || effect === 'siphon' || effect === 'rigged-construct') return 'signature-active';
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
  return 0;
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
  if (name === 'Jet') return { hp: 18, hpMax: 18, armor: 1, defense: 0, defenseBuffAmount: 0, evasion: 6, evasionBuffAmount: 0, superArmorBulwark: 0, superArmorWard: 0, superArmorReactive: 0, elementalShields: {}, defenseBuffTurns: 0, evasionBuffTurns: 0, burn: 0, doomCounter: null, harmfulTickMeter: 0, beneficialTickMeter: 0, counterWindow: 0, counterDamage: 0, consecutiveHitsTaken: 0, dodgeCounter: 0, slow: 0, haste: 0, forecastIntent: false };
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

const getCombatVitals = (state: GolfGameState, card: CardType) => {
  const combatant = state.combatants[actorKeyFromName(card.name)] ?? createCombatant(card.name);
  return {
    hp: combatant.hp,
    hpMax: combatant.hpMax,
    armor: combatant.armor,
    superArmor: sumSuperArmor(combatant),
    minimalVitalsOnly: true,
    name: '',
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
  if (sumSuperArmor(combatant) > 0) {
    entries.push({
      key: 'super-armor',
      label: 'SA',
      tone: 'buff',
      priority: 70,
      stacks: sumSuperArmor(combatant),
      title: `Super Armor: ${sumSuperArmor(combatant)} threshold trigger${sumSuperArmor(combatant) === 1 ? '' : 's'} remaining.`,
    });
  }
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

const ActorStatusRail = ({
  combatant,
  maxVisible,
  iconSize,
  compact = false,
}: {
  combatant: ActorCombatState;
  maxVisible: number;
  iconSize: number;
  compact?: boolean;
}) => {
  const statuses = getActorStatusEntries(combatant);
  if (statuses.length === 0) return null;

  const visibleStatuses = statuses.slice(0, maxVisible);
  const overflowCount = Math.max(0, statuses.length - visibleStatuses.length);
  const badgeFontSize = Math.max(7, Math.round(iconSize * 0.36));
  const labelFontSize = Math.max(7, Math.round(iconSize * 0.42));
  const chipOffset = Math.max(9, Math.round(iconSize * 0.34));

  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-[58%] items-center justify-center gap-1">
      {visibleStatuses.map((status) => {
        const style = STATUS_TONE_STYLES[status.tone];
        return (
          <div
            key={status.key}
            className="relative flex items-center justify-center rounded-[5px] border font-black uppercase tracking-[0.04em]"
            title={status.title}
            style={{
              width: iconSize,
              height: iconSize,
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
                className="absolute flex items-center justify-center rounded-full border bg-black/90 tabular-nums"
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
                className="absolute flex items-center justify-center rounded-full border bg-black/90 tabular-nums"
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
      })}
      {overflowCount > 0 ? (
        <div
          className="flex items-center justify-center rounded-full border border-white/20 bg-black/85 font-black text-white/85"
          style={{
            width: iconSize,
            height: iconSize,
            fontSize: compact ? badgeFontSize : labelFontSize,
            boxShadow: '0 0 10px rgba(255,255,255,0.08)',
          }}
          title={`${overflowCount} more active effect${overflowCount === 1 ? '' : 's'}.`}
        >
          +{overflowCount}
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
  if (card.name === 'Pan') return 'Tableau smoothness and clear rewards.';
  if (card.name === 'Whis') return 'Counter windows and combat foresight.';
  return 'No support bonus';
};

const getAssistPassiveSummary = (card: CardType | null) => {
  if (!card) return 'No assist bonus';
  if (card.name === 'Hiro') return 'Enemy turns grant Jet a small armor brace.';
  if (card.name === 'Pan') return 'Tableau clears grant Jet bonus AP.';
  if (card.name === 'Whis') return 'Dodges gain stronger counter windows.';
  return 'No assist bonus';
};

const awardBenchTempo = (prev: GolfGameState, tableCleared: boolean) => {
  const nextBenchActionPoints = [...prev.playerBenchActionPoints];
  const supportIndex = getSupportBenchIndex(prev);
  nextBenchActionPoints[supportIndex] = Math.min(12, (nextBenchActionPoints[supportIndex] ?? 0) + 1);
  if (tableCleared) {
    getAssistBenchIndices(prev).forEach((assistIndex) => {
      nextBenchActionPoints[assistIndex] = Math.min(12, (nextBenchActionPoints[assistIndex] ?? 0) + 1);
    });
  }
  return nextBenchActionPoints;
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
    return {
      ...prev,
      tableau: rerollTableau(prev.tableau),
      playerBenchActionPoints: nextBenchActionPoints,
      playerSupportActionUsed: true,
      playerStockActionPoints: prev.playerStockActionPoints + 1,
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
    return {
      ...prev,
      playerStockActionPoints: prev.playerStockActionPoints - 3,
      playerFreeTagAvailable: true,
      playerTagLockCapturesRemaining: 0,
      playerBlockedReturnStockId: null,
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
    { name: 'Sticky Paws', category: 'signature', combatDescription: 'Fan out enemy cards and steal one into Jet\'s hand.', exploreDescription: 'After a legal tableau play, capture the next card down into hand.', effect: 'sticky-paws', cost: '5' },
    { name: 'Re-Purpose', category: 'tableau-clear', combatDescription: 'Jet\'s recycler identity: salvage and reuse what would otherwise be lost.', exploreDescription: 'When Jet clears a tableau, recover the final visible card instead of losing it.', effect: 'repurpose', cost: '∞' },
    { name: 'Battery', category: 'tool', combatDescription: 'Bank an ally AP pool into the card, then redeploy it later.', exploreDescription: 'Store tableau tempo for a later release turn.', effect: 'battery', cost: '0' },
    { name: 'Siphon', category: 'battle', combatDescription: 'Steal 2 AP from the target and grant it to Jet.', exploreDescription: 'Drain momentum from one line to empower another.', effect: 'siphon', cost: '2' },
    { name: 'Rigged Construct', category: 'battle', combatDescription: 'Create a temporary wild construct stock that stores and releases a sequence.', exploreDescription: 'Assemble a temporary side stock that can bank a short run.', effect: 'rigged-construct', cost: '8' },
    { name: 'Gale Burst', category: 'battle', combatDescription: 'Spend AP to deal deliberate air damage to a target.', exploreDescription: 'Blow open a line with a sudden adjacency shift.', effect: null, cost: '4' },
    { name: 'Slipstream Cut', category: 'battle', combatDescription: 'Deal deliberate damage and gain haste.', exploreDescription: 'Slice across a tableau line and keep momentum moving.', effect: null, cost: '6' },
    { name: 'Tap Out!', category: 'tool', combatDescription: 'Freely swap with another ally this turn.', exploreDescription: 'Relay tag into an immediate legal tableau play.', effect: 'tap-out', cost: '3' },
    { name: 'Combination Specialist', category: 'passive', combatDescription: 'Every 4 hits adds bonus damage and resets the combo meter.', exploreDescription: 'Long exploration chains produce stronger salvage windows.', effect: null },
    { name: 'Air Pocket', category: 'tool', combatDescription: 'Gain a short evasion window after swapping.', exploreDescription: 'Create a safe tempo pocket before the next tag.', effect: null },
    { name: 'Pressure Spiral', category: 'battle', combatDescription: 'Increase poke damage during long chains.', exploreDescription: 'Long tableau streaks intensify Jet\'s recycler loops.', effect: null },
  ],
  Hiro: [
    { name: 'Ironfur', category: 'signature', combatDescription: 'Raise defense by 5 for 2 turns.', exploreDescription: 'Fortify a tableau column so enemy meddling cannot displace or curse it.', effect: 'ironfur', cost: '4' },
    { name: 'Intervene', category: 'passive', combatDescription: 'Swap in to protect an ally after a streak of incoming hits.', exploreDescription: 'Step into a line before it collapses.', effect: 'intervene' as PlayerHandSlot['effect'] },
    { name: 'Adaptive Thorns', category: 'passive', combatDescription: 'After repeated hits, reflect damage to the attacker.', exploreDescription: 'Punish hostile tableau pressure when a column is harried repeatedly.', effect: null },
    { name: 'Tap Out!', category: 'tool', combatDescription: 'Freely swap with another ally this turn.', exploreDescription: 'Relay tag into an immediate legal tableau play.', effect: 'tap-out', cost: '3' },
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
  const nameTopClass = withVitals ? 'top-[26px]' : 'top-2';
  const valueTopClass = withVitals
    ? (compact ? 'top-[52px]' : 'top-[50px]')
    : (compact ? 'top-[28px]' : 'top-[26px]');

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className={`absolute inset-x-0 ${nameTopClass} flex justify-center px-2`}>
        <div
          className={`font-black uppercase text-white/85 ${compact ? 'text-[8px]' : 'text-[10px]'}`}
          style={{
            letterSpacing: compact ? '0.08em' : '0.14em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'clip',
            maxWidth: '100%',
            lineHeight: 1,
          }}
        >
          {label}
        </div>
      </div>
      <div className={`absolute inset-x-0 flex justify-center ${valueTopClass}`}>
        <div className={`${heuristicLabel ? 'text-[13px]' : 'text-[20px]'} font-black leading-none ${highlighted ? 'text-game-gold' : 'text-white'}`}>
          {heuristicLabel ?? rankLabel(card.rank)}
        </div>
      </div>
      {highlighted && (
        <div className="absolute right-2 top-2 text-[10px] font-black uppercase tracking-[0.12em] text-game-gold">
          Star
        </div>
      )}
    </div>
  );
};

const setupGame = (): GolfGameState => {
  const enemyProfile = pickEnemyProfile();
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
    playerHand: [
      createHandSlot('left', 'ability', 'Re-Purpose', 'repurpose', null),
      createHandSlot('right', 'ability', 'Sticky Paws', 'sticky-paws', null),
    ],
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
    riggedConstructCooldown: 0,
    riggedConstructCards: [],
    riggedConstructArmed: false,
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

const getPlayableColumnIndices = (tableau: CardType[][], stock: CardType) =>
  tableau
    .map((column, columnIndex) => {
      const topCard = column[column.length - 1] ?? null;
      if (!topCard || !canPlayOnStock(topCard, stock)) return null;
      return columnIndex;
    })
    .filter((value): value is number => value !== null);

const scoreGolfMove = (candidate: CardType, stock: CardType) => {
  const diff = Math.abs(candidate.rank - stock.rank);
  const wrappedDiff = diff === 12 ? 1 : diff;
  return 10 - wrappedDiff;
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
  | { type: 'move'; columnIndex: number }
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
  if (mode === 'tableau-pause') {
    const move = pickBestGolfMove(state.tableau, state.playerStock, 'player');
    return move === null ? null : { type: 'move', columnIndex: move };
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
  if (supportCard?.name === 'Pan' && !state.playerSupportActionUsed && supportAp >= getSupportAbilityCost(supportCard) && getPlayableColumnIndices(state.tableau, state.playerStock).length <= 1) {
    return { type: 'support-ability', benchIndex: supportIndex };
  }
  const move = pickBestGolfMove(state.tableau, state.playerStock, 'player');
  if (move !== null) return { type: 'move', columnIndex: move };
  const rotation = chooseBestSupportRotation(state);
  return rotation === null ? null : { type: 'rotate-support', benchIndex: rotation };
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

const solveVisibleBestRun = (visibleCards: Array<CardType | null>, stock: CardType): number => {
  let best = 0;
  for (let columnIndex = 0; columnIndex < visibleCards.length; columnIndex += 1) {
    const candidate = visibleCards[columnIndex];
    if (!candidate || !canPlayOnStock(candidate, stock)) continue;
    const nextVisible = [...visibleCards];
    nextVisible[columnIndex] = null;
    best = Math.max(best, 1 + solveVisibleBestRun(nextVisible, candidate));
  }
  return best;
};

const solveHiddenBestRun = (
  tableau: CardType[][],
  stock: CardType
): { length: number; path: number[] } => {
  let bestLength = 0;
  let bestPath: number[] = [];

  for (let columnIndex = 0; columnIndex < tableau.length; columnIndex += 1) {
    const column = tableau[columnIndex];
    const candidate = column[column.length - 1];
    if (!candidate || !canPlayOnStock(candidate, stock)) continue;
    const nextTableau = tableau.map((entry, idx) => (idx === columnIndex ? entry.slice(0, -1) : entry));
    const child = solveHiddenBestRun(nextTableau, candidate);
    const nextLength = 1 + child.length;
    if (nextLength > bestLength) {
      bestLength = nextLength;
      bestPath = [columnIndex, ...child.path];
    }
  }

  return { length: bestLength, path: bestPath };
};

const buildStockHeuristic = (tableau: CardType[][], stock: CardType): StockHeuristic => {
  const visibleCards = tableau.map((column) => column[column.length - 1] ?? null);
  const hidden = solveHiddenBestRun(tableau, stock);
  return {
    stockId: stock.id,
    visibleBest: solveVisibleBestRun(visibleCards, stock),
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
          fontSize: '8px',
          letterSpacing: '0.08em',
          lineHeight: 1.1,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: `calc(100% - 12px)`,
          textAlign: 'center',
        }}
      >
        {slot.kind === 'captured' ? 'Recovered' : slot.name}
      </div>
    </div>
    {slot.kind === 'captured' ? (
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
    {slot.kind === 'captured' ? (
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
    {slot.kind === 'captured' && slot.card ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center">
        <div className="text-[10px] font-black text-white/80">{slot.card.element}</div>
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
        : 'cursor-not-allowed border-white/10 bg-black/25 opacity-55'
    }`}
    style={{
      width: cardSize.width,
      height: cardSize.height,
      animation: breathing ? 'golf-breathe 1.85s ease-in-out infinite' : undefined,
      boxShadow: breathing ? '0 0 18px rgba(230,179,30,0.22)' : undefined,
    }}
  >
    <div className="relative h-full w-full">
      {roleLabel ? (
        <div className="pointer-events-none absolute inset-x-0 top-1 z-20 flex justify-center">
          <div className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] ${
            activeRole
              ? 'border-game-gold/40 bg-black/82 text-game-gold'
              : 'border-game-teal/30 bg-black/78 text-game-teal/85'
          }`}>
            {roleLabel}
          </div>
        </div>
      ) : null}
      <ActorStatusRail combatant={combatant} maxVisible={2} iconSize={14} compact />
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
      {roleDescription ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-12 z-20 flex justify-center">
          <div className="max-w-[82%] text-center text-[8px] font-mono uppercase tracking-[0.1em] text-white/45">
            {roleDescription}
          </div>
        </div>
      ) : null}
    </div>
    <div className="pointer-events-none absolute bottom-2 left-2 z-10 h-8 w-8 [perspective:120px]">
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
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 h-8 w-8 [perspective:120px]">
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
      className={`relative rounded-[18px] border p-1.5 ${actor.accentClassName}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      style={highlighted ? { boxShadow: '0 0 28px rgba(230,179,30,0.28), 0 0 10px rgba(230,179,30,0.24)' } : undefined}
    >
      <ActorStatusRail combatant={combatant} maxVisible={3} iconSize={18} />
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
      </div>
      {typeof actionPoints === 'number' ? (
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 h-8 w-8 [perspective:120px]">
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
        <div className="pointer-events-none absolute bottom-2 right-2 z-10 h-8 w-8 [perspective:120px]">
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
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 h-1.5 overflow-hidden rounded-full border border-game-gold/35 bg-black/70">
          <div
            className="h-full rounded-full bg-game-gold shadow-[0_0_10px_rgba(230,179,30,0.45)]"
            style={{ width: `${Math.min(100, Math.max(0, holdProgress * 100))}%` }}
          />
        </div>
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
  const benchKinGap = Math.max(10, Math.round(18 * boardScale));
  const boardCompact = boardScale < 0.82;

  const topCards = useMemo(
    () => game.tableau.map((column) => column[column.length - 1] ?? null),
    [game.tableau]
  );

  const playerStockHeuristics = useMemo(() => {
    const entries: StockHeuristic[] = [
      buildStockHeuristic(game.tableau, game.playerStock),
      ...game.playerBench.map((card) => buildStockHeuristic(game.tableau, card)),
    ];
    return new Map(entries.map((entry) => [entry.stockId, entry]));
  }, [game.playerBench, game.playerStock, game.tableau]);

  const bestStarterHeuristic = useMemo(() => {
    const entries = [...playerStockHeuristics.values()];
    if (entries.length === 0) return null;
    return entries.reduce((best, entry) => {
      if (!best) return entry;
      if (entry.hiddenBest !== best.hiddenBest) return entry.hiddenBest > best.hiddenBest ? entry : best;
      if (entry.visibleBest !== best.visibleBest) return entry.visibleBest > best.visibleBest ? entry : best;
      return entry.stockId < best.stockId ? entry : best;
    }, entries[0] ?? null);
  }, [playerStockHeuristics]);

  const effectiveOracleMode = inspectMode ?? oracleMode;

  useEffect(() => {
    if (currentTurn !== 'player') {
      setGuidePlan((prev) => (prev?.source === 'ancestors' ? null : prev));
      return;
    }
    if (effectiveOracleMode !== 'ancestors' || !bestStarterHeuristic) {
      setGuidePlan((prev) => (prev?.source === 'ancestors' ? null : prev));
      return;
    }
    setGuidePlan((prev) => {
      if (prev && prev.source === 'ancestors') {
        return prev;
      }
      return {
        starterStockId: bestStarterHeuristic.stockId,
        starterRequiresSwap: bestStarterHeuristic.stockId !== game.playerStock.id,
        path: bestStarterHeuristic.hiddenPath,
        progress: 0,
        source: 'ancestors',
        visibleSteps: null,
      };
    });
  }, [bestStarterHeuristic, currentTurn, effectiveOracleMode, game.playerStock.id]);

  const ancestorsHighlightedColumns = useMemo(() => {
    if (currentTurn !== 'player' || !guidePlan) return new Map<number, number>();
    const mapping = new Map<number, number>();
    const starterBase = guidePlan.starterRequiresSwap ? 2 : 1;
    const visibleSteps = guidePlan.visibleSteps ?? Number.POSITIVE_INFINITY;
    guidePlan.path.forEach((columnIndex, pathIndex) => {
      const absoluteStep = starterBase + pathIndex;
      if (absoluteStep <= guidePlan.progress) return;
      const remainingOrdinal = absoluteStep - guidePlan.progress;
      if (remainingOrdinal > visibleSteps) return;
      if (!mapping.has(columnIndex)) {
        mapping.set(columnIndex, absoluteStep);
      }
    });
    return mapping;
  }, [currentTurn, guidePlan]);
  const nextGuideTarget = useMemo(() => {
    if (currentTurn !== 'player' || !guidePlan) return null;
    const visibleSteps = guidePlan.visibleSteps ?? Number.POSITIVE_INFINITY;
    const nextAbsoluteStep = guidePlan.progress + 1;
    if (nextAbsoluteStep > visibleSteps) return null;
    if (guidePlan.starterRequiresSwap && guidePlan.progress === 0) {
      const benchIndex = game.playerBench.findIndex((card) => card.id === guidePlan.starterStockId);
      if (benchIndex >= 0) {
        const node = playerBenchRefs.current[benchIndex];
        const rect = node?.getBoundingClientRect();
        if (rect) {
          return {
            key: `bench-${guidePlan.starterStockId}`,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: rect.width,
            height: rect.height,
          };
        }
      }
      return null;
    }
    const pathIndex = guidePlan.progress - (guidePlan.starterRequiresSwap ? 1 : 0);
    const nextColumnIndex = guidePlan.path[pathIndex];
    if (typeof nextColumnIndex !== 'number') return null;
    const node = tableauTopRefs.current[nextColumnIndex];
    const rect = node?.getBoundingClientRect();
    if (!rect) return null;
    return {
      key: `tableau-${nextColumnIndex}-${nextAbsoluteStep}`,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
  }, [currentTurn, game.playerBench, guidePlan, viewport.height, viewport.width]);

  const showHeuristicValues = inspectMode !== null || oracleMode !== 'off';
  const guidanceHighlightedStockId =
    currentTurn === 'player' && effectiveOracleMode !== 'off'
      ? guidePlan?.starterStockId ?? bestStarterHeuristic?.stockId ?? null
      : null;
  const guidanceNextColumn = currentTurn === 'player' && guidePlan
    ? guidePlan.path[Math.max(0, guidePlan.progress - (guidePlan.starterRequiresSwap ? 1 : 0))]
    : null;
  const ancestorStarterStepStockId =
    currentTurn === 'player' && guidePlan && guidePlan.starterRequiresSwap && guidePlan.progress < 1
      ? guidePlan.starterStockId
      : null;
  const getHeuristicLabel = useCallback((stockId: string) => {
    if (guidePlan && effectiveOracleMode === 'ancestors' && ancestorStarterStepStockId === stockId) return '1';
    const heuristic = playerStockHeuristics.get(stockId);
    if (!heuristic) return null;
    if (inspectMode === 'guidance') return String(heuristic.visibleBest);
    if (inspectMode === 'ancestors') return String(heuristic.hiddenBest);
    if (oracleMode === 'guidance') return String(heuristic.visibleBest);
    if (oracleMode === 'ancestors') return String(heuristic.hiddenBest);
    return null;
  }, [ancestorStarterStepStockId, effectiveOracleMode, guidePlan, inspectMode, oracleMode, playerStockHeuristics]);
  const bestOpeningVisibleRun = useMemo(() => {
    const entries = [...playerStockHeuristics.values()];
    if (entries.length === 0) return 0;
    return entries.reduce((best, entry) => Math.max(best, entry.visibleBest), 0);
  }, [playerStockHeuristics]);
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
  const leftCapturedSlot = game.playerCapturedLeft ? createCapturedHandSlot('left', game.playerCapturedLeft) : null;
  const rightCapturedSlot = game.playerCapturedRight ? createCapturedHandSlot('right', game.playerCapturedRight) : null;
  const stickyPawsArmed = game.playerHand.some((slot) => slot.effect === 'sticky-paws' && slot.armed) && game.stickyPawsCooldown === 0;
  const activeActorName = game.playerStock.name;
  const currentEnemyProfile = useMemo(() => getEnemyProfile(game.enemyProfileId), [game.enemyProfileId]);
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
  const leftHandSlots = useMemo(() => {
    if (activeActorName === 'Jet') {
      return [
        leftCapturedSlot,
        leftHandSlot,
        createHandSlot('jet-left-2', 'ability', 'Battery', 'battery', null, game.batteryMode !== null),
      ].filter(Boolean) as PlayerHandSlot[];
    }
    if (activeActorName === 'Hiro') return [createHandSlot('left', 'ability', 'Ironfur', 'ironfur', null)];
    if (activeActorName === 'Pan') return [createHandSlot('pan-left', 'ability', 'Paw-Sperity', 'paw-sperity', null)];
    if (activeActorName === 'Whis') return [createHandSlot('left', 'ability', 'Slipstream', 'slipstream', null)];
    return [];
  }, [activeActorName, leftCapturedSlot, leftHandSlot]);
  const rightHandSlots = useMemo(
    () =>
      activeActorName === 'Jet'
        ? ([
            rightHandSlot,
            createHandSlot('jet-right-2', 'ability', 'Siphon', 'siphon', null),
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
    [activeActorName, game.batteryMode, game.riggedConstructArmed, rightCapturedSlot, rightHandSlot]
  );
  const supportBenchIndex = getSupportBenchIndex(game);
  const supportBenchCard = game.playerBench[supportBenchIndex] ?? null;
  const assistBenchIndices = getAssistBenchIndices(game);
  const inspectedKinCard = useMemo(() => {
    if (kinInspectIndex === null) return null;
    if (kinInspectIndex === -1) return game.playerStock;
    return game.playerBench[kinInspectIndex] ?? null;
  }, [game.playerBench, game.playerStock, kinInspectIndex]);
  const inspectedKinTaxonomy = useMemo(() => {
    if (!inspectedKinCard) return null;
    return getKinInspectorSlots(inspectedKinCard.name, { left: leftHandSlot, right: rightHandSlot });
  }, [inspectedKinCard, leftHandSlot, rightHandSlot]);
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
    if (slot.effect === 'siphon') {
      return game.playerStock.name === 'Jet' && game.playerStockActionPoints >= 2 && game.enemyStockActionPoints > 0;
    }
    if (slot.effect === 'rigged-construct') {
      return game.playerStock.name === 'Jet' && (game.riggedConstructCards.length > 0 || (game.playerStockActionPoints >= 8 && game.riggedConstructCooldown === 0));
    }
    if (slot.effect === 'sticky-paws') {
      return game.playerStock.name === 'Jet';
    }
    return true;
  }, [currentTurn, game]);
  const canOpenStickyPawsSteal = currentTurn === 'player'
    && game.playerStock.name === 'Jet'
    && game.playerStockActionPoints >= 5
    && game.stickyPawsCooldown <= 0
    && enemyStealOptions.length > 0;

  const getConstructTopCard = useCallback(() => {
    const topCard = game.riggedConstructCards[game.riggedConstructCards.length - 1] ?? null;
    return topCard ?? {
      id: 'rigged-construct-wild',
      rank: 1,
      suit: '✦',
      element: game.playerStock.element,
      name: 'Construct',
    };
  }, [game.playerStock.element, game.riggedConstructCards]);

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
          next = {
            ...next,
            playerStockActionPoints: prev.playerStockActionPoints + prev.batteryStoredActionPoints,
            batteryStoredActionPoints: 0,
            batteryMode: null,
          };
          changed = true;
        } else {
          const nextBenchActionPoints = [...prev.playerBenchActionPoints];
          nextBenchActionPoints[target] = (nextBenchActionPoints[target] ?? 0) + prev.batteryStoredActionPoints;
          next = {
            ...next,
            playerBenchActionPoints: nextBenchActionPoints,
            batteryStoredActionPoints: 0,
            batteryMode: null,
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

  const playToPlayerStock = (columnIndex: number) => {
    if (currentTurn !== 'player') return;
    const candidate = topCards[columnIndex];
    if (!candidate) return;
    if (game.riggedConstructArmed) {
      const constructTop = game.riggedConstructCards[game.riggedConstructCards.length - 1] ?? null;
      if (constructTop && !canPlayOnStock(candidate, constructTop)) return;
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
          riggedConstructArmed: false,
        };
      });
      queueDialogueCallout('Jet', 'Loaded in.', 100);
      return;
    }
    if (!canPlayOnStock(candidate, game.playerStock)) return;
    const column = game.tableau[columnIndex];
    const stickySlot = game.playerHand.find((slot) => slot.effect === 'sticky-paws' && slot.armed) ?? null;
    const stickyCapture = stickySlot && column.length > 1 ? column[column.length - 2] : null;
    if (stickySlot && !stickyCapture) return;
    const repurposeSlot = !stickyCapture && column.length === 1
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
        return stickyCapture ? entry.slice(0, -2) : entry.slice(0, -1);
      });
      const refillResult = refillClearedTableau(nextTableau, columnIndex);
      const nextHand = prev.playerHand.map((slot) => ({ ...slot, armed: false }));
      const nextSequence = prev.playerStockSequence + 1;
      const nextBenchActionPoints = awardBenchTempo(prev, refillResult.tableCleared);
      const tableClearApBonus = getPlayerTableClearApBonus(prev, refillResult.tableCleared);
      const prepared = applyCounterWindowToPacket(
        prev,
        buildPokePacket(prev.playerStock, prev.enemyStock, nextSequence, 'player')
      );
      const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
      const postEnemyDefeat = (draft: GolfGameState) =>
        resolveEnemyDefeat(draft, resolved.combatants, stickyCapture ? 'Sticky Paws' : null);

      if (stickyCapture && stickySlot) {
        const preferredSide = stickySlot.slotId === 'right' ? 'playerCapturedRight' : 'playerCapturedLeft';
        const fallbackSide = preferredSide === 'playerCapturedRight' ? 'playerCapturedLeft' : 'playerCapturedRight';
        const nextState = {
          [preferredSide]: prev[preferredSide],
          [fallbackSide]: prev[fallbackSide],
        } as Pick<GolfGameState, 'playerCapturedLeft' | 'playerCapturedRight'>;
        if (nextState[preferredSide] === null) {
          nextState[preferredSide] = stickyCapture;
        } else if (nextState[fallbackSide] === null) {
          nextState[fallbackSide] = stickyCapture;
        }
        return postEnemyDefeat({
          ...prev,
          tableau: refillResult.tableau,
          playerStock: evolveIdentityCard(prev.playerStock, candidate),
          playerHand: nextHand,
          playerCapturedLeft: nextState.playerCapturedLeft,
          playerCapturedRight: nextState.playerCapturedRight,
          clearedCount: prev.clearedCount + 1,
          playerStockSequence: nextSequence,
          playerStockActionPoints: prev.playerStockActionPoints + 1 + tableClearApBonus,
          playerBenchActionPoints: nextBenchActionPoints,
          playerFreeTagAvailable: false,
          stickyPawsCooldown: 7,
          tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
          ...advancePlayerTagLock(prev),
        });
      } else if (repurposeSlot) {
        const nextCapturedLeft = prev.playerCapturedLeft ?? candidate;
        return postEnemyDefeat({
          ...prev,
          tableau: refillResult.tableau,
          playerStock: evolveIdentityCard(prev.playerStock, candidate),
          playerHand: nextHand,
          playerCapturedLeft: nextCapturedLeft,
          clearedCount: prev.clearedCount + 1,
          playerStockSequence: nextSequence,
          playerStockActionPoints: prev.playerStockActionPoints + 1 + tableClearApBonus,
          playerBenchActionPoints: nextBenchActionPoints,
          playerFreeTagAvailable: false,
          tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
          ...advancePlayerTagLock(prev),
        });
      }

      return postEnemyDefeat({
        ...prev,
        tableau: refillResult.tableau,
        playerStock: evolveIdentityCard(prev.playerStock, candidate),
        playerHand: nextHand,
        playerCapturedLeft: prev.playerCapturedLeft,
        playerCapturedRight: prev.playerCapturedRight,
        clearedCount: prev.clearedCount + 1,
        playerStockSequence: nextSequence,
        playerStockActionPoints: prev.playerStockActionPoints + 1 + tableClearApBonus,
        playerBenchActionPoints: nextBenchActionPoints,
        playerFreeTagAvailable: false,
        tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
        ...advancePlayerTagLock(prev),
      });
    });
    setGuidePlan((prev) => {
      if (!prev) return prev;
      const nextExpectedIndex = prev.progress - (prev.starterRequiresSwap ? 1 : 0);
      if (nextExpectedIndex < 0 || nextExpectedIndex >= prev.path.length) return prev;
      return prev.path[nextExpectedIndex] === columnIndex
        ? { ...prev, progress: prev.progress + 1 }
        : prev;
    });
  };

  const useHandSlot = (slotId: HandSlotId) => {
    if (currentTurn !== 'player') return;
    const slot = [...leftHandSlots, ...rightHandSlots, ...game.playerHand].find((entry) => entry.slotId === slotId);
    if (!slot) return;

    if (slot.kind === 'ability' && slot.effect === 'sticky-paws') {
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'ironfur') {
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
      setGame((prev) => {
        if (prev.playerStockActionPoints < 3) return prev;
        return {
          ...prev,
          playerStockActionPoints: prev.playerStockActionPoints - 3,
          playerFreeTagAvailable: true,
          playerTagLockCapturesRemaining: 0,
          playerBlockedReturnStockId: null,
        };
      });
      queueDialogueCallout(game.playerStock.name, 'I see an opening!', 120);
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'battery') {
      setPinnedTooltipSlotId(null);
      setGame((prev) => ({
        ...prev,
        batteryMode: prev.batteryStoredActionPoints > 0
          ? (prev.batteryMode === 'release' ? null : 'release')
          : (prev.batteryMode === 'store' ? null : 'store'),
      }));
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'siphon') {
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        if (prev.playerStock.name !== 'Jet' || prev.playerStockActionPoints < 2 || prev.enemyStockActionPoints <= 0) return prev;
        const stolen = Math.min(2, prev.enemyStockActionPoints);
        return {
          ...prev,
          playerStockActionPoints: prev.playerStockActionPoints - 2 + stolen,
          enemyStockActionPoints: prev.enemyStockActionPoints - stolen,
        };
      });
      appendCombatLog({
        timestamp: Date.now(),
        biomeId: game.biomeId,
        type: 'ability',
        actor: 'Jet',
        target: game.enemyStock.name,
        detail: { effect: 'siphon', enemyApBefore: game.enemyStockActionPoints },
      });
      queueDialogueCallout('Jet', 'Mine now.', 100);
      return;
    }
    if (slot.kind === 'ability' && slot.effect === 'rigged-construct') {
      setPinnedTooltipSlotId(null);
      setGame((prev) => {
        if (prev.playerStock.name !== 'Jet') return prev;
        if (prev.riggedConstructCards.length === 0) {
          if (prev.playerStockActionPoints < 8 || prev.riggedConstructCooldown > 0) return prev;
          return {
            ...prev,
            playerStockActionPoints: prev.playerStockActionPoints - 8,
            riggedConstructCooldown: 20,
            riggedConstructCards: [],
            riggedConstructArmed: true,
          };
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
    if (slot.kind === 'ability' && slot.effect === 'slipstream') {
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

    if (slot.kind !== 'captured' || !slot.card || !canPlayOnStock(slot.card, game.playerStock)) return;
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });

    setGame((prev) => {
      const nextSequence = prev.playerStockSequence + 1;
      const nextBenchActionPoints = awardBenchTempo(prev, false);
      const prepared = applyCounterWindowToPacket(
        prev,
        buildPokePacket(prev.playerStock, prev.enemyStock, nextSequence, 'player')
      );
      const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
      return resolveEnemyDefeat({
        ...prev,
        playerStock: evolveIdentityCard(prev.playerStock, slot.card!),
        playerCapturedLeft: slotId === 'left' ? null : prev.playerCapturedLeft,
        playerCapturedRight: slotId === 'right' ? null : prev.playerCapturedRight,
        clearedCount: prev.clearedCount + 1,
        playerStockSequence: nextSequence,
        playerStockActionPoints: prev.playerStockActionPoints + 1,
        playerBenchActionPoints: nextBenchActionPoints,
        playerFreeTagAvailable: false,
        playerDiscardPile: [...prev.playerDiscardPile, `Recovered ${rankLabel(slot.card!.rank)}`],
        ...advancePlayerTagLock(prev),
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
      const stolenCard = { ...option.card, name: '' };
      const nextCapturedLeft =
        preferredSlot === 'left'
          ? stolenCard
          : prev.playerCapturedLeft;
      const nextCapturedRight =
        preferredSlot === 'right'
          ? stolenCard
          : prev.playerCapturedRight;
      return {
        ...prev,
        playerHand: prev.playerHand.map((entry) =>
          entry.effect === 'sticky-paws' ? { ...entry, armed: false } : entry
        ),
        playerCapturedLeft: nextCapturedLeft,
        playerCapturedRight: nextCapturedRight,
        playerStockActionPoints: devOverride ? prev.playerStockActionPoints : Math.max(0, prev.playerStockActionPoints - 5),
        stickyPawsCooldown: devOverride ? prev.stickyPawsCooldown : 7,
      };
    });
    queueDialogueCallout('Jet', 'Mine now.', 80, 'Sticky Paws');
  }, [canOpenStickyPawsSteal, enemyTurnSummary, game.playerCapturedLeft, game.playerCapturedRight, guidePlan, recordUndoSnapshot, startPlayerHandAnimation]);

  const usePathOfStars = useCallback(() => {
    if (currentTurn !== 'player' || game.playerStock.name !== 'Pan') return;
    const stepCount = getPathOfStarsStepCount(game.playerStockActionPoints);
    if (stepCount <= 0) return;
    const hidden = solveHiddenBestRun(game.tableau, game.playerStock);
    setPinnedTooltipSlotId(null);
    setGame((prev) => ({
      ...prev,
      playerStockActionPoints: 0,
    }));
    setGuidePlan({
      starterStockId: game.playerStock.id,
      starterRequiresSwap: false,
      path: hidden.path,
      progress: 0,
      source: 'path-of-stars',
      visibleSteps: stepCount,
    });
  }, [currentTurn, game.playerStock, game.playerStockActionPoints, game.tableau]);

  const usePathOfStarsDev = useCallback(() => {
    const hidden = solveHiddenBestRun(game.tableau, game.playerStock);
    setPinnedTooltipSlotId(null);
    setGuidePlan({
      starterStockId: game.playerStock.id,
      starterRequiresSwap: false,
      path: hidden.path,
      progress: 0,
      source: 'path-of-stars',
      visibleSteps: Math.max(5, hidden.path.length),
    });
  }, [game.playerStock, game.tableau]);

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

  const useRiggedConstructCard = useCallback(() => {
    if (currentTurn !== 'player' || game.riggedConstructCards.length === 0) return;
    if (game.riggedConstructArmed) {
      setGame((prev) => ({ ...prev, riggedConstructArmed: false }));
      return;
    }
    const topCard = game.riggedConstructCards[game.riggedConstructCards.length - 1];
    if (!topCard || !canPlayOnStock(topCard, game.playerStock)) {
      setGame((prev) => ({ ...prev, riggedConstructArmed: true }));
      return;
    }
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });
    setGame((prev) => {
      const constructTop = prev.riggedConstructCards[prev.riggedConstructCards.length - 1];
      if (!constructTop || !canPlayOnStock(constructTop, prev.playerStock)) return { ...prev, riggedConstructArmed: true };
      const nextSequence = prev.playerStockSequence + 1;
      const nextBenchActionPoints = awardBenchTempo(prev, false);
      const prepared = applyCounterWindowToPacket(
        prev,
        buildPokePacket(prev.playerStock, prev.enemyStock, nextSequence, 'player')
      );
      const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
      return resolveEnemyDefeat({
        ...prev,
        playerStock: evolveIdentityCard(prev.playerStock, constructTop),
        riggedConstructCards: prev.riggedConstructCards.slice(0, -1),
        playerStockSequence: nextSequence,
        playerStockActionPoints: prev.playerStockActionPoints + 1,
        playerBenchActionPoints: nextBenchActionPoints,
        riggedConstructArmed: false,
      }, resolved.combatants, 'Rigged Construct');
    });
    queueDialogueCallout('Jet', 'Back into the line.', 100);
  }, [currentTurn, enemyTurnSummary, game.playerStock, game.riggedConstructArmed, game.riggedConstructCards, guidePlan, queueDialogueCallout, recordUndoSnapshot]);

  const useSupportAbility = useCallback((benchIndex?: number) => {
    if (currentTurn !== 'player') return;
    const supportIndex = getSupportBenchIndex(game);
    if (typeof benchIndex === 'number' && benchIndex !== supportIndex) return;
    const supportCard = getSupportBenchCard(game);
    if (!supportCard) return;
    const cost = getSupportAbilityCost(supportCard);
    const availableAp = game.playerBenchActionPoints[supportIndex] ?? 0;
    if (game.playerSupportActionUsed || availableAp < cost) return;

    setPinnedTooltipSlotId(null);
    clearStickyHold();
    clearKinInspectHold();
    setKinInspectIndex(null);
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });
    setGame((prev) => simulateUseSupportAbility(prev));
    appendCombatLog({
      timestamp: Date.now(),
      biomeId: game.biomeId,
      type: 'ability',
      actor: supportCard.name,
      target: game.playerStock.name,
      detail: { effect: `support-${supportCard.name.toLowerCase()}`, role: 'support' },
    });

    if (supportCard.name === 'Hiro') {
      queueDialogueCallout('Hiro', "Hold the line.", 120);
      queueDialogueCallout('Jet', 'Locked in.', 760);
    } else if (supportCard.name === 'Pan') {
      queueDialogueCallout('Pan', 'Try this route.', 120);
    } else if (supportCard.name === 'Whis') {
      queueDialogueCallout('Whis', 'Take the faster beat.', 120);
    }
  }, [appendCombatLog, currentTurn, enemyTurnSummary, game, guidePlan, queueDialogueCallout, recordUndoSnapshot]);

  const handleBenchCardClick = useCallback((benchIndex: number) => {
    if (currentTurn !== 'player') return;
    if (game.batteryMode !== null) {
      handleBatteryTransfer(benchIndex);
      return;
    }
    const benchCard = game.playerBench[benchIndex];
    if (!benchCard) return;

    if (getBenchRole(game, benchIndex) === 'support') {
      useSupportAbility(benchIndex);
      return;
    }
    if (game.playerSupportRotateUsed) return;

    setPinnedTooltipSlotId(null);
    clearStickyHold();
    clearKinInspectHold();
    setKinInspectIndex(null);
    recordUndoSnapshot({
      game: latestGameRef.current,
      enemyTurnSummary,
      guidePlan,
      actor: 'player',
    });
    setGame((prev) => simulateRotateSupport(prev, benchIndex));
    appendCombatLog({
      timestamp: Date.now(),
      biomeId: game.biomeId,
      type: 'ability',
      actor: benchCard.name,
      detail: { effect: 'rotate-support', toIndex: benchIndex },
    });
    queueDialogueCallout(benchCard.name, 'I can support from here.', 140);
    const priorSupport = getSupportBenchCard(game);
    if (priorSupport) {
      queueDialogueCallout(priorSupport.name, 'Your lead.', 760);
    }
  }, [appendCombatLog, currentTurn, enemyTurnSummary, game, guidePlan, handleBatteryTransfer, queueDialogueCallout, recordUndoSnapshot, useSupportAbility]);

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

  const handleKinInspectPointerDown = useCallback((benchIndex: number) => {
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
      setKinInspectIndex(benchIndex);
    }, KIN_INSPECT_HOLD_MS);
  }, [clearKinInspectHold]);

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
    columnIndex: number
  ): GolfGameState => {
    const stock = actor === 'player' ? prev.playerStock : prev.enemyStock;
    const candidate = prev.tableau[columnIndex][prev.tableau[columnIndex].length - 1];
    if (!candidate || !canPlayOnStock(candidate, stock)) return prev;

    const reducedTableau = prev.tableau.map((column, idx) =>
      idx === columnIndex ? column.slice(0, -1) : column
    );
    const refillResult = refillClearedTableau(reducedTableau, columnIndex);

    if (actor === 'player') {
      const nextSequence = prev.playerStockSequence + 1;
      const prepared = applyCounterWindowToPacket(
        prev,
        buildPokePacket(prev.playerStock, prev.enemyStock, nextSequence, 'player')
      );
      const resolved = resolveDamagePacket(prepared.state.combatants, prepared.packet);
      appendCombatLog({
        timestamp: Date.now(),
        biomeId: prev.biomeId,
        type: 'move',
        actor: prev.playerStock.name,
        target: prev.enemyStock.name,
        detail: { card: candidate.id, columnIndex, damage: resolved.damageDealt, dodged: resolved.dodged },
      });
      return resolveEnemyDefeat({
        ...prev,
        tableau: refillResult.tableau,
        playerStock: evolveIdentityCard(prev.playerStock, candidate),
        clearedCount: prev.clearedCount + 1,
        playerStockSequence: nextSequence,
        playerStockActionPoints: prev.playerStockActionPoints + 1,
        playerFreeTagAvailable: false,
        tableClears: prev.tableClears + (refillResult.tableCleared ? 1 : 0),
        ...advancePlayerTagLock(prev),
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

    return {
      ...nextState,
      playerSupportReactiveUsed: reactedEnemyResult.state.playerSupportReactiveUsed,
      tableau: refillResult.tableau,
      enemyStock: evolveIdentityCard(nextState.enemyStock, candidate),
      clearedCount: nextState.clearedCount + 1,
      enemyStockSequence: nextEnemySequence,
      enemyStockActionPoints: nextState.enemyStockActionPoints + 1,
      combatants: enemyResolved.combatants,
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
            next = executeGolfMove(next, 'player', action.columnIndex);
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
          canPlayOnStock(topCard, game.playerStock)
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
  }, [game.playerStock, game.tableau, stickyPawsArmed]);

  const renderAbilityTooltip = useCallback((slot: PlayerHandSlot) => {
    if (slot.effect === 'battery') {
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Battery</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Tool Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Prime the battery, tap an ally to bank their AP, then prime it again to route the stored AP into another ally.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Stored AP: {game.batteryStoredActionPoints} • Mode: {game.batteryMode ?? 'idle'}
          </div>
        </div>
      );
    }
    if (slot.effect === 'siphon') {
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Siphon</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Battle Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Spend 2 AP to steal up to 2 AP from the current enemy stock and grant it to Jet.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Enemy AP: {game.enemyStockActionPoints}
          </div>
        </div>
      );
    }
    if (slot.effect === 'rigged-construct') {
      return (
        <div>
          <div className="text-sm font-black uppercase tracking-[0.14em] text-game-gold">Rigged Construct</div>
          <div className="mt-2 text-xs uppercase tracking-[0.12em] text-game-teal/70">Battle Active • Jet Only</div>
          <div className="mt-2 text-sm text-white/80">
            Spend 8 AP to deploy a temporary wild construct. Armed construct turns compatible tableau plays into stored construct cards; tapping the construct releases the top card back into Jet in reverse order.
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
            Depth: {game.riggedConstructCards.length} • Cooldown: {game.riggedConstructCooldown > 0 ? game.riggedConstructCooldown : 'ready'}
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
          ? `Click to steal from enemy cards. Long press to arm the exploration grab. Cooldown: ${cooldown > 0 ? cooldown : 'ready'}`
          : slot.effect === 'paw-sperity'
            ? `Permanent kit card. Cooldown: ${game.panPawSperityCooldown > 0 ? game.panPawSperityCooldown : 'ready'}`
            : slot.effect === 'jikan'
              ? 'Undo target: last combat play or last tableau play.'
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
  }, [game.batteryMode, game.batteryStoredActionPoints, game.enemyStockActionPoints, game.panPawSperityCooldown, game.playerStockActionPoints, game.riggedConstructCards.length, game.riggedConstructCooldown, game.stickyPawsCooldown]);

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

      <div className="relative z-10 flex min-h-screen flex-col px-3 py-3 md:px-4 md:py-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
          <div className="flex w-full justify-center">
            <div className="relative flex items-center justify-center" style={{ gap: benchGap }}>
              {game.enemyBench.map((card, benchIndex) => (
                <KinBenchCard
                  key={card.id}
                  card={card}
                  vitals={getCombatVitals(game, card)}
                  combatant={getCombatantForCard(game, card)}
                  actionPoints={0}
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
                  actionPoints={game.enemyStockActionPoints}
                  cardSize={boardCardSize}
                  indicatorSize={indicatorSize}
                  compact={boardCompact}
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
                const isPlayable =
                  !!topCard &&
                  currentTurn === 'player' &&
                  canPlayOnStock(topCard, game.playerStock) &&
                  (!stickyPawsArmed || column.length > 1);
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
                        const ancestorStep = isTopCard ? ancestorsHighlightedColumns.get(columnIndex) ?? null : null;
                        const guidanceGlow =
                          currentTurn === 'player' &&
                          effectiveOracleMode !== 'off' &&
                          isTopCard &&
                          guidanceNextColumn === columnIndex;

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
                            }}
                          >
                            <div
                              className={`rounded-[16px] border p-0.5 shadow-[0_0_18px_rgba(255,255,255,0.08)] ${
                                isTopCard ? 'border-white/15 bg-black/62' : 'border-white/10 bg-black/55'
                              }`}
                              style={
                                guidanceGlow
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
                                  {ancestorStep ? (
                                    <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-full border border-game-gold/40 bg-black/75 px-1.5 py-0.5 text-[9px] font-black text-game-gold">
                                      {ancestorStep}
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
            <div className="flex items-center justify-center" style={{ gap: benchGap }}>
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
                        slot.kind === 'captured' &&
                        !!slot.card &&
                        canPlayOnStock(slot.card, game.playerStock)
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
              {activeActorName === 'Jet' && (game.riggedConstructCards.length > 0 || game.riggedConstructCooldown > 0) ? (
                <RiggedConstructCard
                  topCard={game.riggedConstructCards[game.riggedConstructCards.length - 1] ?? null}
                  depth={game.riggedConstructCards.length}
                  armed={game.riggedConstructArmed}
                  cooldownRemaining={game.riggedConstructCooldown}
                  onClick={useRiggedConstructCard}
                  cardSize={handCardSize}
                />
              ) : null}
              <StockActorShellView
                actor={PLAYER_STOCK_ACTOR}
                stock={game.playerStock}
                vitals={getCombatVitals(game, game.playerStock)}
                combatant={getCombatantForCard(game, game.playerStock)}
                stockRef={playerStockRef}
                onClick={() => {
                  if (game.batteryMode !== null) {
                    handleBatteryTransfer('prime');
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
                highlighted={guidanceHighlightedStockId === game.playerStock.id}
                actionPoints={game.playerStockActionPoints}
                discardCount={game.playerDiscardPile.length}
              />
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
                          } else if (slot.effect === 'siphon') {
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
                        slot.kind === 'captured' &&
                        !!slot.card &&
                        canPlayOnStock(slot.card, game.playerStock)
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
              {effectiveOracleMode === 'guidance' && bestStarterHeuristic ? (
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-game-gold/80">
                  Favor the highlighted stock
                </div>
              ) : null}
              {kinInspectIndex !== null && inspectedKinCard && inspectedKinTaxonomy ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-game-teal/70">
                    Inspecting {inspectedKinCard.name}
                  </div>
                  <div className="flex items-start justify-center" style={{ gap: benchGap }}>
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-white/45">Kin Card</div>
                      <KinBenchCard
                        card={inspectedKinCard}
                        vitals={getCombatVitals(game, inspectedKinCard)}
                        combatant={getCombatantForCard(game, inspectedKinCard)}
                        actionPoints={kinInspectIndex === -1 ? game.playerStockActionPoints : (game.playerBenchActionPoints[kinInspectIndex] ?? 0)}
                        cardSize={boardCardSize}
                        heuristicLabel={null}
                        highlighted={guidanceHighlightedStockId === inspectedKinCard.id || (highlightPanForBadLuck && inspectedKinCard.name === 'Pan')}
                        breathing={highlightPanForBadLuck && inspectedKinCard.name === 'Pan'}
                        discardCount={game.playerDiscardPile.length}
                        canInteract={false}
                        onClick={() => {}}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-[8px] font-mono uppercase tracking-[0.14em] leading-[1.1] text-white/45 text-center">
                        <div>Signature</div>
                        <div>Ability</div>
                      </div>
                      {inspectedKinTaxonomy.signature.length > 0 ? inspectedKinTaxonomy.signature.map((slot) => (
                        <Tooltip key={`${inspectedKinCard.id}-${slot.slotId}-signature`} content={renderAbilityTooltip(slot)} pinnable={false}>
                          <HandSlotCard
                            slot={slot}
                            canUse={false}
                            onClick={() => {}}
                            cooldownRemaining={getAbilityCooldown(game, slot.effect)}
                            taxonomyLabel={getAbilityTaxonomyBadge(slot.effect)}
                            cardSize={handCardSize}
                          />
                        </Tooltip>
                      )) : <HandSlotCard slot={createEmptyHandSlot('left')} canUse={false} onClick={() => {}} cardSize={handCardSize} />}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-[8px] font-mono uppercase tracking-[0.14em] leading-[1.1] text-white/45 text-center">
                        <div>Tableau Clear</div>
                        <div>Ability</div>
                      </div>
                      {inspectedKinTaxonomy.tableauClear.length > 0 ? inspectedKinTaxonomy.tableauClear.map((slot) => (
                        <Tooltip key={`${inspectedKinCard.id}-${slot.slotId}-tableau`} content={renderAbilityTooltip(slot)} pinnable={false}>
                          <HandSlotCard
                            slot={slot}
                            canUse={false}
                            onClick={() => {}}
                            cooldownRemaining={getAbilityCooldown(game, slot.effect)}
                            taxonomyLabel={getAbilityTaxonomyBadge(slot.effect)}
                            cardSize={handCardSize}
                          />
                        </Tooltip>
                      )) : <HandSlotCard slot={createEmptyHandSlot('left')} canUse={false} onClick={() => {}} cardSize={handCardSize} />}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-white/45">Tool Abilities</div>
                      <div className="flex items-start justify-center" style={{ gap: benchGap }}>
                        {inspectedKinTaxonomy.tools.length > 0 ? inspectedKinTaxonomy.tools.map((slot) => (
                          <Tooltip key={`${inspectedKinCard.id}-${slot.slotId}-tool`} content={renderAbilityTooltip(slot)} pinnable={false}>
                            <HandSlotCard
                              slot={slot}
                              canUse={false}
                              onClick={() => {}}
                              cooldownRemaining={getAbilityCooldown(game, slot.effect)}
                              taxonomyLabel={getAbilityTaxonomyBadge(slot.effect)}
                              cardSize={handCardSize}
                            />
                          </Tooltip>
                        )) : <HandSlotCard slot={createEmptyHandSlot('left')} canUse={false} onClick={() => {}} cardSize={handCardSize} />}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-white/45">Battle Abilities</div>
                      <div className="flex items-start justify-center" style={{ gap: benchGap }}>
                        {inspectedKinTaxonomy.battle.length > 0 ? inspectedKinTaxonomy.battle.map((slot) => (
                          <Tooltip key={`${inspectedKinCard.id}-${slot.slotId}-battle`} content={renderAbilityTooltip(slot)} pinnable={false}>
                            <HandSlotCard
                              slot={slot}
                              canUse={false}
                              onClick={() => {}}
                              cooldownRemaining={getAbilityCooldown(game, slot.effect)}
                              taxonomyLabel={getAbilityTaxonomyBadge(slot.effect)}
                              cardSize={handCardSize}
                            />
                          </Tooltip>
                        )) : <HandSlotCard slot={createEmptyHandSlot('left')} canUse={false} onClick={() => {}} cardSize={handCardSize} />}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  {supportBenchCard ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-game-gold/80">
                        Support
                      </div>
                      <KinBenchCard
                        key={supportBenchCard.id}
                        card={supportBenchCard}
                        vitals={getCombatVitals(game, supportBenchCard)}
                        combatant={getCombatantForCard(game, supportBenchCard)}
                        cardRef={(node) => {
                          playerBenchRefs.current[supportBenchIndex] = node;
                        }}
                        actionPoints={game.playerBenchActionPoints[supportBenchIndex] ?? 0}
                        cardSize={boardCardSize}
                        heuristicLabel={null}
                        highlighted={guidanceHighlightedStockId === supportBenchCard.id || (highlightPanForBadLuck && supportBenchCard.name === 'Pan')}
                        breathing={highlightPanForBadLuck && supportBenchCard.name === 'Pan'}
                        discardCount={game.playerDiscardPile.length}
                        canInteract={currentTurn === 'player' && game.batteryMode === null}
                        roleLabel="Support"
                        roleDescription={getSupportPassiveSummary(supportBenchCard)}
                        activeRole
                        onPointerDown={() => handleKinInspectPointerDown(supportBenchIndex)}
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
                        onClick={() => handleBenchCardClick(supportBenchIndex)}
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-game-teal/70">
                      Assist
                    </div>
                    <div className="flex items-start justify-center" style={{ gap: benchKinGap }}>
                      {assistBenchIndices.map((benchIndex) => {
                        const card = game.playerBench[benchIndex];
                        if (!card) return null;
                        return (
                          <KinBenchCard
                            key={card.id}
                            card={card}
                            vitals={getCombatVitals(game, card)}
                            combatant={getCombatantForCard(game, card)}
                            cardRef={(node) => {
                              playerBenchRefs.current[benchIndex] = node;
                            }}
                            actionPoints={game.playerBenchActionPoints[benchIndex] ?? 0}
                            cardSize={boardCardSize}
                            heuristicLabel={null}
                            highlighted={guidanceHighlightedStockId === card.id || (highlightPanForBadLuck && card.name === 'Pan')}
                            breathing={highlightPanForBadLuck && card.name === 'Pan'}
                            discardCount={game.playerDiscardPile.length}
                            canInteract={currentTurn === 'player' && (game.batteryMode !== null || !game.playerSupportRotateUsed)}
                            roleLabel="Assist"
                            roleDescription={getAssistPassiveSummary(card)}
                            onPointerDown={() => handleKinInspectPointerDown(benchIndex)}
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
                            onClick={() => handleBenchCardClick(benchIndex)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            {showHeuristicValues && currentTurn === 'player' && effectiveOracleMode !== 'ancestors' ? (
              <HeuristicPill label={effectiveOracleMode === 'ancestors' ? 'hidden best path' : 'visible best path'} />
            ) : null}
            </div>
          </div>
      </div>

      <button
        type="button"
        onClick={runEnemyTurn}
        disabled={currentTurn !== 'player'}
        className={`fixed bottom-4 right-4 z-40 rounded-2xl border px-5 py-4 text-[10px] font-black uppercase tracking-[0.22em] shadow-[0_12px_30px_rgba(0,0,0,0.38)] backdrop-blur-sm transition-colors md:bottom-6 md:right-6 ${
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
