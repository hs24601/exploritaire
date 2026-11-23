import type { BattleActor, BattleState } from './battle';

/** Temporary collected roster for the 1002 experiment; not a collection unlock rule. */
export const KERU_ROSTER = ['cir', 'dem', 'riv'] as const;
export type KeruId = typeof KERU_ROSTER[number];
export type KeruSelection = { reserves: Partial<Record<KeruId, BattleActor>> };
/** Withdrawal preserves the exact foundation; returning costs its normal summon AP. */
export function withdrawKeru(state: BattleState, id: 'dem' | 'riv'): BattleState {
  const actor = state.party.find(a => a.id === id);
  if (!actor || actor.hp <= 0 || actor.disarmed || state.sandboxScenario !== '1002' || state.turn !== 'party' || state.result || state.cirCompanion?.host === id) return state;
  return { ...state, party: state.party.filter(a => a.id !== id), keruSelection: { reserves: { ...state.keruSelection?.reserves, [id]: actor } } };
}
