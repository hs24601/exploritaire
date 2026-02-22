import { memo, useEffect, useState, useMemo, useCallback, useRef, type RefObject, type KeyboardEventHandler, type MutableRefObject } from 'react';
import { useGraphics } from '../contexts/GraphicsContext';
import type { GameState, Card as CardType, Element, Move, SelectedCard, Actor, ActorDefinition, Die as DieType, RelicCombatEvent, ActorKeru, ActorKeruArchetype, EncounterDefinition } from '../engine/types';
import type { PoiReward } from '../engine/worldMapTypes';
import type { DragState } from '../hooks/useDragDrop';
import { subscribeDragRaf } from '../hooks/dragRafCoordinator';
import { useExplorationEncounterState } from '../hooks/useExplorationEncounterState';
import { useExplorationBootstrapState } from '../hooks/useExplorationBootstrapState';
import { useExplorationMapVisibility } from '../hooks/useExplorationMapVisibility';
import { useExplorationNavigationControls } from '../hooks/useExplorationNavigationControls';
import { useExplorationPoiArrivalRewards } from '../hooks/useExplorationPoiArrivalRewards';
import { useExplorationPoiClearRewards } from '../hooks/useExplorationPoiClearRewards';
import { useExplorationOrimRewardCallouts } from '../hooks/useExplorationOrimRewardCallouts';
import { useExplorationPoiRewardFlow } from '../hooks/useExplorationPoiRewardFlow';
import { useExplorationTableauDisplaySync } from '../hooks/useExplorationTableauDisplaySync';
import { useExplorationTableauProgress } from '../hooks/useExplorationTableauProgress';
import { useExplorationTravelProgression } from '../hooks/useExplorationTravelProgression';
import { useExplorationTraverseHoldControls } from '../hooks/useExplorationTraverseHoldControls';
import { useExplorationTraversalController } from '../hooks/useExplorationTraversalController';
import { useKeruMutationCallouts } from '../hooks/useKeruMutationCallouts';
import type { BlockingRect } from '../engine/lighting';
import { ShadowCanvas } from './LightRenderer';
import { GameButton } from './GameButton';
import { Tableau } from './Tableau';
import { PerspectiveTableauGroup } from './PerspectiveTableauGroup';
import { FoundationActor } from './FoundationActor';
import { Card } from './Card';
import { JewelOrim } from './JewelModal';
import { Die } from './Die';
import { NodeEdgeBiomeScreen } from './NodeEdgeBiomeScreen';
import { FoundationTokenGrid } from './FoundationTokenGrid';
import { Foundation } from './Foundation';
import { DIRECTIONS, type Direction } from './Compass';
import type { ExplorationMapEdge, ExplorationMapNode, ExplorationBlockedCell } from './ExplorationMap';
import type { PoiNarration } from './Exploritaire';
import { InteractionScreen } from './InteractionScreen';
import { ComboTimerController } from './ComboTimerController';
import { ResourceStash } from './ResourceStash';
import {
  EnemyAiController,
  ENEMY_DRAG_SPEED_FACTOR,
  getEnemyMoveAnimationMs,
  ENEMY_TURN_TIME_BUDGET_MS,
} from './EnemyAiController';
import {
  CARD_SIZE,
  ELEMENT_TO_SUIT,
  createWildSentinel,
  getSuitDisplay,
  HAND_SOURCE_INDEX,
  randomIdSuffix,
  SUIT_COLORS,
  WILD_SENTINEL_RANK,
} from '../engine/constants';
import { useCardScale } from '../contexts/CardScaleContext';
import { Hand } from './Hand';
import { PartyBench } from './PartyBench';
import { canPlayCardWithWild, isSequential } from '../engine/rules';
import { actorHasOrimDefinition } from '../engine/orimEffects';
import { getActorDefinition } from '../engine/actors';
import { ORIM_DEFINITIONS } from '../engine/orims';
import { getActiveBlindLevel, getBlindedDetail, getBlindedHiddenTableauIndexes, getBlindedLabel } from '../engine/rpgBlind';
import { getOrimAccentColor, getOrimWatercolorConfig, ORIM_WATERCOLOR_CANVAS_SCALE } from '../watercolor/orimWatercolor';
import { WatercolorOverlay } from '../watercolor/WatercolorOverlay';
import { useWatercolorEngine, usePaintMarkCount } from '../watercolor-engine/WatercolorContext';
import { getBiomeDefinition } from '../engine/biomes';
import { createDie } from '../engine/dice';
import { useDevModeFlag } from '../utils/devMode';
import { mainWorldMap } from '../data/worldMap';
import type { PoiTableauPresetId } from '../data/poiTableaus';
import { SplatterPatternModal } from './SplatterPatternModal';
import { Tooltip } from './Tooltip';
import { createRandomBattleHandRewardCard, getBattleHandRewardThreshold } from './combat/battleHandUnlocks';
import { StartMatchOverlay, type StartOverlayPhase } from './combat/StartMatchOverlay';
import { CombatOverlayFrame } from './combat/CombatOverlayFrame';
import { RpgCardInspectOverlay, getRpgCardMeta } from './combat/RpgCardInspectOverlay';
import { ActorInspectOverlay } from './combat/ActorInspectOverlay';
import { TargetSwirlIndicator } from './TargetSwirlIndicator';
import { Callout } from './Callout';
import { ExplorationEncounterPanel } from './encounters/ExplorationEncounterPanel';
import { isGameAudioMuted, playCardPlaceSound, setGameAudioMuted } from '../audio/gameAudio';
import {
  ASPECT_ABILITY_DEFINITIONS,
  ASPECT_DISPLAY_TEXT,
  KERU_ARCHETYPE_OPTIONS,
  KERU_ARCHETYPE_CARDS,
  KeruAspect,
} from '../data/keruAspects';

const CONTROLLED_DRAGONFIRE_BEHAVIOR_ID = 'controlled_dragonfire_v1';
const CONTROLLED_DRAGONFIRE_CARD_ID_PREFIX = 'relic-controlled-dragonfire-';
const SUMMON_DARKSPAWN_BEHAVIOR_ID = 'summon_darkspawn_v1';
const DEV_TRAVERSE_HOLD_DELAY_MS = 260;
const DEV_TRAVERSE_HOLD_INTERVAL_MS = 190;
const JUMBO_LAYOUT_SCALE = 6;
const KERU_CALLOUT_DURATION_MS = 6600;
const getAspectLabel = (archetype?: string) => {
  if (!archetype || archetype === 'blank') return undefined;
  return ASPECT_DISPLAY_TEXT[archetype as KeruAspect] ??
    `${archetype.charAt(0).toUpperCase()}${archetype.slice(1)}`;
};
const VALID_KERU_ASPECT_SET = new Set<KeruAspect>(KERU_ARCHETYPE_OPTIONS.map((option) => option.archetype));
const BASE_KERU_ASPECT_ORDER = KERU_ARCHETYPE_OPTIONS.map((option) => option.archetype);
const KERU_STAT_DIFFS: Array<{ key: keyof ActorKeru; label: string }> = [
  { key: 'hpMax', label: 'HP' },
  { key: 'staminaMax', label: 'Stamina' },
  { key: 'energyMax', label: 'Energy' },
  { key: 'armor', label: 'Armor' },
  { key: 'evasion', label: 'Evasion' },
  { key: 'sight', label: 'Sight' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'leadership', label: 'Leadership' },
];
const buildKeruStatLines = (previous: ActorKeru, next: ActorKeru): string[] =>
  KERU_STAT_DIFFS.reduce((lines, { key, label }) => {
    const prevValue = previous[key] ?? 0;
    const nextValue = next[key] ?? 0;
    const diff = nextValue - prevValue;
    if (diff > 0) {
      lines.push(`${label}+${diff}`);
    }
    return lines;
  }, [] as string[]);

const getKeruAspectAttributeLines = (archetype?: ActorKeruArchetype | null): string[] => {
  if (!archetype || archetype === 'blank') return [];
  const lookup = archetype.toLowerCase();
  const match = ORIM_DEFINITIONS.find((entry) => {
    if (!entry.isAspect || !entry.aspectProfile) return false;
    const id = String(entry.id ?? '').toLowerCase();
    const name = String(entry.name ?? '').toLowerCase();
    const key = String(entry.aspectProfile.key ?? '').toLowerCase();
    const archetypeName = String(entry.aspectProfile.archetype ?? '').toLowerCase();
    return id === lookup || name === lookup || key === lookup || archetypeName === lookup;
  });
  if (!match?.aspectProfile) return [];
  return (match.aspectProfile.attributes ?? []).map((attr) => {
    if (typeof attr === 'string') return attr;
    const stat = String(attr.stat ?? '').trim();
    const op = String(attr.op ?? '').trim() || '+';
    const value = String(attr.value ?? '').trim();
    return `${stat}${op}${value}`.trim();
  }).filter(Boolean);
};

type DragLight = {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: string;
  castShadows: boolean;
  flicker: { enabled: boolean; speed: number; amount: number };
};

const DragLightOverlay = memo(function DragLightOverlay({
  active,
  dragPositionRef,
  fallbackPositionRef,
  effectiveGlobalCardScale,
  containerSize,
  containerRef,
  anchorRef,
  biomeOriginRef,
  foundationRefs,
  isDraggingKeruRewardCard,
  ambientDarkness,
}: {
  active: boolean;
  dragPositionRef?: MutableRefObject<{ x: number; y: number }>;
  fallbackPositionRef: MutableRefObject<{ x: number; y: number }>;
  effectiveGlobalCardScale: number;
  containerSize: { width: number; height: number };
  containerRef: RefObject<HTMLDivElement>;
  anchorRef: RefObject<HTMLDivElement>;
  biomeOriginRef: MutableRefObject<{ left: number; top: number }>;
  foundationRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  isDraggingKeruRewardCard: boolean;
  ambientDarkness: number;
}) {
  const [lights, setLights] = useState<DragLight[]>([]);

  useEffect(() => {
    if (!active) {
      setLights([]);
      return;
    }
    const update = () => {
      const base = dragPositionRef?.current ?? fallbackPositionRef.current;
      const cardScale = 1.25;
      const effectiveScale = cardScale * effectiveGlobalCardScale;
      const dragCenterX = base.x + (CARD_SIZE.width * effectiveScale) / 2 - biomeOriginRef.current.left;
      const dragCenterY = base.y + (CARD_SIZE.height * effectiveScale) / 2 - biomeOriginRef.current.top;
      const nextLights: DragLight[] = [{
        x: dragCenterX,
        y: dragCenterY,
        radius: 260,
        intensity: 1.2,
        color: '#ffffff',
        castShadows: false,
        flicker: { enabled: false, speed: 0, amount: 0 },
      }];
      if (isDraggingKeruRewardCard) {
        const targetEl = foundationRefs.current[0];
        if (targetEl) {
          const targetRect = targetEl.getBoundingClientRect();
          const targetX = targetRect.left - biomeOriginRef.current.left + (targetRect.width / 2);
          const targetY = targetRect.top - biomeOriginRef.current.top + (targetRect.height / 2);
          nextLights.push({
            x: targetX,
            y: targetY,
            radius: 220,
            intensity: 1.05,
            color: '#7fdbca',
            castShadows: false,
            flicker: { enabled: true, speed: 0.007, amount: 0.16 },
          });
          nextLights.push({
            x: targetX,
            y: targetY,
            radius: 140,
            intensity: 1.25,
            color: '#f7d24b',
            castShadows: false,
            flicker: { enabled: true, speed: 0.011, amount: 0.24 },
          });
        }
      }
      setLights(nextLights);
    };
    update();
    const unsubscribe = subscribeDragRaf(() => update());
    return unsubscribe;
  }, [
    active,
    dragPositionRef,
    fallbackPositionRef,
    effectiveGlobalCardScale,
    biomeOriginRef,
    foundationRefs,
    isDraggingKeruRewardCard,
  ]);

  if (!active || containerSize.width <= 0) return null;

  const lightX = containerSize.width / 2;
  const lightY = containerSize.height * 0.05;
  const lightRadius = Math.max(containerSize.width, containerSize.height) * 1.2;

  return (
    <ShadowCanvas
      containerRef={containerRef}
      anchorRef={anchorRef}
      useCameraTransform={false}
      lightX={lightX}
      lightY={lightY}
      lightRadius={lightRadius}
      lightIntensity={0}
      lightColor="#ffffff"
      ambientDarkness={ambientDarkness}
      flickerSpeed={0}
      flickerAmount={0}
      blockers={[]}
      actorGlows={[]}
      actorLights={lights}
      worldWidth={containerSize.width}
      worldHeight={containerSize.height}
      tileSize={100}
      width={containerSize.width}
      height={containerSize.height}
    />
  );
});

interface CombatGolfProps {
  gameState: GameState;
  encounterDefinition?: EncounterDefinition;
  selectedCard: SelectedCard | null;
  validFoundationsForSelected: boolean[];
  tableauCanPlay: boolean[];
  noValidMoves: boolean;
  isWon: boolean;
  guidanceMoves: Move[];
  activeParty: Actor[];
  sandboxOrimIds?: string[];
  orimTrayDevMode?: boolean;
  orimTrayTab?: 'puzzle' | 'combat';
  onOrimTrayTabChange?: (tab: 'puzzle' | 'combat') => void;
  sandboxOrimSearch?: string;
  onSandboxOrimSearchChange?: (next: string) => void;
  sandboxOrimResults?: Array<{ id: string; name: string; domain: 'puzzle' | 'combat' }>;
  onAddSandboxOrim?: (id: string) => void;
  onRemoveSandboxOrim?: (id: string) => void;
  hasCollectedLoot: boolean;
  dragState: DragState;
  dragPositionRef?: MutableRefObject<{ x: number; y: number }>;
  handleDragStart: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  setFoundationRef: (index: number, el: HTMLDivElement | null) => void;
  handCards: CardType[];
  foundationSplashHint?: {
    foundationIndex: number;
    directionDeg: number;
    token: number;
  } | null;
  rpgImpactSplashHint?: {
    side: 'player' | 'enemy';
    foundationIndex: number;
    directionDeg: number;
    token: number;
  } | null;
  tooltipSuppressed: boolean;
  handleExitBiome: (mode: 'return' | 'abandon') => void;
  useGhostBackground: boolean;
  lightingEnabled: boolean;
  paintLuminosityEnabled?: boolean;
  onTogglePaintLuminosity?: () => void;
  fps?: number;
  serverAlive?: boolean;
  onOpenSettings?: () => void;
  onOpenPoiEditorAt?: (x: number, y: number) => void;
  poiRewardResolvedAt?: number;
  infiniteStockEnabled: boolean;
  onToggleInfiniteStock: () => void;
  noRegretStatus: { canRewind: boolean; cooldown: number; actorId: string | null };
  zenModeEnabled?: boolean;
  isGamePaused?: boolean;
  timeScale?: number;
  onTogglePause?: () => void;
  onToggleCombatSandbox?: () => void;
  onPositionChange?: (x: number, y: number) => void;
  wildAnalysis?: { key: string; sequence: Move[]; maxCount: number } | null;
  actions: {
    selectCard: (card: CardType, tableauIndex: number) => void;
    playToFoundation: (foundationIndex: number) => boolean;
    playCardDirect: (tableauIndex: number, foundationIndex: number) => boolean;
    playCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => boolean;
    playEnemyCardInRandomBiome?: (tableauIndex: number, foundationIndex: number) => boolean;
    playEnemyRpgHandCardOnActor?: (enemyActorIndex: number, cardId: string, targetActorIndex: number) => boolean;
    playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
    playFromStock: (foundationIndex: number, useWild?: boolean, force?: boolean) => boolean;
    completeBiome: () => void;
    autoSolveBiome: () => void;
    playCardInNodeBiome: (nodeId: string, foundationIndex: number) => void;
    endRandomBiomeTurn: () => void;
    endExplorationTurnInRandomBiome?: () => void;
    advanceRandomBiomeTurn?: () => void;
    rerollRandomBiomeDeal?: () => void;
    spawnRandomEnemyInRandomBiome?: () => void;
    cleanupDefeatedEnemies?: () => void;
    setBiomeTableaus?: (tableaus: CardType[][]) => void;
    tickRpgCombat?: (nowMs: number) => boolean;
    processRelicCombatEvent?: (event: RelicCombatEvent) => void;
    adjustRpgHandCardRarity?: (cardId: string, delta: -1 | 1) => boolean;
    addRpgHandCard?: (card: CardType) => boolean;
    removeRpgHandCardById?: (cardId: string) => boolean;
    applyKeruArchetype?: (archetype: 'lupus' | 'ursus' | 'felis') => boolean;
    setEnemyDifficulty?: (difficulty: GameState['enemyDifficulty']) => void;
    rewindLastCard: () => boolean;
    swapPartyLead: (actorId: string) => void;
    playWildAnalysisSequence: () => void;
    puzzleCompleted?: (payload?: { coord?: { x: number; y: number } | null; poiId?: string | null; tableauId?: string | null } | null) => void;
    startBiome?: (tileId: string, biomeId: string) => void;
  };
  benchSwapCount?: number;
  infiniteBenchSwapsEnabled?: boolean;
  onToggleInfiniteBenchSwaps?: () => void;
  onConsumeBenchSwap?: () => void;
  explorationStepRef?: { current: (() => void) | null };
  forcedPerspectiveEnabled?: boolean;
}

interface TurnTimerRailProps {
  label: string;
  fillPercent?: string;
  timerRef?: RefObject<HTMLDivElement | null>;
  totalMs?: number;
  remainingMsOverride?: number;
  showSkipButton?: boolean;
  onSkip?: (remainingMs: number) => void;
  showPauseButton?: boolean;
  onTogglePause?: () => void;
  isGamePaused?: boolean;
  paused?: boolean;
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  cursor?: 'pointer' | 'default';
}

function TurnTimerRail({
  label,
  fillPercent,
  timerRef,
  totalMs = 10000,
  remainingMsOverride,
  showSkipButton = false,
  onSkip,
  showPauseButton = false,
  onTogglePause,
  isGamePaused = false,
  paused = false,
  onClick,
  role,
  tabIndex,
  onKeyDown,
  cursor = 'default',
}: TurnTimerRailProps) {
  const parsePercent = useCallback((value?: string) => {
    if (!value) return 100;
    const parsed = Number.parseFloat(value.replace('%', '').trim());
    if (!Number.isFinite(parsed)) return 100;
    return Math.max(0, Math.min(100, parsed));
  }, []);
  const remainingMs = remainingMsOverride ?? Math.max(0, Math.round((parsePercent(fillPercent) / 100) * totalMs));
  const resolvedFillPct = Math.max(0, Math.min(100, (remainingMs / Math.max(1, totalMs)) * 100));
  const durationSeconds = Math.max(0, totalMs / 1000);
  const durationLabel = `${durationSeconds.toFixed(1)}s`;

  const healthColor = useMemo(() => {
    const t = Math.max(0, Math.min(1, resolvedFillPct / 100));
    const r = Math.round(120 + (1 - t) * 105);
    const g = Math.round(60 + t * 140);
    const b = Math.round(48 + t * 26);
    return `rgb(${r}, ${g}, ${b})`;
  }, [resolvedFillPct]);
  const remainingSeconds = Math.max(0, remainingMs / 1000);
  const timerValueLabel = `${remainingSeconds.toFixed(1)}s`;

  return (
    <div
      className="fixed z-[10012] pointer-events-auto"
      style={{
        left: 12,
        top: 74,
        bottom: 76,
      }}
    >
      <div className="h-full flex flex-col items-center gap-2">
        <div
          className="px-2 py-1 rounded border text-[9px] font-bold tracking-[2px]"
          style={{
            color: '#f7d24b',
            borderColor: 'rgba(255, 229, 120, 0.8)',
            backgroundColor: 'rgba(10, 8, 6, 0.92)',
            boxShadow: '0 0 10px rgba(230, 179, 30, 0.5)',
            lineHeight: 1.1,
          }}
        >
          {label}
        </div>
      <div
        ref={timerRef}
        className="relative flex-1 w-9 font-bold rounded border overflow-hidden select-none"
        onClick={onClick}
        role={role}
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
        style={{
          borderColor: 'rgba(255, 229, 120, 0.9)',
          boxShadow: '0 0 12px rgba(230, 179, 30, 0.65)',
          backgroundColor: 'rgba(10, 8, 6, 0.92)',
          cursor,
          ['--combo-fill' as string]: `${resolvedFillPct}%`,
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: 'var(--combo-fill)',
            backgroundColor: 'rgba(230, 179, 30, 0.95)',
            transition: 'height 90ms linear',
          }}
        />
        <div
          className="absolute left-1/2 pointer-events-none px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-[1px]"
          style={{
            top: `calc(${100 - resolvedFillPct}% - 2px)`,
            transform: 'translate(-50%, -100%)',
            color: '#f8f8f8',
            borderColor: `${healthColor}`,
            backgroundColor: 'rgba(10, 8, 6, 0.9)',
            boxShadow: `0 0 8px ${healthColor}`,
            lineHeight: 1,
            transition: 'top 90ms linear, border-color 120ms linear, box-shadow 120ms linear',
          }}
        >
          {timerValueLabel}
        </div>
        {paused && (
          <div
            className="absolute inset-0 flex items-center justify-center text-xl font-bold pointer-events-none"
            style={{ color: '#f7d24b', textShadow: '0 0 8px rgba(247, 210, 75, 0.75)' }}
          >
            ||
          </div>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-[2px] text-game-white/60">{`duration ${durationLabel}`}</div>
        {showSkipButton ? (
          <button
            type="button"
            onClick={() => onSkip?.(remainingMs)}
            disabled={!onSkip}
            className="px-2 py-1 rounded border text-[12px] font-bold leading-none disabled:opacity-50"
            title="Skip turn"
            style={{
              color: '#0a0a0a',
              borderColor: 'rgba(255, 229, 120, 0.9)',
              backgroundColor: 'rgba(230, 179, 30, 0.95)',
              boxShadow: '0 0 10px rgba(230, 179, 30, 0.55)',
              minWidth: 34,
              textAlign: 'center',
            }}
          >
            ⏭
          </button>
        ) : <div style={{ minHeight: 28 }} />}
        {showPauseButton ? (
          <button
            type="button"
            onClick={onTogglePause}
            disabled={!onTogglePause}
            className="rounded border border-game-gold/70 bg-game-bg-dark/90 px-4 py-2 text-[12px] font-bold tracking-[2px] text-game-gold shadow-neon-gold disabled:opacity-50"
            title={isGamePaused ? 'Resume' : 'Pause'}
            aria-label={isGamePaused ? 'Resume' : 'Pause'}
          >
            {isGamePaused ? '▶' : '⏸'}
          </button>
        ) : <div style={{ minHeight: 36 }} />}
      </div>
    </div>
  );
}

type MajorDirection = 'N' | 'E' | 'S' | 'W';
type MinorDirection = 'NE' | 'SE' | 'SW' | 'NW';
type TableauColumnSource =
  | { kind: 'major'; direction: MajorDirection; columnIndex: number }
  | { kind: 'minor-center'; direction: MinorDirection };

const DEFAULT_TABLEAU_COLUMNS = 7;
const EXPLORATION_SLIDE_ANIMATION_MS = 1200;

const getMinorBlendSources = (direction: MinorDirection): TableauColumnSource[] => {
  switch (direction) {
    case 'NE':
      return [
        { kind: 'major', direction: 'N', columnIndex: 4 },
        { kind: 'major', direction: 'N', columnIndex: 5 },
        { kind: 'major', direction: 'N', columnIndex: 6 },
        { kind: 'minor-center', direction: 'NE' },
        { kind: 'major', direction: 'E', columnIndex: 0 },
        { kind: 'major', direction: 'E', columnIndex: 1 },
        { kind: 'major', direction: 'E', columnIndex: 2 },
      ];
    case 'SE':
      return [
        { kind: 'major', direction: 'E', columnIndex: 4 },
        { kind: 'major', direction: 'E', columnIndex: 5 },
        { kind: 'major', direction: 'E', columnIndex: 6 },
        { kind: 'minor-center', direction: 'SE' },
        { kind: 'major', direction: 'S', columnIndex: 0 },
        { kind: 'major', direction: 'S', columnIndex: 1 },
        { kind: 'major', direction: 'S', columnIndex: 2 },
      ];
    case 'SW':
      return [
        { kind: 'major', direction: 'S', columnIndex: 4 },
        { kind: 'major', direction: 'S', columnIndex: 5 },
        { kind: 'major', direction: 'S', columnIndex: 6 },
        { kind: 'minor-center', direction: 'SW' },
        { kind: 'major', direction: 'W', columnIndex: 0 },
        { kind: 'major', direction: 'W', columnIndex: 1 },
        { kind: 'major', direction: 'W', columnIndex: 2 },
      ];
    case 'NW':
    default:
      return [
        { kind: 'major', direction: 'W', columnIndex: 4 },
        { kind: 'major', direction: 'W', columnIndex: 5 },
        { kind: 'major', direction: 'W', columnIndex: 6 },
        { kind: 'minor-center', direction: 'NW' },
        { kind: 'major', direction: 'N', columnIndex: 0 },
        { kind: 'major', direction: 'N', columnIndex: 1 },
        { kind: 'major', direction: 'N', columnIndex: 2 },
      ];
  }
};

const getColumnSourcesForDirection = (direction: Direction): TableauColumnSource[] => {
  if (direction.length === 1) {
    return Array.from({ length: DEFAULT_TABLEAU_COLUMNS }, (_, index) => ({
      kind: 'major' as const,
      direction: direction as MajorDirection,
      columnIndex: index,
    }));
  }
  return getMinorBlendSources(direction as MinorDirection);
};

const getExplorationSourceKey = (nodeId: string, source: TableauColumnSource): string => {
  if (source.kind === 'major') {
    return `${nodeId}|major|${source.direction}|${source.columnIndex}`;
  }
  return `${nodeId}|minor-center|${source.direction}`;
};

export const CombatGolf = memo(function CombatGolf({
  gameState,
  encounterDefinition,
  selectedCard,
  validFoundationsForSelected,
  tableauCanPlay,
  noValidMoves,
  isWon,
  guidanceMoves,
  activeParty,
  sandboxOrimIds = [],
  orimTrayDevMode = false,
  orimTrayTab = 'puzzle',
  onOrimTrayTabChange,
  sandboxOrimSearch = '',
  onSandboxOrimSearchChange,
  sandboxOrimResults = [],
  onAddSandboxOrim,
  onRemoveSandboxOrim,
  hasCollectedLoot,
  dragState,
  dragPositionRef,
  handleDragStart,
  setFoundationRef,
  handCards,
  foundationSplashHint = null,
  rpgImpactSplashHint = null,
  tooltipSuppressed,
  handleExitBiome,
  useGhostBackground,
  lightingEnabled,
  paintLuminosityEnabled = true,
  onTogglePaintLuminosity,
  fps,
  serverAlive,
  infiniteStockEnabled,
  onToggleInfiniteStock,
  noRegretStatus,
  zenModeEnabled = true,
  isGamePaused = false,
  timeScale = 1,
  onTogglePause,
  onToggleCombatSandbox,
  wildAnalysis = null,
  actions,
  benchSwapCount = 0,
  infiniteBenchSwapsEnabled = false,
  onToggleInfiniteBenchSwaps,
  onConsumeBenchSwap,
  onOpenSettings,
  onOpenPoiEditorAt,
  poiRewardResolvedAt,
  explorationStepRef,
  forcedPerspectiveEnabled = true,
}: CombatGolfProps) {
  const showGraphics = useGraphics();
  const [splatterModalOpen, setSplatterModalOpen] = useState(false);
  const [explorationHeading, setExplorationHeading] = useState<Direction>('N');
  const explorationSpawnX = mainWorldMap.defaultSpawnPosition.col;
  const explorationSpawnY = mainWorldMap.defaultSpawnPosition.row;
  const [explorationNodes, setExplorationNodes] = useState<ExplorationMapNode[]>([
    { id: 'origin', heading: 'N', x: explorationSpawnX, y: explorationSpawnY, z: 0, visits: 1 },
  ]);
  const [explorationEdges, setExplorationEdges] = useState<ExplorationMapEdge[]>([]);
  const [explorationCurrentNodeId, setExplorationCurrentNodeId] = useState<string>('origin');
  const [explorationTrailNodeIds, setExplorationTrailNodeIds] = useState<string[]>(['origin']);
  const [explorationStepOffsetBySource, setExplorationStepOffsetBySource] = useState<Record<string, number>>({});
  const [explorationMovesByDirection, setExplorationMovesByDirection] = useState<Record<MajorDirection, number>>({
    N: 0,
    E: 0,
    S: 0,
    W: 0,
  });
  const [explorationAppliedTraversalByDirection, setExplorationAppliedTraversalByDirection] = useState<Record<MajorDirection, number>>({
    N: 0,
    E: 0,
    S: 0,
    W: 0,
  });
  const {
    narrativeOpen,
    setNarrativeOpen,
    explorationMapAlignment,
    setExplorationMapAlignment,
    pathingLocked,
    setPathingLocked,
    explorationTotalTraversalCount,
    setExplorationTotalTraversalCount,
    ctrlHeld,
    setCtrlHeld,
    comboPaused,
    setComboPaused,
    waveBattleCount,
    setWaveBattleCount,
    explorationSupplies,
    setExplorationSupplies,
    explorationRowsPerStep,
    setExplorationRowsPerStep,
    tableauSlideOffsetPx,
    setTableauSlideOffsetPx,
    tableauSlideAnimating,
    setTableauSlideAnimating,
    devTraverseHoldProgress,
    setDevTraverseHoldProgress,
  } = useExplorationEncounterState();
  const keruHasAspect = useMemo(
    () => ((gameState.actorKeru?.selectedAspectIds ?? []).length > 0),
    [gameState.actorKeru?.selectedAspectIds]
  );
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isGameAudioMuted());
  const [bankedTurnMs, setBankedTurnMs] = useState(0);
  const [bankedTimerBonusMs, setBankedTimerBonusMs] = useState(0);
  const [bankedTimerBonusToken, setBankedTimerBonusToken] = useState<number | undefined>(undefined);
  const [bankCallouts, setBankCallouts] = useState<Array<{ id: number; ms: number }>>([]);
  const [enemyTurnEndCallouts, setEnemyTurnEndCallouts] = useState<Array<{ id: number }>>([]);
  const [waveBattleCallouts, setWaveBattleCallouts] = useState<Array<{ id: number; wave: number }>>([]);
  const waveBattleSpawnPendingRef = useRef(false);
  const waveBattleStartRef = useRef<string | null>(null);
  const [bankSmashFx, setBankSmashFx] = useState<{ id: number; ms: number } | null>(null);
  const [sunkCostPulseStartedAt, setSunkCostPulseStartedAt] = useState<number | null>(null);
  const [sunkCostPulseNowMs, setSunkCostPulseNowMs] = useState<number>(0);
  const sunkCostPulseArmedRef = useRef(false);
  const [inspectedRpgCard, setInspectedRpgCard] = useState<CardType | null>(null);
  const [inspectedRpgCardSource, setInspectedRpgCardSource] = useState<
    { side: 'player' } | { side: 'enemy'; actorIndex: number } | { side: 'reward' } | null
  >(null);
  const [inspectedActorId, setInspectedActorId] = useState<string | null>(null);
  const [actorNodeAssignments, setActorNodeAssignments] = useState<Record<string, Record<string, string>>>({});
  const [activeEnemyHandActorIndex, setActiveEnemyHandActorIndex] = useState<number | null>(null);
  const [activePlayerHandActorIndex, setActivePlayerHandActorIndex] = useState<number | null>(null);
  const [rewardedBattleHandCards, setRewardedBattleHandCards] = useState<CardType[]>([]);
  const [showKeruArchetypeReward, setShowKeruArchetypeReward] = useState(false);
  const [showKeruAbilityReward, setShowKeruAbilityReward] = useState(false);
  const [pendingPoiRewardKey, setPendingPoiRewardKey] = useState<string | null>(null);
  const [lastPoiRewardKey, setLastPoiRewardKey] = useState<string | null>(null);
  const keruAbilityRewardShownRef = useRef(false);
  const [keruFxToken, setKeruFxToken] = useState(0);
  const [keruFxActive, setKeruFxActive] = useState(false);
  const [keruStatLines, setKeruStatLines] = useState<string[]>([]);
  const [keruAttributeCallouts, setKeruAttributeCallouts] = useState<Array<{ id: number; text: string }>>([]);
  const [orimRewardCallouts, setOrimRewardCallouts] = useState<Array<{
    id: number;
    orimId: string;
    foundationIndex: number | null;
    dropPoint?: { x: number; y: number } | null;
  }>>([]);
  const keruAttributeTimeoutsRef = useRef<number[]>([]);
  const [upgradedHandCardIds, setUpgradedHandCardIds] = useState<string[]>([]);
  const upgradedFlashTimeoutsRef = useRef<Record<string, number>>({});
  const prevRpgHandIdsRef = useRef<Set<string>>(new Set());
  const rewardCardIdRef = useRef(0);
  const prevKeruMutationAtRef = useRef<number | undefined>();
  const [comboExpiryTokens, setComboExpiryTokens] = useState<Array<{ id: number; value: number }>>([]);
  const comboTokenIdRef = useRef(0);
  const [ambientDarkness, setAmbientDarkness] = useState(0.85);
  const [armedFoundationIndex, setArmedFoundationIndex] = useState<number | null>(null);
  const [tableauRipTriggerByCardId, setTableauRipTriggerByCardId] = useState<Record<string, number>>({});
  const [foundationBlockers, setFoundationBlockers] = useState<BlockingRect[]>([]);
  const dragBasePositionRef = useRef(dragState.position);
  const dragMetaRef = useRef({
    isDragging: false,
    card: null as CardType | null,
    tableauIndex: null as number | null,
    offset: { x: 0, y: 0 },
  });
  const abilityFoundationRectRef = useRef<DOMRect | null>(null);
  const keruFoundationRectRef = useRef<DOMRect | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [foundationRowWidth, setFoundationRowWidth] = useState(0);
  const [cardPlayFlashes, setCardPlayFlashes] = useState<Array<{
    id: string;
    x: number;
    y: number;
    startTime: number;
    duration: number;
    combo: number;
  }>>([]);
  const [enemyMoveAnims, setEnemyMoveAnims] = useState<Array<{
    id: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    tableauIndex?: number;
    source: 'tableau' | 'rpg';
    card?: CardType;
    rank: number;
    suit: string;
    label?: string;
  }>>([]);
  const [enemyRpgTelegraph, setEnemyRpgTelegraph] = useState<{
    id: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    enemyActorIndex: number;
    targetActorIndex: number;
    label: string;
  } | null>(null);
  const prevEnemyTurnRef = useRef<boolean>(false);
  const prevEnemyTurnForBankRef = useRef<boolean>(false);
  const explorationCurrentNodeIdRef = useRef<string>('origin');
  const explorationHeadingRef = useRef<Direction>('N');
  const explorationNodesRef = useRef<ExplorationMapNode[]>([{ id: 'origin', heading: 'N', x: explorationSpawnX, y: explorationSpawnY, z: 0, visits: 1 }]);
  const explorationEdgesRef = useRef<ExplorationMapEdge[]>([]);
  const explorationTrailNodeIdsRef = useRef<string[]>(['origin']);
  const tableauSlideRafRef = useRef<number | null>(null);
  const explorationLastTopCardIdBySourceRef = useRef<Record<string, string>>({});
  const explorationDisplayedContextRef = useRef<{ nodeId: string; heading: Direction } | null>(null);
  const explorationMajorTableauCacheRef = useRef<Record<string, CardType[][]>>({});
  const explorationMinorCenterCacheRef = useRef<Record<string, CardType[]>>({});
  const explorationPoiTableauCacheRef = useRef<Record<string, CardType[][]>>({});
  const enemyFoundationRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [enemyRevealMap, setEnemyRevealMap] = useState<Record<number, number | null>>({});
  const [enemyTurnRemainingMs, setEnemyTurnRemainingMs] = useState(ENEMY_TURN_TIME_BUDGET_MS);
  // Runtime-tunable speed scaffold; downstream systems can update this mid-match.
  const [enemyDragBaseSpeedFactor] = useState(() => ENEMY_DRAG_SPEED_FACTOR * 2);
  const isGamePausedRef = useRef(isGamePaused);
  const introBiomeRef = useRef(gameState.currentBiome ?? 'none');
  const enemyRevealTimers = useRef<Record<number, number>>({});
  const rpgTickClockRef = useRef<number>(Date.now());
  const rpgTickLastRealNowRef = useRef<number>(performance.now());
  const hpLagTimeoutsRef = useRef<Record<string, number>>({});
  const hpDamageTimeoutsRef = useRef<Record<string, number>>({});
  const prevHpMapRef = useRef<Record<string, number>>({});
  const matchLineContainerRef = useRef<HTMLDivElement | null>(null);
  const tableauRefs = useRef<Array<HTMLDivElement | null>>([]);
  const foundationRefs = useRef<Array<HTMLDivElement | null>>([]);
  const foundationRowRef = useRef<HTMLDivElement | null>(null);
  const biomeContainerRef = useRef<HTMLElement>(null!);
  const biomeContainerOriginRef = useRef({ left: 0, top: 0 });
  const watercolorEngine = useWatercolorEngine();
  const paintMarkCount = usePaintMarkCount();
  const globalCardScale = useCardScale();
  const layoutVariant = gameState.playtestVariant ?? 'single-foundation';
  const isPartyBattleLayout = layoutVariant === 'party-battle' || layoutVariant === 'rpg';
  const isPartyFoundationsLayout = layoutVariant === 'party-foundations' || isPartyBattleLayout;
  const [paintLights, setPaintLights] = useState<Array<{
    x: number;
    y: number;
    radius: number;
    intensity: number;
    color: string;
    flicker: { enabled: boolean; speed: number; amount: number };
  }>>([]);
  const [rerollDie, setRerollDie] = useState<DieType>(() => createDie());
  const [rerollRolling, setRerollRolling] = useState(false);
  useEffect(() => {
    explorationCurrentNodeIdRef.current = explorationCurrentNodeId;
  }, [explorationCurrentNodeId]);
  useEffect(() => {
    explorationHeadingRef.current = explorationHeading;
  }, [explorationHeading]);
  useEffect(() => {
    return () => {
      if (tableauSlideRafRef.current !== null) {
        window.cancelAnimationFrame(tableauSlideRafRef.current);
      }
    };
  }, []);
  const clamp01 = useCallback((value: number) => Math.max(0, Math.min(1, value)), []);
  const getHeadingDelta = useCallback((heading: Direction) => {
    const offsets: Record<Direction, { dx: number; dy: number }> = {
      N: { dx: -1, dy: -1 },
      NE: { dx: 0, dy: -1 },
      E: { dx: 1, dy: -1 },
      SE: { dx: 1, dy: 0 },
      S: { dx: 1, dy: 1 },
      SW: { dx: 0, dy: 1 },
      W: { dx: -1, dy: 1 },
      NW: { dx: -1, dy: 0 },
    };
    return offsets[heading];
  }, []);
  const cloneCard = useCallback((card: CardType): CardType => ({
    ...card,
    orimSlots: card.orimSlots ? card.orimSlots.map((slot) => ({ ...slot })) : undefined,
    orimDisplay: card.orimDisplay ? card.orimDisplay.map((entry) => ({ ...entry })) : undefined,
  }), []);
  const cloneTableaus = useCallback((tableaus: CardType[][]): CardType[][] => (
    tableaus.map((stack) => stack.map((card) => cloneCard(card)))
  ), [cloneCard]);
  // Build POI presence map directly (don't cache so it updates when POI data changes)
  // Track when POI data changes to force re-render
  const [poiDataVersion, setPoiDataVersion] = useState(0);
  const lastPoiDataRef = useRef<string>('');
  const lastPoiCellSignatureRef = useRef<string>('');
  const skipPoiCommitRef = useRef(false);
  const poiByCoordinateKey = useMemo(() => {
    const map = new Map<string, PoiTableauPresetId>();
    mainWorldMap.cells.forEach((cell) => {
      const poi = cell.poi;
      if (!poi?.tableauPresetId) return;
      map.set(`${cell.gridPosition.col},${cell.gridPosition.row}`, poi.tableauPresetId as PoiTableauPresetId);
    });
    // console.log('[POI Tableau Map] poiByCoordinateKey rebuilt. Keys:', Array.from(map.keys()));
    return map;
  }, [poiDataVersion]);

  // Watch mainWorldMap for changes (mutations from App.tsx)
  useEffect(() => {
    const interval = setInterval(() => {
      const rewardData = JSON.stringify(
        mainWorldMap.cells
          .filter((c) => c.poi?.rewards)
          .map((c) => ({ pos: c.gridPosition, rewards: c.poi?.rewards }))
      );
      const cellData = JSON.stringify(
        mainWorldMap.cells.map((cell) => ({
          pos: cell.gridPosition,
          poiId: cell.poi?.id ?? null,
          tableauPresetId: cell.poi?.tableauPresetId ?? null,
        }))
      );
      const rewardsChanged = rewardData !== lastPoiDataRef.current;
      const cellsChanged = cellData !== lastPoiCellSignatureRef.current;
      if (rewardsChanged || cellsChanged) {
        lastPoiDataRef.current = rewardData;
        lastPoiCellSignatureRef.current = cellData;
        setPoiDataVersion((v) => v + 1);
        if (cellsChanged) {
          console.log('[POI Cache] Clearing tableau cache due to POI data change');
          explorationPoiTableauCacheRef.current = {};
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    skipPoiCommitRef.current = true;
  }, [poiDataVersion]);

  // Compute POI maps fresh every render since mainWorldMap is mutated by App.tsx.
  // These are fast computations that must reflect real-time changes to mainWorldMap.
  // Reference poiDataVersion to ensure recomputation when POI data changes
  const poiPresenceByCoordinateKey = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    mainWorldMap.cells.forEach((cell) => {
      const poi = cell.poi;
      if (!poi || poi.type === 'empty') return;
      map.set(`${cell.gridPosition.col},${cell.gridPosition.row}`, { id: poi.id ?? '', name: poi.name });
    });
    console.log('[POI Map] poiPresenceByCoordinateKey rebuilt. Keys:', Array.from(map.keys()), 'version:', poiDataVersion);
    return map;
  }, [poiDataVersion]);
  const poiMapsReady = poiByCoordinateKey.size > 0 || poiPresenceByCoordinateKey.size > 0;

  const explorationPoiMarkers = Array.from(poiPresenceByCoordinateKey.entries()).map(([coordKey, poi]) => {
    const [xRaw, yRaw] = coordKey.split(',');
    return {
      id: poi.id,
      x: Number(xRaw),
      y: Number(yRaw),
      label: '?',
    };
  });

  // Build POI rewards map - computed fresh every render to reflect saved changes
  const poiRewardDefinitionsByCoordinate = (() => {
    const map = new Map<string, PoiReward[]>();
    mainWorldMap.cells.forEach((cell) => {
      const key = `${cell.gridPosition.col},${cell.gridPosition.row}`;
      const poi = cell.poi;
      if (poi?.rewards?.length) {
        map.set(key, poi.rewards);
      }
    });
    return map;
  })();

  const getPoiIdForKey = useCallback((key: string) => (
    poiPresenceByCoordinateKey.get(key)?.id ?? null
  ), [poiPresenceByCoordinateKey]);

  // Build POI narration map - computed fresh every render
  const poiNarrationByCoordinate = (() => {
    const map = new Map<string, PoiNarration>();
    mainWorldMap.cells.forEach((cell) => {
      const key = `${cell.gridPosition.col},${cell.gridPosition.row}`;
      const poi = cell.poi;
      if (poi?.narration) {
        map.set(key, poi.narration);
      }
    });
    return map;
  })();

  const getPoiRewardsForKey = useCallback((key: string) => {
    // Recompute fresh to always get current data
    const map = new Map<string, PoiReward[]>();
    mainWorldMap.cells.forEach((cell) => {
      const cellKey = `${cell.gridPosition.col},${cell.gridPosition.row}`;
      const poi = cell.poi;
      if (poi?.rewards?.length) {
        map.set(cellKey, poi.rewards);
      }
    });
    return map.get(key) ?? [];
  }, []);

  const getPoiNarrationForKey = useCallback((key: string) => (
    poiNarrationByCoordinate.get(key) ?? null
  ), [poiNarrationByCoordinate]);
  const worldBlockedCellKeys = useMemo(() => new Set(
    (mainWorldMap.blockedCells ?? []).map((cell) => `${cell.gridPosition.col},${cell.gridPosition.row}`)
  ), []);
  const worldBlockedEdges = useMemo(() => {
    const edges = new Set<string>();
    (mainWorldMap.blockedEdges ?? []).forEach((edge) => {
      const forward = `${edge.from.col},${edge.from.row}->${edge.to.col},${edge.to.row}`;
      edges.add(forward);
      if (edge.bidirectional !== false) {
        const reverse = `${edge.to.col},${edge.to.row}->${edge.from.col},${edge.from.row}`;
        edges.add(reverse);
      }
    });
    return edges;
  }, []);
  const worldForcedPath = useMemo(
    () => (mainWorldMap.tutorialRail?.path ?? []).map((step) => ({ x: step.col, y: step.row })),
    []
  );
  const explorationBlockedCells = useMemo<ExplorationBlockedCell[]>(() => (
    (mainWorldMap.blockedCells ?? []).map((cell) => ({
      x: cell.gridPosition.col,
      y: cell.gridPosition.row,
      terrain: cell.terrain,
      lightBlocker: cell.lightBlocker,
    }))
  ), []);
  const explorationBlockedEdges = useMemo(
    () => (mainWorldMap.blockedEdges ?? []).map((edge) => ({
      fromX: edge.from.col,
      fromY: edge.from.row,
      toX: edge.to.col,
      toY: edge.to.row,
    })),
    []
  );
  const isCurrentExplorationTableauCleared = useMemo(() => (
    gameState.tableaus.length > 0 && gameState.tableaus.every((tableau) => tableau.length === 0)
  ), [gameState.tableaus]);
  const getExplorationNodeCoordinates = useCallback((nodeId: string): { x: number; y: number } | null => {
    if (nodeId === 'origin') return { x: explorationSpawnX, y: explorationSpawnY };
    const parsed = /^node-(-?\d+)-(-?\d+)$/.exec(nodeId);
    if (!parsed) return null;
    return { x: Number(parsed[1]), y: Number(parsed[2]) };
  }, [explorationSpawnX, explorationSpawnY]);
  const consumedPoiRewardKeysRef = useRef<Set<string>>(new Set());
  useExplorationPoiClearRewards({
    explorationCurrentNodeId,
    explorationNodes,
    tableaus: gameState.tableaus,
    actorKeruArchetype: gameState.actorKeru?.archetype,
    isCurrentExplorationTableauCleared,
    getExplorationNodeCoordinates,
    getPoiRewardsForKey,
    getPoiIdForKey,
    lastPoiRewardKey,
    consumedPoiRewardKeysRef,
    setLastPoiRewardKey,
    setPendingPoiRewardKey,
    setShowKeruArchetypeReward,
    puzzleCompleted: actions.puzzleCompleted,
  });

  useExplorationPoiArrivalRewards({
    explorationCurrentNodeId,
    getExplorationNodeCoordinates,
    getPoiRewardsForKey,
    lastPoiRewardKey,
    setLastPoiRewardKey,
  });

  const explorationConditionalEdges = useMemo(() => {
    const coords = getExplorationNodeCoordinates(explorationCurrentNodeId);
    const clearedCoordKeys = new Set(
      explorationNodes
        .filter((node) => node.cleared)
        .map((node) => `${node.x},${node.y}`)
    );
    if (coords && isCurrentExplorationTableauCleared) {
      clearedCoordKeys.add(`${coords.x},${coords.y}`);
    }
    return (mainWorldMap.conditionalEdges ?? []).map((edge) => {
      let locked = false;
      if (edge.requirement === 'source_tableau_cleared') {
        locked = !clearedCoordKeys.has(`${edge.from.col},${edge.from.row}`);
      }
      return {
        fromX: edge.from.col,
        fromY: edge.from.row,
        toX: edge.to.col,
        toY: edge.to.row,
        locked,
      };
    });
  }, [explorationCurrentNodeId, explorationNodes, getExplorationNodeCoordinates, isCurrentExplorationTableauCleared]);
  const biomeDef = gameState.currentBiome
    ? getBiomeDefinition(gameState.currentBiome)
    : null;
  const overlayOpacity = lightingEnabled ? 0.68 : 0.85;
  const layoutViewportWidth = containerSize.width > 0
    ? containerSize.width
    : (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const layoutViewportHeight = containerSize.height > 0
    ? containerSize.height
    : (typeof window !== 'undefined' ? window.innerHeight : 720);
  const autoScaleReservedLeft = 76;
  const autoScaleReservedHorizontal = isPartyBattleLayout ? 36 : 24;
  const autoScaleAvailableWidth = Math.max(320, layoutViewportWidth - autoScaleReservedLeft - autoScaleReservedHorizontal);
  const baseCardWidth = CARD_SIZE.width * globalCardScale;
  const baseCardHeight = CARD_SIZE.height * globalCardScale;
  const baseTableauGapPx = 12;
  const baseFoundationGapPx = Math.max(2, Math.round((isPartyFoundationsLayout ? 8 : 20) * globalCardScale));
  const widthNeedTableau = (gameState.tableaus.length * baseCardWidth) + (Math.max(0, gameState.tableaus.length - 1) * baseTableauGapPx);
  const widthNeedFoundations = (gameState.foundations.length * baseCardWidth) + (Math.max(0, gameState.foundations.length - 1) * baseFoundationGapPx);
  const widthNeedEnemyFoundations = ((gameState.enemyFoundations?.length ?? 0) * baseCardWidth)
    + (Math.max(0, (gameState.enemyFoundations?.length ?? 0) - 1) * Math.max(baseFoundationGapPx, Math.round(16 * 4 * globalCardScale)));
  const autoFitWidthFactor = Math.min(
    1,
    autoScaleAvailableWidth / Math.max(widthNeedTableau, widthNeedFoundations, widthNeedEnemyFoundations, 1)
  );
  const autoScaleReservedVertical = isPartyBattleLayout ? 196 : 128;
  const autoScaleAvailableHeight = Math.max(360, layoutViewportHeight - autoScaleReservedVertical);
  const estimatedRowsHeightAtBaseScale = isPartyBattleLayout
    ? ((baseCardHeight * 4.3) + 124)
    : ((baseCardHeight * 2.75) + 84);
  const autoFitHeightFactor = Math.min(1, autoScaleAvailableHeight / Math.max(estimatedRowsHeightAtBaseScale, 1));
  const viewportAutoCardScaleFactor = Math.max(0.58, Math.min(1, Math.min(autoFitWidthFactor, autoFitHeightFactor)));
  const effectiveGlobalCardScale = globalCardScale * viewportAutoCardScaleFactor;
  const isNarrowViewport = layoutViewportWidth < 760;
  const tableauGapPx = 12;
  const tableauCount = gameState.tableaus.length;
  const tableauAvailableWidth = autoScaleAvailableWidth;
  const cardWidth = CARD_SIZE.width * effectiveGlobalCardScale;
  const cardHeight = CARD_SIZE.height * effectiveGlobalCardScale;
  const rewardPanelHorizontalPadding = 28;
  const rewardPanelVerticalPadding = 24;
  const rewardPanelHeightPx = Math.min(640, Math.max(360, Math.round(layoutViewportHeight * 0.56)));
  const rewardPanelViewportWidth = typeof window !== 'undefined' ? window.innerWidth : layoutViewportWidth;
  const rewardPanelWidthPx = Math.max(320, Math.min(layoutViewportWidth, rewardPanelViewportWidth) - 16);
  const abilityCardSize = { width: Math.max(140, Math.round(cardWidth * 0.88)), height: Math.max(190, Math.round(cardHeight * 0.88)) };
  const normalizeAspectOptions = useCallback((options?: string[]): KeruAspect[] => (
    (options ?? []).filter((value): value is KeruAspect => VALID_KERU_ASPECT_SET.has(value as KeruAspect))
  ), []);
  const selectedAspect = (gameState.actorKeru?.archetype ?? 'blank') as ActorKeruArchetype;
  const abilityDefinition = selectedAspect !== 'blank' ? ASPECT_ABILITY_DEFINITIONS[selectedAspect as KeruAspect] : null;
  const abilityCard = abilityDefinition?.card ?? null;
  const isDraggingAbilityCard = abilityCard ? (dragState.isDragging && dragState.card?.id === abilityCard.id) : false;
  const [isAbilityOverTarget, setIsAbilityOverTarget] = useState(false);
  // Compute fresh to always get current mainWorldMap data
  // Reference poiDataVersion to ensure recomputation when POI data changes
  const pendingPoiReward = useMemo(() => {
    if (!pendingPoiRewardKey) return undefined;
    const rewards = getPoiRewardsForKey(pendingPoiRewardKey);
    return rewards[0];
  }, [pendingPoiRewardKey, getPoiRewardsForKey, poiDataVersion]);

  const allowedAspectList = useMemo(() => {
    if (!pendingPoiReward) return BASE_KERU_ASPECT_ORDER;
    if (pendingPoiReward.type !== 'aspect-choice') return BASE_KERU_ASPECT_ORDER;
    const normalized = normalizeAspectOptions(pendingPoiReward.options);
    const baseList = normalized.length > 0 ? normalized : BASE_KERU_ASPECT_ORDER;
    const drawCount = Math.max(0, pendingPoiReward.drawCount ?? pendingPoiReward.amount ?? baseList.length);
    return drawCount > 0 ? baseList.slice(0, drawCount) : baseList;
  }, [normalizeAspectOptions, pendingPoiReward]);

  const allowedOrimIds = useMemo(() => {
    if (!pendingPoiReward || pendingPoiReward.type !== 'orim-choice') return [];
    return (pendingPoiReward.options ?? []).filter((opt) => ORIM_DEFINITIONS.some((o) => o.id === opt));
  }, [pendingPoiReward, ORIM_DEFINITIONS]);

  const allowedAspectSet = useMemo(() => new Set(allowedAspectList), [allowedAspectList]);
  const permittedKeruOptions = useMemo(() => (
    KERU_ARCHETYPE_OPTIONS.filter((option) => allowedAspectSet.has(option.archetype))
  ), [allowedAspectSet]);

  const orimRewardCards = useMemo(() => {
    return allowedOrimIds.map((orimId) => {
      const orimDef = ORIM_DEFINITIONS.find((o) => o.id === orimId);
      if (!orimDef) return null;
      const primaryElement = orimDef.elements[0];
      if (!primaryElement) return null;
      return {
        id: `reward-orim-${orimDef.id}`,
        rank: 0,
        element: primaryElement,
        suit: ELEMENT_TO_SUIT[primaryElement] || 'wild',
      } as CardType;
    }).filter((c) => c !== null) as CardType[];
  }, [allowedOrimIds, ORIM_DEFINITIONS]);

  const aspectRewardCards = useMemo(
    () => permittedKeruOptions.map((option) => KERU_ARCHETYPE_CARDS[option.archetype]),
    [permittedKeruOptions]
  );

  const displayedRewardCards = pendingPoiReward?.type === 'orim-choice' ? orimRewardCards : aspectRewardCards;
  const aspectModalWidth = Math.min(1200, Math.round(layoutViewportWidth * 0.96));
  const aspectModalHeight = Math.min(820, Math.round(layoutViewportHeight * 0.82));
  const aspectCardCount = Math.max(1, displayedRewardCards.length);
  const aspectCardGap = Math.max(18, Math.round(aspectModalWidth * 0.02));
  const aspectHeaderBuffer = 190;
  const aspectAvailableWidth = Math.max(320, aspectModalWidth - 80);
  const aspectAvailableHeight = Math.max(260, aspectModalHeight - aspectHeaderBuffer);
  const aspectBaseWidth = Math.floor((aspectAvailableWidth - aspectCardGap * (aspectCardCount - 1)) / aspectCardCount);
  const aspectMaxWidth = Math.min(360, aspectBaseWidth);
  const aspectRatio = CARD_SIZE.height / CARD_SIZE.width;
  let aspectCardWidth = Math.max(240, aspectMaxWidth);
  let aspectCardHeight = Math.round(aspectCardWidth * aspectRatio);
  if (aspectCardHeight > aspectAvailableHeight) {
    aspectCardHeight = Math.max(240, aspectAvailableHeight);
    aspectCardWidth = Math.round(aspectCardHeight / aspectRatio);
  }
  const aspectCardSize = { width: aspectCardWidth, height: aspectCardHeight };
  const aspectChoiceCount = Math.max(1, pendingPoiReward?.chooseCount ?? 1);
  const keruAspectLabel = useMemo(
    () => getAspectLabel(gameState.actorKeru?.archetype),
    [gameState.actorKeru?.archetype]
  );
  const keruCalloutText = keruAspectLabel
    ? `Aspect Gained: ${keruAspectLabel}`
    : 'Aspect Gained';
  const keruRewardCard = abilityCard;
  const isDraggingKeruRewardCard = keruRewardCard ? (dragState.isDragging && dragState.card?.id === keruRewardCard.id) : false;
  const isDraggingAspectRewardCard = dragState.isDragging && !!(dragState.card?.id?.startsWith('keru-archetype-') || dragState.card?.id?.startsWith('reward-orim-'));
  const [isKeruRewardOverTarget, setIsKeruRewardOverTarget] = useState(false);
  const dragHoverStateRef = useRef({ ability: false, keru: false });

  useEffect(() => {
    dragMetaRef.current = {
      isDragging: dragState.isDragging,
      card: dragState.card,
      tableauIndex: dragState.tableauIndex,
      offset: dragState.offset,
    };
    if (dragState.isDragging) {
      dragBasePositionRef.current = dragState.position;
    }
  }, [
    dragState.isDragging,
    dragState.card,
    dragState.tableauIndex,
    dragState.offset.x,
    dragState.offset.y,
    dragState.position.x,
    dragState.position.y,
  ]);

  useEffect(() => {
    if (!dragState.isDragging) {
      abilityFoundationRectRef.current = null;
      keruFoundationRectRef.current = null;
      return;
    }
    if (isDraggingAbilityCard) {
      abilityFoundationRectRef.current = foundationRefs.current[0]?.getBoundingClientRect() ?? null;
    }
    if (isDraggingKeruRewardCard) {
      keruFoundationRectRef.current = foundationRefs.current[0]?.getBoundingClientRect() ?? null;
    }
  }, [dragState.isDragging, isDraggingAbilityCard, isDraggingKeruRewardCard]);

  useEffect(() => {
    if (!dragState.isDragging) {
      if (dragHoverStateRef.current.ability || dragHoverStateRef.current.keru) {
        dragHoverStateRef.current = { ability: false, keru: false };
        setIsAbilityOverTarget(false);
        setIsKeruRewardOverTarget(false);
      }
      return;
    }
    const unsubscribe = subscribeDragRaf(() => {
      const current = dragMetaRef.current;
      if (!current.isDragging) return;
      const base = dragPositionRef?.current ?? dragBasePositionRef.current;
      const pointerX = base.x + current.offset.x;
      const pointerY = base.y + current.offset.y;

      let abilityHit = false;
      if (isDraggingAbilityCard && abilityFoundationRectRef.current) {
        const rect = abilityFoundationRectRef.current;
        abilityHit = pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
      }

      let keruHit = false;
      if (isDraggingKeruRewardCard && keruFoundationRectRef.current) {
        const rect = keruFoundationRectRef.current;
        keruHit = pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
      }

      if (abilityHit !== dragHoverStateRef.current.ability) {
        dragHoverStateRef.current.ability = abilityHit;
        setIsAbilityOverTarget(abilityHit);
      }
      if (keruHit !== dragHoverStateRef.current.keru) {
        dragHoverStateRef.current.keru = keruHit;
        setIsKeruRewardOverTarget(keruHit);
      }
    });
    return unsubscribe;
  }, [dragState.isDragging, dragPositionRef, isDraggingAbilityCard, isDraggingKeruRewardCard]);
  const getActorDisplayLabel = (actor?: Actor | null): string | undefined => {
    if (!actor) return undefined;
    if (actor.definitionId === 'keru') {
      return keruAspectLabel ?? getActorDefinition('keru')?.name ?? 'Keru';
    }
    return getActorDefinition(actor.definitionId)?.name ?? actor.definitionId;
  };
  const foundationCardScale = effectiveGlobalCardScale;
  const tableauRequiredWidth = (tableauCount * CARD_SIZE.width * foundationCardScale) + (Math.max(0, tableauCount - 1) * tableauGapPx);
  const tableauFitScale = tableauRequiredWidth > tableauAvailableWidth
    ? Math.max(0.52, tableauAvailableWidth / tableauRequiredWidth)
    : 1;
  const tableauCardScale = foundationCardScale * tableauFitScale;
  const tableauCardHeight = CARD_SIZE.height * tableauCardScale;
  const explorationTableauMaxDepth = gameState.tableaus.reduce(
    (maxDepth, tableau) => Math.max(maxDepth, tableau.length),
    0
  );
  const explorationTableauEdgeStepPx = Math.max(2, Math.round(3 * tableauCardScale));
  const explorationTableauSingleRowBufferPx = Math.max(6, Math.round(8 * tableauCardScale));
  const explorationTableauRowHeightPx = Math.round(
    tableauCardHeight
      + explorationTableauSingleRowBufferPx
      + (Math.max(0, explorationTableauMaxDepth - 1) * explorationTableauEdgeStepPx)
  );
  const explorationMapWidth = Math.max(
    320,
    Math.min(
      Math.round((tableauCount * CARD_SIZE.width * tableauCardScale) + (Math.max(0, tableauCount - 1) * tableauGapPx) + 24),
      Math.max(320, layoutViewportWidth - 20)
    )
  );
  const explorationMapVerticalBufferPx = 140;
  const rawAvailableMapHeight = layoutViewportHeight - explorationTableauRowHeightPx - explorationMapVerticalBufferPx;
  const availableMapHeight = Math.max(rawAvailableMapHeight, 0);
  const fallbackMapHeight = Math.max(180, Math.round(layoutViewportHeight * 0.35));
  const maxMapHeight = Math.max(220, Math.round(layoutViewportHeight * 0.45));
  const hasAnyVisibleTableaus = gameState.tableaus.some((tableau) => tableau.length > 0);
  const baseMapHeight = availableMapHeight > 0 ? availableMapHeight : fallbackMapHeight;
  const explorationMapHeight = hasAnyVisibleTableaus
    ? Math.min(baseMapHeight, 225)
    : Math.min(baseMapHeight, maxMapHeight);
  const explorationMapFrameWidth = explorationMapWidth + 14;
  const foundationOffset = cardHeight * 1.25;
  const handOffset = Math.max(12, Math.round(cardHeight * 0.35));
  const handCardScale = viewportAutoCardScaleFactor;
  const PARTY_BENCH_ENABLED = true;
  const isRpgMode = true; // Hardcoded to commit to RPG variant
  const isEnemyTurn = gameState.randomBiomeActiveSide === 'enemy';
  const sunkCostRelicEquipped = useMemo(() => {
    const sunkCostDefinition = (gameState.relicDefinitions ?? []).find((definition) => definition.behaviorId === 'sunk_cost_v1');
    if (!sunkCostDefinition) return false;
    return (gameState.equippedRelics ?? []).some((instance) => instance.enabled && instance.relicId === sunkCostDefinition.id);
  }, [gameState.equippedRelics, gameState.relicDefinitions]);
  const hasUnclearedVisibleTableaus = useMemo(
    () => gameState.tableaus.some((tableau) => tableau.length > 0),
    [gameState.tableaus]
  );
  const activePoiNarration = useMemo(() => {
    const coords = getExplorationNodeCoordinates(explorationCurrentNodeId);
    if (!coords) return null;
    return getPoiNarrationForKey(`${coords.x},${coords.y}`);
  }, [explorationCurrentNodeId, getExplorationNodeCoordinates, getPoiNarrationForKey]);
  const narrationTone = (activePoiNarration?.tone ?? 'teal') as 'teal' | 'gold' | 'violet' | 'green' | 'red' | 'blue' | 'orange' | 'pink' | 'silver' | 'brown' | 'black' | 'white';
  const [startOverlayPhase, setStartOverlayPhase] = useState<StartOverlayPhase>('ready');
  const [startCountdown, setStartCountdown] = useState(3);
  const [startTriggeredByPlay, setStartTriggeredByPlay] = useState(false);
  const introBlocking = startOverlayPhase !== 'done';
  const revealAllCardsForIntro = startOverlayPhase === 'countdown' || startOverlayPhase === 'go';
  useEffect(() => {
    if (!isRpgMode && (inspectedRpgCard || activeEnemyHandActorIndex !== null || inspectedRpgCardSource)) {
      setInspectedRpgCard(null);
      setInspectedRpgCardSource(null);
      setActiveEnemyHandActorIndex(null);
    }
  }, [activeEnemyHandActorIndex, inspectedRpgCard, inspectedRpgCardSource, isRpgMode]);
  useEffect(() => {
    if (!isRpgMode || !inspectedRpgCard) return;
    if (inspectedRpgCardSource?.side === 'reward') return;
    const sourceCards = inspectedRpgCardSource?.side === 'enemy'
      ? ((gameState.rpgEnemyHandCards ?? [])[inspectedRpgCardSource.actorIndex] ?? [])
      : (gameState.rpgHandCards ?? []);
    const latest = sourceCards.find((entry) => entry.id === inspectedRpgCard.id) ?? null;
    if (!latest) {
      setInspectedRpgCard(null);
      setInspectedRpgCardSource(null);
      return;
    }
    if (latest !== inspectedRpgCard) {
      setInspectedRpgCard(latest);
    }
  }, [gameState.rpgEnemyHandCards, gameState.rpgHandCards, inspectedRpgCard, inspectedRpgCardSource, isRpgMode]);
  const showWildAnalysis = true && biomeDef?.id === 'random_wilds';
  const wildAnalysisCount = wildAnalysis?.maxCount ?? 0;
  const wildAnalysisReady = showWildAnalysis && wildAnalysisCount > 0;
  const wildAnalysisLabel = wildAnalysis ? String(wildAnalysisCount) : '--';
  const foundationGapPx = Math.max(2, Math.round((true ? 8 : 20) * foundationCardScale));
  const foundationAccessoryGapPx = Math.max(10, Math.round(cardWidth * 0.18));
  const enemyFoundationGapPx = Math.max(16, Math.round(16 * 4 * foundationCardScale));
  const enemyFoundations = true ? (gameState.enemyFoundations ?? []) : [];
  const encounterEnemyActors = useMemo(() => {
    if (!encounterDefinition) return (gameState.enemyActors ?? []);
    if (encounterDefinition.enemyActors && encounterDefinition.enemyActors.length > 0) {
      return encounterDefinition.enemyActors;
    }
    if (encounterDefinition.type === 'puzzle' && encounterDefinition.enemyActorsHook) {
      return encounterDefinition.enemyActorsHook({ gameState });
    }
    return (gameState.enemyActors ?? []);
  }, [encounterDefinition, gameState]);
  const enemyActors = encounterEnemyActors;
  const activeEnemyActorsCount = enemyActors.filter((actor) => (actor?.hp ?? 0) > 0).length;
  const showMultipleEnemyFoundations = activeEnemyActorsCount > 1;
  const enemyFoundationsForDisplay = showMultipleEnemyFoundations
    ? enemyFoundations
    : enemyFoundations.slice(0, 1);
  const enemyActorsForDisplay = showMultipleEnemyFoundations
    ? enemyActors
    : enemyActors.slice(0, 1);
  const inspectedActor = useMemo(() => {
    if (!inspectedActorId) return null;
    const playerMatch = activeParty.find((entry) => entry.id === inspectedActorId);
    if (playerMatch) return playerMatch;
    return enemyActors.find((entry) => entry.id === inspectedActorId) ?? null;
  }, [activeParty, enemyActors, inspectedActorId]);
  useEffect(() => {
    setActorNodeAssignments((prev) => {
      const next: Record<string, Record<string, string>> = { ...prev };
      [...activeParty, ...enemyActors].forEach((actor) => {
        if (!actor) return;
        if (next[actor.id]) return;
        const definition = getActorDefinition(actor.definitionId);
        next[actor.id] = { ...(definition?.orimEnhancements ?? {}) };
      });
      return next;
    });
  }, [activeParty, enemyActors]);
  const enemyRpgHandCards = gameState.rpgEnemyHandCards ?? [];
  const explorationModeActive = isRpgMode && !enemyFoundations.some((foundation) => foundation.length > 0);
  const activeEnemyHandCards = activeEnemyHandActorIndex !== null
    ? (enemyRpgHandCards[activeEnemyHandActorIndex] ?? [])
    : [];
  const activeEnemyHandActorName = activeEnemyHandActorIndex !== null
    ? (getActorDefinition(enemyActors[activeEnemyHandActorIndex]?.definitionId ?? '')?.name
      ?? enemyActors[activeEnemyHandActorIndex]?.definitionId
      ?? `Enemy ${activeEnemyHandActorIndex + 1}`)
    : 'Enemy';
  const enemyDifficulty = gameState.enemyDifficulty ?? biomeDef?.enemyDifficulty ?? 'normal';
  useEffect(() => {
    if (!isRpgMode || activeEnemyHandActorIndex === null) return;
    const cards = enemyRpgHandCards[activeEnemyHandActorIndex] ?? [];
    if (cards.length > 0) return;
    setActiveEnemyHandActorIndex(null);
    if (inspectedRpgCardSource?.side === 'enemy') {
      setInspectedRpgCard(null);
      setInspectedRpgCardSource(null);
    }
  }, [activeEnemyHandActorIndex, enemyRpgHandCards, inspectedRpgCardSource, isRpgMode]);
  useEffect(() => {
    if (!inspectedActorId) return;
    const existsInPlayer = activeParty.some((entry) => entry.id === inspectedActorId);
    const existsInEnemy = enemyActors.some((entry) => entry.id === inspectedActorId);
    if (!existsInPlayer && !existsInEnemy) {
      setInspectedActorId(null);
    }
  }, [activeParty, enemyActors, inspectedActorId]);
  const [hpLagMap, setHpLagMap] = useState<Record<string, number>>({});
  const [hpDamageMap, setHpDamageMap] = useState<Record<string, number>>({});
  const difficultyLabels: Record<string, string> = {
    easy: 'EASY',
    normal: 'NORMAL',
    hard: 'HARD',
    divine: 'DIVINE',
  };
  const nextEnemyDifficulty = (current: string) => {
    const order = ['easy', 'normal', 'hard', 'divine'];
    const idx = Math.max(0, order.indexOf(current));
    return order[(idx + 1) % order.length] as GameState['enemyDifficulty'];
  };
  const foundationHasActor = (gameState.foundations[0]?.length ?? 0) > 0;
  const cloudSightActive = useMemo(() => {
    if (isRpgMode) {
      return (gameState.rpgCloudSightUntil ?? 0) > Date.now();
    }
    if (true) {
      return activeParty.some((actor) => actorHasOrimDefinition(gameState, actor.id, 'cloud_sight'));
    }
    if (!foundationHasActor) return false;
    const foundationActor = activeParty[0];
    if (!foundationActor) return false;
    return actorHasOrimDefinition(gameState, foundationActor.id, 'cloud_sight');
  }, [activeParty, gameState, foundationHasActor, true, isRpgMode]);
  const teamworkActive = useMemo(() => {
    return activeParty.some((actor) => actorHasOrimDefinition(gameState, actor.id, 'teamwork'));
  }, [activeParty, gameState]);
  const foundationOffsetAdjusted = cloudSightActive ? foundationOffset * 0.6 : foundationOffset;
  const handSlotStyle = {
    height: cardHeight * handCardScale + 4,
    minWidth: cardWidth * handCardScale * 2,
    marginTop: true
      ? (isNarrowViewport ? 16 : 32)
      : 2 - Math.round(cardHeight * handCardScale),
  };
  const foundationsStackMarginTop = true
    ? Math.max(10, Math.round(cardHeight * 0.22))
    : -foundationOffsetAdjusted;
  const battleSectionGap = true ? 0 : 'clamp(6px, 1.8vh, 22px)';
  const CATEGORY_GLYPHS: Record<string, string> = {
    ability: '⚡️',
    utility: '💫',
    trait: '🧬',
  };
  const LEGACY_COMBAT_ORIMS = new Set(['scratch', 'bite', 'claw']);
  const orimChipSize = Math.max(22, Math.round(cardWidth * 0.66));
  const orimFontSize = Math.max(12, Math.round(orimChipSize * 0.55));
  const showPartyOrims = false;
  const showPartyOrimsSection = showPartyOrims && !true;
  const MAX_COMBO_FLASH = 15;
  const TOKEN_ORDER: Element[] = ['W', 'E', 'A', 'F', 'D', 'L', 'N'];
  const SHOW_FOUNDATION_TOKEN_BADGES = false;
  const ACTOR_LINE_COLORS: Record<string, string> = {
    keru: '#e6b31e',
    fox: '#e6b31e',
    lupus: '#f0f0f0',
  };
  const COMBO_FLASH_SCALING_ENABLED = true;
  const foundationActor = foundationHasActor ? activeParty[0] ?? null : null;
  const equippedOrims = useMemo(() => {
    const actors = true
      ? activeParty
      : (foundationActor ? [foundationActor] : []);
    if (!actors.length) return [];
    const entries = actors.flatMap((actor) => {
      const actorName = getActorDefinition(actor.definitionId)?.name ?? actor.definitionId;
      return (actor.orimSlots ?? []).flatMap((slot) => {
        if (!slot.orimId) return [];
        const instance = gameState.orimInstances?.[slot.orimId];
        if (!instance) return [];
        const definition = gameState.orimDefinitions.find((item) => item.id === instance.definitionId);
        if (!definition) return [];
        if (!orimTrayDevMode && (definition.domain === 'combat' || LEGACY_COMBAT_ORIMS.has(definition.id))) return [];
        const watercolor = getOrimWatercolorConfig(definition, instance.definitionId);
        return [{
          id: slot.id,
          definitionId: definition.id,
          name: definition.name,
          domain: definition.domain,
          category: definition.category,
          rarity: definition.rarity,
          description: definition.description,
          actorName,
          glyph: CATEGORY_GLYPHS[definition.category] ?? '◌',
          color: getOrimAccentColor(definition, instance.definitionId),
          watercolor,
          isSandbox: false,
        }];
      });
    });
    return entries;
  }, [activeParty, foundationActor, gameState.orimDefinitions, gameState.orimInstances, true, orimTrayDevMode]);

  const sandboxOrims = useMemo(() => {
    if (!sandboxOrimIds.length) return [];
    return sandboxOrimIds.flatMap((id) => {
      const definition = gameState.orimDefinitions.find((item) => item.id === id);
      if (!definition) return [];
      if (!orimTrayDevMode && (definition.domain === 'combat' || LEGACY_COMBAT_ORIMS.has(definition.id))) return [];
      return [{
        id: `sandbox-${id}`,
        definitionId: definition.id,
        name: definition.name,
        domain: definition.domain,
        category: definition.category,
        rarity: definition.rarity,
        description: definition.description,
        actorName: 'Sandbox',
        glyph: CATEGORY_GLYPHS[definition.category] ?? '◌',
        color: getOrimAccentColor(definition, id),
        watercolor: getOrimWatercolorConfig(definition, id),
        isSandbox: true,
      }];
    });
  }, [sandboxOrimIds, gameState.orimDefinitions, orimTrayDevMode]);

  const displayOrims = useMemo(() => ([
    ...equippedOrims,
    ...sandboxOrims,
  ]), [equippedOrims, sandboxOrims]);

  const filteredDisplayOrims = useMemo(() => {
    if (!orimTrayDevMode) return displayOrims;
    return displayOrims.filter((orim) => {
      if (orim.domain !== orimTrayTab) return false;
      if (orimTrayTab === 'puzzle' && LEGACY_COMBAT_ORIMS.has(orim.definitionId)) return false;
      return true;
    });
  }, [displayOrims, orimTrayDevMode, orimTrayTab]);
  const bideOrim = useMemo(() => {
    const definition = gameState.orimDefinitions.find((item) => item.id === 'bide');
    if (!definition) return null;
    return {
      definition,
      color: getOrimAccentColor(definition, definition.id),
      watercolor: getOrimWatercolorConfig(definition, definition.id),
      glyph: definition.glyph ?? '⧉',
    };
  }, [gameState.orimDefinitions]);

  const partyBenchActors = useMemo(() => {
    if (!false) return [];
    const partySlice = foundationHasActor ? activeParty.slice(1, 3) : activeParty.slice(0, 2);
    return partySlice
      .map((actor) => {
        const definition = getActorDefinition(actor.definitionId);
        if (!definition) return null;
        return { actorId: actor.id, definition };
      })
      .filter((entry): entry is { actorId: string; definition: ActorDefinition } => Boolean(entry));
  }, [activeParty, foundationHasActor, false]);
  const foundationOrimInstances = true ? undefined : gameState.orimInstances;
  const foundationOrimDefinitions = true ? undefined : gameState.orimDefinitions;
  const leftFoundationAccessoryStyle = {
    left: `calc(50% - ${foundationRowWidth / 2}px)`,
    top: '50%',
    transform: `translate(calc(-100% - ${foundationAccessoryGapPx}px), -50%)`,
  } as const;
  const enemyDraggingTableauIndexes = useMemo(
    () => new Set(enemyMoveAnims.map((anim) => anim.tableauIndex).filter((idx): idx is number => Number.isInteger(idx))),
    [enemyMoveAnims]
  );
  const rightFoundationAccessoryStyle = {
    left: `calc(50% + ${foundationRowWidth / 2}px)`,
    top: '50%',
    transform: `translate(${foundationAccessoryGapPx}px, -50%)`,
  } as const;
  const actorComboCounts = gameState.actorCombos ?? {};
  const partyLeaderFoundationIndex = useMemo(() => {
    const foundationCount = Math.min(gameState.foundations.length, activeParty.length);
    if (foundationCount <= 0) return 0;
    return Math.floor((foundationCount - 1) / 2);
  }, [activeParty.length, gameState.foundations.length]);
  const partyLeaderActor = activeParty[partyLeaderFoundationIndex] ?? null;
  const partyComboTotal = useMemo(() => {
    if (!activeParty.length) return 0;
    return activeParty.reduce((sum, actor) => sum + (actorComboCounts[actor.id] ?? 0), 0);
  }, [activeParty, actorComboCounts]);
  const lupusPackMomentumActorId = useMemo(() => {
    const lupusActor = activeParty.find((actor) => actor.definitionId === 'lupus');
    if (!lupusActor) return null;
    const apexEnhancement = actorNodeAssignments[lupusActor.id]?.apex;
    if (!apexEnhancement || apexEnhancement.trim().toLowerCase() !== 'ferocity') return null;
    return lupusActor.id;
  }, [activeParty, actorNodeAssignments]);
  const packMomentumActive = !!lupusPackMomentumActorId;
  const partyComboTotalForTimer = packMomentumActive ? partyComboTotal : 0;
  const ownedOrimNames = useMemo(() => {
    const names = (gameState.orimStash ?? []).map((instance) => {
      const definition = gameState.orimDefinitions.find((entry) => entry.id === instance.definitionId);
      return definition?.name ?? instance.definitionId;
    });
    return Array.from(new Set([...names, 'Zephyr'].map((name) => name.trim()).filter(Boolean)));
  }, [gameState.orimDefinitions, gameState.orimStash]);
  const handleAssignNodeOrim = useCallback((actorId: string, nodeId: string, orimName: string) => {
    setActorNodeAssignments((prev) => ({
      ...prev,
      [actorId]: {
        ...(prev[actorId] ?? {}),
        [nodeId]: orimName,
      },
    }));
  }, []);
  const handleClearNodeOrim = useCallback((actorId: string, nodeId: string) => {
    setActorNodeAssignments((prev) => {
      const actorAssignments = { ...(prev[actorId] ?? {}) };
      if (!actorAssignments[nodeId]) return prev;
      delete actorAssignments[nodeId];
      return {
        ...prev,
        [actorId]: actorAssignments,
      };
    });
  }, []);
  useEffect(() => {
    if (!true || isRpgMode) {
      setRewardedBattleHandCards([]);
      return;
    }
    setRewardedBattleHandCards((prev) => {
      const nextCards = [...prev];
      while (partyComboTotal >= getBattleHandRewardThreshold(nextCards.length)) {
        rewardCardIdRef.current += 1;
        nextCards.push(createRandomBattleHandRewardCard(nextCards.length + 1, rewardCardIdRef.current));
      }
      return nextCards.length === prev.length ? prev : nextCards;
    });
  }, [true, isRpgMode, partyComboTotal]);
  const unlockedBattleHandCards = useMemo<CardType[]>(() => {
    if (!true) return [];
    if (isRpgMode) return gameState.rpgHandCards ?? [];
    return rewardedBattleHandCards;
  }, [gameState.rpgHandCards, true, isRpgMode, rewardedBattleHandCards]);
  const rewindHandCard = useMemo<CardType | null>(() => {
    if (!noRegretStatus.actorId) return null;
    const cooldown = Math.max(0, noRegretStatus.cooldown);
    return {
      id: 'ability-rewind',
      rank: cooldown,
      element: 'N',
      suit: ELEMENT_TO_SUIT.N,
      rarity: 'uncommon',
      cooldown,
      maxCooldown: Math.max(1, cooldown),
    };
  }, [noRegretStatus.actorId, noRegretStatus.cooldown]);
  const playerHandCardsWithStatuses = useMemo<CardType[]>(
    () => (rewindHandCard ? [rewindHandCard, ...unlockedBattleHandCards] : unlockedBattleHandCards),
    [rewindHandCard, unlockedBattleHandCards]
  );
  const explorationActorHandCardsByIndex = useMemo<CardType[][]>(
    () => activeParty.map((actor) => {
      if (!actor) return [];
      return (gameState.rpgHandCards ?? []).filter((card) => card.sourceActorId === actor.id);
    }),
    [activeParty, gameState.rpgHandCards]
  );
  const activeExplorationActorHandCards = useMemo<CardType[]>(
    () => (
      activePlayerHandActorIndex !== null
        ? (explorationActorHandCardsByIndex[activePlayerHandActorIndex] ?? [])
        : []
    ),
    [activePlayerHandActorIndex, explorationActorHandCardsByIndex]
  );
  const displayedPlayerHandCards = explorationModeActive
    ? activeExplorationActorHandCards
    : playerHandCardsWithStatuses;
  const shouldRenderPlayerHand = true && (!explorationModeActive || activePlayerHandActorIndex !== null) && displayedPlayerHandCards.length > 0;
  useEffect(() => {
    if (!explorationModeActive) {
      setActivePlayerHandActorIndex(null);
      return;
    }
    if (activePlayerHandActorIndex === null) return;
    if (activePlayerHandActorIndex < 0 || activePlayerHandActorIndex >= activeParty.length) {
      setActivePlayerHandActorIndex(null);
    }
  }, [activeParty.length, activePlayerHandActorIndex, explorationModeActive]);
  useExplorationPoiRewardFlow({
    isRpgMode,
    enemyFoundations,
    explorationNodes,
    actorKeruArchetype: gameState.actorKeru?.archetype,
    pendingPoiRewardKey,
    lastPoiRewardKey,
    poiRewardResolvedAt,
    getPoiRewardsForKey,
    consumedPoiRewardKeysRef,
    keruAbilityRewardShownRef,
    setShowKeruArchetypeReward,
    setShowKeruAbilityReward,
    setPendingPoiRewardKey,
    setLastPoiRewardKey,
  });
  useExplorationOrimRewardCallouts({
    lastResolvedOrimId: gameState.lastResolvedOrimId,
    lastResolvedOrimFoundationIndex: gameState.lastResolvedOrimFoundationIndex,
    lastResolvedOrimDropPoint: gameState.lastResolvedOrimDropPoint,
    hasOrimDefinition: (orimId) => ORIM_DEFINITIONS.some((orim) => orim.id === orimId),
    setOrimRewardCallouts,
    processRelicCombatEvent: actions.processRelicCombatEvent as ((event: { type: 'ORIM_CALLOUT_SHOWN' }) => void) | undefined,
  });

  useKeruMutationCallouts({
    actorKeru: gameState.actorKeru,
    keruCalloutDurationMs: KERU_CALLOUT_DURATION_MS,
    getKeruAspectAttributeLines,
    keruAbilityTimeoutsRef: keruAttributeTimeoutsRef,
    prevKeruMutationAtRef,
    setShowKeruArchetypeReward,
    setKeruFxToken,
    setKeruFxActive,
    setKeruStatLines,
    setKeruAttributeCallouts,
  });
  useEffect(() => {
    if (showKeruAbilityReward && !isDraggingKeruRewardCard && isKeruRewardOverTarget) {
      setShowKeruAbilityReward(false);
    }
  }, [showKeruAbilityReward, isDraggingKeruRewardCard, isKeruRewardOverTarget]);
  useEffect(() => {
    if (!isRpgMode) return;
    const current = gameState.rpgHandCards ?? [];
    const currentIds = new Set(current.map((card) => card.id));
    const isUpgradedRpcCard = (card: CardType) => {
      const levelMatch = card.id.match(/-lvl-(\d+)/);
      const level = levelMatch ? Number(levelMatch[1]) : 0;
      return level >= 3 && (
        card.id.startsWith('rpg-scratch-')
        || card.id.startsWith('rpg-bite-')
        || card.id.startsWith('rpg-peck-')
      );
    };
    const prevIds = prevRpgHandIdsRef.current;
    const newlyUpgraded = current
      .filter((card) =>
        !prevIds.has(card.id)
        && isUpgradedRpcCard(card)
      )
      .map((card) => card.id);
    if (newlyUpgraded.length > 0) {
      setUpgradedHandCardIds((prev) => Array.from(new Set([...prev, ...newlyUpgraded])));
      newlyUpgraded.forEach((id) => {
        if (upgradedFlashTimeoutsRef.current[id]) {
          window.clearTimeout(upgradedFlashTimeoutsRef.current[id]);
        }
        upgradedFlashTimeoutsRef.current[id] = window.setTimeout(() => {
          setUpgradedHandCardIds((prev) => prev.filter((entry) => entry !== id));
          delete upgradedFlashTimeoutsRef.current[id];
        }, 1700);
      });
    }
    prevRpgHandIdsRef.current = currentIds;
  }, [gameState.rpgHandCards, isRpgMode]);
  const freeSwapActorIds = useMemo(() => {
    if (!teamworkActive) return new Set<string>();
    const foundationRank = gameState.foundations[0]?.[gameState.foundations[0].length - 1]?.rank;
    if (!foundationRank) return new Set<string>();
    const freebies = new Set<string>();
    partyBenchActors.forEach((entry) => {
      if (isSequential(entry.definition.value, foundationRank)) {
        freebies.add(entry.actorId);
      }
    });
    return freebies;
  }, [teamworkActive, gameState.foundations, partyBenchActors]);
  const handleBenchActorClick = useCallback((actorId: string) => {
    const isFree = freeSwapActorIds.has(actorId);
    if (!isFree && !infiniteBenchSwapsEnabled && benchSwapCount <= 0) return;
    if (!isFree && !infiniteBenchSwapsEnabled) {
      onConsumeBenchSwap?.();
    }
    actions.swapPartyLead(actorId);
  }, [actions, benchSwapCount, infiniteBenchSwapsEnabled, onConsumeBenchSwap, freeSwapActorIds]);
  type HpBarSide = 'player' | 'enemy';
  type HpBarTheme = {
    borderColor: string;
    fillColor: string;
    bgColor: string;
    shadowColor: string;
    textColor: string;
    textShadow: string;
    damageColor: string;
    damageShadow: string;
  };
  const HP_BAR_THEME: Record<HpBarSide, HpBarTheme> = {
    player: {
      borderColor: 'rgba(127, 219, 202, 0.65)',
      fillColor: 'rgba(127, 219, 202, 0.92)',
      bgColor: 'rgba(10, 10, 10, 0.78)',
      shadowColor: '0 0 8px rgba(127, 219, 202, 0.25)',
      textColor: '#f8f8f8',
      textShadow: '0 0 6px rgba(0, 0, 0, 0.95)',
      damageColor: '#ff6565',
      damageShadow: '0 0 8px rgba(255, 80, 80, 0.7)',
    },
    enemy: {
      borderColor: 'rgba(127, 219, 202, 0.65)',
      fillColor: 'rgba(127, 219, 202, 0.92)',
      bgColor: 'rgba(10, 10, 10, 0.78)',
      shadowColor: '0 0 8px rgba(127, 219, 202, 0.25)',
      textColor: '#f8f8f8',
      textShadow: '0 0 6px rgba(0, 0, 0, 0.95)',
      damageColor: '#ff6565',
      damageShadow: '0 0 8px rgba(255, 80, 80, 0.7)',
    },
  };
  type RpgDragDamagePreview = {
    side: HpBarSide;
    actorIndex: number;
    damage: number;
    hitChance: number;
  };
  const [rpgDragDamagePreview, setRpgDragDamagePreview] = useState<RpgDragDamagePreview | null>(null);
  const rpgPreviewRef = useRef<RpgDragDamagePreview | null>(null);
  const rpgPreviewContextRef = useRef({
    activeParty,
    gameState,
  });

  useEffect(() => {
    rpgPreviewContextRef.current = { activeParty, gameState };
  }, [activeParty, gameState]);

  useEffect(() => {
    if (!isRpgMode) {
      if (rpgPreviewRef.current !== null) {
        rpgPreviewRef.current = null;
        setRpgDragDamagePreview(null);
      }
      return;
    }
    const unsubscribe = subscribeDragRaf(() => {
      const current = dragMetaRef.current;
      if (!current.isDragging || current.tableauIndex !== HAND_SOURCE_INDEX) {
        if (rpgPreviewRef.current !== null) {
          rpgPreviewRef.current = null;
          setRpgDragDamagePreview(null);
        }
        return;
      }
      const draggedCard = current.card;
      if (!draggedCard || !draggedCard.id.startsWith('rpg-') || draggedCard.id.startsWith('rpg-cloud-sight-')) {
        if (rpgPreviewRef.current !== null) {
          rpgPreviewRef.current = null;
          setRpgDragDamagePreview(null);
        }
        return;
      }

      const base = dragPositionRef?.current ?? dragBasePositionRef.current;
      const pointerX = base.x + current.offset.x;
      const pointerY = base.y + current.offset.y;
      const targetEl = document
        .elementsFromPoint(pointerX, pointerY)
        .map((node) => (node as HTMLElement).closest?.('[data-rpg-actor-target="true"]') as HTMLElement | null)
        .find((entry): entry is HTMLElement => !!entry) ?? null;
      if (!targetEl) {
        if (rpgPreviewRef.current !== null) {
          rpgPreviewRef.current = null;
          setRpgDragDamagePreview(null);
        }
        return;
      }

      const sideAttr = targetEl.getAttribute('data-rpg-actor-side');
      const indexAttr = targetEl.getAttribute('data-rpg-actor-index');
      if (sideAttr !== 'player' && sideAttr !== 'enemy') {
        if (rpgPreviewRef.current !== null) {
          rpgPreviewRef.current = null;
          setRpgDragDamagePreview(null);
        }
        return;
      }
      const actorIndex = Number(indexAttr);
      if (!Number.isFinite(actorIndex) || actorIndex < 0) {
        if (rpgPreviewRef.current !== null) {
          rpgPreviewRef.current = null;
          setRpgDragDamagePreview(null);
        }
        return;
      }

      type RpcFamily = 'scratch' | 'bite' | 'peck';
      const getRpcFamily = (id: string): RpcFamily | null => {
        if (id.startsWith('rpg-scratch-')) return 'scratch';
        if (id.startsWith('rpg-bite-') || id.startsWith('rpg-vice-bite-')) return 'bite';
        if (id.startsWith('rpg-peck-') || id.startsWith('rpg-blinding-peck-')) return 'peck';
        return null;
      };
      const getRpcCount = (id: string): number => {
        if (id.startsWith('rpg-scratch-lvl-') || id.startsWith('rpg-bite-lvl-') || id.startsWith('rpg-peck-lvl-')) {
          const match = id.match(/-lvl-(\d+)/);
          const parsed = match ? Number(match[1]) : NaN;
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        if (id.startsWith('rpg-vice-bite-')) return 3;
        if (id.startsWith('rpg-blinding-peck-')) return 3;
        if (id.startsWith('rpg-scratch-') || id.startsWith('rpg-bite-') || id.startsWith('rpg-peck-')) return 1;
        return 0;
      };
      const getRpcDamage = (family: RpcFamily, count: number): number => {
        const safeCount = Math.max(1, count);
        if (family !== 'bite') return safeCount;
        if (safeCount <= 1) return 1;
        if (safeCount === 2) return 2;
        if (safeCount === 3) return 3;
        if (safeCount === 4) return 5;
        return 6;
      };
      const clampPercent = (value: number): number => Math.max(5, Math.min(95, value));

      const family = getRpcFamily(draggedCard.id);
      if (!family) {
        if (rpgPreviewRef.current !== null) {
          rpgPreviewRef.current = null;
          setRpgDragDamagePreview(null);
        }
        return;
      }
      const count = getRpcCount(draggedCard.id);
      const baseDamage = getRpcDamage(family, count);
      if (baseDamage <= 0) {
        if (rpgPreviewRef.current !== null) {
          rpgPreviewRef.current = null;
          setRpgDragDamagePreview(null);
        }
        return;
      }

      const { activeParty: party, gameState: gs } = rpgPreviewContextRef.current;
      const side = sideAttr as HpBarSide;
      const targetActor = side === 'enemy'
        ? (gs.enemyActors ?? [])[actorIndex]
        : ((gs.activeSessionTileId ? (gs.tileParties[gs.activeSessionTileId] ?? []) : [])[actorIndex]);
      if (!targetActor || (targetActor.hp ?? 0) <= 0) {
        if (rpgPreviewRef.current !== null) {
          rpgPreviewRef.current = null;
          setRpgDragDamagePreview(null);
        }
        return;
      }

      const sourceActor = draggedCard.sourceActorId
        ? [...party, ...(gs.enemyActors ?? [])].find((actor) => actor.id === draggedCard.sourceActorId)
        : null;
      const attackerAccuracy = sourceActor?.accuracy ?? 100;
      const now = Date.now();
      const soarActive = (gs.rpgSoarEvasionUntil ?? 0) > now
        && gs.rpgSoarEvasionActorId === targetActor.id
        && (gs.rpgSoarEvasionSide ?? 'player') === side;
      const targetEvasion = (targetActor.evasion ?? 0) + (soarActive ? 75 : 0);
      const hitChance = clampPercent(attackerAccuracy - targetEvasion);
      // Mirror the engine damage formula: defense → super armor → armor → HP
      const afterDefense = Math.max(0, baseDamage - (targetActor.defense ?? 0));
      const afterSuperArmor = (targetActor.superArmor ?? 0) > 0 ? 0 : afterDefense;
      const damage = afterSuperArmor > 0
        ? Math.max(0, afterSuperArmor - (targetActor.armor ?? 0))
        : afterSuperArmor;
      if (damage <= 0 && afterDefense <= 0) {
        if (rpgPreviewRef.current !== null) {
          rpgPreviewRef.current = null;
          setRpgDragDamagePreview(null);
        }
        return;
      }

      const nextPreview: RpgDragDamagePreview = { side, actorIndex, damage, hitChance };
      const prev = rpgPreviewRef.current;
      const isSame = prev
        && prev.side === nextPreview.side
        && prev.actorIndex === nextPreview.actorIndex
        && prev.damage === nextPreview.damage
        && Math.abs(prev.hitChance - nextPreview.hitChance) < 0.01;
      if (!isSame) {
        rpgPreviewRef.current = nextPreview;
        setRpgDragDamagePreview(nextPreview);
      }
    });
    return unsubscribe;
  }, [dragPositionRef, isRpgMode]);
  const renderHpLabel = (actor: Actor | null | undefined, side: HpBarSide = 'player', actorIndex = -1) => {
    const showHpBars = isRpgMode || false;
    if (!showHpBars || !actor) return null;
    const theme = HP_BAR_THEME[side];
    const currentHp = Math.max(0, actor.hp ?? 0);
    const hpMax = Math.max(1, actor.hpMax ?? 1);
    const lagHp = Math.max(currentHp, hpLagMap[actor.id] ?? currentHp);
    const damageAmount = hpDamageMap[actor.id] ?? 0;
    const currentPct = (currentHp / hpMax) * 100;
    const lagPct = (lagHp / hpMax) * 100;
    const damagePct = Math.max(0, lagPct - currentPct);
    const armorValue = Math.max(0, Math.round(actor.armor ?? 0));
    const armorPct = Math.max(0, Math.min(100, (armorValue / hpMax) * 100));
    const superArmorValue = Math.max(0, Math.round(actor.superArmor ?? 0));
    const superArmorPct = Math.max(0, Math.min(100, (superArmorValue / hpMax) * 100));
    const defenseValue = Math.max(0, Math.round(actor.defense ?? 0));
    const previewMatchesTarget = !!rpgDragDamagePreview
      && rpgDragDamagePreview.side === side
      && rpgDragDamagePreview.actorIndex === actorIndex;
    const previewDamageRaw = previewMatchesTarget ? rpgDragDamagePreview.damage : 0;
    const previewDamage = Math.max(0, Math.min(currentHp, previewDamageRaw));
    const previewPct = (previewDamage / hpMax) * 100;
    const previewLeftPct = Math.max(0, currentPct - previewPct);
    const previewWidthPct = Math.max(0, Math.min(currentPct, previewPct));
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1">
          <div
            className="relative rounded border overflow-visible"
            style={{
              width: Math.max(58, Math.round(cardWidth * 0.78)),
              height: 16,
              borderColor: theme.borderColor,
              backgroundColor: theme.bgColor,
              boxShadow: theme.shadowColor,
            }}
          >
            <div className="absolute inset-0 overflow-hidden rounded">
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${currentPct}%`,
                  backgroundColor: theme.fillColor,
                  transition: 'width 220ms linear',
                }}
              />
              {damagePct > 0 && (
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: `${currentPct}%`,
                    width: `${damagePct}%`,
                    backgroundColor: 'rgba(255, 80, 80, 0.92)',
                    boxShadow: '0 0 10px rgba(255, 80, 80, 0.45)',
                    transition: 'left 900ms linear, width 900ms linear',
                  }}
                />
              )}
              {previewWidthPct > 0 && (
                <div
                  className="absolute inset-y-0 animate-pulse"
                  style={{
                    left: `${previewLeftPct}%`,
                    width: `${previewWidthPct}%`,
                    backgroundColor: 'rgba(255, 158, 55, 0.92)',
                    boxShadow: '0 0 12px rgba(255, 145, 30, 0.9)',
                    transition: 'left 50ms linear, width 50ms linear',
                  }}
                />
              )}
              {armorPct > 0 && (
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${armorPct}%`,
                    backgroundColor: 'rgba(0, 196, 255, 0.42)',
                    boxShadow: '0 0 14px rgba(0, 196, 255, 0.65), inset 0 0 10px rgba(0, 196, 255, 0.42)',
                    transition: 'width 220ms linear',
                    zIndex: 3,
                  }}
                  title={`Armor ${armorValue}`}
                />
              )}
              {superArmorPct > 0 && (
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${superArmorPct}%`,
                    backgroundColor: 'rgba(255, 210, 60, 0.48)',
                    boxShadow: '0 0 14px rgba(255, 210, 60, 0.7), inset 0 0 10px rgba(255, 210, 60, 0.4)',
                    transition: 'width 220ms linear',
                    zIndex: 4,
                  }}
                  title={`Super Armor ${superArmorValue}`}
                />
              )}
              <div
                className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-[1.5px]"
                style={{
                  color: theme.textColor,
                  textShadow: theme.textShadow,
                  zIndex: 4,
                }}
              >
                {`${currentHp}/${hpMax}`}
              </div>
            </div>
            {defenseValue > 0 && (
              <div
                className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center rounded-full"
                style={{
                  zIndex: 5,
                  width: 14,
                  height: 14,
                  color: '#a0e4a0',
                  backgroundColor: 'rgba(0, 28, 12, 0.75)',
                  border: '1px solid rgba(100, 220, 100, 0.55)',
                  textShadow: '0 0 8px rgba(100, 220, 100, 0.85)',
                  fontSize: 7,
                  fontWeight: 700,
                  letterSpacing: 0,
                }}
                title={`Defense ${defenseValue}`}
              >
                {defenseValue}
              </div>
            )}
            {superArmorValue > 0 && (
              <div
                className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-[calc(100%+2px)] flex items-center justify-center rounded-full"
                style={{
                  zIndex: 5,
                  width: 14,
                  height: 14,
                  color: '#ffd23c',
                  backgroundColor: 'rgba(32, 20, 0, 0.75)',
                  border: '1px solid rgba(255, 210, 60, 0.55)',
                  textShadow: '0 0 8px rgba(255, 210, 60, 0.85)',
                  fontSize: 7,
                  fontWeight: 700,
                  letterSpacing: 0,
                }}
                title={`Super Armor ${superArmorValue}`}
              >
                ✦
              </div>
            )}
            {armorPct > 0 && (
              <div
                className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 flex items-center justify-center rounded-full"
                style={{
                  zIndex: 5,
                  width: 14,
                  height: 14,
                  color: '#00c8ff',
                  backgroundColor: 'rgba(0, 28, 48, 0.65)',
                  border: '1px solid rgba(0, 196, 255, 0.55)',
                  textShadow: '0 0 10px rgba(0, 196, 255, 0.85)',
                }}
                title={`Armor ${armorValue}`}
              >
                <span className="text-[10px] leading-none">🛡</span>
              </div>
            )}
          </div>
        </div>
        {previewDamage > 0 && (
          <div
            className="text-[10px] font-bold tracking-[2px] animate-pulse"
            style={{
              color: '#ff9e37',
              textShadow: '0 0 10px rgba(255, 145, 30, 0.9)',
            }}
            title={`Hit chance ${Math.round(rpgDragDamagePreview?.hitChance ?? 0)}%`}
          >
            -{previewDamage}
          </div>
        )}
        {damageAmount > 0 && (
          <div
            className="text-[10px] font-bold tracking-[2px]"
            style={{
              color: theme.damageColor,
              textShadow: theme.damageShadow,
              transition: 'opacity 700ms ease',
            }}
          >
            -{damageAmount}
          </div>
        )}
      </div>
    );
  };
  type ActorStatusView = {
    id: string;
    kind: 'buff' | 'debuff';
    label: string;
    detail: string;
    remainingMs?: number;
    totalMs?: number;
  };
  const statusClockMs = isRpgMode ? Date.now() : 0;
  const formatStatusSeconds = (remainingMs: number): string => {
    const seconds = Math.max(0, remainingMs) / 1000;
    return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
  };
  const playerBlindLevel = useMemo(
    () => getActiveBlindLevel(gameState, 'player', statusClockMs),
    [gameState, statusClockMs]
  );
  const hiddenPlayerTableaus = useMemo(
    () => new Set(getBlindedHiddenTableauIndexes(playerBlindLevel)),
    [playerBlindLevel]
  );
  const maskAllPlayerTableauValues = playerBlindLevel >= 4;
  const maskPlayerFoundationValues = isGamePaused;
  const getActorStatuses = useCallback((actor: Actor | null | undefined, side: HpBarSide): ActorStatusView[] => {
    if (!isRpgMode || !actor) return [];
    const statuses: ActorStatusView[] = [];
    const nowMs = statusClockMs;

    const enemySlowUntil = gameState.rpgEnemyDragSlowUntil ?? 0;
    if (
      side === 'enemy'
      && gameState.rpgEnemyDragSlowActorId === actor.id
      && enemySlowUntil > nowMs
    ) {
      statuses.push({
        id: `slow-${actor.id}`,
        kind: 'debuff',
        label: 'SLOW',
        detail: 'Drag speed reduced by 90%',
        remainingMs: enemySlowUntil - nowMs,
        totalMs: 3000,
      });
    }

    const cloudSightUntil = gameState.rpgCloudSightUntil ?? 0;
    if (
      side === 'player'
      && gameState.rpgCloudSightActorId === actor.id
      && cloudSightUntil > nowMs
    ) {
      statuses.push({
        id: `cloud-sight-${actor.id}`,
        kind: 'buff',
        label: 'SOAR',
        detail: 'Second tableau row revealed',
        remainingMs: cloudSightUntil - nowMs,
        totalMs: 10000,
      });
    }
    const soarEvasionUntil = gameState.rpgSoarEvasionUntil ?? 0;
    if (
      gameState.rpgSoarEvasionActorId === actor.id
      && (gameState.rpgSoarEvasionSide ?? 'player') === side
      && soarEvasionUntil > nowMs
    ) {
      statuses.push({
        id: `soar-evasion-${side}-${actor.id}`,
        kind: 'buff',
        label: 'SOAR',
        detail: '+75% EVASION',
        remainingMs: soarEvasionUntil - nowMs,
        totalMs: Math.max(1, gameState.rpgSoarEvasionTotalMs ?? 6000),
      });
    }

    const blindLevel = getActiveBlindLevel(gameState, side, nowMs);
    if (blindLevel > 0) {
      const blindUntil = side === 'enemy' ? (gameState.rpgBlindedEnemyUntil ?? 0) : (gameState.rpgBlindedPlayerUntil ?? 0);
      statuses.push({
        id: `blinded-${side}-${actor.id}`,
        kind: 'debuff',
        label: getBlindedLabel(blindLevel),
        detail: getBlindedDetail(blindLevel),
        remainingMs: Math.max(0, blindUntil - nowMs),
        totalMs: 10000,
      });
    }

    (gameState.rpgDots ?? []).forEach((dot) => {
      if (dot.targetActorId !== actor.id) return;
      if (dot.targetSide !== side) return;
      if (dot.remainingTicks <= 0) return;
      const remainingMs = Math.max(
        0,
        (dot.nextTickAt - nowMs) + Math.max(0, dot.remainingTicks - 1) * dot.intervalMs
      );
      const dotLabel = dot.effectKind === 'bleed' ? 'BLEED' : 'VICE GRIP';
      statuses.push({
        id: dot.id,
        kind: 'debuff',
        label: dotLabel,
        detail: `${dot.damagePerTick} damage/sec (${dot.remainingTicks} ticks left)`,
        remainingMs,
        totalMs: (dot.initialTicks ?? dot.remainingTicks) * dot.intervalMs,
      });
    });

    return statuses;
  }, [
    gameState.rpgCloudSightActorId,
    gameState.rpgCloudSightUntil,
    gameState.rpgSoarEvasionActorId,
    gameState.rpgSoarEvasionSide,
    gameState.rpgSoarEvasionTotalMs,
    gameState.rpgSoarEvasionUntil,
    gameState.rpgDots,
    gameState.rpgBlindedEnemyUntil,
    gameState.rpgBlindedPlayerUntil,
    gameState.rpgEnemyDragSlowActorId,
    gameState.rpgEnemyDragSlowUntil,
    isRpgMode,
    statusClockMs,
  ]);
  const renderStatusBadges = (actor: Actor | null | undefined, side: HpBarSide = 'player') => {
    const statuses = getActorStatuses(actor, side);
    if (statuses.length === 0) return null;
    return (
      <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
        {statuses.map((status) => {
          const isBuff = status.kind === 'buff';
          const chipColor = isBuff ? '#7fdbca' : '#ff8080';
          const chipBg = isBuff ? 'rgba(18, 56, 52, 0.7)' : 'rgba(64, 20, 20, 0.74)';
          const hasDuration = typeof status.remainingMs === 'number' && typeof status.totalMs === 'number' && status.totalMs > 0;
          const remainingMs = hasDuration ? Number(status.remainingMs) : 0;
          const totalMs = hasDuration ? Number(status.totalMs) : 1;
          const fillPct = hasDuration
            ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))
            : 0;
          const tooltipContent = (
            <div className="text-xs leading-snug">
              <div className="font-bold tracking-[1.5px]" style={{ color: chipColor }}>{status.label}</div>
              <div className="mt-1 text-game-white/85">{status.detail}</div>
              {typeof status.remainingMs === 'number' && (
                <div className="mt-1 text-[11px] text-game-white/70">
                  Remaining: {formatStatusSeconds(status.remainingMs)}
                </div>
              )}
            </div>
          );
          return (
            <Tooltip
              key={status.id}
              content={tooltipContent}
              pinnable
              disabled={tooltipSuppressed}
            >
              <div
                className="relative overflow-hidden rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-[1.4px]"
                style={{
                  color: chipColor,
                  borderColor: `${chipColor}AA`,
                  backgroundColor: chipBg,
                  boxShadow: `0 0 8px ${chipColor}33`,
                  cursor: tooltipSuppressed ? 'default' : 'help',
                }}
              >
                {hasDuration && (
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${fillPct}%`,
                      backgroundColor: `${chipColor}33`,
                      transition: 'width 120ms linear',
                    }}
                  />
                )}
                <span className="relative z-[1]">{status.label}</span>
              </div>
            </Tooltip>
          );
        })}
      </div>
    );
  };
  const isActorCombatReady = (actor: Actor | null | undefined) =>
    (actor?.stamina ?? 0) > 0 && (actor?.hp ?? 0) > 0;
  const renderActorNameLabel = (actor: Actor | null | undefined) => {
    const displayName = getActorDisplayLabel(actor);
    if (!displayName) return null;
    return (
      <div
        className="mt-1 text-[10px] font-bold tracking-[2px] uppercase"
        style={{
          color: '#e2e8f0',
          textShadow: '0 0 8px rgba(255,255,255,0.35)',
        }}
      >
        {displayName.toUpperCase()}
      </div>
    );
  };
  const handleDragStartGuarded = useCallback((
    card: CardType,
    tableauIndex: number,
    clientX: number,
    clientY: number,
    rect: DOMRect
  ) => {
    if (introBlocking) return;
    if (isGamePaused && !(isRpgMode && tableauIndex === HAND_SOURCE_INDEX)) return;
    if (isEnemyTurn && !(isRpgMode && tableauIndex === HAND_SOURCE_INDEX)) return;
    handleDragStart(card, tableauIndex, clientX, clientY, rect);
  }, [handleDragStart, introBlocking, isEnemyTurn, isGamePaused, isRpgMode]);
  useEffect(() => {
    if (!isRpgMode) return;
    const actors = [...activeParty, ...enemyActors].filter(Boolean);
    actors.forEach((actor) => {
      const prevHp = prevHpMapRef.current[actor.id];
      const nextHp = Math.max(0, actor.hp ?? 0);
      if (prevHp === undefined) {
        prevHpMapRef.current[actor.id] = nextHp;
        setHpLagMap((prev) => ({ ...prev, [actor.id]: nextHp }));
        return;
      }
      if (nextHp < prevHp) {
        const damage = prevHp - nextHp;
        setHpDamageMap((prev) => ({ ...prev, [actor.id]: damage }));
        setHpLagMap((prev) => ({ ...prev, [actor.id]: prevHp }));
        if (hpLagTimeoutsRef.current[actor.id]) {
          window.clearTimeout(hpLagTimeoutsRef.current[actor.id]);
        }
        if (hpDamageTimeoutsRef.current[actor.id]) {
          window.clearTimeout(hpDamageTimeoutsRef.current[actor.id]);
        }
        hpLagTimeoutsRef.current[actor.id] = window.setTimeout(() => {
          setHpLagMap((prev) => ({ ...prev, [actor.id]: nextHp }));
        }, 40);
        hpDamageTimeoutsRef.current[actor.id] = window.setTimeout(() => {
          setHpDamageMap((prev) => ({ ...prev, [actor.id]: 0 }));
        }, 1100);
      } else if (nextHp > prevHp) {
        setHpLagMap((prev) => ({ ...prev, [actor.id]: nextHp }));
        setHpDamageMap((prev) => ({ ...prev, [actor.id]: 0 }));
      }
      prevHpMapRef.current[actor.id] = nextHp;
    });
  }, [activeParty, enemyActors, isRpgMode]);

  useEffect(() => {
    if (!isRpgMode || !rpgImpactSplashHint || !watercolorEngine) return;
    const targetEl = rpgImpactSplashHint.side === 'enemy'
      ? enemyFoundationRefs.current[rpgImpactSplashHint.foundationIndex]
      : foundationRefs.current[rpgImpactSplashHint.foundationIndex];
    if (!targetEl) return;
    const canvasRoots = Array.from(document.querySelectorAll('[data-watercolor-canvas-root]')) as HTMLElement[];
    const bestCanvas = canvasRoots
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
      .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))[0];
    const canvasRect = bestCanvas?.rect ?? {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const rect = targetEl.getBoundingClientRect();
    const centerX = Math.min(Math.max(0, rect.left - canvasRect.left + rect.width / 2), canvasRect.width);
    const centerY = Math.min(Math.max(0, rect.top - canvasRect.top + rect.height / 2), canvasRect.height);
    const direction = ((rpgImpactSplashHint.directionDeg % 360) + 360) % 360;
    const originJitterRadius = Math.max(4, Math.round(Math.min(rect.width, rect.height) * 0.08));
    const jitter = () => ({
      x: (Math.random() * 2 - 1) * originJitterRadius,
      y: (Math.random() * 2 - 1) * originJitterRadius,
    });
    const first = jitter();
    watercolorEngine.splash({
      origin: {
        x: Math.min(Math.max(0, centerX + first.x), canvasRect.width),
        y: Math.min(Math.max(0, centerY + first.y), canvasRect.height),
      },
      direction,
      patternId: 'splatter_round_burst',
      color: '#ff5c5c',
      intensity: 0.95,
      splotchCount: 9,
      drizzleCount: 6,
      duration: 520,
      sizeScale: 0.9,
    });
    const second = jitter();
    watercolorEngine.splash({
      origin: {
        x: Math.min(Math.max(0, centerX + second.x), canvasRect.width),
        y: Math.min(Math.max(0, centerY + second.y), canvasRect.height),
      },
      direction: (direction + (Math.random() * 16 - 8) + 360) % 360,
      patternId: 'splatter_blob_drip',
      color: '#ff5c5c',
      intensity: 0.75,
      splotchCount: 6,
      drizzleCount: 4,
      duration: 460,
      sizeScale: 0.78,
    });
  }, [isRpgMode, rpgImpactSplashHint, watercolorEngine]);
  const handleActorFoundationLongPress = useCallback((actor: Actor) => {
    setInspectedActorId(actor.id);
    setInspectedRpgCard(null);
    setInspectedRpgCardSource(null);
  }, []);
  const rpgCardInspectOverlay = (
    <RpgCardInspectOverlay
      card={inspectedRpgCard}
      open={isRpgMode && !!inspectedRpgCard}
      onClose={() => {
        setInspectedRpgCard(null);
        setInspectedRpgCardSource(null);
      }}
      onAdjustRarity={(delta) => {
        if (!inspectedRpgCard || inspectedRpgCardSource?.side !== 'player') return;
        actions.adjustRpgHandCardRarity?.(inspectedRpgCard.id, delta);
      }}
      zIndex={10036}
    />
  );
  const actorInspectOverlay = (
    <ActorInspectOverlay
      actor={inspectedActor}
      open={!!inspectedActor}
      onClose={() => setInspectedActorId(null)}
      ownedOrimNames={ownedOrimNames}
      nodeAssignments={inspectedActor ? (actorNodeAssignments[inspectedActor.id] ?? {}) : {}}
      onAssignNodeOrim={handleAssignNodeOrim}
      onClearNodeOrim={handleClearNodeOrim}
      lupusPackMomentumActive={packMomentumActive}
    />
  );
  const closeEnemyHandOverlay = useCallback(() => {
    setActiveEnemyHandActorIndex(null);
    if (inspectedRpgCardSource?.side === 'enemy') {
      setInspectedRpgCard(null);
      setInspectedRpgCardSource(null);
    }
  }, [inspectedRpgCardSource]);
  const handleEnemyHandCardInspect = useCallback((card: CardType) => {
    if (activeEnemyHandActorIndex === null) return;
    setInspectedRpgCardSource({ side: 'enemy', actorIndex: activeEnemyHandActorIndex });
    setInspectedRpgCard(card);
  }, [activeEnemyHandActorIndex]);
  const handlePlayerHandCardLongPress = useCallback((card: CardType) => {
    if (!isRpgMode) return;
    if (card.rank === WILD_SENTINEL_RANK) return;
    setInspectedRpgCardSource({ side: 'player' });
    setInspectedRpgCard(card);
  }, [isRpgMode]);
  const handleKeruAspectSelect = useCallback((archetype: KeruAspect) => {
    if (!allowedAspectSet.has(archetype)) return;
    actions.applyKeruArchetype?.(archetype);
    setShowKeruArchetypeReward(false);
    if (pendingPoiRewardKey) {
      consumedPoiRewardKeysRef.current.add(pendingPoiRewardKey);
      setLastPoiRewardKey(null);
    }
    setPendingPoiRewardKey(null);
  }, [actions.applyKeruArchetype, allowedAspectSet, pendingPoiRewardKey]);
  const noopEnemyHandDragStart = useCallback((
    _card: CardType,
    _tableauIndex: number,
    _clientX: number,
    _clientY: number,
    _rect: DOMRect,
  ) => {}, []);
  const enemyHandOverlayOpen = isRpgMode && activeEnemyHandActorIndex !== null && activeEnemyHandCards.length > 0;
  useEffect(() => {
    if (!enemyHandOverlayOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeEnemyHandOverlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeEnemyHandOverlay, enemyHandOverlayOpen]);
  const enemyHandOverlay = (
    <CombatOverlayFrame visible={enemyHandOverlayOpen} interactive dimOpacity={0.58} blurPx={2} zIndex={10018}>
      <div className="absolute inset-0" onClick={closeEnemyHandOverlay} />
      <div
        className="relative mx-4 rounded-xl border px-3 py-3 md:px-4 md:py-4"
        style={{
          width: 'min(1020px, calc(100vw - 28px))',
          borderColor: 'rgba(127, 219, 202, 0.7)',
          backgroundColor: 'rgba(10, 10, 10, 0.9)',
          boxShadow: '0 0 18px rgba(127, 219, 202, 0.35)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-2">
          <div className="text-[11px] font-bold tracking-[2px] text-game-teal/90 uppercase">{activeEnemyHandActorName} Hand</div>
          <button
            type="button"
            onClick={closeEnemyHandOverlay}
            className="px-2 py-1 rounded border text-[10px] tracking-[2px] font-bold"
            style={{
              borderColor: 'rgba(247, 210, 75, 0.7)',
              color: '#f7d24b',
              backgroundColor: 'rgba(10, 8, 6, 0.85)',
            }}
          >
            CLOSE
          </button>
        </div>
        <div
          className="relative z-40 flex justify-center"
          style={{
            height: cardHeight * handCardScale + 32,
            minWidth: cardWidth * handCardScale * 2,
            marginTop: 4,
          }}
        >
          <Hand
            cards={activeEnemyHandCards}
            cardScale={1}
            onDragStart={noopEnemyHandDragStart}
            onCardClick={handleEnemyHandCardInspect}
            onCardLongPress={handleEnemyHandCardInspect}
            stockCount={0}
            showGraphics={showGraphics}
            interactionMode="click"
            draggingCardId={null}
            isAnyCardDragging={dragState.isDragging}
            hideElements={isRpgMode}
          />
        </div>
      </div>
    </CombatOverlayFrame>
  );
  const isInspectOverlayActive = (isRpgMode && !!inspectedRpgCard) || !!inspectedActor;
  const formatBankSeconds = useCallback((ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}s`, []);
  const [momentumCallouts, setMomentumCallouts] = useState<Array<{ id: number; text: string }>>([]);
  const momentumRelicDefinition = useMemo(() => (
    gameState.relicDefinitions.find((definition) => definition.behaviorId === 'momentum_v1')
  ), [gameState.relicDefinitions]);
  const momentumBonusMs = Number(momentumRelicDefinition?.params?.bonusMs ?? 0);
  const momentumEquipped = useMemo(() => (
    momentumRelicDefinition
      ? (gameState.equippedRelics ?? []).some((instance) => instance.enabled && instance.relicId === momentumRelicDefinition.id)
      : false
  ), [momentumRelicDefinition, gameState.equippedRelics]);
  const timerBankVisuals = (
    <>
      {bankCallouts.map((entry) => (
        <Callout
          key={entry.id}
          visible
          instanceKey={entry.id}
          text={`+${formatBankSeconds(entry.ms)} banked`}
          tone="gold"
          autoFadeMs={1700}
          className="fixed left-14 bottom-24 z-[9985]"
        />
      ))}
      {enemyTurnEndCallouts.map((entry) => (
        <Callout
          key={entry.id}
          visible
          instanceKey={entry.id}
          text="Enemy Turn Ended"
          tone="gold"
          autoFadeMs={1700}
          className="fixed left-14 bottom-20 z-[9985]"
        />
      ))}
      {momentumCallouts.map((entry) => (
        <Callout
          key={entry.id}
          visible
          instanceKey={entry.id}
          text={entry.text}
          tone="teal"
          autoFadeMs={1500}
          className="fixed left-14 bottom-28 z-[9985]"
        />
      ))}
      {waveBattleCallouts.map((entry) => (
        <Callout
          key={entry.id}
          visible
          instanceKey={entry.id}
          text={`Wave ${entry.wave}`}
          tone="orange"
          autoFadeMs={1600}
          className="fixed left-1/2 top-24 -translate-x-1/2 z-[10045]"
        />
      ))}
      {orimRewardCallouts.map((entry) => {
        const def = ORIM_DEFINITIONS.find((o) => o.id === entry.orimId);
        if (!def) return null;
        
        let anchor = { x: window.innerWidth / 2, y: window.innerHeight * 0.33 };

        if (entry.dropPoint) {
          anchor = entry.dropPoint;
        } else if (entry.foundationIndex !== null) {
          const ref = foundationRefs.current[entry.foundationIndex];
          if (ref) {
            const rect = ref.getBoundingClientRect();
            anchor = {
              x: rect.left + rect.width / 2,
              y: rect.top,
            };
          }
        }

        return (
          <Callout
            key={entry.id}
            visible
            instanceKey={entry.id}
            text={`Equipped: ${def.name}`}
            tone="teal"
            autoFadeMs={3500}
            anchor={anchor}
            secondaryCallouts={def.description ? [{ id: 1, text: def.description }] : []}
          />
        );
      })}
      {bankSmashFx && (
        <div
          key={bankSmashFx.id}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10027] pointer-events-none rounded border px-3 py-2 text-[14px] font-bold tracking-[2px]"
          style={{
            color: '#f7d24b',
            borderColor: 'rgba(255, 229, 120, 0.95)',
            backgroundColor: 'rgba(10, 8, 6, 0.94)',
            boxShadow: '0 0 20px rgba(230, 179, 30, 0.65)',
            animation: 'bank-smash-into-rail 1.05s cubic-bezier(0.18, 0.84, 0.2, 1) forwards',
          }}
        >
          +{formatBankSeconds(bankSmashFx.ms)}
        </div>
      )}
      <style>{`
        @keyframes bank-smash-into-rail {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          25% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
          70% { opacity: 1; transform: translate(calc(-50vw + 58px), calc(-50% + 18px)) scale(0.98); }
          85% { opacity: 1; transform: translate(calc(-50vw + 44px), calc(-50% + 18px)) scale(1.12); }
          100% { opacity: 0; transform: translate(calc(-50vw + 44px), calc(-50% + 18px)) scale(0.85); }
        }
      `}</style>
    </>
  );
  const equippedRelics = useMemo(() => {
    const definitionsById = new Map(
      (gameState.relicDefinitions ?? []).map((definition) => [definition.id, definition])
    );
    return (gameState.equippedRelics ?? [])
      .filter((instance) => instance.enabled)
      .map((instance) => {
        const definition = definitionsById.get(instance.relicId);
        if (!definition) return null;
    const knownGlyphByBehaviorId: Record<string, string> = {
      turtle_bide_v1: '🛡',
      heart_of_wild_v1: '🐾',
      sunk_cost_v1: '🐚',
      [CONTROLLED_DRAGONFIRE_BEHAVIOR_ID]: '🐉',
      koi_coin_v1: '🪙',
      hindsight_v1: '⌛',
      momentum_v1: '⏱️',
      [SUMMON_DARKSPAWN_BEHAVIOR_ID]: '⚔',
    };
        const fallbackGlyph = definition.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((chunk) => (chunk.length > 0 ? chunk.charAt(0).toUpperCase() : ''))
          .join('');
        const glyph = knownGlyphByBehaviorId[definition.behaviorId] ?? (fallbackGlyph || 'R');
        return { instance, definition, glyph };
      })
      .filter((entry): entry is { instance: NonNullable<GameState['equippedRelics']>[number]; definition: NonNullable<GameState['relicDefinitions']>[number]; glyph: string } => !!entry);
  }, [gameState.equippedRelics, gameState.relicDefinitions]);
  const koiCoinEquipped = useMemo(
    () => (gameState.equippedRelics ?? []).some((instance) => instance.enabled && instance.relicId === 'koi_coin'),
    [gameState.equippedRelics]
  );
  // DEV OVERRIDE: keep relic debug interactions enabled during active prototyping.
  // TODO: replace with dedicated variant/config param when pre-prod gating is wired.
  const relicDevModeEnabled = true;
  const relicLastActivation = gameState.relicLastActivation;
  const handleControlledDragonfireRelicClick = useCallback(() => {
    if (!actions.addRpgHandCard) return;
    if (!partyLeaderActor) return;
    const card: CardType = {
      id: `${CONTROLLED_DRAGONFIRE_CARD_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      rank: 0,
      element: 'F',
      suit: ELEMENT_TO_SUIT.F,
      rarity: 'rare',
      sourceActorId: partyLeaderActor.id,
    };
    actions.addRpgHandCard(card);
  }, [actions.addRpgHandCard, partyLeaderActor]);
  const handleSummonDarkspawnRelicClick = useCallback(() => {
    actions.spawnRandomEnemyInRandomBiome?.();
  }, [actions.spawnRandomEnemyInRandomBiome]);
  const relicTray = (
    <div
      className="rounded border pointer-events-none w-full max-w-[640px]"
      style={{
        height: '34px',
        minWidth: '240px',
        borderColor: 'rgba(127, 219, 202, 0.7)',
        backgroundColor: 'rgba(10, 10, 10, 0.72)',
        boxShadow: '0 0 10px rgba(127, 219, 202, 0.28)',
      }}
    >
      <div className="h-full w-full px-2 flex items-center gap-2 overflow-x-auto pointer-events-auto">
        {equippedRelics.map(({ instance, definition, glyph }) => {
        const justActivated = relicLastActivation?.instanceId === instance.instanceId;
        const isTurtleBide = definition.behaviorId === 'turtle_bide_v1';
        const isControlledDragonfire = definition.behaviorId === CONTROLLED_DRAGONFIRE_BEHAVIOR_ID;
        const isSummonDarkspawn = definition.behaviorId === SUMMON_DARKSPAWN_BEHAVIOR_ID;
        const isMomentum = definition.behaviorId === 'momentum_v1';
        let relicAccent = 'rgba(255, 215, 64, 0.6)';
        let relicText = '#ffd740';
        let relicBg = 'rgba(18, 12, 2, 0.72)';
        let relicGlowIdle = '0 0 8px rgba(255, 215, 64, 0.25)';
        let relicGlowActive = '0 0 22px rgba(255, 215, 64, 0.95), 0 0 42px rgba(255, 185, 40, 0.75)';
        if (isMomentum) {
          relicAccent = 'rgba(103, 225, 255, 0.78)';
          relicText = '#8ff3ff';
          relicBg = 'rgba(6, 10, 18, 0.85)';
          relicGlowIdle = '0 0 8px rgba(103, 225, 255, 0.3)';
          relicGlowActive = '0 0 22px rgba(103, 225, 255, 0.95), 0 0 42px rgba(70, 195, 255, 0.75)';
        }
        if (isTurtleBide) {
          relicAccent = 'rgba(90, 170, 255, 0.75)';
          relicText = '#6cb6ff';
          relicBg = 'rgba(6, 14, 30, 0.78)';
          relicGlowIdle = '0 0 8px rgba(90, 170, 255, 0.3)';
          relicGlowActive = '0 0 22px rgba(90, 170, 255, 0.95), 0 0 42px rgba(70, 140, 255, 0.75)';
        } else if (isControlledDragonfire) {
          relicAccent = 'rgba(255, 118, 82, 0.78)';
          relicText = '#ff8e66';
          relicBg = 'rgba(26, 8, 5, 0.8)';
          relicGlowIdle = '0 0 8px rgba(255, 118, 82, 0.3)';
          relicGlowActive = '0 0 22px rgba(255, 118, 82, 0.95), 0 0 42px rgba(255, 80, 56, 0.75)';
        } else if (isSummonDarkspawn) {
          relicAccent = 'rgba(168, 100, 220, 0.78)';
          relicText = '#c87de8';
          relicBg = 'rgba(16, 5, 26, 0.85)';
          relicGlowIdle = '0 0 8px rgba(168, 100, 220, 0.3)';
          relicGlowActive = '0 0 22px rgba(168, 100, 220, 0.95), 0 0 42px rgba(140, 60, 200, 0.75)';
        }
          const canDevActivate = relicDevModeEnabled
            && definition.behaviorId === 'turtle_bide_v1'
            && !!actions.processRelicCombatEvent;
          const canControlledDragonfireActivate = definition.behaviorId === CONTROLLED_DRAGONFIRE_BEHAVIOR_ID
            && isRpgMode
            && !!partyLeaderActor
            && !!actions.addRpgHandCard;
          const canSummonDarkspawnActivate = isSummonDarkspawn
            && isRpgMode
            && !!actions.spawnRandomEnemyInRandomBiome;
          const tooltipContent = (
            <div className="space-y-2">
              <div className="text-game-gold text-sm tracking-[2px]">{definition.name}</div>
              <div className="text-[10px] text-game-teal/80 uppercase tracking-[2px]">
                {definition.rarity} • passive • party
              </div>
              {definition.description && (
                <div className="text-xs text-game-white/80 leading-relaxed">{definition.description}</div>
              )}
              {canControlledDragonfireActivate && (
                <div className="text-[10px] text-game-white/65">Click relic to add Dragonfire card to leader hand.</div>
              )}
              {canSummonDarkspawnActivate && (
                <div className="text-[10px] text-game-white/65">Click relic to summon a random enemy to the field.</div>
              )}
              <div className="text-[10px] text-game-white/60">Lvl {instance.level}</div>
              {definition.params && Object.keys(definition.params).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(definition.params).map(([key, value]) => (
                    <span
                      key={`${instance.instanceId}-${key}`}
                      className="text-[10px] px-2 py-[2px] rounded border border-game-gold/40 text-game-gold/90"
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              )}
              {canDevActivate && (
                <div className="pt-1">
                  <button
                    type="button"
                    className="text-[10px] px-2 py-1 rounded border border-game-gold/60 text-game-gold bg-game-bg-dark/70 hover:bg-game-bg-dark/90"
                    onClick={(event) => {
                      event.stopPropagation();
                      const bankMs = Number(definition.params?.msPerArmor ?? 5000);
                      actions.processRelicCombatEvent?.({
                        type: 'TURN_ENDED_EARLY',
                        side: 'player',
                        bankedMs: Number.isFinite(bankMs) && bankMs > 0 ? bankMs : 5000,
                      });
                    }}
                  >
                    Activate (Dev)
                  </button>
                </div>
              )}
            </div>
          );
          return (
            <Tooltip key={instance.instanceId} content={tooltipContent} disabled={tooltipSuppressed} pinnable>
              <div
                key={`${instance.instanceId}-${justActivated ? relicLastActivation?.token : 'idle'}`}
                className="w-6 h-6 rounded-full border flex items-center justify-center text-[11px] leading-none cursor-help select-none"
                onClick={() => {
                  if (canControlledDragonfireActivate) {
                    handleControlledDragonfireRelicClick();
                  } else if (canSummonDarkspawnActivate) {
                    handleSummonDarkspawnRelicClick();
                  }
                }}
                style={{
                  borderColor: relicAccent,
                  color: relicText,
                  backgroundColor: relicBg,
                  boxShadow: justActivated
                    ? relicGlowActive
                    : relicGlowIdle,
                  animation: justActivated ? 'relic-activation-flash 880ms cubic-bezier(0.2, 0.9, 0.25, 1) 1' : undefined,
                  cursor: (canControlledDragonfireActivate || canSummonDarkspawnActivate) ? 'pointer' : 'help',
                }}
                title={definition.name}
              >
                {glyph}
              </div>
            </Tooltip>
          );
        })}
      </div>
      <style>{`
        @keyframes relic-activation-flash {
          0% { transform: scale(0.92); filter: brightness(1); }
          20% { transform: scale(1.12); filter: brightness(1.75); }
          56% { transform: scale(1.02); filter: brightness(1.25); }
          100% { transform: scale(1); filter: brightness(1); }
        }
      `}</style>
    </div>
  );

  useEffect(() => {
    if (!isInspectOverlayActive) return;
    if (isGamePaused) return;
    onTogglePause?.();
  }, [isGamePaused, isInspectOverlayActive, onTogglePause]);

  useEffect(() => {
    return () => {
      Object.values(hpLagTimeoutsRef.current).forEach((id) => window.clearTimeout(id));
      Object.values(hpDamageTimeoutsRef.current).forEach((id) => window.clearTimeout(id));
      Object.values(upgradedFlashTimeoutsRef.current).forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (!true) return;
    const wasEnemyTurn = prevEnemyTurnRef.current;
    if (!wasEnemyTurn && isEnemyTurn) {
      // Pause player combo timer while enemy is taking actions.
      setComboPaused(true);
    }
    if (wasEnemyTurn && !isEnemyTurn) {
      // Enemy finished: immediately resume player combo timer when non-zen.
      setComboPaused(zenModeEnabled);
    }
    prevEnemyTurnRef.current = isEnemyTurn;
  }, [isEnemyTurn, true, zenModeEnabled]);
  useEffect(() => {
    const wasEnemyTurn = prevEnemyTurnForBankRef.current;
    const becamePlayerTurn = wasEnemyTurn && !isEnemyTurn;
    if (becamePlayerTurn && bankedTurnMs > 0 && !introBlocking && isRpgMode) {
      const bonus = bankedTurnMs;
      setBankedTimerBonusMs(bonus);
      setBankedTimerBonusToken(Date.now() + Math.random());
      setBankSmashFx({ id: Date.now() + Math.random(), ms: bonus });
      setBankedTurnMs(0);
      window.setTimeout(() => setBankSmashFx(null), 1100);
    }
    prevEnemyTurnForBankRef.current = isEnemyTurn;
  }, [bankedTurnMs, introBlocking, isEnemyTurn, isRpgMode]);

  useEffect(() => {
    if (introBlocking) return;
    if (!true) return;
    if (zenModeEnabled) return;
    if (isEnemyTurn) return;
    setComboPaused(false);
  }, [introBlocking, isEnemyTurn, true, zenModeEnabled]);
  useEffect(() => {
    rpgTickClockRef.current = Date.now();
    rpgTickLastRealNowRef.current = performance.now();
  }, [timeScale]);
  useEffect(() => {
    if (!isRpgMode) return;
    if (!actions.tickRpgCombat) return;
    if (isGamePaused || introBlocking) return;
    const intervalId = window.setInterval(() => {
      const nowReal = performance.now();
      const deltaReal = Math.max(0, nowReal - rpgTickLastRealNowRef.current);
      rpgTickLastRealNowRef.current = nowReal;
      rpgTickClockRef.current += deltaReal * Math.max(0.1, timeScale);
      actions.tickRpgCombat?.(rpgTickClockRef.current);
    }, 50);
    return () => window.clearInterval(intervalId);
  }, [actions, introBlocking, isGamePaused, isRpgMode, timeScale]);
  const registerEnemyReveal = useCallback((foundationIndex: number, value: number) => {
    setEnemyRevealMap((prev) => ({ ...prev, [foundationIndex]: value }));
    const existing = enemyRevealTimers.current[foundationIndex];
    if (existing) window.clearTimeout(existing);
    enemyRevealTimers.current[foundationIndex] = window.setTimeout(() => {
      setEnemyRevealMap((prev) => ({ ...prev, [foundationIndex]: null }));
    }, 3000);
  }, []);
  const handleComboExpire = useCallback((value: number) => {
    if (!isRpgMode) {
      const id = comboTokenIdRef.current++;
      setComboExpiryTokens((current) => [...current, { id, value }]);
    }
    if (true && !zenModeEnabled && !isEnemyTurn) {
      setComboPaused(true);
      (actions.advanceRandomBiomeTurn ?? actions.endRandomBiomeTurn)();
    }
  }, [
    actions.advanceRandomBiomeTurn,
    actions.endRandomBiomeTurn,
    isEnemyTurn,
    isRpgMode,
    true,
    zenModeEnabled,
  ]);
  const signalValidMove = useCallback(() => {
    actions.processRelicCombatEvent?.({ type: 'VALID_MOVE_PLAYED', side: 'player' });
    if (momentumEquipped && momentumBonusMs > 0) {
      const text = `+${(momentumBonusMs / 1000).toFixed(1)}s`;
      const calloutId = Date.now() + Math.random();
      setMomentumCallouts((prev) => [...prev, { id: calloutId, text }]);
      window.setTimeout(() => {
        setMomentumCallouts((current) => current.filter((entry) => entry.id !== calloutId));
      }, 1500);
    }
  }, [actions.processRelicCombatEvent, momentumEquipped, momentumBonusMs]);
  const maybeGainSupplyFromValidMove = useCallback(() => {
    signalValidMove();
    if (!isRpgMode) return;
    if (Math.random() <= 0.05) {
      setExplorationSupplies((current) => current + 1);
    }
  }, [isRpgMode, signalValidMove]);
  const triggerExplorationTableauSlide = useCallback((from: Direction, to: Direction) => {
    if (from === to) return;
    const total = DIRECTIONS.length;
    const fromIndex = DIRECTIONS.indexOf(from);
    const toIndex = DIRECTIONS.indexOf(to);
    if (fromIndex < 0 || toIndex < 0) return;
    let delta = toIndex - fromIndex;
    if (delta > total / 2) delta -= total;
    if (delta < -total / 2) delta += total;
    if (delta === 0) return;
    const clockwiseTurn = delta > 0;
    const magnitude = Math.max(1, Math.min(2, Math.abs(delta)));
    const startOffset = (clockwiseTurn ? 1 : -1) * (110 * magnitude);

    if (tableauSlideRafRef.current !== null) {
      window.cancelAnimationFrame(tableauSlideRafRef.current);
      tableauSlideRafRef.current = null;
    }

    setTableauSlideAnimating(false);
    setTableauSlideOffsetPx(startOffset);
    tableauSlideRafRef.current = window.requestAnimationFrame(() => {
      tableauSlideRafRef.current = window.requestAnimationFrame(() => {
        setTableauSlideAnimating(true);
        setTableauSlideOffsetPx(0);
      });
    });
  }, []);
  const hasLivingEnemy = useMemo(() => (
    enemyFoundations.some((foundation, index) => {
      if (foundation.length === 0) return false;
      const actor = enemyActors[index];
      if (!actor) return false;
      return (actor.hp ?? 0) > 0 && (actor.stamina ?? 0) > 0;
    })
  ), [enemyActors, enemyFoundations]);
  const hasSpawnedEnemies = !isRpgMode
    || enemyFoundations.some((foundation) => foundation.length > 0)
    || encounterEnemyActors.length > 0;
  const { mapVisible, handleToggleMap } = useExplorationMapVisibility({
    keruHasAspect,
    isRpgMode,
    hasSpawnedEnemies,
  });
  const isExplorationMode = isRpgMode && !false && !hasSpawnedEnemies;
  const showActorComboCounts = !isRpgMode || hasSpawnedEnemies;
  useEffect(() => {
    if (!false) {
      waveBattleSpawnPendingRef.current = false;
      setWaveBattleCount(0);
      setWaveBattleCallouts([]);
      waveBattleStartRef.current = null;
    }
  }, [false, gameState.currentBiome]);
  useEffect(() => {
    if (!isRpgMode) return;
    const coords = getExplorationNodeCoordinates(explorationCurrentNodeId);
    if (!coords) return;
    const cell = mainWorldMap.cells.find(
      (entry) => entry.gridPosition.col === coords.x && entry.gridPosition.row === coords.y
    );
    const biomeId = cell?.poi?.biomeId;
    if (biomeId !== 'wave_battle') return;
    if (gameState.currentBiome === biomeId) return;
    const lockKey = `${coords.x},${coords.y}:${biomeId}`;
    if (waveBattleStartRef.current === lockKey) return;
    waveBattleStartRef.current = lockKey;
    actions.startBiome?.(gameState.activeSessionTileId ?? cell?.poi?.id ?? biomeId, biomeId);
  }, [actions.startBiome, explorationCurrentNodeId, gameState.activeSessionTileId, gameState.currentBiome, getExplorationNodeCoordinates, isRpgMode]);
  useEffect(() => {
    if (!false || !true) return;
    actions.cleanupDefeatedEnemies?.();
    if (hasLivingEnemy) {
      waveBattleSpawnPendingRef.current = false;
      return;
    }
    if (waveBattleSpawnPendingRef.current) return;
    waveBattleSpawnPendingRef.current = true;
    actions.spawnRandomEnemyInRandomBiome?.();
    setWaveBattleCount((prev) => {
      const next = prev + 1;
      const calloutId = Date.now() + Math.random();
      setWaveBattleCallouts((current) => [...current, { id: calloutId, wave: next }]);
      window.setTimeout(() => {
        setWaveBattleCallouts((current) => current.filter((entry) => entry.id !== calloutId));
      }, 1800);
      return next;
    });
  }, [actions.cleanupDefeatedEnemies, actions.spawnRandomEnemyInRandomBiome, hasLivingEnemy, true, false]);
  const showPauseButton = !zenModeEnabled && true && hasSpawnedEnemies;
  /*
  const pauseButton = (
    <button
      type="button"
      onClick={onTogglePause}
      disabled={!onTogglePause}
      className="rounded border border-game-gold/70 bg-game-bg-dark/90 px-4 py-2 text-[12px] font-bold tracking-[2px] text-game-gold shadow-neon-gold disabled:opacity-50"
      title={isGamePaused ? 'Resume' : 'Pause'}
      aria-label={isGamePaused ? 'Resume' : 'Pause'}
    >
      {isGamePaused ? '▶' : '⏸'}
    </button>
  );
  const leftControlColumn = !isInspectOverlayActive ? (
    <div
      className="fixed z-[10035] flex flex-col items-start gap-3"
      style={{
        left: 12,
        bottom: 90,
      }}
    >
      {showPauseButton ? pauseButton : null}
    </div>
  ) : null;
  */
  const devTraverseHoldEnabled = useDevModeFlag();
  const {
    travelRowsPerStep,
    availableExplorationActionPoints,
    explorationTravelProgress,
    canStepForwardInExploration,
    awardExplorationActionPoint,
    registerExplorationTraversal,
  } = useExplorationTravelProgression({
    explorationHeading,
    explorationRowsPerStep,
    explorationMovesByDirection,
    explorationAppliedTraversalByDirection,
    isExplorationMode,
    setExplorationMovesByDirection,
    setExplorationAppliedTraversalByDirection,
    setExplorationTotalTraversalCount,
  });
  const explorationAppliedTraversalCount = explorationTotalTraversalCount;
  const {
    getDisplayedStepIndexForColumn,
    getDebugStepLabelForColumn,
  } = useExplorationTableauProgress({
    isRpgMode,
    hasSpawnedEnemies,
    explorationHeading,
    explorationCurrentNodeId,
    explorationStepOffsetBySource,
    setExplorationStepOffsetBySource,
    explorationLastTopCardIdBySourceRef,
    tableaus: gameState.tableaus,
    getColumnSourcesForDirection,
    getExplorationSourceKey,
  });
  useExplorationTableauDisplaySync({
    isRpgMode,
    hasSpawnedEnemies,
    poiMapsReady,
    explorationCurrentNodeId,
    explorationHeading,
    currentTableaus: gameState.tableaus,
    setBiomeTableaus: actions.setBiomeTableaus,
    getExplorationNodeCoordinates,
    getColumnSourcesForDirection,
    poiByCoordinateKey,
    poiPresenceByCoordinateKey,
    cloneCard,
    cloneTableaus,
    skipPoiCommitRef,
    explorationDisplayedContextRef,
    explorationMajorTableauCacheRef,
    explorationMinorCenterCacheRef,
    explorationPoiTableauCacheRef,
  });
  useExplorationBootstrapState({
    isRpgMode,
    hasSpawnedEnemies,
    biomeKey: gameState.currentBiome,
    explorationSpawnX,
    explorationSpawnY,
    setExplorationNodes,
    setExplorationEdges,
    setExplorationCurrentNodeId,
    setExplorationTrailNodeIds,
    setExplorationHeading,
    setExplorationStepOffsetBySource,
    setExplorationMovesByDirection,
    setExplorationAppliedTraversalByDirection,
    setExplorationTotalTraversalCount,
    explorationNodesRef,
    explorationEdgesRef,
    explorationCurrentNodeIdRef,
    explorationTrailNodeIdsRef,
    explorationHeadingRef,
    explorationLastTopCardIdBySourceRef,
    explorationDisplayedContextRef,
    explorationMajorTableauCacheRef,
    explorationMinorCenterCacheRef,
    explorationPoiTableauCacheRef,
  });
  const {
    handleExplorationHeadingChange,
    handleExplorationHeadingStep,
    toggleExplorationMapAlignment,
  } = useExplorationNavigationControls({
    isRpgMode,
    hasSpawnedEnemies,
    explorationHeadingRef,
    setExplorationHeading,
    setExplorationMapAlignment,
    triggerExplorationTableauSlide,
  });
  const explorationCurrentLocationTitle = useMemo(() => {
    const coords = getExplorationNodeCoordinates(explorationCurrentNodeId);
    if (!coords) return 'UNKNOWN';
    return poiPresenceByCoordinateKey.get(`${coords.x},${coords.y}`)?.name ?? `WILDERNESS ${coords.x},${coords.y}`;
  }, [explorationCurrentNodeId, getExplorationNodeCoordinates, poiPresenceByCoordinateKey]);
  const explorationForcedPathNextIndex = useMemo(() => {
    if (worldForcedPath.length < 2) return null;
    const coords = getExplorationNodeCoordinates(explorationCurrentNodeId);
    if (!coords) return null;
    const currentIndex = worldForcedPath.findIndex((step) => step.x === coords.x && step.y === coords.y);
    if (currentIndex < 0 || currentIndex >= worldForcedPath.length - 1) return null;
    return currentIndex + 1;
  }, [explorationCurrentNodeId, getExplorationNodeCoordinates, worldForcedPath]);
  const explorationActiveBlockedEdge = useMemo(() => {
    if (!(isRpgMode && !hasSpawnedEnemies)) return null;
    if (!pathingLocked) return null;
    const coords = getExplorationNodeCoordinates(explorationCurrentNodeId);
    if (!coords) return null;
    const pinnedConditionalEdge = (mainWorldMap.conditionalEdges ?? []).find((edge) => {
      if (edge.requirement !== 'source_tableau_cleared') return false;
      if (coords.x !== edge.from.col || coords.y !== edge.from.row) return false;
      return !isCurrentExplorationTableauCleared;
    });
    if (pinnedConditionalEdge) {
      return {
        fromX: pinnedConditionalEdge.from.col,
        fromY: pinnedConditionalEdge.from.row,
        toX: pinnedConditionalEdge.to.col,
        toY: pinnedConditionalEdge.to.row,
        reason: 'terrain_gate' as const,
      };
    }
    // Keep active wall stable for map-authored terrain gates only (no heading-driven rotation).
    return null;
  }, [
    explorationCurrentNodeId,
    getExplorationNodeCoordinates,
    hasSpawnedEnemies,
    isCurrentExplorationTableauCleared,
    isRpgMode,
  ]);
  const explorationTableauWall = useMemo(() => (
    explorationActiveBlockedEdge
      ? {
        fromX: explorationActiveBlockedEdge.fromX,
        fromY: explorationActiveBlockedEdge.fromY,
        toX: explorationActiveBlockedEdge.toX,
        toY: explorationActiveBlockedEdge.toY,
        tableaus: Math.max(1, gameState.tableaus.length),
        pathBlock: true,
      }
      : null
  ), [explorationActiveBlockedEdge, gameState.tableaus.length]);
  const {
    canAdvanceExplorationHeading,
    advanceExplorationMap,
    teleportToExplorationNode,
    stepExplorationBackward,
  } = useExplorationTraversalController({
    explorationHeading,
    pathingLocked,
    isCurrentExplorationTableauCleared,
    worldBlockedCellKeys,
    worldBlockedEdges,
    worldForcedPath,
    explorationNodesRef,
    explorationEdgesRef,
    explorationCurrentNodeIdRef,
    explorationTrailNodeIdsRef,
    explorationHeadingRef,
    setExplorationNodes,
    setExplorationEdges,
    setExplorationCurrentNodeId,
    setExplorationTrailNodeIds,
  });
  useEffect(() => {
    if (!(isRpgMode && !hasSpawnedEnemies)) return;
    if (!isCurrentExplorationTableauCleared) return;
    const currentId = explorationCurrentNodeIdRef.current;
    const alreadyCleared = explorationNodesRef.current.some((node) => node.id === currentId && node.cleared);
    if (alreadyCleared) return;
    const updatedNodes = explorationNodesRef.current.map((node) => (
      node.id === currentId ? { ...node, cleared: true } : node
    ));
    // Note: lastPoiRewardKey is set in the main effect when nodes clear,
    // not here, to ensure it happens after tableaus are actually resolved
    explorationNodesRef.current = updatedNodes;
    setExplorationNodes(updatedNodes);
  }, [
    hasSpawnedEnemies,
    isCurrentExplorationTableauCleared,
    isRpgMode,
  ]);
  useEffect(() => {
    if (!isRpgMode) return;
    if (hasSpawnedEnemies) return;
    if (!noValidMoves) return;
    actions.processRelicCombatEvent?.({
      type: 'NO_PLAYABLE_MOVES',
      side: 'player',
    });
  }, [actions, hasSpawnedEnemies, isRpgMode, noValidMoves]);
  useEffect(() => {
    const shouldPulse = noValidMoves && sunkCostRelicEquipped && hasUnclearedVisibleTableaus;
    if (!shouldPulse) {
      sunkCostPulseArmedRef.current = false;
      return;
    }
    if (sunkCostPulseArmedRef.current) return;
    sunkCostPulseArmedRef.current = true;
    const now = Date.now();
    setSunkCostPulseStartedAt(now);
    setSunkCostPulseNowMs(now);
  }, [hasUnclearedVisibleTableaus, noValidMoves, sunkCostRelicEquipped]);
  useEffect(() => {
    if (sunkCostPulseStartedAt === null) return;
    const intervalId = window.setInterval(() => {
      setSunkCostPulseNowMs(Date.now());
    }, 50);
    const timeoutId = window.setTimeout(() => {
      setSunkCostPulseStartedAt(null);
    }, 4000);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [sunkCostPulseStartedAt]);
  const sunkCostTableauPulseStyle = useMemo(() => {
    if (sunkCostPulseStartedAt === null) return null;
    const elapsed = Math.max(0, sunkCostPulseNowMs - sunkCostPulseStartedAt);
    if (elapsed >= 4000) return null;
    const t = Math.min(1, elapsed / 4000);
    const decay = 1 - t;
    const flash = Math.max(0, Math.sin(t * Math.PI * 8)) * decay;
    const borderAlpha = Math.min(0.95, 0.3 + (decay * 0.5) + (flash * 0.25));
    const glowAlpha = Math.min(0.9, 0.2 + (decay * 0.45) + (flash * 0.25));
    return {
      border: `2px solid rgba(255, 62, 62, ${borderAlpha})`,
      borderRadius: 10,
      boxShadow: `0 0 ${6 + (decay * 12)}px rgba(255, 45, 45, ${glowAlpha}), inset 0 0 ${4 + (decay * 8)}px rgba(255, 45, 45, ${glowAlpha * 0.9})`,
      transition: 'none',
    } as const;
  }, [sunkCostPulseNowMs, sunkCostPulseStartedAt]);
  const dynamicAmbientDarkness = useMemo(() => {
    const tableauCount = gameState.tableaus.length;
    const foundationCount = gameState.foundations.length;
    if (tableauCount <= 0 || foundationCount <= 0) return ambientDarkness;

    const hasFoundationStamina = (index: number) => {
      const actor = activeParty[index];
      return isActorCombatReady(actor);
    };
    let playablePairCount = 0;
    gameState.tableaus.forEach((tableau) => {
      const topCard = tableau[tableau.length - 1];
      if (!topCard) return;
      gameState.foundations.forEach((foundation, foundationIndex) => {
        if (!hasFoundationStamina(foundationIndex)) return;
        const foundationTop = foundation[foundation.length - 1];
        if (!foundationTop) return;
        if (canPlayCardWithWild(topCard, foundationTop, gameState.activeEffects, foundation)) {
          playablePairCount += 1;
        }
      });
    });

    const playableTableauCount = tableauCanPlay.filter(Boolean).length;
    const maxPairCount = tableauCount * foundationCount;
    const pairRatio = maxPairCount > 0 ? clamp01(playablePairCount / maxPairCount) : 0;
    const tableauRatio = clamp01(playableTableauCount / tableauCount);
    const availability = clamp01((tableauRatio * 0.55) + (pairRatio * 0.45));
    const darknessOffset = (0.18 * (1 - availability)) - (0.12 * availability);

    return Math.max(0.2, Math.min(1, ambientDarkness + darknessOffset));
  }, [
    activeParty,
    ambientDarkness,
    clamp01,
    gameState.activeEffects,
    gameState.foundations,
    gameState.tableaus,
    tableauCanPlay,
  ]);
  const canTriggerEndTurnFromCombo = true && !isEnemyTurn && !introBlocking;
  const handleExplorationStepForward = useCallback(() => {
    if (!(isRpgMode && !hasSpawnedEnemies)) return;
    if (!canStepForwardInExploration) return;
    const moved = advanceExplorationMap(explorationHeading);
    if (!moved) return;
    registerExplorationTraversal();
  }, [
    advanceExplorationMap,
    canStepForwardInExploration,
    explorationHeading,
    hasSpawnedEnemies,
    isRpgMode,
    registerExplorationTraversal,
  ]);
  const handleExplorationStepBackward = useCallback(() => {
    stepExplorationBackward();
  }, [stepExplorationBackward]);

  const stepExplorationOnPlay = useCallback(() => {
    if (!isExplorationMode) return;
    const moved = advanceExplorationMap(explorationHeading);
    if (!moved) return;
    registerExplorationTraversal();
  }, [advanceExplorationMap, explorationHeading, isExplorationMode, registerExplorationTraversal]);
  useEffect(() => {
    if (explorationStepRef) explorationStepRef.current = () => {
      awardExplorationActionPoint();
    };
  }, [awardExplorationActionPoint, explorationStepRef]);
  const runDevTraversePulse = useCallback(() => {
    if (!(isRpgMode && !hasSpawnedEnemies)) return;
    if (!actions.setBiomeTableaus) return;
    const nextTableaus = gameState.tableaus.map((tableau) => (
      tableau.length > 0 ? tableau.slice(0, tableau.length - 1) : tableau
    ));
    actions.setBiomeTableaus(nextTableaus);
    const moved = advanceExplorationMap(explorationHeading);
    if (!moved) return;
    registerExplorationTraversal(travelRowsPerStep);
  }, [
    actions.setBiomeTableaus,
    advanceExplorationMap,
    explorationHeading,
    gameState.tableaus,
    hasSpawnedEnemies,
    isRpgMode,
    registerExplorationTraversal,
    travelRowsPerStep,
  ]);
  const {
    handlePointerDown: handleTraversalButtonPointerDown,
    handlePointerUp: handleTraversalButtonPointerUp,
    handleClick: handleTraversalButtonClick,
  } = useExplorationTraverseHoldControls({
    enabled: devTraverseHoldEnabled,
    holdDelayMs: DEV_TRAVERSE_HOLD_DELAY_MS,
    holdIntervalMs: DEV_TRAVERSE_HOLD_INTERVAL_MS,
    setHoldProgress: setDevTraverseHoldProgress,
    onTapStepForward: handleExplorationStepForward,
    onHoldPulse: runDevTraversePulse,
  });
  const handleExplorationUseSupply = useCallback(() => {
    if (!(isRpgMode && !hasSpawnedEnemies)) return;
    if (explorationSupplies <= 0) return;
    setExplorationSupplies((current) => Math.max(0, current - 1));
    const supplyWild = createWildSentinel(explorationSupplies);
    supplyWild.id = `supply-wild-${Date.now()}-${randomIdSuffix()}`;
    actions.addRpgHandCard?.(supplyWild);
    awardExplorationActionPoint(20);
  }, [
    actions.addRpgHandCard,
    awardExplorationActionPoint,
    explorationSupplies,
    hasSpawnedEnemies,
    isRpgMode,
  ]);
  const handleExplorationEndTurn = useCallback(() => {
    if (!canTriggerEndTurnFromCombo) return;
    setComboPaused(true);
    if (isRpgMode && !hasSpawnedEnemies && actions.endExplorationTurnInRandomBiome) {
      actions.endExplorationTurnInRandomBiome();
      return;
    }
    (actions.advanceRandomBiomeTurn ?? actions.endRandomBiomeTurn)();
  }, [
    actions.endExplorationTurnInRandomBiome,
    actions.advanceRandomBiomeTurn,
    actions.endRandomBiomeTurn,
    canTriggerEndTurnFromCombo,
    hasSpawnedEnemies,
    isRpgMode,
  ]);
  const handlePartyComboCounterEndTurn = useCallback(() => {
    handleExplorationEndTurn();
  }, [handleExplorationEndTurn]);
  const handlePlayerFoundationClickInBiome = (foundationIndex: number): boolean => {
    if (!isExplorationMode) return false;
    setActivePlayerHandActorIndex((current) => (current === foundationIndex ? null : foundationIndex));
    setInspectedRpgCard(null);
    setInspectedRpgCardSource(null);
    return true;
  };
  const renderExplorationActorHandPreview = (actor: Actor | null | undefined, foundationIndex: number) => {
    if (!isExplorationMode || !actor) return null;
    const actorHandCards = explorationActorHandCardsByIndex[foundationIndex] ?? [];
    const actorHandCount = actorHandCards.length;
    const actorTopCard = actorHandCount > 0 ? actorHandCards[actorHandCount - 1] : null;
    const isActive = activePlayerHandActorIndex === foundationIndex;
    const previewWidth = Math.max(22, Math.round(cardWidth * 0.3));
    const previewHeight = Math.max(30, Math.round(cardHeight * 0.3));
    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          top: 0,
          width: cardWidth,
          height: cardHeight,
          transform: 'translateX(-50%)',
          zIndex: 22,
          overflow: 'hidden',
        }}
      >
        <div
          className="absolute left-1/2"
          style={{
            bottom: Math.max(5, Math.round(cardHeight * 0.06)),
            transform: 'translateX(-50%)',
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handlePlayerFoundationClickInBiome(foundationIndex);
            }}
            className="relative block cursor-pointer pointer-events-auto"
            aria-label={`Toggle ${getActorDefinition(actor.definitionId)?.name ?? 'actor'} hand`}
            title="Toggle actor hand"
          >
          <Card
            card={actorTopCard}
            size={{
              width: previewWidth,
              height: previewHeight,
            }}
            showGraphics={showGraphics}
            hideElements
            rpgSubtitleRarityOnly
            boxShadowOverride={isActive ? '0 0 12px rgba(127, 219, 202, 0.55)' : undefined}
          />
          <div
            className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
            style={{
              color: isActive ? '#7fdbca' : '#f7d24b',
              textShadow: isActive
                ? '0 0 6px rgba(127, 219, 202, 0.65)'
                : '0 0 6px rgba(230, 179, 30, 0.65)',
            }}
          >
            {actorHandCount}
          </div>
          </button>
      </div>
    </div>
  );
  };

  const fpsLabel = serverAlive === false
    ? 'server down'
    : `${Math.round(Math.max(0, Math.floor(fps ?? 0)))}fps`;
  const handleToggleSound = useCallback(() => {
    const next = !soundMuted;
    setSoundMuted(next);
    setGameAudioMuted(next);
  }, [soundMuted]);
  const currentCoords = getExplorationNodeCoordinates(explorationCurrentNodeId);
  const handleBattleButtonClick = useCallback(() => {
    onToggleCombatSandbox?.();
  }, [onToggleCombatSandbox]);
  const coordsLabel = currentCoords ? `${currentCoords.x},${currentCoords.y}` : '--,--';
  const topRightBattleButton = (
    <button
      type="button"
      onClick={handleBattleButtonClick}
      className="h-[30px] min-w-[58px] rounded border border-game-gold/70 bg-game-bg-dark/90 px-2 text-[12px] font-mono tracking-[0.5px] text-game-gold shadow-neon-gold flex items-center justify-center"
      title="Toggle combat sandbox"
      aria-label="Toggle combat sandbox"
    >
      BATTLE
    </button>
  );
  const topRightCoords = (
    <button
      type="button"
      onClick={() => {
        if (!currentCoords) return;
        onOpenPoiEditorAt?.(currentCoords.x, currentCoords.y);
      }}
      className="h-[30px] rounded border border-game-gold/70 bg-game-bg-dark/90 px-2 text-[12px] font-mono tracking-[0.5px] text-game-gold shadow-neon-gold flex items-center justify-center"
      title="Open POI editor at current coordinates"
      aria-label="Open POI editor at current coordinates"
    >
      {coordsLabel}
    </button>
  );
  const topLeftFpsCounter = (
    <button
      type="button"
      onClick={() => onOpenSettings?.()}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      aria-disabled={!onOpenSettings}
      className="h-[30px] rounded border border-game-teal/70 bg-game-bg-dark/90 px-2 text-[12px] font-mono tracking-[0.5px] text-game-teal shadow-neon-teal"
      style={{ opacity: onOpenSettings ? 1 : 0.8, WebkitTouchCallout: 'none' }}
      title="Open settings / report fps"
    >
      {fpsLabel}
    </button>
  );
  const topRightSoundToggle = (
    <button
      type="button"
      onClick={handleToggleSound}
      className="h-[30px] min-w-[30px] rounded border border-game-gold/70 bg-game-bg-dark/90 px-2 text-[14px] leading-none font-bold text-game-gold shadow-neon-gold flex items-center justify-center"
      title={soundMuted ? 'Sound off. Click to enable.' : 'Sound on. Click to mute.'}
      aria-label={soundMuted ? 'Enable sound' : 'Mute sound'}
      aria-pressed={soundMuted}
    >
      {soundMuted ? '🔇' : '🔊'}
    </button>
  );
  const topHudBar = (
    <div className="fixed top-2 left-0 right-0 z-[10034] px-3 pointer-events-none">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="justify-self-start pointer-events-auto">
          {topLeftFpsCounter}
        </div>
        <div className="justify-self-center w-full max-w-[min(90vw,960px)]">
          {relicTray}
        </div>
        <div className="justify-self-end pointer-events-auto flex items-center gap-2">
          {topRightBattleButton}
          {topRightCoords}
          {topRightSoundToggle}
        </div>
      </div>
    </div>
  );
  const handleSkipWithBank = useCallback((remainingMs: number) => {
    if (!isRpgMode || !canTriggerEndTurnFromCombo) return;
    const bankMs = Math.max(0, Math.round(remainingMs));
    if (bankMs > 0) {
      setBankedTurnMs((prev) => prev + bankMs);
      actions.processRelicCombatEvent?.({ type: 'TURN_ENDED_EARLY', side: 'player', bankedMs: bankMs });
      const calloutId = Date.now() + Math.random();
      setBankCallouts((prev) => [...prev, { id: calloutId, ms: bankMs }]);
      window.setTimeout(() => {
        setBankCallouts((prev) => prev.filter((entry) => entry.id !== calloutId));
      }, 1700);
    }
    handleExplorationEndTurn();
  }, [
    canTriggerEndTurnFromCombo,
    handleExplorationEndTurn,
    isRpgMode,
    actions.processRelicCombatEvent,
  ]);
  const comboTimersEnabled = !zenModeEnabled && hasSpawnedEnemies;
  const enemyDragSpeedFactor = useMemo(() => {
    const slowActive = isRpgMode && (gameState.rpgEnemyDragSlowUntil ?? 0) > Date.now();
    const base = slowActive ? enemyDragBaseSpeedFactor * 0.1 : enemyDragBaseSpeedFactor;
    return base * Math.max(0.1, timeScale);
  }, [enemyDragBaseSpeedFactor, gameState.rpgEnemyDragSlowUntil, isRpgMode, timeScale]);
  const enemyMoveDurationMs = getEnemyMoveAnimationMs(enemyDragSpeedFactor);
  const enemyTurnFillPercent = `${Math.max(
    0,
    Math.min(100, (enemyTurnRemainingMs / ENEMY_TURN_TIME_BUDGET_MS) * 100)
  )}%`;
  useEffect(() => {
    if (!isEnemyTurn) {
      setEnemyTurnRemainingMs(ENEMY_TURN_TIME_BUDGET_MS);
      setEnemyRpgTelegraph(null);
    }
  }, [isEnemyTurn]);

  useEffect(() => {
    isGamePausedRef.current = isGamePaused;
  }, [isGamePaused]);

  useEffect(() => {
    const biomeId = gameState.currentBiome ?? 'none';
    if (introBiomeRef.current === biomeId) return;
    introBiomeRef.current = biomeId;
    setRewardedBattleHandCards([]);
    rewardCardIdRef.current = 0;
    setStartOverlayPhase('ready');
    setStartCountdown(3);
    setExplorationSupplies(10);
  }, [gameState.currentBiome]);

  const equippedOrimRow = (
    <div
      className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto rounded-2xl px-3 py-2"
      style={{
        marginTop: Math.round(handOffset * 0.1),
        marginBottom: Math.round(handOffset * 0.1),
        border: orimTrayDevMode ? '1px solid #39ff14' : '1px solid transparent',
        boxShadow: orimTrayDevMode ? '0 0 14px rgba(57, 255, 20, 0.35)' : 'none',
      }}
      data-orim-row
    >
      {orimTrayDevMode && (
        <div className="flex items-center gap-2 w-full justify-center">
          <button
            type="button"
            className="text-xs font-mono px-2 py-1 rounded border"
            onClick={() => onOrimTrayTabChange?.('puzzle')}
            style={{
              borderColor: orimTrayTab === 'puzzle' ? '#39ff14' : 'rgba(127, 219, 202, 0.4)',
              color: orimTrayTab === 'puzzle' ? '#39ff14' : 'rgba(127, 219, 202, 0.8)',
              boxShadow: orimTrayTab === 'puzzle' ? '0 0 8px rgba(57, 255, 20, 0.35)' : 'none',
            }}
            title="Puzzle Orims"
          >
            🧩
          </button>
          <button
            type="button"
            className="text-xs font-mono px-2 py-1 rounded border"
            onClick={() => onOrimTrayTabChange?.('combat')}
            style={{
              borderColor: orimTrayTab === 'combat' ? '#39ff14' : 'rgba(127, 219, 202, 0.4)',
              color: orimTrayTab === 'combat' ? '#39ff14' : 'rgba(127, 219, 202, 0.8)',
              boxShadow: orimTrayTab === 'combat' ? '0 0 8px rgba(57, 255, 20, 0.35)' : 'none',
            }}
            title="Combat Orims"
          >
            ⚔
          </button>
        </div>
      )}
      {filteredDisplayOrims.map((orim) => {
        const tooltipContent = (
          <div className="space-y-2">
            <div className="text-game-white text-sm tracking-[2px]">{orim.name}</div>
            <div className="text-[10px] text-game-teal/80 uppercase tracking-[2px]">
              {orim.category} • {orim.rarity}
            </div>
            <div className="text-[10px] text-game-white/70">{orim.actorName}</div>
            {orim.description && (
              <div className="text-xs text-game-white/80 leading-relaxed">
                {orim.description}
              </div>
            )}
          </div>
        );
        const chip = (
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: orimChipSize,
              height: orimChipSize,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: orim.color,
              color: orim.color,
              fontSize: orimFontSize,
            }}
          >
            {orimTrayDevMode && orim.isSandbox && (
              <button
                type="button"
                className="absolute -top-2 -right-2 text-[9px] rounded-full w-4 h-4 flex items-center justify-center border border-game-pink bg-game-bg-dark"
                style={{ color: '#ff7bb8' }}
                onClick={() => {
                  if (!onRemoveSandboxOrim) return;
                  onRemoveSandboxOrim(orim.id.replace('sandbox-', ''));
                }}
                title="Remove from tray"
              >
                x
              </button>
            )}
            {orim.watercolor && (
              <div
                className="absolute"
                style={{
                  zIndex: 0,
                  pointerEvents: 'none',
                  width: orimChipSize * ORIM_WATERCOLOR_CANVAS_SCALE,
                  height: orimChipSize * ORIM_WATERCOLOR_CANVAS_SCALE,
                  left: (orimChipSize - orimChipSize * ORIM_WATERCOLOR_CANVAS_SCALE) / 2,
                  top: (orimChipSize - orimChipSize * ORIM_WATERCOLOR_CANVAS_SCALE) / 2,
                }}
              >
                <WatercolorOverlay config={orim.watercolor} />
              </div>
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{orim.glyph}</span>
          </div>
        );
        return (
          <Tooltip key={`${orim.id}-${orim.actorName}`} content={tooltipContent} disabled={tooltipSuppressed}>
            <div
              className="flex items-center gap-2"
              title={`${orim.name} — ${orim.actorName}`}
            >
              {chip}
              {/* TEMP: hide orim text labels while iterating on new presentation */}
            </div>
          </Tooltip>
        );
      })}
      {orimTrayDevMode && (
        <div className="w-full flex flex-col gap-2 mt-2">
          <div className="text-[10px] text-game-teal/80 font-mono tracking-[2px]">
            ORIM SEARCH
          </div>
          <input
            className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-game-white"
            placeholder="Search orim..."
            value={sandboxOrimSearch}
            onChange={(e) => onSandboxOrimSearchChange?.(e.target.value)}
          />
          <div className="max-h-32 overflow-y-auto border border-game-teal/20 rounded">
            {sandboxOrimResults.map((orim, index) => (
              <button
                key={`tray-${orim.id}-${index}`}
                type="button"
                className="w-full text-left text-[10px] font-mono px-2 py-1 border-b border-game-teal/10 hover:bg-game-bg-dark/60"
                onClick={() => onAddSandboxOrim?.(orim.id)}
              >
                {orim.name} ({orim.id})
              </button>
            ))}
            {sandboxOrimResults.length === 0 && (
              <div className="text-[10px] text-game-white/40 px-2 py-1">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
  const wildAnalysisButton = showWildAnalysis ? (
    <GameButton
      onClick={actions.playWildAnalysisSequence}
      color="gold"
      size="sm"
      className="px-3"
      disabled={!wildAnalysisReady}
      title={wildAnalysisReady
        ? `Max sequence: ${wildAnalysisCount}`
        : 'No sequence available'}
    >
      {wildAnalysisLabel}
    </GameButton>
  ) : null;
  const showRerollDealControl = !!biomeDef?.randomlyGenerated && !!actions.rerollRandomBiomeDeal && koiCoinEquipped;
  const handleRerollDeal = useCallback(() => {
    if (!actions.rerollRandomBiomeDeal || rerollRolling) return;
    const nextDie = createDie();
    setRerollRolling(true);
    setRerollDie({
      id: nextDie.id,
      value: nextDie.value,
      locked: false,
      rolling: true,
    });
    window.setTimeout(() => {
      actions.rerollRandomBiomeDeal?.();
      setRerollDie(createDie());
      setRerollRolling(false);
    }, 700);
  }, [actions, rerollRolling]);
  const rerollDealControl = showRerollDealControl ? (
    <button
      type="button"
      onClick={handleRerollDeal}
      disabled={rerollRolling || isEnemyTurn || introBlocking}
      className="flex items-center justify-center opacity-90 hover:opacity-100 disabled:opacity-50"
      title="Reroll deal"
    >
      <Die die={rerollDie} size={32} />
    </button>
  ) : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key !== '`') return;
      e.preventDefault();
      setSplatterModalOpen((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setCtrlHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setCtrlHeld(false);
      }
    };
    const handleBlur = () => setCtrlHeld(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const renderMatchLines = useCallback((mode: 'random' | 'traditional') => {
    const autoPathMode = false;
    if (!ctrlHeld && !autoPathMode) return null;
    if (!matchLineContainerRef.current) return null;
    const containerRect = matchLineContainerRef.current.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return null;

    const lines = [];
    for (let tIdx = 0; tIdx < gameState.tableaus.length; tIdx += 1) {
      const tableau = gameState.tableaus[tIdx];
      const card = tableau?.[tableau.length - 1];
      if (!card) continue;
      const tableauEl = tableauRefs.current[tIdx];
      if (!tableauEl) continue;
      const tRect = tableauEl.getBoundingClientRect();
      const x1 = tRect.left + tRect.width / 2 - containerRect.left;
      const y1 = tRect.top + tRect.height / 2 - containerRect.top;

      for (let fIdx = 0; fIdx < gameState.foundations.length; fIdx += 1) {
        const foundation = gameState.foundations[fIdx];
        const actor = activeParty[fIdx];
        const hasStamina = isActorCombatReady(actor);
        if (!hasStamina) continue;
        if (autoPathMode) continue;
        const top = foundation[foundation.length - 1];
        const canPlay = canPlayCardWithWild(card, top, gameState.activeEffects, foundation);
        if (!canPlay) continue;
        const foundationEl = foundationRefs.current[fIdx];
        if (!foundationEl) continue;
        const fRect = foundationEl.getBoundingClientRect();
        const x2 = fRect.left + fRect.width / 2 - containerRect.left;
        const y2 = fRect.top + fRect.height / 2 - containerRect.top;
        const actorColor = actor ? (ACTOR_LINE_COLORS[actor.definitionId] ?? '#7fdbca') : '#7fdbca';
        lines.push({ x1, y1, x2, y2, key: `${tIdx}-${fIdx}`, color: actorColor });
      }
    }

    if (lines.length === 0) return null;

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        width={containerRect.width}
        height={containerRect.height}
        style={{ zIndex: 40, filter: 'drop-shadow(0 0 6px rgba(127,219,202,0.5))' }}
      >
        {lines.map((line) => (
          <line
            key={line.key}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeOpacity={0.85}
          />
        ))}
      </svg>
    );
  }, [ctrlHeld, gameState.tableaus, gameState.foundations, gameState.activeEffects, activeParty, isEnemyTurn]);

  const splatterModal = (
    <SplatterPatternModal
      isOpen={splatterModalOpen}
      onClose={() => setSplatterModalOpen(false)}
    />
  );


  // Compute foundation blockers for light shadows (only in party-foundations with lighting enabled)
  useEffect(() => {
    if (!lightingEnabled || !true) {
      setFoundationBlockers([]);
      setContainerSize({ width: 0, height: 0 });
      return;
    }

    const computeBlockers = () => {
      const container = biomeContainerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      biomeContainerOriginRef.current = { left: containerRect.left, top: containerRect.top };

      // Update container size
      const newSize = {
        width: containerRect.width,
        height: containerRect.height,
      };
      setContainerSize(newSize);

      const rects: BlockingRect[] = [];

      // Add foundation blockers
      for (const el of foundationRefs.current) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        rects.push({
          x: r.left - containerRect.left,
          y: r.top - containerRect.top,
          width: r.width,
          height: r.height,
          castHeight: 8,  // strong shadow length
          softness: 8,    // strong shadow darkness
        });
      }

      // Add tableau blockers
      for (const el of tableauRefs.current) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        rects.push({
          x: r.left - containerRect.left,
          y: r.top - containerRect.top,
          width: r.width,
          height: r.height,
          castHeight: 6,  // medium shadow length
          softness: 6,    // medium softness
        });
      }

      setFoundationBlockers(rects);
    };

    // Defer to next frame to ensure ref is set
    let animId = requestAnimationFrame(computeBlockers);

    // Also set up ResizeObserver for future updates
    const observer = new ResizeObserver(computeBlockers);
    if (biomeContainerRef.current) observer.observe(biomeContainerRef.current);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, [lightingEnabled, true]);

  useEffect(() => {
    if (!foundationRowRef.current) return;
    const target = foundationRowRef.current;
    const update = () => {
      const rect = target.getBoundingClientRect();
      setFoundationRowWidth(rect.width);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, [gameState.foundations.length]);

  // Animate card play flashes - clean up expired ones
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      setCardPlayFlashes((prev) => {
        if (prev.length === 0) return prev; // nothing to prune — skip re-render
        const active = prev.filter((flash) => now - flash.startTime < flash.duration);
        return active.length === prev.length ? prev : active;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Function to trigger a flash when a card is played
  const triggerCardPlayFlash = (foundationIndex: number, comboAtPlay: number) => {
    const foundationEl = foundationRefs.current[foundationIndex];
    if (!foundationEl) return;

    const foundationRect = foundationEl.getBoundingClientRect();
    const containerRect = biomeContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const flashX = foundationRect.left - containerRect.left + foundationRect.width / 2;
    const flashY = foundationRect.top - containerRect.top + foundationRect.height / 2;

    const comboFactor = Math.min(MAX_COMBO_FLASH, Math.max(0, comboAtPlay));
    const comboT = comboFactor / MAX_COMBO_FLASH;
    const duration = 600 * (1 + comboT * 1.8);

    setCardPlayFlashes((prev) => [
      ...prev,
      {
        id: `flash-${performance.now()}-${foundationIndex}`,
        x: flashX,
        y: flashY,
        startTime: performance.now(),
        duration,
        combo: comboAtPlay,
      },
    ]);

    playCardPlaceSound({
      combo: comboAtPlay,
      lane: foundationIndex,
      laneCount: gameState.foundations.length,
    });
  };
  useEffect(() => {
    if (!keruFxToken) return;
    triggerCardPlayFlash(0, Math.max(6, partyComboTotal + 4));
  }, [keruFxToken, partyComboTotal]);

  const triggerIntroGoFlash = useCallback(() => {
    const containerRect = biomeContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setCardPlayFlashes((prev) => [
      ...prev,
      {
        id: `intro-go-${performance.now()}`,
        x: containerRect.width / 2,
        y: containerRect.height / 2,
        startTime: performance.now(),
        duration: 1900,
        combo: MAX_COMBO_FLASH,
      },
    ]);
  }, []);

  useEffect(() => {
    if (startOverlayPhase !== 'countdown') return;
    const timeoutId = window.setTimeout(() => {
      setStartCountdown((prev) => {
        if (prev <= 1) {
          setStartOverlayPhase('go');
          return 1;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearTimeout(timeoutId);
  }, [startOverlayPhase, startCountdown]);

  useEffect(() => {
    if (startOverlayPhase !== 'go') return;
    triggerIntroGoFlash();
    const timeoutId = window.setTimeout(() => {
      setStartOverlayPhase('done');
      if (startTriggeredByPlay && true && !zenModeEnabled && !isEnemyTurn) {
        setComboPaused(false);
      }
      setStartTriggeredByPlay(false);
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [isEnemyTurn, true, startOverlayPhase, startTriggeredByPlay, triggerIntroGoFlash, zenModeEnabled]);

  const handleStartMatch = useCallback(() => {
    if (startOverlayPhase !== 'ready') return;
    setStartTriggeredByPlay(true);
    setStartCountdown(3);
    setStartOverlayPhase('countdown');
  }, [startOverlayPhase]);
  const handleSkipIntro = useCallback(() => {
    setStartTriggeredByPlay(false);
    setStartOverlayPhase('done');
  }, []);

  // Watch for card plays via autoPlayNextMove by detecting foundation changes
  const prevFoundationsRef = useRef<typeof gameState.foundations | null>(null);
  useEffect(() => {
    if (lightingEnabled && true && prevFoundationsRef.current) {
      const prev = prevFoundationsRef.current;
      const current = gameState.foundations;

      // Detect which foundation gained a card
      for (let i = 0; i < current.length; i++) {
        const previousFoundation = prev[i];
        if (!previousFoundation) continue;
        if (current[i].length > previousFoundation.length) {
          const topCard = current[i][current[i].length - 1];
          if (topCard?.id?.startsWith('battle-hand-reward-')) {
            setRewardedBattleHandCards((cards) => cards.filter((card) => card.id !== topCard.id));
          }
          triggerCardPlayFlash(i, partyComboTotal);
        }
      }
    }
    prevFoundationsRef.current = gameState.foundations;
  }, [gameState.foundations, lightingEnabled, true, partyComboTotal]);

  // Extract baked paint marks from the WatercolorCanvas engine and convert to lights.
  // paintMarkCount comes from usePaintMarkCount() which subscribes to the global
  // notifyPaintMarkAdded() emitter — reactive even across component boundaries.
  useEffect(() => {
    if (!lightingEnabled || !paintLuminosityEnabled || !watercolorEngine || !biomeContainerRef.current) {
      setPaintLights([]);
      return;
    }

    const marks = watercolorEngine.getPaintMarks();
    const canvas = biomeContainerRef.current;

    // WatercolorCanvas uses its own pixel space (canvas width/height).
    // biomeContainerRef is the DOM overlay – get its size so we can map marks.
    const canvasState = watercolorEngine.getState();
    const wcWidth = canvasState.size.width;
    const wcHeight = canvasState.size.height;
    if (wcWidth <= 0 || wcHeight <= 0) return;

    const containerRect = canvas.getBoundingClientRect();
    const scaleX = containerRect.width / wcWidth;
    const scaleY = containerRect.height / wcHeight;

    // Spatially thin paint marks to a small representative set.
    // Sort by alpha (brightest first), then skip any mark that lands too close
    // to one already kept. Cap at MAX_PAINT_LIGHTS to bound per-frame canvas work.
    const MAX_PAINT_LIGHTS = 8;
    const MIN_SEP_PX = 70; // minimum separation in container pixels

    const sorted = marks.slice().sort((a, b) => b.alpha - a.alpha);
    const kept: typeof sorted = [];
    for (const mark of sorted) {
      if (kept.length >= MAX_PAINT_LIGHTS) break;
      const cx = mark.x * scaleX;
      const cy = mark.y * scaleY;
      const tooClose = kept.some((k) => {
        const dx = k.x * scaleX - cx;
        const dy = k.y * scaleY - cy;
        return dx * dx + dy * dy < MIN_SEP_PX * MIN_SEP_PX;
      });
      if (!tooClose) kept.push(mark);
    }

    const newPaintLights = kept.map((mark) => {
      // Map from WatercolorCanvas pixel space to ShadowCanvas pixel space
      const x = mark.x * scaleX;
      const y = mark.y * scaleY;

      // Glow radius extends comfortably beyond the splotch edge
      const radius = mark.radius * Math.max(scaleX, scaleY) * 2.5;

      // Paint lights are purely ambient — no shadow casting (castShadows: false below).
      // Intensity can be moderate since it only affects the glow punch-through, not shadows.
      const intensity = Math.min(0.9, mark.alpha * 1.2);

      return {
        x,
        y,
        radius,
        intensity,
        color: mark.color,
        castShadows: false,
        flicker: { enabled: false, speed: 0, amount: 0 },
      };
    });

    setPaintLights(newPaintLights);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightingEnabled, paintLuminosityEnabled, paintMarkCount, watercolorEngine]);

  const handleTableauTopCardRightClick = useCallback((card: CardType, tableauIndex: number) => {
    const tableau = gameState.tableaus[tableauIndex];
    if (!tableau || tableau.length === 0) return;
    const topCard = tableau[tableau.length - 1];
    if (!topCard || topCard.id !== card.id) return;
    setTableauRipTriggerByCardId((current) => ({
      ...current,
      [card.id]: (current[card.id] ?? 0) + 1,
    }));
  }, [gameState.tableaus]);

  useEffect(() => {
    const liveCardIds = new Set(gameState.tableaus.flat().map((card) => card.id));
    setTableauRipTriggerByCardId((current) => {
      const next: Record<string, number> = {};
      let changed = false;
      Object.entries(current).forEach(([id, token]) => {
        if (liveCardIds.has(id)) {
          next[id] = token;
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [gameState.tableaus]);

  // Random biome rendering
  if (biomeDef?.randomlyGenerated) {
    const handleTableauClick = (card: CardType, tableauIndex: number) => {
      if (introBlocking) return;
      if (isGamePaused) return;
      if (isEnemyTurn) return;
      if (gameState.interactionMode !== 'click') {
        actions.selectCard(card, tableauIndex);
        return;
      }
      if (!tableauCanPlay[tableauIndex] || noValidMoves) return;

      const validFoundations = gameState.foundations
        .map((foundation, idx) => {
          const actor = activeParty[idx];
          const hasStamina = isActorCombatReady(actor);
          const canPlay = hasStamina && canPlayCardWithWild(
            card,
            foundation[foundation.length - 1],
            gameState.activeEffects,
            foundation
          );
          return canPlay ? idx : -1;
        })
        .filter((idx) => idx !== -1);

      if (true) {
        if (armedFoundationIndex !== null) {
          if (!validFoundations.includes(armedFoundationIndex)) return;
          const played = actions.playCardInRandomBiome(tableauIndex, armedFoundationIndex);
          if (!played) return;
          triggerCardPlayFlash(armedFoundationIndex, partyComboTotal + 1);
          maybeGainSupplyFromValidMove();
          awardExplorationActionPoint();
          setArmedFoundationIndex(null);
          return;
        }
        if (validFoundations.length === 1) {
          const played = actions.playCardInRandomBiome(tableauIndex, validFoundations[0]);
          if (!played) return;
          triggerCardPlayFlash(validFoundations[0], partyComboTotal + 1);
          maybeGainSupplyFromValidMove();
          awardExplorationActionPoint();
        }
        return;
      }

      const foundationIndex = validFoundations[0] ?? -1;
      if (foundationIndex === -1) return;
      const played = actions.playCardInRandomBiome(tableauIndex, foundationIndex);
      if (!played) return;
      triggerCardPlayFlash(foundationIndex, partyComboTotal + 1);
      maybeGainSupplyFromValidMove();
      awardExplorationActionPoint();
    };
    const handleHandClick = (card: CardType) => {
      if (introBlocking) return;
      if (card.id === 'ability-rewind') {
        if (!noRegretStatus.canRewind) return;
        actions.rewindLastCard();
        return;
      }
      if (card.id.startsWith(CONTROLLED_DRAGONFIRE_CARD_ID_PREFIX)) {
        setInspectedRpgCardSource({ side: 'player' });
        setInspectedRpgCard(card);
        return;
      }
      if (isRpgMode && !(card.rank === WILD_SENTINEL_RANK)) {
        setInspectedRpgCardSource({ side: 'player' });
        setInspectedRpgCard(card);
        return;
      }
      if (isGamePaused) return;
      if (isEnemyTurn) return;
      if (gameState.interactionMode !== 'click') return;

      const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
        const actor = activeParty[idx];
        const hasStamina = isActorCombatReady(actor);
        return hasStamina && canPlayCardWithWild(
          card,
          foundation[foundation.length - 1],
          gameState.activeEffects,
          foundation
        );
      });

      if (foundationIndex === -1) return;
      const played = actions.playFromHand(card, foundationIndex, true);
      if (played && card.id.startsWith('battle-hand-reward-')) {
        setRewardedBattleHandCards((cards) => cards.filter((entry) => entry.id !== card.id));
      }
      if (played) {
        maybeGainSupplyFromValidMove();
        awardExplorationActionPoint();
      }
    };
    const handleStockClick = () => {
      if (introBlocking) return;
      if (isGamePaused) return;
      if (isEnemyTurn) return;
      if (gameState.interactionMode !== 'click') return;
      if (gameState.stock.length === 0) return;
      const stockCard = gameState.stock[gameState.stock.length - 1];

      const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
        const actor = activeParty[idx];
        const hasStamina = isActorCombatReady(actor);
        return hasStamina && canPlayCardWithWild(
          stockCard,
          foundation[foundation.length - 1],
          gameState.activeEffects,
          foundation
        );
      });

      const fallbackIndex = foundationIndex !== -1
        ? foundationIndex
        : Math.max(0, activeParty.findIndex((actor) => (actor?.stamina ?? 0) > 0));
      const played = actions.playFromStock(fallbackIndex, true, true);
      if (played) {
        maybeGainSupplyFromValidMove();
        awardExplorationActionPoint();
      }
    };
    return (
      <ComboTimerController
        partyComboTotal={partyComboTotalForTimer}
        paused={isGamePaused || introBlocking || comboPaused || !comboTimersEnabled}
        timeScale={timeScale}
        disabled={!comboTimersEnabled}
        bonusExtendMs={gameState.rpgComboTimerBonusMs}
        bonusExtendToken={gameState.rpgComboTimerBonusToken}
        secondaryBonusExtendMs={bankedTimerBonusMs}
        secondaryBonusExtendToken={bankedTimerBonusToken}
        onExpire={handleComboExpire}
      >
        {(combo) => {
          const timerRef = combo.timerRef;
          const playerRemainingMs = combo.remainingMs;
          const playerVisualMaxMs = combo.visualMaxMs;
          const showSharedTurnTimer = true && comboTimersEnabled;
          const foundationsMarginTopForLayout = foundationsStackMarginTop;
          const sharedTimerLabel = isEnemyTurn ? 'ENEMY TURN' : 'PLAYER TURN';
          const sharedTimerFillPercent = introBlocking
            ? '100%'
            : (isEnemyTurn ? enemyTurnFillPercent : '100%');
          return (
      <div
        ref={biomeContainerRef as any}
        className="relative w-full h-full flex flex-col items-center justify-center pointer-events-auto overflow-hidden"
        style={{
          gap: 'clamp(6px, 1.4vh, 20px)',
          paddingTop: 'clamp(6px, 1.2vh, 10px)',
          paddingBottom: 'clamp(6px, 1.2vh, 10px)',
          pointerEvents: introBlocking ? 'none' : 'auto',
        }}
      >
        {enemyMoveAnims.map((anim) => (
          <div
            key={anim.id}
            className="absolute pointer-events-none z-[10030]"
            style={{
              left: anim.from.x,
              top: anim.from.y,
              width: cardWidth,
              height: cardHeight,
              transform: 'translate(-50%, -50%)',
              animation: `enemy-move ${enemyMoveDurationMs}ms ease-in-out forwards`,
              animationPlayState: isGamePaused ? 'paused' : 'running',
              ['--delta-x' as string]: `${anim.to.x - anim.from.x}px`,
              ['--delta-y' as string]: `${anim.to.y - anim.from.y}px`,
            }}
          >
            {anim.card ? (
              <Card
                card={anim.card}
                size={{ width: cardWidth, height: cardHeight }}
                showGraphics={showGraphics}
                hideElements={isRpgMode}
                rpgSubtitleRarityOnly={isRpgMode}
              />
            ) : (
              <div
                className="w-full h-full rounded-lg border flex items-center justify-center text-lg font-bold"
                style={{
                  borderColor: 'rgba(230, 179, 30, 0.8)',
                  color: '#f7d24b',
                  backgroundColor: 'rgba(10, 10, 10, 0.9)',
                  boxShadow: '0 0 20px rgba(230, 179, 30, 0.5)',
                }}
              >
                {anim.label ?? (anim.rank === 1 ? 'A' : anim.rank === 11 ? 'J' : anim.rank === 12 ? 'Q' : anim.rank === 13 ? 'K' : anim.rank)}
              </div>
            )}
          </div>
        ))}
        {enemyRpgTelegraph && (
          <svg className="absolute inset-0 pointer-events-none z-[10028]">
            <line
              x1={enemyRpgTelegraph.from.x}
              y1={enemyRpgTelegraph.from.y}
              x2={enemyRpgTelegraph.to.x}
              y2={enemyRpgTelegraph.to.y}
              stroke="rgba(255, 158, 55, 0.95)"
              strokeWidth={3}
              strokeDasharray="10 8"
              strokeLinecap="round"
              className="animate-pulse"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255, 145, 30, 0.85))' }}
            />
            <circle
              cx={enemyRpgTelegraph.to.x}
              cy={enemyRpgTelegraph.to.y}
              r={14}
              fill="rgba(255, 158, 55, 0.18)"
              stroke="rgba(255, 158, 55, 0.95)"
              strokeWidth={2}
              className="animate-pulse"
            />
          </svg>
        )}
        {isEnemyTurn && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10020] pointer-events-none">
            <div
              className="px-4 py-2 rounded border text-[12px] tracking-[4px] font-bold"
              style={{
                color: '#f7d24b',
                borderColor: 'rgba(255, 229, 120, 0.9)',
                backgroundColor: 'rgba(10, 8, 6, 0.92)',
                boxShadow: '0 0 14px rgba(230, 179, 30, 0.65)',
                textShadow: '0 0 6px rgba(230, 179, 30, 0.65)',
              }}
            >
              ENEMY TURN
            </div>
          </div>
        )}
        {true && enemyFoundations.length > 0 && (
          <EnemyAiController
            active={isEnemyTurn}
            state={gameState}
            difficulty={gameState.enemyDifficulty ?? biomeDef?.enemyDifficulty ?? 'normal'}
            timedMode={comboTimersEnabled}
            paused={isGamePaused || introBlocking}
            timeScale={timeScale}
            speedFactor={enemyDragSpeedFactor}
            onTimerUpdate={(remainingMs) => {
              setEnemyTurnRemainingMs(remainingMs);
            }}
            onPlayMove={(tableauIndex, foundationIndex) => {
              return new Promise<boolean>((resolve) => {
                const card = gameState.tableaus[tableauIndex]?.[gameState.tableaus[tableauIndex].length - 1];
                if (!card) {
                  resolve(false);
                  return;
                }

                const containerRect = biomeContainerRef.current?.getBoundingClientRect();
                const tableauEl = tableauRefs.current[tableauIndex];
                const enemyEl = enemyFoundationRefs.current[foundationIndex];
                const animationId = `enemy-move-${performance.now()}`;

                if (containerRect && tableauEl && enemyEl) {
                  const tRect = tableauEl.getBoundingClientRect();
                  const eRect = enemyEl.getBoundingClientRect();
                  const from = {
                    x: tRect.left - containerRect.left + tRect.width / 2,
                    y: tRect.top - containerRect.top + tRect.height / 2,
                  };
                  const to = {
                    x: eRect.left - containerRect.left + eRect.width / 2,
                    y: eRect.top - containerRect.top + eRect.height / 2,
                  };
                  setEnemyMoveAnims((prev) => [...prev, {
                    id: animationId,
                    from,
                    to,
                    tableauIndex,
                    source: 'tableau',
                    card,
                    rank: card.rank,
                    suit: card.suit,
                  }]);
                }

                let elapsedMs = 0;
                let lastFrameMs = performance.now();

                const finishMove = () => {
                  setEnemyMoveAnims((prev) => prev.filter((anim) => anim.id !== animationId));
                  registerEnemyReveal(foundationIndex, card.rank);
                  const applied = actions.playEnemyCardInRandomBiome?.(tableauIndex, foundationIndex) ?? false;
                  resolve(applied);
                };

                const tick = (nowMs: number) => {
                  if (isGamePausedRef.current) {
                    lastFrameMs = nowMs;
                    window.requestAnimationFrame(tick);
                    return;
                  }
                  elapsedMs += nowMs - lastFrameMs;
                  lastFrameMs = nowMs;
                  if (elapsedMs >= enemyMoveDurationMs) {
                    finishMove();
                    return;
                  }
                  window.requestAnimationFrame(tick);
                };

                window.requestAnimationFrame(tick);
              });
            }}
            onPlayRpgAttack={() => {
              return new Promise<boolean>((resolve) => {
                const attackers = enemyActors
                  .map((enemyActor, enemyActorIndex) => {
                    const hand = enemyRpgHandCards[enemyActorIndex] ?? [];
                    const damageCards = hand.filter((card) => (
                      card.id.startsWith('rpg-dark-claw-')
                      || card.id.startsWith('rpg-scratch-')
                      || card.id.startsWith('rpg-bite-')
                      || card.id.startsWith('rpg-vice-bite-')
                      || card.id.startsWith('rpg-peck-')
                      || card.id.startsWith('rpg-blinding-peck-')
                    ));
                    if (!enemyActor || (enemyActor.hp ?? 0) <= 0 || damageCards.length === 0) return null;
                    return { enemyActorIndex, damageCards };
                  })
                  .filter((entry): entry is { enemyActorIndex: number; damageCards: CardType[] } => !!entry);
                const liveTargets = activeParty
                  .map((actor, targetActorIndex) => ({ actor, targetActorIndex }))
                  .filter((entry) => !!entry.actor && (entry.actor.hp ?? 0) > 0);
                if (attackers.length === 0 || liveTargets.length === 0) {
                  resolve(false);
                  return;
                }

                const attacker = attackers[Math.floor(Math.random() * attackers.length)];
                const card = attacker.damageCards[Math.floor(Math.random() * attacker.damageCards.length)];
                const target = liveTargets[Math.floor(Math.random() * liveTargets.length)];
                const containerRect = biomeContainerRef.current?.getBoundingClientRect();
                const enemyEl = enemyFoundationRefs.current[attacker.enemyActorIndex];
                const playerEl = foundationRefs.current[target.targetActorIndex];
                if (!containerRect || !enemyEl || !playerEl) {
                  const applied = actions.playEnemyRpgHandCardOnActor?.(
                    attacker.enemyActorIndex,
                    card.id,
                    target.targetActorIndex
                  ) ?? false;
                  resolve(applied);
                  return;
                }

                const enemyRect = enemyEl.getBoundingClientRect();
                const playerRect = playerEl.getBoundingClientRect();
                const from = {
                  x: enemyRect.left - containerRect.left + enemyRect.width / 2,
                  y: enemyRect.top - containerRect.top + enemyRect.height / 2,
                };
                const to = {
                  x: playerRect.left - containerRect.left + playerRect.width / 2,
                  y: playerRect.top - containerRect.top + playerRect.height / 2,
                };
                const animationId = `enemy-rpg-${performance.now()}`;
                const telegraphMs = Math.max(220, Math.round(enemyMoveDurationMs * 0.55));

                const waitWithPause = (durationMs: number, onDone: () => void) => {
                  let elapsedMs = 0;
                  let lastFrameMs = performance.now();
                  const tickFrame = (nowMs: number) => {
                    if (isGamePausedRef.current) {
                      lastFrameMs = nowMs;
                      window.requestAnimationFrame(tickFrame);
                      return;
                    }
                    elapsedMs += nowMs - lastFrameMs;
                    lastFrameMs = nowMs;
                    if (elapsedMs >= durationMs) {
                      onDone();
                      return;
                    }
                    window.requestAnimationFrame(tickFrame);
                  };
                  window.requestAnimationFrame(tickFrame);
                };

                setEnemyRpgTelegraph({
                  id: animationId,
                  from,
                  to,
                  enemyActorIndex: attacker.enemyActorIndex,
                  targetActorIndex: target.targetActorIndex,
                  label: card.id.startsWith('rpg-dark-claw-') ? 'DARK CLAW' : 'RPG',
                });

                waitWithPause(telegraphMs, () => {
                  setEnemyRpgTelegraph((prev) => (prev?.id === animationId ? null : prev));
                  setEnemyMoveAnims((prev) => [...prev, {
                    id: animationId,
                    from,
                    to,
                    source: 'rpg',
                    card,
                    rank: card.rank ?? 1,
                    suit: card.suit,
                    label: card.id.startsWith('rpg-dark-claw-') ? 'DARK CLAW' : 'RPG',
                  }]);
                  waitWithPause(enemyMoveDurationMs, () => {
                    setEnemyMoveAnims((prev) => prev.filter((anim) => anim.id !== animationId));
                    const applied = actions.playEnemyRpgHandCardOnActor?.(
                      attacker.enemyActorIndex,
                      card.id,
                      target.targetActorIndex
                    ) ?? false;
                    resolve(applied);
                  });
                });
              });
            }}
            onEndTurn={(result) => {
              if (result?.reason === 'no_actions' && (result.remainingMs ?? 0) > 0) {
                const calloutId = Date.now() + Math.random();
                setEnemyTurnEndCallouts((prev) => [...prev, { id: calloutId }]);
                window.setTimeout(() => {
                  setEnemyTurnEndCallouts((prev) => prev.filter((entry) => entry.id !== calloutId));
                }, 1700);
              }
              (actions.advanceRandomBiomeTurn ?? actions.endRandomBiomeTurn)();
            }}
          />
        )}
        {/* Light shadow overlay – shows drag light while dragging, normal lights otherwise */}
        {lightingEnabled && containerSize.width > 0 && (
          dragState.isDragging ? (
            <DragLightOverlay
              active={dragState.isDragging}
              dragPositionRef={dragPositionRef}
              fallbackPositionRef={dragBasePositionRef}
              effectiveGlobalCardScale={effectiveGlobalCardScale}
              containerSize={containerSize}
              containerRef={biomeContainerRef}
              anchorRef={biomeContainerRef}
              biomeOriginRef={biomeContainerOriginRef}
              foundationRefs={foundationRefs}
              isDraggingKeruRewardCard={isDraggingKeruRewardCard}
              ambientDarkness={dynamicAmbientDarkness}
            />
          ) : (() => {
            const lightX = containerSize.width / 2;
            const lightY = containerSize.height * 0.05;
            const lightRadius = Math.max(containerSize.width, containerSize.height) * 1.2;
            // Normal state: flash lights + ambient paint lights
            const now = performance.now();
            const flashLights = cardPlayFlashes.map((flash) => {
              const elapsed = now - flash.startTime;
              const progress = Math.min(1, elapsed / flash.duration);
              const comboBoost = COMBO_FLASH_SCALING_ENABLED
                ? Math.min(MAX_COMBO_FLASH, Math.max(0, flash.combo ?? 0))
                : 0;
              const comboT = comboBoost / MAX_COMBO_FLASH;
              // Ease-out curve with longer linger as combo grows (bullet-time feel).
              const easePower = 2 + comboT * 2.5;
              const easeOutProgress = 1 - Math.pow(1 - progress, easePower);
              const intensity = Math.max(0, 1 - easeOutProgress);
              const radiusScale = 1 + comboT * 1.2;
              const intensityScale = 1 + comboT * 0.9;
              return {
                x: flash.x,
                y: flash.y,
                radius: 200 * (1 + progress * 1.5) * radiusScale,
                intensity: intensity * intensityScale,
                color: '#ffffff',
                castShadows: false,
                flicker: { enabled: false, speed: 0, amount: 0 },
              };
            });
            const allLights = [...flashLights, ...paintLights];

            return (
              <ShadowCanvas
                containerRef={biomeContainerRef}
                anchorRef={biomeContainerRef}
                useCameraTransform={false}
                lightX={lightX}
                lightY={lightY}
                lightRadius={lightRadius}
                lightIntensity={0}
                lightColor="#ffffff"
                ambientDarkness={dynamicAmbientDarkness}
                flickerSpeed={0}
                flickerAmount={0}
                blockers={foundationBlockers}
                actorGlows={[]}
                actorLights={allLights}
                worldWidth={containerSize.width}
                worldHeight={containerSize.height}
                tileSize={100}
                width={containerSize.width}
                height={containerSize.height}
              />
            );
          })()
        )}
        <div
          className="relative w-full h-full flex flex-col items-center justify-center pointer-events-auto"
          style={{ gap: battleSectionGap }}
        >
          <div
            className="relative w-full flex flex-col items-center justify-center pointer-events-auto"
            style={{ gap: battleSectionGap }}
            data-biome-ui
            ref={matchLineContainerRef}
          >
        {renderMatchLines('random')}

        {/* Enemy Foundations + Tableaus */}
          <div className="relative z-30 flex flex-col items-center">
          {true && (
            <div className="relative w-full flex justify-center" style={{ marginBottom: 12, marginTop: -20 }}>
              <div className="flex items-center justify-center" style={{ gap: `${enemyFoundationGapPx}px` }}>
                {enemyFoundationsForDisplay.map((cards, idx) => {
                  const enemyActor = enemyActorsForDisplay[idx];
                  const enemyTopRpgCard = enemyRpgHandCards[idx]?.[Math.max(0, (enemyRpgHandCards[idx]?.length ?? 1) - 1)] ?? null;
                  const enemyHandCount = enemyRpgHandCards[idx]?.length ?? 0;
                  const enemyCombatReady = !enemyActor || (enemyActor.hp ?? 0) > 0;
                  const enemyName = enemyActor
                    ? (getActorDefinition(enemyActor.definitionId)?.name ?? enemyActor.definitionId)
                    : '';
                  const showEnemyName = !!enemyActor || cards.length > 0;
                  return (
                  <div
                    key={`enemy-foundation-${idx}`}
                    className="relative flex flex-col items-center"
                    data-rpg-actor-target="true"
                    data-rpg-actor-side="enemy"
                    data-rpg-actor-index={idx}
                    ref={(el) => {
                      setFoundationRef(gameState.foundations.length + idx, el);
                    }}
                  >
                    {isRpgMode && enemyHandCount > 0 && (
                      <div
                        className="absolute flex items-start justify-center"
                        style={{
                          right: '100%',
                          top: Math.max(18, Math.round(cardHeight * 0.12)),
                        }}
                        title={`Enemy hand: ${enemyName}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveEnemyHandActorIndex((current) => (current === idx ? null : idx));
                            setInspectedRpgCard(null);
                            setInspectedRpgCardSource(null);
                          }}
                          className="relative cursor-pointer"
                          aria-label={`Inspect ${enemyName} hand`}
                        >
                          <Card
                            card={enemyTopRpgCard}
                            size={{
                              width: Math.max(28, Math.round(cardWidth * 0.425)),
                              height: Math.max(38, Math.round(cardHeight * 0.425)),
                            }}
                            showGraphics={showGraphics}
                            hideElements
                            rpgSubtitleRarityOnly
                          />
                          <div
                            className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border text-[10px] font-bold flex items-center justify-center"
                            style={{
                              minWidth: 22,
                              height: 22,
                              padding: '0 4px',
                              color: '#0a0a0a',
                              borderColor: '#ff4d4d',
                              backgroundColor: '#ff4d4d',
                              boxShadow: '0 0 10px rgba(255, 77, 77, 0.55)',
                            }}
                          >
                            {enemyHandCount}
                          </div>
                        </button>
                      </div>
                    )}
                    {showEnemyName && (
                      <div
                        className="mb-1 text-[10px] font-bold tracking-[2px] uppercase"
                        style={{
                          color: '#e2e8f0',
                          textShadow: '0 0 8px rgba(255,255,255,0.35)',
                        }}
                      >
                        {enemyName}
                      </div>
                    )}
                    <Foundation
                      cards={cards}
                      index={idx}
                      onFoundationClick={() => {}}
                      canReceive={false}
                      interactionMode={gameState.interactionMode}
                      showGraphics={showGraphics}
                      isDimmed={!enemyCombatReady}
                      isDragTarget={false}
                      showCompleteSticker={false}
                      countPosition="none"
                      maskValue={isGamePaused}
                      revealValue={isGamePaused ? null : (enemyRevealMap[idx] ?? null)}
                      hideElements={isRpgMode}
                      hpOverlay={renderHpLabel(enemyActor, 'enemy', idx)}
                      hpOverlayPlacement="bottom"
                      hpOverlayOffsetPx={6}
                      setDropRef={(foundationIndex, ref) => {
                        enemyFoundationRefs.current[foundationIndex] = ref;
                      }}
                    />
                    {renderStatusBadges(enemyActor, 'enemy')}
                    {((gameState.enemyFoundationCombos || [])[idx] ?? 0) > 0 && (
                      <div
                        className="mt-1 px-2 py-0.5 rounded border text-[10px] font-bold tracking-[2px]"
                        style={{
                          color: '#f7d24b',
                          borderColor: 'rgba(255, 229, 120, 0.9)',
                          backgroundColor: 'rgba(10, 8, 6, 0.92)',
                          boxShadow: '0 0 10px rgba(230, 179, 30, 0.5)',
                        }}
                      >
                        COMBO {((gameState.enemyFoundationCombos || [])[idx] ?? 0)}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              {(!isRpgMode || hasSpawnedEnemies) && (
                <button
                  type="button"
                  onClick={() => actions.setEnemyDifficulty?.(nextEnemyDifficulty(enemyDifficulty))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center px-3 py-2 rounded border text-[10px] tracking-[3px] font-bold"
                  style={{
                    borderColor: 'rgba(127, 219, 202, 0.6)',
                    color: '#7fdbca',
                    backgroundColor: 'rgba(10, 10, 10, 0.6)',
                    boxShadow: '0 0 10px rgba(127, 219, 202, 0.25)',
                  }}
                  title="Toggle enemy difficulty"
                >
                  <span>{(difficultyLabels[enemyDifficulty] ?? 'NORMAL').slice(0, 1)}</span>
                </button>
              )}
            </div>
          )}
          {showSharedTurnTimer && (
            <TurnTimerRail
              label={sharedTimerLabel}
              fillPercent={sharedTimerFillPercent}
              timerRef={!isEnemyTurn && !introBlocking ? timerRef : undefined}
              totalMs={isEnemyTurn ? ENEMY_TURN_TIME_BUDGET_MS : playerVisualMaxMs}
              remainingMsOverride={!isEnemyTurn && !introBlocking ? playerRemainingMs : undefined}
              showSkipButton={!isEnemyTurn && canTriggerEndTurnFromCombo}
              onSkip={!isEnemyTurn && canTriggerEndTurnFromCombo ? handleSkipWithBank : undefined}
              showPauseButton={showPauseButton}
              onTogglePause={onTogglePause}
              isGamePaused={isGamePaused}
              paused={comboPaused}
              onClick={!isEnemyTurn ? handlePartyComboCounterEndTurn : undefined}
              role={!isEnemyTurn && canTriggerEndTurnFromCombo ? 'button' : undefined}
              tabIndex={!isEnemyTurn && canTriggerEndTurnFromCombo ? 0 : undefined}
              onKeyDown={(event) => {
                if (isEnemyTurn || !canTriggerEndTurnFromCombo) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handlePartyComboCounterEndTurn();
                }
              }}
              cursor={!isEnemyTurn && canTriggerEndTurnFromCombo ? 'pointer' : 'default'}
            />
          )}
          <ExplorationEncounterPanel
            narrativeOpen={narrativeOpen}
            isRpgMode={isRpgMode}
            hasSpawnedEnemies={hasSpawnedEnemies}
            narrationTone={narrationTone}
            activePoiNarration={activePoiNarration}
            onCloseNarrative={() => setNarrativeOpen(false)}
            explorationMapFrameWidth={explorationMapFrameWidth}
            mapVisible={mapVisible}
            hasUnclearedVisibleTableaus={hasUnclearedVisibleTableaus}
            explorationMapWidth={explorationMapWidth}
            explorationMapHeight={explorationMapHeight}
            explorationHeading={explorationHeading}
            explorationMapAlignment={explorationMapAlignment}
            explorationCurrentNodeId={explorationCurrentNodeId}
            explorationTrailNodeIds={explorationTrailNodeIds}
            explorationNodes={explorationNodes}
            explorationEdges={explorationEdges}
            explorationPoiMarkers={explorationPoiMarkers}
            explorationBlockedCells={explorationBlockedCells}
            explorationBlockedEdges={explorationBlockedEdges}
            explorationConditionalEdges={explorationConditionalEdges}
            explorationActiveBlockedEdge={explorationActiveBlockedEdge}
            explorationTableauWall={explorationTableauWall}
            worldForcedPath={worldForcedPath}
            explorationForcedPathNextIndex={explorationForcedPathNextIndex}
            explorationCurrentLocationTitle={explorationCurrentLocationTitle}
            availableExplorationActionPoints={availableExplorationActionPoints}
            explorationSupplies={explorationSupplies}
            onExplorationUseSupply={handleExplorationUseSupply}
            explorationAppliedTraversalCount={explorationAppliedTraversalCount}
            travelRowsPerStep={travelRowsPerStep}
            onStepCostDecrease={() => setExplorationRowsPerStep((current) => Math.max(1, current - 1))}
            onStepCostIncrease={() => setExplorationRowsPerStep((current) => Math.min(12, current + 1))}
            stepExplorationOnPlay={stepExplorationOnPlay}
            canAdvanceExplorationHeading={canAdvanceExplorationHeading}
            devTraverseHoldEnabled={devTraverseHoldEnabled}
            handleExplorationStepBackward={handleExplorationStepBackward}
            pathingLocked={pathingLocked}
            onTogglePathingLocked={() => setPathingLocked((prev) => !prev)}
            handleExplorationHeadingChange={handleExplorationHeadingChange}
            teleportToExplorationNode={teleportToExplorationNode}
            lightingEnabled={lightingEnabled}
            onMapAlignmentToggle={toggleExplorationMapAlignment}
            isExplorationMode={isExplorationMode}
            handleToggleMap={handleToggleMap}
            onRotateLeft={() => handleExplorationHeadingStep(false)}
            onRotateRight={() => handleExplorationHeadingStep(true)}
            forcedPerspectiveEnabled={forcedPerspectiveEnabled}
            gameState={gameState}
            selectedCard={selectedCard}
            handleTableauClick={handleTableauClick}
            handleTableauTopCardRightClick={handleTableauTopCardRightClick}
            showGraphics={showGraphics}
            tableauCardScale={tableauCardScale}
            handleDragStartGuarded={handleDragStartGuarded}
            dragState={dragState}
            cloudSightActive={cloudSightActive}
            tableauCanPlay={tableauCanPlay}
            noValidMoves={noValidMoves}
            explorationTableauRowHeightPx={explorationTableauRowHeightPx}
            tableauSlideOffsetPx={tableauSlideOffsetPx}
            tableauSlideAnimating={tableauSlideAnimating}
            explorationSlideAnimationMs={EXPLORATION_SLIDE_ANIMATION_MS}
            tableauRefs={tableauRefs}
            sunkCostTableauPulseStyle={sunkCostTableauPulseStyle}
            revealAllCardsForIntro={revealAllCardsForIntro}
            enemyDraggingTableauIndexes={enemyDraggingTableauIndexes}
            hiddenPlayerTableaus={hiddenPlayerTableaus}
            maskAllPlayerTableauValues={maskAllPlayerTableauValues}
            getDisplayedStepIndexForColumn={getDisplayedStepIndexForColumn}
            getDebugStepLabelForColumn={getDebugStepLabelForColumn}
            ripTriggerByCardId={tableauRipTriggerByCardId}
          />
            {!isRpgMode && comboExpiryTokens.length > 0 && (
              <div className="relative flex items-center justify-center gap-2" style={{ marginTop: 2, marginBottom: 2 }}>
                {comboExpiryTokens.map((token) => (
                  <div
                    key={token.id}
                    className="px-2 py-1 rounded-full border text-[10px] font-bold tracking-[2px]"
                    style={{
                      color: '#0a0a0a',
                      borderColor: 'rgba(255, 229, 120, 0.9)',
                      backgroundColor: 'rgba(230, 179, 30, 0.95)',
                      boxShadow: '0 0 10px rgba(230, 179, 30, 0.6)',
                    }}
                  >
                    {token.value}
                  </div>
                ))}
              </div>
            )}

        {/* Foundations + End Turn button */}
        <div className="relative z-20 flex flex-col items-center gap-3 w-full" style={{ marginTop: foundationsMarginTopForLayout }}>
          <div className="relative w-full flex justify-center items-center">
            {true && (
              <div className="relative w-full flex items-center justify-center min-h-[148px]">
                <div
                  ref={foundationRowRef}
                  className={`flex items-center justify-center ${forcedPerspectiveEnabled ? 'perspective-foundation-container' : ''}`}
                  style={{ gap: `${foundationGapPx}px` }}
                >
                  <div className={`flex items-center justify-center ${forcedPerspectiveEnabled ? 'perspective-foundation-content' : ''}`} style={{ gap: `${foundationGapPx}px` }}>
                    {gameState.foundations.map((foundation, idx) => {
                    const isWild = foundation.length === 1 && foundation[0].rank === WILD_SENTINEL_RANK;
                    const showGoldHighlight = !!(selectedCard && validFoundationsForSelected[idx]);
                    const actor = false
                      ? ((idx === 0 && !foundationHasActor) ? null : activeParty[idx])
                      : activeParty[idx];
                    const hasStamina = isActorCombatReady(actor);
                    const canReceiveDrag =
                      dragState.isDragging &&
                      dragState.card &&
                      canPlayCardWithWild(
                        dragState.card,
                        foundation[foundation.length - 1],
                        gameState.activeEffects,
                        foundation
                      ) &&
                      hasStamina;

                    return (
                      <div
                        key={idx}
                        className="relative flex flex-col items-center"
                        data-rpg-actor-target="true"
                        data-rpg-actor-side="player"
                        data-rpg-actor-index={idx}
                        ref={(el) => {
                          foundationRefs.current[idx] = el;
                          setFoundationRef(idx, el);
                        }}
                      >
                        {renderStatusBadges(actor, 'player')}
                        <FoundationActor
                          cards={foundation}
                          index={idx}
                          onFoundationClick={(foundationIndex) => {
                            if (isGamePaused) return;
                            if (handlePlayerFoundationClickInBiome(foundationIndex)) return;
                            if (true) {
                              setArmedFoundationIndex((prev) => (prev === foundationIndex ? null : foundationIndex));
                              return;
                            }
                        if (selectedCard) {
                          const played = actions.playCardInRandomBiome(
                            selectedCard.tableauIndex,
                            foundationIndex
                          );
                          if (played) {
                            signalValidMove();
                            maybeGainSupplyFromValidMove();
                            awardExplorationActionPoint();
                            setSelectedCard(null);
                          }
                        }
                          }}
                          canReceive={showGoldHighlight && hasStamina}
                          isGuidanceTarget={true && armedFoundationIndex === idx}
                          isDimmed={!hasStamina}
                          interactionMode={gameState.interactionMode}
                          isDragTarget={!!canReceiveDrag}
                          actor={actor}
                          showGraphics={showGraphics}
                          actorDeck={actor ? gameState.actorDecks[actor.id] : undefined}
                          orimInstances={foundationOrimInstances}
                          orimDefinitions={foundationOrimDefinitions}
                          isPartied
                          showCompleteSticker={false}
                          cardScale={foundationCardScale}
                          tooltipDisabled={tooltipSuppressed}
                          showTokenEdgeOverlay={false}
                          maskValue={maskPlayerFoundationValues}
                          splashDirectionDeg={
                            foundationSplashHint && foundationSplashHint.foundationIndex === idx
                              ? foundationSplashHint.directionDeg
                              : undefined
                          }
                          splashDirectionToken={
                            foundationSplashHint && foundationSplashHint.foundationIndex === idx
                              ? foundationSplashHint.token
                              : undefined
                          }
                          disableFoundationSplashes
                          comboCount={showActorComboCounts && actor ? (true
                            ? (actorComboCounts[actor.id] ?? 0)
                            : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                          hideElements={isRpgMode}
                          hpOverlay={renderHpLabel(actor, 'player', idx)}
                          hpOverlayPlacement="top"
                          hpOverlayOffsetPx={6}
                          onActorLongPress={({ actor: pressedActor }) => handleActorFoundationLongPress(pressedActor)}
                        />
                        {idx === 0 && keruFxActive && isKeruRewardOverTarget && (
                          <div
                            key={`keru-fx-${keruFxToken}`}
                            className="absolute inset-0 pointer-events-none rounded-xl"
                            style={{
                              animation: 'keru-foundation-flash 780ms ease-out forwards',
                            }}
                          >
                            <div
                              className="absolute inset-[-26px] rounded-2xl"
                              style={{
                                background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(127,219,202,0.78) 24%, rgba(127,219,202,0.3) 56%, rgba(127,219,202,0) 78%)',
                                mixBlendMode: 'screen',
                                animation: 'keru-foundation-shimmer 1s ease-out forwards',
                              }}
                            />
                            <div
                              className="absolute inset-[-30px] rounded-2xl"
                              style={{
                                backgroundImage: `
                                  radial-gradient(circle at 14% 30%, rgba(127,219,202,0.9) 0 1px, transparent 1.6px),
                                  radial-gradient(circle at 38% 18%, rgba(247,210,75,0.8) 0 1px, transparent 1.7px),
                                  radial-gradient(circle at 68% 72%, rgba(127,219,202,0.9) 0 1px, transparent 1.5px),
                                  radial-gradient(circle at 86% 44%, rgba(247,210,75,0.75) 0 1px, transparent 1.8px)
                                `,
                                opacity: 0.95,
                                animation: 'keru-foundation-sparkles 1s ease-out forwards',
                              }}
                            />
                          </div>
                        )}
                        {idx === 0 && (keruFxActive || keruAttributeCallouts.length > 0) && (
                          <div
                            className="absolute bottom-0 pointer-events-none"
                            style={{
                              left: '100%',
                              transform: 'translate(10px, 10px)',
                              zIndex: 9990,
                            }}
                          >
                            <Callout
                              visible
                              instanceKey={`keru-aspect-${keruFxToken}`}
                              text={keruCalloutText}
                              tone="gold"
                              autoFadeMs={KERU_CALLOUT_DURATION_MS}
                              secondaryCallouts={keruAttributeCallouts.map((entry) => ({
                                text: entry.text,
                                compact: true,
                                tone: 'teal',
                              }))}
                            />
                          </div>
                        )}
                        {idx === 0 && isKeruRewardOverTarget && <TargetSwirlIndicator />}
                        {renderExplorationActorHandPreview(actor, idx)}
                        {renderActorNameLabel(actor)}
                        {isWild && (
                          <div
                            className="text-[10px] tracking-wider font-bold mt-1"
                            style={{ color: '#e6b31e' }}
                          >
                            WILD
                          </div>
                        )}
                        {(() => {
                          if (!SHOW_FOUNDATION_TOKEN_BADGES) return null;
                          const tokenCounts = (gameState.foundationTokens || [])[idx] || emptyTokens;
                          const tokenList = TOKEN_ORDER.flatMap((element) =>
                            Array.from({ length: tokenCounts[element] || 0 }, () => element)
                          );
                          if (tokenList.length === 0) return null;
                          const tokenSize = Math.max(20, Math.round(cardWidth * 0.32));
                          return (
                            <div className="mt-2 grid grid-cols-3 gap-1 justify-items-center">
                              {tokenList.map((element, tokenIndex) => {
                                const suit = ELEMENT_TO_SUIT[element];
                                const color = SUIT_COLORS[suit];
                                const display = getSuitDisplay(suit, showGraphics);
                                return (
                                  <div
                                    key={`${element}-${tokenIndex}`}
                                    className="rounded-full flex items-center justify-center text-[10px] font-bold"
                                    style={{
                                      width: tokenSize,
                                      height: tokenSize,
                                      borderWidth: 1,
                                      borderStyle: 'solid',
                                      borderColor: color,
                                      backgroundColor: color,
                                      color: '#0a0a0a',
                                      boxShadow: `0 0 0 1px #ffffff, inset 0 0 0 1px #ffffff`,
                                    }}
                                    data-token-face
                                  >
                                    <span
                                      style={{
                                        WebkitTextStroke: '0.3px #ffffff',
                                        textShadow: '0 0 1px rgba(255, 255, 255, 0.5)',
                                      }}
                                    >
                                      {display}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        {!true && (
                          <FoundationTokenGrid
                            tokens={(gameState.foundationTokens || [])[idx] || emptyTokens}
                            comboCount={showActorComboCounts && actor ? (true
                              ? (actorComboCounts[actor.id] ?? 0)
                              : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {wildAnalysisButton && (
                  <div className="absolute" style={leftFoundationAccessoryStyle}>
                    <div className="flex flex-col items-center gap-2">
                      {wildAnalysisButton}
                      {rerollDealControl}
                    </div>
                  </div>
                )}
                <div
                  className="absolute flex flex-col items-center justify-center gap-2 pointer-events-auto z-[100]"
                  style={rightFoundationAccessoryStyle}
                >
                  <div className="flex items-center gap-2">
                    {!isRpgMode && (
                      <GameButton
                        onClick={() => {
                          setComboPaused(true);
                          (actions.advanceRandomBiomeTurn ?? actions.endRandomBiomeTurn)();
                        }}
                        color="gold"
                        size="sm"
                        disabled={isEnemyTurn}
                        className="shadow-neon-gold"
                        style={{
                          borderColor: 'rgba(255, 229, 120, 0.9)',
                          boxShadow: '0 0 12px rgba(230, 179, 30, 0.65)',
                          backgroundColor: 'rgba(10, 8, 6, 0.92)',
                          color: '#f7d24b',
                          textShadow: '0 0 6px rgba(230, 179, 30, 0.65)',
                        }}
                      >
                        {isEnemyTurn ? 'READY' : 'END TURN'}
                      </GameButton>
                    )}
                  </div>
                </div>
              </div>
              </div>
            )}
            {!true && <div className="w-20" aria-hidden="true" />}
            {!true && null}
            {false && true && isRpgMode && !hasSpawnedEnemies && (
              <div
                className="absolute pointer-events-auto z-[100]"
                style={rightFoundationAccessoryStyle}
              >
                <button
                  type="button"
                  onClick={handleTraversalButtonClick}
                  onPointerDown={handleTraversalButtonPointerDown}
                  onPointerUp={handleTraversalButtonPointerUp}
                  onPointerLeave={handleTraversalButtonPointerUp}
                  onPointerCancel={handleTraversalButtonPointerUp}
                  disabled={!canStepForwardInExploration && !devTraverseHoldEnabled}
                  className="relative rounded border font-bold leading-none shadow-neon-gold disabled:opacity-40"
                  style={{
                    width: 48,
                    height: 48,
                    fontSize: 24,
                    borderColor: 'rgba(255, 229, 120, 0.9)',
                    boxShadow: '0 0 12px rgba(230, 179, 30, 0.65)',
                    backgroundColor: 'rgba(10, 8, 6, 0.92)',
                    color: '#f7d24b',
                    textShadow: '0 0 6px rgba(230, 179, 30, 0.65)',
                  }}
                  title={canStepForwardInExploration
                      ? 'Step forward'
                      : (devTraverseHoldEnabled
                        ? 'Dev hold: force-clear and step forward'
                      : `Need ${travelRowsPerStep} AP to step (${availableExplorationActionPoints} available)`)}
                  aria-label="Step forward"
                >
                  {devTraverseHoldEnabled && devTraverseHoldProgress > 0 && (
                    <>
                      <div
                        className="absolute -top-5 left-1/2 -translate-x-1/2 pointer-events-none rounded border px-2 py-[2px] text-[10px] font-bold tracking-[1px]"
                        style={{
                          borderColor: 'rgba(247, 210, 75, 0.8)',
                          backgroundColor: 'rgba(10, 8, 6, 0.9)',
                          color: '#f7d24b',
                          boxShadow: '0 0 10px rgba(230, 179, 30, 0.45)',
                          zIndex: 140,
                        }}
                      >
                        HOLD {Math.round(devTraverseHoldProgress * 100)}%
                      </div>
                      <div
                        className="absolute inset-0 rounded pointer-events-none overflow-hidden"
                        style={{
                          zIndex: 130,
                          border: '1px solid rgba(247, 210, 75, 0.72)',
                          boxShadow: '0 0 14px rgba(230, 179, 30, 0.4)',
                        }}
                      >
                        <div
                          className="absolute bottom-0 left-0 right-0"
                          style={{
                            height: `${Math.round(devTraverseHoldProgress * 100)}%`,
                            background: 'linear-gradient(180deg, rgba(247, 210, 75, 0.12) 0%, rgba(247, 210, 75, 0.38) 100%)',
                          }}
                        />
                      </div>
                    </>
                  )}
                  ↑
                </button>
              </div>
            )}
            {/* End Turn button - affixed to foundations */}
            {!true && (
              <div
                className="w-20 flex flex-col items-center gap-2 pointer-events-auto z-[100] relative"
                style={{ marginLeft: '75px' }}
              >
                <div className="flex items-center gap-2">
                  <GameButton
                    onClick={actions.advanceRandomBiomeTurn ?? actions.endRandomBiomeTurn}
                    color="gold"
                    size="sm"
                    disabled={isEnemyTurn}
                    className="shadow-neon-gold"
                    style={{
                      borderColor: 'rgba(255, 229, 120, 0.9)',
                      boxShadow: '0 0 12px rgba(230, 179, 30, 0.65)',
                      backgroundColor: 'rgba(10, 8, 6, 0.92)',
                      color: '#f7d24b',
                      textShadow: '0 0 6px rgba(230, 179, 30, 0.65)',
                    }}
                  >
                    {isEnemyTurn ? 'READY' : 'END TURN'}
                  </GameButton>
                </div>
                <GameButton
                  onClick={() => handleExitBiome('return')}
                  color="teal"
                  size="sm"
                  className="bg-game-bg-dark/80 shadow-neon-teal"
                >
                  EXIT
                </GameButton>
              </div>
            )}
          </div>
        </div>
        {showPartyOrimsSection ? equippedOrimRow : null}
        {true && (
          <div className="flex items-center justify-center gap-4">
            {!true && (
              <ResourceStash
                resourceStash={gameState.resourceStash}
                collectedTokens={gameState.collectedTokens}
                showGraphics={showGraphics}
                showTokenNotice={false}
                tokenNoticeCount={0}
                onTokenGrab={() => {}}
                position="relative"
                interactive={false}
              />
            )}
          </div>
        )}

        {/* Hand (temporarily hidden) */}
        {PARTY_BENCH_ENABLED && false && (
          <div className="relative z-40 flex justify-center" style={handSlotStyle}>
            <PartyBench
              benchActors={partyBenchActors}
              showGraphics={showGraphics}
              onBenchActorClick={handleBenchActorClick}
              swapCount={benchSwapCount}
              infiniteSwapsEnabled={infiniteBenchSwapsEnabled}
              onToggleInfiniteSwaps={onToggleInfiniteBenchSwaps}
              freeSwapActorIds={freeSwapActorIds}
              actorComboCounts={actorComboCounts}
            />
          </div>
        )}
        {shouldRenderPlayerHand && (
          <div className="relative z-40 flex justify-center" style={handSlotStyle}>
            <Hand
              cards={displayedPlayerHandCards}
              cardScale={1}
              onDragStart={handleDragStartGuarded}
              onCardClick={handleHandClick}
              onCardLongPress={handlePlayerHandCardLongPress}
              stockCount={0}
              showGraphics={showGraphics}
              interactionMode={gameState.interactionMode}
              draggingCardId={dragState.isDragging ? dragState.card?.id : null}
              isAnyCardDragging={dragState.isDragging}
              tooltipEnabled={isGamePaused && !isRpgMode && !inspectedRpgCard}
              upgradedCardIds={upgradedHandCardIds}
              hideElements={isRpgMode}
              onAdjustRpgCardRarity={isRpgMode ? actions.adjustRpgHandCardRarity : undefined}
            />
          </div>
        )}
        {showKeruArchetypeReward && !isDraggingAspectRewardCard && (
          <CombatOverlayFrame
            visible
            interactive={!inspectedRpgCard}
            dimOpacity={0.55}
            blurPx={2}
            zIndex={10024}
          >
            <div className="absolute inset-0" />
            <div
              className="relative mx-4 rounded-[32px] border border-game-teal/50 px-10 py-8 flex flex-col"
              style={{
                width: `${aspectModalWidth}px`,
                height: `${aspectModalHeight}px`,
                maxHeight: '82vh',
                background: 'linear-gradient(180deg, rgba(10,18,24,0.95) 0%, rgba(10,16,22,0.92) 100%)',
                boxShadow: '0 0 40px rgba(0,0,0,0.6), 0 0 22px rgba(127,219,202,0.18)',
              }}
            >
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.6em] text-game-teal/80">
                {pendingPoiReward?.type === 'orim-choice' ? 'Choose an Orim' : 'Awaken Your Aspect'}
              </div>
              <div className="mb-4 text-sm text-game-white/80">
                {pendingPoiReward?.type === 'orim-choice'
                  ? 'Drag an orim card to the foundation to equip it.'
                  : 'Drag an aspect card to the foundation to bind Keru\'s form.'}
              </div>
              <div className="mb-4 text-[11px] uppercase tracking-[0.3em] text-game-gold/80">
                Choose {aspectChoiceCount}
              </div>
              <div className="relative flex flex-1 items-center justify-center pt-2">
                <div className="relative flex items-end justify-center" style={{ gap: aspectCardGap }}>
                  {displayedRewardCards.map((card, index) => {
                    const isCardBeingDragged = isDraggingAspectRewardCard && dragState.card?.id === card.id;
                    const rotation = displayedRewardCards.length === 1
                      ? 0
                      : (index - (displayedRewardCards.length - 1) / 2) * 6;
                    const cardKey = card.id || `aspect-reward-${index}`;
                    const isOrimReward = pendingPoiReward?.type === 'orim-choice';
                    const orimId = isOrimReward ? card.id.replace('reward-orim-', '') : null;
                    const orimDef = orimId ? ORIM_DEFINITIONS.find((o) => o.id === orimId) : null;
                    const jewelColor = orimDef ? getOrimAccentColor(orimDef) : '#63687F';

                    return (
                      <div
                        key={cardKey}
                        style={{
                          transform: isCardBeingDragged ? 'none' : `rotate(${rotation}deg)`,
                          transition: 'transform 0.15s ease-out'
                        }}
                      >
                        {isOrimReward ? (
                          <div className="flex flex-col items-center gap-4">
                            <JewelOrim
                              color={jewelColor}
                              size={Math.min(aspectCardSize.width, aspectCardSize.height) * 0.8}
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.currentTarget && 'setPointerCapture' in e.currentTarget) {
                                  (e.currentTarget as Element).setPointerCapture(e.pointerId);
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                handleDragStartGuarded(card, HAND_SOURCE_INDEX, e.clientX, e.clientY, rect);
                              }}
                            />
                            <div className="text-center">
                              <div className="text-game-white font-bold tracking-wider uppercase text-sm">
                                {orimDef?.name}
                              </div>
                              <div className="text-game-white/60 text-[10px] mt-1 max-w-[180px] leading-tight">
                                {orimDef?.description}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Card
                            card={card}
                            size={aspectCardSize}
                            showGraphics={showGraphics}
                            isAnyCardDragging={dragState.isDragging}
                            onDragStart={(cardPayload, clientX, clientY, rect) => (
                              handleDragStartGuarded(cardPayload, HAND_SOURCE_INDEX, clientX, clientY, rect)
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CombatOverlayFrame>
        )}
        {showKeruAbilityReward && keruRewardCard && abilityDefinition && (
          <CombatOverlayFrame
            visible
            interactive={!inspectedRpgCard}
            dimOpacity={0.4}
            blurPx={1.5}
            zIndex={10024}
          >
            <div className="absolute inset-0" />
            <div
              className="relative rounded-xl border px-3 py-3 md:px-4 md:py-4 overflow-hidden"
              style={{
                width: `${rewardPanelWidthPx}px`,
                height: `${rewardPanelHeightPx}px`,
                marginLeft: 'auto',
                marginRight: 'auto',
                borderColor: 'rgba(127, 219, 202, 0.72)',
                backgroundColor: 'rgba(10, 10, 10, 0.9)',
                boxShadow: '0 0 22px rgba(127, 219, 202, 0.35)',
              }}
            >
              <div className="relative z-40 w-full h-full flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-[10px] font-bold tracking-[2px] uppercase text-game-teal/80">
                  KERU {keruAspectLabel?.toUpperCase() ?? 'AWAKEN'}
                </div>
                <div className="shadow-neon-teal flex items-center justify-center">
                  <Card
                    card={keruRewardCard}
                    showGraphics={showGraphics}
                    size={abilityCardSize}
                    onDragStart={(card, clientX, clientY, rect) => handleDragStartGuarded(card, HAND_SOURCE_INDEX, clientX, clientY, rect)}
                  />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-[1px] text-game-gold">
                  {abilityDefinition.label} · {abilityDefinition.damage}
                </div>
                <div className="text-[10px] tracking-[0.6px] uppercase text-game-white/70 max-w-[320px]">
                  Drag this ability to your foundation to anchor the physical aspect.
                </div>
              </div>
            </div>
          </CombatOverlayFrame>
        )}
        <style>{`
          @keyframes keru-foundation-flash {
            0% { opacity: 0; transform: scale(0.92); }
            22% { opacity: 1; transform: scale(1.04); }
            100% { opacity: 0; transform: scale(1.12); }
          }
          @keyframes keru-foundation-shimmer {
            0% { opacity: 0.95; transform: translateX(-8%) scale(0.92); }
            45% { opacity: 0.85; transform: translateX(6%) scale(1.04); }
            100% { opacity: 0; transform: translateX(14%) scale(1.08); }
          }
          @keyframes keru-foundation-sparkles {
            0% { opacity: 0.95; transform: scale(0.86); }
            35% { opacity: 1; transform: scale(1.02); }
            100% { opacity: 0; transform: scale(1.14); }
          }
        `}</style>
        {false && <StartMatchOverlay phase={startOverlayPhase} countdown={startCountdown} onPlay={handleStartMatch} onSkip={handleSkipIntro} />}
        {enemyHandOverlay}
        {rpgCardInspectOverlay}
        {actorInspectOverlay}
        {timerBankVisuals}
        {topHudBar}
        {splatterModal}
      </div>
      </div>
      </div>
      </div>
          );
        }}
      </ComboTimerController>
    );
  }

  if (biomeDef?.mode === 'node-edge') {
    return (
      <div className="relative w-full h-full pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: useGhostBackground
              ? `rgba(248, 248, 255, ${overlayOpacity})`
              : `rgba(0, 0, 0, ${overlayOpacity})`,
          }}
        />
        <div className="relative w-full h-full flex items-center justify-center pointer-events-auto" data-biome-ui>
        <NodeEdgeBiomeScreen
          gameState={gameState}
          activeParty={activeParty}
          onPlayCard={actions.playCardInNodeBiome}
          onComplete={actions.completeBiome}
          onExit={handleExitBiome}
          onAutoSolve={actions.autoSolveBiome}
          hasCollectedLoot={hasCollectedLoot}
          noValidMoves={noValidMoves}
          showGraphics={showGraphics}
        />
        </div>
        {false && <StartMatchOverlay phase={startOverlayPhase} countdown={startCountdown} onPlay={handleStartMatch} onSkip={handleSkipIntro} />}
        {enemyHandOverlay}
        {rpgCardInspectOverlay}
        {actorInspectOverlay}
        {timerBankVisuals}
        {topHudBar}
        {splatterModal}
      </div>
    );
  }

  const isGardenGrove = biomeDef?.id === 'garden_grove';
  const emptyTokens = { W: 0, E: 0, A: 0, F: 0, L: 0, D: 0, N: 0 } as Record<Element, number>;

  // Traditional biome rendering
  const handleTableauClick = (card: CardType, tableauIndex: number) => {
    if (introBlocking) return;
    if (isGamePaused) return;
    if (gameState.interactionMode !== 'click') {
      actions.selectCard(card, tableauIndex);
      return;
    }
    if (!tableauCanPlay[tableauIndex] || noValidMoves) return;

    const validFoundations = gameState.foundations
      .map((foundation, idx) => {
        const actor = activeParty[idx];
        const hasStamina = isActorCombatReady(actor);
        const canPlay = hasStamina && canPlayCardWithWild(
          card,
          foundation[foundation.length - 1],
          gameState.activeEffects,
          foundation
        );
        return canPlay ? idx : -1;
      })
      .filter((idx) => idx !== -1);

    if (true) {
      if (armedFoundationIndex !== null) {
        if (!validFoundations.includes(armedFoundationIndex)) return;
        const played = actions.playCardDirect(tableauIndex, armedFoundationIndex);
        if (!played) return;
        signalValidMove();
        triggerCardPlayFlash(armedFoundationIndex, partyComboTotal + 1);
        awardExplorationActionPoint();
        setArmedFoundationIndex(null);
        return;
      }
      if (validFoundations.length === 1) {
        const played = actions.playCardDirect(tableauIndex, validFoundations[0]);
        if (!played) return;
        signalValidMove();
        triggerCardPlayFlash(validFoundations[0], partyComboTotal + 1);
        awardExplorationActionPoint();
      }
      return;
    }

    const foundationIndex = validFoundations[0] ?? -1;
    if (foundationIndex === -1) return;
    const played = actions.playCardDirect(tableauIndex, foundationIndex);
    if (!played) return;
    signalValidMove();
    triggerCardPlayFlash(foundationIndex, partyComboTotal + 1);
    awardExplorationActionPoint();
  };
  const handleHandClick = (card: CardType) => {
    if (introBlocking) return;
    if (card.id === 'ability-rewind') {
      if (!noRegretStatus.canRewind) return;
      actions.rewindLastCard();
      return;
    }
    if (card.id.startsWith(CONTROLLED_DRAGONFIRE_CARD_ID_PREFIX)) {
      setInspectedRpgCardSource({ side: 'player' });
      setInspectedRpgCard(card);
      return;
    }
    if (isRpgMode && !(card.rank === WILD_SENTINEL_RANK)) {
      setInspectedRpgCardSource({ side: 'player' });
      setInspectedRpgCard(card);
      return;
    }
    if (isGamePaused) return;
    if (gameState.interactionMode !== 'click') return;

    const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
      const actor = activeParty[idx];
      const hasStamina = isActorCombatReady(actor);
      return hasStamina && canPlayCardWithWild(
        card,
        foundation[foundation.length - 1],
        gameState.activeEffects,
        foundation
      );
    });

    if (foundationIndex === -1) return;
    const played = actions.playFromHand(card, foundationIndex, false);
    if (!played) return;
    signalValidMove();
    if (card.id.startsWith('battle-hand-reward-')) {
      setRewardedBattleHandCards((cards) => cards.filter((entry) => entry.id !== card.id));
    }
    triggerCardPlayFlash(foundationIndex, partyComboTotal + 1);
    awardExplorationActionPoint();
  };
    const handleStockClick = () => {
      if (introBlocking) return;
      if (isGamePaused) return;
      if (gameState.interactionMode !== 'click') return;
      if (gameState.stock.length === 0) return;
      const stockCard = gameState.stock[gameState.stock.length - 1];

    const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
      const actor = activeParty[idx];
      const hasStamina = isActorCombatReady(actor);
      return hasStamina && canPlayCardWithWild(
        stockCard,
        foundation[foundation.length - 1],
        gameState.activeEffects,
        foundation
      );
    });

    const fallbackIndex = foundationIndex !== -1
      ? foundationIndex
      : Math.max(0, activeParty.findIndex((actor) => (actor?.stamina ?? 0) > 0));
    const played = actions.playFromStock(fallbackIndex, false, true);
    if (played) {
      signalValidMove();
      awardExplorationActionPoint();
    }
  };
  const blockIntroPointerEvents = introBlocking && !isExplorationMode;
  // Track container size for watercolor canvas
  return (
    <ComboTimerController
      partyComboTotal={partyComboTotalForTimer}
      paused={isGamePaused || introBlocking || comboPaused}
      timeScale={timeScale}
      bonusExtendMs={gameState.rpgComboTimerBonusMs}
      bonusExtendToken={gameState.rpgComboTimerBonusToken}
      secondaryBonusExtendMs={bankedTimerBonusMs}
      secondaryBonusExtendToken={bankedTimerBonusToken}
      onExpire={handleComboExpire}
    >
      {(combo) => {
        const timerRef = combo.timerRef;
        const playerRemainingMs = combo.remainingMs;
        const playerVisualMaxMs = combo.visualMaxMs;
        const showSharedTurnTimer = true && comboTimersEnabled;
        const sharedTimerLabel = isEnemyTurn ? 'ENEMY TURN' : 'PLAYER TURN';
        const sharedTimerFillPercent = introBlocking
          ? '100%'
          : (isEnemyTurn ? enemyTurnFillPercent : '100%');
        return (
    <div
      ref={biomeContainerRef as any}
      className="relative w-full h-full flex flex-col items-center justify-center pointer-events-auto overflow-hidden"
      style={{
        gap: 'clamp(16px, 3.5vh, 40px)',
        paddingTop: 'clamp(10px, 2vh, 20px)',
        paddingBottom: 'clamp(10px, 2vh, 20px)',
        pointerEvents: blockIntroPointerEvents ? 'none' : 'auto',
      }}
    >
      {showSharedTurnTimer && (
        <TurnTimerRail
          label={sharedTimerLabel}
          fillPercent={sharedTimerFillPercent}
          timerRef={!isEnemyTurn && !introBlocking ? timerRef : undefined}
          totalMs={isEnemyTurn ? ENEMY_TURN_TIME_BUDGET_MS : playerVisualMaxMs}
          remainingMsOverride={!isEnemyTurn && !introBlocking ? playerRemainingMs : undefined}
          showSkipButton={!isEnemyTurn && canTriggerEndTurnFromCombo}
          onSkip={!isEnemyTurn && canTriggerEndTurnFromCombo ? handleSkipWithBank : undefined}
          showPauseButton={showPauseButton}
          onTogglePause={onTogglePause}
          isGamePaused={isGamePaused}
          paused={comboPaused}
          onClick={!isEnemyTurn ? handlePartyComboCounterEndTurn : undefined}
          role={!isEnemyTurn && canTriggerEndTurnFromCombo ? 'button' : undefined}
          tabIndex={!isEnemyTurn && canTriggerEndTurnFromCombo ? 0 : undefined}
          onKeyDown={(event) => {
            if (isEnemyTurn || !canTriggerEndTurnFromCombo) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handlePartyComboCounterEndTurn();
            }
          }}
          cursor={!isEnemyTurn && canTriggerEndTurnFromCombo ? 'pointer' : 'default'}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: useGhostBackground
            ? `rgba(248, 248, 255, ${overlayOpacity})`
            : `rgba(0, 0, 0, ${overlayOpacity})`,
        }}
      />
      <div
        ref={biomeContainerRef as any}
        className="relative w-full h-full flex flex-col items-center justify-center pointer-events-auto"
      style={{ zIndex: 2, gap: 'clamp(6px, 1.8vh, 22px)', pointerEvents: blockIntroPointerEvents ? 'none' : 'auto' }}
      >
      {/* Light shadow overlay – shows drag light while dragging, normal lights otherwise */}
      {lightingEnabled && containerSize.width > 0 && (
        dragState.isDragging ? (
          <DragLightOverlay
            active={dragState.isDragging}
            dragPositionRef={dragPositionRef}
            fallbackPositionRef={dragBasePositionRef}
            effectiveGlobalCardScale={effectiveGlobalCardScale}
            containerSize={containerSize}
            containerRef={biomeContainerRef}
            anchorRef={biomeContainerRef}
            biomeOriginRef={biomeContainerOriginRef}
            foundationRefs={foundationRefs}
            isDraggingKeruRewardCard={isDraggingKeruRewardCard}
            ambientDarkness={dynamicAmbientDarkness}
          />
        ) : (() => {
          const lightX = containerSize.width / 2;
          const lightY = containerSize.height * 0.05;
          const lightRadius = Math.max(containerSize.width, containerSize.height) * 1.2;
          // Normal state: flash lights + ambient paint lights
          const now = performance.now();
          const flashLights = cardPlayFlashes.map((flash) => {
            const elapsed = now - flash.startTime;
            const progress = Math.min(1, elapsed / flash.duration);
            const comboBoost = COMBO_FLASH_SCALING_ENABLED
              ? Math.min(MAX_COMBO_FLASH, Math.max(0, flash.combo ?? 0))
              : 0;
            const comboT = comboBoost / MAX_COMBO_FLASH;
            // Ease-out curve with longer linger as combo grows (bullet-time feel).
            const easePower = 2 + comboT * 2.5;
            const easeOutProgress = 1 - Math.pow(1 - progress, easePower);
            const intensity = Math.max(0, 1 - easeOutProgress); // Smoother fade
            const radiusScale = 1 + comboT * 1.2;
            const intensityScale = 1 + comboT * 0.9;
            return {
              x: flash.x,
              y: flash.y,
              radius: 200 * (1 + progress * 1.5) * radiusScale,
              intensity: intensity * intensityScale,
              color: '#ffffff',
              castShadows: false,
              flicker: {
                enabled: false,
                speed: 0,
                amount: 0,
              },
            };
          });
          const allLights = [...flashLights, ...paintLights];

          return (
            <ShadowCanvas
              containerRef={biomeContainerRef}
              anchorRef={biomeContainerRef}
              useCameraTransform={false}
              lightX={lightX}
              lightY={lightY}
              lightRadius={lightRadius}
              lightIntensity={0}
              lightColor="#ffffff"
              ambientDarkness={dynamicAmbientDarkness}
              flickerSpeed={0}
              flickerAmount={0}
              blockers={foundationBlockers}
              actorGlows={[]}
              actorLights={allLights}
              worldWidth={containerSize.width}
              worldHeight={containerSize.height}
              tileSize={80}
              width={containerSize.width}
              height={containerSize.height}
            />
          );
        })()
      )}
      <InteractionScreen
        className="relative w-full flex flex-col items-center pointer-events-auto"
        style={{ gap: 'clamp(6px, 1.8vh, 22px)' }}
        dataBiomeUi
        containerRef={matchLineContainerRef}
      >
        {renderMatchLines('traditional')}
        <div className="flex items-center gap-3">
          <div className="text-sm text-game-teal tracking-[4px]" data-card-face>
            {biomeDef?.name?.toUpperCase() ?? 'BIOME'}
          </div>
        </div>
      {/* Tableaus */}
      {isGardenGrove ? (
        <div className="grid grid-cols-6 gap-x-3 px-2 sm:px-3" style={{ rowGap: '15px' }}>
          {gameState.tableaus.map((tableau, idx) => (
            <div
              key={idx}
              ref={(el) => { tableauRefs.current[idx] = el; }}
              style={tableau.length > 0 && sunkCostTableauPulseStyle ? sunkCostTableauPulseStyle : undefined}
            >
              <Tableau
                cards={tableau}
                tableauIndex={idx}
                canPlay={tableauCanPlay[idx]}
                noValidMoves={noValidMoves}
                selectedCard={selectedCard}
                onCardSelect={handleTableauClick}
                guidanceMoves={guidanceMoves}
                interactionMode={gameState.interactionMode}
              onDragStart={handleDragStartGuarded}
                draggingCardId={dragState.isDragging ? dragState.card?.id : null}
                showGraphics={showGraphics}
                cardScale={tableauCardScale}
                revealNextRow={cloudSightActive}
                revealAllCards={revealAllCardsForIntro}
                dimTopCard={enemyDraggingTableauIndexes.has(idx)}
                hiddenTopCard={isRpgMode && hiddenPlayerTableaus.has(idx)}
                maskTopValue={isRpgMode && maskAllPlayerTableauValues}
                hideElements={isRpgMode}
                topCardStepIndexOverride={isRpgMode && !hasSpawnedEnemies ? getDisplayedStepIndexForColumn(idx) : null}
                debugStepLabel={getDebugStepLabelForColumn(idx)}
                onTopCardRightClick={handleTableauTopCardRightClick}
                ripTriggerByCardId={tableauRipTriggerByCardId}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex w-full justify-center gap-3 px-2 sm:px-3">
          {gameState.tableaus.map((tableau, idx) => (
            <div
              key={idx}
              ref={(el) => { tableauRefs.current[idx] = el; }}
              style={tableau.length > 0 && sunkCostTableauPulseStyle ? sunkCostTableauPulseStyle : undefined}
            >
              <Tableau
                cards={tableau}
                tableauIndex={idx}
                canPlay={tableauCanPlay[idx]}
                noValidMoves={noValidMoves}
                selectedCard={selectedCard}
                onCardSelect={handleTableauClick}
                guidanceMoves={guidanceMoves}
                interactionMode={gameState.interactionMode}
              onDragStart={handleDragStartGuarded}
                draggingCardId={dragState.isDragging ? dragState.card?.id : null}
                showGraphics={showGraphics}
                cardScale={tableauCardScale}
                revealNextRow={cloudSightActive}
                revealAllCards={revealAllCardsForIntro}
                dimTopCard={enemyDraggingTableauIndexes.has(idx)}
                hiddenTopCard={isRpgMode && hiddenPlayerTableaus.has(idx)}
                maskTopValue={isRpgMode && maskAllPlayerTableauValues}
                hideElements={isRpgMode}
                topCardStepIndexOverride={isRpgMode && !hasSpawnedEnemies ? getDisplayedStepIndexForColumn(idx) : null}
                debugStepLabel={getDebugStepLabelForColumn(idx)}
                onTopCardRightClick={handleTableauTopCardRightClick}
                ripTriggerByCardId={tableauRipTriggerByCardId}
              />
            </div>
          ))}
        </div>
      )}

      {/* Foundations */}
      <div className="flex flex-col items-center gap-4 w-full" style={{ marginTop: foundationsStackMarginTop }}>
        {!isRpgMode && comboExpiryTokens.length > 0 && (
          <div className="relative flex items-center justify-center gap-2">
            {comboExpiryTokens.map((token) => (
              <div
                key={token.id}
                className="px-2 py-1 rounded-full border text-[10px] font-bold tracking-[2px]"
                style={{
                  color: '#0a0a0a',
                  borderColor: 'rgba(255, 229, 120, 0.9)',
                  backgroundColor: 'rgba(230, 179, 30, 0.95)',
                  boxShadow: '0 0 10px rgba(230, 179, 30, 0.6)',
                }}
              >
                {token.value}
              </div>
            ))}
          </div>
        )}
        <div className={`flex w-full justify-center ${true ? 'items-center' : ''} ${forcedPerspectiveEnabled ? 'perspective-foundation-container' : ''}`} style={{ gap: true ? `${foundationGapPx}px` : '10px' }}>
          <div className={`flex items-center justify-center ${forcedPerspectiveEnabled ? 'perspective-foundation-content' : ''}`} style={{ gap: true ? `${foundationGapPx}px` : '10px' }}>
            {gameState.foundations.map((foundation, idx) => {
              const showGoldHighlight =
                !!(selectedCard && validFoundationsForSelected[idx]);
            const actor = false
              ? ((idx === 0 && !foundationHasActor) ? null : activeParty[idx])
              : activeParty[idx];
            const hasStamina = isActorCombatReady(actor);

            const canReceiveDrag =
              dragState.isDragging &&
              dragState.card &&
              canPlayCardWithWild(
                dragState.card,
                foundation[foundation.length - 1],
                gameState.activeEffects,
                foundation
              ) &&
              hasStamina;

            const actorDisplayName = getActorDisplayLabel(actor);
            const actorName = actorDisplayName ? actorDisplayName.toUpperCase() : undefined;

            return (
              <div
                key={idx}
                data-rpg-actor-target="true"
                data-rpg-actor-side="player"
                data-rpg-actor-index={idx}
                ref={(el) => {
                  foundationRefs.current[idx] = el;
                  setFoundationRef(idx, el);
                }}
                >
                {renderStatusBadges(actor, 'player')}
                <FoundationActor
                  cards={foundation}
                  index={idx}
                  onFoundationClick={(foundationIndex) => {
                    if (isGamePaused) return;
                    if (handlePlayerFoundationClickInBiome(foundationIndex)) return;
                    if (true) {
                      setArmedFoundationIndex((prev) => (prev === foundationIndex ? null : foundationIndex));
                      return;
                    }
                    const played = actions.playToFoundation(foundationIndex);
                    if (!played) return;
                    signalValidMove();
                  }}
                  canReceive={showGoldHighlight && hasStamina}
                  isGuidanceTarget={true && armedFoundationIndex === idx}
                  isDimmed={!hasStamina}
                  interactionMode={gameState.interactionMode}
                  isDragTarget={!!canReceiveDrag}
                  actorName={actorName}
                  actor={actor}
                  showGraphics={showGraphics}
                  actorDeck={actor ? gameState.actorDecks[actor.id] : undefined}
                  orimInstances={foundationOrimInstances}
                  orimDefinitions={foundationOrimDefinitions}
                  isPartied
                  showCompleteSticker={isWon}
                  cardScale={foundationCardScale}
                  showTokenEdgeOverlay={false}
                  maskValue={maskPlayerFoundationValues}
                  splashDirectionDeg={
                    foundationSplashHint && foundationSplashHint.foundationIndex === idx
                      ? foundationSplashHint.directionDeg
                      : undefined
                  }
                  splashDirectionToken={
                    foundationSplashHint && foundationSplashHint.foundationIndex === idx
                      ? foundationSplashHint.token
                      : undefined
                  }
                  disableFoundationSplashes
                  comboCount={showActorComboCounts && actor ? (true
                    ? (actorComboCounts[actor.id] ?? 0)
                    : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                  hideElements={isRpgMode}
                  hpOverlay={renderHpLabel(actor, 'player', idx)}
                  hpOverlayPlacement="top"
                  hpOverlayOffsetPx={6}
                  onActorLongPress={({ actor: pressedActor }) => handleActorFoundationLongPress(pressedActor)}
                />
                {idx === 0 && isKeruRewardOverTarget && <TargetSwirlIndicator />}
                {renderExplorationActorHandPreview(actor, idx)}
                {renderActorNameLabel(actor)}
                {(() => {
                  if (!SHOW_FOUNDATION_TOKEN_BADGES) return null;
                  const tokenCounts = (gameState.foundationTokens || [])[idx] || emptyTokens;
                  const tokenList = TOKEN_ORDER.flatMap((element) =>
                    Array.from({ length: tokenCounts[element] || 0 }, () => element)
                  );
                  if (tokenList.length === 0) return null;
                  const tokenSize = Math.max(20, Math.round(cardWidth * 0.32));
                  return (
                    <div className="mt-2 grid grid-cols-3 gap-1 justify-items-center">
                      {tokenList.map((element, tokenIndex) => {
                        const suit = ELEMENT_TO_SUIT[element];
                        const color = SUIT_COLORS[suit];
                        const display = getSuitDisplay(suit, showGraphics);
                        return (
                          <div
                            key={`${element}-${tokenIndex}`}
                            className="rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{
                              width: tokenSize,
                              height: tokenSize,
                              borderWidth: 1,
                              borderStyle: 'solid',
                              borderColor: color,
                              backgroundColor: color,
                              color: '#0a0a0a',
                              boxShadow: `0 0 0 1px #ffffff, inset 0 0 0 1px #ffffff`,
                            }}
                            data-token-face
                          >
                            <span
                              style={{
                                WebkitTextStroke: '0.3px #ffffff',
                                textShadow: '0 0 1px rgba(255, 255, 255, 0.5)',
                              }}
                            >
                              {display}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
        </div>

        <div className="mt-2 pointer-events-auto relative z-[100]">
          <div className="flex items-center gap-2 pointer-events-auto z-[100] relative">
            <GameButton
              onClick={() => handleExitBiome(hasCollectedLoot ? 'return' : 'abandon')}
              color={hasCollectedLoot ? 'teal' : 'red'}
              size="sm"
              className={`w-16 text-center bg-game-bg-dark/80 ${hasCollectedLoot ? 'shadow-neon-teal' : 'shadow-neon-red'}`}
            >
              {hasCollectedLoot ? '<-' : 'ABANDON'}
            </GameButton>
            <GameButton onClick={actions.autoSolveBiome} color="gold" size="sm" className="w-16 text-center">
              ?
            </GameButton>
          </div>
        </div>

        {/* Complete biome button */}
        {isWon && (
          <GameButton onClick={actions.completeBiome} color="gold">
            Complete Adventure
          </GameButton>
        )}
      </div>

      {showPartyOrimsSection ? equippedOrimRow : null}
      {true && !true && (
        <div className="flex justify-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex items-center justify-center gap-3">
            {bideOrim && (
              <div
                className="relative flex items-center justify-center rounded-full"
                style={{
                  width: orimChipSize,
                  height: orimChipSize,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: bideOrim.color,
                  color: bideOrim.color,
                  fontSize: orimFontSize,
                }}
                title={`${bideOrim.definition.name} — ${bideOrim.definition.description}`}
              >
                {bideOrim.watercolor && (
                  <div
                    className="absolute"
                    style={{
                      zIndex: 0,
                      pointerEvents: 'none',
                      width: orimChipSize * ORIM_WATERCOLOR_CANVAS_SCALE,
                      height: orimChipSize * ORIM_WATERCOLOR_CANVAS_SCALE,
                      left: (orimChipSize - orimChipSize * ORIM_WATERCOLOR_CANVAS_SCALE) / 2,
                      top: (orimChipSize - orimChipSize * ORIM_WATERCOLOR_CANVAS_SCALE) / 2,
                    }}
                  >
                    <WatercolorOverlay config={bideOrim.watercolor} />
                  </div>
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{bideOrim.glyph}</span>
              </div>
            )}
            {showWildAnalysis && !true ? wildAnalysisButton : null}
            {!true && (
              <ResourceStash
                resourceStash={gameState.resourceStash}
                collectedTokens={gameState.collectedTokens}
                showGraphics={showGraphics}
                showTokenNotice={false}
                tokenNoticeCount={0}
                onTokenGrab={() => {}}
                position="relative"
                interactive={false}
                className="mt-2"
              />
            )}
            </div>
            <div className="flex flex-col items-center gap-1 text-[10px] text-game-teal/80 font-mono tracking-[2px]">
              <div>AMBIENT DARKNESS</div>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={ambientDarkness}
                onChange={(event) => setAmbientDarkness(Number(event.target.value))}
                className="w-[220px] accent-game-gold"
                aria-label="Ambient darkness"
              />
            </div>
          </div>
        </div>
      )}

      {/* Hand (temporarily hidden) */}
      {PARTY_BENCH_ENABLED && false && (
        <div className="relative z-40 flex justify-center" style={handSlotStyle}>
          <PartyBench
            benchActors={partyBenchActors}
            showGraphics={showGraphics}
            onBenchActorClick={handleBenchActorClick}
            swapCount={benchSwapCount}
            infiniteSwapsEnabled={infiniteBenchSwapsEnabled}
            onToggleInfiniteSwaps={onToggleInfiniteBenchSwaps}
            freeSwapActorIds={freeSwapActorIds}
            actorComboCounts={actorComboCounts}
          />
        </div>
      )}
      {false && <StartMatchOverlay phase={startOverlayPhase} countdown={startCountdown} onPlay={handleStartMatch} onSkip={handleSkipIntro} />}
      {enemyHandOverlay}
      {rpgCardInspectOverlay}
      {actorInspectOverlay}
      {timerBankVisuals}
      {topHudBar}
      </InteractionScreen>
      </div>
      {splatterModal}
    </div>
        );
      }}
    </ComboTimerController>
  );
});

export default CombatGolf;









