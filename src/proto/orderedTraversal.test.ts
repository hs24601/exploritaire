import {describe,it,expect} from 'vitest';
import {createDayOneState,dayOnePlan} from './dayScenarios';
import {beginJourney,bestTravelMove,playTravelCard,paintTravelProgress,denseBerryChoicePending,chooseDenseBerry,prepareTravelTableau,travelTileThreshold} from './travelJourney';
import {arriveActorAtBiome} from './biomeArrival';
import {applyFoundationPlay} from './rules/play';
import {isDenseBerryScene,isDenseBerryStage} from './denseBerryTableau';
function atSparse(){let s=createDayOneState();s={...s,journey:beginJourney(dayOnePlan(s))};while(s.journey!.completed<s.journey!.cards)s=playTravelCard(s,bestTravelMove(s.journey!)!);const tile=s.biomeTiles.find(t=>t.id===s.dayScenarioTiles!.sparsePatchId)!;return arriveActorAtBiome({...s,journey:undefined},'hero',tile.id,tile.position);}
describe('ordered sparse departure',()=>{
 it('requires an isolated reward-free approach before revealing the dense gathering puzzle',()=>{
  let s=atSparse(); const plan=dayOnePlan(s), mana=s.haul.mana;
  expect(plan.segments.map(segment=>segment.cards)).toEqual([6,6,12]);
  expect(plan.segments.map(segment=>isDenseBerryScene(segment,plan.segments))).toEqual([false,true,true]);
  expect(isDenseBerryStage(plan.segments[1])).toBe(false);
  expect(plan.segments[1].end).toBe(plan.segments[2].start);
  s={...s,journey:beginJourney(plan,s.travelRanks!.hero)};
  for(let stage=0;stage<2;stage++){
   expect(s.journey!.columns.flat().every(card=>!card.resource && !card.foodSource && !card.id.startsWith('dense-'))).toBe(true);
   for(let n=0;n<6;n++)s=playTravelCard(s,bestTravelMove(s.journey!)!);
   expect(s.haul.mana).toBe(mana);
   expect(s.journey!.waitingForTraversal).toBe(stage);
   expect(bestTravelMove(s.journey!)).toBeNull();
   s=paintTravelProgress(s,s.journey!.progress);
  }
  expect(s.journey!.columns.flat()).toHaveLength(12);
  expect(s.journey!.columns.flat().filter(card=>card.foodSource)).toHaveLength(5);
  expect(s.journey!.columns.flat().every(card=>card.id.startsWith('dense-'))).toBe(true);
  expect(s.journey!.spent).toBeLessThanOrEqual(plan.estimate);
 });
 it('isolates six reward-free exit plays and waits for actual boundary crossing',()=>{
  let s=atSparse();const plan=dayOnePlan(s);expect(plan.ordered).toBe(true);expect(plan.segments.map(t=>t.traversalStage)).toEqual(['exit','enter','gather']);expect(plan.segments[0].cards).toBe(6);expect(plan.segments[0].end).toBe(.5);expect(plan.segments[1].start).toBe(.5);expect(plan.estimate).toBe(2);
  const rank=s.travelRanks!.hero,initialMana=s.haul.mana,initialAP=s.utilityAP!.hero;
  s=prepareTravelTableau({...s,journey:beginJourney(plan,rank)});
  expect(s.journey!.columns.flat()).toHaveLength(6);expect(s.journey!.columns.flat().every(c=>!c.resource&&!c.foodSource)).toBe(true);
  for(let i=0;i<6;i++){const col=bestTravelMove(s.journey!);expect(col).not.toBeNull();s=playTravelCard(s,col!);}
  expect(s.journey!.completed).toBe(6);expect(s.journey!.rank).toBe(rank);expect(s.utilityAP!.hero).toBe(initialAP+6);expect(s.haul.mana).toBe(initialMana);expect(s.journey!.waitingForTraversal).toBe(0);expect(bestTravelMove(s.journey!)).toBeNull();expect(playTravelCard(s,0)).toBe(s);
  const near=paintTravelProgress(s,.49);expect(near.journey!.waitingForTraversal).toBe(0);expect(near.journey!.columns.flat()).toHaveLength(0);
  const paused=paintTravelProgress({...s,journey:{...s.journey!,paused:true}},.5);expect(paused.journey!.waitingForTraversal).toBe(0);
  s=paintTravelProgress(s,.5);expect(s.journey!.waitingForTraversal).toBeUndefined();expect(s.journey!.columns.flat().length).toBeGreaterThan(0);expect(s.journey!.columns.flat().every(c=>c.segment===1)).toBe(true);expect(s.journey!.rank).toBe(rank);
 });
 it('gathers five berries after the separate reward-free approach',()=>{
  let s=atSparse();const plan=dayOnePlan(s);s={...s,journey:beginJourney(plan,s.travelRanks!.hero)};
  for(let moves=0;moves<100 && s.journey!.completed<s.journey!.cards;moves++){
   if(s.journey!.waitingForTraversal!==undefined)s=paintTravelProgress(s,s.journey!.progress);
   if(denseBerryChoicePending(s)){s=chooseDenseBerry(s,'collect');continue;}
   const col=bestTravelMove(s.journey!);expect(col).not.toBeNull();s=playTravelCard(s,col!);
  }
  expect(s.journey!.progress).toBe(1);expect(s.haul.mana).toBe(6);expect(s.journey!.spent).toBeLessThanOrEqual(plan.estimate);const rank=s.journey!.rank;
  s=paintTravelProgress(s,1);const patch=s.biomeTiles.find(t=>t.id===s.dayScenarioTiles!.patchId)!;s=arriveActorAtBiome({...s,journey:undefined},'hero',patch.id,patch.position);
  expect(s.selectedBiomeId).toBe(patch.id);expect(s.tableau.flat()).toHaveLength(0);expect(s.haul.mana).toBe(6);
  expect(s.biomeTiles.find(t=>t.berryPatchVariant==='sparse')!.berryHarvested).toBe(true);
 });
});

it('captures the outgoing tile threshold rather than the entire journey or an internal stage',()=>{
  const s=atSparse(),plan=dayOnePlan(s),j=beginJourney(plan,6);
  expect(travelTileThreshold(j)).toBe(.5);
  expect(travelTileThreshold({...j,completed:6,progress:.5,waitingForTraversal:0})).toBe(.5);
  expect(travelTileThreshold({...j,completed:6,progress:.5})).toBe(1);
  const enter={...plan.segments[1],start:.5,end:.7};
  const exit={...enter,traversalStage:'exit' as const,start:.7,end:.9};
  expect(travelTileThreshold({...j,completed:6,segments:[plan.segments[0],enter,exit]})).toBe(.9);
});
