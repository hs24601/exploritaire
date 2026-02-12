import type { Actor, Card, ChallengeProgress, BuildPileProgress, Effect, EffectType, GameState, InteractionMode, Tile, Move, Suit, Element, Token, OrimInstance, ActorDeckState, OrimDefinition, OrimSlot } from './types';
import { GAME_CONFIG, ELEMENT_TO_SUIT, SUIT_TO_ELEMENT, GARDEN_GRID, ALL_ELEMENTS, MAX_KARMA_DEALING_ATTEMPTS, TOKEN_PROXIMITY_THRESHOLD, randomIdSuffix } from './constants';
import { createDeck, shuffleDeck } from './deck';
import { canPlayCard, canPlayCardWithWild, checkKarmaDealing } from './rules';
import { createInitialProgress, clearAllProgress as clearAllProgressFn, clearPhaseProgress as clearPhaseProgressFn } from './challenges';
import {
  createInitialBuildPileProgress,
  clearAllBuildPileProgress,
  clearBuildPileProgress as clearBuildPileProgressFn,
  addCardToBuildPile,
  getBuildPileDefinition,
} from './buildPiles';
import {
  createInitialActors,
  createActor,
  getActorDefinition,
} from './actors';
import { createActorDeckStateWithOrim } from './actorDecks';
import { ORIM_DEFINITIONS } from './orims';
import { canActivateOrim } from './orimTriggers';
import { applyOrimTiming, actorHasOrimDefinition } from './orimEffects';
import {
  createInitialTiles,
  createTile,
  addCardToTile,
  findSlotById,
  canAddCardToSlot,
  clearTileProgress as clearTileProgressFn,
  canAssignActorToHomeSlot,
  upgradeTile,
  isForestPuzzleTile,
} from './tiles';
import { createInitialTokens, createToken } from './tokens';
import { getBiomeDefinition } from './biomes';
import { getNodePattern } from './nodePatterns';
import { generateNodeTableau, playCardFromNode } from './nodeTableau';

const NO_REGRET_ORIM_ID = 'no-regret';
const NO_REGRET_COOLDOWN = 5;
const PARTY_FOUNDATION_LIMIT = 3;
const DEFAULT_ENEMY_FOUNDATION_SEEDS: Array<{ id: string; rank: number; suit: Suit; element: Element }> = [
  { id: 'enemy-shadow', rank: 12, suit: '🌙', element: 'D' },
  { id: 'enemy-sun', rank: 8, suit: '☀️', element: 'L' },
];

function clampPartyForFoundations(partyActors: Actor[]): Actor[] {
  return partyActors.slice(0, PARTY_FOUNDATION_LIMIT);
}

function tickNoRegretCooldown(cooldown: number | undefined): number {
  return Math.max(0, (cooldown ?? 0) - 1);
}

function stripLastCardSnapshot(state: GameState): Omit<GameState, 'lastCardActionSnapshot'> {
  return { ...state, lastCardActionSnapshot: undefined } as Omit<GameState, 'lastCardActionSnapshot'>;
}

function recordCardAction(prev: GameState, next: GameState): GameState {
  const snapshot = stripLastCardSnapshot(prev);
  const baseCooldown = next.noRegretCooldown ?? prev.noRegretCooldown;
  return {
    ...next,
    lastCardActionSnapshot: snapshot,
    noRegretCooldown: tickNoRegretCooldown(baseCooldown),
  };
}

function actorHasNoRegret(state: GameState, actorId: string): boolean {
  return actorHasOrimDefinition(state, actorId, NO_REGRET_ORIM_ID);
}

function normalizeStack(actors: Actor[], stackId: string): Actor[] {
  const stackActors = actors
    .filter(actor => actor.stackId === stackId)
    .sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0));

  if (stackActors.length <= 1) {
    return actors.map(actor =>
      actor.stackId === stackId ? { ...actor, stackId: undefined, stackIndex: undefined } : actor
    );
  }

  const stackMap = new Map(stackActors.map((actor, index) => [actor.id, index]));
  return actors.map(actor =>
    actor.stackId === stackId
      ? { ...actor, stackIndex: stackMap.get(actor.id) ?? actor.stackIndex }
      : actor
  );
}

function removeActorFromStack(actors: Actor[], actorId: string): Actor[] {
  const actor = actors.find(item => item.id === actorId);
  if (!actor?.stackId) return actors;
  const stackId = actor.stackId;

  const clearedActors = actors.map(item =>
    item.id === actorId ? { ...item, stackId: undefined, stackIndex: undefined } : item
  );

  return normalizeStack(clearedActors, stackId);
}

function applyStackOrder(
  actors: Actor[],
  stackId: string,
  orderedIds: string[],
  gridPosition?: { col: number; row: number }
): Actor[] {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  return actors.map(actor => {
    if (!orderMap.has(actor.id)) return actor;
    return {
      ...actor,
      stackId,
      stackIndex: orderMap.get(actor.id),
      gridPosition: gridPosition ?? actor.gridPosition,
    };
  });
}

function updateItemInArray<T extends { id: string }>(
  array: T[], id: string, updater: (item: T) => T
): T[] {
  const index = array.findIndex(item => item.id === id);
  if (index === -1) return array;
  const updated = updater(array[index]);
  return [...array.slice(0, index), updated, ...array.slice(index + 1)];
}

function findOpenGridPosition(occupied: Set<string>): { col: number; row: number } {
  for (let row = 0; row < GARDEN_GRID.rows; row += 1) {
    for (let col = 0; col < GARDEN_GRID.cols; col += 1) {
      const key = `${col},${row}`;
      if (!occupied.has(key)) {
        return { col, row };
      }
    }
  }
  return { col: 0, row: 0 };
}

function getOccupiedPositions(
  ...sources: Array<{ gridPosition?: { col: number; row: number } }[]>
): Set<string> {
  const occupied = new Set<string>();
  for (const source of sources) {
    for (const item of source) {
      const pos = item.gridPosition;
      if (pos) occupied.add(`${Math.round(pos.col)},${Math.round(pos.row)}`);
    }
  }
  return occupied;
}

function createEmptyTokenCounts(): Record<Element, number> {
  return {
    W: 0,
    E: 0,
    A: 0,
    F: 0,
    D: 0,
    L: 0,
    N: 0,
  };
}

function getOrimDefinitionById(definitions: OrimDefinition[], definitionId?: string) {
  if (!definitionId) return null;
  return definitions.find((item) => item.id === definitionId) || null;
}

function isOrimLocked(slot?: OrimSlot | null): boolean {
  return !!slot?.locked;
}

const BASE_STAMINA = 3;

function applyBaseStamina(actor: Actor): Actor {
  const prevMax = actor.staminaMax ?? BASE_STAMINA;
  const nextMax = BASE_STAMINA;
  const delta = nextMax - prevMax;
  const current = actor.stamina ?? nextMax;
  const nextStamina = Math.min(nextMax, Math.max(0, current + delta));
  return {
    ...actor,
    staminaMax: nextMax,
    stamina: nextStamina,
  };
}

function normalizeActors(actors: Actor[], actorIds?: Set<string>): Actor[] {
  return actors.map((actor) => {
    if (actorIds && !actorIds.has(actor.id)) return actor;
    return applyBaseStamina(actor);
  });
}

function applyActorNormalization(
  state: GameState,
  actorIds?: string[]
): Pick<GameState, 'availableActors' | 'tileParties'> {
  const actorIdSet = actorIds ? new Set(actorIds) : undefined;
  return {
    availableActors: normalizeActors(state.availableActors, actorIdSet),
    tileParties: Object.fromEntries(
      Object.entries(state.tileParties).map(([tileId, actors]) => ([
        tileId,
        normalizeActors(actors, actorIdSet),
      ]))
    ),
  };
}

function addTokenCounts(
  base: Record<Element, number>,
  delta: Record<Element, number>
): Record<Element, number> {
  return {
    W: (base.W || 0) + (delta.W || 0),
    E: (base.E || 0) + (delta.E || 0),
    A: (base.A || 0) + (delta.A || 0),
    F: (base.F || 0) + (delta.F || 0),
    D: (base.D || 0) + (delta.D || 0),
    L: (base.L || 0) + (delta.L || 0),
    N: (base.N || 0) + (delta.N || 0),
  };
}

function adjustTokenCount(
  base: Record<Element, number>,
  element: Element,
  delta: number
): Record<Element, number> {
  return {
    ...base,
    [element]: Math.max(0, (base[element] || 0) + delta),
  };
}

function applyTokenReward(
  collectedTokens: Record<Element, number>,
  card: Card
): Record<Element, number> {
  if (!card.tokenReward) return collectedTokens;
  return {
    ...collectedTokens,
    [card.tokenReward]: (collectedTokens[card.tokenReward] || 0) + 1,
  };
}

export function addTokenInstanceToGarden(
  state: GameState,
  token: Token
): GameState {
  return {
    ...state,
    tokens: [...state.tokens, token],
  };
}

export function depositTokenToStash(
  state: GameState,
  tokenId: string
): GameState {
  const token = state.tokens.find((item) => item.id === tokenId);
  if (!token) return state;
  if (token.quantity !== 1) return state;

  const updatedStash = adjustTokenCount(
    state.resourceStash || createEmptyTokenCounts(),
    token.element,
    1
  );

  return {
    ...state,
    tokens: state.tokens.filter((item) => item.id !== tokenId),
    resourceStash: updatedStash,
  };
}

export function withdrawTokenFromStash(
  state: GameState,
  element: Element,
  token: Token
): GameState {
  const stash = state.resourceStash || createEmptyTokenCounts();
  if ((stash[element] || 0) <= 0) return state;

  return {
    ...state,
    resourceStash: adjustTokenCount(stash, element, -1),
    tokens: [...state.tokens, token],
  };
}

function getTokenGridPosition(token: Token): { col: number; row: number } {
  return token.gridPosition ?? { col: 0, row: 0 };
}

function findOpenTilePosition(tiles: Tile[]): { col: number; row: number } {
  return findOpenGridPosition(getOccupiedPositions(tiles));
}

function findOpenActorPosition(tiles: Tile[], actors: Actor[]): { col: number; row: number } {
  return findOpenGridPosition(getOccupiedPositions(tiles, actors));
}

function getPartyForTile(state: GameState, tileId?: string): Actor[] {
  if (!tileId) return [];
  return state.tileParties[tileId] ?? [];
}

function findActorById(state: GameState, actorId: string): Actor | null {
  const available = state.availableActors.find((actor) => actor.id === actorId);
  if (available) return available;
  for (const party of Object.values(state.tileParties)) {
    const match = party.find((actor) => actor.id === actorId);
    if (match) return match;
  }
  return null;
}
export interface PersistedState {
  challengeProgress: ChallengeProgress;
  buildPileProgress: BuildPileProgress[];
  pendingCards: Card[];
  interactionMode: InteractionMode;
  availableActors: Actor[];
  tileParties: Record<string, Actor[]>;
  activeSessionTileId?: string;
  tokens: Token[];
  resourceStash: Record<Element, number>;
  orimDefinitions: OrimDefinition[];
  orimStash: OrimInstance[];
  orimInstances: Record<string, OrimInstance>;
  actorDecks: Record<string, ActorDeckState>;
  noRegretCooldowns?: Record<string, number>;
  noRegretCooldown?: number;
  tiles: Tile[];
}

/**
 * Creates a foundation card for an actor based on their definition.
 * Uses the actor's value as the rank and their suit (or neutral star if no suit).
 */
function createActorFoundationCard(actor: Actor): Card {
  const definition = getActorDefinition(actor.definitionId);
  if (!definition) {
    throw new Error(`Actor definition not found for ${actor.definitionId}`);
  }

  // Use actor's suit, or neutral star if no elemental affinity
  const suit: Suit = definition.suit || '⭐';
  const element: Element = definition.element || SUIT_TO_ELEMENT[suit];
  const rank = actor.currentValue;

  return {
    rank,
    suit,
    element,
    id: `actor-${actor.id}-${Date.now()}-${randomIdSuffix()}`,
  };
}

function createInitialOrimState(actors: Actor[], orimDefinitions: OrimDefinition[]): {
  actorDecks: Record<string, ActorDeckState>;
  orimInstances: Record<string, OrimInstance>;
} {
  const actorDecks: Record<string, ActorDeckState> = {};
  const orimInstances: Record<string, OrimInstance> = {};
  actors.forEach((actor) => {
    const { deck, orimInstances: instances } = createActorDeckStateWithOrim(
      actor.id,
      actor.definitionId,
      orimDefinitions
    );
    actorDecks[actor.id] = deck;
    instances.forEach((instance) => {
      orimInstances[instance.id] = instance;
    });
  });
  return { actorDecks, orimInstances };
}

/**
 * Initializes a fresh game state, starting in the garden phase
 */
export function initializeGame(
  persisted?: Partial<PersistedState>,
  options?: { startPhase?: GamePhase; playtestVariant?: GameState['playtestVariant'] }
): GameState {
  // Don't deal cards yet - we start in the garden
  const persistedKeys = persisted ? Object.keys(persisted) : [];
  const isFreshStart = persistedKeys.length === 0 || persistedKeys.every((key) => key === 'orimDefinitions');
  const ensureActorLevel = (actor: Actor): Actor => ({
    ...actor,
    level: actor.level ?? 1,
  });
  const ensureActorEnergy = (actor: Actor): Actor => ({
    ...actor,
    energyMax: actor.energyMax ?? 3,
    energy: actor.energy ?? (actor.energyMax ?? 3),
  });
  const ensureActorHp = (actor: Actor): Actor => ({
    ...actor,
    hpMax: actor.hpMax ?? 10,
    hp: actor.hp ?? (actor.hpMax ?? 10),
    damageTaken: actor.damageTaken ?? 0,
  });
  const ensureActorPower = (actor: Actor): Actor => ({
    ...actor,
    powerMax: actor.powerMax ?? 3,
    power: actor.power ?? 0,
  });
  const applyActorOrimTemplates = (
    actors: Actor[],
    orimDefinitions: OrimDefinition[]
  ): { actors: Actor[]; instances: Record<string, OrimInstance> } => {
    const instances: Record<string, OrimInstance> = {};
    const nextActors = actors.map((actor) => {
      if (!isFreshStart && actor.orimSlots && actor.orimSlots.length > 0) {
        return actor;
      }
      const definition = getActorDefinition(actor.definitionId);
      const templateSlots = definition?.orimSlots ?? [];
      if (templateSlots.length === 0) return actor;
      const slots: OrimSlot[] = templateSlots.map((slot, index) => {
        let orimInstanceId: string | null = null;
        if (slot.orimId) {
          const def = orimDefinitions.find((item) => item.id === slot.orimId);
          if (def) {
            const instance: OrimInstance = {
              id: `orim-${def.id}-${Date.now()}-${randomIdSuffix()}`,
              definitionId: def.id,
            };
            instances[instance.id] = instance;
            orimInstanceId = instance.id;
          }
        }
        return {
          id: `${actor.id}-orim-slot-${index + 1}`,
          orimId: orimInstanceId,
          locked: slot.locked ?? false,
        };
      });
      return { ...actor, orimSlots: slots };
    });
    return { actors: nextActors, instances };
  };
  const ensureActorOrimSlots = (actor: Actor): Actor => {
    if (actor.orimSlots && actor.orimSlots.length > 0) return actor;
    return {
      ...actor,
      orimSlots: [
        {
          id: `${actor.id}-orim-slot-1`,
          orimId: null,
          locked: false,
        },
      ],
    };
  };
  const migrateActorDefinitionId = (actor: Actor): Actor => {
    if (actor.definitionId !== 'fennec') return actor;
    return { ...actor, definitionId: 'fox' };
  };
  const mergeOrimDefinitions = (
    baseDefinitions: OrimDefinition[],
    persistedDefinitions?: OrimDefinition[]
  ): OrimDefinition[] => {
    if (!persistedDefinitions || persistedDefinitions.length === 0) {
      return baseDefinitions;
    }
    const merged = new Map<string, OrimDefinition>();
    baseDefinitions.forEach((definition) => merged.set(definition.id, definition));
    const legacyCombatIds = new Set(['scratch', 'bite', 'claw']);
    persistedDefinitions.forEach((definition) => {
      const base = merged.get(definition.id);
      const legacyDomain = legacyCombatIds.has(definition.id) ? 'combat' : 'puzzle';
      merged.set(definition.id, {
        ...(base ?? definition),
        ...definition,
        domain: definition.domain ?? base?.domain ?? legacyDomain,
      });
    });
    return Array.from(merged.values());
  };
  const orimDefinitions = mergeOrimDefinitions(ORIM_DEFINITIONS, persisted?.orimDefinitions);
  const baseActors = (persisted?.availableActors || createInitialActors()).map((actor) =>
    ensureActorPower(
      ensureActorHp(
        ensureActorEnergy(
          ensureActorLevel(migrateActorDefinitionId(actor))
        )
      )
    )
  );
  const templatedActors = applyActorOrimTemplates(baseActors, orimDefinitions);
  const finalizedActors = templatedActors.actors.map(ensureActorOrimSlots);
  const orimState = createInitialOrimState(finalizedActors, orimDefinitions);
  const actorDecksRaw = persisted?.actorDecks ?? orimState.actorDecks;
  const actorDecks = Object.fromEntries(
    Object.entries(actorDecksRaw).map(([actorId, deck]) => ([
      actorId,
      {
        ...deck,
        cards: deck.cards.map((card) => ({
          ...card,
          cooldown: card.cooldown ?? 0,
          maxCooldown: card.maxCooldown ?? 5,
        })),
      },
    ]))
  );
  const orimInstances = persisted?.orimInstances ?? {
    ...orimState.orimInstances,
    ...templatedActors.instances,
  };
  const baseParties = persisted?.tileParties
    ? Object.fromEntries(
      Object.entries(persisted.tileParties).map(([tileId, actors]) => ([
        tileId,
        actors.map((actor) => ensureActorPower(
          ensureActorHp(
            ensureActorEnergy(
              ensureActorLevel(
                ensureActorOrimSlots(migrateActorDefinitionId(actor))
              )
            )
          )
        )),
      ]))
    )
    : {};
  const baseState: GameState = {
    tableaus: [],
    foundations: [],
    stock: [],
    activeEffects: [],
    turnCount: 0,
    pendingCards: persisted?.pendingCards || [],
    phase: options?.startPhase ?? 'garden', // Start in garden unless overridden
    challengeProgress: persisted?.challengeProgress || createInitialProgress(),
    buildPileProgress: persisted?.buildPileProgress || createInitialBuildPileProgress(),
    interactionMode: (options?.playtestVariant === 'party-foundations' || options?.playtestVariant === 'party-battle'
      ? 'dnd'
      : (persisted?.interactionMode || 'click')),
    availableActors: finalizedActors,
    tileParties: baseParties,
    activeSessionTileId: persisted?.activeSessionTileId,
    tokens: persisted?.tokens || createInitialTokens(),
    collectedTokens: createEmptyTokenCounts(),
    resourceStash: persisted?.resourceStash || createEmptyTokenCounts(),
    orimDefinitions,
    orimStash: persisted?.orimStash || [],
    orimInstances,
    actorDecks,
    actorCombos: persisted?.actorCombos ?? {},
    noRegretCooldown: typeof persisted?.noRegretCooldown === 'number'
      ? persisted.noRegretCooldown
      : Math.max(0, ...Object.values(persisted?.noRegretCooldowns ?? {})),
    lastCardActionSnapshot: undefined,
    tiles: persisted?.tiles || createInitialTiles(),
    blueprints: [], // Player's blueprint library
    pendingBlueprintCards: [], // Blueprints in chaos state
    playtestVariant: options?.playtestVariant ?? 'party-foundations',
  };

  if (!isFreshStart) return baseState;

  const randomWildsTile = baseState.tiles.find((tile) => tile.definitionId === 'random_wilds') || null;
  if (!randomWildsTile) return baseState;

  const partyDefinitionIds = ['fox', 'wolf', 'owl'];
  const queuedActors = baseState.availableActors.filter((actor) =>
    partyDefinitionIds.includes(actor.definitionId)
  );
  if (queuedActors.length === 0) return baseState;

  const queuedActorIds = new Set(queuedActors.map((actor) => actor.id));

  const prequeuedState: GameState = {
    ...baseState,
    availableActors: baseState.availableActors.filter((actor) => !queuedActorIds.has(actor.id)),
    tileParties: {
      ...baseState.tileParties,
      [randomWildsTile.id]: queuedActors,
    },
  };

  return startBiome(prequeuedState, randomWildsTile.id, 'random_wilds');
}

/**
 * Starts an adventure - deals cards and transitions to playing phase
 * Foundations are created based on the actors in the adventure party
 * Uses karma dealing to ensure a minimum number of playable moves
 */
export function startAdventure(state: GameState, tileId: string): GameState {
  if (state.activeSessionTileId && state.activeSessionTileId !== tileId) return state;
  const partyActors = getPartyForTile(state, tileId);
  const foundationActors = clampPartyForFoundations(partyActors);
  if (foundationActors.length === 0) return state;
  const tile = state.tiles.find((entry) => entry.id === tileId);
  const isForest01 = isForestPuzzleTile(tile?.definitionId);

  // Create foundations based on the adventure party (these don't change between redeals)
  const foundations: Card[][] = isForest01
    ? [[createCardFromElement('N', 9)]]
    : foundationActors.map(actor => [
      createActorFoundationCard(actor),
    ]);

  let tableaus: Card[][] = [];
  let stock: Card[] = [];

  if (isForest01) {
    const row1 = [
      { rank: 11, element: 'N' as Element },
      { rank: 12, element: 'N' as Element },
      { rank: 13, element: 'N' as Element },
      { rank: 1, element: 'E' as Element },
      { rank: 2, element: 'N' as Element },
      { rank: 3, element: 'W' as Element },
    ];
    const row2 = [
      { rank: 10, element: 'E' as Element },
      { rank: 9, element: 'N' as Element },
      { rank: 8, element: 'N' as Element },
      { rank: 7, element: 'N' as Element },
      { rank: 6, element: 'N' as Element },
      null,
    ];
    const row3 = [
      { rank: 8, element: 'N' as Element },
      { rank: 7, element: 'N' as Element },
      { rank: 6, element: 'N' as Element },
      { rank: 5, element: 'N' as Element },
      { rank: 4, element: 'N' as Element },
      { rank: 5, element: 'W' as Element },
    ];

    const buildCard = (entry: { rank: number; element: Element }) => {
      const card = createCardFromElement(entry.element, entry.rank);
      return entry.element !== 'N' ? { ...card, tokenReward: entry.element } : card;
    };

    tableaus = row1.map((entry, index) => {
      const stack: Card[] = [];
      if (entry) stack.push(buildCard(entry));
      const mid = row2[index];
      if (mid) stack.push(buildCard(mid));
      const top = row3[index];
      if (top) stack.push(buildCard(top));
      return stack;
    });
    stock = [];
  } else {
    // Keep dealing until karma requirements are met
    let attempts = 0;

    do {
      const deck = shuffleDeck(createDeck());
      tableaus = Array.from({ length: GAME_CONFIG.tableauCount }, () =>
        deck.splice(0, GAME_CONFIG.cardsPerTableau)
      );
      stock = deck;
      attempts++;
    } while (!checkKarmaDealing(tableaus, foundations, state.activeEffects) && attempts < MAX_KARMA_DEALING_ATTEMPTS);
  }

  return {
    ...state,
    tableaus,
    foundations,
    stock,
    phase: 'playing',
    activeSessionTileId: tileId,
    turnCount: 0,
    collectedTokens: createEmptyTokenCounts(),
  };
}

export function processEffects(effects: Effect[]): Effect[] {
  return effects
    .map((effect) => ({
      ...effect,
      duration: effect.duration > 0 ? effect.duration - 1 : effect.duration,
    }))
    .filter((effect) => effect.duration !== 0);
}

export function playCard(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  const tableau = state.tableaus[tableauIndex];
  if (tableau.length === 0) return null;

  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  const foundationActor = partyActors[foundationIndex];
  if (!card.sourceActorId && foundationActor && foundationActor.stamina <= 0) return null;

  const card = tableau[tableau.length - 1];
  const foundationTop = state.foundations[foundationIndex][state.foundations[foundationIndex].length - 1];

  if (!canPlayCard(card, foundationTop, state.activeEffects)) {
    return null;
  }

  const newTableaus = state.tableaus.map((t, i) =>
    i === tableauIndex ? t.slice(0, -1) : t
  );

  const newFoundations = state.foundations.map((f, i) =>
    i === foundationIndex ? [...f, card] : f
  );

  const nextState = {
    ...state,
    tableaus: newTableaus,
    foundations: newFoundations,
    activeEffects: processEffects(state.activeEffects),
    turnCount: state.turnCount + 1,
    collectedTokens: applyTokenReward(
      state.collectedTokens || createEmptyTokenCounts(),
      card
    ),
  };
  const recorded = recordCardAction(state, nextState);
  if (!foundationActor) return recorded;
  return applyOrimTiming(recorded, 'play', foundationActor.id, {
    card,
    foundationIndex,
  });
}

function createEnemyFoundationCard(seed: { id: string; rank: number; suit: Suit; element: Element }): Card {
  return {
    rank: seed.rank,
    suit: seed.suit,
    element: seed.element,
    id: `${seed.id}-${Date.now()}-${randomIdSuffix()}`,
  };
}

function createDefaultEnemyFoundations(): Card[][] {
  return DEFAULT_ENEMY_FOUNDATION_SEEDS.map((seed) => [createEnemyFoundationCard(seed)]);
}

export function playCardFromHand(
  state: GameState,
  card: Card,
  foundationIndex: number,
  useWild = false
): GameState | null {
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  const foundationActor = partyActors[foundationIndex];
  // Cooldown disabled for now.

  const foundation = state.foundations[foundationIndex];
  const foundationCount = state.foundations.length;

  const newFoundations = state.foundations.map((f, i) =>
    i === foundationIndex ? [...f, card] : f
  );

  const combos = incrementFoundationCombos(state, foundationIndex);
  const cooldownTicked = foundationActor
    ? reduceDeckCooldowns(
      { ...state, actorDecks: state.actorDecks },
      foundationActor.id,
      1
    )
    : state.actorDecks;
  const updatedDecks = card.sourceActorId && card.sourceDeckCardId
    ? setDeckCardCooldown({ ...state, actorDecks: cooldownTicked }, card.sourceActorId, card.sourceDeckCardId)
    : cooldownTicked;

  if (!useWild) {
    const nextState = {
      ...state,
      foundations: newFoundations,
      activeEffects: processEffects(state.activeEffects),
      turnCount: state.turnCount + 1,
      collectedTokens: applyTokenReward(
        state.collectedTokens || createEmptyTokenCounts(),
        card
      ),
      foundationCombos: combos,
      actorDecks: updatedDecks,
    };
    const recorded = recordCardAction(state, nextState);
    if (!foundationActor) return recorded;
    return applyOrimTiming(recorded, 'play', foundationActor.id, {
      card,
      foundationIndex,
    });
  }

  const newCombos = combos;

  const tokensSeed = state.foundationTokens && state.foundationTokens.length === foundationCount
    ? state.foundationTokens
    : Array.from({ length: foundationCount }, () => createEmptyTokenCounts());
  const newFoundationTokens = tokensSeed.map((tokens, i) => {
    if (i !== foundationIndex || !card.tokenReward) return { ...tokens };
    return {
      ...tokens,
      [card.tokenReward]: (tokens[card.tokenReward] || 0) + 1,
    };
  });

  const newCollectedTokens = applyTokenReward(
    state.collectedTokens || createEmptyTokenCounts(),
    card
  );

  const nextState = {
    ...state,
    foundations: newFoundations,
    activeEffects: processEffects(state.activeEffects),
    turnCount: state.turnCount + 1,
    biomeMovesCompleted: (state.biomeMovesCompleted || 0) + 1,
    collectedTokens: newCollectedTokens,
    foundationCombos: newCombos,
    foundationTokens: newFoundationTokens,
    actorDecks: updatedDecks,
  };
  const recorded = recordCardAction(state, nextState);
  if (!foundationActor) return recorded;
  return applyOrimTiming(recorded, 'play', foundationActor.id, {
    card,
    foundationIndex,
  });
}

export function playCardFromStock(
  state: GameState,
  foundationIndex: number,
  useWild = false,
  force = false,
  consumeStock = true
): GameState | null {
  const stockCard = state.stock[state.stock.length - 1];
  if (!stockCard) return null;

  if (!force) {
    const foundationTop = state.foundations[foundationIndex][state.foundations[foundationIndex].length - 1];
    const canPlay = useWild
      ? canPlayCardWithWild(stockCard, foundationTop, state.activeEffects)
      : canPlayCard(stockCard, foundationTop, state.activeEffects);
    if (!canPlay) return null;
  }

  const nextState = playCardFromHand(state, stockCard, foundationIndex, useWild);
  if (!nextState) return null;

  if (!consumeStock) {
    return nextState;
  }

  return {
    ...nextState,
    stock: state.stock.slice(0, -1),
  };
}

export function rewindLastCardAction(state: GameState): GameState {
  const snapshot = state.lastCardActionSnapshot;
  if (!snapshot) return state;
  const currentCooldown = state.noRegretCooldown ?? 0;
  if (currentCooldown > 0) return state;

  return {
    ...snapshot,
    noRegretCooldown: NO_REGRET_COOLDOWN,
    lastCardActionSnapshot: undefined,
  };
}

export function addEffect(
  state: GameState,
  effectId: string,
  name: string,
  type: EffectType,
  duration: number,
  config: Record<string, unknown> = {}
): GameState {
  return {
    ...state,
    activeEffects: [
      ...state.activeEffects,
      { id: effectId, name, type, duration, config },
    ],
  };
}

export function checkWin(state: GameState): boolean {
  return state.tableaus.every((t) => t.length === 0);
}

export function checkNoValidMoves(state: GameState): boolean {
  return !state.tableaus.some((tableau) => {
    if (tableau.length === 0) return false;
    const topCard = tableau[tableau.length - 1];
    return state.foundations.some((foundation) =>
      canPlayCard(topCard, foundation[foundation.length - 1], state.activeEffects)
    );
  });
}

export function getTableauCanPlay(state: GameState): boolean[] {
  return state.tableaus.map((tableau) => {
    if (tableau.length === 0) return false;
    const topCard = tableau[tableau.length - 1];
    return state.foundations.some((foundation) =>
      canPlayCard(topCard, foundation[foundation.length - 1], state.activeEffects)
    );
  });
}

export function getValidFoundationsForCard(
  state: GameState,
  card: Card
): boolean[] {
  return state.foundations.map((foundation) =>
    canPlayCard(card, foundation[foundation.length - 1], state.activeEffects)
  );
}

export function returnToGarden(state: GameState): GameState {
  const updatedResourceStash = addTokenCounts(
    state.resourceStash || createEmptyTokenCounts(),
    state.collectedTokens || createEmptyTokenCounts()
  );

  const activeParty = getPartyForTile(state, state.activeSessionTileId);
  const updatedTileParties = state.activeSessionTileId
    ? { ...state.tileParties, [state.activeSessionTileId]: [] }
    : state.tileParties;
  const newAvailableActors = activeParty.length > 0
    ? [...state.availableActors, ...activeParty]
    : state.availableActors;

  return {
    ...state,
    tableaus: [],
    foundations: [],
    stock: [],
    pendingCards: [],
    phase: 'garden',
    availableActors: newAvailableActors,
    tileParties: updatedTileParties,
    activeSessionTileId: undefined,
    collectedTokens: createEmptyTokenCounts(),
    resourceStash: updatedResourceStash,
    currentBiome: undefined,
    biomeMovesCompleted: undefined,
    nodeTableau: undefined,
    pendingBlueprintCards: [],
    foundationCombos: undefined,
    foundationTokens: undefined,
    randomBiomeTurnNumber: undefined,
  };
}

export function abandonSession(state: GameState): GameState {
  const activeParty = getPartyForTile(state, state.activeSessionTileId);
  const updatedTileParties = state.activeSessionTileId
    ? { ...state.tileParties, [state.activeSessionTileId]: [] }
    : state.tileParties;
  const newAvailableActors = activeParty.length > 0
    ? [...state.availableActors, ...activeParty]
    : state.availableActors;

  return {
    ...state,
    tableaus: [],
    foundations: [],
    stock: [],
    phase: 'garden',
    availableActors: newAvailableActors,
    tileParties: updatedTileParties,
    activeSessionTileId: undefined,
    collectedTokens: createEmptyTokenCounts(),
    currentBiome: undefined,
    biomeMovesCompleted: undefined,
    nodeTableau: undefined,
    pendingBlueprintCards: [],
    foundationCombos: undefined,
    foundationTokens: undefined,
    randomBiomeTurnNumber: undefined,
  };
}

/**
 * Assigns an actor (or their stack) to the party slot
 */
export function assignActorToParty(
  state: GameState,
  tileId: string,
  actorId: string
): GameState | null {
  const actor = state.availableActors.find(a => a.id === actorId);
  if (!actor) return null;

  const selectedActors = actor.stackId
    ? state.availableActors
        .filter(a => a.stackId === actor.stackId)
        .sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0))
    : [actor];

  const selectedIds = new Set(selectedActors.map(a => a.id));
  const remainingAvailable = state.availableActors.filter(a => !selectedIds.has(a.id));

  const updatedTileParties = Object.entries(state.tileParties).reduce<Record<string, Actor[]>>(
    (acc, [id, party]) => {
      acc[id] = party.filter((partyActor) => !selectedIds.has(partyActor.id));
      return acc;
    },
    {}
  );

  const updatedParty = selectedActors.map(a => ({
    ...a,
    homeTileId: undefined,
  }));
  const priorParty = getPartyForTile(state, tileId);
  const mergedParty = [...priorParty, ...updatedParty].filter(
    (value, index, self) => self.findIndex((actorItem) => actorItem.id === value.id) === index
  );

  const updatedTiles = state.tiles.map(tile => {
    const hasSelected = tile.actorHomeSlots.some(slot =>
      selectedIds.has(slot.actorId ?? '')
    );
    if (!hasSelected) return tile;

    const updatedHomeSlots = tile.actorHomeSlots.map(slot =>
      selectedIds.has(slot.actorId ?? '') ? { ...slot, actorId: null } : slot
    );
    return { ...tile, actorHomeSlots: updatedHomeSlots };
  });

  return {
    ...state,
    availableActors: remainingAvailable,
    tileParties: {
      ...updatedTileParties,
      [tileId]: mergedParty,
    },
    tiles: updatedTiles,
  };
}

/**
 * Clears the current party back to available actors
 */
export function clearParty(
  state: GameState,
  tileId: string
): GameState {
  const party = getPartyForTile(state, tileId);
  if (party.length === 0) return state;
  return {
    ...state,
    availableActors: [...state.availableActors, ...party],
    tileParties: {
      ...state.tileParties,
      [tileId]: [],
    },
  };
}

/**
 * Removes a single actor from the party back to available, with a new grid position.
 */
export function detachActorFromParty(
  state: GameState,
  tileId: string,
  actorId: string,
  col: number,
  row: number
): GameState {
  const party = getPartyForTile(state, tileId);
  const actorIndex = party.findIndex(actor => actor.id === actorId);
  if (actorIndex === -1) return state;

  const actor = party[actorIndex];
  const updatedParty = [
    ...party.slice(0, actorIndex),
    ...party.slice(actorIndex + 1),
  ];

  const updatedActor = {
    ...actor,
    gridPosition: { col, row },
  };

  return {
    ...state,
    tileParties: {
      ...state.tileParties,
      [tileId]: updatedParty,
    },
    availableActors: [...state.availableActors, updatedActor],
  };
}

/**
 * Assigns a pending card to the current challenge.
 * Returns null if card is not in pending or doesn't match challenge requirements.
 */
export function assignCardToChallenge(
  state: GameState,
  cardId: string
): GameState | null {
  const cardIndex = state.pendingCards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return null;

  const card = state.pendingCards[cardIndex];

  // Update challenge progress
  const newCollected = { ...state.challengeProgress.collected };
  newCollected[card.suit]++;

  // Remove card from pending
  const newPendingCards = [
    ...state.pendingCards.slice(0, cardIndex),
    ...state.pendingCards.slice(cardIndex + 1),
  ];

  return {
    ...state,
    pendingCards: newPendingCards,
    challengeProgress: {
      ...state.challengeProgress,
      collected: newCollected,
    },
  };
}

/**
 * Assigns a pending card to a build pile.
 * Returns null if card cannot be added to the pile.
 */
export function assignCardToBuildPile(
  state: GameState,
  cardId: string,
  buildPileId: string
): GameState | null {
  const cardIndex = state.pendingCards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return null;

  const card = state.pendingCards[cardIndex];
  const pileIndex = state.buildPileProgress.findIndex((p) => p.definitionId === buildPileId);
  if (pileIndex === -1) return null;

  const pile = state.buildPileProgress[pileIndex];
  const definition = getBuildPileDefinition(pile);
  if (!definition) return null;

  const updatedPile = addCardToBuildPile(card, pile, definition);
  if (!updatedPile) return null;

  // Remove card from pending
  const newPendingCards = [
    ...state.pendingCards.slice(0, cardIndex),
    ...state.pendingCards.slice(cardIndex + 1),
  ];

  // Update build pile progress
  const newBuildPileProgress = [
    ...state.buildPileProgress.slice(0, pileIndex),
    updatedPile,
    ...state.buildPileProgress.slice(pileIndex + 1),
  ];

  return {
    ...state,
    pendingCards: newPendingCards,
    buildPileProgress: newBuildPileProgress,
  };
}

/**
 * Toggles between click and drag-and-drop interaction modes.
 */
export function toggleInteractionMode(state: GameState): GameState {
  return {
    ...state,
    interactionMode: state.interactionMode === 'click' ? 'dnd' : 'click',
  };
}

/**
 * Applies a sequence of moves to the game state.
 * Used by the auto-solve feature to execute all optimal moves at once.
 */
export function applyMoves(state: GameState, moves: Move[]): GameState {
  let currentState = state;

  for (const move of moves) {
    const newTableaus = currentState.tableaus.map((t, i) =>
      i === move.tableauIndex ? t.slice(0, -1) : t
    );

    const newFoundations = currentState.foundations.map((f, i) =>
      i === move.foundationIndex ? [...f, move.card] : f
    );

    currentState = {
      ...currentState,
      tableaus: newTableaus,
      foundations: newFoundations,
      turnCount: currentState.turnCount + 1,
      collectedTokens: applyTokenReward(
        currentState.collectedTokens || createEmptyTokenCounts(),
        move.card
      ),
    };
  }

  // Process effects once at the end (or we could process per move)
  return {
    ...currentState,
    activeEffects: processEffects(currentState.activeEffects),
  };
}

/**
 * Clears all progress (phases and build piles), resetting to initial state.
 * Also clears pending cards since they're no longer relevant.
 */
export function clearAllGameProgress(state: GameState): GameState {
  return {
    ...state,
    challengeProgress: clearAllProgressFn(),
    buildPileProgress: clearAllBuildPileProgress(),
    pendingCards: [],
  };
}

/**
 * Clears progress for a specific phase.
 * Does not clear pending cards as they may be used for other phases.
 */
export function clearPhaseGameProgress(state: GameState, phaseId: number): GameState {
  return {
    ...state,
    challengeProgress: clearPhaseProgressFn(state.challengeProgress, phaseId),
  };
}

/**
 * Clears progress for a specific build pile.
 */
export function clearBuildPileGameProgress(state: GameState, buildPileId: string): GameState {
  return {
    ...state,
    buildPileProgress: clearBuildPileProgressFn(state.buildPileProgress, buildPileId),
  };
}

/**
 * Assigns a pending card to a tile slot.
 * Returns null if card cannot be added to the slot.
 */
export function assignCardToTileSlot(
  state: GameState,
  cardId: string,
  tileId: string,
  slotId: string
): GameState | null {
  const cardIndex = state.pendingCards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return null;

  const card = state.pendingCards[cardIndex];
  const tileIndex = state.tiles.findIndex((mc) => mc.id === tileId);
  if (tileIndex === -1) return null;

  const tile = state.tiles[tileIndex];

  // Validate slot exists and card can be added
  const slot = findSlotById(tile, slotId);
  if (!slot || !canAddCardToSlot(card, slot)) return null;

  const updatedTile = addCardToTile(tile, slotId, card);
  if (!updatedTile) return null;

  // Remove card from pending
  const newPendingCards = [
    ...state.pendingCards.slice(0, cardIndex),
    ...state.pendingCards.slice(cardIndex + 1),
  ];

  // Check if tile was just completed - trigger upgrade
  const finalTile = updatedTile.isComplete
    ? upgradeTile(updatedTile)
    : updatedTile;

  // Update tiles array
  const newTiles = [
    ...state.tiles.slice(0, tileIndex),
    finalTile,
    ...state.tiles.slice(tileIndex + 1),
  ];

  return {
    ...state,
    pendingCards: newPendingCards,
    tiles: newTiles,
  };
}

/**
 * Assigns a token to a tile slot.
 * Returns null if token cannot be added to the slot.
 */
export function assignTokenToTileSlot(
  state: GameState,
  tokenId: string,
  tileId: string,
  slotId: string
): GameState | null {
  const tokenIndex = state.tokens.findIndex((t) => t.id === tokenId);
  if (tokenIndex === -1) return null;

  const token = state.tokens[tokenIndex];
  if (token.quantity !== 1) return null;

  const tileIndex = state.tiles.findIndex((mc) => mc.id === tileId);
  if (tileIndex === -1) return null;

  const tile = state.tiles[tileIndex];
  const slot = findSlotById(tile, slotId);
  if (!slot) return null;

  const suit = ELEMENT_TO_SUIT[token.element];
  const tokenCard: Card = {
    id: `token-slot-${token.id}`,
    rank: 1,
    suit,
    element: token.element,
  };

  if (!canAddCardToSlot(tokenCard, slot)) return null;

  const updatedTile = addCardToTile(tile, slotId, tokenCard);
  if (!updatedTile) return null;

  const finalTile = updatedTile.isComplete
    ? upgradeTile(updatedTile)
    : updatedTile;

  const newTiles = [
    ...state.tiles.slice(0, tileIndex),
    finalTile,
    ...state.tiles.slice(tileIndex + 1),
  ];

  const newTokens = [
    ...state.tokens.slice(0, tokenIndex),
    ...state.tokens.slice(tokenIndex + 1),
  ];

  return {
    ...state,
    tokens: newTokens,
    tiles: newTiles,
  };
}

/**
 * Clears progress for a specific tile.
 */
export function clearTileGameProgress(state: GameState, tileId: string): GameState {
  return {
    ...state,
    tiles: clearTileProgressFn(state.tiles, tileId),
  };
}

/**
 * Assigns an actor to a tile home slot
 */
export function assignActorToTileHome(
  state: GameState,
  actorId: string,
  tileId: string,
  slotId: string
): GameState | null {
  const detachedActors = removeActorFromStack(state.availableActors, actorId);
  const actorIndex = detachedActors.findIndex(a => a.id === actorId);
  if (actorIndex === -1) return null;

  const tileIndex = state.tiles.findIndex(mc => mc.id === tileId);
  if (tileIndex === -1) return null;

  const tile = state.tiles[tileIndex];
  if (!canAssignActorToHomeSlot(tile, slotId)) return null;

  // Update actor to track home
  const updatedActors = [...detachedActors];
  updatedActors[actorIndex] = {
    ...updatedActors[actorIndex],
    homeTileId: tileId,
  };

  // Update tile home slot
  const updatedHomeSlots = tile.actorHomeSlots.map(slot =>
    slot.id === slotId ? { ...slot, actorId } : slot
  );

  const updatedTiles = [...state.tiles];
  updatedTiles[tileIndex] = {
    ...tile,
    actorHomeSlots: updatedHomeSlots,
  };

  return {
    ...state,
    availableActors: updatedActors,
    tiles: updatedTiles,
  };
}

/**
 * Removes an actor from all tile home slots (particularly Forest)
 */
export function removeActorFromTileHome(
  state: GameState,
  actorId: string
): GameState {
  const updatedTiles = state.tiles.map(tile => {
    // Check if this tile has the actor in any of its home slots
    const hasActor = tile.actorHomeSlots.some(slot => slot.actorId === actorId);
    if (!hasActor) return tile;

    // Remove actor from home slots
    const updatedHomeSlots = tile.actorHomeSlots.map(slot =>
      slot.actorId === actorId ? { ...slot, actorId: null } : slot
    );

    return {
      ...tile,
      actorHomeSlots: updatedHomeSlots,
    };
  });

  return {
    ...state,
    tiles: updatedTiles,
  };
}

/**
 * Updates the grid position of a tile
 */
export function updateTilePosition(
  state: GameState,
  tileId: string,
  col: number,
  row: number
): GameState {
  const tiles = updateItemInArray(state.tiles, tileId, tile => ({
    ...tile,
    gridPosition: { col: Math.round(col), row: Math.round(row) },
  }));
  return tiles === state.tiles ? state : { ...state, tiles };
}

export function updateTileWatercolorConfig(
  state: GameState,
  tileId: string,
  watercolorConfig: Tile['watercolorConfig']
): GameState {
  const tiles = updateItemInArray(state.tiles, tileId, tile => ({
    ...tile,
    watercolorConfig: watercolorConfig ?? null,
  }));
  return tiles === state.tiles ? state : { ...state, tiles };
}

/**
 * Toggles a tile's lock state.
 */
export function toggleTileLock(
  state: GameState,
  tileId: string
): GameState {
  const tileIndex = state.tiles.findIndex(mc => mc.id === tileId);
  if (tileIndex === -1) return state;

  const current = state.tiles[tileIndex];
  const isLocked = current.isLocked !== false;
  const updatedTile = {
    ...current,
    isLocked: !isLocked,
  };

  const newTiles = [
    ...state.tiles.slice(0, tileIndex),
    updatedTile,
    ...state.tiles.slice(tileIndex + 1),
  ];

  return {
    ...state,
    tiles: newTiles,
  };
}

export function removeTileFromGarden(state: GameState, tileId: string): GameState {
  const tile = state.tiles.find((entry) => entry.id === tileId);
  if (!tile) return state;
  const updatedTiles = state.tiles.filter((entry) => entry.id !== tileId);
  const updatedParties = { ...state.tileParties };
  delete updatedParties[tileId];
  const updatedActors = state.availableActors.map((actor) => {
    if (actor.homeTileId !== tileId) return actor;
    return { ...actor, homeTileId: undefined };
  });
  return {
    ...state,
    tiles: updatedTiles,
    tileParties: updatedParties,
    activeSessionTileId: state.activeSessionTileId === tileId ? undefined : state.activeSessionTileId,
    availableActors: updatedActors,
  };
}

/**
 * Updates the grid position of an available actor
 */
export function updateActorPosition(
  state: GameState,
  actorId: string,
  col: number,
  row: number
): GameState {
  const actorIndex = state.availableActors.findIndex(a => a.id === actorId);
  if (actorIndex === -1) return state;

  const actor = state.availableActors[actorIndex];
  if (actor.stackId) {
    const updatedActors = state.availableActors.map((item) =>
      item.stackId === actor.stackId ? { ...item, gridPosition: { col, row } } : item
    );
    return {
      ...state,
      availableActors: updatedActors,
    };
  }

  const updatedActor = {
    ...actor,
    gridPosition: { col, row },
  };

  const newAvailableActors = [
    ...state.availableActors.slice(0, actorIndex),
    updatedActor,
    ...state.availableActors.slice(actorIndex + 1),
  ];

  return {
    ...state,
    availableActors: newAvailableActors,
  };
}

/**
 * Updates the grid position of a token
 */
export function updateTokenPosition(
  state: GameState,
  tokenId: string,
  col: number,
  row: number
): GameState {
  const tokens = updateItemInArray(state.tokens, tokenId, token => ({
    ...token,
    gridPosition: { col, row },
  }));
  return tokens === state.tokens ? state : { ...state, tokens };
}

export function addTileToGarden(
  state: GameState,
  definitionId: string
): GameState {
  return addTileToGardenAt(state, definitionId);
}

export function addTileToGardenAt(
  state: GameState,
  definitionId: string,
  position?: { col: number; row: number }
): GameState {
  const tile = createTile(definitionId);
  if (!tile) return state;
  tile.isLocked = false;
  tile.gridPosition = position ?? findOpenTilePosition(state.tiles);
  return {
    ...state,
    tiles: [...state.tiles, tile],
  };
}

export function addActorToGarden(
  state: GameState,
  definitionId: string
): GameState {
  const actor = createActor(definitionId);
  if (!actor) return state;
  actor.gridPosition = findOpenActorPosition(state.tiles, state.availableActors);
  return {
    ...state,
    availableActors: [...state.availableActors, actor],
  };
}

export function addTokenToGarden(
  state: GameState,
  element: Element,
  count = 1
): GameState {
  if (count <= 0) return state;

  const base = findOpenActorPosition(state.tiles, state.availableActors);
  const offsets = [
    { col: 0, row: 0 },
    { col: 0.2, row: 0 },
    { col: 0, row: 0.2 },
    { col: 0.2, row: 0.2 },
    { col: 0.4, row: 0 },
    { col: 0, row: 0.4 },
  ];
  const newTokens = Array.from({ length: count }, (_, index) => {
    const offset = offsets[index % offsets.length];
    return {
      ...createToken(element, 1),
      gridPosition: { col: base.col + offset.col, row: base.row + offset.row },
    };
  });

  return {
    ...state,
    tokens: [...state.tokens, ...newTokens],
  };
}

export function stackTokenOnToken(
  state: GameState,
  draggedTokenId: string,
  targetTokenId: string
): GameState {
  if (draggedTokenId === targetTokenId) return state;

  const draggedToken = state.tokens.find(token => token.id === draggedTokenId);
  const targetToken = state.tokens.find(token => token.id === targetTokenId);
  if (!draggedToken || !targetToken) return state;
  if (draggedToken.element !== targetToken.element) return state;
  if (draggedToken.quantity === 5 || targetToken.quantity === 5) return state;

  const anchorPosition = getTokenGridPosition(targetToken);
  const proximityThreshold = TOKEN_PROXIMITY_THRESHOLD;
  const candidateTokens = state.tokens.filter((token) => {
    if (token.element !== targetToken.element || token.quantity !== 1) return false;
    const pos = getTokenGridPosition(token);
    const dx = pos.col - anchorPosition.col;
    const dy = pos.row - anchorPosition.row;
    return Math.hypot(dx, dy) <= proximityThreshold;
  });

  const clusterIds = new Set(candidateTokens.map((token) => token.id));
  clusterIds.add(draggedToken.id);
  clusterIds.add(targetToken.id);
  const cluster = state.tokens.filter((token) => clusterIds.has(token.id) && token.quantity === 1);

  if (cluster.length < 5) {
    const clusterCount = cluster.length;
    const offsetPatterns = [
      { x: 0.18, y: 0 },
      { x: -0.18, y: 0 },
      { x: 0, y: 0.18 },
      { x: 0, y: -0.18 },
      { x: 0.22, y: 0.22 },
    ];
    const offset = offsetPatterns[clusterCount % offsetPatterns.length];
    const newPosition = {
      col: anchorPosition.col + offset.x,
      row: anchorPosition.row + offset.y,
    };
    const updatedTokens = state.tokens.map((token) =>
      token.id === draggedToken.id
        ? { ...token, gridPosition: newPosition }
        : token
    );
    return {
      ...state,
      tokens: updatedTokens,
    };
  }

  const mergeTokens = cluster.slice(0, 5);
  const mergedIds = new Set(mergeTokens.map((token) => token.id));
  const newToken = {
    ...createToken(targetToken.element, 5),
    gridPosition: anchorPosition,
  };

  return {
    ...state,
    tokens: [
      ...state.tokens.filter((token) => !mergedIds.has(token.id)),
      newToken,
    ],
  };
}

function updateActorDeckSlot(
  state: GameState,
  actorId: string,
  cardId: string,
  slotId: string,
  updater: (slot: ActorDeckState['cards'][number]['slots'][number]) => ActorDeckState['cards'][number]['slots'][number]
): { nextDecks: Record<string, ActorDeckState>; slot?: ActorDeckState['cards'][number]['slots'][number] } | null {
  const deck = state.actorDecks[actorId];
  if (!deck) return null;
  const cardIndex = deck.cards.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) return null;
  const card = deck.cards[cardIndex];
  const slotIndex = card.slots.findIndex((slot) => slot.id === slotId);
  if (slotIndex === -1) return null;
  const slot = card.slots[slotIndex];
  const updatedSlot = updater(slot);
  const updatedCard = {
    ...card,
    slots: [
      ...card.slots.slice(0, slotIndex),
      updatedSlot,
      ...card.slots.slice(slotIndex + 1),
    ],
  };
  const updatedDeck = {
    ...deck,
    cards: [
      ...deck.cards.slice(0, cardIndex),
      updatedCard,
      ...deck.cards.slice(cardIndex + 1),
    ],
  };
  return {
    nextDecks: {
      ...state.actorDecks,
      [actorId]: updatedDeck,
    },
    slot: slot,
  };
}

function setDeckCardCooldown(
  state: GameState,
  actorId: string,
  cardId: string
): Record<string, ActorDeckState> {
  const deck = state.actorDecks[actorId];
  if (!deck) return state.actorDecks;
  const cardIndex = deck.cards.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) return state.actorDecks;
  const card = deck.cards[cardIndex];
  const updatedCard = {
    ...card,
    cooldown: card.maxCooldown ?? 5,
  };
  return {
    ...state.actorDecks,
    [actorId]: {
      ...deck,
      cards: [
        ...deck.cards.slice(0, cardIndex),
        updatedCard,
        ...deck.cards.slice(cardIndex + 1),
      ],
    },
  };
}

function reduceDeckCooldowns(
  state: GameState,
  actorId: string,
  amount: number
): Record<string, ActorDeckState> {
  const deck = state.actorDecks[actorId];
  if (!deck || amount <= 0) return state.actorDecks;
  const updatedCards = deck.cards.map((card) => ({
    ...card,
    cooldown: Math.max(0, (card.cooldown ?? 0) - amount),
  }));
  return {
    ...state.actorDecks,
    [actorId]: {
      ...deck,
      cards: updatedCards,
    },
  };
}

function incrementFoundationCombos(
  state: GameState,
  foundationIndex: number
): number[] {
  const foundationCount = state.foundations.length;
  const comboSeed = state.foundationCombos && state.foundationCombos.length === foundationCount
    ? state.foundationCombos
    : Array.from({ length: foundationCount }, () => 0);
  const newCombos = [...comboSeed];
  newCombos[foundationIndex] = (newCombos[foundationIndex] || 0) + 1;
  return newCombos;
}

export function equipOrimFromStash(
  state: GameState,
  actorId: string,
  cardId: string,
  slotId: string,
  orimId: string
): GameState {
  const orim = state.orimInstances[orimId];
  if (!orim) return state;
  if (!state.orimStash.some((item) => item.id === orimId)) return state;
  const definition = state.orimDefinitions.find((item) => item.id === orim.definitionId) || null;
  if (!canActivateOrim(state, actorId, definition, 'equip')) return state;
  const update = updateActorDeckSlot(state, actorId, cardId, slotId, (slot) => {
    if (slot.orimId) return slot;
    return { ...slot, orimId };
  });
  if (!update) return state;
  const wasAssigned = update.slot && !update.slot.orimId;
  if (!wasAssigned) return state;
  return {
    ...state,
    actorDecks: update.nextDecks,
    orimStash: state.orimStash.filter((item) => item.id !== orimId),
  };
}

export function moveOrimBetweenSlots(
  state: GameState,
  fromActorId: string,
  fromCardId: string,
  fromSlotId: string,
  toActorId: string,
  toCardId: string,
  toSlotId: string
): GameState {
  const fromUpdate = updateActorDeckSlot(state, fromActorId, fromCardId, fromSlotId, (slot) => slot);
  if (!fromUpdate?.slot?.orimId) return state;
  const orimId = fromUpdate.slot.orimId;
  const orim = state.orimInstances[orimId];
  if (!orim || isOrimLocked(fromUpdate.slot)) return state;
  const definition = state.orimDefinitions.find((item) => item.id === orim.definitionId) || null;
  if (!canActivateOrim(state, toActorId, definition, 'equip')) return state;
  const toUpdate = updateActorDeckSlot(
    { ...state, actorDecks: fromUpdate.nextDecks },
    toActorId,
    toCardId,
    toSlotId,
    (slot) => {
      if (slot.orimId) return slot;
      return { ...slot, orimId };
    }
  );
  if (!toUpdate) return state;
  const didAssign = toUpdate.slot && !toUpdate.slot.orimId;
  if (!didAssign) return state;
  const clearedFrom = updateActorDeckSlot(
    { ...state, actorDecks: toUpdate.nextDecks },
    fromActorId,
    fromCardId,
    fromSlotId,
    (slot) => ({ ...slot, orimId: null })
  );
  if (!clearedFrom) return state;
  return {
    ...state,
    actorDecks: clearedFrom.nextDecks,
  };
}

export function returnOrimToStash(
  state: GameState,
  actorId: string,
  cardId: string,
  slotId: string
): GameState {
  const update = updateActorDeckSlot(state, actorId, cardId, slotId, (slot) => slot);
  if (!update?.slot?.orimId) return state;
  const orimId = update.slot.orimId;
  const orim = state.orimInstances[orimId];
  if (!orim || isOrimLocked(update.slot)) return state;
  const cleared = updateActorDeckSlot(
    state,
    actorId,
    cardId,
    slotId,
    (slot) => ({ ...slot, orimId: null })
  );
  if (!cleared) return state;
  return {
    ...state,
    actorDecks: cleared.nextDecks,
    orimStash: [...state.orimStash, orim],
  };
}

/**
 * Swaps the party lead (foundation index 0) with another party member.
 */
export function swapPartyLead(
  state: GameState,
  actorId: string
): GameState {
  const activeTileId = state.activeSessionTileId;
  if (!activeTileId) return state;
  const party = getPartyForTile(state, activeTileId);
  if (party.length <= 1) return state;
  const targetIndex = party.findIndex((actor) => actor.id === actorId);
  if (targetIndex < 0) return state;

  const nextParty = [...party];
  if (targetIndex > 0) {
    [nextParty[0], nextParty[targetIndex]] = [nextParty[targetIndex], nextParty[0]];
  }

  const nextFoundations = state.foundations.length
    ? [...state.foundations]
    : state.foundations;
  if (Array.isArray(nextFoundations)) {
    if (nextFoundations.length > targetIndex) {
      if (targetIndex === 0 && nextFoundations[0].length === 0) {
        nextFoundations[0] = [createActorFoundationCard(nextParty[0])];
      } else {
      [nextFoundations[0], nextFoundations[targetIndex]] = [
        nextFoundations[targetIndex],
        nextFoundations[0],
      ];
      }
    } else if (nextFoundations.length === 1) {
      if (nextFoundations[0].length === 0 || targetIndex >= 0) {
        nextFoundations[0] = [createActorFoundationCard(nextParty[0])];
      }
    }
  }

  const nextCombos = state.foundationCombos ? [...state.foundationCombos] : state.foundationCombos;
  if (Array.isArray(nextCombos)) {
    if (nextCombos.length > targetIndex) {
      if (targetIndex === 0 && nextFoundations.length === 1) {
        nextCombos[0] = 0;
      } else {
        [nextCombos[0], nextCombos[targetIndex]] = [nextCombos[targetIndex], nextCombos[0]];
      }
    } else if (nextCombos.length === 1) {
      nextCombos[0] = 0;
    }
  }

  const nextTokens = state.foundationTokens ? [...state.foundationTokens] : state.foundationTokens;
  if (Array.isArray(nextTokens)) {
    if (nextTokens.length > targetIndex) {
      if (targetIndex === 0 && nextFoundations.length === 1) {
        nextTokens[0] = createEmptyTokenCounts();
      } else {
        [nextTokens[0], nextTokens[targetIndex]] = [nextTokens[targetIndex], nextTokens[0]];
      }
    } else if (nextTokens.length === 1) {
      nextTokens[0] = createEmptyTokenCounts();
    }
  }

  return {
    ...state,
    tileParties: {
      ...state.tileParties,
      [activeTileId]: nextParty,
    },
    foundations: nextFoundations,
    foundationCombos: nextCombos,
    foundationTokens: nextTokens,
  };
}

export function devInjectOrimToActor(
  state: GameState,
  actorId: string,
  orimDefinitionId: string
): GameState {
  const actor = findActorById(state, actorId);
  if (!actor) return state;
  const definition = state.orimDefinitions.find((item) => item.id === orimDefinitionId);
  if (!definition) return state;

  const instanceId = `orim-${definition.id}-${Date.now()}-${randomIdSuffix()}`;
  const nextInstances = {
    ...state.orimInstances,
    [instanceId]: { id: instanceId, definitionId: definition.id },
  };

  const nextSlots = [...(actor.orimSlots ?? [])];
  const emptyIndex = nextSlots.findIndex((slot) => !slot.orimId && !slot.locked);
  if (emptyIndex >= 0) {
    nextSlots[emptyIndex] = { ...nextSlots[emptyIndex], orimId: instanceId };
  } else {
    nextSlots.push({
      id: `orim-slot-${actorId}-${Date.now()}-${randomIdSuffix()}`,
      orimId: instanceId,
      locked: false,
    });
  }

  const updateActor = (item: Actor) =>
    item.id === actorId ? { ...item, orimSlots: nextSlots } : item;

  const nextAvailable = state.availableActors.map(updateActor);
  const nextParties = Object.fromEntries(
    Object.entries(state.tileParties).map(([tileId, party]) => [
      tileId,
      party.map(updateActor),
    ])
  );

  return {
    ...state,
    orimInstances: nextInstances,
    availableActors: nextAvailable,
    tileParties: nextParties,
  };
}

export function stackActorOnActor(
  state: GameState,
  draggedActorId: string,
  targetActorId: string
): GameState {
  if (draggedActorId === targetActorId) return state;

  const draggedActor = state.availableActors.find(actor => actor.id === draggedActorId);
  const targetActor = state.availableActors.find(actor => actor.id === targetActorId);
  if (!draggedActor || !targetActor) return state;
  if (draggedActor.stackId && draggedActor.stackId === targetActor.stackId) return state;

  const targetStackId = targetActor.stackId || draggedActor.stackId || `stack-${Date.now()}-${randomIdSuffix()}`;
  const targetStackActors = targetActor.stackId
    ? state.availableActors
        .filter(actor => actor.stackId === targetStackId)
        .slice()
        .sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0))
    : [targetActor];
  const draggedStackActors = draggedActor.stackId
    ? state.availableActors
        .filter(actor => actor.stackId === draggedActor.stackId)
        .slice()
        .sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0))
    : [draggedActor];

  const orderedIds = [
    ...draggedStackActors.map(actor => actor.id),
    ...targetStackActors.map(actor => actor.id).filter(id => !draggedStackActors.some(dragged => dragged.id === id)),
  ];

  const anchorPosition = targetActor.gridPosition;
  const stackedActors = applyStackOrder(state.availableActors, targetStackId, orderedIds, anchorPosition);

  return {
    ...state,
    availableActors: stackedActors,
  };
}

export function detachActorFromStack(
  state: GameState,
  actorId: string,
  col: number,
  row: number
): GameState {
  const detachedActors = removeActorFromStack(state.availableActors, actorId);
  const actorIndex = detachedActors.findIndex(actor => actor.id === actorId);
  if (actorIndex === -1) return state;

  const updatedActor = {
    ...detachedActors[actorIndex],
    gridPosition: { col, row },
  };

  const newAvailableActors = [
    ...detachedActors.slice(0, actorIndex),
    updatedActor,
    ...detachedActors.slice(actorIndex + 1),
  ];

  return {
    ...state,
    availableActors: newAvailableActors,
  };
}

export function reorderActorStack(
  state: GameState,
  stackId: string,
  orderedActorIds: string[]
): GameState {
  if (orderedActorIds.length <= 1) return state;
  const stackActors = state.availableActors.filter(actor => actor.stackId === stackId);
  if (stackActors.length <= 1) return state;

  const anchorPosition = stackActors[0]?.gridPosition;
  const updatedActors = applyStackOrder(state.availableActors, stackId, orderedActorIds, anchorPosition);

  return {
    ...state,
    availableActors: updatedActors,
  };
}

/**
 * Collects a blueprint card from chaos state and adds it to the player's library
 */
export function collectBlueprint(
  state: GameState,
  blueprintCardId: string
): GameState {
  const blueprintCard = state.pendingBlueprintCards.find(bc => bc.id === blueprintCardId);
  if (!blueprintCard) return state;

  // Remove from pending
  const updatedPendingCards = state.pendingBlueprintCards.filter(bc => bc.id !== blueprintCardId);

  // Add to library (check if already exists)
  const alreadyUnlocked = state.blueprints.some(b => b.definitionId === blueprintCard.blueprintId);
  const updatedBlueprints = alreadyUnlocked
    ? state.blueprints
    : [
        ...state.blueprints,
        {
          definitionId: blueprintCard.blueprintId,
          id: `blueprint-${blueprintCard.blueprintId}-${Date.now()}`,
          unlockedAt: Date.now(),
          isNew: true,
        },
      ];

  return {
    ...state,
    pendingBlueprintCards: updatedPendingCards,
    blueprints: updatedBlueprints,
  };
}

// === BIOME SYSTEM ===

/**
 * Helper: Creates a card from element and rank
 */
function createCardFromElement(element: Element, rank: number): Card {
  const suit = ELEMENT_TO_SUIT[element];
  return {
    rank,
    suit,
    element,
    orimSlots: [
      {
        id: `orim-slot-${element}-${rank}-${Date.now()}-${randomIdSuffix()}`,
        orimId: element !== 'N' ? `element-${element}` : null,
      },
    ],
    id: `biome-${element}-${rank}-${Date.now()}-${randomIdSuffix()}`,
  };
}

/**
 * Helper: Get random chaos position
 */
function getChaosPosition(): { x: number; y: number } {
  return {
    x: 200 + Math.random() * 400,
    y: 150 + Math.random() * 300,
  };
}

/**
 * Helper: Get random chaos rotation (5-15 degrees)
 */
function getChaosRotation(): number {
  return 5 + Math.random() * 10;
}

/**
 * Generates a single random card with random rank, element, and tokenReward.
 */
function generateRandomCard(): Card {
  const rank = 1 + Math.floor(Math.random() * 13);
  const elementalElements = ALL_ELEMENTS.filter((entry) => entry !== 'N');
  const hasOrim = Math.random() < 0.75;
  const element = hasOrim
    ? elementalElements[Math.floor(Math.random() * elementalElements.length)]
    : 'N';
  const suit = ELEMENT_TO_SUIT[element];
  return {
    rank,
    suit,
    element,
    tokenReward: element !== 'N' ? element : undefined,
    orimSlots: [
      {
        id: `orim-slot-${element}-${rank}-${Date.now()}-${randomIdSuffix()}`,
        orimId: element !== 'N' ? `element-${element}` : null,
      },
    ],
    id: `rbiome-${Date.now()}-${randomIdSuffix()}`,
  };
}

/**
 * Generates random tableaus for a randomly generated biome.
 * Each card gets a random rank (1-13), random element from all 7,
 * suit derived from element, and tokenReward matching its element.
 */
function generateRandomTableaus(tableauCount: number = 7, cardsPerTableau: number = 4): Card[][] {
  const tableaus: Card[][] = [];
  for (let t = 0; t < tableauCount; t++) {
    const cards: Card[] = [];
    for (let c = 0; c < cardsPerTableau; c++) {
      cards.push(generateRandomCard());
    }
    tableaus.push(cards);
  }
  return tableaus;
}

function generateShowcaseTableaus(tableauCount: number = 7, cardsPerTableau: number = 4): Card[][] {
  const tableaus = generateRandomTableaus(tableauCount, cardsPerTableau);
  const requiredElements: Element[] = ['A', 'E', 'W', 'F', 'D', 'L'];
  requiredElements.forEach((element, index) => {
    if (index >= tableaus.length) return;
    const stack = tableaus[index];
    if (stack.length === 0) return;
    const rank = Math.floor(Math.random() * 13) + 1;
    stack[stack.length - 1] = createCardFromElement(element, rank);
  });
  return tableaus;
}

function generateRandomStock(size: number = 20): Card[] {
  return Array.from({ length: size }, () => generateRandomCard());
}

/**
 * Backfills a tableau by inserting a new random card at the bottom (index 0).
 * Used by infinite biomes to keep tableaus populated after a card is played.
 */
function backfillTableau(tableau: Card[]): Card[] {
  return [generateRandomCard(), ...tableau];
}

function backfillTableauFromQueue(tableau: Card[], queue: Card[] | undefined): { tableau: Card[]; queue: Card[] } {
  if (!queue || queue.length === 0) {
    return { tableau: backfillTableau(tableau), queue: [] };
  }
  const [next, ...rest] = queue;
  return { tableau: [next, ...tableau], queue: rest };
}

function createEnemyBackfillQueues(tableaus: Card[][], sizePerTableau: number): Card[][] {
  return tableaus.map(() => Array.from({ length: sizePerTableau }, () => generateRandomCard()));
}

/**
 * Starts a randomly generated biome.
 * Creates foundations based on the adventure party and random tableaus.
 */
function startRandomBiome(
  state: GameState,
  tileId: string,
  biomeId: string,
  partyActors: Actor[]
): GameState {
  const biomeDef = getBiomeDefinition(biomeId);
  if (!biomeDef || !biomeDef.randomlyGenerated) return state;
  if (partyActors.length === 0) return state;

  const equipAllOrims = false; // TEMP: disable sandbox auto-equip; use actor defaults
  let sandboxActors = partyActors;
  let sandboxInstances: Record<string, OrimInstance> | null = null;
  if (equipAllOrims) {
    sandboxInstances = {};
    sandboxActors = partyActors.map((actor, index) => {
      if (index !== 0) return actor;
      const slots: OrimSlot[] = state.orimDefinitions.map((definition, index) => {
        const instance: OrimInstance = {
          id: `orim-${definition.id}-${actor.id}-${randomIdSuffix()}`,
          definitionId: definition.id,
        };
        sandboxInstances![instance.id] = instance;
        return {
          id: `${actor.id}-orim-slot-${index + 1}`,
          orimId: instance.id,
          locked: false,
        };
      });
      return { ...actor, orimSlots: slots };
    });
  }

  const tableaus = generateShowcaseTableaus(7);
  const stock = generateRandomStock(20);
  const playtestVariant = state.playtestVariant ?? 'single-foundation';
  const usePartyFoundations = playtestVariant === 'party-foundations' || playtestVariant === 'party-battle';
  const useEnemyFoundations = playtestVariant === 'party-battle';
  const foundationActors = clampPartyForFoundations(sandboxActors);
  const foundations: Card[][] = biomeId === 'random_wilds'
    ? (usePartyFoundations
      ? foundationActors.map((actor) => [createActorFoundationCard(actor)])
      : [[]])
    : foundationActors.map(actor => [
      createActorFoundationCard(actor),
    ]);
  const foundationCombos = foundations.map(() => 0);
  const foundationTokens = foundations.map(() => createEmptyTokenCounts());
  const enemyFoundations = useEnemyFoundations ? createDefaultEnemyFoundations() : undefined;
  const enemyFoundationCombos = enemyFoundations ? enemyFoundations.map(() => 0) : undefined;
  const enemyFoundationTokens = enemyFoundations ? enemyFoundations.map(() => createEmptyTokenCounts()) : undefined;
  const actorCombos = {
    ...(state.actorCombos ?? {}),
    ...Object.fromEntries(partyActors.map((actor) => [actor.id, state.actorCombos?.[actor.id] ?? 0])),
  };

  return {
    ...state,
    phase: 'biome',
    currentBiome: biomeId,
    activeSessionTileId: tileId,
    biomeMovesCompleted: 0,
    tableaus,
    foundations,
    stock,
    activeEffects: [],
    turnCount: 0,
    collectedTokens: createEmptyTokenCounts(),
    pendingBlueprintCards: [],
    foundationCombos,
    actorCombos,
    foundationTokens,
    enemyFoundations,
    enemyFoundationCombos,
    enemyFoundationTokens,
    enemyBackfillQueues: undefined,
    randomBiomeTurnNumber: 1,
    randomBiomeActiveSide: useEnemyFoundations ? 'player' : undefined,
    enemyDifficulty: useEnemyFoundations ? (biomeDef.enemyDifficulty ?? 'normal') : undefined,
    tileParties: equipAllOrims
      ? { ...state.tileParties, [tileId]: sandboxActors }
      : state.tileParties,
    orimInstances: sandboxInstances
      ? { ...state.orimInstances, ...sandboxInstances }
      : state.orimInstances,
  };
}

/**
 * Plays a card in a randomly generated biome.
 * Tracks per-foundation combos and tokens.
 */
export function playCardInRandomBiome(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  const tableau = state.tableaus[tableauIndex];
  if (!tableau || tableau.length === 0) return null;

  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  const foundationActor = partyActors[foundationIndex];
  if (foundationActor && foundationActor.stamina <= 0) return null;

  const card = tableau[tableau.length - 1];
  const foundation = state.foundations[foundationIndex];
  const foundationTop = foundation[foundation.length - 1];

  if (!canPlayCardWithWild(card, foundationTop, state.activeEffects)) {
    return null;
  }

  // Check if biome is infinite for backfill
  const biomeDef = state.currentBiome ? getBiomeDefinition(state.currentBiome) : null;
  const isInfinite = !!biomeDef?.infinite;

  const newTableaus = state.tableaus.map((t, i) => {
    if (i !== tableauIndex) return t;
    const remaining = t.slice(0, -1);
    return isInfinite ? backfillTableau(remaining) : remaining;
  });

  const newFoundations = state.foundations.map((f, i) =>
    i === foundationIndex ? [...f, card] : f
  );

  // Update per-foundation combos
  const foundationCount = state.foundations.length;
  const comboSeed = state.foundationCombos && state.foundationCombos.length === foundationCount
    ? state.foundationCombos
    : Array.from({ length: foundationCount }, () => 0);
  const newCombos = [...comboSeed];
  newCombos[foundationIndex] = (newCombos[foundationIndex] || 0) + 1;
  const newActorCombos = foundationActor
    ? {
      ...(state.actorCombos ?? {}),
      [foundationActor.id]: (state.actorCombos?.[foundationActor.id] ?? 0) + 1,
    }
    : (state.actorCombos ?? {});

  // Update per-foundation tokens
  const tokensSeed = state.foundationTokens && state.foundationTokens.length === foundationCount
    ? state.foundationTokens
    : Array.from({ length: foundationCount }, () => createEmptyTokenCounts());
  const newFoundationTokens = tokensSeed.map((tokens, i) => {
    if (i !== foundationIndex || !card.tokenReward) return { ...tokens };
    return {
      ...tokens,
      [card.tokenReward]: (tokens[card.tokenReward] || 0) + 1,
    };
  });

  // Update global collected tokens
  const newCollectedTokens = applyTokenReward(
    state.collectedTokens || createEmptyTokenCounts(),
    card
  );

  const nextState = {
    ...state,
    tableaus: newTableaus,
    foundations: newFoundations,
    activeEffects: processEffects(state.activeEffects),
    turnCount: state.turnCount + 1,
    biomeMovesCompleted: (state.biomeMovesCompleted || 0) + 1,
    collectedTokens: newCollectedTokens,
    foundationCombos: newCombos,
    actorCombos: newActorCombos,
    foundationTokens: newFoundationTokens,
    actorDecks: foundationActor
      ? reduceDeckCooldowns({ ...state, actorDecks: state.actorDecks }, foundationActor.id, 1)
      : state.actorDecks,
  };
  return recordCardAction(state, nextState);
}

/**
 * Plays a card in a randomly generated biome for the enemy foundations.
 * Uses the same tableau rules but applies cards to enemyFoundations.
 */
export function playEnemyCardInRandomBiome(
  state: GameState,
  tableauIndex: number,
  enemyFoundationIndex: number
): GameState | null {
  const enemyFoundations = state.enemyFoundations;
  if (!enemyFoundations || enemyFoundations.length === 0) return null;
  const tableau = state.tableaus[tableauIndex];
  if (!tableau || tableau.length === 0) return null;
  const enemyFoundation = enemyFoundations[enemyFoundationIndex];
  if (!enemyFoundation) return null;

  const card = tableau[tableau.length - 1];
  const foundationTop = enemyFoundation[enemyFoundation.length - 1];
  if (!foundationTop) return null;

  if (!canPlayCardWithWild(card, foundationTop, state.activeEffects)) {
    return null;
  }

  const biomeDef = state.currentBiome ? getBiomeDefinition(state.currentBiome) : null;
  const isInfinite = !!biomeDef?.infinite;
  const useQueue = state.randomBiomeActiveSide === 'enemy';
  let nextQueues = state.enemyBackfillQueues ? state.enemyBackfillQueues.map((q) => [...q]) : undefined;
  const newTableaus = state.tableaus.map((t, i) => {
    if (i !== tableauIndex) return t;
    const remaining = t.slice(0, -1);
    if (!isInfinite) return remaining;
    if (useQueue) {
      const queue = nextQueues?.[i] ?? [];
      const result = backfillTableauFromQueue(remaining, queue);
      if (nextQueues) nextQueues[i] = result.queue;
      return result.tableau;
    }
    return backfillTableau(remaining);
  });

  const newEnemyFoundations = enemyFoundations.map((f, i) =>
    i === enemyFoundationIndex ? [...f, card] : f
  );

  const foundationCount = newEnemyFoundations.length;
  const comboSeed = state.enemyFoundationCombos && state.enemyFoundationCombos.length === foundationCount
    ? state.enemyFoundationCombos
    : Array.from({ length: foundationCount }, () => 0);
  const newCombos = [...comboSeed];
  newCombos[enemyFoundationIndex] = (newCombos[enemyFoundationIndex] || 0) + 1;

  const tokensSeed = state.enemyFoundationTokens && state.enemyFoundationTokens.length === foundationCount
    ? state.enemyFoundationTokens
    : Array.from({ length: foundationCount }, () => createEmptyTokenCounts());
  const newEnemyTokens = tokensSeed.map((tokens, i) => {
    if (i !== enemyFoundationIndex || !card.tokenReward) return { ...tokens };
    return {
      ...tokens,
      [card.tokenReward]: (tokens[card.tokenReward] || 0) + 1,
    };
  });

  return {
    ...state,
    tableaus: newTableaus,
    enemyFoundations: newEnemyFoundations,
    enemyFoundationCombos: newCombos,
    enemyFoundationTokens: newEnemyTokens,
    enemyBackfillQueues: nextQueues,
    turnCount: state.turnCount + 1,
  };
}

/**
 * Advances a random biome turn. If an enemy side exists, switch to it first.
 * Otherwise, end the turn immediately.
 */
export function advanceRandomBiomeTurn(state: GameState): GameState {
  if (!state.currentBiome) return state;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef?.randomlyGenerated) return state;
  const useEnemyFoundations = state.playtestVariant === 'party-battle'
    && (state.enemyFoundations?.length ?? 0) > 0;
  if (!useEnemyFoundations) {
    return endRandomBiomeTurn(state);
  }
  const activeSide = state.randomBiomeActiveSide ?? 'player';
  if (activeSide === 'player') {
    const ensuredEnemyFoundations =
      !state.enemyFoundations || state.enemyFoundations.some((foundation) => foundation.length === 0)
        ? createDefaultEnemyFoundations()
        : state.enemyFoundations;
    return {
      ...state,
      randomBiomeActiveSide: 'enemy',
      enemyBackfillQueues: createEnemyBackfillQueues(state.tableaus, 10),
      enemyFoundations: ensuredEnemyFoundations,
      enemyFoundationCombos: ensuredEnemyFoundations.map(() => 0),
      enemyFoundationTokens: ensuredEnemyFoundations.map(() => createEmptyTokenCounts()),
    };
  }
  return endRandomBiomeTurn(state);
}

/**
 * Ends a turn in a randomly generated biome.
 * Resets foundations to the adventure party, generates fresh tableaus,
 * clears per-foundation combos and tokens. Does NOT clear collectedTokens.
 */
export function endRandomBiomeTurn(state: GameState): GameState {
  if (!state.currentBiome) return state;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef?.randomlyGenerated) return state;
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  if (partyActors.length === 0) return state;

  const tableaus = generateShowcaseTableaus(7);
  const stock = generateRandomStock(20);
  const playtestVariant = state.playtestVariant ?? 'single-foundation';
  const usePartyFoundations = playtestVariant === 'party-foundations' || playtestVariant === 'party-battle';
  const useEnemyFoundations = playtestVariant === 'party-battle';
  const foundationActors = clampPartyForFoundations(partyActors);
  const foundations: Card[][] = usePartyFoundations
    ? foundationActors.map(actor => [createActorFoundationCard(actor)])
    : [[]];
  const foundationCombos = foundations.map(() => 0);
  const foundationTokens = foundations.map(() => createEmptyTokenCounts());
  const enemyFoundations = useEnemyFoundations ? createDefaultEnemyFoundations() : undefined;
  const enemyFoundationCombos = enemyFoundations ? enemyFoundations.map(() => 0) : undefined;
  const enemyFoundationTokens = enemyFoundations ? enemyFoundations.map(() => createEmptyTokenCounts()) : undefined;
  const updatedParty = partyActors.map((actor) => ({
    ...actor,
    stamina: Math.max(0, (actor.stamina ?? 0) - 1),
  }));
  const resetActorCombos = {
    ...(state.actorCombos ?? {}),
    ...Object.fromEntries(updatedParty.map((actor) => [actor.id, 0])),
  };
  let nextState: GameState = {
    ...state,
    tableaus,
    foundations,
    stock,
    foundationCombos,
    actorCombos: resetActorCombos,
    foundationTokens,
    enemyFoundations,
    enemyFoundationCombos,
    enemyFoundationTokens,
    enemyBackfillQueues: undefined,
    tileParties: state.activeSessionTileId
      ? { ...state.tileParties, [state.activeSessionTileId]: updatedParty }
      : state.tileParties,
    randomBiomeTurnNumber: (state.randomBiomeTurnNumber || 1) + 1,
    randomBiomeActiveSide: useEnemyFoundations ? 'player' : undefined,
    enemyDifficulty: useEnemyFoundations ? (state.enemyDifficulty ?? biomeDef.enemyDifficulty ?? 'normal') : undefined,
  };
  partyActors.forEach((actor) => {
    nextState = applyOrimTiming(nextState, 'turn-end', actor.id);
  });
  return nextState;
}


/**
 * Starts a biome adventure with predefined layout
 */
export function startBiome(
  state: GameState,
  tileId: string,
  biomeId: string
): GameState {
  if (state.activeSessionTileId && state.activeSessionTileId !== tileId) return state;
  const biomeDef = getBiomeDefinition(biomeId);
  if (!biomeDef) return state;
  const partyActors = getPartyForTile(state, tileId);
  if (partyActors.length === 0) return state;

  // Route to random biome handler
  if (biomeDef.randomlyGenerated) {
    return startRandomBiome(state, tileId, biomeId, partyActors);
  }

  // Route based on biome mode
  if (biomeDef.mode === 'node-edge') {
    return startNodeEdgeBiome(state, biomeDef, partyActors, tileId);
  }

  // Create tableaus from biome layout (traditional mode)
  const tableaus: Card[][] = biomeDef.layout.tableaus.map((ranks, idx) => {
    const elements = biomeDef.layout.elements[idx];
    return ranks.map((rank, cardIdx) => {
      const element = elements[cardIdx];
      return createCardFromElement(element, rank);
    });
  });

  // Create foundations based on party actors
  const foundationActors = clampPartyForFoundations(partyActors);
  const foundations: Card[][] = foundationActors.map(actor => [
    createActorFoundationCard(actor),
  ]);
  const foundationCombos = foundations.map(() => 0);

  return {
    ...state,
    phase: 'biome',
    currentBiome: biomeId,
    activeSessionTileId: tileId,
    biomeMovesCompleted: 0,
    tableaus,
    foundations,
    stock: [],
    activeEffects: [],
    turnCount: 0,
    collectedTokens: createEmptyTokenCounts(),
    pendingBlueprintCards: [],
    foundationCombos,
  };
}

/**
 * Starts a node-edge biome adventure with spatial pattern layout
 */
function startNodeEdgeBiome(
  state: GameState,
  biomeDef: import('./types').BiomeDefinition,
  partyActors: Actor[],
  tileId: string
): GameState {
  if (!biomeDef.nodePattern) return state;

  const pattern = getNodePattern(biomeDef.nodePattern);
  if (!pattern) return state;

  const nodeTableau = generateNodeTableau(pattern, biomeDef.seed);

  // Create foundations from adventure party
  const foundationActors = clampPartyForFoundations(partyActors);
  const foundations: Card[][] = foundationActors.map(actor => [
    createActorFoundationCard(actor),
  ]);
  const foundationCombos = foundations.map(() => 0);

  // Ensure at least one foundation exists for golf solitaire gameplay
  if (foundations.length === 0) {
    const isPyramidRuins = biomeDef.id === 'pyramid_ruins';
    // Add a default starter foundation with a neutral card
    const starterCard: Card = {
      rank: isPyramidRuins ? 8 : 7, // Middle rank for flexibility
      suit: '⭐',
      element: isPyramidRuins ? 'N' : 'L',
      id: `foundation-starter-${Date.now()}`,
    };
    foundations.push([starterCard]);
  }

  return {
    ...state,
    phase: 'biome',
    currentBiome: biomeDef.id,
    activeSessionTileId: tileId,
    biomeMovesCompleted: 0,
    nodeTableau,
    tableaus: [],                                // Empty for node-edge
    foundations,
    stock: [],
    activeEffects: [],
    turnCount: 0,
    collectedTokens: createEmptyTokenCounts(),
    pendingBlueprintCards: [],
    foundationCombos,
  };
}

/**
 * Plays a card from a node-edge tableau in biome mode
 */
export function playCardInNodeBiome(
  state: GameState,
  nodeId: string,
  foundationIndex: number
): GameState | null {
  if (!state.nodeTableau) return null;

  const node = state.nodeTableau.find(n => n.id === nodeId);
  if (!node || !node.revealed || node.cards.length === 0) return null;

  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  const foundationActor = partyActors[foundationIndex];
  if (foundationActor && foundationActor.stamina <= 0) return null;

  const card = node.cards[node.cards.length - 1];
  const foundationTop = state.foundations[foundationIndex][
    state.foundations[foundationIndex].length - 1
  ];

  if (!canPlayCard(card, foundationTop, state.activeEffects)) {
    return null;
  }

  // Remove card from node
  const result = playCardFromNode(state.nodeTableau, nodeId);
  if (!result) return null;

  // Update foundations
  const newFoundations = state.foundations.map((f, i) =>
    i === foundationIndex ? [...f, result.card] : f
  );

  const nextState = {
    ...state,
    nodeTableau: result.nodes,
    foundations: newFoundations,
    activeEffects: processEffects(state.activeEffects),
    turnCount: state.turnCount + 1,
    biomeMovesCompleted: (state.biomeMovesCompleted || 0) + 1,
  };
  return recordCardAction(state, nextState);
}

/**
 * Plays a card in biome mode - tracks moves and spawns blueprints
 */
export function playCardInBiome(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  // Use regular playCard logic
  const newState = playCard(state, tableauIndex, foundationIndex);
  if (!newState || !state.currentBiome) return newState;

  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef) return newState;

  const movesCompleted = (newState.biomeMovesCompleted || 0) + 1;

  // Check for blueprint spawn
  let pendingBlueprintCards = newState.pendingBlueprintCards || [];
  if (
    biomeDef.blueprintSpawn &&
    movesCompleted === biomeDef.blueprintSpawn.afterMoves
  ) {
    // Spawn blueprint in chaos state
    const blueprintCard = {
      blueprintId: biomeDef.blueprintSpawn.blueprintId,
      position: getChaosPosition(),
      rotation: getChaosRotation(),
      id: `bp-card-${Date.now()}`,
    };
    pendingBlueprintCards = [...pendingBlueprintCards, blueprintCard];
  }

  const partyActors = getPartyForTile(newState, newState.activeSessionTileId);
  const foundationActor = partyActors[foundationIndex];
  const newCombos = incrementFoundationCombos(newState, foundationIndex);
  const nextDecks = foundationActor
    ? reduceDeckCooldowns({ ...newState, actorDecks: newState.actorDecks }, foundationActor.id, 1)
    : newState.actorDecks;
  return {
    ...newState,
    biomeMovesCompleted: movesCompleted,
    pendingBlueprintCards,
    foundationCombos: newCombos,
    actorDecks: nextDecks,
  };
}

/**
 * Completes a biome and returns to garden with rewards
 */
export function completeBiome(state: GameState): GameState {
  if (!state.currentBiome) return state;

  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef) return state;
  const activeTileId = state.activeSessionTileId;
  const activeParty = getPartyForTile(state, activeTileId);

  // Create reward cards
  const rewardCards: Card[] = [];
  biomeDef.rewards.cards.forEach(({ element, count }) => {
    for (let i = 0; i < count; i++) {
      // Create cards with varied ranks
      const rank = 1 + (i % 13);
      rewardCards.push(createCardFromElement(element, rank));
    }
  });

  // Add blueprint rewards to library
  let updatedBlueprints = state.blueprints;
  if (biomeDef.rewards.blueprints) {
    biomeDef.rewards.blueprints.forEach(blueprintId => {
      const alreadyUnlocked = updatedBlueprints.some(b => b.definitionId === blueprintId);
      if (!alreadyUnlocked) {
        updatedBlueprints = [
          ...updatedBlueprints,
          {
            definitionId: blueprintId,
            id: `blueprint-${blueprintId}-${Date.now()}`,
            unlockedAt: Date.now(),
            isNew: true,
          },
        ];
      }
    });
  }

  return {
    ...state,
    phase: 'garden',
    currentBiome: undefined,
    activeSessionTileId: undefined,
    biomeMovesCompleted: undefined,
    pendingCards: [...state.pendingCards, ...rewardCards],
    blueprints: updatedBlueprints,
    pendingBlueprintCards: [],
    tableaus: [],
    foundations: [],
    stock: [],
    tileParties: activeTileId
      ? { ...state.tileParties, [activeTileId]: [] }
      : state.tileParties,
    availableActors: activeParty.length > 0
      ? [...state.availableActors, ...activeParty]
      : state.availableActors,
  };
}
