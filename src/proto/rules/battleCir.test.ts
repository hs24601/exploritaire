import { describe, expect, it } from 'vitest';
import { canUseMomentumSkill, createCombatSandboxScenario, defaultStrike, momentumSkillExpression, momentumSkillTargets, playCard, returnCirToDeck, setMochi, tickBattle, useMomentumSkill, withdrawPlayer } from './battle';
import type { BattleState } from './battle';

const base=()=>{
 const state=createCombatSandboxScenario('006');
 state.foes=state.foes.map(foe=>({...foe,emberPhase:undefined,counterflames:undefined}));
 // Ability cards cost AP: give both Kin enough for any expression plus a follow-up.
 return {...state,momentum:{...state.momentum!,value:20,earned:20,sequence:4},party:state.party.map(actor=>({...actor,charge:actor.id==='hero'?13:10}))};
};
const ap=(state:BattleState,id:string)=>state.party.find(actor=>actor.id===id)!.charge;
describe('one Cir, expressed through her target',()=>{
 it('previews the same target-specific costs that casts spend',()=>{
  const state=base();
  expect(momentumSkillTargets(state,'cir').map(unit=>unit.id)).toEqual(['khad-root','hero','mochi']);
  for(const [target,name,cost] of [['hero','Hearthflame',3],['mochi','Ember Claws',4],['khad-root','Meteor',6]] as const){
   expect(momentumSkillExpression(state,'cir',target)).toMatchObject({name:'Cir · '+name,cost});
   const cast=useMomentumSkill(state,'cir',target);
   const owner=target==='mochi'?'mochi':'hero';
   expect(ap(cast,owner)).toBe(ap(state,owner)-cost);
   expect(cast.momentum).toMatchObject({value:20,spent:0,earned:20,sequence:4});
  }
 });
 it('binding commits the unique Cir for the battle without damaging or changing foundations',()=>{
  const state=base(),bound=useMomentumSkill(state,'cir','hero');
  expect(bound.cir).toEqual({status:'bound',actorId:'hero'});
  expect(bound.party.map(actor=>[actor.hp,actor.rank])).toEqual(state.party.map(actor=>[actor.hp,actor.rank]));expect(bound.foes).toBe(state.foes);expect(bound.columns).toBe(state.columns);
  for(const target of ['hero','mochi','khad-root'])expect(useMomentumSkill(bound,'cir',target)).toBe(bound);
  expect(tickBattle({...bound,started:true},100).cir).toEqual(bound.cir);
  expect(withdrawPlayer(bound).cir).toEqual(bound.cir);
  expect(createCombatSandboxScenario('006').cir).toEqual({status:'available'});
 });
 it('Meteor hits once without borrowing a Kin attack, stagger, Thorns or Momentum generation',()=>{
  const state=base();state.foes[0].thorns=1;
  const next=useMomentumSkill(state,'cir','khad-root');
  expect(next.foes[0]).toMatchObject({hp:28,stagger:0});
  expect(next.party.map(actor=>[actor.hp,actor.rank])).toEqual(state.party.map(actor=>[actor.hp,actor.rank]));expect(next.columns).toBe(state.columns);
  expect(next.cir).toEqual({status:'exhausted'});
  expect(next.events[next.events.length-1]).toMatchObject({label:'Meteor · Fire',amount:8,sourceId:'cir'});
  expect(useMomentumSkill(next,'cir','hero')).toBe(next);
 });
 it('fire respects guard and stagger vulnerability and can end combat',()=>{
  const state=base();state.foes[0]={...state.foes[0],ironbark:true};
  expect(useMomentumSkill(state,'cir','khad-root').foes[0].hp).toBe(36);
  state.foes[0]={...state.foes[0],staggered:20,staggerStage:1,hp:16};
  const next=useMomentumSkill(state,'cir','khad-root');
  expect(next.foes[0].hp).toBe(0);expect(next.result).toBe('won');expect(next.events[next.events.length-1]?.kind).toBe('ko');
 });
 it('Ember Claws strengthens Mochi chips and Pounce, never Hero or zero-damage Bash',()=>{
  const bound=useMomentumSkill(base(),'cir','mochi');
  expect(defaultStrike(bound,'mochi').foes[0]).toMatchObject({hp:34,stagger:1});
  expect(defaultStrike(bound,'hero').foes[0]).toMatchObject({hp:35,stagger:1});
  expect(useMomentumSkill(bound,'pounce').foes[0]).toMatchObject({hp:32,stagger:0});
  expect(useMomentumSkill(bound,'bash').foes[0]).toMatchObject({hp:36,stagger:2});
  const exposed={...bound,foes:bound.foes.map(foe=>({...foe,staggered:20,staggerStage:1}))};
  expect(useMomentumSkill(exposed,'pounce').foes[0].hp).toBe(28);
 });
 it('Hearthflame retaliates after an attack, including a lethal hit, without adding stagger or currency',()=>{
  const bound=useMomentumSkill(base(),'cir','hero'),next=withdrawPlayer(bound);
  expect(next.party[0].hp).toBe(10);expect(next.foes[0]).toMatchObject({hp:35,stagger:0});
  expect(next.events[1]).toMatchObject({amount:1,sourceId:'hero'});
  expect(next.events.map(event=>event.label)).toEqual(['Ember Trial Sentinel','Hearthflame · Fire']);
  expect(next.momentum?.earned).toBe(20);expect(ap(next,'hero')).toBe(10);expect(next.turn).toBe('party');
  bound.party=bound.party.map(actor=>({...actor,hp:actor.id==='hero'?1:actor.hp}));
  expect(withdrawPlayer(bound).foes[0].hp).toBe(35);
 });
 it('Hearthflame retaliates for zero-damage attacks, but not another Kin, Thorns or a skipped response',()=>{
  const bound=useMomentumSkill(base(),'cir','hero');
  const other={...bound,party:bound.party.map(actor=>({...actor,charge:actor.id==='mochi'?10:0}))};
  expect(withdrawPlayer(other).foes[0].hp).toBe(36);
  const thorns={...bound,foes:bound.foes.map(foe=>({...foe,thorns:1}))};
  expect(defaultStrike(thorns,'hero').foes[0].hp).toBe(35);
  const zero={...bound,foes:bound.foes.map(foe=>({...foe,profile:{...foe.profile,damage:0}}))};
  expect(withdrawPlayer(zero).foes[0].hp).toBe(35);
  const staggered={...bound,foes:bound.foes.map(foe=>({...foe,staggered:20,staggerStage:1}))};
  expect(withdrawPlayer(staggered).foes[0]).toMatchObject({hp:36,staggered:0,staggerStage:0});
 });
 it('Hearthflame multiplies only Hero receipts and recall removes the multiplier',()=>{
  const receipt=(state:ReturnType<typeof createCombatSandboxScenario>,actorId='hero')=>{
   const rank=state.party.find(actor=>actor.id===actorId)!.rank%13+1;
   return playCard({...state,columns:[[{id:`receipt-${state.momentum!.earned}`,rank}]]},0,actorId);
  };
  let state=useMomentumSkill(base(),'cir','hero');
  for(let i=0;i<4;i++)state=receipt(state);
  expect(state.momentum).toMatchObject({value:25,earned:25,spent:0,lastGain:1.25});
  state=receipt(state,'mochi');
  expect(state.momentum).toMatchObject({value:26,earned:26,lastGain:1});
  state=receipt(returnCirToDeck(state));
  expect(state.momentum).toMatchObject({value:27,earned:27,lastGain:1});
  const mochi=receipt(useMomentumSkill(base(),'cir','mochi'));
  expect(mochi.momentum).toMatchObject({value:21,earned:21,lastGain:1});
 });
 it('rejects invalid, unaffordable, dead, disarmed and spent targets without spending',()=>{
  const state=base();
  const poor={...state,party:state.party.map(actor=>({...actor,charge:3}))};
  expect(canUseMomentumSkill(poor,'cir')).toBe(true);
  expect(useMomentumSkill(poor,'cir','mochi')).toBe(poor);
  expect(useMomentumSkill(poor,'cir','khad-root')).toBe(poor);
  for(const target of ['tableau','missing'])expect(useMomentumSkill(state,'cir',target)).toBe(state);
  for(const patch of [{hp:0},{disarmed:true},{turnSpent:true}]){
   const invalid={...state,party:state.party.map(actor=>actor.id==='hero'?{...actor,...patch}:actor)};
   expect(useMomentumSkill(invalid,'cir','hero')).toBe(invalid);
  }
  for(const invalid of [{...state,turn:'enemy' as const},{...state,result:'won' as const},{...state,foes:state.foes.map(foe=>({...foe,hp:0}))}])expect(useMomentumSkill(invalid,'cir','khad-root')).toBe(invalid);
 });
 it('removing and readding a bound Kin never duplicates or frees Cir',()=>{
  const bound=useMomentumSkill(base(),'cir','mochi'),returned=setMochi(setMochi(bound,false),true);
  expect(returned.cir).toEqual({status:'bound',actorId:'mochi'});expect(canUseMomentumSkill(returned,'cir')).toBe(false);
 });
});
