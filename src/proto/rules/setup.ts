import { DEFAULT_ACTOR_LUMINOSITY } from '../protoLighting';
import { createPondDeal } from './fishing';
import { POND_CATCHES } from './pondSpecies';
import { createQuestBiomeDeal, nextQuestCard, QUEST_ROUTE_BUDGET } from '../protoQuestDeals';
import { DEFAULT_EXPEDITION_ENERGY, MAGE_PHASE_SHIFT_TRIGGER, PROTO_ENEMIES } from '../protoData';
import { FOUNDATION_MOCKUPS, FOUNDATION_SLOTS, ACTOR_STAMINA_MAX, type BiomeTileState, type Card, type EnemyRuntimeState, type FoundationSlot, type ForestHaul, type ForestResource, type HaulResource, type ProtoState, type SceneKind } from '../protoState';

// Deck, deal, world setup and state helpers. Pure: no React or DOM.

export const TABLEAU_COLUMNS = 7;
export const TABLEAU_ROWS = 5;
export const STARTING_WILD_CARDS = 0;
export const MOBILITY_COOLDOWN_TURNS = 2;

export const PARTY_LOADOUT = [2, 5, 6, 13];
export const ENEMY_TEAM_MOCKUPS: EnemyRuntimeState[] = PROTO_ENEMIES;
export const HERO_STAMINA_MAX = QUEST_ROUTE_BUDGET.maxStamina;
export const SMALL_WOODS_TRAVEL_COST = QUEST_ROUTE_BUDGET.smallTravelCost;
// Energy plan: Day 1 spends 13 tableau actions and keeps two energy for city work.
// Day 2 spends 18 Deep Woods placements plus an 8-stamina round trip; the ration
// bridges the 15-energy default pool while leaving three energy after the route.
export const DEEP_WOODS_TRAVEL_COST = QUEST_ROUTE_BUDGET.deepTravelCost;
export const DAY_TWO_RATION_ENERGY = QUEST_ROUTE_BUDGET.rationEnergy;
export const DAY_TWO_RATION_STAMINA = QUEST_ROUTE_BUDGET.rationStamina;
export const ACTOR_WORK_RESOURCES: ForestResource[] = ['wood', 'berries', 'herbs', 'wood'];
export const FOREST_RESOURCE_ORDER: ForestResource[] = ['wood', 'berries', 'herbs'];
export const FOREST_RESOURCE_LABELS: Record<ForestResource, string> = {
  wood: 'WOOD',
  berries: 'BERRY',
  herbs: 'HERB',
};
export const FOREST_RESOURCE_GLYPHS: Record<ForestResource, string> = {
  wood: '🪵',
  berries: '🫐',
  herbs: '🌿',
};
export const EMPTY_HAUL: ForestHaul = { wood: 0, berries: 0, herbs: 0, ...Object.fromEntries(POND_CATCHES.map((id) => [id, 0])) } as ForestHaul;
export const FOREST_CACHE_REWARD: ForestHaul = { ...EMPTY_HAUL, wood: 4, berries: 3, herbs: 2 };
export const ENCOUNTER_GLYPH = '⚔';

export const createRandomProtoCard = (): Card => {
  const rank = 1 + Math.floor(Math.random() * 13);
  return {
    id: `proto-infinite-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    rank,
  };
};

// Combat cards are intentionally neutral: forage nodes belong to the suspended
// exploration deal and must never leak into an infinite combat tableau.
export const asCombatCard = (card: Card): Card => ({ id: card.id, rank: card.rank });

export const drawTableauReplacement = (
  stock: Card[],
  infiniteBackfill: boolean,
  combatOnly = false,
): { card: Card | null; stock: Card[] } => {
  const stockCard = stock[0] ?? null;
  if (stockCard) {
    return { card: combatOnly ? asCombatCard(stockCard) : stockCard, stock: stock.slice(1) };
  }
  return { card: infiniteBackfill ? createRandomProtoCard() : null, stock };
};

export const createSeededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

export const shuffle = <T,>(items: T[], random: () => number = Math.random) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

export const createDeck = () => {
  let sequence = 0;
  return Array.from({ length: 4 }, (_, copyIndex) =>
    Array.from({ length: 13 }, (_, idx) => {
      sequence += 1;
      return {
        id: `proto-rank-${idx + 1}-copy-${copyIndex + 1}-${sequence}`,
        rank: idx + 1,
      } satisfies Card;
    }),
  ).flat();
};

export const splitTableauDeck = (deck: Card[]) => ({
  tableau: Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) =>
    deck.slice(columnIndex * TABLEAU_ROWS, (columnIndex + 1) * TABLEAU_ROWS),
  ),
  stock: deck.slice(TABLEAU_COLUMNS * TABLEAU_ROWS),
});

export const createCombatDeal = () => {
  const deal = splitTableauDeck(shuffle(createDeck()));
  return {
    tableau: deal.tableau.map((column) => column.map(asCombatCard)),
    stock: deal.stock.map(asCombatCard),
  };
};

export const createAmbushCombatDeal = () => {
  const chain = [3, 4, 5, 6, 7, 8].map((rank, index) => ({
    id: `proto-shadow-wolf-ambush-${rank}-${index}`,
    rank,
  }));
  const tableau = [0, 1, 2].map((columnIndex) =>
    chain.slice(columnIndex * 2, (columnIndex + 1) * 2).reverse(),
  );
  return {
    tableau: [...tableau, [], [], [], []] as Card[][],
    stock: [] as Card[],
  };
};

export const createBiomeTableau = (
  seed: number,
  resourceDensity: number,
  tableauSize: number,
  resourceTypes: readonly ForestResource[],
) => {
  const random = createSeededRandom(seed);
  const deck = shuffle(createDeck(), random);
  const safeTableauSize = Math.max(1, Math.min(deck.length - 1, tableauSize));
  const tableauCards = deck.slice(0, safeTableauSize);
  const resourceCount = Math.round(safeTableauSize * Math.max(0, Math.min(1, resourceDensity)));
  const resourceIndexes = shuffle(Array.from({ length: safeTableauSize }, (_, index) => index), random).slice(0, resourceCount);
  const seededTableau = tableauCards.map((card, index) => {
    const resourceIndex = resourceIndexes.indexOf(index);
    return resourceIndex >= 0 && resourceTypes.length > 0
      ? { ...card, resource: resourceTypes[resourceIndex % resourceTypes.length] }
      : card;
  });
  const columns = Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) => {
    const columnSize = Math.ceil(safeTableauSize / TABLEAU_COLUMNS);
    return seededTableau.slice(columnIndex * columnSize, (columnIndex + 1) * columnSize);
  });
  return {
    tableau: columns,
    stock: deck.slice(safeTableauSize),
  };
};

export const createSeededSmallWoodsDeal = () => createQuestBiomeDeal('small');

// Proto starts with one selectable world object: Small Woods. Additional
// biome sizes can be added to a later progression state, but must not be
// created as part of the initial table.
export const DEFAULT_WOODS_TILES = [
  { id: 'woods-alpha', title: 'Small Woods', sizeLabel: 'Small', gridSize: { columns: 1, rows: 1 }, resourceDensity: 0.45, tableauSize: 13, position: { x: 0, y: -48 }, unlocked: true, travelCost: SMALL_WOODS_TRAVEL_COST, threat: 'none' as const },
] as const;

/** The pond sits in the clear starting area, one cell down and left of the Hero, in view on phones and clear of where quest cards land. It is fished
 * (rules/fishing.ts), so it has no tableau and costs no stamina to reach. */
export const POND_TILE = { id: 'pond', title: 'Pond', sizeLabel: 'Small' as const, gridSize: { columns: 1, rows: 1 }, resourceDensity: 0, tableauSize: 0, position: { x: -48, y: 96 }, unlocked: true, travelCost: 0, threat: 'none' as const, terrain: 'water' as const };
export const isPondTile = (biomeId: string | null | undefined) => biomeId === POND_TILE.id;

export const createDeepWoodsTile = (seed: number) => ({
  id: 'woods-beta',
  title: 'Deep Woods',
  sizeLabel: 'Medium' as const,
  gridSize: { columns: 2, rows: 1 },
  resourceDensity: 0.55,
  tableauSize: 18,
  position: { x: 144, y: -48 },
  seed,
  unlocked: false,
  travelCost: DEEP_WOODS_TRAVEL_COST,
  threat: 'low' as const,
});

export const materializeDeepWoods = (seed: number): BiomeTileState => {
  const tile = createDeepWoodsTile(seed);
  const deal = createQuestBiomeDeal('deep');
  return { ...tile, tableauSize: 19, tableau: deal.tableau, stock: deal.stock };
};

export const isBiomeDealComplete = (tableau: Card[][], stock: Card[]) =>
  stock.length === 0 && tableau.every((column) => column.length === 0);

export const addForestHaul = (haul: ForestHaul, reward: Partial<ForestHaul>): ForestHaul =>
  Object.fromEntries((Object.keys(EMPTY_HAUL) as HaulResource[]).map((key) => [key, (haul[key] ?? 0) + (reward[key] ?? 0)])) as ForestHaul;

export const isAdjacentRank = (left: number, right: number) => {
  if (left === right) return false;
  if ((left === 1 && right === 13) || (left === 13 && right === 1)) return true;
  return Math.abs(left - right) === 1;
};

export const rankDistance = (left: number, right: number) => {
  const direct = Math.abs(left - right);
  return Math.min(direct, 13 - direct);
};

export const canPlayOnFoundation = (card: Card, foundation: FoundationSlot, phaseShiftActive = false) => {
  if (!foundation) return false;
  if (foundation.wildcardBridgeFromRank) {
    return rankDistance(card.rank, foundation.wildcardBridgeFromRank) === 2;
  }
  return isAdjacentRank(card.rank, foundation.card.rank) || (phaseShiftActive && rankDistance(card.rank, foundation.card.rank) === 2);
};

export const isOpenExplorationFoundation = (
  scene: SceneKind,
  foundationIndex: number,
  foundation: FoundationSlot,
) =>
  scene === 'exploration' &&
  foundation !== null &&
  foundation.count === 0 &&
  foundation.cards.length === 0;

export const createFoundations = (party: Card[]): FoundationSlot[] =>
  Array.from({ length: FOUNDATION_SLOTS }, (_, index) =>
    party[index] ? { card: party[index], count: 0, cards: [] } : null,
  );

export const createExplorationFoundations = (party: Card[], count: number): FoundationSlot[] =>
  Array.from({ length: Math.max(1, count) }, (_, index) => ({
    card: party[index] ?? { id: `proto-exploration-foundation-${index}`, rank: 1 },
    count: 0,
    cards: [],
  }));

export const createQuestExplorationFoundations = (party: Card[], count: number, tableau: Card[][]): FoundationSlot[] => {
  const next = nextQuestCard(tableau.map((column) => column.filter((card) => !card.encounter)));
  const rank = next ? ((next.rank + 11) % 13) + 1 : undefined;
  return createExplorationFoundations(party, count).map((foundation) => foundation && rank
    ? { ...foundation, card: { ...foundation.card, rank } } : foundation);
};

export const createInitialState = (): ProtoState => {
  const party = PARTY_LOADOUT.map((rank, index) => ({
    id: `proto-party-${rank}-${index}`,
    rank,
  }));
  const seed = Math.floor(Math.random() * 0xffffffff);
  const biomeTiles = DEFAULT_WOODS_TILES.map((tile, index): BiomeTileState => {
    const deal = createSeededSmallWoodsDeal();
    return { ...tile, seed: seed + index * 7919, tableau: deal.tableau, stock: deal.stock };
  });
  biomeTiles.push({ ...POND_TILE, position: { ...POND_TILE.position }, seed: seed + 104729, tableau: [], stock: [] });
  const firstBiome = biomeTiles[0];
  return {
    tableau: firstBiome.tableau,
    stock: firstBiome.stock,
    foundations: createQuestExplorationFoundations(party, DEFAULT_WOODS_TILES[0].gridSize.columns * DEFAULT_WOODS_TILES[0].gridSize.rows, firstBiome.tableau),
    party,
    wildCards: STARTING_WILD_CARDS,
    actorStamina: Array.from({ length: FOUNDATION_SLOTS }, () => ACTOR_STAMINA_MAX),
    actorWorkCompleted: Array.from({ length: FOUNDATION_SLOTS }, () => 0),
    totalWorkCompleted: 0,
    heroHp: FOUNDATION_MOCKUPS.map((hero) => hero.hp),
    heroBuffs: Array.from({ length: FOUNDATION_SLOTS }, () => []),
    abilityProgress: { [MAGE_PHASE_SHIFT_TRIGGER.id]: 0 },
    mobilityUsed: false,
    mobilityCooldown: 0,
    energy: DEFAULT_EXPEDITION_ENERGY,
    energyMax: DEFAULT_EXPEDITION_ENERGY,
    scene: 'exploration',
    biome: { seed, cacheClaimed: false, cacheReward: FOREST_CACHE_REWARD },
    suspendedExploration: null,
    biomeTiles,
    selectedBiomeId: null,
    worldActors: [{ id: 'hero', label: 'Hero', location: 'table', position: { x: 0, y: 48 }, luminosity: DEFAULT_ACTOR_LUMINOSITY }],
    worldResourceStacks: [],
    trailRations: 0,
    haul: { ...EMPTY_HAUL },
    settledHaul: { ...EMPTY_HAUL },
    enemyTeam: [],
    ambushCardsRemaining: 0,
    day: 1,
    stamina: QUEST_ROUTE_BUDGET.startingStamina,
    maxStamina: HERO_STAMINA_MAX,
    city: { campBuilt: false, campUsedToday: false, restedOnce: false },
    deepEncounterResolved: false,
    battleRecovered: false,
    questClaims: 0,
    questTableCards: [],
    questAccomplished: [],
    pond: createPondDeal(seed + 104729, 1),
    glowfishGlow: false,
  };
};

export const getExpeditionQuestSteps = (state: ProtoState) => {
  const smallWoods = state.biomeTiles.find((tile) => tile.id === 'woods-alpha');
  const smallWoodsComplete = Boolean(smallWoods && isBiomeDealComplete(smallWoods.tableau, smallWoods.stock));
  const heroActor = state.worldActors.find((actor) => actor.id === 'hero');
  return [
    { label: 'Move Hero to Small Woods', complete: heroActor?.biomeId === 'woods-alpha' || smallWoodsComplete },
    { label: 'Solve the safe Small Woods tableau', complete: smallWoodsComplete },
    { label: 'Return resources to the city', complete: smallWoodsComplete && state.worldActors.every((actor) => actor.location !== 'foundation') && Object.values(state.haul).some((count) => count > 0) },
    { label: 'Build the first Camp', complete: state.city.campBuilt },
    { label: 'Rest and recover', complete: state.city.restedOnce },
    { label: 'End Day 1', complete: state.day >= 2 },
    { label: 'Use the Day 2 ration for the Deep Woods round trip', complete: state.deepEncounterResolved || (state.day >= 2 && state.heroBuffs[0]?.some((buff) => buff.id === 'well_fed')) },
    { label: 'Enter the newly revealed Deep Woods', complete: heroActor?.biomeId === 'woods-beta' || state.deepEncounterResolved },
    { label: 'Resolve the first wilderness battle', complete: state.deepEncounterResolved },
    { label: 'Recover from battle', complete: state.battleRecovered },
  ];
};

export const canAffordExplorationAction = (state: ProtoState, cost = 1) =>
  state.scene !== 'exploration' || state.energy >= cost;

export const spendExplorationEnergy = (state: ProtoState, cost: number) =>
  state.scene === 'exploration' ? Math.max(0, state.energy - cost) : state.energy;


export const cloneState = (state: ProtoState): ProtoState => ({
  tableau: state.tableau.map((column) => column.map((card) => ({ ...card }))),
  stock: state.stock.map((card) => ({ ...card })),
  foundations: state.foundations.map((foundation) =>
    foundation
      ? {
          ...foundation,
          card: { ...foundation.card },
          cards: foundation.cards.map((card) => ({ ...card })),
        }
      : null,
  ),
  party: state.party.map((card) => ({ ...card })),
  wildCards: state.wildCards,
  actorStamina: [...state.actorStamina],
  actorWorkCompleted: [...state.actorWorkCompleted],
  totalWorkCompleted: state.totalWorkCompleted,
  heroHp: [...state.heroHp],
  heroBuffs: state.heroBuffs.map((buffs) => buffs.map((buff) => ({ ...buff }))),
  abilityProgress: { ...state.abilityProgress },
  mobilityUsed: state.mobilityUsed,
  mobilityCooldown: state.mobilityCooldown,
  energy: state.energy,
  energyMax: state.energyMax,
  scene: state.scene,
  biome: { ...state.biome, cacheReward: { ...state.biome.cacheReward } },
  suspendedExploration: state.suspendedExploration
    ? {
        tableau: state.suspendedExploration.tableau.map((column) => column.map((card) => ({ ...card }))),
        stock: state.suspendedExploration.stock.map((card) => ({ ...card })),
      }
    : null,
  biomeTiles: state.biomeTiles.map((tile) => ({
    ...tile,
    position: { ...tile.position },
    tableau: tile.tableau.map((column) => column.map((card) => ({ ...card }))),
    stock: tile.stock.map((card) => ({ ...card })),
  })),
  selectedBiomeId: state.selectedBiomeId,
  worldActors: state.worldActors.map((actor) => ({ ...actor, position: { ...actor.position } })),
  worldResourceStacks: state.worldResourceStacks.map((stack) => ({ ...stack, position: { ...stack.position }, ingredients: stack.ingredients ? { ...stack.ingredients } : undefined, build: stack.build ? { ...stack.build, tableau: [...stack.build.tableau] } : undefined })),
  trailRations: state.trailRations,
  haul: { ...state.haul },
  settledHaul: { ...state.settledHaul },
  enemyTeam: state.enemyTeam.map((enemy) => ({ ...enemy })),
  ambushCardsRemaining: state.ambushCardsRemaining,
  day: state.day,
  stamina: state.stamina,
  maxStamina: state.maxStamina,
  city: { ...state.city },
  deepEncounterResolved: state.deepEncounterResolved,
  battleRecovered: state.battleRecovered,
  questClaims: state.questClaims,
  questTableCards: state.questTableCards.map(card => ({ ...card, position: { ...card.position } })),
  questAccomplished: [...state.questAccomplished],
  pond: {
    ...state.pond,
    water: state.pond.water.map((fish) => ({ ...fish })),
    school: state.pond.school.map((fish) => ({ ...fish })),
    bait: state.pond.bait.map((card) => ({ ...card })),
    hand: state.pond.hand.map((card) => ({ ...card })),
    missedRanks: [...state.pond.missedRanks],
    lastCast: state.pond.lastCast ? { ...state.pond.lastCast } : null,
  },
  glowfishGlow: state.glowfishGlow,
});
