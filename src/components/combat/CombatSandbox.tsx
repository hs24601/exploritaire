import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGraphics } from '../../contexts/GraphicsContext';
import { useCardScalePreset } from '../../contexts/CardScaleContext';
import { CARD_SIZE, ELEMENT_TO_SUIT, HAND_SOURCE_INDEX, WILD_SENTINEL_RANK } from '../../engine/constants';
import { getRankDisplay } from '../../engine/rules';
import { getBiomeDefinition } from '../../engine/biomes';
import { getActorDefinition } from '../../engine/actors';
import { createActorDeckStateWithOrim } from '../../engine/actorDecks';
import { Foundation } from '../Foundation';
import { Hand } from '../Hand';
import { DragPreview } from '../DragPreview';
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
const COMBAT_RANDOM_ELEMENTAL_POOL: CardType['element'][] = ['A', 'W', 'E', 'F', 'L', 'D', 'N'];
const COMBAT_LAB_FOUNDATION_ACTOR_DEFINITION_IDS: Array<'felis' | 'ursus' | 'lupus'> = ['felis', 'ursus', 'lupus'];
const ENEMY_TABLEAU_STACK_PEEK_PX = 8;
const ARENA_FIT_PADDING_X = 16;
const ARENA_FIT_PADDING_Y = 20;
const ARENA_MIN_SCALE = 0.35;

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

  const activeSide = gameState.randomBiomeActiveSide ?? 'player';
  const enemyCount = 1;
  const currentDifficulty = gameState.enemyDifficulty ?? 'normal';
  const currentDifficultyIndex = Math.max(0, DIFFICULTY_ORDER.indexOf(currentDifficulty));
  const nextDifficulty = DIFFICULTY_ORDER[(currentDifficultyIndex + 1) % DIFFICULTY_ORDER.length];
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const fpsLabelRef = useRef<HTMLDivElement | null>(null);
  const showGraphics = useGraphics();
  const tableGlobalScale = useCardScalePreset('table');
  const enemyFoundations = useMemo<CardType[][]>(() => {
    const existing = gameState.enemyFoundations ?? [];
    if (existing.length > 0) return existing;
    return [[createLabTargetDummyFoundationCard()]];
  }, [gameState.enemyFoundations]);
  const enemyFoundationCount = enemyFoundations.length;
  const previewPlayerFoundations = gameState.foundations;
  const buildFoundationOverlay = (foundationIndex: number) => {
    const base = previewPlayerFoundations[foundationIndex]?.[0];
    if (!base) return undefined;
    const name = base.name?.trim();
    const accentColor = '#7fdbca';
    const rankDisplay = getRankDisplay(base.rank);
    if (!name) return undefined;
    return {
      name: name || 'Ally',
      accentColor,
      rankDisplay,
    };
  };
  // Always register drop refs so drag hit-testing works even while foundations are seeding.
  const getFoundationDropRef = (_index: number) => setFoundationRef;
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
    const cards: CardType[] = [];
    actorIds.forEach((actorId, index) => {
      if (index < 0 || index >= foundations.length) return;
      const foundationCard = foundations[index]?.[0];
      const inferredDefinitionId = inferFoundationDefinitionId(foundationCard)
        ?? actorPool.find((actor) => actor.id === actorId)?.definitionId
        ?? null;
      const deck = gameState.actorDecks[actorId]
        ?? (inferredDefinitionId
          ? createActorDeckStateWithOrim(actorId || `lab-${inferredDefinitionId}`, inferredDefinitionId, gameState.orimDefinitions).deck
          : undefined);
      if (!deck) return;
      deck.cards.forEach((deckCard) => {
        const slotWithOrim = deckCard.slots.find((slot) => !!slot.orimId);
        const slotOrimId = slotWithOrim?.orimId;
        const instance = slotOrimId ? gameState.orimInstances[slotOrimId] : undefined;
        const inferredDefinitionId = instance?.definitionId
          ?? (slotOrimId && gameState.orimDefinitions.some((entry) => entry.id === slotOrimId)
            ? slotOrimId
            : gameState.orimDefinitions.find((entry) => !!slotOrimId && slotOrimId.includes(`orim-${entry.id}-`))?.id);
        const definition = inferredDefinitionId
          ? gameState.orimDefinitions.find((entry) => entry.id === inferredDefinitionId)
          : undefined;
        const element = definition?.elements?.[0] ?? 'N';
        cards.push({
          id: `lab-deck-${actorId}-${deckCard.id}`,
          rank: Math.max(1, Math.min(13, deckCard.value)),
          element,
          suit: ELEMENT_TO_SUIT[element],
          sourceActorId: actorId,
          sourceDeckCardId: deckCard.id,
          cooldown: deckCard.cooldown,
          maxCooldown: deckCard.maxCooldown,
          rpgApCost: deckCard.cost,
          rpgAbilityId: definition?.id ?? inferredDefinitionId,
          name: definition?.name ?? (inferredDefinitionId ? inferredDefinitionId.replace(/[_-]+/g, ' ') : `${actorId} ability`),
          description: definition?.description,
          orimSlots: deckCard.slots.map((slot) => ({ ...slot })),
        });
      });
    });
    return cards;
  }, [isLabMode, gameState.activeSessionTileId, gameState.tileParties, gameState.foundations, gameState.actorDecks, gameState.orimInstances, gameState.orimDefinitions]);
  const previewHandCards = isLabMode
    ? (deckBackedLabHandCards.length > 0 ? deckBackedLabHandCards : (gameState.rpgHandCards ?? []))
    : (gameState.rpgHandCards ?? []);
  const previewTableauCardScale = 0.82;
  const secondaryTableauCardScale = Math.round(previewTableauCardScale * 0.9 * 1000) / 1000;
  const previewHandCardScale = 0.68;
  const previewTableauHeight = Math.round(CARD_SIZE.height * previewTableauCardScale);
  const previewFoundationWidth = Math.round(CARD_SIZE.width * 0.9);
  const [fallbackTableaus, setFallbackTableaus] = useState<CardType[][]>(() => createCombatStandardTableaus());
  const gameTableaus = gameState.tableaus ?? [];
  const hasRenderableGameTableaus = gameTableaus.length > 0 && gameTableaus.some((tableau) => tableau.length > 0);
  const previewTableaus = hasRenderableGameTableaus ? gameTableaus : fallbackTableaus;
  // Enemy uses the same shared tableau; no separate enemy tableau cards.
  const foundationIndexes = [0, 1, 2];
  const enemyFoundationIndexes = [0];
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
        actions.playFromHand(draggedHandCard, foundationIndex, useWild);
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
  }, [actions, useWild, previewPlayerFoundations.length]);
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
      actions.playFromHand(card, firstPlayableFoundation, useWild);
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
        arr.push(createCombatStandardCard(tableauIndex, arr.length, COMBAT_STANDARD_TABLEAU_DEPTH));
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
                <div className="flex items-start justify-center gap-2">
                  {enemyFoundationIndexes.map((idx) => (
                    <div
                      key={`enemy-foundation-${idx}`}
                      className="rounded border border-game-teal/30 bg-black/45 p-[3px] shrink-0"
                      style={{ minWidth: previewFoundationWidth }}
                    >
                      <Foundation
                        cards={enemyFoundations[idx] ?? []}
                        index={idx}
                        onFoundationClick={() => {}}
                        canReceive={false}
                        interactionMode={gameState.interactionMode}
                        showGraphics={showGraphics}
                        countPosition="none"
                        maskValue={false}
                        watercolorOnlyCards={false}
                      />
                    </div>
                  ))}
                </div>
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
                  startIndex={0}
                />
              </div>
              <div className="flex w-full items-start justify-center px-1">
                <div className="flex items-start justify-center gap-2">
                  {foundationIndexes.map((idx) => (
                    <div
                      key={`player-foundation-${idx}`}
                      className="rounded border border-game-teal/30 bg-black/45 p-[3px] shrink-0"
                      style={{ minWidth: previewFoundationWidth }}
                    >
                      <Foundation
                        cards={previewPlayerFoundations[idx] ?? []}
                        index={idx}
                        onFoundationClick={() => actions.playToFoundation(idx)}
                        canReceive={!!selectedCard && !!validFoundationsForSelected[idx]}
                        interactionMode={gameState.interactionMode}
                        showGraphics={showGraphics}
                        countPosition="none"
                        maskValue={false}
                        setDropRef={getFoundationDropRef(idx)}
                        watercolorOnlyCards={false}
                        foundationOverlay={buildFoundationOverlay(idx)}
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
                      watercolorOnlyCards={false}
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
