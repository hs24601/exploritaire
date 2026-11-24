import {describe,it,expect} from 'vitest';
import {createDayOneState,dayOnePlan,sparsePatchTableauComplete} from './dayScenarios';
import {beginJourney,bestTravelMove,playTravelCard} from './travelJourney';
import {dayCinematicBeatId} from './dayCinematics';
describe('immediate sparse reflection',()=>{
 it('starts at the final play while the live journey remains and keeps the same story beat on arrival',()=>{
  let s=createDayOneState();s={...s,journey:beginJourney(dayOnePlan(s))};
  while(s.journey!.completed<s.journey!.cards){
   expect(sparsePatchTableauComplete(s)).toBe(false);expect(dayCinematicBeatId(s)).toBeNull();
   const move=bestTravelMove(s.journey!);expect(move).not.toBeNull();s=playTravelCard(s,move!);
  }
  expect(sparsePatchTableauComplete(s)).toBe(true);expect(dayCinematicBeatId(s)).toBe('day01.sparse-patch');
  expect(s.haul.mana).toBe(1);expect(dayCinematicBeatId({...s,journey:undefined})).toBe('day01.sparse-patch');
  expect(sparsePatchTableauComplete({...s,journey:{...s.journey!,completed:s.journey!.cards-1}})).toBe(false);
  expect(sparsePatchTableauComplete({...s,journey:{...s.journey!,arrival:{biomeId:s.dayScenarioTiles!.patchId}}})).toBe(false);
  expect(sparsePatchTableauComplete({...s,journey:{...s.journey!,blocked:{progress:0,position:{x:0,y:96},message:'blocked'}}})).toBe(false);
 });
});
