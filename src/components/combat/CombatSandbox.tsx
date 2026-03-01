import { Profiler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGraphics } from '../../contexts/GraphicsContext';
import { useCardScalePreset } from '../../contexts/CardScaleContext';
import { CARD_SIZE, ELEMENT_TO_SUIT, HAND_SOURCE_INDEX } from '../../engine/constants';
import { getRankDisplay } from '../../engine/rules';
import { getBiomeDefinition } from '../../engine/biomes';
import { ACTOR_DEFINITIONS, getActorDefinition } from '../../engine/actors';
import { createActorDeckStateWithOrim } from '../../engine/actorDecks';
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
import type { Actor, Card as CardType, Element, GameState, OrimDefinition, SelectedCard } from '../../engine/types';
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
  onCycleTimeScale: () => void;
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

type PerfSummary = { avg: number; p95: number; max: number };
type PerfFpsSummary = { avg: number; p95: number; worst: number };

const PERF_SAMPLE_CAP = 180;

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
  effects?: Array<{ deadRunOnly?: boolean }>;
  triggers?: Array<{
    type?: string;
    target?: 'self' | 'enemy' | 'anyone';
    value?: number;
    operator?: '<' | '<=' | '>' | '>=' | '=' | '!=';
    countdownType?: 'combo' | 'seconds';
    countdownValue?: number;
  }>;
};

function normalizeAbilityTriggerType(rawType: unknown): string {
  const normalized = String(rawType ?? '').trim().toLowerCase();
  if (normalized === 'deadtableau' || normalized === 'dead_tableau') return 'noValidMovesPlayer';
  if (normalized === 'novalidmovesplayer' || normalized === 'no_valid_moves_player') return 'noValidMovesPlayer';
  if (normalized === 'novalidmovesenemy' || normalized === 'no_valid_moves_enemy') return 'noValidMovesEnemy';
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
  onCycleTimeScale,
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
  const [configCollapsed, setConfigCollapsed] = useState(true);
  const [atmosphereMenuOpen, setAtmosphereMenuOpen] = useState(false);
  const [selectedAtmosphere, setSelectedAtmosphere] = useState<AtmosphereEffectId>('none');
  const [atmosphereOnlyMode, setAtmosphereOnlyMode] = useState(false);
  const [hudFps, setHudFps] = useState(0);
  const showGraphics = useGraphics();
  const tableGlobalScale = useCardScalePreset('table');
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
      if (type === 'ko') {
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
        const resolvedRarity = (definition?.rarity ?? catalogAbility?.rarity ?? 'common') as CardType['rarity'];
        const resolvedCost = Math.max(0, Number(deckCard.cost ?? 0));
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
    gameState.orimInstances,
    gameState.orimDefinitions,
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
    const cost = Math.max(0, Number(card.rpgApCost ?? 0));
    if (cost <= 0) return true;
    if (!card.sourceActorId) return false;
    const actorAp = actorApById.get(card.sourceActorId) ?? 0;
    return actorAp >= cost;
  }, [actorApById, effectiveActiveSide, enforceTurnOwnership, interTurnCountdownActive]);
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
  const handleZenEndTurn = useCallback(() => {
    if (!zenRelicEnabled) return;
    if (!showTurnTimer || !enforceTurnOwnership) return;
    if (interTurnCountdownActive) return;

    if (useLocalTurnSide) {
      const nextSide: 'player' | 'enemy' = effectiveActiveSide === 'player' ? 'enemy' : 'player';
      setLabTurnSide(nextSide);
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
      return;
    }

    actions.advanceRandomBiomeTurn();
  }, [
    actions,
    effectiveActiveSide,
    enforceTurnOwnership,
    interTurnCountdownActive,
    showTurnTimer,
    syncTurnBarWidths,
    turnDurationMs,
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
  const buildPerfCapturePayload = useCallback(() => {
    const dragPerf = getPerfSnapshot();
    const fpsPerf = summarizeFpsFromFrameTimes(frameDeltaSamplesRef.current);
    const dropTotalPerf = summarizePerfSamples(dropTotalDurationSamplesRef.current);
    const dropActionPerf = summarizePerfSamples(dropActionDurationSamplesRef.current);
    const rpgTickPerf = summarizePerfSamples(rpgTickDurationSamplesRef.current);
    const reactCommitPerf = summarizePerfSamples(reactCommitDurationSamplesRef.current);
    const longTaskPerf = summarizePerfSamples(longTaskDurationSamplesRef.current);
    return {
      capturedAt: new Date().toISOString(),
      mode: isLabMode ? 'combat-lab' : 'combat-sandbox',
      activeSide: effectiveActiveSide,
      fps: fpsPerf,
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
  }, [effectiveActiveSide, getPerfSnapshot, isLabMode, perfSnapshot]);
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
  const dropRefCallbacksRef = useRef<Record<number, (index: number, ref: HTMLDivElement | null) => void>>({});
  useEffect(() => {
    if (dragState.isDragging) return;
    draggedOrimDefinitionRef.current = null;
  }, [dragState.isDragging, lastDragEndAt]);
  // Register explicit drop indices so player and enemy foundations both participate in hit-testing.
  const getFoundationDropRef = useCallback((mappedIndex: number) => {
    if (!dropRefCallbacksRef.current[mappedIndex]) {
      dropRefCallbacksRef.current[mappedIndex] = (_componentIndex: number, ref: HTMLDivElement | null) => {
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
    setPendingTurnSide(null);
    setPendingFinalMoveResolution(false);
    setInterTurnCountdownMs(0);
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(turnDurationMs);
    }
    setLocalTurnTimerActive(false);
    syncTurnBarWidths(turnDurationMs);
  }, [open, useLocalTurnSide, turnDurationMs, syncTurnBarWidths]);
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
    localTurnRemainingRef.current = turnDurationMs;
    displayTurnRemainingRef.current = turnDurationMs;
    if (!DISABLE_TURN_BAR_ANIMATION) {
      setLocalTurnRemainingMs(turnDurationMs);
    }
    setPendingTurnSide(null);
    setInterTurnCountdownMs(0);
    setLocalTurnTimerActive(true);
    syncTurnBarWidths(turnDurationMs);
  }, [dragState.isDragging, open, pendingFinalMoveResolution, syncTurnBarWidths, turnDurationMs, useLocalTurnSide]);
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
  }, [dragState.isDragging, finalMoveRelicEnabled, interTurnCountdownActive, interTurnCountdownMs, isGamePaused, labTurnSide, localTurnTimerActive, masterStrategistRelicEnabled, open, pendingTurnSide, showTurnTimer, syncTurnBarWidths, timeScale, turnDurationMs, useLocalTurnSide, zenRelicEnabled]);
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
          End Turn
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
          onClick={onCycleTimeScale}
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
        Space = Pause/Resume · A = Atmosphere
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
            <FpsBadge
              fps={hudFps}
              onClick={() => setAtmosphereOnlyMode((prev) => !prev)}
              title={showCombatHud ? 'Hide HUD (atmosphere only)' : 'Show HUD'}
              className="relative z-10 mb-2 rounded border border-game-gold/60 bg-black/70 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-game-gold"
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
            />
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
                    End Turn
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
                  <div className="flex w-full justify-center">
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
