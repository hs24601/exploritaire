import {describe,it,expect,vi} from 'vitest';
import {createWorldRailBattle,worldRailReceivers,receiveWorldRailCard} from './worldRailBattle';
import {unstickSnowflake,hasSnowflake} from '../proto/rules/snowflakeReward';
import {flurryCompanionPose,FLURRY_COMPANION_SIZE} from './flurryCompanionLayout';
import {createPlayableSandboxScenario,playCard,endPlayerTurn,tickBattle} from '../proto/rules/battle';
import {sixColumnWoodsBattle} from './worldTableauLayout';
import {invokeKeru,feedKeru,dismissKeru,castKeru} from '../proto/rules/keruInvoke';
describe('entry-started world rail combat',()=>{
 it('begins a real six-column Hero encounter immediately',()=>{
  const state=createWorldRailBattle();expect(state.started).toBe(true);expect(state.turn).toBe('party');expect(state.columns).toHaveLength(6);expect(state.party.map(a=>a.id)).toEqual(['hero']);
 });
 it('uses legal receipts to change foundation and AP without admitting covered or stale cards',()=>{
  const state=createWorldRailBattle(),column=0;
  state.columns[0][3]={...state.columns[0][3],rank:state.party[0].rank===13?1:state.party[0].rank+1};
  const cards=state.columns[column],card=cards[cards.length-1],covered=cards[0];
  expect(worldRailReceivers(state,column)).toEqual(['hero']);expect(receiveWorldRailCard(state,column,covered.id,'hero')).toBe(state);
  const next=receiveWorldRailCard(state,column,card.id,'hero');expect(next).toEqual(playCard(state,column,'hero'));expect(next.party[0].rank).toBe(card.rank);expect(next.party[0].charge).toBe(state.party[0].charge+1);
  expect(receiveWorldRailCard(next,column,card.id,'hero')).toBe(next);expect(receiveWorldRailCard({...state,turn:'enemy'},column,card.id,'hero').party[0].rank).toBe(state.party[0].rank);
 });
 it('uses scenario 100 resources, seeded deal, chip attacks and paced enemy rules without musical bonuses',()=>{
  const random=vi.spyOn(Math,'random').mockReturnValue(.37);
  const canonical=sixColumnWoodsBattle(createPlayableSandboxScenario('100')),world=createWorldRailBattle();
  random.mockRestore();
  expect(world.party).toEqual(canonical.party);expect(world.columns).toEqual(canonical.columns);expect(world.keruInvoke).toEqual(canonical.keruInvoke);expect(world.rules).toEqual(canonical.rules);expect(world.tutorial).toEqual(canonical.tutorial);expect(world.bite).toBeUndefined();expect(world.party[0].adept).toBeUndefined();
  let next=endPlayerTurn(world),reference=endPlayerTurn({...canonical,started:true,foes:world.foes});
  for(let i=0;i<120;i++){next=tickBattle(next,.05);reference=tickBattle(reference,.05);}
  expect(next).toEqual(reference);
 });
 it('retains canonical familiar feeding, farewell/cooldown and one-use casts',()=>{
  const state=createWorldRailBattle(),funded={...state,party:state.party.map(a=>({...a,charge:6}))};
  const fed=feedKeru(funded,'cir'),mounted=invokeKeru(fed,'cir');expect(fed.keruInvoke?.tiers?.cir).toBe(1);expect(mounted.party[0].harness?.cir).toBe(1);
  const dismissed=dismissKeru(mounted,'cir');expect(dismissed.keruInvoke?.cooldown?.cir).toBeGreaterThan(0);expect(dismissed.foes[0].hp).toBeLessThan(mounted.foes[0].hp);
  const cast=castKeru(funded,'riv','hero');expect(cast.keruInvoke?.exhausted?.riv).toBe(true);expect(castKeru(cast,'riv','hero')).toBe(cast);
 });
 it('unsticks the enhancement without deleting the sticker or changing HP/AP',()=>{
  const state=createWorldRailBattle({kinId:'hero',memory:{x:.5,y:.3,enhancement:'kin'}});expect(hasSnowflake(state,'hero','kin')).toBe(true);
  const next=unstickSnowflake(state);expect(next.snowflakeReward).toBe('available');expect(next.party).toBe(state.party);expect(hasSnowflake(next,'hero','kin')).toBe(false);
  expect(unstickSnowflake(next)).toBe(next);
 });
 it('keeps the companion ear-sized, gently bobbing and based on Hero heading',()=>{
  const hero={x:4,y:2,z:5,heading:1.2},a=flurryCompanionPose(hero,0),b=flurryCompanionPose(hero,2);
  expect(a.size).toBe(FLURRY_COMPANION_SIZE);expect(a.size).toBeLessThan(.25);expect(a.heading).toBe(hero.heading);expect(b.heading).toBe(hero.heading);expect(Math.abs(a.y-b.y)).toBeLessThan(.18);
  expect(flurryCompanionPose(hero,9,true)).toEqual(flurryCompanionPose(hero,0,true));
 });
});
