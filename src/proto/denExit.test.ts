import {describe,it,expect} from 'vitest';
import {createDayOneState,dayOnePlan} from './dayScenarios';
import {beginJourney,bestTravelMove,playTravelCard} from './travelJourney';
import {passageStepAllowed} from './terrainPassages';
import {travelColumnStation} from './travelMapTableau';
describe('Den north exit trial',()=>{
 it('holds Hero in the Den until six legal plays earn the mouth, then completes the finite berry approach',()=>{
  let s=createDayOneState();const plan=dayOnePlan(s);s={...s,journey:beginJourney(plan)};
  expect(s.journey!.progress).toBe(0);expect(s.journey!.columns.flat()).toHaveLength(6);
  const initial=s.travelStamina;
  const stations=s.journey!.columns.map((_,i)=>travelColumnStation(s.journey!,i,0));
  expect(new Set(stations.map(p=>`${p.x}:${p.y}:${p.elevation}`)).size).toBe(6);
  for(let i=0;i<6;i++){
   const j=s.journey!,move=bestTravelMove(j);expect(move).not.toBeNull();
   expect(playTravelCard({...s,journey:{...j,paused:true}},move!)).toEqual({...s,journey:{...j,paused:true}});
   s=playTravelCard(s,move!);expect(s.journey!.completed).toBe(i+1);
   expect(s.journey!.progress).toBeLessThanOrEqual(.5);expect(s.haul.mana).toBe(0);
  }
  expect(s.journey!.rank).toBe(2);expect(s.travelStamina).toBe(initial);
  expect(s.journey!.columns.flat().every(c=>c.pose)).toBe(true);
  while(s.journey!.completed<plan.cards){const move=bestTravelMove(s.journey!);expect(move).not.toBeNull();s=playTravelCard(s,move!);}
  expect(s.journey!.progress).toBe(1);expect(s.haul.mana).toBe(1);
  expect(s.biomeTiles.find(t=>t.id===s.dayScenarioTiles!.sparsePatchId)!.berryHarvested).toBe(true);
 });
 it('uses only the north face in either direction',()=>{
  const tiles=createDayOneState().biomeTiles;
  expect(passageStepAllowed(tiles,0,2,0,1)).toBe(true);
  expect(passageStepAllowed(tiles,0,1,0,2)).toBe(true);
  for(const [x,y] of [[1,2],[-1,2],[0,3],[1,1]]){
   expect(passageStepAllowed(tiles,0,2,x,y)).toBe(false);
   expect(passageStepAllowed(tiles,x,y,0,2)).toBe(false);
  }
 });
});
