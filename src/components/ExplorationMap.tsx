import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Direction } from './Compass';
import { DIRECTIONS } from './Compass';
import { WatercolorSplotch } from '../watercolor/WatercolorSplotch';
import { generateSplotchConfig } from '../watercolor/splotchUtils';

export type ExplorationMapNode = {
  id: string;
  heading: Direction;
  x: number;
  y: number;
  z: number;
  visits: number;
};

export type ExplorationMapEdge = {
  id: string;
  fromId: string;
  toId: string;
  traversals: number;
};

interface ExplorationMapProps {
  nodes: ExplorationMapNode[];
  edges: ExplorationMapEdge[];
  width?: number;
  heading?: Direction;
  alignmentMode?: 'compass' | 'north';
  currentNodeId: string | null;
  trailNodeIds?: string[];
  travelLabel?: string;
  actionPoints?: number;
  traversalCount?: number;
  stepCost?: number;
  onStepCostDecrease?: () => void;
  onStepCostIncrease?: () => void;
  onHeadingChange?: (direction: Direction) => void;
  onTeleport?: (x: number, y: number) => void;
  poiMarkers?: Array<{ id: string; x: number; y: number; label?: string }>;
}

const WIDTH = 190;
const HEIGHT = 190;
const CELL_SIZE = 26;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_FACTOR = 1.15;

function getNextHeadingFromDirection(heading: Direction, clockwise: boolean): Direction {
  const startIndex = DIRECTIONS.indexOf(heading);
  if (startIndex < 0) return 'N';
  const delta = clockwise ? 1 : -1;
  const idx = (startIndex + delta + DIRECTIONS.length) % DIRECTIONS.length;
  return DIRECTIONS[idx];
}

export const ExplorationMap = memo(function ExplorationMap({
  nodes,
  edges,
  width = WIDTH,
  heading = 'N',
  currentNodeId,
  trailNodeIds = [],
  travelLabel,
  actionPoints,
  traversalCount = 0,
  stepCost,
  onStepCostDecrease,
  onStepCostIncrease,
  onHeadingChange,
  onTeleport,
  poiMarkers = [],
}: ExplorationMapProps) {
  const [mouseCoord, setMouseCoord] = useState<{ x: number; y: number } | null>(null);
  const [isTeleportActive, setIsTeleportActive] = useState(false);
  const [teleportValue, setTeleportValue] = useState('');
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  // Mirror view into a ref so callbacks can read current values without stale closures
  const viewRef = useRef(view);
  viewRef.current = view;

  void stepCost;
  void onStepCostDecrease;
  void onStepCostIncrease;

  const cx = width / 2;
  const cy = HEIGHT / 2;

  const { zoom, panX, panY } = view;
  const cellSizeZ = CELL_SIZE * zoom;

  const currentNode = useMemo(
    () => nodes.find((n) => n.id === currentNodeId) ?? null,
    [nodes, currentNodeId],
  );
  const camX = currentNode?.x ?? 0;
  const camY = currentNode?.y ?? 0;
  // Mirror camX/camY into refs for use in callbacks
  const camXRef = useRef(camX);
  const camYRef = useRef(camY);
  camXRef.current = camX;
  camYRef.current = camY;

  const projected = useMemo(() => nodes.map((node) => ({
    ...node,
    px: cx + (node.x - camX) * cellSizeZ + panX,
    py: cy + (node.y - camY) * cellSizeZ + panY,
  })), [nodes, cx, cy, camX, camY, cellSizeZ, panX, panY]);

  const projectedPoiMarkers = useMemo(() => poiMarkers.map((poi) => ({
    ...poi,
    px: cx + (poi.x - camX) * cellSizeZ + panX,
    py: cy + (poi.y - camY) * cellSizeZ + panY,
  })), [poiMarkers, cx, cy, camX, camY, cellSizeZ, panX, panY]);

  const projectedById = useMemo(
    () => new Map(projected.map((n) => [n.id, n] as const)),
    [projected],
  );

  // Grid line ranges — account for zoom and pan
  const gridXRange = useMemo(() => {
    const min = Math.floor(camX + (-cx - panX) / cellSizeZ) - 1;
    const max = Math.ceil(camX + (width - cx - panX) / cellSizeZ) + 1;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [camX, cx, width, cellSizeZ, panX]);

  const gridYRange = useMemo(() => {
    const min = Math.floor(camY + (-cy - panY) / cellSizeZ) - 1;
    const max = Math.ceil(camY + (HEIGHT - cy - panY) / cellSizeZ) + 1;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [camY, cy, cellSizeZ, panY]);

  const trailSegments = useMemo(() => {
    if (trailNodeIds.length < 2) return [];
    const segments: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 1; i < trailNodeIds.length; i += 1) {
      const from = projectedById.get(trailNodeIds[i - 1]);
      const to = projectedById.get(trailNodeIds[i]);
      if (!from || !to) continue;
      segments.push({ id: `${trailNodeIds[i - 1]}->${trailNodeIds[i]}#${i}`, x1: from.px, y1: from.py, x2: to.px, y2: to.py });
    }
    return segments;
  }, [projectedById, trailNodeIds]);

  const trailBreadcrumbs = useMemo(() => {
    if (trailNodeIds.length === 0) return [];
    const visitsByNode: Record<string, number> = {};
    return trailNodeIds.map((nodeId, index) => {
      const node = projectedById.get(nodeId);
      if (!node) return null;
      const visit = visitsByNode[nodeId] ?? 0;
      visitsByNode[nodeId] = visit + 1;
      const angle = (visit * 137.5 * Math.PI) / 180;
      const radius = Math.min(5, 1.3 + visit * 0.55);
      const age = trailNodeIds.length - 1 - index;
      return {
        id: `${nodeId}#${index}`,
        x: node.px + Math.cos(angle) * radius,
        y: node.py + Math.sin(angle) * radius,
        alpha: Math.max(0.22, 0.85 - age * 0.015),
      };
    }).filter(Boolean) as Array<{ id: string; x: number; y: number; alpha: number }>;
  }, [projectedById, trailNodeIds]);

  const trailSplotches = useMemo(() => {
    const splotches: Array<{
      id: string; x: number; y: number; size: number;
      config: ReturnType<typeof generateSplotchConfig>; index: number;
    }> = [];
    const splotchSize = 30;
    trailSegments.forEach((segment, si) => {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      if (Math.sqrt(dx * dx + dy * dy) === 0) return;
      for (let i = 0; i < 2; i += 1) {
        const t = (i + 0.5) / 2;
        splotches.push({
          id: `${segment.id}-splotch-${i}`,
          x: segment.x1 + dx * t - splotchSize / 2,
          y: segment.y1 + dy * t - splotchSize / 2,
          size: splotchSize,
          config: generateSplotchConfig({
            scale: 0.8 + Math.random() * 0.4,
            offset: [(Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2],
            opacity: 0.5 + Math.random() * 0.2,
            blendMode: 'multiply',
            seed: (si * 1000 + i) * 100,
          }),
          index: si * 2 + i,
        });
      }
    });
    return splotches;
  }, [trailSegments]);

  // Facing arrow aligned to compass bearing: N=up, E=right, S=down, W=left
  const facingIndicator = useMemo(() => {
    if (!currentNodeId) return null;
    const headingIndex = DIRECTIONS.indexOf(heading);
    if (headingIndex < 0) return null;
    const directionRad = ((headingIndex * 45 - 90) * Math.PI) / 180;
    const ux = Math.cos(directionRad);
    const uy = Math.sin(directionRad);
    return {
      tipX: ux * 10.5, tipY: uy * 10.5,
      leftX: -uy * 2.8 - ux * 1.8, leftY: ux * 2.8 - uy * 1.8,
      rightX: uy * 2.8 - ux * 1.8, rightY: -ux * 2.8 - uy * 1.8,
    };
  }, [currentNodeId, heading]);

  // Non-passive wheel event for zoom centered on cursor
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (width / rect.width);
      const my = (e.clientY - rect.top) * (HEIGHT / rect.height);
      setView((prev) => {
        const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor));
        const zoomRatio = newZoom / prev.zoom;
        const halfW = width / 2;
        const halfH = HEIGHT / 2;
        return {
          zoom: newZoom,
          panX: (mx - halfW) - (mx - halfW - prev.panX) * zoomRatio,
          panY: (my - halfH) - (my - halfH - prev.panY) * zoomRatio,
        };
      });
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [width]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = HEIGHT / rect.height;
    if (isDraggingRef.current) {
      const dx = (e.clientX - lastPointerRef.current.x) * scaleX;
      const dy = (e.clientY - lastPointerRef.current.y) * scaleY;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      setView((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
    } else {
      const { zoom: z, panX: px0, panY: py0 } = viewRef.current;
      const cs = CELL_SIZE * z;
      const halfW = width / 2;
      const halfH = HEIGHT / 2;
      const svgX = (e.clientX - rect.left) * scaleX;
      const svgY = (e.clientY - rect.top) * scaleY;
      setMouseCoord({
        x: Math.round((svgX - halfW - px0) / cs) + camXRef.current,
        y: Math.round((svgY - halfH - py0) / cs) + camYRef.current,
      });
    }
  }, [width]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handlePointerLeave = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
    setMouseCoord(null);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setView({ zoom: 1, panX: 0, panY: 0 });
  }, []);

  const handleCoordDoubleClick = useCallback(() => {
    if (!onTeleport) return;
    setTeleportValue(currentNode ? `${currentNode.x},${currentNode.y}` : '0,0');
    setIsTeleportActive(true);
  }, [onTeleport, currentNode]);

  const handleTeleportCommit = useCallback(() => {
    if (!onTeleport) return;
    const parts = teleportValue.split(/[\s,]+/).map((s) => parseInt(s.trim(), 10));
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      onTeleport(parts[0], parts[1]);
    }
    setIsTeleportActive(false);
  }, [onTeleport, teleportValue]);

  const handleTeleportKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTeleportCommit();
    } else if (e.key === 'Escape') {
      setIsTeleportActive(false);
    }
  }, [handleTeleportCommit]);

  const handleLeftChevron = useCallback(() => {
    if (!onHeadingChange) return;
    onHeadingChange(getNextHeadingFromDirection(heading, false));
  }, [heading, onHeadingChange]);

  const handleRightChevron = useCallback(() => {
    if (!onHeadingChange) return;
    onHeadingChange(getNextHeadingFromDirection(heading, true));
  }, [heading, onHeadingChange]);

  return (
    <div
      className="relative rounded border px-2 py-2"
      style={{
        width: width + 14,
        borderColor: 'rgba(127, 219, 202, 0.65)',
        backgroundColor: 'rgba(10, 10, 10, 0.76)',
        boxShadow: '0 0 12px rgba(127, 219, 202, 0.28)',
      }}
    >
      <div
        className="absolute left-2 top-2 px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-[1px]"
        style={{
          borderColor: 'rgba(127, 219, 202, 0.6)',
          color: '#7fdbca',
          backgroundColor: 'rgba(8, 12, 14, 0.88)',
        }}
        title="Successful travel steps"
      >
        👣 {traversalCount}
      </div>
      <div className="text-[9px] font-bold tracking-[2px] text-game-teal/80 text-center mb-1">
        {travelLabel ?? 'EXPLORE MAP'}
      </div>

      <div style={{ position: 'relative', width, height: HEIGHT }} className="block">
        <svg
          ref={svgRef}
          width={width}
          height={HEIGHT}
          className="absolute inset-0"
          style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerLeave}
          onPointerLeave={handlePointerLeave}
          onDoubleClick={handleDoubleClick}
        >
          {/* Vertical grid lines */}
          {gridXRange.map((x) => {
            const sx = cx + (x - camX) * cellSizeZ + panX;
            return (
              <line
                key={`gx-${x}`}
                x1={sx} y1={0}
                x2={sx} y2={HEIGHT}
                stroke={x === 0 ? 'rgba(127, 219, 202, 0.45)' : 'rgba(127, 219, 202, 0.13)'}
                strokeWidth={x === 0 ? 1 : 0.5}
              />
            );
          })}
          {/* Horizontal grid lines */}
          {gridYRange.map((y) => {
            const sy = cy + (y - camY) * cellSizeZ + panY;
            return (
              <line
                key={`gy-${y}`}
                x1={0} y1={sy}
                x2={width} y2={sy}
                stroke={y === 0 ? 'rgba(127, 219, 202, 0.45)' : 'rgba(127, 219, 202, 0.13)'}
                strokeWidth={y === 0 ? 1 : 0.5}
              />
            );
          })}
          {/* X-axis coordinate labels along bottom */}
          {gridXRange.map((x) => {
            const sx = cx + (x - camX) * cellSizeZ + panX;
            return (
              <text
                key={`xl-${x}`}
                x={sx}
                y={HEIGHT - 2}
                textAnchor="middle"
                fontSize={6}
                fill="rgba(127, 219, 202, 0.38)"
              >
                {x}
              </text>
            );
          })}
          {/* Y-axis coordinate labels along left */}
          {gridYRange.map((y) => {
            const sy = cy + (y - camY) * cellSizeZ + panY;
            return (
              <text
                key={`yl-${y}`}
                x={3}
                y={sy + 2}
                textAnchor="start"
                fontSize={6}
                fill="rgba(127, 219, 202, 0.38)"
              >
                {y}
              </text>
            );
          })}

          {/* Trail segments */}
          {trailSegments.map((segment) => (
            <line
              key={segment.id}
              x1={segment.x1} y1={segment.y1}
              x2={segment.x2} y2={segment.y2}
              stroke="rgba(247, 210, 75, 0.78)"
              strokeWidth={1.1}
              strokeDasharray="2.2 2.2"
            />
          ))}
          {/* Trail breadcrumbs */}
          {trailBreadcrumbs.map((crumb) => (
            <circle
              key={crumb.id}
              cx={crumb.x} cy={crumb.y}
              r={1.55}
              fill={`rgba(247, 210, 75, ${crumb.alpha})`}
            />
          ))}
          {/* Edges */}
          {edges.map((edge) => {
            const from = projectedById.get(edge.fromId);
            const to = projectedById.get(edge.toId);
            if (!from || !to) return null;
            const alpha = Math.min(0.85, 0.28 + edge.traversals * 0.12);
            return (
              <line
                key={edge.id}
                x1={from.px} y1={from.py}
                x2={to.px} y2={to.py}
                stroke={`rgba(127, 219, 202, ${alpha})`}
                strokeWidth={Math.min(2.6, 1 + edge.traversals * 0.35)}
              />
            );
          })}
          {/* Nodes */}
          {projected.slice().sort((a, b) => a.py - b.py).map((node) => {
            const isCurrent = node.id === currentNodeId;
            const ring = isCurrent ? '#f7d24b' : '#7fdbca';
            const fill = isCurrent ? 'rgba(230, 179, 30, 0.22)' : 'rgba(12, 34, 36, 0.86)';
            return (
              <g key={node.id} transform={`translate(${node.px}, ${node.py})`}>
                <circle
                  r={isCurrent ? 8 : 6}
                  fill={fill}
                  stroke={ring}
                  strokeWidth={isCurrent ? 1.8 : 1.2}
                />
                {!isCurrent && (
                  <text x={0} y={3} textAnchor="middle" fontSize={7} fontWeight={700} fill="#bdeee5">
                    {node.heading}
                  </text>
                )}
                {isCurrent && facingIndicator && (
                  <polygon
                    points={`${facingIndicator.tipX},${facingIndicator.tipY} ${facingIndicator.leftX},${facingIndicator.leftY} ${facingIndicator.rightX},${facingIndicator.rightY}`}
                    fill="#f7d24b"
                    stroke="rgba(15, 16, 18, 0.95)"
                    strokeWidth={0.45}
                  />
                )}
                {/* Current coordinates label */}
                {isCurrent && currentNode && (
                  <text
                    x={11}
                    y={4}
                    textAnchor="start"
                    fontSize={7}
                    fill="rgba(247, 210, 75, 0.9)"
                    style={{ fontFamily: 'monospace' }}
                  >
                    ({currentNode.x},{currentNode.y})
                  </text>
                )}
              </g>
            );
          })}
          {/* POI markers */}
          {projectedPoiMarkers.map((poi) => (
            <g key={poi.id} transform={`translate(${poi.px}, ${poi.py})`}>
              <circle
                r={4.2}
                fill="rgba(10, 8, 6, 0.9)"
                stroke="rgba(247, 210, 75, 0.95)"
                strokeWidth={1}
              />
              <text
                x={0}
                y={2.4}
                textAnchor="middle"
                fontSize={7}
                fontWeight={700}
                fill="#f7d24b"
              >
                {poi.label ?? '?'}
              </text>
            </g>
          ))}
          {/* Mouse coordinate display — lower-right corner */}
          {mouseCoord && (
            <text
              x={width - 3}
              y={HEIGHT - 3}
              textAnchor="end"
              fontSize={7}
              fill="rgba(127, 219, 202, 0.8)"
              style={{ fontFamily: 'monospace' }}
            >
              {mouseCoord.x}, {mouseCoord.y}
            </text>
          )}
          {/* Zoom level indicator — lower-left corner, only when not at 1x */}
          {Math.abs(zoom - 1) > 0.05 && (
            <text
              x={4}
              y={HEIGHT - 3}
              textAnchor="start"
              fontSize={7}
              fill="rgba(127, 219, 202, 0.55)"
              style={{ fontFamily: 'monospace' }}
            >
              {zoom.toFixed(1)}×
            </text>
          )}
        </svg>

        {/* Watercolor splotches overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {trailSplotches.map((splotch) => (
            <div
              key={splotch.id}
              className="absolute"
              style={{ left: splotch.x, top: splotch.y, width: splotch.size, height: splotch.size, overflow: 'hidden' }}
            >
              <WatercolorSplotch
                config={splotch.config}
                index={splotch.index}
                containerWidth={splotch.size}
                containerHeight={splotch.size}
              />
            </div>
          ))}
        </div>
        {typeof actionPoints === 'number' && (
          <div
            className="absolute right-1 bottom-1 px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-[1px] pointer-events-none"
            style={{
              borderColor: 'rgba(247, 210, 75, 0.8)',
              color: '#f7d24b',
              backgroundColor: 'rgba(10, 8, 6, 0.92)',
              textShadow: '0 0 4px rgba(230, 179, 30, 0.45)',
            }}
            title="Available action points"
          >
            AP {Math.max(0, Math.floor(actionPoints))}
          </div>
        )}
      </div>

      {/* Bottom row: heading chevrons + coordinate display */}
      {(onHeadingChange || (currentNode && onTeleport)) && (
        <div className="mt-1 flex items-center justify-center gap-2">
          {onHeadingChange && (
            <button
              type="button"
              onClick={handleLeftChevron}
              className="px-2 py-0.5 rounded border font-bold leading-none select-none"
              style={{ borderColor: 'rgba(127, 219, 202, 0.65)', color: '#7fdbca', backgroundColor: 'rgba(10, 10, 10, 0.8)' }}
              title="Counterclockwise to previous direction"
            >
              ‹
            </button>
          )}
          {/* Coordinate display / teleport input */}
          {currentNode && (
            isTeleportActive ? (
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                type="text"
                value={teleportValue}
                onChange={(e) => setTeleportValue(e.target.value)}
                onKeyDown={handleTeleportKeyDown}
                onBlur={handleTeleportCommit}
                className="rounded border text-center text-[10px] font-mono font-bold"
                style={{
                  width: 68,
                  borderColor: 'rgba(247, 210, 75, 0.85)',
                  color: '#f7d24b',
                  backgroundColor: 'rgba(10, 8, 6, 0.95)',
                  outline: 'none',
                  padding: '1px 4px',
                }}
                placeholder="x,y"
              />
            ) : (
              <span
                onDoubleClick={handleCoordDoubleClick}
                className="text-[10px] font-mono font-bold select-none"
                style={{
                  color: onTeleport ? 'rgba(247, 210, 75, 0.75)' : 'rgba(127, 219, 202, 0.5)',
                  cursor: onTeleport ? 'pointer' : 'default',
                  minWidth: 68,
                  textAlign: 'center',
                  display: 'inline-block',
                  padding: '1px 4px',
                  borderRadius: 3,
                  border: onTeleport ? '1px solid rgba(247, 210, 75, 0.2)' : '1px solid transparent',
                }}
                title={onTeleport ? 'Double-click to teleport' : undefined}
              >
                {currentNode.x},{currentNode.y}
              </span>
            )
          )}
          {onHeadingChange && (
            <button
              type="button"
              onClick={handleRightChevron}
              className="px-2 py-0.5 rounded border font-bold leading-none select-none"
              style={{ borderColor: 'rgba(127, 219, 202, 0.65)', color: '#7fdbca', backgroundColor: 'rgba(10, 10, 10, 0.8)' }}
              title="Clockwise to next direction"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
});
