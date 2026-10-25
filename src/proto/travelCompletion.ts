import {dayOnePlan, dayOneAllowsPlan} from './dayScenarios';
import {beginPlaytestJourney, travelStartingRank} from './travelJourney';
import type { ProtoState } from './protoState';

/** Keep the rooted tableau as context for the quest until onward travel replaces it. */
export function finishTravelPresentation(state: ProtoState): ProtoState {
  if (state.dayScenario === 'day01' && state.journey && state.journey.completed >= state.journey.cards && state.journey.segments.some(segment => segment.sparseBerry) && state.journey.columns.flat().some(card => card.khadRoot)) return state;
  const settled={...state,journey:undefined};
  if(state.journey?.denseBerryChoice==='leave'){
    const plan=dayOnePlan(settled);
    if(dayOneAllowsPlan(settled,plan))return {...settled,selectedBiomeId:null,tableau:[],stock:[],foundations:[],
      biomeTiles:settled.biomeTiles.map(tile=>tile.id===settled.selectedBiomeId?{...tile,tableau:settled.tableau,stock:settled.stock}:tile),
      worldActors:settled.worldActors.map(actor=>actor.id==='hero'?{...actor,location:'table' as const,biomeId:undefined,foundationIndex:undefined}:actor),
      journey:beginPlaytestJourney(plan,travelStartingRank(settled,'hero'),false)};
  }
  return settled;
}
