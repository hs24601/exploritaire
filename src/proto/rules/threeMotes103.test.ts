import { expect, it } from 'vitest';
import { createPlayableSandboxScenario, endPlayerTurn, tickBattle } from './battle';
import { carrySeriesParty } from './combatSeries';

it('lets three Motes play their own foundation values',()=>{
 let state=createPlayableSandboxScenario('103');
 expect(state.foes.map(f=>f.hp)).toEqual([10,10,10]);
 expect(state.foes.map(f=>f.rank)).toEqual([9,6,12]);
 expect(state.tutorial?.intent).toBeUndefined();
 state={...state,rules:{...state.rules,finiteTableau:true},columns:state.columns.map((_,i)=>i===0?[{id:'a',rank:10}]:i===1?[{id:'b',rank:7}]:i===2?[{id:'c',rank:13}]:[])};
 const hp=state.party[0].hp;state=endPlayerTurn(state);
 for(let i=0;i<80 && state.turn==='enemy';i++)state=tickBattle(state,1);
 expect(state.turn).toBe('party');expect(state.foes.map(f=>f.rank)).toEqual([10,7,13]);
 expect(state.party[0].hp).toBe(hp-3);expect(state.events.filter(e=>e.chipDamage).map(e=>e.sourceId)).toEqual(state.foes.map(f=>f.id));
});
it('carries party state when choosing 103 after 101',()=>{
 const old=createPlayableSandboxScenario('101');old.party[0].hp=13;old.party[0].charge=4;
 const next=carrySeriesParty(old,createPlayableSandboxScenario('103'));
 expect(next.party[0].hp).toBe(13);expect(next.party[0].charge).toBe(4);expect(next.foes).toHaveLength(3);
});
