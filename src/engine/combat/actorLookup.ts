import type { Actor, GameState } from '../types';
import { getPartyAssignments } from './stateAliases';

export function findActorById(state: GameState, actorId: string): Actor | null {
  const enemy = state.enemyActors?.find((actor) => actor.id === actorId);
  if (enemy) return enemy;
  for (const party of Object.values(getPartyAssignments(state))) {
    const match = party.find((actor) => actor.id === actorId);
    if (match) return match;
  }
  const available = state.availableActors.find((actor) => actor.id === actorId);
  if (available) return available;
  return null;
}

