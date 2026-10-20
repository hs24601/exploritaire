import type { ProtoState } from './protoState';

/** Keep the rooted tableau as context for the quest until onward travel replaces it. */
export function finishTravelPresentation(state: ProtoState): ProtoState {
  if (state.dayScenario === 'day01' && state.journey && state.journey.completed >= state.journey.cards && state.journey.segments.some(segment => segment.sparseBerry) && state.journey.columns.flat().some(card => card.khadRoot)) return state;
  return { ...state, journey: undefined };
}
