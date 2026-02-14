import { memo, useMemo } from 'react';
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
}

const WIDTH = 190;
const HEIGHT = 132;
const BASE_SCALE = 16;
const DEPTH_SCALE = 8;

export const ExplorationMap = memo(function ExplorationMap({
  nodes,
  edges,
  width = WIDTH,
  heading = 'N',
  alignmentMode = 'north',
  currentNodeId,
  trailNodeIds = [],
  travelLabel,
  traversalCount = 0,
  stepCost,
  onStepCostDecrease,
  onStepCostIncrease,
}: ExplorationMapProps) {
  const headingIndex = DIRECTIONS.indexOf(heading);
  const headingRotationDeg = headingIndex >= 0 ? (headingIndex * 45) : 0;
  const mapRotationDeg = alignmentMode === 'compass' ? -headingRotationDeg : 0;

  const projectPoint = (x: number, y: number, z: number) => {
    const centerX = width * 0.5;
    const centerY = HEIGHT * 0.54;
    const rotationRad = (mapRotationDeg * Math.PI) / 180;
    const cosTheta = Math.cos(rotationRad);
    const sinTheta = Math.sin(rotationRad);
    const isoX = (x - y) * BASE_SCALE;
    const isoY = (x + y) * BASE_SCALE * 0.45;
    const rawX = centerX + isoX;
    const rawY = centerY + isoY - (z * DEPTH_SCALE);
    if (mapRotationDeg === 0) {
      return { px: rawX, py: rawY };
    }
    const dx = rawX - centerX;
    const dy = rawY - centerY;
    const px = centerX + (dx * cosTheta) - (dy * sinTheta);
    const py = centerY + (dx * sinTheta) + (dy * cosTheta);
    return { px, py };
  };

  const projected = useMemo(() => {
    return nodes.map((node) => {
      const { px, py } = projectPoint(node.x, node.y, node.z);
      return { ...node, px, py };
    });
  }, [nodes, mapRotationDeg, width]);

  const projectedById = useMemo(
    () => new Map(projected.map((node) => [node.id, node] as const)),
    [projected]
  );

  const trailSegments = useMemo(() => {
    if (trailNodeIds.length < 2) return [];
    const segments: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];
    for (let index = 1; index < trailNodeIds.length; index += 1) {
      const fromId = trailNodeIds[index - 1];
      const toId = trailNodeIds[index];
      const from = projectedById.get(fromId);
      const to = projectedById.get(toId);
      if (!from || !to) continue;
      segments.push({
        id: `${fromId}->${toId}#${index}`,
        x1: from.px,
        y1: from.py,
        x2: to.px,
        y2: to.py,
      });
    }
    return segments;
  }, [projectedById, trailNodeIds]);
  const trailBreadcrumbs = useMemo(() => {
    if (trailNodeIds.length === 0) return [];
    const visitsByNode: Record<string, number> = {};
    const breadcrumbs: Array<{ id: string; x: number; y: number; alpha: number }> = [];
    trailNodeIds.forEach((nodeId, index) => {
      const node = projectedById.get(nodeId);
      if (!node) return;
      const visit = (visitsByNode[nodeId] ?? 0);
      visitsByNode[nodeId] = visit + 1;
      const angle = (visit * 137.5 * Math.PI) / 180;
      const radius = Math.min(5, 1.3 + visit * 0.55);
      const x = node.px + Math.cos(angle) * radius;
      const y = node.py + Math.sin(angle) * radius;
      const age = trailNodeIds.length - 1 - index;
      const alpha = Math.max(0.22, 0.85 - age * 0.015);
      breadcrumbs.push({ id: `${nodeId}#${index}`, x, y, alpha });
    });
    return breadcrumbs;
  }, [projectedById, trailNodeIds]);

  const trailSplotches = useMemo(() => {
    const splotches = [];
    const splotchContainerSize = 30; // Fixed size for splotch container in pixels
    const numSplotchesPerSegment = 2; // Number of splotches per line segment

    trailSegments.forEach((segment, segmentIndex) => {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 0) {
        for (let i = 0; i < numSplotchesPerSegment; i++) {
          const t = (i + 0.5) / numSplotchesPerSegment; // Midpoint for each splotch
          const x = segment.x1 + dx * t;
          const y = segment.y1 + dy * t;

          const config = generateSplotchConfig({
            scale: 0.8 + Math.random() * 0.4, // splotch fills its own container, with some variation
            offset: [(Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2], // slight random offset
            opacity: 0.5 + Math.random() * 0.2,
            blendMode: 'multiply',
            seed: (segmentIndex * 1000 + i) * 100 // unique seed for each splotch
          });

          splotches.push({
            id: `${segment.id}-splotch-${i}`,
            x: x - splotchContainerSize / 2, // adjust position to center the splotch container
            y: y - splotchContainerSize / 2,
            size: splotchContainerSize,
            config,
            index: (segmentIndex * numSplotchesPerSegment) + i,
          });
        }
      }
    });
    return splotches;
  }, [trailSegments]);

  const facingIndicator = useMemo(() => {
    if (!currentNodeId) return null;
    const headingIndex = DIRECTIONS.indexOf(heading);
    if (headingIndex < 0) return null;
    const node = nodes.find((entry) => entry.id === currentNodeId);
    if (!node) return null;
    const directionDeg = (headingIndex * 45) - 90 + mapRotationDeg;
    const directionRad = (directionDeg * Math.PI) / 180;
    const ux = Math.cos(directionRad);
    const uy = Math.sin(directionRad);
    return {
      tipX: ux * 9.5,
      tipY: uy * 9.5,
      leftX: (-uy * 2.8) - (ux * 1.8),
      leftY: (ux * 2.8) - (uy * 1.8),
      rightX: (uy * 2.8) - (ux * 1.8),
      rightY: (-ux * 2.8) - (uy * 1.8),
    };
  }, [currentNodeId, heading, mapRotationDeg, nodes]);

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
      <div style={{ position: 'relative', width: width, height: HEIGHT }} className="block">
        <svg width={width} height={HEIGHT} className="absolute inset-0">
          <text
            x={width * 0.5}
            y={11}
            textAnchor="middle"
            fontSize={8}
            fontWeight={700}
            fill="rgba(247, 210, 75, 0.85)"
          >
            N
          </text>
          <text
            x={width - 8}
            y={HEIGHT * 0.54 + 3}
            textAnchor="middle"
            fontSize={8}
            fontWeight={700}
            fill="rgba(247, 210, 75, 0.85)"
          >
            E
          </text>
          <text
            x={width * 0.5}
            y={HEIGHT - 5}
            textAnchor="middle"
            fontSize={8}
            fontWeight={700}
            fill="rgba(247, 210, 75, 0.85)"
          >
            S
          </text>
          <text
            x={8}
            y={HEIGHT * 0.54 + 3}
            textAnchor="middle"
            fontSize={8}
            fontWeight={700}
            fill="rgba(247, 210, 75, 0.85)"
          >
            W
          </text>
        {trailSegments.map((segment) => (
          <line
              key={segment.id}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke="rgba(247, 210, 75, 0.78)"
              strokeWidth={1.1}
              strokeDasharray="2.2 2.2"
          />
        ))}
        {trailBreadcrumbs.map((crumb) => (
          <circle
            key={crumb.id}
            cx={crumb.x}
            cy={crumb.y}
            r={1.55}
            fill={`rgba(247, 210, 75, ${crumb.alpha})`}
          />
        ))}
        {edges.map((edge) => {
            const from = projectedById.get(edge.fromId);
            const to = projectedById.get(edge.toId);
            if (!from || !to) return null;
            const alpha = Math.min(0.85, 0.28 + edge.traversals * 0.12);
            return (
              <line
                key={edge.id}
                x1={from.px}
                y1={from.py}
                x2={to.px}
                y2={to.py}
                stroke={`rgba(127, 219, 202, ${alpha})`}
                strokeWidth={Math.min(2.6, 1 + edge.traversals * 0.35)}
              />
            );
          })}
          {projected
            .slice()
            .sort((a, b) => (a.py - b.py))
            .map((node) => {
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
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fontSize={isCurrent ? 9 : 7}
                  fontWeight={700}
                  fill={isCurrent ? '#f7d24b' : '#bdeee5'}
                >
                  {isCurrent ? '' : node.heading}
                </text>
                  {isCurrent && facingIndicator && (
                    <polygon
                      points={`${facingIndicator.tipX},${facingIndicator.tipY} ${facingIndicator.leftX},${facingIndicator.leftY} ${facingIndicator.rightX},${facingIndicator.rightY}`}
                      fill="#f7d24b"
                      stroke="rgba(15, 16, 18, 0.95)"
                      strokeWidth={0.45}
                    />
                  )}
                </g>
              );
            })}
        </svg>

        {/* Watercolor splotches overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {trailSplotches.map((splotch) => (
            <div
              key={splotch.id}
              className="absolute"
              style={{
                left: splotch.x,
                top: splotch.y,
                width: splotch.size,
                height: splotch.size,
                overflow: 'hidden', // Contain splotch within its container
              }}
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

      {typeof stepCost === 'number' && (
        <div className="mt-1 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={onStepCostDecrease}
            className="px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-[1px]"
            style={{
              borderColor: 'rgba(127, 219, 202, 0.65)',
              color: '#7fdbca',
              backgroundColor: 'rgba(10, 10, 10, 0.8)',
            }}
            title="Decrease rows required per travel step"
          >
            -
          </button>
          <div
            className="px-2 py-0.5 rounded border text-[9px] font-bold tracking-[1px]"
            style={{
              borderColor: 'rgba(127, 219, 202, 0.55)',
              color: '#7fdbca',
              backgroundColor: 'rgba(10, 10, 10, 0.75)',
            }}
            title="Rows required to travel one map step"
          >
            STEP COST {stepCost}
          </div>
          <button
            type="button"
            onClick={onStepCostIncrease}
            className="px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-[1px]"
            style={{
              borderColor: 'rgba(127, 219, 202, 0.65)',
              color: '#7fdbca',
              backgroundColor: 'rgba(10, 10, 10, 0.8)',
            }}
            title="Increase rows required per travel step"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
});
