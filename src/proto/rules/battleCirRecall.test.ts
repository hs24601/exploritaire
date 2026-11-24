import { expect, it } from 'vitest';
import { canUseMomentumSkill, createCombatSandboxScenario, defaultStrike, returnCirToDeck, useMomentumSkill, withdrawPlayer } from './battle';
import type { BattleState } from './battle';
const base=()=>{const state=createCombatSandboxScenario('006');state.foes=state.foes.map(foe=>({...foe,emberPhase:undefined,counterflames:undefined}));return {...state,momentum:{...state.momentum!,value:20,earned:20},party:state.party.map(actor=>({...actor,charge:10}))};};
const ap=(state:BattleState,id:string)=>state.party.find(actor=>actor.id===id)!.charge;
it('recalls without refunds, removes the old effect and charges the new expression in full',()=>{
 const hero=useMomentumSkill(base(),'cir','hero'),recalled=returnCirToDeck(hero);
 expect(recalled.cir).toEqual({status:'available'});expect(recalled.momentum).toBe(hero.momentum);
 expect(recalled.party).toBe(hero.party);expect(ap(hero,'hero')).toBe(7);expect(recalled.foes).toBe(hero.foes);expect(recalled.columns).toBe(hero.columns);
 expect(withdrawPlayer(recalled).foes[0].hp).toBe(36);
 const mochi=useMomentumSkill(recalled,'cir','mochi');
 expect(mochi.cir).toEqual({status:'bound',actorId:'mochi'});expect(ap(mochi,'mochi')).toBe(6);expect(mochi.momentum).toMatchObject({value:20,spent:0,earned:20});
 expect(defaultStrike(mochi,'mochi').foes[0].hp).toBe(34);
 const again=returnCirToDeck(mochi);expect(defaultStrike(again,'mochi').foes[0].hp).toBe(35);
 const meteor=useMomentumSkill(again,'cir','khad-root');expect(meteor.cir).toEqual({status:'exhausted'});
 expect(ap(meteor,'hero')).toBe(1);expect(returnCirToDeck(meteor)).toBe(meteor);
});
it('recall cannot manufacture AP for another purchase',()=>{
 const state={...base(),party:base().party.map(actor=>({...actor,charge:actor.id==='hero'?3:0}))};
 const recalled=returnCirToDeck(useMomentumSkill(state,'cir','hero'));
 expect(ap(recalled,'hero')).toBe(0);expect(canUseMomentumSkill(recalled,'cir')).toBe(false);
 expect(useMomentumSkill(recalled,'cir','hero')).toBe(recalled);
});
it('only recalls a current binding during live player combat, including from a downed Kin',()=>{
 const state=base(),bound=useMomentumSkill(state,'cir','hero');
 expect(returnCirToDeck(state)).toBe(state);
 for(const invalid of [{...bound,turn:'enemy' as const},{...bound,result:'won' as const}])expect(returnCirToDeck(invalid)).toBe(invalid);
 const down={...bound,party:bound.party.map(actor=>actor.id==='hero'?{...actor,hp:0}:actor)};
 expect(returnCirToDeck(down).cir).toEqual({status:'available'});
});
