import { TABLE_GRID, TRUE_CENTER, screenToWorld, type GridCell } from '../gridCoordinates';
import { findWorldPath, pointAlongWorldPath, worldPathLength, type PathObstacle } from '../worldPathfinding';
import { TableQuestCard, type PlacedQuestCard } from './TableQuestCard';
import { BoardObjectLabel } from './BoardObjectLabel';
import { solverFlightDuration } from '../solverTiming';
import { createTableLightField, getTableLighting, tableObjectShadow, type LightLevel, type TableLight } from '../protoLighting';
import { drawTableLight, tableLightNeedsAnimation } from './tableLightCanvas';
import { WORLD_ITEMS, CRAFT_RECIPES, stackIngredients, type CraftStack, type WorldItemId } from '../protoCrafting';
import React, { useEffect, useRef, useState } from 'react';
import { TableauSolveControls, type SolveStepResult } from './TableauSolveControls';
import { useCameraControls } from '../../hooks/useCameraControls';

export type ProtoBiomeTile = {
  id: string;
  title: string;
  sizeLabel: 'Small' | 'Medium' | 'Large';
  gridSize: { columns: number; rows: number };
  resourceDensity: number;
  tableauSize: number;
  position: { x: number; y: number };
  selected: boolean;
  unlocked?: boolean;
  travelCost?: number;
  threat?: 'none' | 'low';
};

export type ProtoWorldActor = {
  id: 'hero';
  label: string;
  location?: 'table' | 'foundation';
  biomeId?: string;
  hutId?: string;
  position: { x: number; y: number };
};

export type ProtoWorldResourceStack = CraftStack;

export type ProtoLightSource = TableLight;

type ResourcePhysicsBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export const CLASSICPLUS_GRID_SIZE = TABLE_GRID.cellSize;
export const CLASSICPLUS_ZOOM_REFERENCE_SCALE = 1.7;

/** A biome claims an explicit rectangle of whole world-grid cells. Tableau
 * card capacity is intentionally independent from this visual footprint. */
export const getBiomeTileFootprint = (gridSize: { columns: number; rows: number }) => {
  const columns = Math.max(1, Math.round(gridSize.columns));
  const rows = Math.max(1, Math.round(gridSize.rows));
  return {
    columns,
    rows,
    width: columns * CLASSICPLUS_GRID_SIZE,
    height: rows * CLASSICPLUS_GRID_SIZE,
  };
};

export const getBiomeWorldFootprint = (tile: Pick<ProtoBiomeTile,'position'|'gridSize'>) => {
  const footprint=getBiomeTileFootprint(tile.gridSize);
  const anchor=TABLE_GRID.atWorld(tile.position);
  const first=TABLE_GRID.offset(anchor,-Math.floor(footprint.columns/2),-Math.floor(footprint.rows/2));
  return {...TABLE_GRID.region(first,footprint.columns,footprint.rows),first};
};

const finiteCoordinate = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value as number : fallback;

const snapToGrid = (value: number) => TABLE_GRID.snap({x:finiteCoordinate(value),y:0}).x;

const finiteWorldPoint = (point: { x: number; y: number } | undefined, fallback = { x: 0, y: 0 }) => ({
  x: finiteCoordinate(point?.x, fallback.x),
  y: finiteCoordinate(point?.y, fallback.y),
});

type ProtoMapProps = {
  biomeTiles: ProtoBiomeTile[];
  actors: ProtoWorldActor[];
  actorOrigins: ProtoWorldActor[];
  resourceStacks: ProtoWorldResourceStack[];
  lightSources?: ProtoLightSource[];
  timeOfDay?: number;
  /** Dev readout: show each object's light % on the table. */
  showLightReadout?: boolean;
  onMoveLight?: (id: string, position: { x: number; y: number }) => void;
  onSelectBiome: (biomeId: string) => void;
  questOpen: boolean;
  onToggleQuest: () => void;
  onDropActorToTable: (actorId: string, point: { x: number; y: number }, arrival?: { biomeId?: string; directBiome?: boolean; foundationIndex?: number }) => void;
  onMoveResourceStack?: (stackId: string, point: { x: number; y: number }, targetId?: string, actorId?: string) => void;
  onSplitResourceStack?: (stackId: string) => void;
  onPlayBuildCard?: (stackId: string, rank: number) => void;
  onSolveBuildStep?: (stackId: string, divine: boolean) => SolveStepResult;
  onStartSolver?: (divine: boolean) => void;
  actorStamina?: number;
  onActorDragStart?: (actorId: string) => void;
  questCards?: PlacedQuestCard[];
  questTitles?: string[];
  questTexts?: string[];
  questClaims?: number;
  onMoveQuest?: (index:number, position:{x:number;y:number}, tilt:number)=>void;
  onRedeemQuest?: (index: number) => void;
  onInspectActor?: (actorId: string, anchor: HTMLElement) => void;
};

/** The open expedition field. World tokens are intentionally lightweight DOM
 * nodes so they remain easy to replace with richer map entities later. */
export const ProtoMap = ({
  biomeTiles,
  actors,
  actorOrigins,
  resourceStacks,
  lightSources = [],
  timeOfDay = 9,
  showLightReadout = false,
  onMoveLight,
  onSelectBiome,
  questOpen,
  onToggleQuest,
  onDropActorToTable,
  onMoveResourceStack,
  onSplitResourceStack,
  onPlayBuildCard,
  onSolveBuildStep,
  onStartSolver,
  actorStamina = 0,
  onActorDragStart,
  onInspectActor,
  questCards = [],
  questTitles = [],
  questTexts = [],
  questClaims = 0,
  onRedeemQuest,
  onMoveQuest,
}: ProtoMapProps) => {
  const camera = useCameraControls({
    minScale: 0.65,
    maxScale: 2.25,
    zoomSensitivity: 0.0048,
    centeredZoom: true,
    initialState: { x: 0, y: 0, scale: CLASSICPLUS_ZOOM_REFERENCE_SCALE },
  });
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  // Steady light the game world can read per object; rendering adds flicker on top.
  const lightField = createTableLightField(timeOfDay, lightSources);
  const lightReadouts: { id: string; position: { x: number; y: number }; lift: number; percent: number; level: LightLevel }[] = [];
  const [hoverCell,setHoverCell] = useState<GridCell>(TRUE_CENTER.cell);
  const [routeBlocked, setRouteBlocked] = useState(false);
  const [draggingActorId, setDraggingActorId] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ actorId: string; x: number; y: number } | null>(null);
  const [travel, setTravel] = useState<{
    actorId: string;
    label: string;
    path: Array<{ x: number; y: number }>;
    progress: number;
    arrival: { biomeId?: string; directBiome?: boolean; foundationIndex?: number };
  } | null>(null);
  const pointerDragRef = useRef<{ actorId: string; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const resourcePointerDragRef = useRef<{ stackId: string; pointerId: number } | null>(null);
  const [draggingResourceId, setDraggingResourceId] = useState<string | null>(null);
  const travelingActorRef = useRef<string | null>(null);
  const resourcePhysicsRef = useRef<Map<string, ResourcePhysicsBody>>(new Map());
  const resourceStacksRef = useRef(resourceStacks);
  const [, setResourcePhysicsTick] = useState(0);
  resourceStacksRef.current = resourceStacks;
  const gridStep = CLASSICPLUS_GRID_SIZE * camera.cameraState.scale;

  const resetProtoCamera = () => {
    camera.setCameraState({ x: 0, y: 0, scale: CLASSICPLUS_ZOOM_REFERENCE_SCALE });
  };

  const clearActorDragState = () => {
    pointerDragRef.current = null;
    setDraggingActorId(null);
    setDragPreview(null);
  };

  const clearResourceDragState = () => {
    resourcePointerDragRef.current = null;
    setDraggingResourceId(null);
  };

  // Resource stacks are visual tokens, so their collision response is kept
  // local to the map. Their authored positions remain the gameplay truth.
  useEffect(() => {
    const activeIds = new Set(resourceStacks.map((stack) => stack.id));
    resourceStacks.forEach((stack) => {
      const existing = resourcePhysicsRef.current.get(stack.id);
      if (!existing) {
        resourcePhysicsRef.current.set(stack.id, {
          x: stack.position.x,
          y: stack.position.y,
          vx: 0,
          vy: 0,
        });
      }
    });
    resourcePhysicsRef.current.forEach((_body, id) => {
      if (!activeIds.has(id)) resourcePhysicsRef.current.delete(id);
    });
  }, [resourceStacks]);

  useEffect(() => {
    let frame = 0;
    let previousTime = performance.now();
    const tick = (now: number) => {
      const deltaSeconds = Math.min(0.032, Math.max(0.001, (now - previousTime) / 1000));
      previousTime = now;
      const stacks = resourceStacksRef.current;
      const bodies = stacks
        .map((stack) => ({ stack, body: resourcePhysicsRef.current.get(stack.id) }))
        .filter((entry): entry is { stack: ProtoWorldResourceStack; body: ResourcePhysicsBody } => Boolean(entry.body));

      bodies.forEach(({ stack, body }) => {
        if (resourcePointerDragRef.current?.stackId === stack.id) return;
        body.vx += (stack.position.x - body.x) * 4.5 * deltaSeconds;
        body.vy += (stack.position.y - body.y) * 4.5 * deltaSeconds;
        body.vx *= 0.88;
        body.vy *= 0.88;
      });

      for (let firstIndex = 0; firstIndex < bodies.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < bodies.length; secondIndex += 1) {
          const first = bodies[firstIndex].body;
          const second = bodies[secondIndex].body;
          if (resourcePointerDragRef.current?.stackId === bodies[firstIndex].stack.id || resourcePointerDragRef.current?.stackId === bodies[secondIndex].stack.id) continue;
          const dx = second.x - first.x;
          const dy = second.y - first.y;
          const distance = Math.hypot(dx, dy);
          const minimumDistance = 48;
          if (distance >= minimumDistance) continue;
          const safeDistance = distance || 1;
          const normalX = distance ? dx / safeDistance : 1;
          const normalY = distance ? dy / safeDistance : 0;
          const overlap = (minimumDistance - distance) * 0.5;
          first.x -= normalX * overlap;
          first.y -= normalY * overlap;
          second.x += normalX * overlap;
          second.y += normalY * overlap;
          const relativeVelocity = (second.vx - first.vx) * normalX + (second.vy - first.vy) * normalY;
          if (relativeVelocity < 0) {
            const bounce = -relativeVelocity * 0.34;
            first.vx -= normalX * bounce;
            first.vy -= normalY * bounce;
            second.vx += normalX * bounce;
            second.vy += normalY * bounce;
          }
        }
      }

      bodies.forEach(({ body }) => {
        body.x += body.vx * deltaSeconds;
        body.y += body.vy * deltaSeconds;
      });
      if (bodies.length > 0) setResourcePhysicsTick((version) => version + 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handlePointerDrop = (event: Event) => {
      const detail = (event as CustomEvent<{ actorId?: string; x?: number; y?: number }>).detail;
      if (!detail.actorId || detail.x === undefined || detail.y === undefined) return;
      const dropTarget = document.elementFromPoint(detail.x, detail.y);
      const foundationTarget = dropTarget?.closest<HTMLElement>('[aria-label="Foundation"]');
      if (foundationTarget) {
        const tile = biomeTiles.find((entry) => entry.selected) ?? biomeTiles[0];
        startActorTravel(detail.actorId, tile?.position ?? actorOrigins.find((entry) => entry.id === detail.actorId)?.position ?? { x: 0, y: 0 }, {
          biomeId: tile?.id,
          foundationIndex: Number(foundationTarget.dataset.foundationIndex ?? 0),
        });
      } else if (dropTarget?.closest('.proto-map-viewport')) {
        const destination = resolveDropDestination(detail.actorId, detail.x, detail.y);
        startActorTravel(detail.actorId, destination.point, destination.arrival);
      }
      setDraggingActorId(null);
      setDragPreview(null);
    };
    window.addEventListener('proto-actor-pointer-drop', handlePointerDrop);
    return () => window.removeEventListener('proto-actor-pointer-drop', handlePointerDrop);
  }, [actorOrigins, biomeTiles, resourceStacks]);

  const startActorTravel = (
    actorId: string,
    target: { x: number; y: number },
    arrival: { biomeId?: string; directBiome?: boolean; foundationIndex?: number } = {},
  ) => {
    const origin = actorOrigins.find((actor) => actor.id === actorId);
    if (!origin || travelingActorRef.current === actorId) return;
    const originPoint = origin.location === 'foundation' && origin.biomeId
      ? resolveBiomeActorCell(origin.biomeId) ?? origin.position
      : origin.position;
    const obstacles: PathObstacle[] = biomeTiles.map(tile => ({id:tile.id,...getBiomeWorldFootprint(tile)}));
    const buildings = resourceStacks.filter(stack => stack.resource === 'provisions_hut' || stack.build && CRAFT_RECIPES.find(recipe => recipe.id === stack.build?.recipeId)?.output === 'provisions_hut');
    buildings.forEach(stack => obstacles.push({id: stack.id, left: stack.position.x-24, right: stack.position.x+24, top: stack.position.y-24, bottom: stack.position.y+24}));
    const destinationBuilding = buildings.find(stack => Math.hypot(stack.position.x-target.x,stack.position.y-target.y)<52);
    // Snap only the destination; route segments remain continuous and diagonal.
    const snappedTarget = arrival.biomeId ? finiteWorldPoint(target) : destinationBuilding ? destinationBuilding.position : TABLE_GRID.snap(target);
    const path = findWorldPath(finiteWorldPoint(originPoint), snappedTarget, obstacles, arrival.biomeId ?? destinationBuilding?.id);
    clearActorDragState();
    if (!path || path.length === 0 || path.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) { setRouteBlocked(true); return; }
    setRouteBlocked(false);
    travelingActorRef.current = actorId;
    setTravel({ actorId, label: origin.label, path, progress: 0, arrival });
  };

  useEffect(() => {
    const handleFoundationTravelRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ actorId?: string; foundationIndex?: number }>).detail;
      if (!detail.actorId || detail.foundationIndex === undefined) return;
      const tile = biomeTiles.find((entry) => entry.selected) ?? biomeTiles[0];
      startActorTravel(detail.actorId, tile?.position ?? actorOrigins.find((entry) => entry.id === detail.actorId)?.position ?? { x: 0, y: 0 }, {
        biomeId: tile?.id,
        foundationIndex: detail.foundationIndex,
      });
    };
    window.addEventListener('proto-foundation-travel-request', handleFoundationTravelRequest);
    return () => window.removeEventListener('proto-foundation-travel-request', handleFoundationTravelRequest);
  }, [actorOrigins, biomeTiles, resourceStacks]);

  useEffect(() => {
    const handleDragStart = (event: Event) => {
      const detail = (event as CustomEvent<{ actorId?: string; x?: number; y?: number }>).detail;
      if (!detail.actorId) return;
      setDraggingActorId(detail.actorId);
      if (detail.x !== undefined && detail.y !== undefined) setDragPreview({ actorId: detail.actorId, x: detail.x, y: detail.y });
    };
    const handleDragMove = (event: Event) => {
      const detail = (event as CustomEvent<{ actorId?: string; x?: number; y?: number }>).detail;
      if (detail.actorId && detail.x !== undefined && detail.y !== undefined) setDragPreview({ actorId: detail.actorId, x: detail.x, y: detail.y });
    };
    const handleDragEnd = () => {
      setDraggingActorId(null);
      setDragPreview(null);
    };
    window.addEventListener('proto-actor-drag-start', handleDragStart);
    window.addEventListener('proto-actor-drag-move', handleDragMove);
    window.addEventListener('proto-actor-drag-end', handleDragEnd);
    return () => {
      window.removeEventListener('proto-actor-drag-start', handleDragStart);
      window.removeEventListener('proto-actor-drag-move', handleDragMove);
      window.removeEventListener('proto-actor-drag-end', handleDragEnd);
    };
  }, []);

  useEffect(() => {
    if (!travel) return undefined;
    const duration = Math.max(300, worldPathLength(travel.path) / 320 * 1000);
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setTravel((current) => (current ? { ...current, progress } : current));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        const destination = travel.path[travel.path.length - 1] ?? travel.path[0];
        travelingActorRef.current = null;
        setTravel(null);
        if (destination) onDropActorToTable(travel.actorId, destination, travel.arrival);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [travel?.actorId]);

  const finishPointerActorDrag = (event: React.PointerEvent<HTMLDivElement>, actorId: string) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.actorId !== actorId || drag.pointerId !== event.pointerId) return;
    const foundationTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[aria-label="Foundation"]');
    if (drag.moved && foundationTarget) {
      const tile = biomeTiles.find((entry) => entry.selected) ?? biomeTiles[0];
      startActorTravel(actorId, tile?.position ?? actorOrigins.find((entry) => entry.id === actorId)?.position ?? { x: 0, y: 0 }, {
        biomeId: tile?.id,
        foundationIndex: Number(foundationTarget.dataset.foundationIndex ?? 0),
      });
    }
    if (!drag.moved) setSelectedActorId(actorId);
    pointerDragRef.current = null;
    setDraggingActorId(null);
    setDragPreview(null);
  };

  const worldPointFromClient = (clientX: number, clientY: number) => {
    const rect = camera.containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToWorld({x:clientX,y:clientY},rect,camera.cameraState);
  };

  const resolveBiomeAdjacentCell = (actorId: string, biomeId: string) => {
    const tile = biomeTiles.find((entry) => entry.id === biomeId);
    if (!tile) return null;
    const footprint = getBiomeTileFootprint(tile.gridSize);
    const centerX = getBiomeWorldFootprint(tile).x;
    const centerY = getBiomeWorldFootprint(tile).y;
    const left = centerX - footprint.width / 2;
    const top = centerY - footprint.height / 2;
    const right = left + footprint.width;
    const bottom = top + footprint.height;
    const candidates = [
      ...Array.from({ length: footprint.columns }, (_, index) => ({ x: left + CLASSICPLUS_GRID_SIZE/2 + index * CLASSICPLUS_GRID_SIZE, y: bottom+CLASSICPLUS_GRID_SIZE/2 })),
      ...Array.from({ length: footprint.columns }, (_, index) => ({ x: left + CLASSICPLUS_GRID_SIZE/2 + index * CLASSICPLUS_GRID_SIZE, y: top - CLASSICPLUS_GRID_SIZE/2 })),
      ...Array.from({ length: footprint.rows }, (_, index) => ({ x: left - CLASSICPLUS_GRID_SIZE/2, y: top + CLASSICPLUS_GRID_SIZE/2 + index * CLASSICPLUS_GRID_SIZE })),
      ...Array.from({ length: footprint.rows }, (_, index) => ({ x: right + CLASSICPLUS_GRID_SIZE/2, y: top + CLASSICPLUS_GRID_SIZE/2 + index * CLASSICPLUS_GRID_SIZE })),
    ];
    const origin = actorOrigins.find((actor) => actor.id === actorId);
    const originPoint = origin?.biomeId ? resolveBiomeActorCell(origin.biomeId) ?? origin.position : origin?.position;
    const target = { x: tile.position.x, y: tile.position.y };
    const horizontal = originPoint ? Math.abs(target.x - originPoint.x) >= Math.abs(target.y - originPoint.y) : false;
    const directionalCandidates = horizontal
      ? candidates.filter((candidate) => (target.x < (originPoint?.x ?? target.x) ? candidate.x < left : candidate.x > right))
      : candidates.filter((candidate) => (target.y < (originPoint?.y ?? target.y) ? candidate.y < top : candidate.y > bottom));
    const orderedCandidates = directionalCandidates.length > 0 ? directionalCandidates : candidates;
    const occupied = new Set(
      actorOrigins
        .filter((actor) => actor.id !== actorId)
        .map((actor) => {
          const position = finiteWorldPoint(actor.position);
          return `${snapToGrid(position.x)}:${snapToGrid(position.y)}`;
        }),
    );
    return orderedCandidates.find((candidate) => !occupied.has(`${candidate.x}:${candidate.y}`)) ?? orderedCandidates[0] ?? null;
  };

  const resolveBiomeActorCell = (biomeId: string) => {
    const tile = biomeTiles.find((entry) => entry.id === biomeId);
    if (!tile) return null;
    const footprint = getBiomeTileFootprint(tile.gridSize);
    const centerX = getBiomeWorldFootprint(tile).x;
    const centerY = getBiomeWorldFootprint(tile).y;
    const left = centerX - footprint.width / 2;
    const top = centerY - footprint.height / 2;
    return TABLE_GRID.center(getBiomeWorldFootprint(tile).first);
  };

  const getActorWorldPosition = (actor: ProtoWorldActor) => finiteWorldPoint(
    actor.location === 'foundation' && actor.biomeId
      ? resolveBiomeActorCell(actor.biomeId) ?? actor.position
      : actor.position,
  );

  useEffect(() => {
    const canvas = lightCanvasRef.current;
    const viewport = camera.containerRef.current;
    if (!canvas || !viewport) return undefined;
    const frame = getTableLighting(timeOfDay);
    const sources = lightSources.map((source) => ({
      ...source,
      position: finiteWorldPoint(source.position),
      radius: Math.max(0.5, finiteCoordinate(source.radius, 2.7)),
    }));
    const draw = (timeMs: number) => {
      const rect = viewport.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTableLight(context, { width, height }, camera.cameraState, frame, sources, timeMs);
    };
    draw(performance.now());
    const observer = new ResizeObserver(() => draw(performance.now()));
    observer.observe(viewport);
    // Flicker redraws at ~24 fps after dark; reduced-motion users get a steady light.
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let frameId = 0;
    let last = 0;
    if (!reducedMotion && tableLightNeedsAnimation(frame, sources)) {
      const tick = (now: number) => {
        if (now - last > 40) { last = now; draw(now); }
        frameId = window.requestAnimationFrame(tick);
      };
      frameId = window.requestAnimationFrame(tick);
    }
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [lightSources, timeOfDay, camera.cameraState.x, camera.cameraState.y, camera.cameraState.scale]);

  const resolveDropDestination = (actorId: string, clientX: number, clientY: number) => {
    const biomeTarget = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-biome-id]');
    if (biomeTarget?.dataset.biomeId) {
      const biomeId = biomeTarget.dataset.biomeId;
      return {
        point: resolveBiomeActorCell(biomeId) ?? resolveBiomeAdjacentCell(actorId, biomeId) ?? worldPointFromClient(clientX, clientY),
        arrival: { biomeId },
      };
    }
    return { point: worldPointFromClient(clientX, clientY), arrival: {} };
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const actorId = event.dataTransfer.getData('text/proto-actor');
    if (!actorId) return;
    const destination = resolveDropDestination(actorId, event.clientX, event.clientY);
    startActorTravel(actorId, destination.point, destination.arrival);
    clearActorDragState();
  };

  const finishPointerTableDrag = (event: React.PointerEvent<HTMLDivElement>, actorId: string) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.actorId !== actorId || drag.pointerId !== event.pointerId) return;
        if (drag.moved) {
      const foundationTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[aria-label="Foundation"]');
      if (foundationTarget) {
        const tile = biomeTiles.find((entry) => entry.selected) ?? biomeTiles[0];
        startActorTravel(actorId, tile?.position ?? actorOrigins.find((entry) => entry.id === actorId)?.position ?? { x: 0, y: 0 }, {
          biomeId: tile?.id,
          foundationIndex: Number(foundationTarget.dataset.foundationIndex ?? 0),
        });
      } else if (document.elementFromPoint(event.clientX, event.clientY)?.closest('.proto-map-viewport')) {
        const destination = resolveDropDestination(actorId, event.clientX, event.clientY);
        startActorTravel(actorId, destination.point, destination.arrival);
      }
    } else {
      setSelectedActorId(actorId);
      onInspectActor?.(actorId, event.currentTarget);
        }
    clearActorDragState();
  };

  const travelPosition = travel ? pointAlongWorldPath(travel.path, travel.progress) : null;

  return (
    <section className="proto-map relative min-h-0 overflow-hidden rounded-[calc(var(--classic-radius)*1.3)] border border-[#8ef2d4]/22 bg-[#050807] font-mono">
      <div
        className="pointer-events-none absolute bottom-2 left-3 z-50 font-mono text-[clamp(0.72rem,1.5vmin,1rem)] font-black uppercase tracking-[0.12em] text-white/72"
        aria-live="polite"
      >
        Zoom {Math.round((camera.cameraState.scale / CLASSICPLUS_ZOOM_REFERENCE_SCALE) * 100)}%
      </div>
      <div className="proto-map-toolbar absolute right-2 top-2 z-50 flex gap-1">
        <button
          type="button"
          className="border border-[#d9a8ff]/42 bg-black/80 px-2 py-1 text-[clamp(0.46rem,0.85vmin,0.58rem)] font-black uppercase tracking-[0.12em] text-[#ecd8ff] hover:bg-[#d9a8ff]/12"
          onClick={onToggleQuest}
          aria-label={questOpen ? 'Close expedition quest tracker' : 'Open expedition quest tracker'}
        >
          {questOpen ? 'Quest −' : 'Quest +'}
        </button>
        <button type="button" className="table-grid-center-button" onClick={()=>camera.setCameraState(previous=>({...previous,x:-TRUE_CENTER.world.x*previous.scale,y:-TRUE_CENTER.world.y*previous.scale}))}>True Center</button>
        <button
          type="button"
          className="border border-white/35 bg-black px-2 py-1 text-[clamp(0.46rem,0.85vmin,0.58rem)] font-black uppercase tracking-[0.12em] text-white/80 hover:bg-white/10"
          onClick={resetProtoCamera}
        >
          Reset View
        </button>
      </div>
      {routeBlocked && <div className="absolute left-3 bottom-12 z-40 rounded border border-[#ffd166] bg-[#17140b] p-2 text-base" role="status">No clear route. Choose an open destination.</div>}
      <div className="table-grid-reference" data-grid-reference={TABLE_GRID.reference(hoverCell)} aria-label="Table grid coordinate">{hoverCell.column===0&&hoverCell.row===0 ? 'True Center · ' : ''}{TABLE_GRID.reference(hoverCell)}</div>
      <div
        ref={camera.containerRef}
        className={`proto-map-viewport h-full min-h-[18rem] cursor-grab touch-none ${camera.isPanning ? 'cursor-grabbing' : ''}`}
        aria-label="Scrollable expedition table"
        onPointerMoveCapture={event=>{const cell=TABLE_GRID.atWorld(worldPointFromClient(event.clientX,event.clientY));setHoverCell(previous=>previous.column===cell.column&&previous.row===cell.row?previous:cell);}}
        onDragOver={(event) => event.preventDefault()}
        onDragEnd={clearActorDragState}
        onDrop={handleDrop}
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(142,242,212,0.28) 0 1px, transparent 1px ${48 * camera.cameraState.scale}px), repeating-linear-gradient(90deg, rgba(142,242,212,0.28) 0 1px, transparent 1px ${48 * camera.cameraState.scale}px)`,
          // A tile image centered at the viewport places its boundaries half a
          // cell from True Center; stored actor coordinates identify square centers.
          backgroundPosition: `calc(50% + ${camera.cameraState.x}px) calc(50% + ${camera.cameraState.y}px)`,
          backgroundSize: `${gridStep}px ${gridStep}px`,
        }}
      >
        <div
          ref={camera.contentRef}
          className="proto-map-world absolute"
          style={{
            left: '-150%',
            top: '-150%',
            width: '400%',
            height: '400%',
            transformOrigin: 'center center',
          }}
        >
          <div className="table-grid-origin" data-grid-landmark="true-center" data-grid-reference={TRUE_CENTER.reference} aria-hidden="true" style={{left:'50%',top:'50%',width:CLASSICPLUS_GRID_SIZE,height:CLASSICPLUS_GRID_SIZE}}>＋</div>
          {lightSources.map((light) => <div key={light.id} data-board-piece="lamp" data-camera-ignore="true"
            aria-label={light.id === 'table-lantern' ? 'Table lantern, drag to move light' : 'Structure light'}
            onPointerDown={(event) => { event.stopPropagation(); if (light.id !== 'table-lantern' || (event.pointerType === 'mouse' && event.button !== 0)) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (light.id !== 'table-lantern' || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const point = worldPointFromClient(event.clientX, event.clientY); onMoveLight?.(light.id, point); }}
            onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            className="proto-table-lamp absolute z-10 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
            style={{ left: 'calc(50% + ' + light.position.x + 'px)', top: 'calc(50% + ' + light.position.y + 'px)' }}>🕯️</div>)}
          {questCards.map(placement => <TableQuestCard key={placement.questIndex} placement={placement} title={questTitles[placement.questIndex]} text={questTexts[placement.questIndex]} redeemed={placement.questIndex < questClaims} onRedeem={() => onRedeemQuest?.(placement.questIndex)} timeOfDay={timeOfDay} lights={lightSources} cameraScale={camera.cameraState.scale}
            onMove={(position,tilt)=>onMoveQuest?.(placement.questIndex,position,tilt)}
            solids={[
              ...biomeTiles.map(tile=>getBiomeWorldFootprint(tile)),
              ...resourceStacks.filter(stack=>stack.resource==='provisions_hut'||stack.build&&CRAFT_RECIPES.find(recipe=>recipe.id===stack.build?.recipeId)?.output==='provisions_hut').map(stack=>({x:stack.position.x,y:stack.position.y,width:48,height:48})),
              ...actors.map(actor=>{const point=getActorWorldPosition(actor);return {x:point.x,y:point.y,width:48,height:48};}),
            ]} />)}
          {biomeTiles.map((tile) => (
            (() => {
              const footprint = getBiomeTileFootprint(tile.gridSize);
              const worldFootprint = getBiomeWorldFootprint(tile);
              const tileLight = lightField.over(worldFootprint);
              lightReadouts.push({ id: 'tile-' + tile.id, position: worldFootprint, lift: worldFootprint.height / 2, percent: tileLight.percent, level: tileLight.level });
              return (
                <button
                  key={tile.id}
                  data-board-piece="tile"
                  type="button"
                  data-light-percent={tileLight.percent}
                  data-light-level={tileLight.level}
                  data-grid-reference={TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position))}
                  data-biome-id={tile.id}
                  title={`${tile.title} · ${tile.sizeLabel} · ${Math.round(tile.resourceDensity * 100)}% resources · ${tile.tableauSize} cards${tile.unlocked === false ? ' · Complete Small Woods to unlock' : ''}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    if (tile.unlocked !== false) onSelectBiome(tile.id);
                  }}
                  className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border text-center transition ${
                    tile.unlocked === false
                      ? 'cursor-not-allowed border-white/10 bg-black/40 text-white/25 opacity-65'
                      : tile.selected
                      ? 'border-[#8ef2d4]/85 bg-[#8ef2d4]/12 text-[#cafff4] shadow-[0_0_26px_rgba(142,242,212,0.2)]'
                      : 'border-white/25 bg-[#0b1211]/95 text-white/68 hover:border-[#8ef2d4]/60'
                  }`}
                  style={{
                    width: footprint.width,
                    height: footprint.height,
                    // Odd footprints have a cell center at half a grid step;
                    // even footprints center on the grid boundary between
                    // their cells so all four edges remain on grid lines.
                    boxShadow: tableObjectShadow(timeOfDay, tile.position, 5, lightSources),
                    left: `calc(50% + ${getBiomeWorldFootprint(tile).x}px)`,
                    top: `calc(50% + ${getBiomeWorldFootprint(tile).y}px)`,
                  }}
                  aria-label={tile.unlocked === false ? `${tile.title}, locked until Small Woods is complete` : `${tile.title} ${tile.sizeLabel}, ${Math.round(tile.resourceDensity * 100)}% resources, ${tile.tableauSize} cards`}
                >
                  <BoardObjectLabel text={tile.unlocked === false ? 'Locked' : tile.title} minFontSize={12} maxFontSize={18} className="uppercase font-black" />
                </button>
              );
            })()
          ))}
          {resourceStacks.map((stack) => (
            (() => {
              const physicsPosition = resourcePhysicsRef.current.get(stack.id) ?? stack.position;
              const stackLight = lightField.at(physicsPosition);
              lightReadouts.push({ id: 'stack-' + stack.id, position: physicsPosition, lift: 24, percent: stackLight.percent, level: stackLight.level });
              return (
                <div
                  key={stack.id}
                  data-board-piece="resource"
                  data-camera-ignore="true"
                  data-light-percent={stackLight.percent}
                  data-light-level={stackLight.level}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (stack.build || WORLD_ITEMS[stack.resource].kind === 'structure') return;
                    if (event.pointerType === 'mouse' && event.button !== 0) return;
                    event.preventDefault();
                    try {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                      // Pointer capture can fail when the browser changes input mode.
                    }
                    resourcePointerDragRef.current = { stackId: stack.id, pointerId: event.pointerId };
                    setDraggingResourceId(stack.id);
                    const body = resourcePhysicsRef.current.get(stack.id);
                    if (body) {
                      body.vx = 0;
                      body.vy = 0;
                    }
                  }}
                  onPointerMove={(event) => {
                    const drag = resourcePointerDragRef.current;
                    if (!drag || drag.stackId !== stack.id || drag.pointerId !== event.pointerId) return;
                    const point = worldPointFromClient(event.clientX, event.clientY);
                    const body = resourcePhysicsRef.current.get(stack.id);
                    if (body) {
                      body.x = point.x;
                      body.y = point.y;
                      body.vx = 0;
                      body.vy = 0;
                      setResourcePhysicsTick((version) => version + 1);
                    }
                  }}
                  onPointerUp={(event) => {
                    const drag = resourcePointerDragRef.current;
                    if (!drag || drag.stackId !== stack.id || drag.pointerId !== event.pointerId) return;
                    const point = worldPointFromClient(event.clientX, event.clientY);
                    const actor = actors.find((entry) => {
                      const actorPoint = getActorWorldPosition(entry);
                      return entry.location !== 'foundation' && Math.hypot(actorPoint.x - point.x, actorPoint.y - point.y) < 28;
                    });
                    const target = resourceStacks.find((entry) => {
                      const body = resourcePhysicsRef.current.get(entry.id) ?? entry.position;
                      return entry.id !== stack.id && !entry.build && Math.hypot(body.x - point.x, body.y - point.y) < 38;
                    });
                    onMoveResourceStack?.(stack.id, point, target?.id, actor?.id);
                    clearResourceDragState();
                  }}
                  onPointerCancel={() => {
                    const body = resourcePhysicsRef.current.get(stack.id);
                    if (body) {
                      body.x = stack.position.x;
                      body.y = stack.position.y;
                      body.vx = 0;
                      body.vy = 0;
                    }
                    clearResourceDragState();
                  }}
                  className={`proto-resource-stack absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#8ef2d4]/55 bg-[#0b1916] text-[0.6rem] font-black text-[#cafff4] shadow-[0_0_18px_rgba(142,242,212,0.16)] ${draggingResourceId === stack.id ? 'cursor-grabbing ring-2 ring-[#cafff4]/55' : 'cursor-grab'}`}
                  style={{ left: `calc(50% + ${physicsPosition.x}px)`, top: `calc(50% + ${physicsPosition.y}px)`, boxShadow: tableObjectShadow(timeOfDay, physicsPosition, stack.resource === 'provisions_hut' ? 14 : 9, lightSources) }}
                  title={Object.entries(stackIngredients(stack)).map(([id, count]) => `${count} ${WORLD_ITEMS[id as WorldItemId].label}`).join(' + ')}
                  aria-label={`${stack.count} ${WORLD_ITEMS[stack.resource].label}${stack.build ? ', building' : ', draggable'}`}
                >
                  <BoardObjectLabel minFontSize={12} maxFontSize={16} text={`${stack.count} ${stack.ingredients && Object.keys(stack.ingredients).length > 1 ? '🧺' : WORLD_ITEMS[stack.resource].glyph}`} />
                  {!stack.build && stack.count > 1 && WORLD_ITEMS[stack.resource].kind !== 'structure' && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onSplitResourceStack?.(stack.id)} className="absolute top-full mt-1 whitespace-nowrap rounded border border-white/30 bg-[#0b1916] px-1 text-[9px]">Split 1</button>}
                  {stack.resource === 'provisions_hut' && !stack.build && <span className="absolute top-full mt-1 whitespace-nowrap rounded bg-black px-1">Hut foundation · {actors.some((actor) => actor.hutId === stack.id) ? 'Staffed' : 'Drop actor here'}</span>}
                  {stack.build && (() => {
                    const recipe = CRAFT_RECIPES.find((entry) => entry.id === stack.build?.recipeId)!;
                    const time = Math.min(1, stack.build.elapsedMs / recipe.durationMs);
                    const progress = recipe.requiresSolitaire ? Math.min(time, stack.build.work / recipe.workRequired) : time;
                    const staffed = actors.some((actor) => actor.hutId === stack.build?.stationId);
                    return <div data-hut-build={stack.id} className="absolute left-1/2 top-full z-30 mt-2 w-44 -translate-x-1/2 rounded border border-[#8ef2d4]/50 bg-[#0b1916] p-2 text-[10px] text-[#cafff4]" onPointerDown={(event) => event.stopPropagation()}>
                      <div>{recipe.label}</div>
                      <div role="progressbar" aria-label={recipe.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="my-1 h-2 overflow-hidden rounded bg-white/15"><div className="h-full bg-[#8ef2d4]" style={{ width: progress * 100 + '%' }} /></div>
                      <div>{Math.round(progress * 100)}% · {Math.ceil((recipe.durationMs - stack.build.elapsedMs) / 1000)}s remaining</div>
                      {recipe.requiresSolitaire && <>
                        <div>{staffed ? 'Actor stamina: ' + actorStamina : 'Paused · drop actor on hut foundation'}</div>
                        <div data-hut-foundation>Solitaire {stack.build.work}/{recipe.workRequired} · Foundation {stack.build.foundation}</div>
                        <div className="mt-1 flex flex-wrap gap-1">{stack.build.tableau.map((rank) => <button type="button" data-hut-card={rank} data-hut-stack={stack.id} key={rank} disabled={!staffed || actorStamina <= 0 || Math.abs(rank - stack.build!.foundation) !== 1} onClick={() => onPlayBuildCard?.(stack.id, rank)} className="rounded border border-white/50 bg-white/10 px-2 py-1 disabled:opacity-30" aria-label={'Play ' + rank + ' to hut foundation'}>{rank}</button>)}</div>
                        <div className="mt-1 text-white/60">Play adjacent rank · 1 stamina/card</div>
                        {onSolveBuildStep && <div className="mt-2 text-left"><TableauSolveControls disabled={!staffed} onStep={(divine) => {
                          const sources = [...document.querySelectorAll<HTMLElement>('[data-hut-card]')].filter(node => node.dataset.hutStack === stack.id);
                          const destination = sources[0]?.closest('[data-hut-build]')?.querySelector<HTMLElement>('[data-hut-foundation]');
                          const result = onSolveBuildStep(stack.id, divine);
                          const source = sources.find(node => Number(node.dataset.hutCard) === result.cardRank);
                          if (result.status === 'played' && source && destination) {
                            const from = source.getBoundingClientRect(), to = destination.getBoundingClientRect();
                            const ghost = source.cloneNode(true) as HTMLElement;
                            ghost.dataset.cardFlight = 'hut';
                            ghost.style.cssText = 'position:fixed;z-index:30000;pointer-events:none;left:' + from.left + 'px;top:' + from.top + 'px;width:' + from.width + 'px;height:' + from.height + 'px;background:#201625;border:3px solid #ffe19a;color:#fff0d0';
                            document.body.appendChild(ghost);
                            const animation = ghost.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(' + (to.left - from.left) + 'px,' + (to.top - from.top) + 'px)' }], { duration: solverFlightDuration(450), easing: 'ease-in-out' });
                            animation.onfinish = () => ghost.remove();
                            animation.oncancel = () => ghost.remove();
                          }
                          return result;
                        }} onStart={onStartSolver} /></div>}
                      </>}
                    </div>;
                  })()}
                </div>
              );
            })()
          ))}
          {travel ? (
            <>
              {travel.path.slice(0, -1).map((point, index) => {
                const next = travel.path[index + 1];
                const dx = next.x - point.x;
                const dy = next.y - point.y;
                const arrow = dx && dy ? (dx > 0 ? (dy > 0 ? '↘' : '↗') : (dy > 0 ? '↙' : '↖')) : dx > 0 ? '→' : dx < 0 ? '←' : dy > 0 ? '↓' : '↑';
                return (
                  <div
                    key={`${travel.actorId}-path-${index}`}
                    aria-hidden="true"
                    className="absolute z-20 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#ffd166]/45 bg-[#17140b]/75 text-[0.9rem] font-black text-[#ffe7ad] shadow-[0_0_16px_rgba(255,209,102,0.2)]"
                    style={{ left: `calc(50% + ${point.x}px)`, top: `calc(50% + ${point.y}px)` }}
                  >
                    {arrow}
                  </div>
                );
              })}
            </>
          ) : null}
          {actors.map((actor) => {
            const actorPosition = travel?.actorId === actor.id && travelPosition ? travelPosition : getActorWorldPosition(actor);
            const actorLight = lightField.at(actorPosition);
            lightReadouts.push({ id: 'actor-' + actor.id, position: actorPosition, lift: 24, percent: actorLight.percent, level: actorLight.level });
            return (
            <div
              key={actor.id}
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onInspectActor?.(actor.id, event.currentTarget); } }}
              data-grid-reference={TABLE_GRID.reference(TABLE_GRID.atWorld(actorPosition))}
              data-board-piece="actor"
              data-camera-ignore="true"
              data-light-percent={actorLight.percent}
              data-light-level={actorLight.level}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                event.preventDefault();
                try {
                  event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                  // Some browsers cancel capture while a native drag starts.
                }
                pointerDragRef.current = {
                  actorId: actor.id,
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  moved: false,
                };
                setSelectedActorId(actor.id);
              }}
              onPointerMove={(event) => {
                const drag = pointerDragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) {
                  drag.moved = true;
                  setDraggingActorId(actor.id);
                  setDragPreview({ actorId: actor.id, x: event.clientX, y: event.clientY });
                  onActorDragStart?.(actor.id);
                }
                if (drag.moved) setDragPreview({ actorId: actor.id, x: event.clientX, y: event.clientY });
              }}
              onPointerUp={(event) => finishPointerTableDrag(event, actor.id)}
              onPointerCancel={() => {
                clearActorDragState();
              }}
              className={`absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none place-items-center rounded-full border-2 bg-[#17140b] text-[0.52rem] font-black uppercase tracking-[0.1em] text-[#ffe7ad] shadow-[0_0_24px_rgba(255,209,102,0.18)] active:cursor-grabbing ${selectedActorId === actor.id ? 'border-[#fff0b5] ring-2 ring-[#ffd166]/45' : 'border-[#ffd166]/75'} ${draggingActorId === actor.id ? 'opacity-45' : ''}`}
              style={{
                // Stored positions and grid coordinates share the same cell-center origin.
                boxShadow: tableObjectShadow(timeOfDay, actorPosition, 12, lightSources),
                left: `calc(50% + ${actorPosition.x}px)`,
                top: `calc(50% + ${actorPosition.y}px)`,
              }}
              aria-label={`${actor.label} actor token`}
            >
              <BoardObjectLabel text={actor.label} minFontSize={12} maxFontSize={16} />
            </div>
            );
          })}
        </div>
        <canvas
          ref={lightCanvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-40"
        />
        {showLightReadout ? (
          <div aria-hidden="true" data-light-readout="true" className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
            {lightReadouts.map((readout) => (
              <span
                key={readout.id}
                className="proto-light-readout"
                data-light-level={readout.level}
                style={{
                  left: `calc(50% + ${camera.cameraState.x + readout.position.x * camera.cameraState.scale}px)`,
                  top: `calc(50% + ${camera.cameraState.y + (readout.position.y - readout.lift) * camera.cameraState.scale - 6}px)`,
                }}
              >
                {readout.percent}%
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {dragPreview && !travel ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[100] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-[#ffe7ad]/80 bg-[#17140b]/55 text-[0.52rem] font-black uppercase tracking-[0.1em] text-[#ffe7ad]/80 shadow-[0_0_24px_rgba(255,209,102,0.22)]"
          data-actor-drag-ghost="true"
          style={{ left: dragPreview.x, top: dragPreview.y }}
        >
          {actors.find((actor) => actor.id === dragPreview.actorId)?.label ?? 'Hero'}
        </div>
      ) : null}
    </section>
  );
};
