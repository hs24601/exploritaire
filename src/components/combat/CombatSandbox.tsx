import { Profiler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGraphics } from '../../contexts/GraphicsContext';
import { useCardScalePreset } from '../../contexts/CardScaleContext';
import { CARD_SIZE, ELEMENT_TO_SUIT, HAND_SOURCE_INDEX } from '../../engine/constants';
import { getRankDisplay } from '../../engine/rules';
import { getBiomeDefinition } from '../../engine/biomes';
import { ACTOR_DEFINITIONS, getActorDefinition } from '../../engine/actors';
import { createActorDeckStateWithOrim } from '../../engine/actorDecks';
import { analyzeOptimalSequence } from '../../engine/analysis';
import { resolveCostByRarity } from '../../engine/rarityLoadouts';
import { Foundation } from '../Foundation';
import { Hand } from '../Hand';
import { DragPreview } from '../DragPreview';
import { DedicatedPlayerTableau } from './DedicatedPlayerTableau';
import { StatusBadges } from './StatusBadges';
import { buildActorStatusBadges } from './buildActorStatusBadges';
import { RelicTray } from './RelicTray';
import { TableauNoMovesOverlay } from './TableauNoMovesOverlay';
import { FpsBadge } from './FpsBadge';
import { buildRelicTrayItems } from './relicTrayModel';
import type { CombatSandboxActionsContract } from './contracts';
import { useRpgCombatTicker } from './hooks/useRpgCombatTicker';
import { useDragDrop } from '../../hooks/useDragDrop';
import { getNeonElementColor } from '../../utils/styles';
import { ParticleProgressBar } from '../ParticleProgressBar';
import type { AbilityLifecycleDef, AbilityLifecycleExhaustScope, AbilityLifecycleUsageEntry, Actor, Card as CardType, Element, GameState, OrimDefinition, OrimRarity, SelectedCard } from '../../engine/types';
import abilitiesJson from '../../data/abilities.json';
import { LostInStarsAtmosphere } from '../atmosphere/LostInStarsAtmosphere';
import { AuroraForestAtmosphere } from '../atmosphere/AuroraForestAtmosphere';
import { BlackHoleAtmosphere } from '../atmosphere/BlackHoleAtmosphere';
import { DriftingPurpleAtmosphere } from '../atmosphere/DriftingPurpleAtmosphere';
import { SmokeGreenAtmosphere } from '../atmosphere/SmokeGreenAtmosphere';
import { InfernoMaelstromAtmosphere } from '../atmosphere/InfernoMaelstromAtmosphere';
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
const ORIM_TRAY_SOURCE_INDEX = -2;
const ORIM_TRAY_WIDTH_PX = 50;
const RELIC_TRAY_WIDTH_PX = 50;
const COLLAPSED_TRAY_WIDTH_PX = 22;
const FINAL_MOVE_RELIC_BEHAVIOR_ID = 'final_move_v1';
const MASTER_STRATEGIST_RELIC_BEHAVIOR_ID = 'master_strategist_v1';
const ZEN_RELIC_BEHAVIOR_ID = 'zen_v1';
const LAB_DEFAULT_ENEMY_DEFINITION_ID = 'shade_of_resentment';
const DEFAULT_TIME_SCALE_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
const AUTO_PLAY_SPEED_OPTIONS = [0.5, 1, 2, 4];
const AUTO_PLAY_BASE_STEP_MS = 430;
const AUTO_PLAY_MAX_TRACE = 10;
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
  | 'player_hand_player_foundation'
  | 'player_hand_enemy_foundation'
  | 'player_rpg_attack'
  | 'enemy_rpg_attack'
  | 'advance_turn'
  | 'exploration_turn'
  | 'complete_biome'
  | 'wait';
type AutoPlayDecisionEntry = {
  side: AutoPlayActorSide | 'system';
  kind: AutoPlayDecisionKind;
  score: number;
  label: string;
  accepted: boolean;
  at: number;
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
  if (scope === 'turn') return Math.max(0, Number(state.lifecycleTurnCounter ?? state.randomBiomeTurnNumber ?? state.turnCount ?? 0));
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
  if (orimDefinitions.some((entry) => entry.id === slotOrimId)) return slotOrimId;
  return orimDefinitions.find((entry) => slotOrimId.includes(`orim-${entry.id}-`))?.id;
}

function findActorForLabFoundation(state: GameState, definitionId: 'felis' | 'ursus' | 'lupus'): Actor | null {
  const partyActors = Object.values(state.tileParties ?? {}).flat();
  return partyActors.find((actor) => actor.definitionId === definitionId)
    ?? state.availableActors.find((actor) => actor.definitionId === definitionId)
    ?? null;
}

function createLabFoundationActorCard(definitionId: 'felis' | 'ursus' | 'lupus', actor: Actor | null): CardType {
  const fallbackName = definitionId === 'felis' ? 'Felis' : definitionId === 'ursus' ? 'Ursus' : 'Lupus';
  const actorDefinition = getActorDefinition(actor?.definitionId ?? definitionId);
  const actorName = actorDefinition?.name ?? fallbackName;
  const actorTitles = actorDefinition?.titles?.filter(Boolean) ?? [];
  return {
    id: `combatlab-foundation-${definitionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rank: actorDefinition?.value ?? 1,
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

function buildLabSeededFoundations(state: GameState, existing: CardType[][]): CardType[][] {
  const felisActor = findActorForLabFoundation(state, COMBAT_LAB_FOUNDATION_ACTOR_DEFINITION_IDS[0]);
  const ursusActor = findActorForLabFoundation(state, COMBAT_LAB_FOUNDATION_ACTOR_DEFINITION_IDS[1]);
  const lupusActor = findActorForLabFoundation(state, COMBAT_LAB_FOUNDATION_ACTOR_DEFINITION_IDS[2]);
  const existingRest = existing.slice(3).map((stack) => [...stack]);
  return [
    [createLabFoundationActorCard('felis', felisActor)],
    [createLabFoundationActorCard('ursus', ursusActor)],
    [createLabFoundationActorCard('lupus', lupusActor)],
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
  return (actor.hp ?? 0) > 0 && (actor.stamina ?? 1) > 0;
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

  const activeSide = gameState.randomBiomeActiveSide ?? 'player';
  const noValidMovesForPlayer = noValidMovesPlayer ?? noValidMoves;
  const noValidMovesForEnemy = noValidMovesEnemy ?? false;
  const combatFlowMode = gameState.combatFlowMode ?? 'turn_based_pressure';
  const enforceTurnOwnership = combatFlowMode === 'turn_based_pressure';
  const turnDurationMs = Math.max(1000, Math.round(gameState.randomBiomeTurnDurationMs ?? 10000));
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
  const useLocalTurnSide = isLabMode && gameState.phase !== 'biome' && enforceTurnOwnership;
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
  const [autoPlayDragAnim, setAutoPlayDragAnim] = useState<AutoPlayDragAnim | null>(null);
  const autoPlayDragNodeRef = useRef<HTMLDivElement | null>(null);
  const autoPlayStallRef = useRef(0);
  const autoPlayBusyRef = useRef(false);
  const autoPlayRngStateRef = useRef<number>(AUTO_PLAY_DEFAULT_SEED >>> 0);
  const autoPlayReplayStartSnapshotRef = useRef<Partial<GameState> | null>(null);
  const autoPlayWasEnabledRef = useRef(false);
  const resetAutoPlayDeterministicRng = useCallback((seedOverride?: number) => {
    const seedSource = seedOverride ?? autoPlaySeed;
    const normalizedSeed = Math.max(0, Math.floor(Number(seedSource) || 0)) >>> 0;
    autoPlayRngStateRef.current = normalizedSeed;
    return normalizedSeed;
  }, [autoPlaySeed]);
  const showGraphics = useGraphics();
  const tableGlobalScale = useCardScalePreset('table');
  const autoPlayTableauRefsRef = useRef<Record<number, HTMLDivElement | null>>({});
  const autoPlayFoundationRefsRef = useRef<Record<number, HTMLDivElement | null>>({});
  const handZoneRef = useRef<HTMLDivElement | null>(null);
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
    actions.spawnEnemyActorInRandomBiome(definitionId, foundationIndex);
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
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLabMode, open, shiftTimeScale]);
  useEffect(() => {
    if (enemySpawnPickerIndex == null) return;
    if ((enemyFoundations[enemySpawnPickerIndex]?.length ?? 0) > 0) {
      setEnemySpawnPickerIndex(null);
    }
  }, [enemyFoundations, enemySpawnPickerIndex]);
  const showTurnTimer = enforceTurnOwnership && enemyFoundationCount > 0;
  const shouldRenderTurnBars = showTurnTimer && !DISABLE_TURN_BAR_ANIMATION;
  const previewPlayerFoundations = gameState.foundations;
  const activeTileId = gameState.activeSessionTileId;
  const partyActors = activeTileId ? (gameState.tileParties[activeTileId] ?? []) : [];
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
    const foundationCards = enemyFoundations[foundationIndex] ?? [];
    const defeatedActor = resolveEnemyFoundationActor(foundationIndex, foundationCards);
    const defeatedDefinitionId = defeatedActor?.definitionId;

    actions.cleanupDefeatedEnemies();

    if (!defeatedDefinitionId) return;
    const respawnFoundationIndex = enemyFoundations.findIndex((foundation, index) => (
      index !== foundationIndex && (foundation?.length ?? 0) === 0
    ));
    actions.spawnEnemyActorInRandomBiome(
      defeatedDefinitionId,
      respawnFoundationIndex >= 0 ? respawnFoundationIndex : foundationIndex
    );
  }, [actions, enemyFoundations, resolveEnemyFoundationActor]);
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
    if (tokenCounts) {
      const segments: Element[] = [];
      AP_SEGMENT_ORDER.forEach((element) => {
        const count = Math.max(0, Math.floor(Number(tokenCounts[element] ?? 0)));
        for (let i = 0; i < count; i += 1) {
          segments.push(element);
        }
      });
      if (segments.length > 0) return segments;
    }
    if (foundationCards.length <= 1) return [];
    return foundationCards
      .slice(1)
      .map((card) => card.tokenReward)
      .filter((element): element is Element => typeof element === 'string');
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
    const tileId = gameState.activeSessionTileId;
    const party = tileId ? (gameState.tileParties[tileId] ?? []) : [];
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
      if (inferredDefinitionId === 'felis') {
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
    gameState.activeSessionTileId,
    gameState.tileParties,
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
      if (looksDeckBacked && (deckCardKeys.has(cardKey) || deckActorAbilityKeys.has(actorAbilityKey))) {
        return false;
      }
      if (isDeadRunOnlyAbilityCard(card) && !noValidMovesForPlayer) {
        return false;
      }
      return true;
    });
    return [...deckBackedLabHandCards, ...runtimeExtras];
  }, [isLabMode, deckBackedLabHandCards, gameState.rpgHandCards, isDeadRunOnlyAbilityCard, noValidMovesForPlayer]);
  const actorApById = useMemo(() => {
    const ap = new Map<string, number>();
    const tileId = gameState.activeSessionTileId;
    const party = tileId ? (gameState.tileParties[tileId] ?? []) : [];
    const pool = [...party, ...(gameState.availableActors ?? [])];
    pool.forEach((actor) => {
      ap.set(actor.id, Math.max(0, Number(actor.power ?? 0)));
    });
    return ap;
  }, [gameState.activeSessionTileId, gameState.tileParties, gameState.availableActors]);
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
  const labTrayOrims = useMemo(() => {
    const definitions = gameState.orimDefinitions ?? [];
    const combatCandidates = definitions.filter((definition) => (
      !definition.isAspect
      && (definition.domain ?? 'puzzle') === 'combat'
    ));
    const nonLegacy = combatCandidates.filter((definition) => !definition.legacyOrim);
    return nonLegacy.length > 0 ? nonLegacy : combatCandidates;
  }, [gameState.orimDefinitions]);
  const labTrayRelics = useMemo(
    () => buildRelicTrayItems(gameState, { includeAllDefinitions: true }),
    [gameState]
  );
  const previewTableauCardScale = 0.82;
  const secondaryTableauCardScale = Math.round(previewTableauCardScale * 0.9 * 1000) / 1000;
  const previewHandCardScale = 1;
  const previewTableauHeight = Math.round(CARD_SIZE.height * previewTableauCardScale);
  const previewFoundationWidth = Math.round(CARD_SIZE.width * 0.9);
  const [fallbackTableaus, setFallbackTableaus] = useState<CardType[][]>(() => createCombatStandardTableaus());
  const gameTableaus = gameState.tableaus ?? [];
  const hasRenderableGameTableaus = gameTableaus.length > 0 && gameTableaus.some((tableau) => tableau.length > 0);
  const previewTableaus = hasRenderableGameTableaus ? gameTableaus : fallbackTableaus;
  // Enemy uses the same shared tableau; no separate enemy tableau cards.
  const foundationIndexes = [0, 1, 2];
  const enemyFoundationIndexes = isLabMode ? [1, 0, 2] : [0];
  const enemyFoundationDropBase = foundationIndexes.length;
  const [autoFitMultiplier, setAutoFitMultiplier] = useState(1);
  const [orimTrayCollapsed, setOrimTrayCollapsed] = useState(true);
  const [relicTrayCollapsed, setRelicTrayCollapsed] = useState(true);
  const draggedHandCardRef = useRef<CardType | null>(null);
  const draggedOrimDefinitionRef = useRef<OrimDefinition | null>(null);
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
  const orimTrayWidthPx = isLabMode ? (orimTrayCollapsed ? COLLAPSED_TRAY_WIDTH_PX : ORIM_TRAY_WIDTH_PX) : 0;
  const relicTrayWidthPx = isLabMode ? (relicTrayCollapsed ? COLLAPSED_TRAY_WIDTH_PX : RELIC_TRAY_WIDTH_PX) : 0;
  const handleToggleLabRelic = useCallback((instanceId: string) => {
    if (!actions.updateEquippedRelics) return;
    const equippedRelics = gameState.equippedRelics ?? [];
    const nextRelics = equippedRelics.map((instance) => (
      instance.instanceId === instanceId
        ? { ...instance, enabled: !instance.enabled }
        : instance
    ));
    actions.updateEquippedRelics(nextRelics);
  }, [actions, gameState.equippedRelics]);
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
    actions.setRandomBiomeActiveSide?.(nextSide);
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
  }, [actions, syncTurnBarWidths, turnDurationMs]);
  const handleZenEndTurn = useCallback(() => {
    if (!zenRelicEnabled) return;
    if (!showTurnTimer || !enforceTurnOwnership) return;
    if (interTurnCountdownActive) return;

    if (useLocalTurnSide) {
      const nextSide: 'player' | 'enemy' = effectiveActiveSide === 'player' ? 'enemy' : 'player';
      forceLocalTurnSide(nextSide);
      return;
    }

    actions.advanceRandomBiomeTurn();
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
  const buildOrimTrayDragCard = useCallback((definition: OrimDefinition): CardType => {
    const element = definition.elements?.[0] ?? 'N';
    return {
      id: `combat-lab-orim-${definition.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      rank: 1,
      element,
      suit: ELEMENT_TO_SUIT[element],
      rarity: definition.rarity ?? 'common',
      name: definition.name,
      description: definition.description,
      rpgAbilityId: definition.id,
      rpgCardKind: 'focus',
    };
  }, []);
  const currentBiomeDef = gameState.currentBiome ? getBiomeDefinition(gameState.currentBiome) : null;
  const useWild = !!currentBiomeDef?.randomlyGenerated;
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
    if (tableauIndex === ORIM_TRAY_SOURCE_INDEX) {
      const definition = draggedOrimDefinitionRef.current;
      draggedOrimDefinitionRef.current = null;
      if (!definition || !actions.devInjectOrimToActor) {
        recordDropMetrics(performance.now() - dropStart, actionMs);
        return;
      }
      const targetActor = isEnemyFoundationDrop
        ? resolveEnemyFoundationActor(
          foundationIndex - enemyFoundationDropBase,
          enemyFoundations[foundationIndex - enemyFoundationDropBase] ?? []
        )
        : resolvePlayerFoundationActor(
          foundationIndex,
          previewPlayerFoundations[foundationIndex] ?? []
        );
      if (!targetActor) {
        recordDropMetrics(performance.now() - dropStart, actionMs);
        return;
      }
      const actionStart = performance.now();
      actions.devInjectOrimToActor(targetActor.id, definition.id, foundationIndex, dropPoint);
      actionMs = performance.now() - actionStart;
      recordDropMetrics(performance.now() - dropStart, actionMs);
      return;
    }
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
      const accepted = actions.playEnemyCardInRandomBiome(tableauIndex, enemyFoundationIndex);
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
      let accepted = actions.playCardInRandomBiome(tableauIndex, foundationIndex);
      if (!accepted && gameState.phase === 'garden') {
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
  }, [actions, useWild, enemyFoundationDropBase, enemyFoundations, gameState.phase, enforceTurnOwnership, effectiveActiveSide, interTurnCountdownActive, recordDropMetrics, resolveEnemyFoundationActor, resolvePlayerFoundationActor, previewPlayerFoundations, applyFoundationTimerBonus]);
  const { dragState, startDrag, setFoundationRef, dragPositionRef, getPerfSnapshot, lastDragEndAt } = useDragDrop(handleSandboxDrop, isGamePaused);
  const handleOrimTrayDragStart = useCallback((event: any, definition: OrimDefinition) => {
    if (!isLabMode) return;
    if (event.button !== 0) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    draggedOrimDefinitionRef.current = definition;
    event.preventDefault();
    startDrag(buildOrimTrayDragCard(definition), ORIM_TRAY_SOURCE_INDEX, event.clientX, event.clientY, rect);
  }, [buildOrimTrayDragCard, isLabMode, startDrag]);
  const buildAutoPlayReplaySnapshot = useCallback((state: GameState): Partial<GameState> => (
    deepCloneReplayValue({
      phase: state.phase,
      playtestVariant: state.playtestVariant,
      currentBiome: state.currentBiome,
      activeSessionTileId: state.activeSessionTileId,
      turnCount: state.turnCount,
      biomeMovesCompleted: state.biomeMovesCompleted,
      enemyDifficulty: state.enemyDifficulty,
      combatFlowMode: state.combatFlowMode,
      randomBiomeActiveSide: state.randomBiomeActiveSide,
      randomBiomeTurnNumber: state.randomBiomeTurnNumber,
      randomBiomeTurnDurationMs: state.randomBiomeTurnDurationMs,
      randomBiomeTurnRemainingMs: state.randomBiomeTurnRemainingMs,
      randomBiomeTurnLastTickAt: state.randomBiomeTurnLastTickAt,
      randomBiomeTurnTimerActive: state.randomBiomeTurnTimerActive,
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
      tileParties: state.tileParties ?? {},
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
  useEffect(() => {
    if (!autoPlayDragAnim) return;
    let rafId = 0;
    let cancelled = false;
    const node = autoPlayDragNodeRef.current;
    const dx = autoPlayDragAnim.to.x - autoPlayDragAnim.from.x;
    const dy = autoPlayDragAnim.to.y - autoPlayDragAnim.from.y;
    const distance = Math.hypot(dx, dy);
    const arcLiftPx = Math.min(26, Math.max(8, distance * 0.06));
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - autoPlayDragAnim.startedAtMs;
      const rawProgress = Math.max(0, Math.min(1, elapsed / autoPlayDragAnim.durationMs));
      const eased = easeInOutCubic(rawProgress);
      const arc = Math.sin(Math.PI * rawProgress) * arcLiftPx;
      const x = autoPlayDragAnim.from.x + (dx * eased);
      const y = autoPlayDragAnim.from.y + (dy * eased) - arc;
      const headingDegrees = Math.atan2(dy, dx) * (180 / Math.PI);
      const dragRotation = (headingDegrees * 0.08) + (Math.sin(Math.PI * rawProgress) * 4.5);
      if (node) {
        node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        node.style.setProperty('--autoplay-drag-rotation', `${dragRotation.toFixed(2)}deg`);
      }
      if (rawProgress >= 1) {
        setAutoPlayDragAnim(null);
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    if (node) {
      node.style.transform = `translate3d(${autoPlayDragAnim.from.x.toFixed(2)}px, ${autoPlayDragAnim.from.y.toFixed(2)}px, 0)`;
      node.style.setProperty('--autoplay-drag-rotation', '0deg');
    }
    rafId = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [autoPlayDragAnim]);
  const startAutoPlayDragAnimation = useCallback((
    card: CardType,
    source: AutoPlayDragSource,
    targetDropIndex: number,
    tableauIndex?: number
  ) => {
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
    const speedScale = Math.max(0.3, autoPlaySpeed * Math.max(0.55, timeScale));
    const baseDurationMs = 260 + (distance * 0.55);
    setAutoPlayDragAnim({
      id: `autoplay-drag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      card,
      from,
      to,
      startedAtMs: performance.now(),
      durationMs: Math.max(
        180,
        Math.min(
          820,
          Math.round(baseDurationMs / speedScale)
        )
      ),
    });
  }, [autoPlaySpeed, timeScale]);
  const dropRefCallbacksRef = useRef<Record<number, (index: number, ref: HTMLDivElement | null) => void>>({});
  useEffect(() => {
    if (dragState.isDragging) return;
    draggedOrimDefinitionRef.current = null;
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
    if (!isHandCardPlayable(card)) return;
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
  const handleSandboxHandLongPress = () => {};
  const handleRerollDeal = () => {
    const nextTableaus = createCombatStandardTableaus();
    setFallbackTableaus(nextTableaus);
    actions.setBiomeTableaus(nextTableaus);
  };
  const executeAutoPlayDecision = useCallback((entry: Omit<AutoPlayDecisionEntry, 'accepted' | 'at'>, run: () => boolean) => {
    const accepted = run();
    const stamped: AutoPlayDecisionEntry = {
      ...entry,
      accepted,
      at: Date.now(),
    };
    appendAutoPlayDecision(stamped);
    if (accepted) {
      autoPlayStallRef.current = 0;
      setAutoPlayStalls(0);
      setLocalTurnTimerActive(true);
    } else {
      autoPlayStallRef.current += 1;
      setAutoPlayStalls(autoPlayStallRef.current);
    }
    return accepted;
  }, [appendAutoPlayDecision]);
  const performAutoPlayStep = useCallback(() => {
    if (!autoPlayEnabled || isGamePaused || dragState.isDragging || interTurnCountdownActive || autoPlayDragAnim) return;
    if (!isLabMode) return;
    if (autoPlayBusyRef.current) return;
    autoPlayBusyRef.current = true;
    actions.cleanupDefeatedEnemies();
    try {
      runWithDeterministicRandom(autoPlayDeterministic, autoPlayRngStateRef, () => {

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
      if (actions.playRpgHandCardOnActor) {
        for (const card of previewHandCards) {
          if (!isHandCardPlayable(card)) continue;
          if (!isDirectRpgAttackCard(card)) continue;
          const power = estimateRpgAttackPower(card);
          if (card.id.startsWith('rpg-cloud-sight-')) {
            const targetIndex = bestPlayerTarget?.actorIndex ?? 0;
            const targetHp = bestPlayerTarget?.actor.hp ?? 0;
            const targetHpMax = Math.max(1, bestPlayerTarget?.actor.hpMax ?? 1);
            const missingHpPct = Math.max(0, (targetHpMax - targetHp) / targetHpMax);
            const score = (10 + missingHpPct * 10) * policy.playerSupportBias;
            candidates.push({
              side: 'player',
              kind: 'player_rpg_attack',
              score,
              label: `${card.name ?? card.id} -> ally#${targetIndex}`,
              run: () => actions.playRpgHandCardOnActor?.(card.id, 'player', targetIndex) ?? false,
            });
            continue;
          }
          if (!bestEnemyTarget) continue;
          const lowHpBonus = Math.max(0, (bestEnemyTarget.actor.hpMax ?? 1) - (bestEnemyTarget.actor.hp ?? 0));
          const score = (14 + power * 6 + lowHpBonus * 0.35) * policy.playerAggro;
          candidates.push({
            side: 'player',
            kind: 'player_rpg_attack',
            score,
            label: `${card.name ?? card.id} -> enemy#${bestEnemyTarget.enemyIndex}`,
            run: () => actions.playRpgHandCardOnActor?.(card.id, 'enemy', bestEnemyTarget.enemyIndex) ?? false,
          });
        }
      }

      for (const card of previewHandCards) {
        if (!isHandCardPlayable(card)) continue;
        for (let foundationIndex = 0; foundationIndex < previewPlayerFoundations.length; foundationIndex += 1) {
          if (!previewPlayerFoundations[foundationIndex]) continue;
          const actor = resolvePlayerFoundationActor(foundationIndex, previewPlayerFoundations[foundationIndex] ?? []);
          if (actor && !isActorAlive(actor)) continue;
          const score = scoreAbilityCard(card, 'player', foundationIndex) * policy.playerSupportBias;
          candidates.push({
            side: 'player',
            kind: 'player_hand_player_foundation',
            score,
            label: `${card.name ?? card.id} -> p#${foundationIndex}`,
            run: () => {
              const accepted = actions.playFromHand(card, foundationIndex, useWild);
              if (accepted) applyFoundationTimerBonus(foundationIndex);
              return accepted;
            },
            drag: {
              card,
              source: 'hand',
              targetDropIndex: foundationIndex,
            },
          });
        }
        for (let enemyFoundationIndex = 0; enemyFoundationIndex < enemyFoundations.length; enemyFoundationIndex += 1) {
          if ((enemyFoundations[enemyFoundationIndex]?.length ?? 0) === 0) continue;
          const actor = resolveEnemyFoundationActor(enemyFoundationIndex, enemyFoundations[enemyFoundationIndex] ?? []);
          if (actor && !isActorAlive(actor)) continue;
          const score = (scoreAbilityCard(card, 'enemy', enemyFoundationIndex) + 3) * policy.playerAggro;
          candidates.push({
            side: 'player',
            kind: 'player_hand_enemy_foundation',
            score,
            label: `${card.name ?? card.id} -> e#${enemyFoundationIndex}`,
            run: () => actions.playFromHandToEnemyFoundation(card, enemyFoundationIndex),
            drag: {
              card,
              source: 'hand',
              targetDropIndex: enemyFoundationDropBase + enemyFoundationIndex,
            },
          });
        }
      }

      const playerFoundationForAnalysis = previewPlayerFoundations.filter((foundation) => foundation.length > 0);
      if (playerFoundationForAnalysis.length > 0) {
        const analysis = analyzeOptimalSequence({
          tableaus: previewTableaus,
          foundations: previewPlayerFoundations,
          activeEffects: gameState.activeEffects,
          mode: useWild ? 'wild' : 'standard',
        });
        const bestMove = analysis.sequence[0];
        if (bestMove) {
          const rankBoost = Math.max(0, Number(bestMove.card.rank ?? 0)) * 0.25;
          candidates.push({
            side: 'player',
            kind: 'player_tableau',
            score: (18 + analysis.maxCount * 4 + rankBoost) * policy.tacticalWeight,
            label: `t#${bestMove.tableauIndex} -> p#${bestMove.foundationIndex}`,
            run: () => {
              const accepted = useWild
                ? actions.playCardInRandomBiome(bestMove.tableauIndex, bestMove.foundationIndex)
                : actions.playFromTableau(bestMove.tableauIndex, bestMove.foundationIndex);
              if (accepted) applyFoundationTimerBonus(bestMove.foundationIndex);
              return accepted;
            },
            drag: {
              card: bestMove.card,
              source: 'tableau',
              targetDropIndex: bestMove.foundationIndex,
              tableauIndex: bestMove.tableauIndex,
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
            run: () => actions.playEnemyCardInRandomBiome(bestMove.tableauIndex, bestMove.foundationIndex),
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
          const rankGap = Math.abs(Number(topCard.rank ?? 0) - Number(topFoundationCard?.rank ?? 0));
          const score = (9 + Math.max(0, Number(topCard.rank ?? 0)) * 0.12 - Math.min(6, rankGap) * 0.35) * policy.enemyAggro * policy.fallbackWeight;
          candidates.push({
            side: 'enemy',
            kind: 'enemy_tableau',
            score,
            label: `fallback t#${tableauIndex} -> e#${enemyFoundationIndex}`,
            run: () => actions.playEnemyCardInRandomBiome(tableauIndex, enemyFoundationIndex),
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
    for (const candidate of sortedCandidates) {
      if (candidate.drag) {
        startAutoPlayDragAnimation(
          candidate.drag.card,
          candidate.drag.source,
          candidate.drag.targetDropIndex,
          candidate.drag.tableauIndex
        );
      }
      const accepted = executeAutoPlayDecision(
        {
          side: candidate.side,
          kind: candidate.kind,
          score: candidate.score,
          label: candidate.label,
        },
        candidate.run
      );
      if (!accepted) continue;

      const shouldHandoffEnemyAfterSinglePlay = (
        enforceTurnOwnership
        && effectiveActiveSide === 'enemy'
        && candidate.side === 'enemy'
        && currentDifficulty === 'normal'
      );
      if (shouldHandoffEnemyAfterSinglePlay) {
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
        } else {
          actions.advanceRandomBiomeTurn();
        }
      }
      return;
    }

    if (gameState.phase === 'playing' && actions.autoPlayNextMove) {
      executeAutoPlayDecision(
        {
          side: 'system',
          kind: 'player_tableau',
          score: 4,
          label: 'phase=playing autopilot',
        },
        () => {
          actions.autoPlayNextMove?.();
          return true;
        }
      );
      return;
    }

    if (gameState.phase === 'biome' && gameState.currentBiome && !useWild && actions.completeBiome) {
      const hasAnyTableauCards = previewTableaus.some((tableau) => tableau.length > 0);
      if (!hasAnyTableauCards) {
        executeAutoPlayDecision(
          {
            side: 'system',
            kind: 'complete_biome',
            score: 3,
            label: 'complete biome',
          },
          () => {
            actions.completeBiome?.();
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
            forceLocalTurnSide(effectiveActiveSide === 'player' ? 'enemy' : 'player');
            return true;
          }
          actions.advanceRandomBiomeTurn();
          return true;
        }
      );
      return;
    }

    if (useWild && actions.endExplorationTurnInRandomBiome) {
      executeAutoPlayDecision(
        {
          side: 'system',
          kind: 'exploration_turn',
          score: 0.5,
          label: 'exploration turn',
        },
        () => {
          actions.endExplorationTurnInRandomBiome?.();
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
              forceLocalTurnSide(effectiveActiveSide === 'player' ? 'enemy' : 'player');
            } else {
              actions.advanceRandomBiomeTurn();
            }
            return true;
          }
          if (gameState.phase === 'biome') {
            actions.endRandomBiomeTurn();
            return true;
          }
          if (gameState.phase === 'playing' && actions.autoPlayNextMove) {
            actions.autoPlayNextMove();
            return true;
          }
          if (useWild && actions.endExplorationTurnInRandomBiome) {
            actions.endExplorationTurnInRandomBiome();
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
    gameState.currentBiome,
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
    useLocalTurnSide,
    useWild,
    abilityCatalogById,
    startAutoPlayDragAnimation,
    autoPlayDragAnim,
    autoPlayPolicyProfile,
  ]);
  useEffect(() => {
    if (!open || !autoPlayEnabled || !isLabMode) return;
    const intervalId = window.setInterval(() => {
      performAutoPlayStep();
    }, autoPlayStepMs);
    return () => window.clearInterval(intervalId);
  }, [autoPlayEnabled, autoPlayStepMs, isLabMode, open, performAutoPlayStep]);
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
    if (!open || !isLabMode) return;
    const foundations = gameState.foundations ?? [];
    const needsActorSeed = (foundationIndex: number) => {
      const topCard = foundations[foundationIndex]?.[0];
      if (!topCard) return true;
      const isActorLikeCard = topCard.id.startsWith('actor-')
        || topCard.id.startsWith('combatlab-foundation-')
        || topCard.id.startsWith('lab-foundation-');
      if (!isActorLikeCard) return true;
      const normalizedName = (topCard.name ?? '').trim().toLowerCase();
      if (!normalizedName || normalizedName === 'party member') return true;
      return false;
    };
    const shouldSeedLabFoundations = foundations.length < 3 || needsActorSeed(0) || needsActorSeed(1) || needsActorSeed(2);
    if (!shouldSeedLabFoundations) return;
    actions.setBiomeFoundations(buildLabSeededFoundations(gameState, foundations));
  }, [actions, gameState, isLabMode, open]);
  useEffect(() => {
    if (!open || !isLabMode) return;
    const tableaus = gameState.tableaus ?? [];
    const hasCards = tableaus.some((t) => (t?.length ?? 0) > 0);
    if (hasCards) return;
    actions.setBiomeTableaus(fallbackTableaus);
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
      actions.setBiomeTableaus(next);
    }
  }, [actions, gameState.tableaus, isLabMode]);
  useEffect(() => {
    if (hasRenderableGameTableaus) {
      setFallbackTableaus(gameTableaus);
    }
  }, [gameTableaus, hasRenderableGameTableaus]);
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
  }, [open, previewTableaus, previewPlayerFoundations, previewHandCards.length, isLabMode]);
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
    actions.setRandomBiomeActiveSide?.('player');
    setPendingTurnSide(null);
    setPendingFinalMoveResolution(false);
    setInterTurnCountdownMs(0);
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(turnDurationMs);
    }
    setLocalTurnTimerActive(false);
    syncTurnBarWidths(turnDurationMs);
  }, [actions, open, useLocalTurnSide, turnDurationMs, syncTurnBarWidths]);
  useEffect(() => {
    if (!open) return;
    setOrimTrayCollapsed(true);
    setRelicTrayCollapsed(true);
  }, [open]);
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
    actions.setRandomBiomeActiveSide?.('enemy');
    localTurnRemainingRef.current = turnDurationMs;
    displayTurnRemainingRef.current = turnDurationMs;
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(turnDurationMs);
    }
    setPendingTurnSide(null);
    setInterTurnCountdownMs(0);
    setLocalTurnTimerActive(true);
    syncTurnBarWidths(turnDurationMs);
  }, [actions, dragState.isDragging, open, pendingFinalMoveResolution, syncTurnBarWidths, turnDurationMs, useLocalTurnSide]);
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
              actions.setRandomBiomeActiveSide?.('enemy');
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
          actions.setRandomBiomeActiveSide?.(pendingTurnSide);
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
    turn: Math.max(0, Number(gameState.lifecycleTurnCounter ?? gameState.randomBiomeTurnNumber ?? gameState.turnCount ?? 0)),
    rest: Math.max(0, Number(gameState.lifecycleRestCounter ?? gameState.globalRestCount ?? 0)),
  }), [
    gameState.globalRestCount,
    gameState.lifecycleBattleCounter,
    gameState.lifecycleRestCounter,
    gameState.lifecycleRunCounter,
    gameState.lifecycleTurnCounter,
    gameState.randomBiomeTurnNumber,
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
        <div>Biome: {gameState.currentBiome ?? '--'}</div>
        <div>Turn: {gameState.randomBiomeTurnNumber ?? '--'}</div>
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
          <span>{autoPlayEnabled ? `active · ${autoPlayStepMs}ms` : 'off'}</span>
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
          onClick={actions.spawnRandomEnemyInRandomBiome}
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
          onClick={actions.endRandomBiomeTurn}
          className="rounded border border-game-teal/45 px-2 py-1 text-game-teal hover:border-game-teal transition-colors"
        >
          {autoPlayEnabled ? activeAiTurnLabel : 'End Turn'}
        </button>
        <button
          type="button"
          onClick={actions.advanceRandomBiomeTurn}
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
        Space = Pause/Resume · A = Atmosphere · P = Auto · [ ] = Time
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
            {selectedAtmosphere === 'lost_in_stars' && (
              <LostInStarsAtmosphere className="pointer-events-none absolute inset-0 z-0 h-full w-full visible" />
            )}
            {selectedAtmosphere === 'aurora_forest' && (
              <AuroraForestAtmosphere className="pointer-events-none absolute inset-0 z-0 h-full w-full visible" />
            )}
            {selectedAtmosphere === 'black_hole' && (
              <BlackHoleAtmosphere className="pointer-events-none absolute inset-0 z-0 h-full w-full visible" />
            )}
            {selectedAtmosphere === 'drifting_purple' && (
              <DriftingPurpleAtmosphere className="pointer-events-none fixed inset-0 z-0 h-screen w-screen visible" />
            )}
            {selectedAtmosphere === 'smoke_green' && (
              <SmokeGreenAtmosphere className="pointer-events-none fixed inset-0 z-0 h-screen w-screen visible" />
            )}
            {selectedAtmosphere === 'inferno_maelstrom' && (
              <InfernoMaelstromAtmosphere className="pointer-events-none fixed inset-0 z-0 h-screen w-screen visible" />
            )}
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
                    onClick={() => shiftTimeScale(-1)}
                    className="rounded border border-game-teal/45 bg-black/70 px-2 py-1 text-[10px] text-game-teal hover:border-game-teal transition-colors"
                    title="Decrease time scale ([)"
                    aria-label="Decrease time scale"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftTimeScale(1)}
                    className="rounded border border-game-teal/45 bg-black/70 px-2 py-1 text-[10px] text-game-teal hover:border-game-teal transition-colors"
                    title="Increase time scale (])"
                    aria-label="Increase time scale"
                  >
                    +
                  </button>
                </>
              )}
            </div>
            {!showCombatHud && (
              <div className="relative z-10 mb-2 text-[9px] uppercase tracking-[0.14em] text-game-teal/70">
                atmosphere only
              </div>
            )}
            {showCombatHud && isLabMode && (
              <div
                className="absolute bottom-0 left-0 top-[30px] z-20 border-r border-game-teal/30 bg-black/70"
                style={{ width: `${orimTrayWidthPx}px` }}
              >
                <div className="flex h-full flex-col items-center gap-1 overflow-y-auto px-1 py-2">
                  <button
                    type="button"
                    onClick={() => setOrimTrayCollapsed((prev) => !prev)}
                    className="flex h-5 w-5 items-center justify-center rounded border border-game-teal/50 bg-black/80 text-[10px] font-bold text-game-gold transition-colors hover:bg-black"
                    aria-label={orimTrayCollapsed ? 'Expand orim tray' : 'Collapse orim tray'}
                    title={orimTrayCollapsed ? 'Expand orim tray' : 'Collapse orim tray'}
                  >
                    {orimTrayCollapsed ? '»' : '«'}
                  </button>
                  {orimTrayCollapsed ? null : labTrayOrims.map((definition) => {
                    const element = definition.elements?.[0] ?? 'N';
                    const neon = getNeonElementColor(element);
                    return (
                      <button
                        key={`lab-orim-${definition.id}`}
                        type="button"
                        onPointerDown={(event) => handleOrimTrayDragStart(event, definition)}
                        className="flex h-10 w-10 flex-col items-center justify-center rounded border bg-black/75 px-0.5 text-center text-[8px] leading-tight text-game-white transition-colors hover:bg-black active:scale-95"
                        style={{
                          borderColor: `${neon}aa`,
                          boxShadow: `0 0 8px ${neon}66`,
                          touchAction: 'none',
                        }}
                        title={definition.name}
                        aria-label={`Drag ${definition.name} to a foundation`}
                      >
                        <span className="max-w-[34px] overflow-hidden text-ellipsis whitespace-nowrap">{definition.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {showCombatHud && isLabMode && (
              <RelicTray
                items={labTrayRelics}
                onToggleRelic={handleToggleLabRelic}
                widthPx={RELIC_TRAY_WIDTH_PX}
                collapsedWidthPx={COLLAPSED_TRAY_WIDTH_PX}
                topOffsetPx={30}
                side="right"
                collapsed={relicTrayCollapsed}
                onToggleCollapsed={() => setRelicTrayCollapsed((prev) => !prev)}
              />
            )}
            {showCombatHud && (
            <div
              ref={fitViewportRef}
              className="relative z-10 flex-1 min-h-0 w-full overflow-hidden"
              style={{
                paddingLeft: isLabMode ? `${orimTrayWidthPx + 6}px` : undefined,
                paddingRight: isLabMode ? `${relicTrayWidthPx + 6}px` : undefined,
              }}
            >
              {autoPlayDragAnim && (
                <div className="pointer-events-none absolute inset-0 z-[10120]">
                  <div
                    ref={autoPlayDragNodeRef}
                    className="pointer-events-none absolute left-0 top-0"
                    style={{ willChange: 'transform' }}
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
              <div className="flex w-full items-start justify-center px-1">
                <div className="flex items-start justify-center gap-[50px]">
                  {enemyFoundationIndexes.map((idx) => {
                    const statuses = buildFoundationStatuses('enemy', idx);
                    const foundationCards = enemyFoundations[idx] ?? [];
                    const showSpawnControl = isLabMode && foundationCards.length === 0;
                    const spawnSelection = getSelectedEnemySpawnId(idx);
                    return (
                      <div
                        key={`enemy-foundation-${idx}`}
                        className="relative rounded border border-game-teal/30 bg-black/45 p-[3px] shrink-0"
                        style={{ minWidth: previewFoundationWidth }}
                      >
                        <Foundation
                          cards={foundationCards}
                          index={idx}
                          onFoundationClick={() => {}}
                          canReceive={false}
                          interactionMode={gameState.interactionMode}
                          showGraphics={showGraphics}
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
                  {shouldRenderTurnBars && effectiveActiveSide === 'enemy' && !interTurnCountdownActive && (
                    <div className="flex w-full justify-center px-1">
                      <div className="w-[420px] max-w-[70vw] px-2 py-1">
                        <div className="mb-1 text-center text-[9px] uppercase tracking-[0.2em] text-[#ff8a00]">Enemy Turn</div>
                        <div className="flex justify-center">
                          <div
                            ref={enemyTurnBarRef}
                            className="h-[8px] rounded transition-[width] duration-75 ease-linear"
                            style={{
                              width: `${turnProgressPercent}%`,
                              background: '#ff8a00',
                              boxShadow: '0 0 8px rgba(255,138,0,0.9), 0 0 18px rgba(255,138,0,0.6)',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div
                ref={tableauBandRef}
                className="relative flex w-full items-start justify-center gap-2 overflow-visible px-1"
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
              {shouldRenderTurnBars && !zenRelicEnabled && effectiveActiveSide === 'player' && !interTurnCountdownActive && (
                <div className="flex w-full justify-center px-1">
                  <div
                    className="max-w-[78vw] px-2 py-1"
                    style={{ width: `${tableauBandWidthPx}px` }}
                  >
                    <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-[#ff8a00]">
                      <span>Player Turn</span>
                      <span>{zenRelicEnabled ? '∞' : `${(turnRemainingMs / 1000).toFixed(1)}s`}</span>
                    </div>
                    <div className="relative h-[10px] overflow-hidden rounded">
                      {highPerformanceTimer ? (
                        <ParticleProgressBar
                          progress={turnProgressPercent / 100}
                          color="#ff8a00"
                          isPaused={isGamePaused}
                        />
                      ) : (
                        <div
                          ref={playerTurnBarRef}
                          className="absolute left-1/2 top-0 h-full -translate-x-1/2 rounded transition-[width] duration-75 ease-linear"
                          style={{
                            width: `${turnProgressPercent}%`,
                            background: '#ff8a00',
                            boxShadow: '0 0 10px rgba(255,138,0,0.95), 0 0 24px rgba(255,138,0,0.65)',
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
              {shouldRenderTurnBars && interTurnCountdownActive && (
                <div className="flex w-full justify-center px-1">
                  <div
                    className="max-w-[78vw] px-2 py-1"
                    style={{ width: `${tableauBandWidthPx}px` }}
                  >
                    <div className="mb-1 text-center text-[9px] uppercase tracking-[0.2em] text-[#ff8a00]">
                      {pendingTurnSide === 'player'
                        ? `GET READY: YOUR TURN IN ${(interTurnCountdownMs / 1000).toFixed(1)}`
                        : `GET READY: ENEMY TURN IN ${(interTurnCountdownMs / 1000).toFixed(1)}`}
                    </div>
                    <div className="relative h-[10px] overflow-hidden rounded">
                      {highPerformanceTimer ? (
                        <ParticleProgressBar
                          progress={Math.max(0, Math.min(100, (interTurnCountdownMs / INTER_TURN_COUNTDOWN_MS))) / 100}
                          color="#ff8a00"
                          isPaused={isGamePaused}
                        />
                      ) : (
                        <div
                          ref={playerTurnBarRef}
                          className="absolute left-1/2 top-0 h-full -translate-x-1/2 rounded transition-[width] duration-75 ease-linear"
                          style={{
                            width: `${Math.max(0, Math.min(100, (interTurnCountdownMs / INTER_TURN_COUNTDOWN_MS) * 100))}%`,
                            background: '#ff8a00',
                            boxShadow: '0 0 10px rgba(255,138,0,0.95), 0 0 24px rgba(255,138,0,0.65)',
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
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
              <div className="flex w-full items-start justify-center px-1">
                <div className="flex items-start justify-center gap-[50px]">
                  {foundationIndexes.map((idx) => {
                    const statuses = buildFoundationStatuses('player', idx);
                    return (
                      <div
                        key={`player-foundation-${idx}`}
                        className="rounded border border-game-white/30 bg-black/45 p-[3px] shrink-0"
                        style={{ minWidth: previewFoundationWidth }}
                      >
                        <Foundation
                          cards={previewPlayerFoundations[idx] ?? []}
                          index={idx}
                          onFoundationClick={() => {
                            if (interTurnCountdownActive) return;
                            if (enforceTurnOwnership && effectiveActiveSide !== 'player') return;
                            const accepted = actions.playToFoundation(idx);
                            if (accepted) {
                              setLocalTurnTimerActive(true);
                              applyFoundationTimerBonus(idx);
                            }
                          }}
                          canReceive={!!selectedCard && !!validFoundationsForSelected[idx]}
                          interactionMode={gameState.interactionMode}
                          showGraphics={showGraphics}
                          countPosition="none"
                          maskValue={false}
                          setDropRef={getFoundationDropRef(idx)}
                          watercolorOnlyCards={false}
                          neonGlowColorOverride={DEFAULT_PLAYER_FOUNDATION_GLOW}
                          neonGlowShadowOverride={`0 0 28px ${DEFAULT_PLAYER_FOUNDATION_GLOW}ee, inset 0 0 20px ${DEFAULT_PLAYER_FOUNDATION_GLOW}55`}
                          foundationOverlay={buildFoundationOverlay(idx)}
                        />
                        <StatusBadges statuses={statuses} compact className="mt-1" />
                      </div>
                    );
                  })}
                </div>
              </div>
                  <div className="flex w-full justify-center px-1 pb-0 pt-1">
                {previewHandCards.length === 0 ? (
                  <div className="flex items-center gap-2 opacity-45">
                    <div
                      className="rounded border border-dashed border-game-white/25 bg-black/30"
                      style={{
                        width: Math.round(CARD_SIZE.width * previewHandCardScale),
                        height: Math.round(CARD_SIZE.height * previewHandCardScale),
                      }}
                    />
                    <div
                      className="rounded border border-dashed border-game-white/18 bg-black/20"
                      style={{
                        width: Math.round(CARD_SIZE.width * previewHandCardScale),
                        height: Math.round(CARD_SIZE.height * previewHandCardScale),
                      }}
                    />
                  </div>
                ) : (
                  <div ref={handZoneRef} className="flex w-full justify-center">
                    <Hand
                      cards={previewHandCards}
                      cardScale={previewHandCardScale}
                      onDragStart={handleSandboxHandDragStart}
                      onCardClick={handleSandboxHandClick}
                      onCardLongPress={handleSandboxHandLongPress}
                      stockCount={0}
                      showGraphics={showGraphics}
                      interactionMode={gameState.interactionMode}
                      draggingCardId={dragState.isDragging ? dragState.card?.id : null}
                      tooltipEnabled={false}
                      upgradedCardIds={[]}
                      disableSpringMotion={true}
                      watercolorOnlyCards={false}
                      isCardPlayable={isHandCardPlayable}
                      getCardLockReason={getHandCardLockReason}
                    />
                  </div>
                )}
              </div>
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
