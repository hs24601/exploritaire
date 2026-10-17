import { berryScenerySprite } from '../berryPresentation';
import { BushBerries } from './BushBerries';
import { trackGameAnimation } from '../../gameAnimations';
import { matchesDeparture, sampleDepartureCamera, type DepartureCamera } from '../departureCamera';
import { shotFromCamera } from '../cameraChoreography';
import { gameTime } from '../../gameTime';
import { stackIsManaInfused } from '../manaInfusion';
import { ManaGlow } from './ManaGlow';
import type { StoryMood } from '../dayCinematics';
import type { PeripheralDarkness as PeripheralDarknessConfig } from '../peripheralDarkness';
import { PeripheralDarkness } from './PeripheralDarkness';
import { ManaberryGlow } from './ManaberryGlow';
import { isTextEditingTarget } from '../keyboardInput';
import { useMapCameraDirector } from '../hooks/useMapCameraDirector';
import { cameraIsPlaying, stopCameraPlayback, useCameraPlayback } from '../cameraDirector';
import { passageStepAllowed } from '../terrainPassages';
import { adjacentSketchProgress, sketchApproach, sketchBorderProps } from '../sketchScenery';
import { populationDensity, populateScenery, populationOwner, sparseBerryBush } from '../sceneryPopulation';
import { useTileInspectionHold } from './useTileInspectionHold';
import { exposedTravelCardAt } from './travelCardHit';
import { TravelWorldContext } from './TravelMapTableau';
import { TravelDestinationActions } from './TravelDestinationActions';
import { planTravel, travelTableauHeld, traversalProfile, type TravelJourney, type TravelPlan } from '../travelJourney';
import { sameTravelCell, addTravelWaypoint, routeThroughTravelCells } from '../travelRouting';
import { WoodlandGround } from './WoodlandGround';
import { standeeRasterScale } from '../spriteRaster';
import { TileDiscoveryArt, TileDiscoveryProvider } from './TileDiscoveryArt';
import { woodsRoughage } from '../woodsRoughage';
import { OffscreenWaypoints } from './OffscreenWaypoints';
import { DayObjectiveWaypoint } from './DayObjectiveWaypoint';
import type { DayObjective } from '../dayObjectives';
import { sceneryHeightUnits, heightToWorld } from '../sceneryHeight';
import { useGlobalLights } from '../globalLighting';
import { actorCloseupCamera, actorCloseupTilt, type ActorCloseup } from '../actorCloseup';
import { useArtStyle } from '../artStyle';
import { actorSprite } from '../actorArt';
import { RestBobtail } from './RestBobtail';
import { isPaintedScenerySprite, scenerySprite, sceneryWorldHeading } from '../sceneryArt';
import { directionalScenery } from '../directionalScenery';
import { useDirectionalScenery } from './useDirectionalScenery';
import type { InteriorOccupant } from './SceneryInterior';
import { UnexploredTile } from './UnexploredTile';
import { advanceTravelBuffer, immersiveTileScale, travelDuration, followingCamera, cinematicTravelCamera } from '../travelMotion';
import { frameTravelCards } from '../travelCameraFraming';
import { TableStoryCard } from './TableStoryCard';
import { useHeldVisual } from './useHeldVisual';
import { createPortal } from 'react-dom';
import { GroundShadowLayer } from './GroundShadowLayer';
import { UnexploredGround } from './UnexploredGround';
import { useEnvironmentFootprints } from './useEnvironmentFootprints';
import { useActorOcclusion } from './useActorOcclusion';
import { useImmersiveLabels } from './useImmersiveLabels';
import { walkableSceneryOwner, fitSceneryFootprint, fitSceneryVolumeFootprint } from '../sceneryFootprint';
import { propVolumeHeading, propVolumeRecipe } from '../propVolume';
import { PropVolumeArt, PropVolumeShadows, prewarmPropVolumes } from './PropVolume';
import { TileTitle } from './TileTitle';
import { connectedTileLabelRegions, immutableTerrainRegions, immutableTileRegions } from '../tileLabels';
import { ConnectedTerrainArt } from './ConnectedTerrainArt';
import { TileSpillArt } from './TileSpillArt';
import { tileSpills } from '../tileSpill';
import { TableActorSprite } from './TableActorSprite';
import { HERO_OVERHEAD_LENGTH_SCALE } from '../directionalSprites';
import { movementHeading, worldActorTransform } from '../actorOrientation';
import { ACTOR_SCALE_REFERENCE, immersionActorScale } from '../actorScale';
import { RoadTileArt } from './RoadTileArt';
import { HeroDenRoof } from './HeroDenRoof';
import type { RoadTile } from '../roadTiles';
import { canSpendInspiration } from '../inspirationTesting';
import { TABLE_GRID, TRUE_CENTER, screenToWorld, type GridCell } from '../gridCoordinates';
import { BLOCKED_REGIONS, isBlockedPoint } from '../worldBounds';
import { findGridPath, pathTime, pointAlongTimedPath, remainingPath, type TimedPoint } from '../gridPathfinding';
import { RouteLine } from './RouteLine';
import { FpsCounter } from './FpsCounter';
import { ActorBaseName } from './ActorBaseName';
import { Reveal } from './Reveal';
import { SilhouetteRelief } from './SilhouetteRelief';
import { biomeOpenState, type BiomeFlag } from '../biomeFlags';
import { TableQuestCard, type PlacedQuestCard } from './TableQuestCard';
import { BoardObjectLabel } from './BoardObjectLabel';
import { BiomeTopDownArt } from './BiomeTopDownArt';
import { solverFlightDuration } from '../solverTiming';
import { actorLight, actorLightId, createTableLightField, getVisualTableLighting, standeeLighting, tableObjectShadow, type LightLevel, type TableLight } from '../protoLighting';
import { drawTableLight, tableLightNeedsAnimation, type GlobalLightCache } from './tableLightCanvas';
import { WORLD_ITEMS, CRAFT_RECIPES, stackIngredients, type CraftStack, type WorldItemId } from '../protoCrafting';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TableauSolveControls, type SolveStepResult } from './TableauSolveControls';
import { rotateVector, useCameraControls } from '../../hooks/useCameraControls';
import { BiomeEdgeScenery } from './BiomeEdgeScenery';
import { layoutTableScenery } from '../biomeEdgeScenery';
import { AtmosphereInAir, LightFireflies, LightShafts } from './TableAtmosphere';
import { VolumetricAtmosphere } from './VolumetricAtmosphere';
import { DustMotes } from './DustMotes';
import { GroundLightCanvas } from './GroundLightCanvas';
import { TableGridCanvas } from './TableGridCanvas';
import { subscribeVisualLight } from '../visualLightClock';
import type { AtmosphereCanopy } from '../volumetricAtmosphere';
import { detectFxQuality } from '../atmosphere';
import type { LabelBox } from '../biomeEdgeScenery';
import { BIOME_EDGE_SCENERY } from '../protoData';
import { Oversample, STANDEE_OVERSAMPLE, SPRITE_STANDEE_SIZE, SpriteStandeeArt, SpriteStandeeShadows } from './SpriteStandee';
import { terrainAutotilePlacements, terrainAutotileSeams } from '../terrainAutotile';
import { TABLE_MAX_SCALE, TABLE_TILT_MS, tableCameraTilt, tableTiltFor, tableTiltTransform, tiltPanScale, unprojectTilt, projectTilt } from '../tableTilt';

export type ProtoBiomeTile = {
  passage?: import('../terrainPassages').TerrainPassage;
  passageOpen?: boolean;
  traversalDifficulty?: number;
  travelCards?: number;
  traversalProgress?: number;
  id: string;
  title: string;
  sizeLabel: 'Small' | 'Medium' | 'Large';
  gridSize: { columns: number; rows: number };
  resourceDensity: number;
  populationDensity?: number;
  berryPatchVariant?: 'sparse';
  berryHarvested?: boolean;
  berriesAvailable?: boolean;
  tableauSize: number;
  position: { x: number; y: number };
  selected: boolean;
  unlocked?: boolean;
  threat?: 'none' | 'low' | 'high';
  /** Water tiles are fished (the pond) rather than dealt as a tableau. */
  terrain?: 'woods' | 'water';
  tileType?: 'unexplored' | 'path' | 'dirt' | 'hero-den' | 'impassable-mountain' | 'berry-patch';
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
  traversalAffinity?: Partial<Record<string, number>>;
  awakeAtHome?: boolean;
  id: string;
  partyId?: string;
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
export const CLASSICPLUS_ZOOM_REFERENCE_SCALE = ACTOR_SCALE_REFERENCE;
const TOP_DOWN_MAX_SCALE = CLASSICPLUS_ZOOM_REFERENCE_SCALE * 3.5;
/** Standees pop up from their bases once the camera has leaned halfway back. */
const STANDEE_POP_MS = 320;
/** Biome scenery pop-ups tower over a one-cell tile and the pieces on it. */
const BIOME_POPUP_SIZE = 72;
/** A pop-up cut below this to clear a label behind it is left out. */
const BIOME_POPUP_MIN_SIZE = 5;
/** How long a tapped tile keeps its label showing. */
const LABEL_TAP_MS = 4000;

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
  /** Scene-owned pins; removing an ID restores ordinary hover/focus/tap reveal. */
  persistentTileLabelIds?: readonly string[];
  storyMood?: StoryMood;
  peripheralDarkness?: PeripheralDarknessConfig;
  cameraDirectorDisabled?: boolean;
  departureCamera?: DepartureCamera;
  settings?: React.ReactNode | ((travelControls: React.ReactNode) => React.ReactNode);
  travelTableau?: React.ReactNode;
  onEditCell?: (cell: GridCell) => void;
  onEditContextMenu?: (cell: GridCell, x: number, y: number) => void;
  editCell?: GridCell;
  journey?: TravelJourney;
  travelStamina?: number;
  travelStaminaMax?: number;
  initialCenter?: { x: number; y: number };
  objective?: DayObjective | null;
  onConfirmTravel?: (plan: TravelPlan) => void;
  travelAllowed?: (plan: TravelPlan) => boolean;
  onFinishTravel?: () => void;
  onTravelPaint?: (progress:number) => void;
  onTravelCheckpoint?: (progress:number) => boolean;
  inactive?: boolean;
  storyCard?: React.ReactNode;
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
  onEnterTile?: (actorId: string, tileId: string) => void;
  onActorExplore?: (actorId: string, from: { x: number; y: number }, to: { x: number; y: number }) => void;
  onDropActorToTable: (actorId: string, point: { x: number; y: number }, arrival?: { biomeId?: string; directBiome?: boolean; foundationIndex?: number }) => void;
  onMoveResourceStack?: (stackId: string, point: { x: number; y: number }, targetId?: string, actorId?: string) => void;
  onSplitResourceStack?: (stackId: string) => void;
  onPlayBuildCard?: (stackId: string, rank: number) => void;
  onSolveBuildStep?: (stackId: string, divine: boolean) => SolveStepResult;
  onStartSolver?: (divine: boolean) => void;
  actorInspiration?: number;
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
  cameraDirectorDisabled, storyMood, peripheralDarkness, departureCamera, persistentTileLabelIds = [],
  onEditCell, onEditContextMenu, editCell,
  journey, travelStamina = 24, travelStaminaMax = 24, initialCenter, objective, onConfirmTravel, onFinishTravel, onTravelCheckpoint, onTravelPaint, travelAllowed,
  inactive = false,
  biomeTiles: sourceBiomeTiles,
  actors,
  actorOrigins,
  resourceStacks,
  lightSources: placedLights = [],
  timeOfDay = 0,
  showLightReadout = false,
  onMoveLight,
  onSelectBiome,
  onDropActorToTable,
  onActorExplore, onEnterTile,
  onMoveResourceStack,
  onSplitResourceStack,
  onPlayBuildCard,
  onSolveBuildStep,
  onStartSolver,
  actorInspiration = 0,
  onActorDragStart,
  onInspectActor, onInspectTile,
  questCards = [],
  storyCard,
  settings, travelTableau,
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
  const [travelWorldHost,setTravelWorldHost]=useState<HTMLDivElement|null>(null);
  const setTravelWorldRef=useCallback((element:HTMLDivElement|null)=>{camera.contentRef.current=element;setTravelWorldHost(element);},[]);
  const globalLights=useGlobalLights();
  const artStyle=useArtStyle();
  const editingRef = useRef(Boolean(onEditCell));
  editingRef.current = Boolean(onEditCell);
  const biomeTiles=useMemo(()=>sourceBiomeTiles.map(tile=>({...tile,sprite:tile.id==='day-one-tree'&&artStyle==='paint'
    ? `${import.meta.env.BASE_URL}assets/biomes/watercolor-v1/pine-sprite-v1.png` : scenerySprite(tile.sprite,artStyle)})),[sourceBiomeTiles,artStyle]);
  // Pop-up-book camera: the table tilts back and pieces stand up as cardboard standees.
  // Sprites that failed to load fall back to the cardboard token.
  const [failedSprites, setFailedSprites] = useState<string[]>([]);
  const journeyRef = useRef(journey);
  journeyRef.current = journey;
  const [pendingTravel, setPendingTravel] = useState<TravelPlan | null>(null);
  const [editingTravelRoute, setEditingTravelRoute] = useState(false);
  const [travelControls, setTravelControls] = useState<{ x: number; y: number }[]>([]);
  const [routeEditError, setRouteEditError] = useState('');
  const routeControlDrag = useRef<{ index: number; pointerId: number; original: { x: number; y: number }[]; plan: TravelPlan } | null>(null);
  const cancelTravelControl = () => {
    const drag = routeControlDrag.current;
    if (!drag) return;
    setTravelControls(drag.original); setPendingTravel(drag.plan); setRouteEditError(''); routeControlDrag.current = null;
  };
  useEffect(() => {
    window.addEventListener('blur', cancelTravelControl);
    return () => window.removeEventListener('blur', cancelTravelControl);
  }, []);
  const [followTravelingActor, setFollowTravelingActor] = useState(true);
  const [cinematicTravel, setCinematicTravel] = useState(true);
  const [closeup, setCloseup] = useState<ActorCloseup | null>(null);
  const closeupRef = useRef(closeup);
  closeupRef.current = closeup;
  // Where each biome tile's label text sits, from the tile's centre, so the
  // tilted camera's edge scenery can keep clear of it.
  // Ambiance tier for the tilted camera (atmosphere.ts): fixed for the session.
  const [fxQuality] = useState(detectFxQuality);
  const [useVolume] = useState(() => new URLSearchParams(window.location.search).get('atmosphere') !== 'off');
  const [biomeLabelBoxes, setBiomeLabelBoxes] = useState<Record<string, LabelBox>>({});
  // The note shown when a tile that won't open is tapped (e.g. unexplored).
  const reportBiomeLabel = useCallback((tileId: string, tile: { width: number; height: number }, box: { left: number; top: number; width: number; height: number; pivot: { x: number; y: number }; rotation: number }) => {
    const next = { left: box.left - tile.width / 2, top: box.top - tile.height / 2, right: box.left + box.width - tile.width / 2, bottom: box.top + box.height - tile.height / 2,
      pivot: { x: box.pivot.x - tile.width / 2, y: box.pivot.y - tile.height / 2 }, rotation: box.rotation };
    setBiomeLabelBoxes((boxes) => {
      const known = boxes[tileId];
      if (known && known.rotation === next.rotation && (['left', 'top', 'right', 'bottom'] as const).every((side) => Math.abs(known[side] - next[side]) < 0.25)
        && Math.abs((known.pivot?.x ?? 0) - next.pivot.x) < 0.25 && Math.abs((known.pivot?.y ?? 0) - next.pivot.y) < 0.25) return boxes;
      return { ...boxes, [tileId]: next };
    });
  }, []);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const [rasterScale, setRasterScale] = useState(() => standeeRasterScale(window.devicePixelRatio, STANDEE_OVERSAMPLE));
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
      ? [gameTime.setTimeout(() => { setUpright(true); setStandeeMotion(reducedMotion ? null : 'rise'); }, half),
        gameTime.setTimeout(() => setAirReady(true), reducedMotion ? 0 : TABLE_TILT_MS),
        gameTime.setTimeout(() => setStandeeMotion(null), half + STANDEE_POP_MS)]
      : [gameTime.setTimeout(() => { setUpright(false); setStandeeMotion(null); }, half),
        gameTime.setTimeout(() => setLeaving(false), reducedMotion ? 0 : TABLE_TILT_MS + 40)];
    return () => timers.forEach((timer) => gameTime.clearTimeout(timer));
  }, [tilted]);
  const atmosphereAreas = biomeTiles.filter((tile) => tile.unlocked !== false && !tile.road && !tile.tileType && !tile.flags?.includes('unexplored')).map((tile) => ({ id: tile.id, terrain: tile.terrain === 'water' ? 'water' as const : 'woods' as const, danger: tile.danger, ...getBiomeWorldFootprint(tile) }));
  // A press on a square an actor stands on never pans (see grabActorOnSquare).
  const actorSquareRef = useRef<(clientX: number, clientY: number) => boolean>(() => false);
  const canStartPanAt = useCallback((clientX: number, clientY: number) => editingRef.current || !closeupRef.current && !actorSquareRef.current(clientX, clientY), []);
  const isObjectGestureAt = useCallback((clientX: number, clientY: number) => !editingRef.current && actorSquareRef.current(clientX, clientY), []);
  const getCameraTilt = useCallback((live: { scale: number; pitch?: number; aimY?:number }) => closeupRef.current
    ? actorCloseupTilt(viewportHeight, live.scale, closeupRef.current, live.pitch)
    : ({...tableCameraTilt(viewportHeight, live.scale, live.pitch), ...(live.scale>10||live.aimY!==undefined?{angle:live.pitch??82,aimY:live.aimY??viewportHeight*.28}:{})}), [viewportHeight]);
  const camera = useCameraControls({
    enabled: !inactive,
    canStartPanAt,
    isObjectGestureAt,
    panScale: live => closeup ? { x: 0, y: 0 } : tiltPanScale(tilted ? getCameraTilt(live) : null),
    orbitTilt: tilted ? { getAngle: live => getCameraTilt(live).angle, min: 0, max: 82 } : undefined,
    minScale: closeup ? closeup.camera.scale : 0.65,
    maxScale: closeup ? closeup.camera.scale * 6 : tilted ? Math.max(TABLE_MAX_SCALE,immersiveTileScale(viewportWidth)*2) : TOP_DOWN_MAX_SCALE,
    zoomSensitivity: 0.0048,
    centeredZoom: true,
    initialState: { x: 0, y: 0, scale: CLASSICPLUS_ZOOM_REFERENCE_SCALE },
  });
  const [groundWorld, setGroundWorld] = useState<HTMLDivElement | null>(null);
  const [gridExtension, setGridExtension] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  const volumeCamera = useMemo(() => ({ getCamera: camera.getLiveCamera, onCameraFrame: camera.onCameraFrame,
    getElevation: (live: { scale: number }) => 90 - getCameraTilt(live).angle }), [camera.getLiveCamera, camera.onCameraFrame, getCameraTilt]);
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
      const next = active ? { left: Math.max(0, view.left - target.left), top: Math.max(0, view.top - target.top),
        right: Math.max(0, target.right - view.right), bottom: Math.max(0, target.bottom - view.bottom) } : { left: 0, top: 0, right: 0, bottom: 0 };
      setGridExtension(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
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
    if (cameraIsPlaying()) return;
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
    const start = gameTime.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      const ease = t * t * (3 - 2 * t);
      camera.setCameraState({ ...target,
        x: from.x + (target.x - from.x) * ease,
        y: from.y + (target.y - from.y) * ease,
        scale: from.scale + (target.scale - from.scale) * ease,
      });
      if (t < 1) frame = gameTime.requestAnimationFrame(tick);
    };
    frame = gameTime.requestAnimationFrame(tick);
    // Direct camera input takes control immediately, including touch gestures.
    const cancel = () => gameTime.cancelAnimationFrame(frame);
    const viewport = camera.containerRef.current;
    const pointer=(event:PointerEvent)=>{if(event.button===0&&(event.target as Element)?.closest('[data-world-card]'))return;cancel();};
    viewport?.addEventListener('pointerdown', pointer);
    viewport?.addEventListener('wheel', cancel);
    window.addEventListener('keydown', cancel);
    return () => {
      cancel();
      viewport?.removeEventListener('pointerdown', pointer);
      viewport?.removeEventListener('wheel', cancel);
      window.removeEventListener('keydown', cancel);
    };
  }, [focusBiomeId, focusX, focusY, camera.getLiveCamera, camera.setCameraState]);
  const tilt = tilted ? getCameraTilt(camera.cameraState) : null;
  const getAtmosphereTilt = useCallback((live: { scale: number; pitch?: number }) =>
    tilted ? getCameraTilt(live) : tableTiltFor(viewportHeight, 0), [tilted, getCameraTilt, viewportHeight]);
  const tiltAngle = tilt?.angle ?? 0;
  const stageTransform = staged ? tableTiltTransform(tilt ?? tableTiltFor(viewportHeight, 0)) : undefined;
  // Publish body scaling with each live camera frame, including wheel, pinch
  // and automatic encounter framing, rather than waiting for React to settle.
  useEffect(() => {
    const viewport = camera.containerRef.current;
    if (!viewport) return;
    const drawActorScale = (live: { scale: number; aimY?:number }) => {
      viewport.style.setProperty('--actor-world-scale', String(upright ? closeupRef.current?.actorScale ?? (live.scale>10||live.aimY!==undefined ? 3.6/live.scale : immersionActorScale(live.scale)) : 1));
    };
    drawActorScale(camera.getLiveCamera());
    const unsubscribe = camera.onCameraFrame(drawActorScale);
    return () => { unsubscribe(); viewport.style.removeProperty('--actor-world-scale'); };
  }, [upright, closeup, camera.getLiveCamera, camera.onCameraFrame]);
  // Zoom and manual orbit drive the rig on the same frame as the world transform. Keep
  // CSS easing for mode switches only; it must not lag wheel or pinch input.
  const drawLiveRig = useCallback(() => {
    if (!tilted || !airReady) return;
    const rig = getCameraTilt(camera.getLiveCamera());
    camera.containerRef.current?.querySelectorAll<HTMLElement>('.proto-table-stage, .proto-table-light, .proto-table-title-layer').forEach(el => {
      el.style.transform = tableTiltTransform(rig);
      el.style.setProperty('--table-tilt', `${rig.angle}deg`);
    });
  }, [tilted, airReady, getCameraTilt, camera.getLiveCamera]);
  // A scene commit can write an older tilt snapshot over a newer live frame.
  // Restore the live projection before the browser paints that commit.
  useLayoutEffect(drawLiveRig);
  useEffect(() => {
    if (!tilted || !airReady) return;
    drawLiveRig();
    return camera.onCameraFrame(drawLiveRig);
  }, [tilted, airReady, drawLiveRig, camera.onCameraFrame]);
  // Returning to top-down preserves framing up to its 350% cap.
  useEffect(() => {
    if (!tilted && camera.getLiveCamera().scale > TOP_DOWN_MAX_SCALE) camera.setCameraState(previous => {
      const ratio = TOP_DOWN_MAX_SCALE / previous.scale;
      return { ...previous, x: previous.x * ratio, y: previous.y * ratio, scale: TOP_DOWN_MAX_SCALE, aimY:undefined };
    });
  }, [tilted]);
  // Camera spin, degrees clockwise on screen (useCameraControls). React state
  // catches up after a turn; pieces facing the camera turn
  // against it, and scenery that sits behind a tile follows the side facing it.
  useEnvironmentFootprints(camera.containerRef, camera.onCameraFrame, upright, camera.getLiveCamera, getCameraTilt);
  const actorHeadings = useRef(new Map<string, { x: number; y: number; heading: number }>());
  useActorOcclusion(camera.containerRef, upright, camera.getLiveCamera, getCameraTilt);
  useImmersiveLabels(camera.containerRef, upright, camera.getLiveCamera, getCameraTilt);
  const yaw = camera.cameraState.yaw ?? 0;
  const denSource=biomeTiles.find(tile=>tile.tileType==='hero-den')?.sprite;
  const denView=useDirectionalScenery(denSource,artStyle==='paint'&&upright,camera.getLiveCamera,camera.onCameraFrame);
  const immutableRegions = useMemo(() => immutableTileRegions(biomeTiles), [biomeTiles]);
  const terrainRegions = useMemo(() => immutableTerrainRegions(biomeTiles), [biomeTiles]);
  const labelRegions = useMemo(() => connectedTileLabelRegions(biomeTiles), [biomeTiles]);
  // Neighbour-aware variants: each connected terrain cell leans, scales and
  // flips its art from its joined sides, so ranges don't read as copies.
  const terrainPieces = useMemo(() => terrainAutotilePlacements(terrainRegions, position => TABLE_GRID.atWorld(position), TABLE_GRID.cellSize), [terrainRegions]);
  // Tilted, low ridges cross every joined seam so raised ranges show no ground between peaks.
  const terrainSeams = useMemo(() => terrainAutotileSeams(terrainRegions, position => TABLE_GRID.atWorld(position), TABLE_GRID.cellSize), [terrainRegions]);
  const terrainOwners = new Map(immutableRegions.flatMap(region => region.tiles.map(tile => [tile.id, region] as const)));
  const sharedLabelTiles = new Set(labelRegions.flatMap(region => region.tiles.map(tile => tile.id)));
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  const [boundedGroundLight,setBoundedGroundLight]=useState(()=>new URLSearchParams(location.search).get('groundRenderer')!=='canvas');
  const groundLightUnavailable=useCallback(()=>setBoundedGroundLight(false),[]);
  const globalLightCache = useRef<GlobalLightCache | null>(null);
  const lightReadouts: { id: string; position: { x: number; y: number }; lift: number; percent: number; level: LightLevel }[] = [];
  const [hoverCell,setHoverCell] = useState<GridCell>(TRUE_CENTER.cell);
  // Hover, keyboard focus, touch and scene/choreography pins share one label.
  // A tap keeps the label up briefly; pins last for their owning scene.
  const [labelHoverId, setLabelHoverId] = useState<string | null>(null);
  const [labelTapId, setLabelTapId] = useState<string | null>(null);
  useEffect(() => {
    if (!labelTapId) return;
    const timer = gameTime.setTimeout(() => setLabelTapId(null), LABEL_TAP_MS);
    return () => gameTime.clearTimeout(timer);
  }, [labelTapId]);
  const cameraPlayback = useCameraPlayback();
  const pinnedLabels = new Set([...persistentTileLabelIds, ...cameraPlayback.tileLabelIds]);
  const labelShown = (ids: readonly string[]) => ids.some(id => id === labelHoverId || id === labelTapId || pinnedLabels.has(id)) || undefined;
  const labelReveal = (id: string) => ({
    onPointerEnter: (event: React.PointerEvent) => { if (event.pointerType !== 'touch') setLabelHoverId(id); },
    onPointerLeave: (event: React.PointerEvent) => { if (event.pointerType !== 'touch') setLabelHoverId(current => current === id ? null : current); },
    // Keyboard focus only; a click or tap also focuses the button.
    onFocus: (event: React.FocusEvent) => { if (event.currentTarget.matches(':focus-visible')) setLabelHoverId(id); },
    onBlur: () => setLabelHoverId(current => current === id ? null : current),
  });
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
  const actorClickClaimed = useRef(false);
  const resourcePointerDragRef = useRef<{ stackId: string; pointerId: number } | null>(null);
  const [draggingResourceId, setDraggingResourceId] = useState<string | null>(null);
  useHeldVisual(() => document.querySelector<HTMLElement>('.proto-resource-stack.cursor-grabbing'), Boolean(draggingResourceId));
  const travelingActorRef = useRef<string | null>(null);
  const liveTravel = useRef(travel);
  const hadJourney = useRef(false);
  useEffect(() => {
    if (journey) { hadJourney.current = true; return; }
    if (hadJourney.current) {
      hadJourney.current = false;
      travelingActorRef.current = null;
      liveTravel.current = null;
      travelPose.current = null;
      setTravel(null);
    }
  }, [journey]);
  // React holds a bounded scene snapshot; the travel clock owns live progress.
  const travelPose = useRef<{ actorId: string; position: { x: number; y: number }; heading: number } | null>(null);
  const getTravelPose = useCallback(() => travelPose.current, []);
  const travelFrames = useRef(new Set<(now: number) => void>());
  const closeupTripOverride = useRef<TimedPoint[] | null>(null);
  const departureTrip = useRef<{ path: unknown; camera: DepartureCamera } | null>(null);
  if (travel && matchesDeparture(departureCamera, travel.actorId, travel.path) && departureTrip.current?.path !== travel.path) departureTrip.current = { path: travel.path, camera: departureCamera };
  if (!travel) departureTrip.current = null;
  const followTiltRef = useRef(tilted);
  followTiltRef.current = tilted;
  useEffect(() => {
    const authored = departureTrip.current?.path === travel?.path ? departureTrip.current?.camera : undefined;
    if (travel && closeup && !authored) closeupTripOverride.current = travel.path;
    if (!travel || !tilted || !authored && (!followTravelingActor || closeup || closeupTripOverride.current === travel.path)) return;
    if (authored) stopCameraPlayback();
    const initialView = camera.getLiveCamera();
    const initialShot = { ...shotFromCamera(initialView, tilted, getCameraTilt(initialView).angle), framing: (initialView.aimY ?? 0) / Math.max(1, viewportHeight) };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let enteredImmersion = tilted;
    let lastTime = gameTime.now();
    let shotTime = 0;
    let steadyUntil = 0;
    let previous = pointAlongTimedPath(travel.path, travel.progress);
    let heading = movementHeading(travel.path[1] ?? previous, { ...previous, heading: 0 });
    const tick = (now: number) => {
      // The global O handler consumes key events before local listeners.
      // Observe its mode change too, so returning to OTT releases tracking.
      if (followTiltRef.current) enteredImmersion = true;
      else if (enteredImmersion) { cancel(); return; }
      if (cameraIsPlaying()) { lastTime = now; return; }
      const trip = liveTravel.current;
      if (!trip) return;
      const elapsed = Math.min(64, Math.max(0, now - lastTime));
      lastTime = now;
      if ((cinematicTravel || authored) && (journeyRef.current?.paused || journeyRef.current?.blocked)) return;
      const steady=now<steadyUntil;
      if(!steady || authored)shotTime += elapsed;
      const position = pointAlongTimedPath(trip.path, trip.progress);
      heading = movementHeading(position, { ...previous, heading });
      let next=authored ? sampleDepartureCamera(authored, initialShot, position, shotTime, viewportHeight, reducedMotion) : cinematicTravel
        ? cinematicTravelCamera(position, heading, camera.getLiveCamera(), elapsed, shotTime, Object.keys(journeyRef.current?.memberRanks ?? {}).length, reducedMotion, Boolean(travelTableau), viewportWidth)
        : followingCamera(position, heading, camera.getLiveCamera(), CLASSICPLUS_ZOOM_REFERENCE_SCALE * 3, elapsed, reducedMotion);
      if(!authored&&cinematicTravel&&travelTableau){
        const stations=Array.from(camera.containerRef.current?.querySelectorAll<HTMLElement>('.travel-world-station')??[])
          .filter(el=>el.querySelector('[data-exposed="true"]'))
          .map(el=>({x:Number(el.dataset.worldX),y:Number(el.dataset.worldY),heading:Number(el.dataset.worldHeading),elevation:Number(el.dataset.worldElevation)}));
        next=frameTravelCards(position,stations,{width:viewportWidth,height:viewportHeight},camera.getLiveCamera(),{
          ...next,scale:immersiveTileScale(viewportWidth),yaw:heading*180/Math.PI+180+(reducedMotion?0:Math.sin(shotTime/16000)*3),
        },elapsed,steady,reducedMotion);
      }
      camera.setCameraFrame(next,false);
      previous = position;
      lastTime = now;
    };
    travelFrames.current.add(tick);
    // Explicit camera input takes over for the rest of this trip.
    const cancel = () => { travelFrames.current.delete(tick); camera.syncCamera(); };
    const key = (event: KeyboardEvent) => {
      if((event.target as Element)?.closest('[data-world-card]')&&['Enter'].includes(event.code)){steadyUntil=gameTime.now()+650;return;}
      if (['KeyO', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) cancel();
    };
    const viewport = camera.containerRef.current;
    const toolbar = viewport?.closest('.proto-map')?.querySelector('.proto-map-toolbar');
    const pointer=(event:PointerEvent)=>{
      if(event.button===0&&((event.target as Element)?.closest('[data-world-card]')||viewport&&exposedTravelCardAt(viewport,event.clientX,event.clientY))){steadyUntil=gameTime.now()+650;return;}
      if(event.button===0&&(event.target as Element)?.closest('[data-camera-ignore]'))return;
      cancel();
    };
    viewport?.addEventListener('pointerdown', pointer, true);
    viewport?.addEventListener('wheel', cancel);
    toolbar?.addEventListener('pointerdown', cancel);
    toolbar?.addEventListener('click', cancel);
    window.addEventListener('keydown', key);
    return () => {
      cancel();
      viewport?.removeEventListener('pointerdown', pointer, true);
      viewport?.removeEventListener('wheel', cancel);
      toolbar?.removeEventListener('pointerdown', cancel);
      toolbar?.removeEventListener('click', cancel);
      window.removeEventListener('keydown', key);
    };
  }, [travel?.actorId, tilted, followTravelingActor, cinematicTravel, closeup, Boolean(travelTableau), viewportWidth, viewportHeight, camera.getLiveCamera, camera.setCameraFrame, camera.syncCamera]);
  // Move only the actor and its attached pieces on the compositor frame. Heavy
  // world lighting/scenery can consume snapshots without quantizing the gait.
  const paintTravelActor = useCallback(() => {
    const pose = travelPose.current, viewport = camera.containerRef.current;
    if (!pose || !viewport) return;
    const { actorId, position, heading } = pose;
    const ids = Object.keys(journeyRef.current?.memberRanks ?? { [actorId]: 0 });
    const selector = ids.map(id => `[data-travel-actor="${id}"], [data-cell-grip="actor-${id}"], [data-actor-name-owner="${id}"]`).join(',');
    viewport.querySelectorAll<HTMLElement>(selector).forEach(el => {
      el.style.left = `calc(50% + ${position.x}px)`;
      el.style.top = `calc(50% + ${position.y}px)`;
      if (el.dataset.boardPiece === 'actor') {
        el.dataset.actorX = String(position.x); el.dataset.actorY = String(position.y);
        el.dataset.actorHeading = String(heading);
        el.dataset.gridReference = TABLE_GRID.reference(TABLE_GRID.atWorld(position));
        if (el.classList.contains('proto-actor-overhead')) el.style.transform = worldActorTransform(heading + Math.PI, false);
        else if(el.dataset.actorOrientation==='world-plane'&&el.classList.contains('proto-sprite-standee')){
          const factor=Number.parseFloat(el.style.width)/Number(el.dataset.actorWidth);
          el.style.transform=`${worldActorTransform(heading,true,factor)} scale(var(--actor-world-scale, 1))`;
        }
      }
    });
  }, [camera.containerRef]);
  useLayoutEffect(paintTravelActor);
  const resourcePhysicsRef = useRef<Map<string, ResourcePhysicsBody>>(new Map());
  const resourceStacksRef = useRef(resourceStacks);
  const [, setResourcePhysicsTick] = useState(0);
  resourceStacksRef.current = resourceStacks;

  useEffect(() => {
    const viewport = camera.containerRef.current;
    if (!viewport) return undefined;
    const update = () => {
      if (viewport.clientHeight && viewport.clientWidth) { setViewportHeight(viewport.clientHeight); setViewportWidth(viewport.clientWidth); }
      setRasterScale(standeeRasterScale(window.devicePixelRatio, STANDEE_OVERSAMPLE));
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  const exitCloseup = useCallback((restore = true) => {
    const saved = closeupRef.current;
    if (!saved) return;
    closeupRef.current = null;
    setCloseup(null);
    if (restore) {
      camera.setCameraState(saved.camera);
      onTiltedChange?.(saved.tilted);
    }
  }, [camera.setCameraState, onTiltedChange]);
  // The target owns translation; wheel/pinch retain their normal zoom and
  // Q/E or a middle-button/touch twist orbit around the actor's fixed position.
  const closeupActors = useRef(actors);
  closeupActors.current = actors;
  useEffect(() => {
    if (!closeup || inactive) return;
    let frame = 0;
    const tick = () => {
      const actor = closeupActors.current.find(actor => actor.id === (selectedActorId ?? closeup.actorId));
      if (!actor) { exitCloseup(); return; }
      const position = (travelPose.current?.actorId === actor.id || Boolean(travelPose.current && journey?.memberRanks?.[actor.id] !== undefined)) ? travelPose.current!.position : getActorWorldPosition(actor);
      const live = camera.getLiveCamera(), centered = actorCloseupCamera(position, live);
      if (Math.abs(centered.x - live.x) > .001 || Math.abs(centered.y - live.y) > .001)
        camera.setCameraFrame(centered, false, true);
      frame = gameTime.requestAnimationFrame(tick);
    };
    frame = gameTime.requestAnimationFrame(tick);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') exitCloseup(); };
    window.addEventListener('keydown', key);
    return () => { gameTime.cancelAnimationFrame(frame); window.removeEventListener('keydown', key); };
  }, [closeup, inactive, selectedActorId, exitCloseup, camera.getLiveCamera, camera.setCameraFrame]);
  useEffect(() => { if (closeup && !tilted) { exitCloseup(false); camera.setCameraState(closeup.camera); } }, [tilted, closeup, exitCloseup, camera.setCameraState]);
  useMapCameraDirector({ enabled: !cameraDirectorDisabled, viewport: camera.containerRef, getCamera: camera.getLiveCamera, setFrame: camera.setCameraFrame, sync: camera.syncCamera, tilted, pitch: live => getCameraTilt(live).angle, setTilted: onTiltedChange, begin: () => exitCloseup(false), paused: Boolean(journey?.paused) });
  /** Eases the spin back to 0° the short way round. */
  const unspin = () => camera.spinTo(Math.round((camera.getLiveCamera().yaw ?? 0) / 360) * 360);
  const resetProtoCamera = () => {
    exitCloseup(false);
    camera.setCameraState((previous) => ({ ...previous, x: 0, y: 0, scale: CLASSICPLUS_ZOOM_REFERENCE_SCALE, pitch: undefined, aimY:undefined }));
    unspin();
  };

  // Keyboard camera: Q and E turn it 45° (eased); W, A, S and D glide it
  // relative to the view while held, so W always heads for the far side of
  // the screen at any spin. Only editable text/data fields keep letter keys;
  // focusing a card preview, dialog or button must not disable the camera.
  const { spinStep, panBy, syncCamera } = camera;
  useEffect(() => {
    if (inactive) return;
    const held = new Set<string>();
    let frame = 0;
    let last = 0;
    const PAN_SPEED = 560; // screen px per second
    const glide = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const x = (held.has('a') ? 1 : 0) - (held.has('d') ? 1 : 0);
      const y = (held.has('w') ? 1 : 0) - (held.has('s') ? 1 : 0);
      const length = Math.hypot(x, y);
      if (length) panBy((x / length) * PAN_SPEED * dt, (y / length) * PAN_SPEED * dt);
      frame = held.size ? gameTime.requestAnimationFrame(glide) : 0;
      if (!frame) syncCamera();
    };
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isTextEditingTarget(event.target)) return;
      if (gameTime.isPaused()) return;
      const key = event.key.toLowerCase();
      if (key === 'q' || key === 'e') {
        if (!event.repeat) spinStep(key === 'q' ? -45 : 45);
        event.preventDefault();
        return;
      }
      if (closeupRef.current || !['w', 'a', 's', 'd'].includes(key)) return;
      event.preventDefault();
      event.stopPropagation();
      held.add(key);
      if (!frame) { last = gameTime.now(); frame = gameTime.requestAnimationFrame(glide); }
    };
    const up = (event: KeyboardEvent) => held.delete(event.key.toLowerCase());
    const release = () => held.clear();
    const unpause = gameTime.subscribe(() => { if (gameTime.isPaused()) release(); });
    const focus = (event: FocusEvent) => { if (isTextEditingTarget(event.target)) release(); };
    const visibility = () => { if (document.hidden) release(); };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('focusin', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up);
      unpause();
      window.removeEventListener('blur', release);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('visibilitychange', visibility);
      gameTime.cancelAnimationFrame(frame);
    };
  }, [inactive, spinStep, panBy, syncCamera, tilted, closeup, onTiltedChange]);

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
    let previousTime = gameTime.now();
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
      frame = gameTime.requestAnimationFrame(tick);
    };
    frame = gameTime.requestAnimationFrame(tick);
    return () => gameTime.cancelAnimationFrame(frame);
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
  const planRoute = (actorId: string, target: { x: number; y: number }, arrival: { biomeId?: string } = {}, controls?: readonly { x: number; y: number }[]) => {
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
    if (isBlockedPoint(snappedTarget) || biomeTiles.some(tile => !tile.flags?.includes('unexplored') && !tile.passage && tile.tileType === 'impassable-mountain' && TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position)) === TABLE_GRID.reference(TABLE_GRID.atWorld(snappedTarget)))) return null;
    const cellCosts = new Map<string, number>();
    const mark = (column: number, row: number, cost: number) => {
      const key = `${column},${row}`;
      cellCosts.set(key, Math.max(cellCosts.get(key) ?? 1, cost));
    };
    biomeTiles.forEach((tile) => {
      const area = getBiomeWorldFootprint(tile);
      const cost = tile.flags?.includes('unexplored') ? 1 : tile.unlocked === false || !tile.passage && (tile.tileType === 'impassable-mountain' || tile.flags?.includes('impassable')) || tile.flags?.includes('danger') && tile.id !== arrival.biomeId ? Infinity : 1 + Math.min(100, traversalProfile(tile, origin.traversalAffinity).difficulty) * .000000001;
      for (let column = 0; column < Math.round(area.width / CLASSICPLUS_GRID_SIZE); column += 1)
        for (let row = 0; row < Math.round(area.height / CLASSICPLUS_GRID_SIZE); row += 1)
          mark(area.first.column + column, area.first.row + row, cost);
    });
    buildings.forEach((stack) => { const cell = TABLE_GRID.atWorld(stack.position); mark(cell.column, cell.row, Infinity); });
    const cost = (column: number, row: number) =>
      isBlockedPoint({ x: column * CLASSICPLUS_GRID_SIZE, y: row * CLASSICPLUS_GRID_SIZE }) ? Infinity : cellCosts.get(`${column},${row}`) ?? 1;
    const goal = TABLE_GRID.atWorld(snappedTarget);
    const routeCost = (column: number, row: number) => destinationBuilding && column === goal.column && row === goal.row ? 1 : cost(column, row);
    routeCost.canStep = (x:number,y:number,nx:number,ny:number) => passageStepAllowed(sourceBiomeTiles,x,y,nx,ny);
    if (!Number.isFinite(routeCost(goal.column, goal.row))) return null;
    const path = controls ? routeThroughTravelCells(originPoint, snappedTarget, controls, routeCost) : findGridPath(originPoint, snappedTarget, routeCost, CLASSICPLUS_GRID_SIZE);
    if (!path || path.length === 0 || path.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
    return { path, target: snappedTarget };
  };

  const startActorTravel = (
    actorId: string,
    target: { x: number; y: number },
    arrival: { biomeId?: string; directBiome?: boolean; foundationIndex?: number } = {},
  ) => {
    const origin = actorOrigins.find((actor) => actor.id === actorId);
    if (!origin || journeyRef.current && !journeyRef.current.blocked || pendingTravel || travelingActorRef.current) return;
    const current = origin.location === 'foundation' && origin.biomeId ? resolveBiomeActorCell(origin.biomeId) ?? origin.position : origin.position;
    if (sameTravelCell(current, target)) { clearActorDragState(); setRouteBlocked(false); return; }
    const route = planRoute(actorId, target, arrival);
    clearActorDragState();
    if (!route) { setRouteBlocked(true); return; }
    setRouteBlocked(false);
    setEditingTravelRoute(true); setRouteEditError(''); setTravelControls([TABLE_GRID.snap(route.path[route.path.length - 1])]);
    setPendingTravel(planTravel(actorId, route.path, sourceBiomeTiles, arrival, origin.traversalAffinity));
  };
  useEffect(() => {
    if(!journey?.blocked || travel || pendingTravel)return;
    const target=journey.path[journey.path.length-1];
    const route=planRoute(journey.actorId,target,journey.arrival);
    setRouteEditError(journey.blocked.message); setEditingTravelRoute(true);
    const plan=route ? planTravel(journey.actorId,route.path,sourceBiomeTiles,journey.arrival,actorOrigins.find(a=>a.id===journey.actorId)?.traversalAffinity) : {...journey, path:[{...journey.blocked.position,pace:0},target], estimate:Infinity};
    setPendingTravel(plan);setTravelControls(route ? [TABLE_GRID.snap(route.path[route.path.length - 1])]:[]);
  }, [journey?.blocked,travel]);
  const confirmTravel = () => {
    if (!pendingTravel || pendingTravel.estimate > travelStamina || travelAllowed && !travelAllowed(pendingTravel)) return;
    const plan = pendingTravel;
    const trip = { actorId: plan.actorId, label: actorOrigins.find(a => a.id === plan.actorId)?.label ?? 'Actor', path: plan.path, progress: 0, arrival: plan.arrival };
    travelingActorRef.current = plan.actorId;
    liveTravel.current = trip;
    if (matchesDeparture(departureCamera, trip.actorId, trip.path) || followTravelingActor && cinematicTravel) {
      exitCloseup(false);
      closeupTripOverride.current = null;
      onTiltedChange?.(true);
    }
    setTravel(trip); setPendingTravel(null); onConfirmTravel?.(plan);

  };

  useEffect(() => {
    if (!initialCenter) return;
    const view = camera.getLiveCamera();
    camera.setCameraFrame({ ...view, x: -initialCenter.x * view.scale, y: -initialCenter.y * view.scale });
    camera.syncCamera();
  }, [initialCenter?.x, initialCenter?.y]);

  // Scenario actions can start a normal card-driven journey without a map drag.
  // The map still owns walking, camera follow and the arrival callback.
  useEffect(() => {
    if (!journey || travelingActorRef.current) return;
    const trip = { actorId: journey.actorId, label: actorOrigins.find(a => a.id === journey.actorId)?.label ?? 'Actor', path: journey.path, progress: 0, arrival: journey.arrival };
    travelingActorRef.current = journey.actorId; liveTravel.current = trip;
    if (matchesDeparture(departureCamera, trip.actorId, trip.path) || followTravelingActor && cinematicTravel) { exitCloseup(false); closeupTripOverride.current = null; onTiltedChange?.(true); }
    setPendingTravel(null); setTravel(trip);
  }, [journey?.path]);

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

    const startedAt = gameTime.now();
    let lastTime = startedAt;
    let frame = 0;
    let previousProgress = travel.progress;
    let travelVelocity = 0;
    let lastScene = startedAt;
    const tick = (now: number) => {
      const earned = journeyRef.current?.blocked?.progress ?? (journeyRef.current?.paused ? previousProgress : journeyRef.current?.progress ?? 0);
      const totalCost=Math.max(.001,pathTime(travel.path));
      const motion=advanceTravelBuffer(previousProgress*totalCost,travelVelocity,earned*totalCost,now-lastTime,Boolean(journeyRef.current?.paused));
      travelVelocity=motion.speed;
      let progress=motion.position/totalCost;
      camera.containerRef.current?.setAttribute('data-travel-speed',String(travelVelocity));
      camera.containerRef.current?.setAttribute('data-travel-buffer',String(Math.max(0,(earned-progress)*totalCost)));
      for(const segment of journeyRef.current?.segments ?? []) {
        if(segment.start >= previousProgress-1e-9 && segment.start <= progress+1e-9 && onTravelCheckpoint?.(segment.start)===false) { progress=segment.start; break; }
      }
      const block=journeyRef.current?.blocked;
      if(block)progress=Math.min(progress,block.progress);
      lastTime = now;
      const current = pointAlongTimedPath(travel.path, progress);
      const previousPose = actorHeadings.current.get(travel.actorId);
      const heading = movementHeading(current, previousPose);
      actorHeadings.current.set(travel.actorId, { ...current, heading });
      const inDen = biomeTiles.some(tile => tile.tileType === 'hero-den' && TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position)) === TABLE_GRID.reference(TABLE_GRID.atWorld(current)));
      travelPose.current = { actorId: travel.actorId, position: current, heading: followTiltRef.current && inDen ? Math.PI : heading };
      liveTravel.current = { ...travel, progress };
      paintTravelActor();
      travelFrames.current.forEach(listener => listener(now));
      // Follow every intervening route leg when a slow frame skips a corner;
      // a straight chord would discover tiles the actor never approached.
      const notifyEntry = (from: {x:number;y:number}, to: {x:number;y:number}) => {
        const tileAt = (point: {x:number;y:number}) => biomeTiles.find(tile => { const area = getBiomeWorldFootprint(tile); return point.x >= area.left && point.x < area.right && point.y >= area.top && point.y < area.bottom; });
        const entered = tileAt(to); if (entered && entered.id !== tileAt(from)?.id) onEnterTile?.(travel.actorId, entered.id);
      };
      const remaining = remainingPath(travel.path, previousProgress);
      let elapsed = pathTime(travel.path) * (progress - previousProgress);
      for (let i = 1; i < remaining.length; i++) {
        const cost = Math.hypot(remaining[i].x - remaining[i - 1].x, remaining[i].y - remaining[i - 1].y) * remaining[i].pace;
        if (cost > elapsed) {
          notifyEntry(remaining[i - 1], current);
          if (!journeyRef.current) onActorExplore?.(travel.actorId, remaining[i - 1], current);
          break;
        }
        notifyEntry(remaining[i - 1], remaining[i]);
        if (!journeyRef.current) onActorExplore?.(travel.actorId, remaining[i - 1], remaining[i]);
        elapsed -= cost;
      }
      previousProgress = progress;
      // Expensive lighting snapshots are independent of movement frames.
      if (now - lastScene >= 250 && progress < 1) {
        lastScene = now;
        onTravelPaint?.(progress);
        setTravel(liveTravel.current);
      }
      if (journeyRef.current?.blocked && progress >= journeyRef.current.blocked.progress-1e-9) {
        travelingActorRef.current=null; liveTravel.current=null; travelPose.current=null; setTravel(null);
        return;
      }
      if (progress < 1 || journeyRef.current && travelTableauHeld(journeyRef.current) || journeyRef.current?.pendingSearch !== undefined || journeyRef.current?.search) {
        frame = gameTime.requestAnimationFrame(tick);
      } else {
        const destination = travel.path[travel.path.length - 1] ?? travel.path[0];
        travelingActorRef.current = null;
        liveTravel.current = null;
        travelPose.current = null;
        setTravel(null);
        onTravelPaint?.(progress);
        onFinishTravel?.();
        if (destination) onDropActorToTable(travel.actorId, destination, travel.arrival);
      }
    };
    frame = gameTime.requestAnimationFrame(tick);
    return () => gameTime.cancelAnimationFrame(frame);
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

  const inspectionTargetAt = (x:number,y:number) => {
    if(onEditCell||inactive||!onInspectTile)return null;
    const cell=TABLE_GRID.atWorld(worldPointFromClient(x,y));
    const tile=biomeTiles.find(t=>{const a=getBiomeWorldFootprint(t);return cell.column>=a.first.column&&cell.column<a.first.column+t.gridSize.columns&&cell.row>=a.first.row&&cell.row<a.first.row+t.gridSize.rows;});
    if(!tile||tile.flags?.includes('unexplored')||tile.unlocked===false)return null;
    const anchor=camera.containerRef.current?.querySelector<HTMLElement>(`button[data-biome-id="${tile.id}"]`);
    return anchor?{id:tile.id,anchor}:null;
  };
  const tileHold=useTileInspectionHold(inspectionTargetAt,target=>{clearActorDragState();onInspectTile?.(target.id,target.anchor);});

  const changeTravelControl = (index: number, point: { x: number; y: number }, original = travelControls) => {
    if (!pendingTravel) return;
    const controls = original.map((value, i) => i === index ? TABLE_GRID.snap(point) : value);
    const target = controls[controls.length - 1];
    const previousTarget = pendingTravel.path[pendingTravel.path.length - 1];
    const destinationTile = sourceBiomeTiles.find(tile => {
      if (tile.unlocked === false || tile.flags?.includes('unexplored')) return false;
      const area = getBiomeWorldFootprint(tile);
      return target.x >= area.left && target.x < area.right && target.y >= area.top && target.y < area.bottom;
    });
    const arrival = sameTravelCell(target, previousTarget) ? pendingTravel.arrival : destinationTile ? { biomeId: destinationTile.id } : {};
    const route = planRoute(pendingTravel.actorId, target, arrival, controls.slice(0, -1));
    if (!route) { setRouteEditError('That grid is blocked or unreachable. The last legal route is preserved.'); return; }
    setRouteEditError(''); setTravelControls(controls);
    const actor = actorOrigins.find(a => a.id === pendingTravel.actorId);
    setPendingTravel(planTravel(pendingTravel.actorId, route.path, sourceBiomeTiles, arrival, actor?.traversalAffinity));
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
    (travelPose.current?.actorId === actor.id || Boolean(travelPose.current && journey?.memberRanks?.[actor.id] !== undefined)) ? travelPose.current!.position : actor.location === 'foundation' && actor.biomeId
      ? resolveBiomeActorCell(actor.biomeId) ?? actor.position
      : actor.position,
  );

  // Placed lights plus the light each actor carries. Keyed by content so the
  // canvas effect only reruns when a light actually changes.
  // A travelling actor's light moves with it along its path, frame by frame.
  const travelPosition = travel ? pointAlongTimedPath(travel.path, travel.progress) : null;
  const actorIsInDen = (_actor: ProtoWorldActor, position: { x: number; y: number }) => biomeTiles.some(tile => tile.tileType === 'hero-den'
      && TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position)) === TABLE_GRID.reference(TABLE_GRID.atWorld(position)));
  // Den artwork is a presentation pose, independent of the bedtime gameplay state.
  // Only actors with both authored views can replace their normal map sprite.
  const denRestActors: readonly string[] = ['hero', 'mochi'];
  const actorIsSleeping = (actor: ProtoWorldActor, position: { x: number; y: number }) => actorIsInDen(actor, position)
    && denRestActors.includes(actor.id)
    && travel?.actorId !== actor.id;
  const actorIsCuddling = (actor: ProtoWorldActor, position: { x: number; y: number }) => actorIsSleeping(actor, position)
    && actors.some(other => other.id !== actor.id && actorIsSleeping(other, getActorWorldPosition(other))
      && TABLE_GRID.reference(TABLE_GRID.atWorld(getActorWorldPosition(other))) === TABLE_GRID.reference(TABLE_GRID.atWorld(position)));
  const sleepingArtName = (actor: ProtoWorldActor, position: { x: number; y: number }) => actorIsCuddling(actor, position) ? 'hero-mochi' : actor.id;
  const actorArt = (actor: ProtoWorldActor, position: { x: number; y: number }) => actorIsSleeping(actor, position)
    ? actorSprite(`${import.meta.env.BASE_URL}assets/actors/${sleepingArtName(actor, position)}-sleeping.png`, artStyle)
    : actor.id === 'hero' && travel?.actorId !== actor.id
      ? `${import.meta.env.BASE_URL}assets/actors/hero-sitting.png` : actor.sprite;
  const actorLights = actors.flatMap(actor => actorLight(actor.id, (travel?.actorId === actor.id || Boolean(travel && journey?.memberRanks?.[actor.id] !== undefined)) && travelPosition ? travelPosition : getActorWorldPosition(actor), actor.luminosity, actor.lightColor) ?? []);
  const lightKey = JSON.stringify([placedLights, actorLights]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lightSources = useMemo(() => [...placedLights, ...actorLights], [lightKey]);
  // Steady light the game world can read per object; rendering adds flicker on top.
  const lightField = createTableLightField(timeOfDay, lightSources, BLOCKED_REGIONS);

  useEffect(() => {
    const canvas = lightCanvasRef.current;
    const viewport = camera.containerRef.current;
    if (!upright || !canvas || !viewport || boundedGroundLight && airReady) return undefined;
    globalLightCache.current ??= { canvas:document.createElement('canvas'),key:'' };
    const frame = getVisualTableLighting(timeOfDay);
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
    draw(gameTime.now());
    const unfollow = camera.onCameraFrame(follow);
    const observer = new ResizeObserver(() => { surfaceWidth = surface.offsetWidth; surfaceHeight = surface.offsetHeight; draw(gameTime.now()); });
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
  }, [globalLights, lightSources, timeOfDay, staged, upright, boundedGroundLight, airReady, camera.cameraState.x, camera.cameraState.y, camera.cameraState.scale, camera.getLiveCamera, camera.onCameraFrame]);

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
      return path.length > 1 ? { path } : null;
    }
    if (pendingTravel) return { path: pendingTravel.path };
    if (!dragPlan?.route) return null;
    return { path: dragPlan.route.path };
  })();
  // Ink bounds turn only when the label snaps to another tile edge, so the
  // route passes under the same physical label in each orientation.
  const labelQuads = biomeTiles.flatMap((tile) => {
    const box = biomeLabelBoxes[tile.id];
    const region = labelRegions.find(region => region.tiles.some(member => member.id === tile.id));
    if (!box || !labelShown(region ? region.tiles.map(member => member.id) : [tile.id])) return [];
    const centre = getBiomeWorldFootprint(tile), pivot = box.pivot ?? { x: 0, y: 0 };
    return [[[box.left - 2, box.top - 2], [box.right + 2, box.top - 2], [box.right + 2, box.bottom + 2], [box.left - 2, box.bottom + 2]].map(([x, y]) => {
      const turned = rotateVector({ x: x - pivot.x, y: y - pivot.y }, box.rotation ?? 0);
      return { x: centre.x + pivot.x + turned.x, y: centre.y + pivot.y + turned.y };
    })];
  });

  // Tilted, every tile's edge scenery is laid out together, so neighbouring
  // tiles share one run along their seam (biomeEdgeScenery.ts).
  const sceneryTiles = biomeTiles.filter((tile) => tile.id !== 'curious-sapling' && tile.unlocked !== false && !tile.road && !tile.tileType && !tile.flags?.includes('unexplored')).map((tile) => {
    const area = getBiomeWorldFootprint(tile);
    return { id: tile.id, centre: { x: area.x, y: area.y }, size: { width: area.width, height: area.height }, terrain: tile.terrain ?? 'woods',
      // Author placement in a fixed world frame; live label fitting must not
      // move or resize physical scenery when the camera turns.
      scenery: (()=>{const scenery=BIOME_EDGE_SCENERY[tile.terrain === 'water' ? 'water' : 'woods'];
        return {side:{...scenery.side,src:scenerySprite(scenery.side.src,artStyle)!},front:{...scenery.front,src:scenerySprite(scenery.front.src,artStyle)!}};})(),
      label: { left: -area.width * .25, right: area.width * .25, top: -8, bottom: 8 } };
  });
  const tableScenery = upright ? layoutTableScenery(sceneryTiles, 60, 0) : {};
  const sparseApproaches = useRef(new Map<string, { horizontal: boolean; sign: number }>());
  const sketchTraveler = (area: { x: number; y: number }) => {
    const moving = actors.find(actor => actor.id === travel?.actorId);
    if (moving) return travelPosition ?? getActorWorldPosition(moving);
    return actors.map(getActorWorldPosition).sort((a,b) =>
      Math.hypot(a.x-area.x,a.y-area.y)-Math.hypot(b.x-area.x,b.y-area.y))[0] ?? area;
  };
  const sketchPending = (tile: ProtoBiomeTile) => tile.traversalProgress !== undefined && tile.traversalProgress < 1;
  const reliefSketch = Object.fromEntries(biomeTiles.filter(sketchPending).map(tile =>
    [tile.id, adjacentSketchProgress(tile, biomeTiles, TABLE_GRID.cellSize)]));
  for (const tile of biomeTiles) {
    if (tile.id !== 'curious-sapling' && tile.unlocked !== false && !tile.flags?.includes('unexplored') && tile.sprite &&
      ((!tile.tileType && !tile.road && tile.terrain !== 'water') || tile.tileType === 'berry-patch')) {
      const area = getBiomeWorldFootprint(tile);
      if (tile.berryPatchVariant === 'sparse') {
        const key = `${tile.id}:${area.x},${area.y}`;
        if (!sparseApproaches.current.has(key)) sparseApproaches.current.set(key, sketchApproach(area, sketchTraveler(area)));
        tableScenery[tile.id] = [sparseBerryBush(`${import.meta.env.BASE_URL}assets/biomes/watercolor-v1/manaberry-sparse-standee-v1.png`, area.width, area.height, sparseApproaches.current.get(key)!)];
        continue;
      }
      tableScenery[tile.id] = populateScenery({id:'tree',edge:'front',src:tile.tileType === 'berry-patch' ? tile.sprite : `${import.meta.env.BASE_URL}assets/biomes/watercolor-v1/pine-sprite-v1.png`,x:0,y:0,width:24,height:36,flip:false},
        populationDensity(tile.populationDensity, tile.tileType !== 'berry-patch'), area.width, area.height,
        sketchPending(tile) ? sketchApproach(area,sketchTraveler(area)) : undefined);
      continue;
    }
    if (!sketchPending(tile) || !tableScenery[tile.id]) continue;
    const area = getBiomeWorldFootprint(tile);
    const border = sketchBorderProps(tableScenery[tile.id], area, sketchTraveler(area));
    // The main relief occupies the first corner; avoid stacking another tree there.
    tableScenery[tile.id] = tile.sprite ? border.slice(1) : border;
  }
  // One placement for both visible pop-ups and the atmosphere's canopy atlas.
  const biomePopups = new Map(biomeTiles.map(tile => {
    const area = getBiomeWorldFootprint(tile);
    const occupied = actors.some(actor => {
      const position = (travel?.actorId === actor.id || Boolean(travel && journey?.memberRanks?.[actor.id] !== undefined)) && travelPosition ? travelPosition : getActorWorldPosition(actor);
      return TABLE_GRID.reference(TABLE_GRID.atWorld(position)) === TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position));
    });
    // The empty cave meets the north tile edge beside the mountain props.
    // Retain the sleeping hollow's depth while an actor occupies it. The shared
    // footprint fitter keeps the complete foot line just inside the tile.
    const back = { x: 0, y: propVolumeRecipe(tile.sprite)||isPaintedScenerySprite(tile.sprite) ? 0 : area.height * (tile.tileType === 'hero-den' && occupied ? .24 : -.37) };
    const piece = terrainPieces.get(tile.id);
    const position = { x:area.x+back.x+(piece?.dx ?? 0), y:area.y+back.y+(piece?.dy ?? 0) };
    if (sketchPending(tile) && tile.tileType !== 'hero-den') {
      const { horizontal, sign } = sketchApproach(area, sketchTraveler(area));
      position.x = area.x + area.width * .38 * (horizontal ? sign : -1);
      position.y = area.y + area.height * .38 * (horizontal ? -1 : sign);
    }
    const size = tile.tileType === 'hero-den' ? 46 : BIOME_POPUP_SIZE * (piece?.scale ?? 1);
    const terrainOwner = terrainOwners.get(tile.id) ?? area;
    const owner = tile.tileType === 'hero-den' || tile.tileType === 'impassable-mountain' || tile.flags?.includes('impassable') ? terrainOwner : walkableSceneryOwner(position, terrainOwner);
    const fitted = propVolumeRecipe(tile.sprite)||isPaintedScenerySprite(tile.sprite) ? fitSceneryVolumeFootprint(position, size, size, owner) : fitSceneryFootprint(position, size, size, owner, 0);
    const directional=tile.tileType==='hero-den'?denView:null;
    return [tile.id,{ position: fitted.position, size: fitted.width, requestedSize: size, requestedPosition: position, owner, flip: directional?.flip ?? piece?.flip ?? false,
      // A neighbour-aware piece may swap in its own art beside the tile's sprite.
      sprite: directional?.src ?? (piece?.art && tile.sprite ? scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/${piece.art}`,artStyle) : tile.sprite) }] as const;
  }));
  const warmSceneryKey = JSON.stringify([
    ...biomeTiles.filter(tile => !tile.flags?.includes('unexplored')).flatMap(tile => {
      const popup = biomePopups.get(tile.id);
      return popup?.sprite && propVolumeRecipe(popup.sprite) ? [{ sprite: popup.sprite, flip: popup.flip }] : [];
    }),
    ...terrainSeams.map(seam => ({ sprite: scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/${seam.src}`,artStyle)!, flip: seam.flip })),
  ]);
  useEffect(() => prewarmPropVolumes(JSON.parse(warmSceneryKey)), [warmSceneryKey]);
  useEffect(() => {
    const readout = camera.containerRef.current?.closest('.proto-map')?.querySelector<HTMLElement>('.proto-map-zoom');
    const draw = (live: { scale: number }) => {
      const text = closeupRef.current ? 'Close-up ' + (live.scale / closeupRef.current.camera.scale).toFixed(1) + '×' : `Zoom ${Math.round(live.scale / CLASSICPLUS_ZOOM_REFERENCE_SCALE * 100)}%`;
      if (readout && readout.textContent !== text) readout.textContent = text;
    };
    draw(camera.getLiveCamera()); return camera.onCameraFrame(draw);
  }, [closeup, camera.getLiveCamera, camera.onCameraFrame]);
  const atmosphereCanopies: AtmosphereCanopy[] = biomeTiles.filter(tile => tile.unlocked !== false && !tile.flags?.includes('unexplored')).flatMap(tile => {
    const popup = biomePopups.get(tile.id)!;
    const area = getBiomeWorldFootprint(tile);
    const canopies: AtmosphereCanopy[] = (tableScenery[tile.id] ?? []).map(prop => {
      const foot = {x:area.x+prop.x,y:area.y+prop.y}, owner = populationOwner(foot, area, prop.id.startsWith('population-')) ?? walkableSceneryOwner(foot, area);
      const fitted = propVolumeRecipe(prop.src)||isPaintedScenerySprite(prop.src) ? fitSceneryVolumeFootprint(foot,prop.width,prop.height,owner) : fitSceneryFootprint(foot,prop.width,prop.height,owner,0);
      return {id:`${tile.id}-${prop.id}`,...fitted.position,width:fitted.width,height:fitted.height,sprite:prop.src,flip:prop.flip,trimmed:isPaintedScenerySprite(prop.src),worldHeading:sceneryWorldHeading(prop.src)};
    });
    if (!tableScenery[tile.id] && popup.sprite && !failedSprites.includes(popup.sprite) && popup.size >= BIOME_POPUP_MIN_SIZE) canopies.push({
      id:tile.id,...popup.position,width:popup.size,height:popup.size,sprite:popup.sprite,flip:popup.flip,trimmed:true,worldHeading:directionalScenery(popup.sprite)?undefined:sceneryWorldHeading(popup.sprite),
    });
    return canopies;
  });
  // Actor fog protection comes from the live artwork in VolumetricAtmosphere.
  // A canopy made from actor.sprite leaves a second, static portrait-shaped
  // opening floating above the directional actor as its pose/camera changes.

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const actorId = event.dataTransfer.getData('text/proto-actor');
    if (!actorId) return;
    const destination = resolveDropDestination(actorId, event.clientX, event.clientY);
    startActorTravel(actorId, destination.point, destination.arrival);
    clearActorDragState();
  };

  const finishPointerTableDrag = (event: React.PointerEvent<Element>, actorId: string) => {
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
      const grip = event.currentTarget.hasAttribute('data-cell-grip') ? event.currentTarget.nextElementSibling : null;
      const anchor=grip instanceof HTMLElement ? grip : event.currentTarget instanceof HTMLElement ? event.currentTarget
        : camera.containerRef.current?.querySelector<HTMLElement>(`[data-actor-id="${actorId}"]`);
      if(anchor)onInspectActor?.(actorId,anchor);
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
  // Tile cutouts keep their authored world orientation throughout camera orbit.
  const sceneryStandee = (heading=0) => ({ ...standee(undefined, rasterScale),
    transform: `${worldActorTransform(heading, true, rasterScale)} scaleY(var(--standee-rise, 1)) scale(var(--scenery-fit-scale, 1))` });
  // Flat round tokens turn against a spun camera so their faces stay upright.
  // They're placed by Tailwind's centring transform, which takes --tw-rotate.
  const faceCameraFlat = { ['--tw-rotate' as string]: 'calc(-1 * var(--camera-yaw, 0deg))' } as React.CSSProperties;
  // Sprite standees: a pixel-art cut-out lit by the table's lights, casting its
  // own silhouette across the table away from each one.
  const spriteStandee = (sprite: string | undefined, position: { x: number; y: number }, { size = SPRITE_STANDEE_SIZE, owner = 'actor', flip = false, actorId,occupants,discoveryTileId }: { size?: number; owner?: string; flip?: boolean; actorId?: string;occupants?:readonly InteriorOccupant[];discoveryTileId?:string } = {}) => {
    if (!upright || !sprite || failedSprites.includes(sprite)) return null;
    const volume = owner === 'biome' && Boolean(propVolumeRecipe(sprite));
    const worldHeading = sceneryWorldHeading(sprite);
    const facingYaw = owner === 'biome' ? volume ? 0 : directionalScenery(sprite)||worldHeading === undefined ? yaw : worldHeading * 180 / Math.PI : yaw;
    const lit = standeeLighting(timeOfDay, position, size, lightSources, facingYaw);
    const onError = () => setFailedSprites((list) => list.includes(sprite) ? list : [...list, sprite]);
    return {
      shadows: volume ? <PropVolumeShadows sprite={sprite} position={position} shadows={lit.shadows} size={size} owner={owner} flip={flip} /> : <SpriteStandeeShadows sprite={sprite} position={position} shadows={lit.shadows} size={size} owner={owner} yaw={facingYaw} actorId={actorId} flip={flip} />,
      silhouette: volume ? <PropVolumeArt sprite={sprite} width={size} height={size} lighting={lit} hours={timeOfDay} position={position} camera={volumeCamera} monochrome flip={flip} fallback={<SpriteStandeeArt sprite={sprite} lighting={lit} size={size} />} /> : <SilhouetteRelief sprite={sprite} width={size} height={size} lighting={lit} hours={timeOfDay} position={position} yaw={facingYaw}
        fallback={<SpriteStandeeArt sprite={sprite} lighting={lit} size={size} />} />,
      art: volume ? <TileDiscoveryArt relief tileId={discoveryTileId ?? []}><PropVolumeArt sprite={sprite} width={size} height={size} lighting={lit} hours={timeOfDay} position={position} camera={volumeCamera} flip={flip} fallback={<SpriteStandeeArt sprite={sprite} lighting={lit} onError={onError} size={size} />} /></TileDiscoveryArt> : <SpriteStandeeArt sprite={sprite} lighting={lit} onError={onError} size={size} flip={flip} occupants={occupants} discoveryTileId={discoveryTileId} />,
    };
  };
  const actorGrip = (actor:ProtoWorldActor) => ({
    onPointerDown:(event:React.PointerEvent<Element>)=>grabActor(actor.id,event,event.currentTarget),
    onPointerMove:(event:React.PointerEvent<Element>)=>{
      const drag=pointerDragRef.current;if(!drag||drag.actorId!==actor.id||drag.pointerId!==event.pointerId)return;
      if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6){
        drag.moved=true;setDraggingActorId(actor.id);setDragPreview({actorId:actor.id,x:event.clientX,y:event.clientY});onActorDragStart?.(actor.id);
      }
      if(drag.moved)setDragPreview({actorId:actor.id,x:event.clientX,y:event.clientY});
    },
    onPointerUp:(event:React.PointerEvent<Element>)=>finishPointerTableDrag(event,actor.id),
    onPointerCancel:()=>clearActorDragState(),
  });
  // Pixel-art standees stay sharp as the camera zooms; flat pieces need none.
  const oversample = upright ? rasterScale : 1;
  /** Picks up an actor; moves and the release then go to `holder`. */
  const grabActor = (actorId: string, event: React.PointerEvent, holder: Element) => {
    // Other mouse buttons spin the camera, even over a piece.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (pointerDragRef.current) return;
    actorClickClaimed.current = true;
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
  const actorAtPointer = (clientX: number, clientY: number) => {
    const occupant = actorOnSquare(clientX, clientY);
    if (occupant) return occupant;
    // Alpha masks and close-up's gesture layer leave their hit boxes intact.
    // Route a press on the revealed body to its original actor.
    // This layout read happens on input only, never in the rendering loop.
    const exposed = [...(camera.containerRef.current?.querySelectorAll<HTMLElement>(closeupRef.current
      ? '[data-board-piece="actor"]' : '[data-board-piece="actor"][data-actor-occluded="true"]') ?? [])].find(face => {
      const box = face.getBoundingClientRect();
      return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
    });
    return exposed ? actors.find(actor => actor.id === exposed.dataset.actorId) : undefined;
  };
  actorSquareRef.current = (clientX, clientY) => Boolean(actorAtPointer(clientX, clientY));
  const grabActorOnSquare = (event: React.PointerEvent<HTMLDivElement>) => {
    actorClickClaimed.current = false;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('.proto-map-world, [data-closeup-gesture-surface]') || target.closest('[data-board-piece="actor"], [data-interior-actor], [data-cell-grip^="actor-"], button:not([data-biome-id]), .proto-standee-sign, [data-hut-build]')) return;
    const actor = actorAtPointer(event.clientX, event.clientY);
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
  const standeeBase = (key: string, position: { x: number; y: number }, width: number, actorId?: string) => upright
    ? <div key={key} aria-hidden="true" data-travel-actor={actorId} className="proto-standee-base" style={{ left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`, width, height: width, boxShadow: tableObjectShadow(timeOfDay, position, 6, lightSources) }} />
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
    <TileDiscoveryProvider tiles={onEditCell ? [] : sourceBiomeTiles} reliefSketch={reliefSketch}>
    <TravelWorldContext.Provider value={{host:travelWorldHost,upright,progress:travel?.progress??0,actorPosition:()=>travelPose.current?.position??travelPosition??{x:0,y:0},onCameraFrame:camera.onCameraFrame,
      solids:biomeTiles.filter(tile=>!tile.flags?.includes('unexplored')&&(tile.tileType==='impassable-mountain'||(!tile.tileType&&!tile.road))).map(tile=>{const r=getBiomeWorldFootprint(tile);return {left:r.x-r.width/2,top:r.y-r.height/2,right:r.x+r.width/2,bottom:r.y+r.height/2};}),
      project:point=>{const live=camera.getLiveCamera(),plane=rotateVector({x:live.x+point.x*live.scale,y:live.y+point.y*live.scale},live.yaw??0),screen=tilted?projectTilt(plane,getCameraTilt(live)):plane;return{x:viewportWidth/2+screen.x,y:viewportHeight/2+screen.y};}}}>
    <section data-story-cinematic={Boolean(storyMood)} hidden={inactive} data-actor-closeup={Boolean(closeup)} data-camera-view={upright ? 'immersive' : 'tabletop'} className="proto-map relative min-h-0 overflow-hidden rounded-[calc(var(--classic-radius)*1.3)] border border-[#8ef2d4]/22 bg-[#050807] font-mono">
      {storyMood && globalLights && <div className="day-cinema-grade" data-story-mood={storyMood} aria-hidden="true" />}
      <PeripheralDarkness config={peripheralDarkness} enabled={globalLights} />
      {typeof settings === 'function' ? settings(<div className="art-settings__section" aria-label="Travel controls"><span>Stamina · {travelStamina.toFixed(1)} / {travelStaminaMax}</span>        <label className="art-settings__toggle"><input type="checkbox" checked={followTravelingActor} onChange={event => setFollowTravelingActor(event.target.checked)} />Follow traveling actor</label>
        <label className="art-settings__toggle"><input type="checkbox" checked={cinematicTravel} onChange={event => {
          setCinematicTravel(event.target.checked);
          if (event.target.checked) { setFollowTravelingActor(true); exitCloseup(false); closeupTripOverride.current = null; if (travel) onTiltedChange?.(true); }
        }} />Cinematic travel</label>
</div>) : settings}
      {travelTableau}

      <svg aria-hidden="true" width="0" height="0" style={{position:'absolute',pointerEvents:'none'}}><defs><filter id="combat-scenery-tint" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values=".32 .42 .12 0 .055  .12 .24 .05 0 .015  .13 .25 .06 0 .022  0 0 0 1 0" /></filter>
        <filter id="actor-visibility-stroke" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.8" result="expanded" />
          <feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge" />
          <feFlood floodColor="#fff0b5" />
          <feComposite in2="edge" operator="in" result="stroke" />
          <feMerge><feMergeNode in="stroke" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="actor-visibility-stroke-oversampled" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius={.8 * rasterScale} result="expanded" />
          <feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge" />
          <feFlood floodColor="#fff0b5" />
          <feComposite in2="edge" operator="in" result="stroke" />
          <feMerge><feMergeNode in="stroke" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs></svg>
      <div className="proto-map-hud">
      {objective && <DayObjectiveWaypoint objective={objective} onCameraFrame={camera.onCameraFrame} project={point => {
        const live = camera.getLiveCamera();
        const plane = rotateVector({ x: live.x + point.x * live.scale, y: live.y + point.y * live.scale }, live.yaw ?? 0);
        const screen = tilted ? projectTilt(plane, getCameraTilt(live)) : plane;
        return { x: viewportWidth / 2 + screen.x, y: viewportHeight / 2 + screen.y };
      }} onFocus={() => {
        exitCloseup(false);
        if (travel) setFollowTravelingActor(false);
        const live = camera.getLiveCamera();
        const scale = Math.min(live.scale, CLASSICPLUS_ZOOM_REFERENCE_SCALE);
        camera.setCameraFrame({ ...live, scale, x: -objective.position.x * scale, y: -objective.position.y * scale });
      }} />}
      {pendingTravel && editingTravelRoute && travelControls.map((point, index) => {
        const live = camera.getLiveCamera();
        const plane = rotateVector({ x: live.x + point.x * live.scale, y: live.y + point.y * live.scale }, live.yaw ?? 0);
        const screen = tilted ? projectTilt(plane, getCameraTilt(live)) : plane;
        return <button key={index} type="button" className="travel-route-control" data-route-control={index} data-route-destination={index === travelControls.length - 1 || undefined} data-grid-reference={TABLE_GRID.reference(TABLE_GRID.atWorld(point))} data-camera-ignore="true"
          aria-label={`${index === travelControls.length - 1 ? 'Destination point' : 'Route point'} ${index + 1} · ${TABLE_GRID.reference(TABLE_GRID.atWorld(point))}`} title="Drag to choose a grid square; arrow keys move one cell"
          style={{ left: `calc(50% + ${screen.x}px)`, top: `calc(50% + ${screen.y}px)` }}
          onPointerDown={event => { event.stopPropagation(); event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); routeControlDrag.current = { index, pointerId: event.pointerId, original: travelControls, plan: pendingTravel }; }}
          onPointerMove={event => { const drag = routeControlDrag.current; if (drag?.pointerId === event.pointerId) { event.stopPropagation(); changeTravelControl(index, worldPointFromClient(event.clientX, event.clientY), drag.original); } }}
          onPointerUp={event => { const drag = routeControlDrag.current; if (drag?.pointerId === event.pointerId) { event.stopPropagation(); changeTravelControl(index, worldPointFromClient(event.clientX, event.clientY), drag.original); routeControlDrag.current = null; } }}
          onPointerCancel={cancelTravelControl}
          onLostPointerCapture={cancelTravelControl}
          onKeyDown={event => { const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; const delta = directions[event.key]; if (delta) { event.preventDefault(); event.stopPropagation(); changeTravelControl(index, TABLE_GRID.center(TABLE_GRID.offset(TABLE_GRID.atWorld(point), ...delta))); } }}
        >{index + 1}</button>;
      })}
      {pendingTravel && <TravelDestinationActions path={pendingTravel.path} controls={travelControls} onCameraFrame={camera.onCameraFrame} project={point => {
        const live=camera.getLiveCamera();
        const plane=rotateVector({x:live.x+point.x*live.scale,y:live.y+point.y*live.scale},live.yaw??0);
        const screen=tilted?projectTilt(plane,getCameraTilt(live)):plane;
        return {x:viewportWidth/2+screen.x,y:viewportHeight/2+screen.y};
      }}>
          {routeEditError && <span className="sr-only" role="status">{routeEditError}</span>}
          <div className="travel-target-buttons"><button type="button" aria-label="Confirm travel" disabled={pendingTravel.estimate > travelStamina || Boolean(travelAllowed && !travelAllowed(pendingTravel))} onClick={confirmTravel}>OK!</button>
          <button type="button" aria-label="Cancel travel" onClick={() => { routeControlDrag.current = null; setPendingTravel(null); setEditingTravelRoute(false); if(journeyRef.current?.blocked) onFinishTravel?.(); }}>X</button></div>
      </TravelDestinationActions>}
      {closeup && <div className="proto-travel-controls" aria-label="Actor close-up controls" data-camera-ignore="true">        {closeup && <label className="proto-travel-speed proto-actor-closeup-control">Actor close-up
          <input type="range" min="1" max="6" step="0.1" aria-label="Actor close-up magnification"
            value={Math.max(1, Math.min(6, camera.cameraState.scale / closeup.camera.scale))}
            aria-valuetext={(camera.cameraState.scale / closeup.camera.scale).toFixed(1) + ' times'}
            onChange={event => camera.setCameraState(previous => ({ ...previous, scale: closeup.camera.scale * Number(event.target.value) }))} />
          <output>{(camera.cameraState.scale / closeup.camera.scale).toFixed(1)}×</output>
        </label>}
      </div>}
      <div
        className="proto-map-footer"
      >
        <div className="proto-map-readouts">
          <FpsCounter />
          <div className="proto-map-zoom" aria-live="polite">{closeup ? 'Close-up ' + (camera.cameraState.scale / closeup.camera.scale).toFixed(1) + '×' : 'Zoom ' + Math.round((camera.cameraState.scale / CLASSICPLUS_ZOOM_REFERENCE_SCALE) * 100) + '%'}</div>
        </div>
      <div className="proto-map-toolbar" role="group" aria-label="Map camera controls">
        <button type="button" className="proto-map-camera-button" aria-pressed={tilted} aria-label={tilted ? 'Flat camera view' : 'Tilt camera view'} title={tilted ? 'Flat camera view · O' : 'Tilt camera view · O'} onClick={() => { if (closeup) exitCloseup(false); onTiltedChange?.(!tilted); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={tilted ? 'M4 4h16v16H4z M4 12h16 M12 4v16' : 'M3 17l5-10h8l5 10z M6 12h12 M12 7v10'} /></svg></button>
        {/* Turn the table 45° (Q / E); a double-click turns it back to 0°. */}
        <button type="button" className="proto-map-camera-button" disabled={inactive} aria-label="Turn table left" title="Turn table left (Q) · double-click to straighten" onClick={() => camera.spinStep(-45)} onDoubleClick={unspin}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2 8 M4 4v6h6" /></svg></button>
        <button type="button" className="proto-map-camera-button" disabled={inactive} aria-label="Turn table right" title="Turn table right (E) · double-click to straighten" onClick={() => camera.spinStep(45)} onDoubleClick={unspin}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10a8 8 0 1 0-2 8 M20 4v6h-6" /></svg></button>
        <button type="button" className="proto-map-camera-button" disabled={inactive || Boolean(closeup)} aria-label="True Center" title="True Center · center on table:0,0" onClick={()=>camera.setCameraState(previous=>({...previous,x:-TRUE_CENTER.world.x*previous.scale,y:-TRUE_CENTER.world.y*previous.scale}))}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" /><path d="M12 2v6 M12 16v6 M2 12h6 M16 12h6" /></svg></button>
        <button
          type="button"
          className="proto-map-camera-button"
          aria-label="Reset View"
          title="Reset View · restore the starting camera"
          disabled={inactive}
          onClick={resetProtoCamera}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2 8 M4 4v6h6 M9 12l3-3 3 3v5H9z" /></svg>
        </button>
      </div>
        <div className="table-grid-reference" data-grid-reference={TABLE_GRID.reference(hoverCell)} aria-label="Table grid coordinate" title={hoverCell.column===0&&hoverCell.row===0 ? 'True Center · table:0,0' : TABLE_GRID.reference(hoverCell)}>{TABLE_GRID.reference(hoverCell)}</div>
      </div>
      </div>
      {routeBlocked && <div className="absolute left-3 bottom-12 z-40 rounded border border-[#ffd166] bg-[#17140b] p-2 text-base" role="status">No clear route. Choose an open destination.</div>}
      <div
        ref={camera.containerRef}
        className={`proto-map-viewport h-full min-h-[18rem] touch-none ${tilted ? camera.isPanning ? 'cursor-grabbing' : 'cursor-grab' : ''}`}
        aria-label="Scrollable expedition table"
        onContextMenu={event => {
          event.preventDefault();
          if ('pointerType' in event.nativeEvent && event.nativeEvent.pointerType === 'touch') return;
          if(!onEditCell){
            if((event.target as Element).closest('.travel-tableau,.travel-target-actions,.proto-map-toolbar,input,select,textarea'))return;
            const target=inspectionTargetAt(event.clientX,event.clientY);
            if(target){event.stopPropagation();onInspectTile?.(target.id,target.anchor);}return;
          }
          if (!onEditContextMenu || (event.target as Element).closest('button, input, select')) return;
          event.preventDefault(); event.stopPropagation();
          onEditContextMenu(TABLE_GRID.atWorld(worldPointFromClient(event.clientX, event.clientY)), event.clientX, event.clientY);
        }}
        onPointerDownCapture={event => {
          if(event.button===0&&exposedTravelCardAt(event.currentTarget,event.clientX,event.clientY)&&!(event.target as Element).closest('button')){event.stopPropagation();return;}
          // Stationary touch taps emit no pointer move; record the pressed cell
          // before actor grabs or camera gestures can claim the event.
          const cell = TABLE_GRID.atWorld(worldPointFromClient(event.clientX, event.clientY));
          setHoverCell(previous => previous.column === cell.column && previous.row === cell.row ? previous : cell);
          if (onEditCell) {
            if (event.button === 0) { onEditCell(cell); event.preventDefault(); event.stopPropagation(); }
            return;
          }
          if(!(event.target as Element).closest('.travel-tableau,.travel-target-actions,.proto-map-toolbar,input,select,textarea'))tileHold.start(event);
          grabActorOnSquare(event);
        }}
        onClickCapture={event => {
          if (pendingTravel && editingTravelRoute && !actorClickClaimed.current && !(event.target as Element).closest('[data-board-piece="actor"], [data-cell-grip], button:not([data-biome-id])')) {
            const tile = (event.target as Element).closest<HTMLElement>('[data-biome-id]');
            const point = event.detail === 0 && tile
              ? biomeTiles.find(value => value.id === tile.dataset.biomeId)?.position
              : worldPointFromClient(event.clientX, event.clientY);
            const controls = point && addTravelWaypoint(pendingTravel.path, travelControls, point);
            if (controls) {
              setTravelControls(controls); setRouteEditError('');
              event.preventDefault(); event.stopPropagation(); return;
            }
          }
          if(!(event.target as Element).closest('button')){
            const card=exposedTravelCardAt(event.currentTarget,event.clientX,event.clientY);
            if(card){event.preventDefault();event.stopPropagation();card.focus();if(!card.disabled)card.click();return;}
          }
          if (onEditCell) {
            if (event.detail > 0) onEditCell(TABLE_GRID.atWorld(worldPointFromClient(event.clientX, event.clientY)));
            event.preventDefault(); event.stopPropagation(); return;
          }
          if (closeupRef.current) { event.preventDefault(); event.stopPropagation(); return; }
          // A captured actor gesture can originate on foreground scenery.
          // Its subsequent native click must not also inspect that prop.
          const pointerClick = event.detail > 0 || event.nativeEvent instanceof PointerEvent && Boolean(event.nativeEvent.pointerType);
          if (pointerClick && actorClickClaimed.current) {
            actorClickClaimed.current = false; event.preventDefault(); event.stopPropagation();
          }
        }}
        onPointerMoveCapture={event=>{const cell=TABLE_GRID.atWorld(worldPointFromClient(event.clientX,event.clientY));setHoverCell(previous=>previous.column===cell.column&&previous.row===cell.row?previous:cell);}}
        onKeyDownCapture={event => {
          if (onEditCell && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault(); event.stopPropagation();
            const id = (event.target as HTMLElement).closest<HTMLElement>('[data-biome-id]')?.dataset.biomeId;
            const tile = biomeTiles.find(entry => entry.id === id);
            if (tile) onEditCell(TABLE_GRID.atWorld(tile.position));
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragEnd={clearActorDragState}
        onDrop={event => { if (onEditCell) { event.preventDefault(); return; } handleDrop(event); }}
      >
        {closeup && <div data-closeup-gesture-surface="true" aria-hidden="true" className="absolute inset-0 z-[45]" />}
        {/* The table plane. Tilted, it is oversized around the same center so
            its far edge stays off screen; everything on it tilts together. */}
        <div className="proto-map-composite proto-map-composite--ground">
        {upright && airReady && !storyMood && <TableGridCanvas extension={gridExtension} view={{width:viewportWidth,height:viewportHeight}} getCamera={camera.getLiveCamera} getTilt={getCameraTilt} onCameraFrame={camera.onCameraFrame} />}
        <div
          className={`proto-table-stage absolute${staged ? ' proto-table-stage--tilted' : ''}`}
          style={{
            inset: staged ? '-100%' : 0,
            zIndex: 0,
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
            display: upright && airReady ? 'none' : undefined,
            inset: staged ? 0 : '-50%',
            rotate: 'var(--camera-yaw, 0deg)',
            // Sized and placed from the live camera (--camera-*), so the grid keeps
            // pace with the pieces every frame instead of at React's state syncs.
            backgroundImage: storyMood ? 'none' : `repeating-linear-gradient(0deg, rgba(142,242,212,0.28) 0 1px, transparent 1px calc(48px * var(--camera-scale, ${camera.cameraState.scale}))), repeating-linear-gradient(90deg, rgba(142,242,212,0.28) 0 1px, transparent 1px calc(48px * var(--camera-scale, ${camera.cameraState.scale})))`,
            // A tile image centered at the viewport places its boundaries half a
            // cell from True Center; stored actor coordinates identify square centers.
            backgroundPosition: `calc(50% + var(--camera-x, ${camera.cameraState.x}px)) calc(50% + var(--camera-y, ${camera.cameraState.y}px))`,
            backgroundSize: `calc(${CLASSICPLUS_GRID_SIZE}px * var(--camera-scale, ${camera.cameraState.scale})) calc(${CLASSICPLUS_GRID_SIZE}px * var(--camera-scale, ${camera.cameraState.scale}))`,
          }}
        />
        <div className="proto-table-plane absolute" style={{ inset: staged ? '33.3333%' : 0 }}>
          <div ref={setGroundWorld} data-ground-world="true" className="proto-map-world absolute" style={{ left: '50%', top: '50%', width: 0, height: 0, transformOrigin: '0 0', transform: 'var(--camera-transform)', transformStyle: 'flat' }} />
        </div>
        </div>
        {/* Keep the changing light texture in the ground's flat compositor.
            It must never sort against physical scenery's projected depth. */}
        {boundedGroundLight && airReady && upright ? <GroundLightCanvas hours={timeOfDay} lights={lightSources} occluders={BLOCKED_REGIONS}
          view={{width:viewportWidth,height:viewportHeight}} getCamera={camera.getLiveCamera} getTilt={getCameraTilt} onCameraFrame={camera.onCameraFrame} onUnavailable={groundLightUnavailable}/>
        : <div aria-hidden="true" className="proto-table-light proto-ground-light pointer-events-none absolute z-0" style={{ inset: staged ? '-100%' : 0, transform: stageTransform, transition: tilted && airReady || !staged ? 'none' : undefined }}>
          {upright ? <canvas ref={lightCanvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0" /> : null}
        </div>}
        </div>
        {/* Composite ground before physical solids. A depth-bearing solid's
            projected near half extends below its billboard foot; a coplanar
            ground layer would slice those pixels off at the table plane. */}
        <div className="proto-map-composite proto-map-composite--physical">
        <div className={`proto-table-stage absolute${staged ? ' proto-table-stage--tilted' : ''}`} style={{ inset: staged ? '-100%' : 0, zIndex: 1, pointerEvents: 'none', transform: stageTransform, transition: tilted && airReady || !staged ? 'none' : undefined, ['--table-tilt' as string]: `${tiltAngle}deg` }}>
        <div className="proto-table-plane absolute" style={{ inset: staged ? '33.3333%' : 0 }}>
        <div
          ref={setTravelWorldRef}
          data-physical-world="true"
          className="proto-map-world absolute"
          style={{
            // The world needs an origin, not a viewport-sized raster plane.
            // Child positions remain relative to True Center at every zoom.
            left: '50%',
            top: '50%',
            width: 0,
            height: 0,
            transformOrigin: '0 0',
          }}
        >
          <GroundShadowLayer.Provider value={groundWorld}>
          {editCell && <div aria-hidden="true" data-editor-cell={TABLE_GRID.reference(editCell)} style={{ position: 'absolute',
            left: TABLE_GRID.bounds(editCell).left, top: TABLE_GRID.bounds(editCell).top, width: TABLE_GRID.cellSize, height: TABLE_GRID.cellSize,
            border: '2px solid #ffe3a0', background: '#ffdb9633', boxShadow: '0 0 12px #ffdb9677', pointerEvents: 'none', zIndex: 60 }} />}
          {/* The cell a dragged actor would land on; red when there's no route. */}
          {dragPlan?.cell ? <div aria-hidden="true" data-cell-cue={TABLE_GRID.reference(dragPlan.cell)} data-cue-blocked={dragPlan.route ? undefined : 'true'}
            className={`proto-cell-cue${dragPlan.route ? '' : ' proto-cell-cue--blocked'}`}
            style={{ left: `calc(50% + ${TABLE_GRID.center(dragPlan.cell).x}px)`, top: `calc(50% + ${TABLE_GRID.center(dragPlan.cell).y}px)` }} /> : null}
          <div className="table-grid-origin" data-grid-landmark="true-center" data-grid-reference={TRUE_CENTER.reference} aria-hidden="true" style={{left:'50%',top:'50%',width:CLASSICPLUS_GRID_SIZE,height:CLASSICPLUS_GRID_SIZE}}>＋</div>
          {storyCard && <TableStoryCard toWorld={worldPointFromClient} solids={[
            ...biomeTiles.map(tile => { const area = getBiomeWorldFootprint(tile); return { x: area.x, y: area.y, width: area.width, height: area.height }; }),
          ]}>{storyCard}</TableStoryCard>}
          {placedLights.filter((light) => !light.fromPiece).map((light) => <div key={light.id} data-board-piece="lamp" data-camera-ignore="true"
            aria-label={light.id === 'table-lantern' ? 'Table lantern, drag to move light' : 'Structure light'}
            onPointerDown={(event) => { event.stopPropagation(); if (light.id !== 'table-lantern' || (event.pointerType === 'mouse' && event.button !== 0)) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (light.id !== 'table-lantern' || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const point = worldPointFromClient(event.clientX, event.clientY); onMoveLight?.(light.id, point); }}
            onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            className="proto-table-lamp absolute z-10 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
            style={{ left: 'calc(50% + ' + light.position.x + 'px)', top: 'calc(50% + ' + light.position.y + 'px)', ...faceCameraFlat, ...standee() }}>🕯️</div>)}
          {questCards.filter(placement => placement.questIndex >= 0).map(placement => <TableQuestCard key={placement.questIndex} placement={placement} title={questTitles[placement.questIndex]} text={questTexts[placement.questIndex]} rewardLabel={questRewardLabels[placement.questIndex]} inspirationReward={questRewardLabels[placement.questIndex] ? 0 : undefined} redeemed={placement.questIndex < questClaims} onRedeem={() => onRedeemQuest?.(placement.questIndex)} timeOfDay={timeOfDay} lights={lightSources} cameraScale={camera.cameraState.scale} toWorld={worldPointFromClient}
            onMove={(position,tilt)=>onMoveQuest?.(placement.questIndex,position,tilt)}
            solids={[
              ...biomeTiles.filter(tile => (!tile.tileType || tile.tileType === 'berry-patch') && !tile.road).map(tile=>getBiomeWorldFootprint(tile)),
              ...resourceStacks.filter(stack=>stack.resource==='provisions_hut'||stack.build&&CRAFT_RECIPES.find(recipe=>recipe.id===stack.build?.recipeId)?.output==='provisions_hut').map(stack=>({x:stack.position.x,y:stack.position.y,width:48,height:48})),
              ...actors.map(actor=>{const point=getActorWorldPosition(actor);return {x:point.x,y:point.y,width:48,height:48};}),
              // Other quest cards on the table, e.g. the teaching card, at their largest size.
              ...questCards.filter(other=>other.questIndex!==placement.questIndex).map(other=>({x:other.position.x,y:other.position.y,width:120,height:120*88/63})),
            ]} />)}
          {/* Static ground is one flat plane. It inherits neither billboard
              camera variables nor the 3D layer required by upright scenery. */}
          {groundWorld && createPortal(<div className="proto-neutral-ground absolute inset-0" style={{
            ['--camera-transform' as string]: 'none', ['--camera-yaw' as string]: '0deg',
            ['--camera-x' as string]: '0px', ['--camera-y' as string]: '0px',
            ['--camera-scale' as string]: '1', ['--camera-sx' as string]: '0px',
          }}>
            <UnexploredGround cells={neutralGroundCells} />
            {[...unexploredGround.values()]}
            {/* Tilted, the range keeps its solid rock floor (without the overhead peaks) under the standing peaks. */}
            {terrainRegions.map(region => <ConnectedTerrainArt key={region.id} region={region} pieces={terrainPieces} peaks={!upright}
              sprite={scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/impassable-mountain_topdown.svg`,artStyle)!}
              floorSprite={artStyle==='paint'?`${import.meta.env.BASE_URL}assets/biomes/watercolor-v1/mountain-ground-v1.png`:undefined} rockColor="#354154" />)}
          </div>, groundWorld)}
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
              const { position:popupPosition,size:popupSize, requestedSize, requestedPosition, owner: popupOwner, flip: popupFlip, sprite: popupSprite } = biomePopups.get(tile.id)!;
              const popupOversample = tile.id === 'curious-sapling' ? oversample * 4 : oversample;
              // Standing at the back of its tile, a pop-up can be in front of
              // another tile's label. Fit both dimensions together, so narrowing
              // the art can retain a readable pop-up at a low camera angle.
              const occupants:InteriorOccupant[]=upright&&artStyle==='paint'&&tile.tileType==='hero-den' ? actors.filter(actor=>{
                const position=getActorWorldPosition(actor);
                return actorIsSleeping(actor,position)&&TABLE_GRID.reference(TABLE_GRID.atWorld(position))===TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position))
                  && !(actor.id==='mochi'&&actorIsCuddling(actor,position));
              }).map(actor=>({id:actor.id,sprite:actorArt(actor,getActorWorldPosition(actor))!,selected:selectedActorId===actor.id,
                handlers:{...actorGrip(actor),onClick:event=>event.stopPropagation()}})) : [];
              const popup = tableScenery[tile.id] || tile.flags?.includes('unexplored') || tile.unlocked === false || popupSize < BIOME_POPUP_MIN_SIZE ? null : spriteStandee(popupSprite, popupPosition, { size: popupSize, owner: 'biome', flip: popupFlip,occupants,discoveryTileId:tile.id });
              // Unexplored tiles stay anonymous and silent until discovery.
              const unexplored = Boolean(tile.flags?.includes('unexplored'));
              const explored = tile.exploration ?? 1;
              const openState = biomeOpenState(tile.flags);
              const tapTile = (event: React.MouseEvent<HTMLElement>) => {
                if (unexplored) return;
                setLabelTapId(tile.id);
                if (tile.unlocked !== false && openState.opens) onSelectBiome(tile.id);
              };
              return (
                <React.Fragment key={tile.id}>
                {/* Terrain shares the camera surface; only movable pieces
                    claim pointer gestures. The camera suppresses drag clicks. */}
                {groundWorld && createPortal(<button
                  data-traversal-pending={tile.traversalProgress !== undefined && tile.traversalProgress < 1 ? "true" : undefined}
                  data-board-piece="tile"
                  data-tabletop={!upright || undefined}
                  type="button"
                  aria-haspopup="dialog"
                  data-light-percent={tileLight.percent}
                  data-light-level={tileLight.level}
                  data-grid-reference={TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position))}
                  data-biome-id={tile.id}
                  data-scenery-symmetry={upright && !unexplored ? propVolumeRecipe(tile.sprite)?.symmetry : undefined}
                  data-scenery-facing={upright && !unexplored ? propVolumeRecipe(tile.sprite)?.facing : undefined}
                  title={unexplored ? undefined : tile.berryPatchVariant === 'sparse' ? `${tile.title} · one bush · ${tile.berryHarvested ? 'picked clean' : 'one manaberry along the way'}` : tile.tileType === 'berry-patch' ? `${tile.title} · forage ripe manaberries · 20% yield mana · ${tile.tableauSize} cards` : tile.road ? `${tile.title} · explore the path` : tile.tileType === 'impassable-mountain' ? tile.passage ? `${tile.passage.title} · ${tile.passage.axis} · ${tile.passageOpen ? 'opened passage' : tile.passage.tags.map(t=>'#'+t).join(' ')}` : 'Impassable mountain · find a route around it' : tile.tileType ? `${tile.title} · explore the path` : tile.danger ? `${tile.title} · danger: a Shadow Wolf prowls here` : tile.terrain === 'water' ? `${tile.title} · fishing` : `${tile.title} · ${tile.sizeLabel} · ${Math.round(tile.resourceDensity * 100)}% resources · ${tile.tableauSize} cards${tile.unlocked === false ? ' · Complete Small Woods to unlock' : ''}`}
                  data-explored={explored.toFixed(2)}
                  data-unexplored={unexplored || undefined}
                  data-tile-type={unexplored ? 'unexplored' : tile.tileType ?? tile.terrain ?? 'woods'}
                  data-terrain={unexplored ? undefined : tile.terrain}
                  data-selected={tile.selected || undefined}
                  onClick={tapTile}
                  {...labelReveal(tile.id)}
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
                  <TileDiscoveryArt tileId={tile.id}>
                  {!unexplored && tile.tileType === 'hero-den' && <img data-den-ground="true" aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" style={{ imageRendering: artStyle==='paint'?'auto':'pixelated', transform: 'rotate(180deg)' }} src={scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/hero-den-ground-v3.png`,artStyle)} alt="" draggable={false} />}
                  {!unexplored && !tile.tileType && !tile.road && tile.terrain !== 'water' && tile.unlocked !== false && <WoodlandGround footprint={worldFootprint} danger={tile.danger} brightness={upright ? standeeLighting(timeOfDay, tile.position, 0, lightSources).brightness : 1} />}
                  {!unexplored && tile.tileType === 'dirt' && <img data-dirt-ground="true" aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" style={{ imageRendering: artStyle === 'paint' ? 'auto' : 'pixelated' }} src={scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/dirt-ground.png`, artStyle)} alt="" draggable={false} />}
                  {!unexplored && tile.tileType === 'berry-patch' && <img data-berry-ground="true" aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" style={{ imageRendering: artStyle==='paint'?'auto':'pixelated' }} src={scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/berry-patch-ground.svg`,artStyle)} alt="" draggable={false} />}
                  {unexplored ? <span aria-hidden="true" className="absolute inset-0" style={{ background: '#182221', filter: 'var(--silhouette-filter) grayscale(1) brightness(0.45)' }} />
                    : tile.road ? <RoadTileArt road={tile.road} exploration={explored} brightness={upright ? standeeLighting(timeOfDay, tile.position, 0, lightSources).brightness : 1} />
                    : tile.tileType === 'hero-den' ? !upright && <img data-den-overhead="true" aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" style={{ imageRendering: artStyle==='paint'?'auto':'pixelated', objectFit: 'contain', transform: 'rotate(180deg)' }} src={scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/hero-den-topdown-v3.png`,artStyle)} alt="" draggable={false} />
                    : tile.tileType === 'berry-patch' ? !upright && (tile.berryPatchVariant === 'sparse' ? <span className="absolute pointer-events-none" style={{ left: `calc(50% + ${tableScenery[tile.id]?.[0]?.x ?? 0}px)`, top: `calc(50% + ${tableScenery[tile.id]?.[0]?.y ?? 0}px)`, width: 18, height: 18, transform: 'translate(-50%, -50%)' }}><img data-sparse-bush="overhead" aria-hidden="true" className="absolute inset-0 h-full w-full" style={{ objectFit: 'contain' }} src={berryScenerySprite(`${import.meta.env.BASE_URL}assets/biomes/watercolor-v1/manaberry-sparse-overhead-v1.png`, false)} alt="" draggable={false} /><BushBerries sprite="sparse-berry" visible={tile.berriesAvailable ?? !tile.berryHarvested} overhead />{!tile.berryHarvested && <ManaberryGlow overhead />}</span> : <span className="absolute inset-0 pointer-events-none"><img data-berry-overhead="true" aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" style={{ imageRendering: artStyle==='paint'?'auto':'pixelated', objectFit: 'contain' }} src={berryScenerySprite(scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/berry-patch-topdown.svg`,artStyle)!, false)} alt="" draggable={false} /><BushBerries sprite="berry" visible={tile.berriesAvailable ?? true} overhead /></span>)
                    : tile.tileType === 'impassable-mountain' ? null : !tile.tileType && !upright ? <span className="absolute inset-0" style={{filter:tile.danger ? "url(#combat-scenery-tint)" : undefined}}><BiomeTopDownArt tileId={tile.id} terrain={tile.terrain} danger={tile.danger} exploration={explored} width={footprint.width} height={footprint.height} /></span> : null}
                  </TileDiscoveryArt>
                </button>, groundWorld)}
                {!upright && <span aria-hidden="true" className="proto-table-air--flat pointer-events-none absolute" style={{ left: '50%', top: '50%' }}><LightFireflies lights={lightSources.filter(light => light.id === `biome-light-${tile.id}`)} quality={fxQuality} flat /></span>}
                {!unexplored && !tile.tileType && !tile.road && tile.terrain !== 'water' && tile.unlocked !== false && <TileSpillArt discoveryTileIds={[tile.id]} raised={upright} hours={timeOfDay} lights={lightSources} danger={tile.danger} decals={woodsRoughage(tile.id, worldFootprint)} />}
                {upright && !unexplored && tableScenery[tile.id] && tile.unlocked !== false ? <BiomeEdgeScenery
                  tileId={tile.id}
                  centre={worldFootprint}
                  berriesAvailable={tile.berriesAvailable}
                  berryGlow={tile.berryPatchVariant === 'sparse' && !tile.berryHarvested}
                  footprint={worldFootprint}
                  props={tableScenery[tile.id] ?? []}
                  yaw={0}
                  billboardYaw={yaw}
                  exploration={explored}
                  hours={timeOfDay}
                  lights={lightSources}
                  quality={fxQuality}
                  standee={sceneryStandee()}
                  volumeStandee={standee(undefined, oversample)}
                  volumeCamera={volumeCamera}
                  oversample={oversample}
                /> : null}
                {popup ? <React.Fragment key={tile.id + '-popup'}>
                  {popup.shadows}
                  <div
                    aria-hidden="true"
                    data-traversal-pending={tile.traversalProgress !== undefined && tile.traversalProgress < 1 ? "true" : undefined}
                    data-board-piece="biome-popup"
                    data-biome-popup={tile.id}
                    data-environment-prop="true"
                    data-scenery-heading={propVolumeRecipe(popupSprite) ? propVolumeHeading(propVolumeRecipe(popupSprite)) : sceneryWorldHeading(popupSprite)}
                    data-scenery-billboard={directionalScenery(popupSprite)?'directional':isPaintedScenerySprite(popupSprite) && sceneryWorldHeading(popupSprite) === undefined && !propVolumeRecipe(popupSprite) ? 'paint' : undefined}
                    data-scenery-view={directionalScenery(popupSprite)?denView?.direction:undefined}
                    data-scenery-symmetry={propVolumeRecipe(tile.sprite)?.symmetry}
                    data-scenery-facing={propVolumeRecipe(popupSprite)?.facing ?? (sceneryWorldHeading(popupSprite) === Math.PI ? 'north' : undefined)}
                    data-scenery-volume={propVolumeRecipe(tile.sprite) ? 'true' : undefined}
                    data-scenery-x={requestedPosition.x} data-scenery-y={requestedPosition.y}
                    data-scenery-desired-width={requestedSize} data-scenery-desired-height={requestedSize}
                    data-scenery-width={popupSize} data-scenery-height={popupSize} data-scenery-height-units={sceneryHeightUnits(popupSprite)}
                    data-terrain-piece={terrainPieces.get(tile.id)?.shape} data-scenery-flip={popupFlip || undefined}
                    data-owner-x={popupOwner.x} data-owner-y={popupOwner.y}
                    data-owner-width={popupOwner.width} data-owner-height={popupOwner.height}
                    className="proto-sprite-standee absolute"
                    onClick={tapTile}
                    {...labelReveal(tile.id)}
                    style={{ left: `calc(50% + ${popupPosition.x}px)`, top: `calc(50% + ${popupPosition.y}px)`, ...(propVolumeRecipe(popupSprite)||directionalScenery(popupSprite)||sceneryWorldHeading(popupSprite) === undefined ? standee(undefined, popupOversample) : sceneryStandee(sceneryWorldHeading(popupSprite))), width: popupSize * popupOversample, height: popupSize * popupOversample }}
                  ><Oversample width={popupSize} height={popupSize} factor={popupOversample}><span className="absolute inset-0" style={{filter:tile.danger ? "url(#combat-scenery-tint)" : undefined}}><Reveal fraction={isPaintedScenerySprite(tile.sprite) || tile.tileType === 'hero-den' || tile.tileType === 'berry-patch' ? 1 : explored} width={popupSize} height={popupSize} shade={popup.silhouette}>{popup.art}</Reveal></span></Oversample></div>
                </React.Fragment> : null}
                </React.Fragment>
              );
            })()
          ))}
          {/* Unlike neighbours spill decals across their shared edge (tileSpill.ts).
              Flat, they keep clear of the printed labels; tilted, labels stand above them
              and the layer lies just above the ground so standing pieces still cover it. */}
          <TileSpillArt raised={upright} hours={timeOfDay} lights={lightSources} decals={tileSpills(
            biomeTiles,
            position => TABLE_GRID.atWorld(position), TABLE_GRID.cellSize,
            { avoid: upright ? [] : labelQuads.map(quad => ({ left: Math.min(...quad.map(p => p.x)), top: Math.min(...quad.map(p => p.y)), right: Math.max(...quad.map(p => p.x)), bottom: Math.max(...quad.map(p => p.y)) })) })} />
          {upright && terrainSeams.map(seam => <BiomeEdgeScenery key={seam.id}
            tileId={seam.id}
            discoveryTileIds={seam.tileIds}
            centre={seam.position}
            footprint={seam.owner}
            props={[{ id: 'ridge', edge: 'front', src: scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/${seam.src}`,artStyle)!, x: 0, y: 0, width: TABLE_GRID.cellSize * seam.scale, height: TABLE_GRID.cellSize * seam.scale, flip: seam.flip }]}
            yaw={0}
            hours={timeOfDay}
            lights={lightSources}
            quality={fxQuality}
            standee={sceneryStandee()}
            volumeStandee={standee(undefined, oversample)}
            volumeCamera={volumeCamera}
            oversample={oversample}
          />)}
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
                onLostPointerCapture: () => {
                  if (resourcePointerDragRef.current?.stackId === stack.id) clearResourceDragState();
                },
              };
              return (
                <React.Fragment key={stack.id}>
                {standeeBase('base', physicsPosition, 44)}
                {stack.build || WORLD_ITEMS[stack.resource].kind === 'structure' ? null : cellGrip(`stack-${stack.id}`, physicsPosition, grip)}
                <div
                  data-board-piece="resource"
                  data-resource={stack.resource}
                  data-mana-infused={stackIsManaInfused(stack) || undefined}
                  data-camera-ignore="true"
                  data-light-percent={stackLight.percent}
                  data-light-level={stackLight.level}
                  {...grip}
                  className={`proto-resource-stack${upright ? ' proto-standee' : ''} absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#8ef2d4]/55 bg-[#0b1916] text-[0.6rem] font-black text-[#cafff4] shadow-[0_0_18px_rgba(142,242,212,0.16)] ${draggingResourceId === stack.id ? 'cursor-grabbing ring-2 ring-[#cafff4]/55' : 'cursor-grab'}`}
                  style={{ left: `calc(50% + ${physicsPosition.x}px)`, top: `calc(50% + ${physicsPosition.y}px)`, boxShadow: upright ? tableObjectShadow(timeOfDay, physicsPosition, stack.resource === 'provisions_hut' ? 14 : 9, lightSources, yaw) : 'none', ...faceCameraFlat, ...standee({ width: 48, height: 60 }) }}
                  title={Object.entries(stackIngredients(stack)).map(([id, count]) => `${count} ${WORLD_ITEMS[id as WorldItemId].label}`).join(' + ')}
                  aria-label={`${stack.count} ${WORLD_ITEMS[stack.resource].label}${stack.build ? ', building' : ', draggable'}`}
                >
                  {stackIsManaInfused(stack) && <ManaGlow />}
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
                        <div>{staffed ? 'Actor inspiration: ' + actorInspiration : 'Paused · drop actor on hut foundation'}</div>
                        <div data-hut-foundation>Solitaire {stack.build.work}/{recipe.workRequired} · Foundation {stack.build.foundation}</div>
                        <div className="mt-1 flex flex-wrap gap-1">{stack.build.tableau.map((rank) => <button type="button" data-hut-card={rank} data-hut-stack={stack.id} key={rank} disabled={!staffed || !canSpendInspiration(actorInspiration, 1) || Math.abs(rank - stack.build!.foundation) !== 1} onClick={() => onPlayBuildCard?.(stack.id, rank)} className="rounded border border-white/50 bg-white/10 px-2 py-1 disabled:opacity-30" aria-label={'Play ' + rank + ' to hut foundation'}>{rank}</button>)}</div>
                        <div className="mt-1 text-white/60">Play adjacent rank · 1 inspiration/card</div>
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
                            const animation = trackGameAnimation(ghost.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(' + (to.left - from.left) + 'px,' + (to.top - from.top) + 'px)' }], { duration: solverFlightDuration(450), easing: 'ease-in-out' }));
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
          {routeShown ? <RouteLine path={routeShown.path} labels={labelQuads} difficultyAt={point => {
            const cell=TABLE_GRID.atWorld(point);
            const tile=sourceBiomeTiles.find(t=>{const area=getBiomeWorldFootprint(t);return cell.column>=area.first.column&&cell.column<area.first.column+t.gridSize.columns&&cell.row>=area.first.row&&cell.row<area.first.row+t.gridSize.rows;});
            const actor=actorOrigins.find(a=>a.id===(travel?.actorId??pendingTravel?.actorId??dragPreview?.actorId));
            return tile?.flags?.includes('unexplored') ? -1 : traversalProfile(tile,actor?.traversalAffinity).difficulty;
          }} /> : null}
          {actors.map(actor => { const position = (travel?.actorId === actor.id || Boolean(travel && journey?.memberRanks?.[actor.id] !== undefined)) && travelPosition ? travelPosition : getActorWorldPosition(actor); return <React.Fragment key={actor.id}>{!actorIsSleeping(actor, position) && spriteStandee(actorArt(actor, position), position, { actorId: actor.id })?.shadows}</React.Fragment>; })}
          {actors.map((actor) => {
            const actorPosition = (travel?.actorId === actor.id || Boolean(travel && journey?.memberRanks?.[actor.id] !== undefined)) && travelPosition ? travelPosition : getActorWorldPosition(actor);
            const actorLight = lightField.at(actorPosition);
            lightReadouts.push({ id: 'actor-' + actor.id, position: actorPosition, lift: upright ? -30 : 24, percent: actorLight.percent, level: actorLight.level });
            const sleeping = actorIsSleeping(actor, actorPosition);
            const cuddling = actorIsCuddling(actor, actorPosition);
            // Hero owns the shared silhouette; Mochi keeps an independent
            // focusable inspection/drag target over her part of the cuddle.
            const sharedCompanion = cuddling && actor.id === 'mochi';
            const sitting = (actor.id === 'hero' || actor.id === 'banks') && !sleeping && travel?.actorId !== actor.id;
            // A resting body lies on the cave floor, rather than standing as a
            // vertical card that becomes an orange line from above.
            const overheadHero = sleeping || !upright && (actor.id === 'hero' || actor.id === 'banks' || actor.id === 'mochi' && artStyle === 'paint');
            const heading = travelPose.current?.actorId === actor.id ? actorHeadings.current.get(actor.id)?.heading ?? 0 : movementHeading(actorPosition, actorHeadings.current.get(actor.id), actor.heading);
            if (travelPose.current?.actorId !== actor.id) actorHeadings.current.set(actor.id, { ...actorPosition, heading });
            // Within the immersive den, every pose faces out through its north
            // entrance. Keep travel heading history for movement outside it.
            const poseHeading = actorIsInDen(actor, actorPosition) && (upright || sleeping) ? Math.PI : sleeping ? actor.heading ?? 0 : heading;
            const directional = (actor.id === 'hero' || actor.id === 'banks' || actor.id === 'mochi' && artStyle === 'paint') && !sleeping;
            // Directional actors own their live canvas and need no static portrait
            // to receive the standard standee footprint and world scaling.
            const cutOut = spriteStandee(actorArt(actor, actorPosition), actorPosition) ?? (directional && upright ? {art:null,shadows:null,silhouette:null} : null);
            // This occupant has one visible drawing, inside the den's mouth.
            // Retain the world token and whole-square grip for input/gameplay.
            const paintedInterior=upright&&artStyle==='paint'&&sleeping;
            // Grabbing anywhere on the actor's square drags the actor, never the camera.
            const grip = actorGrip(actor);
            return (
            <React.Fragment key={actor.id}>

            {upright && !sleeping && <ActorBaseName actorId={actor.id} name={actor.label} position={actorPosition} diameter={Math.max(40, Array.from(actor.label).length * 9)} />}
            {!sharedCompanion && cellGrip(`actor-${actor.id}`, actorPosition, grip)}
            <div
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setSelectedActorId(actor.id); onInspectActor?.(actor.id, event.currentTarget); } }}
              data-grid-reference={TABLE_GRID.reference(TABLE_GRID.atWorld(actorPosition))}
              data-board-piece="actor"
              data-travel-actor={actor.id}
              data-actor-id={actor.id}
              data-actor-pose={sleeping ? 'sleeping' : sitting ? 'sitting' : directional ? 'walking' : 'standing'}
              data-den-rest-art={sleeping ? sleepingArtName(actor, actorPosition) : undefined}
              data-den-interior-owner={paintedInterior?'hero-den':undefined}
              data-shared-companion={sharedCompanion || undefined}
              data-actor-heading={poseHeading}
              data-actor-orientation={directional ? 'directional' : 'world-plane'}
              data-actor-shrink={cutOut ? 'true' : undefined}
              data-actor-x={actorPosition.x} data-actor-y={actorPosition.y}
              data-actor-width={cutOut ? 32 : 48} data-actor-height={sleeping ? 20 : cutOut ? 32 : 64}
              data-selected={selectedActorId === actor.id || undefined}
              data-camera-ignore="true"
              data-light-percent={actorLight.percent}
              data-light-level={actorLight.level}
              {...grip}
              className={overheadHero ? `proto-actor-overhead absolute cursor-grab select-none${draggingActorId === actor.id ? ' opacity-45' : ''}` : cutOut
                ? `proto-sprite-standee absolute cursor-grab select-none active:cursor-grabbing${selectedActorId === actor.id ? ' proto-sprite-standee--selected' : ''}${draggingActorId === actor.id ? ' opacity-45' : ''}`
                : `absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none place-items-center rounded-full border-2 bg-[#17140b] text-[0.52rem] font-black uppercase tracking-[0.1em] text-[#ffe7ad] shadow-[0_0_24px_rgba(255,209,102,0.18)] active:cursor-grabbing ${selectedActorId === actor.id ? 'border-[#fff0b5] ring-2 ring-[#ffd166]/45' : 'border-[#ffd166]/75'} ${draggingActorId === actor.id ? 'opacity-45' : ''}`}
              style={{
                // Stored positions and grid coordinates share the same cell-center origin.
                boxShadow: cutOut || !upright ? undefined : tableObjectShadow(timeOfDay, actorPosition, 12, lightSources.filter(light => light.id !== actorLightId(actor.id)), yaw),
                ...(cutOut || sleeping ? null : faceCameraFlat),
                left: `calc(50% + ${actorPosition.x}px)`,
                top: `calc(50% + ${actorPosition.y + (!upright && sleeping ? 5 : 0)}px)`,
                ...(cutOut ? { ...standee(undefined, oversample), transform: `${standee(undefined, oversample)?.transform} scale(var(--actor-world-scale, 1))`, width: SPRITE_STANDEE_SIZE * oversample, height: SPRITE_STANDEE_SIZE * oversample } : standee({ width: 48, height: 64 })),
                ...(cutOut && !directional ? { transform: `${worldActorTransform(poseHeading, true, oversample)} scale(var(--actor-world-scale, 1))`, animation: undefined } : {}),
                // Standing/sitting overhead sources point nose-up; sleeping
                // art is authored nose-down. Both follow the same world heading.
                ...(overheadHero ? { width: sleeping && upright ? 20 : 26, height: sleeping && upright ? 20 : 26, '--actor-overhead-length': actor.id === 'hero' && !sleeping ? HERO_OVERHEAD_LENGTH_SCALE : 1, transform: `${worldActorTransform(poseHeading + (sleeping ? 0 : Math.PI), false)}${sleeping && upright ? ' translateZ(0.8px)' : ''}`, transformOrigin: '50% 50%' } as React.CSSProperties : {}),
                ...(sharedCompanion ? { width: 12 * (upright ? oversample : 1), height: 12 * (upright ? oversample : 1), marginLeft: 7, marginTop: -6 } : {}),
              }}
              aria-label={`${actor.label} actor token${cuddling ? ', cuddling in the den' : sleeping ? ', sleeping in her den' : ''}`}
            >
              {sharedCompanion || paintedInterior ? null : directional ? <Oversample persistent width={overheadHero ? 26 : SPRITE_STANDEE_SIZE} height={overheadHero ? 26 : SPRITE_STANDEE_SIZE} factor={oversample}><TableActorSprite actorId={actor.id === 'banks' ? 'banks' : actor.id === 'mochi' ? 'mochi' : 'hero'} overhead={overheadHero} position={actorPosition} pose={sitting ? 'sitting' : 'walking'} heading={poseHeading} getCamera={camera.getLiveCamera} getTilt={getCameraTilt} getWorldPose={travel?.actorId === actor.id ? getTravelPose : undefined} brightness={upright ? standeeLighting(timeOfDay, actorPosition, SPRITE_STANDEE_SIZE, lightSources, yaw).brightness : 1} fallback={overheadHero ? <img src={`${import.meta.env.BASE_URL}assets/actors/hero-standing-topdown.png`} alt="" draggable={false} /> : cutOut?.art} /></Oversample> : overheadHero ? <img style={{ imageRendering: artStyle === 'paint' && actor.id === 'hero' && !cuddling ? 'auto' : 'pixelated' }} src={actorSprite(`${import.meta.env.BASE_URL}assets/actors/${sleeping ? sleepingArtName(actor, actorPosition) : actor.id}-${sleeping ? 'sleeping' : sitting ? 'sitting' : 'standing'}-topdown.png`, artStyle)} alt="" draggable={false} /> : cutOut ? <Oversample width={SPRITE_STANDEE_SIZE} height={SPRITE_STANDEE_SIZE} factor={oversample}>{cutOut.art}</Oversample> : <BoardObjectLabel text={actor.label} minFontSize={16} maxFontSize={16} />}
              {!sharedCompanion && !paintedInterior && !directional && overheadHero && sleeping && <span style={{position:'absolute',inset:0,pointerEvents:'none'}}><RestBobtail sprite={actorSprite(`${import.meta.env.BASE_URL}assets/actors/${sleepingArtName(actor, actorPosition)}-sleeping-topdown.png`,artStyle)!} /></span>}
            </div>
            </React.Fragment>
            );
          })}

        {upright && <div className="proto-surface-title-layer" style={{position:'absolute',left:0,top:0,width:0,height:0,transformStyle:'preserve-3d',pointerEvents:'none'}}>
          {biomeTiles.filter(tile => tile.tileType !== 'hero-den' && !sharedLabelTiles.has(tile.id) && !tile.flags?.includes('unexplored')).map(tile => {
            const area = getBiomeWorldFootprint(tile);
            return <div key={`${tile.id}-title`} data-biome-title={tile.id} data-label-owner="tile" data-label-pinned={pinnedLabels.has(tile.id) || undefined} data-label-shown={labelShown([tile.id])} className="proto-tile-title-anchor" style={{ inset: 'auto', left: `calc(50% + ${area.x}px)`, top: `calc(50% + ${area.y}px)`, width: area.width, height: area.height, transform: 'translate(-50%, -50%)' }}>
              <TileTitle align="bottom" biome={tile.tileType ?? tile.terrain} text={tile.title} width={area.width} height={area.height} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame} onTextBox={box => reportBiomeLabel(tile.id, area, box)} />
            </div>;
          })}
          {biomeTiles.filter(tile => tile.tileType === 'hero-den' && !sharedLabelTiles.has(tile.id) && !tile.flags?.includes('unexplored')).map(tile => <div key={tile.id} className="proto-den-title" data-den-title="true" data-label-owner="tile" data-label-pinned={pinnedLabels.has(tile.id) || undefined} data-label-shown={labelShown([tile.id])} style={{ position: 'absolute', left: `calc(50% + ${tile.position.x}px)`, top: `calc(50% + ${tile.position.y}px)`, width: upright ? 48 : 72, height: upright ? 48 : 72, transform: 'translate(-50%, -50%)' }}>
            <TileTitle align="bottom" maxLines={1}
              clearCenter={!upright && actors.some(actor => { const p = (travel?.actorId === actor.id || Boolean(travel && journey?.memberRanks?.[actor.id] !== undefined)) && travelPosition ? travelPosition : getActorWorldPosition(actor); return Math.abs(p.x - tile.position.x) < 24 && Math.abs(p.y - tile.position.y) < 24; }) ? 18 : undefined}
              biome={tile.tileType ?? tile.terrain} text={tile.title} width={48} height={48} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame} />
          </div>)}
          {labelRegions.map(region => <div key={region.id} data-connected-label={region.id} data-label-tiles={region.tiles.map(tile => tile.id).join(' ')} data-label-owner="region" data-label-pinned={region.tiles.some(tile => pinnedLabels.has(tile.id)) || undefined} data-label-shown={labelShown(region.tiles.map(tile => tile.id))}
            data-immutable-region={region.tiles[0].tileType === 'impassable-mountain' ? region.id : undefined} data-region-tile-count={region.tiles.length}
            className="proto-immutable-region-label" style={{ left: `calc(50% + ${region.x}px)`, top: `calc(50% + ${region.y}px)`, width: region.width, height: region.height }}>
            <TileTitle align="bottom" biome={region.tiles[0].tileType ?? region.tiles[0].terrain} text={region.title} width={region.width} height={region.height} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame}
              onTextBox={box => region.tiles.forEach(tile => {
                const area = getBiomeWorldFootprint(tile);
                reportBiomeLabel(tile.id, area, { ...box,
                  left: box.left + region.x - region.width / 2 - area.left,
                  top: box.top + region.y - region.height / 2 - area.top,
                  pivot: { x: region.x - area.left, y: region.y - area.top } });
              })} />
          </div>)}

        </div>}
        </GroundShadowLayer.Provider>
        </div>
        </div>
        </div>
        </div>
        {/* Overhead ink retains its foreground compositor.
            Immersive ink lives in the physical scene, below foreground relief. */}
        <div className="proto-table-title-layer absolute pointer-events-none" style={{ inset: staged ? '-100%' : 0, transform: stageTransform, transition: tilted && airReady || !staged ? 'none' : undefined }}>
          <div className="absolute" style={{ inset: staged ? '33.3333%' : 0 }}>
            <div className="absolute" style={{ left: '50%', top: '50%', width: 0, height: 0, transformOrigin: '0 0', transform: 'var(--camera-transform)' }}>
          {!upright && biomeTiles.filter(tile => tile.tileType === 'hero-den' && !tile.flags?.includes('unexplored')).map(tile => <HeroDenRoof key={`${tile.id}-roof`} tileId={tile.id} position={tile.position} size={CLASSICPLUS_GRID_SIZE} />)}
          {!upright && <>
          {biomeTiles.filter(tile => tile.tileType !== 'hero-den' && !sharedLabelTiles.has(tile.id) && !tile.flags?.includes('unexplored')).map(tile => {
            const area = getBiomeWorldFootprint(tile);
            return <div key={`${tile.id}-title`} data-biome-title={tile.id} data-label-owner="tile" data-label-pinned={pinnedLabels.has(tile.id) || undefined} data-label-shown={labelShown([tile.id])} className="proto-tile-title-anchor" style={{ inset: 'auto', left: `calc(50% + ${area.x}px)`, top: `calc(50% + ${area.y}px)`, width: area.width, height: area.height, transform: 'translate(-50%, -50%)' }}>
              <TileTitle align="bottom" biome={tile.tileType ?? tile.terrain} text={tile.title} width={area.width} height={area.height} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame} onTextBox={box => reportBiomeLabel(tile.id, area, box)} />
            </div>;
          })}
          {biomeTiles.filter(tile => tile.tileType === 'hero-den' && !sharedLabelTiles.has(tile.id) && !tile.flags?.includes('unexplored')).map(tile => <div key={tile.id} className="proto-den-title" data-den-title="true" data-label-owner="tile" data-label-pinned={pinnedLabels.has(tile.id) || undefined} data-label-shown={labelShown([tile.id])} style={{ position: 'absolute', left: `calc(50% + ${tile.position.x}px)`, top: `calc(50% + ${tile.position.y}px)`, width: upright ? 48 : 72, height: upright ? 48 : 72, transform: 'translate(-50%, -50%)' }}>
            <TileTitle align="bottom" maxLines={1}
              clearCenter={!upright && actors.some(actor => { const p = (travel?.actorId === actor.id || Boolean(travel && journey?.memberRanks?.[actor.id] !== undefined)) && travelPosition ? travelPosition : getActorWorldPosition(actor); return Math.abs(p.x - tile.position.x) < 24 && Math.abs(p.y - tile.position.y) < 24; }) ? 18 : undefined}
              biome={tile.tileType ?? tile.terrain} text={tile.title} width={48} height={48} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame} />
          </div>)}
          {labelRegions.map(region => <div key={region.id} data-connected-label={region.id} data-label-tiles={region.tiles.map(tile => tile.id).join(' ')} data-label-owner="region" data-label-pinned={region.tiles.some(tile => pinnedLabels.has(tile.id)) || undefined} data-label-shown={labelShown(region.tiles.map(tile => tile.id))}
            data-immutable-region={region.tiles[0].tileType === 'impassable-mountain' ? region.id : undefined} data-region-tile-count={region.tiles.length}
            className="proto-immutable-region-label" style={{ left: `calc(50% + ${region.x}px)`, top: `calc(50% + ${region.y}px)`, width: region.width, height: region.height }}>
            <TileTitle align="bottom" biome={region.tiles[0].tileType ?? region.tiles[0].terrain} text={region.title} width={region.width} height={region.height} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame}
              onTextBox={box => region.tiles.forEach(tile => {
                const area = getBiomeWorldFootprint(tile);
                reportBiomeLabel(tile.id, area, { ...box,
                  left: box.left + region.x - region.width / 2 - area.left,
                  top: box.top + region.y - region.height / 2 - area.top,
                  pivot: { x: region.x - area.left, y: region.y - area.top } });
              })} />
          </div>)}
          </>}
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="proto-table-light pointer-events-none absolute z-40" style={{ inset: staged ? '-100%' : 0, transform: stageTransform, transition: tilted && airReady || !staged ? 'none' : undefined }}>
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
          getCamera={camera.getLiveCamera} getTilt={getCameraTilt} onCameraFrame={camera.onCameraFrame}
          frame={getVisualTableLighting(timeOfDay)}
          lights={lightSources}
          camera={camera.cameraState}
          areas={atmosphereAreas}
          quality={fxQuality}
          view={{ width: viewportWidth, height: viewportHeight }}
          tilt={tilt}
        /></div> : null}
        {airReady && tilt ? <DustMotes frame={getVisualTableLighting(timeOfDay)} quality={fxQuality} camera={camera.cameraState}
          tilt={tilt} getTilt={getCameraTilt} view={{ width:viewportWidth,height:viewportHeight }} getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame} /> : null}
        {/* Darkness is continuous through camera transitions; airReady gates
            decorative air effects only, never the visibility mask. */}
        {useVolume ? <VolumetricAtmosphere active={globalLights && !inactive} overhead={!tilted} lowQuality={fxQuality === 'low'}
          frame={getVisualTableLighting(timeOfDay)} lights={lightSources}
          scene={{ canopies:tilted ? atmosphereCanopies : [],patches:atmosphereAreas,
            relief:tilted ? [] : biomeTiles.filter(tile => tile.unlocked !== false && !tile.flags?.includes('unexplored') && (tile.tileType === 'impassable-mountain' || !tile.tileType && tile.terrain === 'woods')).map(tile => ({
              ...getBiomeWorldFootprint(tile), elevation:heightToWorld(sceneryHeightUnits(tile.sprite) ?? (tile.tileType === 'impassable-mountain' ? 11.6 : 8)) })),
            concealed:biomeTiles.filter(tile => tile.unlocked === false || tile.flags?.includes('unexplored')).map(getBiomeWorldFootprint) }}
          tilt={getAtmosphereTilt(camera.cameraState)} getTilt={getAtmosphereTilt} view={{ width:viewportWidth,height:viewportHeight }}
          getCamera={camera.getLiveCamera} onCameraFrame={camera.onCameraFrame}
        /> : airReady ? <LightShafts frame={getVisualTableLighting(timeOfDay)} quality={fxQuality} camera={camera.cameraState} view={{ width: viewportWidth, height: viewportHeight }} /> : null}
        {staged ? <div aria-hidden="true" className={`proto-table-horizon${tilted ? ' proto-table-horizon--shown' : ''}`} /> : null}
        <OffscreenWaypoints />
      </div>
      {dragPreview && !travel ? createPortal(
        <div
          aria-hidden="true"
          data-actor-drag-preview="true"
          className={`pointer-events-none fixed z-[100] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-[#ffe7ad]/80 bg-[#17140b]/55 text-base font-black uppercase tracking-[0.1em] text-[#ffe7ad]/80${upright ? ' shadow-[0_0_24px_rgba(255,209,102,0.22)]' : ''}`}
          data-actor-drag-ghost="true"
          style={{ left: dragPreview.x, top: dragPreview.y, zIndex: 100000 }}
        >
          {actors.find((actor) => actor.id === dragPreview.actorId)?.label ?? 'Hero'}
        </div>, document.body
      ) : null}
      {tileHold.feedback}
    </section>
    </TravelWorldContext.Provider>
    </TileDiscoveryProvider>
  );
};
