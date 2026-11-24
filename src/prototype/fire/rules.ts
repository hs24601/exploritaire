export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type Region = 'north' | 'east' | 'south' | 'west';
export type ResourceType = 'wood' | 'carrot' | 'acorn';
export type ActorTrait = 'lumberLore';
export type NodeResourceType = ResourceType;
export type FireName = 'Ember' | 'Small Fire' | 'Steady Fire';

export interface FireCard { id: string; rank: Rank; resourceType: ResourceType; }
export interface ResourceRequirement { resourceType: ResourceType; capacity: number; }
/** Shared semantic contracts for future actors and interactable nodes. */
export interface ActorProfile { id: string; traits: readonly ActorTrait[]; }
export interface NodeProfile { id: string; resourceType: NodeResourceType; preferredTrait?: ActorTrait; harvestPointsPerResource?: number; /** @deprecated use preferredTrait */ requiredTrait?: ActorTrait; }
/** Every actor can work every node. Traits are an efficiency affinity, not a gate. */
export const canActorInteractWithNode = (_actor: ActorProfile, _node: NodeProfile) => true;
export interface FireState {
  fireRank: 0 | 1 | 2;
  requiredFuelRank: Rank | null;
  fuelConsumed: number;
  fuelRequired: number;
  stateName: FireName;
  fuelQueue: FireCard[];
  /** Ten fuel ticks make up each of the four visual rails around the fire. */
  fuelTicks: number;
  /** Action-driven time for this prototype. Nodes advance this once per interaction. */
  actionCount: number;
  /** Once kindled, the fire remains a Campfire even while its fuel ebbs. */
  hasIgnited: boolean;
}
export interface SpiritFireGame {
  /** Retained for future multi-foundation entities; Ember currently takes direct donations. */
  tableauRegions: Record<Region, FireCard[]>;
  scatteredCards: FireCard[];
  selectedCardId: string | null;
  fireState: FireState;
  gameMessage: string;
}

export const REGIONS: Region[] = ['north', 'east', 'south', 'west'];
export const EMBER_COMPLETION_REQUIREMENT = 4;
export const FUEL_TICKS_PER_RAIL = 10;
export const FIRE_RAIL_COUNT = 4;
export const FIRE_FUEL_CAPACITY = FUEL_TICKS_PER_RAIL * FIRE_RAIL_COUNT;
export const EMBER_TARGET_ID = 'ember';
export const EMBER_REQUIREMENT: ResourceRequirement = { resourceType: 'wood', capacity: EMBER_COMPLETION_REQUIREMENT };
export const rankLabel = (rank: Rank | null) => rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === null ? '—' : String(rank);
export const resourceLabel = (resource: ResourceType) => resource === 'wood' ? 'Wood' : resource === 'carrot' ? 'Carrot' : 'Acorn';
export const foundationTargetId = (region: Region) => `foundation-${region}`;
/** Legacy exports kept for older prototype consumers. */
export const FOUNDATION_REQUIREMENTS: Record<Region, ResourceRequirement> = Object.fromEntries(REGIONS.map((region) => [region, EMBER_REQUIREMENT])) as Record<Region, ResourceRequirement>;
export const FOUNDATION_SEQUENCES: Record<Region, readonly Rank[]> = { north: [], east: [], south: [], west: [] };
export const requiredRankForFoundation = () => null;

const makeCards = (region: Region, ranks: Rank[]) => ranks.map((rank, index) => ({ id: `${region}-${index + 1}`, rank, resourceType: 'wood' as const }));
const seed: Record<Region, FireCard[]> = {
  north: makeCards('north', [9, 10, 11, 12]), east: makeCards('east', [5, 6, 7, 8]),
  south: makeCards('south', [13, 1, 2, 3]), west: makeCards('west', [1, 2, 3, 4]),
};

export const createInitialGame = (): SpiritFireGame => ({
  tableauRegions: { north: [], east: [], south: [], west: [] },
  scatteredCards: [...seed.north, ...seed.east, ...seed.south, ...seed.west],
  selectedCardId: null,
  fireState: { fireRank: 0, requiredFuelRank: null, fuelConsumed: 0, fuelRequired: EMBER_COMPLETION_REQUIREMENT, stateName: 'Ember', fuelQueue: [], fuelTicks: 0, actionCount: 0, hasIgnited: false },
  gameMessage: 'Small Grove yields wood. Drag any wood card directly to the Ember.',
});

export function getCard(game: SpiritFireGame, id: string): { card: FireCard; region?: Region; location: 'foundation' | 'scattered'; index: number } | null {
  const scatteredIndex = game.scatteredCards.findIndex((card) => card.id === id);
  if (scatteredIndex >= 0) return { card: game.scatteredCards[scatteredIndex], location: 'scattered', index: scatteredIndex };
  const fuelIndex = game.fireState.fuelQueue.findIndex((card) => card.id === id);
  if (fuelIndex >= 0) return { card: game.fireState.fuelQueue[fuelIndex], location: 'foundation', index: fuelIndex };
  return null;
}

/** Resource eligibility is independent of card rank and reusable by future entities. */
export function isValidEmberDonation(game: SpiritFireGame, sourceId: string) {
  const source = getCard(game, sourceId);
  return !!source && source.location === 'scattered' && source.card.resourceType === EMBER_REQUIREMENT.resourceType && game.fireState.fuelTicks < FIRE_FUEL_CAPACITY;
}
export function getValidMoves(game: SpiritFireGame, sourceId: string) { return isValidEmberDonation(game, sourceId) ? [EMBER_TARGET_ID] : []; }
/** Legacy foundation wrapper; active Ember donation is direct rather than cardinal. */
export function isValidDonation(game: SpiritFireGame, sourceId: string, _region: Region) { return isValidEmberDonation(game, sourceId); }
/** True once the fire has been kindled at least once; fuel may subsequently ebb. */
export function isTableauSorted(game: SpiritFireGame) { return game.fireState.hasIgnited; }
export function getFoundationProgress(game: SpiritFireGame) { return game.fireState.fuelQueue.length; }
export function getFuelProgress(game: SpiritFireGame) { return game.fireState.fuelTicks; }
export function getFireLuminosity(game: SpiritFireGame) { return Math.max(.5, game.fireState.fuelTicks / FUEL_TICKS_PER_RAIL); }
export function isFireFullyStoked(game: SpiritFireGame) { return game.fireState.fuelTicks >= FIRE_FUEL_CAPACITY; }

export function donateToEmber(game: SpiritFireGame, sourceId: string): SpiritFireGame {
  if (!isValidEmberDonation(game, sourceId)) return { ...game, gameMessage: 'The Ember accepts a wood resource card.' };
  const source = getCard(game, sourceId)!;
  const fuelQueue = [...game.fireState.fuelQueue, source.card];
  const fuelTicks = Math.min(FIRE_FUEL_CAPACITY, game.fireState.fuelTicks + FUEL_TICKS_PER_RAIL);
  const hasIgnited = game.fireState.hasIgnited || fuelQueue.length >= EMBER_COMPLETION_REQUIREMENT;
  return {
    ...game,
    scatteredCards: game.scatteredCards.filter((card) => card.id !== sourceId),
    selectedCardId: null,
    fireState: { ...game.fireState, fuelQueue, fuelTicks, fuelConsumed: fuelQueue.length, hasIgnited, stateName: hasIgnited ? 'Steady Fire' : game.fireState.stateName },
    gameMessage: hasIgnited && !game.fireState.hasIgnited ? 'The Ember catches: a Campfire burns.' : `Wood feeds the fire. ${fuelTicks} / ${FIRE_FUEL_CAPACITY} fuel.`,
  };
}
export function donateCard(game: SpiritFireGame, sourceId: string, _region: Region): SpiritFireGame { return donateToEmber(game, sourceId); }
export function moveCard(game: SpiritFireGame, sourceId: string, _destinationId: string): SpiritFireGame { return donateToEmber(game, sourceId); }
export function isCardExposed(game: SpiritFireGame, id: string) { return getCard(game, id)?.location === 'scattered'; }
export function isCardAdjacentToFire(game: SpiritFireGame, id: string) { return getCard(game, id)?.location === 'foundation'; }
export function isValidTableauMove(game: SpiritFireGame, sourceId: string, _destinationId: string) { return isValidEmberDonation(game, sourceId); }
export function isValidFuelCard(card: FireCard | null) { return card?.resourceType === EMBER_REQUIREMENT.resourceType; }
/** Advances action time by one beat. This is intentionally action-driven, not real-time. */
export function consumeFuel(game: SpiritFireGame) {
  const fuelTicks = Math.max(0, game.fireState.fuelTicks - 1);
  return {
    ...game,
    fireState: { ...game.fireState, fuelTicks, actionCount: game.fireState.actionCount + 1 },
    gameMessage: fuelTicks === 0 ? 'The campfire has ebbed to coals. Gather wood to feed it.' : `The fire ebbs. ${fuelTicks} / ${FIRE_FUEL_CAPACITY} fuel.`,
  };
}
export function advanceFireIfReady(game: SpiritFireGame) { return game; }
