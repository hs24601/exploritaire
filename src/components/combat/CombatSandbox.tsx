import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGraphics } from '../../contexts/GraphicsContext';
import { CARD_SIZE, ELEMENT_TO_SUIT, HAND_SOURCE_INDEX, WILD_SENTINEL_RANK } from '../../engine/constants';
import { getBiomeDefinition } from '../../engine/biomes';
import { getActorDefinition } from '../../engine/actors';
import { Foundation } from '../Foundation';
import { Hand } from '../Hand';
import { DragPreview } from '../DragPreview';
import { DedicatedEnemyTableau } from './DedicatedEnemyTableau';
import { DedicatedPlayerTableau } from './DedicatedPlayerTableau';
import { useDragDrop } from '../../hooks/useDragDrop';
import type { Actor, Card as CardType, GameState, SelectedCard } from '../../engine/types';

interface CombatSandboxActions {
  newGame: (preserveProgress?: boolean) => void;
  startBiome: (tileId: string, biomeId: string) => void;
  spawnRandomEnemyInRandomBiome: () => void;
  rerollRandomBiomeDeal: () => void;
  endRandomBiomeTurn: () => void;
  advanceRandomBiomeTurn: () => void;
  cleanupDefeatedEnemies: () => void;
  setEnemyDifficulty: (difficulty: GameState['enemyDifficulty']) => void;
  selectCard: (card: CardType, tableauIndex: number) => void;
  playToFoundation: (foundationIndex: number) => boolean;
  playFromTableau: (tableauIndex: number, foundationIndex: number) => boolean;
  playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
  playCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => boolean;
  setBiomeTableaus: (tableaus: CardType[][]) => void;
  setBiomeFoundations: (foundations: CardType[][]) => void;
}

interface CombatSandboxProps {
  open: boolean;
  isLabMode?: boolean;
  gameState: GameState;
  actions: CombatSandboxActions;
  timeScale: number;
  onCycleTimeScale: () => void;
  isGamePaused: boolean;
  onTogglePause: () => void;
  onClose: () => void;
  onOpenEditor?: () => void;
  selectedCard: SelectedCard | null;
  validFoundationsForSelected: boolean[];
  noValidMoves: boolean;
  tableauCanPlay: boolean[];
}

const DIFFICULTY_ORDER: NonNullable<GameState['enemyDifficulty']>[] = ['easy', 'normal', 'hard', 'divine'];
const COMBAT_STANDARD_TABLEAU_COUNT = 7;
const COMBAT_STANDARD_TABLEAU_DEPTH = 4;
const COMBAT_STANDARD_HAND_COUNT = 5;
const COMBAT_LAB_HAND_COUNT = 10;
const COMBAT_RANDOM_ELEMENTAL_POOL: CardType['element'][] = ['A', 'W', 'E', 'F', 'L', 'D', 'N'];
const COMBAT_LAB_FOUNDATION_ACTOR_DEFINITION_IDS: Array<'felis' | 'ursus'> = ['felis', 'ursus'];

function findActorForLabFoundation(state: GameState, definitionId: 'felis' | 'ursus'): Actor | null {
  const partyActors = Object.values(state.tileParties ?? {}).flat();
  return partyActors.find((actor) => actor.definitionId === definitionId)
    ?? state.availableActors.find((actor) => actor.definitionId === definitionId)
    ?? null;
}

function createLabFoundationActorCard(definitionId: 'felis' | 'ursus', actor: Actor | null): CardType {
  const fallbackName = definitionId === 'felis' ? 'Felis' : 'Ursus';
  const actorDefinition = getActorDefinition(actor?.definitionId ?? definitionId);
  const actorName = actorDefinition?.name ?? fallbackName;
  const actorTitles = actorDefinition?.titles?.filter(Boolean) ?? [];
  return {
    id: `combatlab-foundation-${definitionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rank: WILD_SENTINEL_RANK,
    suit: ELEMENT_TO_SUIT.N,
    element: 'N',
    name: actorName,
    description: actorDefinition?.description ?? 'Primary foundation actor.',
    tags: actorTitles.slice(0, 3),
    sourceActorId: actor?.id,
    rpgActorId: actor?.id,
    rpgCardKind: 'focus',
  };
}

function buildLabSeededFoundations(state: GameState, existing: CardType[][]): CardType[][] {
  const felisActor = findActorForLabFoundation(state, COMBAT_LAB_FOUNDATION_ACTOR_DEFINITION_IDS[0]);
  const ursusActor = findActorForLabFoundation(state, COMBAT_LAB_FOUNDATION_ACTOR_DEFINITION_IDS[1]);
  return [
    [createLabFoundationActorCard('felis', felisActor)],
    [createLabFoundationActorCard('ursus', ursusActor)],
    [...(existing[2] ?? [])],
    [...(existing[3] ?? [])],
  ];
}

function createLabTargetDummyFoundationCard(): CardType {
  const targetDummyDef = getActorDefinition('target_dummy');
  return {
    id: `actor-target_dummy-lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rank: Math.max(1, Math.min(13, targetDummyDef?.value ?? 1)),
    suit: ELEMENT_TO_SUIT.N,
    element: 'N',
    name: targetDummyDef?.name ?? 'Target Dummy',
    description: targetDummyDef?.description ?? 'A durable training target that never takes actions.',
    tags: targetDummyDef?.titles?.slice(0, 3) ?? ['Target', 'Dummy'],
    rpgCardKind: 'focus',
  };
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

function createCombatStandardHandCards(count = COMBAT_STANDARD_HAND_COUNT): CardType[] {
  return Array.from({ length: count }, (_value, handIndex) => (
    createCombatStandardCard(-1, handIndex, count)
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
  onClose: _onClose,
  onOpenEditor,
  selectedCard,
  validFoundationsForSelected,
  noValidMoves,
  tableauCanPlay,
}: CombatSandboxProps) {
  if (!open) return null;

  const enemyCount = gameState.enemyActors?.length ?? 0;
  const enemyFoundationCount = gameState.enemyFoundations?.filter((foundation) => foundation.length > 0).length ?? 0;
  const activeSide = gameState.randomBiomeActiveSide ?? 'player';
  const currentDifficulty = gameState.enemyDifficulty ?? 'normal';
  const currentDifficultyIndex = Math.max(0, DIFFICULTY_ORDER.indexOf(currentDifficulty));
  const nextDifficulty = DIFFICULTY_ORDER[(currentDifficultyIndex + 1) % DIFFICULTY_ORDER.length];
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const fpsLabelRef = useRef<HTMLDivElement | null>(null);
  const showGraphics = useGraphics();
  const enemyPreviewFoundations = gameState.enemyFoundations ?? [];
  const activeEnemyCount = (gameState.enemyActors ?? []).filter((actor) => (actor?.hp ?? 0) > 0).length;
  const enemyPreviewFoundationsForDisplay = activeEnemyCount > 1
    ? enemyPreviewFoundations
    : enemyPreviewFoundations.slice(0, 1);
  const fallbackEnemyFoundationRef = useRef<CardType[][]>([[createLabTargetDummyFoundationCard()]]);
  const hasEnemyFoundationCards = enemyPreviewFoundationsForDisplay.some((stack) => stack.length > 0);
  const enemyFoundationsForDisplay = (isLabMode && !hasEnemyFoundationCards)
    ? fallbackEnemyFoundationRef.current
    : enemyPreviewFoundationsForDisplay;
  const previewPlayerFoundations = gameState.foundations;
  const getFoundationDropRef = (index: number) =>
    index >= 0 && index < previewPlayerFoundations.length ? setFoundationRef : undefined;
  const [fallbackHandCards, setFallbackHandCards] = useState<CardType[]>(() => createCombatStandardHandCards(isLabMode ? COMBAT_LAB_HAND_COUNT : COMBAT_STANDARD_HAND_COUNT));
  const hasRenderableGameHandCards = (gameState.rpgHandCards?.length ?? 0) > 0;
  const usingFallbackLabHandCards = isLabMode && !hasRenderableGameHandCards;
  const previewHandCards = usingFallbackLabHandCards ? fallbackHandCards : (gameState.rpgHandCards ?? []);
  const previewTableauCardScale = 0.82;
  const secondaryTableauCardScale = Math.round(previewTableauCardScale * 0.9 * 1000) / 1000;
  const previewHandCardScale = 0.68;
  const previewTableauHeight = Math.round(CARD_SIZE.height * previewTableauCardScale);
  const previewFoundationWidth = Math.round(CARD_SIZE.width * 0.9);
  const previewEnhancementFoundationScale = 0.9;
  const previewEnhancementFoundationWidth = previewFoundationWidth;
  const [fallbackTableaus, setFallbackTableaus] = useState<CardType[][]>(() => createCombatStandardTableaus());
  const gameTableaus = gameState.tableaus ?? [];
  const hasRenderableGameTableaus = gameTableaus.length > 0 && gameTableaus.some((tableau) => tableau.length > 0);
  const previewTableaus = hasRenderableGameTableaus ? gameTableaus : fallbackTableaus;
  const [autoFitMultiplier, setAutoFitMultiplier] = useState(1);
  const draggedHandCardRef = useRef<CardType | null>(null);
  const fitViewportRef = useRef<HTMLDivElement | null>(null);
  const fitContentRef = useRef<HTMLDivElement | null>(null);
  const autoFitMultiplierRef = useRef(1);
  const currentBiomeDef = gameState.currentBiome ? getBiomeDefinition(gameState.currentBiome) : null;
  const useWild = !!currentBiomeDef?.randomlyGenerated;
  const handleSandboxDrop = useCallback((tableauIndex: number, foundationIndex: number) => {
    if (tableauIndex === HAND_SOURCE_INDEX) {
      const draggedHandCard = draggedHandCardRef.current;
      if (draggedHandCard) {
        const played = actions.playFromHand(draggedHandCard, foundationIndex, useWild);
        if (played && usingFallbackLabHandCards) {
          setFallbackHandCards((prev) => prev.filter((card) => card.id !== draggedHandCard.id));
        }
      }
      draggedHandCardRef.current = null;
      return;
    }
    if (foundationIndex < 0 || foundationIndex >= previewPlayerFoundations.length) {
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
      actions.playCardInRandomBiome(tableauIndex, foundationIndex);
      return;
    }
    actions.playFromTableau(tableauIndex, foundationIndex);
  }, [actions, useWild, usingFallbackLabHandCards, previewPlayerFoundations.length]);
  const { dragState, startDrag, setFoundationRef, dragPositionRef } = useDragDrop(handleSandboxDrop, isGamePaused);
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
    startDrag(card, tableauIndex, clientX, clientY, rect);
  };
  const handleSandboxHandDragStart = (
    card: CardType,
    _sourceIndex: number,
    clientX: number,
    clientY: number,
    rect: DOMRect
  ) => {
    draggedHandCardRef.current = card;
    startDrag(card, HAND_SOURCE_INDEX, clientX, clientY, rect);
  };
  const handleSandboxHandClick = (card: CardType) => {
    if (gameState.interactionMode !== 'click') return;
    const firstPlayableFoundation = validFoundationsForSelected.findIndex((value) => value);
    if (firstPlayableFoundation >= 0) {
      const played = actions.playFromHand(card, firstPlayableFoundation, useWild);
      if (played && usingFallbackLabHandCards) {
        setFallbackHandCards((prev) => prev.filter((entry) => entry.id !== card.id));
      }
    }
  };
  const handleSandboxHandLongPress = () => {};
  const visibleFoundationIndexes = useMemo(
    () => previewPlayerFoundations.map((_, index) => index).filter((index) => index !== 1),
    [previewPlayerFoundations.length]
  );
  const foundationColumns = useMemo(
    () => visibleFoundationIndexes.map((index) => ({
      index,
      width: index === 2 || index === 3 ? previewEnhancementFoundationWidth : previewFoundationWidth,
      scale: index === 2 || index === 3 ? previewEnhancementFoundationScale : 1,
    })),
    [visibleFoundationIndexes, previewEnhancementFoundationScale, previewEnhancementFoundationWidth, previewFoundationWidth]
  );
  const foundationColumnIndexes = useMemo(
    () => new Set<number>(foundationColumns.map((column) => column.index)),
    [foundationColumns]
  );
  useEffect(() => {
    const totalFoundations = previewPlayerFoundations.length;
    for (let idx = 0; idx < totalFoundations; idx += 1) {
      if (!foundationColumnIndexes.has(idx)) {
        setFoundationRef(idx, null);
      }
    }
  }, [previewPlayerFoundations.length, foundationColumnIndexes, setFoundationRef]);
  const dragTargetFoundationByIndex = useMemo(() => {
    if (!dragState.isDragging) return new Set<number>();
    return foundationColumnIndexes;
  }, [dragState.isDragging, foundationColumnIndexes]);
  const handleSandboxFoundationClick = (foundationIndex: number) => {
    if (gameState.interactionMode !== 'click') return;
    actions.playToFoundation(foundationIndex);
  };
  const handleRerollDeal = () => {
    const nextTableaus = createCombatStandardTableaus();
    const nextHandCards = createCombatStandardHandCards(isLabMode ? COMBAT_LAB_HAND_COUNT : COMBAT_STANDARD_HAND_COUNT);
    setFallbackTableaus(nextTableaus);
    setFallbackHandCards(nextHandCards);
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
    const shouldSeedLabFoundations = foundations.length < 4 || needsActorSeed(0) || needsActorSeed(1);
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
      const ratio = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight);
      const next = Math.max(0.55, Math.min(1, ratio));
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
      if (fpsLabelRef.current) {
        fpsLabelRef.current.textContent = 'FPS: --';
      }
      return;
    }

    let rafId = 0;
    let frameCount = 0;
    let lastSampleTime = performance.now();

    const tick = (now: number) => {
      frameCount += 1;
      const elapsed = now - lastSampleTime;
      if (elapsed >= 500) {
        const nextFps = Math.max(0, Math.round((frameCount * 1000) / elapsed));
        if (fpsLabelRef.current) {
          fpsLabelRef.current.textContent = `FPS: ${nextFps}`;
        }
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
  const configPanelWidth = configCollapsed ? 56 : 180;
  const useInlineLabLayout = isLabMode;
  const shellClassName = useInlineLabLayout ? 'fixed inset-0 z-[10014] flex bg-black/95' : '';
  const configPanelClassName = useInlineLabLayout
    ? 'order-2 h-full shrink-0 border-l border-game-gold/30 bg-black/88 p-3 text-[10px] font-mono text-game-white menu-text overflow-y-auto transition-[width] duration-200'
    : 'fixed top-[56px] bottom-4 right-4 z-[10015] max-w-[calc(50vw-1rem)] rounded-lg border border-game-gold/40 bg-black/85 p-3 text-[10px] font-mono text-game-white shadow-[0_12px_40px_rgba(0,0,0,0.75)] backdrop-blur-sm menu-text overflow-y-auto transition-[width] duration-200';
  const arenaDockClassName = useInlineLabLayout
    ? 'order-1 h-full min-w-0 flex-1 p-3'
    : 'fixed top-[56px] bottom-4 left-4 z-[10014] flex items-center justify-center';
  const arenaDockStyle = useInlineLabLayout
    ? undefined
    : {
      width: `calc(100vw - (${configPanelWidth}px + 3rem))`,
    };
  const arenaPanelClassName = useInlineLabLayout
    ? 'h-full w-full flex flex-col overflow-hidden text-[10px] font-mono text-game-white menu-text'
    : 'rounded-lg border border-game-teal/30 bg-black/90 p-3 text-[10px] font-mono text-game-white shadow-[0_12px_40px_rgba(0,0,0,0.75)] backdrop-blur-sm menu-text h-full w-full flex flex-col overflow-hidden';

  return (
    <div className={shellClassName}>
      <div className={configPanelClassName} style={{ width: configPanelWidth }}>
      <div className="mb-2 flex items-center justify-between">
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
            className="rounded border border-game-gold/40 bg-game-bg-dark/80 px-2 py-0.5 text-[11px] text-game-gold hover:border-game-gold hover:text-game-white transition-colors"
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
        <div>Side: {activeSide}</div>
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

      <div className={arenaDockClassName} style={arenaDockStyle}>
        <div className={arenaPanelClassName}>
            <div
              ref={fpsLabelRef}
              className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-game-gold"
            >
              FPS: --
            </div>
            <div ref={fitViewportRef} className="flex-1 min-h-0 w-full overflow-hidden">
              <div className="flex h-full w-full items-start justify-center overflow-hidden">
                <div
                  ref={fitContentRef}
                  className="inline-flex w-max max-w-none flex-col items-center justify-start gap-2 pt-1"
                  style={{
                    transform: `scale(${autoFitMultiplier})`,
                    transformOrigin: 'top center',
                  }}
                >
              <div className="flex w-full min-h-[96px] items-start justify-center px-1">
                {enemyFoundationsForDisplay.length === 0 ? (
                  <div
                    className="rounded border border-dashed border-game-white/20 bg-black/20"
                    style={{ width: previewFoundationWidth, height: Math.round(CARD_SIZE.height * 0.9) }}
                  />
                ) : (
                  <div className="flex flex-wrap items-start justify-center gap-2">
                    {enemyFoundationsForDisplay.map((cards, idx) => (
                      <div
                        key={`sandbox-enemy-${idx}`}
                        className="rounded border border-game-teal/30 bg-black/45 p-[3px]"
                        style={{ minWidth: previewFoundationWidth }}
                      >
                        <Foundation
                          cards={cards}
                          index={idx}
                          onFoundationClick={() => {}}
                          canReceive={false}
                          interactionMode={gameState.interactionMode}
                          showGraphics={showGraphics}
                          countPosition="none"
                          maskValue={false}
                          watercolorOnlyCards={true}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
                  <div
                className="flex w-full items-start justify-center gap-2 overflow-visible px-1"
                style={{ minHeight: Math.round(previewTableauHeight * secondaryTableauCardScale / previewTableauCardScale) + 28 }}
              >
                <DedicatedEnemyTableau
                  tableaus={previewTableaus}
                  showGraphics={showGraphics}
                  cardScale={secondaryTableauCardScale}
                />
              </div>
                  <div
                className="flex w-full items-start justify-center gap-2 overflow-visible px-1"
                style={{ minHeight: previewTableauHeight + 30 }}
              >
                <DedicatedPlayerTableau
                  tableaus={previewTableaus}
                  showGraphics={showGraphics}
                  cardScale={previewTableauCardScale}
                  interactionMode={gameState.interactionMode}
                  noValidMoves={noValidMoves}
                  tableauCanPlay={tableauCanPlay}
                  selectedCard={selectedCard}
                  draggingCardId={dragState.isDragging ? dragState.card?.id : null}
                  isAnyCardDragging={dragState.isDragging}
                  onTopCardSelect={handleSandboxCardSelect}
                  onTopCardDragStart={handleSandboxTableauDragStart}
                />
              </div>
              <div className="flex w-full items-start justify-center px-1">
                <div className="flex items-start justify-center gap-2">
                  {foundationColumns.map((column) => (
                    <div
                      key={column.index}
                      className="rounded border border-game-teal/30 bg-black/45 p-[3px] shrink-0"
                      style={{ minWidth: column.width }}
                    >
                      <Foundation
                        cards={previewPlayerFoundations[column.index] ?? []}
                        index={column.index}
                        scale={column.scale}
                        onFoundationClick={handleSandboxFoundationClick}
                        canReceive={!!selectedCard && !!validFoundationsForSelected[column.index]}
                        interactionMode={gameState.interactionMode}
                        showGraphics={showGraphics}
                        countPosition="none"
                        maskValue={false}
                        setDropRef={getFoundationDropRef(column.index)}
                        isDragTarget={dragTargetFoundationByIndex.has(column.index)}
                        watercolorOnlyCards={true}
                      />
                    </div>
                  ))}
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
                      isAnyCardDragging={dragState.isDragging}
                      tooltipEnabled={false}
                      upgradedCardIds={[]}
                      disableSpringMotion={true}
                      watercolorOnlyCards={true}
                    />
                  </div>
                )}
              </div>
                </div>
              </div>
            </div>
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
  );
}
