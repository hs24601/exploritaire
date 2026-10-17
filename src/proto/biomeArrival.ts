import { partyMembers } from './partySystem';
import type { ProtoState } from './protoState';
import { arriveAt } from './biomeFlags';
import { discoverActorTiles } from './tileDiscovery';
import { createQuestExplorationFoundations, EMPTY_HAUL, FOREST_CACHE_REWARD } from './rules/setup';

/** Load the destination deal atomically with its selection, preserving the departing deal. */
export const activateBiome = (state: ProtoState, biomeId: string): ProtoState => {
  const target = state.biomeTiles.find(tile => tile.id === biomeId);
  if (!target || target.tileType === 'impassable-mountain' || target.tileType === 'dirt' || state.selectedBiomeId === biomeId) return state;
  if (biomeId === 'hero-den' && state.ordinaryDay && !state.ordinaryDay.bedtime) return state;
  return { ...state, selectedBiomeId: biomeId,
    biomeTiles: state.biomeTiles.map(tile => tile.id === state.selectedBiomeId
      ? { ...tile, tableau: state.tableau, stock: state.stock } : tile),
    biome: { ...state.biome, seed: target.seed, cacheReward: target.road || target.tileType ? { ...EMPTY_HAUL } : { ...FOREST_CACHE_REWARD }, cacheClaimed: target.tableau.length === 0 && target.stock.length === 0 },
    foundations: target.id === 'hero-den' && state.denRest?.receivingCard
      ? [{card:state.denRest.receivingCard,count:0,cards:[]}]
      : createQuestExplorationFoundations(state.party, target.gridSize.columns * target.gridSize.rows, target.tableau),
    tableau: target.tableau.map(column => column.map(card => ({ ...card }))),
    stock: target.stock.map(card => ({ ...card })),
  };
};

const arriveSingleActorAtBiome = (state: ProtoState, actorId: string, biomeId: string,
  destination: { x: number; y: number }, requestedFoundationIndex?: number): ProtoState => {
  const target = state.biomeTiles.find(tile => tile.id === biomeId);
  const actor = state.worldActors.find(entry => entry.id === actorId);
  if (!actor || target?.tileType === 'impassable-mountain' || !target?.unlocked) return state;
  // Coming home is a quiet return, not an automatic sleep game.
  if (biomeId === 'hero-den' && state.ordinaryDay && !state.ordinaryDay.bedtime) {
    return discoverActorTiles({ ...state, travelStamina: state.dayScenario ? state.travelStamina : 24,
      biomeTiles: state.biomeTiles.map(tile => tile.id === state.selectedBiomeId ? { ...tile, tableau: state.tableau, stock: state.stock } : tile),
      selectedBiomeId: null, tableau: [], stock: [], foundations: [],
      settledHaul: { ...state.haul, ...(state.dayScenario ? { mana: state.settledHaul.mana } : {}) },
      worldActors: state.worldActors.map(entry => entry.id === actorId
        ? { ...entry, position: destination, location: 'table', biomeId: undefined, foundationIndex: undefined } : entry),
    });
  }
  const departing = actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId
    ? { ...state, foundations: state.foundations.map((slot, index) => index === (actor.foundationIndex ?? 0) && slot
      ? { ...slot, count: 0, cards: [], wildcardBridgeFromRank: undefined } : slot) }
    : state;
  if (target.tileType === 'dirt' || target.berryPatchVariant === 'sparse' || target.opensTableauOnArrival === false) {
    return discoverActorTiles({ ...departing,
      worldActors: departing.worldActors.map(entry => entry.id === actorId
        ? { ...entry, position: destination, location: 'table', biomeId, foundationIndex: undefined, hutId: undefined } : entry),
      settledHaul: actor.location === 'foundation' ? { ...state.haul } : state.settledHaul,
    });
  }
  const active = activateBiome(departing, biomeId);
  const available = (index: number) => index >= 0 && index < active.foundations.length &&
    Number.isInteger(index) && active.foundations[index]?.count === 0 && active.foundations[index]?.cards.length === 0 &&
    !active.worldActors.some(entry => entry.id !== actorId && entry.location === 'foundation' && entry.biomeId === biomeId && (entry.foundationIndex ?? 0) === index);
  const index = requestedFoundationIndex ?? active.foundations.findIndex((_, i) => available(i));
  return discoverActorTiles({ ...active,
    ordinaryDay: active.ordinaryDay && biomeId === 'day-one-tree' ? { ...active.ordinaryDay, visitedTree: true } : active.ordinaryDay,
    biomeTiles: active.biomeTiles.map(tile => tile.id === biomeId ? { ...tile, tileType: tile.tileType === 'unexplored' ? 'path' as const : tile.tileType, flags: arriveAt(tile.flags) } : tile),
    worldActors: active.worldActors.map(entry => entry.id === actorId
      ? { ...entry, position: destination, biomeId, hutId: undefined,
          location: available(index) ? 'foundation' : 'table', foundationIndex: available(index) ? index : undefined } : entry),
    settledHaul: actor.location === 'foundation' ? { ...state.haul } : state.settledHaul,
  });
};

export const arriveActorAtBiome = (state: ProtoState, actorId: string, biomeId: string,
 destination: {x:number;y:number}, requestedFoundationIndex?: number): ProtoState => {
 const members = partyMembers(state,actorId);
 const target = state.biomeTiles.find(t => t.id === biomeId);
 if (!target?.unlocked || target.tileType === 'impassable-mountain') return state;
 const leaderId = members.length > 1 ? members[0].id : actorId;
 let next = arriveSingleActorAtBiome(state,leaderId,biomeId,destination,members.length > 1 ? undefined : requestedFoundationIndex);
 const leader = next.worldActors.find(a => a.id === leaderId);
 for (const member of members.filter(a => a.id !== leaderId)) {
  if (leader?.location === 'foundation' && biomeId !== 'hero-den') {
   const seed = next.foundations[leader.foundationIndex ?? 0];
   const index = next.foundations.findIndex((_,i) => !next.worldActors.some(a => a.location === 'foundation' && a.biomeId === biomeId && a.foundationIndex === i));
   const slot = index < 0 ? next.foundations.length : index;
   if (index < 0 && seed) next = {...next,foundations:[...next.foundations,{...seed,card:{...seed.card,id:`party-foundation-${member.id}`},count:0,cards:[]}]};
   next = arriveSingleActorAtBiome(next,member.id,biomeId,destination,slot);
  } else next = {...next,worldActors:next.worldActors.map(a => a.id === member.id ? {...a,position:{...destination},location:'table',biomeId:leader?.biomeId,foundationIndex:undefined,hutId:undefined} : a)};
 }
 return discoverActorTiles(next);
};
