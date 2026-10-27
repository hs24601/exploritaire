import {describe,it,expect} from 'vitest';
import {createDayOneState,dayOnePlan} from './dayScenarios';
import {beginPlaytestJourney,beginJourney,bestTravelMove,playTravelCard,paintTravelProgress,planTravel} from './travelJourney';
import {pendingTutorialQuest} from './tutorialQuests';
import {arriveActorAtBiome} from './biomeArrival';

describe('temporarily suspended traversal deals',()=>{
 it('keeps the legacy mechanism while runtime skips den exit and retains sparse gathering',()=>{
  let s=createDayOneState();const plan=dayOnePlan(s);
  expect(beginJourney(plan).segments[0].kind).toBe('den-exit');
  s={...s,denQuestDiscovered:true,journey:beginPlaytestJourney(plan,2,false)};
  expect(s.journey!.cards).toBe(6);expect(s.journey!.progress).toBe(1);
  expect(s.journey!.segments.some(seg=>seg.kind==='den-exit')).toBe(false);
  expect(pendingTutorialQuest(s)?.id).toBe('first-berry');
  expect(playTravelCard(s,bestTravelMove(s.journey!)!)).toBe(s);
  s=paintTravelProgress(s,1);
  for(let i=0;i<6;i++)s=playTravelCard(s,bestTravelMove(s.journey!)!);
  expect(s.haul.mana).toBe(1);expect(s.journey!.completed).toBe(6);
  expect(s.journey!.columns.flat().filter(c=>c.khadRoot)).toHaveLength(2);
 });
 it('removes outgoing and incoming deals while preserving the finite five-berry puzzle',()=>{
  let s=createDayOneState();const sparse=s.biomeTiles.find(t=>t.id===s.dayScenarioTiles!.sparsePatchId)!;
  s=arriveActorAtBiome({...s,biomeTiles:s.biomeTiles.map(t=>t.id===sparse.id?{...t,berryHarvested:true}:t)},'hero',sparse.id,sparse.position);
  const j=beginPlaytestJourney(dayOnePlan(s),6,false);
  expect(j.cards).toBe(12);expect(j.columns.flat()).toHaveLength(12);
  expect(j.columns.flat().filter(c=>c.foodSource)).toHaveLength(5);
  expect(j.segments.filter(seg=>seg.cards).every(seg=>seg.denseBerry)).toBe(true);
 });
 it('walks ordinary routes without awarding cards, AP, fruit or stamina costs',()=>{
  const j=beginPlaytestJourney(planTravel('hero',[{x:0,y:0,pace:0},{x:48,y:0,pace:1}],[]));
  expect(j.cards).toBe(0);expect(j.columns.flat()).toHaveLength(0);
  expect(j.progress).toBe(1);expect(j.spent).toBe(0);expect(j.berries).toBe(0);expect(j.rank).toBe(2);
 });
});
