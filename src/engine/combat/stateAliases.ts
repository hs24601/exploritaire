import type { Actor, GameState } from '../types';

export function getPartyAssignments(state: GameState): Record<string, Actor[]> {
  return state.partyAssignments ?? {};
}

export function getActiveCombatPartyId(state: GameState): string | undefined {
  return state.activeCombatPartyId;
}

export function setPartyAssignments(
  _state: GameState,
  partyAssignments: Record<string, Actor[]>
): Pick<GameState, 'partyAssignments'> {
  return {
    partyAssignments,
  };
}

export function clearActiveCombatParty(): Pick<GameState, 'activeCombatPartyId'> {
  return {
    activeCombatPartyId: undefined,
  };
}
