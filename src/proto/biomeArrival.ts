import type { ProtoState } from './protoState';
import { arriveAt } from './biomeFlags';
import { discoverActorTiles } from './tileDiscovery';
import { createQuestExplorationFoundations, EMPTY_HAUL, FOREST_CACHE_REWARD } from './rules/setup';
import { canSpendStamina, spendStamina } from './staminaTesting';

/** Load the destination deal atomically with its selection, preserving the departing deal. */
export const activateBiome = (state: ProtoState, biomeId: string): ProtoState => {
  const target = state.biomeTiles.find(tile => tile.id === biomeId);
  if (!target || target.tileType === 'impassable-mountain' || state.selectedBiomeId === biomeId) return state;
  return { ...state, selectedBiomeId: biomeId,
    biomeTiles: state.biomeTiles.map(tile => tile.id === state.selectedBiomeId
      ? { ...tile, tableau: state.tableau, stock: state.stock } : tile),
    biome: { ...state.biome, seed: target.seed, cacheReward: target.road || target.tileType ? { ...EMPTY_HAUL } : { ...FOREST_CACHE_REWARD }, cacheClaimed: target.tableau.length === 0 && target.stock.length === 0 },
    foundations: createQuestExplorationFoundations(state.party, target.gridSize.columns * target.gridSize.rows, target.tableau),
    tableau: target.tableau.map(column => column.map(card => ({ ...card }))),
    stock: target.stock.map(card => ({ ...card })),
  };
};

export const arriveActorAtBiome = (state: ProtoState, actorId: string, biomeId: string,
  destination: { x: number; y: number }, requestedFoundationIndex?: number): ProtoState => {
  const target = state.biomeTiles.find(tile => tile.id === biomeId);
  const actor = state.worldActors.find(entry => entry.id === actorId);
  if (!actor || target?.tileType === 'impassable-mountain' || !target?.unlocked || !canSpendStamina(state.stamina, target.travelCost)) return state;
  const departing = actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId
    ? { ...state, foundations: state.foundations.map((slot, index) => index === (actor.foundationIndex ?? 0) && slot
      ? { ...slot, count: 0, cards: [], wildcardBridgeFromRank: undefined } : slot) }
    : state;
  const active = activateBiome(departing, biomeId);
  const available = (index: number) => index >= 0 && index < active.foundations.length &&
    Number.isInteger(index) && active.foundations[index]?.count === 0 && active.foundations[index]?.cards.length === 0 &&
    !active.worldActors.some(entry => entry.id !== actorId && entry.location === 'foundation' && entry.biomeId === biomeId && (entry.foundationIndex ?? 0) === index);
  const index = requestedFoundationIndex ?? active.foundations.findIndex((_, i) => available(i));
  return discoverActorTiles({ ...active,
    biomeTiles: active.biomeTiles.map(tile => tile.id === biomeId ? { ...tile, tileType: tile.tileType === 'unexplored' ? 'path' as const : tile.tileType, flags: arriveAt(tile.flags) } : tile),
    worldActors: active.worldActors.map(entry => entry.id === actorId
      ? { ...entry, position: destination, biomeId, hutId: undefined,
          location: available(index) ? 'foundation' : 'table', foundationIndex: available(index) ? index : undefined } : entry),
    stamina: spendStamina(state.stamina, target.travelCost),
    settledHaul: actor.location === 'foundation' ? { ...state.haul } : state.settledHaul,
  });
};
