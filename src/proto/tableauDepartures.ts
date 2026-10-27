import type { ProtoState } from './protoState';

/** Leaving a foundation returns the actor to its existing world position. */
type DepartureState = Pick<ProtoState, 'biomeTiles' | 'selectedBiomeId'> & {
  worldActors: readonly (Omit<ProtoState['worldActors'][number], 'id'> & { id: string })[];
};
export function tableauDepartures(state: DepartureState, actorId?: string) {
  return state.worldActors.filter(actor => actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId && (!actorId || actor.id === actorId)).flatMap(actor => {
    const biome = state.biomeTiles.find(tile => tile.id === actor.biomeId);
    if (!biome) return [];
    return [{ actorId: actor.id, position: { ...actor.position } }];
  });
}
