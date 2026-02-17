import { memo, useEffect, useState, useMemo, useCallback, useRef, type RefObject, type KeyboardEventHandler } from 'react';
import { useGraphics } from '../contexts/GraphicsContext';
import type { GameState, Card as CardType, Element, Move, SelectedCard, Actor, ActorDefinition, Die as DieType, RelicCombatEvent } from '../engine/types';
import type { DragState } from '../hooks/useDragDrop';
import type { BlockingRect } from '../engine/lighting';
import { ShadowCanvas } from './LightRenderer';
import { GameButton } from './GameButton';
import { Tableau } from './Tableau';
import { FoundationActor } from './FoundationActor';
import { Card } from './Card';
import { Die } from './Die';
import { NodeEdgeBiomeScreen } from './NodeEdgeBiomeScreen';
import { FoundationTokenGrid } from './FoundationTokenGrid';
import { Foundation } from './Foundation';
import { Compass, DIRECTIONS, type Direction } from './Compass';
import { ExplorationMap, type ExplorationMapEdge, type ExplorationMapNode } from './ExplorationMap';
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
import { getActiveBlindLevel, getBlindedDetail, getBlindedHiddenTableauIndexes, getBlindedLabel } from '../engine/rpgBlind';
import { getOrimAccentColor, getOrimWatercolorConfig, ORIM_WATERCOLOR_CANVAS_SCALE } from '../watercolor/orimWatercolor';
import { WatercolorOverlay } from '../watercolor/WatercolorOverlay';
import { useWatercolorEngine, usePaintMarkCount } from '../watercolor-engine/WatercolorContext';
import { getBiomeDefinition } from '../engine/biomes';
import { createDie } from '../engine/dice';
import { NO_MOVES_BADGE_STYLE } from '../utils/styles';
import { useDevModeFlag } from '../utils/devMode';
import { mainWorldMap } from '../data/worldMap';
import { createPoiTableauPreset, type PoiTableauPresetId } from '../data/poiTableaus';
import { SplatterPatternModal } from './SplatterPatternModal';
import { Tooltip } from './Tooltip';
import { createRandomBattleHandRewardCard, getBattleHandRewardThreshold } from './combat/battleHandUnlocks';
import { StartMatchOverlay, type StartOverlayPhase } from './combat/StartMatchOverlay';
import { CombatOverlayFrame } from './combat/CombatOverlayFrame';
import { RpgCardInspectOverlay } from './combat/RpgCardInspectOverlay';
import { ActorInspectOverlay } from './combat/ActorInspectOverlay';

const CONTROLLED_DRAGONFIRE_BEHAVIOR_ID = 'controlled_dragonfire_v1';
const CONTROLLED_DRAGONFIRE_CARD_ID_PREFIX = 'relic-controlled-dragonfire-';
const DEV_TRAVERSE_HOLD_DELAY_MS = 260;
const DEV_TRAVERSE_HOLD_INTERVAL_MS = 190;

interface CombatGolfProps {
  gameState: GameState;
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
  infiniteStockEnabled: boolean;
  onToggleInfiniteStock: () => void;
  noRegretStatus: { canRewind: boolean; cooldown: number; actorId: string | null };
  zenModeEnabled?: boolean;
  isGamePaused?: boolean;
  timeScale?: number;
  onTogglePause?: () => void;
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
    setBiomeTableaus?: (tableaus: CardType[][]) => void;
    tickRpgCombat?: (nowMs: number) => boolean;
    processRelicCombatEvent?: (event: RelicCombatEvent) => void;
    adjustRpgHandCardRarity?: (cardId: string, delta: -1 | 1) => boolean;
    addRpgHandCard?: (card: CardType) => boolean;
    removeRpgHandCardById?: (cardId: string) => boolean;
    setEnemyDifficulty?: (difficulty: GameState['enemyDifficulty']) => void;
    rewindLastCard: () => boolean;
    swapPartyLead: (actorId: string) => void;
    playWildAnalysisSequence: () => void;
  };
  benchSwapCount?: number;
  infiniteBenchSwapsEnabled?: boolean;
  onToggleInfiniteBenchSwaps?: () => void;
  onConsumeBenchSwap?: () => void;
  explorationStepRef?: { current: (() => void) | null };
}

interface TurnTimerRailProps {
  label: string;
  fillPercent?: string;
  timerRef?: RefObject<HTMLDivElement | null>;
  totalMs?: number;
  remainingMsOverride?: number;
  showSkipButton?: boolean;
  onSkip?: (remainingMs: number) => void;
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
const DEFAULT_TABLEAU_DEPTH = 4;
const ELEMENT_POOL: Element[] = ['N', 'A', 'E', 'W', 'F', 'D', 'L'];
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
  wildAnalysis = null,
  actions,
  benchSwapCount = 0,
  infiniteBenchSwapsEnabled = false,
  onToggleInfiniteBenchSwaps,
  onConsumeBenchSwap,
  onOpenSettings,
  explorationStepRef,
}: CombatGolfProps) {
  const showGraphics = useGraphics();
  const [splatterModalOpen, setSplatterModalOpen] = useState(false);
  const [explorationHeading, setExplorationHeading] = useState<Direction>('N');
  const [explorationMapAlignment, setExplorationMapAlignment] = useState<'compass' | 'north'>('north');
  const [explorationNodes, setExplorationNodes] = useState<ExplorationMapNode[]>([
    { id: 'origin', heading: 'N', x: 0, y: 0, z: 0, visits: 1 },
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
  const [explorationTotalTraversalCount, setExplorationTotalTraversalCount] = useState(0);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [owlOverwatchUntilMs, setOwlOverwatchUntilMs] = useState(0);
  const [owlExplorationRevealByNode, setOwlExplorationRevealByNode] = useState<Record<string, Record<number, string | null>>>({});
  const [overwatchClockMs, setOverwatchClockMs] = useState(() => Date.now());
  const [comboPaused, setComboPaused] = useState(false);
  const [mapVisible, setMapVisible] = useState(true);
  const [bankedTurnMs, setBankedTurnMs] = useState(0);
  const [bankedTimerBonusMs, setBankedTimerBonusMs] = useState(0);
  const [bankedTimerBonusToken, setBankedTimerBonusToken] = useState<number | undefined>(undefined);
  const [bankCallouts, setBankCallouts] = useState<Array<{ id: number; ms: number }>>([]);
  const [enemyTurnEndCallouts, setEnemyTurnEndCallouts] = useState<Array<{ id: number }>>([]);
  const [bankSmashFx, setBankSmashFx] = useState<{ id: number; ms: number } | null>(null);
  const [explorationSupplies, setExplorationSupplies] = useState(10);
  const [explorationApLockFloor, setExplorationApLockFloor] = useState<number | null>(null);
  const [explorationRowsPerStep, setExplorationRowsPerStep] = useState(1);
  const [tableauSlideOffsetPx, setTableauSlideOffsetPx] = useState(0);
  const [tableauSlideAnimating, setTableauSlideAnimating] = useState(false);
  const [inspectedRpgCard, setInspectedRpgCard] = useState<CardType | null>(null);
  const [inspectedRpgCardSource, setInspectedRpgCardSource] = useState<{ side: 'player' } | { side: 'enemy'; actorIndex: number } | null>(null);
  const [inspectedActorId, setInspectedActorId] = useState<string | null>(null);
  const [actorNodeAssignments, setActorNodeAssignments] = useState<Record<string, Record<string, string>>>({});
  const [activeEnemyHandActorIndex, setActiveEnemyHandActorIndex] = useState<number | null>(null);
  const [activePlayerHandActorIndex, setActivePlayerHandActorIndex] = useState<number | null>(null);
  const [rewardedBattleHandCards, setRewardedBattleHandCards] = useState<CardType[]>([]);
  const [upgradedHandCardIds, setUpgradedHandCardIds] = useState<string[]>([]);
  const upgradedFlashTimeoutsRef = useRef<Record<string, number>>({});
  const prevRpgHandIdsRef = useRef<Set<string>>(new Set());
  const rewardCardIdRef = useRef(0);
  const [comboExpiryTokens, setComboExpiryTokens] = useState<Array<{ id: number; value: number }>>([]);
  const comboTokenIdRef = useRef(0);
  const [ambientDarkness, setAmbientDarkness] = useState(0.85);
  const [armedFoundationIndex, setArmedFoundationIndex] = useState<number | null>(null);
  const [foundationBlockers, setFoundationBlockers] = useState<BlockingRect[]>([]);
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
  const explorationNodesRef = useRef<ExplorationMapNode[]>([{ id: 'origin', heading: 'N', x: 0, y: 0, z: 0, visits: 1 }]);
  const explorationEdgesRef = useRef<ExplorationMapEdge[]>([]);
  const explorationTrailNodeIdsRef = useRef<string[]>(['origin']);
  const tableauSlideRafRef = useRef<number | null>(null);
  const devTraverseHoldTimeoutRef = useRef<number | null>(null);
  const devTraverseHoldIntervalRef = useRef<number | null>(null);
  const devTraverseHoldRafRef = useRef<number | null>(null);
  const devTraverseHoldStartAtRef = useRef<number>(0);
  const devTraverseTriggeredHoldRef = useRef(false);
  const [devTraverseHoldProgress, setDevTraverseHoldProgress] = useState(0);
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
  const poiByCoordinateKey = useMemo(() => {
    const poiById = new Map(mainWorldMap.pointsOfInterest.map((poi) => [poi.id, poi]));
    const map = new Map<string, PoiTableauPresetId>();
    mainWorldMap.cells.forEach((cell) => {
      const poi = poiById.get(cell.poiId);
      if (!poi?.tableauPresetId) return;
      map.set(`${cell.gridPosition.col},${cell.gridPosition.row}`, poi.tableauPresetId as PoiTableauPresetId);
    });
    return map;
  }, []);
  const poiPresenceByCoordinateKey = useMemo(() => {
    const poiById = new Map(mainWorldMap.pointsOfInterest.map((poi) => [poi.id, poi]));
    const map = new Map<string, { id: string; name: string }>();
    mainWorldMap.cells.forEach((cell) => {
      const poi = poiById.get(cell.poiId);
      if (!poi || poi.type === 'empty') return;
      map.set(`${cell.gridPosition.col},${cell.gridPosition.row}`, { id: poi.id, name: poi.name });
    });
    return map;
  }, []);
  const explorationPoiMarkers = useMemo(() => {
    const entries = Array.from(poiPresenceByCoordinateKey.entries());
    return entries.map(([coordKey, poi]) => {
      const [xRaw, yRaw] = coordKey.split(',');
      return {
        id: poi.id,
        x: Number(xRaw),
        y: Number(yRaw),
        label: '?',
      };
    });
  }, [poiPresenceByCoordinateKey]);
  const getExplorationNodeCoordinates = useCallback((nodeId: string): { x: number; y: number } | null => {
    if (nodeId === 'origin') return { x: 0, y: 0 };
    const parsed = /^node-(-?\d+)-(-?\d+)$/.exec(nodeId);
    if (!parsed) return null;
    return { x: Number(parsed[1]), y: Number(parsed[2]) };
  }, []);
  const getPoiTableauPresetForNode = useCallback((nodeId: string): PoiTableauPresetId | null => {
    const coords = getExplorationNodeCoordinates(nodeId);
    if (!coords) return null;
    return poiByCoordinateKey.get(`${coords.x},${coords.y}`) ?? null;
  }, [getExplorationNodeCoordinates, poiByCoordinateKey]);
  const hasPoiForNode = useCallback((nodeId: string): boolean => {
    const coords = getExplorationNodeCoordinates(nodeId);
    if (!coords) return false;
    return poiPresenceByCoordinateKey.has(`${coords.x},${coords.y}`);
  }, [getExplorationNodeCoordinates, poiPresenceByCoordinateKey]);
  const ensurePoiPresetTableaus = useCallback((nodeId: string): CardType[][] | null => {
    const presetId = getPoiTableauPresetForNode(nodeId);
    if (!presetId) return null;
    const cacheKey = `${nodeId}|poi|${presetId}`;
    const cached = explorationPoiTableauCacheRef.current[cacheKey];
    let generated = cached ?? createPoiTableauPreset(presetId);
    const coords = getExplorationNodeCoordinates(nodeId);
    if (coords && coords.x === 0 && (coords.y === 0 || coords.y === 1 || coords.y === 2)) {
      generated = generated.slice(0, 7).map((stack) => (stack.length > 0 ? [stack[stack.length - 1]] : []));
    }
    explorationPoiTableauCacheRef.current[cacheKey] = generated;
    return generated;
  }, [getExplorationNodeCoordinates, getPoiTableauPresetForNode]);
  const hashString = useCallback((value: string) => {
    let hash = 2166136261 >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }, []);
  const createPrng = useCallback((seed: number) => {
    let state = seed >>> 0;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }, []);
  const createDeterministicCard = useCallback((
    nodeId: string,
    directionLabel: string,
    columnIndex: number,
    depthIndex: number
  ): CardType => {
    const seed = hashString(`${nodeId}:${directionLabel}:${columnIndex}:${depthIndex}`);
    const rand = createPrng(seed);
    const rank = Math.floor(rand() * 13) + 1;
    const element = ELEMENT_POOL[Math.floor(rand() * ELEMENT_POOL.length)] ?? 'N';
    const suit = ELEMENT_TO_SUIT[element];
    return {
      id: `exp-${nodeId}-${directionLabel}-${columnIndex}-${depthIndex}-${seed.toString(36)}`,
      rank,
      element,
      suit,
      tableauStepIndex: Math.max(1, DEFAULT_TABLEAU_DEPTH - depthIndex),
      tokenReward: element !== 'N' ? element : undefined,
      orimSlots: [],
    };
  }, [createPrng, hashString]);
  const createDeterministicTableaus = useCallback((nodeId: string, directionLabel: string) => {
    return Array.from({ length: DEFAULT_TABLEAU_COLUMNS }, (_, columnIndex) => (
      Array.from({ length: DEFAULT_TABLEAU_DEPTH }, (_, depthIndex) => (
        createDeterministicCard(nodeId, directionLabel, columnIndex, depthIndex)
      ))
    ));
  }, [createDeterministicCard]);
  const getMajorCacheKey = useCallback((nodeId: string, direction: MajorDirection) => `${nodeId}|major|${direction}`, []);
  const getMinorCenterCacheKey = useCallback((nodeId: string, direction: MinorDirection) => `${nodeId}|minor-center|${direction}`, []);
  const ensureMajorDirectionTableaus = useCallback((nodeId: string, direction: MajorDirection) => {
    const key = getMajorCacheKey(nodeId, direction);
    const cached = explorationMajorTableauCacheRef.current[key];
    if (cached) return cached;
    const generated = createDeterministicTableaus(nodeId, direction);
    explorationMajorTableauCacheRef.current[key] = generated;
    return generated;
  }, [createDeterministicTableaus, getMajorCacheKey]);
  const ensureMinorCenterTableau = useCallback((nodeId: string, direction: MinorDirection) => {
    const key = getMinorCenterCacheKey(nodeId, direction);
    const cached = explorationMinorCenterCacheRef.current[key];
    if (cached) return cached;
    const generated = createDeterministicTableaus(nodeId, direction)[3] ?? [];
    explorationMinorCenterCacheRef.current[key] = generated;
    return generated;
  }, [createDeterministicTableaus, getMinorCenterCacheKey]);
  const getDisplayTableausForHeading = useCallback((nodeId: string, direction: Direction): CardType[][] => {
    if (!hasPoiForNode(nodeId)) {
      return [];
    }
    const poiPresetTableaus = ensurePoiPresetTableaus(nodeId);
    if (poiPresetTableaus) {
      return cloneTableaus(poiPresetTableaus);
    }
    if (direction.length === 1) {
      return cloneTableaus(ensureMajorDirectionTableaus(nodeId, direction as MajorDirection));
    }
    const sources = getColumnSourcesForDirection(direction);
    const columns = sources.map((source) => {
      if (source.kind === 'major') {
        const major = ensureMajorDirectionTableaus(nodeId, source.direction);
        return major[source.columnIndex] ?? [];
      }
      return ensureMinorCenterTableau(nodeId, source.direction);
    });
    return cloneTableaus(columns);
  }, [cloneTableaus, ensureMajorDirectionTableaus, ensureMinorCenterTableau, ensurePoiPresetTableaus, hasPoiForNode]);
  const commitDisplayedTableausToCaches = useCallback((nodeId: string, direction: Direction, displayed: CardType[][]) => {
    const presetId = getPoiTableauPresetForNode(nodeId);
    if (presetId) {
      const cacheKey = `${nodeId}|poi|${presetId}`;
      if (presetId === 'initial_actions_00' || presetId === 'initial_actions_01' || presetId === 'initial_actions_02') {
        const previous = explorationPoiTableauCacheRef.current[cacheKey] ?? createPoiTableauPreset(presetId);
        const next = Array.from({ length: 7 }, (_, index) => {
          const prevTop = previous[index]?.[0];
          const currentTop = displayed[index]?.[displayed[index].length - 1];
          // Initial-actions POIs are single-row only: a column may keep its same card
          // or become empty, but never reveal a different card behind it.
          if (!prevTop) return [];
          if (!currentTop) return [];
          if (currentTop.id !== prevTop.id) return [];
          return [cloneCard(currentTop)];
        });
        explorationPoiTableauCacheRef.current[cacheKey] = next;
        return;
      }
      explorationPoiTableauCacheRef.current[cacheKey] = displayed.map((stack) => stack.map((card) => cloneCard(card)));
      return;
    }
    const sources = getColumnSourcesForDirection(direction);
    sources.forEach((source, index) => {
      const stack = displayed[index] ?? [];
      if (source.kind === 'major') {
        const majorKey = getMajorCacheKey(nodeId, source.direction);
        const major = explorationMajorTableauCacheRef.current[majorKey]
          ?? ensureMajorDirectionTableaus(nodeId, source.direction);
        major[source.columnIndex] = stack.map((card) => cloneCard(card));
        explorationMajorTableauCacheRef.current[majorKey] = major;
        return;
      }
      const minorKey = getMinorCenterCacheKey(nodeId, source.direction);
      explorationMinorCenterCacheRef.current[minorKey] = stack.map((card) => cloneCard(card));
    });
  }, [cloneCard, ensureMajorDirectionTableaus, getMajorCacheKey, getMinorCenterCacheKey, getPoiTableauPresetForNode]);
  const areTableausEquivalent = useCallback((left: CardType[][], right: CardType[][]) => {
    if (left.length !== right.length) return false;
    for (let col = 0; col < left.length; col += 1) {
      const l = left[col] ?? [];
      const r = right[col] ?? [];
      if (l.length !== r.length) return false;
      for (let row = 0; row < l.length; row += 1) {
        if (l[row]?.id !== r[row]?.id) return false;
      }
    }
    return true;
  }, []);
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
  const foundationOffset = cardHeight * 1.25;
  const handOffset = Math.max(12, Math.round(cardHeight * 0.35));
  const handCardScale = viewportAutoCardScaleFactor;
  const PARTY_BENCH_ENABLED = true;
  const playtestVariant = gameState.playtestVariant ?? 'single-foundation';
  const isSingleFoundationVariant = playtestVariant === 'single-foundation';
  const isRpgVariant = playtestVariant === 'rpg';
  const isPartyBattleVariant = playtestVariant === 'party-battle' || isRpgVariant;
  const isPartyFoundationsVariant = playtestVariant === 'party-foundations' || isPartyBattleVariant;
  const isEnemyTurn = isPartyBattleVariant && gameState.randomBiomeActiveSide === 'enemy';
  const [startOverlayPhase, setStartOverlayPhase] = useState<StartOverlayPhase>('ready');
  const [startCountdown, setStartCountdown] = useState(3);
  const [startTriggeredByPlay, setStartTriggeredByPlay] = useState(false);
  const introBlocking = startOverlayPhase !== 'done';
  const revealAllCardsForIntro = startOverlayPhase === 'countdown' || startOverlayPhase === 'go';
  useEffect(() => {
    if (!isRpgVariant && (inspectedRpgCard || activeEnemyHandActorIndex !== null || inspectedRpgCardSource)) {
      setInspectedRpgCard(null);
      setInspectedRpgCardSource(null);
      setActiveEnemyHandActorIndex(null);
    }
  }, [activeEnemyHandActorIndex, inspectedRpgCard, inspectedRpgCardSource, isRpgVariant]);
  useEffect(() => {
    if (!isRpgVariant || !inspectedRpgCard) return;
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
  }, [gameState.rpgEnemyHandCards, gameState.rpgHandCards, inspectedRpgCard, inspectedRpgCardSource, isRpgVariant]);
  const showWildAnalysis = isPartyFoundationsVariant && biomeDef?.id === 'random_wilds';
  const wildAnalysisCount = wildAnalysis?.maxCount ?? 0;
  const wildAnalysisReady = showWildAnalysis && wildAnalysisCount > 0;
  const wildAnalysisLabel = wildAnalysis ? String(wildAnalysisCount) : '--';
  const foundationGapPx = Math.max(2, Math.round((isPartyFoundationsVariant ? 8 : 20) * foundationCardScale));
  const foundationAccessoryGapPx = Math.max(10, Math.round(cardWidth * 0.18));
  const enemyFoundationGapPx = Math.max(16, Math.round(16 * 4 * foundationCardScale));
  const enemyFoundations = isPartyBattleVariant ? (gameState.enemyFoundations ?? []) : [];
  const enemyActors = isPartyBattleVariant ? (gameState.enemyActors ?? []) : [];
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
  const explorationModeActive = isRpgVariant && !enemyFoundations.some((foundation) => foundation.length > 0);
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
    if (!isRpgVariant || activeEnemyHandActorIndex === null) return;
    const cards = enemyRpgHandCards[activeEnemyHandActorIndex] ?? [];
    if (cards.length > 0) return;
    setActiveEnemyHandActorIndex(null);
    if (inspectedRpgCardSource?.side === 'enemy') {
      setInspectedRpgCard(null);
      setInspectedRpgCardSource(null);
    }
  }, [activeEnemyHandActorIndex, enemyRpgHandCards, inspectedRpgCardSource, isRpgVariant]);
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
    if (isRpgVariant) {
      return (gameState.rpgCloudSightUntil ?? 0) > Date.now();
    }
    if (isPartyFoundationsVariant) {
      return activeParty.some((actor) => actorHasOrimDefinition(gameState, actor.id, 'cloud_sight'));
    }
    if (!foundationHasActor) return false;
    const foundationActor = activeParty[0];
    if (!foundationActor) return false;
    return actorHasOrimDefinition(gameState, foundationActor.id, 'cloud_sight');
  }, [activeParty, gameState, foundationHasActor, isPartyFoundationsVariant, isRpgVariant]);
  const teamworkActive = useMemo(() => {
    return activeParty.some((actor) => actorHasOrimDefinition(gameState, actor.id, 'teamwork'));
  }, [activeParty, gameState]);
  const foundationOffsetAdjusted = cloudSightActive ? foundationOffset * 0.6 : foundationOffset;
  const handSlotStyle = {
    height: cardHeight * handCardScale + 4,
    minWidth: cardWidth * handCardScale * 2,
    marginTop: isPartyBattleVariant
      ? (isNarrowViewport ? 16 : 32)
      : 2 - Math.round(cardHeight * handCardScale),
  };
  const foundationsStackMarginTop = isPartyBattleVariant
    ? Math.max(10, Math.round(cardHeight * 0.22))
    : -foundationOffsetAdjusted;
  const battleSectionGap = isPartyBattleVariant ? 0 : 'clamp(6px, 1.8vh, 22px)';
  const CATEGORY_GLYPHS: Record<string, string> = {
    ability: '⚡️',
    utility: '💫',
    trait: '🧬',
  };
  const LEGACY_COMBAT_ORIMS = new Set(['scratch', 'bite', 'claw']);
  const orimChipSize = Math.max(22, Math.round(cardWidth * 0.66));
  const orimFontSize = Math.max(12, Math.round(orimChipSize * 0.55));
  const showPartyOrims = false;
  const showPartyOrimsSection = showPartyOrims && !isPartyBattleVariant;
  const MAX_COMBO_FLASH = 15;
  const TOKEN_ORDER: Element[] = ['W', 'E', 'A', 'F', 'D', 'L', 'N'];
  const SHOW_FOUNDATION_TOKEN_BADGES = false;
  const ACTOR_LINE_COLORS: Record<string, string> = {
    fox: '#e6b31e',
    wolf: '#f0f0f0',
    owl: '#fff5cc',
  };
  const COMBO_FLASH_SCALING_ENABLED = true;
  const foundationActor = foundationHasActor ? activeParty[0] ?? null : null;
  const equippedOrims = useMemo(() => {
    const actors = isPartyFoundationsVariant
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
  }, [activeParty, foundationActor, gameState.orimDefinitions, gameState.orimInstances, isPartyFoundationsVariant, orimTrayDevMode]);

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
    if (!isSingleFoundationVariant) return [];
    const partySlice = foundationHasActor ? activeParty.slice(1, 3) : activeParty.slice(0, 2);
    return partySlice
      .map((actor) => {
        const definition = getActorDefinition(actor.definitionId);
        if (!definition) return null;
        return { actorId: actor.id, definition };
      })
      .filter((entry): entry is { actorId: string; definition: ActorDefinition } => Boolean(entry));
  }, [activeParty, foundationHasActor, isSingleFoundationVariant]);
  const foundationOrimInstances = isPartyBattleVariant ? undefined : gameState.orimInstances;
  const foundationOrimDefinitions = isPartyBattleVariant ? undefined : gameState.orimDefinitions;
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
  const owlOverwatchActorId = useMemo(() => {
    const owlActor = activeParty.find((actor) => actor.definitionId === 'owl');
    if (!owlActor) return null;
    const apexEnhancement = actorNodeAssignments[owlActor.id]?.apex;
    if (!apexEnhancement || apexEnhancement.trim().toLowerCase() !== 'zephyr') return null;
    return owlActor.id;
  }, [activeParty, actorNodeAssignments]);
  const wolfPackMomentumActorId = useMemo(() => {
    const wolfActor = activeParty.find((actor) => actor.definitionId === 'wolf');
    if (!wolfActor) return null;
    const apexEnhancement = actorNodeAssignments[wolfActor.id]?.apex;
    if (!apexEnhancement || apexEnhancement.trim().toLowerCase() !== 'ferocity') return null;
    return wolfActor.id;
  }, [activeParty, actorNodeAssignments]);
  const packMomentumActive = !!wolfPackMomentumActorId;
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
  const owlOverwatchMilestoneRef = useRef(0);
  useEffect(() => {
    if (!owlOverwatchActorId) {
      owlOverwatchMilestoneRef.current = 0;
      setOwlOverwatchUntilMs(0);
      setOwlExplorationRevealByNode({});
      return;
    }
    const milestone = Math.floor(Math.max(0, partyComboTotal) / 5);
    if (milestone <= 0) {
      owlOverwatchMilestoneRef.current = 0;
      return;
    }
    if (milestone > owlOverwatchMilestoneRef.current) {
      owlOverwatchMilestoneRef.current = milestone;
      setOwlOverwatchUntilMs(Date.now() + 5000);
      const isExploringWithoutEnemies = isRpgVariant && !enemyFoundations.some((foundation) => foundation.length > 0);
      if (isExploringWithoutEnemies) {
        const nodeId = explorationCurrentNodeIdRef.current;
        setOwlExplorationRevealByNode((prev) => {
          const existingForNode = prev[nodeId] ?? {};
          const nextForNode = { ...existingForNode };
          gameState.tableaus.forEach((tableau, tableauIndex) => {
            const secondCard = tableau.length >= 2 ? tableau[tableau.length - 2] : null;
            if (secondCard) {
              nextForNode[tableauIndex] = secondCard.id;
            }
          });
          return {
            ...prev,
            [nodeId]: nextForNode,
          };
        });
      }
    }
  }, [enemyFoundations, gameState.tableaus, isRpgVariant, owlOverwatchActorId, partyComboTotal]);
  useEffect(() => {
    const nodeId = explorationCurrentNodeId;
    setOwlExplorationRevealByNode((prev) => {
      const nodeMap = prev[nodeId] ?? {};
      const nextNodeMap: Record<number, string | null> = {};
      let changed = false;
      for (const [indexKey, cardId] of Object.entries(nodeMap)) {
        if (!cardId) continue;
        const tableauIndex = Number(indexKey);
        const tableau = gameState.tableaus[tableauIndex] ?? [];
        const stillExists = tableau.some((card) => card.id === cardId);
        if (stillExists) {
          nextNodeMap[tableauIndex] = cardId;
        } else {
          changed = true;
        }
      }
      if (!changed && Object.keys(nextNodeMap).length === Object.keys(nodeMap).length) return prev;
      return {
        ...prev,
        [nodeId]: nextNodeMap,
      };
    });
  }, [explorationCurrentNodeId, gameState.tableaus]);
  useEffect(() => {
    if (owlOverwatchUntilMs <= 0) return;
    const remainingMs = owlOverwatchUntilMs - Date.now();
    if (remainingMs <= 0) {
      setOwlOverwatchUntilMs(0);
      return;
    }
    const timeoutId = window.setTimeout(() => setOwlOverwatchUntilMs(0), remainingMs + 20);
    return () => window.clearTimeout(timeoutId);
  }, [owlOverwatchUntilMs]);
  const owlOverwatchActive = !!owlOverwatchActorId && Date.now() < owlOverwatchUntilMs;
  const owlExplorationRevealMap = owlExplorationRevealByNode[explorationCurrentNodeId] ?? {};
  useEffect(() => {
    if (!owlOverwatchActive) return;
    setOverwatchClockMs(Date.now());
    const intervalId = window.setInterval(() => {
      setOverwatchClockMs(Date.now());
    }, 50);
    return () => window.clearInterval(intervalId);
  }, [owlOverwatchActive]);
  useEffect(() => {
    if (!isPartyBattleVariant || isRpgVariant) {
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
  }, [isPartyBattleVariant, isRpgVariant, partyComboTotal]);
  const unlockedBattleHandCards = useMemo<CardType[]>(() => {
    if (!isPartyBattleVariant) return [];
    if (isRpgVariant) return gameState.rpgHandCards ?? [];
    return rewardedBattleHandCards;
  }, [gameState.rpgHandCards, isPartyBattleVariant, isRpgVariant, rewardedBattleHandCards]);
  const owlOverwatchRemainingMs = Math.max(0, owlOverwatchUntilMs - overwatchClockMs);
  const owlOverwatchStatusCard = useMemo<CardType | null>(() => {
    if (!owlOverwatchActorId || owlOverwatchRemainingMs <= 0) return null;
    return {
      id: 'status-overwatch',
      rank: 0,
      element: 'N',
      suit: ELEMENT_TO_SUIT.N,
      rarity: 'uncommon',
      cooldown: owlOverwatchRemainingMs,
      maxCooldown: 5000,
    };
  }, [owlOverwatchActorId, owlOverwatchRemainingMs]);
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
  const playerHandCardsWithOverwatch = useMemo<CardType[]>(
    () => (owlOverwatchStatusCard ? [owlOverwatchStatusCard, ...unlockedBattleHandCards] : unlockedBattleHandCards),
    [owlOverwatchStatusCard, unlockedBattleHandCards]
  );
  const playerHandCardsWithStatuses = useMemo<CardType[]>(
    () => (rewindHandCard ? [rewindHandCard, ...playerHandCardsWithOverwatch] : playerHandCardsWithOverwatch),
    [playerHandCardsWithOverwatch, rewindHandCard]
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
  const shouldRenderPlayerHand = isPartyBattleVariant && (!explorationModeActive || activePlayerHandActorIndex !== null);
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
  useEffect(() => {
    if (!isRpgVariant) return;
    const current = gameState.rpgHandCards ?? [];
    const currentIds = new Set(current.map((card) => card.id));
    const isUpgradedRpcCard = (card: CardType) => {
      const levelMatch = card.id.match(/-lvl-(\d+)-/);
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
  }, [gameState.rpgHandCards, isRpgVariant]);
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
  const rpgDragDamagePreview = useMemo<RpgDragDamagePreview | null>(() => {
    if (!isRpgVariant) return null;
    if (!dragState.isDragging || dragState.tableauIndex !== HAND_SOURCE_INDEX) return null;
    const draggedCard = dragState.card;
    if (!draggedCard || !draggedCard.id.startsWith('rpg-')) return null;
    if (draggedCard.id.startsWith('rpg-cloud-sight-')) return null;

    const pointerX = dragState.position.x + dragState.offset.x;
    const pointerY = dragState.position.y + dragState.offset.y;
    const targetEl = document
      .elementsFromPoint(pointerX, pointerY)
      .map((node) => (node as HTMLElement).closest?.('[data-rpg-actor-target="true"]') as HTMLElement | null)
      .find((entry): entry is HTMLElement => !!entry) ?? null;
    if (!targetEl) return null;

    const sideAttr = targetEl.getAttribute('data-rpg-actor-side');
    const indexAttr = targetEl.getAttribute('data-rpg-actor-index');
    if (sideAttr !== 'player' && sideAttr !== 'enemy') return null;
    const actorIndex = Number(indexAttr);
    if (!Number.isFinite(actorIndex) || actorIndex < 0) return null;

    type RpcFamily = 'scratch' | 'bite' | 'peck';
    const getRpcFamily = (id: string): RpcFamily | null => {
      if (id.startsWith('rpg-scratch-')) return 'scratch';
      if (id.startsWith('rpg-bite-') || id.startsWith('rpg-vice-bite-')) return 'bite';
      if (id.startsWith('rpg-peck-') || id.startsWith('rpg-blinding-peck-')) return 'peck';
      return null;
    };
    const getRpcCount = (id: string): number => {
      if (id.startsWith('rpg-scratch-lvl-') || id.startsWith('rpg-bite-lvl-') || id.startsWith('rpg-peck-lvl-')) {
        const match = id.match(/-lvl-(\d+)-/);
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
    if (!family) return null;
    const count = getRpcCount(draggedCard.id);
    const baseDamage = getRpcDamage(family, count);
    if (baseDamage <= 0) return null;

    const side = sideAttr as HpBarSide;
    const targetActor = side === 'enemy'
      ? (gameState.enemyActors ?? [])[actorIndex]
      : ((gameState.activeSessionTileId ? (gameState.tileParties[gameState.activeSessionTileId] ?? []) : [])[actorIndex]);
    if (!targetActor || (targetActor.hp ?? 0) <= 0) return null;

    const sourceActor = draggedCard.sourceActorId
      ? [...activeParty, ...(gameState.enemyActors ?? [])].find((actor) => actor.id === draggedCard.sourceActorId)
      : null;
    const attackerAccuracy = sourceActor?.accuracy ?? 100;
    const now = Date.now();
    const soarActive = (gameState.rpgSoarEvasionUntil ?? 0) > now
      && gameState.rpgSoarEvasionActorId === targetActor.id
      && (gameState.rpgSoarEvasionSide ?? 'player') === side;
    const targetEvasion = (targetActor.evasion ?? 0) + (soarActive ? 75 : 0);
    const hitChance = clampPercent(attackerAccuracy - targetEvasion);
    const damage = Math.max(0, baseDamage - (targetActor.armor ?? 0));
    if (damage <= 0) return null;

    return { side, actorIndex, damage, hitChance };
  }, [
    activeParty,
    dragState.card,
    dragState.isDragging,
    dragState.offset.x,
    dragState.offset.y,
    dragState.position.x,
    dragState.position.y,
    dragState.tableauIndex,
    gameState.activeSessionTileId,
    gameState.enemyActors,
    gameState.rpgSoarEvasionActorId,
    gameState.rpgSoarEvasionSide,
    gameState.rpgSoarEvasionUntil,
    gameState.tileParties,
    isRpgVariant,
  ]);
  const renderHpLabel = (actor: Actor | null | undefined, side: HpBarSide = 'player', actorIndex = -1) => {
    if (!isRpgVariant || !actor) return null;
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
  const [statusClockMs, setStatusClockMs] = useState(() => Date.now());
  useEffect(() => {
    if (!isRpgVariant) return;
    const intervalId = window.setInterval(() => {
      setStatusClockMs(Date.now());
    }, 100);
    return () => window.clearInterval(intervalId);
  }, [isRpgVariant]);
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
    if (!isRpgVariant || !actor) return [];
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
    isRpgVariant,
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
    if (!actor) return null;
    const actorName = getActorDefinition(actor.definitionId)?.name ?? actor.definitionId;
    return (
      <div
        className="mt-1 text-[10px] font-bold tracking-[2px] uppercase"
        style={{
          color: '#e2e8f0',
          textShadow: '0 0 8px rgba(255,255,255,0.35)',
        }}
      >
        {actorName}
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
    if (isGamePaused && !(isRpgVariant && tableauIndex === HAND_SOURCE_INDEX)) return;
    if (isEnemyTurn && !(isRpgVariant && tableauIndex === HAND_SOURCE_INDEX)) return;
    handleDragStart(card, tableauIndex, clientX, clientY, rect);
  }, [handleDragStart, introBlocking, isEnemyTurn, isGamePaused, isRpgVariant]);
  useEffect(() => {
    if (!isRpgVariant) return;
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
  }, [activeParty, enemyActors, isRpgVariant]);

  useEffect(() => {
    if (!isRpgVariant || !rpgImpactSplashHint || !watercolorEngine) return;
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
  }, [isRpgVariant, rpgImpactSplashHint, watercolorEngine]);
  const handleActorFoundationLongPress = useCallback((actor: Actor) => {
    setInspectedActorId(actor.id);
    setInspectedRpgCard(null);
    setInspectedRpgCardSource(null);
  }, []);
  const rpgCardInspectOverlay = (
    <RpgCardInspectOverlay
      card={inspectedRpgCard}
      open={isRpgVariant && !!inspectedRpgCard}
      onClose={() => {
        setInspectedRpgCard(null);
        setInspectedRpgCardSource(null);
      }}
      onAdjustRarity={(delta) => {
        if (!inspectedRpgCard || inspectedRpgCardSource?.side !== 'player') return;
        actions.adjustRpgHandCardRarity?.(inspectedRpgCard.id, delta);
      }}
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
      owlOverwatchActive={owlOverwatchActive}
      owlOverwatchRemainingMs={owlOverwatchRemainingMs}
      wolfPackMomentumActive={packMomentumActive}
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
  const noopEnemyHandDragStart = useCallback((
    _card: CardType,
    _tableauIndex: number,
    _clientX: number,
    _clientY: number,
    _rect: DOMRect,
  ) => {}, []);
  const enemyHandOverlayOpen = isRpgVariant && activeEnemyHandActorIndex !== null && activeEnemyHandCards.length > 0;
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
            stockCount={0}
            showGraphics={showGraphics}
            interactionMode="click"
            draggingCardId={null}
            isAnyCardDragging={dragState.isDragging}
            hideElements={isRpgVariant}
          />
        </div>
      </div>
    </CombatOverlayFrame>
  );
  const isInspectOverlayActive = (isRpgVariant && !!inspectedRpgCard) || !!inspectedActor;
  const formatBankSeconds = useCallback((ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}s`, []);
  const timerBankVisuals = (
    <>
      {bankCallouts.map((entry) => (
        <div
          key={entry.id}
          className="fixed left-14 bottom-24 z-[10026] pointer-events-none rounded border px-2 py-1 text-[11px] font-bold tracking-[1px]"
          style={{
            color: '#f7d24b',
            borderColor: 'rgba(255, 229, 120, 0.85)',
            backgroundColor: 'rgba(10, 8, 6, 0.92)',
            boxShadow: '0 0 14px rgba(230, 179, 30, 0.55)',
            animation: 'bank-callout-fade 1.7s ease-out forwards',
          }}
        >
          +{formatBankSeconds(entry.ms)} banked
        </div>
      ))}
      {enemyTurnEndCallouts.map((entry) => (
        <div
          key={entry.id}
          className="fixed left-14 bottom-20 z-[10026] pointer-events-none rounded border px-2 py-1 text-[11px] font-bold tracking-[1px]"
          style={{
            color: '#f7d24b',
            borderColor: 'rgba(255, 229, 120, 0.85)',
            backgroundColor: 'rgba(10, 8, 6, 0.92)',
            boxShadow: '0 0 14px rgba(230, 179, 30, 0.55)',
            animation: 'bank-callout-fade 1.7s ease-out forwards',
          }}
        >
          ENEMY TURN ENDED
        </div>
      ))}
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
        @keyframes bank-callout-fade {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-24px); }
        }
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
        const glyph = definition.behaviorId === 'turtle_bide_v1'
          ? '🛡'
          : (definition.behaviorId === 'heart_of_wild_v1'
            ? '🐾'
          : (definition.behaviorId === CONTROLLED_DRAGONFIRE_BEHAVIOR_ID
            ? '🐉'
          : (definition.behaviorId === 'koi_coin_v1' ? '🪙' : (
            definition.behaviorId === 'hindsight_v1' ? '⌛' : (
            definition.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((chunk) => chunk[0]?.toUpperCase() ?? '')
              .join('') || 'R'
            )
          ))));
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
          const relicAccent = isTurtleBide
            ? 'rgba(90, 170, 255, 0.75)'
            : (isControlledDragonfire ? 'rgba(255, 118, 82, 0.78)' : 'rgba(255, 215, 64, 0.6)');
          const relicText = isTurtleBide ? '#6cb6ff' : (isControlledDragonfire ? '#ff8e66' : '#ffd740');
          const relicBg = isTurtleBide ? 'rgba(6, 14, 30, 0.78)' : (isControlledDragonfire ? 'rgba(26, 8, 5, 0.8)' : 'rgba(18, 12, 2, 0.72)');
          const relicGlowIdle = isTurtleBide
            ? '0 0 8px rgba(90, 170, 255, 0.3)'
            : (isControlledDragonfire ? '0 0 8px rgba(255, 118, 82, 0.3)' : '0 0 8px rgba(255, 215, 64, 0.25)');
          const relicGlowActive = isTurtleBide
            ? '0 0 22px rgba(90, 170, 255, 0.95), 0 0 42px rgba(70, 140, 255, 0.75)'
            : (isControlledDragonfire
              ? '0 0 22px rgba(255, 118, 82, 0.95), 0 0 42px rgba(255, 80, 56, 0.75)'
              : '0 0 22px rgba(255, 215, 64, 0.95), 0 0 42px rgba(255, 185, 40, 0.75)');
          const canDevActivate = relicDevModeEnabled
            && definition.behaviorId === 'turtle_bide_v1'
            && !!actions.processRelicCombatEvent;
          const canControlledDragonfireActivate = definition.behaviorId === CONTROLLED_DRAGONFIRE_BEHAVIOR_ID
            && isRpgVariant
            && !!partyLeaderActor
            && !!actions.addRpgHandCard;
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
                  if (!canControlledDragonfireActivate) return;
                  handleControlledDragonfireRelicClick();
                }}
                style={{
                  borderColor: relicAccent,
                  color: relicText,
                  backgroundColor: relicBg,
                  boxShadow: justActivated
                    ? relicGlowActive
                    : relicGlowIdle,
                  animation: justActivated ? 'relic-activation-flash 880ms cubic-bezier(0.2, 0.9, 0.25, 1) 1' : undefined,
                  cursor: canControlledDragonfireActivate ? 'pointer' : 'help',
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
    if (!isPartyBattleVariant) return;
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
  }, [isEnemyTurn, isPartyBattleVariant, zenModeEnabled]);
  useEffect(() => {
    const wasEnemyTurn = prevEnemyTurnForBankRef.current;
    const becamePlayerTurn = wasEnemyTurn && !isEnemyTurn;
    if (becamePlayerTurn && bankedTurnMs > 0 && !introBlocking && isRpgVariant) {
      const bonus = bankedTurnMs;
      setBankedTimerBonusMs(bonus);
      setBankedTimerBonusToken(Date.now() + Math.random());
      setBankSmashFx({ id: Date.now() + Math.random(), ms: bonus });
      setBankedTurnMs(0);
      window.setTimeout(() => setBankSmashFx(null), 1100);
    }
    prevEnemyTurnForBankRef.current = isEnemyTurn;
  }, [bankedTurnMs, introBlocking, isEnemyTurn, isRpgVariant]);

  useEffect(() => {
    if (introBlocking) return;
    if (!isPartyBattleVariant) return;
    if (zenModeEnabled) return;
    if (isEnemyTurn) return;
    setComboPaused(false);
  }, [introBlocking, isEnemyTurn, isPartyBattleVariant, zenModeEnabled]);
  useEffect(() => {
    rpgTickClockRef.current = Date.now();
    rpgTickLastRealNowRef.current = performance.now();
  }, [timeScale]);
  useEffect(() => {
    if (!isRpgVariant) return;
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
  }, [actions, introBlocking, isGamePaused, isRpgVariant, timeScale]);
  const registerEnemyReveal = useCallback((foundationIndex: number, value: number) => {
    setEnemyRevealMap((prev) => ({ ...prev, [foundationIndex]: value }));
    const existing = enemyRevealTimers.current[foundationIndex];
    if (existing) window.clearTimeout(existing);
    enemyRevealTimers.current[foundationIndex] = window.setTimeout(() => {
      setEnemyRevealMap((prev) => ({ ...prev, [foundationIndex]: null }));
    }, 3000);
  }, []);
  const handleComboExpire = useCallback((value: number) => {
    if (!isRpgVariant) {
      const id = comboTokenIdRef.current++;
      setComboExpiryTokens((current) => [...current, { id, value }]);
    }
    if (isPartyBattleVariant && !zenModeEnabled && !isEnemyTurn) {
      setComboPaused(true);
      (actions.advanceRandomBiomeTurn ?? actions.endRandomBiomeTurn)();
    }
  }, [
    actions.advanceRandomBiomeTurn,
    actions.endRandomBiomeTurn,
    isEnemyTurn,
    isRpgVariant,
    isPartyBattleVariant,
    zenModeEnabled,
  ]);
  const maybeGainSupplyFromValidMove = useCallback(() => {
    if (!isRpgVariant) return;
    if (Math.random() <= 0.05) {
      setExplorationSupplies((current) => current + 1);
    }
  }, [isRpgVariant]);
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
  const hasSpawnedEnemies = !isRpgVariant || enemyFoundations.some((foundation) => foundation.length > 0);
  const isExplorationMode = isRpgVariant && !hasSpawnedEnemies;
  const showActorComboCounts = !isRpgVariant || hasSpawnedEnemies;
  useEffect(() => {
    if ((hasSpawnedEnemies || !isRpgVariant) && mapVisible) {
      setMapVisible(false);
    }
  }, [hasSpawnedEnemies, isRpgVariant, mapVisible]);
  const mapToggleButton = isRpgVariant && !hasSpawnedEnemies ? (
    <button
      type="button"
      onClick={() => setMapVisible((prev) => !prev)}
      className="rounded border border-game-teal/70 bg-game-bg-dark/90 px-3 py-2 text-[12px] font-bold tracking-[1px] text-game-teal shadow-neon-teal"
      style={{
        boxShadow: mapVisible ? '0 0 12px rgba(127, 219, 202, 0.55)' : undefined,
      }}
      title="Toggle exploration map"
      aria-pressed={mapVisible}
    >
      🗺 {mapVisible ? 'HIDE' : 'MAP'}
    </button>
  ) : null;
  const spawnButton = isRpgVariant ? (
    <button
      type="button"
      onClick={() => actions.spawnRandomEnemyInRandomBiome?.()}
      disabled={!actions.spawnRandomEnemyInRandomBiome}
      className="rounded border border-game-red/70 bg-game-bg-dark/90 px-3 py-2 text-[14px] font-bold tracking-[1px] text-game-red shadow-neon-red disabled:opacity-50"
      title="Spawn enemy"
    >
      ⚔
    </button>
  ) : null;
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
      {mapToggleButton}
      {spawnButton}
      {pauseButton}
    </div>
  ) : null;
  const activeTravelDirection = (explorationHeading.length === 1 ? explorationHeading : explorationHeading[0]) as MajorDirection;
  const travelRowsPerStep = Math.max(1, explorationRowsPerStep);
  const currentDirectionMoves = explorationMovesByDirection[activeTravelDirection] ?? 0;
  const consumedDirectionRows = (explorationAppliedTraversalByDirection[activeTravelDirection] ?? 0) * travelRowsPerStep;
  const pendingDirectionRows = Math.max(0, currentDirectionMoves - consumedDirectionRows);
  const isDevModeHashEnabled = useDevModeFlag();
  const devTraverseHoldEnabled = isDevModeHashEnabled;
  const isExplorationApLocked = explorationApLockFloor !== null;
  const availableExplorationActionPoints = isExplorationApLocked
    ? Math.max(pendingDirectionRows, explorationApLockFloor ?? 0)
    : pendingDirectionRows;
  const explorationTravelProgress = Math.min(travelRowsPerStep, availableExplorationActionPoints);
  const canStepForwardInExploration = availableExplorationActionPoints >= travelRowsPerStep;
  const explorationAppliedTraversalCount = explorationTotalTraversalCount;
  useEffect(() => {
    if (!isDevModeHashEnabled) {
      setExplorationApLockFloor(null);
    }
  }, [isDevModeHashEnabled]);
  const getDisplayedStepIndexForColumn = useCallback((columnIndex: number) => {
    const sources = getColumnSourcesForDirection(explorationHeading);
    const source = sources[columnIndex];
    if (!source) return 1;
    const sourceKey = getExplorationSourceKey(explorationCurrentNodeId, source);
    return (explorationStepOffsetBySource[sourceKey] ?? 0) + 1;
  }, [explorationCurrentNodeId, explorationHeading, explorationStepOffsetBySource]);
  const getDebugStepLabelForColumn = useCallback((columnIndex: number) => {
    if (!(isRpgVariant && !hasSpawnedEnemies)) return null;
    const sources = getColumnSourcesForDirection(explorationHeading);
    const source = sources[columnIndex];
    if (!source) return null;
    const sourceKey = getExplorationSourceKey(explorationCurrentNodeId, source);
    const step = (explorationStepOffsetBySource[sourceKey] ?? 0) + 1;
    return `${sourceKey} | s:${step}`;
  }, [
    explorationCurrentNodeId,
    explorationHeading,
    explorationStepOffsetBySource,
    hasSpawnedEnemies,
    isRpgVariant,
  ]);
  useEffect(() => {
    if (!(isRpgVariant && !hasSpawnedEnemies)) return;
    setExplorationNodes([{ id: 'origin', heading: 'N', x: 0, y: 0, z: 0, visits: 1 }]);
    explorationNodesRef.current = [{ id: 'origin', heading: 'N', x: 0, y: 0, z: 0, visits: 1 }];
    setExplorationEdges([]);
    explorationEdgesRef.current = [];
    setExplorationCurrentNodeId('origin');
    explorationCurrentNodeIdRef.current = 'origin';
    setExplorationTrailNodeIds(['origin']);
    explorationTrailNodeIdsRef.current = ['origin'];
    setExplorationHeading('N');
    explorationHeadingRef.current = 'N';
    setExplorationStepOffsetBySource({});
    setExplorationMovesByDirection({
      N: 0,
      E: 0,
      S: 0,
      W: 0,
    });
    setExplorationAppliedTraversalByDirection({
      N: 0,
      E: 0,
      S: 0,
      W: 0,
    });
    setExplorationTotalTraversalCount(0);
    explorationLastTopCardIdBySourceRef.current = {};
    explorationDisplayedContextRef.current = null;
    explorationMajorTableauCacheRef.current = {};
    explorationMinorCenterCacheRef.current = {};
    explorationPoiTableauCacheRef.current = {};
    setOwlExplorationRevealByNode({});
    setExplorationApLockFloor(null);
  }, [gameState.currentBiome, hasSpawnedEnemies, isRpgVariant]);
  const handleExplorationHeadingChange = useCallback((direction: Direction) => {
    if (isRpgVariant && !hasSpawnedEnemies) {
      triggerExplorationTableauSlide(explorationHeadingRef.current, direction);
    }
    setExplorationHeading(direction);
  }, [hasSpawnedEnemies, isRpgVariant, triggerExplorationTableauSlide]);
  const handleExplorationHeadingStep = useCallback((clockwise: boolean) => {
    const idx = DIRECTIONS.indexOf(explorationHeading);
    if (idx < 0) return;
    const next = DIRECTIONS[(idx + (clockwise ? 1 : -1) + DIRECTIONS.length) % DIRECTIONS.length];
    handleExplorationHeadingChange(next);
  }, [explorationHeading, handleExplorationHeadingChange]);
  const explorationCurrentCoordsLabel = useMemo(() => {
    const coords = getExplorationNodeCoordinates(explorationCurrentNodeId);
    if (!coords) return '?,?';
    return `${coords.x},${coords.y}`;
  }, [explorationCurrentNodeId, getExplorationNodeCoordinates]);
  const advanceExplorationMap = useCallback((direction: Direction) => {
    const compassDelta: Record<Direction, { dx: number; dy: number }> = {
      N: { dx: 0, dy: -1 }, NE: { dx: 1, dy: -1 }, E: { dx: 1, dy: 0 }, SE: { dx: 1, dy: 1 },
      S: { dx: 0, dy: 1 }, SW: { dx: -1, dy: 1 }, W: { dx: -1, dy: 0 }, NW: { dx: -1, dy: -1 },
    };
    const prevNodes = explorationNodesRef.current;
    const currentNode = prevNodes.find((node) => node.id === explorationCurrentNodeIdRef.current) ?? prevNodes[0];
    if (!currentNode) return;
    const { dx, dy } = compassDelta[direction] ?? { dx: 0, dy: -1 };
    const targetX = currentNode.x + dx;
    const targetY = currentNode.y + dy;
    const existingIndex = prevNodes.findIndex((node) => node.x === targetX && node.y === targetY);
    let nextNodes: ExplorationMapNode[];
    let targetNodeId: string;
    if (existingIndex >= 0) {
      targetNodeId = prevNodes[existingIndex].id;
      nextNodes = prevNodes.map((node, index) => (
        index === existingIndex ? { ...node, visits: node.visits + 1, heading: direction } : node
      ));
    } else {
      const newId = `node-${targetX}-${targetY}`;
      targetNodeId = newId;
      const depth = Math.min(6, Math.floor(prevNodes.length / 3));
      nextNodes = [...prevNodes, { id: newId, heading: direction, x: targetX, y: targetY, z: depth, visits: 1 }];
    }
    const edgeKey = `${currentNode.id}->${targetNodeId}`;
    const prevEdges = explorationEdgesRef.current;
    const foundEdge = prevEdges.find((edge) => edge.id === edgeKey);
    const nextEdges = foundEdge
      ? prevEdges.map((edge) => (edge.id === edgeKey ? { ...edge, traversals: edge.traversals + 1 } : edge))
      : [...prevEdges, { id: edgeKey, fromId: currentNode.id, toId: targetNodeId, traversals: 1 }];
    const nextTrail = [...explorationTrailNodeIdsRef.current, targetNodeId];
    // Update refs synchronously before calling setters
    explorationCurrentNodeIdRef.current = targetNodeId;
    explorationNodesRef.current = nextNodes;
    explorationEdgesRef.current = nextEdges;
    explorationTrailNodeIdsRef.current = nextTrail;
    // Call all setters at top level — no nesting, no functional updaters
    setExplorationNodes(nextNodes);
    setExplorationCurrentNodeId(targetNodeId);
    setExplorationTrailNodeIds(nextTrail);
    setExplorationEdges(nextEdges);
  }, []);
  const teleportToExplorationNode = useCallback((targetX: number, targetY: number) => {
    const prevNodes = explorationNodesRef.current;
    const existingIndex = prevNodes.findIndex((n) => n.x === targetX && n.y === targetY);
    let nextNodes: ExplorationMapNode[];
    let targetNodeId: string;
    if (existingIndex >= 0) {
      targetNodeId = prevNodes[existingIndex].id;
      nextNodes = prevNodes.map((n, i) =>
        i === existingIndex ? { ...n, visits: n.visits + 1 } : n,
      );
    } else {
      targetNodeId = `node-${targetX}-${targetY}`;
      const depth = Math.min(6, Math.floor(prevNodes.length / 3));
      nextNodes = [...prevNodes, {
        id: targetNodeId,
        heading: explorationHeadingRef.current,
        x: targetX,
        y: targetY,
        z: depth,
        visits: 1,
      }];
    }
    const nextTrail = [...explorationTrailNodeIdsRef.current, targetNodeId];
    explorationCurrentNodeIdRef.current = targetNodeId;
    explorationNodesRef.current = nextNodes;
    explorationTrailNodeIdsRef.current = nextTrail;
    setExplorationNodes(nextNodes);
    setExplorationCurrentNodeId(targetNodeId);
    setExplorationTrailNodeIds(nextTrail);
  }, []);
  const awardExplorationActionPoint = useCallback((points = 1) => {
    if (!isExplorationMode) return;
    if (points <= 0) return;
    setExplorationMovesByDirection((prev) => ({
      ...prev,
      [activeTravelDirection]: (prev[activeTravelDirection] ?? 0) + points,
    }));
  }, [activeTravelDirection, isExplorationMode]);
  useEffect(() => {
    if (!(isRpgVariant && !hasSpawnedEnemies)) return;
    if (!actions.setBiomeTableaus) return;
    const nodeId = explorationCurrentNodeId;
    const heading = explorationHeading;
    const currentDisplay = gameState.tableaus;
    const displayedContext = explorationDisplayedContextRef.current;
    if (displayedContext) {
      commitDisplayedTableausToCaches(displayedContext.nodeId, displayedContext.heading, currentDisplay);
    }
    const desiredDisplay = getDisplayTableausForHeading(nodeId, heading);
    if (!areTableausEquivalent(currentDisplay, desiredDisplay)) {
      actions.setBiomeTableaus(desiredDisplay);
      explorationDisplayedContextRef.current = { nodeId, heading };
      return;
    }
    explorationDisplayedContextRef.current = { nodeId, heading };
  }, [
    actions.setBiomeTableaus,
    areTableausEquivalent,
    commitDisplayedTableausToCaches,
    explorationCurrentNodeId,
    explorationHeading,
    gameState.tableaus,
    getDisplayTableausForHeading,
    hasSpawnedEnemies,
    isRpgVariant,
  ]);
  useEffect(() => {
    if (!(isRpgVariant && !hasSpawnedEnemies)) return;
    const sources = getColumnSourcesForDirection(explorationHeading);
    if (sources.length === 0) return;
    const increments: Record<string, number> = {};
    sources.forEach((source, columnIndex) => {
      const sourceKey = getExplorationSourceKey(explorationCurrentNodeId, source);
      const nextTopId = gameState.tableaus[columnIndex]?.[gameState.tableaus[columnIndex].length - 1]?.id ?? '';
      const prevTopId = explorationLastTopCardIdBySourceRef.current[sourceKey];
      if (prevTopId !== undefined && prevTopId !== nextTopId) {
        increments[sourceKey] = (increments[sourceKey] ?? 0) + 1;
      }
      explorationLastTopCardIdBySourceRef.current[sourceKey] = nextTopId;
    });
    if (Object.keys(increments).length > 0) {
      setExplorationStepOffsetBySource((prev) => {
        const next = { ...prev };
        Object.entries(increments).forEach(([key, value]) => {
          next[key] = (next[key] ?? 0) + value;
        });
        return next;
      });
    }
  }, [
    explorationCurrentNodeId,
    explorationHeading,
    gameState.tableaus,
    hasSpawnedEnemies,
    isRpgVariant,
  ]);
  useEffect(() => {
    if (!isRpgVariant) return;
    if (hasSpawnedEnemies) return;
    if (!noValidMoves) return;
    actions.processRelicCombatEvent?.({
      type: 'NO_PLAYABLE_MOVES',
      side: 'player',
    });
  }, [actions, hasSpawnedEnemies, isRpgVariant, noValidMoves]);
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
  const canTriggerEndTurnFromCombo = isPartyBattleVariant && !isEnemyTurn && !introBlocking;
  const handleExplorationStepForward = useCallback(() => {
    if (!(isRpgVariant && !hasSpawnedEnemies)) return;
    if (!canStepForwardInExploration) return;
    advanceExplorationMap(explorationHeading);
    setExplorationAppliedTraversalByDirection((prev) => ({
      ...prev,
      [activeTravelDirection]: (prev[activeTravelDirection] ?? 0) + 1,
    }));
    setExplorationTotalTraversalCount((prev) => prev + 1);
  }, [
    activeTravelDirection,
    advanceExplorationMap,
    canStepForwardInExploration,
    explorationHeading,
    hasSpawnedEnemies,
    isRpgVariant,
  ]);
  const stepExplorationOnPlay = useCallback(() => {
    if (!isExplorationMode) return;
    advanceExplorationMap(explorationHeading);
    setExplorationAppliedTraversalByDirection((prev) => ({
      ...prev,
      [activeTravelDirection]: (prev[activeTravelDirection] ?? 0) + 1,
    }));
    setExplorationTotalTraversalCount((prev) => prev + 1);
  }, [activeTravelDirection, advanceExplorationMap, explorationHeading, isExplorationMode]);
  useEffect(() => {
    if (explorationStepRef) explorationStepRef.current = () => {
      awardExplorationActionPoint();
    };
  }, [awardExplorationActionPoint, explorationStepRef]);
  useEffect(() => {
    if (!isExplorationMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        stepExplorationOnPlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExplorationMode, stepExplorationOnPlay]);
  const runDevTraversePulse = useCallback(() => {
    if (!(isRpgVariant && !hasSpawnedEnemies)) return;
    if (!actions.setBiomeTableaus) return;
    const nextTableaus = gameState.tableaus.map((tableau) => (
      tableau.length > 0 ? tableau.slice(0, tableau.length - 1) : tableau
    ));
    actions.setBiomeTableaus(nextTableaus);
    advanceExplorationMap(explorationHeading);
    setExplorationAppliedTraversalByDirection((prev) => ({
      ...prev,
      [activeTravelDirection]: (prev[activeTravelDirection] ?? 0) + 1,
    }));
    setExplorationMovesByDirection((prev) => ({
      ...prev,
      [activeTravelDirection]: (prev[activeTravelDirection] ?? 0) + travelRowsPerStep,
    }));
    setExplorationTotalTraversalCount((prev) => prev + 1);
  }, [
    actions.setBiomeTableaus,
    activeTravelDirection,
    advanceExplorationMap,
    explorationHeading,
    gameState.tableaus,
    hasSpawnedEnemies,
    isRpgVariant,
    travelRowsPerStep,
  ]);
  const clearDevTraverseHold = useCallback(() => {
    if (devTraverseHoldTimeoutRef.current !== null) {
      window.clearTimeout(devTraverseHoldTimeoutRef.current);
      devTraverseHoldTimeoutRef.current = null;
    }
    if (devTraverseHoldIntervalRef.current !== null) {
      window.clearInterval(devTraverseHoldIntervalRef.current);
      devTraverseHoldIntervalRef.current = null;
    }
    if (devTraverseHoldRafRef.current !== null) {
      window.cancelAnimationFrame(devTraverseHoldRafRef.current);
      devTraverseHoldRafRef.current = null;
    }
    devTraverseHoldStartAtRef.current = 0;
    setDevTraverseHoldProgress(0);
  }, []);
  const handleTraversalButtonPointerDown = useCallback(() => {
    if (!devTraverseHoldEnabled) return;
    clearDevTraverseHold();
    devTraverseTriggeredHoldRef.current = false;
    devTraverseHoldStartAtRef.current = performance.now();
    const tickProgress = () => {
      if (devTraverseHoldStartAtRef.current <= 0) return;
      const elapsed = performance.now() - devTraverseHoldStartAtRef.current;
      const progress = Math.max(0, Math.min(1, elapsed / DEV_TRAVERSE_HOLD_DELAY_MS));
      setDevTraverseHoldProgress(progress);
      if (progress < 1) {
        devTraverseHoldRafRef.current = window.requestAnimationFrame(tickProgress);
      } else {
        devTraverseHoldRafRef.current = null;
      }
    };
    devTraverseHoldRafRef.current = window.requestAnimationFrame(tickProgress);
    devTraverseHoldTimeoutRef.current = window.setTimeout(() => {
      devTraverseTriggeredHoldRef.current = true;
      setDevTraverseHoldProgress(1);
      runDevTraversePulse();
      devTraverseHoldIntervalRef.current = window.setInterval(() => {
        runDevTraversePulse();
      }, DEV_TRAVERSE_HOLD_INTERVAL_MS);
    }, DEV_TRAVERSE_HOLD_DELAY_MS);
  }, [clearDevTraverseHold, devTraverseHoldEnabled, runDevTraversePulse]);
  const handleTraversalButtonPointerUp = useCallback(() => {
    clearDevTraverseHold();
  }, [clearDevTraverseHold]);
  const handleTraversalButtonClick = useCallback(() => {
    if (devTraverseTriggeredHoldRef.current) {
      devTraverseTriggeredHoldRef.current = false;
      return;
    }
    handleExplorationStepForward();
  }, [handleExplorationStepForward]);
  useEffect(() => () => {
    clearDevTraverseHold();
  }, [clearDevTraverseHold]);
  const handleExplorationUseSupply = useCallback(() => {
    if (!(isRpgVariant && !hasSpawnedEnemies)) return;
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
    isRpgVariant,
  ]);
  const handleToggleExplorationApLock = useCallback(() => {
    if (!isDevModeHashEnabled) return;
    setExplorationApLockFloor((current) => (
      current === null ? availableExplorationActionPoints : null
    ));
  }, [availableExplorationActionPoints, isDevModeHashEnabled]);
  const handleExplorationEndTurn = useCallback(() => {
    if (!canTriggerEndTurnFromCombo) return;
    setComboPaused(true);
    if (isRpgVariant && !hasSpawnedEnemies && actions.endExplorationTurnInRandomBiome) {
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
    isRpgVariant,
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
        className="absolute pointer-events-auto"
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
            className="relative block cursor-pointer"
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
  const overlayToolbar = (
    <div
      className="fixed z-[10034] left-1/2 flex items-center gap-4"
      style={{
        top: 32,
        transform: 'translateX(-50%)',
        width: 'min(90vw, 960px)',
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        onClick={onOpenSettings}
        disabled={!onOpenSettings}
        className="rounded border border-game-teal/70 bg-game-bg-dark/90 px-3 py-1 text-[20px] font-mono tracking-[1px] text-game-teal shadow-neon-teal"
        style={{
          minWidth: 86,
          opacity: onOpenSettings ? 1 : 0.5,
        }}
        title="Open settings / report fps"
      >
        {fpsLabel}
      </button>
      {relicTray}
    </div>
  );
  const handleSkipWithBank = useCallback((remainingMs: number) => {
    if (!isRpgVariant || !canTriggerEndTurnFromCombo) return;
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
    isRpgVariant,
    actions.processRelicCombatEvent,
  ]);
  const comboTimersEnabled = !zenModeEnabled && hasSpawnedEnemies;
  const enemyDragSpeedFactor = useMemo(() => {
    const slowActive = isRpgVariant && (gameState.rpgEnemyDragSlowUntil ?? 0) > Date.now();
    const base = slowActive ? enemyDragBaseSpeedFactor * 0.1 : enemyDragBaseSpeedFactor;
    return base * Math.max(0.1, timeScale);
  }, [enemyDragBaseSpeedFactor, gameState.rpgEnemyDragSlowUntil, isRpgVariant, timeScale]);
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
    setOwlExplorationRevealByNode({});
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
      if (e.key !== '\\') return;
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
    const autoPathMode = !isEnemyTurn && owlOverwatchActive && !!owlOverwatchActorId;
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
        if (autoPathMode && actor?.id !== owlOverwatchActorId) continue;
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
  }, [ctrlHeld, gameState.tableaus, gameState.foundations, gameState.activeEffects, activeParty, owlOverwatchActive, owlOverwatchActorId, isEnemyTurn]);

  const splatterModal = (
    <SplatterPatternModal
      isOpen={splatterModalOpen}
      onClose={() => setSplatterModalOpen(false)}
    />
  );


  // Compute foundation blockers for light shadows (only in party-foundations with lighting enabled)
  useEffect(() => {
    if (!lightingEnabled || !isPartyFoundationsVariant) {
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
  }, [lightingEnabled, isPartyFoundationsVariant]);

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
  };

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
      if (startTriggeredByPlay && isPartyBattleVariant && !zenModeEnabled && !isEnemyTurn) {
        setComboPaused(false);
      }
      setStartTriggeredByPlay(false);
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [isEnemyTurn, isPartyBattleVariant, startOverlayPhase, startTriggeredByPlay, triggerIntroGoFlash, zenModeEnabled]);

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
    if (lightingEnabled && isPartyFoundationsVariant && prevFoundationsRef.current) {
      const prev = prevFoundationsRef.current;
      const current = gameState.foundations;

      // Detect which foundation gained a card
      for (let i = 0; i < current.length; i++) {
        if (current[i].length > prev[i].length) {
          const topCard = current[i][current[i].length - 1];
          if (topCard?.id?.startsWith('battle-hand-reward-')) {
            setRewardedBattleHandCards((cards) => cards.filter((card) => card.id !== topCard.id));
          }
          triggerCardPlayFlash(i, partyComboTotal);
        }
      }
    }
    prevFoundationsRef.current = gameState.foundations;
  }, [gameState.foundations, lightingEnabled, isPartyFoundationsVariant, partyComboTotal]);

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

      if (isPartyFoundationsVariant) {
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
      if (isRpgVariant && !(card.rank === WILD_SENTINEL_RANK)) {
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
          const showSharedTurnTimer = isPartyBattleVariant && comboTimersEnabled;
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
                hideElements={isRpgVariant}
                rpgSubtitleRarityOnly={isRpgVariant}
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
        {isPartyBattleVariant && enemyFoundations.length > 0 && (
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
        {lightingEnabled && containerSize.width > 0 && (() => {
          const lightX = containerSize.width / 2;
          const lightY = containerSize.height * 0.05;
          const lightRadius = Math.max(containerSize.width, containerSize.height) * 1.2;

        let allLights;
        if (dragState.isDragging) {
          // During drag: single light follows the dragged card
          const cardScale = 1.25;
          const effectiveScale = cardScale * effectiveGlobalCardScale;
          const dragCenterX = dragState.position.x
            + (CARD_SIZE.width * effectiveScale) / 2
            - biomeContainerOriginRef.current.left;
          const dragCenterY = dragState.position.y
            + (CARD_SIZE.height * effectiveScale) / 2
            - biomeContainerOriginRef.current.top;
          allLights = [{
            x: dragCenterX,
            y: dragCenterY,
            radius: 260,
            intensity: 1.2,
            color: '#ffffff',
            castShadows: false,
            flicker: { enabled: false, speed: 0, amount: 0 },
          }];
        } else {
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
            allLights = [...flashLights, ...paintLights];
          }

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
              blockers={dragState.isDragging ? [] : foundationBlockers}
              actorGlows={[]}
              actorLights={allLights}
              worldWidth={containerSize.width}
              worldHeight={containerSize.height}
              tileSize={100}
              width={containerSize.width}
              height={containerSize.height}
            />
          );
        })()}
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
          {isPartyBattleVariant && (
            <div className="relative w-full flex justify-center" style={{ marginBottom: 12, marginTop: -20 }}>
              <div className="flex items-center justify-center" style={{ gap: `${enemyFoundationGapPx}px` }}>
                {enemyFoundations.map((cards, idx) => {
                  const enemyActor = enemyActors[idx];
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
                    {isRpgVariant && enemyHandCount > 0 && (
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
                      hideElements={isRpgVariant}
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
              {(!isRpgVariant || hasSpawnedEnemies) && (
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
          {isRpgVariant && !hasSpawnedEnemies && mapVisible && (
            <div className="w-full px-2 sm:px-3 mb-2">
              <div
                className="relative mx-auto"
                style={{ width: `${explorationMapWidth + 14}px`, maxWidth: '100%' }}
              >
                <ExplorationMap
                  nodes={explorationNodes}
                  edges={explorationEdges}
                  width={explorationMapWidth}
                  heading={explorationHeading}
                  alignmentMode={explorationMapAlignment}
                  currentNodeId={explorationCurrentNodeId}
                  trailNodeIds={explorationTrailNodeIds}
                  poiMarkers={explorationPoiMarkers}
                  travelLabel={`AP ${explorationTravelProgress}/${travelRowsPerStep}`}
                  traversalCount={explorationAppliedTraversalCount}
                  stepCost={travelRowsPerStep}
                  onStepCostDecrease={() => setExplorationRowsPerStep((current) => Math.max(1, current - 1))}
                  onStepCostIncrease={() => setExplorationRowsPerStep((current) => Math.min(12, current + 1))}
                  onTeleport={teleportToExplorationNode}
                />
                <div className="mt-1 flex items-center justify-between gap-2 px-1 z-20 pointer-events-auto">
                  <button
                    type="button"
                    onClick={handleExplorationUseSupply}
                    disabled={explorationSupplies <= 0}
                    className="relative rounded border border-game-gold/70 bg-game-bg-dark/90 px-1 py-1 text-[14px] leading-none text-game-gold shadow-neon-gold disabled:opacity-50"
                    title={`Use supply (+20 AP). ${explorationSupplies} remaining`}
                    aria-label="Use supply"
                  >
                    <span aria-hidden="true">💤</span>
                    <span
                      className="absolute -right-1.5 -top-1.5 min-w-[16px] h-4 px-1 rounded-full border text-[9px] font-bold leading-[14px] text-center"
                      style={{
                        borderColor: 'rgba(255, 229, 120, 0.9)',
                        backgroundColor: 'rgba(10, 8, 6, 0.98)',
                        color: '#f7d24b',
                        textShadow: '0 0 4px rgba(230, 179, 30, 0.55)',
                      }}
                      aria-label={`Supplies ${explorationSupplies}`}
                    >
                      {explorationSupplies}
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExplorationHeadingStep(false)}
                      className="px-2 py-0.5 rounded border font-bold leading-none select-none"
                      style={{
                        borderColor: 'rgba(127, 219, 202, 0.65)',
                        color: '#7fdbca',
                        backgroundColor: 'rgba(10, 10, 10, 0.8)',
                      }}
                      title="Counterclockwise to previous direction"
                    >
                      ‹
                    </button>
                    <div
                      className="px-2 py-0.5 rounded border text-[10px] font-bold tracking-[1px] tabular-nums select-none"
                      style={{
                        borderColor: 'rgba(127, 219, 202, 0.45)',
                        color: '#d7fff8',
                        backgroundColor: 'rgba(10, 10, 10, 0.8)',
                      }}
                      title="Current exploration coordinates (col,row)"
                    >
                      {explorationCurrentCoordsLabel}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExplorationHeadingStep(true)}
                      className="px-2 py-0.5 rounded border font-bold leading-none select-none"
                      style={{
                        borderColor: 'rgba(127, 219, 202, 0.65)',
                        color: '#7fdbca',
                        backgroundColor: 'rgba(10, 10, 10, 0.8)',
                      }}
                      title="Clockwise to next direction"
                    >
                      ›
                    </button>
                  </div>
                  <div
                    role={isDevModeHashEnabled ? 'button' : undefined}
                    tabIndex={isDevModeHashEnabled ? 0 : undefined}
                    onClick={isDevModeHashEnabled ? handleToggleExplorationApLock : undefined}
                    onKeyDown={isDevModeHashEnabled ? ((event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleToggleExplorationApLock();
                      }
                    }) : undefined}
                    className="px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-[1px] select-none"
                    style={{
                      borderColor: isExplorationApLocked ? 'rgba(255, 158, 72, 0.86)' : 'rgba(247, 210, 75, 0.8)',
                      color: isExplorationApLocked ? '#ffb26b' : '#f7d24b',
                      backgroundColor: 'rgba(10, 8, 6, 0.92)',
                      textShadow: '0 0 4px rgba(230, 179, 30, 0.45)',
                      cursor: isDevModeHashEnabled ? 'pointer' : 'default',
                    }}
                    title={isDevModeHashEnabled
                      ? (isExplorationApLocked
                        ? `AP lock active at ${explorationApLockFloor}. Click to unlock.`
                        : `AP unlocked (${availableExplorationActionPoints}). Click to lock.`)
                      : 'Available action points'}
                  >
                    AP {Math.max(0, Math.floor(availableExplorationActionPoints))}{isExplorationApLocked ? ' LOCK' : ''}
                  </div>
                </div>
                <div
                  className="absolute top-0 right-0 z-20 pointer-events-auto"
                  style={{ transform: 'scale(0.75)', transformOrigin: 'top right' }}
                >
                  <Compass
                    value={explorationHeading}
                    onChange={handleExplorationHeadingChange}
                    mapAlignmentMode={explorationMapAlignment}
                    onMapAlignmentToggle={() => {
                      setExplorationMapAlignment((current) => (current === 'north' ? 'compass' : 'north'));
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <div
            className="flex w-full justify-center gap-3 px-2 sm:px-3"
            style={{
              alignItems: 'flex-start',
              height: `${explorationTableauRowHeightPx}px`,
              overflow: 'hidden',
              transform: `translateX(${tableauSlideOffsetPx}px)`,
              transition: tableauSlideAnimating ? `transform ${EXPLORATION_SLIDE_ANIMATION_MS}ms cubic-bezier(0.2, 0.9, 0.25, 1)` : 'none',
              willChange: 'transform',
            }}
          >
            {gameState.tableaus.map((tableau, idx) => (
              <div key={idx} ref={(el) => { tableauRefs.current[idx] = el; }}>
                <Tableau
                  cards={tableau}
                  tableauIndex={idx}
                  canPlay={tableauCanPlay[idx]}
                  noValidMoves={noValidMoves}
                  selectedCard={selectedCard}
                  onCardSelect={handleTableauClick}
                  guidanceMoves={[]}
                  interactionMode={gameState.interactionMode}
                  onDragStart={handleDragStartGuarded}
                  draggingCardId={dragState.isDragging ? dragState.card?.id : null}
                  showGraphics={showGraphics}
                  cardScale={tableauCardScale}
                  revealNextRow={cloudSightActive}
                  persistentRevealCardId={isRpgVariant && !hasSpawnedEnemies ? (owlExplorationRevealMap[idx] ?? null) : null}
                  revealAllCards={revealAllCardsForIntro}
                  dimTopCard={enemyDraggingTableauIndexes.has(idx)}
                  hiddenTopCard={isRpgVariant && hiddenPlayerTableaus.has(idx)}
                  maskTopValue={isRpgVariant && maskAllPlayerTableauValues}
                  hideElements={isRpgVariant}
                  topCardStepIndexOverride={isRpgVariant && !hasSpawnedEnemies ? getDisplayedStepIndexForColumn(idx) : null}
                  debugStepLabel={getDebugStepLabelForColumn(idx)}
                />
              </div>
            ))}
          </div>
        </div>
            {!isRpgVariant && comboExpiryTokens.length > 0 && (
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
            {isPartyFoundationsVariant && (
              <div className="relative w-full flex items-center justify-center min-h-[148px]">
                <div
                  ref={foundationRowRef}
                  className="flex items-center justify-center"
                  style={{ gap: `${foundationGapPx}px` }}
                >
                  {gameState.foundations.map((foundation, idx) => {
                    const isWild = foundation.length === 1 && foundation[0].rank === WILD_SENTINEL_RANK;
                    const showGoldHighlight = !!(selectedCard && validFoundationsForSelected[idx]);
                    const actor = isSingleFoundationVariant
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
                            if (isPartyFoundationsVariant) {
                              setArmedFoundationIndex((prev) => (prev === foundationIndex ? null : foundationIndex));
                              return;
                            }
                        if (selectedCard) {
                              actions.playCardInRandomBiome(
                                selectedCard.tableauIndex,
                                foundationIndex
                              );
                            }
                          }}
                          canReceive={showGoldHighlight && hasStamina}
                          isGuidanceTarget={isPartyFoundationsVariant && armedFoundationIndex === idx}
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
                          comboCount={showActorComboCounts && actor ? (isPartyFoundationsVariant
                            ? (actorComboCounts[actor.id] ?? 0)
                            : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                          hideElements={isRpgVariant}
                          hpOverlay={renderHpLabel(actor, 'player', idx)}
                          hpOverlayPlacement="top"
                          hpOverlayOffsetPx={6}
                          onActorLongPress={({ actor: pressedActor }) => handleActorFoundationLongPress(pressedActor)}
                        />
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
                        {!isPartyFoundationsVariant && (
                          <FoundationTokenGrid
                            tokens={(gameState.foundationTokens || [])[idx] || emptyTokens}
                            comboCount={showActorComboCounts && actor ? (isPartyFoundationsVariant
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
                    {!isRpgVariant && (
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
                    {noValidMoves && (
                      <div
                        className="px-2 py-1 rounded border text-xs font-bold"
                        style={NO_MOVES_BADGE_STYLE}
                      >
                        !
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {!isPartyFoundationsVariant && <div className="w-20" aria-hidden="true" />}
            {!isPartyFoundationsVariant && (
              <div
                ref={foundationRowRef}
                className="flex items-start"
                style={{ gap: `${foundationGapPx}px` }}
              >
              {gameState.foundations.map((foundation, idx) => {
                const isWild = foundation.length === 1 && foundation[0].rank === WILD_SENTINEL_RANK;
                const showGoldHighlight = !!(selectedCard && validFoundationsForSelected[idx]);
                const actor = isSingleFoundationVariant
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
                        if (isPartyFoundationsVariant) {
                          setArmedFoundationIndex((prev) => (prev === foundationIndex ? null : foundationIndex));
                          return;
                        }
                        if (selectedCard) {
                          actions.playCardInRandomBiome(
                            selectedCard.tableauIndex,
                            foundationIndex
                          );
                        }
                      }}
                      canReceive={showGoldHighlight && hasStamina}
                      isGuidanceTarget={isPartyFoundationsVariant && armedFoundationIndex === idx}
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
                      comboCount={showActorComboCounts && actor ? (isPartyFoundationsVariant
                        ? (actorComboCounts[actor.id] ?? 0)
                        : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                      hideElements={isRpgVariant}
                      hpOverlay={renderHpLabel(actor, 'player', idx)}
                      hpOverlayPlacement="top"
                      hpOverlayOffsetPx={6}
                      onActorLongPress={({ actor: pressedActor }) => handleActorFoundationLongPress(pressedActor)}
                    />
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
                    {!isPartyFoundationsVariant && (
                      <FoundationTokenGrid
                        tokens={(gameState.foundationTokens || [])[idx] || emptyTokens}
                        comboCount={showActorComboCounts && actor ? (isPartyFoundationsVariant
                          ? (actorComboCounts[actor.id] ?? 0)
                          : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            )}
            {isPartyFoundationsVariant && isRpgVariant && !hasSpawnedEnemies && (
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
            {!isPartyFoundationsVariant && (
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
                  {noValidMoves && (
                    <div
                      className="px-2 py-1 rounded border text-xs font-bold"
                      style={NO_MOVES_BADGE_STYLE}
                    >
                      !
                    </div>
                  )}
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
        {isPartyFoundationsVariant && (
          <div className="flex items-center justify-center gap-4">
            {!isPartyBattleVariant && (
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
        {PARTY_BENCH_ENABLED && isSingleFoundationVariant && (
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
              stockCount={0}
              showGraphics={showGraphics}
              interactionMode={gameState.interactionMode}
              draggingCardId={dragState.isDragging ? dragState.card?.id : null}
              isAnyCardDragging={dragState.isDragging}
              tooltipEnabled={isGamePaused && !isRpgVariant && !inspectedRpgCard}
              upgradedCardIds={upgradedHandCardIds}
              hideElements={isRpgVariant}
              onAdjustRpgCardRarity={isRpgVariant ? actions.adjustRpgHandCardRarity : undefined}
            />
          </div>
        )}
        <StartMatchOverlay phase={startOverlayPhase} countdown={startCountdown} onPlay={handleStartMatch} onSkip={handleSkipIntro} />
        {enemyHandOverlay}
        {rpgCardInspectOverlay}
        {actorInspectOverlay}
        {timerBankVisuals}
        {overlayToolbar}
        {leftControlColumn}
        </div>
        </div>
        {splatterModal}
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
        <StartMatchOverlay phase={startOverlayPhase} countdown={startCountdown} onPlay={handleStartMatch} onSkip={handleSkipIntro} />
        {enemyHandOverlay}
        {rpgCardInspectOverlay}
        {actorInspectOverlay}
        {timerBankVisuals}
        {overlayToolbar}
        {leftControlColumn}
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

    if (isPartyFoundationsVariant) {
      if (armedFoundationIndex !== null) {
        if (!validFoundations.includes(armedFoundationIndex)) return;
        actions.playCardDirect(tableauIndex, armedFoundationIndex);
        triggerCardPlayFlash(armedFoundationIndex, partyComboTotal + 1);
        awardExplorationActionPoint();
        setArmedFoundationIndex(null);
        return;
      }
      if (validFoundations.length === 1) {
        actions.playCardDirect(tableauIndex, validFoundations[0]);
        triggerCardPlayFlash(validFoundations[0], partyComboTotal + 1);
        awardExplorationActionPoint();
      }
      return;
    }

    const foundationIndex = validFoundations[0] ?? -1;
    if (foundationIndex === -1) return;
    actions.playCardDirect(tableauIndex, foundationIndex);
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
    if (isRpgVariant && !(card.rank === WILD_SENTINEL_RANK)) {
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
      awardExplorationActionPoint();
    }
  };
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
        const showSharedTurnTimer = isPartyBattleVariant && comboTimersEnabled;
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
        pointerEvents: introBlocking ? 'none' : 'auto',
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
      style={{ zIndex: 2, gap: 'clamp(6px, 1.8vh, 22px)', pointerEvents: introBlocking ? 'none' : 'auto' }}
      >
      {/* Light shadow overlay – shows drag light while dragging, normal lights otherwise */}
      {lightingEnabled && containerSize.width > 0 && (() => {
        const lightX = containerSize.width / 2;
        const lightY = containerSize.height * 0.05;
        const lightRadius = Math.max(containerSize.width, containerSize.height) * 1.2;

        let allLights;
        if (dragState.isDragging) {
          // During drag: single light follows the dragged card
          const cardScale = 1.25;
          const effectiveScale = cardScale * effectiveGlobalCardScale;
          const dragCenterX = dragState.position.x
            + (CARD_SIZE.width * effectiveScale) / 2
            - biomeContainerOriginRef.current.left;
          const dragCenterY = dragState.position.y
            + (CARD_SIZE.height * effectiveScale) / 2
            - biomeContainerOriginRef.current.top;
          allLights = [{
            x: dragCenterX,
            y: dragCenterY,
            radius: 260,
            intensity: 1.2,
            color: '#ffffff',
            castShadows: false,
            flicker: { enabled: false, speed: 0, amount: 0 },
          }];
        } else {
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
          allLights = [...flashLights, ...paintLights];
        }

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
            blockers={dragState.isDragging ? [] : foundationBlockers}
            actorGlows={[]}
            actorLights={allLights}
            worldWidth={containerSize.width}
            worldHeight={containerSize.height}
            tileSize={80}
            width={containerSize.width}
            height={containerSize.height}
          />
        );
      })()}
      <div
        className="relative w-full flex flex-col items-center pointer-events-auto"
      style={{ gap: 'clamp(6px, 1.8vh, 22px)' }}
        data-biome-ui
        ref={matchLineContainerRef}
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
            <div key={idx} ref={(el) => { tableauRefs.current[idx] = el; }}>
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
                persistentRevealCardId={isRpgVariant && !hasSpawnedEnemies ? (owlExplorationRevealMap[idx] ?? null) : null}
                revealAllCards={revealAllCardsForIntro}
                dimTopCard={enemyDraggingTableauIndexes.has(idx)}
                hiddenTopCard={isRpgVariant && hiddenPlayerTableaus.has(idx)}
                maskTopValue={isRpgVariant && maskAllPlayerTableauValues}
                hideElements={isRpgVariant}
                topCardStepIndexOverride={isRpgVariant && !hasSpawnedEnemies ? getDisplayedStepIndexForColumn(idx) : null}
                debugStepLabel={getDebugStepLabelForColumn(idx)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex w-full justify-center gap-3 px-2 sm:px-3">
          {gameState.tableaus.map((tableau, idx) => (
            <div key={idx} ref={(el) => { tableauRefs.current[idx] = el; }}>
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
                persistentRevealCardId={isRpgVariant && !hasSpawnedEnemies ? (owlExplorationRevealMap[idx] ?? null) : null}
                revealAllCards={revealAllCardsForIntro}
                dimTopCard={enemyDraggingTableauIndexes.has(idx)}
                hiddenTopCard={isRpgVariant && hiddenPlayerTableaus.has(idx)}
                maskTopValue={isRpgVariant && maskAllPlayerTableauValues}
                hideElements={isRpgVariant}
                topCardStepIndexOverride={isRpgVariant && !hasSpawnedEnemies ? getDisplayedStepIndexForColumn(idx) : null}
                debugStepLabel={getDebugStepLabelForColumn(idx)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Foundations */}
      <div className="flex flex-col items-center gap-4 w-full" style={{ marginTop: foundationsStackMarginTop }}>
        {!isRpgVariant && comboExpiryTokens.length > 0 && (
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
        <div className={`flex w-full justify-center ${isPartyFoundationsVariant ? 'items-center' : ''}`} style={{ gap: isPartyFoundationsVariant ? `${foundationGapPx}px` : '10px' }}>
            {gameState.foundations.map((foundation, idx) => {
              const showGoldHighlight =
                !!(selectedCard && validFoundationsForSelected[idx]);
            const actor = isSingleFoundationVariant
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

            const actorName = actor ? getActorDefinition(actor.definitionId)?.name : undefined;

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
                    if (isPartyFoundationsVariant) {
                      setArmedFoundationIndex((prev) => (prev === foundationIndex ? null : foundationIndex));
                      return;
                    }
                    actions.playToFoundation(foundationIndex);
                  }}
                  canReceive={showGoldHighlight && hasStamina}
                  isGuidanceTarget={isPartyFoundationsVariant && armedFoundationIndex === idx}
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
                  comboCount={showActorComboCounts && actor ? (isPartyFoundationsVariant
                    ? (actorComboCounts[actor.id] ?? 0)
                    : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                  hideElements={isRpgVariant}
                  hpOverlay={renderHpLabel(actor, 'player', idx)}
                  hpOverlayPlacement="top"
                  hpOverlayOffsetPx={6}
                  onActorLongPress={({ actor: pressedActor }) => handleActorFoundationLongPress(pressedActor)}
                />
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
            {noValidMoves && (
              <div
                className="px-2 py-1 rounded border text-xs font-bold"
                style={NO_MOVES_BADGE_STYLE}
              >
                !
              </div>
            )}
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
      {isPartyFoundationsVariant && !isPartyBattleVariant && (
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
            {showWildAnalysis && !isPartyFoundationsVariant ? wildAnalysisButton : null}
            {!isPartyBattleVariant && (
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
      {PARTY_BENCH_ENABLED && isSingleFoundationVariant && (
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
      <StartMatchOverlay phase={startOverlayPhase} countdown={startCountdown} onPlay={handleStartMatch} onSkip={handleSkipIntro} />
      {enemyHandOverlay}
      {rpgCardInspectOverlay}
      {actorInspectOverlay}
      {timerBankVisuals}
      {overlayToolbar}
      {leftControlColumn}
      </div>
      </div>
      {splatterModal}
    </div>
        );
      }}
    </ComboTimerController>
  );
});

export default CombatGolf;
