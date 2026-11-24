import { describe, expect, it } from 'vitest';
import { createCombatSandboxScenario, canUseMomentumSkill, momentumSkillExpression, momentumSkillTargets, useMomentumSkill, returnCirToDeck } from './battle';
const base=()=>{
 const state=createCombatSandboxScenario('006');
 return {...state,foes:state.foes.map(f=>({...f,emberPhase:undefined})),momentum:{...state.momentum!,value:20,earned:20},party:state.party.map(a=>({...a,charge:10}))};
};
describe('distinct Cir playtest abilities',()=>{
 it('keeps each identity and price stable while rejecting wrong targets',()=>{
  const state=base();
  for(const [id,target,name,cost] of [['cir-hearthflame','hero','Hearthflame',3],['cir-ember-claws','mochi','Ember Claws',4],['cir-meteor','khad-root','Meteor',6]] as const){
   expect(momentumSkillExpression(state,id,'hero')).toMatchObject({name:'Cir · '+name,cost});
   expect(momentumSkillExpression(state,id,'khad-root')).toMatchObject({name:'Cir · '+name,cost});
   expect(momentumSkillTargets(state,id).map(u=>u.id)).toEqual([target]);
   expect(canUseMomentumSkill(state,id,target)).toBe(true);
   expect(useMomentumSkill(state,id,target)).toEqual(useMomentumSkill(state,'cir',target));
   const wrong=target==='hero'?'mochi':'hero';
   expect(useMomentumSkill(state,id,wrong)).toBe(state);
  }
 });
 it('keeps paid recall, exclusivity, exhaustion and authored phase gates',()=>{
  const state=base(),bound=useMomentumSkill(state,'cir-hearthflame','hero');
  expect(canUseMomentumSkill(bound,'cir-ember-claws','mochi')).toBe(false);
  const recalled=returnCirToDeck(bound),next=useMomentumSkill(recalled,'cir-ember-claws','mochi');
  expect(next.party.find(a=>a.id==='mochi')!.charge).toBe(6);expect(next.momentum?.value).toBe(20);
  const meteor=useMomentumSkill(state,'cir-meteor','khad-root');expect(meteor.cir?.status).toBe('exhausted');
  expect(canUseMomentumSkill(meteor,'cir-hearthflame','hero')).toBe(false);
  expect(canUseMomentumSkill({...createCombatSandboxScenario('006'),momentum:state.momentum},'cir-meteor','khad-root')).toBe(false);
 });
});
