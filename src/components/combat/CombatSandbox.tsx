import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGraphics } from '../../contexts/GraphicsContext';
import { CARD_SIZE, ELEMENT_TO_SUIT, HAND_SOURCE_INDEX } from '../../engine/constants';
import { getBiomeDefinition } from '../../engine/biomes';
import { Foundation } from '../Foundation';
import { Tableau } from '../Tableau';
import { Hand } from '../Hand';
import { DragPreview } from '../DragPreview';
import { useDragDrop } from '../../hooks/useDragDrop';
import type { Card as CardType, GameState, SelectedCard } from '../../engine/types';

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
}

interface CombatSandboxProps {
  open: boolean;
  gameState: GameState;
  actions: CombatSandboxActions;
  timeScale: number;
  onCycleTimeScale: () => void;
  isGamePaused: boolean;
  onTogglePause: () => void;
  onClose: () => void;
  selectedCard: SelectedCard | null;
  validFoundationsForSelected: boolean[];
  noValidMoves: boolean;
  tableauCanPlay: boolean[];
}

const DIFFICULTY_ORDER: NonNullable<GameState['enemyDifficulty']>[] = ['easy', 'normal', 'hard', 'divine'];
const COMBAT_STANDARD_TABLEAU_COUNT = 7;
const COMBAT_STANDARD_TABLEAU_DEPTH = 4;
const COMBAT_STANDARD_COLUMN_ELEMENTS: CardType['element'][] = ['A', 'W', 'E', 'F', 'L', 'D', 'N'];

function createCombatStandardCard(tableauIndex: number, rowIndex: number, depth: number): CardType {
  const element = COMBAT_STANDARD_COLUMN_ELEMENTS[tableauIndex % COMBAT_STANDARD_COLUMN_ELEMENTS.length];
  const isTopCard = rowIndex === depth - 1;
  const rank = isTopCard
    ? Math.min(13, tableauIndex + 1)
    : Math.max(1, ((tableauIndex + rowIndex + 1) % 13) + 1);
  return {
    id: `initial_actions_sandbox_${tableauIndex}_${rowIndex}_${depth}`,
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
  gameState,
  actions,
  timeScale,
  onCycleTimeScale,
  isGamePaused,
  onTogglePause,
  onClose,
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

  const [combatModalOpen, setCombatModalOpen] = useState(true);
  const showGraphics = useGraphics();
  const enemyPreviewFoundations = gameState.enemyFoundations ?? [];
  const activeEnemyCount = (gameState.enemyActors ?? []).filter((actor) => (actor?.hp ?? 0) > 0).length;
  const enemyPreviewFoundationsForDisplay = activeEnemyCount > 1
    ? enemyPreviewFoundations
    : enemyPreviewFoundations.slice(0, 1);
  const previewPlayerFoundations = gameState.foundations;
  const previewHandCards = gameState.rpgHandCards ?? [];
  const previewTableauCardScale = 0.9;
  const previewHandCardScale = 0.85;
  const previewTableauWidth = Math.round(CARD_SIZE.width * previewTableauCardScale);
  const previewTableauHeight = Math.round(CARD_SIZE.height * previewTableauCardScale);
  const previewFoundationWidth = Math.round(CARD_SIZE.width * 0.9);
  const [fallbackTableaus, setFallbackTableaus] = useState<CardType[][]>(() => createCombatStandardTableaus());
  const gameTableaus = gameState.tableaus ?? [];
  const hasRenderableGameTableaus = gameTableaus.length > 0 && gameTableaus.some((tableau) => tableau.length > 0);
  const previewTableaus = hasRenderableGameTableaus ? gameTableaus : fallbackTableaus;
  const draggedHandCardRef = useRef<CardType | null>(null);
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
    if (useWild) {
      actions.playCardInRandomBiome(tableauIndex, foundationIndex);
      return;
    }
    actions.playFromTableau(tableauIndex, foundationIndex);
  }, [actions, useWild]);
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
  const dragTargetFoundationByIndex = useMemo(() => {
    if (!dragState.isDragging) return new Set<number>();
    return new Set<number>(previewPlayerFoundations.map((_, foundationIndex) => foundationIndex));
  }, [dragState.isDragging, previewPlayerFoundations]);
  const handleSandboxFoundationClick = (foundationIndex: number) => {
    if (gameState.interactionMode !== 'click') return;
    actions.playToFoundation(foundationIndex);
  };
  const handleRerollDeal = () => {
    const nextTableaus = createCombatStandardTableaus();
    setFallbackTableaus(nextTableaus);
    actions.setBiomeTableaus(nextTableaus);
  };
  useEffect(() => {
    if (open) {
      setCombatModalOpen(true);
    }
  }, [open]);
  useEffect(() => {
    if (hasRenderableGameTableaus) {
      setFallbackTableaus(gameTableaus);
    }
  }, [gameTableaus, hasRenderableGameTableaus]);
  const openCombatModal = () => setCombatModalOpen(true);
  const closeCombatModal = () => setCombatModalOpen(false);

  return (
    <>
      <div className="fixed top-[56px] bottom-4 right-4 z-[10015] w-[180px] max-w-[calc(50vw-1rem)] rounded-lg border border-game-gold/40 bg-black/85 p-3 text-[10px] font-mono text-game-white shadow-[0_12px_40px_rgba(0,0,0,0.75)] backdrop-blur-sm menu-text overflow-y-auto">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-game-gold">Combat Sandbox</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-game-pink/50 px-2 py-0.5 text-[10px] text-game-pink hover:border-game-pink hover:text-game-white transition-colors"
        >
          Close
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded border border-game-teal/30 bg-game-bg-dark/60 p-2 text-[9px] text-game-teal/90">
        <div>Phase: {gameState.phase}</div>
        <div>Side: {activeSide}</div>
        <div>Biome: {gameState.currentBiome ?? '--'}</div>
        <div>Turn: {gameState.randomBiomeTurnNumber ?? '--'}</div>
        <div>Enemies: {enemyCount}</div>
        <div>Enemy stacks: {enemyFoundationCount}</div>
        <div>Hand: {(gameState.rpgHandCards ?? []).length}</div>
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

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={openCombatModal}
          className="rounded border border-game-teal/50 bg-game-teal/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.3em] text-game-teal hover:border-game-teal hover:bg-game-teal/20 transition-colors"
        >
          Launch Battle View
        </button>
      </div>
    </div>

      {combatModalOpen && (
        <div
          className="fixed top-[56px] bottom-4 left-4 z-[10014] flex items-center justify-center"
          style={{
            width: 'calc(100vw - (180px + 3rem))',
          }}
        >
          <div className="rounded-lg border border-game-teal/30 bg-black/90 p-3 text-[10px] font-mono text-game-white shadow-[0_12px_40px_rgba(0,0,0,0.75)] backdrop-blur-sm menu-text h-full w-full flex flex-col">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-game-gold">Combat Elements</div>
              <button
                type="button"
                onClick={closeCombatModal}
                className="rounded border border-game-pink/50 px-2 py-0.5 text-[10px] text-game-pink hover:border-game-pink hover:text-game-white transition-colors"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col items-center justify-center space-y-3 h-full overflow-y-auto w-full">
              <div className="space-y-1">
                <div className="text-[8px] uppercase tracking-[0.4em] text-game-white/50">Enemy Foundations</div>
                <div className="flex flex-wrap items-start justify-center gap-2 overflow-x-auto px-1 py-1">
                  {enemyPreviewFoundationsForDisplay.length === 0 ? (
                    <div className="text-[9px] text-game-white/40">Spawn enemies to populate foundations.</div>
                  ) : (
                    enemyPreviewFoundationsForDisplay.map((cards, idx) => (
                      <div
                        key={`sandbox-enemy-${idx}`}
                        className="rounded border border-game-teal/40 bg-black/60 p-1"
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
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[8px] uppercase tracking-[0.4em] text-game-white/50">Tableau</div>
                <div
                  className="flex w-full items-start justify-center gap-3 overflow-visible px-1 py-2"
                  style={{ minHeight: previewTableauHeight + 56, paddingTop: 10, paddingBottom: 14 }}
                >
                  {previewTableaus.length === 0 ? (
                    <div className="text-[9px] text-game-white/40">Tableaus will render here once cards exist.</div>
                  ) : (
                    previewTableaus.map((tableau, idx) => (
                    <div
                      key={`sandbox-tableau-${idx}`}
                      className="flex items-start p-0"
                      style={{ minWidth: previewTableauWidth, minHeight: previewTableauHeight + 44 }}
                    >
                        <Tableau
                          cards={tableau}
                          tableauIndex={idx}
                          canPlay={tableauCanPlay[idx] ?? false}
                          noValidMoves={noValidMoves}
                          selectedCard={selectedCard}
                          onCardSelect={handleSandboxCardSelect}
                          guidanceMoves={[]}
                          interactionMode={gameState.interactionMode}
                          onDragStart={handleSandboxTableauDragStart}
                          showGraphics={showGraphics}
                          cardScale={previewTableauCardScale}
                          draggingCardId={dragState.isDragging ? dragState.card?.id : null}
                          isAnyCardDragging={dragState.isDragging}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[8px] uppercase tracking-[0.4em] text-game-white/50">Player Foundations</div>
                <div className="flex flex-wrap items-start justify-center gap-2 overflow-x-auto px-1 py-1">
                  {previewPlayerFoundations.map((cards, idx) => (
                    <div
                      key={`sandbox-player-${idx}`}
                      className="rounded border border-game-teal/40 bg-black/60 p-1"
                      style={{ minWidth: previewFoundationWidth }}
                    >
                      <Foundation
                        cards={cards}
                        index={idx}
                        onFoundationClick={handleSandboxFoundationClick}
                        canReceive={!!selectedCard && !!validFoundationsForSelected[idx]}
                        interactionMode={gameState.interactionMode}
                        showGraphics={showGraphics}
                        countPosition="none"
                        maskValue={false}
                        setDropRef={setFoundationRef}
                        isDragTarget={dragTargetFoundationByIndex.has(idx)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[8px] uppercase tracking-[0.4em] text-game-white/50">Player Hand</div>
                <div className="flex justify-center overflow-x-auto px-1 py-1">
                  {previewHandCards.length === 0 ? (
                    <div className="text-[9px] text-game-white/40">Hand will display held cards here.</div>
                  ) : (
                    <div className="flex justify-center w-full">
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
                      />
                    </div>
                  )}
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
      )}
    </>
  );
}
