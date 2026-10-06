import { flyQuestToDiscard } from './questDiscardFlight';
import { TableauCardArea } from './components/TableauCardArea';
import { solverFlightDuration } from './solverTiming';
import { QuestField } from './components/QuestField';
import { TrayRestoreHandle } from './components/TrayRestoreHandle';
import { SettlementSupplyTray } from './components/SettlementSupplyTray';
import { TUTORIAL_QUEST_INDEX, type PlacedQuestCard } from './components/TableQuestCard';
import { DetailsCardViewer, ActorCardArt } from './components/DetailsCardViewer';
import { redeemActiveQuest } from './questProgress';
import { logHold } from './holdLog';
import { blockedSolids } from './worldBounds';
import { DEFAULT_ACTOR_LUMINOSITY, getTableLighting, tableObjectShadow } from './protoLighting';
import { TimeOfDaySlider } from './components/TimeOfDaySlider';
import { PondField } from './components/PondField';
import { GLOWFISH_TABLE_LIGHT, POND_CATCHES, POND_MISS_STAMINA, POND_SPECIES, isPondCatch, type PondCatch, castBait, eatPondCatch, endGlowfishGlow, landHooked, loseHooked, restockPond } from './rules/fishing';
import { NEUTRAL_STANDEE_LIGHTING, SpriteStandeeArt } from './components/SpriteStandee';
import { PROTO_BUILD_COMMIT, PROTO_BUILD_LABEL, PROTO_BUILD_TITLE } from './buildInfo';
import { assessSolverMove, preserveSolverRpgValues, type SolverMove } from './tableauSolver';
import { TableauSolveControls, type SolveStepResult } from './components/TableauSolveControls';
import { nextQuestCard, isQuestPlacement } from './protoQuestDeals';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { advanceBuild, splitStack, playBuildCard, stackIngredients, ingredientCount, startStackBuild, WORLD_ITEMS, CRAFT_RECIPES, type WorldItemId } from './protoCrafting';
import { DragPreview } from '../components/DragPreview';
import type { Card as EngineCard } from '../engine/types';
import {
  DEFAULT_CHIP_ABILITY,
  DEFAULT_BIOME,
  DEFAULT_EXPEDITION_ENERGY,
  MAGE_PHASE_SHIFT_TRIGGER,
  WORLD_ACTOR_SPRITES,
  BIOME_TILE_SPRITES,
} from './protoData';
import {
  getCardTransportDurationMs,
  interpolateCardTransport,
  type CardTransportPoint,
} from './protoTransport';
import { Tableau } from '../golf/components/Tableau';
import {
  ProtoMap,
  getBiomeExitPoint,
  type ProtoBiomeTile,
  type ProtoWorldActor,
  type ProtoWorldResourceStack,
} from './components/ProtoMap';
import { ProtoCard, EmptySlot } from './components/ProtoCard';
import { ActorFoundationPanel, EnemyTeamPanel } from './components/FoundationBoards';
import { AbilityDetailPopup } from './components/AbilityDetailPopup';
import { AutoPlayControl } from './components/AutoPlayControl';
import {
  ACTOR_STAMINA_MAX, AUTO_PLAY_SPEED_OPTIONS, DEV_ACTOR_DEFEAT_OVERRIDE, FOUNDATION_MOCKUPS, FOUNDATION_SLOTS,
  rankLabel, targetToneForAbility,
  type AbilityDetail, type Card, type CardTransport,
  type ForestResource, type HaulResource, type HeroBuff, type PendingAbilityTarget, type PendingMobility,
  type PendingTargetSelection, type ProtoState, type TargetAnnouncement,
} from './protoState';
import { ACTOR_WORK_RESOURCES, DAY_TWO_RATION_ENERGY, DAY_TWO_RATION_STAMINA, ENCOUNTER_GLYPH, ENEMY_TEAM_MOCKUPS, FOREST_RESOURCE_GLYPHS, FOREST_RESOURCE_LABELS, FOREST_RESOURCE_ORDER, MOBILITY_COOLDOWN_TURNS, SMALL_WOODS_TRAVEL_COST, TABLEAU_COLUMNS, TABLEAU_ROWS, addForestHaul, canAffordExplorationAction, canPlayOnFoundation, cloneState, createAmbushCombatDeal, isPondTile, createFoundations, createInitialState, createQuestExplorationFoundations, drawTableauReplacement, getExpeditionQuestSteps, isAdjacentRank, isBiomeDealComplete, isOpenExplorationFoundation, materializeDeepWoods, spendExplorationEnergy } from './rules/setup';
import { adjacentFoundationIndexes, applyFoundationPlay, hasNormalPlayerTableauMove } from './rules/play';
import { AMBUSH_PLAYER_CARD_BUDGET, ENEMY_TURN_MAX_MOVES, actorIndexForId, applyEnemyTableauMove, getTauntTargetIndex, hasBlinkStrain, resolveEnemyIntents, selectEnemyTableauMove } from './rules/combat';

/** Hour the table opens at, on the first day and every day after. */
const TABLE_OPENING_HOUR = 9;


/** Details-card text for a supply: its category and the recipes that consume it. */
const supplyDetails = (id: WorldItemId) => {
  const item = WORLD_ITEMS[id];
  const lowQualityFood = item.food && item.quality === 0;
  return {
    kind: item.kind === 'resource' ? `Gathered resource${item.food ? ' · food' : ''}` : item.kind,
    uses: CRAFT_RECIPES.flatMap(recipe => recipe.inputs?.[id] ? [`${recipe.label}: ${recipe.inputs[id]} needed`]
      : recipe.lowQualityFood && lowQualityFood ? [`${recipe.label}: counts toward ${recipe.lowQualityFood} food`] : []),
  };
};

/** Desktop columns, left to right: supplies, tableau, table, quests. Stowed trays
 * and the hidden tableau drop out so no empty track keeps its gap. */
const desktopLayoutTracks = (tableau: boolean, supplies: boolean, quests: boolean) => {
  const tracks = [
    supplies && ['supply', 'var(--supply-tray-width)'],
    tableau && ['tableau', 'minmax(0, 1fr)'],
    ['map', 'minmax(0, 1.7fr)'],
    quests && ['quest', 'var(--quest-tray-width)'],
  ].filter((track): track is string[] => Boolean(track));
  return {
    '--layout-columns': tracks.map(([, size]) => size).join(' '),
    '--layout-areas': `"${tracks.map(() => 'header').join(' ')}" "${tracks.map(([area]) => area).join(' ')}"`,
  } as CSSProperties;
};

const asDragPreviewCard = (card: Card): EngineCard => ({
  id: card.id,
  rank: card.rank,
  element: 'N',
  suit: '☀️',
});

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
const FOUNDATION_POPUP_SIZE = 64;

export const ProtoVariant = () => {
  const [state, setState] = useState<ProtoState>(() =>
    createInitialState(),
  );
  const [pendingTargetSelection, setPendingTargetSelection] =
    useState<PendingTargetSelection | null>(null);
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
  const [questOpen, setQuestOpen] = useState(true);
  const [supplyOpen, setSupplyOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<'map' | 'tableau' | 'quests' | 'supplies'>('map');
  useEffect(() => { if (state.selectedBiomeId) setMobilePanel('tableau'); }, [state.selectedBiomeId]);
  const [inspectedActorId, setInspectedActorId] = useState<string | null>(null);
  const [inspectionAnchor, setInspectionAnchor] = useState<HTMLElement | null>(null);
  const inspectActor = (id: string, anchor: HTMLElement) => { setInspectionAnchor(anchor); setInspectedActorId(id); };
  // The table opens in the morning.
  const [tableHours, setTableHours] = useState(TABLE_OPENING_HOUR);
  // Battle-camera tilt for the table and the tableau field, toggled from the map.
  const [cameraTilted, setCameraTilted] = useState(false);
  const [cycleLighting, setCycleLighting] = useState(false);
  const [tableLightsEnabled, setTableLightsEnabled] = useState(true);
  // Guidance highlights every playable tableau card; off by default.
  const [moveGuidance, setMoveGuidance] = useState(false);
  const [lightReadoutVisible, setLightReadoutVisible] = useState(false);
  const lighting = getTableLighting(tableHours);
  // Each later day starts in the morning too.
  const startedDay = useRef(state.day);
  useEffect(() => { if (state.day !== startedDay.current) { startedDay.current = state.day; setTableHours(TABLE_OPENING_HOUR); } }, [state.day]);
  useEffect(() => {
    if (!cycleLighting) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - previous) / 1000;
      previous = now;
      setTableHours((hours) => (hours + elapsed * 0.2) % 24);
    // Each tick re-renders the whole table; light drifts slowly, so once a second
    // is smooth enough and keeps phones free to answer input.
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cycleLighting]);
  const tableLights = tableLightsEnabled ? [
    ...(state.city.campBuilt ? [{ id: 'camp-lamp', position: { x: 0, y: 96 }, radius: 5.5, height: 120, color: '#ff8a3d', flicker: 1 }] : []),
    ...state.worldResourceStacks.filter((stack) => stack.resource === 'provisions_hut' && !stack.build)
      .map((stack) => ({ id: 'hut-lamp-' + stack.id, position: { x: stack.position.x + 36, y: stack.position.y - 36 }, radius: 4, height: 85, color: '#ffd08a', flicker: 0.3 })),
    ...state.worldResourceStacks.filter((stack) => !stack.build && (stack.resource === 'glowfish' || (stack.ingredients?.glowfish ?? 0) > 0))
      .map((stack) => ({ id: 'glowfish-' + stack.id, position: stack.position, ...GLOWFISH_TABLE_LIGHT })),
  ] : [];
  const stateRef = useRef(state);
  const tableauCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const foundationTransportRefs = useRef<Array<HTMLDivElement | null>>([]);
  const foundationActorPointerRef = useRef<{ actorId: string; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const enemyTransportRefs = useRef<Array<HTMLDivElement | null>>([]);
  const enemyMovesMadeRef = useRef(0);
  const cardTransportPositionRef = useRef<CardTransportPoint>({ x: 0, y: 0 });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!targetAnnouncement) return undefined;
    const timeoutId = window.setTimeout(() => {
      setTargetAnnouncement(null);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [targetAnnouncement]);

  useEffect(() => {
    if (burningEnemyIds.length === 0) return undefined;
    const timeoutId = window.setTimeout(() => {
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
    return () => window.clearTimeout(timeoutId);
  }, [burningEnemyIds]);

  const clearPendingInteractions = () => {
    setPendingTargetSelection(null);
    setPendingWildCardTarget(false);
    setPendingMobility(null);
    setPendingAbilityTarget(null);
    setAbilityDetail(null);
    setSelectedAdvisorAbilities({});
  };

const selectBiome = (biomeId: string) => {
    if (state.scene !== 'exploration' || biomeId === state.selectedBiomeId) return;
    const target = state.biomeTiles.find((tile) => tile.id === biomeId);
    if (!target || !target.unlocked) return;
    clearPendingInteractions();
    setState((prev) => ({
      ...prev,
      selectedBiomeId: biomeId,
      biome: { ...prev.biome, seed: target.seed, cacheClaimed: target.tableau.length === 0 && target.stock.length === 0 },
      foundations: createQuestExplorationFoundations(prev.party, target.gridSize.columns * target.gridSize.rows, target.tableau),
      tableau: target.tableau.map((column) => column.map((card) => ({ ...card }))),
      stock: target.stock.map((card) => ({ ...card })),
    }));
  };

  const dropActorToTable = (
    actorId: string,
    destination?: { x: number; y: number },
    arrival: { biomeId?: string; directBiome?: boolean; foundationIndex?: number } = {},
  ) => {
    const actor = state.worldActors.find((entry) => entry.id === actorId);
    if (!actor) return;
    const hut = destination && state.worldResourceStacks.find((stack) =>
      (stack.resource === 'provisions_hut' && !stack.build || stack.build && CRAFT_RECIPES.find((recipe) => recipe.id === stack.build?.recipeId)?.output === 'provisions_hut') &&
      Math.hypot(stack.position.x - destination.x, stack.position.y - destination.y) < 52);
    if (hut && actor.location === 'table') {
      setState((prev) => ({ ...prev, worldActors: prev.worldActors.map((entry) => entry.id === actorId ? { ...entry, location: 'table' as const, hutId: hut.id, foundationIndex: undefined, position: hut.position } : entry) }));
      return;
    }
    if (actor.location === 'table') {
      if (!destination) return;
      setState((prev) => {
        const targetBiome = arrival.biomeId
          ? prev.biomeTiles.find((tile) => tile.id === arrival.biomeId)
          : null;
        if (arrival.biomeId && (!targetBiome || !targetBiome.unlocked || prev.stamina < targetBiome.travelCost)) {
          return prev;
        }
        const switchedBiome = Boolean(arrival.biomeId && arrival.biomeId !== prev.selectedBiomeId);
        const requestedFoundationIndex = arrival.foundationIndex;
        const autoFoundationIndex = arrival.biomeId
          ? prev.foundations.findIndex((foundation, index) =>
              foundation?.count === 0 &&
              foundation.cards.length === 0 &&
              !prev.worldActors.some((worldActor) => worldActor.location === 'foundation' && worldActor.foundationIndex === index),
            )
          : -1;
        const foundationIndex = requestedFoundationIndex ?? (autoFoundationIndex >= 0 ? autoFoundationIndex : undefined);
        const canAutoSlot = foundationIndex !== undefined &&
          Number.isInteger(foundationIndex) &&
          foundationIndex >= 0 &&
          foundationIndex < prev.foundations.length &&
          prev.foundations[foundationIndex]?.count === 0 &&
          prev.foundations[foundationIndex]?.cards.length === 0 &&
          !prev.worldActors.some((worldActor) => worldActor.location === 'foundation' && worldActor.foundationIndex === foundationIndex);
        return {
          ...prev,
          selectedBiomeId: arrival.biomeId ?? prev.selectedBiomeId,
          biome: targetBiome && switchedBiome
            ? {
                ...prev.biome,
                seed: targetBiome.seed,
                cacheClaimed: targetBiome.tableau.length === 0 && targetBiome.stock.length === 0,
              }
            : prev.biome,
          foundations: targetBiome && switchedBiome
            ? createQuestExplorationFoundations(prev.party, targetBiome.gridSize.columns * targetBiome.gridSize.rows, targetBiome.tableau)
            : prev.foundations,
          tableau: targetBiome && switchedBiome
            ? targetBiome.tableau.map((column) => column.map((card) => ({ ...card })))
            : prev.tableau,
          stock: targetBiome && switchedBiome
            ? targetBiome.stock.map((card) => ({ ...card }))
            : prev.stock,
          worldActors: prev.worldActors.map((entry) => {
            if (entry.id !== actorId) return entry;
            return canAutoSlot
              ? { ...entry, location: 'foundation' as const, hutId: undefined, foundationIndex, biomeId: arrival.biomeId ?? entry.biomeId }
              : { ...entry, position: destination, biomeId: arrival.biomeId, hutId: undefined };
          }),
          stamina: arrival.biomeId
            ? Math.max(0, prev.stamina - (targetBiome?.travelCost ?? 0))
            : prev.stamina,
        };
      });
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
      stamina: Math.max(0, prev.stamina - (biome.travelCost ?? SMALL_WOODS_TRAVEL_COST)),
      foundations: prev.foundations.map((slot, index) =>
        index === foundationIndex && slot ? { ...slot, count: 0, cards: [], wildcardBridgeFromRank: undefined } : slot,
      ),
      worldActors: prev.worldActors.map((entry) =>
        entry.id === actorId
          ? { ...entry, location: 'table' as const, foundationIndex: undefined, biomeId: arrival.biomeId, position: arrivalPosition, hutId: hut?.id }
          : entry,
      ),
      settledHaul: { ...prev.haul },
    }));
  };

  const settledHaul = state.settledHaul;
  // Pond catches join the tray once there are some, so the glowfish stays a surprise.
  const supplyItems = useMemo(() => (Object.keys(settledHaul) as HaulResource[])
    .filter(id => FOREST_RESOURCE_ORDER.includes(id as ForestResource) || settledHaul[id] > 0)
    .map(id => ({ id, label: WORLD_ITEMS[id].label, glyph: WORLD_ITEMS[id].glyph, count: settledHaul[id], ...supplyDetails(id) })), [settledHaul]);

  const drawSettlementSupply = (resource: HaulResource, count: number) => {
    const id = crypto.randomUUID();
    setState(prev => {
      if (count <= 0 || prev.settledHaul[resource] < count) return prev;
      return { ...prev,
        settledHaul: { ...prev.settledHaul, [resource]: prev.settledHaul[resource] - count },
        haul: { ...prev.haul, [resource]: prev.haul[resource] - count },
        worldResourceStacks: [...prev.worldResourceStacks, { id, resource, count, biomeId: 'table', position: { x: 48 + Math.random() * 96, y: 48 } }],
      };
    });
  };

  const moveResourceStack = (stackId: string, position: { x: number; y: number }, targetId?: string, actorId?: string) => {
    const leftoverId = crypto.randomUUID();
    const eaten = actorId ? state.worldResourceStacks.find((stack) => stack.id === stackId && !stack.build && Object.keys(stackIngredients(stack)).length === 1) : undefined;
    if (eaten?.resource === 'glowfish') setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'GLOWING', impact: '+2 max STA and a brighter light until nightfall' });
    else if (eaten?.resource === 'kingfish') setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'FEAST', impact: 'Stamina fully restored' });
    else if (eaten && isPondCatch(eaten.resource)) setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: WORLD_ITEMS[eaten.resource].label.toUpperCase(), impact: `+${POND_SPECIES.find((species) => species.id === eaten.resource)?.stamina} STA` });
    setState((prev) => {
      const source = prev.worldResourceStacks.find((stack) => stack.id === stackId);
      if (!source || source.build || WORLD_ITEMS[source.resource].kind === 'structure') return prev;
      if (actorId && isPondCatch(source.resource) && Object.keys(stackIngredients(source)).length === 1) {
        const fed = eatPondCatch(prev, source.resource, actorId, ACTOR_STAMINA_MAX);
        return { ...fed, worldResourceStacks: prev.worldResourceStacks.map((stack) => stack.id === source.id ? { ...stack, count: stack.count - 1, ingredients: undefined } : stack).filter((stack) => stack.count > 0) };
      }
      if (actorId && (source.resource === 'trail_ration' || source.resource === 'hearty_ration') && Object.keys(stackIngredients(source)).length === 1) {
        const bonus = source.resource === 'hearty_ration' ? DAY_TWO_RATION_ENERGY * 2 : DAY_TWO_RATION_ENERGY;
        return { ...prev, stamina: Math.min(prev.maxStamina + bonus, prev.stamina + bonus),
          actorStamina: prev.actorStamina.map((value, index) => index === 0 ? Math.min(ACTOR_STAMINA_MAX, value + bonus) : value),
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

  const pondSelected = isPondTile(state.selectedBiomeId);
  const pondAngler = state.worldActors.find((actor) => actor.location === 'foundation' && isPondTile(actor.biomeId)) ?? null;
  // Casting needs stamina, since a miss costs some.
  const canCastPond = Boolean(pondAngler) && state.scene === 'exploration' && state.stamina >= POND_MISS_STAMINA;
  const castPondBait = (baitId: string) => {
    if (!canCastPond) return;
    setState((prev) => {
      const { pond, hooked } = castBait(prev.pond, baitId);
      if (pond === prev.pond) return prev;
      return { ...prev, pond, stamina: hooked ? prev.stamina : Math.max(0, prev.stamina - POND_MISS_STAMINA) };
    });
  };
  // The fight's outcome: a landed fish joins the haul at once, as its kind.
  const endPondFight = (landed: boolean) => {
    const preview = landed ? landHooked(state.pond) : null;
    if (preview?.bonus === 'glowfish') setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'GLOWFISH', impact: 'Lucky! It glows. Eat it for light' });
    else if (preview?.caught === 'kingfish') setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'KINGFISH', impact: 'A feast. Eat it to restore all stamina' });
    setState((prev) => {
      if (!prev.pond.hooked) return prev;
      if (!landed) return { ...prev, pond: loseHooked(prev.pond) };
      const { pond, caught: kind, bonus } = landHooked(prev.pond);
      return kind ? { ...prev, pond, haul: addForestHaul(prev.haul, { [kind]: 1, ...(bonus ? { [bonus]: 1 } : {}) }) } : { ...prev, pond };
    });
  };

  const splitResourceStack = (stackId: string) => {
    const id = crypto.randomUUID();
    setState((prev) => ({ ...prev, worldResourceStacks: prev.worldResourceStacks.flatMap((stack) => stack.id === stackId ? splitStack(stack, id) : [stack]) }));
  };

  const playHutCard = (stackId: string, rank: number, divine = false) => {
    setState((prev) => {
      const stack = prev.worldResourceStacks.find((entry) => entry.id === stackId);
      if (!stack?.build?.stationId || (!divine && (prev.scene !== 'exploration' || prev.actorStamina[0] <= 0 || !prev.worldActors.some((actor) => actor.hutId === stack.build?.stationId)))) return prev;
      let played = playBuildCard(stack, rank);
      if (played === stack) return prev;
      if (divine && played.build) {
        const recipe = CRAFT_RECIPES.find((entry) => entry.id === played.build?.recipeId)!;
        if (played.build.work >= recipe.workRequired) played = advanceBuild({ ...played, build: { ...played.build, elapsedMs: recipe.durationMs } }, 0, true);
      }
      return { ...prev, actorStamina: divine ? prev.actorStamina : prev.actorStamina.map((value, index) => index === 0 ? value - 1 : value),
        worldResourceStacks: prev.worldResourceStacks.map((entry) => entry.id === stack.id ? played : entry) };
    });
  };

  useEffect(() => {
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsedMs = now - lastTick;
      lastTick = now;
      setState((prev) => {
        if (prev.scene !== 'exploration' || !prev.worldResourceStacks.some((stack) => stack.build)) return prev;
        const stacks = prev.worldResourceStacks.map((stack) => advanceBuild(stack, elapsedMs, Boolean(prev.worldActors.some((actor) => actor.hutId === stack.build?.stationId))));
        const rations = stacks.filter((stack, index) => prev.worldResourceStacks[index].build && !stack.build && stack.resource === 'trail_ration').length;
        return { ...prev, worldResourceStacks: stacks, trailRations: prev.trailRations + rations };
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

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
        actorStamina: Array.from({ length: FOUNDATION_SLOTS }, () => ACTOR_STAMINA_MAX),
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
    setUndoStack((prev) => prev.slice(1));
    clearPendingInteractions();
    setBurningEnemyIds([]);
    setTargetAnnouncement(null);
  };

  const buildCamp = () => {
    if (state.scene !== 'exploration' || state.city.campBuilt || state.settledHaul.wood < 3 || state.settledHaul.berries < 1) return;
    pushUndo();
    setState((prev) => ({
      ...prev,
      haul: { ...prev.haul, wood: prev.haul.wood - 3, berries: prev.haul.berries - 1 },
      settledHaul: { ...prev.settledHaul, wood: Math.max(0, prev.settledHaul.wood - 3), berries: Math.max(0, prev.settledHaul.berries - 1) },
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
      stamina: prev.maxStamina,
      heroHp: prev.heroHp.map((hp, index) => index === 0 ? Math.min(FOUNDATION_MOCKUPS[0]?.maxHp ?? hp, hp + 3) : hp),
      city: { ...prev.city, campUsedToday: true, restedOnce: true },
      battleRecovered: prev.deepEncounterResolved ? true : prev.battleRecovered,
    }));
    setTargetAnnouncement({ targetKind: 'hero', targetIndex: 0, abilityName: 'REST', impact: 'Stamina restored / +3 HP' });
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
              position: { x: 96, y: 48 },
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
    setQuestOpen(true);
    setState(createInitialState());
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
    if (!canAffordExplorationAction(sourceState)) return null;
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
          missing: Math.max(0, (FOUNDATION_MOCKUPS[index]?.maxHp ?? hp) - hp),
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
    options: { hallowedPath?: boolean; divine?: boolean } = {},
  ) => {
    const divine = Boolean(options.divine);
    const hallowedPath = Boolean(options.hallowedPath && foundationIndex === actorIndexForId('jarnathan'));
    const playOptions = {
      columnIndex,
      foundationIndex,
      divine,
      hallowedPath,
      hallowedEmergency: hallowedPath && pendingMobility?.emergency === true,
    };
    const base = stateRef.current;
    const result = applyFoundationPlay(base, playOptions);
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
    if (result.workCycleCompleted && !divine) {
      const actorLabel = FOUNDATION_MOCKUPS[foundationIndex]?.label ?? `Actor ${foundationIndex + 1}`;
      setTargetAnnouncement({
        targetKind: 'hero',
        targetIndex: foundationIndex,
        abilityName: 'TABLEAU COMPLETE',
        impact: `${actorLabel}: +3 ${ACTOR_WORK_RESOURCES[foundationIndex]?.toUpperCase() ?? 'WOOD'} +1 WILD`,
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
    const current = stateRef.current;
    if (!current.worldActors.some((actor) => actor.location === 'foundation' && actor.biomeId === current.selectedBiomeId)) return { status: 'blocked', message: 'Posture an actor in the foundation' };
    if (cardTransport || burningEnemyIds.length) return { status: 'waiting', message: 'Waiting for current action' };
    if (!divine && currentTurn !== 'player') return { status: 'waiting', message: 'Waiting for player turn' };
    if (!current.tableau.some((column) => column.length)) return { status: 'complete', message: 'Tableau cleared' };
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
    if (!divine && !canAffordExplorationAction(current)) return { status: 'blocked', message: 'Not enough energy' };
    if (!divine && current.worldActors.some((actor) => actor.hutId)) return { status: 'blocked', message: 'Actor is working at a hut' };
    const rootMoves: SolverMove[] = current.tableau.flatMap((column, columnIndex) => {
      const card = column[column.length - 1];
      if (!card) return [];
      const indexes = divine
        ? current.foundations.flatMap((foundation, index) => foundation && isQuestPlacement(current.tableau, card) && (isOpenExplorationFoundation(current.scene, index, foundation) || canPlayOnFoundation(card, foundation)) ? [index] : [])
        : adjacentFoundationIndexes(card, current);
      return indexes.map((foundation) => ({ column: columnIndex, foundation }));
    });
    const assessment = assessSolverMove({ columns: current.tableau, stock: current.stock,
      foundations: current.foundations.map((foundation) => foundation?.card.rank ?? null),
      openFoundations: current.foundations.map((foundation, index) => isOpenExplorationFoundation(current.scene, index, foundation)),
      moveBudget: divine || current.scene === 'combat' ? undefined : current.energy,
    }, { rootMoves });
    if (!assessment) return { status: 'blocked', message: 'No legal move; check actor posture or puzzle state' };
    queueCardTransport(assessment.move.column, { side: 'player', index: assessment.move.foundation }, { divine, solver: true });
    return { status: 'played', message: assessment.method + (assessment.samples ? ' · ' + assessment.samples + ' rollouts/move' : ' next move') };
  };

  const solveHutStep = (stackId: string, divine: boolean): SolveStepResult => {
    const current = stateRef.current;
    const stack = current.worldResourceStacks.find((entry) => entry.id === stackId);
    if (!stack?.build || stack.build.tableau.length === 0) return { status: 'complete', message: 'Solitaire cleared' };
    if (current.scene !== 'exploration' || !current.worldActors.some((actor) => actor.hutId === stack.build?.stationId)) return { status: 'blocked', message: 'Posture an actor at this foundation' };
    if (!divine && current.actorStamina[0] <= 0) return { status: 'blocked', message: 'Actor needs stamina' };
    const assessment = assessSolverMove({ columns: stack.build.tableau.map((rank) => [{ id: stackId + '-' + rank, rank }]), stock: [], foundations: [stack.build.foundation], moveBudget: divine ? undefined : current.actorStamina[0] });
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
      (options.divine || canAffordExplorationAction(current)) &&
      (options.divine || adjacentFoundationIndexes(card, current).includes(target.index) || Boolean(options.hallowedPath));
    const enemy = current.enemyTeam[target.index] ?? null;
    const validEnemyTarget =
      target.side === 'enemy' &&
      current.scene === 'combat' &&
      Boolean(enemy && enemy.hp > 0 && isAdjacentRank(card.rank, enemy.currentRank));
    if (!validPlayerTarget && !validEnemyTarget) return;

    const source = tableauCardRefs.current[card.id];
    const targetNode = target.side === 'player'
      ? foundationTransportRefs.current[target.index]
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
    const startedAt = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / cardTransport.durationMs);
      cardTransportPositionRef.current = interpolateCardTransport(cardTransport.from, cardTransport.to, progress);
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }
      landCardTransport(cardTransport);
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
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
    if (!canAffordExplorationAction(current)) return;
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
              ? Math.min(FOUNDATION_MOCKUPS[index]?.maxHp ?? hp, hp + pendingAbilityTarget.power)
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
    const maxHp = FOUNDATION_MOCKUPS[heroIndex]?.maxHp ?? 20;
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
    if (playerAutoPaused) return undefined;
    if (currentTurn !== 'player') return undefined;
    if (cardTransport) return undefined;
    const timeoutId = window.setTimeout(runPlayerAutoStep, AUTO_PLAY_SPEED_OPTIONS[playerAutoSpeedIndex]?.ms ?? 800);
    return () => window.clearTimeout(timeoutId);
  }, [
    abilityDetail,
    pendingAbilityTarget,
    pendingTargetSelection,
    pendingWildCardTarget,
    pendingMobility,
    playerAutoPaused,
    playerAutoSpeedIndex,
    currentTurn,
    enemyAutoPaused,
    cardTransport,
    state,
  ]);

  useEffect(() => {
    if (enemyAutoPaused) return undefined;
    if (currentTurn !== 'enemy') return undefined;
    if (cardTransport) return undefined;
    const timeoutId = window.setTimeout(runEnemyAutoStep, AUTO_PLAY_SPEED_OPTIONS[enemyAutoSpeedIndex]?.ms ?? 800);
    return () => window.clearTimeout(timeoutId);
  }, [currentTurn, enemyAutoPaused, enemyAutoSpeedIndex, cardTransport, state]);

  const questNextCard = state.scene === 'exploration' ? nextQuestCard(state.tableau) : undefined;
  const questSteps = getExpeditionQuestSteps(state);
  const smallWoodsComplete = questSteps[1].complete;
  const questInstructions = [
    'Drag Hero onto the Small Woods tile to begin the expedition.',
    'Play every card in the safe Small Woods tableau onto the foundation.',
    'Return Hero to the city with the resources collected in Small Woods.',
    'Use the collected wood and food to build your first Camp.',
    'Rest at your Camp to recover before the next expedition.',
    'End the first day after building Camp and resting.',
    'Eat the Day 2 ration to prepare for the Deep Woods journey.',
    'Move Hero into the newly revealed Deep Woods.',
    'Win the first wilderness battle in the Deep Woods.',
    'Return and recover after the wilderness battle.',
  ];
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
    const tile = state.biomeTiles.find(tile => tile.id === (index <= 1 ? 'woods-alpha' : index === 7 || index === 8 ? 'woods-beta' : ''));
    const location = tile?.position ?? { x: 0, y: 48 };
    const blocked = [
      ...blockedSolids().map(region => ({ x: region.x, y: region.y, w: region.width, h: region.height })),
      ...state.biomeTiles.map(tile => ({ x: tile.position.x, y: tile.position.y, w: tile.gridSize.columns * 48, h: tile.gridSize.rows * 48 })),
      ...state.worldActors.map(actor => ({ x: actor.position.x, y: actor.position.y, w: 64, h: 64 })),
      ...state.worldResourceStacks.map(stack => ({ x: stack.position.x, y: stack.position.y, w: 64, h: 64 })),
      ...state.questTableCards.map(card => ({ ...card.position, w: 120, h: 120 * 88 / 63 })),
    ];
    const openSpot = (directions = [[-1,0],[0,-1],[1,0],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]]) => {
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
    // The first quest brings a teaching card that shows how to clear quest cards.
    if (index === 0) {
      blocked.push({ ...position, w: 120, h: 120 * 88 / 63 });
      // Same row on the far side of the biome, so both cards share the view.
      arrivals.push({ questIndex: TUTORIAL_QUEST_INDEX, position: openSpot([[1,0],[-1,0],[1,1],[-1,1],[0,1],[1,-1],[-1,-1],[0,-1]]), flightFrom });
    }
    setState(previous => previous.questTableCards.some(card => card.questIndex === index) ? previous : { ...previous, questTableCards: [...previous.questTableCards, ...arrivals] });
  }, [state]);
  const clearTutorialCard = () => {
    const card = document.querySelector<HTMLElement>('[data-table-quest="' + TUTORIAL_QUEST_INDEX + '"] .quest-card');
    const from = card?.getBoundingClientRect();
    if (card && from?.width) {
      const ghost = card.cloneNode(true) as HTMLElement;
      ghost.style.cssText = 'position:fixed;left:'+from.x+'px;top:'+from.y+'px;width:'+from.width+'px;height:'+from.height+'px;z-index:60000;pointer-events:none;margin:0;';
      document.body.append(ghost);
      const fade = ghost.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.85) translateY(-24px)', opacity: 0 }], { duration: 420, easing: 'ease-in' });
      fade.onfinish = () => ghost.remove(); fade.oncancel = () => ghost.remove();
    }
    setState(previous => ({ ...previous, questTableCards: previous.questTableCards.filter(placed => placed.questIndex !== TUTORIAL_QUEST_INDEX) }));
  };
  const leaveTableau = () => {
    const occupied = [
      ...state.worldActors.filter(actor => actor.location === 'table').map(actor => actor.position),
      ...state.worldResourceStacks.map(stack => stack.position),
    ];
    state.worldActors.filter(actor => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId).forEach(actor => {
      const biome = state.biomeTiles.find(tile => tile.id === actor.biomeId);
      if (!biome) return;
      const exit = getBiomeExitPoint(biome, occupied);
      occupied.push(exit);
      dropActorToTable(actor.id, exit);
    });
    setMobilePanel('map');
  };
  const redeemQuest = () => {
    const index = state.questClaims;
    const step = getExpeditionQuestSteps(state)[index];
    if (!step || !(step.complete || state.questAccomplished[index])) { logHold(`redeem refused: quest ${index} not complete`); return; }
    const rewardSource = document.querySelector<HTMLElement>('[data-table-quest="' + index + '"] .quest-card');
    flyQuestToDiscard(rewardSource);
    const from = rewardSource?.getBoundingClientRect();
    const destination = document.querySelector('[data-stamina-tray]')?.getBoundingClientRect();
    if (from && destination?.width) {
      const bolt = document.createElement('span'); bolt.textContent = '⚡'; bolt.className = 'quest-stamina-flight';
      bolt.style.cssText = 'position:fixed;left:'+(from.x+from.width/2)+'px;top:'+(from.y+from.height/2)+'px;z-index:60001;pointer-events:none;font-size:28px;';
      document.body.append(bolt);
      const flight = bolt.animate([{transform:'translate(-50%,-50%) scale(1)'},{transform:'translate('+(destination.x+destination.width/2-from.x-from.width/2)+'px,'+(destination.y+destination.height/2-from.y-from.height/2)+'px) scale(.5)',opacity:0}],{duration:550,easing:'ease-in-out'});
      flight.onfinish=()=>bolt.remove();flight.oncancel=()=>bolt.remove();
    }
    setState((previous) => {
      // Prevent repeated input from redeeming a newly exposed quest.
      if (previous.questClaims !== index) return previous;
      // Quest bonuses can exceed the resting cap, so claiming at full STA never wastes a reward.
      const redeemed = redeemActiveQuest(previous, getExpeditionQuestSteps(previous).map((step) => step.complete), 1, ACTOR_STAMINA_MAX);
      return redeemed === previous ? previous : { ...redeemed, questTableCards: redeemed.questTableCards.filter(card => card.questIndex === TUTORIAL_QUEST_INDEX || card.questIndex >= redeemed.questClaims) };
    });
  };

  return (
    <div
      className="proto-game-root h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(20,38,31,0.24),transparent_38%),linear-gradient(180deg,#05060a,#090d12_38%,#06070a)] p-[clamp(0.6rem,1.8vmin,1.2rem)] text-white"
      style={{
        ['--classic-card-w' as string]: 'clamp(2.35rem, min(8.8vw, 10dvh), 5rem)',
        ['--classic-gap' as string]: 'clamp(0.3rem, 1vmin, 0.9rem)',
        ['--classic-tableau-gap' as string]: 'clamp(0.18rem, 0.55vw, 0.55rem)',
        ['--classic-stack-step' as string]: 'clamp(1.15rem, min(4.8dvh, calc(var(--classic-card-w)*0.5)), 2.35rem)',
        ['--classic-radius' as string]: 'clamp(0.8rem, 1.7vmin, 1.35rem)',
        ['--actor-board-span' as string]: '85%',
        ['--table-object-shadow' as string]: tableObjectShadow(tableHours, { x: 0, y: 0 }, 5, tableLights),
        ['--table-daylight' as string]: lighting.daylight,
        ['--table-wood-light' as string]: `${18 + lighting.daylight * 12}%`,
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1680px] min-h-0 flex-col gap-[clamp(0.55rem,1.4vmin,1rem)]">
        <div className="min-h-0 flex-1">
          <section className="flex h-full min-h-0 flex-col rounded-[calc(var(--classic-radius)*1.75)] border border-white/10 bg-black/20 p-[clamp(0.6rem,1.6vmin,1.2rem)] shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
            <div data-mobile-panel={mobilePanel} style={desktopLayoutTracks(Boolean(state.selectedBiomeId), supplyOpen, questOpen)} className={`proto-main-layout grid h-full min-h-0 flex-1 gap-[clamp(0.55rem,1.4vmin,0.9rem)] ${state.selectedBiomeId ? '' : 'proto-main-layout--no-tableau'} ${questOpen ? '' : 'proto-main-layout--no-quest'}`}>
              <div className="proto-main-header min-h-0">
                <nav className="proto-mobile-nav" aria-label="Game panels">
                  {(['supplies', 'map', 'tableau', 'quests'] as const).map(panel => <button key={panel} type="button" aria-pressed={mobilePanel === panel} disabled={panel === 'tableau' && !state.selectedBiomeId} onClick={() => { setMobilePanel(panel); if (panel === 'quests') setQuestOpen(true); if (panel === 'supplies') setSupplyOpen(true); }}>{panel === 'map' ? 'Table' : panel === 'tableau' ? 'Tableau' : panel === 'supplies' ? 'Supplies' : 'Quests'}</button>)}
                </nav>
                <div className="proto-lighting-rail" data-camera-ignore="true">
                  <span className="proto-lighting-rail__clock">Day {state.day} · {lighting.phase} · {String(Math.floor(lighting.hour)).padStart(2, '0')}:{String(Math.floor((lighting.hour % 1) * 60)).padStart(2, '0')}</span>
                  <label className="flex items-center gap-2">Time <TimeOfDaySlider hours={tableHours} onChange={setTableHours} /></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={cycleLighting} onChange={(event) => setCycleLighting(event.target.checked)} />Cycle day/night</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={tableLightsEnabled} onChange={(event) => setTableLightsEnabled(event.target.checked)} />Table lights</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={lightReadoutVisible} onChange={(event) => setLightReadoutVisible(event.target.checked)} />Light %</label>
                </div>
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
                <div className="proto-game-rail mt-[clamp(0.35rem,0.8vmin,0.55rem)] flex flex-wrap items-center gap-[clamp(0.3rem,0.7vmin,0.5rem)]">
                  {state.scene === 'combat' ? (
                    <>
                      <AutoPlayControl
                        label="Player AI"
                        paused={playerAutoPaused}
                        speedIndex={playerAutoSpeedIndex}
                        onToggle={() => setPlayerAutoPaused((paused) => !paused)}
                        onSpeedChange={setPlayerAutoSpeedIndex}
                      />
                      <AutoPlayControl
                        label="Enemy AI"
                        paused={enemyAutoPaused}
                        speedIndex={enemyAutoSpeedIndex}
                        onToggle={() => setEnemyAutoPaused((paused) => !paused)}
                        onSpeedChange={setEnemyAutoSpeedIndex}
                      />
                      <button type="button" onClick={endTurn} className="proto-game-action border border-[#ffd166]/42 px-3 py-2 text-[clamp(0.56rem,1.05vmin,0.7rem)] font-semibold uppercase tracking-[0.14em] text-[#ffe8ae]">
                        End Turn
                      </button>
                    </>
                  ) : null}
                  {state.scene === 'exploration' ? (
                    <button
                      type="button"
                      disabled={state.energy > 0}
                      onClick={returnToBase}
                      className="proto-game-action border border-[#8ef2d4]/42 px-3 py-2 text-[clamp(0.56rem,1.05vmin,0.7rem)] font-semibold uppercase tracking-[0.14em] text-[#cafff4] disabled:cursor-default disabled:border-white/15 disabled:text-white/35"
                    >
                      Return Base
                    </button>
                  ) : null}
                  {state.scene === 'exploration' ? (
                    <>
                      <div data-stamina-tray="true" className="rounded-full border border-[#ffd166]/28 bg-[#ffd166]/8 px-3 py-2 font-mono text-[clamp(0.56rem,1.05vmin,0.7rem)] font-semibold uppercase tracking-[0.12em] text-[#ffe7ad]">
                        Day {state.day} · Stamina {state.stamina}/{state.maxStamina}
                      </div>
                      {state.trailRations > 0 ? (
                        <button
                          type="button"
                          onClick={consumeTrailRation}
                          className="proto-game-action border border-[#ffd166]/48 bg-[#ffd166]/8 px-3 py-2 text-[clamp(0.56rem,1.05vmin,0.7rem)] font-semibold uppercase tracking-[0.12em] text-[#ffe7ad]"
                        >
                          Use Trail Ration · +{DAY_TWO_RATION_ENERGY}E +{DAY_TWO_RATION_STAMINA}S
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={state.city.campBuilt || state.settledHaul.wood < 3 || state.settledHaul.berries < 1}
                        onClick={buildCamp}
                        className="proto-game-action border border-[#ffd166]/42 px-3 py-2 text-[clamp(0.56rem,1.05vmin,0.7rem)] font-semibold uppercase tracking-[0.14em] text-[#ffe8ae] disabled:cursor-default disabled:border-white/15 disabled:text-white/35"
                      >
                        {state.city.campBuilt ? 'Camp Built' : 'Build Camp · 3W 1B'}
                      </button>
                      <button
                        type="button"
                        disabled={!state.city.campBuilt || state.city.campUsedToday || state.worldActors.some((actor) => actor.location === 'foundation')}
                        onClick={restAtCamp}
                        className="proto-game-action border border-[#8ef2d4]/42 px-3 py-2 text-[clamp(0.56rem,1.05vmin,0.7rem)] font-semibold uppercase tracking-[0.14em] text-[#cafff4] disabled:cursor-default disabled:border-white/15 disabled:text-white/35"
                      >
                        {state.city.campUsedToday ? 'Camp Rested' : 'Rest'}
                      </button>
                      <button
                        type="button"
                        disabled={state.worldActors.some((actor) => actor.location === 'foundation') || (state.day === 1 && (!state.city.campBuilt || !state.city.restedOnce || !smallWoodsComplete))}
                        onClick={endDay}
                        className="proto-game-action border border-[#d9a8ff]/42 px-3 py-2 text-[clamp(0.56rem,1.05vmin,0.7rem)] font-semibold uppercase tracking-[0.14em] text-[#ecd8ff] disabled:cursor-default disabled:border-white/15 disabled:text-white/35"
                      >
                        End Day
                      </button>
                    </>
                  ) : null}
                  <button type="button" onClick={redeal} className="proto-game-action border border-white/28 px-3 py-2 text-[clamp(0.56rem,1.05vmin,0.7rem)] font-semibold uppercase tracking-[0.14em] text-white/80">
                    Redeal
                  </button>
                  <span className="proto-build-label" data-build-commit={PROTO_BUILD_COMMIT} title={PROTO_BUILD_TITLE}>{PROTO_BUILD_LABEL}</span>
                </div>
              </div>

              <SettlementSupplyTray
                open={supplyOpen}
                items={supplyItems}
                onPlace={(id) => drawSettlementSupply(id as HaulResource, 1)}
                onClose={() => { setSupplyOpen(false); if (mobilePanel === 'supplies') setMobilePanel('map'); }}
              />
              <div className={`proto-tableau-field min-h-0 min-w-0 overflow-hidden ${state.selectedBiomeId ? '' : 'hidden'}${pondSelected ? ' proto-tableau-field--pond' : ''}`}>
              {pondSelected ? (
                <PondField pond={state.pond} angler={pondAngler?.label ?? null} tired={Boolean(pondAngler) && state.stamina < POND_MISS_STAMINA}
                  landed={Object.fromEntries(POND_CATCHES.map((id) => [id, state.haul[id] - state.settledHaul[id]])) as Record<PondCatch, number>}
                  onCast={castPondBait} onFightEnd={endPondFight} onLeave={leaveTableau} />
              ) : (<>
              <div className="proto-main-tableau proto-main-tableau--solver grid min-h-0 grid-cols-1 items-center gap-[clamp(0.35rem,0.9vmin,0.6rem)] overflow-hidden rounded-[calc(var(--classic-radius)*1.3)] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(14,22,20,0.44),rgba(9,12,14,0.28))] p-[clamp(0.45rem,1.2vmin,0.75rem)]">
                <TableauCardArea columns={TABLEAU_COLUMNS} rows={Math.max(TABLEAU_ROWS, ...tableState.tableau.map((column) => column.length))}>
                <div className={`proto-tableau-stage${cameraTilted ? ' proto-tableau-stage--tilted' : ''}`}>
                <Tableau
                  columns={tableState.tableau}
                  className="grid min-w-0 justify-center"
                  style={{
                    gridTemplateColumns: 'repeat(7, minmax(0, var(--classic-card-w)))',
                    gap: 'var(--classic-tableau-gap)',
                    justifyContent: 'center',
                  }}
                >
                  {Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) => {
                    const column = tableState.tableau[columnIndex] ?? [];
                    const rowCount = Math.max(TABLEAU_ROWS, ...tableState.tableau.map((entry) => entry.length));
                    const topPadding = rowCount - column.length;
                    return (
                      <div
                        key={`tableau-column-${columnIndex}`}
                        className="relative"
                        style={{
                          width: 'var(--classic-card-w)',
                          height: 'var(--classic-stack-height)',
                        }}
                      >
                        {column.length === 0 ? (
                          <div className="absolute bottom-0 left-0 w-full">
                            <EmptySlot key={`top-empty-${columnIndex}`} emphasis="strong" />
                          </div>
                        ) : null}
                        {column.map((card, cardIndex) => {
                          const stackIndex = topPadding + cardIndex;
                          // Rows behind the front row sit farther from the tilted camera.
                          const depth = rowCount - 1 - stackIndex;
                          const isTopCard = cardIndex === column.length - 1;
                          const targetIndexes = adjacentFoundationIndexes(card, tableState);
                          const encounterReady = isTopCard && tableState.scene === 'exploration' && Boolean(card.encounter);
                          const playable = isTopCard && canAffordExplorationAction(tableState) && targetIndexes.length > 0;
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
                              cardRef={(node) => {
                                tableauCardRefs.current[card.id] = node;
                              }}
                              transporting={transporting}
                              active={(moveGuidance && (playable || encounterReady)) || choosingTarget}
                              mobilityTarget={mobilityTarget}
                              muted={!isTopCard}
                              standardRankSize
                              footerLabel={
                                state.scene === 'exploration' && card.encounter ? (
                                  <span role="img" aria-label="Shadow Wolf encounter">
                                    {ENCOUNTER_GLYPH}
                                  </span>
                                ) : card.resource && state.scene === 'exploration' ? (
                                  <span role="img" aria-label={FOREST_RESOURCE_LABELS[card.resource]}>
                                    {FOREST_RESOURCE_GLYPHS[card.resource]}
                                  </span>
                                ) : undefined
                              }
                              disabled={!playable && !encounterReady && !mobilityTarget}
                              onClick={() => {
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
                                // Depth of field: the farther back the row, the softer and dimmer it reads.
                                filter: cameraTilted && depth > 0 ? `blur(${Math.min(1.6, depth * 0.45).toFixed(2)}px) brightness(${(1 - Math.min(0.3, depth * 0.07)).toFixed(2)})` : undefined,
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </Tableau>
                </div>
                </TableauCardArea>
                <div className="proto-tableau-actions"><button type="button" disabled={Boolean(cardTransport) || state.scene !== 'exploration' || !state.worldActors.some(actor => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId)} onClick={leaveTableau}>Leave Tableau</button></div>
                <TableauSolveControls disabled={!state.worldActors.some((actor) => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId)} key={state.selectedBiomeId ?? 'main'} onStep={solveMainStep} onStart={startSolver} guidance={moveGuidance} onGuidanceChange={setMoveGuidance} />
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
                      Cache +{state.biome.cacheReward.wood}W +{state.biome.cacheReward.berries}B +{state.biome.cacheReward.herbs}H
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

              <div className="proto-main-foundations min-h-0 overflow-hidden rounded-[calc(var(--classic-radius)*1.3)] border border-[#f4c86c]/18 bg-[linear-gradient(180deg,rgba(22,18,12,0.44),rgba(9,10,12,0.28))] p-[clamp(0.5rem,1.25vmin,0.8rem)]">
                {state.scene === 'exploration' ? (
                  <div className="proto-table-summary mb-[clamp(0.35rem,0.9vmin,0.6rem)] grid grid-cols-4 gap-[clamp(0.35rem,0.9vmin,0.6rem)] border-b border-white/12 pb-[clamp(0.35rem,0.9vmin,0.6rem)] font-mono text-[clamp(0.45rem,0.9vmin,0.58rem)] uppercase tracking-[0.08em]">
                    <div><span className="text-white/45">Energy </span><span className="text-[#cafff4]">{state.energy}/{state.energyMax}</span></div>
                    <div><span className="text-white/45">{questNextCard ? 'Next ' : 'Work '}</span><span className="text-[#cafff4]">{questNextCard ? questNextCard.encounter ? 'Encounter' : rankLabel(questNextCard.rank) : state.totalWorkCompleted}</span></div>
                    <div><span className="text-white/45">Turn </span><span className="text-[#ffe1b5]">{turnCount} {currentTurn}</span></div>
                    <div><span className="text-white/45">Mobility </span><span className="text-[#ecd8ff]">{pendingMobility !== null ? 'TARGET' : state.mobilityUsed ? 'COOLDOWN' : 'READY'}</span></div>
                  </div>
                ) : null}
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
                      const collectedResources = FOREST_RESOURCE_ORDER.map((resource) => ({
                        resource,
                        count: foundation?.cards.filter((card) => card.resource === resource).length ?? 0,
                      }));
                      return (
                        <div key={`exploration-foundation-${index}`} className="proto-foundation-assembly">
                        <div
                          aria-label="Foundation"
                          data-foundation-index={index}
                          ref={(node) => {
                            foundationTransportRefs.current[index] = node;
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
                          className="proto-foundation-card--exploration grid aspect-[56/74] w-full max-w-[clamp(8rem,18vw,14rem)] place-items-center rounded-[calc(var(--classic-radius)*1.15)] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(10,15,16,0.96),rgba(5,8,10,0.98))] text-[clamp(0.58rem,1vmin,0.7rem)] font-mono uppercase tracking-[0.18em] text-white/30"
                        >
                          {actor ? (
                            <span className="proto-actor-energy" aria-label={`${actor.label} energy ${state.energy} of ${state.energyMax}`} title={`${actor.label} energy`}>
                              <span aria-hidden="true">⚡</span><span>{state.energy}</span>
                            </span>
                          ) : null}
                          {actor ? (
                            <div
                              aria-label="Hero actor in foundation"
                              role="button"
                              tabIndex={0}
                              aria-haspopup="dialog"
                              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspectActor(actor.id, event.currentTarget); } }}
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
                                if (!drag.moved) setInspectedActorId(actor.id);
                                foundationActorPointerRef.current = null;
                              }}
                              onPointerCancel={() => {
                                foundationActorPointerRef.current = null;
                                window.dispatchEvent(new CustomEvent('proto-actor-drag-end'));
                              }}
                              className="proto-exploration-actor cursor-grab touch-none text-center text-[#ffe7ad] active:cursor-grabbing"
                            >
                              {cameraTilted && WORLD_ACTOR_SPRITES[actor.id] ? (
                                // Battle camera: the actor pops up from the top edge of its card,
                                // clear of the energy bubble, card count and resources.
                                <span className="proto-foundation-popup" aria-hidden="true">
                                  <span className="proto-foundation-popup__base" />
                                  <SpriteStandeeArt sprite={WORLD_ACTOR_SPRITES[actor.id]} lighting={NEUTRAL_STANDEE_LIGHTING} size={FOUNDATION_POPUP_SIZE} />
                                </span>
                              ) : null}
                              <span className="proto-occupied-foundation-face" aria-label={`Foundation top card ${rankLabel(foundation?.card.rank ?? 2)}${foundation?.card.resource ? `, ${FOREST_RESOURCE_LABELS[foundation.card.resource]}` : ''}`}>
                                <span className="proto-occupied-foundation-rank">
                                  <span>{rankLabel(foundation?.card.rank ?? 2)}</span>
                                  {collectedCardCount > 0 && foundation?.card.resource ? <span role="img" aria-label={FOREST_RESOURCE_LABELS[foundation.card.resource]}>{FOREST_RESOURCE_GLYPHS[foundation.card.resource]}</span> : null}
                                </span>
                                <span className="proto-occupied-foundation-owner">{actor.label}</span>
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
                          <span className="proto-foundation-count-token" aria-label={`${collectedCardCount} cards collected`} title="Cards collected">
                            <span aria-hidden="true">▤</span><span>{collectedCardCount}</span>
                          </span>
                        </div>
                          <ul className="proto-foundation-resources" aria-label="Resources collected this tableau">
                            {collectedResources.map(({ resource, count }) => (
                              <li key={resource} data-resource={resource} data-count={count} aria-label={`${FOREST_RESOURCE_LABELS[resource]} ${count}`} title={FOREST_RESOURCE_LABELS[resource]}>
                                <span aria-hidden="true">{FOREST_RESOURCE_GLYPHS[resource]}</span><span aria-hidden="true">{count}</span>
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
                        stamina={state.actorStamina[index] ?? ACTOR_STAMINA_MAX}
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
              </div>
              </>)}
              </div>
              <ProtoMap
                biomeTiles={state.biomeTiles.map((tile) => ({ ...tile, selected: tile.id === state.selectedBiomeId, sprite: BIOME_TILE_SPRITES[tile.id] }))}
                actors={state.worldActors
                  .filter((actor) => actor.location === 'table' || Boolean(actor.biomeId))
                  .map(({ id, label, location, biomeId, position, hutId, luminosity, lightColor }) => ({ id, label, location, biomeId, position, hutId, luminosity, lightColor, sprite: WORLD_ACTOR_SPRITES[id] }))}
                actorOrigins={state.worldActors.map(({ id, label, location, biomeId, position }) => ({ id, label, location, biomeId, position }))}
                resourceStacks={state.worldResourceStacks}
                questCards={state.questTableCards}
                questTitles={questSteps.map(step => step.label)}
                questTexts={questInstructions}
                questClaims={state.questClaims}
                onMoveQuest={(index, position, tilt) => setState(previous => ({ ...previous, questTableCards: previous.questTableCards.map(card => card.questIndex === index ? { ...card, position, tilt, tableState: true, flightFrom: undefined } : card) }))}
                tilted={cameraTilted}
                onTiltedChange={setCameraTilted}
                onRedeemQuest={(index) => { logHold(index === TUTORIAL_QUEST_INDEX ? 'tutorial card cleared' : index === state.questClaims ? `redeem quest ${index}` : `redeem ignored: card ${index}, next claim is ${state.questClaims}`); if (index === TUTORIAL_QUEST_INDEX) clearTutorialCard(); else if (index === state.questClaims) redeemQuest(); }}
                lightSources={tableLights}
                timeOfDay={tableHours}
                showLightReadout={lightReadoutVisible}
                onSelectBiome={selectBiome}
                questOpen={questOpen}
                onToggleQuest={() => setQuestOpen((open) => !open)}
                onDropActorToTable={dropActorToTable}
                onMoveResourceStack={moveResourceStack}
                onSplitResourceStack={splitResourceStack}
                onPlayBuildCard={playHutCard}
                onSolveBuildStep={solveHutStep}
                onStartSolver={startSolver}
                onInspectActor={inspectActor}
                actorStamina={state.actorStamina[0]}
              />
              {<QuestField
                open={questOpen}
                deployedQuestId={state.questTableCards.some(card => card.questIndex === state.questClaims) ? 'expedition-' + state.questClaims : undefined}
                subtitle={'Happy path · Day ' + state.day}
                quests={questSteps.map((step, index) => ({
                  id: 'expedition-' + index,
                  title: step.label,
                  text: questInstructions[index],
                  status: index < state.questClaims ? 'redeemed' : (state.questAccomplished[index] || step.complete) ? 'complete' : 'incomplete',
                  rewards: [{ kind: 'stamina', amount: 1 }],
                }))}
                onRedeem={(id) => { if (id === 'expedition-' + state.questClaims) redeemQuest(); }}
                onClose={() => { setQuestOpen(false); if (mobilePanel === 'quests') setMobilePanel('map'); }}
              />}
            </div>
          </section>
        </div>
      </div>
      {!supplyOpen && <TrayRestoreHandle tray="supplies" onRestore={() => { setSupplyOpen(true); if (window.matchMedia('(max-width: 900px)').matches) setMobilePanel('supplies'); }} />}
      {!questOpen && <TrayRestoreHandle tray="quests" onRestore={() => { setQuestOpen(true); if (window.matchMedia('(max-width: 900px)').matches) setMobilePanel('quests'); }} />}
      {inspectedActorId && inspectionAnchor && state.worldActors.some((actor) => actor.id === inspectedActorId) ? <DetailsCardViewer
        anchor={inspectionAnchor}
        timeOfDay={tableHours}
        lights={tableLights}
        position={state.worldActors.find((actor) => actor.id === inspectedActorId)!.position}
        object={{
          id: inspectedActorId,
          name: state.worldActors.find((actor) => actor.id === inspectedActorId)!.label,
          badge: '♟',
          badgeLabel: 'Actor',
          art: <ActorCardArt sprite={WORLD_ACTOR_SPRITES[inspectedActorId]} label={state.worldActors.find((actor) => actor.id === inspectedActorId)!.label} />,
          descriptor: 'An expedition hero who explores the wilderness, gathers resources, and helps build your settlement.',
          trays: [{ id: 'stats', label: 'Stats' }, { id: 'equipment', label: 'Equipment' }, { id: 'buffs', label: 'Buffs' }],
        }}
        onClose={() => setInspectedActorId(null)}
      /> : null}
      <AbilityDetailPopup detail={abilityDetail} onClose={() => setAbilityDetail(null)} />
      {cardTransport ? (
        <DragPreview
          card={asDragPreviewCard(
            state.tableau[cardTransport.sourceColumnIndex]?.find((card) => card.id === cardTransport.cardId)
              ?? { id: cardTransport.cardId, rank: 1 },
          )}
          positionRef={cardTransportPositionRef}
          offset={{ x: 0, y: 0 }}
          size={cardTransport.size}
          showText
          zIndex={30000}
        />
      ) : null}
    </div>
  );
};
