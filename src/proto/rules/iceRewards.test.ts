import { expect, it } from 'vitest';
import { createPlayableSandboxScenario, endPlayerTurn, tickBattle, defaultStrike } from './battle';
import { absorbTempHp } from './cirCompanion';
import { dragonFoundationPlay } from './battleTutorials';

it('gains armor from unused AP at turn end, capped at five, and absorbs damage',()=>{
 let state=createPlayableSandboxScenario('100');state={...state,party:state.party.map(a=>({...a,charge:4,iceArmor:3,iceRewards:['ice-armor']}))};
 state=endPlayerTurn(state);expect(state.party[0].iceArmor).toBe(5);
 const hurt=absorbTempHp(state.party[0],3);expect(hurt.iceArmor).toBe(2);expect(hurt.hp).toBe(state.party[0].hp);
});
it('Rime Retort stops only the attacker at six stacks',()=>{
 let state=createPlayableSandboxScenario('101');state={...state,party:state.party.map(a=>({...a,iceRewards:['rime-retort'],rimeRetort:5})),rules:{...state.rules,finiteTableau:true},columns:state.columns.map((_,i)=>i===0?[{id:'first',rank:10}]:i===1?[{id:'second',rank:7}]:[])};
 const one=dragonFoundationPlay(state,0)!;expect(one.party[0].rimeRetort).toBe(0);expect(one.foes[0].rimeFrozen).toBe(true);expect(dragonFoundationPlay(one,0)).toBeNull();
 const two=dragonFoundationPlay(one,1)!;expect(two.foes[1].rank).toBe(7);expect(two.party[0].rimeRetort).toBe(1);
});
it('Whiteout can add ice damage and a two-turn Frost stack to a chip hit',()=>{
 const base=createPlayableSandboxScenario('100');let proc;
 for(let seed=1;seed<100;seed++){const state={...base,effectSeed:seed,party:base.party.map(a=>({...a,iceRewards:['whiteout' as const]}))};const next=defaultStrike(state,'hero');if(next.foes[0].iceFrost?.length){proc=next;break;}}
 expect(proc).toBeDefined();expect(proc!.foes[0].iceFrost).toEqual([2]);expect(base.foes[0].hp-proc!.foes[0].hp).toBe(2);
});
import { startCharging, intentEnemyPlayOne } from './battleDeadRun';
import { evadeCir } from './cirCompanion';

it('Frost blocks empty enemy ability pips without breaking the ability',()=>{
 let state=startCharging(createPlayableSandboxScenario('1012'),0);
 state={...state,foes:state.foes.map(f=>({...f,iceFrost:[2,2,2,2]}))};
 const rank=state.tutorial!.intent!.rank;
 state={...state,columns:state.columns.map((_,i)=>i===0?[{id:'ice-test',rank:rank===13?1:rank+1}]:[])};
 expect(intentEnemyPlayOne(state)).toBeNull();expect(state.tutorial!.intentCap).not.toBe(0);
});
it('Whiteout evasion reflects the active Frost stacks',()=>{
 const state=createPlayableSandboxScenario('100');const actor={...state.party[0],iceRewards:['whiteout' as const]};
 const frosted={...state,foes:state.foes.map(f=>({...f,iceFrost:Array(10).fill(2)}))};
 expect(evadeCir(frosted,actor).evaded).toBe(true);
});
import { rewardHeal } from './iceRewards';
it('heals Hero by five, half maximum, or to maximum without overhealing',()=>{
 expect(rewardHeal(3,32,'five')).toBe(8);expect(rewardHeal(3,32,'half')).toBe(19);
 expect(rewardHeal(29,32,'five')).toBe(32);expect(rewardHeal(3,32,'full')).toBe(32);
 expect(rewardHeal(1,5,'half')).toBe(4);
});
import { rewardOwner } from './iceRewards';
it('assigns ice abilities to their Keru without requiring a familiar',()=>{
 expect(rewardOwner('ice-armor')).toBe('Demi');expect(rewardOwner('rime-retort')).toBe('Demi');
 expect(rewardOwner('whiteout')).toBe('Dewi');expect(rewardOwner('glacial-lance')).toBe('Dewi');
 const state=createPlayableSandboxScenario('100');expect(state.party[0].harness).toBeUndefined();
});
