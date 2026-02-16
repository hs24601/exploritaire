import { memo, useMemo, useState, useCallback } from 'react';
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
  traversalCount?: number;
  stepCost?: number;
  onStepCostDecrease?: () => void;
  onStepCostIncrease?: () => void;
  onHeadingChange?: (direction: Direction) => void;
}

const WIDTH = 190;
const HEIGHT = 190;
const CELL_SIZE = 26;

// Cardinal directions in clockwise order for chevron cycling
const CARDINAL = ['N', 'E', 'S', 'W'] as const;
type CardinalDir = typeof CARDINAL[number];


function nearestCardinal(h: Direction): CardinalDir {
  const m: Record<Direction, CardinalDir> = {
    N: 'N', NE: 'E', E: 'E', SE: 'S', S: 'S', SW: 'W', W: 'W', NW: 'N',
  };
  return m[h];
}

export const ExplorationMap = memo(function ExplorationMap({
  nodes,
  edges,
  width = WIDTH,
  heading = 'N',
  currentNodeId,
  trailNodeIds = [],
  travelLabel,
  traversalCount = 0,
  stepCost,
  onStepCostDecrease,
  onStepCostIncrease,
  onHeadingChange,
}: ExplorationMapProps) {
  const [mouseCoord, setMouseCoord] = useState<{ x: number; y: number } | null>(null);

  const cx = width / 2;
  const cy = HEIGHT / 2;

  const currentNode = useMemo(
    () => nodes.find((n) => n.id === currentNodeId) ?? null,
    [nodes, currentNodeId],
  );
  const camX = currentNode?.x ?? 0;
  const camY = currentNode?.y ?? 0;

  const projected = useMemo(() => nodes.map((node) => ({
    ...node,
    px: cx + (node.x - camX) * CELL_SIZE,
    py: cy + (node.y - camY) * CELL_SIZE,
  })), [nodes, cx, camX, camY]);

  const projectedById = useMemo(
    () => new Map(projected.map((n) => [n.id, n] as const)),
    [projected],
  );

  // Grid line ranges — offset by camera position so grid stays aligned to world coords
  const gridXRange = useMemo(() => {
    const min = Math.ceil(camX - cx / CELL_SIZE);
    const max = Math.floor(camX + (width - cx) / CELL_SIZE);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [camX, cx, width]);

  const gridYRange = useMemo(() => {
    const min = Math.ceil(camY - cy / CELL_SIZE);
    const max = Math.floor(camY + (HEIGHT - cy) / CELL_SIZE);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [camY, cy]);

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

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (width / rect.width);
    const py = (e.clientY - rect.top) * (HEIGHT / rect.height);
    setMouseCoord({
      x: Math.round((px - cx) / CELL_SIZE) + camX,
      y: Math.round((py - cy) / CELL_SIZE) + camY,
    });
  }, [cx, cy, camX, camY, width]);

  const handleLeftChevron = useCallback(() => {
    if (!onHeadingChange) return;
    const card = nearestCardinal(heading);
    const idx = CARDINAL.indexOf(card);
    onHeadingChange(CARDINAL[(idx - 1 + 4) % 4]);
  }, [heading, onHeadingChange]);

  const handleRightChevron = useCallback(() => {
    if (!onHeadingChange) return;
    const card = nearestCardinal(heading);
    const idx = CARDINAL.indexOf(card);
    onHeadingChange(CARDINAL[(idx + 1) % 4]);
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
          width={width}
          height={HEIGHT}
          className="absolute inset-0"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setMouseCoord(null)}
        >
          {/* Vertical grid lines */}
          {gridXRange.map((x) => {
            const sx = cx + (x - camX) * CELL_SIZE;
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
            const sy = cy + (y - camY) * CELL_SIZE;
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
            const sx = cx + (x - camX) * CELL_SIZE;
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
            const sy = cy + (y - camY) * CELL_SIZE;
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
      </div>

      {/* Direction chevrons */}
      {onHeadingChange && (
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <button
            type="button"
            onClick={handleLeftChevron}
            className="px-2 py-0.5 rounded border font-bold leading-none select-none"
            style={{
              fontSize: 15,
              borderColor: 'rgba(127, 219, 202, 0.65)',
              color: '#7fdbca',
              backgroundColor: 'rgba(10, 10, 10, 0.8)',
            }}
            title="Counterclockwise to previous cardinal direction"
          >
            ‹
          </button>
          <div
            className="px-2 py-0.5 rounded border font-bold tracking-[2px] text-center"
            style={{
              fontSize: 10,
              minWidth: 26,
              borderColor: 'rgba(247, 210, 75, 0.7)',
              color: '#f7d24b',
              backgroundColor: 'rgba(10, 10, 10, 0.75)',
              textShadow: '0 0 6px rgba(247, 210, 75, 0.45)',
            }}
          >
            {nearestCardinal(heading)}
          </div>
          <button
            type="button"
            onClick={handleRightChevron}
            className="px-2 py-0.5 rounded border font-bold leading-none select-none"
            style={{
              fontSize: 15,
              borderColor: 'rgba(127, 219, 202, 0.65)',
              color: '#7fdbca',
              backgroundColor: 'rgba(10, 10, 10, 0.8)',
            }}
            title="Clockwise to next cardinal direction"
          >
            ›
          </button>
        </div>
      )}

      {/* Step cost controls */}
      {typeof stepCost === 'number' && (
        <div className="mt-1 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={onStepCostDecrease}
            className="px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-[1px]"
            style={{ borderColor: 'rgba(127, 219, 202, 0.65)', color: '#7fdbca', backgroundColor: 'rgba(10, 10, 10, 0.8)' }}
            title="Decrease rows required per travel step"
          >
            -
          </button>
          <div
            className="px-2 py-0.5 rounded border text-[9px] font-bold tracking-[1px]"
            style={{ borderColor: 'rgba(127, 219, 202, 0.55)', color: '#7fdbca', backgroundColor: 'rgba(10, 10, 10, 0.75)' }}
            title="Rows required to travel one map step"
          >
            STEP COST {stepCost}
          </div>
          <button
            type="button"
            onClick={onStepCostIncrease}
            className="px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-[1px]"
            style={{ borderColor: 'rgba(127, 219, 202, 0.65)', color: '#7fdbca', backgroundColor: 'rgba(10, 10, 10, 0.8)' }}
            title="Increase rows required per travel step"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
});
