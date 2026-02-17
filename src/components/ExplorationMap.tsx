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
  cleared?: boolean;
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
  onHeadingChange?: (direction: Direction) => void;
  onTeleport?: (x: number, y: number) => void;
  poiMarkers?: Array<{ id: string; x: number; y: number; label?: string }>;
  blockedCells?: Array<{ x: number; y: number }>;
  blockedEdges?: Array<{ fromX: number; fromY: number; toX: number; toY: number }>;
  conditionalEdges?: Array<{ fromX: number; fromY: number; toX: number; toY: number; locked: boolean }>;
  activeBlockedEdge?: { fromX: number; fromY: number; toX: number; toY: number; reason?: string } | null;
  forcedPath?: Array<{ x: number; y: number }>;
  nextForcedPathIndex?: number | null;
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

function extractBlockedRegions(blockedCells: GridCell[]): Array<{ id: string; cells: GridCell[] }> {
  const remaining = new Set(blockedCells.map((cell) => `${cell.x},${cell.y}`));
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
  onHeadingChange,
  onTeleport,
  poiMarkers = [],
  blockedCells = [],
  blockedEdges = [],
  conditionalEdges = [],
  activeBlockedEdge = null,
  forcedPath = [],
  nextForcedPathIndex = null,
}: ExplorationMapProps) {
  const [mouseCoord, setMouseCoord] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [isTeleportActive, setIsTeleportActive] = useState(false);
  const [teleportValue, setTeleportValue] = useState('');
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  void stepCost;
  void onStepCostDecrease;
  void onStepCostIncrease;

  const cx = width / 2;
  const cy = HEIGHT / 2;

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
    if (!activeBlockedEdge) return null;
    const moveDx = activeBlockedEdge.toX - activeBlockedEdge.fromX;
    const moveDy = activeBlockedEdge.toY - activeBlockedEdge.fromY;
    const anchorX = activeBlockedEdge.fromX + (moveDx * 0.35);
    const anchorY = activeBlockedEdge.fromY + (moveDy * 0.35);
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
      ...activeBlockedEdge,
      x1: from.px,
      y1: from.py,
      x2: to.px,
      y2: to.py,
      mx: (from.px + to.px) / 2,
      my: (from.py + to.py) / 2,
    };
  }, [activeBlockedEdge, projectWorldToScreen]);

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
    const scaleY = HEIGHT / rect.height;
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
        className="text-[12px] font-bold tracking-[1.6px] text-game-teal/85 text-center mb-0.5"
        style={{ paddingRight: 96 }}
      >
        {travelLabel ?? 'UNKNOWN'}
      </div>
      <div className="text-center mb-1">
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
              className="text-[11px] font-mono font-bold select-none"
              style={{
                color: onTeleport ? 'rgba(247, 210, 75, 0.9)' : 'rgba(127, 219, 202, 0.75)',
                cursor: onTeleport ? 'pointer' : 'default',
                minWidth: 72,
                textAlign: 'center',
                display: 'inline-block',
                padding: '1px 4px',
                borderRadius: 3,
                border: onTeleport ? '1px solid rgba(247, 210, 75, 0.35)' : '1px solid transparent',
              }}
              title={onTeleport ? 'Double-click to teleport' : undefined}
            >
              {currentNode.x},{currentNode.y}
            </span>
          )
        )}
      </div>

      <div style={{ position: 'relative', width, height: HEIGHT }} className="block">
        <svg
          ref={svgRef}
          width={width}
          height={HEIGHT}
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
            const label = projectWorldToScreen(x, camY + ((HEIGHT / 2 - 4 - panY) / Math.max(cellSizeZ, 1)));
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
          {projectedActiveBlockedEdge && (
            <g>
              <line
                x1={projectedActiveBlockedEdge.x1}
                y1={projectedActiveBlockedEdge.y1}
                x2={projectedActiveBlockedEdge.x2}
                y2={projectedActiveBlockedEdge.y2}
                stroke="rgba(255, 86, 86, 0.96)"
                strokeWidth={4.8}
                strokeLinecap="round"
              />
              {Array.from({ length: 7 }).map((_, index) => {
                const dx = projectedActiveBlockedEdge.x2 - projectedActiveBlockedEdge.x1;
                const dy = projectedActiveBlockedEdge.y2 - projectedActiveBlockedEdge.y1;
                const segmentLength = Math.max(1, Math.hypot(dx, dy));
                const step = segmentLength / 7;
                const ux = dx / segmentLength;
                const uy = dy / segmentLength;
                const edgeInset = step * 0.75;
                const usableLength = Math.max(1, segmentLength - (edgeInset * 2));
                const cardHeight = Math.max(2.2, step * 0.62);
                const cardWidth = Math.max(1.8, cardHeight * 0.62);
                const t = (index + 0.5) / 7;
                const distance = edgeInset + (usableLength * t);
                const x = projectedActiveBlockedEdge.x1 + (ux * distance);
                const y = projectedActiveBlockedEdge.y1 + (uy * distance);
                return (
                  <g
                    key={`blocked-card-${index}`}
                    transform={`translate(${x}, ${y})`}
                  >
                    <rect
                      x={-cardWidth / 2}
                      y={-cardHeight / 2}
                      width={cardWidth}
                      height={cardHeight}
                      rx={Math.max(0.9, cardWidth * 0.16)}
                      fill="rgba(33, 10, 10, 0.98)"
                      stroke="rgba(255, 120, 120, 0.98)"
                      strokeWidth={Math.max(0.9, cardWidth * 0.12)}
                    />
                    <line
                      x1={-cardWidth * 0.3}
                      y1={-cardHeight * 0.3}
                      x2={cardWidth * 0.3}
                      y2={cardHeight * 0.3}
                      stroke="rgba(255, 120, 120, 0.9)"
                      strokeWidth={Math.max(0.45, cardWidth * 0.08)}
                    />
                    <line
                      x1={cardWidth * 0.3}
                      y1={-cardHeight * 0.3}
                      x2={-cardWidth * 0.3}
                      y2={cardHeight * 0.3}
                      stroke="rgba(255, 120, 120, 0.9)"
                      strokeWidth={Math.max(0.45, cardWidth * 0.08)}
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
                    {currentNode && (
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
          {/* Mouse coordinate display — anchored beside cursor */}
          {mouseCoord && (
            <text
              x={Math.min(width - 4, mouseCoord.px + 9)}
              y={Math.max(8, mouseCoord.py - 3)}
              textAnchor="start"
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

      {/* Bottom row: heading chevrons + coordinate + zoom + counters + center */}
      {(onHeadingChange || currentNode) && (
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
          {currentNode && (
            <div
              className="px-2 py-0.5 rounded border text-[10px] font-bold tracking-[1px] tabular-nums select-none"
              style={{
                borderColor: 'rgba(127, 219, 202, 0.45)',
                color: '#d7fff8',
                backgroundColor: 'rgba(10, 10, 10, 0.8)',
              }}
              title="Current exploration coordinates (col,row)"
            >
              {currentNode.x},{currentNode.y}
            </div>
          )}
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
              minWidth: 38,
              textAlign: 'center',
            }}
            title={typeof supplyCount === 'number' ? `Use supply (+20 AP). ${supplyCount} remaining` : 'Supplies'}
          >
            {typeof supplyCount === 'number' ? supplyCount : '--'}
          </button>
          <div className="flex items-center gap-1 rounded border px-1.5 py-0.5" style={{ borderColor: 'rgba(127, 219, 202, 0.5)', backgroundColor: 'rgba(10, 10, 10, 0.7)' }}>
            <span className="text-[8px] font-bold tracking-[1px]" style={{ color: 'rgba(127, 219, 202, 0.75)' }}>
              Z
            </span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={handleZoomSliderChange}
              className="w-20 accent-[rgba(127,219,202,0.95)]"
              title="Zoom (locks to player)"
            />
            <span className="text-[8px] font-mono font-bold min-w-[28px] text-right" style={{ color: 'rgba(127, 219, 202, 0.9)' }}>
              {zoom.toFixed(2)}x
            </span>
          </div>
          <div
            className="px-1.5 py-0.5 rounded border text-[12px] font-bold tracking-[1px] select-none"
            style={{
              borderColor: 'rgba(247, 210, 75, 0.8)',
              color: '#f7d24b',
              backgroundColor: 'rgba(10, 8, 6, 0.92)',
              textShadow: '0 0 4px rgba(230, 179, 30, 0.45)',
              minWidth: 42,
              textAlign: 'center',
            }}
            title="Available action points"
          >
            {typeof actionPoints === 'number' ? Math.max(0, Math.floor(actionPoints)) : '--'}
          </div>
          <button
            type="button"
            onClick={handleCenterOnPlayer}
            className="h-6 min-w-[28px] px-1.5 rounded border text-[12px] leading-none font-bold tracking-[0.8px] pointer-events-auto flex items-center justify-center"
            style={{
              borderColor: 'rgba(255, 118, 118, 0.78)',
              color: '#ff6f6f',
              backgroundColor: 'rgba(24, 8, 10, 0.9)',
              boxShadow: '0 0 8px rgba(255, 86, 86, 0.35)',
            }}
            title="Center map on player"
          >
            🂠
          </button>
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
