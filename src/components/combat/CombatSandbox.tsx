import { Profiler, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useGraphics } from '../../contexts/GraphicsContext';
import { useCardScalePreset } from '../../contexts/CardScaleContext';
import { usePerspective } from '../../contexts/PerspectiveContext';
import { CARD_SIZE, ELEMENT_TO_SUIT, HAND_SOURCE_INDEX, WILD_SENTINEL_RANK } from '../../engine/constants';
import { canPlayCardWithWild, getRankDisplay } from '../../engine/rules';
import { ACTOR_DEFINITIONS, getActorDefinition } from '../../engine/actors';
import { createActorDeckStateWithOrim } from '../../engine/actorDecks';
import { analyzeOptimalSequence } from '../../engine/analysis';
import { isCombatSessionActive } from '../../engine/combatSession';
import {
  getCombatActiveSide,
  getCombatLastWorldEvent,
  getCombatTurnDurationMs,
  getCombatTurnNumber,
} from '../../engine/combat/sessionBridge';
import { getActiveCombatPartyId, getPartyAssignments } from '../../engine/combat/stateAliases';
import { resolveCostByRarity } from '../../engine/rarityLoadouts';
import { Foundation } from '../Foundation';
import { DeckSprawl } from '../DeckSprawl';
import { DragPreview } from '../DragPreview';
import { DedicatedPlayerTableau } from './DedicatedPlayerTableau';
import { StatusBadges } from './StatusBadges';
import { buildActorStatusBadges } from './buildActorStatusBadges';
import { TableauNoMovesOverlay } from './TableauNoMovesOverlay';
import { FpsBadge } from './FpsBadge';
import type { CombatSandboxActionsContract } from './contracts';
import { useRpgCombatTicker } from './hooks/useRpgCombatTicker';
import { useDragDrop } from '../../hooks/useDragDrop';
import { getNeonElementColor } from '../../utils/styles';
import type { AbilityLifecycleDef, AbilityLifecycleExhaustScope, AbilityLifecycleUsageEntry, Actor, Card as CardType, Element, GameState, OrimDefinition, OrimRarity, SelectedCard } from '../../engine/types';
import abilitiesJson from '../../data/abilities.json';
import { LostInStarsAtmosphere } from '../atmosphere/LostInStarsAtmosphere';
import { AuroraForestAtmosphere } from '../atmosphere/AuroraForestAtmosphere';
import { GargantuaAtmosphere } from '../atmosphere/GargantuaAtmosphere';
import { BrownianMotionAtmosphere } from '../atmosphere/BrownianMotionAtmosphere';
import { ChaosSplitAtmosphere } from '../atmosphere/ChaosSplitAtmosphere';
import { CometBarrageAtmosphere } from '../atmosphere/CometBarrageAtmosphere';
import { CometRainAtmosphere } from '../atmosphere/CometRainAtmosphere';
import { CosmicLintAtmosphere } from '../atmosphere/CosmicLintAtmosphere';
import { DoorSandsTimeAtmosphere } from '../atmosphere/DoorSandsTimeAtmosphere';
import { DriftingPurpleAtmosphere } from '../atmosphere/DriftingPurpleAtmosphere';
import { EinsteinRosenAtmosphere } from '../atmosphere/EinsteinRosenAtmosphere';
import { ElectricSkiesAtmosphere } from '../atmosphere/ElectricSkiesAtmosphere';
import { FallingSnowAtmosphere } from '../atmosphere/FallingSnowAtmosphere';
import { FlorpusForestAtmosphere } from '../atmosphere/FlorpusForestAtmosphere';
import { GravitySplitAtmosphere } from '../atmosphere/GravitySplitAtmosphere';
import { SmokeGreenAtmosphere } from '../atmosphere/SmokeGreenAtmosphere';
import { SpinningStarfieldAtmosphere } from '../atmosphere/SpinningStarfieldAtmosphere';
import { InfernoMaelstromAtmosphere } from '../atmosphere/InfernoMaelstromAtmosphere';
import { OceanSolarCycleAtmosphere } from '../atmosphere/OceanSolarCycleAtmosphere';
import { RagingWavesAtmosphere } from '../atmosphere/RagingWavesAtmosphere';
import { RaritySquaresTunnelAtmosphere } from '../atmosphere/RaritySquaresTunnelAtmosphere';
import { SacredRealmAtmosphere } from '../atmosphere/SacredRealmAtmosphere';
import { SakuraBlossomsAtmosphere } from '../atmosphere/SakuraBlossomsAtmosphere';
import { SolarisPrimeAtmosphere } from '../atmosphere/SolarisPrimeAtmosphere';
import { StarsTwinklePerformantAtmosphere } from '../atmosphere/StarsTwinklePerformantAtmosphere';
import { ATMOSPHERE_PRESETS, type AtmosphereEffectId } from '../atmosphere/atmosphereLibrary';

interface CombatSandboxProps {
  open: boolean;
  isLabMode?: boolean;
  gameState: GameState;
  actions: CombatSandboxActionsContract;
  timeScale: number;
  timeScaleOptions?: number[];
  onCycleTimeScale: () => void;
  onSetTimeScale?: (next: number) => void;
  isGamePaused: boolean;
  highPerformanceTimer?: boolean;
  onTogglePause: () => void;
  onClose: () => void;
  onOpenEditor?: () => void;
  selectedCard: SelectedCard | null;
  validFoundationsForSelected: boolean[];
  noValidMoves: boolean;
  noValidMovesPlayer?: boolean;
  noValidMovesEnemy?: boolean;
  tableauCanPlay: boolean[];
  hideGameContent?: boolean;
}

const DIFFICULTY_ORDER: NonNullable<GameState['enemyDifficulty']>[] = ['easy', 'normal', 'hard', 'divine'];
const COMBAT_STANDARD_TABLEAU_COUNT = 7;
const COMBAT_STANDARD_TABLEAU_DEPTH = 4;
const COMBAT_RANDOM_ELEMENTAL_POOL: CardType['element'][] = ['A', 'W', 'E', 'F', 'L', 'D', 'N'];
const COMBAT_LAB_FOUNDATION_ACTOR_DEFINITION_IDS: Array<'felis' | 'ursus' | 'lupus'> = ['felis', 'ursus', 'lupus'];
const ENEMY_TABLEAU_STACK_PEEK_PX = 8;
const ARENA_FIT_PADDING_X = 16;
const ARENA_FIT_PADDING_Y = 20;
const ARENA_MIN_SCALE = 0.35;
const PLAYER_TURN_BAR_BUFFER_PX = 24;
const INTER_TURN_COUNTDOWN_MS = 3000;
const AP_SEGMENT_ORDER: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];
const DEFAULT_PLAYER_FOUNDATION_GLOW = '#ffffff';
const DEFAULT_ENEMY_FOUNDATION_GLOW = '#ff8f66';
const ENEMY_FOUNDATION_LAB_SLOT_COUNT = 3;
const DISABLE_TURN_BAR_ANIMATION = false;
const TURN_TIMER_TICK_MS = 150;
const RPG_TICK_INTERVAL_MS = 80;
const FINAL_MOVE_RELIC_BEHAVIOR_ID = 'final_move_v1';
const MASTER_STRATEGIST_RELIC_BEHAVIOR_ID = 'master_strategist_v1';
const ZEN_RELIC_BEHAVIOR_ID = 'zen_v1';
const LAB_DEFAULT_ENEMY_DEFINITION_ID = 'shade_of_resentment';
const DEFAULT_TIME_SCALE_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
const AUTO_PLAY_SPEED_OPTIONS = [0.5, 1, 2, 4];
const AUTO_PLAY_BASE_STEP_MS = 430;
const AUTO_PLAY_DRAG_DURATION_MULTIPLIER = 2;
const AUTO_PLAY_MAX_DRAG_DURATION_MS = 1960;
const AUTO_PLAY_MAX_TRACE = 10;
const AUTO_PLAY_AUDIT_MAX = 400;
const AUTO_PLAY_STALL_LIMIT = 4;
const AUTO_PLAY_DEFAULT_SEED = 1337;
const AUTO_PLAY_REPLAY_VERSION = 1;
const AUTO_PLAY_DRAG_CARD_WIDTH = 66;
const AUTO_PLAY_DRAG_CARD_HEIGHT = 92;
const AUTO_EFFECT_WEIGHTS: Partial<Record<string, number>> = {
  damage: 9,
  burn: 7,
  bleed: 7,
  stun: 8,
  draw: 6,
  healing: 6,
  armor: 4.5,
  defense: 4.5,
  evasion: 3.8,
  redeal_tableau: 6,
  upgrade_card_rarity_uncommon: 3.5,
};
const FALLBACK_ABILITY_IDS = new Set(
  (((abilitiesJson as { abilities?: AbilityCatalogEntry[] }).abilities) ?? [])
    .map((entry) => String(entry.id ?? '').trim())
    .filter((id) => id.length > 0)
);
function resolveDeckCardApCost(
  deckCard: { cost?: number; costByRarity?: Partial<Record<OrimRarity, number>> },
  rarity: OrimRarity
): number {
  return resolveCostByRarity(deckCard, rarity);
}

type PerfSummary = { avg: number; p95: number; max: number };
type PerfFpsSummary = { avg: number; p95: number; worst: number };
type AutoPlayActorSide = 'player' | 'enemy';
type AutoPlayDecisionKind =
  | 'player_tableau'
  | 'enemy_tableau'
  | 'enemy_rpg_attack'
  | 'advance_turn'
  | 'rest_turn'
  | 'complete_encounter'
  | 'wait';
type AutoPlayDecisionEntry = {
  side: AutoPlayActorSide | 'system';
  kind: AutoPlayDecisionKind;
  score: number;
  label: string;
  accepted: boolean;
  at: number;
};
type AutoPlayMoveAuditEntry = {
  kind: 'step' | 'decision';
  at: number;
  activeSide: 'player' | 'enemy';
  turn: number;
  timeScale: number;
  autoPlaySpeed: number;
  playerTableauTopRanks: Array<number | null>;
  playerFoundationTopRanks: Array<number | null>;
  enemyFoundationTopRanks: Array<number | null>;
  legalPlayerMovesByFoundation: number[];
  legalEnemyMovesByFoundation: number[];
  detail: Record<string, unknown>;
};
type AutoPlayBatchRunSummary = {
  run: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  turnsCompleted: number;
  playerTurnsStarted: number;
  enemyTurnsStarted: number;
  playerCardsPlayed: number;
  enemyCardsPlayed: number;
  peakLegalPlayerMoves: number;
  peakLegalEnemyMoves: number;
  finalTurnNumber: number;
  completionReason: 'dead_tableau' | 'stall_limit' | 'manual_stop';
  deadTableauReached: boolean;
  noValidMovesPlayer: boolean;
  remainingTableauDepths: number[];
  playerTableauTopRanks: Array<number | null>;
  playerFoundationTopRanks: Array<number | null>;
  legalPlayerMovesByFoundation: number[];
  totalLegalPlayerMoves: number;
  traceTail: AutoPlayDecisionEntry[];
  moveAuditTail: AutoPlayMoveAuditEntry[];
};
type AutoPlayBatchRunMetrics = {
  peakLegalPlayerMoves: number;
  peakLegalEnemyMoves: number;
  playerCardsPlayed: number;
  enemyCardsPlayed: number;
  playerTurnsStarted: number;
  enemyTurnsStarted: number;
  observedTurnCounter: number;
};
type AutoPlayDragSource = 'tableau' | 'hand';
type AutoPlayDragAnim = {
  id: string;
  card: CardType;
  from: { x: number; y: number };
  to: { x: number; y: number };
  startedAtMs: number;
  durationMs: number;
};
type AutoPlayPolicyProfile = {
  id: NonNullable<GameState['enemyDifficulty']>;
  playerAggro: number;
  enemyAggro: number;
  playerSupportBias: number;
  enemySupportBias: number;
  tacticalWeight: number;
  fallbackWeight: number;
};
type AutoPlayReplayBundle = {
  version: number;
  capturedAt: string;
  deterministic: boolean;
  seed: number;
  difficulty: NonNullable<GameState['enemyDifficulty']>;
  timeScale: number;
  autoPlaySpeed: number;
  trace: AutoPlayDecisionEntry[];
  startSnapshot: Partial<GameState>;
  finalSnapshot: Partial<GameState>;
};

const PERF_SAMPLE_CAP = 180;
const AUTO_PLAY_POLICY_BY_DIFFICULTY: Record<NonNullable<GameState['enemyDifficulty']>, AutoPlayPolicyProfile> = {
  easy: {
    id: 'easy',
    playerAggro: 0.92,
    enemyAggro: 0.84,
    playerSupportBias: 1.08,
    enemySupportBias: 1.16,
    tacticalWeight: 0.88,
    fallbackWeight: 1.2,
  },
  normal: {
    id: 'normal',
    playerAggro: 1,
    enemyAggro: 1,
    playerSupportBias: 1,
    enemySupportBias: 1,
    tacticalWeight: 1,
    fallbackWeight: 1,
  },
  hard: {
    id: 'hard',
    playerAggro: 1.08,
    enemyAggro: 1.15,
    playerSupportBias: 0.96,
    enemySupportBias: 0.94,
    tacticalWeight: 1.14,
    fallbackWeight: 0.85,
  },
  divine: {
    id: 'divine',
    playerAggro: 1.15,
    enemyAggro: 1.24,
    playerSupportBias: 0.92,
    enemySupportBias: 0.88,
    tacticalWeight: 1.26,
    fallbackWeight: 0.72,
  },
};

function deepCloneReplayValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function easeInOutCubic(value: number): number {
  if (value < 0.5) return 4 * value * value * value;
  return 1 - (Math.pow(-2 * value + 2, 3) / 2);
}

function nextAutoPlaySeed(seed: number): number {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

function runWithDeterministicRandom<T>(
  enabled: boolean,
  seedRef: { current: number },
  run: () => T
): T {
  if (!enabled) return run();
  const originalRandom = Math.random;
  Math.random = () => {
    seedRef.current = nextAutoPlaySeed(seedRef.current);
    return seedRef.current / 0x100000000;
  };
  try {
    return run();
  } finally {
    Math.random = originalRandom;
  }
}

function pushPerfSample(buffer: number[], value: number) {
  if (!Number.isFinite(value) || value < 0) return;
  buffer.push(value);
  if (buffer.length > PERF_SAMPLE_CAP) {
    buffer.splice(0, buffer.length - PERF_SAMPLE_CAP);
  }
}

function summarizePerfSamples(samples: number[]): PerfSummary {
  if (samples.length === 0) return { avg: 0, p95: 0, max: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const max = sorted[sorted.length - 1];
  return { avg, p95, max };
}

function summarizeFpsFromFrameTimes(frameTimesMs: number[]): PerfFpsSummary {
  if (frameTimesMs.length === 0) return { avg: 0, p95: 0, worst: 0 };
  const sorted = [...frameTimesMs].sort((a, b) => a - b);
  const avgFrameTime = frameTimesMs.reduce((sum, value) => sum + value, 0) / frameTimesMs.length;
  const p95FrameTime = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const worstFrameTime = sorted[sorted.length - 1];
  return {
    avg: avgFrameTime > 0 ? 1000 / avgFrameTime : 0,
    p95: p95FrameTime > 0 ? 1000 / p95FrameTime : 0,
    worst: worstFrameTime > 0 ? 1000 / worstFrameTime : 0,
  };
}

type AbilityCatalogEntry = {
  id?: string;
  label?: string;
  description?: string;
  element?: Element;
  rarity?: string;
  power?: number;
  canTap?: boolean;
  effects?: Array<{
    type?: string;
    value?: number;
    target?: 'self' | 'enemy' | 'all_enemies' | 'ally' | 'all_allies' | 'anyone';
    deadRunOnly?: boolean;
    drawWild?: boolean;
    drawElement?: Element;
  }>;
  triggers?: Array<{
    type?: string;
    target?: 'self' | 'enemy' | 'anyone';
    value?: number;
    operator?: '<' | '<=' | '>' | '>=' | '=' | '!=';
    countdownType?: 'combo' | 'seconds';
    countdownValue?: number;
  }>;
  lifecycle?: AbilityLifecycleDef;
};

function normalizeAbilityTriggerType(rawType: unknown): string {
  const normalized = String(rawType ?? '').trim().toLowerCase();
  if (normalized === 'deadtableau' || normalized === 'dead_tableau') return 'noValidMovesPlayer';
  if (normalized === 'novalidmovesplayer' || normalized === 'no_valid_moves_player') return 'noValidMovesPlayer';
  if (normalized === 'novalidmovesenemy' || normalized === 'no_valid_moves_enemy') return 'noValidMovesEnemy';
  if (normalized === 'ondeath' || normalized === 'on_death') return 'on_death';
  if (normalized === 'notdiscarded' || normalized === 'not_discarded') return 'notDiscarded';
  if (normalized === 'foundationdiscardcount' || normalized === 'foundation_discard_count') return 'foundationDiscardCount';
  if (normalized === 'partydiscardcount' || normalized === 'party_discard_count') return 'partyDiscardCount';
  if (normalized === 'foundationactivedeckcount' || normalized === 'foundation_active_deck_count') return 'foundationActiveDeckCount';
  if (normalized === 'actoractivedeckcount' || normalized === 'actor_active_deck_count') return 'actorActiveDeckCount';
  return normalized;
}

function normalizeAbilityTriggerOperator(rawOperator: unknown): '<' | '<=' | '>' | '>=' | '=' | '!=' {
  const normalized = String(rawOperator ?? '').trim();
  if (normalized === '<' || normalized === '<=' || normalized === '>' || normalized === '>=' || normalized === '=' || normalized === '!=') {
    return normalized;
  }
  return '>=';
}

function compareAbilityTriggerMetric(metric: number, threshold: number, operator: '<' | '<=' | '>' | '>=' | '=' | '!='): boolean {
  if (operator === '<') return metric < threshold;
  if (operator === '<=') return metric <= threshold;
  if (operator === '>') return metric > threshold;
  if (operator === '=') return metric === threshold;
  if (operator === '!=') return metric !== threshold;
  return metric >= threshold;
}

type NormalizedLifecyclePreview = {
  exhaustScope: NonNullable<AbilityLifecycleDef['exhaustScope']>;
  maxUsesPerScope: number;
  cooldownMode: NonNullable<AbilityLifecycleDef['cooldownMode']>;
  cooldownValue: number;
  cooldownResetsOn: NonNullable<AbilityLifecycleDef['cooldownResetsOn']>;
};

function normalizeLifecycleForPreview(lifecycle?: AbilityLifecycleDef): NormalizedLifecyclePreview {
  const exhaustScope = lifecycle?.exhaustScope === 'turn'
    || lifecycle?.exhaustScope === 'battle'
    || lifecycle?.exhaustScope === 'rest'
    || lifecycle?.exhaustScope === 'run'
    ? lifecycle.exhaustScope
    : 'none';
  const cooldownMode = lifecycle?.cooldownMode === 'seconds'
    || lifecycle?.cooldownMode === 'turns'
    || lifecycle?.cooldownMode === 'combo'
    ? lifecycle.cooldownMode
    : 'none';
  const cooldownResetsOn = lifecycle?.cooldownResetsOn === 'turn_end'
    || lifecycle?.cooldownResetsOn === 'battle_end'
    || lifecycle?.cooldownResetsOn === 'rest'
    ? lifecycle.cooldownResetsOn
    : 'turn_start';
  const maxUsesRaw = Number(lifecycle?.maxUsesPerScope ?? 1);
  const cooldownValueRaw = Number(lifecycle?.cooldownValue ?? 0);
  return {
    exhaustScope,
    maxUsesPerScope: Number.isFinite(maxUsesRaw) ? Math.max(0, Math.floor(maxUsesRaw)) : 1,
    cooldownMode,
    cooldownValue: Number.isFinite(cooldownValueRaw) ? Math.max(0, Math.floor(cooldownValueRaw)) : 0,
    cooldownResetsOn,
  };
}

function getLifecycleCounterForPreview(state: GameState, scope: AbilityLifecycleExhaustScope): number {
  if (scope === 'turn') return Math.max(0, Number(state.lifecycleTurnCounter ?? getCombatTurnNumber(state) ?? state.turnCount ?? 0));
  if (scope === 'battle') return Math.max(0, Number(state.lifecycleBattleCounter ?? 0));
  if (scope === 'rest') return Math.max(0, Number(state.lifecycleRestCounter ?? state.globalRestCount ?? 0));
  if (scope === 'run') return Math.max(1, Number(state.lifecycleRunCounter ?? 1));
  return 0;
}

function getLifecycleScopeUsageForPreview(
  entry: AbilityLifecycleUsageEntry | undefined,
  scope: AbilityLifecycleExhaustScope,
  counter: number
): number {
  if (!entry) return 0;
  if (scope === 'turn') return entry.turnCounter === counter ? Math.max(0, Number(entry.turnUses ?? 0)) : 0;
  if (scope === 'battle') return entry.battleCounter === counter ? Math.max(0, Number(entry.battleUses ?? 0)) : 0;
  if (scope === 'rest') return entry.restCounter === counter ? Math.max(0, Number(entry.restUses ?? 0)) : 0;
  if (scope === 'run') return entry.runCounter === counter ? Math.max(0, Number(entry.runUses ?? 0)) : 0;
  return 0;
}

function canUseDeckCardLifecycleForPreview(
  state: GameState,
  deckCardId: string | undefined,
  lifecycle?: AbilityLifecycleDef
): boolean {
  if (!deckCardId) return true;
  const normalized = normalizeLifecycleForPreview(lifecycle);
  const usageEntry = state.abilityLifecycleUsageByDeckCard?.[deckCardId];
  if (normalized.cooldownMode === 'turns' && normalized.cooldownValue > 0) {
    const currentTurnCounter = getLifecycleCounterForPreview(state, 'turn');
    const readyAt = Math.max(0, Number(usageEntry?.turnCooldownReadyAt ?? 0));
    if (currentTurnCounter < readyAt) {
      if (normalized.cooldownResetsOn === 'battle_end') {
        const priorBattleCounter = Number(usageEntry?.turnCooldownBattleCounter ?? -1);
        const currentBattleCounter = getLifecycleCounterForPreview(state, 'battle');
        if (!(priorBattleCounter >= 0 && currentBattleCounter !== priorBattleCounter)) return false;
      } else if (normalized.cooldownResetsOn === 'rest') {
        const priorRestCounter = Number(usageEntry?.turnCooldownRestCounter ?? -1);
        const currentRestCounter = getLifecycleCounterForPreview(state, 'rest');
        if (!(priorRestCounter >= 0 && currentRestCounter !== priorRestCounter)) return false;
      } else {
        return false;
      }
    }
  }
  if (normalized.exhaustScope === 'none') return true;
  if (normalized.maxUsesPerScope <= 0) return true;
  const counter = getLifecycleCounterForPreview(state, normalized.exhaustScope);
  const used = getLifecycleScopeUsageForPreview(usageEntry, normalized.exhaustScope, counter);
  return used < normalized.maxUsesPerScope;
}

function withAlpha(color: string, alpha: number): string {
  const normalized = color.trim();
  const clamped = Math.max(0, Math.min(1, alpha));
  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hexMatch) return normalized;
  const hex = hexMatch[1];
  const expanded = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamped.toFixed(3)})`;
}

function buildFoundationNeonStyle(
  tokenCounts?: Partial<Record<Element, number>>,
  fallbackElement?: Element,
  preferredElement?: Element
): { color?: string; shadow?: string } {
  const weighted = AP_SEGMENT_ORDER
    .map((element) => ({ element, count: Math.max(0, Math.floor(Number(tokenCounts?.[element] ?? 0))) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  if (weighted.length === 0 && preferredElement) {
    weighted.push({ element: preferredElement, count: 1 });
  }
  if (weighted.length === 0 && fallbackElement) {
    weighted.push({ element: fallbackElement, count: 1 });
  }
  if (weighted.length === 0) return {};

  const preferredActive = preferredElement
    ? weighted.find((entry) => entry.element === preferredElement && entry.count > 0)
    : undefined;
  const primaryEntry = preferredActive ?? weighted[0];
  const total = weighted.reduce((sum, entry) => sum + entry.count, 0) || 1;
  const totalIntensity = Math.max(0, Math.min(1, (total - 1) / 8));
  const primaryColor = getNeonElementColor(primaryEntry.element);
  const primaryWeight = primaryEntry.count / total;
  const shadowParts = weighted.map((entry, idx) => {
    const color = getNeonElementColor(entry.element);
    const weight = entry.count / total;
    const blur = Math.round(10 + totalIntensity * 28 + weight * 10 + Math.max(0, 4 - idx * 1.5));
    const alpha = Math.max(0.16, Math.min(0.95, 0.18 + totalIntensity * 0.5 + weight * 0.25));
    return `0 0 ${blur}px ${withAlpha(color, alpha)}`;
  });
  shadowParts.push(
    `inset 0 0 ${Math.round(10 + totalIntensity * 20 + primaryWeight * 8)}px ${withAlpha(primaryColor, 0.2 + totalIntensity * 0.42 + primaryWeight * 0.14)}`
  );

  return {
    color: primaryColor,
    shadow: shadowParts.join(', '),
  };
}

function getPreferredFoundationElement(
  foundationCards: CardType[],
  tokenCounts?: Partial<Record<Element, number>>
): Element | undefined {
  const fromCards = [...foundationCards]
    .reverse()
    .find((entry) => (
      typeof entry.tokenReward === 'string'
      && !isHandOriginCard(entry)
      && entry.element !== 'N'
    ))?.tokenReward as Element | undefined;
  if (fromCards) return fromCards;
  if (!tokenCounts) return undefined;
  const dominant = AP_SEGMENT_ORDER
    .map((element) => ({ element, count: Math.max(0, Math.floor(Number(tokenCounts[element] ?? 0))) }))
    .sort((a, b) => b.count - a.count)
    .find((entry) => entry.count > 0);
  return dominant?.element;
}

function hasAnyFoundationTokens(tokenCounts?: Partial<Record<Element, number>>): boolean {
  if (!tokenCounts) return false;
  return AP_SEGMENT_ORDER.some((element) => Math.max(0, Math.floor(Number(tokenCounts[element] ?? 0))) > 0);
}

function isInterruptHandCard(card: CardType): boolean {
  if (card.rpgCardKind === 'fast') return true;
  const tags = card.tags ?? [];
  return tags.some((tag) => {
    const normalized = String(tag).trim().toLowerCase();
    return normalized === 'interrupt' || normalized === 'quick';
  });
}

function getCardTurnPlayability(card: CardType): 'player' | 'enemy' | 'anytime' | null {
  const value = card.rpgTurnPlayability;
  if (value === 'player' || value === 'enemy' || value === 'anytime') return value;
  return null;
}

function canPlayCardOnTurn(
  card: CardType,
  activeSide: 'player' | 'enemy',
  fallbackToLegacyPlayerTurn = true
): boolean {
  const turnPlayability = getCardTurnPlayability(card);
  if (turnPlayability) {
    return turnPlayability === 'anytime' || turnPlayability === activeSide;
  }
  if (!fallbackToLegacyPlayerTurn) return true;
  return activeSide === 'player';
}

function isHandOriginCard(card: CardType): boolean {
  if (card.sourceDeckCardId) return true;
  if (card.rpgAbilityId) return true;
  if (card.rpgCardKind) return true;
  if (card.id.startsWith('lab-deck-') || card.id.startsWith('deckhand-') || card.id.startsWith('draw-wild-')) {
    return true;
  }
  return false;
}

function resolveOrimDefinitionIdFromSlot(
  slotOrimId: string | null | undefined,
  orimInstances: Record<string, { definitionId: string }>,
  orimDefinitions: OrimDefinition[]
): string | undefined {
  if (!slotOrimId) return undefined;
  const byInstance = orimInstances[slotOrimId]?.definitionId;
  if (byInstance) return byInstance;
  if (FALLBACK_ABILITY_IDS.has(slotOrimId)) return slotOrimId;
  if (orimDefinitions.some((entry) => entry.id === slotOrimId)) return slotOrimId;
  const parsed = slotOrimId.match(/^orim-(.+)-\d{10,16}-[a-z0-9]+$/i)?.[1];
  if (parsed) {
    if (orimDefinitions.some((entry) => entry.id === parsed)) return parsed;
    if (FALLBACK_ABILITY_IDS.has(parsed)) return parsed;
  }
  const knownIds = [
    ...orimDefinitions.map((entry) => entry.id),
    ...Array.from(FALLBACK_ABILITY_IDS),
  ].sort((a, b) => b.length - a.length);
  return knownIds.find((id) => slotOrimId.includes(`orim-${id}-`));
}

type LabFoundationActors = {
  felis: Actor | null;
  ursus: Actor | null;
  lupus: Actor | null;
};

function resolveLabFoundationActors(state: Pick<GameState, 'partyAssignments' | 'availableActors'>): LabFoundationActors {
  const partyActors = Object.values(getPartyAssignments(state as GameState)).flat();
  const findActor = (definitionId: 'felis' | 'ursus' | 'lupus'): Actor | null => (
    partyActors.find((actor) => actor.definitionId === definitionId)
    ?? state.availableActors.find((actor) => actor.definitionId === definitionId)
    ?? null
  );
  return {
    felis: findActor('felis'),
    ursus: findActor('ursus'),
    lupus: findActor('lupus'),
  };
}

function createLabFoundationActorCard(definitionId: 'felis' | 'ursus' | 'lupus', actor: Actor | null): CardType {
  const fallbackName = definitionId === 'felis' ? 'Felis' : definitionId === 'ursus' ? 'Ursus' : 'Lupus';
  const actorDefinition = getActorDefinition(actor?.definitionId ?? definitionId);
  const actorName = actorDefinition?.name ?? fallbackName;
  const actorTitles = actorDefinition?.titles?.filter(Boolean) ?? [];
  return {
    id: `combatlab-foundation-${definitionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rank: WILD_SENTINEL_RANK,
    suit: actorDefinition?.suit ?? ELEMENT_TO_SUIT.N,
    element: actorDefinition?.element ?? 'N',
    name: actorName,
    description: actorDefinition?.description ?? 'Primary foundation actor.',
    tags: actorTitles.slice(0, 3),
    sourceActorId: actor?.id,
    rpgActorId: actor?.id,
    rpgCardKind: 'focus',
  };
}

function inferFoundationDefinitionId(card: CardType | undefined): 'felis' | 'ursus' | 'lupus' | null {
  if (!card) return null;
  const normalized = String(card.name ?? '').trim().toLowerCase();
  if (normalized === 'felis') return 'felis';
  if (normalized === 'ursus') return 'ursus';
  if (normalized === 'lupus') return 'lupus';
  return null;
}

function buildLabSeededFoundations(existing: CardType[][], actors: LabFoundationActors): CardType[][] {
  const existingRest = existing.slice(3).map((stack) => [...stack]);
  return [
    [createLabFoundationActorCard('felis', actors.felis)],
    [createLabFoundationActorCard('ursus', actors.ursus)],
    [createLabFoundationActorCard('lupus', actors.lupus)],
    ...existingRest,
  ];
}

function createLabDefaultEnemyFoundationCard(actor: Actor | null): CardType {
  const defaultEnemyDef = getActorDefinition(actor?.definitionId ?? LAB_DEFAULT_ENEMY_DEFINITION_ID);
  const actorId = actor?.id ?? LAB_DEFAULT_ENEMY_DEFINITION_ID;
  return {
    id: `actor-${LAB_DEFAULT_ENEMY_DEFINITION_ID}-lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rank: Math.max(1, Math.min(13, defaultEnemyDef?.value ?? 1)),
    suit: ELEMENT_TO_SUIT.N,
    element: 'N',
    name: defaultEnemyDef?.name ?? 'Enemy',
    description: defaultEnemyDef?.description ?? 'Default combat lab enemy.',
    tags: defaultEnemyDef?.titles?.slice(0, 3) ?? ['Enemy'],
    sourceActorId: actorId,
    rpgActorId: actorId,
    rpgCardKind: 'focus',
  };
}

function findLabDefaultEnemyActor(state: GameState): Actor | null {
  const enemyActors = state.enemyActors ?? [];
  return enemyActors.find((actor) => actor?.definitionId === LAB_DEFAULT_ENEMY_DEFINITION_ID)
    ?? enemyActors.find((actor) => actor?.definitionId === 'target_dummy')
    ?? null;
}

function isActorAlive(actor: Actor | null | undefined): boolean {
  if (!actor) return false;
  // Mirror engine-side combat gating so autoplay/UI targeting never drifts.
  return (actor.hp ?? 0) > 0 && (actor.stamina ?? 0) > 0;
}

function estimateRpgAttackPower(card: CardType): number {
  if (card.id.startsWith('rpg-dark-claw-')) return 4;
  if (card.id.startsWith('rpg-vice-bite-')) return 3.5;
  if (card.id.startsWith('rpg-bite-')) return 2.5;
  if (card.id.startsWith('rpg-blinding-peck-')) return 2;
  if (card.id.startsWith('rpg-peck-')) return 1.6;
  if (card.id.startsWith('rpg-scratch-')) return 1.4;
  return Math.max(1, Number(card.rank ?? 1));
}

function isDirectRpgAttackCard(card: CardType): boolean {
  return (
    card.id.startsWith('rpg-dark-claw-')
    || card.id.startsWith('rpg-scratch-')
    || card.id.startsWith('rpg-bite-')
    || card.id.startsWith('rpg-vice-bite-')
    || card.id.startsWith('rpg-peck-')
    || card.id.startsWith('rpg-blinding-peck-')
    || card.id.startsWith('rpg-cloud-sight-')
  );
}

function summarizeAutoPlayEntry(entry: AutoPlayDecisionEntry): string {
  return `${entry.side}:${entry.kind} · ${entry.label} · ${entry.score.toFixed(1)}${entry.accepted ? '' : ' (blocked)'}`;
}

function createCombatStandardCard(tableauIndex: number, rowIndex: number, depth: number): CardType {
  const element = COMBAT_RANDOM_ELEMENTAL_POOL[Math.floor(Math.random() * COMBAT_RANDOM_ELEMENTAL_POOL.length)];
  const rank = Math.max(1, Math.min(13, Math.floor(Math.random() * 13) + 1));
  return {
    id: `sandbox-random-${tableauIndex}-${rowIndex}-${depth}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rank,
    element,
    suit: ELEMENT_TO_SUIT[element],
    tokenReward: element !== 'N' ? element : undefined,
    rarity: 'common',
  };
}

function createCombatStandardTableaus(): CardType[][] {
  return Array.from({ length: COMBAT_STANDARD_TABLEAU_COUNT }, (_t, tableauIndex) => (
    Array.from({ length: COMBAT_STANDARD_TABLEAU_DEPTH }, (_r, rowIndex) => (
      createCombatStandardCard(tableauIndex, rowIndex, COMBAT_STANDARD_TABLEAU_DEPTH)
    ))
  ));
}

export function CombatSandbox({
  open,
  isLabMode = false,
  gameState,
  actions,
  timeScale,
  timeScaleOptions = DEFAULT_TIME_SCALE_OPTIONS,
  onCycleTimeScale,
  onSetTimeScale,
  isGamePaused,
  onTogglePause,
  highPerformanceTimer = false,
  onClose: _onClose,
  onOpenEditor,
  selectedCard,
  validFoundationsForSelected,
  noValidMoves,
  noValidMovesPlayer,
  noValidMovesEnemy,
  tableauCanPlay,
  hideGameContent = false,
}: CombatSandboxProps) {
  if (!open) return null;

  const { perspectiveEnabled, setCombatLabPerspectiveHotkeyEnabled } = usePerspective();
  useEffect(() => {
    setCombatLabPerspectiveHotkeyEnabled(open && isLabMode);
    return () => setCombatLabPerspectiveHotkeyEnabled(false);
  }, [isLabMode, open, setCombatLabPerspectiveHotkeyEnabled]);

  const activeSide = getCombatActiveSide(gameState);
  const noValidMovesForPlayer = noValidMovesPlayer ?? noValidMoves;
  const noValidMovesForEnemy = noValidMovesEnemy ?? false;
  const combatFlowMode = gameState.combatFlowMode ?? 'turn_based_pressure';
  const enforceTurnOwnership = combatFlowMode === 'turn_based_pressure';
  const turnDurationMs = getCombatTurnDurationMs(gameState, 10000);
  const [localTurnRemainingMs, setLocalTurnRemainingMs] = useState(turnDurationMs);
  const [localTurnTimerActive, setLocalTurnTimerActive] = useState(false);
  const localTurnRemainingRef = useRef(turnDurationMs);
  const displayTurnRemainingRef = useRef(turnDurationMs);
  const playerTurnBarRef = useRef<HTMLDivElement | null>(null);
  const enemyTurnBarRef = useRef<HTMLDivElement | null>(null);
  const [labTurnSide, setLabTurnSide] = useState<'player' | 'enemy'>('player');
  const [pendingTurnSide, setPendingTurnSide] = useState<'player' | 'enemy' | null>(null);
  const [pendingFinalMoveResolution, setPendingFinalMoveResolution] = useState(false);
  const [interTurnCountdownMs, setInterTurnCountdownMs] = useState(0);
  const useLocalTurnSide = isLabMode && enforceTurnOwnership;
  const effectiveActiveSide: 'player' | 'enemy' = useLocalTurnSide ? labTurnSide : activeSide;
  const interTurnCountdownActive = useLocalTurnSide && interTurnCountdownMs > 0;
  const turnRemainingMs = Math.max(0, localTurnRemainingMs);
  const turnProgressPercent = turnDurationMs > 0 ? Math.max(0, Math.min(100, (turnRemainingMs / turnDurationMs) * 100)) : 0;
  const enemyCount = 1;
  const currentDifficulty = gameState.enemyDifficulty ?? 'normal';
  const currentDifficultyIndex = Math.max(0, DIFFICULTY_ORDER.indexOf(currentDifficulty));
  const nextDifficulty = DIFFICULTY_ORDER[(currentDifficultyIndex + 1) % DIFFICULTY_ORDER.length];
  const autoPlayPolicyProfile = AUTO_PLAY_POLICY_BY_DIFFICULTY[currentDifficulty] ?? AUTO_PLAY_POLICY_BY_DIFFICULTY.normal;
  const [configCollapsed, setConfigCollapsed] = useState(true);
  const [atmosphereMenuOpen, setAtmosphereMenuOpen] = useState(false);
  const [selectedAtmosphere, setSelectedAtmosphere] = useState<AtmosphereEffectId>('none');
  const [atmosphereOnlyMode, setAtmosphereOnlyMode] = useState(false);
  const [hudFps, setHudFps] = useState(0);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const [autoPlaySpeedIndex, setAutoPlaySpeedIndex] = useState(1);
  const [autoPlayDeterministic, setAutoPlayDeterministic] = useState(false);
  const [autoPlaySeed, setAutoPlaySeed] = useState(AUTO_PLAY_DEFAULT_SEED);
  const [autoPlayReplayNotice, setAutoPlayReplayNotice] = useState('');
  const [autoPlayStalls, setAutoPlayStalls] = useState(0);
  const [autoPlayLastDecision, setAutoPlayLastDecision] = useState<AutoPlayDecisionEntry | null>(null);
  const [autoPlayTrace, setAutoPlayTrace] = useState<AutoPlayDecisionEntry[]>([]);
  const [handVisible, setHandVisible] = useState(false);
  const [testSequencePanelOpen, setTestSequencePanelOpen] = useState(false);
  const [testSequenceInput, setTestSequenceInput] = useState('25');
  const [testSequenceRunning, setTestSequenceRunning] = useState(false);
  const [testSequenceCompleted, setTestSequenceCompleted] = useState(false);
  const [testSequenceRequestedRuns, setTestSequenceRequestedRuns] = useState(0);
  const [testSequenceCurrentRun, setTestSequenceCurrentRun] = useState(0);
  const [testSequenceResults, setTestSequenceResults] = useState<AutoPlayBatchRunSummary[]>([]);
  const [testSequenceCopyNotice, setTestSequenceCopyNotice] = useState('');
  const [worldEventBanner, setWorldEventBanner] = useState<{ token: string; label: string; detail?: string } | null>(null);
  const [autoPlayDragAnim, setAutoPlayDragAnim] = useState<AutoPlayDragAnim | null>(null);
  const [tappedPlayerFoundations, setTappedPlayerFoundations] = useState<Record<number, boolean>>({});
  const lastProcessedTapActionCountRef = useRef(Math.max(0, Math.floor(Number(gameState.turnCount ?? 0))));
  const autoPlayDragNodeRef = useRef<HTMLDivElement | null>(null);
  const autoPlayDragRafRef = useRef<number>(0);
  const autoPlayDragTimeoutRef = useRef<number>(0);
  const autoPlayDragStartedAtRef = useRef(0);
  const autoPlayDragRemainingMsRef = useRef(0);
  const autoPlayDragPausedTransformRef = useRef<string | null>(null);
  const autoPlayDragTargetTransformRef = useRef<string | null>(null);
  const autoPlayDragAnimIdRef = useRef<string | null>(null);
  const autoPlayDragCompletionRef = useRef<(() => void) | null>(null);
  const autoPlayMoveAuditRef = useRef<AutoPlayMoveAuditEntry[]>([]);
  const worldEventSeenRef = useRef<string>('');
  const labFoundationSeedTokenRef = useRef<string>('');
  const autoPlayStallRef = useRef(0);
  const autoPlayBusyRef = useRef(false);
  const autoPlayRngStateRef = useRef<number>(AUTO_PLAY_DEFAULT_SEED >>> 0);
  const autoPlayReplayStartSnapshotRef = useRef<Partial<GameState> | null>(null);
  const autoPlayWasEnabledRef = useRef(false);
  const testSequenceRunStartedAtRef = useRef<number>(0);
  const testSequenceResetTimeoutRef = useRef<number>(0);
  const testSequenceFinalizedRunRef = useRef<number>(0);
  const testSequenceLastActiveSideRef = useRef<'player' | 'enemy'>('player');
  const testSequenceRunMetricsRef = useRef<AutoPlayBatchRunMetrics>({
    peakLegalPlayerMoves: 0,
    peakLegalEnemyMoves: 0,
    playerCardsPlayed: 0,
    enemyCardsPlayed: 0,
    playerTurnsStarted: 1,
    enemyTurnsStarted: 0,
    observedTurnCounter: 0,
  });
  const resetAutoPlayDeterministicRng = useCallback((seedOverride?: number) => {
    const seedSource = seedOverride ?? autoPlaySeed;
    const normalizedSeed = Math.max(0, Math.floor(Number(seedSource) || 0)) >>> 0;
    autoPlayRngStateRef.current = normalizedSeed;
    return normalizedSeed;
  }, [autoPlaySeed]);
  const showGraphics = useGraphics();
  const tableGlobalScale = useCardScalePreset('board');
  const autoPlayTableauRefsRef = useRef<Record<number, HTMLDivElement | null>>({});
  const autoPlayFoundationRefsRef = useRef<Record<number, HTMLDivElement | null>>({});
  const handZoneRef = useRef<HTMLDivElement | null>(null);
  const previewHandCountRef = useRef(0);
  const [enemySpawnPickerIndex, setEnemySpawnPickerIndex] = useState<number | null>(null);
  const [enemySpawnSelectionByIndex, setEnemySpawnSelectionByIndex] = useState<Record<number, string>>({});
  const enemyActorSpawnOptions = useMemo(() => {
    const nonPartyActors = ACTOR_DEFINITIONS.filter((definition) => definition.type !== 'adventurer');
    const source = nonPartyActors.length > 0 ? nonPartyActors : ACTOR_DEFINITIONS;
    return source.map((definition) => ({
      id: definition.id,
      label: definition.name || definition.id,
    }));
  }, []);
  const getSelectedEnemySpawnId = useCallback((foundationIndex: number) => {
    const saved = enemySpawnSelectionByIndex[foundationIndex];
    if (saved) return saved;
    return enemyActorSpawnOptions.find((entry) => entry.id === LAB_DEFAULT_ENEMY_DEFINITION_ID)?.id
      ?? enemyActorSpawnOptions[0]?.id
      ?? LAB_DEFAULT_ENEMY_DEFINITION_ID;
  }, [enemyActorSpawnOptions, enemySpawnSelectionByIndex]);
  const handleEnemySpawnSelectionChange = useCallback((foundationIndex: number, definitionId: string) => {
    setEnemySpawnSelectionByIndex((prev) => ({
      ...prev,
      [foundationIndex]: definitionId,
    }));
  }, []);
  const handleSpawnEnemyActor = useCallback((foundationIndex: number) => {
    const definitionId = getSelectedEnemySpawnId(foundationIndex);
    if (!definitionId) return;
    actions.spawnEnemyActor(definitionId, foundationIndex);
    setEnemySpawnPickerIndex(null);
  }, [actions, getSelectedEnemySpawnId]);
  const enemyFoundations = useMemo<CardType[][]>(() => {
    const existing = (gameState.enemyFoundations ?? []).map((foundation) => [...foundation]);
    const targetDummyActor = findLabDefaultEnemyActor(gameState);
    const normalized = existing.length > 0
      ? existing
      : [[createLabDefaultEnemyFoundationCard(targetDummyActor)]];
    if (isLabMode) {
      while (normalized.length < ENEMY_FOUNDATION_LAB_SLOT_COUNT) {
        normalized.push([]);
      }
    }
    return normalized;
  }, [gameState.enemyFoundations, gameState.enemyActors, isLabMode]);
  const enemyFoundationCount = enemyFoundations.length;
  const enabledRelicBehaviorIds = useMemo(() => {
    const definitionsById = new Map((gameState.relicDefinitions ?? []).map((definition) => [definition.id, definition]));
    const enabled = new Set<string>();
    for (const instance of gameState.equippedRelics ?? []) {
      if (!instance.enabled) continue;
      const definition = definitionsById.get(instance.relicId);
      if (!definition?.behaviorId) continue;
      enabled.add(definition.behaviorId);
    }
    return enabled;
  }, [gameState.equippedRelics, gameState.relicDefinitions]);
  const finalMoveRelicEnabled = enabledRelicBehaviorIds.has(FINAL_MOVE_RELIC_BEHAVIOR_ID);
  const masterStrategistRelicEnabled = enabledRelicBehaviorIds.has(MASTER_STRATEGIST_RELIC_BEHAVIOR_ID);
  const zenRelicEnabled = enabledRelicBehaviorIds.has(ZEN_RELIC_BEHAVIOR_ID);
  const normalizedTimeScaleOptions = useMemo(() => {
    const source = (timeScaleOptions ?? DEFAULT_TIME_SCALE_OPTIONS).filter((value) => Number.isFinite(value) && value > 0);
    if (source.length === 0) return DEFAULT_TIME_SCALE_OPTIONS;
    return Array.from(new Set(source.map((value) => Number(value)))).sort((a, b) => a - b);
  }, [timeScaleOptions]);
  const autoPlaySpeed = AUTO_PLAY_SPEED_OPTIONS[Math.max(0, Math.min(AUTO_PLAY_SPEED_OPTIONS.length - 1, autoPlaySpeedIndex))];
  const autoPlayStepMs = Math.max(
    45,
    Math.round(AUTO_PLAY_BASE_STEP_MS / Math.max(0.2, autoPlaySpeed * Math.max(0.25, timeScale)))
  );
  const batchFastMode = testSequenceRunning;
  const effectiveAutoPlayStepMs = batchFastMode ? 1 : autoPlayStepMs;
  const shiftTimeScale = useCallback((direction: -1 | 1) => {
    if (normalizedTimeScaleOptions.length === 0) {
      onCycleTimeScale();
      return;
    }
    const currentIdx = normalizedTimeScaleOptions.reduce((bestIndex, value, index) => {
      const bestDistance = Math.abs(normalizedTimeScaleOptions[bestIndex] - timeScale);
      const distance = Math.abs(value - timeScale);
      return distance < bestDistance ? index : bestIndex;
    }, 0);
    const nextIdx = Math.max(0, Math.min(normalizedTimeScaleOptions.length - 1, currentIdx + direction));
    const nextValue = normalizedTimeScaleOptions[nextIdx];
    if (onSetTimeScale) {
      onSetTimeScale(nextValue);
      return;
    }
    if (nextIdx !== currentIdx) {
      onCycleTimeScale();
    }
  }, [normalizedTimeScaleOptions, onCycleTimeScale, onSetTimeScale, timeScale]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'a') return;
      const target = event.target as HTMLElement | null;
      if (
        target
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setAtmosphereMenuOpen((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);
  useEffect(() => {
    if (!open || !isLabMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'p') {
        event.preventDefault();
        setAutoPlayEnabled((prev) => !prev);
        return;
      }
      if (key === 'h') {
        if (previewHandCountRef.current === 0) return;
        event.preventDefault();
        setHandVisible((prev) => !prev);
        return;
      }
      if (event.key === '[') {
        event.preventDefault();
        shiftTimeScale(-1);
        return;
      }
      if (event.key === ']') {
        event.preventDefault();
        shiftTimeScale(1);
        return;
      }
      if (key === 'e') {
        event.preventDefault();
        onOpenEditor?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLabMode, onOpenEditor, open, shiftTimeScale]);
  useEffect(() => {
    if (enemySpawnPickerIndex == null) return;
    if ((enemyFoundations[enemySpawnPickerIndex]?.length ?? 0) > 0) {
      setEnemySpawnPickerIndex(null);
    }
  }, [enemyFoundations, enemySpawnPickerIndex]);
  const showTurnTimer = enforceTurnOwnership && enemyFoundationCount > 0;
  const previewPlayerFoundations = gameState.foundations;
  const activeTileId = getActiveCombatPartyId(gameState);
  const partyActors = activeTileId ? (getPartyAssignments(gameState)[activeTileId] ?? []) : [];
  const playerActorPool = [...partyActors, ...(gameState.availableActors ?? [])];
  const enemyActors = gameState.enemyActors ?? [];
  const getOverlayRankDisplay = (card: CardType | undefined, fallbackRank?: number): string | undefined => {
    const rankCandidate = typeof card?.rank === 'number'
      ? card.rank
      : (typeof fallbackRank === 'number' ? fallbackRank : undefined);
    if (typeof rankCandidate !== 'number' || !Number.isFinite(rankCandidate)) return undefined;
    const normalizedRank = Math.max(0, Math.min(13, Math.round(rankCandidate)));
    return getRankDisplay(normalizedRank);
  };
  const resolvePlayerFoundationActor = (foundationIndex: number, foundationCards: CardType[]): Actor | null => {
    const rootCard = foundationCards[0];
    const rootActorId = rootCard?.sourceActorId ?? rootCard?.rpgActorId;
    if (rootActorId) {
      const byRootId = playerActorPool.find((actor) => actor?.id === rootActorId);
      if (byRootId) return byRootId;
    }
    const inferredDefinitionId = inferFoundationDefinitionId(rootCard);
    if (inferredDefinitionId) {
      const byDefinition = playerActorPool.find((actor) => actor.definitionId === inferredDefinitionId);
      if (byDefinition) return byDefinition;
    }
    return partyActors[foundationIndex] ?? null;
  };
  const resolveEnemyFoundationActor = (foundationIndex: number, foundationCards: CardType[]): Actor | null => {
    const rootCard = foundationCards[0];
    const actorId = rootCard?.sourceActorId ?? rootCard?.rpgActorId;
    const indexedEnemyActor = enemyActors[foundationIndex] ?? null;
    if (!actorId) return indexedEnemyActor;
    return enemyActors.find((actor) => actor?.id === actorId) ?? indexedEnemyActor;
  };
  const handleEnemyFoundationDestructionComplete = useCallback((foundationIndex: number) => {
    actions.cleanupDefeatedEnemies();
  }, [actions]);
  const buildFoundationStatuses = (side: 'player' | 'enemy', foundationIndex: number) => {
    const nowMs = Date.now();
    if (side === 'player') {
      const foundationCards = previewPlayerFoundations[foundationIndex] ?? [];
      const actor = resolvePlayerFoundationActor(foundationIndex, foundationCards);
      return buildActorStatusBadges(gameState, actor, 'player', {
        nowMs,
        requireRpgMode: true,
      });
    }
    const foundationCards = enemyFoundations[foundationIndex] ?? [];
    const actor = resolveEnemyFoundationActor(foundationIndex, foundationCards);
    return buildActorStatusBadges(gameState, actor, 'enemy', {
      nowMs,
      requireRpgMode: true,
    });
  };
  const buildTokenCountsFromCards = (
    foundationCards: CardType[],
    options?: { glowOnly?: boolean }
  ): Partial<Record<Element, number>> => {
    const counts: Partial<Record<Element, number>> = {};
    foundationCards.slice(1).forEach((card) => {
      if (options?.glowOnly) {
        if (isHandOriginCard(card)) return;
        if (card.element === 'N') return;
      }
      const token = card.tokenReward;
      if (typeof token !== 'string') return;
      if (!AP_SEGMENT_ORDER.includes(token as Element)) return;
      counts[token as Element] = (counts[token as Element] ?? 0) + 1;
    });
    return counts;
  };
  const buildApSegments = (
    foundationCards: CardType[],
    tokenCounts?: Partial<Record<Element, number>>
  ): Element[] => {
    const orderedByFoundation = foundationCards
      .slice(1)
      .map((card) => card.tokenReward)
      .filter((element): element is Element => (
        typeof element === 'string'
        && AP_SEGMENT_ORDER.includes(element as Element)
      ));
    if (tokenCounts) {
      const remaining: Partial<Record<Element, number>> = {};
      let remainingTotal = 0;
      AP_SEGMENT_ORDER.forEach((element) => {
        const count = Math.max(0, Math.floor(Number(tokenCounts[element] ?? 0)));
        if (count <= 0) return;
        remaining[element] = count;
        remainingTotal += count;
      });
      if (remainingTotal <= 0) return [];
      const segments: Element[] = [];
      orderedByFoundation.forEach((element) => {
        const count = Math.max(0, Math.floor(Number(remaining[element] ?? 0)));
        if (count <= 0) return;
        segments.push(element);
        remaining[element] = count - 1;
      });
      AP_SEGMENT_ORDER.forEach((element) => {
        const count = Math.max(0, Math.floor(Number(remaining[element] ?? 0)));
        if (count <= 0) return;
        for (let i = 0; i < count; i += 1) segments.push(element);
      });
      return segments;
    }
    return orderedByFoundation;
  };
  const buildFoundationOverlay = (foundationIndex: number) => {
    const foundationCards = previewPlayerFoundations[foundationIndex] ?? [];
    if (foundationCards.length === 0) return undefined;
    const rootCard = foundationCards[0];
    const topCard = foundationCards[foundationCards.length - 1];
    const actor = resolvePlayerFoundationActor(foundationIndex, foundationCards);
    const inferredDefinitionId = inferFoundationDefinitionId(rootCard);
    const actorDefinition = actor
      ? getActorDefinition(actor.definitionId)
      : (inferredDefinitionId ? getActorDefinition(inferredDefinitionId) : null);
    const hpValue = actor
      ? Math.max(0, Math.round(actor.hp))
      : (typeof actorDefinition?.baseHp === 'number' ? Math.max(0, Math.round(actorDefinition.baseHp)) : undefined);
    const hpMaxValue = actor
      ? Math.max(1, Math.round(actor.hpMax))
      : (typeof actorDefinition?.baseHp === 'number' ? Math.max(1, Math.round(actorDefinition.baseHp)) : undefined);
    const armorValue = actor
      ? Math.max(0, Math.round(actor.armor ?? 0))
      : Math.max(0, Math.round(actorDefinition?.baseArmor ?? 0));
    const superArmorValue = actor
      ? Math.max(0, Math.round(actor.superArmor ?? 0))
      : Math.max(0, Math.round(actorDefinition?.baseSuperArmor ?? 0));
    const rankDisplay = getOverlayRankDisplay(
      topCard,
      actor?.currentValue ?? actorDefinition?.value ?? rootCard?.rank
    );
    const fallbackElement = actor?.element ?? actorDefinition?.element ?? rootCard?.element;
    const stateTokenCounts = gameState.foundationTokens?.[foundationIndex];
    const foundationTokenCounts = hasAnyFoundationTokens(stateTokenCounts)
      ? stateTokenCounts
      : buildTokenCountsFromCards(foundationCards);
    const glowTokenCounts = buildTokenCountsFromCards(foundationCards, { glowOnly: true });
    const preferredElement = getPreferredFoundationElement(foundationCards, glowTokenCounts);
    const neonStyle = buildFoundationNeonStyle(
      glowTokenCounts,
      fallbackElement,
      preferredElement
    );
    const name = rootCard?.name?.trim() || actorDefinition?.name || 'Ally';
    return {
      name,
      hp: hpValue,
      hpMax: hpMaxValue,
      armor: armorValue,
      superArmor: superArmorValue,
      rankDisplay,
      apSegments: buildApSegments(foundationCards, foundationTokenCounts),
      apCount: Math.max(0, Math.round(actor?.power ?? 0)),
      shimmerElement: preferredElement ?? fallbackElement,
      accentColor: neonStyle.color ?? DEFAULT_PLAYER_FOUNDATION_GLOW,
    };
  };
  const buildEnemyFoundationOverlay = (foundationIndex: number) => {
    const foundationCards = enemyFoundations[foundationIndex] ?? [];
    if (foundationCards.length === 0) return undefined;
    const rootCard = foundationCards[0];
    const topCard = foundationCards[foundationCards.length - 1];
    const enemyActor = resolveEnemyFoundationActor(foundationIndex, foundationCards);
    const actorDefinition = enemyActor
      ? getActorDefinition(enemyActor.definitionId)
      : getActorDefinition(LAB_DEFAULT_ENEMY_DEFINITION_ID);
    const hpValue = enemyActor
      ? Math.max(0, Math.round(enemyActor.hp))
      : (typeof actorDefinition?.baseHp === 'number' ? Math.max(0, Math.round(actorDefinition.baseHp)) : undefined);
    const hpMaxValue = enemyActor
      ? Math.max(1, Math.round(enemyActor.hpMax))
      : (typeof actorDefinition?.baseHp === 'number' ? Math.max(1, Math.round(actorDefinition.baseHp)) : undefined);
    const armorValue = enemyActor
      ? Math.max(0, Math.round(enemyActor.armor ?? 0))
      : Math.max(0, Math.round(actorDefinition?.baseArmor ?? 0));
    const superArmorValue = enemyActor
      ? Math.max(0, Math.round(enemyActor.superArmor ?? 0))
      : Math.max(0, Math.round(actorDefinition?.baseSuperArmor ?? 0));
    const rankDisplay = getOverlayRankDisplay(
      topCard,
      enemyActor?.currentValue ?? actorDefinition?.value ?? rootCard?.rank
    );
    const fallbackElement = enemyActor?.element ?? actorDefinition?.element ?? rootCard?.element;
    const stateTokenCounts = gameState.enemyFoundationTokens?.[foundationIndex];
    const foundationTokenCounts = hasAnyFoundationTokens(stateTokenCounts)
      ? stateTokenCounts
      : buildTokenCountsFromCards(foundationCards);
    const glowTokenCounts = buildTokenCountsFromCards(foundationCards, { glowOnly: true });
    const preferredElement = getPreferredFoundationElement(foundationCards, glowTokenCounts);
    const neonStyle = buildFoundationNeonStyle(
      glowTokenCounts,
      fallbackElement,
      preferredElement
    );
    const name = rootCard.name?.trim() || actorDefinition?.name || 'Enemy';
    return {
      name,
      hp: hpValue,
      hpMax: hpMaxValue,
      armor: armorValue,
      superArmor: superArmorValue,
      rankDisplay,
      apSegments: buildApSegments(foundationCards, foundationTokenCounts),
      apCount: Math.max(0, Math.round(enemyActor?.power ?? 0)),
      shimmerElement: preferredElement ?? fallbackElement,
      accentColor: neonStyle.color ?? DEFAULT_ENEMY_FOUNDATION_GLOW,
    };
  };
  const playerFoundationNeonStyles = useMemo(() => (
    previewPlayerFoundations.map((foundationCards, foundationIndex) => {
      const rootCard = foundationCards[0];
      const rootActorId = rootCard?.sourceActorId ?? rootCard?.rpgActorId;
      const inferredDefinitionId = inferFoundationDefinitionId(rootCard);
      const actor = rootActorId
        ? (playerActorPool.find((entry) => entry?.id === rootActorId) ?? null)
        : (
          inferredDefinitionId
            ? (playerActorPool.find((entry) => entry.definitionId === inferredDefinitionId) ?? null)
            : null
        );
      const actorDefinition = actor
        ? getActorDefinition(actor.definitionId)
        : (inferredDefinitionId ? getActorDefinition(inferredDefinitionId) : null);
      const fallbackElement = actor?.element ?? actorDefinition?.element ?? rootCard?.element;
      const glowTokenCounts = buildTokenCountsFromCards(foundationCards, { glowOnly: true });
      const preferredElement = getPreferredFoundationElement(foundationCards, glowTokenCounts);
      return buildFoundationNeonStyle(
        glowTokenCounts,
        fallbackElement,
        preferredElement
      );
    })
  ), [previewPlayerFoundations, gameState.foundationTokens, playerActorPool]);
  const enemyFoundationNeonStyles = useMemo(() => (
    enemyFoundations.map((foundationCards, foundationIndex) => {
      const rootCard = foundationCards[0];
      const actorId = rootCard?.sourceActorId ?? rootCard?.rpgActorId;
      const indexedEnemyActor = enemyActors[foundationIndex] ?? null;
      const enemyActor = actorId
        ? (enemyActors.find((entry) => entry?.id === actorId) ?? indexedEnemyActor)
        : indexedEnemyActor;
      const actorDefinition = enemyActor
        ? getActorDefinition(enemyActor.definitionId)
        : getActorDefinition(LAB_DEFAULT_ENEMY_DEFINITION_ID);
      const fallbackElement = enemyActor?.element ?? actorDefinition?.element ?? rootCard?.element;
      const glowTokenCounts = buildTokenCountsFromCards(foundationCards, { glowOnly: true });
      const preferredElement = getPreferredFoundationElement(foundationCards, glowTokenCounts);
      return buildFoundationNeonStyle(
        glowTokenCounts,
        fallbackElement,
        preferredElement
      );
    })
  ), [enemyFoundations, gameState.enemyFoundationTokens, enemyActors]);
  const abilityCatalogById = useMemo(() => {
    const rows = (abilitiesJson as { abilities?: AbilityCatalogEntry[] }).abilities ?? [];
    return new Map(
      rows
        .filter((entry) => typeof entry.id === 'string' && entry.id.length > 0)
        .map((entry) => [entry.id as string, entry])
    );
  }, []);
  const isDeadRunOnlyAbilityCard = useCallback((card: CardType): boolean => {
    const abilityId = card.rpgAbilityId;
    if (!abilityId) return false;
    const definition = gameState.orimDefinitions.find((entry) => entry.id === abilityId);
    const catalog = abilityCatalogById.get(abilityId);
    const effects = definition?.effects ?? catalog?.effects ?? [];
    const hasDeadRunOnlyEffect = effects.some((effect) => !!effect?.deadRunOnly);
    const triggers = definition?.triggers ?? catalog?.triggers ?? [];
    const hasDeadTableauTrigger = triggers.some((trigger) => {
      const triggerType = normalizeAbilityTriggerType(trigger?.type);
      return triggerType === 'noValidMovesPlayer' || triggerType === 'noValidMovesEnemy';
    });
    return hasDeadRunOnlyEffect || hasDeadTableauTrigger;
  }, [abilityCatalogById, gameState.orimDefinitions]);
  const areAbilityTriggersSatisfied = useCallback((
    triggers: AbilityCatalogEntry['triggers'],
    sourceActorId: string,
    sourceFoundationIndex: number
  ): boolean => {
    if (!triggers || triggers.length === 0) return true;
    const playerCombos = gameState.foundationCombos ?? [];
    const enemyCombos = gameState.enemyFoundationCombos ?? [];
    const playerPartyCombo = playerCombos.reduce((sum, value) => sum + Math.max(0, Number(value ?? 0)), 0);
    const enemyPartyCombo = enemyCombos.reduce((sum, value) => sum + Math.max(0, Number(value ?? 0)), 0);
    const sourceActor = playerActorPool.find((actor) => actor.id === sourceActorId) ?? null;
    const sourceAp = Math.max(0, Number(sourceActor?.power ?? 0));
    const enemyMaxAp = enemyActors.reduce((max, actor) => Math.max(max, Math.max(0, Number(actor?.power ?? 0))), 0);
    const playerPartyAp = playerActorPool.reduce((sum, actor) => sum + Math.max(0, Number(actor?.power ?? 0)), 0);
    const enemyPartyAp = enemyActors.reduce((sum, actor) => sum + Math.max(0, Number(actor?.power ?? 0)), 0);
    const playerActorIds = playerActorPool.map((actor) => actor.id);
    const enemyActorIds = enemyActors.map((actor) => actor.id);
    const getActorDiscardCount = (actorId: string): number => Math.max(0, Number(gameState.rpgDiscardPilesByActor?.[actorId]?.length ?? 0));
    const getActorActiveDeckCount = (actorId: string): number => {
      const cards = gameState.actorDecks[actorId]?.cards ?? [];
      return cards.filter((card) => card.discarded !== true).length;
    };
    const nowMs = Date.now();
    const evaluateActorTrigger = (
      type: string,
      actor: Actor | null,
      triggerValue: number,
      triggerOperator: '<' | '<=' | '>' | '>=' | '=' | '!='
    ): boolean => {
      if (!actor) return false;
      const hp = Math.max(0, Number(actor.hp ?? 0));
      const hpMax = Math.max(1, Number(actor.hpMax ?? 1));
      if (type === 'below_hp_pct') {
        const pct = (hp / hpMax) * 100;
        return compareAbilityTriggerMetric(pct, triggerValue, triggerOperator);
      }
      if (type === 'ko' || type === 'on_death') {
        return hp <= 0;
      }
      if (type === 'has_armor') {
        return Math.max(0, Number(actor.armor ?? 0)) > 0;
      }
      if (type === 'has_super_armor') {
        return Math.max(0, Number(actor.superArmor ?? 0)) > 0;
      }
      if (type === 'inactive_duration') {
        const lastPlayedAt = gameState.rpgLastCardPlayedAtByActor?.[actor.id];
        if (!lastPlayedAt || !Number.isFinite(lastPlayedAt)) return false;
        return compareAbilityTriggerMetric(nowMs - lastPlayedAt, triggerValue * 1000, triggerOperator);
      }
      if (type === 'is_stunned') {
        return false;
      }
      return false;
    };
    return triggers.every((trigger) => {
      const type = normalizeAbilityTriggerType(trigger?.type);
      if (!type) return true;
      if (type === 'noValidMovesPlayer') {
        return noValidMovesForPlayer;
      }
      if (type === 'noValidMovesEnemy') {
        return noValidMovesForEnemy;
      }
      if (type === 'notDiscarded') {
        return true;
      }
      const target = (trigger?.target ?? 'self');
      const triggerOperatorRaw = normalizeAbilityTriggerOperator(trigger?.operator);
      const triggerOperator = (() => {
        if (type === 'below_hp_pct') return trigger?.operator ? triggerOperatorRaw : '<=';
        if (type === 'inactive_duration') return trigger?.operator ? triggerOperatorRaw : '>=';
        if (type === 'combo_personal' || type === 'combopersonal' || type === 'combo_party' || type === 'comboparty') {
          return trigger?.operator ? triggerOperatorRaw : '>=';
        }
        if (type === 'foundationDiscardCount' || type === 'partyDiscardCount' || type === 'foundationActiveDeckCount' || type === 'actorActiveDeckCount') {
          return trigger?.operator ? triggerOperatorRaw : '>=';
        }
        return triggerOperatorRaw;
      })();
      const triggerValueRaw = Number(trigger?.value ?? (type === 'below_hp_pct' ? 10 : 1));
      const triggerValue = Number.isFinite(triggerValueRaw)
        ? Math.max(0, Math.floor(triggerValueRaw))
        : 1;
      if (type === 'combo_personal' || type === 'combopersonal') {
        const playerPersonal = Math.max(0, Number(playerCombos[sourceFoundationIndex] ?? 0));
        const enemyPersonalHit = enemyCombos.some((value) => Math.max(0, Number(value ?? 0)) >= triggerValue);
        const selfMetric = Math.max(playerPersonal, sourceAp);
        const enemyMetric = Math.max(
          enemyPersonalHit ? triggerValue : 0,
          Math.max(0, enemyMaxAp)
        );
        if (target === 'self') return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator);
        if (target === 'enemy') return compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
        return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      }
      if (type === 'combo_party' || type === 'comboparty') {
        const selfMetric = Math.max(playerPartyCombo, playerPartyAp);
        const enemyMetric = Math.max(enemyPartyCombo, enemyPartyAp);
        if (target === 'self') return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator);
        if (target === 'enemy') return compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
        return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      }
      if (type === 'foundationDiscardCount') {
        const selfMetric = getActorDiscardCount(sourceActorId);
        const enemyMetric = enemyActorIds.reduce((max, actorId) => Math.max(max, getActorDiscardCount(actorId)), 0);
        if (target === 'self') return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator);
        if (target === 'enemy') return compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
        return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      }
      if (type === 'partyDiscardCount') {
        const selfMetric = playerActorIds.reduce((sum, actorId) => sum + getActorDiscardCount(actorId), 0);
        const enemyMetric = enemyActorIds.reduce((sum, actorId) => sum + getActorDiscardCount(actorId), 0);
        if (target === 'self') return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator);
        if (target === 'enemy') return compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
        return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      }
      if (type === 'foundationActiveDeckCount' || type === 'actorActiveDeckCount') {
        const selfMetric = getActorActiveDeckCount(sourceActorId);
        const enemyMetric = enemyActorIds.reduce((max, actorId) => Math.max(max, getActorActiveDeckCount(actorId)), 0);
        if (target === 'self') return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator);
        if (target === 'enemy') return compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
        return compareAbilityTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareAbilityTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      }
      const enemyHit = enemyActors.some((actor) => evaluateActorTrigger(type, actor ?? null, triggerValue, triggerOperator));
      const selfHit = evaluateActorTrigger(type, sourceActor, triggerValue, triggerOperator);
      if (target === 'self') return selfHit;
      if (target === 'enemy') return enemyHit;
      return selfHit || enemyHit;
    });
  }, [
    gameState.actorDecks,
    enemyActors,
    gameState.enemyFoundationCombos,
    gameState.foundationCombos,
    gameState.rpgDiscardPilesByActor,
    gameState.rpgLastCardPlayedAtByActor,
    noValidMovesForEnemy,
    noValidMovesForPlayer,
    playerActorPool,
  ]);
  const deckBackedLabHandCards = useMemo<CardType[]>(() => {
    if (!isLabMode) return [];
    const foundations = gameState.foundations ?? [];
    const tileId = getActiveCombatPartyId(gameState);
    const party = tileId ? (getPartyAssignments(gameState)[tileId] ?? []) : [];
    const actorPool = [...party, ...(gameState.availableActors ?? [])];
    const usedActorIds = new Set<string>();
    const actorIdsFromFoundations = foundations.map((foundation, index) => {
      const fromFoundation = foundation[0]?.sourceActorId ?? foundation[0]?.rpgActorId;
      if (typeof fromFoundation === 'string' && fromFoundation.length > 0) {
        usedActorIds.add(fromFoundation);
        return fromFoundation;
      }
      const foundationName = String(foundation[0]?.name ?? '').trim().toLowerCase();
      if (foundationName) {
        const matchedByName = actorPool.find((actor) => {
          if (usedActorIds.has(actor.id)) return false;
          if (!gameState.actorDecks[actor.id]) return false;
          const definition = getActorDefinition(actor.definitionId);
          return String(definition?.name ?? '').trim().toLowerCase() === foundationName;
        });
        if (matchedByName) {
          usedActorIds.add(matchedByName.id);
          return matchedByName.id;
        }
      }
      const byIndex = party[index]?.id;
      if (byIndex && !usedActorIds.has(byIndex) && !!gameState.actorDecks[byIndex]) {
        usedActorIds.add(byIndex);
        return byIndex;
      }
      const nextUnused = actorPool.find((actor) => !usedActorIds.has(actor.id) && !!gameState.actorDecks[actor.id]);
      if (nextUnused) {
        usedActorIds.add(nextUnused.id);
        return nextUnused.id;
      }
      return undefined;
    }).filter((actorId): actorId is string => typeof actorId === 'string' && actorId.length > 0);
    const actorIds = actorIdsFromFoundations.length > 0 ? actorIdsFromFoundations : party.map((actor) => actor.id);
    const candidates: Array<{ card: CardType; deadRunOnly: boolean }> = [];
    actorIds.forEach((actorId, index) => {
      if (index < 0 || index >= foundations.length) return;
      const foundationCard = foundations[index]?.[0];
      const inferredDefinitionId = inferFoundationDefinitionId(foundationCard)
        ?? actorPool.find((actor) => actor?.id === actorId)?.definitionId
        ?? null;
      const deck = gameState.actorDecks[actorId]
        ?? (inferredDefinitionId
          ? createActorDeckStateWithOrim(actorId || `lab-${inferredDefinitionId}`, inferredDefinitionId, gameState.orimDefinitions).deck
          : undefined);
      if (!deck) return;
      const hasConfiguredSkittishCard = deck.cards.some((deckCard) => {
        const slotWithOrim = deckCard.slots.find((slot) => !!slot.orimId);
        const slotAbilityId = resolveOrimDefinitionIdFromSlot(
          slotWithOrim?.orimId,
          gameState.orimInstances,
          gameState.orimDefinitions
        );
        return slotAbilityId === 'skittish_scurry';
      });
      const nowMs = Date.now();
      deck.cards.forEach((deckCard, deckCardIndex) => {
        if (deckCard.active === false) return;
        const slotWithOrim = deckCard.slots.find((slot) => !!slot.orimId);
        const slotOrimId = slotWithOrim?.orimId;
        const inferredDefinitionId = resolveOrimDefinitionIdFromSlot(
          slotOrimId,
          gameState.orimInstances,
          gameState.orimDefinitions
        );
        const definition = inferredDefinitionId
          ? gameState.orimDefinitions.find((entry) => entry.id === inferredDefinitionId)
          : undefined;
        const catalogAbility = inferredDefinitionId ? abilityCatalogById.get(inferredDefinitionId) : undefined;
        const lifecycle = definition?.lifecycle ?? catalogAbility?.lifecycle;
        if (!canUseDeckCardLifecycleForPreview(gameState, deckCard.id, lifecycle)) return;
        const abilityEffects = definition?.effects ?? catalogAbility?.effects ?? [];
        const abilityTriggers = definition?.triggers ?? catalogAbility?.triggers ?? [];
        const nonNotDiscardedTriggers = abilityTriggers.filter((trigger) => (
          normalizeAbilityTriggerType(trigger?.type) !== 'notDiscarded'
        ));
        const notDiscardedTrigger = abilityTriggers.find((trigger) => (
          normalizeAbilityTriggerType(trigger?.type) === 'notDiscarded'
        ));
        if (deckCard.discarded) {
          if (!deckCard.notDiscarded) return;
          const countdownType = (String(notDiscardedTrigger?.countdownType ?? 'combo').trim().toLowerCase() === 'seconds')
            ? 'seconds'
            : 'combo';
          const countdownValueRaw = Number(notDiscardedTrigger?.countdownValue ?? 0);
          const countdownValue = Number.isFinite(countdownValueRaw) ? Math.max(0, Math.floor(countdownValueRaw)) : 0;
          const cooldownReady = (() => {
            if (countdownType === 'seconds') {
              const discardedAtMs = Number(deckCard.discardedAtMs ?? 0);
              if (!discardedAtMs || !Number.isFinite(discardedAtMs)) return countdownValue <= 0;
              return (nowMs - discardedAtMs) >= (countdownValue * 1000);
            }
            const actorComboNow = Math.max(0, Number(gameState.actorCombos?.[actorId] ?? 0));
            const comboAtDiscard = Math.max(0, Number(deckCard.discardedAtCombo ?? actorComboNow));
            return (actorComboNow - comboAtDiscard) >= countdownValue;
          })();
          if (!cooldownReady) return;
          if (!areAbilityTriggersSatisfied(nonNotDiscardedTriggers, actorId, index)) return;
        } else if (!areAbilityTriggersSatisfied(nonNotDiscardedTriggers, actorId, index)) {
          return;
        }
        const isDeadRunOnly = abilityEffects.some((effect) => effect?.deadRunOnly)
          || nonNotDiscardedTriggers.some((trigger) => {
            const triggerType = normalizeAbilityTriggerType(trigger?.type);
            return triggerType === 'noValidMovesPlayer' || triggerType === 'noValidMovesEnemy';
          });
        const element = definition?.elements?.[0] ?? catalogAbility?.element ?? 'N';
        const resolvedName = definition?.name
          ?? catalogAbility?.label
          ?? (inferredDefinitionId ? inferredDefinitionId.replace(/[_-]+/g, ' ') : `${actorId} ability`);
        const resolvedDescription = definition?.description ?? catalogAbility?.description;
        const resolvedRarity = (definition?.rarity ?? catalogAbility?.rarity ?? 'common') as OrimRarity;
        const resolvedCost = resolveDeckCardApCost(deckCard, resolvedRarity);
        candidates.push({
          deadRunOnly: isDeadRunOnly,
          card: {
          id: `lab-deck-${actorId}-${index}-${deckCard.id}-${deckCardIndex}`,
          rank: Math.max(1, Math.min(13, deckCard.value)),
          element,
          suit: ELEMENT_TO_SUIT[element],
          rarity: resolvedRarity,
          sourceActorId: actorId,
          sourceDeckCardId: deckCard.id,
          cooldown: deckCard.cooldown,
          maxCooldown: deckCard.maxCooldown,
          rpgApCost: resolvedCost,
          rpgTurnPlayability: deckCard.turnPlayability ?? 'player',
          rpgAbilityId: definition?.id ?? inferredDefinitionId,
          name: resolvedName,
          description: resolvedDescription,
          orimSlots: deckCard.slots.map((slot) => ({ ...slot })),
          },
        });
      });
      if (inferredDefinitionId === 'felis' && !hasConfiguredSkittishCard) {
        const hasSkittishReadyCard = candidates.some((entry) => (
          entry.card.sourceActorId === actorId
          && entry.card.rpgAbilityId === 'skittish_scurry'
          && (entry.card.cooldown ?? 0) <= 0
        ));
        if (!hasSkittishReadyCard) {
          const skittishDefinition = gameState.orimDefinitions.find((entry) => entry.id === 'skittish_scurry');
          const skittishCatalog = abilityCatalogById.get('skittish_scurry');
          const element = skittishDefinition?.elements?.[0] ?? skittishCatalog?.element ?? 'N';
          candidates.push({
            deadRunOnly: true,
            card: {
              id: `lab-deck-${actorId}-${index}-fallback-skittish_scurry`,
              rank: 1,
              element,
              suit: ELEMENT_TO_SUIT[element],
              rarity: (skittishDefinition?.rarity ?? skittishCatalog?.rarity ?? 'common') as CardType['rarity'],
              sourceActorId: actorId,
              sourceDeckCardId: `fallback-skittish-scurry-${actorId}`,
              cooldown: 0,
              maxCooldown: 0,
              rpgApCost: 0,
              rpgTurnPlayability: 'player',
              rpgAbilityId: 'skittish_scurry',
              name: skittishDefinition?.name ?? skittishCatalog?.label ?? 'Skittish Scurry',
              description: skittishDefinition?.description ?? skittishCatalog?.description ?? 'Shuffle and redeal the entire tableau.',
              orimSlots: [],
            },
          });
        }
      }
    });

    const deadRunActive = effectiveActiveSide === 'player' && noValidMovesForPlayer;
    const cards = candidates
      .filter((entry) => !entry.deadRunOnly || deadRunActive)
      .map((entry) => entry.card);

    const seenIds = new Map<string, number>();
    return cards.map((card) => {
      const currentCount = seenIds.get(card.id) ?? 0;
      seenIds.set(card.id, currentCount + 1);
      if (currentCount === 0) return card;
      return {
        ...card,
        id: `${card.id}-dup-${currentCount}`,
      };
    });
  }, [
    isLabMode,
    gameState.activeCombatPartyId,
    gameState.partyAssignments,
    gameState.availableActors,
    gameState.actorCombos,
    gameState.foundations,
    gameState.actorDecks,
    gameState.abilityLifecycleUsageByDeckCard,
    gameState.orimInstances,
    gameState.orimDefinitions,
    gameState.lifecycleTurnCounter,
    gameState.lifecycleBattleCounter,
    gameState.lifecycleRestCounter,
    gameState.lifecycleRunCounter,
    abilityCatalogById,
    areAbilityTriggersSatisfied,
    effectiveActiveSide,
    noValidMovesForPlayer,
  ]);
  const previewHandCards = useMemo<CardType[]>(() => {
    if (!isLabMode) return gameState.rpgHandCards ?? [];
    if (deckBackedLabHandCards.length === 0) return gameState.rpgHandCards ?? [];
    const deckIds = new Set(deckBackedLabHandCards.map((card) => card.id));
    const deckCardKeys = new Set(deckBackedLabHandCards.map((card) => (
      `${card.sourceActorId ?? ''}|${card.sourceDeckCardId ?? ''}|${card.rpgAbilityId ?? ''}`
    )));
    const deckActorAbilityKeys = new Set(deckBackedLabHandCards.map((card) => (
      `${card.sourceActorId ?? ''}|${card.rpgAbilityId ?? ''}`
    )));
    const runtimeExtras = (gameState.rpgHandCards ?? []).filter((card) => {
      if (deckIds.has(card.id)) return false;
      const cardKey = `${card.sourceActorId ?? ''}|${card.sourceDeckCardId ?? ''}|${card.rpgAbilityId ?? ''}`;
      const actorAbilityKey = `${card.sourceActorId ?? ''}|${card.rpgAbilityId ?? ''}`;
      const looksDeckBacked = !!card.sourceActorId && (!!card.sourceDeckCardId || !!card.rpgAbilityId);
      if (looksDeckBacked && card.sourceActorId && card.sourceDeckCardId) {
        const sourceDeck = gameState.actorDecks[card.sourceActorId];
        const sourceDeckCard = sourceDeck?.cards.find((entry) => entry.id === card.sourceDeckCardId);
        if (sourceDeckCard) {
          if (sourceDeckCard.active === false || sourceDeckCard.discarded) {
            return false;
          }
          if (!deckCardKeys.has(cardKey)) {
            return false;
          }
        }
      }
      if (looksDeckBacked && (deckCardKeys.has(cardKey) || deckActorAbilityKeys.has(actorAbilityKey))) {
        return false;
      }
      if (isDeadRunOnlyAbilityCard(card) && !noValidMovesForPlayer) {
        return false;
      }
      return true;
    });
    return [...deckBackedLabHandCards, ...runtimeExtras];
  }, [isLabMode, deckBackedLabHandCards, gameState.rpgHandCards, gameState.actorDecks, isDeadRunOnlyAbilityCard, noValidMovesForPlayer]);
  useEffect(() => {
    previewHandCountRef.current = previewHandCards.length;
  }, [previewHandCards.length]);
  useEffect(() => {
    if (previewHandCards.length > 0) return;
    setHandVisible(false);
  }, [previewHandCards.length]);
  const actorApById = useMemo(() => {
    const ap = new Map<string, number>();
    const tileId = getActiveCombatPartyId(gameState);
    const party = tileId ? (getPartyAssignments(gameState)[tileId] ?? []) : [];
    const pool = [...party, ...(gameState.availableActors ?? [])];
    pool.forEach((actor) => {
      // Prefer active party values when duplicate actor ids exist in availableActors.
      if (ap.has(actor.id)) return;
      ap.set(actor.id, Math.max(0, Number(actor.power ?? 0)));
    });
    return ap;
  }, [gameState.activeCombatPartyId, gameState.partyAssignments, gameState.availableActors]);
  const isHandCardPlayable = useCallback((card: CardType) => {
    if (interTurnCountdownActive) return false;
    if (enforceTurnOwnership) {
      const turnPlayable = canPlayCardOnTurn(card, effectiveActiveSide, true);
      const legacyInterruptOverride = effectiveActiveSide === 'enemy'
        && getCardTurnPlayability(card) === null
        && isInterruptHandCard(card);
      if (!turnPlayable && !legacyInterruptOverride) return false;
    }
    if ((card.cooldown ?? 0) > 0) return false;
    if (card.sourceDeckCardId) {
      const lifecycleAbilityId = card.rpgAbilityId;
      const definition = lifecycleAbilityId
        ? gameState.orimDefinitions.find((entry) => entry.id === lifecycleAbilityId)
        : undefined;
      const lifecycle = definition?.lifecycle ?? (lifecycleAbilityId ? abilityCatalogById.get(lifecycleAbilityId)?.lifecycle : undefined);
      if (!canUseDeckCardLifecycleForPreview(gameState, card.sourceDeckCardId, lifecycle)) return false;
    }
    const cost = Math.max(0, Number(card.rpgApCost ?? 0));
    if (cost <= 0) return true;
    if (!card.sourceActorId) return false;
    const actorAp = actorApById.get(card.sourceActorId) ?? 0;
    return actorAp >= cost;
  }, [abilityCatalogById, actorApById, effectiveActiveSide, enforceTurnOwnership, gameState, interTurnCountdownActive]);
  const getHandCardLockReason = useCallback((card: CardType): string | undefined => {
    if (interTurnCountdownActive) return 'Inter-turn countdown';
    if (enforceTurnOwnership) {
      const turnPlayable = canPlayCardOnTurn(card, effectiveActiveSide, true);
      const legacyInterruptOverride = effectiveActiveSide === 'enemy'
        && getCardTurnPlayability(card) === null
        && isInterruptHandCard(card);
      if (!turnPlayable && !legacyInterruptOverride) {
        return effectiveActiveSide === 'enemy' ? 'Enemy turn only' : 'Player turn only';
      }
    }
    if ((card.cooldown ?? 0) > 0) {
      return `Cooldown ${Math.max(0, Number(card.cooldown ?? 0))}`;
    }
    if (card.sourceDeckCardId) {
      const lifecycleAbilityId = card.rpgAbilityId;
      const definition = lifecycleAbilityId
        ? gameState.orimDefinitions.find((entry) => entry.id === lifecycleAbilityId)
        : undefined;
      const lifecycle = definition?.lifecycle ?? (lifecycleAbilityId ? abilityCatalogById.get(lifecycleAbilityId)?.lifecycle : undefined);
      if (lifecycle && !canUseDeckCardLifecycleForPreview(gameState, card.sourceDeckCardId, lifecycle)) {
        const normalized = normalizeLifecycleForPreview(lifecycle);
        const usage = gameState.abilityLifecycleUsageByDeckCard?.[card.sourceDeckCardId];
        if (normalized.cooldownMode === 'turns' && normalized.cooldownValue > 0) {
          const readyAt = Math.max(0, Number(usage?.turnCooldownReadyAt ?? 0));
          const remaining = Math.max(0, readyAt - getLifecycleCounterForPreview(gameState, 'turn'));
          if (remaining > 0) return `Ready in ${remaining} turn${remaining === 1 ? '' : 's'}`;
        }
        if (normalized.exhaustScope !== 'none' && normalized.maxUsesPerScope > 0) {
          const scopeCounter = getLifecycleCounterForPreview(gameState, normalized.exhaustScope);
          const used = getLifecycleScopeUsageForPreview(usage, normalized.exhaustScope, scopeCounter);
          if (used >= normalized.maxUsesPerScope) {
            return `Exhausted (${normalized.exhaustScope})`;
          }
        }
        return 'Lifecycle locked';
      }
    }
    const cost = Math.max(0, Number(card.rpgApCost ?? 0));
    if (cost > 0) {
      if (!card.sourceActorId) return 'No source actor';
      const actorAp = actorApById.get(card.sourceActorId) ?? 0;
      if (actorAp < cost) return `Need ${cost} AP`;
    }
    return undefined;
  }, [
    abilityCatalogById,
    actorApById,
    effectiveActiveSide,
    enforceTurnOwnership,
    gameState,
    interTurnCountdownActive,
  ]);
  const previewTableauCardScale = 0.98;
  const secondaryTableauCardScale = Math.round(previewTableauCardScale * 0.9 * 1000) / 1000;
  const previewHandCardScale = 1;
  const previewTableauHeight = Math.round(CARD_SIZE.height * previewTableauCardScale);
  const previewFoundationWidth = Math.round(CARD_SIZE.width * 1.2);
  const [fallbackTableaus, setFallbackTableaus] = useState<CardType[][]>(() => createCombatStandardTableaus());
  const gameTableaus = gameState.tableaus ?? [];
  const hasRenderableGameTableaus = gameTableaus.length > 0 && gameTableaus.some((tableau) => tableau.length > 0);
  const previewTableaus = hasRenderableGameTableaus ? gameTableaus : fallbackTableaus;
  const toCardSignature = useCallback((card: CardType): string => (
    card.id
    ?? `${card.rank}-${card.suit}-${card.element ?? 'N'}-${card.sourceActorId ?? ''}`
  ), []);
  const toTableauSignature = useCallback((tableaus: CardType[][]): string => (
    tableaus
      .map((tableau) => tableau.map((card) => toCardSignature(card)).join(','))
      .join('|')
  ), [toCardSignature]);
  const gameTableauSignature = useMemo(() => toTableauSignature(gameTableaus), [gameTableaus, toTableauSignature]);
  const labFoundationActors = useMemo(
    () => resolveLabFoundationActors({ partyAssignments: gameState.partyAssignments, availableActors: gameState.availableActors }),
    [gameState.availableActors, gameState.partyAssignments]
  );
  const previewTableauShapeSignature = useMemo(
    () => previewTableaus.map((tableau) => tableau.length).join(','),
    [previewTableaus]
  );
  const previewFoundationShapeSignature = useMemo(
    () => previewPlayerFoundations.map((foundation) => foundation.length).join(','),
    [previewPlayerFoundations]
  );
  // Enemy uses the same shared tableau; no separate enemy tableau cards.
  const foundationIndexes = [0, 1, 2];
  const enemyFoundationIndexes = isLabMode ? [1, 0, 2] : [0];
  const enemyFoundationDropBase = foundationIndexes.length;
  const [autoFitMultiplier, setAutoFitMultiplier] = useState(1);
  const draggedHandCardRef = useRef<CardType | null>(null);
  const fitViewportRef = useRef<HTMLDivElement | null>(null);
  const fitContentRef = useRef<HTMLDivElement | null>(null);
  const tableauBandRef = useRef<HTMLDivElement | null>(null);
  const autoFitMultiplierRef = useRef(1);
  const localTurnTickRef = useRef(performance.now());
  const lastTurnCardCountsRef = useRef({ player: 0, enemy: 0 });
  const frameDeltaSamplesRef = useRef<number[]>([]);
  const rpgTickDurationSamplesRef = useRef<number[]>([]);
  const dropTotalDurationSamplesRef = useRef<number[]>([]);
  const dropActionDurationSamplesRef = useRef<number[]>([]);
  const reactCommitDurationSamplesRef = useRef<number[]>([]);
  const longTaskDurationSamplesRef = useRef<number[]>([]);
  const [perfSnapshot, setPerfSnapshot] = useState({
    fpsAvg: 0,
    fpsP95: 0,
    fpsWorst: 0,
    dragMoveP95: 0,
    dragMoveAvg: 0,
    dragEndP95: 0,
    dropTotalP95: 0,
    dropActionP95: 0,
    rpgTickP95: 0,
    reactCommitP95: 0,
    longTaskP95: 0,
    longTaskMax: 0,
  });
  const [perfCaptureNotice, setPerfCaptureNotice] = useState('');
  const handleSandboxProfilerRender = useCallback((
    _id: string,
    _phase: string,
    actualDuration: number
  ) => {
    pushPerfSample(reactCommitDurationSamplesRef.current, actualDuration);
  }, []);
  const [tableauBandWidthPx, setTableauBandWidthPx] = useState(420);
  const setActiveSide = actions.setActiveSide;
  const syncTurnBarWidths = useCallback((remainingMs: number, totalMs = turnDurationMs) => {
    if (DISABLE_TURN_BAR_ANIMATION) return;
    const normalizedTotal = Math.max(1, totalMs);
    const percent = normalizedTotal > 0
      ? Math.max(0, Math.min(100, (Math.max(0, Math.min(normalizedTotal, remainingMs)) / normalizedTotal) * 100))
      : 0;
    const width = `${percent}%`;
    if (playerTurnBarRef.current) playerTurnBarRef.current.style.width = width;
    if (enemyTurnBarRef.current) enemyTurnBarRef.current.style.width = width;
  }, [turnDurationMs]);
  const forceLocalTurnSide = useCallback((nextSide: 'player' | 'enemy') => {
    setLabTurnSide(nextSide);
    setActiveSide?.(nextSide);
    setTappedPlayerFoundations({});
    setPendingTurnSide(null);
    setPendingFinalMoveResolution(false);
    setInterTurnCountdownMs(0);
    localTurnRemainingRef.current = turnDurationMs;
    displayTurnRemainingRef.current = turnDurationMs;
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(turnDurationMs);
    }
    setLocalTurnTimerActive(true);
    syncTurnBarWidths(turnDurationMs);
  }, [setActiveSide, syncTurnBarWidths, turnDurationMs]);
  const handleZenEndTurn = useCallback(() => {
    if (!zenRelicEnabled) return;
    if (!showTurnTimer || !enforceTurnOwnership) return;
    if (interTurnCountdownActive) return;

    if (useLocalTurnSide) {
      const nextSide: 'player' | 'enemy' = effectiveActiveSide === 'player' ? 'enemy' : 'player';
      forceLocalTurnSide(nextSide);
      if (nextSide === 'player') {
        actions.reshuffleTableaus();
      }
      return;
    }

    actions.advanceTurn();
  }, [
    actions,
    effectiveActiveSide,
    enforceTurnOwnership,
    forceLocalTurnSide,
    interTurnCountdownActive,
    showTurnTimer,
    useLocalTurnSide,
    zenRelicEnabled,
  ]);
  const handleHudEndTurn = useCallback(() => {
    if (interTurnCountdownActive) return;
    setTappedPlayerFoundations({});
    if (showTurnTimer && enforceTurnOwnership) {
      if (useLocalTurnSide) {
        const nextSide: 'player' | 'enemy' = effectiveActiveSide === 'player' ? 'enemy' : 'player';
        forceLocalTurnSide(nextSide);
        if (nextSide === 'player') {
          actions.reshuffleTableaus();
        }
        return;
      }
      actions.advanceTurn();
      return;
    }
    if (isCombatSessionActive(gameState)) {
      actions.endTurn();
      return;
    }
    actions.advanceTurn();
  }, [
    actions,
    effectiveActiveSide,
    enforceTurnOwnership,
    forceLocalTurnSide,
    gameState,
    interTurnCountdownActive,
    showTurnTimer,
    useLocalTurnSide,
  ]);
  const getActorFoundationTimerBonusMs = useCallback((actor: Actor | null): number => {
    if (!actor) return 0;
    return (actor.orimSlots ?? []).reduce((total, slot) => {
      const definitionId = resolveOrimDefinitionIdFromSlot(
        slot.orimId,
        gameState.orimInstances,
        gameState.orimDefinitions
      );
      if (!definitionId) return total;
      const definition = gameState.orimDefinitions.find((entry) => entry.id === definitionId);
      if (!definition) return total;
      const bonusMs = Math.max(0, Number(definition.timerBonusMs ?? 0));
      return total + (Number.isFinite(bonusMs) ? bonusMs : 0);
    }, 0);
  }, [gameState.orimDefinitions, gameState.orimInstances]);
  const applyFoundationTimerBonus = useCallback((foundationIndex: number) => {
    const foundationCards = previewPlayerFoundations[foundationIndex] ?? [];
    const actor = resolvePlayerFoundationActor(foundationIndex, foundationCards);
    const bonusMs = getActorFoundationTimerBonusMs(actor);
    if (bonusMs <= 0) return;
    const boostedRemaining = Math.max(0, localTurnRemainingRef.current + bonusMs);
    localTurnRemainingRef.current = boostedRemaining;
    displayTurnRemainingRef.current = boostedRemaining;
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(boostedRemaining);
    }
    syncTurnBarWidths(boostedRemaining);
  }, [getActorFoundationTimerBonusMs, previewPlayerFoundations, resolvePlayerFoundationActor, syncTurnBarWidths]);
  useEffect(() => {
    const actionCount = Math.max(0, Math.floor(Number(gameState.turnCount ?? 0)));
    const prevActionCount = lastProcessedTapActionCountRef.current;
    lastProcessedTapActionCountRef.current = actionCount;
    if (actionCount <= prevActionCount) return;
    const delta = actionCount - prevActionCount;
    if (delta <= 0) return;
    const tappedIndexes = Object.entries(tappedPlayerFoundations)
      .filter(([, tapped]) => !!tapped)
      .map(([index]) => Number(index))
      .filter((index) => Number.isFinite(index) && index >= 0);
    if (tappedIndexes.length === 0) return;
    tappedIndexes.forEach((foundationIndex) => {
      const foundationCards = previewPlayerFoundations[foundationIndex] ?? [];
      const actor = resolvePlayerFoundationActor(foundationIndex, foundationCards);
      if (!actor?.id) return;
      actions.spendActorAp?.(actor.id, delta);
    });
  }, [
    actions,
    gameState.turnCount,
    previewPlayerFoundations,
    resolvePlayerFoundationActor,
    tappedPlayerFoundations,
  ]);
  useEffect(() => {
    const prevKeys = Object.keys(tappedPlayerFoundations);
    if (prevKeys.length === 0) return;
    let changed = false;
    const next: Record<number, boolean> = {};
    prevKeys.forEach((foundationIndexKey) => {
      if (!tappedPlayerFoundations[Number(foundationIndexKey)]) {
        changed = true;
        return;
      }
      const foundationIndex = Number(foundationIndexKey);
      const foundationCards = previewPlayerFoundations[foundationIndex] ?? [];
      if (foundationCards.length === 0) {
        changed = true;
        return;
      }
      next[foundationIndex] = true;
    });
    if (!changed && Object.keys(next).length === prevKeys.length) return;
    setTappedPlayerFoundations(next);
  }, [previewPlayerFoundations, tappedPlayerFoundations]);
  const isFoundationTableauLocked = useCallback(
    (foundationIndex: number) => Boolean(tappedPlayerFoundations[foundationIndex]),
    [tappedPlayerFoundations]
  );
  const handleSandboxFoundationClick = useCallback((foundationIndex: number) => {
    if (interTurnCountdownActive) return;
    if (enforceTurnOwnership && effectiveActiveSide !== 'player') return;
    const canPlaySelected = !!selectedCard && !!validFoundationsForSelected[foundationIndex];
    if (canPlaySelected) {
      if (isFoundationTableauLocked(foundationIndex)) {
        setTappedPlayerFoundations((prev) => {
          if (!prev[foundationIndex]) return prev;
          const next = { ...prev };
          delete next[foundationIndex];
          return next;
        });
        return;
      }
      const accepted = actions.playToFoundation(foundationIndex);
      if (accepted) {
        setLocalTurnTimerActive(true);
        applyFoundationTimerBonus(foundationIndex);
      }
      return;
    }
    const foundationCards = previewPlayerFoundations[foundationIndex] ?? [];
    if (foundationCards.length === 0) return;
    setTappedPlayerFoundations((prev) => {
      const next = { ...prev };
      if (next[foundationIndex]) {
        delete next[foundationIndex];
      } else {
        next[foundationIndex] = true;
      }
      return next;
    });
  }, [
    interTurnCountdownActive,
    enforceTurnOwnership,
    effectiveActiveSide,
    selectedCard,
    validFoundationsForSelected,
    isFoundationTableauLocked,
    previewPlayerFoundations,
    applyFoundationTimerBonus,
  ]);
  const useWild = false;
  const recordDropMetrics = useCallback((totalMs: number, actionMs: number) => {
    pushPerfSample(dropTotalDurationSamplesRef.current, totalMs);
    pushPerfSample(dropActionDurationSamplesRef.current, actionMs);
  }, []);
  const handleSandboxDrop = useCallback((tableauIndex: number, foundationIndex: number, dropPoint?: { x: number; y: number }) => {
    const dropStart = performance.now();
    let actionMs = 0;
    if (interTurnCountdownActive) {
      recordDropMetrics(performance.now() - dropStart, actionMs);
      return;
    }
    const isEnemyFoundationDrop = foundationIndex >= enemyFoundationDropBase
      && foundationIndex < enemyFoundationDropBase + enemyFoundations.length;
    if (isEnemyFoundationDrop) {
      const enemyFoundationIndex = foundationIndex - enemyFoundationDropBase;
      if (tableauIndex === HAND_SOURCE_INDEX) {
        const draggedHandCard = draggedHandCardRef.current;
        if (draggedHandCard) {
          const actionStart = performance.now();
          const accepted = actions.playFromHandToEnemyFoundation(draggedHandCard, enemyFoundationIndex);
          actionMs = performance.now() - actionStart;
          if (accepted) setLocalTurnTimerActive(true);
          if (import.meta.env.DEV) {
            console.debug('[sandbox drop] hand->enemyFoundation', {
              enemyFoundationIndex,
              cardId: draggedHandCard.id,
              accepted,
            });
          }
        }
        draggedHandCardRef.current = null;
        recordDropMetrics(performance.now() - dropStart, actionMs);
        return;
      }
      const actionStart = performance.now();
      const accepted = actions.playEnemyFromTableau(tableauIndex, enemyFoundationIndex);
      actionMs = performance.now() - actionStart;
      if (accepted) setLocalTurnTimerActive(true);
      if (import.meta.env.DEV) {
        console.debug('[sandbox drop] tableau->enemyFoundation', {
          tableauIndex,
          enemyFoundationIndex,
          accepted,
        });
      }
      recordDropMetrics(performance.now() - dropStart, actionMs);
      return;
    }
    if (tableauIndex === HAND_SOURCE_INDEX) {
      const draggedHandCard = draggedHandCardRef.current;
      if (draggedHandCard) {
        const actionStart = performance.now();
        const accepted = actions.playFromHand(draggedHandCard, foundationIndex, useWild);
        actionMs = performance.now() - actionStart;
        if (accepted) {
          setLocalTurnTimerActive(true);
          applyFoundationTimerBonus(foundationIndex);
        }
      }
      draggedHandCardRef.current = null;
      recordDropMetrics(performance.now() - dropStart, actionMs);
      return;
    }
    if (foundationIndex < 0 || foundationIndex >= previewPlayerFoundations.length) {
      recordDropMetrics(performance.now() - dropStart, actionMs);
      return;
    }
    if (isFoundationTableauLocked(foundationIndex)) {
      recordDropMetrics(performance.now() - dropStart, actionMs);
      return;
    }
    if (enforceTurnOwnership && effectiveActiveSide !== 'player') {
      recordDropMetrics(performance.now() - dropStart, actionMs);
      return;
    }
    if (import.meta.env.DEV) {
      console.debug('[sandbox drop] tableau->foundation', {
        tableauIndex,
        foundationIndex,
        foundationsLength: previewPlayerFoundations.length,
        foundationSize: previewPlayerFoundations[foundationIndex]?.length ?? null,
        foundationKeys: previewPlayerFoundations.map((f) => (f ? f.length : null)),
      });
    }
    if (useWild) {
      const actionStart = performance.now();
      let accepted = actions.playFromTableau(tableauIndex, foundationIndex);
      if (!accepted) {
        accepted = actions.playFromTableau(tableauIndex, foundationIndex);
      }
      actionMs = performance.now() - actionStart;
      if (accepted) {
        setLocalTurnTimerActive(true);
        applyFoundationTimerBonus(foundationIndex);
      }
      recordDropMetrics(performance.now() - dropStart, actionMs);
      return;
    }
    const actionStart = performance.now();
    const accepted = actions.playFromTableau(tableauIndex, foundationIndex);
    actionMs = performance.now() - actionStart;
    if (accepted) {
      setLocalTurnTimerActive(true);
      applyFoundationTimerBonus(foundationIndex);
    }
    recordDropMetrics(performance.now() - dropStart, actionMs);
  }, [actions, useWild, enemyFoundationDropBase, enemyFoundations, gameState.phase, enforceTurnOwnership, effectiveActiveSide, interTurnCountdownActive, recordDropMetrics, resolveEnemyFoundationActor, resolvePlayerFoundationActor, previewPlayerFoundations, applyFoundationTimerBonus, isFoundationTableauLocked]);
  const { dragState, startDrag, setFoundationRef, dragPositionRef, getPerfSnapshot, lastDragEndAt } = useDragDrop(handleSandboxDrop, isGamePaused);
  const buildAutoPlayReplaySnapshot = useCallback((state: GameState): Partial<GameState> => (
    deepCloneReplayValue({
      phase: state.phase,
      currentEncounterId: state.currentEncounterId,
      activeCombatPartyId: state.activeCombatPartyId,
      turnCount: state.turnCount,
      enemyDifficulty: state.enemyDifficulty,
      combatFlowMode: state.combatFlowMode,
      activeCombatSide: state.activeCombatSide,
      combatTurnNumber: state.combatTurnNumber,
      combatTurnDurationMs: state.combatTurnDurationMs,
      combatTurnRemainingMs: state.combatTurnRemainingMs,
      combatTurnLastTickAt: state.combatTurnLastTickAt,
      combatTurnTimerActive: state.combatTurnTimerActive,
      tableaus: state.tableaus ?? [],
      foundations: state.foundations ?? [],
      enemyFoundations: state.enemyFoundations ?? [],
      foundationCombos: state.foundationCombos ?? [],
      enemyFoundationCombos: state.enemyFoundationCombos ?? [],
      foundationTokens: state.foundationTokens ?? [],
      enemyFoundationTokens: state.enemyFoundationTokens ?? [],
      actorCombos: state.actorCombos ?? {},
      actorDecks: state.actorDecks ?? {},
      collectedTokens: state.collectedTokens,
      activeEffects: state.activeEffects ?? [],
      availableActors: state.availableActors ?? [],
      partyAssignments: getPartyAssignments(state),
      enemyActors: state.enemyActors ?? [],
      rpgHandCards: state.rpgHandCards ?? [],
      rpgEnemyHandCards: state.rpgEnemyHandCards ?? [],
      rpgDiscardPilesByActor: state.rpgDiscardPilesByActor ?? {},
      rpgDots: state.rpgDots ?? [],
      rpgEnemyDragSlowUntil: state.rpgEnemyDragSlowUntil,
      rpgEnemyDragSlowActorId: state.rpgEnemyDragSlowActorId,
      rpgCloudSightUntil: state.rpgCloudSightUntil,
      rpgCloudSightActorId: state.rpgCloudSightActorId,
      lifecycleRunCounter: state.lifecycleRunCounter,
      lifecycleBattleCounter: state.lifecycleBattleCounter,
      lifecycleTurnCounter: state.lifecycleTurnCounter,
      lifecycleRestCounter: state.lifecycleRestCounter,
      abilityLifecycleUsageByDeckCard: state.abilityLifecycleUsageByDeckCard ?? {},
      combatFlowTelemetry: state.combatFlowTelemetry,
    })
  ), []);
  const emitAutoPlayReplayNotice = useCallback((label: string) => {
    setAutoPlayReplayNotice(label);
    window.setTimeout(() => setAutoPlayReplayNotice(''), 2600);
  }, []);
  const buildAutoPlayReplayBundle = useCallback((): AutoPlayReplayBundle => {
    const startSnapshot = autoPlayReplayStartSnapshotRef.current
      ?? buildAutoPlayReplaySnapshot(gameState);
    autoPlayReplayStartSnapshotRef.current = startSnapshot;
    return {
      version: AUTO_PLAY_REPLAY_VERSION,
      capturedAt: new Date().toISOString(),
      deterministic: autoPlayDeterministic,
      seed: autoPlaySeed,
      difficulty: currentDifficulty,
      timeScale,
      autoPlaySpeed,
      trace: autoPlayTrace,
      startSnapshot,
      finalSnapshot: buildAutoPlayReplaySnapshot(gameState),
    };
  }, [
    autoPlayDeterministic,
    autoPlaySeed,
    autoPlaySpeed,
    autoPlayTrace,
    buildAutoPlayReplaySnapshot,
    currentDifficulty,
    gameState,
    timeScale,
  ]);
  const handleExportAutoPlayReplay = useCallback(() => {
    const payload = buildAutoPlayReplayBundle();
    const json = JSON.stringify(payload, null, 2);
    const globalWindow = window as Window & { __combatLabLastAutoPlayReplay?: AutoPlayReplayBundle };
    globalWindow.__combatLabLastAutoPlayReplay = payload;
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(json)
        .then(() => emitAutoPlayReplayNotice('Replay copied'))
        .catch(() => {
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `combat-lab-replay-${Date.now()}.json`;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
          emitAutoPlayReplayNotice('Replay downloaded');
        });
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `combat-lab-replay-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    emitAutoPlayReplayNotice('Replay downloaded');
  }, [buildAutoPlayReplayBundle, emitAutoPlayReplayNotice]);
  const handleImportAutoPlayReplay = useCallback(async () => {
    const parseBundle = (raw: string): AutoPlayReplayBundle | null => {
      try {
        const parsed = JSON.parse(raw) as Partial<AutoPlayReplayBundle>;
        const fallbackDifficulty = currentDifficulty;
        const fallbackSpeed = autoPlaySpeed;
        const difficulty = DIFFICULTY_ORDER.includes((parsed.difficulty ?? fallbackDifficulty) as NonNullable<GameState['enemyDifficulty']>)
          ? (parsed.difficulty as NonNullable<GameState['enemyDifficulty']>)
          : fallbackDifficulty;
        return {
          version: Number(parsed.version ?? AUTO_PLAY_REPLAY_VERSION),
          capturedAt: String(parsed.capturedAt ?? new Date().toISOString()),
          deterministic: parsed.deterministic !== false,
          seed: Math.max(0, Math.floor(Number(parsed.seed ?? AUTO_PLAY_DEFAULT_SEED))),
          difficulty,
          timeScale: Math.max(0.25, Number(parsed.timeScale ?? timeScale)),
          autoPlaySpeed: Math.max(0.5, Number(parsed.autoPlaySpeed ?? fallbackSpeed)),
          trace: Array.isArray(parsed.trace) ? parsed.trace.slice(0, AUTO_PLAY_MAX_TRACE) as AutoPlayDecisionEntry[] : [],
          startSnapshot: (parsed.startSnapshot ?? parsed.finalSnapshot ?? {}) as Partial<GameState>,
          finalSnapshot: (parsed.finalSnapshot ?? parsed.startSnapshot ?? {}) as Partial<GameState>,
        };
      } catch {
        return null;
      }
    };
    let raw = '';
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      const manual = window.prompt('Paste replay JSON');
      raw = manual ?? '';
    }
    if (!raw.trim()) {
      emitAutoPlayReplayNotice('No replay payload');
      return;
    }
    const bundle = parseBundle(raw.trim());
    if (!bundle) {
      emitAutoPlayReplayNotice('Invalid replay payload');
      return;
    }
    if (!actions.restoreCombatLabSnapshot) {
      emitAutoPlayReplayNotice('Snapshot restore unavailable');
      return;
    }
    const snapshot = bundle.startSnapshot && Object.keys(bundle.startSnapshot).length > 0
      ? bundle.startSnapshot
      : bundle.finalSnapshot;
    const applied = actions.restoreCombatLabSnapshot(snapshot);
    if (!applied) {
      emitAutoPlayReplayNotice('Replay apply failed');
      return;
    }
    setAutoPlayEnabled(false);
    if (bundle.difficulty !== currentDifficulty) {
      actions.setEnemyDifficulty(bundle.difficulty);
    }
    if (onSetTimeScale) {
      onSetTimeScale(bundle.timeScale);
    }
    setAutoPlayDeterministic(bundle.deterministic);
    setAutoPlaySeed(bundle.seed);
    resetAutoPlayDeterministicRng(bundle.seed);
    const closestSpeedIndex = AUTO_PLAY_SPEED_OPTIONS.reduce((bestIndex, option, index) => {
      const bestDistance = Math.abs(AUTO_PLAY_SPEED_OPTIONS[bestIndex] - bundle.autoPlaySpeed);
      const currentDistance = Math.abs(option - bundle.autoPlaySpeed);
      return currentDistance < bestDistance ? index : bestIndex;
    }, 0);
    setAutoPlaySpeedIndex(closestSpeedIndex);
    setAutoPlayTrace(bundle.trace);
    setAutoPlayLastDecision(bundle.trace[0] ?? null);
    autoPlayReplayStartSnapshotRef.current = deepCloneReplayValue(snapshot);
    autoPlayStallRef.current = 0;
    setAutoPlayStalls(0);
    emitAutoPlayReplayNotice('Replay imported');
  }, [
    actions,
    autoPlaySpeed,
    currentDifficulty,
    emitAutoPlayReplayNotice,
    onSetTimeScale,
    resetAutoPlayDeterministicRng,
    timeScale,
  ]);
  const buildPerfCapturePayload = useCallback(() => {
    const dragPerf = getPerfSnapshot();
    const fpsPerf = summarizeFpsFromFrameTimes(frameDeltaSamplesRef.current);
    const dropTotalPerf = summarizePerfSamples(dropTotalDurationSamplesRef.current);
    const dropActionPerf = summarizePerfSamples(dropActionDurationSamplesRef.current);
    const rpgTickPerf = summarizePerfSamples(rpgTickDurationSamplesRef.current);
    const reactCommitPerf = summarizePerfSamples(reactCommitDurationSamplesRef.current);
    const longTaskPerf = summarizePerfSamples(longTaskDurationSamplesRef.current);
    const lifecycle = {
      run: getLifecycleCounterForPreview(gameState, 'run'),
      battle: getLifecycleCounterForPreview(gameState, 'battle'),
      turn: getLifecycleCounterForPreview(gameState, 'turn'),
      rest: getLifecycleCounterForPreview(gameState, 'rest'),
    };
    const lifecycleUsageEntries = Object.entries(gameState.abilityLifecycleUsageByDeckCard ?? {})
      .slice(0, 12)
      .map(([deckCardId, usage]) => ({ deckCardId, usage }));
    return {
      capturedAt: new Date().toISOString(),
      mode: isLabMode ? 'combat-lab' : 'combat-sandbox',
      activeSide: effectiveActiveSide,
      timeScale,
      fps: fpsPerf,
      autoPlay: {
        enabled: autoPlayEnabled,
        speed: autoPlaySpeed,
        stepMs: autoPlayStepMs,
        stalls: autoPlayStalls,
        policy: autoPlayPolicyProfile.id,
        deterministic: autoPlayDeterministic,
        seed: autoPlaySeed,
        rngState: autoPlayRngStateRef.current,
        replayStartCaptured: !!autoPlayReplayStartSnapshotRef.current,
        lastDecision: autoPlayLastDecision,
        traceHead: autoPlayTrace.slice(0, 6),
      },
      lifecycle: {
        ...lifecycle,
        trackedDeckCards: Object.keys(gameState.abilityLifecycleUsageByDeckCard ?? {}).length,
        sampleUsage: lifecycleUsageEntries,
      },
      drag: {
        ...dragPerf,
      },
      drop: {
        total: dropTotalPerf,
        action: dropActionPerf,
        sampleCount: dropTotalDurationSamplesRef.current.length,
      },
      rpgTick: {
        ...rpgTickPerf,
        sampleCount: rpgTickDurationSamplesRef.current.length,
      },
      reactCommit: {
        ...reactCommitPerf,
        sampleCount: reactCommitDurationSamplesRef.current.length,
      },
      longTask: {
        ...longTaskPerf,
        sampleCount: longTaskDurationSamplesRef.current.length,
      },
      latest: perfSnapshot,
    };
  }, [
    autoPlayDeterministic,
    autoPlayEnabled,
    autoPlayLastDecision,
    autoPlayPolicyProfile.id,
    autoPlaySeed,
    autoPlaySpeed,
    autoPlayStalls,
    autoPlayStepMs,
    autoPlayTrace,
    effectiveActiveSide,
    gameState,
    getPerfSnapshot,
    isLabMode,
    perfSnapshot,
    timeScale,
  ]);
  const handleCapturePerf = useCallback(() => {
    const payload = buildPerfCapturePayload();
    const json = JSON.stringify(payload, null, 2);
    const globalWindow = window as Window & { __combatLabLastPerfCapture?: unknown };
    globalWindow.__combatLabLastPerfCapture = payload;
    console.log('[combat-lab perf capture]', payload);

    const saveNotice = (label: string) => {
      setPerfCaptureNotice(label);
      window.setTimeout(() => setPerfCaptureNotice(''), 2400);
    };

    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(json)
        .then(() => saveNotice('Copied'))
        .catch(() => {
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `combat-lab-perf-${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          saveNotice('Downloaded');
        });
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `combat-lab-perf-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    saveNotice('Downloaded');
  }, [buildPerfCapturePayload]);
  const appendAutoPlayDecision = useCallback((entry: AutoPlayDecisionEntry) => {
    setAutoPlayLastDecision(entry);
    setAutoPlayTrace((prev) => [entry, ...prev].slice(0, AUTO_PLAY_MAX_TRACE));
    const globalWindow = window as Window & { __combatLabAutoPlayTrace?: AutoPlayDecisionEntry[] };
    globalWindow.__combatLabAutoPlayTrace = [entry, ...(globalWindow.__combatLabAutoPlayTrace ?? [])].slice(0, AUTO_PLAY_MAX_TRACE);
  }, []);
  const buildAutoPlayLegalMoveCounts = useCallback(() => {
    const legalPlayerMovesByFoundation = previewPlayerFoundations.map((foundation, foundationIndex) => {
      if (isFoundationTableauLocked(foundationIndex)) return 0;
      const foundationTop = foundation[foundation.length - 1];
      return previewTableaus.reduce((count, tableau) => {
        const topCard = tableau[tableau.length - 1];
        if (!topCard) return count;
        return count + (canPlayCardWithWild(topCard, foundationTop, gameState.activeEffects) ? 1 : 0);
      }, 0);
    });
    const legalEnemyMovesByFoundation = enemyFoundations.map((foundation) => {
      if (!foundation?.length) return 0;
      const foundationTop = foundation[foundation.length - 1];
      if (!foundationTop) return 0;
      return previewTableaus.reduce((count, tableau) => {
        const topCard = tableau[tableau.length - 1];
        if (!topCard) return count;
        return count + (canPlayCardWithWild(topCard, foundationTop, gameState.activeEffects) ? 1 : 0);
      }, 0);
    });
    return { legalPlayerMovesByFoundation, legalEnemyMovesByFoundation };
  }, [enemyFoundations, gameState.activeEffects, isFoundationTableauLocked, previewPlayerFoundations, previewTableaus]);
  useEffect(() => {
    if (!testSequenceRunning) return;
    const { legalPlayerMovesByFoundation, legalEnemyMovesByFoundation } = buildAutoPlayLegalMoveCounts();
    const totalLegalPlayerMoves = legalPlayerMovesByFoundation.reduce((sum, value) => sum + value, 0);
    const totalLegalEnemyMoves = legalEnemyMovesByFoundation.reduce((sum, value) => sum + value, 0);
    const currentMetrics = testSequenceRunMetricsRef.current;
    const observedTurnCounter = Math.max(
      0,
      Number(gameState.lifecycleTurnCounter ?? gameState.turnCount ?? 0)
    );
    const lastActiveSide = testSequenceLastActiveSideRef.current;
    let playerTurnsStarted = currentMetrics.playerTurnsStarted;
    let enemyTurnsStarted = currentMetrics.enemyTurnsStarted;
    if (effectiveActiveSide !== lastActiveSide) {
      if (effectiveActiveSide === 'player') {
        playerTurnsStarted += 1;
      } else {
        enemyTurnsStarted += 1;
      }
      testSequenceLastActiveSideRef.current = effectiveActiveSide;
    }
    testSequenceRunMetricsRef.current = {
      peakLegalPlayerMoves: Math.max(currentMetrics.peakLegalPlayerMoves, totalLegalPlayerMoves),
      peakLegalEnemyMoves: Math.max(currentMetrics.peakLegalEnemyMoves, totalLegalEnemyMoves),
      playerCardsPlayed: Math.max(currentMetrics.playerCardsPlayed, gameState.combatFlowTelemetry?.playerCardsPlayed ?? 0),
      enemyCardsPlayed: Math.max(currentMetrics.enemyCardsPlayed, gameState.combatFlowTelemetry?.enemyCardsPlayed ?? 0),
      playerTurnsStarted,
      enemyTurnsStarted,
      observedTurnCounter: Math.max(currentMetrics.observedTurnCounter, observedTurnCounter),
    };
  }, [buildAutoPlayLegalMoveCounts, effectiveActiveSide, gameState, testSequenceRunning]);
  const resetTestSequenceRun = useCallback((runNumber: number) => {
    testSequenceRunStartedAtRef.current = performance.now();
    testSequenceFinalizedRunRef.current = Math.max(0, runNumber - 1);
    testSequenceLastActiveSideRef.current = 'player';
    testSequenceRunMetricsRef.current = {
      peakLegalPlayerMoves: 0,
      peakLegalEnemyMoves: 0,
      playerCardsPlayed: 0,
      enemyCardsPlayed: 0,
      playerTurnsStarted: 1,
      enemyTurnsStarted: 0,
      observedTurnCounter: 0,
    };
    setTestSequenceCurrentRun(runNumber);
    setAutoPlayTrace([]);
    setAutoPlayLastDecision(null);
    autoPlayMoveAuditRef.current = [];
    const globalWindow = window as Window & {
      __combatLabMoveAudit?: AutoPlayMoveAuditEntry[];
      __combatLabLastTestSequence?: unknown;
    };
    globalWindow.__combatLabMoveAudit = [];
    setTappedPlayerFoundations({});
    setPendingTurnSide(null);
    setPendingFinalMoveResolution(false);
    setInterTurnCountdownMs(0);
    setLocalTurnTimerActive(false);
    localTurnRemainingRef.current = turnDurationMs;
    displayTurnRemainingRef.current = turnDurationMs;
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(turnDurationMs);
    }
    forceLocalTurnSide('player');
    setActiveSide?.('player');
    actions.newGame(true);
    setAutoPlayEnabled(true);
  }, [actions, forceLocalTurnSide, setActiveSide, turnDurationMs]);
  const buildTestSequencePayload = useCallback((results: AutoPlayBatchRunSummary[]) => {
    const durations = results.map((entry) => entry.durationMs);
    const finalMoveTotals = results.map((entry) => entry.totalLegalPlayerMoves);
    const peakMoveTotals = results.map((entry) => entry.peakLegalPlayerMoves);
    const turnsCompletedTotals = results.map((entry) => entry.turnsCompleted);
    const playerCardsPlayedTotals = results.map((entry) => entry.playerCardsPlayed);
    const enemyCardsPlayedTotals = results.map((entry) => entry.enemyCardsPlayed);
    const avg = (values: number[]) => values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
    return {
      capturedAt: new Date().toISOString(),
      requestedRuns: testSequenceRequestedRuns,
      completedRuns: results.length,
      config: {
        autoPlaySpeed,
        timeScale,
        deterministic: autoPlayDeterministic,
        seed: autoPlaySeed,
      },
      summary: {
        deadTableauRuns: results.filter((entry) => entry.deadTableauReached).length,
        avgDurationMs: Math.round(avg(durations)),
        avgFinalLegalMoves: Number(avg(finalMoveTotals).toFixed(3)),
        avgPeakLegalMoves: Number(avg(peakMoveTotals).toFixed(3)),
        avgTurnsCompleted: Number(avg(turnsCompletedTotals).toFixed(3)),
        avgPlayerCardsPlayed: Number(avg(playerCardsPlayedTotals).toFixed(3)),
        avgEnemyCardsPlayed: Number(avg(enemyCardsPlayedTotals).toFixed(3)),
        maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
        maxPeakLegalMoves: peakMoveTotals.length > 0 ? Math.max(...peakMoveTotals) : 0,
        completionReasons: results.reduce<Record<string, number>>((acc, entry) => {
          acc[entry.completionReason] = (acc[entry.completionReason] ?? 0) + 1;
          return acc;
        }, {}),
      },
      results: results.map((entry) => ({
        run: entry.run,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        durationMs: entry.durationMs,
        turnsCompleted: entry.turnsCompleted,
        playerTurnsStarted: entry.playerTurnsStarted,
        enemyTurnsStarted: entry.enemyTurnsStarted,
        playerCardsPlayed: entry.playerCardsPlayed,
        enemyCardsPlayed: entry.enemyCardsPlayed,
        peakLegalPlayerMoves: entry.peakLegalPlayerMoves,
        peakLegalEnemyMoves: entry.peakLegalEnemyMoves,
        finalTurnNumber: entry.finalTurnNumber,
        completionReason: entry.completionReason,
        deadTableauReached: entry.deadTableauReached,
        noValidMovesPlayer: entry.noValidMovesPlayer,
        remainingTableauDepths: entry.remainingTableauDepths,
        playerTableauTopRanks: entry.playerTableauTopRanks,
        playerFoundationTopRanks: entry.playerFoundationTopRanks,
        legalPlayerMovesByFoundation: entry.legalPlayerMovesByFoundation,
        totalLegalPlayerMoves: entry.totalLegalPlayerMoves,
      })),
      diagnosticSamples: results.slice(0, 3).map((entry) => ({
        run: entry.run,
        completionReason: entry.completionReason,
        traceTail: entry.traceTail,
        moveAuditTail: entry.moveAuditTail,
      })),
    };
  }, [autoPlayDeterministic, autoPlaySeed, autoPlaySpeed, testSequenceRequestedRuns, timeScale]);
  const handleCopyTestSequenceResults = useCallback(() => {
    const payload = buildTestSequencePayload(testSequenceResults);
    const json = JSON.stringify(payload, null, 2);
    const globalWindow = window as Window & { __combatLabLastTestSequence?: unknown };
    globalWindow.__combatLabLastTestSequence = payload;

    const setNotice = (label: string) => {
      setTestSequenceCopyNotice(label);
      window.setTimeout(() => setTestSequenceCopyNotice(''), 2400);
    };

    const downloadResults = () => {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `combat-test-seq-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('Downloaded');
    };

    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(json)
        .then(() => setNotice('Copied'))
        .catch(() => downloadResults());
      return;
    }
    downloadResults();
  }, [buildTestSequencePayload, testSequenceResults]);
  const handleStartTestSequence = useCallback(() => {
    const requested = Math.max(1, Math.min(1000, Math.floor(Number(testSequenceInput) || 0)));
    setTestSequenceInput(String(requested));
    setTestSequenceResults([]);
    setTestSequenceCompleted(false);
    setTestSequenceRequestedRuns(requested);
    setTestSequenceCurrentRun(0);
    setTestSequenceCopyNotice('');
    setTestSequenceRunning(true);
    resetTestSequenceRun(1);
  }, [resetTestSequenceRun, testSequenceInput]);
  const appendAutoPlayMoveAudit = useCallback((entry: Omit<AutoPlayMoveAuditEntry, 'at' | 'activeSide' | 'turn' | 'timeScale' | 'autoPlaySpeed' | 'playerTableauTopRanks' | 'playerFoundationTopRanks' | 'enemyFoundationTopRanks' | 'legalPlayerMovesByFoundation' | 'legalEnemyMovesByFoundation'>) => {
    const { legalPlayerMovesByFoundation, legalEnemyMovesByFoundation } = buildAutoPlayLegalMoveCounts();
    const stamped: AutoPlayMoveAuditEntry = {
      ...entry,
      at: Date.now(),
      activeSide: effectiveActiveSide,
      turn: Math.max(0, Number(gameState.turnCount ?? 0)),
      timeScale,
      autoPlaySpeed,
      playerTableauTopRanks: previewTableaus.map((tableau) => tableau[tableau.length - 1]?.rank ?? null),
      playerFoundationTopRanks: previewPlayerFoundations.map((foundation) => foundation[foundation.length - 1]?.rank ?? null),
      enemyFoundationTopRanks: enemyFoundations.map((foundation) => foundation[foundation.length - 1]?.rank ?? null),
      legalPlayerMovesByFoundation,
      legalEnemyMovesByFoundation,
    };
    autoPlayMoveAuditRef.current = [stamped, ...autoPlayMoveAuditRef.current].slice(0, AUTO_PLAY_AUDIT_MAX);
    const globalWindow = window as Window & {
      __combatLabMoveAudit?: AutoPlayMoveAuditEntry[];
      __combatLabExportMoveAudit?: () => string;
      __combatLabClearMoveAudit?: () => void;
    };
    globalWindow.__combatLabMoveAudit = autoPlayMoveAuditRef.current;
    globalWindow.__combatLabExportMoveAudit = () => JSON.stringify(autoPlayMoveAuditRef.current, null, 2);
    globalWindow.__combatLabClearMoveAudit = () => {
      autoPlayMoveAuditRef.current = [];
      globalWindow.__combatLabMoveAudit = [];
    };
  }, [
    autoPlaySpeed,
    buildAutoPlayLegalMoveCounts,
    effectiveActiveSide,
    enemyFoundations,
    gameState.turnCount,
    previewPlayerFoundations,
    previewTableaus,
    timeScale,
  ]);
  useEffect(() => {
    if (!autoPlayDragAnim) {
      autoPlayDragAnimIdRef.current = null;
      autoPlayDragStartedAtRef.current = 0;
      autoPlayDragRemainingMsRef.current = 0;
      autoPlayDragPausedTransformRef.current = null;
      autoPlayDragTargetTransformRef.current = null;
      autoPlayDragCompletionRef.current = null;
      if (autoPlayDragRafRef.current) {
        window.cancelAnimationFrame(autoPlayDragRafRef.current);
        autoPlayDragRafRef.current = 0;
      }
      if (autoPlayDragTimeoutRef.current) {
        window.clearTimeout(autoPlayDragTimeoutRef.current);
        autoPlayDragTimeoutRef.current = 0;
      }
      return;
    }
    const node = autoPlayDragNodeRef.current;
    if (!node) return;

    if (autoPlayDragAnimIdRef.current !== autoPlayDragAnim.id) {
      autoPlayDragAnimIdRef.current = autoPlayDragAnim.id;
      autoPlayDragStartedAtRef.current = 0;
      autoPlayDragRemainingMsRef.current = autoPlayDragAnim.durationMs;
      autoPlayDragPausedTransformRef.current = null;
    }

    if (autoPlayDragRafRef.current) {
      window.cancelAnimationFrame(autoPlayDragRafRef.current);
      autoPlayDragRafRef.current = 0;
    }
    if (autoPlayDragTimeoutRef.current) {
      window.clearTimeout(autoPlayDragTimeoutRef.current);
      autoPlayDragTimeoutRef.current = 0;
    }

    const dx = autoPlayDragAnim.to.x - autoPlayDragAnim.from.x;
    const dy = autoPlayDragAnim.to.y - autoPlayDragAnim.from.y;
    const headingDegrees = Math.atan2(dy, dx) * (180 / Math.PI);
    const startRotation = 0;
    const endRotation = headingDegrees * 0.08;
    const initialTransform = `translate3d(${autoPlayDragAnim.from.x.toFixed(2)}px, ${autoPlayDragAnim.from.y.toFixed(2)}px, 0) rotate(${startRotation.toFixed(2)}deg)`;
    const targetTransform = `translate3d(${autoPlayDragAnim.to.x.toFixed(2)}px, ${autoPlayDragAnim.to.y.toFixed(2)}px, 0) rotate(${endRotation.toFixed(2)}deg)`;
    autoPlayDragTargetTransformRef.current = targetTransform;

    if (isGamePaused) {
      if (autoPlayDragStartedAtRef.current > 0) {
        const elapsed = Math.max(0, performance.now() - autoPlayDragStartedAtRef.current);
        autoPlayDragRemainingMsRef.current = Math.max(0, autoPlayDragRemainingMsRef.current - elapsed);
        autoPlayDragStartedAtRef.current = 0;
      }
      const computedTransform = window.getComputedStyle(node).transform;
      node.style.transition = 'none';
      if (computedTransform && computedTransform !== 'none') {
        node.style.transform = computedTransform;
        autoPlayDragPausedTransformRef.current = computedTransform;
      } else {
        node.style.transform = autoPlayDragPausedTransformRef.current ?? initialTransform;
        autoPlayDragPausedTransformRef.current = node.style.transform;
      }
      return;
    }

    const remainingMs = Math.max(1, autoPlayDragRemainingMsRef.current || autoPlayDragAnim.durationMs);
    const resumeTransform = autoPlayDragPausedTransformRef.current ?? initialTransform;
    node.style.transition = 'none';
    node.style.transform = resumeTransform;

    autoPlayDragRafRef.current = window.requestAnimationFrame(() => {
      const activeNode = autoPlayDragNodeRef.current;
      if (!activeNode) return;
      activeNode.style.transition = `transform ${remainingMs}ms cubic-bezier(0.33, 1, 0.68, 1)`;
      activeNode.style.transform = targetTransform;
      autoPlayDragStartedAtRef.current = performance.now();
      autoPlayDragRemainingMsRef.current = remainingMs;
      autoPlayDragPausedTransformRef.current = null;
      autoPlayDragTimeoutRef.current = window.setTimeout(() => {
        const complete = autoPlayDragCompletionRef.current;
        autoPlayDragAnimIdRef.current = null;
        autoPlayDragStartedAtRef.current = 0;
        autoPlayDragRemainingMsRef.current = 0;
        autoPlayDragPausedTransformRef.current = null;
        autoPlayDragTargetTransformRef.current = null;
        autoPlayDragCompletionRef.current = null;
        autoPlayDragTimeoutRef.current = 0;
        complete?.();
        setAutoPlayDragAnim(null);
      }, remainingMs);
    });

    return () => {
      if (autoPlayDragRafRef.current) {
        window.cancelAnimationFrame(autoPlayDragRafRef.current);
        autoPlayDragRafRef.current = 0;
      }
      if (autoPlayDragTimeoutRef.current) {
        window.clearTimeout(autoPlayDragTimeoutRef.current);
        autoPlayDragTimeoutRef.current = 0;
      }
      if (node) {
        node.style.transition = 'none';
      }
    };
  }, [autoPlayDragAnim, isGamePaused]);
  const startAutoPlayDragAnimation = useCallback((
    card: CardType,
    source: AutoPlayDragSource,
    targetDropIndex: number,
    tableauIndex?: number,
    onComplete?: () => void
  ) => {
    if (batchFastMode) {
      onComplete?.();
      return;
    }
    const viewportRect = fitViewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return;
    const targetRect = autoPlayFoundationRefsRef.current[targetDropIndex]?.getBoundingClientRect();
    if (!targetRect) return;
    const sourceRect = source === 'hand'
      ? handZoneRef.current?.getBoundingClientRect()
      : autoPlayTableauRefsRef.current[tableauIndex ?? -1]?.getBoundingClientRect();
    if (!sourceRect) return;
    const pointerAnchorOffsetX = AUTO_PLAY_DRAG_CARD_WIDTH / 2;
    const pointerAnchorOffsetY = AUTO_PLAY_DRAG_CARD_HEIGHT / 2;
    const from = {
      x: sourceRect.left - viewportRect.left + sourceRect.width / 2 + pointerAnchorOffsetX,
      y: sourceRect.top - viewportRect.top + sourceRect.height / 2 + pointerAnchorOffsetY,
    };
    const to = {
      x: targetRect.left - viewportRect.left + targetRect.width / 2 + pointerAnchorOffsetX,
      y: targetRect.top - viewportRect.top + targetRect.height / 2 + pointerAnchorOffsetY,
    };
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    // Keep autoplay speed visibly coupled to drag travel time across all speed presets.
    // Multiplier slows all drag motion uniformly without changing autoplay decision cadence.
    const speedScale = Math.max(0.25, autoPlaySpeed) * Math.max(0.5, timeScale);
    const baseDurationMs = (360 + (distance * 0.9)) * AUTO_PLAY_DRAG_DURATION_MULTIPLIER;
    autoPlayDragCompletionRef.current = onComplete ?? null;
    setAutoPlayDragAnim({
      id: `autoplay-drag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      card,
      from,
      to,
      startedAtMs: performance.now(),
      durationMs: Math.max(
        90,
        Math.min(
          AUTO_PLAY_MAX_DRAG_DURATION_MS,
          Math.round(baseDurationMs / speedScale)
        )
      ),
    });
  }, [autoPlaySpeed, batchFastMode, timeScale]);
  const dropRefCallbacksRef = useRef<Record<number, (index: number, ref: HTMLDivElement | null) => void>>({});
  useEffect(() => {
    if (dragState.isDragging) return;
  }, [dragState.isDragging, lastDragEndAt]);
  // Register explicit drop indices so player and enemy foundations both participate in hit-testing.
  const getFoundationDropRef = useCallback((mappedIndex: number) => {
    if (!dropRefCallbacksRef.current[mappedIndex]) {
      dropRefCallbacksRef.current[mappedIndex] = (_componentIndex: number, ref: HTMLDivElement | null) => {
        autoPlayFoundationRefsRef.current[mappedIndex] = ref;
        setFoundationRef(mappedIndex, ref);
      };
    }
    return dropRefCallbacksRef.current[mappedIndex];
  }, [setFoundationRef]);
  const handleSandboxCardSelect = (card: CardType, selectedTableauIndex: number) => {
    actions.selectCard(card, selectedTableauIndex);
  };
  const handleSandboxTableauDragStart = (
    card: CardType,
    tableauIndex: number,
    clientX: number,
    clientY: number,
    rect: DOMRect
  ) => {
    if (interTurnCountdownActive) return;
    if (enforceTurnOwnership && effectiveActiveSide !== 'player') return;
    startDrag(card, tableauIndex, clientX, clientY, rect);
  };
  const handleSandboxHandDragStart = (
    card: CardType,
    _sourceIndex: number,
    clientX: number,
    clientY: number,
    rect: DOMRect
  ) => {
    if (interTurnCountdownActive) return;
    draggedHandCardRef.current = card;
    startDrag(card, HAND_SOURCE_INDEX, clientX, clientY, rect);
  };
  const handleSandboxHandClick = (card: CardType) => {
    if (gameState.interactionMode !== 'click') return;
    if (interTurnCountdownActive) return;
    if (!isHandCardPlayable(card)) return;
    const firstPlayableFoundation = validFoundationsForSelected.findIndex((value) => value);
    if (firstPlayableFoundation >= 0) {
      const accepted = actions.playFromHand(card, firstPlayableFoundation, useWild);
      if (accepted) setLocalTurnTimerActive(true);
    }
  };
  const handleRerollDeal = () => {
    const nextTableaus = createCombatStandardTableaus();
    setFallbackTableaus(nextTableaus);
    actions.setTableaus(nextTableaus);
  };
  const executeAutoPlayDecision = useCallback((
    entry: Omit<AutoPlayDecisionEntry, 'accepted' | 'at'>,
    run: () => boolean,
    options?: {
      recordRejected?: boolean;
      countRejectedAsStall?: boolean;
    }
  ) => {
    const accepted = run();
    if (accepted || options?.recordRejected !== false) {
      const stamped: AutoPlayDecisionEntry = {
        ...entry,
        accepted,
        at: Date.now(),
      };
      appendAutoPlayDecision(stamped);
      appendAutoPlayMoveAudit({
        kind: 'decision',
        detail: {
          label: entry.label,
          decisionKind: entry.kind,
          side: entry.side,
          score: entry.score,
          accepted,
        },
      });
    }
    if (accepted) {
      autoPlayStallRef.current = 0;
      setAutoPlayStalls(0);
      setLocalTurnTimerActive(true);
    } else if (options?.countRejectedAsStall !== false) {
      autoPlayStallRef.current += 1;
      setAutoPlayStalls(autoPlayStallRef.current);
    }
    return accepted;
  }, [appendAutoPlayDecision, appendAutoPlayMoveAudit]);
  const performAutoPlayStepRef = useRef<() => void>(() => {});
  const performAutoPlayStep = useCallback(() => {
    if (!autoPlayEnabled || isGamePaused || dragState.isDragging || interTurnCountdownActive || autoPlayDragAnim) return;
    if (!isLabMode) return;
    if (autoPlayBusyRef.current) return;
    autoPlayBusyRef.current = true;
    actions.cleanupDefeatedEnemies();
    try {
      runWithDeterministicRandom(autoPlayDeterministic, autoPlayRngStateRef, () => {
      appendAutoPlayMoveAudit({
        kind: 'step',
        detail: {
          reason: 'autoplay_step_start',
        },
      });
      const engineActiveSide = getCombatActiveSide(gameState);
      if (enforceTurnOwnership && useLocalTurnSide && engineActiveSide !== effectiveActiveSide) {
        actions.setActiveSide?.(effectiveActiveSide);
        appendAutoPlayDecision({
          side: 'system',
          kind: 'advance_turn',
          score: 1.1,
          label: `sync side ${engineActiveSide} -> ${effectiveActiveSide}`,
          accepted: true,
          at: Date.now(),
        });
        return;
      }

      const aliveEnemyTargets = enemyActors
        .map((actor, enemyIndex) => ({ actor, enemyIndex }))
        .filter((entry) => isActorAlive(entry.actor));
      const alivePlayerTargets = partyActors
        .map((actor, actorIndex) => ({ actor, actorIndex }))
        .filter((entry) => isActorAlive(entry.actor));
      const bestEnemyTarget = aliveEnemyTargets
        .slice()
        .sort((a, b) => (a.actor.hp ?? 0) - (b.actor.hp ?? 0))[0];
      const bestPlayerTarget = alivePlayerTargets
        .slice()
        .sort((a, b) => (a.actor.hp ?? 0) - (b.actor.hp ?? 0))[0];
      const policy = autoPlayPolicyProfile;

    type Candidate = {
      side: AutoPlayActorSide | 'system';
      kind: AutoPlayDecisionKind;
      score: number;
      label: string;
      run: () => boolean;
      drag?: {
        card: CardType;
        source: AutoPlayDragSource;
        targetDropIndex: number;
        tableauIndex?: number;
      };
    };
    const candidates: Candidate[] = [];
    const tryPlayerTableauPlay = (tableauIndex: number, foundationIndex: number): boolean => {
      if (isFoundationTableauLocked(foundationIndex)) return false;
      let accepted = actions.playFromTableau(tableauIndex, foundationIndex);
      if (!accepted) {
        accepted = actions.playFromTableau(tableauIndex, foundationIndex);
      }
      if (accepted) applyFoundationTimerBonus(foundationIndex);
      return accepted;
    };

    const scoreAbilityCard = (card: CardType, targetSide: AutoPlayActorSide, targetIndex: number): number => {
      const entry = card.rpgAbilityId ? abilityCatalogById.get(card.rpgAbilityId) : undefined;
      const effects = entry?.effects ?? [];
      let score = 8 * policy.tacticalWeight;
      let projectedDamage = 0;
      for (const effect of effects) {
        const normalizedType = String(effect.type ?? '').trim().toLowerCase();
        const value = Math.max(1, Number(effect.value ?? 1));
        const baseWeight = (AUTO_EFFECT_WEIGHTS[normalizedType] ?? 2.5) * policy.tacticalWeight;
        score += baseWeight * value;
        if (normalizedType === 'damage' || normalizedType === 'burn' || normalizedType === 'bleed' || normalizedType === 'stun') {
          projectedDamage += value;
        }
        if (effect.drawWild || effect.drawElement) score += 2.5 * policy.playerSupportBias;
        const effectTarget = String(effect.target ?? '').toLowerCase();
        if (targetSide === 'enemy' && (effectTarget === 'enemy' || effectTarget === 'all_enemies' || effectTarget === 'anyone')) {
          score += 5 * policy.playerAggro;
        }
        if (targetSide === 'player' && (effectTarget === 'self' || effectTarget === 'ally' || effectTarget === 'all_allies' || effectTarget === 'anyone')) {
          score += 4 * policy.playerSupportBias;
        }
      }
      if (isDeadRunOnlyAbilityCard(card) && noValidMovesForPlayer) score += 12 * policy.tacticalWeight;
      if (card.rpgCardKind === 'fast') score += 2.5 * policy.tacticalWeight;
      const apCost = Math.max(0, Number(card.rpgApCost ?? 0));
      score -= apCost * 1.4;
      score -= Math.max(0, Number(card.cooldown ?? 0)) * 2;
      if (targetSide === 'enemy') {
        const target = aliveEnemyTargets.find((entryItem) => entryItem.enemyIndex === targetIndex)?.actor;
        if (target && projectedDamage >= Math.max(1, Number(target.hp ?? 0))) score += 16 * policy.playerAggro;
      } else {
        const target = alivePlayerTargets.find((entryItem) => entryItem.actorIndex === targetIndex)?.actor;
        if (target && (target.hp ?? 0) <= Math.max(3, (target.hpMax ?? 0) * 0.4)) score += 8 * policy.playerSupportBias;
      }
      return score;
    };

    const canActAsPlayer = !enforceTurnOwnership || effectiveActiveSide === 'player';
    const canActAsEnemy = !enforceTurnOwnership || effectiveActiveSide === 'enemy';

    if (canActAsPlayer) {
      const playerFoundationForAnalysis = previewPlayerFoundations.filter((foundation) => foundation.length > 0);
      if (playerFoundationForAnalysis.length > 0) {
        const analysis = analyzeOptimalSequence({
          tableaus: previewTableaus,
          foundations: previewPlayerFoundations,
          activeEffects: gameState.activeEffects,
          mode: useWild ? 'wild' : 'standard',
        });
        const bestMove = analysis.sequence[0];
        const bestMoveIsLegal = !!bestMove
          && !isFoundationTableauLocked(bestMove.foundationIndex)
          && canPlayCardWithWild(
            bestMove.card,
            previewPlayerFoundations[bestMove.foundationIndex]?.[previewPlayerFoundations[bestMove.foundationIndex].length - 1],
            gameState.activeEffects
          );
        if (bestMoveIsLegal && bestMove) {
          const rankBoost = Math.max(0, Number(bestMove.card.rank ?? 0)) * 0.25;
          candidates.push({
            side: 'player',
            kind: 'player_tableau',
            score: (18 + analysis.maxCount * 4 + rankBoost) * policy.tacticalWeight,
            label: `t#${bestMove.tableauIndex} -> p#${bestMove.foundationIndex}`,
            run: () => tryPlayerTableauPlay(bestMove.tableauIndex, bestMove.foundationIndex),
            drag: {
              card: bestMove.card,
              source: 'tableau',
              targetDropIndex: bestMove.foundationIndex,
              tableauIndex: bestMove.tableauIndex,
            },
          });
        }
      }

      // Solver can occasionally return no move in lab snapshots where direct engine
      // play is still possible; add a low-priority brute-force fallback.
      for (let tableauIndex = 0; tableauIndex < previewTableaus.length; tableauIndex += 1) {
        const tableauCards = previewTableaus[tableauIndex] ?? [];
        const topCard = tableauCards[tableauCards.length - 1];
        if (!topCard) continue;
        for (let foundationIndex = 0; foundationIndex < previewPlayerFoundations.length; foundationIndex += 1) {
          const foundationCards = previewPlayerFoundations[foundationIndex] ?? [];
          if (isFoundationTableauLocked(foundationIndex)) continue;
          const actor = resolvePlayerFoundationActor(foundationIndex, previewPlayerFoundations[foundationIndex] ?? []);
          if (actor && !isActorAlive(actor)) continue;
          const topFoundationCard = foundationCards[foundationCards.length - 1];
          if (!canPlayCardWithWild(topCard, topFoundationCard, gameState.activeEffects)) continue;
          candidates.push({
            side: 'player',
            kind: 'player_tableau',
            score: (2.5 + Math.max(0, Number(topCard.rank ?? 0)) * 0.1) * policy.fallbackWeight,
            label: `brute t#${tableauIndex} -> p#${foundationIndex}`,
            run: () => tryPlayerTableauPlay(tableauIndex, foundationIndex),
            drag: {
              card: topCard,
              source: 'tableau',
              targetDropIndex: foundationIndex,
              tableauIndex,
            },
          });
        }
      }
    }

    if (canActAsEnemy) {
      if (actions.playEnemyRpgHandCardOnActor && bestPlayerTarget) {
        const enemyHands = ((gameState as GameState & { rpgEnemyHandCards?: CardType[][] }).rpgEnemyHandCards ?? []);
        enemyHands.forEach((handCards, enemyActorIndex) => {
          const enemyActor = enemyActors[enemyActorIndex];
          if (!isActorAlive(enemyActor)) return;
          handCards.forEach((card) => {
            if (!isDirectRpgAttackCard(card)) return;
            const baseScore = (12 + estimateRpgAttackPower(card) * 5) * policy.enemyAggro;
            candidates.push({
              side: 'enemy',
              kind: 'enemy_rpg_attack',
              score: baseScore + Math.max(0, ((bestPlayerTarget.actor.hpMax ?? 1) - (bestPlayerTarget.actor.hp ?? 0)) * 0.2),
              label: `${card.name ?? card.id} -> p#${bestPlayerTarget.actorIndex}`,
              run: () => actions.playEnemyRpgHandCardOnActor?.(enemyActorIndex, card.id, bestPlayerTarget.actorIndex) ?? false,
            });
          });
        });
      }

      const enemyFoundationForAnalysis = enemyFoundations.filter((foundation) => foundation.length > 0);
      const queuedEnemyTableauMoves = new Set<string>();
      if (enemyFoundationForAnalysis.length > 0) {
        const analysis = analyzeOptimalSequence({
          tableaus: previewTableaus,
          foundations: enemyFoundations,
          activeEffects: gameState.activeEffects,
          mode: useWild ? 'wild' : 'standard',
        });
        const bestMove = analysis.sequence[0];
        if (bestMove) {
          queuedEnemyTableauMoves.add(`${bestMove.tableauIndex}:${bestMove.foundationIndex}`);
          candidates.push({
            side: 'enemy',
            kind: 'enemy_tableau',
            score: (16 + analysis.maxCount * 3.5 + Math.max(0, Number(bestMove.card.rank ?? 0)) * 0.2) * policy.enemyAggro * policy.tacticalWeight,
            label: `t#${bestMove.tableauIndex} -> e#${bestMove.foundationIndex}`,
            run: () => actions.playEnemyFromTableau(bestMove.tableauIndex, bestMove.foundationIndex),
            drag: {
              card: bestMove.card,
              source: 'tableau',
              targetDropIndex: enemyFoundationDropBase + bestMove.foundationIndex,
              tableauIndex: bestMove.tableauIndex,
            },
          });
        }
      }

      for (let tableauIndex = 0; tableauIndex < previewTableaus.length; tableauIndex += 1) {
        const tableauCards = previewTableaus[tableauIndex] ?? [];
        const topCard = tableauCards[tableauCards.length - 1];
        if (!topCard) continue;
        for (let enemyFoundationIndex = 0; enemyFoundationIndex < enemyFoundations.length; enemyFoundationIndex += 1) {
          if ((enemyFoundations[enemyFoundationIndex]?.length ?? 0) === 0) continue;
          const actor = resolveEnemyFoundationActor(enemyFoundationIndex, enemyFoundations[enemyFoundationIndex] ?? []);
          if (actor && !isActorAlive(actor)) continue;
          const moveKey = `${tableauIndex}:${enemyFoundationIndex}`;
          if (queuedEnemyTableauMoves.has(moveKey)) continue;
          const topFoundationCard = enemyFoundations[enemyFoundationIndex]?.[enemyFoundations[enemyFoundationIndex].length - 1];
          if (!topFoundationCard) continue;
          if (!canPlayCardWithWild(topCard, topFoundationCard, gameState.activeEffects)) continue;
          const rankGap = Math.abs(Number(topCard.rank ?? 0) - Number(topFoundationCard?.rank ?? 0));
          const score = (9 + Math.max(0, Number(topCard.rank ?? 0)) * 0.12 - Math.min(6, rankGap) * 0.35) * policy.enemyAggro * policy.fallbackWeight;
          candidates.push({
            side: 'enemy',
            kind: 'enemy_tableau',
            score,
            label: `fallback t#${tableauIndex} -> e#${enemyFoundationIndex}`,
            run: () => actions.playEnemyFromTableau(tableauIndex, enemyFoundationIndex),
            drag: {
              card: topCard,
              source: 'tableau',
              targetDropIndex: enemyFoundationDropBase + enemyFoundationIndex,
              tableauIndex,
            },
          });
        }
      }
    }

    const sortedCandidates = [...candidates]
      .map((candidate) => ({
        candidate,
        tieBreaker: Math.random(),
      }))
      .sort((a, b) => {
        if (b.candidate.score !== a.candidate.score) return b.candidate.score - a.candidate.score;
        return a.tieBreaker - b.tieBreaker;
      })
      .map((entry) => entry.candidate);
    appendAutoPlayMoveAudit({
      kind: 'step',
      detail: {
        reason: 'candidates_built',
        candidateCount: sortedCandidates.length,
        topCandidates: sortedCandidates.slice(0, 5).map((candidate) => ({
          side: candidate.side,
          kind: candidate.kind,
          label: candidate.label,
          score: Number(candidate.score.toFixed(3)),
        })),
      },
    });
    for (const candidate of sortedCandidates) {
      const shouldHandoffEnemyAfterSinglePlay = (
        enforceTurnOwnership
        && effectiveActiveSide === 'enemy'
        && candidate.side === 'enemy'
        && currentDifficulty === 'normal'
      );
      const finalizeAcceptedDecision = () => {
        if (!shouldHandoffEnemyAfterSinglePlay) return;
        appendAutoPlayDecision({
          side: 'system',
          kind: 'advance_turn',
          score: 1.5,
          label: 'normal difficulty: handoff to player after enemy play',
          accepted: true,
          at: Date.now(),
        });
        if (useLocalTurnSide) {
          forceLocalTurnSide('player');
          actions.reshuffleTableaus();
        } else {
          actions.advanceTurn();
        }
      };
      if (candidate.drag) {
        startAutoPlayDragAnimation(
          candidate.drag.card,
          candidate.drag.source,
          candidate.drag.targetDropIndex,
          candidate.drag.tableauIndex,
          () => {
            const accepted = executeAutoPlayDecision(
              {
                side: candidate.side,
                kind: candidate.kind,
                score: candidate.score,
                label: candidate.label,
              },
              candidate.run,
              {
                recordRejected: false,
                countRejectedAsStall: false,
              }
            );
            if (accepted) finalizeAcceptedDecision();
          }
        );
      } else {
        const accepted = executeAutoPlayDecision(
          {
            side: candidate.side,
            kind: candidate.kind,
            score: candidate.score,
            label: candidate.label,
          },
          candidate.run,
          {
            recordRejected: false,
            countRejectedAsStall: false,
          }
        );
        if (!accepted) continue;
        finalizeAcceptedDecision();
      }
      return;
    }

    if ((gameState.phase === 'combat' || gameState.phase === 'playing') && actions.autoPlayNextMove) {
      executeAutoPlayDecision(
        {
          side: 'system',
          kind: 'player_tableau',
          score: 4,
          label: 'phase=combat autopilot',
        },
        () => {
          actions.autoPlayNextMove?.();
          return true;
        }
      );
      return;
    }

    // Last-chance player fallback: try direct legal tableau plays before handing off turn.
    if (enforceTurnOwnership && effectiveActiveSide === 'player') {
      for (let tableauIndex = 0; tableauIndex < previewTableaus.length; tableauIndex += 1) {
        const tableauCards = previewTableaus[tableauIndex] ?? [];
        if (tableauCards.length === 0) continue;
        for (let foundationIndex = 0; foundationIndex < previewPlayerFoundations.length; foundationIndex += 1) {
          const accepted = executeAutoPlayDecision(
            {
              side: 'player',
              kind: 'player_tableau',
              score: 0.85,
              label: `forced t#${tableauIndex} -> p#${foundationIndex}`,
            },
            () => tryPlayerTableauPlay(tableauIndex, foundationIndex),
            {
              recordRejected: false,
              countRejectedAsStall: false,
            }
          );
          if (accepted) return;
        }
      }
    }

    if (actions.completeEncounter) {
      const hasAnyTableauCards = previewTableaus.some((tableau) => tableau.length > 0);
      if (!hasAnyTableauCards) {
        executeAutoPlayDecision(
          {
            side: 'system',
            kind: 'advance_turn',
            score: 3,
            label: 'complete encounter',
          },
          () => {
            actions.completeEncounter?.();
            return true;
          }
        );
        return;
      }
    }

    if (enforceTurnOwnership) {
      executeAutoPlayDecision(
        {
          side: 'system',
          kind: 'advance_turn',
          score: 1,
          label: `turn -> ${effectiveActiveSide === 'player' ? 'enemy' : 'player'}`,
        },
        () => {
          if (useLocalTurnSide) {
            const nextSide: 'player' | 'enemy' = effectiveActiveSide === 'player' ? 'enemy' : 'player';
            forceLocalTurnSide(nextSide);
            if (nextSide === 'player') {
              actions.reshuffleTableaus();
            }
            return true;
          }
          actions.advanceTurn();
          return true;
        }
      );
      return;
    }

    const nextStalls = autoPlayStallRef.current + 1;
    autoPlayStallRef.current = nextStalls;
    setAutoPlayStalls(nextStalls);
    appendAutoPlayDecision({
      side: 'system',
      kind: 'wait',
      score: 0,
      label: 'no legal autoplay action',
      accepted: false,
      at: Date.now(),
    });
    if (nextStalls >= AUTO_PLAY_STALL_LIMIT) {
      executeAutoPlayDecision(
        {
          side: 'system',
          kind: 'advance_turn',
          score: 0.2,
          label: `stall guard (${nextStalls}): force encounter progress`,
        },
        () => {
          if (enforceTurnOwnership) {
            if (useLocalTurnSide) {
              const nextSide: 'player' | 'enemy' = effectiveActiveSide === 'player' ? 'enemy' : 'player';
              forceLocalTurnSide(nextSide);
              if (nextSide === 'player') {
                actions.reshuffleTableaus();
              }
            } else {
              actions.advanceTurn();
            }
            return true;
          }
          if (isCombatSessionActive(gameState)) {
            actions.endTurn();
            return true;
          }
          if ((gameState.phase === 'combat' || gameState.phase === 'playing') && actions.autoPlayNextMove) {
            actions.autoPlayNextMove();
            return true;
          }
          if (useWild && actions.endRestTurn) {
            actions.endRestTurn();
            return true;
          }
          return false;
        }
      );
    }
    return;
      });
    } finally {
      autoPlayBusyRef.current = false;
    }
  }, [
    actions,
    appendAutoPlayDecision,
    appendAutoPlayMoveAudit,
    applyFoundationTimerBonus,
    autoPlayEnabled,
    autoPlayDeterministic,
    dragState.isDragging,
    effectiveActiveSide,
    enforceTurnOwnership,
    enemyFoundationDropBase,
    enemyActors,
    enemyFoundations,
    executeAutoPlayDecision,
    forceLocalTurnSide,
    currentDifficulty,
    gameState.activeEffects,
    gameState.currentEncounterId,
    gameState.phase,
    interTurnCountdownActive,
    isDeadRunOnlyAbilityCard,
    isGamePaused,
    isHandCardPlayable,
    isLabMode,
    noValidMovesForPlayer,
    partyActors,
    previewHandCards,
    previewPlayerFoundations,
    previewTableaus,
    resolveEnemyFoundationActor,
    resolvePlayerFoundationActor,
    isFoundationTableauLocked,
    useLocalTurnSide,
    useWild,
    abilityCatalogById,
    startAutoPlayDragAnimation,
    autoPlayDragAnim,
    autoPlayPolicyProfile,
  ]);
  useEffect(() => {
    performAutoPlayStepRef.current = performAutoPlayStep;
  }, [performAutoPlayStep]);
  useEffect(() => {
    if (!open || !autoPlayEnabled || !isLabMode) return;
    const intervalId = window.setInterval(() => {
      performAutoPlayStepRef.current();
    }, effectiveAutoPlayStepMs);
    return () => window.clearInterval(intervalId);
  }, [autoPlayEnabled, effectiveAutoPlayStepMs, isLabMode, open]);
  useEffect(() => {
    if (!testSequenceRunning) return;
    if (effectiveActiveSide === 'player' && !interTurnCountdownActive) return;
    forceLocalTurnSide('player');
    setActiveSide?.('player');
    setPendingTurnSide(null);
    setPendingFinalMoveResolution(false);
    setInterTurnCountdownMs(0);
  }, [effectiveActiveSide, forceLocalTurnSide, interTurnCountdownActive, setActiveSide, testSequenceRunning]);
  useEffect(() => {
    if (!testSequenceRunning) return;
    if (testSequenceCurrentRun <= 0) return;
    if (dragState.isDragging || autoPlayDragAnim || interTurnCountdownActive) return;
    if (!noValidMovesForPlayer) return;
    if (testSequenceFinalizedRunRef.current === testSequenceCurrentRun) return;

    testSequenceFinalizedRunRef.current = testSequenceCurrentRun;

    setAutoPlayEnabled(false);
    const completedAt = performance.now();
    const { legalPlayerMovesByFoundation, legalEnemyMovesByFoundation } = buildAutoPlayLegalMoveCounts();
    const runMetrics = testSequenceRunMetricsRef.current;
    const finalTurnCounter = Math.max(
      runMetrics.observedTurnCounter,
      Number(gameState.lifecycleTurnCounter ?? gameState.turnCount ?? 0)
    );
    const runTurnsCompleted = finalTurnCounter;
    const result: AutoPlayBatchRunSummary = {
      run: testSequenceCurrentRun,
      startedAt: new Date(Date.now() - Math.max(0, Math.round(completedAt - testSequenceRunStartedAtRef.current))).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Math.max(0, Math.round(completedAt - testSequenceRunStartedAtRef.current)),
      turnsCompleted: runTurnsCompleted,
      playerTurnsStarted: runMetrics.playerTurnsStarted,
      enemyTurnsStarted: runMetrics.enemyTurnsStarted,
      playerCardsPlayed: runMetrics.playerCardsPlayed,
      enemyCardsPlayed: runMetrics.enemyCardsPlayed,
      peakLegalPlayerMoves: Math.max(runMetrics.peakLegalPlayerMoves, legalPlayerMovesByFoundation.reduce((sum, value) => sum + value, 0)),
      peakLegalEnemyMoves: Math.max(runMetrics.peakLegalEnemyMoves, legalEnemyMovesByFoundation.reduce((sum, value) => sum + value, 0)),
      finalTurnNumber: Math.max(1, finalTurnCounter + 1),
      completionReason: 'dead_tableau',
      deadTableauReached: true,
      noValidMovesPlayer: true,
      remainingTableauDepths: previewTableaus.map((tableau) => tableau.length),
      playerTableauTopRanks: previewTableaus.map((tableau) => tableau[tableau.length - 1]?.rank ?? null),
      playerFoundationTopRanks: previewPlayerFoundations.map((foundation) => foundation[foundation.length - 1]?.rank ?? null),
      legalPlayerMovesByFoundation,
      totalLegalPlayerMoves: legalPlayerMovesByFoundation.reduce((sum, value) => sum + value, 0),
      traceTail: autoPlayTrace.slice(0, 12),
      moveAuditTail: autoPlayMoveAuditRef.current.slice(0, 40),
    };
    console.log('[combat-lab test sequence run]', result);
    setTestSequenceResults((prev) => {
      const next = [...prev, result];
      const done = next.length >= testSequenceRequestedRuns;
      if (done) {
        setTestSequenceRunning(false);
        setTestSequenceCompleted(true);
        const globalWindow = window as Window & { __combatLabLastTestSequence?: unknown };
        globalWindow.__combatLabLastTestSequence = buildTestSequencePayload(next);
      } else {
        if (testSequenceResetTimeoutRef.current) {
          window.clearTimeout(testSequenceResetTimeoutRef.current);
        }
        testSequenceResetTimeoutRef.current = window.setTimeout(() => {
          resetTestSequenceRun(next.length + 1);
        }, batchFastMode ? 0 : 220);
      }
      return next;
    });
  }, [
    batchFastMode,
    autoPlayDragAnim,
    autoPlayTrace,
    buildAutoPlayLegalMoveCounts,
    buildTestSequencePayload,
    dragState.isDragging,
    interTurnCountdownActive,
    noValidMovesForPlayer,
    previewPlayerFoundations,
    previewTableaus,
    resetTestSequenceRun,
    testSequenceCurrentRun,
    testSequenceRequestedRuns,
    testSequenceRunning,
  ]);
  useEffect(() => {
    return () => {
      if (testSequenceResetTimeoutRef.current) {
        window.clearTimeout(testSequenceResetTimeoutRef.current);
      }
    };
  }, []);
  useEffect(() => {
    resetAutoPlayDeterministicRng();
  }, [autoPlaySeed, resetAutoPlayDeterministicRng]);
  useEffect(() => {
    if (autoPlayEnabled) return;
    autoPlayStallRef.current = 0;
    setAutoPlayStalls(0);
  }, [autoPlayEnabled]);
  useEffect(() => {
    const wasEnabled = autoPlayWasEnabledRef.current;
    if (!wasEnabled && autoPlayEnabled) {
      autoPlayReplayStartSnapshotRef.current = buildAutoPlayReplaySnapshot(gameState);
      setAutoPlayTrace([]);
      setAutoPlayLastDecision(null);
    }
    autoPlayWasEnabledRef.current = autoPlayEnabled;
  }, [autoPlayEnabled, buildAutoPlayReplaySnapshot, gameState]);
  useEffect(() => {
    if (!autoPlayEnabled) return;
    autoPlayStallRef.current = 0;
    setAutoPlayStalls(0);
    if (autoPlayDeterministic) {
      resetAutoPlayDeterministicRng();
    }
  }, [autoPlayDeterministic, autoPlayEnabled, resetAutoPlayDeterministicRng]);
  useEffect(() => {
    if (open || !autoPlayEnabled) return;
    setAutoPlayEnabled(false);
  }, [autoPlayEnabled, open]);
  useEffect(() => {
    if (!open) {
      worldEventSeenRef.current = '';
      setWorldEventBanner(null);
      return;
    }
    const worldEvent = getCombatLastWorldEvent(gameState);
    if (!worldEvent || !worldEvent.id || !Number.isFinite(worldEvent.at)) return;
    const token = `${worldEvent.id}:${worldEvent.at}`;
    if (worldEventSeenRef.current === token) return;
    worldEventSeenRef.current = token;
    setWorldEventBanner({
      token,
      label: worldEvent.label || 'World Event',
      detail: worldEvent.detail,
    });
    const timeoutId = window.setTimeout(() => {
      setWorldEventBanner((prev) => (prev?.token === token ? null : prev));
    }, 1900);
    return () => window.clearTimeout(timeoutId);
  }, [
    gameState.combatLastWorldEvent?.at,
    gameState.combatLastWorldEvent?.detail,
    gameState.combatLastWorldEvent?.id,
    gameState.combatLastWorldEvent?.label,
    open,
  ]);
  useEffect(() => {
    if (!open || !isLabMode) return;
    const foundations = gameState.foundations ?? [];
    const firstThree = foundations.slice(0, 3);
    const hasVisibleSeededFoundations = firstThree.length === 3 && firstThree.every((stack) => (stack?.length ?? 0) > 0);
    if (hasVisibleSeededFoundations) {
      labFoundationSeedTokenRef.current = '';
      return;
    }
    const seedToken = `seeded-foundations:${firstThree.map((stack) => stack?.length ?? 0).join(',')}`;
    if (labFoundationSeedTokenRef.current === seedToken) return;
    labFoundationSeedTokenRef.current = seedToken;
    actions.setFoundations(buildLabSeededFoundations(foundations, labFoundationActors));
  }, [actions, gameState.foundations, isLabMode, labFoundationActors, open]);
  useEffect(() => {
    if (!open || !isLabMode) return;
    const tableaus = gameState.tableaus ?? [];
    const hasCards = tableaus.some((t) => (t?.length ?? 0) > 0);
    if (hasCards) return;
    actions.setTableaus(fallbackTableaus);
  }, [actions, fallbackTableaus, gameState.tableaus, isLabMode, open]);
  // Lab-only: keep tableau depth replenished to COMBAT_STANDARD_TABLEAU_DEPTH after plays.
  useEffect(() => {
    if (!isLabMode) return;
    const tableaus = gameState.tableaus ?? [];
    if (tableaus.length === 0) return;
    let changed = false;
    const next = tableaus.map((t, tableauIndex) => {
      const arr = [...t];
      while (arr.length < COMBAT_STANDARD_TABLEAU_DEPTH) {
        // Preserve the currently revealed top card by backfilling from the bottom.
        arr.unshift(createCombatStandardCard(tableauIndex, arr.length, COMBAT_STANDARD_TABLEAU_DEPTH));
        changed = true;
      }
      return arr;
    });
    if (changed) {
      setFallbackTableaus(next);
      actions.setTableaus(next);
    }
  }, [actions, gameState.tableaus, isLabMode]);
  useEffect(() => {
    if (hasRenderableGameTableaus) {
      setFallbackTableaus((prev) => {
        if (toTableauSignature(prev) === gameTableauSignature) return prev;
        return gameTableaus.map((tableau) => [...tableau]);
      });
    }
  }, [gameTableauSignature, gameTableaus, hasRenderableGameTableaus, toTableauSignature]);
  useEffect(() => {
    if (!open) {
      autoFitMultiplierRef.current = 1;
      setAutoFitMultiplier(1);
      return;
    }
    const viewportEl = fitViewportRef.current;
    const contentEl = fitContentRef.current;
    if (!viewportEl || !contentEl) return;

    let rafId = 0;
    let scheduled = false;

    const recalc = () => {
      scheduled = false;
      const viewport = fitViewportRef.current;
      const content = fitContentRef.current;
      if (!viewport || !content) return;
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;
      const contentWidth = content.scrollWidth;
      const contentHeight = content.scrollHeight;
      if (viewportWidth <= 0 || viewportHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) return;
      const availableWidth = Math.max(1, viewportWidth - ARENA_FIT_PADDING_X);
      const availableHeight = Math.max(1, viewportHeight - ARENA_FIT_PADDING_Y);
      const ratio = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
      const next = Math.max(ARENA_MIN_SCALE, Math.min(1, ratio));
      if (Math.abs(next - autoFitMultiplierRef.current) > 0.01) {
        autoFitMultiplierRef.current = next;
        setAutoFitMultiplier(next);
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(recalc);
    };

    const observer = new ResizeObserver(() => schedule());
    observer.observe(viewportEl);
    if (!isLabMode) {
      observer.observe(contentEl);
    }
    schedule();

    return () => {
      observer.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [open, previewTableauShapeSignature, previewFoundationShapeSignature, previewHandCards.length, isLabMode]);
  useEffect(() => {
    if (!open) {
      setHudFps(0);
      return;
    }

    let rafId = 0;
    let frameCount = 0;
    let lastSampleTime = performance.now();
    let lastFrameTime = lastSampleTime;

    const tick = (now: number) => {
      const frameDelta = Math.max(0, now - lastFrameTime);
      lastFrameTime = now;
      pushPerfSample(frameDeltaSamplesRef.current, frameDelta);
      frameCount += 1;
      const elapsed = now - lastSampleTime;
      if (elapsed >= 500) {
        const nextFps = Math.max(0, Math.round((frameCount * 1000) / elapsed));
        setHudFps(nextFps);
        frameCount = 0;
        lastSampleTime = now;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [open]);
  useEffect(() => {
    if (!open || !useLocalTurnSide) return;
    localTurnRemainingRef.current = turnDurationMs;
    displayTurnRemainingRef.current = turnDurationMs;
    setLabTurnSide('player');
    setActiveSide?.('player');
    setPendingTurnSide(null);
    setPendingFinalMoveResolution(false);
    setInterTurnCountdownMs(0);
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(turnDurationMs);
    }
    setLocalTurnTimerActive(false);
    syncTurnBarWidths(turnDurationMs);
  }, [open, setActiveSide, syncTurnBarWidths, turnDurationMs, useLocalTurnSide]);
  useEffect(() => {
    localTurnRemainingRef.current = turnDurationMs;
    displayTurnRemainingRef.current = turnDurationMs;
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(turnDurationMs);
    }
    setLocalTurnTimerActive(false);
    setPendingTurnSide(null);
    setPendingFinalMoveResolution(false);
    setInterTurnCountdownMs(0);
    syncTurnBarWidths(turnDurationMs);
    lastTurnCardCountsRef.current = {
      player: gameState.combatFlowTelemetry?.playerCardsPlayed ?? 0,
      enemy: gameState.combatFlowTelemetry?.enemyCardsPlayed ?? 0,
    };
  }, [activeSide, turnDurationMs, gameState.combatFlowTelemetry?.enemyCardsPlayed, gameState.combatFlowTelemetry?.playerCardsPlayed, syncTurnBarWidths]);
  useEffect(() => {
    if (!open || !useLocalTurnSide) return;
    if (!pendingFinalMoveResolution) return;
    if (dragState.isDragging) return;
    setPendingFinalMoveResolution(false);
    setLabTurnSide('enemy');
    setActiveSide?.('enemy');
    localTurnRemainingRef.current = turnDurationMs;
    displayTurnRemainingRef.current = turnDurationMs;
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(turnDurationMs);
    }
    setPendingTurnSide(null);
    setInterTurnCountdownMs(0);
    setLocalTurnTimerActive(true);
    syncTurnBarWidths(turnDurationMs);
  }, [dragState.isDragging, open, pendingFinalMoveResolution, setActiveSide, syncTurnBarWidths, turnDurationMs, useLocalTurnSide]);
  useEffect(() => {
    if (useLocalTurnSide) return;
    const playerCount = gameState.combatFlowTelemetry?.playerCardsPlayed ?? 0;
    const enemyCount = gameState.combatFlowTelemetry?.enemyCardsPlayed ?? 0;
    const prior = lastTurnCardCountsRef.current;
    if (!localTurnTimerActive) {
      const activeCount = activeSide === 'player' ? playerCount : enemyCount;
      const priorActive = activeSide === 'player' ? prior.player : prior.enemy;
      if (activeCount > priorActive) {
        setLocalTurnTimerActive(true);
      }
    }
    lastTurnCardCountsRef.current = { player: playerCount, enemy: enemyCount };
  }, [activeSide, gameState.combatFlowTelemetry?.enemyCardsPlayed, gameState.combatFlowTelemetry?.playerCardsPlayed, localTurnTimerActive, useLocalTurnSide]);
  useEffect(() => {
    if (!open || !showTurnTimer) return;
    localTurnTickRef.current = performance.now();
    const canPaintTurnBars = () => !DISABLE_TURN_BAR_ANIMATION;
    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.max(0, now - localTurnTickRef.current);
      localTurnTickRef.current = now;
      const pauseTimeDuringDrag = dragState.isDragging && masterStrategistRelicEnabled;
      if (isGamePaused || pauseTimeDuringDrag) {
        return;
      }
      if (localTurnTimerActive && !interTurnCountdownActive && !zenRelicEnabled) {
        const delta = elapsed * Math.max(0, timeScale);
        const nextRemaining = Math.max(0, localTurnRemainingRef.current - delta);
        localTurnRemainingRef.current = nextRemaining;
        if (canPaintTurnBars()) {
          syncTurnBarWidths(nextRemaining);
        }
        if (nextRemaining <= 0) {
          if (useLocalTurnSide) {
            setLocalTurnTimerActive(false);
            if (labTurnSide === 'player' && dragState.isDragging && finalMoveRelicEnabled) {
              localTurnRemainingRef.current = 0;
              displayTurnRemainingRef.current = 0;
              if (!DISABLE_TURN_BAR_ANIMATION) {
                setLocalTurnRemainingMs(0);
              }
              setPendingTurnSide(null);
              setInterTurnCountdownMs(0);
              setPendingFinalMoveResolution(true);
              if (canPaintTurnBars()) {
                syncTurnBarWidths(0);
              }
            } else if (labTurnSide === 'player') {
              setLabTurnSide('enemy');
              actions.setActiveSide?.('enemy');
              localTurnRemainingRef.current = turnDurationMs;
              displayTurnRemainingRef.current = turnDurationMs;
              if (!DISABLE_TURN_BAR_ANIMATION) {
                setLocalTurnRemainingMs(turnDurationMs);
              }
              setPendingTurnSide(null);
              setInterTurnCountdownMs(0);
              setLocalTurnTimerActive(true);
              if (canPaintTurnBars()) {
                syncTurnBarWidths(turnDurationMs);
              }
            } else {
              setPendingTurnSide('player');
              setInterTurnCountdownMs(INTER_TURN_COUNTDOWN_MS);
              if (canPaintTurnBars()) {
                syncTurnBarWidths(INTER_TURN_COUNTDOWN_MS, INTER_TURN_COUNTDOWN_MS);
              }
            }
          } else {
            displayTurnRemainingRef.current = 0;
            if (!DISABLE_TURN_BAR_ANIMATION) {
              setLocalTurnRemainingMs(0);
            }
            setLocalTurnTimerActive(false);
          }
        } else if (
          canPaintTurnBars() && (
            Math.abs(nextRemaining - displayTurnRemainingRef.current) >= TURN_TIMER_TICK_MS
            || nextRemaining === turnDurationMs
          )
        ) {
          displayTurnRemainingRef.current = nextRemaining;
          setLocalTurnRemainingMs(nextRemaining);
        }
      }
      if (useLocalTurnSide && interTurnCountdownActive && pendingTurnSide) {
        const countdownNext = Math.max(0, interTurnCountdownMs - elapsed * Math.max(0, timeScale));
        setInterTurnCountdownMs(countdownNext);
        if (canPaintTurnBars()) {
          syncTurnBarWidths(countdownNext, INTER_TURN_COUNTDOWN_MS);
        }
        if (countdownNext <= 0) {
          setLabTurnSide(pendingTurnSide);
          actions.setActiveSide?.(pendingTurnSide);
          setPendingTurnSide(null);
          setInterTurnCountdownMs(0);
          localTurnRemainingRef.current = turnDurationMs;
          displayTurnRemainingRef.current = turnDurationMs;
          if (!DISABLE_TURN_BAR_ANIMATION) {
            setLocalTurnRemainingMs(turnDurationMs);
          }
          setLocalTurnTimerActive(true);
          if (canPaintTurnBars()) {
            syncTurnBarWidths(turnDurationMs);
          }
        }
      }
    }, TURN_TIMER_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [actions, dragState.isDragging, finalMoveRelicEnabled, interTurnCountdownActive, interTurnCountdownMs, isGamePaused, labTurnSide, localTurnTimerActive, masterStrategistRelicEnabled, open, pendingTurnSide, showTurnTimer, syncTurnBarWidths, timeScale, turnDurationMs, useLocalTurnSide, zenRelicEnabled]);
  useRpgCombatTicker({
    enabled: open,
    paused: isGamePaused || (dragState.isDragging && masterStrategistRelicEnabled),
    timeScale,
    tickAction: actions.tickRpgCombat,
    intervalMs: RPG_TICK_INTERVAL_MS,
    onTickDurationMs: (durationMs) => {
      pushPerfSample(rpgTickDurationSamplesRef.current, durationMs);
    },
    resetClockDeps: [open, actions.tickRpgCombat],
  });
  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          pushPerfSample(longTaskDurationSamplesRef.current, entry.duration);
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      return undefined;
    }
    return () => observer?.disconnect();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    if (configCollapsed) return;
    const intervalId = window.setInterval(() => {
      const dragPerf = getPerfSnapshot();
      const fpsPerf = summarizeFpsFromFrameTimes(frameDeltaSamplesRef.current);
      const dropTotalPerf = summarizePerfSamples(dropTotalDurationSamplesRef.current);
      const dropActionPerf = summarizePerfSamples(dropActionDurationSamplesRef.current);
      const rpgTickPerf = summarizePerfSamples(rpgTickDurationSamplesRef.current);
      const reactCommitPerf = summarizePerfSamples(reactCommitDurationSamplesRef.current);
      const longTaskPerf = summarizePerfSamples(longTaskDurationSamplesRef.current);
      setPerfSnapshot({
        fpsAvg: fpsPerf.avg,
        fpsP95: fpsPerf.p95,
        fpsWorst: fpsPerf.worst,
        dragMoveP95: dragPerf.moveP95Ms,
        dragMoveAvg: dragPerf.moveAvgMs,
        dragEndP95: dragPerf.endP95Ms,
        dropTotalP95: dropTotalPerf.p95,
        dropActionP95: dropActionPerf.p95,
        rpgTickP95: rpgTickPerf.p95,
        reactCommitP95: reactCommitPerf.p95,
        longTaskP95: longTaskPerf.p95,
        longTaskMax: longTaskPerf.max,
      });
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [configCollapsed, getPerfSnapshot, open]);
  useEffect(() => {
    if (!open) return;
    const target = tableauBandRef.current;
    if (!target) return;
    const update = () => {
      const next = Math.max(240, Math.round(target.getBoundingClientRect().width + PLAYER_TURN_BAR_BUFFER_PX));
      setTableauBandWidthPx(next);
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, previewTableaus.length]);
  const lifecycleCounters = useMemo(() => ({
    run: Math.max(1, Number(gameState.lifecycleRunCounter ?? 1)),
    battle: Math.max(0, Number(gameState.lifecycleBattleCounter ?? 0)),
    turn: Math.max(0, Number(gameState.lifecycleTurnCounter ?? getCombatTurnNumber(gameState) ?? gameState.turnCount ?? 0)),
    rest: Math.max(0, Number(gameState.lifecycleRestCounter ?? gameState.globalRestCount ?? 0)),
  }), [
    gameState.globalRestCount,
    gameState.lifecycleBattleCounter,
    gameState.lifecycleRestCounter,
    gameState.lifecycleRunCounter,
    gameState.lifecycleTurnCounter,
    gameState.combatTurnNumber,
    gameState.turnCount,
  ]);
  const lifecycleDebugRows = useMemo(() => {
    const seenDeckCardIds = new Set<string>();
    return previewHandCards
      .filter((card) => !!card.sourceDeckCardId)
      .filter((card) => {
        const deckCardId = card.sourceDeckCardId as string;
        if (seenDeckCardIds.has(deckCardId)) return false;
        seenDeckCardIds.add(deckCardId);
        return true;
      })
      .map((card) => {
        const deckCardId = card.sourceDeckCardId as string;
        const abilityId = card.rpgAbilityId;
        const definition = abilityId ? gameState.orimDefinitions.find((entry) => entry.id === abilityId) : undefined;
        const catalog = abilityId ? abilityCatalogById.get(abilityId) : undefined;
        const lifecycle = definition?.lifecycle ?? catalog?.lifecycle;
        if (!lifecycle) return null;
        const normalized = normalizeLifecycleForPreview(lifecycle);
        const usage = gameState.abilityLifecycleUsageByDeckCard?.[deckCardId];
        const canUse = canUseDeckCardLifecycleForPreview(gameState, deckCardId, lifecycle);
        const scopeUsage = (() => {
          if (normalized.exhaustScope === 'none' || normalized.maxUsesPerScope <= 0) return '--';
          const scopeCounter = getLifecycleCounterForPreview(gameState, normalized.exhaustScope);
          const used = getLifecycleScopeUsageForPreview(usage, normalized.exhaustScope, scopeCounter);
          return `${used}/${normalized.maxUsesPerScope}`;
        })();
        const turnsRemaining = (() => {
          if (normalized.cooldownMode !== 'turns' || normalized.cooldownValue <= 0) return 0;
          const readyAt = Math.max(0, Number(usage?.turnCooldownReadyAt ?? 0));
          const currentTurn = lifecycleCounters.turn;
          const baseline = Math.max(0, readyAt - currentTurn);
          if (baseline <= 0) return 0;
          if (normalized.cooldownResetsOn === 'battle_end') {
            const stamped = Number(usage?.turnCooldownBattleCounter ?? -1);
            if (stamped >= 0 && stamped !== lifecycleCounters.battle) return 0;
          }
          if (normalized.cooldownResetsOn === 'rest') {
            const stamped = Number(usage?.turnCooldownRestCounter ?? -1);
            if (stamped >= 0 && stamped !== lifecycleCounters.rest) return 0;
          }
          return baseline;
        })();
        const actorLabel = card.sourceActorId ? card.sourceActorId.slice(0, 8) : 'actor';
        const abilityLabel = card.name ?? abilityId ?? deckCardId;
        return {
          key: `${deckCardId}-${abilityId ?? 'ability'}`,
          label: `${actorLabel}:${abilityLabel}`,
          scope: normalized.exhaustScope === 'none' ? 'none' : normalized.exhaustScope,
          usage: scopeUsage,
          turnsRemaining,
          canUse,
        };
      })
      .filter((entry): entry is { key: string; label: string; scope: string; usage: string; turnsRemaining: number; canUse: boolean } => !!entry)
      .slice(0, 5);
  }, [
    abilityCatalogById,
    gameState,
    lifecycleCounters.battle,
    lifecycleCounters.rest,
    lifecycleCounters.turn,
    previewHandCards,
  ]);
  const configPanelWidth = configCollapsed ? 34 : 180;
  const showCombatHud = !atmosphereOnlyMode;
  const effectiveConfigPanelWidth = showCombatHud ? configPanelWidth : 0;
  const useInlineLabLayout = isLabMode;
  const shellClassName = useInlineLabLayout ? 'fixed inset-0 z-[10014] flex bg-black/95' : '';
  const configPanelClassName = useInlineLabLayout
    ? `order-2 h-full shrink-0 border-l border-game-gold/30 bg-black/88 ${configCollapsed ? 'p-[5px]' : 'p-3'} text-[10px] font-mono text-game-white menu-text overflow-y-auto transition-[width] duration-200`
    : `fixed top-[56px] bottom-4 right-4 z-[10015] max-w-[calc(50vw-1rem)] rounded-lg border border-game-gold/40 bg-black/85 ${configCollapsed ? 'p-[5px]' : 'p-3'} text-[10px] font-mono text-game-white shadow-[0_12px_40px_rgba(0,0,0,0.75)] backdrop-blur-sm menu-text overflow-y-auto transition-[width] duration-200`;
  const arenaDockClassName = useInlineLabLayout
    ? 'order-1 h-full min-w-0 flex-1 p-3'
    : 'fixed top-[56px] bottom-4 left-4 z-[10014] flex items-center justify-center';
  const arenaDockStyle = useInlineLabLayout
    ? undefined
    : {
      width: `calc(100vw - (${effectiveConfigPanelWidth}px + 3rem))`,
    };
  const arenaPanelClassName = useInlineLabLayout
    ? 'relative h-full w-full flex flex-col overflow-hidden text-[10px] font-mono text-game-white menu-text'
    : 'relative rounded-lg border border-game-teal/30 bg-black/90 p-3 text-[10px] font-mono text-game-white shadow-[0_12px_40px_rgba(0,0,0,0.75)] backdrop-blur-sm menu-text h-full w-full flex flex-col overflow-hidden';
  const activeAiTurnLabel = effectiveActiveSide === 'enemy' ? 'Enemy AI Turn' : 'Player AI Turn';
  const totalTurnsCompleted = Math.max(
    0,
    Number(getCombatTurnNumber(gameState) ?? gameState.lifecycleTurnCounter ?? gameState.turnCount ?? 0) - 1
  );

  return (
    <Profiler id="CombatSandbox" onRender={handleSandboxProfilerRender}>
    <div className={shellClassName}>
      {showCombatHud && (
      <div className={configPanelClassName} style={{ width: configPanelWidth }}>
      <div className={`${configCollapsed ? 'mb-0' : 'mb-2'} flex items-center justify-between`}>
        {!configCollapsed && (
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-game-gold">config</div>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!configCollapsed && (
            <button
              type="button"
              onClick={() => onOpenEditor?.()}
              className="rounded border border-game-teal/50 bg-game-bg-dark/80 px-2 py-0.5 text-[11px] text-game-teal hover:border-game-teal hover:text-game-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Open editor"
              aria-label="Open editor"
              disabled={!onOpenEditor}
            >
              ✎
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfigCollapsed((prev) => !prev)}
            className={`rounded border border-game-gold/40 bg-game-bg-dark/80 text-[11px] text-game-gold hover:border-game-gold hover:text-game-white transition-colors ${configCollapsed ? 'h-5 w-5 p-0' : 'px-2 py-0.5'}`}
            title={configCollapsed ? 'Expand config' : 'Collapse config'}
            aria-label={configCollapsed ? 'Expand config' : 'Collapse config'}
          >
            {configCollapsed ? '▸' : '▾'}
          </button>
        </div>
      </div>

      {!configCollapsed && (
      <>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded border border-game-teal/30 bg-game-bg-dark/60 p-2 text-[9px] text-game-teal/90">
        <div>Phase: {gameState.phase}</div>
        <div>Side: {effectiveActiveSide}</div>
        <div>Encounter: {gameState.currentEncounterId ?? '--'}</div>
        <div>Turn: {getCombatTurnNumber(gameState) ?? '--'}</div>
        <div>Enemies: {enemyCount}</div>
        <div>Enemy stacks: {enemyFoundationCount}</div>
        <div>Hand: {previewHandCards.length}</div>
        <div>Time: x{timeScale.toFixed(1)}</div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => actions.setCombatFlowMode(combatFlowMode === 'turn_based_pressure' ? 'real_time_shared' : 'turn_based_pressure')}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          Flow: {combatFlowMode === 'turn_based_pressure' ? 'Turn' : 'Real-time'}
        </button>
        <div className="rounded border border-game-teal/30 px-2 py-1 text-[9px] text-game-teal/85">
          Timer: {showTurnTimer ? (zenRelicEnabled ? '∞' : `${Math.ceil(turnRemainingMs / 1000)}s`) : 'off'}
        </div>
      </div>
      <div className="mb-3 rounded border border-game-teal/25 bg-game-bg-dark/50 px-2 py-1 text-[9px] text-game-teal/75">
        P/E turns: {gameState.combatFlowTelemetry?.playerTurnsStarted ?? 0}/{gameState.combatFlowTelemetry?.enemyTurnsStarted ?? 0} ·
        timeouts: {gameState.combatFlowTelemetry?.playerTimeouts ?? 0}/{gameState.combatFlowTelemetry?.enemyTimeouts ?? 0}
      </div>
      <div className="mb-3 rounded border border-game-teal/25 bg-game-bg-dark/45 px-2 py-1 text-[9px] text-game-teal/80">
        <div className="mb-1 uppercase tracking-[0.14em] text-game-teal/70">Auto Play</div>
        <div className="flex items-center justify-between">
          <span>Status</span>
          <span>{autoPlayEnabled ? (batchFastMode ? 'active · batch fast' : `active · ${autoPlayStepMs}ms`) : 'off'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Cadence</span>
          <span>x{autoPlaySpeed.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Policy</span>
          <span>{autoPlayPolicyProfile.id}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Stalls</span>
          <span>{autoPlayStalls}/{AUTO_PLAY_STALL_LIMIT}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Deterministic</span>
          <button
            type="button"
            onClick={() => setAutoPlayDeterministic((prev) => !prev)}
            className={`rounded border px-1.5 py-0 text-[8px] uppercase tracking-[0.12em] transition-colors ${autoPlayDeterministic ? 'border-game-gold/60 text-game-gold' : 'border-game-teal/40 text-game-teal/80'}`}
          >
            {autoPlayDeterministic ? 'on' : 'off'}
          </button>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[8px]">
          <input
            type="number"
            min={0}
            step={1}
            value={autoPlaySeed}
            onChange={(event) => {
              const raw = Number(event.target.value);
              const nextSeed = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
              setAutoPlaySeed(nextSeed);
            }}
            className="w-[72px] rounded border border-game-teal/30 bg-black/60 px-1 py-0.5 text-[8px] text-game-teal"
            title="Deterministic seed"
            aria-label="Deterministic autoplay seed"
          />
          <button
            type="button"
            onClick={() => resetAutoPlayDeterministicRng()}
            className="rounded border border-game-teal/35 px-1.5 py-0 text-[8px] text-game-teal hover:border-game-teal/70"
            title="Reset deterministic RNG state from seed"
          >
            reset rng
          </button>
          <span className="ml-auto text-game-teal/65">rng {autoPlayRngStateRef.current}</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={handleExportAutoPlayReplay}
            className="rounded border border-game-teal/35 px-1.5 py-0.5 text-[8px] text-game-teal hover:border-game-teal/70"
          >
            Export Replay
          </button>
          <button
            type="button"
            onClick={() => { void handleImportAutoPlayReplay(); }}
            className="rounded border border-game-teal/35 px-1.5 py-0.5 text-[8px] text-game-teal hover:border-game-teal/70"
          >
            Import Replay
          </button>
        </div>
        <div className="mt-1 min-h-[12px] text-[8px] text-game-teal/65">
          {autoPlayReplayNotice}
        </div>
        <div className="mt-1 border-t border-game-teal/20 pt-1 text-[8px] leading-tight text-game-teal/70">
          {autoPlayLastDecision ? summarizeAutoPlayEntry(autoPlayLastDecision) : 'No decision yet'}
        </div>
        {autoPlayTrace.length > 0 && (
          <div className="mt-1 space-y-0.5 text-[8px] text-game-teal/60">
            {autoPlayTrace.slice(0, 3).map((entry) => (
              <div key={`autoplay-trace-${entry.at}-${entry.kind}`}>{summarizeAutoPlayEntry(entry)}</div>
            ))}
          </div>
        )}
      </div>
      <div className="mb-3 rounded border border-game-teal/25 bg-game-bg-dark/45 px-2 py-1 text-[9px] text-game-teal/80">
        <div className="mb-1 uppercase tracking-[0.14em] text-game-teal/70">Lifecycle</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8px]">
          <div>Run/Battle</div>
          <div className="text-right">{lifecycleCounters.run}/{lifecycleCounters.battle}</div>
          <div>Turn/Rest</div>
          <div className="text-right">{lifecycleCounters.turn}/{lifecycleCounters.rest}</div>
        </div>
        {lifecycleDebugRows.length > 0 ? (
          <div className="mt-1 border-t border-game-teal/20 pt-1 space-y-0.5 text-[8px] text-game-teal/70">
            {lifecycleDebugRows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-2">
                <span className="truncate">{row.label}</span>
                <span className={`shrink-0 ${row.canUse ? 'text-game-teal/70' : 'text-game-gold/80'}`}>
                  {row.scope}:{row.usage} {row.turnsRemaining > 0 ? `· t-${row.turnsRemaining}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-1 border-t border-game-teal/20 pt-1 text-[8px] text-game-teal/60">
            No lifecycle-tracked hand cards.
          </div>
        )}
      </div>
      <div className="mb-3 rounded border border-game-teal/25 bg-game-bg-dark/45 px-2 py-1 text-[9px] text-game-teal/80">
        <div className="mb-1 uppercase tracking-[0.14em] text-game-teal/70">Perf</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <div>FPS avg/p95/min</div>
          <div className="text-right">{perfSnapshot.fpsAvg.toFixed(0)}/{perfSnapshot.fpsP95.toFixed(0)}/{perfSnapshot.fpsWorst.toFixed(0)}</div>
          <div>Drag move avg/p95</div>
          <div className="text-right">{perfSnapshot.dragMoveAvg.toFixed(1)}/{perfSnapshot.dragMoveP95.toFixed(1)}ms</div>
          <div>Drag end p95</div>
          <div className="text-right">{perfSnapshot.dragEndP95.toFixed(1)}ms</div>
          <div>Drop total/action p95</div>
          <div className="text-right">{perfSnapshot.dropTotalP95.toFixed(1)}/{perfSnapshot.dropActionP95.toFixed(1)}ms</div>
          <div>RPG tick p95</div>
          <div className="text-right">{perfSnapshot.rpgTickP95.toFixed(1)}ms</div>
          <div>React commit p95</div>
          <div className="text-right">{perfSnapshot.reactCommitP95.toFixed(1)}ms</div>
          <div>Long task p95/max</div>
          <div className="text-right">{perfSnapshot.longTaskP95.toFixed(1)}/{perfSnapshot.longTaskMax.toFixed(1)}ms</div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCapturePerf}
            className="rounded border border-game-teal/45 px-2 py-1 text-[10px] text-game-teal hover:border-game-teal transition-colors"
          >
            Capture Perf
          </button>
          <div className="text-[9px] text-game-teal/60">
            {perfCaptureNotice || 'Copies JSON to clipboard (or downloads)'}
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={actions.spawnEnemy}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          Spawn Enemy
        </button>
        <button
          type="button"
          onClick={handleRerollDeal}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          Reroll Deal
        </button>
        <button
          type="button"
          onClick={actions.endTurn}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          {autoPlayEnabled ? activeAiTurnLabel : 'End Turn'}
        </button>
        <button
          type="button"
          onClick={actions.advanceTurn}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          Next Turn
        </button>
        <button
          type="button"
          onClick={() => actions.setEnemyDifficulty(nextDifficulty)}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          Difficulty: {currentDifficulty}
        </button>
        <button
          type="button"
          onClick={actions.cleanupDefeatedEnemies}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          Cleanup KOs
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => shiftTimeScale(1)}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          Time x{timeScale.toFixed(1)}
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          {isGamePaused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <div className="mb-3 rounded border border-game-teal/30 bg-game-bg-dark/50 px-2 py-2">
        <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-game-teal/70">Atmosphere</div>
        <select
          value={selectedAtmosphere}
          onChange={(event) => setSelectedAtmosphere(event.target.value as AtmosphereEffectId)}
          className="w-full rounded border border-game-teal/40 bg-black/85 px-2 py-1 text-[10px] text-game-teal"
        >
          {ATMOSPHERE_PRESETS.map((preset) => (
            <option key={`config-atmosphere-${preset.id}`} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3 rounded border border-game-teal/25 bg-game-bg-dark/40 px-2 py-1 text-center text-[9px] uppercase tracking-[0.18em] text-game-teal/70">
        Space = Pause/Resume · A = Atmosphere · P = Auto · H = Hand · [ ] = Time
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => actions.newGame(true)}
          className="rounded border border-game-gold/50 px-2 py-1 text-game-gold hover:border-game-gold transition-colors"
        >
          Reset Run
        </button>
        <button
          type="button"
          onClick={() => actions.newGame(false)}
          className="rounded border border-game-pink/50 px-2 py-1 text-game-pink hover:border-game-pink transition-colors"
        >
          New Save
        </button>
      </div>

      </>
      )}
    </div>
      )}

      <div className={arenaDockClassName} style={arenaDockStyle}>
        <div className={`${arenaPanelClassName}${hideGameContent ? ' invisible' : ''}`}>
            {(() => {
              const className = 'pointer-events-none absolute inset-0 z-0 h-full w-full visible';
              const atmosphereComponents: Partial<Record<AtmosphereEffectId, unknown>> = {
                lost_in_stars: LostInStarsAtmosphere,
                aurora_forest: AuroraForestAtmosphere,
                gargantua: GargantuaAtmosphere,
                brownian_motion: BrownianMotionAtmosphere,
                chaos_split: ChaosSplitAtmosphere,
                comet_barrage: CometBarrageAtmosphere,
                comet_rain: CometRainAtmosphere,
                cosmic_lint: CosmicLintAtmosphere,
                door_sands_time: DoorSandsTimeAtmosphere,
                drifting_purple: DriftingPurpleAtmosphere,
                einstein_rosen: EinsteinRosenAtmosphere,
                electric_skies: ElectricSkiesAtmosphere,
                falling_snow: FallingSnowAtmosphere,
                florpus_forest: FlorpusForestAtmosphere,
                gravity_split: GravitySplitAtmosphere,
                inferno_maelstrom: InfernoMaelstromAtmosphere,
                ocean_solar_cycle: OceanSolarCycleAtmosphere,
                raging_waves: RagingWavesAtmosphere,
                rarity_squares_tunnel: RaritySquaresTunnelAtmosphere,
                sacred_realm: SacredRealmAtmosphere,
                solaris_prime: SolarisPrimeAtmosphere,
                sakura_blossoms: SakuraBlossomsAtmosphere,
                smoke_green: SmokeGreenAtmosphere,
                spinning_starfield: SpinningStarfieldAtmosphere,
                stars_twinkle_performant: StarsTwinklePerformantAtmosphere,
                };
                if (selectedAtmosphere === 'none') return null;
                const candidate = atmosphereComponents[selectedAtmosphere] as
                | ComponentType<{ className?: string }>
                | { default?: ComponentType<{ className?: string }> }
                | undefined;
                const AtmosphereComponent = (
                candidate
                && typeof candidate === 'object'
                && 'default' in candidate
                && candidate.default
                ) ? candidate.default : candidate;
                const isRenderable = Boolean(
                AtmosphereComponent
                && (
                  typeof AtmosphereComponent === 'function'
                  || (typeof AtmosphereComponent === 'object' && '$$typeof' in (AtmosphereComponent as object))
                )
                );
              if (!isRenderable) {
                if (import.meta.env.DEV) console.warn('[atmosphere] unresolved preset', selectedAtmosphere);
                return null;
              }
              const RenderAtmosphere = AtmosphereComponent as ComponentType<{ className?: string }>;
              return <RenderAtmosphere className={className} />;
            })()}
            {showCombatHud && atmosphereMenuOpen && (
              <div className="pointer-events-none absolute right-2 top-2 z-[10018] flex flex-col items-end gap-1">
                <div className="pointer-events-auto rounded border border-game-teal/50 bg-black/70 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-game-teal">
                  Atmosphere (A)
                </div>
                <select
                  value={selectedAtmosphere}
                  onChange={(event) => setSelectedAtmosphere(event.target.value as AtmosphereEffectId)}
                  className="pointer-events-auto rounded border border-game-teal/40 bg-black/85 px-2 py-1 text-[10px] text-game-teal"
                >
                  {ATMOSPHERE_PRESETS.map((preset) => (
                    <option key={`atmosphere-${preset.id}`} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showCombatHud && worldEventBanner && (
              <div className="pointer-events-none absolute left-1/2 top-2 z-[10017] -translate-x-1/2 rounded border border-[#ff8a00]/70 bg-black/78 px-3 py-1 text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#ffb347]">{worldEventBanner.label}</div>
                {worldEventBanner.detail && (
                  <div className="mt-0.5 text-[9px] text-[#ffd18d]/90">{worldEventBanner.detail}</div>
                )}
              </div>
            )}
            <div
              className="relative z-10 mb-2 flex items-center gap-1.5 self-start"
              style={
                hideGameContent
                  ? {
                      position: 'fixed',
                      top: '8px',
                      right: '8px',
                      zIndex: 12100,
                    }
                  : undefined
              }
            >
              <FpsBadge
                fps={hudFps}
                onClick={() => setAtmosphereOnlyMode((prev) => !prev)}
                title={showCombatHud ? 'Hide HUD (atmosphere only)' : 'Show HUD'}
                className="rounded border border-game-gold/60 bg-black/70 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-game-gold"
              />
              {isLabMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setAutoPlayEnabled((prev) => !prev)}
                    className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${autoPlayEnabled ? 'border-game-gold/80 bg-game-gold/15 text-game-gold' : 'border-game-teal/55 bg-black/70 text-game-teal hover:border-game-teal'}`}
                    title={autoPlayEnabled ? 'Disable auto play (P)' : 'Enable auto play (P)'}
                    aria-label={autoPlayEnabled ? 'Disable auto play' : 'Enable auto play'}
                  >
                    {autoPlayEnabled ? 'Stop' : 'Play'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoPlaySpeedIndex((prev) => (prev + 1) % AUTO_PLAY_SPEED_OPTIONS.length)}
                    className="rounded border border-game-teal/45 bg-black/70 px-2 py-1 text-[10px] text-game-teal hover:border-game-teal transition-colors"
                    title="Cycle auto play speed"
                    aria-label="Cycle auto play speed"
                  >
                    Auto x{autoPlaySpeed.toFixed(1)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoPlayDeterministic((prev) => !prev)}
                    className={`rounded border px-2 py-1 text-[10px] transition-colors ${autoPlayDeterministic ? 'border-game-gold/70 bg-game-gold/10 text-game-gold' : 'border-game-teal/45 bg-black/70 text-game-teal hover:border-game-teal'}`}
                    title="Toggle deterministic autoplay (seeded RNG)"
                    aria-label="Toggle deterministic autoplay"
                  >
                    {autoPlayDeterministic ? 'Det ✓' : 'Det'}
                  </button>
                  <button
                    type="button"
                    onClick={onTogglePause}
                    className="rounded border border-game-teal/45 bg-black/70 px-2 py-1 text-[10px] text-game-teal hover:border-game-teal transition-colors"
                    title="Pause or resume combat"
                    aria-label="Toggle pause"
                  >
                    {isGamePaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={handleHudEndTurn}
                    className="rounded border border-game-teal/45 bg-black/70 px-2 py-1 text-[10px] text-game-teal hover:border-game-teal transition-colors"
                    title="Advance to the next turn side"
                    aria-label="Advance turn"
                  >
                    End Turn
                  </button>
                  <div
                    className="rounded border border-game-teal/45 bg-black/70 px-2 py-1 text-[10px] text-game-teal"
                    title="Total turns completed"
                    aria-label="Total turns completed"
                  >
                    Turns {totalTurnsCompleted}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestSequencePanelOpen((prev) => !prev)}
                    className={`rounded border px-2 py-1 text-[10px] transition-colors ${testSequencePanelOpen ? 'border-game-gold/70 bg-game-gold/10 text-game-gold' : 'border-game-teal/45 bg-black/70 text-game-teal hover:border-game-teal'}`}
                    title="Open batch autoplay test sequence controls"
                    aria-label="Toggle autoplay test sequence controls"
                  >
                    Test Seq
                  </button>
                  {testSequencePanelOpen && (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        step={1}
                        value={testSequenceInput}
                        onChange={(event) => setTestSequenceInput(event.target.value)}
                        className="w-16 rounded border border-game-teal/45 bg-black/75 px-2 py-1 text-[10px] text-game-teal outline-none"
                        aria-label="Autoplay test run count"
                        title="Number of autoplay test runs"
                      />
                      <button
                        type="button"
                        onClick={handleStartTestSequence}
                        disabled={testSequenceRunning}
                        className={`rounded border px-2 py-1 text-[10px] transition-colors ${testSequenceRunning ? 'cursor-not-allowed border-game-teal/20 bg-black/40 text-game-teal/35' : 'border-game-teal/45 bg-black/70 text-game-teal hover:border-game-teal'}`}
                        title="Run autoplay test sequence"
                        aria-label="Run autoplay test sequence"
                      >
                        {testSequenceRunning ? 'Running' : 'Run'}
                      </button>
                      <div className="rounded border border-game-teal/35 bg-black/70 px-2 py-1 text-[10px] text-game-teal/90">
                        {testSequenceRunning
                          ? `Test ${testSequenceCurrentRun}/${testSequenceRequestedRuns}`
                          : testSequenceCompleted
                            ? `Done ${testSequenceResults.length}/${testSequenceRequestedRuns}`
                            : 'Idle'}
                      </div>
                      {testSequenceCompleted && testSequenceResults.length > 0 && (
                        <button
                          type="button"
                          onClick={handleCopyTestSequenceResults}
                          className="rounded border border-game-gold/70 bg-game-gold/10 px-2 py-1 text-[10px] text-game-gold transition-colors hover:border-game-gold"
                          title="Copy test sequence payload"
                          aria-label="Copy test sequence payload"
                        >
                          Copy Results
                        </button>
                      )}
                      {testSequenceCopyNotice && (
                        <div className="rounded border border-game-gold/40 bg-black/70 px-2 py-1 text-[10px] text-game-gold/90">
                          {testSequenceCopyNotice}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            {!showCombatHud && (
              <div className="relative z-10 mb-2 text-[9px] uppercase tracking-[0.14em] text-game-teal/70">
                atmosphere only
              </div>
            )}
            {showCombatHud && (
            <div
              ref={fitViewportRef}
              className="relative z-10 flex-1 min-h-0 w-full overflow-hidden"
            >
              {autoPlayDragAnim && (
                <div className="pointer-events-none absolute inset-0 z-[10120]">
                  <div
                    ref={autoPlayDragNodeRef}
                    className="pointer-events-none absolute left-0 top-0"
                    style={{
                      willChange: 'transform',
                      transform: `translate3d(${autoPlayDragAnim.from.x.toFixed(2)}px, ${autoPlayDragAnim.from.y.toFixed(2)}px, 0) rotate(0deg)`,
                      transition: 'none',
                    }}
                  >
                    <div className="relative h-0 w-0">
                      <div
                        className="absolute rounded border border-game-gold/60 bg-black/85 p-1 text-center text-[11px] font-bold text-game-gold"
                        style={{
                          width: `${AUTO_PLAY_DRAG_CARD_WIDTH}px`,
                          height: `${AUTO_PLAY_DRAG_CARD_HEIGHT}px`,
                          transform: 'translate(-100%, -100%) rotate(var(--autoplay-drag-rotation, 0deg))',
                          transformOrigin: '100% 100%',
                          boxShadow: '0 0 10px rgba(230,179,30,0.5)',
                        }}
                      >
                        <div className="truncate">{autoPlayDragAnim.card.name ?? autoPlayDragAnim.card.rank}</div>
                        <div className="mt-2 text-xl">{getRankDisplay(autoPlayDragAnim.card.rank)}</div>
                        <div className="mt-1 text-[10px] text-game-teal">{autoPlayDragAnim.card.element}</div>
                      </div>
                      <div
                        className="absolute text-lg text-game-gold drop-shadow-[0_0_6px_rgba(230,179,30,0.9)]"
                        style={{ left: '2px', top: '2px' }}
                      >
                        ☝
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex h-full w-full items-start justify-center overflow-hidden pt-2">
                <div
                  ref={fitContentRef}
                  className="inline-flex w-max max-w-none flex-col items-center justify-center gap-2 py-6"
                  style={{
                    transform: `scale(${autoFitMultiplier})`,
                    transformOrigin: 'top center',
                  }}
                >
              <div className={`flex w-full items-start justify-center px-1 ${perspectiveEnabled ? 'perspective-foundation-container' : ''}`}>
                <div className={`flex items-start justify-center gap-[50px] ${perspectiveEnabled ? 'perspective-foundation-content' : ''}`}>
                  {enemyFoundationIndexes.map((idx) => {
                    const statuses = buildFoundationStatuses('enemy', idx);
                    const foundationCards = enemyFoundations[idx] ?? [];
                    const showSpawnControl = isLabMode && foundationCards.length === 0;
                    const spawnSelection = getSelectedEnemySpawnId(idx);
                    return (
                      <div
                        key={`enemy-foundation-${idx}`}
                        className="relative rounded bg-black/45 p-[3px] shrink-0"
                        style={{ minWidth: previewFoundationWidth }}
                      >
                        <Foundation
                          cards={foundationCards}
                          index={idx}
                          onFoundationClick={() => {}}
                          allowClickInDnd
                          canReceive={false}
                          interactionMode={gameState.interactionMode}
                          showGraphics={showGraphics}
                          scale={1.12}
                          countPosition="none"
                          maskValue={false}
                          watercolorOnlyCards={false}
                          foundationOverlay={buildEnemyFoundationOverlay(idx)}
                          neonGlowColorOverride={enemyFoundationNeonStyles[idx]?.color ?? DEFAULT_ENEMY_FOUNDATION_GLOW}
                          neonGlowShadowOverride={enemyFoundationNeonStyles[idx]?.shadow}
                          setDropRef={getFoundationDropRef(enemyFoundationDropBase + idx)}
                          onDestructionComplete={() => handleEnemyFoundationDestructionComplete(idx)}
                        />
                        {showSpawnControl && (
                          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                            <button
                              type="button"
                              className="pointer-events-auto h-10 w-10 rounded-full border border-game-teal/60 bg-black/80 text-xl leading-none text-game-teal transition-colors hover:border-game-teal hover:bg-black"
                              onClick={() => setEnemySpawnPickerIndex((prev) => (prev === idx ? null : idx))}
                              aria-label="Spawn enemy actor"
                            >
                              +
                            </button>
                          </div>
                        )}
                        {showSpawnControl && enemySpawnPickerIndex === idx && (
                          <div className="absolute left-1/2 top-full z-30 mt-2 w-[180px] -translate-x-1/2 rounded border border-game-teal/40 bg-black/90 p-2">
                            <select
                              className="mb-2 w-full rounded border border-game-teal/35 bg-black/80 px-2 py-1 text-[11px] text-game-teal"
                              value={spawnSelection}
                              onChange={(event) => handleEnemySpawnSelectionChange(idx, event.target.value)}
                            >
                              {enemyActorSpawnOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="flex-1 rounded border border-game-teal/45 px-2 py-1 text-[11px] text-game-teal hover:border-game-teal"
                                onClick={() => handleSpawnEnemyActor(idx)}
                              >
                                Spawn
                              </button>
                              <button
                                type="button"
                                className="rounded border border-game-white/25 px-2 py-1 text-[11px] text-game-white/75 hover:border-game-white/50"
                                onClick={() => setEnemySpawnPickerIndex(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        <StatusBadges statuses={statuses} compact className="mt-1" />
                      </div>
                    );
                  })}
                </div>
              </div>
                  <div className={perspectiveEnabled ? 'tableau-group-perspective-container' : ''}>
                    <div
                      ref={tableauBandRef}
                      className={`relative flex w-full items-start justify-center gap-2 overflow-visible px-1 ${perspectiveEnabled ? 'tableau-group-perspective-content' : ''}`}
                      style={{ minHeight: previewTableauHeight + 30 }}
                    >
                      <DedicatedPlayerTableau
                        tableaus={previewTableaus}
                        showGraphics={showGraphics}
                        cardScale={previewTableauCardScale}
                        interactionMode={gameState.interactionMode}
                        noValidMoves={noValidMovesForPlayer}
                        tableauCanPlay={tableauCanPlay}
                        selectedCard={selectedCard}
                        draggingCardId={dragState.isDragging ? dragState.card?.id : null}
                        onTopCardSelect={handleSandboxCardSelect}
                        onTopCardDragStart={handleSandboxTableauDragStart}
                        setTableauRef={(tableauIndex, el) => {
                          autoPlayTableauRefsRef.current[tableauIndex] = el;
                        }}
                        startIndex={0}
                      />
                      <TableauNoMovesOverlay active={noValidMovesForPlayer} />
                    </div>
                  </div>
              {showTurnTimer && zenRelicEnabled && !interTurnCountdownActive && (
                <div className="flex w-full justify-center px-1 py-1">
                  <button
                    type="button"
                    onClick={handleZenEndTurn}
                    className="rounded border border-[#ff8a00]/70 bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#ffb347] transition-colors hover:border-[#ffb347] hover:text-[#ffd18d]"
                  >
                    {autoPlayEnabled ? activeAiTurnLabel : 'End Turn'}
                  </button>
                </div>
              )}
              <div className={`flex w-full items-start justify-center px-1 ${perspectiveEnabled ? 'perspective-foundation-container' : ''}`}>
                <div className={`flex items-start justify-center gap-[50px] ${perspectiveEnabled ? 'perspective-foundation-content' : ''}`}>
                  {foundationIndexes.map((idx) => {
                    const statuses = buildFoundationStatuses('player', idx);
                    const isTapped = Boolean(tappedPlayerFoundations[idx]);
                    return (
                      <div
                        key={`player-foundation-${idx}`}
                        className="rounded bg-black/45 p-[3px] shrink-0"
                        style={{ minWidth: previewFoundationWidth }}
                      >
                    <Foundation
                          cards={previewPlayerFoundations[idx] ?? []}
                          index={idx}
                          onFoundationClick={() => handleSandboxFoundationClick(idx)}
                          allowClickInDnd
                          canReceive={!!selectedCard && !!validFoundationsForSelected[idx] && !isFoundationTableauLocked(idx)}
                          interactionMode={gameState.interactionMode}
                          showGraphics={showGraphics}
                          scale={1.12}
                          countPosition="none"
                          maskValue={false}
                          setDropRef={getFoundationDropRef(idx)}
                          watercolorOnlyCards={false}
                          neonGlowColorOverride={DEFAULT_PLAYER_FOUNDATION_GLOW}
                          neonGlowShadowOverride={`0 0 28px ${DEFAULT_PLAYER_FOUNDATION_GLOW}ee, inset 0 0 20px ${DEFAULT_PLAYER_FOUNDATION_GLOW}55`}
                          foundationOverlay={buildFoundationOverlay(idx)}
                          isTapped={isTapped}
                        />
                        <StatusBadges statuses={statuses} compact className="mt-1" />
                      </div>
                    );
                  })}
                </div>
              </div>
                  {previewHandCards.length > 0 && (
                    <div className="flex w-full justify-center px-1 pb-0 pt-1">
                      <div ref={handZoneRef} className="flex w-full justify-center">
                        <DeckSprawl
                          cards={previewHandCards}
                          cardScale={previewHandCardScale}
                          onDragStart={handleSandboxHandDragStart}
                          onCardClick={handleSandboxHandClick}
                          showGraphics={showGraphics}
                          interactionMode={gameState.interactionMode}
                          draggingCardId={dragState.isDragging ? dragState.card?.id : null}
                          watercolorOnlyCards={false}
                          isCardPlayable={isHandCardPlayable}
                          getCardLockReason={getHandCardLockReason}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
            {dragState.isDragging && dragState.card && (
              <DragPreview
                card={dragState.card}
                positionRef={dragPositionRef}
                offset={dragState.offset}
                size={dragState.size}
                showText={true}
              />
            )}
        </div>
      </div>
    </div>
    </Profiler>
  );
}
