import type { CSSProperties, MutableRefObject } from 'react';
import { Tableau, TableauGroup } from '../Tableau';
import { Exploritaire, type PoiNarration } from '../Exploritaire';
import type { Direction } from '../Compass';
import type { ExplorationBlockedCell, ExplorationMapEdge, ExplorationMapNode } from '../ExplorationMap';
import type { Card as CardType, GameState, Move, SelectedCard } from '../../engine/types';

interface ExplorationEncounterPanelProps {
  narrativeOpen: boolean;
  isRpgMode: boolean;
  hasSpawnedEnemies: boolean;
  narrationTone: PoiNarration['tone'];
  activePoiNarration?: PoiNarration | null;
  onCloseNarrative: () => void;
  explorationMapFrameWidth: number;
  mapVisible: boolean;
  hasUnclearedVisibleTableaus: boolean;
  explorationMapWidth: number;
  explorationMapHeight: number;
  explorationHeading: Direction;
  explorationMapAlignment: 'player' | 'map';
  explorationCurrentNodeId: string;
  explorationTrailNodeIds: string[];
  explorationNodes: ExplorationMapNode[];
  explorationEdges: ExplorationMapEdge[];
  explorationPoiMarkers: Array<{ coordKey: string; label: string; tone: 'teal' | 'orange' | 'pink' | 'white' }>;
  explorationBlockedCells: ExplorationBlockedCell[];
  explorationBlockedEdges: Array<ExplorationMapEdge & { blocked?: boolean }>;
  explorationConditionalEdges: ExplorationMapEdge[];
  explorationActiveBlockedEdge?: ExplorationMapEdge | null;
  explorationTableauWall?: { fromX: number; fromY: number; toX: number; toY: number } | null;
  worldForcedPath?: Array<{ x: number; y: number }>;
  explorationForcedPathNextIndex?: number | null;
  explorationCurrentLocationTitle?: string;
  availableExplorationActionPoints: number;
  explorationSupplies: number;
  onExplorationUseSupply: () => void;
  explorationAppliedTraversalCount: number;
  travelRowsPerStep: number;
  onStepCostDecrease: () => void;
  onStepCostIncrease: () => void;
  stepExplorationOnPlay: () => void;
  canAdvanceExplorationHeading: boolean;
  devTraverseHoldEnabled: boolean;
  handleExplorationStepBackward: () => void;
  pathingLocked: boolean;
  onTogglePathingLocked: () => void;
  handleExplorationHeadingChange: (direction: Direction) => void;
  teleportToExplorationNode: (x: number, y: number) => void;
  lightingEnabled: boolean;
  onMapAlignmentToggle: () => void;
  isExplorationMode: boolean;
  handleToggleMap: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  forcedPerspectiveEnabled?: boolean;
  gameState: GameState;
  selectedCard: SelectedCard | null;
  handleTableauClick: (card: CardType, tableauIndex: number) => void;
  handleTableauTopCardRightClick?: (card: CardType, tableauIndex: number) => void;
  showGraphics: boolean;
  tableauCardScale: number;
  handleDragStartGuarded: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  dragState: {
    isDragging: boolean;
    card: CardType | null;
  };
  cloudSightActive: boolean;
  tableauCanPlay: boolean[];
  noValidMoves: boolean;
  explorationTableauRowHeightPx: number;
  tableauSlideOffsetPx: number;
  tableauSlideAnimating: boolean;
  explorationSlideAnimationMs: number;
  tableauRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  sunkCostTableauPulseStyle?: CSSProperties;
  revealAllCardsForIntro: boolean;
  enemyDraggingTableauIndexes: Set<number>;
  hiddenPlayerTableaus: Set<number>;
  maskAllPlayerTableauValues: boolean;
  getDisplayedStepIndexForColumn: (columnIndex: number) => number | null;
  getDebugStepLabelForColumn: (columnIndex: number) => string | undefined;
  ripTriggerByCardId?: Record<string, number>;
}

export function ExplorationEncounterPanel({
  narrativeOpen,
  isRpgMode,
  hasSpawnedEnemies,
  narrationTone,
  activePoiNarration,
  onCloseNarrative,
  explorationMapFrameWidth,
  mapVisible,
  hasUnclearedVisibleTableaus,
  explorationMapWidth,
  explorationMapHeight,
  explorationHeading,
  explorationMapAlignment,
  explorationCurrentNodeId,
  explorationTrailNodeIds,
  explorationNodes,
  explorationEdges,
  explorationPoiMarkers,
  explorationBlockedCells,
  explorationBlockedEdges,
  explorationConditionalEdges,
  explorationActiveBlockedEdge,
  explorationTableauWall,
  worldForcedPath,
  explorationForcedPathNextIndex,
  explorationCurrentLocationTitle,
  availableExplorationActionPoints,
  explorationSupplies,
  onExplorationUseSupply,
  explorationAppliedTraversalCount,
  travelRowsPerStep,
  onStepCostDecrease,
  onStepCostIncrease,
  stepExplorationOnPlay,
  canAdvanceExplorationHeading,
  devTraverseHoldEnabled,
  handleExplorationStepBackward,
  pathingLocked,
  onTogglePathingLocked,
  handleExplorationHeadingChange,
  teleportToExplorationNode,
  lightingEnabled,
  onMapAlignmentToggle,
  isExplorationMode,
  handleToggleMap,
  onRotateLeft,
  onRotateRight,
  forcedPerspectiveEnabled = true,
  gameState,
  selectedCard,
  handleTableauClick,
  handleTableauTopCardRightClick,
  showGraphics,
  tableauCardScale,
  handleDragStartGuarded,
  dragState,
  cloudSightActive,
  tableauCanPlay,
  noValidMoves,
  explorationTableauRowHeightPx,
  tableauSlideOffsetPx,
  tableauSlideAnimating,
  explorationSlideAnimationMs,
  tableauRefs,
  sunkCostTableauPulseStyle,
  revealAllCardsForIntro,
  enemyDraggingTableauIndexes,
  hiddenPlayerTableaus,
  maskAllPlayerTableauValues,
  getDisplayedStepIndexForColumn,
  getDebugStepLabelForColumn,
  ripTriggerByCardId,
}: ExplorationEncounterPanelProps) {
  return (
    <>
      <Exploritaire
        showNarration={narrativeOpen && isRpgMode && !hasSpawnedEnemies}
        narrationTone={narrationTone}
        activePoiNarration={activePoiNarration}
        onCloseNarrative={onCloseNarrative}
        explorationMapFrameWidth={explorationMapFrameWidth}
        showMap={isRpgMode && !hasSpawnedEnemies && mapVisible}
        hasUnclearedVisibleTableaus={hasUnclearedVisibleTableaus}
        mapWidth={explorationMapWidth}
        mapHeight={explorationMapHeight}
        heading={explorationHeading}
        alignmentMode={explorationMapAlignment}
        currentNodeId={explorationCurrentNodeId}
        trailNodeIds={explorationTrailNodeIds}
        nodes={explorationNodes}
        edges={explorationEdges}
        poiMarkers={explorationPoiMarkers}
        blockedCells={explorationBlockedCells}
        blockedEdges={explorationBlockedEdges}
        conditionalEdges={explorationConditionalEdges}
        activeBlockedEdge={explorationActiveBlockedEdge}
        tableauWall={explorationTableauWall}
        forcedPath={worldForcedPath}
        nextForcedPathIndex={explorationForcedPathNextIndex}
        travelLabel={explorationCurrentLocationTitle}
        actionPoints={availableExplorationActionPoints}
        supplyCount={explorationSupplies}
        onUseSupply={onExplorationUseSupply}
        traversalCount={explorationAppliedTraversalCount}
        stepCost={travelRowsPerStep}
        onStepCostDecrease={onStepCostDecrease}
        onStepCostIncrease={onStepCostIncrease}
        onStepForward={stepExplorationOnPlay}
        canStepForward={canAdvanceExplorationHeading || devTraverseHoldEnabled}
        onStepBackward={handleExplorationStepBackward}
        canStepBackward={explorationTrailNodeIds.length > 1}
        pathingLocked={pathingLocked}
        onTogglePathingLocked={onTogglePathingLocked}
        onHeadingChange={handleExplorationHeadingChange}
        onTeleport={teleportToExplorationNode}
        showLighting={lightingEnabled}
        onMapAlignmentToggle={onMapAlignmentToggle}
        enableKeyboard={isExplorationMode}
        onToggleMap={handleToggleMap}
        onRotateLeft={onRotateLeft}
        onRotateRight={onRotateRight}
      />
      {hasUnclearedVisibleTableaus && (
        forcedPerspectiveEnabled ? (
          <TableauGroup
            mode="perspective"
            tableaus={gameState.tableaus}
            selectedCard={selectedCard}
            onCardSelect={handleTableauClick}
            guidanceMoves={[]}
            interactionMode={gameState.interactionMode}
            showGraphics={showGraphics}
            cardScale={tableauCardScale}
            onDragStart={handleDragStartGuarded}
            draggingCardId={dragState.isDragging ? dragState.card?.id : null}
            isAnyCardDragging={dragState.isDragging}
            revealNextRow={cloudSightActive}
            tableauCanPlay={tableauCanPlay}
            noValidMoves={noValidMoves}
            onTopCardRightClick={handleTableauTopCardRightClick}
            ripTriggerByCardId={ripTriggerByCardId}
          />
        ) : (
          <div
            className="flex w-full justify-center gap-3 px-2 sm:px-3"
            style={{
              alignItems: 'flex-start',
              height: `${explorationTableauRowHeightPx}px`,
              overflow: 'hidden',
              transform: `translateX(${tableauSlideOffsetPx}px)`,
              transition: tableauSlideAnimating ? `transform ${explorationSlideAnimationMs}ms cubic-bezier(0.2, 0.9, 0.25, 1)` : 'none',
              willChange: 'transform',
            }}
          >
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
                  guidanceMoves={[]}
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
                  ripTriggerByCardId={ripTriggerByCardId}
                />
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
