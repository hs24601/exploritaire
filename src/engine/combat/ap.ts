import type { Actor, GameState } from '../types';

function incrementActorAp(actor: Actor, amount: number): Actor {
  const gain = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (gain <= 0) return actor;
  const currentPower = Math.max(0, Number(actor.power ?? 0));
  const nextPower = currentPower + gain;
  if (nextPower === currentPower) return actor;
  return {
    ...actor,
    power: nextPower,
  };
}

export function grantApToActorById(
  state: GameState,
  actorId: string | null | undefined,
  amount: number = 1
): GameState {
  if (!actorId) return state;
  const gain = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (gain <= 0) return state;

  let availableChanged = false;
  const nextAvailableActors = state.availableActors.map((actor) => {
    if (actor.id !== actorId) return actor;
    const updated = incrementActorAp(actor, gain);
    if (updated !== actor) availableChanged = true;
    return updated;
  });

  let tilePartiesChanged = false;
  const nextTileParties = Object.fromEntries(
    Object.entries(state.tileParties).map(([tileId, actors]) => {
      let partyChanged = false;
      const nextActors = actors.map((actor) => {
        if (actor.id !== actorId) return actor;
        const updated = incrementActorAp(actor, gain);
        if (updated !== actor) partyChanged = true;
        return updated;
      });
      if (partyChanged) tilePartiesChanged = true;
      return [tileId, nextActors];
    })
  );

  let enemyChanged = false;
  const nextEnemyActors = state.enemyActors?.map((actor) => {
    if (actor.id !== actorId) return actor;
    const updated = incrementActorAp(actor, gain);
    if (updated !== actor) enemyChanged = true;
    return updated;
  });

  if (!availableChanged && !tilePartiesChanged && !enemyChanged) return state;
  return {
    ...state,
    availableActors: availableChanged ? nextAvailableActors : state.availableActors,
    tileParties: tilePartiesChanged ? nextTileParties : state.tileParties,
    enemyActors: enemyChanged ? nextEnemyActors : state.enemyActors,
  };
}

