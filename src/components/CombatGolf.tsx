import { memo, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useGraphics } from '../contexts/GraphicsContext';
import type { GameState, Card as CardType, Element, Move, SelectedCard, Actor, ActorDefinition } from '../engine/types';
import type { DragState } from '../hooks/useDragDrop';
import type { BlockingRect } from '../engine/lighting';
import { ShadowCanvas } from './LightRenderer';
import { GameButton } from './GameButton';
import { Tableau } from './Tableau';
import { FoundationActor } from './FoundationActor';
import { NodeEdgeBiomeScreen } from './NodeEdgeBiomeScreen';
import { FoundationTokenGrid } from './FoundationTokenGrid';
import { Foundation } from './Foundation';
import { ComboTimerController } from './ComboTimerController';
import { ResourceStash } from './ResourceStash';
import {
  EnemyAiController,
  ENEMY_DRAG_SPEED_FACTOR,
  getEnemyMoveAnimationMs,
  ENEMY_TURN_TIME_BUDGET_MS,
} from './EnemyAiController';
import { CARD_SIZE, ELEMENT_TO_SUIT, getSuitDisplay, SUIT_COLORS, WILD_SENTINEL_RANK } from '../engine/constants';
import { useCardScale } from '../contexts/CardScaleContext';
import { Hand } from './Hand';
import { PartyBench } from './PartyBench';
import { canPlayCard, canPlayCardWithWild, isSequential } from '../engine/rules';
import { actorHasOrimDefinition } from '../engine/orimEffects';
import { getActorDefinition } from '../engine/actors';
import { getOrimAccentColor, getOrimWatercolorConfig, ORIM_WATERCOLOR_CANVAS_SCALE } from '../watercolor/orimWatercolor';
import { WatercolorOverlay, setWatercolorInteractionDegraded } from '../watercolor/WatercolorOverlay';
import { useWatercolorEngine, usePaintMarkCount } from '../watercolor-engine/WatercolorContext';
import { getBiomeDefinition } from '../engine/biomes';
import { NO_MOVES_BADGE_STYLE } from '../utils/styles';
import { SplatterPatternModal } from './SplatterPatternModal';
import { Tooltip } from './Tooltip';
import { PauseOverlay } from './combat/PauseOverlay';
import { createRandomBattleHandRewardCard, getBattleHandRewardThreshold } from './combat/battleHandUnlocks';
import { StartMatchOverlay, type StartOverlayPhase } from './combat/StartMatchOverlay';

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
  tooltipSuppressed: boolean;
  handleExitBiome: (mode: 'return' | 'abandon') => void;
  useGhostBackground: boolean;
  lightingEnabled: boolean;
  paintLuminosityEnabled?: boolean;
  onTogglePaintLuminosity?: () => void;
  fps?: number;
  serverAlive?: boolean;
  infiniteStockEnabled: boolean;
  onToggleInfiniteStock: () => void;
  noRegretStatus: { canRewind: boolean; cooldown: number; actorId: string | null };
  zenModeEnabled?: boolean;
  isGamePaused?: boolean;
  wildAnalysis?: { key: string; sequence: Move[]; maxCount: number } | null;
  actions: {
    selectCard: (card: CardType, tableauIndex: number) => void;
    playToFoundation: (foundationIndex: number) => boolean;
    playCardDirect: (tableauIndex: number, foundationIndex: number) => boolean;
    playCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => boolean;
    playEnemyCardInRandomBiome?: (tableauIndex: number, foundationIndex: number) => boolean;
    playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
    playFromStock: (foundationIndex: number, useWild?: boolean, force?: boolean) => boolean;
    completeBiome: () => void;
    autoSolveBiome: () => void;
    playCardInNodeBiome: (nodeId: string, foundationIndex: number) => void;
    endRandomBiomeTurn: () => void;
    advanceRandomBiomeTurn?: () => void;
    setEnemyDifficulty?: (difficulty: GameState['enemyDifficulty']) => void;
    rewindLastCard: () => boolean;
    swapPartyLead: (actorId: string) => void;
    playWildAnalysisSequence: () => void;
  };
  benchSwapCount?: number;
  infiniteBenchSwapsEnabled?: boolean;
  onToggleInfiniteBenchSwaps?: () => void;
  onConsumeBenchSwap?: () => void;
}

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
  wildAnalysis = null,
  actions,
  benchSwapCount = 0,
  infiniteBenchSwapsEnabled = false,
  onToggleInfiniteBenchSwaps,
  onConsumeBenchSwap,
}: CombatGolfProps) {
  const showGraphics = useGraphics();
  const [splatterModalOpen, setSplatterModalOpen] = useState(false);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [comboPaused, setComboPaused] = useState(false);
  const [rewardedBattleHandCards, setRewardedBattleHandCards] = useState<CardType[]>([]);
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
    tableauIndex: number;
    rank: number;
    suit: string;
  }>>([]);
  const prevEnemyTurnRef = useRef<boolean>(false);
  const enemyFoundationRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [enemyRevealMap, setEnemyRevealMap] = useState<Record<number, number | null>>({});
  const [enemyTurnRemainingMs, setEnemyTurnRemainingMs] = useState(ENEMY_TURN_TIME_BUDGET_MS);
  // Runtime-tunable speed scaffold; downstream systems can update this mid-match.
  const [enemyDragSpeedFactor] = useState(() => ENEMY_DRAG_SPEED_FACTOR * 2);
  const isGamePausedRef = useRef(isGamePaused);
  const introBiomeRef = useRef(gameState.currentBiome ?? 'none');
  const enemyRevealTimers = useRef<Record<number, number>>({});
  const matchLineContainerRef = useRef<HTMLDivElement | null>(null);
  const tableauRefs = useRef<Array<HTMLDivElement | null>>([]);
  const foundationRefs = useRef<Array<HTMLDivElement | null>>([]);
  const foundationRowRef = useRef<HTMLDivElement | null>(null);
  const biomeContainerRef = useRef<HTMLElement>(null!);
  const biomeContainerOriginRef = useRef({ left: 0, top: 0 });
  const watercolorEngine = useWatercolorEngine();
  const paintMarkCount = usePaintMarkCount();
  const globalCardScale = useCardScale();
  const [paintLights, setPaintLights] = useState<Array<{
    x: number;
    y: number;
    radius: number;
    intensity: number;
    color: string;
    flicker: { enabled: boolean; speed: number; amount: number };
  }>>([]);
  const biomeDef = gameState.currentBiome
    ? getBiomeDefinition(gameState.currentBiome)
    : null;
  const overlayOpacity = lightingEnabled ? 0.68 : 0.85;
  const cardWidth = CARD_SIZE.width * globalCardScale;
  const cardHeight = CARD_SIZE.height * globalCardScale;
  const foundationCardScale = globalCardScale;
  const foundationOffset = cardHeight * 1.25;
  const handOffset = Math.max(12, Math.round(cardHeight * 0.35));
  const handCardScale = 1;
  const PARTY_BENCH_ENABLED = true;
  const playtestVariant = gameState.playtestVariant ?? 'single-foundation';
  const isSingleFoundationVariant = playtestVariant === 'single-foundation';
  const isPartyBattleVariant = playtestVariant === 'party-battle';
  const isPartyFoundationsVariant = playtestVariant === 'party-foundations' || isPartyBattleVariant;
  const isEnemyTurn = isPartyBattleVariant && gameState.randomBiomeActiveSide === 'enemy';
  const [startOverlayPhase, setStartOverlayPhase] = useState<StartOverlayPhase>('ready');
  const [startCountdown, setStartCountdown] = useState(3);
  const [startTriggeredByPlay, setStartTriggeredByPlay] = useState(false);
  const introBlocking = startOverlayPhase !== 'done';
  const revealAllCardsForIntro = startOverlayPhase === 'countdown' || startOverlayPhase === 'go';
  const showWildAnalysis = isPartyFoundationsVariant && biomeDef?.id === 'random_wilds';
  const wildAnalysisCount = wildAnalysis?.maxCount ?? 0;
  const wildAnalysisReady = showWildAnalysis && wildAnalysisCount > 0;
  const wildAnalysisLabel = wildAnalysis ? String(wildAnalysisCount) : '--';
  const foundationGapPx = Math.max(2, Math.round((isPartyFoundationsVariant ? 4 : 20) * globalCardScale));
  const foundationAccessoryGapPx = Math.max(10, Math.round(cardWidth * 0.18));
  const enemyFoundations = isPartyBattleVariant ? (gameState.enemyFoundations ?? []) : [];
  const enemyDifficulty = gameState.enemyDifficulty ?? biomeDef?.enemyDifficulty ?? 'normal';
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
  const showFpsOverlay = isPartyFoundationsVariant && typeof fps === 'number';
  const fpsOverlay = showFpsOverlay ? (
    <div
      className="fixed top-4 left-4 text-base font-mono z-[9999] pointer-events-none bg-game-bg-dark/80 border px-4 py-2 rounded"
      style={{
        color: serverAlive === false ? '#ff6b6b' : '#7fdbca',
        borderColor: serverAlive === false
          ? 'rgba(255, 107, 107, 0.6)'
          : 'rgba(127, 219, 202, 0.6)',
      }}
    >
      {serverAlive === false ? 'server down' : `${Math.round(fps)}fps`}
    </div>
  ) : null;
  const foundationHasActor = (gameState.foundations[0]?.length ?? 0) > 0;
  const cloudSightActive = useMemo(() => {
    if (isPartyFoundationsVariant) {
      return activeParty.some((actor) => actorHasOrimDefinition(gameState, actor.id, 'cloud_sight'));
    }
    if (!foundationHasActor) return false;
    const foundationActor = activeParty[0];
    if (!foundationActor) return false;
    return actorHasOrimDefinition(gameState, foundationActor.id, 'cloud_sight');
  }, [activeParty, gameState, foundationHasActor, isPartyFoundationsVariant]);
  const teamworkActive = useMemo(() => {
    return activeParty.some((actor) => actorHasOrimDefinition(gameState, actor.id, 'teamwork'));
  }, [activeParty, gameState]);
  const foundationOffsetAdjusted = cloudSightActive ? foundationOffset * 0.6 : foundationOffset;
  const handSlotStyle = {
    height: cardHeight * handCardScale + 4,
    minWidth: cardWidth * handCardScale * 2,
    marginTop: isPartyBattleVariant
      ? 40
      : 2 - Math.round(cardHeight * handCardScale),
  };
  const foundationsStackMarginTop = isPartyBattleVariant
    ? -20
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
    () => new Set(enemyMoveAnims.map((anim) => anim.tableauIndex)),
    [enemyMoveAnims]
  );
  const rightFoundationAccessoryStyle = {
    left: `calc(50% + ${foundationRowWidth / 2}px)`,
    top: '50%',
    transform: `translate(${foundationAccessoryGapPx}px, -50%)`,
  } as const;
  const actorComboCounts = gameState.actorCombos ?? {};
  const partyComboTotal = useMemo(() => {
    if (!activeParty.length) return 0;
    return activeParty.reduce((sum, actor) => sum + (actorComboCounts[actor.id] ?? 0), 0);
  }, [activeParty, actorComboCounts]);
  useEffect(() => {
    if (!isPartyBattleVariant) {
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
  }, [isPartyBattleVariant, partyComboTotal]);
  const unlockedBattleHandCards = useMemo<CardType[]>(() => {
    if (!isPartyBattleVariant) return [];
    return rewardedBattleHandCards;
  }, [isPartyBattleVariant, rewardedBattleHandCards]);
  const showPartyComboCounter = activeParty.length > 0;
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
  const handleDragStartGuarded = useCallback((
    card: CardType,
    tableauIndex: number,
    clientX: number,
    clientY: number,
    rect: DOMRect
  ) => {
    if (introBlocking) return;
    if (isGamePaused) return;
    if (isEnemyTurn) return;
    handleDragStart(card, tableauIndex, clientX, clientY, rect);
  }, [handleDragStart, introBlocking, isEnemyTurn, isGamePaused]);
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
    if (introBlocking) return;
    if (!isPartyBattleVariant) return;
    if (zenModeEnabled) return;
    if (isEnemyTurn) return;
    setComboPaused(false);
  }, [introBlocking, isEnemyTurn, isPartyBattleVariant, zenModeEnabled]);
  const registerEnemyReveal = useCallback((foundationIndex: number, value: number) => {
    setEnemyRevealMap((prev) => ({ ...prev, [foundationIndex]: value }));
    const existing = enemyRevealTimers.current[foundationIndex];
    if (existing) window.clearTimeout(existing);
    enemyRevealTimers.current[foundationIndex] = window.setTimeout(() => {
      setEnemyRevealMap((prev) => ({ ...prev, [foundationIndex]: null }));
    }, 3000);
  }, []);
  const handleComboExpire = useCallback((value: number) => {
    const id = comboTokenIdRef.current++;
    setComboExpiryTokens((current) => [...current, { id, value }]);
    if (isPartyBattleVariant && !zenModeEnabled && !isEnemyTurn) {
      setComboPaused(true);
      (actions.advanceRandomBiomeTurn ?? actions.endRandomBiomeTurn)();
    }
  }, [
    actions.advanceRandomBiomeTurn,
    actions.endRandomBiomeTurn,
    isEnemyTurn,
    isPartyBattleVariant,
    zenModeEnabled,
  ]);
  const comboTimersEnabled = !zenModeEnabled;
  const enemyMoveDurationMs = getEnemyMoveAnimationMs(enemyDragSpeedFactor);
  const enemyTurnFillPercent = `${Math.max(
    0,
    Math.min(100, (enemyTurnRemainingMs / ENEMY_TURN_TIME_BUDGET_MS) * 100)
  )}%`;
  useEffect(() => {
    if (!isEnemyTurn) {
      setEnemyTurnRemainingMs(ENEMY_TURN_TIME_BUDGET_MS);
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
    if (!ctrlHeld) return null;
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
        const hasStamina = (actor?.stamina ?? 0) > 0;
        if (!hasStamina) continue;
        const top = foundation[foundation.length - 1];
        const canPlay = mode === 'random'
          ? canPlayCardWithWild(card, top, gameState.activeEffects)
          : canPlayCard(card, top, gameState.activeEffects);
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
  }, [ctrlHeld, gameState.tableaus, gameState.foundations, gameState.activeEffects, activeParty]);

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

  // Phase 2 safe mode: temporarily reduce WatercolorOverlay quality only during active drag.
  useEffect(() => {
    setWatercolorInteractionDegraded(dragState.isDragging);
    return () => {
      setWatercolorInteractionDegraded(false);
    };
  }, [dragState.isDragging]);

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
          const hasStamina = (actor?.stamina ?? 0) > 0;
          const canPlay = hasStamina && canPlayCardWithWild(
            card,
            foundation[foundation.length - 1],
            gameState.activeEffects
          );
          return canPlay ? idx : -1;
        })
        .filter((idx) => idx !== -1);

      if (isPartyFoundationsVariant) {
        if (armedFoundationIndex !== null) {
          if (!validFoundations.includes(armedFoundationIndex)) return;
          actions.playCardInRandomBiome(tableauIndex, armedFoundationIndex);
          triggerCardPlayFlash(armedFoundationIndex, partyComboTotal + 1);
          setArmedFoundationIndex(null);
          return;
        }
        if (validFoundations.length === 1) {
          actions.playCardInRandomBiome(tableauIndex, validFoundations[0]);
          triggerCardPlayFlash(validFoundations[0], partyComboTotal + 1);
        }
        return;
      }

      const foundationIndex = validFoundations[0] ?? -1;
      if (foundationIndex === -1) return;
      actions.playCardInRandomBiome(tableauIndex, foundationIndex);
      triggerCardPlayFlash(foundationIndex, partyComboTotal + 1);
    };
    const handleHandClick = (card: CardType) => {
      if (introBlocking) return;
      if (isGamePaused) return;
      if (isEnemyTurn) return;
      if (gameState.interactionMode !== 'click') return;
      if (noValidMoves) return;

      const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
        const actor = activeParty[idx];
        const hasStamina = (actor?.stamina ?? 0) > 0;
        return hasStamina && canPlayCardWithWild(
          card,
          foundation[foundation.length - 1],
          gameState.activeEffects
        );
      });

      if (foundationIndex === -1) return;
      const played = actions.playFromHand(card, foundationIndex, true);
      if (played && card.id.startsWith('battle-hand-reward-')) {
        setRewardedBattleHandCards((cards) => cards.filter((entry) => entry.id !== card.id));
      }
    };
    const handleStockClick = () => {
      if (introBlocking) return;
      if (isEnemyTurn) return;
      if (gameState.interactionMode !== 'click') return;
      if (gameState.stock.length === 0) return;
      const stockCard = gameState.stock[gameState.stock.length - 1];

      const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
        const actor = activeParty[idx];
        const hasStamina = (actor?.stamina ?? 0) > 0;
        return hasStamina && canPlayCardWithWild(
          stockCard,
          foundation[foundation.length - 1],
          gameState.activeEffects
        );
      });

      const fallbackIndex = foundationIndex !== -1
        ? foundationIndex
        : Math.max(0, activeParty.findIndex((actor) => (actor?.stamina ?? 0) > 0));
      actions.playFromStock(fallbackIndex, true, true);
    };
    return (
      <ComboTimerController
        partyComboTotal={partyComboTotal}
        paused={isGamePaused || introBlocking || comboPaused || !comboTimersEnabled}
        disabled={!comboTimersEnabled}
        onExpire={handleComboExpire}
      >
        {(combo) => {
          const displayedPartyComboTotal = combo.displayedCombo;
          const timerRef = combo.timerRef;
          return (
      <div
        ref={biomeContainerRef as any}
        className="relative w-full h-full flex flex-col items-center pointer-events-auto overflow-hidden"
        style={{
          gap: 'clamp(6px, 1.4vh, 20px)',
          paddingTop: 'clamp(6px, 1.2vh, 10px)',
          paddingBottom: 'clamp(6px, 1.2vh, 10px)',
          pointerEvents: (isGamePaused || introBlocking) ? 'none' : 'auto',
        }}
      >
        {fpsOverlay}
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
            <div
              className="w-full h-full rounded-lg border flex items-center justify-center text-lg font-bold"
              style={{
                borderColor: 'rgba(230, 179, 30, 0.8)',
                color: '#f7d24b',
                backgroundColor: 'rgba(10, 10, 10, 0.9)',
                boxShadow: '0 0 20px rgba(230, 179, 30, 0.5)',
              }}
            >
              {anim.rank === 1 ? 'A' : anim.rank === 11 ? 'J' : anim.rank === 12 ? 'Q' : anim.rank === 13 ? 'K' : anim.rank}
            </div>
          </div>
        ))}
        {isEnemyTurn && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10020] pointer-events-none">
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
            onEndTurn={() => {
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
          const effectiveScale = cardScale * globalCardScale;
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
              ambientDarkness={ambientDarkness}
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
            className="relative w-full flex flex-col items-center pointer-events-auto"
            style={{ gap: battleSectionGap }}
            data-biome-ui
            ref={matchLineContainerRef}
          >
        {renderMatchLines('random')}

        {/* Enemy Foundations + Tableaus */}
        <div className="relative z-30 flex flex-col items-center">
          {isPartyBattleVariant && (
            <div className="relative w-full flex justify-center" style={{ marginBottom: 50, marginTop: -35 }}>
              <div className="flex items-center justify-center gap-4">
                {enemyFoundations.map((cards, idx) => (
                  <div key={`enemy-foundation-${idx}`} className="relative flex flex-col items-center">
                    <Foundation
                      cards={cards}
                      index={idx}
                      onFoundationClick={() => {}}
                      canReceive={false}
                      interactionMode={gameState.interactionMode}
                      showGraphics={showGraphics}
                      isDimmed={false}
                      isDragTarget={false}
                      showCompleteSticker={false}
                      countPosition="none"
                      maskValue={false}
                      revealValue={enemyRevealMap[idx] ?? null}
                      setDropRef={(foundationIndex, ref) => {
                        enemyFoundationRefs.current[foundationIndex] = ref;
                      }}
                    />
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
                ))}
              </div>
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
            </div>
          )}
          {isPartyBattleVariant && isEnemyTurn && comboTimersEnabled && (
            <div className="relative flex items-center gap-3" style={{ marginBottom: 14 }}>
              <div
                className="relative text-[12px] tracking-[3px] font-bold px-2 py-1 rounded border overflow-hidden min-w-[210px]"
                style={{
                  borderColor: 'rgba(255, 229, 120, 0.9)',
                  boxShadow: '0 0 12px rgba(230, 179, 30, 0.65)',
                  backgroundColor: 'rgba(10, 8, 6, 0.92)',
                  ['--combo-fill' as string]: enemyTurnFillPercent,
                }}
              >
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: 'var(--combo-fill)',
                    backgroundColor: 'rgba(230, 179, 30, 0.95)',
                  }}
                />
                <div
                  className="combo-spark-line"
                  style={{
                    left: 'calc(var(--combo-fill) - 3px)',
                  }}
                />
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    color: '#f7d24b',
                    clipPath: 'inset(0 0 0 var(--combo-fill))',
                  }}
                >
                  ENEMY TURN
                </div>
                <div
                  className="relative z-10 flex items-center justify-center"
                  style={{
                    color: '#0a0a0a',
                    clipPath: 'inset(0 calc(100% - var(--combo-fill)) 0 0)',
                  }}
                >
                  ENEMY TURN
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3">
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
                  cardScale={foundationCardScale}
                  revealNextRow={cloudSightActive}
                  revealAllCards={revealAllCardsForIntro}
                  dimTopCard={enemyDraggingTableauIndexes.has(idx)}
                />
              </div>
            ))}
          </div>
        </div>

            {!isPartyFoundationsVariant && showPartyComboCounter && displayedPartyComboTotal > 0 && (
              <div className="relative flex items-center gap-3">
            {comboPaused && (
              <div
                className="absolute -top-8 left-1/2 -translate-x-1/2 text-3xl font-bold text-game-white"
                style={{ textShadow: '0 0 12px rgba(255,255,255,0.6)' }}
              >
                ||
              </div>
            )}
                <div
                  ref={timerRef}
                  className="relative text-[12px] tracking-[3px] font-bold px-2 py-1 rounded border overflow-hidden"
              style={{
                borderColor: 'rgba(255, 229, 120, 0.9)',
                boxShadow: '0 0 12px rgba(230, 179, 30, 0.65)',
                backgroundColor: 'rgba(10, 8, 6, 0.92)',
                ['--combo-fill' as string]: '100%',
              }}
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: 'var(--combo-fill)',
                  backgroundColor: 'rgba(230, 179, 30, 0.95)',
                }}
              />
              <div
                className="combo-spark-line"
                style={{
                  left: 'calc(var(--combo-fill) - 3px)',
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  color: '#f7d24b',
                  clipPath: 'inset(0 0 0 var(--combo-fill))',
                }}
              >
                PARTY COMBO {displayedPartyComboTotal}
              </div>
              <div
                className="relative z-10 flex items-center justify-center"
                style={{
                  color: '#0a0a0a',
                  clipPath: 'inset(0 calc(100% - var(--combo-fill)) 0 0)',
                }}
              >
                PARTY COMBO {displayedPartyComboTotal}
              </div>
            </div>
            {comboExpiryTokens.length > 0 && (
              <div className="flex items-center gap-2">
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
          </div>
        )}

        {/* Foundations + End Turn button */}
        <div className="relative z-20 flex flex-col items-center gap-3 w-full" style={{ marginTop: foundationsStackMarginTop }}>
          <div className="relative w-full flex justify-center items-center">
            {isPartyFoundationsVariant && (
              <div className="relative w-full flex items-center justify-center min-h-[180px]">
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
                    const hasStamina = (actor?.stamina ?? 0) > 0;
                    const canReceiveDrag =
                      dragState.isDragging &&
                      dragState.card &&
                      canPlayCardWithWild(
                        dragState.card,
                        foundation[foundation.length - 1],
                        gameState.activeEffects
                      ) &&
                      hasStamina;

                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center"
                        ref={(el) => {
                          foundationRefs.current[idx] = el;
                          setFoundationRef(idx, el);
                        }}
                      >
                        <FoundationActor
                          cards={foundation}
                          index={idx}
                          onFoundationClick={(foundationIndex) => {
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
                          comboCount={actor ? (isPartyFoundationsVariant
                            ? (actorComboCounts[actor.id] ?? 0)
                            : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                        />
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
                            comboCount={actor ? (isPartyFoundationsVariant
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
                    {wildAnalysisButton}
                  </div>
                )}
                <div
                  className="absolute flex flex-col items-center justify-center gap-2 pointer-events-auto z-[100]"
                  style={rightFoundationAccessoryStyle}
                >
                  {noRegretStatus.actorId && (
                    <GameButton
                      onClick={actions.rewindLastCard}
                      color="purple"
                      size="sm"
                      className="pointer-events-auto"
                      disabled={!noRegretStatus.canRewind}
                      title={noRegretStatus.cooldown > 0 ? `Cooldown: ${noRegretStatus.cooldown}` : 'Rewind last card'}
                    >
                      {noRegretStatus.cooldown > 0 ? `REW ${noRegretStatus.cooldown}` : 'REWIND'}
                    </GameButton>
                  )}
                  <div className="flex items-center gap-2">
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
                const hasStamina = (actor?.stamina ?? 0) > 0;
                const canReceiveDrag =
                  dragState.isDragging &&
                  dragState.card &&
                  canPlayCardWithWild(
                    dragState.card,
                    foundation[foundation.length - 1],
                    gameState.activeEffects
                  ) &&
                  hasStamina;

                return (
                  <div
                    key={idx}
                    className="flex flex-col items-center"
                    ref={(el) => {
                      foundationRefs.current[idx] = el;
                      setFoundationRef(idx, el);
                    }}
                  >
                    <FoundationActor
                      cards={foundation}
                      index={idx}
                      onFoundationClick={(foundationIndex) => {
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
                      comboCount={actor ? (isPartyFoundationsVariant
                        ? (actorComboCounts[actor.id] ?? 0)
                        : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                    />
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
                        comboCount={actor ? (isPartyFoundationsVariant
                          ? (actorComboCounts[actor.id] ?? 0)
                          : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            )}
            {/* End Turn button - affixed to foundations */}
            {!isPartyFoundationsVariant && (
              <div
                className="w-20 flex flex-col items-center gap-2 pointer-events-auto z-[100] relative"
                style={{ marginLeft: '75px' }}
              >
                {noRegretStatus.actorId && (
                  <GameButton
                    onClick={actions.rewindLastCard}
                    color="purple"
                    size="sm"
                    className="pointer-events-auto"
                    disabled={!noRegretStatus.canRewind}
                    title={noRegretStatus.cooldown > 0 ? `Cooldown: ${noRegretStatus.cooldown}` : 'Rewind last card'}
                  >
                    {noRegretStatus.cooldown > 0 ? `REW ${noRegretStatus.cooldown}` : 'REWIND'}
                  </GameButton>
                )}
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
            {(showPartyComboCounter && !isEnemyTurn && (displayedPartyComboTotal > 0 || (isPartyBattleVariant && comboTimersEnabled))) && (
              <div className="relative flex items-center gap-3">
                {comboPaused && (
                  <div
                    className="absolute -top-8 left-1/2 -translate-x-1/2 text-3xl font-bold text-game-white"
                    style={{ textShadow: '0 0 12px rgba(255,255,255,0.6)' }}
                  >
                    ||
                  </div>
                )}
                <div
                  ref={timerRef}
                  className="relative text-[12px] tracking-[3px] font-bold px-2 py-1 rounded border overflow-hidden"
                  style={{
                    borderColor: 'rgba(255, 229, 120, 0.9)',
                    boxShadow: '0 0 12px rgba(230, 179, 30, 0.65)',
                    backgroundColor: 'rgba(10, 8, 6, 0.92)',
                    ['--combo-fill' as string]: '100%',
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: 'var(--combo-fill)',
                      backgroundColor: 'rgba(230, 179, 30, 0.95)',
                    }}
                  />
                  <div
                    className="combo-spark-line"
                    style={{
                      left: 'calc(var(--combo-fill) - 3px)',
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      color: '#f7d24b',
                      clipPath: 'inset(0 0 0 var(--combo-fill))',
                    }}
                  >
                    PARTY COMBO {displayedPartyComboTotal}
                  </div>
                  <div
                    className="relative z-10 flex items-center justify-center"
                    style={{
                      color: '#0a0a0a',
                      clipPath: 'inset(0 calc(100% - var(--combo-fill)) 0 0)',
                    }}
                  >
                    PARTY COMBO {displayedPartyComboTotal}
                  </div>
                </div>
              </div>
            )}
            {comboExpiryTokens.length > 0 && (
              <div className="flex items-center gap-2">
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
        {isPartyBattleVariant && (
          <div className="relative z-40 flex justify-center" style={handSlotStyle}>
            <Hand
              cards={unlockedBattleHandCards}
              cardScale={1}
              onDragStart={handleDragStartGuarded}
              onCardClick={handleHandClick}
              stockCount={0}
              showGraphics={showGraphics}
              interactionMode={gameState.interactionMode}
              draggingCardId={dragState.isDragging ? dragState.card?.id : null}
            />
          </div>
        )}
        <StartMatchOverlay phase={startOverlayPhase} countdown={startCountdown} onPlay={handleStartMatch} onSkip={handleSkipIntro} />
        <PauseOverlay paused={isGamePaused} />
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
        {fpsOverlay}
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
        <PauseOverlay paused={isGamePaused} />
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
        const hasStamina = (actor?.stamina ?? 0) > 0;
        const canPlay = hasStamina && canPlayCard(
          card,
          foundation[foundation.length - 1],
          gameState.activeEffects
        );
        return canPlay ? idx : -1;
      })
      .filter((idx) => idx !== -1);

    if (isPartyFoundationsVariant) {
      if (armedFoundationIndex !== null) {
        if (!validFoundations.includes(armedFoundationIndex)) return;
        actions.playCardDirect(tableauIndex, armedFoundationIndex);
        triggerCardPlayFlash(armedFoundationIndex, partyComboTotal + 1);
        setArmedFoundationIndex(null);
        return;
      }
      if (validFoundations.length === 1) {
        actions.playCardDirect(tableauIndex, validFoundations[0]);
        triggerCardPlayFlash(validFoundations[0], partyComboTotal + 1);
      }
      return;
    }

    const foundationIndex = validFoundations[0] ?? -1;
    if (foundationIndex === -1) return;
    actions.playCardDirect(tableauIndex, foundationIndex);
    triggerCardPlayFlash(foundationIndex, partyComboTotal + 1);
  };
  const handleHandClick = (card: CardType) => {
    if (introBlocking) return;
    if (isGamePaused) return;
    if (gameState.interactionMode !== 'click') return;
    if (noValidMoves) return;

    const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
      const actor = activeParty[idx];
      const hasStamina = (actor?.stamina ?? 0) > 0;
      return hasStamina && canPlayCard(
        card,
        foundation[foundation.length - 1],
        gameState.activeEffects
      );
    });

    if (foundationIndex === -1) return;
    const played = actions.playFromHand(card, foundationIndex, false);
    if (!played) return;
    if (card.id.startsWith('battle-hand-reward-')) {
      setRewardedBattleHandCards((cards) => cards.filter((entry) => entry.id !== card.id));
    }
    triggerCardPlayFlash(foundationIndex, partyComboTotal + 1);
  };
    const handleStockClick = () => {
      if (introBlocking) return;
      if (gameState.interactionMode !== 'click') return;
      if (gameState.stock.length === 0) return;
      const stockCard = gameState.stock[gameState.stock.length - 1];

    const foundationIndex = gameState.foundations.findIndex((foundation, idx) => {
      const actor = activeParty[idx];
      const hasStamina = (actor?.stamina ?? 0) > 0;
      return hasStamina && canPlayCard(
        stockCard,
        foundation[foundation.length - 1],
        gameState.activeEffects
      );
    });

    const fallbackIndex = foundationIndex !== -1
      ? foundationIndex
      : Math.max(0, activeParty.findIndex((actor) => (actor?.stamina ?? 0) > 0));
    actions.playFromStock(fallbackIndex, false, true);
  };
  // Track container size for watercolor canvas
  return (
    <ComboTimerController
      partyComboTotal={partyComboTotal}
      paused={isGamePaused || introBlocking || comboPaused}
      onExpire={handleComboExpire}
    >
      {(combo) => {
        const displayedPartyComboTotal = combo.displayedCombo;
        const timerRef = combo.timerRef;
        return (
    <div
      ref={biomeContainerRef as any}
      className="relative w-full h-full flex flex-col items-center pointer-events-auto overflow-hidden"
      style={{
        gap: 'clamp(16px, 3.5vh, 40px)',
        paddingTop: 'clamp(10px, 2vh, 20px)',
        paddingBottom: 'clamp(10px, 2vh, 20px)',
        pointerEvents: (isGamePaused || introBlocking) ? 'none' : 'auto',
      }}
    >
      {fpsOverlay}
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
      style={{ zIndex: 2, gap: 'clamp(6px, 1.8vh, 22px)', pointerEvents: (isGamePaused || introBlocking) ? 'none' : 'auto' }}
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
          const effectiveScale = cardScale * globalCardScale;
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
            ambientDarkness={ambientDarkness}
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
        <div className="grid grid-cols-6 gap-x-3" style={{ rowGap: '15px' }}>
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
                cardScale={foundationCardScale}
                revealNextRow={cloudSightActive}
                revealAllCards={revealAllCardsForIntro}
                dimTopCard={enemyDraggingTableauIndexes.has(idx)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3">
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
                cardScale={foundationCardScale}
                revealNextRow={cloudSightActive}
                revealAllCards={revealAllCardsForIntro}
                dimTopCard={enemyDraggingTableauIndexes.has(idx)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Foundations */}
      <div className="flex flex-col items-center gap-4 w-full" style={{ marginTop: foundationsStackMarginTop }}>
        {showPartyComboCounter && (
          <div className="relative flex flex-col items-center">
            {comboPaused && (
              <div
                className="absolute -top-8 text-3xl font-bold text-game-white"
                style={{ textShadow: '0 0 12px rgba(255,255,255,0.6)' }}
              >
                ||
              </div>
            )}
            <div
              ref={timerRef}
              className="relative text-[12px] tracking-[3px] font-bold px-2 py-1 rounded border overflow-hidden"
              style={{
                borderColor: 'rgba(255, 229, 120, 0.9)',
                boxShadow: '0 0 12px rgba(230, 179, 30, 0.65)',
                backgroundColor: 'rgba(10, 8, 6, 0.92)',
                ['--combo-fill' as string]: '100%',
              }}
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: 'var(--combo-fill)',
                  backgroundColor: 'rgba(230, 179, 30, 0.95)',
                }}
              />
              <div
                className="combo-spark-line"
                style={{
                  left: 'calc(var(--combo-fill) - 3px)',
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  color: '#f7d24b',
                  clipPath: 'inset(0 0 0 var(--combo-fill))',
                }}
              >
                PARTY COMBO {displayedPartyComboTotal}
              </div>
              <div
                className="relative z-10 flex items-center justify-center"
                style={{
                  color: '#0a0a0a',
                  clipPath: 'inset(0 calc(100% - var(--combo-fill)) 0 0)',
                }}
              >
                PARTY COMBO {displayedPartyComboTotal}
              </div>
            </div>
            {comboExpiryTokens.length > 0 && (
              <div className="absolute -bottom-7 flex gap-2">
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
          </div>
        )}
        <div className={`flex w-full justify-center ${isPartyFoundationsVariant ? 'items-center' : ''}`} style={{ gap: isPartyFoundationsVariant ? '4px' : '10px' }}>
            {gameState.foundations.map((foundation, idx) => {
              const showGoldHighlight =
                !!(selectedCard && validFoundationsForSelected[idx]);
            const actor = isSingleFoundationVariant
              ? ((idx === 0 && !foundationHasActor) ? null : activeParty[idx])
              : activeParty[idx];
            const hasStamina = (actor?.stamina ?? 0) > 0;

            const canReceiveDrag =
              dragState.isDragging &&
              dragState.card &&
              canPlayCard(
                dragState.card,
                foundation[foundation.length - 1],
                gameState.activeEffects
              ) &&
              hasStamina;

            const actorName = actor ? getActorDefinition(actor.definitionId)?.name : undefined;

            return (
              <div
                key={idx}
                ref={(el) => {
                  foundationRefs.current[idx] = el;
                  setFoundationRef(idx, el);
                }}
              >
                <FoundationActor
                  cards={foundation}
                  index={idx}
                  onFoundationClick={(foundationIndex) => {
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
                  comboCount={actor ? (isPartyFoundationsVariant
                    ? (actorComboCounts[actor.id] ?? 0)
                    : ((gameState.foundationCombos || [])[idx] || 0)) : 0}
                />
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
            {noRegretStatus.actorId && (
              <GameButton
                onClick={actions.rewindLastCard}
                color="purple"
                size="sm"
                className="w-16 text-center pointer-events-auto"
                disabled={!noRegretStatus.canRewind}
                title={noRegretStatus.cooldown > 0 ? `Cooldown: ${noRegretStatus.cooldown}` : 'Rewind last card'}
              >
                {noRegretStatus.cooldown > 0 ? `R${noRegretStatus.cooldown}` : 'REW'}
              </GameButton>
            )}
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
      <PauseOverlay paused={isGamePaused} />
      </div>
      </div>
      {splatterModal}
    </div>
        );
      }}
    </ComboTimerController>
  );
});
