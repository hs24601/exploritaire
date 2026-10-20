import { ManaberryIcon } from './components/ManaberryIcon';
import { CaveTableauScenery } from './components/CaveTableauScenery';
import { dayOneTutorialQuest, pendingTutorialQuest } from './tutorialQuests';
import { DenQuestDiscovery } from './components/DenQuestDiscovery';
import { ActorMapCard } from './components/ActorMapCard';
import { SceneTree } from './components/SceneTree';
import { createSceneCheckpoint, sceneCheckpointFromSearch, type SceneCheckpointId } from './sceneCheckpoints';
import { buildDayCinematicBeats, dayCinematicBeatId } from './dayCinematics';
import { finishTravelPresentation } from './travelCompletion';
import { getCameraPlayback, playCameraSteps } from './cameraDirector';
import { TableauDragPreview } from './components/TableauDragPreview';
import { TableauEditor } from '../tooling/TableauEditor';
import { tileHasBerries } from './berryPresentation';
import { trackGameAnimation } from '../gameAnimations';
import { dayOneDepartureCamera } from './departureCamera';
import { isTextEditingTarget } from './keyboardInput';
import { GlobalPauseControl, useGlobalPauseLifecycle } from './components/GlobalPause';
import { gameTime } from '../gameTime';
import { useDayCinematics } from './hooks/useDayCinematics';
import { ScenarioCameraDetails } from './components/ScenarioCameraDetails';
import { SceneActorEmotion } from './components/SceneActorEmotion';
import { DayCinematicReview } from './components/DayCinematicReview';
import { CameraChoreographyTools, CameraChoreographyButton } from './components/CameraChoreographyTools';
import { useCameraStoryTriggers } from './hooks/useCameraStoryTriggers';
import { fireCameraTrigger, stopCameraPlayback } from './cameraDirector';
import { CalloutEditingProvider } from './components/CalloutEditing';
import { pointAlongTimedPath } from './gridPathfinding';
import { BanksRescueCinema } from './components/BanksRescueCinema';
import { createDayScenario, createDayOneState, dayOneAllowsPlan, dayOnePlan, dayOneReturning, dayTwoPatchForaged, dayTravelAction, dayOneHour, dayOneThought, manaCarrierLuminosity } from './dayScenarios';
import { DayForagingCallout } from './components/DayForagingCallout';
import { dayObjective } from './dayObjectives';
import type { TravelPlan } from './travelJourney';
import { tileDetailsCard } from './components/TileDetailsCard';
import { flyTravelCard } from './travelCardFlight';
import { TableauPlayArea } from './components/TableauTemplate';
import { TableauLighting } from './components/TableauLighting';
import { EVENT_CARDS_ENABLED } from './eventCards';
import { removeTravelEvents } from './travelJourney';
import { EventDiscardPile } from './components/EventDiscardPile';
import { partyMembers, joinParty, leaveParty, addPartyCompanion } from './partySystem';
import { TravelTableau } from './components/TravelTableau';
import { TileEditor } from './tileEditor/TileEditor';
import { SAVED_TILE_DOCUMENT, materializeTiles, applyTileDocument } from './tileEditor/runtime';
import { authorTile, coversCell, type TileDocument } from './tileEditor/schema';
import { paintTravelProgress, breachTravelPassage, beginJourney, travelStartingRank, prepareTravelTableau, travelTableauHeld, checkTravelCairn, bestTravelMove, playTravelCard, playTravelEvent, travelEventCost, discardTravelEvent, redrawTravel, TRAVEL_STAMINA_MAX } from './travelJourney';
import { AbilityTray } from './components/AbilityTray';
import { availableMovesFor } from './rules/battleAbilities';
import { ActorPlaytestEditor, DEFAULT_ACTOR_DESCRIPTION } from './components/ActorPlaytestEditor';
import { ArtSettings } from './components/ArtSettings';
import { useGlobalLights, setGlobalLightsEnabled } from './globalLighting';

import { ACTOR_HOLO_ART } from './art/actorCardArt';
import { JumboActionCard } from './components/CardJumbo';
import { drawSleepStock, isDenRest, REST_COLUMNS, REST_ROWS, SLEEP_ICONS, SLEEP_LABELS } from './rules/rest';
import { ActorHoloCard } from './components/ActorHoloCard';
import { activateBiome, arriveActorAtBiome } from './biomeArrival';
import { eatSupper, isHome, ordinaryThought, SUPPER_MANA } from './rules/ordinaryDay';
import { discoverActorTiles, discoverTiles } from './tileDiscovery';
import { TABLE_GRID } from './gridCoordinates';
import { DISABLE_INSPIRATION_CONSUMPTION, canSpendInspiration, spendInspiration } from './inspirationTesting';
import { flyQuestToDiscard } from './questDiscardFlight';
import { TableauLandscape } from './components/TableauLandscape';
import { FoundationExitButton } from './components/FoundationExitButton';
import { createTableauLightRig } from './tableauLighting';
import { tableauDepartures } from './tableauDepartures';
import { actorLight, biomeLights } from './protoLighting';
import { solverFlightDuration } from './solverTiming';
import { type PlacedQuestCard } from './components/TableQuestCard';
import { QuestArtwork, QuestEmblem } from './components/QuestArtwork';
import { DetailsCardViewer, ActorCardArt, type DetailsCardObject } from './components/DetailsCardViewer';
import { requestHoloDeviceTilt } from './useHoloDeviceTilt';
import { redeemActiveQuest } from './questProgress';
import { logHold } from './holdLog';
import { blockedSolids } from './worldBounds';
import { DEFAULT_ACTOR_LUMINOSITY, getTableLighting, tableObjectShadow } from './protoLighting';
import { TimeOfDaySlider } from './components/TimeOfDaySlider';
import { PondField } from './components/PondField';
import { WorldMinimap } from './components/WorldMinimap';
import { CombatDemo } from './components/CombatDemo';
import type { BattleScene } from './rules/battleCues';
import { BattleTableauField } from './components/BattleTableauField';
import './components/CombatField.css';
import { GLOWFISH_TABLE_LIGHT, POND_MISS_INSPIRATION, POND_SPECIES, isPondCatch, castBait, eatPondCatch, endGlowfishGlow, landHooked, loseHooked, restockPond } from './rules/fishing';


import { PROTO_BUILD_COMMIT, PROTO_BUILD_LABEL, PROTO_BUILD_TITLE } from './buildInfo';
import { assessSolverMove, preserveSolverRpgValues, type SolverMove } from './tableauSolver';
import { TableauSolveControls, type SolveStepResult } from './components/TableauSolveControls';
import { nextQuestCard, isQuestPlacement } from './protoQuestDeals';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { advanceBuild, splitStack, playBuildCard, stackIngredients, ingredientCount, startStackBuild, WORLD_ITEMS, CRAFT_RECIPES, type WorldItemId } from './protoCrafting';
import { ProtoCardFlight } from './components/ProtoCardFlight';
import { snapshotCardBackground } from './components/BiomeCardBackground';
import { cardResourceFace } from './cardResourceFace';
import { createRuntimeId } from './runtimeId';
import type { FoodLanding } from './components/FoodCollectionFx';
import {
  DEFAULT_CHIP_ABILITY,
  DEFAULT_BIOME,
  DEFAULT_EXPEDITION_ENERGY,
  MAGE_PHASE_SHIFT_TRIGGER,
  WORLD_ACTOR_SPRITES,
  biomeTileSprite,
} from './protoData';
import {
  getCardTransportDurationMs,
  interpolateCardTransport,
  type CardTransportPoint,
} from './protoTransport';
import { Tableau } from '../golf/components/Tableau';
import {
  ProtoMap,
  getBiomeWorldFootprint,
  type ProtoBiomeTile,
  type ProtoWorldActor,
  type ProtoWorldResourceStack,
} from './components/ProtoMap';
import { ProtoCard } from './components/ProtoCard';
import { ActorFoundationPanel, EnemyTeamPanel } from './components/FoundationBoards';
import { AbilityDetailPopup } from './components/AbilityDetailPopup';
import { AutoPlayControl } from './components/AutoPlayControl';
import {
  ACTOR_INSPIRATION_MAX, AUTO_PLAY_SPEED_OPTIONS, DEV_ACTOR_DEFEAT_OVERRIDE, FOUNDATION_MOCKUPS, FOUNDATION_SLOTS,
  rankLabel, targetToneForAbility,
  type AbilityDetail, type Card, type CardTransport,
  type HeroBuff, type PendingAbilityTarget, type PendingMobility,
  type PendingTargetSelection, type ProtoState, type TargetAnnouncement,
} from './protoState';
import { ACTOR_WORK_RESOURCES, DAY_TWO_RATION_ENERGY, DAY_TWO_RATION_INSPIRATION, ENCOUNTER_GLYPH, ENEMY_TEAM_MOCKUPS, FOREST_RESOURCE_GLYPHS, FOREST_RESOURCE_LABELS, FOREST_RESOURCE_ORDER, MOBILITY_COOLDOWN_TURNS, TABLEAU_COLUMNS, TABLEAU_ROWS, addForestHaul, canAffordExplorationAction, canPlayOnFoundation, cloneState, createAmbushCombatDeal, isPondTile, isDangerTile, DANGER_WOODS_REWARD, createFoundations, createInitialState, createQuestExplorationFoundations, drawTableauReplacement, getExpeditionQuestSteps, isAdjacentRank, isBiomeDealComplete, isOpenExplorationFoundation, materializeDeepWoods, spendExplorationEnergy } from './rules/setup';
import { adjacentFoundationIndexes, applyFoundationPlay, discardTableauEvent, utilityRetrievalCost, hasNormalPlayerTableauMove } from './rules/play';
import { REDRAW_INSPIRATION_COST } from './rules/redraw';
import { AMBUSH_PLAYER_CARD_BUDGET, ENEMY_TURN_MAX_MOVES, actorIndexForId, applyEnemyTableauMove, getTauntTargetIndex, hasBlinkStrain, resolveEnemyIntents, selectEnemyTableauMove } from './rules/combat';
import { biomeOpenState } from './biomeFlags';

/** Hour the table opens at, on the first day and every day after. */
const TABLE_OPENING_HOUR = 0;


/** Keep the active deal beside a larger world or combat view. */
const desktopLayoutTracks = (tableauPresent: boolean, headerPresent: boolean) => {
  const tracks = tableauPresent
    ? [['tableau', 'minmax(0, 1fr)'], ['map', 'minmax(0, 1.7fr)']]
    : [['map', 'minmax(0, 1fr)']];
  return {
    '--layout-columns': tracks.map(([, size]) => size).join(' '),
    '--layout-areas': (headerPresent ? '"' + tracks.map(() => 'header').join(' ') + '" ' : '') + '"' + tracks.map(([area]) => area).join(' ') + '"',
    '--layout-rows': headerPresent ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
  } as CSSProperties;
};

const mobilityLabelForKind = (kind: PendingMobility['kind']) =>
  kind === 'hallowed_path' ? 'Hallowed Path' : kind;

const addSpentComboProgress = (progress: Record<string, number>, ability: PendingAbilityTarget) => {
  if (ability.sourceClass !== 'Mage' || ability.effectType === 'phase_shift') return progress;
  return {
    ...progress,
    [MAGE_PHASE_SHIFT_TRIGGER.id]: Math.min(
      MAGE_PHASE_SHIFT_TRIGGER.threshold,
      (progress[MAGE_PHASE_SHIFT_TRIGGER.id] ?? 0) + ability.power,
    ),
  };
};



/** Size of the actor pop-up on its foundation card in the battle camera, in px. */


export const ProtoVariant = ({ authoring = false }: { authoring?: boolean } = {}) => {
  const [editorDocument, setEditorDocument] = useState<TileDocument | null>(() => authoring ? JSON.parse(JSON.stringify(SAVED_TILE_DOCUMENT)) : null);
  const editorOpen = editorDocument !== null;
  const [scenarioRun, setScenarioRun] = useState(0);
  const [initialScene] = useState(() => {
    const id = authoring ? undefined : sceneCheckpointFromSearch(window.location.search);
    const state = id ? createSceneCheckpoint(id) : authoring ? createDayScenario('sandbox') : createDayOneState();
    return { id, state };
  });
  const [sceneCheckpoint, setSceneCheckpoint] = useState<SceneCheckpointId | undefined>(initialScene.id);
  const [settledSceneBeat, setSettledSceneBeat] = useState<string | null>(() => initialScene.id ? dayCinematicBeatId(initialScene.state) : null);
  const [editorMenu, setEditorMenu] = useState<{ cell: ReturnType<typeof TABLE_GRID.cell>; x: number; y: number } | null>(null);
  const [editorCell, setEditorCell] = useState(() => TABLE_GRID.cell(0, 2));
  const appliedTileDocument = useRef<TileDocument | null>(null);
  const [state, setState] = useState<ProtoState>(() =>
    initialScene.state,
  );
  useCameraStoryTriggers(state, scenarioRun, editorOpen);
  useEffect(() => {
    if (!EVENT_CARDS_ENABLED) setState(removeTravelEvents);
  }, []);
  useEffect(() => {
    if (editorOpen) return;
    setState(discoverActorTiles);
  }, [state.worldActors, state.biomeTiles, editorOpen]);
  const previewTiles = useMemo(() => editorDocument ? materializeTiles(editorDocument, state.biomeTiles).map(tile => ({ ...tile,
    flags: tile.flags?.filter(flag => flag !== 'unexplored'), unlocked: true, traversalProgress: 1 })) : state.biomeTiles, [editorDocument, state.biomeTiles]);
  const [pendingTargetSelection, setPendingTargetSelection] =
    useState<PendingTargetSelection | null>(null);
  const [utility, setUtility] = useState<{ foundationIndex: number; move: 'Fetch' | 'Dig' } | null>(null);
  useEffect(() => { setUtility(null); }, [state.selectedBiomeId, state.worldActors]);
  const [pendingWildCardTarget, setPendingWildCardTarget] = useState(false);
  const [pendingMobility, setPendingMobility] = useState<PendingMobility | null>(null);
  const [pendingAbilityTarget, setPendingAbilityTarget] = useState<PendingAbilityTarget | null>(null);
  const [burningEnemyIds, setBurningEnemyIds] = useState<string[]>([]);
  const [targetAnnouncement, setTargetAnnouncement] = useState<TargetAnnouncement | null>(null);
  const [abilityDetail, setAbilityDetail] = useState<AbilityDetail | null>(null);
  const [selectedAdvisorAbilities, setSelectedAdvisorAbilities] = useState<Record<number, string | null>>({});
  const [undoStack, setUndoStack] = useState<ProtoState[]>([]);
  const [playerAutoPaused, setPlayerAutoPaused] = useState(true);
  const [enemyAutoPaused, setEnemyAutoPaused] = useState(false);
  const [playerAutoSpeedIndex, setPlayerAutoSpeedIndex] = useState(1);
  const [enemyAutoSpeedIndex, setEnemyAutoSpeedIndex] = useState(1);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'enemy'>('player');
  const [turnCount, setTurnCount] = useState(1);
  const [cardTransport, setCardTransport] = useState<CardTransport | null>(null);
  const [foodLanding, setFoodLanding] = useState<(FoodLanding & { foundationIndex: number; biomeId: string | null }) | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'map' | 'tableau'>('map');
  const [scenarioExpanded, setScenarioExpanded] = useState(false);

  const [inspectedActorId, setInspectedActorId] = useState<string | null>(null);
  const [inspectedTileId,setInspectedTileId]=useState<string|null>(null);
  const [inspectionAnchor, setInspectionAnchor] = useState<HTMLElement | null>(null);
  const [inspectionId, setInspectionId] = useState(0);
  const [inspectionJumboId, setInspectionJumboId] = useState<string | null>(null);
  const inspectActor = (id: string, anchor: HTMLElement, _jumbo = false) => {
    setInspectedTileId(null);
    setInspectionJumboId(id);
    requestHoloDeviceTilt();
    setInspectionId(value => value + 1);
    const actor = state.worldActors.find(entry => entry.id === id);
    const tile = anchor.closest('.proto-map') && actor ? state.biomeTiles.find(tile => {
      if (actor.location === 'foundation') return tile.id === actor.biomeId;
      const area = getBiomeWorldFootprint(tile);
      return actor.position.x >= area.left && actor.position.x < area.right && actor.position.y >= area.top && actor.position.y < area.bottom;
    }) : undefined;
    // Keep the compact card anchored to the actor's square in perspective.
    // The tile supplies placement only; it never adds a tile inspection card.
    setInspectionAnchor(tile && !tile.flags?.includes('unexplored') ? document.querySelector<HTMLElement>(`button[data-biome-id="${tile.id}"]`) ?? anchor : anchor);
    setInspectedActorId(id);
  };
  const inspectTile=(id:string,anchor:HTMLElement)=>{
    const tile=state.biomeTiles.find(t=>t.id===id);
    if(!tile||tile.flags?.includes('unexplored')||!tile.unlocked)return;
    setInspectedActorId(null);setInspectedTileId(id);setInspectionJumboId(null);setInspectionAnchor(anchor);setInspectionId(value=>value+1);
  };
  const closeInspection = () => { setInspectedActorId(null);setInspectedTileId(null); };
  // Hold midnight unless the player changes time or enables cycling.
  const [tableHours, setTableHours] = useState(10);
  const scriptedHour = state.dayScenario ? dayOneHour(state) : null;
  useEffect(() => { if (scriptedHour !== null) setTableHours(scriptedHour); }, [scriptedHour]);
  // Battle-camera tilt for the table and the tableau field, toggled from the map.
  const [cameraTilted, setCameraTilted] = useState(false);
  useGlobalPauseLifecycle();
  // Capture both phases, including on buttons, without stealing editable text or shortcuts.
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isTextEditingTarget(event.target)) return;
      const pause = event.code === 'Space' || event.key === ' ';
      const view = event.code === 'KeyO' || event.key.toLowerCase() === 'o';
      if (!pause && !view) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'keydown' && !event.repeat) {
        if (pause) gameTime.setPaused(!gameTime.isPaused());
        else if (!gameTime.isPaused()) { stopCameraPlayback(); setCameraTilted(value => !value); }
      }
    };
    const block = (event: Event) => {
      if ((event.target instanceof Element && event.target.closest('[data-editor-safe="true"]')) || !gameTime.isPaused() || isTextEditingTarget(event.target) || (event.target instanceof Element && event.target.closest('[data-global-pause-control]'))) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', shortcut, true); window.addEventListener('keyup', shortcut, true);
    const blocked = ['pointerdown', 'pointermove', 'pointerup', 'mousemove', 'touchmove', 'click', 'dblclick', 'wheel', 'keydown', 'keyup'] as const;
    blocked.forEach(type => window.addEventListener(type, block, { capture: true, passive: false }));
    return () => {
      window.removeEventListener('keydown', shortcut, true); window.removeEventListener('keyup', shortcut, true);
      blocked.forEach(type => window.removeEventListener(type, block, true));
    };
  }, []);
  const engagementKey = state.worldActors
    .filter(actor => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId)
    .map(actor => `${actor.biomeId}:${actor.id}`).sort().join('|');
  const [cycleLighting, setCycleLighting] = useState(false);
  const [tableLightsEnabled, setTableLightsEnabled] = useState(!authoring);
  const globalLights = useGlobalLights();
  // Guidance highlights every playable tableau card; off by default.
  const [moveGuidance, setMoveGuidance] = useState(false);
  const [lightReadoutVisible, setLightReadoutVisible] = useState(false);
  const lighting = getTableLighting(tableHours);
  // Each later day uses the same midnight opening.
  const startedDay = useRef(state.day);
  useEffect(() => { if (state.day !== startedDay.current) { startedDay.current = state.day; setTableHours(state.dayScenario ? dayOneHour(state) : TABLE_OPENING_HOUR); } }, [state.day]);
  useEffect(() => {
    if (!cycleLighting) return;
    let previous = gameTime.now();
    const timer = gameTime.setInterval(() => {
      const now = gameTime.now();
      const elapsed = (now - previous) / 1000;
      previous = now;
      setTableHours((hours) => (hours + elapsed * 0.2) % 24);
    // Each tick re-renders the whole table; light drifts slowly, so once a second
    // is smooth enough and keeps phones free to answer input.
    }, 1000);
    return () => gameTime.clearInterval(timer);
  }, [cycleLighting]);
  const tableLights = tableLightsEnabled ? [
    ...biomeLights(state.biomeTiles),
    ...(state.city.campBuilt ? [{ id: 'camp-lamp', position: { x: 0, y: 96 }, radius: 5.5, height: 120, color: '#ff8a3d', flicker: 1 }] : []),
    ...state.worldResourceStacks.filter((stack) => stack.resource === 'provisions_hut' && !stack.build)
      .map((stack) => ({ id: 'hut-lamp-' + stack.id, position: { x: stack.position.x + 36, y: stack.position.y - 36 }, radius: 4, height: 85, color: '#ffd08a', flicker: 0.3 })),
    ...state.worldResourceStacks.filter((stack) => !stack.build && (stack.resource === 'glowfish' || (stack.ingredients?.glowfish ?? 0) > 0))
      .map((stack) => ({ id: 'glowfish-' + stack.id, position: stack.position, ...GLOWFISH_TABLE_LIGHT })),
  ] : [];
  useEffect(() => {
    const docked = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setState(prev => prev.dayScenario === 'day01' && prev.discoveredTutorialQuests?.includes(id)
        ? { ...prev, dockedTutorialQuests: [...new Set([...(prev.dockedTutorialQuests ?? []), id])] } : prev);
    };
    window.addEventListener('proto-quest-docked', docked);
    return () => window.removeEventListener('proto-quest-docked', docked);
  }, []);
  const foundQuest = pendingTutorialQuest(state);
  const discoverQuest = (id: string) => setState(prev => {
    if(pendingTutorialQuest(prev)?.id!==id)return prev;
    const next = {...prev, denQuestDiscovered:prev.denQuestDiscovered || id==='navigate-den', discoveredTutorialQuests:[...new Set([...(prev.discoveredTutorialQuests ?? []),id])]};
    return id === 'denser-patch' && (prev.journey?.walkedProgress ?? 0) >= 1 ? finishTravelPresentation(next) : next;
  });
  const stateRef = useRef(state);
  const tableauCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const foundationTransportRefs = useRef<Array<HTMLElement | null>>([]);
  const foundationActorPointerRef = useRef<{ actorId: string; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const enemyTransportRefs = useRef<Array<HTMLDivElement | null>>([]);
  const enemyMovesMadeRef = useRef(0);
  const cardTransportPositionRef = useRef<CardTransportPoint>({ x: 0, y: 0 });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!targetAnnouncement) return undefined;
    const timeoutId = gameTime.setTimeout(() => {
      setTargetAnnouncement(null);
    }, 3000);
    return () => gameTime.clearTimeout(timeoutId);
  }, [targetAnnouncement]);

  useEffect(() => {
    if (burningEnemyIds.length === 0) return undefined;
    const timeoutId = gameTime.setTimeout(() => {
      setState((prev) => {
        const enemyTeam = prev.enemyTeam.filter((enemy) => !burningEnemyIds.includes(enemy.id));
        if (enemyTeam.length > 0) return { ...prev, enemyTeam };
        const suspendedExploration = prev.suspendedExploration;
        const restoredTableau = suspendedExploration?.tableau ?? prev.tableau;
        const restoredStock = suspendedExploration?.stock ?? prev.stock;
        const cacheAwarded =
          !prev.biome.cacheClaimed &&
          isBiomeDealComplete(restoredTableau, restoredStock);
        return {
          ...prev,
          enemyTeam,
          tableau: restoredTableau,
          stock: restoredStock,
          scene: 'exploration',
          suspendedExploration: null,
          biome: cacheAwarded ? { ...prev.biome, cacheClaimed: true } : prev.biome,
          haul: cacheAwarded ? addForestHaul(prev.haul, prev.biome.cacheReward) : prev.haul,
          foundations: createQuestExplorationFoundations(prev.party,
            prev.biomeTiles.find((tile) => tile.id === prev.selectedBiomeId)?.gridSize.columns ?? 1,
            restoredTableau),
          heroBuffs: prev.heroBuffs.map(() => []),
          abilityProgress: { [MAGE_PHASE_SHIFT_TRIGGER.id]: 0 },
          mobilityUsed: false,
          mobilityCooldown: 0,
          ambushCardsRemaining: 0,
          deepEncounterResolved: prev.selectedBiomeId === 'woods-beta' ? true : prev.deepEncounterResolved,
        };
      });
      setBurningEnemyIds([]);
    }, 700);
    return () => gameTime.clearTimeout(timeoutId);
  }, [burningEnemyIds]);

  const clearPendingInteractions = () => {
    setUtility(null);
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingMobility(null);
    setPendingAbilityTarget(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({});
  };

const selectBiome = (biomeId: string) => {
    if (state.journey || state.scene !== 'exploration' || biomeId === state.selectedBiomeId) return;
    const target = state.biomeTiles.find((tile) => tile.id === biomeId);
    // An unknown biome keeps its tableau hidden until an actor gets nearby.
    if (!target || !target.unlocked || !biomeOpenState(target.flags).opens) return;
    clearPendingInteractions();
    setState(prev => activateBiome(prev, biomeId));
  };

  const dropActorToTable = (
    actorId: string,
    destination?: { x: number; y: number },
    arrival: { biomeId?: string; directBiome?: boolean; foundationIndex?: number } = {},
  ) => {
    const actor = state.worldActors.find((entry) => entry.id === actorId);
    if (!actor) return;
    if (state.dayScenario && destination && !state.journey &&
      (destination.x !== actor.position.x || destination.y !== actor.position.y)) return;
    const hut = destination && state.worldResourceStacks.find((stack) =>
      (stack.resource === 'provisions_hut' && !stack.build || stack.build && CRAFT_RECIPES.find((recipe) => recipe.id === stack.build?.recipeId)?.output === 'provisions_hut') &&
      Math.hypot(stack.position.x - destination.x, stack.position.y - destination.y) < 52);
    if (hut && actor.location === 'table') {
      setState((prev) => ({ ...prev, worldActors: prev.worldActors.map((entry) => entry.id === actorId ? { ...entry, location: 'table' as const, hutId: hut.id, foundationIndex: undefined, position: hut.position } : entry) }));
      return;
    }
    if (arrival.biomeId && destination) {
      clearPendingInteractions();
      setState(prev => arriveActorAtBiome(prev, actorId, arrival.biomeId!, destination, arrival.foundationIndex));
      return;
    }
    if (actor.location === 'table') {
      if (destination) setState(prev => ({ ...prev, worldActors: prev.worldActors.map(entry => partyMembers(prev, actorId).some(member => member.id === entry.id)
        ? { ...entry, position: destination, biomeId: undefined, hutId: undefined } : entry) }));
      return;
    }
    if (actor.location !== 'foundation') return;
    const biome = state.biomeTiles.find((tile) => tile.id === actor.biomeId) ?? state.biomeTiles[0];
    if (!biome) return;
    const foundationIndex = Number.isInteger(actor.foundationIndex) && (actor.foundationIndex ?? -1) >= 0
      ? actor.foundationIndex as number
      : 0;
    const arrivalPosition = destination ?? { x: biome.position.x, y: biome.position.y + 96 };
    clearPendingInteractions();
    setState((prev) => ({
      ...prev,
      foundations: prev.foundations.map((slot, index) =>
        actor.biomeId === prev.selectedBiomeId && partyMembers(prev, actorId).some(member => (member.foundationIndex ?? 0) === index) && slot ? { ...slot, count: 0, cards: [], wildcardBridgeFromRank: undefined } : slot,
      ),
      worldActors: prev.worldActors.map((entry) =>
        partyMembers(prev, actorId).some(member => member.id === entry.id)
          ? { ...entry, location: 'table' as const, foundationIndex: undefined, biomeId: arrival.biomeId, position: arrivalPosition, hutId: hut?.id }
          : entry,
      ),
      settledHaul: { ...prev.haul },
    }));
  };

  const moveResourceStack = (stackId: string, position: { x: number; y: number }, targetId?: string, actorId?: string) => {
    const leftoverId = createRuntimeId();
    const eaten = actorId ? state.worldResourceStacks.find((stack) => stack.id === stackId && !stack.build && Object.keys(stackIngredients(stack)).length === 1) : undefined;
    if (eaten?.resource === 'glowfish') setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'GLOWING', impact: '+2 max INSP and a brighter light until nightfall' });
    else if (eaten?.resource === 'kingfish') setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'FEAST', impact: 'Inspiration fully restored' });
    else if (eaten && isPondCatch(eaten.resource)) setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: WORLD_ITEMS[eaten.resource].label.toUpperCase(), impact: `+${POND_SPECIES.find((species) => species.id === eaten.resource)?.inspiration} INSP` });
    setState((prev) => {
      const source = prev.worldResourceStacks.find((stack) => stack.id === stackId);
      if (!source || source.build || WORLD_ITEMS[source.resource].kind === 'structure') return prev;
      if (actorId && isPondCatch(source.resource) && Object.keys(stackIngredients(source)).length === 1) {
        const fed = eatPondCatch(prev, source.resource, actorId, prev.actorMaxInspiration?.[0] ?? ACTOR_INSPIRATION_MAX);
        return { ...fed, worldResourceStacks: prev.worldResourceStacks.map((stack) => stack.id === source.id ? { ...stack, count: stack.count - 1, ingredients: undefined } : stack).filter((stack) => stack.count > 0) };
      }
      if (actorId && (source.resource === 'trail_ration' || source.resource === 'hearty_ration') && Object.keys(stackIngredients(source)).length === 1) {
        const bonus = source.resource === 'hearty_ration' ? DAY_TWO_RATION_ENERGY * 2 : DAY_TWO_RATION_ENERGY;
        return { ...prev, inspiration: Math.min(prev.maxInspiration + bonus, prev.inspiration + bonus),
          actorInspiration: prev.actorInspiration.map((value, index) => index === 0 ? Math.min(prev.actorMaxInspiration?.[0] ?? ACTOR_INSPIRATION_MAX, value + bonus) : value),
          energy: prev.energy + bonus, energyMax: prev.energyMax + bonus,
          heroBuffs: prev.heroBuffs.map((buffs, index) => index === 0 ? [...buffs.filter((buff) => buff.id !== 'well_fed'), { id: 'well_fed' as const, value: bonus, turnsRemaining: bonus }] : buffs),
          trailRations: source.resource === 'trail_ration' ? Math.max(0, prev.trailRations - 1) : prev.trailRations,
          worldResourceStacks: prev.worldResourceStacks.map((stack) => stack.id === source.id ? { ...stack, count: stack.count - 1, ingredients: undefined } : stack).filter((stack) => stack.count > 0) };
      }
      const target = prev.worldResourceStacks.find((stack) => stack.id === targetId && stack.id !== source.id && !stack.build);
      if (target?.resource === 'provisions_hut') {
        if (prev.worldResourceStacks.some((stack) => stack.build?.stationId === target.id)) return prev;
        const placed = { ...source, position: { x: target.position.x + 58, y: target.position.y }, stationId: target.id };
        const builds = startStackBuild(placed, target, leftoverId);
        return { ...prev, worldResourceStacks: [...prev.worldResourceStacks.filter((stack) => stack.id !== source.id), ...builds] };
      }
      if (target) {
        const ingredients = { ...stackIngredients(target) };
        Object.entries(stackIngredients(source)).forEach(([id, count]) => { const item = id as WorldItemId; ingredients[item] = (ingredients[item] ?? 0) + count; });
        const combined = { ...target, ingredients, count: ingredientCount(ingredients) };
        return { ...prev, worldResourceStacks: [...prev.worldResourceStacks.filter((stack) => stack.id !== source.id && stack.id !== target.id), ...startStackBuild(combined, prev.worldResourceStacks.find((entry) => entry.id === target.stationId), leftoverId)] };
      }
      return { ...prev, worldResourceStacks: prev.worldResourceStacks.flatMap((stack) => stack.id === source.id ? startStackBuild({ ...stack, position, stationId: undefined }, undefined, leftoverId) : [stack]) };
    });
  };

  const pondSelected = isPondTile(state.selectedBiomeId, state.biomeTiles);
  const pondAngler = state.worldActors.find((actor) => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId && isPondTile(actor.biomeId, state.biomeTiles)) ?? null;
  // Casting needs inspiration, since a miss costs some.
  const canCastPond = Boolean(pondAngler) && state.scene === 'exploration' && canSpendInspiration(state.inspiration, POND_MISS_INSPIRATION);
  const castPondBait = (baitId: string) => {
    if (!canCastPond) return;
    setState((prev) => {
      const { pond, hooked } = castBait(prev.pond, baitId);
      if (pond === prev.pond) return prev;
      return { ...prev, pond, inspiration: hooked ? prev.inspiration : spendInspiration(prev.inspiration, POND_MISS_INSPIRATION) };
    });
  };
  // Temporary camera study replaces the Dark Woods skirmish entry only.
  const dangerSelected = isDangerTile(state.selectedBiomeId);
  const dangerFighter = state.worldActors.find((actor) => actor.location === 'foundation' && isDangerTile(actor.biomeId)) ?? null;
  const [combatDemoOpen, setCombatDemoOpen] = useState(() => new URLSearchParams(window.location.search).has('combatdemo'));
  const dayCinema = useDayCinematics(state, scenarioRun, editorOpen || combatDemoOpen, settledSceneBeat);
  useEffect(() => {
    if (!sceneCheckpoint) return;
    const beatId = settledSceneBeat ?? 'day01.opening';
    const beat = buildDayCinematicBeats(state).find(b => b.id === beatId);
    const bubbleCamera = beat?.bubbleCameras?.[1];
    const steps = beat?.choreography.steps;
    const last = (bubbleCamera?.kind === 'shot' ? bubbleCamera.step : undefined) ?? steps?.[steps.length - 1];
    if (!last) return;
    const home = state.biomeTiles.find(t => t.id === 'hero-den')?.position;
    const shot = ['day01.opening', 'day01.leave-den', 'day01.navigate-den'].includes(sceneCheckpoint) && home
      ? { x: home.x + 4.11, y: home.y - 43.47, scale: 10.469, yaw: 200.4, pitch: 54.8, tilted: true, framing: .24 }
      : last.shot;
    let frame = 0, cancelled = false;
    const apply = () => {
      if (cancelled) return;
      if (!getCameraPlayback().available) { frame = requestAnimationFrame(apply); return; }
      playCameraSteps([{ ...last, shot, durationMs: 0, holdMs: 0, easing: 'cut' }], false, 'Scene checkpoint');
    };
    frame = requestAnimationFrame(apply);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [scenarioRun, sceneCheckpoint]);
  const [combatDemoReplay, setCombatDemoReplay] = useState(0);
  const [battleScene, setBattleScene] = useState<BattleScene | undefined>(undefined);
  const watchBattleScene = () => { setCombatDemoReplay(replay => replay + 1); setCombatDemoOpen(true); setMobilePanel('map'); };
  const demoArrival = useRef<string | null>(null);
  useEffect(() => {
    const id = dangerFighter?.id ?? null;
    if (id && demoArrival.current !== id) { setCombatDemoOpen(true); setMobilePanel('map'); }
    demoArrival.current = id;
  }, [dangerFighter?.id]);

  // The fight's outcome: a landed fish joins the haul at once, as its kind.
  const endPondFight = (landed: boolean) => {
    const preview = landed ? landHooked(state.pond) : null;
    if (preview?.caught && pondAngler) setFoodLanding({ id: createRuntimeId(), foundationIndex: pondAngler.foundationIndex ?? 0,
      biomeId: state.selectedBiomeId, berries: false, glyph: '✨', x: 20 + Math.random() * 60, y: 25 + Math.random() * 45 });
    if (preview?.bonus === 'glowfish') setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'GLOWFISH', impact: 'Lucky! It glows. Eat it for light' });
    else if (preview?.caught === 'kingfish') setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'KINGFISH', impact: 'A feast. Eat it to restore all inspiration' });
    setState((prev) => {
      if (!prev.pond.hooked) return prev;
      if (!landed) return { ...prev, pond: loseHooked(prev.pond) };
      const { pond, caught: kind, bonus } = landHooked(prev.pond);
      return kind ? { ...prev, pond, haul: addForestHaul(prev.haul, { [kind]: 1, ...(bonus ? { [bonus]: 1 } : {}) }) } : { ...prev, pond };
    });
  };

  const splitResourceStack = (stackId: string) => {
    const id = createRuntimeId();
    setState((prev) => ({ ...prev, worldResourceStacks: prev.worldResourceStacks.flatMap((stack) => stack.id === stackId ? splitStack(stack, id) : [stack]) }));
  };

  const playHutCard = (stackId: string, rank: number, divine = false) => {
    setState((prev) => {
      const stack = prev.worldResourceStacks.find((entry) => entry.id === stackId);
      if (!stack?.build?.stationId || (!divine && (prev.scene !== 'exploration' || !canSpendInspiration(prev.actorInspiration[0], 1) || !prev.worldActors.some((actor) => actor.hutId === stack.build?.stationId)))) return prev;
      let played = playBuildCard(stack, rank);
      if (played === stack) return prev;
      if (divine && played.build) {
        const recipe = CRAFT_RECIPES.find((entry) => entry.id === played.build?.recipeId)!;
        if (played.build.work >= recipe.workRequired) played = advanceBuild({ ...played, build: { ...played.build, elapsedMs: recipe.durationMs } }, 0, true);
      }
      return { ...prev, actorInspiration: divine ? prev.actorInspiration : prev.actorInspiration.map((value, index) => index === 0 ? spendInspiration(value, 1) : value),
        worldResourceStacks: prev.worldResourceStacks.map((entry) => entry.id === stack.id ? played : entry) };
    });
  };

  useEffect(() => {
    if (editorOpen) return;
    let lastTick = gameTime.now();
    const timer = gameTime.setInterval(() => {
      const now = gameTime.now();
      const elapsedMs = now - lastTick;
      lastTick = now;
      setState((prev) => {
        if (prev.scene !== 'exploration' || !prev.worldResourceStacks.some((stack) => stack.build)) return prev;
        const stacks = prev.worldResourceStacks.map((stack) => advanceBuild(stack, elapsedMs, Boolean(prev.worldActors.some((actor) => actor.hutId === stack.build?.stationId))));
        const rations = stacks.filter((stack, index) => prev.worldResourceStacks[index].build && !stack.build && stack.resource === 'trail_ration').length;
        return { ...prev, worldResourceStacks: stacks, trailRations: prev.trailRations + rations };
      });
    }, 250);
    return () => gameTime.clearInterval(timer);
  }, [editorOpen]);

  useEffect(() => {
    if (state.scene !== 'exploration' || !state.selectedBiomeId) return;
    setState((prev) => {
      const tile = prev.biomeTiles.find((entry) => entry.id === prev.selectedBiomeId);
      if (!tile) return prev;
      const sameTableau = JSON.stringify(tile.tableau.map((column) => column.map((card) => card.id))) === JSON.stringify(prev.tableau.map((column) => column.map((card) => card.id)));
      const sameStock = JSON.stringify(tile.stock.map((card) => card.id)) === JSON.stringify(prev.stock.map((card) => card.id));
      if (sameTableau && sameStock) return prev;
      return {
        ...prev,
        biomeTiles: prev.biomeTiles.map((entry) =>
          entry.id === prev.selectedBiomeId
            ? {
                ...entry,
                tableau: prev.tableau.map((column) => column.map((card) => ({ ...card }))),
                stock: prev.stock.map((card) => ({ ...card })),
              }
            : entry,
        ),
      };
    });
  }, [state.scene, state.selectedBiomeId, state.tableau, state.stock]);

  const beginCombatEncounter = (columnIndex: number) => {
    clearPendingInteractions();
    setTargetAnnouncement(null);
    setState((prev) => {
      if (prev.scene !== 'exploration') return prev;
      const column = prev.tableau[columnIndex] ?? [];
      const encounter = column[column.length - 1] ?? null;
      if (encounter?.encounter !== 'shadow_wolf_cub') return prev;
      const combatDeal = createAmbushCombatDeal();
      return {
        ...prev,
        tableau: combatDeal.tableau,
        stock: combatDeal.stock,
        scene: 'combat',
        foundations: createFoundations(prev.party),
        actorInspiration: Array.from({ length: FOUNDATION_SLOTS }, () => ACTOR_INSPIRATION_MAX),
        actorWorkCompleted: Array.from({ length: FOUNDATION_SLOTS }, () => 0),
        heroBuffs: FOUNDATION_MOCKUPS.map(() => []),
        suspendedExploration: {
          tableau: prev.tableau.map((entry, index) =>
            index === columnIndex ? entry.slice(0, -1) : entry,
          ),
          stock: prev.stock,
        },
        enemyTeam: ENEMY_TEAM_MOCKUPS.map((enemy) => ({ ...enemy })),
        ambushCardsRemaining: AMBUSH_PLAYER_CARD_BUDGET,
      };
    });
  };

  const devDefeatEnemy = (enemyIndex: number) => {
    if (!DEV_ACTOR_DEFEAT_OVERRIDE) return;
    const enemy = state.enemyTeam[enemyIndex] ?? null;
    if (!enemy || enemy.hp <= 0) return;
    clearPendingInteractions();
    setState((prev) => ({
      ...prev,
      enemyTeam: prev.enemyTeam.map((entry, index) =>
        index === enemyIndex ? { ...entry, hp: 0 } : entry,
      ),
    }));
    setBurningEnemyIds((prev) => [...new Set([...prev, enemy.id])]);
  };

  const devDefeatHero = (heroIndex: number) => {
    if (!DEV_ACTOR_DEFEAT_OVERRIDE) return;
    clearPendingInteractions();
    setState((prev) => ({
      ...prev,
      heroHp: prev.heroHp.map((hp, index) => (index === heroIndex ? 0 : hp)),
      heroBuffs: prev.heroBuffs.map((buffs, index) => (index === heroIndex ? [] : buffs)),
      foundations: prev.foundations.map((foundation, index) =>
        index === heroIndex && foundation
          ? { ...foundation, count: 0, cards: [] }
          : foundation,
      ),
    }));
  };

  const pushUndo = (snapshot: ProtoState = stateRef.current) => {
    setUndoStack((prev) => [cloneState(snapshot), ...prev].slice(0, 12));
  };

  const undoLastAction = () => {
    const previous = undoStack[0] ?? null;
    if (!previous) return;
    setState(cloneState(previous));
    setFoodLanding(null);
    setUndoStack((prev) => prev.slice(1));
    clearPendingInteractions();
    setBurningEnemyIds([]);
    setTargetAnnouncement(null);
  };

  const buildCamp = () => {
    if (state.scene !== 'exploration' || state.city.campBuilt || state.settledHaul.wood < 3 || state.settledHaul.mana < 1) return;
    pushUndo();
    setState((prev) => ({
      ...prev,
      haul: { ...prev.haul, wood: prev.haul.wood - 3, mana: prev.haul.mana - 1 },
      settledHaul: { ...prev.settledHaul, wood: Math.max(0, prev.settledHaul.wood - 3), mana: Math.max(0, prev.settledHaul.mana - 1) },
      city: { ...prev.city, campBuilt: true },
    }));
    setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'CAMP BUILT', impact: 'Rest is available' });
  };

  const restAtCamp = () => {
    if (state.scene !== 'exploration' || !state.city.campBuilt || state.city.campUsedToday) return;
    if (state.worldActors.some((actor) => actor.location === 'foundation')) return;
    pushUndo();
    setState((prev) => ({
      ...prev,
      inspiration: prev.maxInspiration,
      heroHp: prev.heroHp.map((hp, index) => index === 0 ? Math.min(prev.heroMaxHp?.[0] ?? FOUNDATION_MOCKUPS[0]?.maxHp ?? hp, hp + 3) : hp),
      city: { ...prev.city, campUsedToday: true, restedOnce: true },
      battleRecovered: prev.deepEncounterResolved ? true : prev.battleRecovered,
    }));
    setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'REST', impact: 'Inspiration restored / +3 HP' });
  };

  const endDay = () => {
    if (state.day === 1 && (!state.city.campBuilt || !state.city.restedOnce || !state.biomeTiles.some((tile) => tile.id === 'woods-alpha' && isBiomeDealComplete(tile.tableau, tile.stock)))) return;
    if (state.scene !== 'exploration' || state.worldActors.some((actor) => actor.location === 'foundation')) return;
    pushUndo();
    setState((prev) => ({
      ...endGlowfishGlow(prev, DEFAULT_ACTOR_LUMINOSITY),
      pond: restockPond(prev.pond, prev.day + 1),
      energy: DEFAULT_EXPEDITION_ENERGY,
      energyMax: DEFAULT_EXPEDITION_ENERGY,
      day: prev.day + 1,
      city: { ...prev.city, campUsedToday: false },
      biomeTiles: prev.biomeTiles.map((tile) => tile.id === 'woods-beta' ? { ...tile, unlocked: true } : tile),
      trailRations: prev.trailRations + (prev.day === 1 ? 1 : 0),
      worldResourceStacks: prev.day === 1
        ? [
            ...prev.worldResourceStacks,
            {
              id: `proto-trail-ration-day-${prev.day + 1}`,
              resource: 'trail_ration' as const,
              count: 1,
              biomeId: 'table',
              position: { x: 48, y: 0 },
            },
          ]
        : prev.worldResourceStacks,
    }));
    setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'DAY BREAKS', impact: `Day ${state.day + 1}` });
  };

  const consumeTrailRation = () => {
    const ration = state.worldResourceStacks.find((stack) => stack.resource === 'trail_ration' && !stack.build && Object.keys(stackIngredients(stack)).length === 1);
    if (ration) moveResourceStack(ration.id, ration.position, undefined, 'hero');
  };

  const endTurn = () => {
    if (cardTransport || currentTurn !== 'player') return;
    if (state.scene === 'combat' && state.ambushCardsRemaining > 0) {
      setTargetAnnouncement({
        targetKind: 'enemy',
        targetIndex: 0,
        abilityName: 'AMBUSH HOLDS',
        impact: `${state.ambushCardsRemaining} cards before breakout`,
      });
      return;
    }
    pushUndo();
    clearPendingInteractions();
    setBurningEnemyIds([]);
    setTargetAnnouncement(null);
    enemyMovesMadeRef.current = 0;
    setCurrentTurn('enemy');
  };

  const redeal = () => {
    clearPendingInteractions();
    setBurningEnemyIds([]);
    setTargetAnnouncement(null);
    setUndoStack([]);
    setCurrentTurn('player');
    setTurnCount(1);
    const fresh = createDayScenario(state.dayScenario ?? 'sandbox', appliedTileDocument.current ?? SAVED_TILE_DOCUMENT);
    setState(fresh);
    setTableHours(state.dayScenario ? dayOneHour(fresh) : TABLE_OPENING_HOUR);
  };

  const returnToBase = () => {
    if (state.scene !== 'exploration' || state.energy > 0) return;
    clearPendingInteractions();
    setState((prev) => ({
      ...prev,
      energy: prev.energyMax,
      settledHaul: { ...prev.haul },
      worldActors: prev.worldActors.map(actor => ({ ...actor, location: 'table' as const, foundationIndex: undefined, biomeId: undefined, hutId: undefined, position: { x: 0, y: 48 } })),
      foundations: prev.foundations.map((foundation) =>
        foundation
          ? { ...foundation, count: 0, cards: [], wildcardBridgeFromRank: undefined }
          : foundation,
      ),
      heroBuffs: prev.heroBuffs.map(() => []),
      abilityProgress: { [MAGE_PHASE_SHIFT_TRIGGER.id]: 0 },
      mobilityUsed: false,
      mobilityCooldown: 0,
    }));
    setTargetAnnouncement({
      targetKind: 'hero',
      targetIndex: 0,
      abilityName: 'Base Resupply',
      impact: `Energy ${DEFAULT_EXPEDITION_ENERGY}/${DEFAULT_EXPEDITION_ENERGY}`,
    });
  };

  const cancelLoadedAbility = () => {
    clearPendingInteractions();
    setTargetAnnouncement(null);
  };

  const advanceToEnemyTurn = () => {
    if (stateRef.current.scene === 'combat' && stateRef.current.ambushCardsRemaining > 0) {
      setTargetAnnouncement({
        targetKind: 'enemy',
        targetIndex: 0,
        abilityName: 'AMBUSH HOLDS',
        impact: `${stateRef.current.ambushCardsRemaining} cards before breakout`,
      });
      return;
    }
    clearPendingInteractions();
    setTargetAnnouncement(null);
    enemyMovesMadeRef.current = 0;
    setCurrentTurn('enemy');
  };

  const finishEnemyTurn = () => {
    const resolved = resolveEnemyIntents(stateRef.current);
    setState({
      ...resolved.state,
      mobilityUsed: false,
      mobilityCooldown: Math.max(0, resolved.state.mobilityCooldown - 1),
    });
    setCurrentTurn('player');
    setTurnCount((prev) => prev + 1);
    clearPendingInteractions();
    setBurningEnemyIds([]);
    setTargetAnnouncement(resolved.announcement);
  };

  const finishPlayerAutoAction = () => {
    if (stateRef.current.scene === 'combat' && stateRef.current.ambushCardsRemaining > 0) {
      setCurrentTurn('player');
      return;
    }
    // Exploration has no opposing turn; do not wait for the enemy autoplay timer.
    if (stateRef.current.scene === 'combat' && !enemyAutoPaused) {
      setCurrentTurn('enemy');
    }
  };

  const selectPlayerAutoMove = (sourceState: ProtoState) => {

    type Candidate = {
      columnIndex: number;
      foundationIndex: number;
      score: number;
    };
    const candidates: Candidate[] = [];
    sourceState.tableau.forEach((column, columnIndex) => {
      const card = column[column.length - 1] ?? null;
      if (!card) return;
      adjacentFoundationIndexes(card, sourceState).forEach((foundationIndex) => {
        const foundation = sourceState.foundations[foundationIndex];
        const comboCount = foundation?.count ?? 0;
        const nextCount = comboCount + 1;
        candidates.push({
          columnIndex,
          foundationIndex,
          score: nextCount * 10 - foundationIndex,
        });
      });
    });
    return candidates.sort((left, right) => right.score - left.score)[0] ?? null;
  };

  const runPlayerAutoStep = () => {
    if (cardTransport) return;
    if (abilityDetail) return;
    if (state.scene === 'exploration') {
      const encounterColumn = state.tableau.findIndex((column) =>
        column[column.length - 1]?.encounter === 'shadow_wolf_cub',
      );
      if (encounterColumn >= 0) {
        beginCombatEncounter(encounterColumn);
        return;
      }
    }
    if (pendingMobility !== null) {
      if (playerAutoPaused) return;
      const targetColumn = pendingMobility.kind === 'blink'
        ? selectAutoBlinkTargetColumn(state)
        : state.tableau.findIndex((column) =>
            pendingMobility.kind === 'dig' ? column.length >= 2 : column.length > 0,
          );
      if (targetColumn >= 0) {
        if (pendingMobility.kind === 'dig') {
          digTableauColumn(targetColumn);
        } else if (pendingMobility.kind === 'hallowed_path') {
          selectHallowedPathCard(targetColumn);
        } else {
          blinkToTableauCard(targetColumn);
        }
        finishPlayerAutoAction();
      } else {
        // An auto-selected mobility action must improve the position. Do not
        // leave a target prompt armed when no valid outcome remains.
        clearPendingInteractions();
        finishPlayerAutoAction();
      }
      return;
    }
    if (pendingTargetSelection) {
      const targetIndex = pendingTargetSelection.targetIndexes
        .slice()
        .sort((left, right) => (state.foundations[right]?.count ?? 0) - (state.foundations[left]?.count ?? 0))[0];
      if (targetIndex !== undefined) chooseFoundationTarget(targetIndex);
      return;
    }
    if (pendingAbilityTarget) {
      if (pendingAbilityTarget.targetKind === 'enemy') {
        const targetIndex = state.enemyTeam
          .map((enemy, index) => ({ enemy, index }))
          .filter(({ enemy }) => enemy.hp > 0)
          .sort((left, right) => left.enemy.hp - right.enemy.hp)[0]?.index;
        if (targetIndex !== undefined) {
          applyAbilityToEnemy(targetIndex);
          finishPlayerAutoAction();
        }
        return;
      }
      if (pendingAbilityTarget.targetKind === 'self') {
        applyAbilityToSelf(pendingAbilityTarget.sourceIndex);
        finishPlayerAutoAction();
        return;
      }
      const targetIndex = state.heroHp
        .map((hp, index) => ({
          index,
          missing: Math.max(0, (state.heroMaxHp?.[index] ?? FOUNDATION_MOCKUPS[index]?.maxHp ?? hp) - hp),
        }))
        .sort((left, right) => right.missing - left.missing)[0]?.index;
      if (targetIndex !== undefined) {
        if (pendingAbilityTarget.effectType === 'phase_shift') {
          applyPhaseShiftToHero(targetIndex);
        } else {
          applyAbilityToHero(targetIndex);
        }
        finishPlayerAutoAction();
      }
      return;
    }
    if (pendingWildCardTarget) {
      const targetIndex = state.foundations.findIndex((foundation) => foundation && !foundation.wildcardBridgeFromRank);
      if (targetIndex >= 0) {
        chooseFoundationTarget(targetIndex);
        finishPlayerAutoAction();
      }
      return;
    }

    const move = selectPlayerAutoMove(state);
    if (move) {
      queueCardTransport(move.columnIndex, { side: 'player', index: move.foundationIndex });
      return;
    }

    const mageIndex = FOUNDATION_MOCKUPS.findIndex((hero) => hero.heroClass === 'Mage');
    if (!state.mobilityUsed) {
      const mageFoundation = state.foundations[mageIndex] ?? null;
      const mageHasPhaseShift = state.heroBuffs[mageIndex]?.some((buff) => buff.id === 'phase_shift') ?? false;
      if (
        mageFoundation &&
        !mageFoundation.wildcardBridgeFromRank &&
        !mageHasPhaseShift &&
        selectAutoBlinkTargetColumn(state) >= 0
      ) {
        startMageBlink();
        return;
      }
    }

    if (!enemyAutoPaused) {
      advanceToEnemyTurn();
    }
  };

  const runEnemyAutoStep = () => {
    if (cardTransport || currentTurn !== 'enemy') return;
    const current = stateRef.current;
    if (current.scene === 'combat' && current.ambushCardsRemaining > 0) {
      setCurrentTurn('player');
      return;
    }
    if (current.scene !== 'combat' || enemyMovesMadeRef.current >= ENEMY_TURN_MAX_MOVES) {
      finishEnemyTurn();
      return;
    }
    const move = selectEnemyTableauMove(current);
    if (!move) {
      finishEnemyTurn();
      return;
    }
    queueCardTransport(move.columnIndex, { side: 'enemy', index: move.enemyIndex });
  };

  const selectAutoBlinkTargetColumn = (sourceState: ProtoState) => {
    const mageIndex = actorIndexForId('glacia');
    const mageFoundation = sourceState.foundations[mageIndex] ?? null;
    if (!mageFoundation) return -1;

    const candidates = sourceState.tableau.flatMap((column, columnIndex) => {
      const targetCard = column[column.length - 1] ?? null;
      if (!targetCard || targetCard.rank === mageFoundation.card.rank) return [];
      const afterBlink: ProtoState = {
        ...sourceState,
        tableau: sourceState.tableau.map((entry, index) =>
          index === columnIndex ? [...entry.slice(0, -1), mageFoundation.card] : entry,
        ),
        foundations: sourceState.foundations.map((foundation, index) =>
          index === mageIndex && foundation
            ? { ...foundation, card: targetCard, count: 0, cards: [], wildcardBridgeFromRank: undefined }
            : foundation,
        ),
      };
      const followUpMoves = afterBlink.tableau.reduce((total, entry) => {
        const topCard = entry[entry.length - 1] ?? null;
        return total + (topCard ? adjacentFoundationIndexes(topCard, afterBlink).length : 0);
      }, 0);
      return followUpMoves > 0 ? [{ columnIndex, followUpMoves }] : [];
    });

    return candidates
      .sort((left, right) => right.followUpMoves - left.followUpMoves || left.columnIndex - right.columnIndex)[0]
      ?.columnIndex ?? -1;
  };

  const startMageBlink = () => {
    if (state.scene === 'exploration' && nextQuestCard(state.tableau)) return;
    const mageIndex = actorIndexForId('glacia');
    const mageFoundation = state.foundations[mageIndex] ?? null;
    const phaseShiftActive = state.heroBuffs[mageIndex]?.some((buff) => buff.id === 'phase_shift') ?? false;
    const hasNormalMove = hasNormalPlayerTableauMove(state);
    const emergency = state.mobilityCooldown > 0 && !hasNormalMove;
    const standardUse = state.mobilityCooldown === 0;
    const energyCost = emergency ? 2 : 1;
    if (
      mageIndex < 0 ||
      !mageFoundation ||
      state.mobilityUsed ||
      (!standardUse && !emergency) ||
      !canAffordExplorationAction(state, energyCost) ||
      mageFoundation.wildcardBridgeFromRank ||
      phaseShiftActive
    ) return;
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingAbilityTarget(null);
    setTargetAnnouncement(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({ [mageIndex]: 'mobility' });
    setPendingMobility({ sourceIndex: mageIndex, emergency, kind: 'blink' });
  };

  const startHeroDig = () => {
    if (state.scene === 'exploration' && nextQuestCard(state.tableau)) return;
    const heroIndex = actorIndexForId('hero');
    const hasNormalMove = hasNormalPlayerTableauMove(state);
    const emergency = state.mobilityCooldown > 0 && !hasNormalMove;
    const standardUse = state.mobilityCooldown === 0;
    const energyCost = emergency ? 2 : 1;
    const hasDigTarget = state.tableau.some((column) => column.length >= 2);
    if (heroIndex < 0 || state.mobilityUsed || (!standardUse && !emergency) || !canAffordExplorationAction(state, energyCost) || !hasDigTarget) return;
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingAbilityTarget(null);
    setTargetAnnouncement(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({ [heroIndex]: 'mobility' });
    setPendingMobility({ sourceIndex: heroIndex, emergency, kind: 'dig' });
  };

  const startJarnHallowedPath = () => {
    if (state.scene === 'exploration' && nextQuestCard(state.tableau)) return;
    const jarnIndex = actorIndexForId('jarnathan');
    const jarnFoundation = state.foundations[jarnIndex] ?? null;
    const hasNormalMove = hasNormalPlayerTableauMove(state);
    const emergency = state.mobilityCooldown > 0 && !hasNormalMove;
    const standardUse = state.mobilityCooldown === 0;
    const energyCost = (emergency ? 2 : 1) + 1;
    const hasTarget = state.tableau.some((column) => column.length > 0);
    if (
      jarnIndex < 0 ||
      !jarnFoundation ||
      state.mobilityUsed ||
      (!standardUse && !emergency) ||
      !canAffordExplorationAction(state, energyCost) ||
      jarnFoundation.wildcardBridgeFromRank ||
      !hasTarget
    ) return;
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingAbilityTarget(null);
    setTargetAnnouncement(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({ [jarnIndex]: 'mobility' });
    setPendingMobility({ sourceIndex: jarnIndex, emergency, kind: 'hallowed_path' });
  };

  const blinkToTableauCard = (columnIndex: number) => {
    const mobility = pendingMobility;
    if (!mobility || state.mobilityUsed) return;
    const sourceIndex = mobility.sourceIndex;
    const emergency = mobility.emergency;
    const sourceFoundation = state.foundations[sourceIndex] ?? null;
    const sourceColumn = state.tableau[columnIndex] ?? [];
    const targetCard = sourceColumn[sourceColumn.length - 1] ?? null;
    if (!sourceFoundation || !targetCard) return;
    pushUndo();
    const sourceCard = sourceFoundation.card;
    setState((prev) => ({
      ...prev,
      tableau: prev.tableau.map((column, index) =>
        index === columnIndex ? [...column.slice(0, -1), sourceCard] : column,
      ),
      foundations: prev.foundations.map((foundation, index) =>
        index === sourceIndex && foundation
          ? {
              ...foundation,
              card: targetCard,
              count: 0,
              cards: [],
              wildcardBridgeFromRank: undefined,
            }
          : foundation,
      ),
      heroBuffs: prev.heroBuffs.map((buffs, index) =>
        index === sourceIndex
          ? [
              ...buffs.filter((buff) => buff.id !== 'phase_shift' && buff.id !== 'blink_strain'),
              ...(emergency ? [{ id: 'blink_strain' as const, value: 0, turnsRemaining: 2 }] : []),
            ]
          : buffs,
      ),
      abilityProgress: emergency
        ? { ...prev.abilityProgress, [MAGE_PHASE_SHIFT_TRIGGER.id]: 0 }
        : prev.abilityProgress,
      mobilityUsed: true,
      mobilityCooldown: MOBILITY_COOLDOWN_TURNS,
      energy: spendExplorationEnergy(prev, emergency ? 2 : 1),
    }));
    clearPendingInteractions();
    setTargetAnnouncement({
      targetKind: 'hero',
      targetIndex: sourceIndex,
      abilityName: 'Blink',
      impact: `${rankLabel(sourceCard.rank)} <-> ${rankLabel(targetCard.rank)}`,
    });
  };

  const digTableauColumn = (columnIndex: number) => {
    const mobility = pendingMobility;
    if (!mobility || mobility.kind !== 'dig' || state.mobilityUsed) return;
    const column = state.tableau[columnIndex] ?? [];
    if (column.length < 2) return;
    const topCard = column[column.length - 1];
    const unearthedCard = column[column.length - 2];
    pushUndo();
    setState((prev) => ({
      ...prev,
      tableau: prev.tableau.map((entry, index) =>
        index === columnIndex
          ? [...entry.slice(0, -2), topCard, unearthedCard]
          : entry,
      ),
      heroBuffs: prev.heroBuffs.map((buffs, index) =>
        index === mobility.sourceIndex
          ? [
              ...buffs.filter((buff) => buff.id !== 'muddy_paws'),
              ...(mobility.emergency ? [{ id: 'muddy_paws' as const, value: 0, turnsRemaining: 2 }] : []),
            ]
          : buffs,
      ),
      mobilityUsed: true,
      mobilityCooldown: MOBILITY_COOLDOWN_TURNS,
      energy: spendExplorationEnergy(prev, mobility.emergency ? 2 : 1),
    }));
    clearPendingInteractions();
    setTargetAnnouncement({
      targetKind: 'hero',
      targetIndex: mobility.sourceIndex,
      abilityName: 'Dig',
      impact: `${rankLabel(unearthedCard.rank)} unearthed`,
    });
  };

  const selectHallowedPathCard = (columnIndex: number) => {
    const mobility = pendingMobility;
    if (!mobility || mobility.kind !== 'hallowed_path' || state.mobilityUsed) return;
    const column = state.tableau[columnIndex] ?? [];
    const card = column[column.length - 1] ?? null;
    if (!card) return;
    setPendingTargetSelection({
      columnIndex,
      cardId: card.id,
      targetIndexes: [mobility.sourceIndex],
      hallowedPath: true,
    });
  };

  const playColumnToFoundation = (
    columnIndex: number,
    foundationIndex: number,
    options: { hallowedPath?: boolean; divine?: boolean; retrieval?: { move: 'Fetch' | 'Dig'; cardIndex: number } } = {},
  ) => {
    const divine = Boolean(options.divine);
    const hallowedPath = Boolean(options.hallowedPath && foundationIndex === actorIndexForId('jarnathan'));
    const playOptions = {
      columnIndex,
      foundationIndex,
      retrieval: options.retrieval,
      divine,
      hallowedPath,
      hallowedEmergency: hallowedPath && pendingMobility?.emergency === true,
    };
    const base = stateRef.current;
    const result = applyFoundationPlay(base, playOptions);
    setUtility(null);
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingMobility(null);
    setPendingAbilityTarget(null);
    setTargetAnnouncement(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({});
    // Rejected plays leave no undo entry, announcement or burn.
    if (!result) return;
    pushUndo(base);
    setState((prev) => (prev === base ? result.state : applyFoundationPlay(prev, playOptions)?.state ?? prev));
    // A card landed early (the next play was clicked mid-flight) must be visible
    // to that next play in the same event.
    if (stateRef.current === base) stateRef.current = result.state;
    // Commit the move before starting its presentation effect.
    const gainedMaterial = (Object.keys(base.haul) as Array<keyof typeof base.haul>).find(key => result.state.haul[key] > base.haul[key]);
    const gainedInspiration = result.state.actorInspiration[foundationIndex] > base.actorInspiration[foundationIndex] || result.state.inspiration > base.inspiration;
    const receivesResource = result.state.actorInspiration[foundationIndex] > base.actorInspiration[foundationIndex]
      || result.state.inspiration > base.inspiration || result.state.wildCards > base.wildCards
      || Object.keys(base.haul).some(key => result.state.haul[key as keyof typeof base.haul] > base.haul[key as keyof typeof base.haul]);
    if (receivesResource) {
      setFoodLanding({ id: createRuntimeId(), foundationIndex, biomeId: base.selectedBiomeId,
        berries: result.card.foodSource === 'berries',
        glyph: gainedInspiration ? '💫' : gainedMaterial ? FOREST_RESOURCE_GLYPHS[gainedMaterial] : '✨',
        x: 20 + Math.random() * 60, y: 25 + Math.random() * 45 });
    }
    if (result.workCycleCompleted && !divine) {
      const actorLabel = FOUNDATION_MOCKUPS[foundationIndex]?.label ?? `Actor ${foundationIndex + 1}`;
      setTargetAnnouncement({
        targetKind: 'hero',
        targetIndex: foundationIndex,
        abilityName: 'TABLEAU COMPLETE',
        impact: `${actorLabel}: ${ACTOR_WORK_RESOURCES[foundationIndex] ? `+3 ${ACTOR_WORK_RESOURCES[foundationIndex]!.toUpperCase()} ` : ''}+1 WILD`,
      });
    }
    const chip = result.chip;
    if (chip) {
      if (chip.enemy.hp <= DEFAULT_CHIP_ABILITY.damage) {
        setBurningEnemyIds((prev) => [...new Set([...prev, chip.enemy.id])]);
      }
      setTargetAnnouncement({
        targetKind: 'enemy',
        targetIndex: chip.enemyIndex,
        abilityName: DEFAULT_CHIP_ABILITY.label,
        impact: `-${DEFAULT_CHIP_ABILITY.damage} HP`,
      });
    } else if (hallowedPath) {
      setTargetAnnouncement({
        targetKind: 'hero',
        targetIndex: foundationIndex,
        abilityName: 'Hallowed Path',
        impact: `${rankLabel(result.card.rank)} guided`,
      });
    }
  };

  const startSolver = (divine: boolean) => {
    setPlayerAutoPaused(true);
    clearPendingInteractions();
    if (divine) { setEnemyAutoPaused(true); setCurrentTurn('player'); }
  };

  const solveMainStep = (divine: boolean): SolveStepResult => {
    if(pendingTutorialQuest(stateRef.current))return {status:'waiting',message:'Pick up the quest card on the ground'};
    const current = stateRef.current;
    if (!current.worldActors.some((actor) => actor.location === 'foundation' && actor.biomeId === current.selectedBiomeId)) return { status: 'blocked', message: 'Posture an actor in the foundation' };
    if (cardTransport || burningEnemyIds.length) return { status: 'waiting', message: 'Waiting for current action' };
    if (!divine && currentTurn !== 'player') return { status: 'waiting', message: 'Waiting for player turn' };
    if (!current.tableau.some((column) => column.length)) return { status: 'complete', message: 'Tableau cleared' };
    if (isDenRest(current) && !hasNormalPlayerTableauMove(current)) {
      if (!current.stock.length) return { status: 'complete', message: 'Rest finished · stock exhausted' };
      setState(prev => drawSleepStock(prev));
      return { status: 'played', message: 'Draw stock' };
    }
    const encounterColumn = current.tableau.findIndex((column) => column[column.length - 1]?.encounter);
    if (encounterColumn >= 0) {
      if (divine) {
        pushUndo();
        setState((prev) => ({ ...prev, tableau: prev.tableau.map((column, index) => index === encounterColumn ? column.slice(0, -1) : column), deepEncounterResolved: prev.selectedBiomeId === 'woods-beta' || prev.deepEncounterResolved }));
      } else {
        if (!current.worldActors.some((actor) => actor.location === 'foundation' && actor.biomeId === current.selectedBiomeId)) return { status: 'blocked', message: 'Posture an actor in the foundation' };
        beginCombatEncounter(encounterColumn);
      }
      return { status: 'played', message: divine ? 'Divine encounter resolved' : 'Encounter started' };
    }

    if (!divine && current.worldActors.some((actor) => actor.hutId)) return { status: 'blocked', message: 'Actor is working at a hut' };
    const rootMoves: SolverMove[] = current.tableau.flatMap((column, columnIndex) => {
      const card = column[column.length - 1];
      if (!card) return [];
      const indexes = divine && !isDenRest(current)
        ? current.foundations.flatMap((foundation, index) => foundation && isQuestPlacement(current.tableau, card) && (isOpenExplorationFoundation(current.scene, index, foundation) || canPlayOnFoundation(card, foundation)) ? [index] : [])
        : adjacentFoundationIndexes(card, current);
      return indexes.map((foundation) => ({ column: columnIndex, foundation }));
    });
    const assessment = assessSolverMove({ columns: current.tableau, stock: current.stock,
      stockMode: isDenRest(current) ? 'draw' : 'backfill',
      foundations: current.foundations.map((foundation) => foundation?.card.rank ?? null),
      openFoundations: current.foundations.map((foundation, index) => isOpenExplorationFoundation(current.scene, index, foundation) && (!isDenRest(current) || !current.denRest?.started)),

    }, { rootMoves });
    if (!assessment) return { status: 'blocked', message: 'No legal move; check actor posture or puzzle state' };
    queueCardTransport(assessment.move.column, { side: 'player', index: assessment.move.foundation }, { divine, solver: true });
    return { status: 'played', message: assessment.method + (assessment.samples ? ' · ' + assessment.samples + ' rollouts/move' : ' next move') };
  };

  const solveTravelStep = (): SolveStepResult => {
    if(pendingTutorialQuest(stateRef.current))return {status:'waiting',message:'Pick up the quest card on the ground'};
    const current = stateRef.current;
    const journey = current.journey;
    if (!journey || journey.completed >= journey.cards && !journey.search && journey.pendingSearch===undefined && !travelTableauHeld(journey)) return { status: 'complete', message: 'Destination reached' };
    if (journey.waitingForTraversal!==undefined) return {status:'waiting',message:'Walking to the next stage'};
    if (journey.obstruction) return {status:'blocked',message:'Terrain blocked · use a matching ability or choose another route'};
    if (journey.paused) return { status: 'blocked', message: 'Journey paused' };
    if (travelTableauHeld(journey)) return {status:'blocked',message:'Tile work complete · resolve or discard its event to continue'};
    const column = bestTravelMove(journey);
    if (column === null) return { status: 'blocked', message: 'No legal move · Reset trail to continue' };
    const next = playTravelCard(current, column);
    if (next === current) return { status: 'blocked', message: 'Not enough stamina to advance' };
    const cards = journey.columns[column];
    const card = cards?.[cards.length - 1];
    const receiver = partyMembers(current, journey.actorId).find(member => (next.utilityAP?.[member.id] ?? 0) > (current.utilityAP?.[member.id] ?? 0))?.id ?? journey.actorId;
    if (card) flyTravelCard(card.id, receiver);
    setState(next);
    return { status: 'played', message: 'Advanced travel' };
  };

  const solveHutStep = (stackId: string, divine: boolean): SolveStepResult => {
    const current = stateRef.current;
    const stack = current.worldResourceStacks.find((entry) => entry.id === stackId);
    if (!stack?.build || stack.build.tableau.length === 0) return { status: 'complete', message: 'Solitaire cleared' };
    if (current.scene !== 'exploration' || !current.worldActors.some((actor) => actor.hutId === stack.build?.stationId)) return { status: 'blocked', message: 'Posture an actor at this foundation' };
    if (!divine && !canSpendInspiration(current.actorInspiration[0], 1)) return { status: 'blocked', message: 'Actor needs inspiration' };
    const assessment = assessSolverMove({ columns: stack.build.tableau.map((rank) => [{ id: stackId + '-' + rank, rank }]), stock: [], foundations: [stack.build.foundation], moveBudget: divine || DISABLE_INSPIRATION_CONSUMPTION ? undefined : current.actorInspiration[0] });
    if (!assessment) return { status: 'blocked', message: 'No legal move' };
    pushUndo();
    playHutCard(stackId, stack.build.tableau[assessment.move.column], divine);
    return { status: 'played', cardRank: stack.build.tableau[assessment.move.column], message: assessment.method + ' hut move' };
  };

  const queueCardTransport = (
    columnIndex: number,
    target: { side: 'player' | 'enemy'; index: number },
    options: { hallowedPath?: boolean; divine?: boolean; solver?: boolean; afterLanding?: boolean } = {},
  ) => {
    if ((cardTransport && !options.afterLanding) || (!options.divine && currentTurn !== target.side)) return;
    const current = stateRef.current;
    const card = current.tableau[columnIndex]?.[current.tableau[columnIndex].length - 1] ?? null;
    if (!card) return;
    const validPlayerTarget =
      target.side === 'player' &&

      (options.divine || adjacentFoundationIndexes(card, current).includes(target.index) || Boolean(options.hallowedPath));
    const enemy = current.enemyTeam[target.index] ?? null;
    const validEnemyTarget =
      target.side === 'enemy' &&
      current.scene === 'combat' &&
      Boolean(enemy && enemy.hp > 0 && isAdjacentRank(card.rank, enemy.currentRank));
    if (!validPlayerTarget && !validEnemyTarget) return;

    const source = tableauCardRefs.current[card.id];
    const targetNode = target.side === 'player'
      ? document.querySelector<HTMLElement>(`[data-map-actor-card="${current.worldActors.find(actor => actor.location === 'foundation' && actor.biomeId === current.selectedBiomeId && (actor.foundationIndex ?? 0) === target.index)?.id}"]`) ?? foundationTransportRefs.current[target.index]
      : enemyTransportRefs.current[target.index];
    if (!source || !targetNode) {
      // The browser experience always uses the transport. This fallback keeps
      // non-DOM test callers deterministic without introducing a second rules path.
      if (target.side === 'player') {
        playColumnToFoundation(columnIndex, target.index, options);
      } else if (enemy) {
        setState((prev) => applyEnemyTableauMove(prev, {
          columnIndex,
          enemyIndex: target.index,
          card,
        }));
      }
      return;
    }

    const sourceRect = source.getBoundingClientRect();
    source.closest('.proto-tableau-field')?.dispatchEvent(new CustomEvent('tableau-vegetation-rustle', { detail: { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 } }));
    const targetRect = targetNode.getBoundingClientRect();
    const from = { x: sourceRect.left, y: sourceRect.top };
    const to = {
      x: targetRect.left + ((targetRect.width - sourceRect.width) / 2),
      y: targetRect.top + ((targetRect.height - sourceRect.height) / 2),
    };
    const speed = target.side === 'player'
      ? FOUNDATION_MOCKUPS[target.index]?.cardTransportSpeed ?? 1
      : enemy?.cardTransportSpeed ?? 1;
    cardTransportPositionRef.current = from;
    setCardTransport({
      background: snapshotCardBackground(source),
      cardId: card.id,
      sourceColumnIndex: columnIndex,
      targetSide: target.side,
      targetIndex: target.index,
      hallowedPath: Boolean(options.hallowedPath),
      divine: Boolean(options.divine),
      solver: Boolean(options.solver),
      from,
      to,
      size: { width: sourceRect.width, height: sourceRect.height },
      // Tableau-to-foundation flights always use the auto-solve speed; enemy
      // plays keep the slower readable pace unless the solver drives them.
      durationMs: options.solver || target.side === 'player'
        ? solverFlightDuration(getCardTransportDurationMs(from, to, speed))
        : getCardTransportDurationMs(from, to, speed),
    });
  };

  // A flight lands once: at the end of its animation, or early when the next
  // manual play is clicked while it is still in the air.
  const landedTransportRef = useRef<CardTransport | null>(null);
  const landCardTransport = (cardTransport: CardTransport) => {
      if (landedTransportRef.current === cardTransport) return;
      landedTransportRef.current = cardTransport;
      const current = stateRef.current;
      const sourceColumn = current.tableau[cardTransport.sourceColumnIndex] ?? [];
      const topCard = sourceColumn[sourceColumn.length - 1] ?? null;
      const targetIsStillAvailable = cardTransport.targetSide === 'player'
        ? (cardTransport.divine || (current.heroHp[cardTransport.targetIndex] ?? 0) > 0) &&
          topCard?.id === cardTransport.cardId &&
          Boolean(topCard) &&
          (cardTransport.divine || cardTransport.hallowedPath || adjacentFoundationIndexes(topCard, current).includes(cardTransport.targetIndex))
        : Boolean(
          topCard?.id === cardTransport.cardId &&
          current.scene === 'combat' &&
          current.enemyTeam[cardTransport.targetIndex]?.hp > 0 &&
          topCard &&
          isAdjacentRank(topCard.rank, current.enemyTeam[cardTransport.targetIndex].currentRank),
        );
      setCardTransport(null);
      if (targetIsStillAvailable) {
        if (cardTransport.targetSide === 'player') {
          playColumnToFoundation(
            cardTransport.sourceColumnIndex,
            cardTransport.targetIndex,
            { hallowedPath: cardTransport.hallowedPath, divine: cardTransport.divine },
          );
          if (!cardTransport.divine && (cardTransport.solver || !playerAutoPaused)) finishPlayerAutoAction();
        } else if (topCard) {
          setState((prev) => applyEnemyTableauMove(prev, {
            columnIndex: cardTransport.sourceColumnIndex,
            enemyIndex: cardTransport.targetIndex,
            card: topCard,
          }));
          enemyMovesMadeRef.current += 1;
        }
        return;
      }
      setTargetAnnouncement({
        targetKind: cardTransport.targetSide === 'player' ? 'hero' : 'enemy',
        targetIndex: cardTransport.targetIndex,
        abilityName: 'Route interrupted',
        impact: 'Card returned to tableau',
      });
      if (cardTransport.targetSide === 'enemy') finishEnemyTurn();
  };

  useEffect(() => {
    if (!cardTransport) return undefined;
    let animationFrame = 0;
    const startedAt = gameTime.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / cardTransport.durationMs);
      cardTransportPositionRef.current = interpolateCardTransport(cardTransport.from, cardTransport.to, progress);
      if (progress < 1) {
        animationFrame = gameTime.requestAnimationFrame(animate);
        return;
      }
      landCardTransport(cardTransport);
    };
    animationFrame = gameTime.requestAnimationFrame(animate);
    return () => gameTime.cancelAnimationFrame(animationFrame);
  }, [cardTransport]);

  // While a plain manual exploration play is in the air, the tableau already
  // shows where it will land, so the next eligible card can be clicked at once
  // (exploration refills come from the stock, so the projection is exact).
  const flightProjection = useMemo(() => {
    if (!cardTransport || cardTransport.targetSide !== 'player' || cardTransport.solver || cardTransport.divine || cardTransport.hallowedPath) return null;
    if (state.scene !== 'exploration') return null;
    return applyFoundationPlay(state, { columnIndex: cardTransport.sourceColumnIndex, foundationIndex: cardTransport.targetIndex, divine: false, hallowedPath: false, hallowedEmergency: false })?.state ?? null;
  }, [cardTransport, state]);
  const tableState = flightProjection ?? state;

  const playColumn = (columnIndex: number) => {
    if (cardTransport) {
      if (!flightProjection) return;
      landCardTransport(cardTransport);
    }
    setPendingAbilityTarget(null);
    setPendingMobility(null);
    setTargetAnnouncement(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({});
    const current = stateRef.current;

    const column = current.tableau[columnIndex] ?? [];
    const card = column[column.length - 1] ?? null;
    if (!card) return;
    const targetIndexes = adjacentFoundationIndexes(card, current);
    if (targetIndexes.length === 0) return;
    if (targetIndexes.length === 1) {
      queueCardTransport(columnIndex, { side: 'player', index: targetIndexes[0] }, { afterLanding: true });
      return;
    }
    setPendingTargetSelection({ columnIndex, cardId: card.id, targetIndexes });
  };

  const chooseFoundationTarget = (foundationIndex: number) => {
    if (cardTransport) return;
    if (pendingWildCardTarget) {
      pushUndo();
      setState((prev) => {
        const foundation = prev.foundations[foundationIndex] ?? null;
        if (!foundation || foundation.wildcardBridgeFromRank || prev.wildCards <= 0) return prev;
        return {
          ...prev,
          wildCards: prev.wildCards - 1,
          foundations: prev.foundations.map((slot, index) =>
            index === foundationIndex && slot
              ? {
                  ...slot,
                  count: slot.count + 1,
                  cards: [
                    ...slot.cards,
                    { id: `proto-wild-${Date.now()}-${foundationIndex}`, rank: slot.card.rank },
                  ],
                  wildcardBridgeFromRank: slot.card.rank,
                }
              : slot,
          ),
        };
      });
      setPendingWildCardTarget(false);
      setPendingTargetSelection(null);
      setPendingAbilityTarget(null);
      setTargetAnnouncement(null);
      setAbilityDetail(null);
      setSelectedAdvisorAbilities({});
      return;
    }
    if (!pendingTargetSelection?.targetIndexes.includes(foundationIndex)) {
      if (pendingAbilityTarget?.targetKind === 'self' && pendingAbilityTarget.sourceIndex === foundationIndex) {
        applyAbilityToSelf(foundationIndex);
        return;
      }
      if (pendingAbilityTarget?.targetKind === 'hero') {
        if (pendingAbilityTarget.effectType === 'phase_shift') {
          applyPhaseShiftToHero(foundationIndex);
        } else {
          applyAbilityToHero(foundationIndex);
        }
        return;
      }
      return;
    }
    queueCardTransport(pendingTargetSelection.columnIndex, { side: 'player', index: foundationIndex }, {
      hallowedPath: pendingTargetSelection.hallowedPath,
    });
  };

  const clearFoundationCombo = (foundationIndex: number) => {
    setState((prev) => ({
      ...prev,
      foundations: prev.foundations.map((foundation, index) =>
        index === foundationIndex && foundation
          ? {
              ...foundation,
              count: 0,
              cards: [],
              wildcardBridgeFromRank: undefined,
            }
          : foundation,
      ),
    }));
  };

  const startWildCardTargeting = () => {
    if (state.scene === 'exploration' && nextQuestCard(state.tableau)) return;
    if (state.wildCards <= 0) return;
    setPendingTargetSelection(null);
    setPendingMobility(null);
    setPendingAbilityTarget(null);
    setTargetAnnouncement(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({});
    setPendingWildCardTarget(true);
  };

  const applyAbilityToEnemy = (enemyIndex: number) => {
    if (!pendingAbilityTarget || pendingAbilityTarget.targetKind !== 'enemy') return;
    const targetEnemy = state.enemyTeam[enemyIndex] ?? null;
    if (!targetEnemy || targetEnemy.hp <= 0) return;
    const isFrostbolt = pendingAbilityTarget.effectType === 'frostbolt';
    const isHolyNova = pendingAbilityTarget.effectType === 'holy_nova';
    const impact = isHolyNova
      ? `All allies +${pendingAbilityTarget.power} HP; foes -${pendingAbilityTarget.power} HP`
      : isFrostbolt
      ? `-${pendingAbilityTarget.power} HP, -${pendingAbilityTarget.power} CB`
      : `-${pendingAbilityTarget.power} HP`;
    pushUndo();
    setState((prev) => ({
      ...prev,
      enemyTeam: prev.enemyTeam.map((enemy, index) =>
        (isHolyNova ? enemy.hp > 0 : index === enemyIndex)
          ? {
              ...enemy,
              hp: Math.max(0, enemy.hp - pendingAbilityTarget.power),
              comboCount: isFrostbolt ? Math.max(0, enemy.comboCount - pendingAbilityTarget.power) : enemy.comboCount,
            }
          : enemy,
      ),
      heroHp: isHolyNova
        ? prev.heroHp.map((hp, index) =>
            hp > 0
              ? Math.min(prev.heroMaxHp?.[index] ?? FOUNDATION_MOCKUPS[index]?.maxHp ?? hp, hp + pendingAbilityTarget.power)
              : hp,
          )
        : prev.heroHp,
      abilityProgress: hasBlinkStrain(prev, pendingAbilityTarget.sourceIndex)
        ? prev.abilityProgress
        : addSpentComboProgress(prev.abilityProgress, pendingAbilityTarget),
    }));
    if (isHolyNova) {
      const defeatedEnemyIds = state.enemyTeam
        .filter((enemy) => enemy.hp > 0 && enemy.hp - pendingAbilityTarget.power <= 0)
        .map((enemy) => enemy.id);
      if (defeatedEnemyIds.length > 0) {
        setBurningEnemyIds((prev) => [...new Set([...prev, ...defeatedEnemyIds])]);
      }
    } else if (targetEnemy.hp - pendingAbilityTarget.power <= 0) {
      setBurningEnemyIds((prev) => [...new Set([...prev, targetEnemy.id])]);
    }
    clearFoundationCombo(pendingAbilityTarget.sourceIndex);
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingAbilityTarget(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({});
    setTargetAnnouncement({
      targetKind: 'enemy',
      targetIndex: enemyIndex,
      abilityName: pendingAbilityTarget.effectLabel,
      impact,
    });
  };

  const applyAbilityToHero = (heroIndex: number) => {
    if (!pendingAbilityTarget || pendingAbilityTarget.targetKind !== 'hero') return;
    if ((state.heroHp[heroIndex] ?? 0) <= 0) return;
    const maxHp = state.heroMaxHp?.[heroIndex] ?? FOUNDATION_MOCKUPS[heroIndex]?.maxHp ?? 20;
    const impact = `+${pendingAbilityTarget.power} HP`;
    pushUndo();
    setState((prev) => ({
      ...prev,
      heroHp: prev.heroHp.map((hp, index) =>
        index === heroIndex
          ? Math.min(maxHp, hp + pendingAbilityTarget.power)
          : hp,
      ),
      abilityProgress: hasBlinkStrain(prev, pendingAbilityTarget.sourceIndex)
        ? prev.abilityProgress
        : addSpentComboProgress(prev.abilityProgress, pendingAbilityTarget),
    }));
    clearFoundationCombo(pendingAbilityTarget.sourceIndex);
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingAbilityTarget(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({});
    setTargetAnnouncement({
      targetKind: 'hero',
      targetIndex: heroIndex,
      abilityName: pendingAbilityTarget.effectLabel,
      impact,
    });
  };

  const applyPhaseShiftToHero = (heroIndex: number) => {
    if (!pendingAbilityTarget || pendingAbilityTarget.effectType !== 'phase_shift' || pendingAbilityTarget.targetKind !== 'hero') return;
    pushUndo();
    setState((prev) => ({
      ...prev,
      heroBuffs: prev.heroBuffs.map((buffs, index) =>
        index === heroIndex
          ? [...buffs.filter((buff) => buff.id !== 'phase_shift'), { id: 'phase_shift', value: 2, turnsRemaining: 1 }]
          : buffs,
      ),
      abilityProgress: { ...prev.abilityProgress, [MAGE_PHASE_SHIFT_TRIGGER.id]: 0 },
    }));
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingAbilityTarget(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({});
    setTargetAnnouncement({
      targetKind: 'hero',
      targetIndex: heroIndex,
      abilityName: pendingAbilityTarget.effectLabel,
      impact: 'Next placement may bridge +/-2',
    });
  };

  const applyAbilityToSelf = (heroIndex: number) => {
    if (
      !pendingAbilityTarget ||
      pendingAbilityTarget.targetKind !== 'self' ||
      pendingAbilityTarget.sourceIndex !== heroIndex
    ) return;
    const isGuard = pendingAbilityTarget.effectType === 'guard';
    const buff: HeroBuff = {
      id: isGuard ? 'def' : 'taunt',
      value: isGuard ? pendingAbilityTarget.power : 0,
      turnsRemaining: 1,
    };
    const impact = isGuard ? `DEF +${buff.value} / 1 turn` : 'Enemy attacks redirected / 1 turn';
    pushUndo();
    setState((prev) => ({
      ...prev,
      heroBuffs: prev.heroBuffs.map((buffs, index) =>
        index === heroIndex ? [...buffs.filter((entry) => entry.id !== buff.id), buff] : buffs,
      ),
    }));
    clearFoundationCombo(pendingAbilityTarget.sourceIndex);
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingAbilityTarget(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({});
    setTargetAnnouncement({
      targetKind: 'hero',
      targetIndex: heroIndex,
      abilityName: pendingAbilityTarget.effectLabel,
      impact,
    });
  };

  useEffect(() => {
    if (playerAutoPaused || editorOpen) return undefined;
    if (currentTurn !== 'player') return undefined;
    if (cardTransport) return undefined;
    const timeoutId = gameTime.setTimeout(runPlayerAutoStep, AUTO_PLAY_SPEED_OPTIONS[playerAutoSpeedIndex]?.ms ?? 800);
    return () => gameTime.clearTimeout(timeoutId);
  }, [
    abilityDetail,
    pendingAbilityTarget,
    pendingTargetSelection,
    pendingWildCardTarget,
    pendingMobility,
    playerAutoPaused,
    editorOpen,
    playerAutoSpeedIndex,
    currentTurn,
    enemyAutoPaused,
    cardTransport,
    state,
  ]);

  useEffect(() => {
    if (enemyAutoPaused || editorOpen) return undefined;
    if (currentTurn !== 'enemy') return undefined;
    if (cardTransport) return undefined;
    const timeoutId = gameTime.setTimeout(runEnemyAutoStep, AUTO_PLAY_SPEED_OPTIONS[enemyAutoSpeedIndex]?.ms ?? 800);
    return () => gameTime.clearTimeout(timeoutId);
  }, [currentTurn, enemyAutoPaused, enemyAutoSpeedIndex, cardTransport, state, editorOpen]);

  const questSteps = getExpeditionQuestSteps(state);
  const questInstructions = questSteps.map(step => step.text);
  // Accomplishments latch: returning home or consuming a buff cannot undo a quest.
  useEffect(() => {
    setState((previous) => {
      const steps = getExpeditionQuestSteps(previous);
      if (!steps.some((step, index) => step.complete && !previous.questAccomplished[index])) return previous;
      return { ...previous, questAccomplished: steps.map((step, index) => Boolean(previous.questAccomplished[index] || step.complete)) };
    });
  }, [state]);
  useEffect(() => {
    const index = state.questClaims;
    const step = getExpeditionQuestSteps(state)[index];
    if (!step || !(step.complete || state.questAccomplished[index]) || state.questTableCards.some(card => card.questIndex === index)) return;
    const tile = state.biomeTiles.find(tile => tile.id === step.biomeId);
    const location = tile?.position ?? { x: 0, y: 48 };
    const blocked = [
      ...blockedSolids().map(region => ({ x: region.x, y: region.y, w: region.width, h: region.height })),
      ...state.biomeTiles.filter(tile => (!tile.tileType || tile.tileType === 'berry-patch') && !tile.road).map(tile => ({ x: tile.position.x, y: tile.position.y, w: tile.gridSize.columns * 48, h: tile.gridSize.rows * 48 })),
      ...state.worldActors.map(actor => ({ x: actor.position.x, y: actor.position.y, w: 64, h: 64 })),
      ...state.worldResourceStacks.map(stack => ({ x: stack.position.x, y: stack.position.y, w: 64, h: 64 })),
      ...state.questTableCards.map(card => ({ ...card.position, w: 120, h: 120 * 88 / 63 })),
    ];
    // Beside or below the quest location before above it: with neighbouring
    // biomes on its row, straight up lands off the top of the view.
    const openSpot = (directions = [[-1,0],[1,0],[-1,1],[1,1],[0,1],[-1,-1],[1,-1],[0,-1]]) => {
      for (let radius = 1; radius <= 12; radius++) {
        for (const [dx, dy] of directions) {
          const candidate = { x: location.x + dx * radius * 140, y: location.y + dy * radius * 200 };
          if (!blocked.some(other => Math.abs(candidate.x - other.x) < (120 + other.w) / 2 + 16 && Math.abs(candidate.y - other.y) < (120 * 88 / 63 + other.h) / 2 + 16)) return candidate;
        }
      }
      return { x: location.x + 192, y: location.y };
    };
    const position = openSpot();
    const sourceRect = document.querySelector('[data-quest-id="expedition-' + index + '"] .quest-card')?.getBoundingClientRect();
    const rect = sourceRect && sourceRect.width > 0 ? sourceRect : document.querySelector('.quest-tray__toggle')?.getBoundingClientRect();
    const flightFrom = rect && rect.width > 0 ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : undefined;
    const arrivals: PlacedQuestCard[] = [{ questIndex: index, position, flightFrom }];
    setState(previous => previous.questTableCards.some(card => card.questIndex === index) ? previous : { ...previous, questTableCards: [...previous.questTableCards, ...arrivals] });
  }, [state]);
  const leaveTableau = (actorId?: string) => {
    tableauDepartures(state, actorId).forEach(exit => dropActorToTable(exit.actorId, exit.position));
    if (!actorId || state.worldActors.filter(actor => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId).length === 1) setMobilePanel('map');
  };
  const fieldBiome = state.biomeTiles.find(tile => tile.id === state.selectedBiomeId);
  const fieldActors = state.worldActors.filter(actor => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId);
  // Selection alone can be an inspection or a path crossed during travel.
  // Only arrival/staffing promotes the deal, including a completely cleared one.
  const [mapTravelTest, setMapTravelTest] = useState(false);
  const mapTravelActive = (!state.journey?.ordered && mapTravelTest && !state.journey?.segments.some(s=>s.kind==='den-exit' && state.journey!.progress<s.end)) && Boolean(state.journey) && !state.journey?.columns.flat().some(card => card.pose) && !combatDemoOpen;
  const idleFieldBiome = !state.journey && !state.selectedBiomeId ? state.biomeTiles.find(tile=>tile.id===(state.worldActors.find(actor=>actor.id==='hero')?.biomeId ?? (isHome(state)?'hero-den':undefined))) : undefined;
  const tableauPresent = !mapTravelActive && (Boolean(state.journey || state.selectedBiomeId || foundQuest) || combatDemoOpen);
  const tableauOccupied = Boolean(state.selectedBiomeId) && fieldActors.length > 0 && !pondSelected;
  const journeyActive = Boolean(state.journey);

  useEffect(() => {

    setMobilePanel(tableauOccupied || combatDemoOpen || journeyActive && !mapTravelActive ? 'tableau' : 'map');
  }, [tableauOccupied, engagementKey, combatDemoOpen, journeyActive, mapTravelActive]);
  const finishResting = () => {
    clearPendingInteractions(); setUndoStack([]);
    setState(previous => previous.ordinaryDay?.bedtime && isHome(previous) ? { ...previous,
      biomeTiles: previous.biomeTiles.map(tile => tile.id === previous.selectedBiomeId ? { ...tile, tableau: previous.tableau, stock: previous.stock } : tile),
      selectedBiomeId: null, tableau: [], stock: [], foundations: [],
      ordinaryDay: { ...previous.ordinaryDay, complete: true } } : previous);
  };
  const fieldRig = createTableauLightRig(tableHours, fieldBiome?.position ?? { x: 0, y: 0 }, [
    ...tableLights,
    ...state.worldActors.flatMap(actor => {
      const light = actorLight(actor.id, actor.location === 'foundation' ? state.biomeTiles.find(tile => tile.id === actor.biomeId)?.position ?? actor.position : actor.position, manaCarrierLuminosity(state, actor.id, actor.luminosity), actor.lightColor);
      return light ? [light] : [];
    }),
  ], cameraTilted, !editorOpen);
  const redeemQuest = () => {
    const index = state.questClaims;
    const step = getExpeditionQuestSteps(state)[index];
    if (!step || !(step.complete || state.questAccomplished[index])) { logHold(`redeem refused: quest ${index} not complete`); return; }
    const rewardSource = document.querySelector<HTMLElement>('[data-table-quest="' + index + '"] .quest-card');
    flyQuestToDiscard(rewardSource);
    const from = rewardSource?.getBoundingClientRect();
    const destination = document.querySelector('[data-inspiration-tray]')?.getBoundingClientRect();
    if (from && destination?.width) {
      const bolt = document.createElement('span'); bolt.textContent = '💫'; bolt.className = 'quest-inspiration-flight';
      bolt.style.cssText = 'position:fixed;left:'+(from.x+from.width/2)+'px;top:'+(from.y+from.height/2)+'px;z-index:60001;pointer-events:none;font-size:28px;';
      document.body.append(bolt);
      const flight = trackGameAnimation(bolt.animate([{transform:'translate(-50%,-50%) scale(1)'},{transform:'translate('+(destination.x+destination.width/2-from.x-from.width/2)+'px,'+(destination.y+destination.height/2-from.y-from.height/2)+'px) scale(.5)',opacity:0}],{duration:550,easing:'ease-in-out'}));
      flight.onfinish=()=>bolt.remove();flight.oncancel=()=>bolt.remove();
    }
    setState((previous) => {
      // Prevent repeated input from redeeming a newly exposed quest.
      if (previous.questClaims !== index) return previous;
      // Rest's energy will be earned in the den tableau, not as a fixed quest bonus.
      const redeemed = redeemActiveQuest(previous, getExpeditionQuestSteps(previous).map((step) => step.complete), 0, ACTOR_INSPIRATION_MAX);
      return redeemed === previous ? previous : { ...redeemed, questTableCards: redeemed.questTableCards.filter(card => card.questIndex >= redeemed.questClaims) };
    });
  };

  const editorToggle = import.meta.env.DEV && <button className="tile-editor-toggle" data-editor-safe="true" type="button" aria-label="Edit tiles" aria-pressed={editorOpen}
    disabled={!editorOpen && Boolean(cardTransport || burningEnemyIds.length)}
    title="Developer tile editor · stops travel and pauses gameplay" onClick={() => {
      stopCameraPlayback();
      setEditorMenu(null);
      if (editorOpen) { setEditorDocument(null); return; }
      closeInspection(); clearPendingInteractions(); setCombatDemoOpen(false); setMobilePanel('map');
      leaveTableau();
      setState(previous => ({ ...previous, scene: 'exploration', journey: undefined, selectedBiomeId: null }));
      setTableLightsEnabled(false); setCycleLighting(false);
      const base = appliedTileDocument.current ?? { ...SAVED_TILE_DOCUMENT, tiles: SAVED_TILE_DOCUMENT.tiles ?? createInitialState(false).biomeTiles.map(authorTile) };
      setEditorDocument(JSON.parse(JSON.stringify(base)));
    }}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5" /></svg></button>;

  const travelTableau = state.journey ? <TravelTableau khadQuest={state.dayScenario==='day01' && !state.discoveredTutorialQuests?.includes('denser-patch') ? dayOneTutorialQuest(state).steps.find(step=>step.id==='denser-patch') : undefined} onDiscoverKhadQuest={()=>discoverQuest('denser-patch')} lightingEnabled={!editorOpen} discoverDenQuest={state.dayScenario==='day01' && !state.denQuestDiscovered} onDiscoverDenQuest={state.dayScenario==='day01'?()=>discoverQuest('navigate-den'):undefined} questDiscoveryHeld={!!foundQuest} tiles={state.biomeTiles} onBreach={(actorId,ability)=>setState(prev=>breachTravelPassage(prev,actorId,ability))} onReplan={()=>setState(prev=>{const j=prev.journey;if(!j)return prev;return {...prev,journey:{...j,paused:true,streak:0,tileStreak:0,blocked:{progress:j.progress,position:pointAlongTimedPath(j.path,j.progress),message:'Terrain obstructs this passage. Choose another route or cancel.'}}};})} mapOverlay={mapTravelActive} hours={tableHours} eventCost={(column,row,actorId,utility)=>travelEventCost(state,column,row,actorId,utility)} onEventPlay={(column,row,actorId,utility,cardId)=>setState(prev=>playTravelEvent(prev,column,row,actorId,utility,cardId))} onDiscard={(column,cardId)=>setState(prev=>discardTravelEvent(prev,column,cardId))} discarded={state.eventDiscard} terrainCrossings={state.terrainCrossings} members={partyMembers(state, state.journey.actorId).map(member => ({ id: member.id, label: member.label, inspiration: state.actorInspiration[Math.max(0, FOUNDATION_MOCKUPS.findIndex(a => a.id === member.id))] ?? 0, ap: state.utilityAP?.[member.id] ?? 0 }))} actorName={state.worldActors.find(actor => actor.id === state.journey!.actorId)?.label ?? state.journey.actorId} utilityAP={state.utilityAP?.[state.journey.actorId] ?? 0} onInspectActor={(anchor, actorId) => inspectActor(actorId ?? state.journey!.actorId, anchor, true)} onSolveStep={solveTravelStep} journey={state.journey} stamina={state.travelStamina ?? TRAVEL_STAMINA_MAX} inspiration={state.actorInspiration[Math.max(0, FOUNDATION_MOCKUPS.findIndex(actor => actor.id === state.journey!.actorId))]} onPlay={(column, actorId) => {
      const current = stateRef.current;
      const next = playTravelCard(current, column, actorId);
      if (next === current) return;
      const cards = current.journey?.columns[column];
      const card = cards?.[cards.length - 1];
      if (card && current.journey) flyTravelCard(card.id, actorId ?? current.journey.actorId);
      setState(next);
    }} onRedraw={actorId => setState(prev => redrawTravel(prev, actorId))} onPause={() => setState(prev => prev.journey ? { ...prev, journey: { ...prev.journey, paused: !prev.journey.paused } } : prev)} /> : null;

  const startScenarioTravel = (plan: TravelPlan) => {
    if (foundQuest || !dayOneAllowsPlan(state, plan)) return;
    clearPendingInteractions(); setUndoStack([]);
    setState(prev => prepareTravelTableau({ ...prev, journey: { ...beginJourney(plan, travelStartingRank(prev,plan.actorId), false), memberRanks: { [plan.actorId]: travelStartingRank(prev,plan.actorId) } },
      biomeTiles: prev.biomeTiles.map(tile => tile.id === prev.selectedBiomeId ? { ...tile, tableau: prev.tableau, stock: prev.stock } : tile),
      selectedBiomeId: null, tableau: [], stock: [], foundations: [],
      worldActors: prev.worldActors.map(actor => actor.id === plan.actorId ? { ...actor, location: 'table', heading: actor.id==='hero'?undefined:actor.heading, position: plan.path[0], biomeId: undefined, foundationIndex: undefined } : actor) }));
    setMobilePanel('tableau');
  };
  const switchDayScenario = (scenario: string, carriedMana?: number) => {
    setSceneCheckpoint(undefined); setSettledSceneBeat(null);
    stopCameraPlayback();
    setScenarioRun(run => run + 1);
    clearPendingInteractions(); setUndoStack([]); setCardTransport(null); setFoodLanding(null);
    setPlayerAutoPaused(true); setCombatDemoOpen(false); closeInspection(); setEditorDocument(null);
    setState(createDayScenario(scenario, appliedTileDocument.current ?? SAVED_TILE_DOCUMENT, carriedMana));
    setTableHours(scenario === 'sandbox' ? TABLE_OPENING_HOUR : scenario==='day03'?9:10); setCycleLighting(false);
    setGlobalLightsEnabled(true); setTableLightsEnabled(true); setMobilePanel('map');
  };
  const jumpToScene = (id: SceneCheckpointId) => {
    const next = createSceneCheckpoint(id, appliedTileDocument.current ?? SAVED_TILE_DOCUMENT);
    switchDayScenario(next.dayScenario!);
    setSceneCheckpoint(id); setSettledSceneBeat(dayCinematicBeatId(next));
    setState(next); setTableHours(dayOneHour(next));
  };
  const mapSettings = (travelControls?: React.ReactNode) => (<div className="proto-settings-host" data-editor-safe="true">{editorToggle}<ArtSettings>{travelControls}
                  <label className="art-settings__toggle"><input type="checkbox" checked={mapTravelTest} onChange={event => { setMapTravelTest(event.target.checked); setMobilePanel('map'); }} />Map tableau (test)</label>
                  <label className="art-settings__toggle" title="Apply global day/night lighting and haze. Uncheck for a bright view; local lights remain independent."><input type="checkbox" checked={globalLights} onChange={(event) => setGlobalLightsEnabled(event.target.checked)} />Global lights</label>
                  <div className="art-settings__section" aria-label="Lighting controls">
                  <span>Day {state.day} · {lighting.phase} · {String(Math.floor(lighting.hour)).padStart(2, '0')}:{String(Math.floor((lighting.hour % 1) * 60)).padStart(2, '0')}</span>
                  {state.dayScenario ? <span>Story milestones advance the day. Reading takes no time.</span> : <><label className="flex items-center gap-2">Time <TimeOfDaySlider hours={tableHours} onChange={setTableHours} /></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={cycleLighting} onChange={(event) => setCycleLighting(event.target.checked)} />Cycle day/night</label></>}
                  <label className="flex items-center gap-2"><input type="checkbox" checked={tableLightsEnabled} onChange={(event) => setTableLightsEnabled(event.target.checked)} />Table lights</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={lightReadoutVisible} onChange={(event) => setLightReadoutVisible(event.target.checked)} />Light %</label>
                  </div>
                <div className="proto-party-controls" data-camera-ignore="true" aria-label="Party controls">
                  <span>Party · {state.worldActors.filter(a => a.partyId).map(a => a.label).join(', ') || 'Solo'}</span>
                  <button type="button" disabled={Boolean(state.journey) || editorOpen || state.worldActors.length >= 3 || state.worldActors.some(a => a.location !== 'table')} onClick={() => setState(addPartyCompanion)}>Add playtest companion</button>
                  {state.worldActors.filter(a => a.id !== 'hero').map(actor => <button type="button" key={actor.id} disabled={editorOpen || Boolean(state.journey) || (actor.partyId ? leaveParty(state, actor.id) === state : joinParty(state, actor.id, 'hero') === state)} onClick={() => setState(prev => actor.partyId ? leaveParty(prev, actor.id) : joinParty(prev, actor.id, 'hero'))}>{actor.partyId ? 'Leave party' : 'Join Hero'} · {actor.label}</button>)}
                </div>
                <div className="art-settings__section" aria-label="Development controls">
                  {import.meta.env.DEV && !editorOpen && <CameraChoreographyButton />}
                  <span className="proto-build-label" data-build-commit={PROTO_BUILD_COMMIT} title={PROTO_BUILD_TITLE}>{PROTO_BUILD_LABEL}</span>
                </div>
                </ArtSettings></div>);

  return (
    <CalloutEditingProvider enabled={Boolean(import.meta.env.DEV && editorOpen)}><div
      className={`proto-game-root ${authoring ? 'proto-authoring-root' : ''} ${editorOpen ? 'tile-editor-open' : ''} h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(20,38,31,0.24),transparent_38%),linear-gradient(180deg,#05060a,#090d12_38%,#06070a)] p-[clamp(0.6rem,1.8vmin,1.2rem)] text-white`}
      onPointerDownCapture={event => { if (editorOpen && event.target instanceof Element && !event.target.closest('.tile-editor, .proto-map, [data-editor-safe]')) { event.preventDefault(); event.stopPropagation(); } }}
      onClickCapture={event => { if (editorOpen && event.target instanceof Element && !event.target.closest('.tile-editor, .proto-map, [data-editor-safe]')) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDownCapture={event => { if (editorOpen && event.target instanceof Element && !event.target.closest('.tile-editor, .proto-map, [data-editor-safe]')) { event.preventDefault(); event.stopPropagation(); } }}
      style={{
        ['--classic-card-w' as string]: 'clamp(2.35rem, min(8.8vw, 10dvh), 5rem)',
        ['--classic-gap' as string]: 'clamp(0.3rem, 1vmin, 0.9rem)',
        ['--classic-tableau-gap' as string]: 'clamp(0.18rem, 0.55vw, 0.55rem)',
        ['--classic-stack-step' as string]: 'clamp(1.15rem, min(4.8dvh, calc(var(--classic-card-w)*0.5)), 2.35rem)',
        ['--classic-radius' as string]: 'clamp(0.8rem, 1.7vmin, 1.35rem)',
        ['--actor-board-span' as string]: '85%',
        ['--table-object-shadow' as string]: cameraTilted ? tableObjectShadow(tableHours, { x: 0, y: 0 }, 5, tableLights) : 'none',
        ['--table-daylight' as string]: lighting.daylight,
        ['--table-wood-light' as string]: `${18 + lighting.daylight * 12}%`,
      }}
    >
      {state.dayScenario==='day02' && state.dayTwoAmbush && <BanksRescueCinema key={scenarioRun} onExit={()=>switchDayScenario('day02')} onComplete={()=>switchDayScenario('day03')} />}
      <TableauDragPreview key={`tableau-preview-${scenarioRun}`} enabled={!!state.denQuestDiscovered && !editorOpen && !combatDemoOpen && state.dayScenario==='day01' && state.journey?.segments[0]?.kind==='den-exit' && state.journey.completed===0 && (state.journey.memberRanks?.hero ?? state.journey.rank)===2} paused={Boolean(state.journey?.paused)} cardIds={state.journey?.columns.flatMap(column=>{const card=column[column.length-1];return card?.rank===3?[card.id]:[];}) ?? []} />
      {!authoring && <SceneTree current={sceneCheckpoint} onSelect={jumpToScene} />}
      <DayForagingCallout onFaceTarget={target=>setState(prev=>({...prev,worldActors:prev.worldActors.map(actor=>actor.id==='hero'?{...actor,heading:Math.atan2(target.x-actor.position.x,target.y-actor.position.y)}:actor)}))} state={state} hidden={combatDemoOpen || Boolean(sceneCheckpoint && dayCinema.beat?.id === settledSceneBeat)} cinematicBeat={dayCinema.enabled ? dayCinema.beat : null} />
      {import.meta.env.DEV && <CameraChoreographyTools tiles={state.biomeTiles.map(t => ({ id: t.id, label: t.title }))} />}
      {editorDocument && <TileEditor workspace={authoring} tools={authoring ? undefined : <CameraChoreographyButton />} renderTableaus={tile => <TableauEditor target={tile ? tile.berryPatchVariant === 'sparse' ? 'berry-patch-sparse' : tile.kind : undefined} tileLabel={tile?.title} />} document={editorDocument} cell={editorCell} contextMenu={editorMenu} onDismissMenu={() => setEditorMenu(null)} onSelectCell={setEditorCell} onChange={setEditorDocument}
        onClose={() => { setEditorMenu(null); setEditorDocument(null); }} onApply={document => {
          const next = applyTileDocument(state, document);
          appliedTileDocument.current = JSON.parse(JSON.stringify(document));
          setUndoStack([]); setState(next);
        }} />}
      <div data-scenario-expanded={scenarioExpanded} className="proto-workspace mx-auto h-full w-full min-h-0 gap-[clamp(0.55rem,1.4vmin,1rem)]">
        <div className="proto-play-area min-h-0 min-w-0">
          <section className="flex h-full min-h-0 flex-col rounded-[calc(var(--classic-radius)*1.75)] border border-white/10 bg-black/20 p-[clamp(0.6rem,1.6vmin,1.2rem)] shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
            <div data-mobile-panel={mobilePanel} data-primary-viewport="map" data-tableau-present={tableauPresent} data-layout-emphasis="map" style={desktopLayoutTracks(tableauPresent, state.scene === 'combat')} className="proto-main-layout grid h-full min-h-0 flex-1 gap-[clamp(0.55rem,1.4vmin,0.9rem)]">
              <div className="proto-main-header min-h-0" data-combat-header={state.scene === 'combat'}>

                {state.scene === 'combat' ? (
                  <EnemyTeamPanel
                    enemies={state.enemyTeam}
                    scene={state.scene}
                    biomeCacheClaimed={state.biome.cacheClaimed}
                    pendingAbility={pendingAbilityTarget}
                    tauntActive={getTauntTargetIndex(state) !== null}
                    burningEnemyIds={burningEnemyIds}
                    transportTargetIndex={cardTransport?.targetSide === 'enemy' ? cardTransport.targetIndex : null}
                    onTargetEnemy={applyAbilityToEnemy}
                    onDevDefeatEnemy={devDefeatEnemy}
                    onTransportTargetRef={(enemyIndex, node) => {
                      enemyTransportRefs.current[enemyIndex] = node;
                    }}
                    announcement={targetAnnouncement}
                    ambushCardsRemaining={state.ambushCardsRemaining}
                  />
                ) : null}

              </div>

              <div hidden={!tableauPresent} className={`proto-tableau-field min-h-0 min-w-0 overflow-hidden${pondSelected && !combatDemoOpen ? ' proto-tableau-field--pond' : ''}${dangerSelected || combatDemoOpen ? ' proto-tableau-field--combat' : ''}`}>
              {foundQuest && foundQuest.id!=='navigate-den' && !(foundQuest.id==='denser-patch' && state.journey?.segments.some(segment=>segment.sparseBerry)) && <DenQuestDiscovery key={foundQuest.id} step={foundQuest} paused={!!state.journey?.paused} onDiscover={()=>discoverQuest(foundQuest.id)} />}
              {!editorOpen && !state.journey && (state.selectedBiomeId || idleFieldBiome || combatDemoOpen) && !pondSelected && <TableauLighting hours={tableHours} />}
              {(state.selectedBiomeId || idleFieldBiome) && !pondSelected && !combatDemoOpen && <TableauLandscape tileType={(fieldBiome ?? idleFieldBiome)?.berryPatchVariant==='sparse' ? 'berry-patch-sparse' : (fieldBiome ?? idleFieldBiome)?.tileType} berriesAvailable={fieldBiome ? tileHasBerries(fieldBiome, state.tableau, state.stock) : idleFieldBiome ? tileHasBerries(idleFieldBiome) : false} />}
              {!state.journey && idleFieldBiome?.tileType==='hero-den' && <CaveTableauScenery className="travel-den-scene-cave" />}
              {state.journey ? (mapTravelActive ? null : travelTableau) : !state.selectedBiomeId && !combatDemoOpen ? (<>
                <div className="proto-main-tableau min-h-0 rounded-[calc(var(--classic-radius)*1.3)] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(14,22,20,0.44),rgba(9,12,14,0.28))]" aria-label="Empty tableau" style={{gridArea:"1 / 1 / -1 / -1"}} />
              </>) : dangerSelected || combatDemoOpen ? (
                <BattleTableauField hours={tableHours} lights={tableLights} active={combatDemoOpen} onWatch={watchBattleScene} onSceneChange={setBattleScene}
                  heroInspiration={state.actorInspiration[0]} onRedraw={(actorId) => { if (actorId === 'hero') setState((prev) => ({ ...prev, actorInspiration: prev.actorInspiration.map((value, index) => index === 0 ? Math.max(0, value - REDRAW_INSPIRATION_COST) : value) })); }} />
              ) : pondSelected ? (
                <PondField pond={state.pond} angler={pondAngler?.label ?? null} tired={Boolean(pondAngler) && !canSpendInspiration(state.inspiration, POND_MISS_INSPIRATION)}
                  landed={state.haul.mana - state.settledHaul.mana}
                  onCast={castPondBait} onFightEnd={endPondFight} onLeave={() => leaveTableau()} />
              ) : (<>
              <div inert={!!foundQuest} className="proto-main-tableau proto-main-tableau--solver grid min-h-0 grid-cols-1 items-center gap-[clamp(0.35rem,0.9vmin,0.6rem)] overflow-hidden rounded-[calc(var(--classic-radius)*1.3)] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(14,22,20,0.44),rgba(9,12,14,0.28))] p-[clamp(0.45rem,1.2vmin,0.75rem)]">
                <div className="proto-tableau-heading">
                  {isDenRest(state) && <div className="proto-rest-status" role="status" aria-label="Den rest status"><span>Hero’s Den · Rest</span><span>INSP {state.inspiration}/{state.maxInspiration}</span><span>{state.tableau.every(column => !column.length) ? 'Perfect rest' : !state.stock.length && !hasNormalPlayerTableauMove(state) ? 'Rest finished' : `${state.tableau.reduce((sum, column) => sum + column.length, 0)} left`}</span>{state.ordinaryDay?.bedtime && !state.ordinaryDay.complete && <button type="button" disabled={Boolean(cardTransport)} onClick={finishResting}>Finish resting</button>}</div>}
                  <TableauSolveControls disabled={!!foundQuest || !state.worldActors.some((actor) => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId)} key={state.selectedBiomeId ?? 'main'} onStep={solveMainStep} onStart={startSolver} guidance={moveGuidance} onGuidanceChange={setMoveGuidance} />
                </div>
                <TableauPlayArea biome={fieldBiome} rig={fieldRig} hours={tableHours} immersive={false} columns={isDenRest(state)?REST_COLUMNS:TABLEAU_COLUMNS} rows={isDenRest(state)?REST_ROWS:Math.max(1,...tableState.tableau.map(c=>c.length))}>
                <div className={`proto-tableau-stage${cameraTilted ? ' proto-tableau-stage--tilted' : ''}`}>
                <Tableau
                  columns={tableState.tableau}
                  className="grid min-w-0 justify-center"
                  style={{
                    gridTemplateColumns: `repeat(${isDenRest(state) ? REST_COLUMNS : TABLEAU_COLUMNS}, minmax(0, var(--classic-card-w)))`,
                    gap: 'var(--classic-tableau-gap)',
                    justifyContent: 'center',
                  }}
                >
                  {Array.from({ length: isDenRest(state) ? REST_COLUMNS : TABLEAU_COLUMNS }, (_, columnIndex) => {
                    const column = tableState.tableau[columnIndex] ?? [];
                    const rowCount = isDenRest(state) ? REST_ROWS : Math.max(1, ...tableState.tableau.map((entry) => entry.length));
                    const topPadding = isDenRest(state) ? 0 : rowCount - column.length;
                    return (
                      <div
                        key={`tableau-column-${columnIndex}`}
                        className="relative"
                        style={{
                          width: 'var(--classic-card-w)',
                          height: 'var(--classic-stack-height)',
                        }}
                      >
                        {column.map((card, cardIndex) => {
                          const stackIndex = topPadding + cardIndex;
                          // Rows behind the front row sit farther from the tilted camera.
                          const depth = rowCount - 1 - stackIndex;
                          const isTopCard = cardIndex === column.length - 1;
                          const targetIndexes = adjacentFoundationIndexes(card, tableState);
                          const encounterReady = isTopCard && tableState.scene === 'exploration' && Boolean(card.encounter);
                          const playable = isTopCard && targetIndexes.length > 0;
                          const utilityCost = utility ? utilityRetrievalCost(state, utility.foundationIndex, utility.move, columnIndex, cardIndex) : null;
                          const transporting = cardTransport?.cardId === card.id;
                          const mobilityTarget =
                            isTopCard &&
                            pendingMobility !== null &&
                            (pendingMobility.kind === 'blink' || pendingMobility.kind === 'hallowed_path' || column.length >= 2);
                          const choosingTarget =
                            pendingTargetSelection?.cardId === card.id &&
                            pendingTargetSelection.columnIndex === columnIndex;
                          return (
                            <ProtoCard
                              key={card.id}
                              card={card}
                              allowJumbo={false}
                              cardRef={(node) => {
                                tableauCardRefs.current[card.id] = node;
                              }}
                              onDiscard={card.event && isTopCard && !cardTransport && state.scene==='exploration' ? ()=>setState(prev=>discardTableauEvent(prev,columnIndex)) : undefined}
                              onDropActor={!utility && !pendingMobility && !cardTransport && playable && !encounterReady ? target => {
                                const actorId=target.dataset.mapActorCard ?? target.dataset.travelFoundation;
                                const actor=state.worldActors.find(actor=>actor.id===actorId && actor.location==='foundation' && actor.biomeId===state.selectedBiomeId);
                                if(actorId && !actor)return;
                                const index=actor ? actor.foundationIndex ?? 0 : Number(target.dataset.foundationIndex);
                                if(targetIndexes.includes(index))playColumnToFoundation(columnIndex,index);
                              } : undefined}
                              transporting={transporting}
                              active={utility ? utilityCost !== null : (moveGuidance && (playable || encounterReady)) || choosingTarget}
                              mobilityTarget={mobilityTarget}
                              muted={!isTopCard && !utility}
                              buried={!isTopCard}
                              centerRank={isTopCard}
                              lit={cameraTilted}
                              standardRankSize
                              footerLabel={
                                utility ? (utilityCost !== null ? `${utilityCost} AP` : undefined) : isDenRest(state) && card.sleep ? (
                                  <span role="img" aria-label={SLEEP_LABELS[card.sleep]}>{SLEEP_ICONS[card.sleep]}</span>
                                ) : state.scene === 'exploration' && card.encounter ? (
                                  <span role="img" aria-label="Shadow Wolf encounter">
                                    {ENCOUNTER_GLYPH}
                                  </span>
                                ) : cardResourceFace(card) && state.scene === 'exploration' ? (
                                  <span role="img" aria-label={cardResourceFace(card)?.label}>
                                    {card.foodSource === 'berries' ? <ManaberryIcon /> : cardResourceFace(card)?.glyph}
                                  </span>
                                ) : undefined
                              }
                              disabled={utility ? utilityCost === null || Boolean(cardTransport) : !playable && !encounterReady && !mobilityTarget}
                              onClick={() => {
                                if(card.event && stateRef.current.tableau[columnIndex]?.[cardIndex]?.id!==card.id)return;
                                if (utility) { if (utilityCost !== null && !cardTransport) playColumnToFoundation(columnIndex, utility.foundationIndex, { retrieval: { move: utility.move, cardIndex } }); return; }
                                if (cardTransport) {
                                  if (flightProjection && playable && !mobilityTarget && !encounterReady) playColumn(columnIndex);
                                  return;
                                }
                                if (mobilityTarget) {
                                  pendingMobility?.kind === 'dig'
                                    ? digTableauColumn(columnIndex)
                                    : pendingMobility?.kind === 'hallowed_path'
                                      ? selectHallowedPathCard(columnIndex)
                                      : blinkToTableauCard(columnIndex);
                                  return;
                                }
                                if (encounterReady) {
                                  beginCombatEncounter(columnIndex);
                                  return;
                                }
                                if (playable) playColumn(columnIndex);
                              }}
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                transform: `translateY(calc(var(--classic-stack-step) * ${stackIndex}))`,
                                zIndex: stackIndex + 1,
                                ...(cameraTilted ? fieldRig.surface((columnIndex - 3) * 28, 35 - depth * 18) : {}),
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </Tableau>
                </div>
                </TableauPlayArea>
                <div className="proto-tableau-status grid gap-[clamp(0.4rem,1vmin,0.65rem)] self-stretch content-center">
                  {state.scene === 'exploration' ? (
                    <div className={`rounded-[calc(var(--classic-radius)*0.55)] border px-2 py-2 text-center font-mono ${
                      state.energy === 0
                        ? 'border-[#ffb13d]/50 bg-[#ffb13d]/12 text-[#ffe1b5]'
                        : 'border-[#8ef2d4]/24 bg-[#8ef2d4]/6 text-[#cafff4]'
                    }`}>
                      <div className="text-[clamp(0.46rem,0.98vmin,0.6rem)] font-black uppercase tracking-[0.16em]">
                        Forage Energy
                      </div>
                      <div className="mt-0.5 text-[clamp(0.78rem,1.58vmin,0.96rem)] font-black tracking-[0.12em]">
                        {state.energy}/{state.energyMax}
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-[calc(var(--classic-radius)*0.55)] border border-[#8ef2d4]/24 bg-[#8ef2d4]/6 px-2 py-2 text-center font-mono">
                    <div className="text-[clamp(0.46rem,0.98vmin,0.6rem)] font-black uppercase tracking-[0.16em] text-[#8ef2d4]/70">
                      {DEFAULT_BIOME.objectiveLabel}
                    </div>
                    <div className="mt-0.5 text-[clamp(0.72rem,1.46vmin,0.88rem)] font-black uppercase tracking-[0.12em] text-[#cafff4]">
                      {DEFAULT_BIOME.label}
                    </div>
                    <div className="mt-1 text-[clamp(0.42rem,0.86vmin,0.54rem)] font-bold uppercase tracking-[0.08em] text-white/46">
                      {DEFAULT_BIOME.resources.join(' / ')}
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1 border-t border-white/10 pt-1.5 text-[clamp(0.4rem,0.8vmin,0.52rem)] font-black uppercase tracking-[0.06em] text-[#ffe7ad]">
                      {FOREST_RESOURCE_ORDER.map((resource) => (
                        <div key={`haul-${resource}`}>
                          <div className="text-white/42">{FOREST_RESOURCE_LABELS[resource]}</div>
                          <div className="mt-0.5 text-[0.9rem] text-white">{state.haul[resource]}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 border-t border-white/10 pt-1.5 text-[clamp(0.38rem,0.76vmin,0.5rem)] font-black uppercase tracking-[0.08em] text-white/48">
                      {state.biome.cacheClaimed
                        ? 'Forest cache secured'
                        : `Deal ${state.tableau.reduce((total, column) => total + column.length, 0) + state.stock.length} cards`}
                    </div>
                    <div className="mt-0.5 text-[clamp(0.38rem,0.76vmin,0.5rem)] font-black uppercase tracking-[0.06em] text-[#ffe7ad]">
                      Cache +{state.biome.cacheReward.wood}W +{state.biome.cacheReward.mana} mana
                    </div>
                  </div>
                  <div className="rounded-[calc(var(--classic-radius)*0.55)] border border-[#ffd166]/18 bg-[#ffd166]/8 px-2 py-2 text-center font-mono">
                    <div className="text-[clamp(0.48rem,1.05vmin,0.62rem)] font-black uppercase tracking-[0.16em] text-[#ffd166]/70">
                      Turn {turnCount}
                    </div>
                    <div className="mt-0.5 text-[clamp(0.72rem,1.5vmin,0.9rem)] font-black uppercase tracking-[0.14em] text-white/86">
                      {currentTurn}
                    </div>
                  </div>
                  <div className={`rounded-[calc(var(--classic-radius)*0.55)] border px-2 py-2 text-center font-mono ${
                    pendingMobility !== null
                      ? 'border-[#d9a8ff]/55 bg-[#d9a8ff]/12 text-[#ecd8ff]'
                      : state.mobilityUsed
                        ? 'border-white/10 bg-white/4 text-white/36'
                        : state.mobilityCooldown > 0
                          ? hasNormalPlayerTableauMove(state)
                            ? 'border-white/10 bg-white/4 text-white/42'
                            : 'border-[#ffb13d]/42 bg-[#ffb13d]/10 text-[#ffe1b5]'
                          : 'border-[#d9a8ff]/38 bg-[#d9a8ff]/8 text-[#ecd8ff]'
                  }`}>
                    <div className="text-[clamp(0.48rem,1.05vmin,0.62rem)] font-black uppercase tracking-[0.16em]">
                      Mobility
                    </div>
                    <div className="mt-0.5 text-[clamp(0.62rem,1.28vmin,0.78rem)] font-black uppercase tracking-[0.12em]">
                      {pendingMobility !== null
                        ? `${mobilityLabelForKind(pendingMobility.kind)} target`
                        : state.mobilityUsed
                          ? 'Cooldown'
                          : state.mobilityCooldown > 0
                            ? hasNormalPlayerTableauMove(state)
                              ? `CD ${state.mobilityCooldown}`
                              : 'Emergency'
                            : 'Ready'}
                    </div>
                    {pendingMobility !== null ? (
                      <button
                        type="button"
                        aria-label={`Cancel ${pendingMobility.kind}`}
                        onClick={() => setPendingMobility(null)}
                        className="mt-1 rounded-full border border-[#d9a8ff]/38 bg-black/22 px-2 py-0.5 text-[clamp(0.48rem,0.95vmin,0.6rem)] font-black uppercase tracking-[0.1em] text-[#ecd8ff] transition hover:border-[#d9a8ff]/75"
                      >
                        X
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={`proto-main-foundations ${isDenRest(state) ? 'proto-rest-foundations ' : ''}min-h-0 overflow-hidden rounded-[calc(var(--classic-radius)*1.3)] border border-[#f4c86c]/18 bg-[linear-gradient(180deg,rgba(22,18,12,0.44),rgba(9,10,12,0.28))] p-[clamp(0.5rem,1.25vmin,0.8rem)]`}>
                <div
                  className={`proto-foundation-board mx-auto grid w-full justify-center ${state.scene === 'exploration' ? 'proto-foundation-board--exploration' : ''}${cameraTilted ? ' proto-foundation-board--tilted' : ''}`}
                  style={{
                    gridTemplateColumns: `repeat(${state.scene === 'exploration' ? Math.max(1, state.foundations.length) : FOUNDATION_SLOTS}, minmax(${state.scene === 'exploration' ? '8rem' : '0'}, 1fr))`,
                    gap: 'var(--classic-gap)',
                  }}
                >
                  {state.scene === 'exploration' ? (
                    state.foundations.map((foundation, index) => {
                      const actor = state.worldActors.find(
                        (entry) => entry.location === 'foundation' && entry.biomeId === state.selectedBiomeId && (entry.foundationIndex ?? 0) === index,
                      );
                      const collectedCardCount = foundation?.cards.length ?? 0;
                      const collectedResources = isDenRest(state) ? (['rest'] as const).map(sleep => ({
                        resource: sleep, label: SLEEP_LABELS[sleep], glyph: SLEEP_ICONS[sleep],
                        count: foundation?.cards.filter(card => card.sleep === sleep).length ?? 0,
                      })) : FOREST_RESOURCE_ORDER.map((resource) => ({
                        resource,
                        label: FOREST_RESOURCE_LABELS[resource], glyph: FOREST_RESOURCE_GLYPHS[resource],
                        count: foundation?.cards.filter((card) => (card.resource && WORLD_ITEMS[card.resource].food ? 'mana' : card.resource) === resource).length ?? 0,
                      }));
                      return (
                        <div key={`exploration-foundation-${index}`} className="proto-foundation-assembly">
                        <div
                          aria-label="Foundation"
                          data-foundation-index={index}
                          ref={(node) => {
                            if (!isDenRest(state)) foundationTransportRefs.current[index] = node;
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            const actorId = event.dataTransfer.getData('text/proto-actor');
                            if (actorId) {
                              window.dispatchEvent(new CustomEvent('proto-foundation-travel-request', {
                                detail: { actorId, foundationIndex: index },
                              }));
                            }
                          }}
                          style={cameraTilted ? fieldRig.surface((index - (state.foundations.length - 1) / 2) * 55, 90) : undefined}
                          className="proto-foundation-card--exploration grid aspect-[56/74] w-full max-w-[clamp(8rem,18vw,14rem)] place-items-center rounded-[calc(var(--classic-radius)*1.15)] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(10,15,16,0.96),rgba(5,8,10,0.98))] text-[clamp(0.58rem,1vmin,0.7rem)] font-mono uppercase tracking-[0.18em] text-white/30"
                        >
                          {actor ? (
                            <span className="proto-actor-energy" aria-label={isDenRest(state) ? `${actor.label} inspiration ${state.inspiration} of ${state.maxInspiration}` : `${actor.label} energy ${state.energy} of ${state.energyMax}`} title={isDenRest(state) ? `${actor.label} inspiration` : `${actor.label} energy`}>
                              <span aria-hidden="true">{isDenRest(state) ? '💫' : '⚡'}</span><span>{isDenRest(state) ? state.inspiration : state.energy}</span>
                            </span>
                          ) : null}
                          {actor ? (
                            <div
                              aria-label="Hero actor in foundation"
                              role="button"
                              tabIndex={0}
                              aria-haspopup="dialog"
                              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); inspectActor(actor.id, event.currentTarget, true); } }}
                              data-camera-ignore="true"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                if (event.pointerType === 'mouse' && event.button !== 0) return;
                                event.preventDefault();
                                try {
                                  event.currentTarget.setPointerCapture(event.pointerId);
                                } catch {
                                  // Capture can fail when the browser starts a native drag.
                                }
                                foundationActorPointerRef.current = {
                                  actorId: actor.id,
                                  pointerId: event.pointerId,
                                  startX: event.clientX,
                                  startY: event.clientY,
                                  moved: false,
                                };
                              }}
                              onPointerMove={(event) => {
                                const drag = foundationActorPointerRef.current;
                                if (!drag || drag.pointerId !== event.pointerId) return;
                                if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) {
                                  drag.moved = true;
                                  window.dispatchEvent(new CustomEvent('proto-actor-drag-start', {
                                    detail: { actorId: actor.id, x: event.clientX, y: event.clientY },
                                  }));
                                }
                                if (drag.moved) {
                                  window.dispatchEvent(new CustomEvent('proto-actor-drag-move', {
                                    detail: { actorId: actor.id, x: event.clientX, y: event.clientY },
                                  }));
                                }
                              }}
                              onPointerUp={(event) => {
                                const drag = foundationActorPointerRef.current;
                                if (!drag || drag.pointerId !== event.pointerId) return;
                                if (drag.moved) {
                                  window.dispatchEvent(new CustomEvent('proto-actor-pointer-drop', {
                                    detail: { actorId: actor.id, x: event.clientX, y: event.clientY },
                                  }));
                                  window.dispatchEvent(new CustomEvent('proto-actor-drag-end'));
                                }
                                if (!drag.moved) {
                                  const anchor = event.currentTarget;
                                  requestHoloDeviceTilt();
                                  // Let the release's synthesized click finish before mounting
                                  // the jumbo backdrop, so a tap cannot immediately dismiss it.
                                  gameTime.requestAnimationFrame(() => inspectActor(actor.id, anchor, true));
                                }
                                foundationActorPointerRef.current = null;
                              }}
                              onPointerCancel={() => {
                                foundationActorPointerRef.current = null;
                                window.dispatchEvent(new CustomEvent('proto-actor-drag-end'));
                              }}
                              className="proto-exploration-actor cursor-grab touch-none text-center text-[#ffe7ad] active:cursor-grabbing"
                            >
                              <span className={`proto-occupied-foundation-face${cameraTilted ? ' proto-lit-surface' : ''}`} aria-label={isDenRest(state) ? 'Hero resting in her den' : `Foundation top card ${rankLabel(foundation?.card.rank ?? 2)}${foundation?.card.resource ? `, ${FOREST_RESOURCE_LABELS[foundation.card.resource]}` : ''}`}>
                                <ActorHoloCard relocated actorId={actor.id} name={actor.label} rank={isDenRest(state) ? '' : rankLabel(foundation?.card.rank ?? 2)} resource={collectedCardCount > 0 && foundation?.card.resource ? FOREST_RESOURCE_GLYPHS[foundation.card.resource] : undefined}
                                  foodLanding={foodLanding?.foundationIndex === index && foodLanding.biomeId === state.selectedBiomeId ? foodLanding : undefined} />
                              </span>

                            </div>
                          ) : foundation?.count ? (
                            <div className="proto-exploration-actor">
                              <span className="proto-occupied-foundation-face">
                                <span className="proto-occupied-foundation-rank"><span>{rankLabel(foundation.card.rank)}</span><span>{foundation.card.resource ? FOREST_RESOURCE_GLYPHS[foundation.card.resource] : '·'}</span></span>
                                <span className="proto-occupied-foundation-owner">Foundation</span>
                              </span>
                            </div>
                          ) : (
                            <div className="proto-exploration-actor"><span className="proto-empty-foundation-face">Foundation {index + 1}</span></div>
                          )}
                          {actor && <FoundationExitButton label={`Exit tableau · ${actor.label}`} disabled={Boolean(cardTransport)} onExit={() => leaveTableau(actor.id)} />}
                          <span className="proto-foundation-count-token" aria-label={`${collectedCardCount} cards collected`} title="Cards collected">
                            <span aria-hidden="true">▤</span><span>{collectedCardCount}</span>
                          </span>
                        </div>
                          {actor?.id === 'hero' && <div className="battle-moves" role="group" aria-label={actor.label + ' utility abilities'}>
                            <strong>{state.utilityAP?.[actor.id] ?? 0} AP banked</strong>
                            <AbilityTray actorName={actor.label} abilities={availableMovesFor(actor.id).filter(move => move.retrieval).map(move => <button key={move.name} type="button" className="battle-move" disabled={Boolean(cardTransport)} aria-pressed={utility?.foundationIndex === index && utility.move === move.name} title={move.description} onClick={() => { setPendingMobility(null); setPendingTargetSelection(null); setUtility(utility?.move === move.name ? null : { foundationIndex: index, move: move.name as 'Fetch' | 'Dig' }); }}><span>{move.name}</span><span>{move.name === 'Dig' ? 'Depth' : 2} AP</span></button>)} />
                            {utility && <button type="button" onClick={() => setUtility(null)}>Cancel {utility.move}</button>}
                          </div>}
                          <ul className="proto-foundation-resources" aria-label="Resources collected this tableau">
                            {collectedResources.map(({ resource, count, label, glyph }) => (
                              <li key={resource} data-resource={resource} data-count={count} aria-label={`${label} ${count}`} title={label}>
                                <span aria-hidden="true">{glyph}</span><span aria-hidden="true">{count}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })
                  ) : (
                  state.foundations.map((foundation, index) => (
                    <div key={`foundation-${index}`} className="min-w-0">
                      {(() => {
                        const tableauTarget = pendingTargetSelection?.targetIndexes.includes(index) ?? false;
                        const transportTarget =
                          cardTransport?.targetSide === 'player' && cardTransport.targetIndex === index;
                        const wildTarget = pendingWildCardTarget && Boolean(foundation && !foundation.wildcardBridgeFromRank);
                        const abilityTarget = pendingAbilityTarget?.targetKind === 'hero';
                        const selfAbilityTarget =
                          pendingAbilityTarget?.targetKind === 'self' && pendingAbilityTarget.sourceIndex === index;
                        const sourceActive = pendingAbilityTarget?.sourceIndex === index;
                        const mobilityEnergyCost = state.mobilityCooldown > 0 && !hasNormalPlayerTableauMove(state) ? 2 : 1;
                        const mobilityAvailable =
                          pendingMobility === null &&
                          !state.mobilityUsed &&
                          (state.mobilityCooldown === 0 || !hasNormalPlayerTableauMove(state)) &&
                          canAffordExplorationAction(state, mobilityEnergyCost);
                        const mobilityKind = FOUNDATION_MOCKUPS[index]?.mobility?.kind;
                        const mobilityReady =
                          mobilityKind === 'dig'
                            ? mobilityAvailable && state.tableau.some((column) => column.length >= 2)
                            : mobilityKind === 'blink'
                              ? mobilityAvailable &&
                                Boolean(foundation) &&
                                !foundation?.wildcardBridgeFromRank &&
                                !(state.heroBuffs[index] ?? []).some((buff) => buff.id === 'phase_shift')
                              : mobilityKind === 'hallowed_path'
                                ? mobilityAvailable &&
                                  Boolean(foundation) &&
                                  !foundation?.wildcardBridgeFromRank &&
                                  canAffordExplorationAction(state, mobilityEnergyCost + 1) &&
                                  state.tableau.some((column) => column.length > 0)
                                : false;
                        const canActivate = Boolean(foundation?.count) || (
                          FOUNDATION_MOCKUPS[index]?.heroClass === 'Mage' &&
                          (state.abilityProgress[MAGE_PHASE_SHIFT_TRIGGER.id] ?? 0) >= MAGE_PHASE_SHIFT_TRIGGER.threshold
                        );
                        return (
                      <ActorFoundationPanel
                        foundation={foundation}
                        index={index}
                        scene={state.scene}
                        hp={state.heroHp[index] ?? FOUNDATION_MOCKUPS[index]?.hp ?? 20}
                        buffs={state.heroBuffs[index] ?? []}
                        inspiration={state.actorInspiration[index] ?? ACTOR_INSPIRATION_MAX}
                        workCompleted={state.actorWorkCompleted[index] ?? 0}
                        active={tableauTarget || transportTarget || wildTarget || sourceActive || pendingMobility?.sourceIndex === index}
                        placementTargetable={tableauTarget || transportTarget}
                        targetable={abilityTarget || selfAbilityTarget}
                        targetTone={targetToneForAbility(pendingAbilityTarget)}
                        pendingAbility={pendingAbilityTarget}
                        canChoose={(pendingMobility === null || pendingTargetSelection?.hallowedPath === true) && (tableauTarget || wildTarget || abilityTarget || selfAbilityTarget || canActivate)}
                        selectedAdvisorAbility={selectedAdvisorAbilities[index] ?? null}
                        onClick={() => chooseFoundationTarget(index)}
                        onSelectAdvisorAbility={(abilityId) =>
                          setSelectedAdvisorAbilities((prev) => ({ ...prev, [index]: abilityId }))
                        }
                        mobilityLabel={FOUNDATION_MOCKUPS[index]?.mobility?.label ?? 'Locked'}
                        mobilityReady={mobilityReady}
                        mobilityPending={pendingMobility?.sourceIndex === index}
                        onUseMobility={() => {
                          if (mobilityKind === 'dig') startHeroDig();
                          if (mobilityKind === 'blink') startMageBlink();
                          if (mobilityKind === 'hallowed_path') startJarnHallowedPath();
                        }}
                        onCancelAbility={cancelLoadedAbility}
                        onDevDefeat={() => devDefeatHero(index)}
                        onTransportTargetRef={(node) => {
                          foundationTransportRefs.current[index] = node;
                        }}
                        announcement={targetAnnouncement}
                      />
                        );
                      })()}
                    </div>
                  ))) }
                </div>
                {EVENT_CARDS_ENABLED && state.eventDiscard?.length ? <EventDiscardPile cards={state.eventDiscard} /> : null}
                {isDenRest(state) && <div className="proto-rest-stock">
                  <span aria-live="polite">Stock {state.stock.length}</span>
                  <JumboActionCard type="button" className="proto-rest-receiver" cardRef={node=>{foundationTransportRefs.current[0]=node;}} aria-label={`Receiving card ${rankLabel(state.foundations[0]?.card.rank ?? 1)} · Draw stock · ${state.stock.length} cards remaining`} disabled={Boolean(cardTransport) || !state.stock.length || state.tableau.every(column => !column.length) || !fieldActors.length}
                    onClick={() => { pushUndo(); setState(prev => drawSleepStock(prev)); }}><span aria-hidden="true">{rankLabel(state.foundations[0]?.card.rank ?? 1)}</span><span>{state.stock.length ? 'Draw' : 'Last'}</span></JumboActionCard>
                </div>}
                {state.scene === 'exploration' && fieldActors.length > 1 && <FoundationExitButton everyone label="Everyone exit tableau" disabled={Boolean(cardTransport)} onExit={() => leaveTableau()} />}
              </div>
              </>)}
              </div>
              {combatDemoOpen ? <CombatDemo key={combatDemoReplay} battle={battleScene} onClose={() => setCombatDemoOpen(false)} onRestart={watchBattleScene}
                onEscape={dangerFighter ? () => { setCombatDemoOpen(false); leaveTableau(); } : undefined}
                overlay={<>{mapSettings()}<WorldMinimap tiles={state.biomeTiles} actors={state.worldActors} selectedBiomeId={state.selectedBiomeId} onViewMap={() => { setCombatDemoOpen(false); setMobilePanel('map'); }} /></>} /> : <ProtoMap departureCamera={dayCinema.enabled ? dayOneDepartureCamera(state) : undefined} cameraDirectorDisabled={Boolean(state.dayScenario === 'day02' && state.dayTwoAmbush)} key={scenarioRun}
                storyMood={dayCinema.active ? dayCinema.presentationBeat?.mood : undefined}
                peripheralDarkness={dayCinema.active ? dayCinema.presentationBeat?.peripheralDarkness : undefined}
                persistentTileLabelIds={dayCinema.tileLabelIds}
                objective={editorOpen ? null : dayObjective(state)}
                openingCardDeal={!sceneCheckpoint && !editorOpen && dayCinema.enabled && dayCinema.beat?.id === 'day01.opening'}
                travelTableau={mapTravelActive ? travelTableau : undefined}
                sceneId={dayCinema.beat?.id ?? (state.journey ? sceneCheckpoint : undefined) ?? dayCinema.presentationBeat?.id ?? state.dayScenario ?? 'sandbox'}
                actorCard={<ActorMapCard actorId="hero" name="Hero" position={state.journey?.actorId === 'hero' ? pointAlongTimedPath(state.journey.path, state.journey.walkedProgress ?? 0) : state.worldActors.find(a => a.id === 'hero')?.position} rank={rankLabel(state.journey ? state.journey.memberRanks?.hero ?? state.journey.rank : state.worldActors.find(a=>a.id==='hero')?.location==='foundation' ? state.foundations[state.worldActors.find(a=>a.id==='hero')?.foundationIndex ?? 0]?.card.rank ?? 2 : state.travelRanks?.hero ?? 2)} onInspect={anchor=>inspectActor('hero',anchor,true)} receivedResources={{AP:state.utilityAP?.hero??0,mana:state.haul.mana,inspiration:state.actorInspiration[0]??0}} foodLanding={foodLanding??undefined} />}
                settings={mapSettings}
                inactive={false}
                onEditCell={editorOpen ? cell => { setEditorCell(cell); setEditorMenu(null); } : undefined}
                onEditContextMenu={editorOpen ? (cell, x, y) => {
                  setEditorCell(cell);
                  setEditorMenu(editorDocument?.tiles?.some(tile => coversCell(tile, cell.column, cell.row)) || Math.abs(cell.column) > 7 || Math.abs(cell.row) > 7 ? null : { cell, x, y });
                } : undefined}
                editCell={editorOpen ? editorCell : undefined}
                extendTableau={false}
                storyCard={!state.dayScenario && state.ordinaryDay?.questCardSpawned && <div className="proto-ordinary-day" aria-label="An ordinary day" data-resting={state.ordinaryDay.bedtime || state.ordinaryDay.complete || undefined}>
                  <div className="proto-ordinary-day__heading"><QuestEmblem /><div><strong>{state.dayScenario ? 'Day 01 · Before dark' : 'An ordinary day'}</strong><span>{state.ordinaryDay.complete ? 'Home, at last' : state.ordinaryDay.bedtime ? 'Good night' : state.ordinaryDay.supper ? 'A quiet evening' : 'A little foraging'}</span></div></div>
                  <QuestArtwork sprite={`${import.meta.env.BASE_URL}assets/runtime/ui/quests/hero-snuffling-berries-v1.png`} paintedSprite={`${import.meta.env.BASE_URL}assets/runtime/ui/quests/hero-snuffling-berries-paint-bobtail-v2.png`} />
                  <div className="proto-ordinary-day__thought" role="status" title={state.dayScenario ? dayOneThought(state) : ordinaryThought(state)}>
                    <span>{state.dayScenario ? dayOneThought(state) : ordinaryThought(state)}</span>
                  </div>
                  <div className="proto-ordinary-day__actions" title={state.ordinaryDay.visitedTree ? 'Hero stopped beneath the old tree today.' : undefined}>
                    <span aria-label="Food carried">Mana {state.haul.mana}</span>
                    {state.dayScenario && <><span>STA {(state.travelStamina ?? 0).toFixed(1)} · {String(Math.floor(tableHours)).padStart(2,'0')}:{String(Math.round(tableHours%1*60)).padStart(2,'0')}</span>
                      {!state.ordinaryDay.supper && !state.ordinaryDay.bedtime && !state.ordinaryDay.complete && <button type="button" disabled={Boolean(cardTransport || state.journey) || (dayOneReturning(state) ? isHome(state) : !isHome(state))} onClick={() => startScenarioTravel(dayOnePlan(state))}>{dayOneReturning(state) ? 'Return before dark' : 'Visit manaberry patch'}</button>}
                      {!isHome(state) && !state.journey && !dayOneReturning(state) && <span>Forage two manaberries, then head home.</span>}
                    </>}
                    {state.ordinaryDay.visitedTree && <span title="Hero stopped beneath the old tree today.">A familiar old tree ✓</span>}
                    {!state.ordinaryDay.supper && <button type="button" disabled={!isHome(state) || state.haul.mana < SUPPER_MANA || Boolean(cardTransport)} onClick={() => { clearPendingInteractions(); setUndoStack([]); setState(eatSupper); }}>Eat supper · 2 mana</button>}
                    {state.ordinaryDay.supper && !state.ordinaryDay.bedtime && <button type="button" disabled={!isHome(state) || Boolean(cardTransport)} onClick={() => {
                      clearPendingInteractions(); setUndoStack([]);
                      setState(previous => {
                        if (!previous.ordinaryDay?.supper || !isHome(previous)) return previous;
                        const ready = { ...previous, ordinaryDay: { ...previous.ordinaryDay, bedtime: true } };
                        return arriveActorAtBiome(ready, 'hero', 'hero-den', { x: 0, y: 96 });
                      });
                    }}>Curl up · Zzz</button>}
                    {state.ordinaryDay.bedtime && !state.ordinaryDay.complete && <button type="button" disabled={Boolean(cardTransport) || !isHome(state)} onClick={finishResting}>Finish resting</button>}
                  </div>
                </div>}
                biomeTiles={previewTiles.map((tile) => ({ ...tile, selected: tile.id === state.selectedBiomeId, berriesAvailable: tileHasBerries(tile, tile.id === state.selectedBiomeId ? state.tableau : tile.tableau, tile.id === state.selectedBiomeId ? state.stock : tile.stock), sprite: biomeTileSprite(tile),
                  // A foe beaten today leaves its woods quiet: no danger, so passable.
                  flags: tile.clearedDay === state.day ? tile.flags?.filter((flag) => flag !== 'danger') : tile.flags,
                  // Discovery shows the entire biome, independent of solitaire work.
                  exploration: tile.flags?.includes('unexplored') ? 0 : 1 }))}
                actors={state.worldActors
                  .filter((actor) => (actor.location === 'table' || Boolean(actor.biomeId)) && (!actor.partyId || state.worldActors.find(member => member.partyId === actor.partyId)?.id === actor.id))
                  .map(({ id, label, location, biomeId, position, hutId, luminosity, lightColor, partyId, heading }) => ({ id, heading, label: partyId ? `${label} +${state.worldActors.filter(member => member.partyId === partyId).length - 1}` : label, location, biomeId, position, hutId, luminosity: manaCarrierLuminosity(state, id, luminosity), lightColor, partyId, awakeAtHome: Boolean(state.ordinaryDay && !state.ordinaryDay.bedtime), sprite: WORLD_ACTOR_SPRITES[id] }))}
                actorOrigins={state.worldActors.map(({ id, label, location, biomeId, position, traversalAffinity, partyId, heading }) => ({ id, label, location, biomeId, position, traversalAffinity, partyId, heading }))}
                resourceStacks={state.worldResourceStacks}
                questCards={state.questTableCards}
                questTitles={questSteps.map(step => step.label)}
                questRewardLabels={questSteps.map(() => 'Energy')}
                questTexts={questInstructions}
                questClaims={state.questClaims}
                onMoveQuest={(index, position, tilt) => setState(previous => ({ ...previous, questTableCards: previous.questTableCards.map(card => card.questIndex === index ? { ...card, position, tilt, tableState: true, flightFrom: undefined } : card) }))}
                tilted={cameraTilted}
                focusBiomeId={!state.journey && cameraTilted && fieldActors.length ? state.selectedBiomeId : null}
                onTiltedChange={setCameraTilted}
                onRedeemQuest={(index) => { logHold(index === state.questClaims ? `redeem quest ${index}` : `redeem ignored: card ${index}, next claim is ${state.questClaims}`); if (index === state.questClaims) redeemQuest(); }}
                lightSources={editorOpen && tableLightsEnabled ? [...tableLights.filter(light => !light.id.startsWith('biome-light-')), ...biomeLights(previewTiles)] : tableLights}
                timeOfDay={tableHours}
                showLightReadout={lightReadoutVisible}
                onEnterTile={(actorId, tileId) => { if (actorId === 'hero' && !editorOpen) fireCameraTrigger('tile-enter', tileId); }}
                onActorExplore={(actorId, from, to) => setState(prev => {
                  if (!prev.worldActors.some(actor => actor.id === actorId)) return prev;
                  const biomeTiles = discoverTiles(prev.biomeTiles, from, to);
                  const next = biomeTiles === prev.biomeTiles ? prev : { ...prev, biomeTiles };
                  // Only occupying a path opens its deal. Seeing a neighbour
                  // must not switch tableaus, start combat or staff a foundation.
                  const cell = TABLE_GRID.atWorld(to);
                  const occupied = biomeTiles.find(tile => (tile.road || tile.tileType === 'path') &&
                    TABLE_GRID.atWorld(tile.position).column === cell.column && TABLE_GRID.atWorld(tile.position).row === cell.row);
                  return occupied && !prev.journey && prev.scene === 'exploration' ? activateBiome(next, occupied.id) : next;
                })}
                onSelectBiome={selectBiome}
                journey={state.journey}
                travelAllowed={plan => !foundQuest && dayOneAllowsPlan(state, plan)}
                travelStamina={state.travelStamina ?? TRAVEL_STAMINA_MAX}
                travelStaminaMax={state.scenarioStaminaMax ?? TRAVEL_STAMINA_MAX}
                initialCenter={state.dayScenario ? {x:0,y:96}:undefined}
                onConfirmTravel={plan => {
                  if (state.dayScenario) { startScenarioTravel(plan); return; }
                  clearPendingInteractions(); setUndoStack([]);
                  setState(prev => prepareTravelTableau({ ...prev, journey: { ...beginJourney(plan,travelStartingRank(prev,plan.actorId)), memberRanks: Object.fromEntries(partyMembers(prev, plan.actorId).map((member, i) => [member.id, prev.journey?.memberRanks?.[member.id] ?? travelStartingRank(prev,member.id,2+i*3)])), spent: prev.journey?.spent ?? 0, berries: prev.journey?.berries ?? 0, priorCompleted: (prev.journey?.priorCompleted ?? 0) + (prev.journey?.completed ?? 0), completedCardIds: prev.journey?.completedCardIds ?? [] },
                    biomeTiles: prev.biomeTiles.map(tile => ({ ...tile, ...(tile.id === prev.selectedBiomeId ? { tableau: prev.tableau, stock: prev.stock } : {}), ...(plan.segments.some(segment => segment.tileId === tile.id && segment.unknown) ? { traversalProgress: tile.traversalProgress ?? 0 } : {}) })),
                    selectedBiomeId: null, tableau: [], stock: [], foundations: [],
                    worldActors: prev.worldActors.map(actor => partyMembers(prev, plan.actorId).some(member => member.id === actor.id) ? { ...actor, location: 'table', heading: undefined, position: plan.path[0], biomeId: undefined, foundationIndex: undefined, hutId: undefined } : actor) }));
                }}
                onTravelPaint={progress => setState(prev => paintTravelProgress(prev, progress))}
                onTravelCheckpoint={progress => {
                  const previous=stateRef.current;
                  const next=checkTravelCairn(previous,progress);
                  if(next!==previous){stateRef.current=next;setState(next);}
                  return !next.journey?.blocked;
                }}
                onFinishTravel={() => setState(finishTravelPresentation)}
                onDropActorToTable={dropActorToTable}
                onMoveResourceStack={moveResourceStack}
                onSplitResourceStack={splitResourceStack}
                onPlayBuildCard={playHutCard}
                onSolveBuildStep={solveHutStep}
                onStartSolver={startSolver}
                onInspectActor={inspectActor}
                onInspectTile={inspectTile}
                actorInspiration={state.actorInspiration[0]}
              />}
            </div>
          </section>
        </div>
        <aside aria-label="Scenario controls" className="proto-day-panel" data-day-scenario={state.dayScenario ?? 'sandbox'}>
          <button type="button" className="proto-day-panel__toggle" aria-expanded={scenarioExpanded} aria-controls="scenario-data" onClick={() => setScenarioExpanded(value => !value)}>Scenario {scenarioExpanded ? '−' : '+'}</button>
          <div id="scenario-data" hidden={!scenarioExpanded}>
          <div className="proto-day-panel__toolbar"><label>Scenario <select aria-label="Day scenario" value={state.dayScenario ?? 'sandbox'} onChange={event => switchDayScenario(event.target.value)}><option value="day01">Day 01 · Before dark</option><option value="day02">Day 02 · The darker woods</option><option value="day03">Day 03 · Home with Banks</option><option value="sandbox">Sandbox · Authored map</option></select></label><div className="proto-day-panel__review-actions"><GlobalPauseControl />{state.dayScenario && <DayCinematicReview state={state} beats={dayCinema.beats} current={dayCinema.beat?.id} enabled={dayCinema.enabled} />}<button type="button" onClick={() => switchDayScenario(state.dayScenario ?? 'sandbox')}>Restart scenario</button></div></div>
          {state.dayScenario && <>
            <p className="proto-day-panel__thought" role="status">{dayOneThought(state)}</p>
            <div className="proto-day-panel__actions"><span>Mana {state.haul.mana} · STA {(state.travelStamina ?? 0).toFixed(1)} · {String(Math.floor(tableHours)).padStart(2,'0')}:{String(Math.round(tableHours%1*60)).padStart(2,'0')}</span>
              {dayTravelAction(state) && <button type="button" disabled={Boolean(cardTransport || state.journey)} onClick={() => startScenarioTravel(dayOnePlan(state))}>{dayTravelAction(state)}</button>}
              {state.dayScenario==='day01' && !state.journey && state.selectedBiomeId===state.dayScenarioTiles?.patchId && !dayOneReturning(state) && <span>Gather two more: supper tonight, and keep the first berry for light.</span>}
              {state.dayScenario==='day02' && !state.journey && state.selectedBiomeId===state.dayScenarioTiles?.patchId && !dayTwoPatchForaged(state) && <span>Search the last few branches.</span>}
              {state.dayScenario==='day02' && !state.journey && state.selectedBiomeId===state.dayScenarioTiles?.woodsId && <span>Uncover the mana in the woods.</span>}
              {state.dayScenario==='day01' && state.ordinaryDay?.complete && <button type="button" onClick={()=>switchDayScenario('day02',state.haul.mana)}>Begin Day 02</button>}
              {!state.ordinaryDay?.supper && isHome(state) && dayOneReturning(state) && <button type="button" disabled={!!foundQuest || Boolean(cardTransport || state.journey)} onClick={() => {clearPendingInteractions();setUndoStack([]);setState(eatSupper);}}>Eat supper · 2 mana</button>}
              {state.dayScenario==='day01' && state.ordinaryDay?.supper && !state.ordinaryDay.bedtime && <button type="button" disabled={!!foundQuest || Boolean(cardTransport)} onClick={() => {clearPendingInteractions();setUndoStack([]);setState(prev => arriveActorAtBiome({...prev,ordinaryDay:{...prev.ordinaryDay!,bedtime:true}},'hero','hero-den',{x:0,y:96}));}}>Curl up · Zzz</button>}
              {state.ordinaryDay?.bedtime && !state.ordinaryDay.complete && <button type="button" disabled={Boolean(cardTransport)} onClick={finishResting}>Finish resting</button>}
            </div>
          </>}
          <SceneActorEmotion scenario={state.dayScenario ?? 'sandbox'} relieved={Boolean(state.ordinaryDay?.supper || state.ordinaryDay?.bedtime || state.ordinaryDay?.complete)} />
          <ScenarioCameraDetails />
          </div>
        </aside>
      </div>
      {inspectionAnchor && inspectedTileId && state.biomeTiles.some(t=>t.id===inspectedTileId) ? <DetailsCardViewer key={inspectionId} anchor={inspectionAnchor} timeOfDay={tableHours} lights={tableLights} position={state.biomeTiles.find(t=>t.id===inspectedTileId)!.position} objects={[tileDetailsCard(state.biomeTiles.find(t=>t.id===inspectedTileId)!,state.day,()=>{closeInspection();selectBiome(inspectedTileId);})]} onClose={closeInspection} onCloseObject={closeInspection}/>:null}
      {inspectionAnchor && inspectedActorId ? <DetailsCardViewer
        key={inspectionId}
        initialJumboId={inspectionJumboId}
        anchor={inspectionAnchor}
        timeOfDay={tableHours}
        lights={tableLights}
        position={state.worldActors.find(actor => actor.id === inspectedActorId)?.position ?? { x: 0, y: 0 }}
        objects={[
        ...(inspectedActorId && state.worldActors.some(actor => actor.id === inspectedActorId) ? [{
          id: inspectedActorId,
          travelActorId: inspectedActorId,
          name: state.worldActors.find((actor) => actor.id === inspectedActorId)!.label,
          badge: '♟',
          badgeLabel: 'Actor',
          art: <ActorCardArt sprite={inspectedActorId === 'hero' ? ACTOR_HOLO_ART.hero : WORLD_ACTOR_SPRITES[inspectedActorId]} label={state.worldActors.find((actor) => actor.id === inspectedActorId)!.label} />,
          jumboEditor: <ActorPlaytestEditor key={inspectedActorId} actorId={inspectedActorId} state={state} onApply={values => setState(prev => ({ ...prev,
            actorDescriptions: { ...prev.actorDescriptions, [inspectedActorId]: values.description },
            heroHp: prev.heroHp.map((hp, index) => index === 0 ? values.hp : hp),
            heroMaxHp: FOUNDATION_MOCKUPS.map((actor, index) => index === 0 ? values.maxHp : prev.heroMaxHp?.[index] ?? actor.maxHp),
            actorInspiration: prev.actorInspiration.map((value, index) => index === 0 ? values.work : value),
            actorMaxInspiration: prev.actorInspiration.map((_, index) => index === 0 ? values.maxWork : prev.actorMaxInspiration?.[index] ?? ACTOR_INSPIRATION_MAX),
            inspiration: values.inspiration, maxInspiration: values.maxInspiration, energy: values.energy, energyMax: values.maxEnergy,
          }))} />,
          descriptorPreview: 'Expedition hero',
          descriptor: state.actorDescriptions?.[inspectedActorId] ?? DEFAULT_ACTOR_DESCRIPTION,
          trays: [
            { id: 'stats', label: 'Stats', chips: [
              { id: 'hp', icon: '♥', value: `${state.heroHp[0] ?? FOUNDATION_MOCKUPS[0].hp}/${state.heroMaxHp?.[0] ?? FOUNDATION_MOCKUPS[0].maxHp}`,
                label: `Health: ${state.heroHp[0] ?? FOUNDATION_MOCKUPS[0].hp} of ${state.heroMaxHp?.[0] ?? FOUNDATION_MOCKUPS[0].maxHp}` },
              { id: 'inspiration', icon: '💫', value: `${state.actorInspiration[0] ?? ACTOR_INSPIRATION_MAX}/${state.actorMaxInspiration?.[0] ?? ACTOR_INSPIRATION_MAX}`,
                label: `Inspiration: ${state.actorInspiration[0] ?? ACTOR_INSPIRATION_MAX} of ${state.actorMaxInspiration?.[0] ?? ACTOR_INSPIRATION_MAX}` },
            ] },
            { id: 'equipment', label: 'Equipment', details: 'Not yet configured' },
            { id: 'buffs', label: 'Effects', content: state.heroBuffs[0]?.length || '—', details: state.heroBuffs[0]?.length
              ? state.heroBuffs[0].map(buff => `${buff.id.replace(/_/g, ' ')} (${buff.value}, ${buff.turnsRemaining} turns)`).join(' · ')
              : 'No active buffs or debuffs' },
          ],
        } satisfies DetailsCardObject] : []),
        ]}
        onClose={closeInspection}
        onCloseObject={id => { if (id === inspectedActorId) setInspectedActorId(null); }}
      /> : null}
      <AbilityDetailPopup detail={abilityDetail} onClose={() => setAbilityDetail(null)} />
      {cardTransport ? (
        <ProtoCardFlight
          background={cardTransport.background}
          card={
            state.tableau[cardTransport.sourceColumnIndex]?.find((card) => card.id === cardTransport.cardId)
              ?? { id: cardTransport.cardId, rank: 1 }
          }
          positionRef={cardTransportPositionRef}
          size={cardTransport.size}
        />
      ) : null}
    </div></CalloutEditingProvider>
  );
};
