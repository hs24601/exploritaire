import { memo, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ExplorationMapEdge, ExplorationMapNode, ExplorationBlockedCell } from './ExplorationMap';
import { ExplorationMap } from './ExplorationMap';
import { Compass, type Direction } from './Compass';
import { RichNarration } from './RichNarration';

export interface PoiNarration {
  title?: string;
  body?: string;
  tone?: 'teal' | 'orange' | 'pink' | 'white';
  autoCloseOnDeparture?: boolean;
  completion?: {
    title?: string;
    body?: string;
    tone?: 'teal' | 'orange' | 'pink' | 'white';
  };
}

interface ExploritaireProps {
  showNarration: boolean;
  narrationTheme: { outer: string; inner: string; accent: string };
  narrationTone: PoiNarration['tone'];
  activePoiNarration?: PoiNarration | null;
  onCloseNarrative: () => void;
  explorationMapFrameWidth: number;
  showMap: boolean;
  hasUnclearedVisibleTableaus: boolean;
  mapWidth: number;
  mapHeight: number;
  heading: Direction;
  alignmentMode: 'player' | 'map';
  currentNodeId: string;
  trailNodeIds: string[];
  nodes: ExplorationMapNode[];
  edges: ExplorationMapEdge[];
  poiMarkers: Array<{ coordKey: string; label: string; tone: 'teal' | 'orange' | 'pink' | 'white' }>;
  blockedCells: ExplorationBlockedCell[];
  blockedEdges: Array<ExplorationMapEdge & { blocked?: boolean }>;
  conditionalEdges: ExplorationMapEdge[];
  activeBlockedEdge?: ExplorationMapEdge | null;
  tableauWall?: { fromX: number; fromY: number; toX: number; toY: number } | null;
  forcedPath?: Array<{ x: number; y: number }>;
  nextForcedPathIndex?: number | null;
  travelLabel?: string;
  actionPoints: number;
  supplyCount: number;
  onUseSupply: () => void;
  traversalCount: number;
  stepCost: number;
  onStepCostDecrease: () => void;
  onStepCostIncrease: () => void;
  onStepForward: () => void;
  canStepForward: boolean;
  onStepBackward: () => void;
  canStepBackward: boolean;
  pathingLocked: boolean;
  onTogglePathingLocked: () => void;
  onHeadingChange: (direction: Direction) => void;
  onTeleport: (nodeId: string) => void;
  showLighting: boolean;
  onMapAlignmentToggle: () => void;
  enableKeyboard?: boolean;
  onToggleMap?: () => void;
  onStepForward?: () => void;
  onStepBackward?: () => void;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
}

export const Exploritaire = memo(function Exploritaire({
  showNarration,
  narrationTheme,
  narrationTone,
  activePoiNarration,
  onCloseNarrative,
  explorationMapFrameWidth,
  showMap,
  hasUnclearedVisibleTableaus,
  mapWidth,
  mapHeight,
  heading,
  alignmentMode,
  currentNodeId,
  trailNodeIds,
  nodes,
  edges,
  poiMarkers,
  blockedCells,
  blockedEdges,
  conditionalEdges,
  activeBlockedEdge,
  tableauWall,
  forcedPath,
  nextForcedPathIndex,
  travelLabel,
  actionPoints,
  supplyCount,
  onUseSupply,
  traversalCount,
  stepCost,
  onStepCostDecrease,
  onStepCostIncrease,
  onStepForward: onStepForwardControl,
  canStepForward,
  onStepBackward: onStepBackwardControl,
  canStepBackward,
  pathingLocked,
  onTogglePathingLocked,
  onHeadingChange,
  onTeleport,
  showLighting,
  onMapAlignmentToggle,
  enableKeyboard = false,
  onToggleMap,
  onStepForward: onStepForwardKey,
  onStepBackward: onStepBackwardKey,
  onRotateLeft,
  onRotateRight,
}: ExploritaireProps) {
  useEffect(() => {
    if (!enableKeyboard) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'm') {
        if (!onToggleMap) return;
        event.preventDefault();
        onToggleMap();
        return;
      }
      if (key === 'arrowup' || key === 'w') {
        if (!onStepForwardKey) return;
        event.preventDefault();
        onStepForwardKey();
        return;
      }
      if (key === 'arrowdown' || key === 's') {
        if (!onStepBackwardKey) return;
        event.preventDefault();
        onStepBackwardKey();
        return;
      }
      if (key === 'arrowleft' || key === 'a') {
        if (!onRotateLeft) return;
        event.preventDefault();
        onRotateLeft();
        return;
      }
      if (key === 'arrowright' || key === 'd') {
        if (!onRotateRight) return;
        event.preventDefault();
        onRotateRight();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, onRotateLeft, onRotateRight, onStepBackwardKey, onStepForwardKey, onToggleMap]);

  return (
    <>
      {showNarration && (
        <div className="w-full px-2 sm:px-3 mb-2 flex justify-center pointer-events-none">
          <div
            className={`relative w-full rounded-[15px] border border-game-teal/50 bg-gradient-to-br ${narrationTheme.outer} shadow-[0_12px_40px_rgba(0,0,0,0.65)] pointer-events-auto overflow-hidden`}
            style={{ padding: '1px', width: `${explorationMapFrameWidth}px`, maxWidth: '100%' }}
          >
            <div className={`relative rounded-[15px] bg-gradient-to-br ${narrationTheme.inner} px-5 py-3 text-game-white`}>
              <button
                type="button"
                onClick={onCloseNarrative}
                className="absolute top-2 right-2 h-7 w-7 rounded-full border border-white/60 bg-black/40 text-base leading-none flex items-center justify-center hover:bg-black/70 transition"
                aria-label="Dismiss message"
              >
                ×
              </button>
              <div className="space-y-1 text-center">
                <div className={`text-sm font-semibold uppercase tracking-[0.6em] ${narrationTheme.accent}`}>
                  {activePoiNarration?.title ? (
                    <RichNarration text={activePoiNarration.title} tone={narrationTone} />
                  ) : (
                    <>
                      Awaken your{' '}
                      <motion.span
                        className="inline-flex text-base md:text-lg font-black tracking-[0.6em]"
                        animate={{
                          scale: [1, 1.08, 1],
                          textShadow: [
                            '0 0 0 rgba(255,255,255,0)',
                            '0 0 18px rgba(126, 255, 199, 0.8)',
                            '0 0 0 rgba(255,255,255,0)',
                          ],
                        }}
                        transition={{ duration: 1.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                      >
                        aspect
                      </motion.span>
                    </>
                  )}
                </div>
                <div className="text-sm text-game-white/80 max-w-xl mx-auto">
                  {activePoiNarration?.body ? (
                    <RichNarration text={activePoiNarration.body} tone={narrationTone} />
                  ) : (
                    'You cannot progress through this physical world as just a spirit. Order the elements before you to unlock a physical aspect.'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showMap && (
        <div className="w-full px-2 sm:px-3 mb-2">
          <div
            className="relative mx-auto"
            style={{
              width: `${explorationMapFrameWidth}px`,
              maxWidth: '100%',
              maxHeight: hasUnclearedVisibleTableaus ? '50vh' : undefined,
              overflow: hasUnclearedVisibleTableaus ? 'hidden' : undefined,
            }}
          >
            <ExplorationMap
              nodes={nodes}
              edges={edges}
              width={mapWidth}
              height={mapHeight}
              heading={heading}
              alignmentMode={alignmentMode}
              currentNodeId={currentNodeId}
              trailNodeIds={trailNodeIds}
              poiMarkers={poiMarkers}
              blockedCells={blockedCells}
              blockedEdges={blockedEdges}
              conditionalEdges={conditionalEdges}
              activeBlockedEdge={activeBlockedEdge ?? undefined}
              tableauWall={tableauWall ?? undefined}
              forcedPath={forcedPath}
              nextForcedPathIndex={nextForcedPathIndex ?? undefined}
              travelLabel={travelLabel}
              actionPoints={actionPoints}
              supplyCount={supplyCount}
              onUseSupply={onUseSupply}
              traversalCount={traversalCount}
              stepCost={stepCost}
              onStepCostDecrease={onStepCostDecrease}
              onStepCostIncrease={onStepCostIncrease}
              onStepForward={onStepForwardControl}
              canStepForward={canStepForward}
              onStepBackward={onStepBackwardControl}
              canStepBackward={canStepBackward}
              pathingLocked={pathingLocked}
              onTogglePathingLocked={onTogglePathingLocked}
              onHeadingChange={onHeadingChange}
              onTeleport={onTeleport}
              showLighting={showLighting}
            />
            <div
              className="absolute top-0 right-0 z-20 pointer-events-auto"
              style={{ transform: 'scale(0.75)', transformOrigin: 'top right' }}
            >
              <Compass
                value={heading}
                onChange={onHeadingChange}
                mapAlignmentMode={alignmentMode}
                onMapAlignmentToggle={onMapAlignmentToggle}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});
