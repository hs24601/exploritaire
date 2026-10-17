import {describe,it,expect} from 'vitest';
import {createDayOneState,createDayTwoState,dayOnePlan,dayOneAllowsPlan,dayOneHour,manaCarrierLuminosity} from './dayScenarios';
import {arriveActorAtBiome} from './biomeArrival';
import {applyFoundationPlay} from './rules/play';
import {eatSupper} from './rules/ordinaryDay';
import {beginJourney,bestTravelMove,playTravelCard} from './travelJourney';
import {getTableLighting} from './protoLighting';

describe('Day 01 before dark',()=>{
 it('funds the sparse and dense outing, gathers three berries, and keeps one lit after supper',()=>{
  let s=createDayOneState();expect(s.travelStamina).toBeGreaterThanOrEqual(4);expect(dayOneHour(s)).toBe(10);
  expect(manaCarrierLuminosity(s,'hero')).toBe(0);
  const nearby=dayOnePlan(s);expect(nearby.arrival.biomeId).toBe(s.dayScenarioTiles?.sparsePatchId);
  s={...s,journey:beginJourney(nearby,2,false)};
  expect(nearby.cards).toBe(6);
  expect(s.journey!.columns).toHaveLength(1);
  expect([...s.journey!.columns[0]].reverse().map(card=>card.rank)).toEqual([3,4,5,6,7,8]);
  expect(s.journey!.columns[0].filter(card=>card.foodSource==='berries').map(card=>card.rank)).toEqual([8]);
  for(let i=0;i<100 && s.journey!.completed<nearby.cards;i++){const col=bestTravelMove(s.journey!);expect(col).not.toBeNull();s=playTravelCard(s,col!);}
  expect(s.haul.mana).toBe(1);expect(s.biomeTiles.find(t=>t.id===s.dayScenarioTiles?.sparsePatchId)?.berryHarvested).toBe(true);
  const sparse=s.biomeTiles.find(t=>t.id===s.dayScenarioTiles?.sparsePatchId)!;
  s=arriveActorAtBiome({...s,journey:undefined},'hero',sparse.id,sparse.position);
  const outward=dayOnePlan(s);expect(dayOneAllowsPlan(s,outward)).toBe(true);
  expect(dayOneAllowsPlan(s,{...outward,path:[...outward.path,{x:48,y:48,pace:1}]})).toBe(false);
  s={...s,journey:beginJourney(outward)};
  for(let i=0;i<100 && s.journey!.completed<outward.cards;i++){
    const col=bestTravelMove(s.journey!);expect(col).not.toBeNull();s=playTravelCard(s,col!);
  }
  expect(s.journey!.completed).toBe(outward.cards);expect(s.haul.mana).toBe(1);
  s=arriveActorAtBiome({...s,journey:undefined},'hero','day-one-berries',{x:-48,y:48});
  for(let i=0;i<6;i++){const result=applyFoundationPlay(s,{columnIndex:i,foundationIndex:0});expect(result,`forage play ${i}`).not.toBeNull();s=result!.state;}
  expect(s.haul.mana).toBe(3);expect(s.tableau.flat()).toHaveLength(0);
  expect(manaCarrierLuminosity(s,'hero')).toBe(.36);expect(s.haul.mana).toBe(3);expect(dayOneHour(s)).toBe(16.5);
  const home=dayOnePlan(s);expect(dayOneAllowsPlan(s,home)).toBe(true);
  s={...s,journey:beginJourney(home)};
  for(let i=0;i<100 && s.journey!.completed<home.cards;i++){const col=bestTravelMove(s.journey!);expect(col).not.toBeNull();s=playTravelCard(s,col!);}
  expect(s.journey!.completed).toBe(home.cards);expect(s.travelStamina).toBeGreaterThanOrEqual(0);
  s=arriveActorAtBiome({...s,journey:undefined},'hero','hero-den',{x:0,y:96});
  expect(s.haul.mana).toBe(3);expect(dayOneHour(s)).toBe(17.5);expect(manaCarrierLuminosity(s,'hero')).toBe(.36);
  expect(eatSupper({...s,haul:{...s.haul,mana:2}}).ordinaryDay?.supper).toBe(false);
  s=eatSupper(s);expect(s.haul.mana).toBe(1);expect(manaCarrierLuminosity(s,'hero')).toBe(.12);expect(dayOneHour(s)).toBe(19);expect(dayOneAllowsPlan(s,dayOnePlan(s))).toBe(false);
  const tomorrow=createDayTwoState(undefined,s.haul.mana);
  expect(tomorrow.haul.mana).toBe(1);expect(manaCarrierLuminosity(tomorrow,'hero')).toBe(.12);
  expect(dayOnePlan(tomorrow).arrival.biomeId).toBe(tomorrow.dayScenarioTiles?.patchId);
  expect(tomorrow.biomeTiles.find(tile=>tile.berryPatchVariant==='sparse')?.berryHarvested).toBe(true);
 });
 it('keeps midday moody and a fresh scenario independent',()=>{
  expect(getTableLighting(12).ambient).toBeLessThan(.4);expect(getTableLighting(12).darkness).toBeGreaterThan(.3);
  const a=createDayOneState(),b=createDayOneState();a.biomeTiles.find(t=>t.id===a.dayScenarioTiles?.patchId)!.tableau=[];expect(b.biomeTiles.find(t=>t.id===b.dayScenarioTiles?.patchId)!.tableau.flat()).toHaveLength(6);
 });
});
