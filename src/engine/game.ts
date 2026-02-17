import type { Actor, Card, ChallengeProgress, BuildPileProgress, Effect, EffectType, GameState, InteractionMode, Tile, Move, Suit, Element, Token, OrimInstance, ActorDeckState, OrimDefinition, OrimSlot, OrimRarity, RelicDefinition, RelicInstance, RelicRuntimeEntry, RelicCombatEvent, ActorKeru, ActorKeruArchetype } from './types';
import { GAME_CONFIG, ELEMENT_TO_SUIT, SUIT_TO_ELEMENT, GARDEN_GRID, ALL_ELEMENTS, MAX_KARMA_DEALING_ATTEMPTS, TOKEN_PROXIMITY_THRESHOLD, randomIdSuffix, createFullWildSentinel } from './constants';
import { createDeck, shuffleDeck } from './deck';
import { canPlayCardWithWild, checkKarmaDealing } from './rules';
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
import { RELIC_DEFINITIONS } from './relics';
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
// import { getNodePattern } from './nodePatterns'; // Deprecated
// import { generateNodeTableau, playCardFromNode } from './nodeTableau'; // Deprecated

const NO_REGRET_ORIM_ID = 'no-regret';
const NO_REGRET_COOLDOWN = 5;
const PARTY_FOUNDATION_LIMIT = 3;
const RPG_VICE_BITE_DOT_POWER = 1;
const RPG_VICE_BITE_TICKS = 3;
const RPG_VICE_BITE_INTERVAL_MS = 1000;
const RPG_VICE_BITE_SLOW_MS = 3000;
const RPG_BITE_BLEED_CHANCE = 0.2;
const RPG_BITE_BLEED_DOT_POWER = 1;
const RPG_BITE_BLEED_TICKS = 3;
const RPG_BITE_BLEED_INTERVAL_MS = 1000;
const RPG_CLOUD_SIGHT_MS = 10000;
const RPG_SOAR_EVASION_BONUS = 75;
const RPG_SOAR_EVASION_BASE_MS = 6000;
const RPG_SOAR_EVASION_LEVEL_STEP_MS = 2000;
const ORIM_RARITY_ORDER: OrimRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const DEFAULT_ENEMY_FOUNDATION_SEEDS: Array<{ id: string; rank: number; suit: Suit; element: Element }> = [
  { id: 'enemy-shadow', rank: 12, suit: '🌙', element: 'D' },
  { id: 'enemy-sun', rank: 8, suit: '☀️', element: 'L' },
];
const DEFAULT_ENEMY_ACTOR_IDS = ['shadowcub', 'shadowkit'] as const;
const DEFAULT_EQUIPPED_RELIC_IDS = new Set<string>(['turtles_bide', 'koi_coin', 'heart_of_the_wild', 'hindsight', 'controlled_dragonfire', 'summon_darkspawn']);
const HINDSIGHT_BEHAVIOR_ID = 'hindsight_v1';
const HINDSIGHT_LAST_USED_REST_COUNTER = 'hindsightLastUsedRestCount';
const DEFAULT_KERU_ID = 'keru-primary';
const KERU_BASE_HP = 1;

function clampPartyForFoundations(partyActors: Actor[]): Actor[] {
  return partyActors.slice(0, PARTY_FOUNDATION_LIMIT);
}

function tickNoRegretCooldown(cooldown: number | undefined): number {
  return Math.max(0, (cooldown ?? 0) - 1);
}

function isActorCombatEnabled(actor: Actor | null | undefined): boolean {
  if (!actor) return false;
  return (actor.stamina ?? 0) > 0 && (actor.hp ?? 0) > 0;
}

function getNoRegretActor(state: GameState): Actor | null {
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  const fallbackActors = partyActors.length > 0
    ? partyActors
    : Object.values(state.tileParties ?? {}).flat();
  const candidateActors = fallbackActors.length > 0 ? fallbackActors : state.availableActors;
  return candidateActors.find((actor) => actorHasNoRegret(state, actor.id)) ?? null;
}

function getHindsightInstance(state: GameState): RelicInstance | null {
  const hindsightRelic = state.relicDefinitions.find((definition) => definition.behaviorId === HINDSIGHT_BEHAVIOR_ID);
  if (!hindsightRelic) return null;
  return state.equippedRelics.find((instance) => instance.relicId === hindsightRelic.id && instance.enabled) ?? null;
}

function canUseHindsightRewind(state: GameState, instance: RelicInstance): boolean {
  const restCount = state.globalRestCount ?? 0;
  const runtime = state.relicRuntimeState[instance.instanceId];
  const lastUsedRestCount = runtime?.counters?.[HINDSIGHT_LAST_USED_REST_COUNTER];
  if (typeof lastUsedRestCount !== 'number') return true;
  return lastUsedRestCount !== restCount;
}

function clampPercent(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function createDefaultKeru(): ActorKeru {
  return {
    id: DEFAULT_KERU_ID,
    archetype: 'blank',
    label: 'Blank Keru',
    hp: KERU_BASE_HP,
    hpMax: KERU_BASE_HP,
    armor: 0,
    stamina: 1,
    staminaMax: 1,
    energy: 1,
    energyMax: 1,
    evasion: 0,
    sight: 0,
    mobility: 0,
    leadership: 0,
    tags: ['fragile', 'blank'],
    selectedAspectIds: [],
    mutationCount: 0,
  };
}

function normalizeKeru(keru?: ActorKeru): ActorKeru {
  if (!keru) return createDefaultKeru();
  return {
    ...createDefaultKeru(),
    ...keru,
    hp: keru.hp ?? keru.hpMax ?? KERU_BASE_HP,
    hpMax: keru.hpMax ?? KERU_BASE_HP,
    archetype: keru.archetype ?? 'blank',
    label: keru.label ?? 'Blank Keru',
    selectedAspectIds: keru.selectedAspectIds ?? [],
    tags: keru.tags ?? ['fragile', 'blank'],
    mutationCount: keru.mutationCount ?? 0,
  };
}

function getKeruArchetypePatch(archetype: Exclude<ActorKeruArchetype, 'blank'>): Pick<ActorKeru, 'archetype' | 'label' | 'hp' | 'hpMax' | 'armor' | 'stamina' | 'staminaMax' | 'energy' | 'energyMax' | 'evasion' | 'sight' | 'mobility' | 'leadership' | 'tags'> {
  if (archetype === 'wolf') {
    return {
      archetype: 'wolf',
      label: 'Wolf Keru',
      hp: 2,
      hpMax: 2,
      armor: 0,
      stamina: 4,
      staminaMax: 4,
      energy: 3,
      energyMax: 3,
      evasion: 8,
      sight: 1,
      mobility: 2,
      leadership: 3,
      tags: ['ranger', 'stamina', 'leadership'],
    };
  }
  if (archetype === 'bear') {
    return {
      archetype: 'bear',
      label: 'Bear Keru',
      hp: 4,
      hpMax: 4,
      armor: 2,
      stamina: 2,
      staminaMax: 2,
      energy: 2,
      energyMax: 2,
      evasion: 0,
      sight: 0,
      mobility: 0,
      leadership: 1,
      tags: ['tank', 'hp', 'armor'],
    };
  }
  return {
    archetype: 'cat',
    label: 'Cat Keru',
    hp: 2,
    hpMax: 2,
    armor: 0,
    stamina: 3,
    staminaMax: 3,
    energy: 4,
    energyMax: 4,
    evasion: 24,
    sight: 3,
    mobility: 3,
    leadership: 0,
    tags: ['rogue', 'stealth', 'evasion', 'sight', 'mobility'],
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
  const enemy = state.enemyActors?.find((actor) => actor.id === actorId);
  if (enemy) return enemy;
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
  relicDefinitions: RelicDefinition[];
  equippedRelics: RelicInstance[];
  relicRuntimeState: Record<string, RelicRuntimeEntry>;
  orimStash: OrimInstance[];
  orimInstances: Record<string, OrimInstance>;
  actorDecks: Record<string, ActorDeckState>;
  globalRestCount?: number;
  noRegretCooldowns?: Record<string, number>;
  noRegretCooldown?: number;
  tiles: Tile[];
  actorKeru?: ActorKeru;
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
  const isFreshStart = persistedKeys.length === 0 || persistedKeys.every((key) => key === 'orimDefinitions' || key === 'relicDefinitions');
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
  const ensureActorCombatStats = (actor: Actor): Actor => ({
    ...actor,
    armor: actor.armor ?? 0,
    evasion: actor.evasion ?? 0,
    accuracy: actor.accuracy ?? 100,
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
      // Deprecated: starter Orim templates are disabled for the rework reset.
      const templateSlots: Array<{ orimId?: string; locked?: boolean }> = [];
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
    if (actor.definitionId === 'fennec' || actor.definitionId === 'fox') {
      return { ...actor, definitionId: 'keru' };
    }
    return actor;
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
  const mergeRelicDefinitions = (
    baseDefinitions: RelicDefinition[],
    persistedDefinitions?: RelicDefinition[]
  ): RelicDefinition[] => {
    if (!persistedDefinitions || persistedDefinitions.length === 0) {
      return baseDefinitions;
    }
    const merged = new Map<string, RelicDefinition>();
    baseDefinitions.forEach((definition) => merged.set(definition.id, definition));
    persistedDefinitions.forEach((definition) => {
      const base = merged.get(definition.id);
      merged.set(definition.id, {
        ...(base ?? definition),
        ...definition,
      });
    });
    return Array.from(merged.values());
  };
  const orimDefinitions = mergeOrimDefinitions(ORIM_DEFINITIONS, persisted?.orimDefinitions);
  const relicDefinitions = mergeRelicDefinitions(RELIC_DEFINITIONS, persisted?.relicDefinitions);
  const persistedRelics = persisted?.equippedRelics ?? [];
  const equippedRelics = relicDefinitions.map((definition, index) => {
    const existing = persistedRelics.find((item) => item.relicId === definition.id);
    return existing ?? {
      instanceId: `relic-${definition.id}-${index + 1}`,
      relicId: definition.id,
      level: 1,
      enabled: DEFAULT_EQUIPPED_RELIC_IDS.has(definition.id),
    };
  });
  const relicRuntimeState = persisted?.relicRuntimeState ?? {};
  const baseActors = (persisted?.availableActors || createInitialActors()).map((actor) =>
    ensureActorCombatStats(
      ensureActorPower(
        ensureActorHp(
          ensureActorEnergy(
            ensureActorLevel(migrateActorDefinitionId(actor))
          )
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
          ensureActorCombatStats(
            ensureActorHp(
              ensureActorEnergy(
                ensureActorLevel(
                  ensureActorOrimSlots(migrateActorDefinitionId(actor))
                )
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
    interactionMode: (options?.playtestVariant === 'party-foundations' || options?.playtestVariant === 'party-battle' || options?.playtestVariant === 'rpg'
      ? 'dnd'
      : (persisted?.interactionMode || 'click')),
    availableActors: finalizedActors,
    tileParties: baseParties,
    activeSessionTileId: persisted?.activeSessionTileId,
    tokens: persisted?.tokens || createInitialTokens(),
    collectedTokens: createEmptyTokenCounts(),
    resourceStash: persisted?.resourceStash || createEmptyTokenCounts(),
    orimDefinitions,
    relicDefinitions,
    equippedRelics,
    relicRuntimeState,
    relicLastActivation: undefined,
    orimStash: persisted?.orimStash || [],
    orimInstances,
    actorDecks,
    actorCombos: persisted?.actorCombos ?? {},
    globalRestCount: persisted?.globalRestCount ?? 0,
    noRegretCooldown: typeof persisted?.noRegretCooldown === 'number'
      ? persisted.noRegretCooldown
      : Math.max(0, ...Object.values(persisted?.noRegretCooldowns ?? {})),
    lastCardActionSnapshot: undefined,
    tiles: persisted?.tiles || createInitialTiles(),
    blueprints: [], // Player's blueprint library
    pendingBlueprintCards: [], // Blueprints in chaos state
    playtestVariant: options?.playtestVariant ?? 'party-foundations',
    currentLocationId: persisted?.currentLocationId ?? 'starting_area', // Initialize player's starting location
    facingDirection: persisted?.facingDirection ?? 'N', // Initialize player's facing direction
    actorKeru: normalizeKeru(persisted?.actorKeru),
  };

  if (!isFreshStart) return baseState;

  const randomWildsTile = baseState.tiles.find((tile) => tile.definitionId === 'random_wilds') || null;
  if (!randomWildsTile) return baseState;

  const partyDefinitionIds = ['keru', 'wolf', 'owl'];
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
  if (foundationActor && !isActorCombatEnabled(foundationActor)) return null;

  const card = tableau[tableau.length - 1];
  const foundation = state.foundations[foundationIndex];
  const foundationTop = foundation[foundation.length - 1];

  if (!canPlayCardWithWild(card, foundationTop, state.activeEffects, foundation)) {
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

function createEmptyEnemyFoundations(): Card[][] {
  return DEFAULT_ENEMY_FOUNDATION_SEEDS.map(() => []);
}

function createDefaultEnemyActors(): Actor[] {
  const actors = DEFAULT_ENEMY_ACTOR_IDS
    .map((definitionId) => createActor(definitionId))
    .filter((actor): actor is Actor => Boolean(actor))
    .slice(0, DEFAULT_ENEMY_FOUNDATION_SEEDS.length)
    .map((actor) => ({
      ...actor,
      hpMax: 10,
      hp: 10,
      armor: 0,
      evasion: 5,
      accuracy: 90,
      staminaMax: 3,
      stamina: 3,
      energyMax: 3,
      energy: 3,
    }));
  return actors;
}

function ensureEnemyActorsForFoundations(
  existingActors: Actor[] | undefined,
  foundationCount: number
): Actor[] {
  const defaults = createDefaultEnemyActors();
  const result: Actor[] = [];
  for (let i = 0; i < foundationCount; i += 1) {
    const existing = existingActors?.[i];
    if (existing) {
      result.push(existing);
      continue;
    }
    const fallback = defaults[i] ?? defaults[defaults.length - 1];
    result.push({
      ...fallback,
      id: `${fallback.id}-${randomIdSuffix()}`,
    });
  }
  return result;
}

function createRandomEnemyActor(): Actor | null {
  const definitionId = DEFAULT_ENEMY_ACTOR_IDS[Math.floor(Math.random() * DEFAULT_ENEMY_ACTOR_IDS.length)];
  const actor = createActor(definitionId);
  if (!actor) return null;
  return {
    ...actor,
    hpMax: 10,
    hp: 10,
    armor: 0,
    evasion: 5,
    accuracy: 90,
    staminaMax: 3,
    stamina: 3,
    energyMax: 3,
    energy: 3,
  };
}

type RpcFamily = 'scratch' | 'bite' | 'peck';

type RpcProfile = {
  damage: number;
  viceGrip: boolean;
  bleedChance: number;
};

function getRpcProfile(family: RpcFamily, count: number): RpcProfile {
  const safeCount = Math.max(1, count);
  if (family !== 'bite') {
    return {
      damage: safeCount,
      viceGrip: false,
      bleedChance: 0,
    };
  }
  if (safeCount <= 1) {
    return { damage: 1, viceGrip: false, bleedChance: 0 };
  }
  if (safeCount === 2) {
    return { damage: 2, viceGrip: false, bleedChance: 0 };
  }
  if (safeCount === 3) {
    return { damage: 3, viceGrip: true, bleedChance: 0 };
  }
  if (safeCount === 4) {
    return { damage: 5, viceGrip: true, bleedChance: 0 };
  }
  return { damage: 6, viceGrip: true, bleedChance: RPG_BITE_BLEED_CHANCE };
}

function getRpcFamily(card: Card): RpcFamily | null {
  if (card.id.startsWith('rpg-scratch-')) return 'scratch';
  if (card.id.startsWith('rpg-bite-') || card.id.startsWith('rpg-vice-bite-')) return 'bite';
  if (card.id.startsWith('rpg-peck-') || card.id.startsWith('rpg-blinding-peck-')) return 'peck';
  return null;
}

function withAddedArmorToActiveParty(state: GameState, armorDelta: number): GameState {
  const tileId = state.activeSessionTileId;
  if (!tileId || armorDelta <= 0) return state;
  const party = state.tileParties[tileId] ?? [];
  if (party.length === 0) return state;
  return {
    ...state,
    tileParties: {
      ...state.tileParties,
      [tileId]: party.map((actor) => ({
        ...actor,
        armor: Math.max(0, (actor.armor ?? 0) + armorDelta),
      })),
    },
  };
}

function warnOnUnexpectedHpIncrease(prev: GameState, next: GameState, context: string): void {
  const collectById = (state: GameState): Map<string, number> => {
    const map = new Map<string, number>();
    const playerParty = getPartyForTile(state, state.activeSessionTileId);
    playerParty.forEach((actor) => {
      map.set(actor.id, actor.hp ?? 0);
    });
    (state.enemyActors ?? []).forEach((actor) => {
      map.set(actor.id, actor.hp ?? 0);
    });
    return map;
  };

  const prevHpById = collectById(prev);
  const nextHpById = collectById(next);
  const increases: Array<{ actorId: string; from: number; to: number }> = [];

  prevHpById.forEach((from, actorId) => {
    const to = nextHpById.get(actorId);
    if (to === undefined) return;
    if (to > from) {
      increases.push({ actorId, from, to });
    }
  });

  if (increases.length === 0) return;
  console.warn('[Invariant][HP Increase]', context, increases);
}

function getRpcCount(card: Card): number {
  if (card.id.startsWith('rpg-scratch-lvl-') || card.id.startsWith('rpg-bite-lvl-') || card.id.startsWith('rpg-peck-lvl-')) {
    const match = card.id.match(/-lvl-(\d+)-/);
    const parsed = match ? Number(match[1]) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (card.id.startsWith('rpg-vice-bite-')) return 3;
  if (card.id.startsWith('rpg-blinding-peck-')) return 3;
  if (card.id.startsWith('rpg-scratch-') || card.id.startsWith('rpg-bite-') || card.id.startsWith('rpg-peck-')) return 1;
  return 0;
}

function getCloudSightCount(card: Card): number {
  if (card.id.startsWith('rpg-cloud-sight-lvl-')) {
    const match = card.id.match(/-lvl-(\d+)-/);
    const parsed = match ? Number(match[1]) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (card.id.startsWith('rpg-cloud-sight-')) return 1;
  return 0;
}

function getEffectiveEvasion(
  state: GameState,
  actor: Actor,
  side: 'player' | 'enemy',
  now: number
): number {
  const base = actor.evasion ?? 0;
  const soarActive = (state.rpgSoarEvasionUntil ?? 0) > now
    && state.rpgSoarEvasionActorId === actor.id
    && (state.rpgSoarEvasionSide ?? 'player') === side;
  return base + (soarActive ? RPG_SOAR_EVASION_BONUS : 0);
}

function getRpgCardRarity(count: number): OrimRarity {
  if (count <= 1) return 'common';
  if (count === 2) return 'uncommon';
  if (count === 3) return 'rare';
  if (count === 4) return 'epic';
  if (count === 5) return 'legendary';
  return 'mythic';
}

function getDefaultRpgCardRarity(card: Card): OrimRarity {
  if (card.id.startsWith('rpg-cloud-sight-')) return getRpgCardRarity(getCloudSightCount(card));
  const family = getRpcFamily(card);
  if (family) {
    return getRpgCardRarity(getRpcCount(card));
  }
  return 'common';
}

function createRpcCard(family: RpcFamily, sourceActorId: string, count: number): Card {
  const safeCount = Math.max(1, count);
  const profile = getRpcProfile(family, safeCount);
  const actorGlyph = family === 'scratch'
    ? 'F'
    : (family === 'bite' ? 'W' : 'O');
  return {
    id: `rpg-${family}-lvl-${safeCount}-${Date.now()}-${randomIdSuffix()}`,
    rank: profile.damage,
    element: 'N',
    suit: ELEMENT_TO_SUIT.N,
    sourceActorId,
    actorGlyph,
    rarity: getRpgCardRarity(safeCount),
  };
}

function createRpgScratchCard(sourceActorId: string): Card {
  return createRpcCard('scratch', sourceActorId, 1);
}

function createRpgBiteCard(sourceActorId: string): Card {
  return createRpcCard('bite', sourceActorId, 1);
}

function createRpgCloudSightCard(sourceActorId: string): Card {
  return createRpgCloudSightCardWithLevel(sourceActorId, 1);
}

function createRpgCloudSightCardWithLevel(sourceActorId: string, level: number): Card {
  const safeLevel = Math.max(1, level);
  return {
    id: `rpg-cloud-sight-lvl-${safeLevel}-${Date.now()}-${randomIdSuffix()}`,
    rank: 0,
    element: 'N',
    suit: ELEMENT_TO_SUIT.N,
    sourceActorId,
    actorGlyph: 'O',
    rarity: getRpgCardRarity(safeLevel),
  };
}

function createRpgPeckCard(sourceActorId: string): Card {
  return createRpcCard('peck', sourceActorId, 1);
}

function createRpgDarkClawCard(sourceActorId: string): Card {
  return {
    id: `rpg-dark-claw-${Date.now()}-${randomIdSuffix()}`,
    rank: 1,
    element: 'D',
    suit: ELEMENT_TO_SUIT.D,
    sourceActorId,
    actorGlyph: 'D',
    rarity: 'common',
  };
}

function upgradeRpgHandCards(cards: Card[]): Card[] {
  const passthrough: Card[] = [];
  const counts: Record<RpcFamily, number> = { scratch: 0, bite: 0, peck: 0 };
  const sourceByFamily: Partial<Record<RpcFamily, string>> = {};
  let cloudSightCount = 0;
  let cloudSightSource: string | undefined;

  cards.forEach((card) => {
    if (card.id.startsWith('rpg-cloud-sight-')) {
      const count = getCloudSightCount(card);
      if (count > 0) {
        cloudSightCount += count;
        if (!cloudSightSource && card.sourceActorId) {
          cloudSightSource = card.sourceActorId;
        }
      }
      return;
    }
    const family = getRpcFamily(card);
    if (!family) {
      passthrough.push(card);
      return;
    }
    const count = getRpcCount(card);
    if (count <= 0) return;
    counts[family] += count;
    if (!sourceByFamily[family] && card.sourceActorId) {
      sourceByFamily[family] = card.sourceActorId;
    }
  });

  const normalized: Card[] = [...passthrough];
  (['scratch', 'bite', 'peck'] as RpcFamily[]).forEach((family) => {
    const count = counts[family];
    if (count <= 0) return;
    normalized.push(createRpcCard(family, sourceByFamily[family] ?? 'unknown', count));
  });
  if (cloudSightCount > 0) {
    normalized.push(createRpgCloudSightCardWithLevel(cloudSightSource ?? 'unknown', cloudSightCount));
  }
  return normalized;
}

function canAwardPlayerActorCards(
  state: GameState,
  options?: { allowEnemyDefault?: boolean; sourceSide?: 'player' | 'enemy' }
): boolean {
  if (state.playtestVariant !== 'rpg') return false;
  const sourceSide = options?.sourceSide ?? (state.randomBiomeActiveSide ?? 'player');
  if (sourceSide === 'enemy') return !!options?.allowEnemyDefault;
  return true;
}

function awardActorComboCards(
  state: GameState,
  foundationIndex: number,
  nextActorCombos: Record<string, number>,
  options?: { allowEnemyDefault?: boolean; sourceSide?: 'player' | 'enemy' }
): Card[] | undefined {
  if (!canAwardPlayerActorCards(state, options)) return state.rpgHandCards;
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  const foundationActor = partyActors[foundationIndex];
  if (!foundationActor) return state.rpgHandCards;
  const combo = nextActorCombos[foundationActor.id] ?? 0;
  if (combo <= 0) return state.rpgHandCards;

  const rewards: Card[] = [];
  if (foundationActor.definitionId === 'keru') {
    rewards.push(createRpgScratchCard(foundationActor.id));
  }
  if (foundationActor.definitionId === 'wolf') {
    if (combo % 3 === 0) rewards.push(createRpgBiteCard(foundationActor.id));
  }
  if (foundationActor.definitionId === 'owl') {
    if (combo % 2 === 0) rewards.push(createRpgPeckCard(foundationActor.id));
    if (combo % 3 === 0) rewards.push(createRpgCloudSightCard(foundationActor.id));
  }
  const base = rewards.length > 0 ? [...(state.rpgHandCards ?? []), ...rewards] : (state.rpgHandCards ?? []);
  return upgradeRpgHandCards(base);
}

function awardEnemyActorComboCards(
  state: GameState,
  enemyFoundationIndex: number,
  nextEnemyCombos: number[]
): Card[][] | undefined {
  if (state.playtestVariant !== 'rpg') return state.rpgEnemyHandCards;
  const enemyActors = state.enemyActors ?? [];
  const actor = enemyActors[enemyFoundationIndex];
  if (!actor) return state.rpgEnemyHandCards;
  const combo = nextEnemyCombos[enemyFoundationIndex] ?? 0;
  if (combo <= 0) return state.rpgEnemyHandCards;

  const definitionId = actor.definitionId.toLowerCase();
  const isDarkClawActor = definitionId === 'shadowcub' || definitionId === 'shadowkit';
  if (!isDarkClawActor) return state.rpgEnemyHandCards;

  const current = state.rpgEnemyHandCards ?? enemyActors.map(() => []);
  const next = current.map((cards) => [...cards]);
  while (next.length < enemyActors.length) next.push([]);
  // Combo required 1 => every combo increment awards one Dark Claw card.
  next[enemyFoundationIndex].push(createRpgDarkClawCard(actor.id));
  return next;
}

function isRpgCombatActive(state: GameState): boolean {
  if (state.playtestVariant !== 'rpg') return true;
  return (state.enemyFoundations ?? []).some((foundation) => foundation.length > 0);
}

export function playCardFromHand(
  state: GameState,
  card: Card,
  foundationIndex: number,
  useWild = false
): GameState | null {
  const isWildCard = card.rank === 0;
  if (state.playtestVariant === 'rpg' && card.id.startsWith('rpg-') && !isWildCard) {
    return null;
  }
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  const foundationActor = partyActors[foundationIndex];
  // Cooldown disabled for now.

  const foundationCount = state.foundations.length;

  const newFoundations = state.foundations.map((f, i) =>
    i === foundationIndex ? [...f, card] : f
  );

  const combos = incrementFoundationCombos(state, foundationIndex);
  const nextActorCombos = foundationActor
    ? {
      ...(state.actorCombos ?? {}),
      [foundationActor.id]: (state.actorCombos?.[foundationActor.id] ?? 0) + 1,
    }
    : (state.actorCombos ?? {});
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
    const baseRpgHandCards = state.playtestVariant === 'rpg'
      ? (state.rpgHandCards ?? []).filter((entry) => entry.id !== card.id)
      : state.rpgHandCards;
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
      actorCombos: nextActorCombos,
      actorDecks: updatedDecks,
      rpgHandCards: isRpgCombatActive(state)
        ? awardActorComboCards({
          ...state,
          actorCombos: nextActorCombos,
          rpgHandCards: baseRpgHandCards,
        }, foundationIndex, nextActorCombos, { sourceSide: 'player' })
        : baseRpgHandCards,
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
  const baseRpgHandCards = state.playtestVariant === 'rpg'
    ? (state.rpgHandCards ?? []).filter((entry) => entry.id !== card.id)
    : state.rpgHandCards;

  const nextState = {
    ...state,
    foundations: newFoundations,
    activeEffects: processEffects(state.activeEffects),
    turnCount: state.turnCount + 1,
    biomeMovesCompleted: (state.biomeMovesCompleted || 0) + 1,
    collectedTokens: newCollectedTokens,
    foundationCombos: newCombos,
    actorCombos: nextActorCombos,
    foundationTokens: newFoundationTokens,
    actorDecks: updatedDecks,
    rpgHandCards: isRpgCombatActive(state)
      ? awardActorComboCards({
        ...state,
        actorCombos: nextActorCombos,
        rpgHandCards: baseRpgHandCards,
      }, foundationIndex, nextActorCombos, { sourceSide: 'player' })
      : baseRpgHandCards,
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
    const foundation = state.foundations[foundationIndex];
    const foundationTop = state.foundations[foundationIndex][state.foundations[foundationIndex].length - 1];
    const canPlay = canPlayCardWithWild(stockCard, foundationTop, state.activeEffects, foundation);
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
  const noRegretActor = getNoRegretActor(state);
  const currentCooldown = state.noRegretCooldown ?? 0;
  const canUseNoRegret = !!noRegretActor && currentCooldown <= 0;
  const hindsightInstance = getHindsightInstance(state);
  const canUseHindsight = !!hindsightInstance && canUseHindsightRewind(state, hindsightInstance);
  if (!canUseNoRegret && !canUseHindsight) return state;

  let nextState: GameState = {
    ...snapshot,
    lastCardActionSnapshot: undefined,
  };
  if (canUseNoRegret) {
    return {
      ...nextState,
      noRegretCooldown: NO_REGRET_COOLDOWN,
    };
  }
  if (!hindsightInstance) return state;

  const restCount = state.globalRestCount ?? 0;
  const runtime = nextState.relicRuntimeState[hindsightInstance.instanceId] ?? {};
  nextState = {
    ...nextState,
    relicRuntimeState: {
      ...nextState.relicRuntimeState,
      [hindsightInstance.instanceId]: {
        ...runtime,
        counters: {
          ...(runtime.counters ?? {}),
          [HINDSIGHT_LAST_USED_REST_COUNTER]: restCount,
        },
      },
    },
    relicLastActivation: {
      instanceId: hindsightInstance.instanceId,
      token: Date.now() + Math.random(),
      procs: 1,
      armorGained: 0,
    },
  };
  return nextState;
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
      canPlayCardWithWild(topCard, foundation[foundation.length - 1], state.activeEffects, foundation)
    );
  });
}

export function getTableauCanPlay(state: GameState): boolean[] {
  return state.tableaus.map((tableau) => {
    if (tableau.length === 0) return false;
    const topCard = tableau[tableau.length - 1];
    return state.foundations.some((foundation) =>
      canPlayCardWithWild(topCard, foundation[foundation.length - 1], state.activeEffects, foundation)
    );
  });
}

export function getValidFoundationsForCard(
  state: GameState,
  card: Card
): boolean[] {
  return state.foundations.map((foundation) =>
    canPlayCardWithWild(card, foundation[foundation.length - 1], state.activeEffects, foundation)
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
    // nodeTableau: undefined, // Deprecated
    pendingBlueprintCards: [],
    foundationCombos: undefined,
    foundationTokens: undefined,
    randomBiomeTurnNumber: undefined,
    currentLocationId: undefined, // Clear current location
    facingDirection: undefined, // Clear facing direction
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
    // nodeTableau: undefined, // Deprecated
    pendingBlueprintCards: [],
    foundationCombos: undefined,
    foundationTokens: undefined,
    randomBiomeTurnNumber: undefined,
    currentLocationId: undefined, // Clear current location
    facingDirection: undefined, // Clear facing direction
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

export function applyKeruArchetype(
  state: GameState,
  archetype: Exclude<ActorKeruArchetype, 'blank'>
): GameState {
  const currentKeru = normalizeKeru(state.actorKeru);
  const patch = getKeruArchetypePatch(archetype);
  const nextKeru: ActorKeru = {
    ...currentKeru,
    ...patch,
    mutationCount: (currentKeru.mutationCount ?? 0) + 1,
    selectedAspectIds: Array.from(new Set([...(currentKeru.selectedAspectIds ?? []), archetype])),
    lastMutationAt: Date.now(),
  };

  const activeTileId = state.activeSessionTileId;
  if (!activeTileId) {
    return {
      ...state,
      actorKeru: nextKeru,
    };
  }
  const party = getPartyForTile(state, activeTileId);
  if (party.length === 0) {
    return {
      ...state,
      actorKeru: nextKeru,
    };
  }

  const lead = party[0];
  const nextLead: Actor = {
    ...lead,
    hpMax: nextKeru.hpMax,
    hp: Math.min(nextKeru.hp, nextKeru.hpMax),
    staminaMax: nextKeru.staminaMax,
    stamina: Math.min(nextKeru.stamina, nextKeru.staminaMax),
    energyMax: nextKeru.energyMax,
    energy: Math.min(nextKeru.energy, nextKeru.energyMax),
    armor: nextKeru.armor,
    evasion: nextKeru.evasion,
    accuracy: Math.max(70, Math.min(130, 100 + nextKeru.sight * 3)),
  };
  const nextParty = [nextLead, ...party.slice(1)];

  const nextFoundations = [...state.foundations];
  if (nextFoundations.length > 0) {
    const existing = nextFoundations[0] ?? [];
    const baseCard = createActorFoundationCard(nextLead);
    nextFoundations[0] = existing.length > 0
      ? [{ ...existing[0], ...baseCard }]
      : [baseCard];
  }

  return {
    ...state,
    actorKeru: nextKeru,
    tileParties: {
      ...state.tileParties,
      [activeTileId]: nextParty,
    },
    foundations: nextFoundations,
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
  const usePartyFoundations = playtestVariant === 'party-foundations' || playtestVariant === 'party-battle' || playtestVariant === 'rpg';
  const useEnemyFoundations = playtestVariant === 'party-battle' || playtestVariant === 'rpg';
  const foundationActors = clampPartyForFoundations(sandboxActors);
  const useSingleWildFoundation = playtestVariant === 'rpg' && biomeId === 'random_wilds';
  const foundations: Card[][] = useSingleWildFoundation
    ? [[createFullWildSentinel(0)]]
    : biomeId === 'random_wilds'
      ? (usePartyFoundations
        ? foundationActors.map((actor) => [createActorFoundationCard(actor)])
        : [[]])
      : foundationActors.map((actor) => [
        createActorFoundationCard(actor),
      ]);
  const foundationCombos = foundations.map(() => 0);
  const foundationTokens = foundations.map(() => createEmptyTokenCounts());
  const enemyFoundations = useEnemyFoundations
    ? (playtestVariant === 'rpg' ? createEmptyEnemyFoundations() : createDefaultEnemyFoundations())
    : undefined;
  const enemyActors = useEnemyFoundations
    ? (playtestVariant === 'rpg' ? [] : ensureEnemyActorsForFoundations(state.enemyActors, enemyFoundations?.length ?? 0))
    : undefined;
  const enemyFoundationCombos = enemyFoundations ? enemyFoundations.map(() => 0) : undefined;
  const enemyFoundationTokens = enemyFoundations ? enemyFoundations.map(() => createEmptyTokenCounts()) : undefined;
  const rpgEnemyHandCards = useEnemyFoundations ? (enemyFoundations?.map(() => []) ?? []) : undefined;
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
    enemyActors,
    enemyFoundationCombos,
    enemyFoundationTokens,
    rpgEnemyHandCards,
    enemyBackfillQueues: undefined,
    randomBiomeTurnNumber: 1,
    randomBiomeActiveSide: useEnemyFoundations ? 'player' : undefined,
    enemyDifficulty: useEnemyFoundations ? (biomeDef.enemyDifficulty ?? 'normal') : undefined,
    rpgHandCards: state.playtestVariant === 'rpg' ? [] : state.rpgHandCards,
    rpgDots: [],
    rpgEnemyDragSlowUntil: 0,
    rpgEnemyDragSlowActorId: undefined,
    rpgCloudSightUntil: 0,
    rpgCloudSightActorId: undefined,
    rpgSoarEvasionUntil: 0,
    rpgSoarEvasionActorId: undefined,
    rpgSoarEvasionSide: undefined,
    rpgSoarEvasionTotalMs: 0,
    rpgComboTimerBonusMs: 0,
    rpgComboTimerBonusToken: undefined,
    rpgBlindedPlayerLevel: 0,
    rpgBlindedPlayerUntil: 0,
    rpgBlindedEnemyLevel: 0,
    rpgBlindedEnemyUntil: 0,
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
  if (foundationActor && !isActorCombatEnabled(foundationActor)) return null;

  const card = tableau[tableau.length - 1];
  const foundation = state.foundations[foundationIndex];
  const foundationTop = foundation[foundation.length - 1];

  if (!canPlayCardWithWild(card, foundationTop, state.activeEffects, foundation)) {
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
    rpgHandCards: isRpgCombatActive(state)
      ? awardActorComboCards(state, foundationIndex, newActorCombos, { sourceSide: 'player' })
      : (state.rpgHandCards ?? []),
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
  const enemyActors = state.enemyActors ?? [];
  if (!enemyFoundations || enemyFoundations.length === 0) return null;
  const tableau = state.tableaus[tableauIndex];
  if (!tableau || tableau.length === 0) return null;
  const enemyFoundation = enemyFoundations[enemyFoundationIndex];
  if (!enemyFoundation) return null;
  if (enemyActors[enemyFoundationIndex] && !isActorCombatEnabled(enemyActors[enemyFoundationIndex])) return null;

  const card = tableau[tableau.length - 1];
  const foundationTop = enemyFoundation[enemyFoundation.length - 1];
  if (!foundationTop) return null;

  if (!canPlayCardWithWild(card, foundationTop, state.activeEffects, enemyFoundation)) {
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

  const nextRpgEnemyHandCards = awardEnemyActorComboCards(state, enemyFoundationIndex, newCombos);

  return {
    ...state,
    tableaus: newTableaus,
    enemyFoundations: newEnemyFoundations,
    enemyFoundationCombos: newCombos,
    enemyFoundationTokens: newEnemyTokens,
    rpgEnemyHandCards: nextRpgEnemyHandCards,
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
  const useEnemyFoundations = (state.playtestVariant === 'party-battle' || state.playtestVariant === 'rpg')
    && (state.enemyFoundations?.length ?? 0) > 0;
  if (!useEnemyFoundations) {
    return endRandomBiomeTurn(state);
  }
  const activeSide = state.randomBiomeActiveSide ?? 'player';
  if (activeSide === 'player') {
    const ensuredEnemyFoundations: Card[][] = state.playtestVariant === 'rpg'
      ? (state.enemyFoundations ?? createEmptyEnemyFoundations())
      : (
        !state.enemyFoundations || state.enemyFoundations.some((foundation) => foundation.length === 0)
          ? createDefaultEnemyFoundations()
          : state.enemyFoundations
      );
    const ensuredEnemyActors = state.playtestVariant === 'rpg'
      ? (state.enemyActors ?? [])
      : ensureEnemyActorsForFoundations(
        state.enemyActors,
        ensuredEnemyFoundations.length
      );
    const nextState: GameState = {
      ...state,
      randomBiomeActiveSide: 'enemy',
      enemyBackfillQueues: createEnemyBackfillQueues(state.tableaus, 10),
      enemyFoundations: ensuredEnemyFoundations,
      enemyActors: ensuredEnemyActors,
      enemyFoundationCombos: ensuredEnemyFoundations.map(() => 0),
      enemyFoundationTokens: ensuredEnemyFoundations.map(() => createEmptyTokenCounts()),
      rpgEnemyHandCards: (() => {
        const existing = state.rpgEnemyHandCards ?? [];
        const mapped = ensuredEnemyFoundations.map((_, idx) => [...(existing[idx] ?? [])]);
        return mapped;
      })(),
    };
    warnOnUnexpectedHpIncrease(state, nextState, 'advanceRandomBiomeTurn:player->enemy');
    return nextState;
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
  const usePartyFoundations = playtestVariant === 'party-foundations' || playtestVariant === 'party-battle' || playtestVariant === 'rpg';
  const useEnemyFoundations = playtestVariant === 'party-battle' || playtestVariant === 'rpg';
  const foundationActors = clampPartyForFoundations(partyActors);
  const useSingleWildFoundation = playtestVariant === 'rpg' && biomeDef.id === 'random_wilds';
  const foundations: Card[][] = useSingleWildFoundation
    ? [[createFullWildSentinel(0)]]
    : (usePartyFoundations
      ? foundationActors.map((actor) => [createActorFoundationCard(actor)])
      : [[]]);
  const foundationCombos = foundations.map(() => 0);
  const foundationTokens = foundations.map(() => createEmptyTokenCounts());
  const enemyFoundations = useEnemyFoundations
    ? (playtestVariant === 'rpg' ? createEmptyEnemyFoundations() : createDefaultEnemyFoundations())
    : undefined;
  const enemyActors = useEnemyFoundations
    ? (playtestVariant === 'rpg' ? [] : ensureEnemyActorsForFoundations(state.enemyActors, enemyFoundations?.length ?? 0))
    : undefined;
  const enemyFoundationCombos = enemyFoundations ? enemyFoundations.map(() => 0) : undefined;
  const enemyFoundationTokens = enemyFoundations ? enemyFoundations.map(() => createEmptyTokenCounts()) : undefined;
  const nextRpgEnemyHandCards = useEnemyFoundations
    ? (() => {
      const existing = state.rpgEnemyHandCards ?? [];
      const mapped = (enemyFoundations ?? []).map((_, idx) => [...(existing[idx] ?? [])]);
      return mapped;
    })()
    : undefined;
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
    enemyActors,
    enemyFoundationCombos,
    enemyFoundationTokens,
    rpgEnemyHandCards: nextRpgEnemyHandCards,
    enemyBackfillQueues: undefined,
    tileParties: state.activeSessionTileId
      ? { ...state.tileParties, [state.activeSessionTileId]: updatedParty }
      : state.tileParties,
    randomBiomeTurnNumber: (state.randomBiomeTurnNumber || 1) + 1,
    randomBiomeActiveSide: useEnemyFoundations ? 'player' : undefined,
    enemyDifficulty: useEnemyFoundations ? (state.enemyDifficulty ?? biomeDef.enemyDifficulty ?? 'normal') : undefined,
    rpgHandCards: state.rpgHandCards ?? [],
    rpgDots: state.rpgDots ?? [],
    rpgEnemyDragSlowUntil: state.rpgEnemyDragSlowUntil ?? 0,
    rpgEnemyDragSlowActorId: state.rpgEnemyDragSlowActorId,
    rpgCloudSightUntil: state.rpgCloudSightUntil ?? 0,
    rpgCloudSightActorId: state.rpgCloudSightActorId,
    rpgSoarEvasionUntil: state.rpgSoarEvasionUntil ?? 0,
    rpgSoarEvasionActorId: state.rpgSoarEvasionActorId,
    rpgSoarEvasionSide: state.rpgSoarEvasionSide,
    rpgSoarEvasionTotalMs: state.rpgSoarEvasionTotalMs ?? 0,
    rpgComboTimerBonusMs: 0,
    rpgComboTimerBonusToken: undefined,
    rpgBlindedPlayerLevel: state.rpgBlindedPlayerLevel ?? 0,
    rpgBlindedPlayerUntil: state.rpgBlindedPlayerUntil ?? 0,
    rpgBlindedEnemyLevel: state.rpgBlindedEnemyLevel ?? 0,
    rpgBlindedEnemyUntil: state.rpgBlindedEnemyUntil ?? 0,
  };
  partyActors.forEach((actor) => {
    nextState = applyOrimTiming(nextState, 'turn-end', actor.id);
  });
  warnOnUnexpectedHpIncrease(state, nextState, 'endRandomBiomeTurn');
  return nextState;
}

export function endExplorationTurnInRandomBiome(state: GameState): GameState {
  if (!state.currentBiome) return state;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef?.randomlyGenerated) return state;
  if (state.playtestVariant !== 'rpg') return state;
  const hasEnemies = (state.enemyFoundations ?? []).some((foundation) => foundation.length > 0);
  if (hasEnemies) return state;
  return {
    ...state,
    globalRestCount: (state.globalRestCount ?? 0) + 1,
    turnCount: state.turnCount + 1,
    randomBiomeTurnNumber: (state.randomBiomeTurnNumber || 1) + 1,
  };
}

/**
 * Rerolls the current random-biome deal in-place.
 * Rebuilds only tableaus (and enemy backfill queue if enemy side is active),
 * preserving active foundations/actors/turn-side so this is safe mid-match.
 */
export function rerollRandomBiomeDeal(state: GameState): GameState {
  if (!state.currentBiome) return state;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef?.randomlyGenerated) return state;

  const nextTableaus = generateShowcaseTableaus(state.tableaus.length || 7);
  const nextEnemyQueue = state.randomBiomeActiveSide === 'enemy'
    ? createEnemyBackfillQueues(nextTableaus, 10)
    : state.enemyBackfillQueues;

  return {
    ...state,
    tableaus: nextTableaus,
    enemyBackfillQueues: nextEnemyQueue,
  };
}

export function spawnRandomEnemyInRandomBiome(state: GameState): GameState {
  if (state.phase !== 'biome') return state;
  const biomeId = state.currentBiome;
  if (!biomeId) return state;
  const biomeDef = getBiomeDefinition(biomeId);
  if (!biomeDef?.randomlyGenerated) return state;
  if (state.playtestVariant !== 'rpg') return state;
  const foundations = state.enemyFoundations;
  if (!foundations || foundations.length === 0) return state;
  const emptyIndexes = foundations
    .map((foundation, index) => ({ foundation, index }))
    .filter(({ foundation }) => foundation.length === 0)
    .map(({ index }) => index);
  if (emptyIndexes.length === 0) return state;
  const spawnIndex = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
  const seed = DEFAULT_ENEMY_FOUNDATION_SEEDS[spawnIndex] ?? DEFAULT_ENEMY_FOUNDATION_SEEDS[0];
  const nextEnemyFoundations = foundations.map((foundation, index) => (
    index === spawnIndex ? [createEnemyFoundationCard(seed)] : foundation
  ));
  const spawnedActor = createRandomEnemyActor();
  const nextEnemyActors = [...(state.enemyActors ?? [])];
  if (spawnedActor) {
    nextEnemyActors[spawnIndex] = { ...spawnedActor, id: `${spawnedActor.id}-${randomIdSuffix()}` };
  }
  const nextEnemyCombos = state.enemyFoundationCombos
    ? state.enemyFoundationCombos.map((value, index) => (index === spawnIndex ? 0 : value))
    : nextEnemyFoundations.map(() => 0);
  const nextEnemyTokens = state.enemyFoundationTokens
    ? state.enemyFoundationTokens.map((value, index) => (index === spawnIndex ? createEmptyTokenCounts() : value))
    : nextEnemyFoundations.map(() => createEmptyTokenCounts());
  const nextEnemyHands = (() => {
    const current = state.rpgEnemyHandCards ?? [];
    const next = nextEnemyFoundations.map((_, index) => [...(current[index] ?? [])]);
    next[spawnIndex] = [];
    return next;
  })();
  return {
    ...state,
    enemyFoundations: nextEnemyFoundations,
    enemyActors: nextEnemyActors,
    enemyFoundationCombos: nextEnemyCombos,
    enemyFoundationTokens: nextEnemyTokens,
    rpgEnemyHandCards: nextEnemyHands,
  };
}

export function playRpgHandCardOnActor(
  state: GameState,
  cardId: string,
  side: 'player' | 'enemy',
  actorIndex: number
): GameState {
  if (state.playtestVariant !== 'rpg') return state;
  const hand = state.rpgHandCards ?? [];
  const card = hand.find((entry) => entry.id === cardId);
  if (!card) return state;
  const rpcFamily = getRpcFamily(card);
  const rpcCount = rpcFamily ? getRpcCount(card) : 0;
  const rpcProfile = rpcFamily ? getRpcProfile(rpcFamily, rpcCount) : null;
  const isCloudSight = card.id.startsWith('rpg-cloud-sight-');
  if (!rpcFamily && !isCloudSight) return state;
  const sourceActor = card.sourceActorId ? findActorById(state, card.sourceActorId) : null;
  const attackerAccuracy = sourceActor?.accuracy ?? 100;

  const resolveDirectDamage = (target: Actor, baseDamage: number): Actor => {
    if ((target.hp ?? 0) <= 0) return target;
    const targetEvasion = getEffectiveEvasion(state, target, side, now);
    const targetArmor = target.armor ?? 0;
    const hitChance = clampPercent(attackerAccuracy - targetEvasion, 5, 95);
    const didHit = Math.random() * 100 < hitChance;
    if (!didHit) return target;
    const damage = Math.max(0, baseDamage - targetArmor);
    if (damage <= 0) return target;
    const hpBefore = target.hp ?? target.hpMax ?? 0;
    return {
      ...target,
      hp: Math.max(0, hpBefore - damage),
      damageTaken: (target.damageTaken ?? 0) + damage,
    };
  };

  const now = Date.now();
  const createDot = (
    targetSide: 'player' | 'enemy',
    targetActorId: string,
    damagePerTick: number,
    ticks: number,
    intervalMs: number,
    effectKind: 'vice_grip' | 'bleed'
  ) => ({
    id: `rpg-dot-${Date.now()}-${randomIdSuffix()}`,
    sourceActorId: sourceActor?.id,
    targetSide,
    targetActorId,
    damagePerTick,
    initialTicks: ticks,
    remainingTicks: ticks,
    nextTickAt: now + intervalMs,
    intervalMs,
    effectKind,
  });
  const stripCardFromHand = (next: GameState): GameState => ({
    ...next,
    rpgHandCards: upgradeRpgHandCards(hand.filter((entry) => entry.id !== cardId)),
  });

  if (side === 'enemy') {
    const enemyActors = state.enemyActors ?? [];
    if (actorIndex < 0 || actorIndex >= enemyActors.length) return state;
    if (!isActorCombatEnabled(enemyActors[actorIndex])) return state;
    if (isCloudSight) return state;
    const baseDamage = rpcProfile?.damage ?? 0;
    const updatedEnemyActors = enemyActors.map((actor, index) =>
      index === actorIndex ? resolveDirectDamage(actor, baseDamage) : actor
    );
    let damagedState: GameState = {
      ...state,
      enemyActors: updatedEnemyActors,
    };
    if (rpcFamily === 'bite' && rpcProfile?.viceGrip) {
      const targetActor = enemyActors[actorIndex];
      damagedState = {
        ...damagedState,
        rpgDots: [
          ...(damagedState.rpgDots ?? []),
          createDot('enemy', targetActor.id, RPG_VICE_BITE_DOT_POWER, RPG_VICE_BITE_TICKS, RPG_VICE_BITE_INTERVAL_MS, 'vice_grip'),
        ],
        rpgEnemyDragSlowUntil: Math.max(damagedState.rpgEnemyDragSlowUntil ?? 0, now + RPG_VICE_BITE_SLOW_MS),
        rpgEnemyDragSlowActorId: targetActor.id,
      };
      if ((rpcProfile.bleedChance ?? 0) > 0 && Math.random() < (rpcProfile.bleedChance ?? 0)) {
        damagedState = {
          ...damagedState,
          rpgDots: [
            ...(damagedState.rpgDots ?? []),
            createDot('enemy', targetActor.id, RPG_BITE_BLEED_DOT_POWER, RPG_BITE_BLEED_TICKS, RPG_BITE_BLEED_INTERVAL_MS, 'bleed'),
          ],
        };
      }
    }
    return stripCardFromHand(damagedState);
  }

  if (!state.activeSessionTileId) return state;
  const party = state.tileParties[state.activeSessionTileId] ?? [];
  if (actorIndex < 0 || actorIndex >= party.length) return state;
  if (!isActorCombatEnabled(party[actorIndex])) return state;

  if (isCloudSight) {
    const target = party[actorIndex];
    if (target.definitionId !== 'owl') return state;
    if (sourceActor?.id && sourceActor.id !== target.id) return state;
    const cloudSightLevel = getCloudSightCount(card);
    const grantsTimerBonus = cloudSightLevel >= 2;
    const grantsEvasion = cloudSightLevel >= 4;
    const scaledEvasionDurationMs = RPG_SOAR_EVASION_BASE_MS + Math.max(0, cloudSightLevel - 4) * RPG_SOAR_EVASION_LEVEL_STEP_MS;
    return stripCardFromHand({
      ...state,
      rpgCloudSightUntil: Math.max(state.rpgCloudSightUntil ?? 0, now + RPG_CLOUD_SIGHT_MS),
      rpgCloudSightActorId: target.id,
      rpgSoarEvasionUntil: grantsEvasion ? Math.max(state.rpgSoarEvasionUntil ?? 0, now + scaledEvasionDurationMs) : (state.rpgSoarEvasionUntil ?? 0),
      rpgSoarEvasionActorId: grantsEvasion ? target.id : state.rpgSoarEvasionActorId,
      rpgSoarEvasionSide: grantsEvasion ? 'player' : state.rpgSoarEvasionSide,
      rpgSoarEvasionTotalMs: grantsEvasion ? scaledEvasionDurationMs : (state.rpgSoarEvasionTotalMs ?? 0),
      rpgComboTimerBonusMs: grantsTimerBonus ? 2000 : (state.rpgComboTimerBonusMs ?? 0),
      rpgComboTimerBonusToken: grantsTimerBonus ? (now + Math.random()) : state.rpgComboTimerBonusToken,
    });
  }

  const baseDamage = rpcProfile?.damage ?? 0;
  const updatedParty = party.map((actor, index) =>
    index === actorIndex ? resolveDirectDamage(actor, baseDamage) : actor
  );

  let damagedState: GameState = {
    ...state,
    tileParties: {
      ...state.tileParties,
      [state.activeSessionTileId]: updatedParty,
    },
  };
  if (rpcFamily === 'bite' && rpcProfile?.viceGrip) {
    const target = party[actorIndex];
    damagedState = {
      ...damagedState,
      rpgDots: [
        ...(damagedState.rpgDots ?? []),
        createDot('player', target.id, RPG_VICE_BITE_DOT_POWER, RPG_VICE_BITE_TICKS, RPG_VICE_BITE_INTERVAL_MS, 'vice_grip'),
      ],
    };
    if ((rpcProfile.bleedChance ?? 0) > 0 && Math.random() < (rpcProfile.bleedChance ?? 0)) {
      damagedState = {
        ...damagedState,
        rpgDots: [
          ...(damagedState.rpgDots ?? []),
          createDot('player', target.id, RPG_BITE_BLEED_DOT_POWER, RPG_BITE_BLEED_TICKS, RPG_BITE_BLEED_INTERVAL_MS, 'bleed'),
        ],
      };
    }
  }
  return stripCardFromHand(damagedState);
}

export function playEnemyRpgHandCardOnActor(
  state: GameState,
  enemyActorIndex: number,
  cardId: string,
  targetActorIndex: number
): GameState {
  if (state.playtestVariant !== 'rpg') return state;
  const enemyActors = state.enemyActors ?? [];
  if (enemyActorIndex < 0 || enemyActorIndex >= enemyActors.length) return state;
  const enemyActor = enemyActors[enemyActorIndex];
  if (!isActorCombatEnabled(enemyActor)) return state;

  const enemyHands = state.rpgEnemyHandCards ?? enemyActors.map(() => []);
  const enemyHand = enemyHands[enemyActorIndex] ?? [];
  const card = enemyHand.find((entry) => entry.id === cardId);
  if (!card) return state;

  const party = getPartyForTile(state, state.activeSessionTileId);
  if (targetActorIndex < 0 || targetActorIndex >= party.length) return state;
  const targetActor = party[targetActorIndex];
  if (!isActorCombatEnabled(targetActor)) return state;

  const rpcFamily = getRpcFamily(card);
  const rpcCount = rpcFamily ? getRpcCount(card) : 0;
  const rpcProfile = rpcFamily ? getRpcProfile(rpcFamily, rpcCount) : null;
  const isDarkClaw = card.id.startsWith('rpg-dark-claw-');
  if (!rpcFamily && !isDarkClaw) return state;

  const sourceActor = card.sourceActorId
    ? (findActorById(state, card.sourceActorId) ?? enemyActor)
    : enemyActor;
  const attackerAccuracy = sourceActor?.accuracy ?? 100;
  const now = Date.now();

  const resolveDirectDamage = (target: Actor, baseDamage: number): Actor => {
    if ((target.hp ?? 0) <= 0) return target;
    const targetEvasion = getEffectiveEvasion(state, target, 'player', now);
    const targetArmor = target.armor ?? 0;
    const hitChance = clampPercent(attackerAccuracy - targetEvasion, 5, 95);
    const didHit = Math.random() * 100 < hitChance;
    if (!didHit) return target;
    const damage = Math.max(0, baseDamage - targetArmor);
    if (damage <= 0) return target;
    const hpBefore = target.hp ?? target.hpMax ?? 0;
    return {
      ...target,
      hp: Math.max(0, hpBefore - damage),
      damageTaken: (target.damageTaken ?? 0) + damage,
    };
  };

  const baseDamage = isDarkClaw ? Math.max(1, card.rank ?? 1) : (rpcProfile?.damage ?? 0);
  if (baseDamage <= 0) return state;

  const updatedParty = party.map((actor, index) =>
    index === targetActorIndex ? resolveDirectDamage(actor, baseDamage) : actor
  );
  let nextState: GameState = {
    ...state,
    tileParties: state.activeSessionTileId
      ? { ...state.tileParties, [state.activeSessionTileId]: updatedParty }
      : state.tileParties,
  };

  if (rpcFamily === 'bite' && rpcProfile?.viceGrip) {
    const createDot = (
      targetSide: 'player' | 'enemy',
      targetActorId: string,
      damagePerTick: number,
      ticks: number,
      intervalMs: number,
      effectKind: 'vice_grip' | 'bleed'
    ) => ({
      id: `rpg-dot-${Date.now()}-${randomIdSuffix()}`,
      sourceActorId: sourceActor?.id,
      targetSide,
      targetActorId,
      damagePerTick,
      initialTicks: ticks,
      remainingTicks: ticks,
      nextTickAt: now + intervalMs,
      intervalMs,
      effectKind,
    });
    nextState = {
      ...nextState,
      rpgDots: [
        ...(nextState.rpgDots ?? []),
        createDot('player', targetActor.id, RPG_VICE_BITE_DOT_POWER, RPG_VICE_BITE_TICKS, RPG_VICE_BITE_INTERVAL_MS, 'vice_grip'),
      ],
    };
    if ((rpcProfile.bleedChance ?? 0) > 0 && Math.random() < (rpcProfile.bleedChance ?? 0)) {
      nextState = {
        ...nextState,
        rpgDots: [
          ...(nextState.rpgDots ?? []),
          createDot('player', targetActor.id, RPG_BITE_BLEED_DOT_POWER, RPG_BITE_BLEED_TICKS, RPG_BITE_BLEED_INTERVAL_MS, 'bleed'),
        ],
      };
    }
  }

  const nextEnemyHands = enemyHands.map((cards, index) =>
    index === enemyActorIndex ? cards.filter((entry) => entry.id !== cardId) : [...cards]
  );
  return {
    ...nextState,
    rpgEnemyHandCards: nextEnemyHands,
  };
}

export function adjustRpgHandCardRarity(
  state: GameState,
  cardId: string,
  delta: -1 | 1
): GameState {
  if (state.playtestVariant !== 'rpg') return state;
  const hand = state.rpgHandCards ?? [];
  const index = hand.findIndex((card) => card.id === cardId);
  if (index === -1) return state;
  const target = hand[index];
  if (!target.id.startsWith('rpg-')) return state;

  const current = target.rarity ?? getDefaultRpgCardRarity(target);
  const currentIndex = ORIM_RARITY_ORDER.indexOf(current);
  if (currentIndex === -1) return state;
  const nextIndex = Math.max(0, Math.min(ORIM_RARITY_ORDER.length - 1, currentIndex + delta));
  if (nextIndex === currentIndex) return state;

  const nextHand = hand.slice();
  nextHand[index] = { ...target, rarity: ORIM_RARITY_ORDER[nextIndex] };
  return {
    ...state,
    rpgHandCards: nextHand,
  };
}

export function tickRpgCombat(state: GameState, now: number = Date.now()): GameState {
  if (state.playtestVariant !== 'rpg') return state;
  const slowExpired = (state.rpgEnemyDragSlowUntil ?? 0) > 0 && now >= (state.rpgEnemyDragSlowUntil ?? 0);
  const cloudExpired = (state.rpgCloudSightUntil ?? 0) > 0 && now >= (state.rpgCloudSightUntil ?? 0);
  const soarExpired = (state.rpgSoarEvasionUntil ?? 0) > 0 && now >= (state.rpgSoarEvasionUntil ?? 0);
  const blindedEnemyExpired = (state.rpgBlindedEnemyUntil ?? 0) > 0 && now >= (state.rpgBlindedEnemyUntil ?? 0);
  const blindedPlayerExpired = (state.rpgBlindedPlayerUntil ?? 0) > 0 && now >= (state.rpgBlindedPlayerUntil ?? 0);
  const dots = state.rpgDots ?? [];
  if (dots.length === 0 && !slowExpired && !cloudExpired && !soarExpired && !blindedEnemyExpired && !blindedPlayerExpired) return state;

  let changed = false;
  let nextState: GameState = state;
  const nextDots = dots.map((dot) => ({ ...dot }));

  if (slowExpired) {
    nextState = { ...nextState, rpgEnemyDragSlowUntil: 0, rpgEnemyDragSlowActorId: undefined };
    changed = true;
  }
  if (cloudExpired) {
    nextState = { ...nextState, rpgCloudSightUntil: 0, rpgCloudSightActorId: undefined };
    changed = true;
  }
  if (soarExpired) {
    nextState = { ...nextState, rpgSoarEvasionUntil: 0, rpgSoarEvasionActorId: undefined, rpgSoarEvasionSide: undefined, rpgSoarEvasionTotalMs: 0 };
    changed = true;
  }
  if (blindedEnemyExpired) {
    nextState = { ...nextState, rpgBlindedEnemyLevel: 0, rpgBlindedEnemyUntil: 0 };
    changed = true;
  }
  if (blindedPlayerExpired) {
    nextState = { ...nextState, rpgBlindedPlayerLevel: 0, rpgBlindedPlayerUntil: 0 };
    changed = true;
  }

  const applyTickDamage = (
    actor: Actor,
    sourceActor: Actor | null,
    baseDamage: number
  ): Actor => {
    if ((actor.hp ?? 0) <= 0) return actor;
    const targetArmor = actor.armor ?? 0;
    const sourceAccuracy = sourceActor?.accuracy ?? 100;
    const targetEvasion = getEffectiveEvasion(nextState, actor, dot.targetSide, now);
    const hitChance = clampPercent(sourceAccuracy - targetEvasion, 5, 95);
    const didHit = Math.random() * 100 < hitChance;
    if (!didHit) return actor;
    const damage = Math.max(0, baseDamage - targetArmor);
    if (damage <= 0) return actor;
    return {
      ...actor,
      hp: Math.max(0, (actor.hp ?? actor.hpMax ?? 0) - damage),
      damageTaken: (actor.damageTaken ?? 0) + damage,
    };
  };

  nextDots.forEach((dot) => {
    if (dot.remainingTicks <= 0) return;
    if (now < dot.nextTickAt) return;
    const sourceActor = dot.sourceActorId ? findActorById(nextState, dot.sourceActorId) : null;

    if (dot.targetSide === 'enemy') {
      const enemyActors = nextState.enemyActors ?? [];
      const idx = enemyActors.findIndex((actor) => actor.id === dot.targetActorId);
      if (idx !== -1) {
        const updatedEnemyActors = enemyActors.map((actor, index) =>
          index === idx ? applyTickDamage(actor, sourceActor, dot.damagePerTick) : actor
        );
        nextState = { ...nextState, enemyActors: updatedEnemyActors };
        changed = true;
      }
    } else if (nextState.activeSessionTileId) {
      const party = nextState.tileParties[nextState.activeSessionTileId] ?? [];
      const idx = party.findIndex((actor) => actor.id === dot.targetActorId);
      if (idx !== -1) {
        const updatedParty = party.map((actor, index) =>
          index === idx ? applyTickDamage(actor, sourceActor, dot.damagePerTick) : actor
        );
        nextState = {
          ...nextState,
          tileParties: {
            ...nextState.tileParties,
            [nextState.activeSessionTileId]: updatedParty,
          },
        };
        changed = true;
      }
    }

    dot.remainingTicks -= 1;
    dot.nextTickAt += dot.intervalMs;
  });

  const filteredDots = nextDots.filter((dot) => dot.remainingTicks > 0);
  if (filteredDots.length !== dots.length) changed = true;
  if (!changed) return state;
  return {
    ...nextState,
    rpgDots: filteredDots,
  };
}

export function updateRelicDefinitions(state: GameState, definitions: RelicDefinition[]): GameState {
  const deduped = new Map<string, RelicDefinition>();
  definitions.forEach((definition) => {
    if (!definition.id) return;
    deduped.set(definition.id, definition);
  });
  const nextDefinitions = Array.from(deduped.values());
  const nextEquipped = nextDefinitions.map((definition, index) => {
    const existing = state.equippedRelics.find((item) => item.relicId === definition.id);
    return existing ?? {
      instanceId: `relic-${definition.id}-${index + 1}`,
      relicId: definition.id,
      level: 1,
      enabled: false,
    };
  });
  return {
    ...state,
    relicDefinitions: nextDefinitions,
    equippedRelics: nextEquipped,
  };
}

export function updateEquippedRelics(state: GameState, equippedRelics: RelicInstance[]): GameState {
  const validRelicIds = new Set(state.relicDefinitions.map((definition) => definition.id));
  const nextEquipped = equippedRelics.filter((instance) => validRelicIds.has(instance.relicId));
  return {
    ...state,
    equippedRelics: nextEquipped,
  };
}

export function processRelicCombatEvent(state: GameState, event: RelicCombatEvent): GameState {
  if (state.playtestVariant !== 'rpg') return state;
  if (event.side !== 'player') return state;
  if (event.type === 'NO_PLAYABLE_MOVES') {
    const hasEnemies = (state.enemyFoundations ?? []).some((foundation) => foundation.length > 0);
    if (hasEnemies) return state;
    if (!checkNoValidMoves(state)) return state;
    const heartRelic = state.relicDefinitions.find((definition) => definition.behaviorId === 'heart_of_wild_v1');
    if (!heartRelic) return state;
    const heartInstance = state.equippedRelics.find((instance) => instance.relicId === heartRelic.id && instance.enabled);
    if (!heartInstance) return state;
    const restCount = state.globalRestCount ?? 0;
    if (restCount <= 0) return state;
    const runtime = state.relicRuntimeState[heartInstance.instanceId] ?? {};
    const lastTriggeredRestCount = Number(runtime.counters?.heartLastTriggeredRestCount ?? 0);
    if (restCount <= lastTriggeredRestCount) return state;
    const stamp = Date.now();
    const nextFoundations = state.foundations.map((foundation, index) => ([
      ...foundation,
      {
        ...createFullWildSentinel(index),
        id: `heart-wild-${stamp}-${index}-${randomIdSuffix()}`,
      },
    ]));
    return {
      ...state,
      foundations: nextFoundations,
      relicRuntimeState: {
        ...state.relicRuntimeState,
        [heartInstance.instanceId]: {
          ...runtime,
          counters: {
            ...(runtime.counters ?? {}),
            heartLastTriggeredRestCount: restCount,
          },
        },
      },
      relicLastActivation: {
        instanceId: heartInstance.instanceId,
        token: Date.now() + Math.random(),
        procs: 1,
        armorGained: 0,
      },
    };
  }
  if (event.type !== 'TURN_ENDED_EARLY') return state;
  const turtleRelic = state.relicDefinitions.find((definition) => definition.behaviorId === 'turtle_bide_v1');
  if (!turtleRelic) return state;
  const turtleInstance = state.equippedRelics.find((instance) => instance.relicId === turtleRelic.id && instance.enabled);
  if (!turtleInstance) return state;
  const msPerArmor = Number(turtleRelic.params?.msPerArmor ?? 5000);
  const armorPerProc = Number(turtleRelic.params?.armorPerProc ?? 1);
  if (!Number.isFinite(msPerArmor) || msPerArmor <= 0 || !Number.isFinite(armorPerProc) || armorPerProc <= 0) {
    return state;
  }
  const runtime = state.relicRuntimeState[turtleInstance.instanceId] ?? {};
  const priorRemainder = runtime.counters?.bankedMsRemainder ?? 0;
  const totalMs = priorRemainder + Math.max(0, Math.round(event.bankedMs));
  const procs = Math.floor(totalMs / msPerArmor);
  const remainder = totalMs % msPerArmor;
  let nextState: GameState = {
    ...state,
    relicRuntimeState: {
      ...state.relicRuntimeState,
      [turtleInstance.instanceId]: {
        ...runtime,
        counters: {
          ...(runtime.counters ?? {}),
          bankedMsRemainder: remainder,
        },
      },
    },
  };
  if (procs > 0) {
    const armorGain = procs * armorPerProc;
    nextState = {
      ...withAddedArmorToActiveParty(nextState, armorGain),
      relicLastActivation: {
        instanceId: turtleInstance.instanceId,
        token: Date.now() + Math.random(),
        procs,
        armorGained: armorGain,
      },
    };
  }
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
    return {
      ...startRandomBiome(state, tileId, biomeId, partyActors),
      currentLocationId: biomeId, // Set current location
    };
  }

  // Node-edge mode is deprecated; fall through to traditional biome setup
  // if (biomeDef.mode === 'node-edge') {
  //   return startNodeEdgeBiome(state, biomeDef, partyActors, tileId);
  // }

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
 * Plays a card in biome mode - tracks moves and spawns blueprints
 */
function isTableauCleared(tableaus: Card[][], index: number): boolean {
  return tableaus[index]?.length === 0;
}

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

/**
 * Checks if the player can traverse in their facing direction.
 * Traversal is possible if there's an exit in that direction and
 * all directional tableaus for that exit are cleared.
 */
export function canTraverse(state: GameState): boolean {
  if (!state.currentLocationId || !state.facingDirection) return false;
  const biomeDef = getBiomeDefinition(state.currentLocationId);
  if (!biomeDef) return false;

  const targetBiomeId = biomeDef.exits?.[state.facingDirection];
  if (!targetBiomeId) return false; // No exit in this direction

  const directionalTableaus = biomeDef.directionalTableaus?.[state.facingDirection];
  if (directionalTableaus && directionalTableaus.length > 0) {
    // If directional tableaus are specified, all must be cleared
    return directionalTableaus.every(idx => isTableauCleared(state.tableaus, idx));
  }

  // If no specific directional tableaus are defined, but an exit exists, traversal is open
  return true;
}

/**
 * Executes traversal to a new biome in the player's facing direction.
 * Resets biome state and starts the new biome.
 */
export function traverse(state: GameState): GameState | null {
  if (!canTraverse(state)) return null; // Cannot traverse if conditions not met

  const biomeDef = getBiomeDefinition(state.currentLocationId!); // current location is guaranteed by canTraverse
  const newBiomeId = biomeDef!.exits![state.facingDirection!]!; // new biome is guaranteed by canTraverse

  // Clear current biome state (tableaus, foundations, etc.)
  let nextState: GameState = {
    ...state,
    tableaus: [],
    foundations: [],
    stock: [],
    activeEffects: [],
    turnCount: 0,
    collectedTokens: createEmptyTokenCounts(),
    pendingBlueprintCards: [],
    foundationCombos: undefined,
    actorCombos: undefined, // Clear actor combos for new biome
    foundationTokens: undefined,
    enemyFoundations: undefined, // Clear enemy data
    enemyActors: undefined,
    enemyFoundationCombos: undefined,
    enemyFoundationTokens: undefined,
    rpgEnemyHandCards: undefined,
    enemyBackfillQueues: undefined,
    randomBiomeTurnNumber: undefined,
    randomBiomeActiveSide: undefined,
    enemyDifficulty: undefined,
    rpgHandCards: undefined, // Clear RPG hand for new biome
    rpgDots: [],
    rpgEnemyDragSlowUntil: 0,
    rpgEnemyDragSlowActorId: undefined,
    rpgCloudSightUntil: 0,
    rpgCloudSightActorId: undefined,
    rpgSoarEvasionUntil: 0,
    rpgSoarEvasionActorId: undefined,
    rpgSoarEvasionSide: undefined,
    rpgSoarEvasionTotalMs: 0,
    rpgComboTimerBonusMs: 0,
    rpgComboTimerBonusToken: undefined,
    rpgBlindedPlayerLevel: 0,
    rpgBlindedPlayerUntil: 0,
    rpgBlindedEnemyLevel: 0,
    rpgBlindedEnemyUntil: 0,
    // Update current location and active session tile
    currentLocationId: newBiomeId,
    activeSessionTileId: newBiomeId, // Active session tile ID can be the biome ID now
  };

  // Start the new biome
  const partyActors = getPartyForTile(nextState, newBiomeId); // Get party for the new tile
  return startBiome(nextState, newBiomeId, newBiomeId);
}


