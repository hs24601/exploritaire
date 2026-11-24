import { expect, it } from 'vitest';
import { createPlayableSandboxScenario, endPlayerTurn, tickBattle } from './battle';

function encounter(skipFirst=false) {
 let state=createPlayableSandboxScenario('101');
 state={...state,rules:{...state.rules,finiteTableau:true},foes:state.foes.map((f,i)=>i===0 && skipFirst?{...f,staggered:1}:f),columns:state.columns.map((_,i)=>i===0?[{id:'first',rank:10}]:i===1?[{id:'second',rank:7}]:[])};
 const hp=state.party[0].hp;
 state=endPlayerTurn(state);
 for(let i=0;i<60 && state.turn==='enemy';i++) state=tickBattle(state,1);
 return {state,hp};
}
it('gives each Mote an independent foundation and chip attack',()=>{
 const {state,hp}=encounter();
 expect(state.turn).toBe('party');
 expect(state.foes.map(f=>f.hp)).toEqual([10,10]);
 expect(state.foes.map(f=>f.rank)).toEqual([10,7]);
 expect(state.events.filter(e=>e.chipDamage).map(e=>e.sourceId)).toEqual(state.foes.map(f=>f.id));
 expect(state.party[0].hp).toBe(hp-2);
});
it('lets the second Mote act when the first is staggered',()=>{
 const {state,hp}=encounter(true);
 expect(state.foes.map(f=>f.rank)).toEqual([9,7]);
 expect(state.party[0].hp).toBe(hp-1);
 expect(state.events.filter(e=>e.chipDamage).map(e=>e.sourceId)).toEqual([state.foes[1].id]);
});
