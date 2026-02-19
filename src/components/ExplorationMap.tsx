import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Direction } from './Compass';
import { DIRECTIONS } from './Compass';
import { WatercolorSplotch } from '../watercolor/WatercolorSplotch';
import { generateSplotchConfig } from '../watercolor/splotchUtils';
import { ShadowCanvas } from './LightRenderer';
import type { BlockingRect } from '../engine/lighting';
import { POISparkleMarker, computePOISparkleEffect, type PoiStarDef } from './POISparkleMarker';

export type ExplorationMapNode = {
  id: string;
  heading: Direction;
  x: number;
  y: number;
  z: number;
  visits: number;
  cleared?: boolean;
};

export type ExplorationMapEdge = {
  id: string;
  fromId: string;
  toId: string;
  traversals: number;
};

export type ExplorationBlockedCell = {
  x: number;
  y: number;
  terrain?: 'mountain' | 'canyon' | 'ridge' | 'cliff' | 'other';
  lightBlocker?: {
    castHeight?: number;
    softness?: number;
  };
};

interface ExplorationMapProps {
  nodes: ExplorationMapNode[];
  edges: ExplorationMapEdge[];
  width?: number;
  height?: number;
  heading?: Direction;
  alignmentMode?: 'player' | 'map';
  currentNodeId: string | null;
  trailNodeIds?: string[];
  travelLabel?: string;
  actionPoints?: number;
  supplyCount?: number;
  onUseSupply?: () => void;
  traversalCount?: number;
  stepCost?: number;
  onStepCostDecrease?: () => void;
  onStepCostIncrease?: () => void;
  onStepForward?: () => void;
  canStepForward?: boolean;
  onStepBackward?: () => void;
  canStepBackward?: boolean;
  onHeadingChange?: (direction: Direction) => void;
  onTeleport?: (x: number, y: number) => void;
  poiMarkers?: Array<{ id: string; x: number; y: number; label?: string }>;
  blockedCells?: ExplorationBlockedCell[];
  blockedEdges?: Array<{ fromX: number; fromY: number; toX: number; toY: number }>;
  conditionalEdges?: Array<{ fromX: number; fromY: number; toX: number; toY: number; locked: boolean }>;
  activeBlockedEdge?: { fromX: number; fromY: number; toX: number; toY: number; reason?: string } | null;
  tableauWall?: { fromX: number; fromY: number; toX: number; toY: number; tableaus: number; pathBlock?: boolean } | null;
  forcedPath?: Array<{ x: number; y: number }>;
  nextForcedPathIndex?: number | null;
  showLighting?: boolean;
}

const WIDTH = 190;
const HEIGHT = 190;
const CELL_SIZE = 26;
const ZOOM_RECALIBRATION = 5;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 1;
const ZOOM_FACTOR = 1.15;
const FULL_TURN_DEG = 360;
const STEP_DEG = FULL_TURN_DEG / DIRECTIONS.length;
const SHORT_HEIGHT_THRESHOLD = 230;

// POI sparkle star definitions (screen-space offsets from POI center)
const POI_STAR_DEFS: PoiStarDef[] = [
  { dx: 0,    dy: -16, size: 6,  delay: 0.0, dur: 3.1 },      // top (neutral)
  { dx: -14,  dy: -8,  size: 5,  delay: 0.8, dur: 2.8 },      // top-left
  { dx: 14,   dy: -8,  size: 6,  delay: 1.4, dur: 3.2 },      // top-right
  { dx: 0,    dy:  16, size: 5,  delay: 0.6, dur: 2.9 },      // bottom (neutral)
  { dx: -14,  dy:  8,  size: 6,  delay: 1.8, dur: 3.4 },      // bottom-left
  { dx: 14,   dy:  8,  size: 5,  delay: 1.0, dur: 2.6 },      // bottom-right
];

// POI targets with sparkle effect (grid coordinates)
const SPARKLE_POI_TARGETS = [
  { x: 0, y: 1, name: 'poi_initial_01' }, // Tutorial B
];

type GridCell = { x: number; y: number };
type GridPoint = { x: number; y: number };

function hashString(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createPrng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function pointKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function extractBlockedRegions(blockedCells: ExplorationBlockedCell[]): Array<{ id: string; cells: GridCell[] }> {
  const gridCells = blockedCells.map((cell) => ({ x: cell.x, y: cell.y }));
  const remaining = new Set(gridCells.map((cell) => `${cell.x},${cell.y}`));
  const regions: Array<{ id: string; cells: GridCell[] }> = [];

  while (remaining.size > 0) {
    const first = remaining.values().next().value as string;
    remaining.delete(first);
    const [sx, sy] = first.split(',').map(Number);
    const queue: GridCell[] = [{ x: sx, y: sy }];
    const cells: GridCell[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      cells.push(current);
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];
      neighbors.forEach((neighbor) => {
        const key = `${neighbor.x},${neighbor.y}`;
        if (!remaining.has(key)) return;
        remaining.delete(key);
        queue.push(neighbor);
      });
    }

    cells.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    regions.push({
      id: cells.map((cell) => `${cell.x},${cell.y}`).join('|'),
      cells,
    });
  }

  return regions;
}

function buildRegionBoundaryLoops(cells: GridCell[]): GridPoint[][] {
  const cellSet = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  const segments: Array<{ from: GridPoint; to: GridPoint }> = [];

  cells.forEach((cell) => {
    const left = cell.x - 0.5;
    const right = cell.x + 0.5;
    const top = cell.y - 0.5;
    const bottom = cell.y + 0.5;
    if (!cellSet.has(`${cell.x},${cell.y - 1}`)) segments.push({ from: { x: left, y: top }, to: { x: right, y: top } });
    if (!cellSet.has(`${cell.x + 1},${cell.y}`)) segments.push({ from: { x: right, y: top }, to: { x: right, y: bottom } });
    if (!cellSet.has(`${cell.x},${cell.y + 1}`)) segments.push({ from: { x: right, y: bottom }, to: { x: left, y: bottom } });
    if (!cellSet.has(`${cell.x - 1},${cell.y}`)) segments.push({ from: { x: left, y: bottom }, to: { x: left, y: top } });
  });

  const startMap = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    const key = pointKey(segment.from);
    const entry = startMap.get(key);
    if (entry) entry.push(index);
    else startMap.set(key, [index]);
  });

  const used = new Set<number>();
  const loops: GridPoint[][] = [];

  segments.forEach((segment, index) => {
    if (used.has(index)) return;
    used.add(index);
    const loop: GridPoint[] = [{ ...segment.from }, { ...segment.to }];
    const startKey = pointKey(segment.from);
    let cursor = segment.to;

    while (pointKey(cursor) !== startKey) {
      const nextCandidates = startMap.get(pointKey(cursor)) ?? [];
      const nextIndex = nextCandidates.find((candidate) => !used.has(candidate));
      if (typeof nextIndex !== 'number') break;
      used.add(nextIndex);
      const nextSegment = segments[nextIndex];
      loop.push({ ...nextSegment.to });
      cursor = nextSegment.to;
    }

    if (loop.length >= 4) loops.push(loop);
  });

  return loops;
}

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ${rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')} Z`;
}

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
  height = HEIGHT,
  heading = 'N',
  alignmentMode = 'player',
  currentNodeId,
  trailNodeIds = [],
  travelLabel,
  actionPoints,
  supplyCount,
  onUseSupply,
  traversalCount = 0,
  stepCost,
  onStepCostDecrease,
  onStepCostIncrease,
  onStepForward,
  canStepForward = true,
  onStepBackward,
  canStepBackward = false,
  onHeadingChange,
  onTeleport,
  poiMarkers = [],
  blockedCells = [],
  blockedEdges = [],
  conditionalEdges = [],
  activeBlockedEdge = null,
  tableauWall = null,
  forcedPath = [],
  nextForcedPathIndex = null,
  showLighting = true,
}: ExplorationMapProps) {
  const [mouseCoord, setMouseCoord] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [isTeleportActive, setIsTeleportActive] = useState(false);
  const [teleportValue, setTeleportValue] = useState('');
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const shadowContainerRef = useRef<HTMLDivElement>(null);
  const zoomSliderRef = useRef<HTMLInputElement>(null);

  void stepCost;
  void onStepCostDecrease;
  void onStepCostIncrease;

  const cx = width / 2;
  const cy = height / 2;

  const { zoom, panX, panY } = view;
  const cellSizeZ = CELL_SIZE * zoom * ZOOM_RECALIBRATION;

  const currentNode = useMemo(
    () => nodes.find((n) => n.id === currentNodeId) ?? null,
    [nodes, currentNodeId],
  );
  const camX = currentNode?.x ?? 0;
  const camY = currentNode?.y ?? 0;

  const mapRotationDeg = useMemo(() => {
    if (alignmentMode === 'map') return 0;
    const headingIndex = DIRECTIONS.indexOf(heading);
    if (headingIndex < 0) return 0;
    return -(headingIndex * STEP_DEG);
  }, [alignmentMode, heading]);
  const mapRotationRad = (mapRotationDeg * Math.PI) / 180;
  const mapRotationCos = Math.cos(mapRotationRad);
  const mapRotationSin = Math.sin(mapRotationRad);

  const projectWorldToScreen = useCallback((x: number, y: number) => {
    const dx = (x - camX) * cellSizeZ;
    const dy = (y - camY) * cellSizeZ;
    const rx = (dx * mapRotationCos) - (dy * mapRotationSin);
    const ry = (dx * mapRotationSin) + (dy * mapRotationCos);
    return {
      px: cx + panX + rx,
      py: cy + panY + ry,
    };
  }, [camX, camY, cellSizeZ, cx, cy, mapRotationCos, mapRotationSin, panX, panY]);

  const projectScreenToWorld = useCallback((px: number, py: number) => {
    const dx = px - cx - panX;
    const dy = py - cy - panY;
    const ux = (dx * mapRotationCos) + (dy * mapRotationSin);
    const uy = (-dx * mapRotationSin) + (dy * mapRotationCos);
    return {
      x: (ux / cellSizeZ) + camX,
      y: (uy / cellSizeZ) + camY,
    };
  }, [camX, camY, cellSizeZ, cx, cy, mapRotationCos, mapRotationSin, panX, panY]);

  const projected = useMemo(() => nodes.map((node) => ({
    ...node,
    ...projectWorldToScreen(node.x, node.y),
  })), [nodes, projectWorldToScreen]);

  const projectedPoiMarkers = useMemo(() => poiMarkers.map((poi) => ({
    ...poi,
    ...projectWorldToScreen(poi.x, poi.y),
  })), [poiMarkers, projectWorldToScreen]);

  const projectedBlockedEdges = useMemo(() => blockedEdges.map((edge) => ({
    ...edge,
    x1: projectWorldToScreen(edge.fromX, edge.fromY).px,
    y1: projectWorldToScreen(edge.fromX, edge.fromY).py,
    x2: projectWorldToScreen(edge.toX, edge.toY).px,
    y2: projectWorldToScreen(edge.toX, edge.toY).py,
  })), [blockedEdges, projectWorldToScreen]);
  const projectedConditionalEdges = useMemo(() => conditionalEdges.map((edge) => ({
    ...edge,
    x1: projectWorldToScreen(edge.fromX, edge.fromY).px,
    y1: projectWorldToScreen(edge.fromX, edge.fromY).py,
    x2: projectWorldToScreen(edge.toX, edge.toY).px,
    y2: projectWorldToScreen(edge.toX, edge.toY).py,
  })), [conditionalEdges, projectWorldToScreen]);
  const projectedActiveBlockedEdge = useMemo(() => {
    const edge = tableauWall ?? activeBlockedEdge;
    if (!edge) return null;
    const moveDx = edge.toX - edge.fromX;
    const moveDy = edge.toY - edge.fromY;
    const anchorX = edge.fromX + (moveDx * 0.35);
    const anchorY = edge.fromY + (moveDy * 0.35);
    // Build a "wall" perpendicular to travel so it spans between neighboring obstacle lanes.
    const wallFromWorld = Math.abs(moveDy) >= Math.abs(moveDx)
      ? { x: anchorX - 1, y: anchorY }
      : { x: anchorX, y: anchorY - 1 };
    const wallToWorld = Math.abs(moveDy) >= Math.abs(moveDx)
      ? { x: anchorX + 1, y: anchorY }
      : { x: anchorX, y: anchorY + 1 };
    // Terrain wall should stay pinned to world/map space, so it rotates with the map view.
    const from = projectWorldToScreen(wallFromWorld.x, wallFromWorld.y);
    const to = projectWorldToScreen(wallToWorld.x, wallToWorld.y);
    return {
      ...edge,
      x1: from.px,
      y1: from.py,
      x2: to.px,
      y2: to.py,
      mx: (from.px + to.px) / 2,
      my: (from.py + to.py) / 2,
    };
  }, [activeBlockedEdge, tableauWall, projectWorldToScreen]);

  const tableauWallCards = useMemo<TableauWallCard[]>(() => {
    if (!projectedActiveBlockedEdge) return [];
    const count = Math.max(1, Math.round(tableauWall?.tableaus ?? 0) || 1);
    const dx = projectedActiveBlockedEdge.x2 - projectedActiveBlockedEdge.x1;
    const dy = projectedActiveBlockedEdge.y2 - projectedActiveBlockedEdge.y1;
    const segmentLength = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / segmentLength;
    const uy = dy / segmentLength;
    const edgeInset = Math.min(cellSizeZ * 0.35, segmentLength * 0.18);
    const usableLength = Math.max(1, segmentLength - (edgeInset * 2));
    const step = usableLength / count;
    const cardHeight = step * 1.02;
    const cardWidth = Math.min(cellSizeZ * 0.34, Math.max(2.2, cardHeight * 0.62));
    return Array.from({ length: count }).map((_, index) => {
      const distance = edgeInset + (step * (index + 0.5));
      const x = projectedActiveBlockedEdge.x1 + (ux * distance);
      const y = projectedActiveBlockedEdge.y1 + (uy * distance);
      return { x, y, width: cardWidth, height: cardHeight };
    });
  }, [projectedActiveBlockedEdge, tableauWall?.tableaus, cellSizeZ]);

  const tableauWallLine = useMemo(() => {
    if (!projectedActiveBlockedEdge || tableauWallCards.length === 0) return projectedActiveBlockedEdge;
    const dx = projectedActiveBlockedEdge.x2 - projectedActiveBlockedEdge.x1;
    const dy = projectedActiveBlockedEdge.y2 - projectedActiveBlockedEdge.y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const centers = tableauWallCards.map((card) => ({
      t: (card.x - projectedActiveBlockedEdge.x1) * ux + (card.y - projectedActiveBlockedEdge.y1) * uy,
      x: card.x,
      y: card.y,
    }));
    const min = centers.reduce((acc, cur) => (cur.t < acc.t ? cur : acc), centers[0]);
    const max = centers.reduce((acc, cur) => (cur.t > acc.t ? cur : acc), centers[0]);
    return {
      ...projectedActiveBlockedEdge,
      x1: min.x,
      y1: min.y,
      x2: max.x,
      y2: max.y,
    };
  }, [projectedActiveBlockedEdge, tableauWallCards]);

  const projectedForcedPath = useMemo(() => forcedPath.map((step) => ({
    ...step,
    ...projectWorldToScreen(step.x, step.y),
  })), [forcedPath, projectWorldToScreen]);

  const projectedBlockedRegions = useMemo(() => {
    const regions = extractBlockedRegions(blockedCells);
    return regions.map((region) => {
      const loops = buildRegionBoundaryLoops(region.cells);
      const seed = hashString(region.id);
      const jitteredLoops = loops.map((loop) => loop.map((point) => {
        const projectedPoint = projectWorldToScreen(point.x, point.y);
        return {
          x: projectedPoint.px,
          y: projectedPoint.py,
        };
      }));
      const allPoints = jitteredLoops.flat();
      if (allPoints.length === 0) {
        return {
          id: region.id,
          clipId: `blocked-region-clip-${seed.toString(36)}`,
          loops: [] as Array<Array<{ x: number; y: number }>>,
          peaks: [] as Array<{
            id: string;
            leftX: number;
            rightX: number;
            baseY: number;
            peakX: number;
            peakY: number;
            snowPeakY: number;
          }>,
        };
      }
      const peaks = region.cells.map((cell, index) => {
        const rand = createPrng(seed + index * 97 + cell.x * 13 + cell.y * 17);
        const center = projectWorldToScreen(cell.x, cell.y);
        const centerX = center.px;
        const centerY = center.py;
        const widthScale = cellSizeZ * (0.62 + rand() * 0.16);
        const baseY = centerY + cellSizeZ * (0.28 + rand() * 0.08);
        const heightScale = cellSizeZ * (0.42 + rand() * 0.22);
        const peakX = centerX + (rand() - 0.5) * widthScale * 0.16;
        const peakY = baseY - heightScale;
        return {
          id: `${region.id}-peak-${index}-${seed.toString(36)}`,
          leftX: centerX - widthScale * 0.5,
          rightX: centerX + widthScale * 0.5,
          baseY,
          peakX,
          peakY,
          snowPeakY: baseY - heightScale * 0.62,
        };
      });
      return {
        id: region.id,
        clipId: `blocked-region-clip-${seed.toString(36)}`,
        loops: jitteredLoops,
        peaks,
      };
    });
  }, [blockedCells, cellSizeZ, projectWorldToScreen]);

  const blockedRegionRects = useMemo(() => {
    const rects: BlockingRect[] = [];
    projectedBlockedRegions.forEach((region) => {
      region.loops.forEach((loop) => {
        if (loop.length === 0) return;
        const xs = loop.map((point) => point.x);
        const ys = loop.map((point) => point.y);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);
        const widthRect = right - left || 1;
        const heightRect = bottom - top || 1;
        rects.push({
          x: left,
          y: top,
          width: widthRect,
          height: heightRect,
        });
      });
    });
    return rects;
  }, [projectedBlockedRegions]);

  const projectedCellBlockers = useMemo(() => {
    const buildRect = (cell: ExplorationBlockedCell): BlockingRect => {
      const corners = [
        projectWorldToScreen(cell.x - 0.5, cell.y - 0.5),
        projectWorldToScreen(cell.x + 0.5, cell.y - 0.5),
        projectWorldToScreen(cell.x + 0.5, cell.y + 0.5),
        projectWorldToScreen(cell.x - 0.5, cell.y + 0.5),
      ];
      const xs = corners.map((point) => point.px);
      const ys = corners.map((point) => point.py);
      const left = Math.min(...xs);
      const right = Math.max(...xs);
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      return {
        x: left,
        y: top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
        castHeight: cell.lightBlocker?.castHeight ?? 6,
        softness: cell.lightBlocker?.softness ?? 5,
      };
    };
    return blockedCells.map(buildRect);
  }, [blockedCells, projectWorldToScreen]);

  const edgeBlockers = useMemo(() => {
    const rects: BlockingRect[] = [];
    const accumulateEdge = (edge: { fromX: number; fromY: number; toX: number; toY: number }) => {
      const from = projectWorldToScreen(edge.fromX, edge.fromY);
      const to = projectWorldToScreen(edge.toX, edge.toY);
      const left = Math.min(from.px, to.px);
      const right = Math.max(from.px, to.px);
      const top = Math.min(from.py, to.py);
      const bottom = Math.max(from.py, to.py);
      const thickness = Math.max(4, cellSizeZ * 0.1);
      rects.push({
        x: left - thickness * 0.5,
        y: top - thickness * 0.5,
        width: (right - left) || thickness,
        height: (bottom - top) || thickness,
      });
    };
    blockedEdges.forEach(accumulateEdge);
    conditionalEdges.forEach(accumulateEdge);
    return rects;
  }, [blockedEdges, conditionalEdges, projectWorldToScreen, cellSizeZ]);

  const tableauWallBlockers = useMemo<BlockingRect[]>(() => {
    if (tableauWallCards.length === 0) return [];
    const minX = Math.min(...tableauWallCards.map((card) => card.x - card.width / 2));
    const maxX = Math.max(...tableauWallCards.map((card) => card.x + card.width / 2));
    const minY = Math.min(...tableauWallCards.map((card) => card.y - card.height / 2));
    const maxY = Math.max(...tableauWallCards.map((card) => card.y + card.height / 2));
    const padX = Math.max(2, cellSizeZ * 0.08);
    const padY = Math.max(2, cellSizeZ * 0.12);
    return [{
      x: minX - padX,
      y: minY - padY,
      width: (maxX - minX) + (padX * 2),
      height: (maxY - minY) + (padY * 2),
      castHeight: Math.max(8, Math.round(cellSizeZ * 0.45)),
      softness: Math.max(4, Math.round(cellSizeZ * 0.2)),
    }];
  }, [tableauWallCards, cellSizeZ]);

  const projectedById = useMemo(
    () => new Map(projected.map((n) => [n.id, n] as const)),
    [projected],
  );
  const currentProjected = useMemo(
    () => (currentNodeId ? projectedById.get(currentNodeId) ?? null : null),
    [currentNodeId, projectedById],
  );

  const playerScreenPos = useMemo(() => {
    if (currentProjected) return currentProjected;
    return projectWorldToScreen(camX, camY);
  }, [currentProjected, projectWorldToScreen, camX, camY]);

  const playerActorLights = useMemo(() => ([
    {
      x: playerScreenPos.px,
      y: playerScreenPos.py,
      radius: Math.max(cellSizeZ * 0.375, 6),
      intensity: 0.375,
      color: '#f7d24b',
      castShadows: false,
      flicker: { enabled: true, speed: 0.28, amount: 0.15 },
    },
  ]), [playerScreenPos, cellSizeZ]);

  // POI sparkle effects disabled to prevent render cascade
  // TODO: Re-enable with a separate isolated component that doesn't depend on ExplorationMap internals
  const sparkleEffects: Record<string, any> = {};
  const poiActorLights: any[] = [];
  const poiShadowBlockers: BlockingRect[] = [];

  const shadowBlockers = useMemo(
    () => [...blockedRegionRects, ...edgeBlockers, ...projectedCellBlockers, ...tableauWallBlockers, ...poiShadowBlockers],
    [blockedRegionRects, edgeBlockers, projectedCellBlockers, tableauWallBlockers, poiShadowBlockers],
  );

  // Grid line ranges — account for zoom and pan
  const gridXRange = useMemo(() => {
    const min = Math.floor(camX + (-cx - panX) / cellSizeZ) - 1;
    const max = Math.ceil(camX + (width - cx - panX) / cellSizeZ) + 1;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [camX, cx, width, cellSizeZ, panX]);

  const gridYRange = useMemo(() => {
    const min = Math.floor(camY + (-cy - panY) / cellSizeZ) - 1;
    const max = Math.ceil(camY + (height - cy - panY) / cellSizeZ) + 1;
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

  // Facing arrow follows heading when map is north-up; points up when map is player-aligned.
  const facingIndicator = useMemo(() => {
    if (!currentNodeId) return null;
    const facingHeading: Direction = alignmentMode === 'player' ? 'N' : heading;
    const headingIndex = DIRECTIONS.indexOf(facingHeading);
    if (headingIndex < 0) return null;
    const directionRad = ((headingIndex * 45 - 90) * Math.PI) / 180;
    const ux = Math.cos(directionRad);
    const uy = Math.sin(directionRad);
    return {
      tipX: ux * 10.5, tipY: uy * 10.5,
      leftX: -uy * 2.8 - ux * 1.8, leftY: ux * 2.8 - uy * 1.8,
      rightX: uy * 2.8 - ux * 1.8, rightY: -ux * 2.8 - uy * 1.8,
    };
  }, [alignmentMode, currentNodeId, heading]);

  // Non-passive wheel event for zoom centered on cursor
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((prev) => {
        const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor));
        return {
          zoom: newZoom,
          panX: 0,
          panY: 0,
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
    const scaleY = height / rect.height;
    if (isDraggingRef.current) {
      const dx = (e.clientX - lastPointerRef.current.x) * scaleX;
      const dy = (e.clientY - lastPointerRef.current.y) * scaleY;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      setView((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
    } else {
      const svgX = (e.clientX - rect.left) * scaleX;
      const svgY = (e.clientY - rect.top) * scaleY;
      const world = projectScreenToWorld(svgX, svgY);
      setMouseCoord({
        x: Math.round(world.x),
        y: Math.round(world.y),
        px: svgX,
        py: svgY,
      });
    }
  }, [projectScreenToWorld, width]);

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
  const handleCenterOnPlayer = useCallback(() => {
    setView((prev) => ({ ...prev, panX: 0, panY: 0 }));
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

  const handleZoomSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const nextZoom = Number.parseFloat(e.target.value);
    if (Number.isNaN(nextZoom)) return;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    setView((prev) => ({ ...prev, zoom: clamped, panX: 0, panY: 0 }));
  }, []);

  const handleLeftChevron = useCallback(() => {
    if (!onHeadingChange) return;
    onHeadingChange(getNextHeadingFromDirection(heading, false));
  }, [heading, onHeadingChange]);

  const handleRightChevron = useCallback(() => {
    if (!onHeadingChange) return;
    onHeadingChange(getNextHeadingFromDirection(heading, true));
  }, [heading, onHeadingChange]);

  const isCompact = height < SHORT_HEIGHT_THRESHOLD;

  return (
    <div
      className="relative rounded border overflow-hidden"
      style={{
        width: width + 14,
        borderColor: 'rgba(127, 219, 202, 0.65)',
        backgroundColor: 'rgba(10, 10, 10, 0.76)',
        boxShadow: '0 0 12px rgba(127, 219, 202, 0.28)',
        padding: 0,
      }}
      data-dev-component="ExplorationMap"
      data-dev-name="Exploration Map"
      data-dev-kind="panel"
      data-dev-description="Node grid and travel controls for exploration mode."
      data-dev-path="components/ExplorationMap"
    >
      <div
        className="absolute left-2 top-2 px-1.5 py-0.5 rounded border text-[11px] font-bold tracking-[1px]"
        style={{
          borderColor: 'rgba(127, 219, 202, 0.6)',
          color: '#7fdbca',
          backgroundColor: 'rgba(8, 12, 14, 0.88)',
        }}
        title="Successful travel steps"
      >
        👣 {traversalCount}
      </div>
      <div
        className="absolute left-1/2 top-2 z-30 px-3 py-0.5 rounded-full border pointer-events-none"
        style={{
          transform: 'translateX(-50%)',
          borderColor: 'rgba(127, 219, 202, 0.45)',
          backgroundColor: 'rgba(10, 10, 10, 0.85)',
          color: 'rgba(127, 219, 202, 0.9)',
          boxShadow: '0 0 12px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] whitespace-nowrap">
          {travelLabel ?? 'Exploring...'}
        </div>
      </div>
      <div style={{ position: 'relative', width, height, overflow: 'hidden' }} className="block">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerLeave}
          onPointerLeave={handlePointerLeave}
          onDoubleClick={handleDoubleClick}
        >
          {/* Vertical grid lines */}
          {gridXRange.map((x) => {
            const top = projectWorldToScreen(x, gridYRange[0] - 1);
            const bottom = projectWorldToScreen(x, gridYRange[gridYRange.length - 1] + 1);
            return (
              <line
                key={`gx-${x}`}
                x1={top.px} y1={top.py}
                x2={bottom.px} y2={bottom.py}
                stroke={x === 0 ? 'rgba(127, 219, 202, 0.45)' : 'rgba(127, 219, 202, 0.13)'}
                strokeWidth={x === 0 ? 1 : 0.5}
              />
            );
          })}
          {/* Horizontal grid lines */}
          {gridYRange.map((y) => {
            const left = projectWorldToScreen(gridXRange[0] - 1, y);
            const right = projectWorldToScreen(gridXRange[gridXRange.length - 1] + 1, y);
            return (
              <line
                key={`gy-${y}`}
                x1={left.px} y1={left.py}
                x2={right.px} y2={right.py}
                stroke={y === 0 ? 'rgba(127, 219, 202, 0.45)' : 'rgba(127, 219, 202, 0.13)'}
                strokeWidth={y === 0 ? 1 : 0.5}
              />
            );
          })}
          {/* X-axis coordinate labels along bottom */}
          {gridXRange.map((x) => {
            const label = projectWorldToScreen(x, camY + ((height / 2 - 4 - panY) / Math.max(cellSizeZ, 1)));
            return (
              <text
                key={`xl-${x}`}
                x={label.px}
                y={label.py}
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
            const label = projectWorldToScreen(camX + ((3 - cx - panX) / Math.max(cellSizeZ, 1)), y);
            return (
              <text
                key={`yl-${y}`}
                x={label.px}
                y={label.py + 2}
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
          {/* Forced tutorial path */}
          {projectedForcedPath.length > 1 && projectedForcedPath.slice(1).map((step, idx) => {
            const prev = projectedForcedPath[idx];
            if (!prev) return null;
            return (
              <line
                key={`rail-${idx}`}
                x1={prev.px}
                y1={prev.py}
                x2={step.px}
                y2={step.py}
                stroke="rgba(247, 210, 75, 0.92)"
                strokeWidth={1.8}
                strokeDasharray="3 2"
              />
            );
          })}
          {/* Blocked regions as seamless mountain masses */}
          {projectedBlockedRegions.map((region) => (
            <g key={`blocked-region-${region.id}`}>
              <defs>
                <clipPath id={region.clipId}>
                  {region.loops.map((loop, loopIndex) => (
                    <path
                      key={`blocked-region-clip-${region.id}-${loopIndex}`}
                      d={pointsToPath(loop)}
                    />
                  ))}
                </clipPath>
              </defs>
              {region.loops.map((loop, loopIndex) => (
                <path
                  key={`blocked-region-fill-${region.id}-${loopIndex}`}
                  d={pointsToPath(loop)}
                  fill="rgba(66, 58, 49, 0.92)"
                  stroke="rgba(28, 24, 21, 0.75)"
                  strokeWidth={1.05}
                  strokeLinejoin="round"
                />
              ))}
              {region.loops.map((loop, loopIndex) => (
                <path
                  key={`blocked-region-highlight-${region.id}-${loopIndex}`}
                  d={pointsToPath(loop)}
                  fill="none"
                  stroke="rgba(134, 118, 98, 0.56)"
                  strokeWidth={0.8}
                  strokeDasharray="2.6 1.3"
                  strokeLinejoin="round"
                />
              ))}
              <g clipPath={`url(#${region.clipId})`}>
                {region.peaks.map((peak) => (
                  <g key={peak.id}>
                    <polygon
                      points={`${peak.leftX},${peak.baseY} ${peak.peakX},${peak.peakY} ${peak.rightX},${peak.baseY}`}
                      fill="rgba(100, 87, 72, 0.94)"
                      stroke="rgba(35, 30, 25, 0.65)"
                      strokeWidth={0.8}
                    />
                    <polygon
                      points={`${peak.peakX - (peak.rightX - peak.leftX) * 0.13},${peak.snowPeakY} ${peak.peakX},${peak.peakY} ${peak.peakX + (peak.rightX - peak.leftX) * 0.1},${peak.snowPeakY + (peak.baseY - peak.peakY) * 0.07}`}
                      fill="rgba(236, 232, 223, 0.82)"
                    />
                  </g>
                ))}
              </g>
            </g>
          ))}
          {/* Blocked edges */}
          {projectedBlockedEdges.map((edge, index) => (
            <line
              key={`blocked-edge-${edge.fromX}-${edge.fromY}-${edge.toX}-${edge.toY}-${index}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="rgba(110, 96, 82, 0.88)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray="1.2 1.2"
            />
          ))}
          {/* Conditionally passable edges (terrain gates) */}
          {projectedConditionalEdges.map((edge, index) => (
            <line
              key={`conditional-edge-${edge.fromX}-${edge.fromY}-${edge.toX}-${edge.toY}-${index}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke={edge.locked ? 'rgba(255, 183, 77, 0.92)' : 'rgba(132, 216, 150, 0.85)'}
              strokeWidth={2.2}
              strokeDasharray={edge.locked ? '2.2 1.1' : '0'}
              strokeLinecap="round"
            />
          ))}
          {tableauWallLine && (
            <g>
              <line
                x1={tableauWallLine.x1}
                y1={tableauWallLine.y1}
                x2={tableauWallLine.x2}
                y2={tableauWallLine.y2}
                stroke={tableauWall?.pathBlock === false ? 'rgba(120, 230, 210, 0.85)' : 'rgba(255, 86, 86, 0.96)'}
                strokeWidth={4.2}
                strokeLinecap="round"
              />
              {tableauWallCards.map((card, index) => {
                const fill = tableauWall?.pathBlock === false ? 'rgba(10, 26, 26, 0.98)' : 'rgba(33, 10, 10, 0.98)';
                const stroke = tableauWall?.pathBlock === false ? 'rgba(120, 230, 210, 0.95)' : 'rgba(255, 120, 120, 0.98)';
                return (
                  <g
                    key={`blocked-card-${index}`}
                    transform={`translate(${card.x}, ${card.y})`}
                  >
                    <rect
                      x={-card.width / 2}
                      y={-card.height / 2}
                      width={card.width}
                      height={card.height}
                      rx={Math.max(0.8, card.width * 0.18)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={Math.max(0.6, card.width * 0.12)}
                    />
                    <line
                      x1={-card.width * 0.3}
                      y1={-card.height * 0.3}
                      x2={card.width * 0.3}
                      y2={card.height * 0.3}
                      stroke={stroke}
                      strokeWidth={Math.max(0.35, card.width * 0.08)}
                    />
                    <line
                      x1={card.width * 0.3}
                      y1={-card.height * 0.3}
                      x2={-card.width * 0.3}
                      y2={card.height * 0.3}
                      stroke={stroke}
                      strokeWidth={Math.max(0.35, card.width * 0.08)}
                    />
                  </g>
                );
              })}
            </g>
          )}
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
          {/* Nodes — current player marker + unresolved location markers only */}
          {projected.slice().sort((a, b) => a.py - b.py).map((node) => {
            const isCurrent = node.id === currentNodeId;
            const isUnresolved = !node.cleared && !isCurrent;

            if (!isCurrent && !isUnresolved) return null;

            return (
              <g key={node.id} transform={`translate(${node.px}, ${node.py})`}>
                {isCurrent ? (
                  <>
                    <circle
                      r={8}
                      fill="rgba(230, 179, 30, 0.22)"
                      stroke="#f7d24b"
                      strokeWidth={1.8}
                    />
                    {facingIndicator && (
                      <polygon
                        points={`${facingIndicator.tipX},${facingIndicator.tipY} ${facingIndicator.leftX},${facingIndicator.leftY} ${facingIndicator.rightX},${facingIndicator.rightY}`}
                        fill="#f7d24b"
                        stroke="rgba(15, 16, 18, 0.95)"
                        strokeWidth={0.45}
                      />
                    )}
                  </>
                ) : (
                  /* Unresolved location — small diamond marker */
                  <>
                    <polygon
                      points="0,-5 4,0 0,5 -4,0"
                      fill="rgba(12, 34, 36, 0.9)"
                      stroke="rgba(127, 219, 202, 0.7)"
                      strokeWidth={1}
                    />
                    <text x={0} y={2.5} textAnchor="middle" fontSize={6} fontWeight={700} fill="rgba(127, 219, 202, 0.85)">
                      !
                    </text>
                  </>
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
          {/* POI sparkle markers disabled - TODO: implement as separate component */}
          {/* Path step numbers */}
          {projectedForcedPath.map((step, idx) => (
            <text
              key={`rail-step-${step.x}-${step.y}-${idx}`}
              x={step.px}
              y={step.py - 7}
              textAnchor="middle"
              fontSize={6}
              fill="rgba(247, 210, 75, 0.95)"
              fontWeight={700}
            >
              {idx}
            </text>
          ))}
          {typeof nextForcedPathIndex === 'number' && projectedForcedPath[nextForcedPathIndex] && (
            <circle
              cx={projectedForcedPath[nextForcedPathIndex].px}
              cy={projectedForcedPath[nextForcedPathIndex].py}
              r={10}
              fill="none"
              stroke="rgba(247, 210, 75, 0.92)"
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
          )}
          {/* Zoom level indicator — lower-left corner, only when not at 1x */}
          {Math.abs(zoom - 1) > 0.05 && (
            <text
              x={4}
              y={height - 3}
              textAnchor="start"
              fontSize={7}
              fill="rgba(127, 219, 202, 0.55)"
              style={{ fontFamily: 'monospace' }}
            >
              {zoom.toFixed(1)}×
            </text>
          )}
        </svg>
        {showLighting && (
          <div
            ref={shadowContainerRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 8 }}
          >
            <ShadowCanvas
              containerRef={shadowContainerRef}
              anchorRef={shadowContainerRef}
              lightX={playerScreenPos.px}
              lightY={playerScreenPos.py}
              lightRadius={cellSizeZ * 1.5}
              lightIntensity={0.45}
              lightColor="#7fdbca"
              ambientDarkness={0.98}
              flickerSpeed={0}
              flickerAmount={0}
              actorLights={[...playerActorLights, ...poiActorLights]}
              blockers={shadowBlockers}
              actorGlows={[]}
              worldWidth={width}
              tileSize={cellSizeZ}
              width={width}
              worldHeight={height}
              height={height}
            />
          </div>
        )}
        {mouseCoord && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 30 }}
          >
            <div
              className="absolute text-[11px] font-mono font-bold tabular-nums rounded px-1.5 py-0.5"
              style={{
                left: Math.min(width - 4, mouseCoord.px + 9),
                top: Math.max(8, mouseCoord.py - 14),
                backgroundColor: 'rgba(10, 10, 10, 0.85)',
                color: 'rgba(127, 219, 202, 0.95)',
                border: '1px solid rgba(127, 219, 202, 0.4)',
                boxShadow: '0 0 6px rgba(0,0,0,0.6)',
              }}
            >
              {mouseCoord.x},{mouseCoord.y}
            </div>
          </div>
        )}
        {currentProjected && (onHeadingChange || onStepForward) && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 20 }}
            aria-hidden={!onHeadingChange && !onStepForward}
          >
            <div
              className="absolute"
              style={{
                left: currentProjected.px,
                top: currentProjected.py,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {onStepForward && canStepForward && (
                <button
                  type="button"
                  onClick={onStepForward}
                  className="absolute px-2 py-0.5 rounded border font-bold leading-none select-none pointer-events-auto"
                  style={{
                    left: 0,
                    top: isCompact ? -52 : -68,
                    transform: 'translate(-50%, -50%)',
                    borderColor: 'rgba(247, 210, 75, 0.8)',
                    color: '#f7d24b',
                    backgroundColor: 'rgba(10, 8, 6, 0.9)',
                  }}
                  title="Step forward"
                >
                  ↑
                </button>
              )}
              {onStepBackward && canStepBackward && (
                <button
                  type="button"
                  onClick={onStepBackward}
                  className="absolute px-2 py-0.5 rounded border font-bold leading-none select-none pointer-events-auto"
                  style={{
                    left: 0,
                    top: isCompact ? 52 : 68,
                    transform: 'translate(-50%, -50%)',
                    borderColor: 'rgba(247, 210, 75, 0.8)',
                    color: '#f7d24b',
                    backgroundColor: 'rgba(10, 8, 6, 0.9)',
                  }}
                  title="Step backward"
                >
                  ↓
                </button>
              )}
              {onHeadingChange && (
              <button
                  type="button"
                  onClick={handleLeftChevron}
                  className="absolute px-2 py-0.5 rounded border font-bold leading-none select-none pointer-events-auto"
                  style={{
                    left: -68,
                    top: 0,
                    transform: 'translate(-50%, -50%)',
                    borderColor: 'rgba(247, 210, 75, 0.8)',
                    color: '#f7d24b',
                    backgroundColor: 'rgba(10, 8, 6, 0.9)',
                  }}
                  title="Counterclockwise to previous direction"
                >
                  <span style={{ display: 'inline-block', transform: 'rotate(-90deg)' }}>↺</span>
                </button>
              )}
              {onHeadingChange && (
          <button
                  type="button"
                  onClick={handleRightChevron}
                  className="absolute px-2 py-0.5 rounded border font-bold leading-none select-none pointer-events-auto"
                  style={{
                    left: 68,
                    top: 0,
                    transform: 'translate(-50%, -50%)',
                    borderColor: 'rgba(247, 210, 75, 0.8)',
                    color: '#f7d24b',
                    backgroundColor: 'rgba(10, 8, 6, 0.9)',
                  }}
                  title="Clockwise to next direction"
                >
                  <span style={{ display: 'inline-block', transform: 'rotate(90deg)' }}>↻</span>
                </button>
              )}
            </div>
          </div>
        )}

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
        {(blockedCells.length > 0 || blockedEdges.length > 0 || conditionalEdges.length > 0 || forcedPath.length > 0) && (
          <div
            className="absolute top-1 px-1.5 py-0.5 rounded border text-[8px] font-bold tracking-[0.8px] pointer-events-none"
            style={{
              right: 98,
              borderColor: 'rgba(247, 210, 75, 0.45)',
              color: 'rgba(247, 210, 75, 0.92)',
              backgroundColor: 'rgba(10, 8, 6, 0.9)',
            }}
            title="Map legend"
          >
            {forcedPath.length > 0 ? '● Rail ' : ''}
            {blockedCells.length > 0 ? 'Mountains ' : ''}
            {blockedEdges.length > 0 ? 'Ridge ' : ''}
            {conditionalEdges.length > 0 ? 'Gate' : ''}
          </div>
        )}
      </div>


      {(currentNode || typeof supplyCount === 'number' || onHeadingChange) && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-auto px-3"
          style={{ bottom: 5 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col items-center gap-0.5">
              {!isCompact && <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: 'rgba(255, 229, 120, 0.8)' }}>
                Supplies
              </div>}
              <button
                type="button"
                onClick={onUseSupply}
                disabled={!onUseSupply || typeof supplyCount !== 'number' || supplyCount <= 0}
                className="px-1.5 py-0.5 rounded border text-[12px] font-bold tracking-[1px] select-none disabled:opacity-50"
                style={{
                  borderColor: 'rgba(255, 229, 120, 0.8)',
                  color: '#f7d24b',
                  backgroundColor: 'rgba(10, 8, 6, 0.92)',
                  textShadow: '0 0 4px rgba(230, 179, 30, 0.45)',
                  minWidth: 44,
                  textAlign: 'center',
                }}
                title={typeof supplyCount === 'number' ? `Use supply (+20 AP). ${supplyCount} remaining` : 'Supplies'}
                data-dev-component="ExplorationMapSupplyButton"
                data-dev-name="Use Supply"
                data-dev-kind="control"
                data-dev-description="Spend one supply to gain action points."
                data-dev-role="map-control"
              >
                {typeof supplyCount === 'number' ? supplyCount : '--'}
              </button>
            </div>
            <div className="flex-1 flex justify-center">
              {currentNode && (
                <div
                  className="flex items-center justify-center rounded-full text-[11px] font-mono font-bold text-game-white"
                  style={{
                    padding: '2px 8px',
                    backgroundColor: 'rgba(10, 10, 10, 0.85)',
                    borderRadius: '999px',
                    border: '1px solid rgba(127, 219, 202, 0.4)',
                    minWidth: 68,
                  }}
                >
                  {isTeleportActive ? (
                    <input
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      type="text"
                      value={teleportValue}
                      onChange={(e) => setTeleportValue(e.target.value)}
                      onKeyDown={handleTeleportKeyDown}
                      onBlur={handleTeleportCommit}
                      className="rounded border text-center text-[11px] font-mono font-bold"
                      style={{
                        width: 72,
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
                      className="select-none"
                      style={{
                        color: onTeleport ? 'rgba(247, 210, 75, 0.9)' : 'rgba(127, 219, 202, 0.75)',
                        cursor: onTeleport ? 'pointer' : 'default',
                      }}
                      title={onTeleport ? 'Double-click to teleport' : undefined}
                    >
                      {currentNode.x},{currentNode.y}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end">
              {onHeadingChange && (
                <div className="flex flex-col items-center gap-0.5">
                  {!isCompact && <div className="h-[13px]" aria-hidden="true" />}
                  <button
                    type="button"
                    onClick={handleCenterOnPlayer}
                    className="h-6 min-w-[28px] px-1.5 rounded border text-[17px] leading-none font-bold tracking-[0.8px] pointer-events-auto flex items-center justify-center"
                    style={{
                      borderColor: 'rgba(255, 118, 118, 0.78)',
                      color: '#ff6f6f',
                      backgroundColor: 'rgba(24, 8, 10, 0.9)',
                      boxShadow: '0 0 8px rgba(255, 86, 86, 0.35)',
                    }}
                    title="Center map on player"
                    data-dev-component="ExplorationMapCenterButton"
                    data-dev-name="Center Map on Player"
                    data-dev-kind="control"
                    data-dev-description="Re-center the map view on the current player node."
                    data-dev-role="map-control"
                  >
                    ⌖
                  </button>
                </div>
              )}
          <div className="flex flex-col items-center gap-0.5">
            {!isCompact && <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: 'rgba(255, 229, 120, 0.8)' }}>
              AP
            </div>}
            <button
              type="button"
              className="px-1.5 py-0.5 rounded border text-[12px] font-bold tracking-[1px] select-none"
              style={{
                borderColor: 'rgba(255, 229, 120, 0.8)',
                color: '#f7d24b',
                backgroundColor: 'rgba(10, 8, 6, 0.92)',
                textShadow: '0 0 4px rgba(230, 179, 30, 0.45)',
                minWidth: 38,
                textAlign: 'center',
              }}
              title="Available action points"
            >
              {typeof actionPoints === 'number' ? Math.max(0, Math.floor(actionPoints)) : '--'}
            </button>
          </div>
            </div>
          </div>
        </div>
      )}
      <div
        className="absolute left-2 z-30 pointer-events-auto"
        style={{
          top: 0,
          bottom: isCompact ? 38 : 0,
          padding: '0 6px',
        }}
      >
        <div
          className="flex flex-col items-center gap-2"
          style={{ height: '100%', justifyContent: 'center' }}
        >
          <div className="text-[8px] font-bold uppercase tracking-[0.4em]" style={{ color: 'rgba(127, 219, 202, 0.75)' }}>
            Z
          </div>
          <input
            ref={zoomSliderRef}
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={handleZoomSliderChange}
            orient="vertical"
            className="accent-[rgba(127,219,202,0.95)]"
            title="Zoom (locks to player)"
            data-dev-component="ExplorationMapZoomSlider"
            data-dev-name="Map Zoom"
            data-dev-kind="control"
            data-dev-description="Adjust map zoom level."
            data-dev-role="map-control"
            style={{
              height: Math.min(
                isCompact ? height - 70 : height,
                Math.max(isCompact ? 60 : 90, cellSizeZ * 1.5)
              ),
              width: 18,
              margin: 0,
              WebkitAppearance: 'slider-vertical',
              writingMode: 'bt-lr',
              backgroundColor: 'transparent',
            }}
          />
          <div className="text-[10px] font-mono font-bold" style={{ color: 'rgba(127, 219, 202, 0.9)' }}>
            {zoom.toFixed(2)}x
          </div>
        </div>
      </div>
    </div>
  );
});





