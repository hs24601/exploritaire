import { UnexploredTile } from './UnexploredTile';
import { UnexploredGround } from './UnexploredGround';
import { useEnvironmentFootprints } from './useEnvironmentFootprints';
import { useActorOcclusion } from './useActorOcclusion';
import { fitSceneryFootprint } from '../sceneryFootprint';
import { TileTitle } from './TileTitle';
import { connectedTileLabelRegions, immutableTerrainRegions, immutableTileRegions } from '../tileLabels';
import { ConnectedTerrainArt } from './ConnectedTerrainArt';
import { TableActorSprite } from './TableActorSprite';
import { movementHeading, worldActorTransform } from '../actorOrientation';
import { RoadTileArt } from './RoadTileArt';
import { HeroDenRoof } from './HeroDenRoof';
import type { RoadTile } from '../roadTiles';
import { canSpendStamina } from '../staminaTesting';
import { TABLE_GRID, TRUE_CENTER, screenToWorld, type GridCell } from '../gridCoordinates';
import { BLOCKED_REGIONS, blockedSolids, isBlockedPoint } from '../worldBounds';
import { findGridPath, pathTime, pointAlongTimedPath, remainingPath, type TimedPoint } from '../gridPathfinding';
import { RouteLine } from './RouteLine';
import { FpsCounter } from './FpsCounter';
import { ActorBaseName } from './ActorBaseName';
import { Reveal } from './Reveal';
import { SilhouetteRelief } from './SilhouetteRelief';
import { biomeOpenState, biomeTravelCost, type BiomeFlag } from '../biomeFlags';
import { TableQuestCard, type PlacedQuestCard } from './TableQuestCard';
import { BoardObjectLabel } from './BoardObjectLabel';
import { BiomeTopDownArt } from './BiomeTopDownArt';
import { solverFlightDuration } from '../solverTiming';
import { actorLight, actorLightId, createTableLightField, getTableLighting, standeeLighting, tableObjectShadow, type LightLevel, type TableLight } from '../protoLighting';
import { drawTableLight, tableLightNeedsAnimation, type GlobalLightCache } from './tableLightCanvas';
import { WORLD_ITEMS, CRAFT_RECIPES, stackIngredients, type CraftStack, type WorldItemId } from '../protoCrafting';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TableauSolveControls, type SolveStepResult } from './TableauSolveControls';
import { rotateVector, useCameraControls } from '../../hooks/useCameraControls';
import { BiomeEdgeScenery } from './BiomeEdgeScenery';
import { layoutTableScenery } from '../biomeEdgeScenery';
import { AtmosphereInAir, LightShafts } from './TableAtmosphere';
import { VolumetricAtmosphere } from './VolumetricAtmosphere';
import { DustMotes } from './DustMotes';
import { subscribeVisualLight } from '../visualLightClock';
import type { AtmosphereCanopy } from '../volumetricAtmosphere';
import { detectFxQuality } from '../atmosphere';
import type { LabelBox } from '../biomeEdgeScenery';
import { BIOME_EDGE_SCENERY } from '../protoData';
import { Oversample, STANDEE_OVERSAMPLE, SPRITE_STANDEE_SIZE, SpriteStandeeArt, SpriteStandeeShadows } from './SpriteStandee';
import { TABLE_MAX_SCALE, TABLE_TILT_MS, tableCameraTilt, tableTiltFor, tableTiltTransform, tiltPanScale, unprojectTilt } from '../tableTilt';

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
  threat?: 'none' | 'low' | 'high';
  /** Water tiles are fished (the pond) rather than dealt as a tableau. */
  terrain?: 'woods' | 'water';
  tileType?: 'unexplored' | 'path' | 'hero-den' | 'impassable-mountain';
  road?: RoadTile;
  /** Dangerous tiles have a printed warning flat, embers and mist in immersion. */
  danger?: boolean;
  /** Pixel-art scenery that pops up from the back of the tile (pines for Small Woods). */
  sprite?: string;
  /** What the tile does to travel and to opening it (biomeFlags.ts). */
  flags?: BiomeFlag[];
  /** How explored it is, 0-1: its props are coloured in by this share and
   * the rest is silhouette. */
  exploration?: number;
};

export type ProtoWorldActor = {
  id: 'hero';
  label: string;
  location?: 'table' | 'foundation';
  biomeId?: string;
  hutId?: string;
  position: { x: number; y: number };
  /** Light the actor carries, 0–1; defaults to candlelight. */
  luminosity?: number;
  lightColor?: string;
  /** Cut-out art shown when the actor stands up in the tilted camera. */
  sprite?: string;
  /** Optional authored world heading in radians (+Y is zero), independent of camera. */
  heading?: number;
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
const TOP_DOWN_MAX_SCALE = CLASSICPLUS_ZOOM_REFERENCE_SCALE * 3.5;
/** Standees pop up from their bases once the camera has leaned halfway back. */
const STANDEE_POP_MS = 320;
/** Biome scenery pop-ups tower over a one-cell tile and the pieces on it. */
const BIOME_POPUP_SIZE = 72;
/** A pop-up cut below this to clear a label behind it is left out. */
const BIOME_POPUP_MIN_SIZE = 26;

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

/** The free grid cell touching a biome's footprint that sits closest to the
 * middle of its bottom edge, where an actor steps out of the tableau. */
export const getBiomeExitPoint = (tile: Pick<ProtoBiomeTile,'position'|'gridSize'>, occupied: readonly { x: number; y: number }[] = []) => {
  const area=getBiomeWorldFootprint(tile);
  const columns=Math.round(area.width/CLASSICPLUS_GRID_SIZE),rows=Math.round(area.height/CLASSICPLUS_GRID_SIZE);
  const taken=new Set(occupied.filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)).map(point=>TABLE_GRID.reference(TABLE_GRID.atWorld(point))));
  const ring:{x:number;y:number}[]=[];
  for(let column=-1;column<=columns;column+=1)for(let row=-1;row<=rows;row+=1){
    if(column>=0&&column<columns&&row>=0&&row<rows)continue;
    ring.push(TABLE_GRID.center(TABLE_GRID.offset(area.first,column,row)));
  }
  const goal={x:area.x,y:area.bottom+CLASSICPLUS_GRID_SIZE/2};
  ring.sort((a,b)=>Math.hypot(a.x-goal.x,a.y-goal.y)-Math.hypot(b.x-goal.x,b.y-goal.y));
  return ring.find(point=>!taken.has(TABLE_GRID.reference(TABLE_GRID.atWorld(point))))??ring[0];
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
  onActorExplore?: (actorId: string, from: { x: number; y: number }, to: { x: number; y: number }) => void;
  onDropActorToTable: (actorId: string, point: { x: number; y: number }, arrival?: { biomeId?: string; directBiome?: boolean; foundationIndex?: number }) => void;
  onMoveResourceStack?: (stackId: string, point: { x: number; y: number }, targetId?: string, actorId?: string) => void;
  onSplitResourceStack?: (stackId: string) => void;
  onPlayBuildCard?: (stackId: string, rank: number) => void;
  onSolveBuildStep?: (stackId: string, divine: boolean) => SolveStepResult;
  onStartSolver?: (divine: boolean) => void;
  actorStamina?: number;
  /** Party stamina: travelling into a biome costs some (its travelCost). */
  stamina?: number;
  onActorDragStart?: (actorId: string) => void;
  questCards?: PlacedQuestCard[];
  questTitles?: string[];
  questTexts?: string[];
  questRewardLabels?: string[];
  questClaims?: number;
  onMoveQuest?: (index:number, position:{x:number;y:number}, tilt:number)=>void;
  /** Camera tilt, shared with the tableau field; the map's Tilt button toggles it. */
  tilted?: boolean;
  onTiltedChange?: (tilted: boolean) => void;
  /** Staffed encounter to frame when engaging with the world. */
  focusBiomeId?: string | null;
  /** Extend this same CSS projection behind the adjacent exploration field. */
  extendTableau?: boolean;
  onRedeemQuest?: (index: number) => void;
  onInspectActor?: (actorId: string, anchor: HTMLElement) => void;
  onInspectTile?: (tileId: string, anchor: HTMLElement) => void;
};

/** The open expedition field. World tokens are intentionally lightweight DOM
 * nodes so they remain easy to replace with richer map entities later. */
export const ProtoMap = ({
  biomeTiles,
  actors,
  actorOrigins,
  resourceStacks,
  lightSources: placedLights = [],
  timeOfDay = 9,
  showLightReadout = false,
  onMoveLight,
  onSelectBiome,
  onDropActorToTable,
  onActorExplore,
  onMoveResourceStack,
  onSplitResourceStack,
  onPlayBuildCard,
  onSolveBuildStep,
  onStartSolver,
  actorStamina = 0,
  stamina = Infinity,
  onActorDragStart,
  onInspectActor,
  onInspectTile,
  questCards = [],
  questTitles = [],
  questTexts = [],
  questRewardLabels = [],
  questClaims = 0,
  onRedeemQuest,
  onMoveQuest,
  tilted = false,
  focusBiomeId = null,
  extendTableau = false,
  onTiltedChange,
}: ProtoMapProps) => {
  // Pop-up-book camera: the table tilts back and pieces stand up as cardboard standees.
  // Sprites that failed to load fall back to the cardboard token.
  const [failedSprites, setFailedSprites] = useState<string[]>([]);
  // Where each biome tile's label text sits, from the tile's centre, so the
  // tilted camera's edge scenery can keep clear of it.
  // Ambiance tier for the tilted camera (atmosphere.ts): fixed for the session.
  const [fxQuality] = useState(detectFxQuality);
  const [useVolume] = useState(() => new URLSearchParams(window.location.search).get('atmosphere') !== 'off');
  const [biomeLabelBoxes, setBiomeLabelBoxes] = useState<Record<string, LabelBox>>({});
  // The note shown when a tile that won't open is tapped (e.g. unexplored).
  const reportBiomeLabel = useCallback((tileId: string, tile: { width: number; height: number }, box: { left: number; top: number; width: number; height: number; pivot: { x: number; y: number } }) => {
    const next = { left: box.left - tile.width / 2, top: box.top - tile.height / 2, right: box.left + box.width - tile.width / 2, bottom: box.top + box.height - tile.height / 2,
      pivot: { x: box.pivot.x - tile.width / 2, y: box.pivot.y - tile.height / 2 } };
    setBiomeLabelBoxes((boxes) => {
      const known = boxes[tileId];
      if (known && (['left', 'top', 'right', 'bottom'] as const).every((side) => Math.abs(known[side] - next[side]) < 0.25)
        && Math.abs((known.pivot?.x ?? 0) - next.pivot.x) < 0.25 && Math.abs((known.pivot?.y ?? 0) - next.pivot.y) < 0.25) return boxes;
      return { ...boxes, [tileId]: next };
    });
  }, []);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [viewportWidth, setViewportWidth] = useState(1280);
  // The camera eases between Flat and Tilt (CSS transitions on the table and
  // its light). The table stays oversized ("staged") until it has settled
  // flat, and pieces swap between standees and printed tokens halfway through,
  // popping up as the table leans back and folding down as it settles.
  const [shownTilted, setShownTilted] = useState(tilted);
  const [leaving, setLeaving] = useState(false);
  const [upright, setUpright] = useState(tilted);
  const [airReady, setAirReady] = useState(tilted);
  const [standeeMotion, setStandeeMotion] = useState<'rise' | 'fold' | null>(null);
  if (shownTilted !== tilted) {
    setShownTilted(tilted);
    setLeaving(!tilted);
    setStandeeMotion(tilted ? null : 'fold');
    setAirReady(false);
  }
  const staged = tilted || leaving;
  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const half = reducedMotion ? 0 : TABLE_TILT_MS / 2;
    const timers = tilted
      ? [window.setTimeout(() => { setUpright(true); setStandeeMotion(reducedMotion ? null : 'rise'); }, half),
        window.setTimeout(() => setAirReady(true), reducedMotion ? 0 : TABLE_TILT_MS),
        window.setTimeout(() => setStandeeMotion(null), half + STANDEE_POP_MS)]
      : [window.setTimeout(() => { setUpright(false); setStandeeMotion(null); }, half),
        window.setTimeout(() => setLeaving(false), reducedMotion ? 0 : TABLE_TILT_MS + 40)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [tilted]);
  const atmosphereAreas = biomeTiles.filter((tile) => tile.unlocked !== false && !tile.road && !tile.tileType && !tile.flags?.includes('unexplored')).map((tile) => ({ id: tile.id, terrain: tile.terrain === 'water' ? 'water' as const : 'woods' as const, danger: tile.danger, ...getBiomeWorldFootprint(tile) }));
  // A press on a square an actor stands on never pans (see grabActorOnSquare).
  const actorSquareRef = useRef<(clientX: number, clientY: number) => boolean>(() => false);
  const canStartPanAt = useCallback((clientX: number, clientY: number) => !actorSquareRef.current(clientX, clientY), []);
  const camera = useCameraControls({
    canStartPanAt,
    panScale: live => tiltPanScale(tilted ? tableCameraTilt(viewportHeight, live.scale) : null),
    minScale: 0.65,
    maxScale: tilted ? TABLE_MAX_SCALE : TOP_DOWN_MAX_SCALE,
    zoomSensitivity: 0.0048,
    centeredZoom: true,
    initialState: { x: 0, y: 0, scale: CLASSICPLUS_ZOOM_REFERENCE_SCALE },
  });
  const getCameraTilt = useCallback((live: { scale: number }) => tableCameraTilt(viewportHeight, live.scale), [viewportHeight]);
  useEffect(() => {
    const viewport = camera.containerRef.current;
    const map = viewport?.closest<HTMLElement>('.proto-map');
    const layout = map?.closest<HTMLElement>('.proto-main-layout');
    const field = layout?.querySelector<HTMLElement>('.proto-tableau-field');
    if (!viewport || !map || !layout || !field) return;
    // Expand the clipping window, never the camera's measured viewport or pivot.
    // The existing world, floor and standees keep a single continuous projection.
    const update = () => {
      const view = viewport.getBoundingClientRect(), target = field.getBoundingClientRect();
      const active = extendTableau && view.width > 0 && target.width > 0 && window.innerWidth >= 1000;
      map.dataset.tableauExtension = String(active);
      field.dataset.cssCameraBackground = String(active);
      viewport.style.clipPath = active ? `inset(${Math.min(0,target.top-view.top)}px ${Math.min(0,view.right-target.right)}px ${Math.min(0,view.bottom-target.bottom)}px ${Math.min(0,target.left-view.left)}px)` : '';
    };
    const observer = new ResizeObserver(update);
    [viewport,layout,field].forEach(node => observer.observe(node));
    update();
    return () => { observer.disconnect(); delete map.dataset.tableauExtension; delete field.dataset.cssCameraBackground; viewport.style.clipPath = ''; };
  }, [extendTableau, camera.containerRef]);
  const tabletopCamera = useRef<ReturnType<typeof camera.getLiveCamera> | null>(null);
  const focusTile = biomeTiles.find(tile => tile.id === focusBiomeId);
  const focusX = focusTile ? getBiomeWorldFootprint(focusTile).x : 0;
  const focusY = focusTile ? getBiomeWorldFootprint(focusTile).y : 0;
  useEffect(() => {
    const from = camera.getLiveCamera();
    let target: typeof from;
    if (focusBiomeId) {
      tabletopCamera.current ??= { ...from };
      const scale = Math.max(from.scale, 3.1);
      target = { ...from, x: -focusX * scale, y: -focusY * scale, scale };
    } else {
      if (!tabletopCamera.current) return;
      target = tabletopCamera.current;
      tabletopCamera.current = null;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.setCameraState(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      const ease = t * t * (3 - 2 * t);
      camera.setCameraState({ ...target,
        x: from.x + (target.x - from.x) * ease,
        y: from.y + (target.y - from.y) * ease,
        scale: from.scale + (target.scale - from.scale) * ease,
      });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Direct camera input takes control immediately, including touch gestures.
    const cancel = () => cancelAnimationFrame(frame);
    const viewport = camera.containerRef.current;
    viewport?.addEventListener('pointerdown', cancel);
    viewport?.addEventListener('wheel', cancel);
    window.addEventListener('keydown', cancel);
    return () => {
      cancel();
      viewport?.removeEventListener('pointerdown', cancel);
      viewport?.removeEventListener('wheel', cancel);
      window.removeEventListener('keydown', cancel);
    };
  }, [focusBiomeId, focusX, focusY, camera.getLiveCamera, camera.setCameraState]);
  const tilt = tilted ? getCameraTilt(camera.cameraState) : null;
  const tiltAngle = tilt?.angle ?? 0;
  const stageTransform = staged ? tableTiltTransform(tilt ?? tableTiltFor(viewportHeight, 0)) : undefined;
  // Zoom drives the whole rig on the same frame as the world transform. Keep
  // CSS easing for mode switches only; it must not lag wheel or pinch input.
  useEffect(() => {
    if (!tilted || !airReady) return;
    const drawRig = (live: { scale: number }) => {
      const rig = getCameraTilt(live);
      camera.containerRef.current?.querySelectorAll<HTMLElement>('.proto-table-stage, .proto-table-light, .proto-table-title-layer, .proto-table-actor-layer').forEach(el => {
        el.style.transform = tableTiltTransform(rig);
        el.style.setProperty('--table-tilt', `${rig.angle}deg`);
      });
    };
    drawRig(camera.getLiveCamera());
    return camera.onCameraFrame(drawRig);
  }, [tilted, airReady, getCameraTilt, camera.getLiveCamera, camera.onCameraFrame]);
  // Returning to top-down preserves framing up to its 350% cap.
  useEffect(() => {
    if (!tilted && camera.getLiveCamera().scale > TOP_DOWN_MAX_SCALE) camera.setCameraState(previous => {
      const ratio = TOP_DOWN_MAX_SCALE / previous.scale;
      return { ...previous, x: previous.x * ratio, y: previous.y * ratio, scale: TOP_DOWN_MAX_SCALE };
    });
  }, [tilted]);
  // Camera spin, degrees clockwise on screen (useCameraControls). React state
  // catches up after a turn; pieces facing the camera turn
  // against it, and scenery that sits behind a tile follows the side facing it.
  useEnvironmentFootprints(camera.containerRef, camera.onCameraFrame, upright, camera.getLiveCamera);
  const actorGhostWorld = useRef<HTMLDivElement>(null);
  const actorHeadings = useRef(new Map<string, { x: number; y: number; heading: number }>());
  useActorOcclusion(camera.containerRef, actorGhostWorld, upright, camera.getLiveCamera, getCameraTilt);
  const yaw = camera.cameraState.yaw ?? 0;
  const immutableRegions = useMemo(() => immutableTileRegions(biomeTiles), [biomeTiles]);
  const terrainRegions = useMemo(() => immutableTerrainRegions(biomeTiles), [biomeTiles]);
  const labelRegions = useMemo(() => connectedTileLabelRegions(biomeTiles), [biomeTiles]);
  const terrainOwners = new Map(immutableRegions.flatMap(region => region.tiles.map(tile => [tile.id, region] as const)));
  const sharedLabelTiles = new Set(labelRegions.flatMap(region => region.tiles.map(tile => tile.id)));
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  const globalLightCache = useRef<GlobalLightCache | null>(null);
  const lightReadouts: { id: string; position: { x: number; y: number }; lift: number; percent: number; level: LightLevel }[] = [];
  const [hoverCell,setHoverCell] = useState<GridCell>(TRUE_CENTER.cell);
  const [routeBlocked, setRouteBlocked] = useState(false);
  const [draggingActorId, setDraggingActorId] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ actorId: string; x: number; y: number } | null>(null);
  const [travel, setTravel] = useState<{
    actorId: string;
    label: string;
    path: TimedPoint[];
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

  useEffect(() => {
    const viewport = camera.containerRef.current;
    if (!viewport) return undefined;
    const observer = new ResizeObserver(() => { setViewportHeight(viewport.clientHeight || 720); setViewportWidth(viewport.clientWidth || 1280); });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  /** Eases the spin back to 0° the short way round. */
  const unspin = () => camera.spinTo(Math.round((camera.getLiveCamera().yaw ?? 0) / 360) * 360);
  const resetProtoCamera = () => {
    camera.setCameraState((previous) => ({ ...previous, x: 0, y: 0, scale: CLASSICPLUS_ZOOM_REFERENCE_SCALE }));
    unspin();
  };

  // Keyboard camera: Q and E turn it 45° (eased); W, A, S and D glide it
  // relative to the view while held, so W always heads for the far side of
  // the screen at any spin. Never while typing or inside a dialog.
  const { spinStep, panBy, syncCamera } = camera;
  useEffect(() => {
    const held = new Set<string>();
    let frame = 0;
    let last = 0;
    const PAN_SPEED = 560; // screen px per second
    const typing = (target: EventTarget | null) => target instanceof Element
      && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], dialog'));
    const glide = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const x = (held.has('a') ? 1 : 0) - (held.has('d') ? 1 : 0);
      const y = (held.has('w') ? 1 : 0) - (held.has('s') ? 1 : 0);
      const length = Math.hypot(x, y);
      if (length) panBy((x / length) * PAN_SPEED * dt, (y / length) * PAN_SPEED * dt);
      frame = held.size ? requestAnimationFrame(glide) : 0;
      if (!frame) syncCamera();
    };
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'q' || key === 'e') {
        if (!event.repeat) spinStep(key === 'q' ? -45 : 45);
        event.preventDefault();
        return;
      }
      if (!['w', 'a', 's', 'd'].includes(key)) return;
      event.preventDefault();
      held.add(key);
      if (!frame) { last = performance.now(); frame = requestAnimationFrame(glide); }
    };
    const up = (event: KeyboardEvent) => held.delete(event.key.toLowerCase());
    const release = () => held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      cancelAnimationFrame(frame);
    };
  }, [spinStep, panBy, syncCamera, tilted, onTiltedChange]);

  // While a piece is dragged, the biome under the pointer that would accept it lights up.
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  useEffect(() => {
    if (!dragPreview) { setDropTargetId(null); return; }
    const tile = biomeAtClientPoint(dragPreview.x, dragPreview.y);
    setDropTargetId(tile && tile.unlocked !== false ? tile.id : null);
  }, [dragPreview, biomeTiles]);

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

  /** The fastest legal route for an actor to `target` on the table grid
   * (gridPathfinding.ts): open table costs 1 per cell; a biome costs what its
   * flags say (unexplored can't be crossed, rough is slow); locked biomes,
   * huts and the impassable terrain can't be crossed. The start and the
   * destination are always allowed. Null when there's no route. */
  const planRoute = (actorId: string, target: { x: number; y: number }, arrival: { biomeId?: string } = {}) => {
    const origin = actorOrigins.find((actor) => actor.id === actorId);
    if (!origin) return null;
    const originPoint = finiteWorldPoint(origin.location === 'foundation' && origin.biomeId
      ? resolveBiomeActorCell(origin.biomeId) ?? origin.position
      : origin.position);
    const buildings = resourceStacks.filter(stack => stack.resource === 'provisions_hut' || stack.build && CRAFT_RECIPES.find(recipe => recipe.id === stack.build?.recipeId)?.output === 'provisions_hut');
    const destinationBuilding = buildings.find(stack => Math.hypot(stack.position.x-target.x,stack.position.y-target.y)<52);
    // Only the destination snaps (to its cell, a biome's entry cell or a hut).
    const snappedTarget = arrival.biomeId ? finiteWorldPoint(target) : destinationBuilding ? destinationBuilding.position : TABLE_GRID.snap(finiteWorldPoint(target));
    // The destination is always allowed to be stood on, but never terrain.
    if (isBlockedPoint(snappedTarget) || biomeTiles.some(tile => tile.tileType === 'impassable-mountain' && TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position)) === TABLE_GRID.reference(TABLE_GRID.atWorld(snappedTarget)))) return null;
    const cellCosts = new Map<string, number>();
    const mark = (column: number, row: number, cost: number) => {
      const key = `${column},${row}`;
      cellCosts.set(key, Math.max(cellCosts.get(key) ?? 1, cost));
    };
    biomeTiles.forEach((tile) => {
      const area = getBiomeWorldFootprint(tile);
      const cost = tile.unlocked === false || tile.tileType === 'impassable-mountain' ? Infinity : tile.road || tile.tileType ? 1 : biomeTravelCost(tile.flags);
      for (let column = 0; column < Math.round(area.width / CLASSICPLUS_GRID_SIZE); column += 1)
        for (let row = 0; row < Math.round(area.height / CLASSICPLUS_GRID_SIZE); row += 1)
          mark(area.first.column + column, area.first.row + row, cost);
    });
    buildings.forEach((stack) => { const cell = TABLE_GRID.atWorld(stack.position); mark(cell.column, cell.row, Infinity); });
    const cost = (column: number, row: number) =>
      isBlockedPoint({ x: column * CLASSICPLUS_GRID_SIZE, y: row * CLASSICPLUS_GRID_SIZE }) ? Infinity : cellCosts.get(`${column},${row}`) ?? 1;
    const path = findGridPath(originPoint, snappedTarget, cost, CLASSICPLUS_GRID_SIZE);
    if (!path || path.length === 0 || path.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
    return { path, target: snappedTarget };
  };

  const startActorTravel = (
    actorId: string,
    target: { x: number; y: number },
    arrival: { biomeId?: string; directBiome?: boolean; foundationIndex?: number } = {},
  ) => {
    const origin = actorOrigins.find((actor) => actor.id === actorId);
    if (!origin || travelingActorRef.current === actorId) return;
    const route = planRoute(actorId, target, arrival);
    clearActorDragState();
    if (!route) { setRouteBlocked(true); return; }
    setRouteBlocked(false);
    travelingActorRef.current = actorId;
    setTravel({ actorId, label: origin.label, path: route.path, progress: 0, arrival });
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
    // Slower ground takes longer: the pace of each stretch weighs its length.
    const duration = Math.max(300, pathTime(travel.path) / 320 * 1000);
    const startedAt = performance.now();
    let frame = 0;
    let previousProgress = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const current = pointAlongTimedPath(travel.path, progress);
      // Follow every intervening route leg when a slow frame skips a corner;
      // a straight chord would discover tiles the actor never approached.
      const remaining = remainingPath(travel.path, previousProgress);
      let elapsed = pathTime(travel.path) * (progress - previousProgress);
      for (let i = 1; i < remaining.length; i++) {
        const cost = Math.hypot(remaining[i].x - remaining[i - 1].x, remaining[i].y - remaining[i - 1].y) * remaining[i].pace;
        if (cost > elapsed) {
          onActorExplore?.(travel.actorId, remaining[i - 1], current);
          break;
        }
        onActorExplore?.(travel.actorId, remaining[i - 1], remaining[i]);
        elapsed -= cost;
      }
      previousProgress = progress;
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
    // The live camera, so a press lands right even mid-pan or mid-spin.
    const live = camera.getLiveCamera();
    const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
    const screen = { x: clientX - centerX, y: clientY - centerY };
    // Back off the tilt onto the table plane, then undo the spin about the centre.
    const plane = rotateVector(tilted ? unprojectTilt(screen, getCameraTilt(live)) : screen, -(live.yaw ?? 0));
    return screenToWorld({x:centerX+plane.x,y:centerY+plane.y},rect,live);
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

  // Placed lights plus the light each actor carries. Keyed by content so the
  // canvas effect only reruns when a light actually changes.
  // A travelling actor's light moves with it along its path, frame by frame.
  const travelPosition = travel ? pointAlongTimedPath(travel.path, travel.progress) : null;
  const actorIsSleeping = (actor: ProtoWorldActor, position: { x: number; y: number }) => actor.id === 'hero'
    && travel?.actorId !== actor.id && biomeTiles.some(tile => tile.tileType === 'hero-den'
      && TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position)) === TABLE_GRID.reference(TABLE_GRID.atWorld(position)));
  const actorArt = (actor: ProtoWorldActor, position: { x: number; y: number }) => actorIsSleeping(actor, position)
    ? `${import.meta.env.BASE_URL}assets/actors/hero-sleeping.png` : actor.sprite;
  const actorLights = actors.flatMap(actor => actorLight(actor.id, travel?.actorId === actor.id && travelPosition ? travelPosition : getActorWorldPosition(actor), actor.luminosity, actor.lightColor) ?? []);
  const lightKey = JSON.stringify([placedLights, actorLights]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lightSources = useMemo(() => [...placedLights, ...actorLights], [lightKey]);
  // Steady light the game world can read per object; rendering adds flicker on top.
  const lightField = createTableLightField(timeOfDay, lightSources, BLOCKED_REGIONS);

  useEffect(() => {
    const canvas = lightCanvasRef.current;
    const viewport = camera.containerRef.current;
    if (!upright || !canvas || !viewport) return undefined;
    globalLightCache.current ??= { canvas:document.createElement('canvas'),key:'' };
    const frame = getTableLighting(timeOfDay);
    const sources = lightSources.map((source) => ({
      ...source,
      position: finiteWorldPoint(source.position),
      radius: Math.max(0.5, finiteCoordinate(source.radius, 2.7)),
    }));
    const surface = canvas.parentElement ?? viewport;
    // The oversized wash follows the camera without repainting during a spin.
    // Cache layout dimensions so live camera frames never force layout here.
    let drawn = camera.getLiveCamera();
    const paintedYaw = drawn.yaw ?? 0;
    let surfaceWidth = surface.offsetWidth, surfaceHeight = surface.offsetHeight;
    const follow = (live: { x: number; y: number; scale: number; yaw?: number }) => {
      const k = live.scale / drawn.scale;
      // The pan since the redraw, in the spun frame, turned onto the screen.
      const shift = rotateVector({ x: live.x - k * drawn.x, y: live.y - k * drawn.y }, live.yaw ?? 0);
      canvas.style.transform = `translate(${shift.x}px, ${shift.y}px) rotate(${(live.yaw ?? 0) - paintedYaw}deg) scale(${k})`;
    };
    const draw = (timeMs: number) => {
      // Layout size, not the projected box: a tilted table plane is oversized
      // around the same center. The wash is all soft gradients, so it paints at
      // a fraction of a CSS pixel and the browser scales it up; full-resolution
      // flicker redraws of the oversized tilted plane stalled input for seconds.
      const dpr = staged ? 0.25 : 0.5;
      const width = surfaceWidth;
      const height = surfaceHeight;
      // Mobile panel navigation hides the map while opening a path tableau.
      // Wait for its next visible resize instead of caching an empty canvas.
      if (!width || !height) return;
      const rasterWidth = Math.max(1, Math.round(width * dpr));
      const rasterHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== rasterWidth || canvas.height !== rasterHeight) {
        canvas.width = rasterWidth;
        canvas.height = rasterHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawn = { ...camera.getLiveCamera(), yaw: paintedYaw };
      drawTableLight(context, { width, height }, drawn, frame, sources, timeMs, BLOCKED_REGIONS,globalLightCache.current!);
      follow(camera.getLiveCamera());
    };
    draw(performance.now());
    const unfollow = camera.onCameraFrame(follow);
    const observer = new ResizeObserver(() => { surfaceWidth = surface.offsetWidth; surfaceHeight = surface.offsetHeight; draw(performance.now()); });
    observer.observe(viewport);
    // Flicker redraws at ~24 fps after dark; reduced-motion users get a steady light.
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let stopAnimation: (() => void) | undefined;
    let previousFlickerYaw = camera.getLiveCamera().yaw ?? 0;
    if (!reducedMotion && tableLightNeedsAnimation(frame, sources)) {
      stopAnimation = subscribeVisualLight((now) => {
        const liveYaw = camera.getLiveCamera().yaw ?? 0;
        const moving = Math.abs(liveYaw - previousFlickerYaw) > 0.01;
        previousFlickerYaw = liveYaw;
        if (!document.hidden && !moving) draw(now);
      });
    }
    return () => {
      observer.disconnect();
      unfollow();
      stopAnimation?.();
    };
  }, [lightSources, timeOfDay, staged, upright, camera.cameraState.x, camera.cameraState.y, camera.cameraState.scale, camera.getLiveCamera, camera.onCameraFrame]);

  const biomeAtClientPoint = (clientX: number, clientY: number) => {
    const cell = TABLE_GRID.atWorld(worldPointFromClient(clientX, clientY));
    return biomeTiles.find(tile => {
      const area = getBiomeWorldFootprint(tile);
      return cell.column >= area.first.column && cell.column < area.first.column + tile.gridSize.columns
        && cell.row >= area.first.row && cell.row < area.first.row + tile.gridSize.rows;
    });
  };

  const resolveDropDestination = (actorId: string, clientX: number, clientY: number) => {
    // Raised art can cover several neighbouring cells. Actor placement is
    // decided on the table plane, never by the scenery's screen hit box.
    const destinationTile = biomeAtClientPoint(clientX, clientY);
    if (destinationTile && (destinationTile.road || destinationTile.tileType)) return { point: TABLE_GRID.snap(worldPointFromClient(clientX, clientY)), arrival: { biomeId: destinationTile.id } };
    const biomeId = destinationTile?.id;
    if (biomeId) {
      return {
        point: resolveBiomeActorCell(biomeId) ?? resolveBiomeAdjacentCell(actorId, biomeId) ?? worldPointFromClient(clientX, clientY),
        arrival: { biomeId },
      };
    }
    return { point: worldPointFromClient(clientX, clientY), arrival: {} };
  };

  // While an actor is dragged over the table: where it would land and the
  // route it would take there. A biome target lights the tile itself (the
  // drop cue); any other cell gets its own cue, red when unreachable.
  const dragPlan = (() => {
    if (!dragPreview || travel) return null;
    const over = document.elementFromPoint(dragPreview.x, dragPreview.y);
    if (!over?.closest('.proto-map-viewport') || over.closest('[aria-label="Foundation"]')) return null;
    const destination = resolveDropDestination(dragPreview.actorId, dragPreview.x, dragPreview.y);
    const route = planRoute(dragPreview.actorId, destination.point, destination.arrival);
    const biome = destination.arrival.biomeId ? biomeTiles.find((tile) => tile.id === destination.arrival.biomeId) : null;
    return { route, biome, cell: biome ? null : TABLE_GRID.atWorld(route?.target ?? destination.point) };
  })();
  // The route on show: the drag's preview, or what's left of the one being walked.
  const routeShown = (() => {
    if (travel) {
      const path = remainingPath(travel.path, travel.progress);
      return path.length > 1 ? { path, unaffordable: false, label: null as string | null } : null;
    }
    if (!dragPlan?.route) return null;
    const cost = dragPlan.biome?.travelCost ?? 0;
    const unaffordable = !canSpendStamina(stamina, cost);
    const cells = Math.max(1, Math.round(pathTime(dragPlan.route.path) / CLASSICPLUS_GRID_SIZE));
    return { path: dragPlan.route.path, unaffordable,
      label: unaffordable ? 'Not enough stamina' : `${cells} ${cells === 1 ? 'cell' : 'cells'}${cost ? ` · ${cost} STA` : ''}` };
  })();
  const compositeTileTitle = (tile: ProtoBiomeTile) => upright && Boolean(tile.sprite || (!tile.road && !tile.tileType));
  // Tile labels as they lie on the table (turned upright for the camera), so
  // the route passes under them.
  const labelQuads = biomeTiles.flatMap((tile) => {
    const box = biomeLabelBoxes[tile.id];
    if (!box) return [];
    const centre = getBiomeWorldFootprint(tile), pivot = box.pivot ?? { x: 0, y: 0 };
    return [[[box.left - 2, box.top - 2], [box.right + 2, box.top - 2], [box.right + 2, box.bottom + 2], [box.left - 2, box.bottom + 2]].map(([x, y]) => {
      const turned = rotateVector({ x: x - pivot.x, y: y - pivot.y }, -yaw);
      return { x: centre.x + pivot.x + turned.x, y: centre.y + pivot.y + turned.y };
    })];
  });

  // Tilted, every tile's edge scenery is laid out together, so neighbouring
  // tiles share one run along their seam (biomeEdgeScenery.ts).
  const sceneryTiles = biomeTiles.filter((tile) => tile.unlocked !== false && !tile.road && !tile.tileType && !tile.flags?.includes('unexplored')).map((tile) => {
    const area = getBiomeWorldFootprint(tile);
    return { id: tile.id, centre: { x: area.x, y: area.y }, size: { width: area.width, height: area.height }, terrain: tile.terrain ?? 'woods',
      // Author placement in a fixed world frame; live label fitting must not
      // move or resize physical scenery when the camera turns.
      scenery: BIOME_EDGE_SCENERY[tile.terrain === 'water' ? 'water' : 'woods'],
      label: { left: -area.width * .25, right: area.width * .25, top: -8, bottom: 8 } };
  });
  const tableScenery = upright ? layoutTableScenery(sceneryTiles, 60, 0) : {};
  // One placement for both visible pop-ups and the atmosphere's canopy atlas.
  const biomePopups = new Map(biomeTiles.map(tile => {
    const area = getBiomeWorldFootprint(tile);
    const occupied = actors.some(actor => {
      const position = travel?.actorId === actor.id && travelPosition ? travelPosition : getActorWorldPosition(actor);
      return TABLE_GRID.reference(TABLE_GRID.atWorld(position)) === TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position));
    });
    // The empty cave meets the front tile edge beside the mountain range.
    // Retain the sleeping hollow's depth while an actor occupies it. The shared
    // footprint fitter keeps the complete foot line just inside the tile.
    const back = { x: 0, y: area.height * (tile.tileType === 'hero-den' ? occupied ? .24 : .5 : -.37) };
    const position = { x:area.x+back.x, y:area.y+back.y };
    const size = tile.tileType === 'hero-den' ? 46 : BIOME_POPUP_SIZE;
    const owner = terrainOwners.get(tile.id) ?? area;
    const fitted = fitSceneryFootprint(position, size, size, owner, 0);
    return [tile.id,{ position: fitted.position, size: fitted.width, requestedSize: size, requestedPosition: position, owner }] as const;
  }));
  const atmosphereCanopies: AtmosphereCanopy[] = biomeTiles.filter(tile => tile.unlocked !== false && !tile.flags?.includes('unexplored')).flatMap(tile => {
    const popup = biomePopups.get(tile.id)!;
    const area = getBiomeWorldFootprint(tile);
    const canopies: AtmosphereCanopy[] = (tableScenery[tile.id] ?? []).map(prop => {
      const fitted = fitSceneryFootprint({x:area.x+prop.x,y:area.y+prop.y},prop.width,prop.height,area,0);
      return {id:`${tile.id}-${prop.id}`,...fitted.position,width:fitted.width,height:fitted.height,sprite:prop.src,flip:prop.flip,worldHeading:0};
    });
    if (tile.sprite && !failedSprites.includes(tile.sprite) && popup.size >= BIOME_POPUP_MIN_SIZE) canopies.push({
      id:tile.id,...popup.position,width:popup.size,height:popup.size,sprite:tile.sprite,trimmed:true,worldHeading:0,
    });
    return canopies;
  });
  // Keep faces crisp without treating every small figure as a tree canopy.
  actors.forEach(actor=>{
    if(!actor.sprite||failedSprites.includes(actor.sprite))return;
    const position=travel?.actorId===actor.id&&travelPosition?travelPosition:getActorWorldPosition(actor);
    atmosphereCanopies.push({id:`figure-${actor.id}`,...position,width:SPRITE_STANDEE_SIZE,height:SPRITE_STANDEE_SIZE,sprite:actor.sprite,trimmed:true,castsShadow:false});
  });

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
      // A tap on the square's grab area opens the card from the actor itself.
      const grip = event.currentTarget.dataset.cellGrip ? event.currentTarget.nextElementSibling : null;
      onInspectActor?.(actorId, grip instanceof HTMLElement ? grip : event.currentTarget);
        }
    clearActorDragState();
  };


  // Tilted, pieces stand upright on their table point like cardboard standees.
  const standee = (size?: { width: number; height: number }, oversample = 1): React.CSSProperties | null => upright ? {
    // Rotate about the foot first, then move the foot onto the table point, so
    // the base stays planted at any zoom. An oversampled piece is laid out
    // larger and scaled back down about its foot (see STANDEE_OVERSAMPLE).
    // Turned against a spun camera first, so it faces the camera.
    transform: `translate(-50%,-100%) rotateZ(calc(-1 * var(--camera-yaw, 0deg))) rotateX(calc(-1 * var(--table-tilt)))${oversample === 1 ? '' : ` scale(${1 / oversample})`} scaleY(var(--standee-rise, 1)) scale(var(--scenery-fit-scale, 1))`,
    transformOrigin: '50% 100%',
    animation: standeeMotion === 'rise' ? `proto-standee-pop ${STANDEE_POP_MS}ms ease-out both`
      : standeeMotion === 'fold' ? `proto-standee-fold ${TABLE_TILT_MS / 2}ms ease-in forwards` : undefined,
    // A die-cut cardboard edge, shaded toward its base.
    ...(size ? { width: size.width, height: size.height, borderRadius: `${size.width / 2}px ${size.width / 2}px 6px 6px`, border: '1.5px solid #efe4cc', boxShadow: 'inset 0 -12px 16px #0007' } : {}),
  } : null;
  // Trial: tile scenery is a fixed vertical world plane, like a placed cut-out.
  const sceneryStandee = { ...standee(undefined, STANDEE_OVERSAMPLE),
    transform: `${worldActorTransform(0, true, STANDEE_OVERSAMPLE)} scaleY(var(--standee-rise, 1)) scale(var(--scenery-fit-scale, 1))` };
  // Flat round tokens turn against a spun camera so their faces stay upright.
  // They're placed by Tailwind's centring transform, which takes --tw-rotate.
  const faceCameraFlat = { ['--tw-rotate' as string]: 'calc(-1 * var(--camera-yaw, 0deg))' } as React.CSSProperties;
  // Sprite standees: a pixel-art cut-out lit by the table's lights, casting its
  // own silhouette across the table away from each one.
  const spriteStandee = (sprite: string | undefined, position: { x: number; y: number }, { size = SPRITE_STANDEE_SIZE, owner = 'actor' }: { size?: number; owner?: string } = {}) => {
    if (!upright || !sprite || failedSprites.includes(sprite)) return null;
    const facingYaw = owner === 'biome' ? 0 : yaw;
    const lit = standeeLighting(timeOfDay, position, size, lightSources, facingYaw);
    const onError = () => setFailedSprites((list) => list.includes(sprite) ? list : [...list, sprite]);
    return {
      shadows: <SpriteStandeeShadows sprite={sprite} position={position} shadows={lit.shadows} size={size} owner={owner} yaw={facingYaw} />,
      silhouette: <SilhouetteRelief sprite={sprite} width={size} height={size} lighting={lit} hours={timeOfDay} position={position} yaw={facingYaw}
        fallback={<SpriteStandeeArt sprite={sprite} lighting={lit} size={size} />} />,
      art: <SpriteStandeeArt sprite={sprite} lighting={lit} onError={onError} size={size} />,
    };
  };
  // Pixel-art standees stay sharp as the camera zooms; flat pieces need none.
  const oversample = upright ? STANDEE_OVERSAMPLE : 1;
  /** Picks up an actor; moves and the release then go to `holder`. */
  const grabActor = (actorId: string, event: React.PointerEvent, holder: Element) => {
    // Other mouse buttons spin the camera, even over a piece.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    try {
      holder.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers cancel capture while a native drag starts.
    }
    pointerDragRef.current = {
      actorId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setSelectedActorId(actorId);
  };
  /** The square under the pointer decides what a grab takes: when it holds an
   * actor, the actor wins over scenery or another piece standing in front of
   * it in the tilted view (pressing a piece's own controls still works). */
  const actorOnSquare = (clientX: number, clientY: number) => {
    const cell = TABLE_GRID.atWorld(worldPointFromClient(clientX, clientY));
    return actors.find((entry) => {
      const at = TABLE_GRID.atWorld(getActorWorldPosition(entry));
      return at.column === cell.column && at.row === cell.row;
    });
  };
  actorSquareRef.current = (clientX, clientY) => Boolean(actorOnSquare(clientX, clientY));
  const grabActorOnSquare = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('.proto-map-world') || target.closest('[data-board-piece="actor"], [data-cell-grip^="actor-"], button:not([data-biome-id]), .proto-standee-sign, [data-hut-build]')) return;
    const actor = actorOnSquare(event.clientX, event.clientY);
    const holder = actor && event.currentTarget.querySelector(`[data-cell-grip="actor-${actor.id}"]`);
    if (actor && holder) grabActor(actor.id, event, holder);
  };
  /** An invisible grab area over a piece's whole grid square, lying on the
   * table, so a grab on an occupied square takes the piece instead of panning.
   * Off during a drag, so drops land on whatever is under the pointer. */
  const cellGrip = (id: string, position: { x: number; y: number }, handlers: Record<string, (event: React.PointerEvent<HTMLDivElement>) => void>) => (
    <div key="grip" aria-hidden="true" data-camera-ignore="true" data-cell-grip={id} className="proto-cell-grip" style={{ left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`, width: CLASSICPLUS_GRID_SIZE, height: CLASSICPLUS_GRID_SIZE, pointerEvents: draggingActorId || draggingResourceId ? 'none' : undefined }} {...handlers} />
  );
  // A true circle lying on the table: the camera's tilt flattens it into a
  // level ellipse at any spin (an oval drawn on the table would swing round).
  const standeeBase = (key: string, position: { x: number; y: number }, width: number) => upright
    ? <div key={key} aria-hidden="true" className="proto-standee-base" style={{ left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`, width, height: width, boxShadow: tableObjectShadow(timeOfDay, position, 6, lightSources) }} />
    : null;

  const neutralGroundCells = useMemo(() => biomeTiles.filter(tile => tile.flags?.includes('unexplored')
    || tile.tileType === 'hero-den'
    || tile.tileType === 'impassable-mountain').map(getBiomeWorldFootprint), [biomeTiles]);
  const unexploredGround = useMemo(() => new Map(biomeTiles.filter(tile => tile.flags?.includes('unexplored')).map(tile => {
    const footprint = getBiomeTileFootprint(tile.gridSize), area = getBiomeWorldFootprint(tile);
    return [tile.id, <UnexploredTile key={tile.id} id={tile.id} x={area.x} y={area.y} width={footprint.width} height={footprint.height}
      reference={TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position))} tabletop={!upright} unlocked={tile.unlocked !== false} selected={Boolean(tile.selected)} dropTarget={dropTargetId === tile.id} />] as const;
  })), [biomeTiles, upright, dropTargetId]);

  return (
    <section data-camera-view={upright ? 'immersive' : 'tabletop'} className="proto-map relative min-h-0 overflow-hidden rounded-[calc(var(--classic-radius)*1.3)] border border-[#8ef2d4]/22 bg-[#050807] font-mono">
      <svg aria-hidden="true" width="0" height="0" className="absolute pointer-events-none"><defs>
        <filter id="proto-actor-xray" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius=".65" result="spread" />
          <feComposite in="spread" in2="SourceAlpha" operator="out" result="edge" />
          <feFlood floodColor="#e8f5ff" result="ink" />
          <feComposite in="ink" in2="edge" operator="in" result="outline" />
          <feGaussianBlur in="outline" stdDeviation="1.1" result="glow" />
          <feComponentTransfer in="SourceGraphic" result="ghost"><feFuncA type="linear" slope=".2" /></feComponentTransfer>
          <feMerge><feMergeNode in="glow" /><feMergeNode in="ghost" /><feMergeNode in="outline" /></feMerge>
        </filter>
      </defs></svg>
      <div
        className="proto-map-footer"
      >
        <div className="proto-map-readouts">
          <FpsCounter />
          <div className="proto-map-zoom" aria-live="polite">Zoom {Math.round((camera.cameraState.scale / CLASSICPLUS_ZOOM_REFERENCE_SCALE) * 100)}%</div>
        </div>
      <div className="proto-map-toolbar" role="group" aria-label="Map camera controls">
        <button type="button" className="proto-map-camera-button" aria-pressed={tilted} aria-label={tilted ? 'Flat camera view' : 'Tilt camera view'} title={tilted ? 'Flat camera view' : 'Tilt camera view'} onClick={() => onTiltedChange?.(!tilted)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={tilted ? 'M4 4h16v16H4z M4 12h16 M12 4v16' : 'M3 17l5-10h8l5 10z M6 12h12 M12 7v10'} /></svg></button>
        {/* Turn the table 45° (Q / E); a double-click turns it back to 0°. */}
        <button type="button" className="proto-map-camera-button" aria-label="Turn table left" title="Turn table left (Q) · double-click to straighten" onClick={() => camera.spinStep(-45)} onDoubleClick={unspin}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2 8 M4 4v6h6" /></svg></button>
        <button type="button" className="proto-map-camera-button" aria-label="Turn table right" title="Turn table right (E) · double-click to straighten" onClick={() => camera.spinStep(45)} onDoubleClick={unspin}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10a8 8 0 1 0-2 8 M20 4v6h-6" /></svg></button>
        <button type="button" className="proto-map-camera-button" aria-label="True Center" title="True Center · center on table:0,0" onClick={()=>camera.setCameraState(previous=>({...previous,x:-TRUE_CENTER.world.x*previous.scale,y:-TRUE_CENTER.world.y*previous.scale}))}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" /><path d="M12 2v6 M12 16v6 M2 12h6 M16 12h6" /></svg></button>
        <button
          type="button"
          className="proto-map-camera-button"
          aria-label="Reset View"
          title="Reset View · restore the starting camera"
          onClick={resetProtoCamera}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2 8 M4 4v6h6 M9 12l3-3 3 3v5H9z" /></svg>
        </button>
      </div>
        <div className="table-grid-reference" data-grid-reference={TABLE_GRID.reference(hoverCell)} aria-label="Table grid coordinate" title={hoverCell.column===0&&hoverCell.row===0 ? 'True Center · table:0,0' : TABLE_GRID.reference(hoverCell)}>{TABLE_GRID.reference(hoverCell)}</div>
      </div>
      {routeBlocked && <div className="absolute left-3 bottom-12 z-40 rounded border border-[#ffd166] bg-[#17140b] p-2 text-base" role="status">No clear route. Choose an open destination.</div>}
      <div
        ref={camera.containerRef}
        className={`proto-map-viewport h-full min-h-[18rem] cursor-grab touch-none ${camera.isPanning ? 'cursor-grabbing' : ''}`}
        aria-label="Scrollable expedition table"
        onPointerDownCapture={grabActorOnSquare}
        onPointerMoveCapture={event=>{const cell=TABLE_GRID.atWorld(worldPointFromClient(event.clientX,event.clientY));setHoverCell(previous=>previous.column===cell.column&&previous.row===cell.row?previous:cell);}}
        onDragOver={(event) => event.preventDefault()}
        onDragEnd={clearActorDragState}
        onDrop={handleDrop}
      >
        {/* The table plane. Tilted, it is oversized around the same center so
            its far edge stays off screen; everything on it tilts together. */}
        <div
          className={`proto-table-stage absolute${staged ? ' proto-table-stage--tilted' : ''}`}
          style={{
            inset: staged ? '-100%' : 0,
            transform: stageTransform,
            transition: tilted && airReady || !staged ? 'none' : undefined,
            ['--table-tilt' as string]: `${tiltAngle}deg`,
          }}
        >
        <div
          className="proto-table-floor absolute"
          style={{
            // Turns with a spun camera about the view centre; flat, it's
            // oversized so its corners never show.
            inset: staged ? 0 : '-50%',
            rotate: 'var(--camera-yaw, 0deg)',
            // Sized and placed from the live camera (--camera-*), so the grid keeps
            // pace with the pieces every frame instead of at React's state syncs.
            backgroundImage: `repeating-linear-gradient(0deg, rgba(142,242,212,0.28) 0 1px, transparent 1px calc(48px * var(--camera-scale, ${camera.cameraState.scale}))), repeating-linear-gradient(90deg, rgba(142,242,212,0.28) 0 1px, transparent 1px calc(48px * var(--camera-scale, ${camera.cameraState.scale})))`,
            // A tile image centered at the viewport places its boundaries half a
            // cell from True Center; stored actor coordinates identify square centers.
            backgroundPosition: `calc(50% + var(--camera-x, ${camera.cameraState.x}px)) calc(50% + var(--camera-y, ${camera.cameraState.y}px))`,
            backgroundSize: `calc(${CLASSICPLUS_GRID_SIZE}px * var(--camera-scale, ${camera.cameraState.scale})) calc(${CLASSICPLUS_GRID_SIZE}px * var(--camera-scale, ${camera.cameraState.scale}))`,
          }}
        />
        <div className="proto-table-plane absolute" style={{ inset: staged ? '33.3333%' : 0 }}>
        <div
          ref={camera.contentRef}
          data-physical-world="true"
          className="proto-map-world absolute"
          style={{
            left: '-150%',
            top: '-150%',
            width: '400%',
            height: '400%',
            transformOrigin: 'center center',
          }}
        >
          {/* Impassable terrain around the clear area: black placeholder tiles,
              lit only by the sun and moon (the light canvas keeps table lights off them). */}
          {BLOCKED_REGIONS.map((region) => <div key={region.id} aria-hidden="true" data-blocked-region={region.id} className="proto-blocked-terrain"
            style={{ left: `calc(50% + ${region.left}px)`, top: `calc(50% + ${region.top}px)`, width: region.right - region.left, height: region.bottom - region.top,
              ['--terrain-sky' as string]: (0.05 + getTableLighting(timeOfDay).daylight * 0.11).toFixed(3) }} />)}
          {/* The cell a dragged actor would land on; red when there's no route. */}
          {dragPlan?.cell ? <div aria-hidden="true" data-cell-cue={TABLE_GRID.reference(dragPlan.cell)} data-cue-blocked={dragPlan.route ? undefined : 'true'}
            className={`proto-cell-cue${dragPlan.route ? '' : ' proto-cell-cue--blocked'}`}
            style={{ left: `calc(50% + ${TABLE_GRID.center(dragPlan.cell).x}px)`, top: `calc(50% + ${TABLE_GRID.center(dragPlan.cell).y}px)` }} /> : null}
          <div className="table-grid-origin" data-grid-landmark="true-center" data-grid-reference={TRUE_CENTER.reference} aria-hidden="true" style={{left:'50%',top:'50%',width:CLASSICPLUS_GRID_SIZE,height:CLASSICPLUS_GRID_SIZE}}>＋</div>
          {placedLights.filter((light) => !light.fromPiece).map((light) => <div key={light.id} data-board-piece="lamp" data-camera-ignore="true"
            aria-label={light.id === 'table-lantern' ? 'Table lantern, drag to move light' : 'Structure light'}
            onPointerDown={(event) => { event.stopPropagation(); if (light.id !== 'table-lantern' || (event.pointerType === 'mouse' && event.button !== 0)) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (light.id !== 'table-lantern' || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const point = worldPointFromClient(event.clientX, event.clientY); onMoveLight?.(light.id, point); }}
            onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            className="proto-table-lamp absolute z-10 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
            style={{ left: 'calc(50% + ' + light.position.x + 'px)', top: 'calc(50% + ' + light.position.y + 'px)', ...faceCameraFlat, ...standee() }}>🕯️</div>)}
          {questCards.filter(placement => placement.questIndex >= 0).map(placement => <TableQuestCard key={placement.questIndex} placement={placement} title={questTitles[placement.questIndex]} text={questTexts[placement.questIndex]} rewardLabel={questRewardLabels[placement.questIndex]} staminaReward={questRewardLabels[placement.questIndex] ? 0 : undefined} redeemed={placement.questIndex < questClaims} onRedeem={() => onRedeemQuest?.(placement.questIndex)} timeOfDay={timeOfDay} lights={lightSources} cameraScale={camera.cameraState.scale} toWorld={worldPointFromClient}
            onMove={(position,tilt)=>onMoveQuest?.(placement.questIndex,position,tilt)}
            solids={[
              ...blockedSolids(),
              ...biomeTiles.filter(tile => !tile.tileType && !tile.road).map(tile=>getBiomeWorldFootprint(tile)),
              ...resourceStacks.filter(stack=>stack.resource==='provisions_hut'||stack.build&&CRAFT_RECIPES.find(recipe=>recipe.id===stack.build?.recipeId)?.output==='provisions_hut').map(stack=>({x:stack.position.x,y:stack.position.y,width:48,height:48})),
              ...actors.map(actor=>{const point=getActorWorldPosition(actor);return {x:point.x,y:point.y,width:48,height:48};}),
              // Other quest cards on the table, e.g. the teaching card, at their largest size.
              ...questCards.filter(other=>other.questIndex!==placement.questIndex).map(other=>({x:other.position.x,y:other.position.y,width:120,height:120*88/63})),
            ]} />)}
          {/* Static ground is one flat plane. It inherits neither billboard
              camera variables nor the 3D layer required by upright scenery. */}
          <div className="proto-neutral-ground absolute inset-0" style={{
            ['--camera-transform' as string]: 'none', ['--camera-yaw' as string]: '0deg',
            ['--camera-x' as string]: '0px', ['--camera-y' as string]: '0px',
            ['--camera-scale' as string]: '1', ['--camera-sx' as string]: '0px',
          }}>
            <UnexploredGround cells={neutralGroundCells} />
            {[...unexploredGround.values()]}
            {!upright && terrainRegions.map(region => <ConnectedTerrainArt key={region.id} region={region}
              sprite={`${import.meta.env.BASE_URL}assets/biomes/impassable-mountain_topdown.svg`} rockColor="#354154" />)}
          </div>
          {biomeTiles.map((tile) => (
            (() => {
              const footprint = getBiomeTileFootprint(tile.gridSize);
              const worldFootprint = getBiomeWorldFootprint(tile);
              if (tile.flags?.includes('unexplored')) return null;
              const tileLight = lightField.over(worldFootprint);
              lightReadouts.push({ id: 'tile-' + tile.id, position: worldFootprint, lift: worldFootprint.height / 2, percent: tileLight.percent, level: tileLight.level });
              // Scenery pops up from the back of the tile, which is its base, so the label stays readable in front
              // (tilted, far enough back to clear the label's ink above the shadows).
              // The back is authored in world space and stays there during orbit.
              const { position:popupPosition,size:popupSize, requestedSize, requestedPosition, owner: popupOwner } = biomePopups.get(tile.id)!;
              // Standing at the back of its tile, a pop-up can be in front of
              // another tile's label. Fit both dimensions together, so narrowing
              // the art can retain a readable pop-up at a low camera angle.
              const popup = tile.flags?.includes('unexplored') || tile.unlocked === false || popupSize < BIOME_POPUP_MIN_SIZE ? null : spriteStandee(tile.sprite, popupPosition, { size: popupSize, owner: 'biome' });
              // Unexplored tiles stay anonymous and silent until discovery.
              const unexplored = Boolean(tile.flags?.includes('unexplored'));
              const explored = tile.exploration ?? 1;
              const openState = biomeOpenState(tile.flags);
              const tapTile = (event: React.MouseEvent<HTMLElement>) => {
                if (unexplored) return;
                if (onInspectTile) onInspectTile(tile.id, event.currentTarget);
                else if (tile.unlocked !== false && openState.opens) onSelectBiome(tile.id);
              };
              return (
                <React.Fragment key={tile.id}>
                {/* Terrain shares the camera surface; only movable pieces
                    claim pointer gestures. The camera suppresses drag clicks. */}
                <button
                  data-board-piece="tile"
                  data-tabletop={!upright || undefined}
                  type="button"
                  aria-haspopup="dialog"
                  data-light-percent={tileLight.percent}
                  data-light-level={tileLight.level}
                  data-grid-reference={TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position))}
                  data-biome-id={tile.id}
                  title={unexplored ? undefined : tile.road ? `${tile.title} · explore the path` : tile.tileType === 'impassable-mountain' ? 'Impassable mountain · find a route around it' : tile.tileType ? `${tile.title} · explore the path` : tile.danger ? `${tile.title} · danger: a Shadow Wolf prowls here` : tile.terrain === 'water' ? `${tile.title} · fishing` : `${tile.title} · ${tile.sizeLabel} · ${Math.round(tile.resourceDensity * 100)}% resources · ${tile.tableauSize} cards${tile.unlocked === false ? ' · Complete Small Woods to unlock' : ''}`}
                  data-explored={explored.toFixed(2)}
                  data-unexplored={unexplored || undefined}
                  data-tile-type={unexplored ? 'unexplored' : tile.tileType ?? tile.terrain ?? 'woods'}
                  data-terrain={unexplored ? undefined : tile.terrain}
                  data-selected={tile.selected || undefined}
                  onClick={tapTile}
                  data-drop-target={dropTargetId === tile.id ? 'true' : undefined}
                  className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center text-center transition ${dropTargetId === tile.id ? 'proto-drop-target ' : ''}${!unexplored && tile.terrain === 'water' ? 'proto-water-tile ' : ''}${!unexplored && tile.danger ? 'proto-danger-tile ' : ''}${
                    tile.unlocked === false
                      ? 'cursor-not-allowed border-white/10 bg-black/40 text-white/25 opacity-65'
                      : tile.selected
                      ? 'border-[#8ef2d4]/85 bg-[#8ef2d4]/12 text-[#cafff4]'
                      : 'border-white/25 bg-[#0b1211]/95 text-white/68 hover:border-[#8ef2d4]/60'
                  }`}
                  style={{
                    width: footprint.width,
                    height: footprint.height,
                    // Odd footprints have a cell center at half a grid step;
                    // even footprints center on the grid boundary between
                    // their cells so all four edges remain on grid lines.
                    left: `calc(50% + ${getBiomeWorldFootprint(tile).x}px)`,
                    top: `calc(50% + ${getBiomeWorldFootprint(tile).y}px)`,
                  }}
                  aria-label={unexplored ? 'Unexplored biome' : tile.danger ? `${tile.title}, danger: a Shadow Wolf prowls here` : tile.terrain === 'water' ? `${tile.title}, fishing` : tile.unlocked === false ? `${tile.title}, locked until Small Woods is complete` : `${tile.title} ${tile.sizeLabel}, ${Math.round(tile.resourceDensity * 100)}% resources, ${tile.tableauSize} cards`}
                >
                  {unexplored ? <span aria-hidden="true" className="absolute inset-0" style={{ background: '#182221', filter: 'var(--silhouette-filter) grayscale(1) brightness(0.45)' }} /> : tile.road ? <RoadTileArt road={tile.road} exploration={explored} brightness={upright ? standeeLighting(timeOfDay, tile.position, 0, lightSources).brightness : 1} /> : tile.tileType === 'hero-den' ? !upright && <img data-den-overhead="true" aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" style={{ imageRendering: 'pixelated', objectFit: 'contain' }} src={`${import.meta.env.BASE_URL}assets/biomes/hero-den-topdown-v2.png`} alt="" draggable={false} /> : tile.tileType === 'impassable-mountain' ? null : !tile.tileType && !upright ? <BiomeTopDownArt terrain={tile.terrain} danger={tile.danger} exploration={explored} width={footprint.width} height={footprint.height} /> : null}
                  <span className="proto-tile-title-anchor">{!compositeTileTitle(tile) && !unexplored && tile.tileType !== 'hero-den' && !sharedLabelTiles.has(tile.id) && <TileTitle align={upright ? 'center' : 'top'} text={tile.title} width={footprint.width} height={footprint.height} yaw={yaw} scale={camera.effectiveScale} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame} onTextBox={(box) => reportBiomeLabel(tile.id, footprint, box)} />}</span>
                </button>
                {upright && !unexplored && !tile.tileType && !tile.road && tile.unlocked !== false ? <BiomeEdgeScenery
                  tileId={tile.id}
                  centre={worldFootprint}
                  footprint={worldFootprint}
                  props={tableScenery[tile.id] ?? []}
                  yaw={0}
                  exploration={explored}
                  hours={timeOfDay}
                  lights={lightSources}
                  quality={fxQuality}
                  standee={sceneryStandee}
                  oversample={oversample}
                /> : null}
                {popup ? <React.Fragment key={tile.id + '-popup'}>
                  {popup.shadows}
                  <div
                    aria-hidden="true"
                    data-board-piece="biome-popup"
                    data-biome-popup={tile.id}
                    data-environment-prop="true"
                    data-scenery-heading="0"
                    data-scenery-x={requestedPosition.x} data-scenery-y={requestedPosition.y}
                    data-scenery-desired-width={requestedSize} data-scenery-desired-height={requestedSize}
                    data-scenery-width={popupSize} data-scenery-height={popupSize}
                    data-owner-x={popupOwner.x} data-owner-y={popupOwner.y}
                    data-owner-width={popupOwner.width} data-owner-height={popupOwner.height}
                    className="proto-sprite-standee absolute"
                    onClick={tapTile}
                    style={{ left: `calc(50% + ${popupPosition.x}px)`, top: `calc(50% + ${popupPosition.y}px)`, ...sceneryStandee, width: popupSize * oversample, height: popupSize * oversample }}
                  ><Oversample width={popupSize} height={popupSize} factor={oversample}><Reveal fraction={tile.tileType === 'hero-den' ? 1 : explored} width={popupSize} height={popupSize} shade={popup.silhouette}>{popup.art}</Reveal></Oversample></div>
                </React.Fragment> : null}
                </React.Fragment>
              );
            })()
          ))}
          {resourceStacks.map((stack) => (
            (() => {
              const physicsPosition = resourcePhysicsRef.current.get(stack.id) ?? stack.position;
              const stackLight = lightField.at(physicsPosition);
              lightReadouts.push({ id: 'stack-' + stack.id, position: physicsPosition, lift: upright ? -30 : 24, percent: stackLight.percent, level: stackLight.level });
              // Grabbing anywhere on the stack's square drags the stack, never the camera.
              const grip = {
                onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
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
                },
                onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
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
                },
                onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
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
                },
                onPointerCancel: () => {
                  const body = resourcePhysicsRef.current.get(stack.id);
                  if (body) {
                    body.x = stack.position.x;
                    body.y = stack.position.y;
                    body.vx = 0;
                    body.vy = 0;
                  }
                  clearResourceDragState();
                },
              };
              return (
                <React.Fragment key={stack.id}>
                {standeeBase('base', physicsPosition, 44)}
                {stack.build || WORLD_ITEMS[stack.resource].kind === 'structure' ? null : cellGrip(`stack-${stack.id}`, physicsPosition, grip)}
                <div
                  data-board-piece="resource"
                  data-resource={stack.resource}
                  data-camera-ignore="true"
                  data-light-percent={stackLight.percent}
                  data-light-level={stackLight.level}
                  {...grip}
                  className={`proto-resource-stack${upright ? ' proto-standee' : ''} absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#8ef2d4]/55 bg-[#0b1916] text-[0.6rem] font-black text-[#cafff4] shadow-[0_0_18px_rgba(142,242,212,0.16)] ${draggingResourceId === stack.id ? 'cursor-grabbing ring-2 ring-[#cafff4]/55' : 'cursor-grab'}`}
                  style={{ left: `calc(50% + ${physicsPosition.x}px)`, top: `calc(50% + ${physicsPosition.y}px)`, boxShadow: upright ? tableObjectShadow(timeOfDay, physicsPosition, stack.resource === 'provisions_hut' ? 14 : 9, lightSources, yaw) : 'none', ...faceCameraFlat, ...standee({ width: 48, height: 60 }) }}
                  title={Object.entries(stackIngredients(stack)).map(([id, count]) => `${count} ${WORLD_ITEMS[id as WorldItemId].label}`).join(' + ')}
                  aria-label={`${stack.count} ${WORLD_ITEMS[stack.resource].label}${stack.build ? ', building' : ', draggable'}`}
                >
                  <BoardObjectLabel minFontSize={12} maxFontSize={16} text={`${stack.count} ${stack.ingredients && Object.keys(stack.ingredients).length > 1 ? '🧺' : WORLD_ITEMS[stack.resource].glyph}`} />
                  {!stack.build && stack.count > 1 && WORLD_ITEMS[stack.resource].kind !== 'structure' && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onSplitResourceStack?.(stack.id)} className="proto-standee-sign absolute top-full mt-1 whitespace-nowrap rounded border border-white/30 bg-[#0b1916] px-1 text-[9px]">Split 1</button>}
                  {stack.resource === 'provisions_hut' && !stack.build && <span className="proto-standee-sign absolute top-full mt-1 whitespace-nowrap rounded bg-black px-1">Hut foundation · {actors.some((actor) => actor.hutId === stack.id) ? 'Staffed' : 'Drop actor here'}</span>}
                  {stack.build && (() => {
                    const recipe = CRAFT_RECIPES.find((entry) => entry.id === stack.build?.recipeId)!;
                    const time = Math.min(1, stack.build.elapsedMs / recipe.durationMs);
                    const progress = recipe.requiresSolitaire ? Math.min(time, stack.build.work / recipe.workRequired) : time;
                    const staffed = actors.some((actor) => actor.hutId === stack.build?.stationId);
                    return <div data-hut-build={stack.id} className="proto-standee-sign absolute left-1/2 top-full z-30 mt-2 w-44 -translate-x-1/2 rounded border border-[#8ef2d4]/50 bg-[#0b1916] p-2 text-[10px] text-[#cafff4]" onPointerDown={(event) => event.stopPropagation()}>
                      <div>{recipe.label}</div>
                      <div role="progressbar" aria-label={recipe.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="my-1 h-2 overflow-hidden rounded bg-white/15"><div className="h-full bg-[#8ef2d4]" style={{ width: progress * 100 + '%' }} /></div>
                      <div>{Math.round(progress * 100)}% · {Math.ceil((recipe.durationMs - stack.build.elapsedMs) / 1000)}s remaining</div>
                      {recipe.requiresSolitaire && <>
                        <div>{staffed ? 'Actor stamina: ' + actorStamina : 'Paused · drop actor on hut foundation'}</div>
                        <div data-hut-foundation>Solitaire {stack.build.work}/{recipe.workRequired} · Foundation {stack.build.foundation}</div>
                        <div className="mt-1 flex flex-wrap gap-1">{stack.build.tableau.map((rank) => <button type="button" data-hut-card={rank} data-hut-stack={stack.id} key={rank} disabled={!staffed || !canSpendStamina(actorStamina, 1) || Math.abs(rank - stack.build!.foundation) !== 1} onClick={() => onPlayBuildCard?.(stack.id, rank)} className="rounded border border-white/50 bg-white/10 px-2 py-1 disabled:opacity-30" aria-label={'Play ' + rank + ' to hut foundation'}>{rank}</button>)}</div>
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
                </React.Fragment>
              );
            })()
          ))}
          {/* The route: previewed while an actor is dragged, then walked and
              used up as the actor travels it. */}
          {routeShown ? <RouteLine path={routeShown.path} unaffordable={routeShown.unaffordable} labels={labelQuads} /> : null}
          {routeShown?.label ? <span aria-hidden="true" className="proto-route-label proto-face-camera" data-route-label="true" data-route-unaffordable={routeShown.unaffordable || undefined}
            style={{ left: `calc(50% + ${routeShown.path[routeShown.path.length - 1].x}px)`, top: `calc(50% + ${routeShown.path[routeShown.path.length - 1].y}px)` }}>{routeShown.label}</span> : null}
          {actors.map(actor => { const position = travel?.actorId === actor.id && travelPosition ? travelPosition : getActorWorldPosition(actor); return <React.Fragment key={actor.id}>{spriteStandee(actorArt(actor, position), position)?.shadows}</React.Fragment>; })}
          {actors.map((actor) => {
            const actorPosition = travel?.actorId === actor.id && travelPosition ? travelPosition : getActorWorldPosition(actor);
            const actorLight = lightField.at(actorPosition);
            lightReadouts.push({ id: 'actor-' + actor.id, position: actorPosition, lift: upright ? -30 : 24, percent: actorLight.percent, level: actorLight.level });
            const sleeping = actorIsSleeping(actor, actorPosition);
            const heading = movementHeading(actorPosition, actorHeadings.current.get(actor.id), actor.heading);
            actorHeadings.current.set(actor.id, { ...actorPosition, heading });
            // The den authors a resting direction. Keep movement facing for
            // the standing pose, but never rotate a resting body with the camera.
            const poseHeading = sleeping ? actor.heading ?? 0 : heading;
            const directional = actor.id === 'hero' && !sleeping;
            const cutOut = spriteStandee(actorArt(actor, actorPosition), actorPosition);
            // Grabbing anywhere on the actor's square drags the actor, never the camera.
            const grip = {
              onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => grabActor(actor.id, event, event.currentTarget),
              onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
                const drag = pointerDragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) {
                  drag.moved = true;
                  setDraggingActorId(actor.id);
                  setDragPreview({ actorId: actor.id, x: event.clientX, y: event.clientY });
                  onActorDragStart?.(actor.id);
                }
                if (drag.moved) setDragPreview({ actorId: actor.id, x: event.clientX, y: event.clientY });
              },
              onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => finishPointerTableDrag(event, actor.id),
              onPointerCancel: () => {
                clearActorDragState();
              },
            };
            return (
            <React.Fragment key={actor.id}>

            {!sleeping && standeeBase('base', actorPosition, Math.max(40, Array.from(actor.label).length * 9))}
            {upright && !sleeping && <ActorBaseName name={actor.label} position={actorPosition} diameter={Math.max(40, Array.from(actor.label).length * 9)} />}
            {cellGrip(`actor-${actor.id}`, actorPosition, grip)}
            <div
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onInspectActor?.(actor.id, event.currentTarget); } }}
              data-grid-reference={TABLE_GRID.reference(TABLE_GRID.atWorld(actorPosition))}
              data-board-piece="actor"
              data-actor-id={actor.id}
              data-actor-pose={sleeping ? 'sleeping' : 'standing'}
              data-actor-heading={poseHeading}
              data-actor-orientation={directional ? 'directional' : 'world-plane'}
              data-actor-x={actorPosition.x} data-actor-y={actorPosition.y}
              data-actor-width={cutOut ? 32 : 48} data-actor-height={sleeping ? 20 : cutOut ? 32 : 64}
              data-selected={selectedActorId === actor.id || undefined}
              data-camera-ignore="true"
              data-light-percent={actorLight.percent}
              data-light-level={actorLight.level}
              {...grip}
              className={sleeping && !upright ? `proto-sleeping-overhead absolute cursor-grab select-none${draggingActorId === actor.id ? ' opacity-45' : ''}` : cutOut
                ? `proto-sprite-standee absolute cursor-grab select-none active:cursor-grabbing${selectedActorId === actor.id ? ' proto-sprite-standee--selected' : ''}${draggingActorId === actor.id ? ' opacity-45' : ''}`
                : `absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none place-items-center rounded-full border-2 bg-[#17140b] text-[0.52rem] font-black uppercase tracking-[0.1em] text-[#ffe7ad] shadow-[0_0_24px_rgba(255,209,102,0.18)] active:cursor-grabbing ${selectedActorId === actor.id ? 'border-[#fff0b5] ring-2 ring-[#ffd166]/45' : 'border-[#ffd166]/75'} ${draggingActorId === actor.id ? 'opacity-45' : ''}`}
              style={{
                // Stored positions and grid coordinates share the same cell-center origin.
                boxShadow: cutOut || !upright ? undefined : tableObjectShadow(timeOfDay, actorPosition, 12, lightSources.filter(light => light.id !== actorLightId(actor.id)), yaw),
                ...(cutOut || sleeping ? null : faceCameraFlat),
                left: `calc(50% + ${actorPosition.x}px)`,
                top: `calc(50% + ${actorPosition.y}px)`,
                ...(cutOut ? { ...standee(undefined, oversample), width: SPRITE_STANDEE_SIZE * oversample, height: SPRITE_STANDEE_SIZE * oversample } : standee({ width: 48, height: 64 })),
                ...(cutOut && !directional ? { transform: worldActorTransform(poseHeading, true, oversample), animation: undefined } : {}),
                ...(sleeping && !upright ? { width: 26, height: 26, transform: worldActorTransform(poseHeading, false), transformOrigin: '50% 50%' } : {}),
              }}
              aria-label={`${actor.label} actor token${sleeping ? ', sleeping in her den' : ''}`}
            >
              {sleeping && !upright ? <img src={`${import.meta.env.BASE_URL}assets/actors/hero-sleeping-topdown.png`} alt="" draggable={false} /> : cutOut ? <Oversample width={SPRITE_STANDEE_SIZE} height={SPRITE_STANDEE_SIZE} factor={oversample}>{directional ? <TableActorSprite position={actorPosition} heading={poseHeading} getCamera={camera.getLiveCamera} getTilt={getCameraTilt} brightness={standeeLighting(timeOfDay, actorPosition, SPRITE_STANDEE_SIZE, lightSources, yaw).brightness} fallback={cutOut.art} /> : cutOut.art}</Oversample> : <BoardObjectLabel text={actor.label} minFontSize={16} maxFontSize={16} />}
            </div>
            </React.Fragment>
            );
          })}

        </div>
        </div>
        </div>
        {/* Tile and connected-region ink is composited on the ground
            plane so tall scenery cannot conceal its title. This is a drawing
            layer at the same terrain elevation, never a lifted terrain piece. */}
        <div className="proto-table-title-layer absolute pointer-events-none" style={{ inset: staged ? '-100%' : 0, transform: stageTransform, transition: tilted && airReady || !staged ? 'none' : undefined }}>
          <div className="absolute" style={{ inset: staged ? '33.3333%' : 0 }}>
            <div className="absolute" style={{ left: '-150%', top: '-150%', width: '400%', height: '400%', transformOrigin: 'center center', transform: 'var(--camera-transform)' }}>
          {!upright && biomeTiles.filter(tile => tile.tileType === 'hero-den' && !tile.flags?.includes('unexplored')).map(tile => <HeroDenRoof key={`${tile.id}-roof`} position={tile.position} size={CLASSICPLUS_GRID_SIZE} />)}
          {biomeTiles.filter(tile => compositeTileTitle(tile) && tile.tileType !== 'hero-den' && !sharedLabelTiles.has(tile.id) && !tile.flags?.includes('unexplored')).map(tile => {
            const area = getBiomeWorldFootprint(tile);
            return <div key={`${tile.id}-title`} data-biome-title={tile.id} className="proto-tile-title-anchor" style={{ inset: 'auto', left: `calc(50% + ${area.x}px)`, top: `calc(50% + ${area.y}px)`, width: area.width, height: area.height, transform: 'translate(-50%, -50%)' }}>
              <TileTitle align={upright ? 'center' : 'top'} text={tile.title} width={area.width} height={area.height} yaw={yaw} scale={camera.effectiveScale} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame} onTextBox={box => reportBiomeLabel(tile.id, area, box)} />
            </div>;
          })}
          {biomeTiles.filter(tile => tile.tileType === 'hero-den' && !sharedLabelTiles.has(tile.id) && !tile.flags?.includes('unexplored')).map(tile => <div key={tile.id} className="proto-den-title" data-den-title="true" style={{ position: 'absolute', left: `calc(50% + ${tile.position.x}px)`, top: `calc(50% + ${tile.position.y + (upright ? 12 : 0)}px)`, width: 48, height: upright ? 24 : 48, transform: 'translate(-50%, -50%)' }}>
            <TileTitle align={upright ? 'center' : 'bottom'} maxLines={upright ? undefined : 1} text={tile.title} width={48} height={upright ? 24 : 48} yaw={yaw} scale={camera.effectiveScale} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame} />
          </div>)}
          {labelRegions.map(region => <div key={region.id} data-connected-label={region.id}
            data-immutable-region={region.tiles[0].tileType === 'impassable-mountain' ? region.id : undefined} data-region-tile-count={region.tiles.length}
            className="proto-immutable-region-label" style={{ left: `calc(50% + ${region.x}px)`, top: `calc(50% + ${region.y}px)`, width: region.width, height: region.height }}>
            <TileTitle align={upright ? 'center' : 'top'} text={region.title} width={region.width} height={region.height} yaw={yaw} scale={camera.effectiveScale} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame}
              onTextBox={box => region.tiles.forEach(tile => {
                const area = getBiomeWorldFootprint(tile);
                reportBiomeLabel(tile.id, area, { ...box,
                  left: box.left + region.x - region.width / 2 - area.left,
                  top: box.top + region.y - region.height / 2 - area.top,
                  pivot: { x: region.x - area.left, y: region.y - area.top } });
              })} />
          </div>)}
            </div>
          </div>
        </div>
        {/* Occluded actors share one translucent silhouette pass through scenery.
            Their physical artwork, bases and grab areas stay in the depth scene. */}
        <div className={`proto-table-actor-layer absolute${staged ? ' proto-table-stage--tilted' : ''}`} style={{ inset: staged ? '-100%' : 0, transform: stageTransform, transition: tilted && airReady || !staged ? 'none' : undefined, ['--table-tilt' as string]: `${tiltAngle}deg` }}>
          <div className="proto-table-plane absolute" style={{ inset: staged ? '33.3333%' : 0 }}>
            <div ref={actorGhostWorld} className="proto-map-world absolute" style={{ left: '-150%', top: '-150%', width: '400%', height: '400%', transformOrigin: 'center center', transform: 'var(--camera-transform)' }}>

            </div>
          </div>
        </div>
        {/* Light overlay on its own copy of the table plane. Kept out of the
            pieces' 3D scene so standees never cut through it: it lays the
            table's light over them like a projected wash. */}
        <div aria-hidden="true" className="proto-table-light pointer-events-none absolute z-40" style={{ inset: staged ? '-100%' : 0, transform: stageTransform, transition: tilted && airReady || !staged ? 'none' : undefined }}>
        {upright ? <canvas
          ref={lightCanvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        /> : null}
        {showLightReadout ? (
          <div aria-hidden="true" data-light-readout="true" className="pointer-events-none absolute inset-0 z-[45] overflow-hidden" style={{ rotate: 'var(--camera-yaw, 0deg)' }}>
            {lightReadouts.map((readout) => (
              <span
                key={readout.id}
                className="proto-light-readout proto-face-camera"
                data-light-level={readout.level}
                style={{
                  // Live camera, so the readouts keep pace with the table every frame.
                  left: `calc(50% + var(--camera-x, 0px) + ${readout.position.x}px * var(--camera-scale, 1))`,
                  top: `calc(50% + var(--camera-y, 0px) + ${readout.position.y - readout.lift}px * var(--camera-scale, 1) - 6px)`,
                }}
              >
                {readout.percent}%
              </span>
            ))}
          </div>
        ) : null}
        </div>
        {/* Immersion, on its own copy of the tilted plane so nothing in it dips
            under the light wash: light hangs in the air around lamps, fireflies drift
            over the woods and pond, the water fizzes. Tilted only. */}
        {airReady ? <div aria-hidden="true" className="proto-table-light proto-table-air pointer-events-none absolute z-40" style={{ inset: '-100%', transform: stageTransform, transition: 'none', ['--table-tilt' as string]: `${tiltAngle}deg` }}><AtmosphereInAir
          frame={getTableLighting(timeOfDay)}
          lights={lightSources}
          camera={camera.cameraState}
          areas={atmosphereAreas}
          quality={fxQuality}
          view={{ width: viewportWidth, height: viewportHeight }}
          tilt={tilt}
        /></div> : null}
        {airReady && tilt ? <DustMotes frame={getTableLighting(timeOfDay)} quality={fxQuality} camera={camera.cameraState}
          tilt={tilt} getTilt={getCameraTilt} view={{ width:viewportWidth,height:viewportHeight }} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame} /> : null}
        {airReady && fxQuality === 'high' && useVolume ? <VolumetricAtmosphere active
          frame={getTableLighting(timeOfDay)} lights={lightSources}
          scene={{ canopies:atmosphereCanopies,patches:atmosphereAreas }}
          tilt={getCameraTilt(camera.cameraState)} getTilt={getCameraTilt} view={{ width:viewportWidth,height:viewportHeight }}
          getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame}
        /> : airReady ? <LightShafts frame={getTableLighting(timeOfDay)} quality={fxQuality} camera={camera.cameraState} view={{ width: viewportWidth, height: viewportHeight }} /> : null}
        {staged ? <div aria-hidden="true" className={`proto-table-horizon${tilted ? ' proto-table-horizon--shown' : ''}`} /> : null}
      </div>
      {dragPreview && !travel ? (
        <div
          aria-hidden="true"
          data-actor-drag-preview="true"
          className={`pointer-events-none fixed z-[100] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-[#ffe7ad]/80 bg-[#17140b]/55 text-base font-black uppercase tracking-[0.1em] text-[#ffe7ad]/80${upright ? ' shadow-[0_0_24px_rgba(255,209,102,0.22)]' : ''}`}
          data-actor-drag-ghost="true"
          style={{ left: dragPreview.x, top: dragPreview.y }}
        >
          {actors.find((actor) => actor.id === dragPreview.actorId)?.label ?? 'Hero'}
        </div>
      ) : null}
    </section>
  );
};
