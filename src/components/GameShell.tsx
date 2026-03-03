import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDragDrop } from '../hooks/useDragDrop';
import { Table } from './Table';
import { DragPreview } from './DragPreview';
import { PlayingScreen } from './PlayingScreen';
import { EncounterScene } from './encounters/EncounterScene';
import { JewelModal } from './JewelModal';
import { GameButton } from './GameButton';
import { canPlayCard, canPlayCardWithWild } from '../engine/rules';
import { ELEMENT_TO_SUIT, HAND_SOURCE_INDEX } from '../engine/constants';
import { getBiomeDefinition } from '../engine/biomes';
import { getTileDefinition } from '../engine/tiles';
import { getBlueprintDefinition } from '../engine/blueprints';
import { getActorDisplayGlyph } from '../engine/actors';
import { getOrimAccentColor } from '../utils/orimColors';
import { mainWorldMap } from '../data/worldMap';
import { usePerspective } from '../contexts/PerspectiveContext';
import type { Blueprint, BlueprintCard, Card as CardType, Suit, Element, OrimDefinition } from '../engine/types';
import type { useGameEngine } from '../hooks/useGameEngine';
import type { EncounterCombatActions } from './combat/contracts';

type EngineOutput = ReturnType<typeof useGameEngine>;

export interface GameShellProps {
  // Engine outputs
  gameState: NonNullable<EngineOutput['gameState']>;
  actions: EngineOutput['actions'];
  selectedCard: EngineOutput['selectedCard'];
  guidanceMoves: EngineOutput['guidanceMoves'];
  validFoundationsForSelected: boolean[];
  tableauCanPlay: boolean[];
  noValidMoves: boolean;
  isWon: boolean;
  noRegretStatus: EngineOutput['noRegretStatus'];
  wildAnalysis: EngineOutput['analysis']['wild'];
  showGraphics: boolean;

  // Global settings
  lightingEnabled: boolean;
  paintLuminosityEnabled: boolean;
  showText: boolean;
  zenModeEnabled: boolean;
  isGamePaused: boolean;
  highPerformanceTimer?: boolean;
  timeScale: number;
  discoveryEnabled: boolean;
  hidePauseOverlay: boolean;

  // Callbacks reaching back into App
  onTogglePause: () => void;
  onOpenSettings: () => void;
  onTogglePaintLuminosity: () => void;
  onPositionChange: (x: number, y: number) => void;

  // Dev/monitoring
  fps: number;
  serverAlive: boolean;
  onOpenPoiEditorAt?: (x: number, y: number) => void;

  sandboxOrimIds: string[];
  onAddSandboxOrim: (id: string) => void;
  onRemoveSandboxOrim: (id: string) => void;
  sandboxOrimSearch: string;
  onSandboxOrimSearchChange: (value: string) => void;
  sandboxOrimResults: OrimDefinition[];
  orimTrayDevMode: boolean;
  orimTrayTab: 'puzzle' | 'combat';
  onOrimTrayTabChange: (tab: 'puzzle' | 'combat') => void;
  infiniteStockEnabled: boolean;
  onToggleInfiniteStock: () => void;
  benchSwapCount: number;
  onConsumeBenchSwap: () => void;
  infiniteBenchSwapsEnabled: boolean;
  onToggleInfiniteBenchSwaps: () => void;

}

const DEFAULT_CARD_PLACEMENT_SPLASH_ENABLED = false;

export function GameShell({
  gameState,
  actions,
  selectedCard,
  guidanceMoves,
  validFoundationsForSelected,
  tableauCanPlay,
  noValidMoves,
  isWon,
  noRegretStatus,
  wildAnalysis,
  showGraphics,
  lightingEnabled,
  paintLuminosityEnabled,
  showText,
  zenModeEnabled,
  isGamePaused,
  highPerformanceTimer = false,
  timeScale,
  discoveryEnabled,
  onTogglePause,
  onOpenSettings,
  onTogglePaintLuminosity,
  onPositionChange,
  fps,
  serverAlive,
  onOpenPoiEditorAt,
  sandboxOrimIds,
  onAddSandboxOrim,
  onRemoveSandboxOrim,
  sandboxOrimSearch,
  onSandboxOrimSearchChange,
  sandboxOrimResults,
  orimTrayDevMode,
  orimTrayTab,
  onOrimTrayTabChange,
  infiniteStockEnabled,
  onToggleInfiniteStock,
  benchSwapCount,
  onConsumeBenchSwap,
  infiniteBenchSwapsEnabled,
  onToggleInfiniteBenchSwaps,
}: GameShellProps) {
  // ── State ────────────────────────────────────────────────────────────────
  const [isPuzzleOpen, setIsPuzzleOpen] = useState(false);
  const [isJewelModalOpen, setIsJewelModalOpen] = useState(false);
  const [returnModal, setReturnModal] = useState<{
    open: boolean;
    blueprintCards: BlueprintCard[];
    blueprints: Blueprint[];
  }>({
    open: false,
    blueprintCards: [],
    blueprints: [],
  });
  const [tokenReturnNotice, setTokenReturnNotice] = useState<{ id: number; count: number } | null>(null);
  const [handCards, setHandCards] = useState<CardType[]>([]);
  const [foundationSplashHint, setFoundationSplashHint] = useState<{
    foundationIndex: number;
    directionDeg: number;
    token: number;
  } | null>(null);
  const [poiRewardResolvedAt, setPoiRewardResolvedAt] = useState<number>(0);
  const [rpgImpactSplashHint, setRpgImpactSplashHint] = useState<{
    side: 'player' | 'enemy';
    foundationIndex: number;
    directionDeg: number;
    token: number;
  } | null>(null);
  const [tooltipSuppressed, setTooltipSuppressed] = useState(false);
  const [currentPlayerCoords, setCurrentPlayerCoords] = useState<{ x: number; y: number } | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const draggedHandCardRef = useRef<CardType | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const lastPartyKeyRef = useRef<string>('');
  const explorationStepRef = useRef<(() => void) | null>(null);

  // ── Constants ─────────────────────────────────────────────────────────────
  const ghostBackgroundEnabled = false;
  const showPuzzleOverlay = true;

  // ── Derived values ────────────────────────────────────────────────────────
  const guidanceActive = guidanceMoves.length > 0;
  const totalReturnTokens = Object.values(gameState.collectedTokens || {}).reduce((sum, value) => sum + (value || 0), 0);
  const hasCollectedLoot =
    totalReturnTokens > 0
    || (gameState.pendingBlueprintCards ?? []).length > 0
    || gameState.blueprints.some((blueprint) => blueprint.isNew);
  const activeParty = gameState.activeSessionTileId
    ? gameState.tileParties[gameState.activeSessionTileId] ?? []
    : [];
  const activeTile = gameState.activeSessionTileId
    ? gameState.tiles.find((tile) => tile.id === gameState.activeSessionTileId)
    : undefined;
  const activeTileName = activeTile
    ? getTileDefinition(activeTile.definitionId)?.name ?? 'ADVENTURE'
    : 'ADVENTURE';

  // ── Effects ───────────────────────────────────────────────────────────────

  // Phase detection → isPuzzleOpen
  useEffect(() => {
    const phase = gameState.phase;
    if (phase !== lastPhaseRef.current && (phase === 'playing' || phase === 'biome')) {
      setIsPuzzleOpen(true);
    }
    lastPhaseRef.current = phase;
  }, [gameState]);

  // Auto wave-battle trigger
  useEffect(() => {
    if (!currentPlayerCoords) return;
    const cell = mainWorldMap.cells.find(
      (entry) =>
        entry.gridPosition.col === currentPlayerCoords.x
        && entry.gridPosition.row === currentPlayerCoords.y
    );
    const biomeId = cell?.poi?.biomeId;
    if (biomeId !== 'wave_battle') return;
    if (gameState.phase === 'biome' && gameState.currentBiome === biomeId) return;
    const tileId = gameState.activeSessionTileId ?? cell?.poi?.id ?? biomeId;
    handleStartBiome(tileId, biomeId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayerCoords, gameState]);

  // Hand cards computation
  useEffect(() => {
    const categoryGlyphs: Record<string, string> = {
      ability: '⚡️',
      utility: '💫',
      trait: '🧬',
    };
    const activePartyLocal = gameState.activeSessionTileId
      ? gameState.tileParties[gameState.activeSessionTileId] ?? []
      : [];
    const foundationHasActor = (gameState.foundations[0]?.length ?? 0) > 0;
    const handParty = gameState.currentBiome === 'random_wilds'
      ? (foundationHasActor ? activePartyLocal.slice(0, 1) : [])
      : activePartyLocal;
    const partyKey = activePartyLocal.map((actor) => actor.id).join('|');
    if (gameState.phase !== 'biome') {
      setHandCards([]);
      lastPartyKeyRef.current = '';
      return;
    }
    lastPartyKeyRef.current = partyKey;
    const nextHand = handParty.flatMap((actor) => {
      const deck = gameState.actorDecks[actor.id];
      if (!deck) return [];
      const buildDisplay = (slotId: string, definitionId?: string, fallbackId?: string) => {
        const definition = definitionId
          ? gameState.orimDefinitions.find((item) => item.id === definitionId)
          : undefined;
        if (!definition) return null;
        const glyph = (definition.category ? categoryGlyphs[definition.category] : undefined) ?? '◌';
        const meta: string[] = [];
        if (definition?.rarity) meta.push(definition.rarity);
        meta.push(`Power ${definition?.powerCost ?? 0}`);
        if (definition?.damage !== undefined) meta.push(`DMG ${definition.damage}`);
        if (definition?.affinity) {
          meta.push(`Affinity ${Object.entries(definition.affinity)
            .map(([key, value]) => `${key}:${value}`)
            .join(' ')}`);
        }
        return {
          id: slotId || fallbackId || `orim-slot-${Math.random()}`,
          glyph,
          color: getOrimAccentColor(definition, definition?.id),
          definitionId: definition.id,
          title: definition?.name,
          meta,
          description: definition?.description,
        };
      };
      const actorGlyph = getActorDisplayGlyph(actor.definitionId, showGraphics);
      const actorOrimDisplay = (actor.orimSlots ?? [])
        .map((slot, index) => {
          const instance = slot.orimId ? gameState.orimInstances[slot.orimId] : undefined;
          return buildDisplay(slot.id, instance?.definitionId, `${actor.id}-orim-${index}`);
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      return deck.cards.map((card) => ({
        id: `hand-${card.id}`,
        rank: card.value,
        element: 'N' as Element,
        suit: ELEMENT_TO_SUIT.N as Suit,
        actorGlyph,
        sourceActorId: actor.id,
        sourceDeckCardId: card.id,
        rpgApCost: card.costByRarity?.common ?? card.cost ?? 0,
        cooldown: card.cooldown ?? 0,
        maxCooldown: card.maxCooldown ?? 0,
        orimDisplay: [
          ...actorOrimDisplay,
          ...card.slots
            .map((slot, index) => {
              const instance = slot.orimId ? gameState.orimInstances[slot.orimId] : undefined;
              return buildDisplay(slot.id, instance?.definitionId, `${card.id}-orim-${index}`);
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
        ],
        orimSlots: card.slots.map((slot) => ({
          id: slot.id,
          orimId: slot.orimId ?? null,
          locked: slot.locked ?? false,
        })),
      }));
    });
    setHandCards(nextHand);
  }, [gameState, showGraphics]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Handle drop from DND
  const handleDrop = useCallback(
    (
      tableauIndex: number,
      foundationIndex: number,
      dropPoint?: { x: number; y: number },
      momentum?: { x: number; y: number }
    ) => {
      const applySplashHint = () => {
        if (!DEFAULT_CARD_PLACEMENT_SPLASH_ENABLED) return;
        if (!momentum || (Math.abs(momentum.x) + Math.abs(momentum.y)) <= 0.1) return;
        const directionDeg = (Math.atan2(momentum.y, momentum.x) * 180) / Math.PI;
        setFoundationSplashHint({
          foundationIndex,
          directionDeg,
          token: Date.now(),
        });
      };
      const currentBiomeDef = gameState.currentBiome ? getBiomeDefinition(gameState.currentBiome) : null;
      const useWild = !!currentBiomeDef?.randomlyGenerated;

      // Hand source: validate and remove from hand
      if (tableauIndex === HAND_SOURCE_INDEX) {
        const card = draggedHandCardRef.current;
        if (import.meta.env.DEV) {
          console.debug('[hand drop]', {
            cardId: card?.id,
            sourceActorId: card?.sourceActorId,
            foundationIndex,
          });
        }
        if (card) {
          if (card.id.startsWith('keru-archetype-')) {
            const archetype = card.id.replace('keru-archetype-', '');
            const availableAspectIds = new Set(
              (gameState.orimDefinitions ?? [])
                .filter((definition) => definition.isAspect)
                .map((definition) => String(definition.id ?? '').toLowerCase())
            );
            if (availableAspectIds.has(archetype.toLowerCase())) {
              const applied = actions.applyKeruArchetype(archetype as 'felis');
              if (applied) {
                const directionDeg = momentum
                  ? (Math.atan2(momentum.y, momentum.x) * 180) / Math.PI
                  : -90;
                setFoundationSplashHint({
                  foundationIndex,
                  directionDeg,
                  token: Date.now(),
                });
              }
            }
            draggedHandCardRef.current = null;
            return;
          }
          if (card.id.startsWith('reward-orim-')) {
            const orimId = card.id.replace('reward-orim-', '');
            const party = gameState.activeSessionTileId
              ? gameState.tileParties[gameState.activeSessionTileId] ?? []
              : [];
            const targetActor = party[foundationIndex];
            if (targetActor && actions.devInjectOrimToActor) {
              actions.devInjectOrimToActor(targetActor.id, orimId, foundationIndex, dropPoint);
              applySplashHint();
              setPoiRewardResolvedAt(Date.now());
            }
            draggedHandCardRef.current = null;
            return;
          }
          if (card.id.startsWith('rpg-')) {
            const point = dropPoint;
            if (point) {
              const actorTarget = document
                .elementsFromPoint(point.x, point.y)
                .find((entry) => entry instanceof HTMLElement && entry.dataset.rpgActorTarget === 'true') as HTMLElement | undefined;
              const side = actorTarget?.dataset.rpgActorSide;
              const actorIndexRaw = actorTarget?.dataset.rpgActorIndex;
              const actorIndex = actorIndexRaw !== undefined ? Number(actorIndexRaw) : NaN;
              if ((side === 'player' || side === 'enemy') && Number.isInteger(actorIndex)) {
                const played = actions.playRpgHandCardOnActor(card.id, side, actorIndex);
                if (
                  DEFAULT_CARD_PLACEMENT_SPLASH_ENABLED
                  && played
                  && momentum
                  && (Math.abs(momentum.x) + Math.abs(momentum.y)) > 0.1
                ) {
                  const directionDeg = (Math.atan2(momentum.y, momentum.x) * 180) / Math.PI;
                  setRpgImpactSplashHint({
                    side,
                    foundationIndex: actorIndex,
                    directionDeg,
                    token: Date.now(),
                  });
                }
              }
            }
            draggedHandCardRef.current = null;
            return;
          }
          const played = actions.playFromHand(card, foundationIndex, useWild);
          if (played) applySplashHint();
          void played;
        }
        draggedHandCardRef.current = null;
        return;
      }

      const foundation = gameState.foundations[foundationIndex];
      if (!foundation) return;
      const foundationTop = foundation[foundation.length - 1];

      const tableau = gameState.tableaus[tableauIndex];
      if (tableau.length === 0) return;

      const card = tableau[tableau.length - 1];
      const canPlace = canPlayCardWithWild(card, foundationTop, gameState.activeEffects);

      if (useWild) {
        if (canPlace) {
          const played = actions.playCardInRandomBiome(tableauIndex, foundationIndex);
          if (played) {
            applySplashHint();
            explorationStepRef.current?.();
          }
        }
        return;
      }

      if (canPlace) {
        const played = actions.playFromTableau(tableauIndex, foundationIndex);
        if (played) applySplashHint();
      }
    },
    [gameState, actions]
  );

  const { dragState, startDrag, setFoundationRef, lastDragEndAt, dragPositionRef } = useDragDrop(handleDrop, isGamePaused);

  // Tooltip suppression
  useEffect(() => {
    if (dragState.isDragging) {
      setTooltipSuppressed(true);
      return;
    }
    if (!lastDragEndAt) {
      setTooltipSuppressed(false);
      return;
    }
    setTooltipSuppressed(true);
    const timeout = window.setTimeout(() => setTooltipSuppressed(false), 450);
    return () => window.clearTimeout(timeout);
  }, [dragState.isDragging, lastDragEndAt]);

  const handleDragStart = useCallback(
    (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => {
      if (tableauIndex === HAND_SOURCE_INDEX) {
        draggedHandCardRef.current = card;
      }
      startDrag(card, tableauIndex, clientX, clientY, rect);
    },
    [startDrag]
  );

  const handleStartAdventure = useCallback((tileId: string) => {
    if (gameState.activeSessionTileId && gameState.activeSessionTileId !== tileId) return;
    if (gameState.phase !== 'garden') {
      setIsPuzzleOpen(true);
      return;
    }
    actions.startAdventure(tileId);
    setIsPuzzleOpen(true);
  }, [actions, gameState]);

  const handleStartBiome = useCallback((tileId: string, biomeId: string) => {
    if (gameState.activeSessionTileId && gameState.activeSessionTileId !== tileId) return;
    if (gameState.phase === 'biome' && gameState.currentBiome === biomeId) {
      setIsPuzzleOpen(true);
      return;
    }
    actions.startBiome(tileId, biomeId);
    setIsPuzzleOpen(true);
  }, [actions, gameState]);

  const handleCloseReturnModal = useCallback(() => {
    setReturnModal((prev) => ({ ...prev, open: false }));
  }, []);

  const handleExitBiome = useCallback((mode: 'return' | 'abandon') => {
    const blueprintCards = gameState.pendingBlueprintCards ?? [];
    const blueprints = gameState.blueprints.filter((blueprint) => blueprint.isNew);
    const totalTokens = Object.values(gameState.collectedTokens || {}).reduce((sum, value) => sum + (value || 0), 0);
    const hasLoot = totalTokens > 0 || blueprintCards.length > 0 || blueprints.length > 0;
    if (mode === 'return' && hasLoot) {
      setReturnModal({
        open: true,
        blueprintCards,
        blueprints,
      });
    } else {
      setReturnModal((prev) => ({ ...prev, open: false }));
    }
    if (mode === 'return') {
      if (totalTokens > 0) {
        setTokenReturnNotice({ id: Date.now(), count: totalTokens });
      } else {
        setTokenReturnNotice(null);
      }
      actions.returnToGarden();
    } else {
      actions.abandonSession();
    }
    setIsPuzzleOpen(false);
  }, [actions, gameState]);

  // Stable actions object for PlayingScreen — prevents memo() busting on every render
  const playingScreenActions = useMemo(() => ({
    selectCard: actions.selectCard,
    playToFoundation: actions.playToFoundation,
    returnToGarden: actions.returnToGarden,
    autoPlay: actions.autoPlay,
    rewindLastCard: actions.rewindLastCard,
  }), [actions.selectCard, actions.playToFoundation, actions.returnToGarden, actions.autoPlay, actions.rewindLastCard]);

  const combatActions = useMemo<EncounterCombatActions>(() => ({
    selectCard: actions.selectCard,
    playToFoundation: actions.playToFoundation,
    playCardDirect: actions.playCardDirect,
    playCardInRandomBiome: actions.playCardInRandomBiome,
    playEnemyCardInRandomBiome: actions.playEnemyCardInRandomBiome,
    playFromHand: actions.playFromHand,
    playFromStock: (foundationIndex: number, useWild = false, force = false) =>
      actions.playFromStock(foundationIndex, useWild, force, !infiniteStockEnabled),
    completeBiome: actions.completeBiome,
    autoSolveBiome: actions.autoSolveBiome,
    playCardInNodeBiome: actions.playCardInNodeBiome,
    endRandomBiomeTurn: actions.endRandomBiomeTurn,
    endExplorationTurnInRandomBiome: actions.endExplorationTurnInRandomBiome,
    advanceRandomBiomeTurn: actions.advanceRandomBiomeTurn,
    tickRpgCombat: actions.tickRpgCombat,
    setEnemyDifficulty: actions.setEnemyDifficulty,
    rewindLastCard: actions.rewindLastCard,
    swapPartyLead: actions.swapPartyLead,
    playWildAnalysisSequence: actions.playWildAnalysisSequence,
    spawnRandomEnemyInRandomBiome: actions.spawnRandomEnemyInRandomBiome,
    setBiomeTableaus: actions.setBiomeTableaus,
    addRpgHandCard: actions.addRpgHandCard,
    applyKeruArchetype: actions.applyKeruArchetype,
    puzzleCompleted: actions.puzzleCompleted,
    startBiome: actions.startBiome,
  }), [
    actions.selectCard,
    actions.playToFoundation,
    actions.playCardDirect,
    actions.playCardInRandomBiome,
    actions.playEnemyCardInRandomBiome,
    actions.playFromHand,
    actions.playFromStock,
    actions.completeBiome,
    actions.autoSolveBiome,
    actions.playCardInNodeBiome,
    actions.endRandomBiomeTurn,
    actions.endExplorationTurnInRandomBiome,
    actions.advanceRandomBiomeTurn,
    actions.tickRpgCombat,
    actions.setEnemyDifficulty,
    actions.rewindLastCard,
    actions.swapPartyLead,
    actions.playWildAnalysisSequence,
    actions.spawnRandomEnemyInRandomBiome,
    actions.setBiomeTableaus,
    actions.addRpgHandCard,
    actions.applyKeruArchetype,
    actions.puzzleCompleted,
    actions.startBiome,
    infiniteStockEnabled,
  ]);

  const eventActions = useMemo(() => ({
    puzzleCompleted: actions.puzzleCompleted,
    completeBiome: actions.completeBiome,
  }), [actions.puzzleCompleted, actions.completeBiome]);

  const handleCombatPositionChange = useCallback((x: number, y: number) => {
    setCurrentPlayerCoords({ x, y });
    onPositionChange(x, y);
  }, [onPositionChange]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showPuzzleOverlay && isPuzzleOpen && (gameState.phase === 'playing' || gameState.phase === 'biome') && (
        <div className="fixed inset-0 z-[9000]">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: lightingEnabled ? 0.8 : 1,
              backgroundColor: ghostBackgroundEnabled
                ? 'rgba(248, 248, 255, 0.85)'
                : 'rgba(0, 0, 0, 0.85)',
            }}
          />
          <div className={`relative w-full h-full flex items-center justify-center${showText ? '' : ' textless-mode'}`}>
            <div className="relative w-full h-full flex items-center justify-center" style={{ zIndex: 2 }}>
            {/* Playing screen */}
            {gameState.phase === 'playing' && (
              <PlayingScreen
                gameState={gameState}
                selectedCard={selectedCard}
                validFoundationsForSelected={validFoundationsForSelected}
                tableauCanPlay={tableauCanPlay}
                noValidMoves={noValidMoves}
                isWon={isWon}
                guidanceMoves={guidanceMoves}
                guidanceActive={guidanceActive}
                activeParty={activeParty}
                activeTileName={activeTileName}
                isDragging={dragState.isDragging}
                draggingCard={dragState.card}
                noRegretStatus={noRegretStatus}
                handleDragStart={handleDragStart}
                setFoundationRef={setFoundationRef}
                actions={playingScreenActions}
              />
            )}

            {gameState.phase === 'biome' && (
              <EncounterScene
                gameState={gameState}
                selectedCard={selectedCard}
                validFoundationsForSelected={validFoundationsForSelected}
                tableauCanPlay={tableauCanPlay}
                noValidMoves={noValidMoves}
                isWon={isWon}
                guidanceMoves={guidanceMoves}
                activeParty={activeParty}
                sandboxOrimIds={sandboxOrimIds}
                orimTrayDevMode={orimTrayDevMode}
                orimTrayTab={orimTrayTab}
                onOrimTrayTabChange={onOrimTrayTabChange}
                sandboxOrimSearch={sandboxOrimSearch}
                onSandboxOrimSearchChange={onSandboxOrimSearchChange}
                sandboxOrimResults={sandboxOrimResults as Array<{ id: string; name: string; domain: 'puzzle' | 'combat' }>}
                onAddSandboxOrim={onAddSandboxOrim}
                onRemoveSandboxOrim={onRemoveSandboxOrim}
                hasCollectedLoot={hasCollectedLoot}
                dragState={dragState}
                dragPositionRef={dragPositionRef}
                handleDragStart={handleDragStart}
                setFoundationRef={setFoundationRef}
                foundationSplashHint={foundationSplashHint}
                rpgImpactSplashHint={rpgImpactSplashHint}
                handCards={handCards}
                tooltipSuppressed={tooltipSuppressed}
                handleExitBiome={handleExitBiome}
                useGhostBackground={ghostBackgroundEnabled}
                lightingEnabled={lightingEnabled}
                fps={fps}
                serverAlive={serverAlive}
                infiniteStockEnabled={infiniteStockEnabled}
                onToggleInfiniteStock={onToggleInfiniteStock}
                onOpenPoiEditorAt={onOpenPoiEditorAt}
                poiRewardResolvedAt={poiRewardResolvedAt}
                benchSwapCount={benchSwapCount}
                infiniteBenchSwapsEnabled={infiniteBenchSwapsEnabled}
                onToggleInfiniteBenchSwaps={onToggleInfiniteBenchSwaps}
                onConsumeBenchSwap={onConsumeBenchSwap}
                noRegretStatus={noRegretStatus}
                paintLuminosityEnabled={paintLuminosityEnabled}
                onTogglePaintLuminosity={onTogglePaintLuminosity}
                zenModeEnabled={zenModeEnabled}
                isGamePaused={isGamePaused}
                timeScale={timeScale}
                onOpenSettings={onOpenSettings}
                onTogglePause={onTogglePause}
                wildAnalysis={wildAnalysis}
                combatActions={combatActions}
                explorationStepRef={explorationStepRef}
                onPositionChange={handleCombatPositionChange}
                eventActions={eventActions}
              />
            )}
            </div>
          </div>
        </div>
      )}

      {/* Garden screen */}
      <Table
          pendingCards={gameState.pendingCards}
          buildPileProgress={gameState.buildPileProgress}
          tiles={gameState.tiles}
          availableActors={gameState.availableActors}
          tileParties={gameState.tileParties}
          activeSessionTileId={gameState.activeSessionTileId}
          tokens={gameState.tokens}
          resourceStash={gameState.resourceStash}
          collectedTokens={gameState.collectedTokens}
          orimDefinitions={gameState.orimDefinitions}
          orimStash={gameState.orimStash}
          orimInstances={gameState.orimInstances}
          actorDecks={gameState.actorDecks}
          tokenReturnNotice={tokenReturnNotice}
          showTokenTray={gameState.phase === 'garden'}
          showLighting={lightingEnabled}
          discoveryEnabled={discoveryEnabled}
          disableZoom={gameState.phase !== 'garden' && gameState.phase !== 'biome'}
          allowWindowPan={gameState.phase === 'biome'}
          onStartAdventure={handleStartAdventure}
          onStartBiome={handleStartBiome}
          onAssignCardToBuildPile={actions.assignCardToBuildPile}
          onAssignCardToTileSlot={actions.assignCardToTileSlot}
          onAssignTokenToTileSlot={actions.assignTokenToTileSlot}
          onAssignActorToParty={actions.assignActorToParty}
          onAssignActorToTileHome={actions.assignActorToTileHome}
          onClearBuildPileProgress={actions.clearBuildPileProgress}
          onClearTileProgress={actions.clearTileProgress}
          onClearAllProgress={actions.clearAllProgress}
          onResetGame={() => actions.newGame(false)}
          onUpdateTilePosition={actions.updateTileGridPosition}
          onAddTileToGardenAt={actions.addTileToGardenAt}
          onRemoveTile={actions.removeTileFromGarden}
          onToggleTileLock={actions.toggleTileLock}
          onUpdateActorPosition={actions.updateActorGridPosition}
          onUpdateTokenPosition={actions.updateTokenGridPosition}
          onStackActors={actions.stackActorOnActor}
          onStackTokens={actions.stackTokenOnToken}
          onEquipOrimFromStash={actions.equipOrimFromStash}
          onMoveOrimBetweenSlots={actions.moveOrimBetweenSlots}
          onReturnOrimToStash={actions.returnOrimToStash}
          onAddTokenInstance={actions.addTokenInstanceToGarden}
          onDepositTokenToStash={actions.depositTokenToStash}
          onWithdrawTokenFromStash={actions.withdrawTokenFromStash}
          onReorderActorStack={actions.reorderActorStack}
          onDetachActorFromStack={actions.detachActorFromStack}
          onDetachActorFromParty={actions.detachActorFromParty}
          onRemoveActorFromTileHome={actions.removeActorFromTileHome}
          showText={showText}
          showGraphics={showGraphics}
          serverAlive={serverAlive}
          fps={fps}
      />

      {returnModal.open && (
        <div className="fixed inset-0 z-[9500]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full h-full flex items-center justify-center p-6">
            <div className="relative bg-game-bg-dark border border-game-teal/40 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <button
                onClick={handleCloseReturnModal}
                className="absolute top-3 right-3 text-xs text-game-pink border border-game-pink rounded w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                title="Close"
              >
                x
              </button>
              <div className="text-sm text-game-teal tracking-[4px] mb-4">
                ADVENTURE RETURNS
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-xs text-game-purple tracking-wider mb-2">BLUEPRINTS</div>
                  {(returnModal.blueprintCards.length > 0 || returnModal.blueprints.length > 0) ? (
                    <div className="flex flex-wrap gap-3">
                      {returnModal.blueprintCards.map((bp) => {
                        const def = getBlueprintDefinition(bp.blueprintId);
                        return (
                          <div
                            key={bp.id}
                            className="border border-game-purple/40 rounded-md px-3 py-2 text-xs"
                            data-card-face
                          >
                            {def?.name?.toUpperCase() ?? 'BLUEPRINT'}
                          </div>
                        );
                      })}
                      {returnModal.blueprints.map((bp) => {
                        const def = getBlueprintDefinition(bp.definitionId);
                        return (
                          <div
                            key={bp.id}
                            className="border border-game-purple/40 rounded-md px-3 py-2 text-xs"
                            data-card-face
                          >
                            {def?.name?.toUpperCase() ?? 'BLUEPRINT'}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-game-white opacity-60">No blueprints returned</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <GameButton onClick={handleCloseReturnModal} color="teal" size="sm">
                  CONTINUE
                </GameButton>
              </div>
            </div>
          </div>
        </div>
      )}

      <JewelModal
        isOpen={isJewelModalOpen}
        onClose={() => setIsJewelModalOpen(false)}
      />

      {/* Win screen now displayed near the final tableau */}

      {/* Drag preview */}
      {dragState.isDragging && dragState.card && (
        <DragPreview
          card={dragState.card}
          positionRef={dragPositionRef}
          offset={dragState.offset}
          size={dragState.size}
          showText={showText}
        />
      )}

    </>
  );
}
