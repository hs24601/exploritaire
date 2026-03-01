import { memo, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ExplorationMapEdge, ExplorationMapNode, ExplorationBlockedCell } from './ExplorationMap';
import { ExplorationMap } from './ExplorationMap';
import { Compass, type Direction } from './Compass';
import { RichNarration } from './RichNarration';

export interface PoiNarration {
  title?: string;
  body?: string;
  tone?: 'teal' | 'gold' | 'violet' | 'green' | 'red' | 'blue' | 'orange' | 'pink' | 'silver' | 'brown' | 'black' | 'white';
  autoCloseOnDeparture?: boolean;
  completion?: {
    title?: string;
    body?: string;
    tone?: 'teal' | 'gold' | 'violet' | 'green' | 'red' | 'blue' | 'orange' | 'pink' | 'silver' | 'brown' | 'black' | 'white';
  };
}

interface ExploritaireProps {
  showNarration: boolean;
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
  poiMarkers: Array<{ id: string; x: number; y: number; label?: string }>;
  blockedCells: ExplorationBlockedCell[];
  blockedEdges: Array<{ fromX: number; fromY: number; toX: number; toY: number }>;
  conditionalEdges: Array<{ fromX: number; fromY: number; toX: number; toY: number; locked: boolean }>;
  activeBlockedEdge?: { fromX: number; fromY: number; toX: number; toY: number; reason?: string } | null;
  tableauWall?: { fromX: number; fromY: number; toX: number; toY: number; tableaus: number; pathBlock?: boolean } | null;
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
  onTeleport: (x: number, y: number) => void;
  showLighting: boolean;
  onMapAlignmentToggle: () => void;
  enableKeyboard?: boolean;
  onToggleMap?: () => void;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
}

export const Exploritaire = memo(function Exploritaire({
  showNarration,
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
  onStepForward,
  canStepForward,
  onStepBackward,
  canStepBackward,
  pathingLocked,
  onTogglePathingLocked,
  onHeadingChange,
  onTeleport,
  showLighting,
  onMapAlignmentToggle,
  enableKeyboard = false,
  onToggleMap,
  onRotateLeft,
  onRotateRight,
}: ExploritaireProps) {
  const narrationPalette = (() => {
    switch (narrationTone) {
      case 'gold':
        return { hue: '45deg', sat: '170%', con: 1.45, bri: 1.25, accent: '#f7d24b', text: '#fff7c8', border: 'rgba(247, 210, 75, 0.75)', glow: '0 0 22px rgba(247, 210, 75, 0.35)' };
      case 'violet':
        return { hue: '285deg', sat: '185%', con: 1.5, bri: 1.2, accent: '#c87de8', text: '#f3d5ff', border: 'rgba(200, 125, 232, 0.7)', glow: '0 0 22px rgba(200, 125, 232, 0.35)' };
      case 'green':
        return { hue: '125deg', sat: '150%', con: 1.35, bri: 1.2, accent: '#6bcb77', text: '#dbffe0', border: 'rgba(107, 203, 119, 0.7)', glow: '0 0 22px rgba(107, 203, 119, 0.35)' };
      case 'red':
        return { hue: '0deg', sat: '200%', con: 1.55, bri: 1.15, accent: '#ff4d4d', text: '#ffe2e2', border: 'rgba(255, 77, 77, 0.7)', glow: '0 0 22px rgba(255, 77, 77, 0.35)' };
      case 'blue':
        return { hue: '210deg', sat: '180%', con: 1.45, bri: 1.2, accent: '#6cb6ff', text: '#e4f2ff', border: 'rgba(108, 182, 255, 0.7)', glow: '0 0 22px rgba(108, 182, 255, 0.35)' };
      case 'orange':
        return { hue: '25deg', sat: '190%', con: 1.45, bri: 1.2, accent: '#ff8e66', text: '#ffe7dc', border: 'rgba(255, 142, 102, 0.7)', glow: '0 0 22px rgba(255, 142, 102, 0.35)' };
      case 'pink':
        return { hue: '320deg', sat: '160%', con: 1.35, bri: 1.25, accent: '#f5d0fe', text: '#ffe9ff', border: 'rgba(245, 208, 254, 0.7)', glow: '0 0 22px rgba(245, 208, 254, 0.35)' };
      case 'silver':
        return { hue: '210deg', sat: '30%', con: 1.2, bri: 1.35, accent: '#e2e8f0', text: '#f8fafc', border: 'rgba(226, 232, 240, 0.75)', glow: '0 0 22px rgba(226, 232, 240, 0.32)' };
      case 'brown':
        return { hue: '28deg', sat: '120%', con: 1.35, bri: 1.1, accent: '#a16207', text: '#ffe8c7', border: 'rgba(161, 98, 7, 0.7)', glow: '0 0 22px rgba(161, 98, 7, 0.35)' };
      case 'black':
        return { hue: '210deg', sat: '8%', con: 1.15, bri: 0.6, accent: '#ffffff', text: '#f8fafc', border: 'rgba(255, 255, 255, 0.4)', glow: '0 0 18px rgba(255, 255, 255, 0.18)' };
      case 'white':
        return { hue: '0deg', sat: '5%', con: 1.05, bri: 1.6, accent: '#ffffff', text: '#0a0a0a', border: 'rgba(255, 255, 255, 0.7)', glow: '0 0 18px rgba(255, 255, 255, 0.35)' };
      case 'teal':
      default:
        return { hue: '165deg', sat: '150%', con: 1.4, bri: 1.2, accent: '#7fdbca', text: '#d9fff8', border: 'rgba(127, 219, 202, 0.75)', glow: '0 0 22px rgba(127, 219, 202, 0.35)' };
    }
  })();

  const narrationFilter = `url(#narrator-watercolor) drop-shadow(0 0em 0em rgba(255,255,255,1)) sepia(1) brightness(${narrationPalette.bri}) contrast(${narrationPalette.con}) saturate(${narrationPalette.sat}) hue-rotate(${narrationPalette.hue})`;

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
        if (!onStepForward) return;
        event.preventDefault();
        onStepForward();
        return;
      }
      if (key === 'arrowdown' || key === 's') {
        if (!onStepBackward) return;
        event.preventDefault();
        onStepBackward();
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
  }, [enableKeyboard, onRotateLeft, onRotateRight, onStepBackward, onStepForward, onToggleMap]);

  return (
    <>
      {showNarration && (
        <div className="w-full px-2 sm:px-3 mb-2 flex justify-center pointer-events-none">
          <svg width="0" height="0" className="absolute" aria-hidden="true">
            <defs>
              <filter id="narrator-watercolor">
                <feTurbulence result="noise-lg" type="fractalNoise" baseFrequency=".0125" numOctaves="2" seed="1222" />
                <feTurbulence result="noise-md" type="fractalNoise" baseFrequency=".12" numOctaves="3" seed="11413" />
                <feComposite result="BaseGraphic" in="SourceGraphic" in2="noise-lg" operator="arithmetic" k1="0.3" k2="0.45" k4="-.07" />
                <feMorphology result="layer-1" in="BaseGraphic" operator="dilate" radius="0.5" />
                <feDisplacementMap result="layer-1" in="layer-1" in2="noise-lg" xChannelSelector="R" yChannelSelector="B" scale="2" />
                <feDisplacementMap result="layer-1" in="layer-1" in2="noise-md" xChannelSelector="R" yChannelSelector="B" scale="3" />
                <feDisplacementMap result="mask" in="layer-1" in2="noise-lg" xChannelSelector="A" yChannelSelector="A" scale="4" />
                <feGaussianBlur result="mask" in="mask" stdDeviation="6" />
                <feComposite result="layer-1" in="layer-1" in2="mask" operator="arithmetic" k1="1" k2=".25" k3="-.25" k4="0" />
                <feDisplacementMap result="layer-2" in="BaseGraphic" in2="noise-lg" xChannelSelector="G" yChannelSelector="R" scale="2" />
                <feDisplacementMap result="layer-2" in="layer-2" in2="noise-md" xChannelSelector="A" yChannelSelector="G" scale="3" />
                <feDisplacementMap result="glow" in="BaseGraphic" in2="noise-lg" xChannelSelector="R" yChannelSelector="A" scale="5" />
                <feMorphology result="glow-diff" in="glow" operator="erode" radius="2" />
                <feComposite result="glow" in="glow" in2="glow-diff" operator="out" />
                <feGaussianBlur result="glow" in="glow" stdDeviation=".5" />
                <feComposite result="layer-2" in="layer-2" in2="glow" operator="arithmetic" k1="1.2" k2="0.55" k3=".3" k4="-0.2" />
                <feComposite result="watercolor" in="layer-1" in2="layer-2" operator="over" />
              </filter>
            </defs>
          </svg>
          <div
            className="relative w-full rounded-[15px] border shadow-[0_12px_40px_rgba(0,0,0,0.65)] pointer-events-auto overflow-hidden"
            style={{ padding: '1px', width: `${explorationMapFrameWidth}px`, maxWidth: '100%', isolation: 'isolate', borderColor: narrationPalette.border, boxShadow: narrationPalette.glow }}
          >
            <div
              className="absolute inset-0 rounded-[15px]"
              aria-hidden="true"
              style={{
                background: 'rgb(0 0 0 / 100%)',
                filter: narrationFilter,
                opacity: 0.92,
                transform: 'translate(-1px, -1px)',
                zIndex: 0,
              }}
            />
            <div className="relative rounded-[15px] px-5 py-3" style={{ zIndex: 1, color: narrationPalette.text }}>
              <button
                type="button"
                onClick={onCloseNarrative}
                className="absolute top-2 right-2 h-7 w-7 rounded-full border border-white/60 bg-black/40 text-base leading-none flex items-center justify-center hover:bg-black/70 transition"
                aria-label="Dismiss message"
              >
                ×
              </button>
              <div className="space-y-1 text-center">
                <div className="text-sm font-semibold uppercase tracking-[0.6em]" style={{ color: narrationPalette.accent }}>
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
              onStepForward={onStepForward}
              canStepForward={canStepForward}
              onStepBackward={onStepBackward}
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
