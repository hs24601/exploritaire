import type { ProtoState } from './protoState';
import { getBiomeExitPoint } from './components/ProtoMap';

/** Allocate separate free exit cells before dispatching any state updates. */
type DepartureState = Pick<ProtoState, 'worldResourceStacks' | 'biomeTiles' | 'selectedBiomeId'> & {
  worldActors: readonly (Omit<ProtoState['worldActors'][number], 'id'> & { id: string })[];
};
export function tableauDepartures(state: DepartureState, actorId?: string) {
  const occupied = [
    ...state.worldActors.filter(actor => actor.location === 'table').map(actor => actor.position),
    ...state.worldResourceStacks.map(stack => stack.position),
  ];
  return state.worldActors.filter(actor => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId && (!actorId || actor.id === actorId)).flatMap(actor => {
    const biome = state.biomeTiles.find(tile => tile.id === actor.biomeId);
    if (!biome) return [];
    const position = getBiomeExitPoint(biome, occupied);
    occupied.push(position);
    return [{ actorId: actor.id, position }];
  });
}
